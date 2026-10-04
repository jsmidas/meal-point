import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/guard";
import { bizCertSignedUrl, uploadBizCert, removeBizCert } from "@/lib/auth/biz-cert";

export const runtime = "nodejs";

/** 로그인한 회원 본인의 업체 정보·승인 상태. 관리자 계정은 대상이 아니다. */
async function memberSession(request: NextRequest) {
  const s = await getSession(request);
  if (!s || !s.id || (s.role !== "member" && s.role !== "company")) return null;
  return s;
}

const SELECT = "id, login_id, name, company_name, biz_number, phone, email, role, company_id, approval_status, biz_cert_path, approval_requested_at, approved_at, reject_reason, companies(name)";

export async function GET(request: NextRequest) {
  const s = await memberSession(request);
  if (!s) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: m, error } = await (supabase.from("members") as any).select(SELECT).eq("id", s.id).maybeSingle();
  if (error || !m) return NextResponse.json({ ok: false, error: error?.message || "회원 정보를 찾을 수 없습니다." }, { status: 404 });
  const certUrl = m.biz_cert_path ? await bizCertSignedUrl(supabase, m.biz_cert_path) : null;
  return NextResponse.json({
    ok: true,
    member: {
      id: m.id,
      login_id: m.login_id,
      name: m.name,
      company_name: m.company_name,
      biz_number: m.biz_number,
      phone: m.phone,
      email: m.email,
      role: m.role,
      approval_status: m.approval_status || "none",
      linked_company_name: m.companies?.name ?? null,
      has_cert: !!m.biz_cert_path,
      cert_url: certUrl,
      approval_requested_at: m.approval_requested_at,
      approved_at: m.approved_at,
      reject_reason: m.reject_reason,
    },
  });
}

/** 업체 정보 수정 + 사업자등록증 업로드 + 승인 요청 (multipart/form-data) */
export async function POST(request: NextRequest) {
  const s = await memberSession(request);
  if (!s) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
  const str = (k: string) => { const v = fd.get(k); return typeof v === "string" ? v.trim() : ""; };
  const company_name = str("company_name");
  const biz_number = str("biz_number").replace(/[^0-9-]/g, "");
  const phone = str("phone");
  const email = str("email");
  const name = str("name");
  const certRaw = fd.get("cert");
  const cert = certRaw instanceof File && certRaw.size > 0 ? certRaw : null;

  if (!company_name) return NextResponse.json({ ok: false, error: "업체명을 입력하세요." }, { status: 400 });
  if (biz_number && !/^\d{3}-?\d{2}-?\d{5}$/.test(biz_number)) {
    return NextResponse.json({ ok: false, error: "사업자등록번호 형식이 올바르지 않습니다. (예: 123-45-67890)" }, { status: 400 });
  }

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase.from("members") as any;
  const { data: m } = await db.select("id, approval_status, biz_cert_path").eq("id", s.id).maybeSingle();
  if (!m) return NextResponse.json({ ok: false, error: "회원 정보를 찾을 수 없습니다." }, { status: 404 });

  const patch: Record<string, unknown> = { company_name, biz_number: biz_number || null, phone: phone || null, email: email || null };
  if (name) patch.name = name;

  if (cert) {
    const up = await uploadBizCert(supabase, s.id as string, cert);
    if ("error" in up) return NextResponse.json({ ok: false, error: up.error }, { status: 400 });
    patch.biz_cert_path = up.path;
    if (m.biz_cert_path) await removeBizCert(supabase, m.biz_cert_path);
  }
  if (!cert && !m.biz_cert_path) {
    return NextResponse.json({ ok: false, error: "사업자등록증 파일을 올려주세요." }, { status: 400 });
  }

  // 승인 전 상태(none/rejected/pending)면 승인 요청으로 전환. 이미 승인된 업체는 정보만 갱신.
  if (m.approval_status !== "approved") {
    patch.approval_status = "pending";
    patch.approval_requested_at = new Date().toISOString();
    patch.reject_reason = null;
  }

  const { error } = await db.update(patch).eq("id", s.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, approval_status: patch.approval_status ?? m.approval_status });
}
