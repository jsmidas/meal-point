import { NextRequest, NextResponse } from "next/server";
import { findOrCreateMember, createAuthResponse } from "@/lib/auth/social";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";

// 로그인 후 복귀 경로 — 상대경로만 허용(오픈 리다이렉트 방지)
function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // 콜백 처리
  if (action === "callback") {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = request.cookies.get("naver_oauth_state")?.value;
    const errTo = (err: string) => {
      const res = NextResponse.redirect(new URL(`/login?error=${err}`, request.url));
      res.cookies.set("naver_oauth_state", "", { path: "/", maxAge: 0 });
      res.cookies.set("oauth_next", "", { path: "/", maxAge: 0 });
      return res;
    };

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
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (tokenData.error || !tokenData.access_token) {
        console.error("[naver] token error:", tokenData.error, tokenData.error_description);
        return errTo("token_failed");
      }

      const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profileData = await profileRes.json();

      if (profileData.resultcode !== "00") {
        console.error("[naver] profile error:", profileData.resultcode, profileData.message);
        return errTo("profile_failed");
      }

      const { id: naverId, name, nickname, email } = profileData.response;

      const member = await findOrCreateMember({
        provider: "naver",
        provider_id: String(naverId),
        name: name || nickname || "네이버 사용자",
        email,
      });

      if (!member) {
        return errTo("inactive");
      }

      const nextPath = safeNext(request.cookies.get("oauth_next")?.value);
      const response = await createAuthResponse(member, new URL(nextPath, request.url).toString());
      response.cookies.set("naver_oauth_state", "", { path: "/", maxAge: 0 });
      response.cookies.set("oauth_next", "", { path: "/", maxAge: 0 });
      return response;
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
    maxAge: 60 * 10,
  });
  // 로그인 후 돌아올 경로 보존 (예: /account). 없으면 이전 시도의 값이 남지 않게 지운다.
  const nextPath = safeNext(searchParams.get("next"));
  response.cookies.set("oauth_next", nextPath === "/" ? "" : nextPath, {
    httpOnly: true,
    path: "/",
    maxAge: nextPath === "/" ? 0 : 60 * 10,
  });

  return response;
}
