import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * 관리자 화면(/admin)에서는 Supabase 요청을 같은 출처의 /api/sb 프록시로 보낸다.
 * 프록시는 서명된 관리자 세션 쿠키를 확인한 뒤 service_role 로 대신 호출한다.
 * 그 외(공개 홈페이지)는 anon 키로 Supabase 에 직접 요청한다 — anon 은 공개 테이블만 읽을 수 있다.
 */
function isAdminPage(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
}

const proxiedFetch: typeof fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith(SUPABASE_URL + "/")) {
    const rewritten = "/api/sb/" + url.slice(SUPABASE_URL.length + 1);
    // 프록시가 서버 키를 붙이므로 클라이언트의 apikey/Authorization 은 제거
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.delete("apikey");
    headers.delete("authorization");
    return fetch(rewritten, { ...init, headers, credentials: "same-origin" });
  }
  return fetch(input, init);
};

export function createClient() {
  if (isAdminPage()) {
    return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { fetch: proxiedFetch },
    });
  }
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
