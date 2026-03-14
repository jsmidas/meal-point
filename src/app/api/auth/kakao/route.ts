import { NextRequest, NextResponse } from "next/server";
import { findOrCreateMember, createAuthResponse } from "@/lib/auth/social";

const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID || "";
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET || "";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // 콜백 처리
  if (action === "callback") {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = request.cookies.get("kakao_oauth_state")?.value;

    if (!code || !state || state !== storedState) {
      return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
    }

    try {
      const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
      const callbackUrl = `${baseUrl}/api/auth/kakao?action=callback`;

      // 토큰 발급
      const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: KAKAO_CLIENT_ID,
          client_secret: KAKAO_CLIENT_SECRET,
          redirect_uri: callbackUrl,
          code,
        }),
      });
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        return NextResponse.redirect(new URL("/login?error=token_failed", request.url));
      }

      // 사용자 정보 조회
      const profileRes = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profileData = await profileRes.json();

      const kakaoId = String(profileData.id);
      const name =
        profileData.kakao_account?.profile?.nickname || "카카오 사용자";
      const email = profileData.kakao_account?.email || null;

      const member = await findOrCreateMember({
        provider: "kakao",
        provider_id: kakaoId,
        name,
        email,
      });

      if (!member) {
        return NextResponse.redirect(new URL("/login?error=inactive", request.url));
      }

      const response = createAuthResponse(member, new URL("/", request.url).toString());
      response.cookies.set("kakao_oauth_state", "", { path: "/", maxAge: 0 });
      return response;
    } catch {
      return NextResponse.redirect(new URL("/login?error=kakao_failed", request.url));
    }
  }

  // 카카오 로그인 시작
  const state = crypto.randomUUID();
  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const callbackUrl = `${baseUrl}/api/auth/kakao?action=callback`;

  const kakaoAuthUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  kakaoAuthUrl.searchParams.set("response_type", "code");
  kakaoAuthUrl.searchParams.set("client_id", KAKAO_CLIENT_ID);
  kakaoAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  kakaoAuthUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(kakaoAuthUrl.toString());
  response.cookies.set("kakao_oauth_state", state, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
