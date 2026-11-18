import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/password";
import { uploadBizCert } from "@/lib/auth/biz-cert";
import { clientIp, lockedUntil, recordAttempt, type ThrottleRule } from "@/lib/auth/throttle";

export const runtime = "nodejs";

/**
 * 홈페이지 회원가입(업체 승인 요청).
 * multipart/form-data: login_id, password, name(담당자), company_name, biz_number, phone, email, cert(파일)
 * JSON 도 받되 파일은 multipart 에서만 가능.
 * 사업자등록증(cert)은 선택. 첨부해 업로드에 성공했을 때만 approval_status='pending'(승인 요청)이 되고,
 * 없으면 'none' 으로 가입만 된다 — 이후 '내 정보'(/api/account)에서 올리면 승인 요청으로 전환된다.
 */
// 같은 IP에서 1시간에 5번까지만 가입 시도를 받는다 (자동 가입 스팸 방지)
const REGISTER_RULE: ThrottleRule = { max: 5, windowMs: 60 * 60 * 1000, lockMs: 60 * 60 * 1000 };

export async function POST(request: NextRequest) {
  const throttleKey = `register:${clientIp(request)}`;
  if (await lockedUntil(throttleKey)) {
    return NextResponse.json(
      { ok: false, error: "가입 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

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

  // 대소문자만 다른 아이디(예: daham01 / Daham01)는 같은 아이디로 본다 — 사칭·혼동 방지
  const { data: existingRows, error: existingError } = await db
    .select("id")
    // 아이디에 허용된 문자 중 "_" 만 LIKE 와일드카드라서 그것만 이스케이프한다
    .ilike("login_id", login_id.replace(/_/g, "\\_"))
    .limit(1);
  if (existingError) {
    console.error("[register] 아이디 중복 확인 실패", existingError.message);
    return NextResponse.json({ ok: false, error: "일시적인 오류입니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  const existing = existingRows && existingRows.length > 0;
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
      approval_status: "none",
    })
    .select("id")
    .single();

  if (error || !created) {
    // 동시에 같은 아이디로 가입한 경우(중복 제약 위반)는 "이미 사용 중"으로 안내
    if (error?.code === "23505") {
      return NextResponse.json({ ok: false, error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }
    console.error("[register] 회원 등록 실패", error?.message);
    return NextResponse.json({ ok: false, error: "회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  await recordAttempt(throttleKey, REGISTER_RULE);

  let certWarning: string | null = null;
  if (cert) {
    const up = await uploadBizCert(supabase, created.id, cert);
    if ("path" in up) {
      await db
        .update({ biz_cert_path: up.path, approval_status: "pending", approval_requested_at: new Date().toISOString() })
        .eq("id", created.id);
    } else {
      certWarning = up.error;
    }
  }

  return NextResponse.json({ ok: true, cert_uploaded: !!cert && !certWarning, warning: certWarning });
}
