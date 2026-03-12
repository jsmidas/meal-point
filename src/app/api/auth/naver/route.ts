import { NextRequest, NextResponse } from "next/server";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";
const COOKIE_NAME = "mp_admin_token";
const TOKEN_VALUE = "mealpoint-admin-authenticated";

// 네이버 로그인 시작: 네이버 인증 URL로 리다이렉트
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // 콜백 처리
  if (action === "callback") {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = request.cookies.get("naver_oauth_state")?.value;

    // state 검증 (CSRF 방지)
    if (!code || !state || state !== storedState) {
      return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
    }

    try {
      // 토큰 발급
      const tokenRes = await fetch(
        `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${NAVER_CLIENT_ID}&client_secret=${NAVER_CLIENT_SECRET}&code=${code}&state=${state}`,
        { method: "GET" }
      );
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        return NextResponse.redirect(new URL("/login?error=token_failed", request.url));
      }

      // 사용자 정보 조회
      const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profileData = await profileRes.json();

      if (profileData.resultcode !== "00") {
        return NextResponse.redirect(new URL("/login?error=profile_failed", request.url));
      }

      const { name, email } = profileData.response;

      // 관리자 인증 쿠키 설정 (기존 시스템과 동일)
      const response = NextResponse.redirect(new URL("/admin", request.url));
      response.cookies.set(COOKIE_NAME, TOKEN_VALUE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7일
      });
      // 사용자 정보를 별도 쿠키에 저장
      response.cookies.set("mp_user_info", JSON.stringify({ name, email, provider: "naver" }), {
        httpOnly: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      // state 쿠키 삭제
      response.cookies.set("naver_oauth_state", "", { path: "/", maxAge: 0 });

      return response;
    } catch {
      return NextResponse.redirect(new URL("/login?error=naver_failed", request.url));
    }
  }

  // 네이버 로그인 시작
  const state = crypto.randomUUID();
  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const callbackUrl = `${baseUrl}/api/auth/naver?action=callback`;

  const naverAuthUrl = new URL("https://nid.naver.com/oauth2.0/authorize");
  naverAuthUrl.searchParams.set("response_type", "code");
  naverAuthUrl.searchParams.set("client_id", NAVER_CLIENT_ID);
  naverAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  naverAuthUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(naverAuthUrl.toString());
  response.cookies.set("naver_oauth_state", state, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 10, // 10분
  });

  return response;
}
