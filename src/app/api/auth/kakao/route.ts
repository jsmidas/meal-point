import { NextRequest, NextResponse } from "next/server";
import {
  findOrCreateMember,
  oauthBaseUrl,
  oauthErrorRedirect,
  oauthSuccessRedirect,
  startOAuthRedirect,
} from "@/lib/auth/social";

export const runtime = "nodejs";

const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID || "";
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET || "";
const STATE_COOKIE = "kakao_oauth_state";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // 콜백 처리
  if (action === "callback") {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = request.cookies.get(STATE_COOKIE)?.value;
    // 오류 시 복귀 경로는 공통 처리(oauthErrorRedirect)가 정한다: 체험 신청에서 시작했으면 /trial, 그 외 /login
    const errTo = (err: string) => oauthErrorRedirect(request, STATE_COOKIE, err);

    // 사용자가 카카오 동의 화면에서 취소한 경우 (error=access_denied)
    if (searchParams.get("error")) {
      return errTo("cancelled");
    }

    if (!code || !state || state !== storedState) {
      return errTo("invalid_state");
    }

    try {
      const callbackUrl = `${oauthBaseUrl(request)}/api/auth/kakao?action=callback`;

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
        cache: "no-store",
      });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
        console.error("[kakao] token error:", tokenData.error, tokenData.error_description);
        return errTo("token_failed");
      }

      // 사용자 정보 조회
      const profileRes = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        cache: "no-store",
      });
      const profileData = await profileRes.json();

      // 조회가 실패하면 id 가 없다 — 그대로 진행하면 엉뚱한 계정이 만들어지므로 반드시 확인
      if (!profileRes.ok || profileData.id === undefined || profileData.id === null) {
        console.error("[kakao] profile error:", profileData.code, profileData.msg);
        return errTo("profile_failed");
      }

      const result = await findOrCreateMember({
        provider: "kakao",
        provider_id: profileData.id,
        name: profileData.kakao_account?.profile?.nickname || "카카오 사용자",
        email: profileData.kakao_account?.email || null,
      });
      if (result.status === "inactive") return errTo("inactive");
      if (result.status !== "ok") return errTo("kakao_failed");

      return await oauthSuccessRedirect(request, STATE_COOKIE, result.member);
    } catch (e) {
      console.error("[kakao] login failed:", e);
      return errTo("kakao_failed");
    }
  }

  // 키 미설정 시 카카오 오류 화면 대신 로그인 페이지에서 안내
  if (!KAKAO_CLIENT_ID) {
    return NextResponse.redirect(new URL("/login?error=not_configured", request.url));
  }

  // 카카오 로그인 시작
  const state = crypto.randomUUID();
  const callbackUrl = `${oauthBaseUrl(request)}/api/auth/kakao?action=callback`;

  const kakaoAuthUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  kakaoAuthUrl.searchParams.set("response_type", "code");
  kakaoAuthUrl.searchParams.set("client_id", KAKAO_CLIENT_ID);
  kakaoAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  kakaoAuthUrl.searchParams.set("state", state);

  return startOAuthRedirect(request, kakaoAuthUrl, STATE_COOKIE, state);
}
