import { NextRequest, NextResponse } from "next/server";
import {
  findOrCreateMember,
  oauthBaseUrl,
  oauthErrorRedirect,
  oauthSuccessRedirect,
  startOAuthRedirect,
} from "@/lib/auth/social";

export const runtime = "nodejs";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const STATE_COOKIE = "google_oauth_state";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // 콜백 처리
  if (action === "callback") {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = request.cookies.get(STATE_COOKIE)?.value;
    const errTo = (err: string) => oauthErrorRedirect(request, STATE_COOKIE, err);

    // 사용자가 구글 동의 화면에서 취소한 경우 (error=access_denied)
    if (searchParams.get("error")) {
      return errTo("cancelled");
    }

    if (!code || !state || state !== storedState) {
      return errTo("invalid_state");
    }

    try {
      const callbackUrl = `${oauthBaseUrl(request)}/api/auth/google?action=callback`;

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
        cache: "no-store",
      });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
        console.error("[google] token error:", tokenData.error, tokenData.error_description);
        return errTo("token_failed");
      }

      // 사용자 정보 조회
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        cache: "no-store",
      });
      const profileData = await profileRes.json();

      // 조회가 실패하면 id 가 없다 — 그대로 진행하면 식별값 없는 유령 회원이 만들어지므로 반드시 확인
      if (!profileRes.ok || !profileData.id) {
        console.error("[google] profile error:", profileData.error?.message || profileRes.status);
        return errTo("profile_failed");
      }

      const result = await findOrCreateMember({
        provider: "google",
        provider_id: profileData.id,
        name: profileData.name || "구글 사용자",
        email: profileData.email || null,
      });
      if (result.status === "inactive") return errTo("inactive");
      if (result.status !== "ok") return errTo("google_failed");

      return await oauthSuccessRedirect(request, STATE_COOKIE, result.member);
    } catch (e) {
      console.error("[google] login failed:", e);
      return errTo("google_failed");
    }
  }

  // 키 미설정 시 구글 오류 화면 대신 로그인 페이지에서 안내
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/login?error=not_configured", request.url));
  }

  // 구글 로그인 시작
  const state = crypto.randomUUID();
  const callbackUrl = `${oauthBaseUrl(request)}/api/auth/google?action=callback`;

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", state);
  googleAuthUrl.searchParams.set("access_type", "offline");

  return startOAuthRedirect(request, googleAuthUrl, STATE_COOKIE, state);
}
