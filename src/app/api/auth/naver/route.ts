import { NextRequest, NextResponse } from "next/server";
import {
  findOrCreateMember,
  oauthBaseUrl,
  oauthErrorRedirect,
  oauthSuccessRedirect,
  startOAuthRedirect,
} from "@/lib/auth/social";

export const runtime = "nodejs";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";
const STATE_COOKIE = "naver_oauth_state";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // 콜백 처리
  if (action === "callback") {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = request.cookies.get(STATE_COOKIE)?.value;
    const errTo = (err: string) => oauthErrorRedirect(request, STATE_COOKIE, err);

    // 사용자가 네이버 동의 화면에서 취소한 경우 (error=access_denied)
    if (searchParams.get("error")) {
      return errTo("cancelled");
    }

    if (!code || !state || state !== storedState) {
      return errTo("invalid_state");
    }

    try {
      const tokenUrl = new URL("https://nid.naver.com/oauth2.0/token");
      tokenUrl.searchParams.set("grant_type", "authorization_code");
      tokenUrl.searchParams.set("client_id", NAVER_CLIENT_ID);
      tokenUrl.searchParams.set("client_secret", NAVER_CLIENT_SECRET);
      tokenUrl.searchParams.set("code", code);
      tokenUrl.searchParams.set("state", state);
      const tokenRes = await fetch(tokenUrl, { cache: "no-store" });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
        console.error("[naver] token error:", tokenData.error, tokenData.error_description);
        return errTo("token_failed");
      }

      const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        cache: "no-store",
      });
      const profileData = await profileRes.json();

      if (!profileRes.ok || profileData.resultcode !== "00" || !profileData.response?.id) {
        console.error("[naver] profile error:", profileData.resultcode, profileData.message);
        return errTo("profile_failed");
      }

      const { id: naverId, name, nickname, email } = profileData.response;

      const result = await findOrCreateMember({
        provider: "naver",
        provider_id: naverId,
        name: name || nickname || "네이버 사용자",
        email,
      });
      if (result.status === "inactive") return errTo("inactive");
      if (result.status !== "ok") return errTo("naver_failed");

      return await oauthSuccessRedirect(request, STATE_COOKIE, result.member);
    } catch (e) {
      console.error("[naver] login failed:", e);
      return errTo("naver_failed");
    }
  }

  // 키 미설정 시 네이버 오류 화면 대신 로그인 페이지에서 안내
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/login?error=naver_not_configured", request.url));
  }

  // 네이버 로그인 시작
  const state = crypto.randomUUID();
  const callbackUrl = `${oauthBaseUrl(request)}/api/auth/naver?action=callback`;

  const naverAuthUrl = new URL("https://nid.naver.com/oauth2.0/authorize");
  naverAuthUrl.searchParams.set("response_type", "code");
  naverAuthUrl.searchParams.set("client_id", NAVER_CLIENT_ID);
  naverAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  naverAuthUrl.searchParams.set("state", state);

  return startOAuthRedirect(request, naverAuthUrl, STATE_COOKIE, state);
}
