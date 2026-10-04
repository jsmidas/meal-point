import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/password";
import { uploadBizCert } from "@/lib/auth/biz-cert";

export const runtime = "nodejs";

/**
 * 홈페이지 회원가입(업체 승인 요청).
 * multipart/form-data: login_id, password, name(담당자), company_name, biz_number, phone, email, cert(파일)
 * JSON 도 받되 파일은 multipart 에서만 가능.
 * 가입 즉시 approval_status='pending' 으로 두고, 관리자가 거래처에 연결해 승인한다.
 */
export async function POST(request: NextRequest) {
  let fields: Record<string, string> = {};
  let cert: File | null = null;
  const ct = request.headers.get("content-type") || "";
  try {
    if (ct.includes("multipart/form-data")) {
      const fd = await request.formData();
      for (const [k, v] of fd.entries()) {
        if (v instanceof File) { if (k === "cert" && v.size > 0) cert = v; }
        else fields[k] = String(v);
      }
    } else {
      const body = await request.json();
      fields = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, v == null ? "" : String(v)]));
    }
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const login_id = (fields.login_id || "").trim();
  const password = fields.password || "";
  const name = (fields.name || "").trim();
  const company_name = (fields.company_name || "").trim();
  const biz_number = (fields.biz_number || "").replace(/[^0-9-]/g, "").trim();
  const phone = (fields.phone || "").trim();
  const email = (fields.email || "").trim();

  if (!login_id || !password || !name || !company_name) {
    return NextResponse.json({ ok: false, error: "아이디, 비밀번호, 담당자명, 업체명은 필수입니다." }, { status: 400 });
  }
  if (login_id.length < 4 || login_id.length > 64 || !/^[A-Za-z0-9_.@-]+$/.test(login_id)) {
    return NextResponse.json({ ok: false, error: "아이디는 4자 이상의 영문·숫자·기호(_ . @ -)만 쓸 수 있습니다." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ ok: false, error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }
  if (biz_number && !/^\d{3}-?\d{2}-?\d{5}$/.test(biz_number)) {
    return NextResponse.json({ ok: false, error: "사업자등록번호 형식이 올바르지 않습니다. (예: 123-45-67890)" }, { status: 400 });
  }

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase.from("members") as any;

  const { data: existing } = await db.select("id").eq("login_id", login_id).maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: false, error: "이미 사용 중인 아이디입니다." }, { status: 409 });
  }

  const password_hash = await hashPassword(password);
  const { data: created, error } = await db
    .insert({
      login_id,
      password_hash,
      name,
      company_name,
      biz_number: biz_number || null,
      phone: phone || null,
      email: email || null,
      provider: "local",
      role: "member",
      is_active: true,
      approval_status: "pending",
      approval_requested_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json({ ok: false, error: "회원가입에 실패했습니다. " + (error?.message || "") }, { status: 500 });
  }

  let certWarning: string | null = null;
  if (cert) {
    const up = await uploadBizCert(supabase, created.id, cert);
    if ("path" in up) {
      await db.update({ biz_cert_path: up.path }).eq("id", created.id);
    } else {
      certWarning = up.error;
    }
  }

  return NextResponse.json({ ok: true, cert_uploaded: !!cert && !certWarning, warning: certWarning });
}
