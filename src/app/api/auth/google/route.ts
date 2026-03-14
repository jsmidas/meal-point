import { NextRequest, NextResponse } from "next/server";
import { findOrCreateMember, createAuthResponse } from "@/lib/auth/social";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // 콜백 처리
  if (action === "callback") {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = request.cookies.get("google_oauth_state")?.value;

    if (!code || !state || state !== storedState) {
      return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
    }

    try {
      const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
      const callbackUrl = `${baseUrl}/api/auth/google?action=callback`;

      // 토큰 발급
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: callbackUrl,
          code,
        }),
      });
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        return NextResponse.redirect(new URL("/login?error=token_failed", request.url));
      }

      // 사용자 정보 조회
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profileData = await profileRes.json();

      const member = await findOrCreateMember({
        provider: "google",
        provider_id: profileData.id,
        name: profileData.name || "구글 사용자",
        email: profileData.email || null,
      });

      if (!member) {
        return NextResponse.redirect(new URL("/login?error=inactive", request.url));
      }

      const response = createAuthResponse(member, new URL("/", request.url).toString());
      response.cookies.set("google_oauth_state", "", { path: "/", maxAge: 0 });
      return response;
    } catch {
      return NextResponse.redirect(new URL("/login?error=google_failed", request.url));
    }
  }

  // 구글 로그인 시작
  const state = crypto.randomUUID();
  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const callbackUrl = `${baseUrl}/api/auth/google?action=callback`;

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", state);
  googleAuthUrl.searchParams.set("access_type", "offline");

  const response = NextResponse.redirect(googleAuthUrl.toString());
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
