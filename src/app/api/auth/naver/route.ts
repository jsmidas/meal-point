import { NextRequest, NextResponse } from "next/server";
import { findOrCreateMember, createAuthResponse } from "@/lib/auth/social";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // 콜백 처리
  if (action === "callback") {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = request.cookies.get("naver_oauth_state")?.value;

    if (!code || !state || state !== storedState) {
      return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
    }

    try {
      const tokenRes = await fetch(
        `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${NAVER_CLIENT_ID}&client_secret=${NAVER_CLIENT_SECRET}&code=${code}&state=${state}`
      );
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        return NextResponse.redirect(new URL("/login?error=token_failed", request.url));
      }

      const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profileData = await profileRes.json();

      if (profileData.resultcode !== "00") {
        return NextResponse.redirect(new URL("/login?error=profile_failed", request.url));
      }

      const { id: naverId, name, email } = profileData.response;

      const member = await findOrCreateMember({
        provider: "naver",
        provider_id: naverId,
        name: name || "네이버 사용자",
        email,
      });

      if (!member) {
        return NextResponse.redirect(new URL("/login?error=inactive", request.url));
      }

      const response = createAuthResponse(member, new URL("/", request.url).toString());
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
    maxAge: 60 * 10,
  });

  return response;
}
