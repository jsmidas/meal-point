/**
 * 관리자 화면 전용 Supabase 프록시.
 *
 * 관리자 페이지의 데이터 조회(PostgREST)와 파일 업로드(Storage)는 anon 키로 직접 Supabase 에 가지 않고
 * 이 라우트를 거친다. 서명된 관리자 세션이 있을 때만 service_role 키로 대신 호출하므로,
 * anon 키의 RLS 읽기 권한을 공개 테이블(products, product_pages, company_info, popups)만 남겨도 관리자 화면이 동작한다.
 *
 * 허용 범위
 *  - rest/v1/<table>            : GET / HEAD 만 (쓰기는 /api/db 를 통해서만)
 *  - storage/v1/object/logos/…  : GET / POST / PUT / DELETE (logos 버킷만)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 전달하지 않을 요청 헤더
const DROP_REQ_HEADERS = new Set(["host", "cookie", "connection", "content-length", "apikey", "authorization", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip"]);
// 전달할 응답 헤더
const KEEP_RES_HEADERS = ["content-type", "content-range", "range-unit", "x-total-count", "cache-control", "etag", "last-modified", "location", "sb-request-id"];

function allowed(path: string, method: string): boolean {
  if (path.startsWith("rest/v1/")) {
    return method === "GET" || method === "HEAD";
  }
  if (path.startsWith("storage/v1/object/logos/") || path === "storage/v1/object/logos") {
    return ["GET", "HEAD", "POST", "PUT", "DELETE"].includes(method);
  }
  return false;
}

async function proxy(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "Supabase 서버 설정이 없습니다." }, { status: 500 });
  }

  const { path: segs } = await ctx.params;
  const path = segs.map(decodeURIComponent).map(encodeURIComponent).join("/");
  const method = request.method.toUpperCase();
  if (!allowed(path, method)) {
    return NextResponse.json({ error: `허용되지 않는 요청: ${method} /${path}` }, { status: 403 });
  }

  const target = `${SUPABASE_URL}/${path}${request.nextUrl.search}`;
  const headers = new Headers();
  request.headers.forEach((v, k) => {
    if (!DROP_REQ_HEADERS.has(k.toLowerCase())) headers.set(k, v);
  });
  headers.set("apikey", SERVICE_KEY);
  headers.set("Authorization", `Bearer ${SERVICE_KEY}`);

  const hasBody = method !== "GET" && method !== "HEAD";
  const upstream = await fetch(target, {
    method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
    cache: "no-store",
  });

  const resHeaders = new Headers();
  for (const h of KEEP_RES_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) resHeaders.set(h, v);
  }
  resHeaders.set("cache-control", "no-store");
  return new NextResponse(method === "HEAD" ? null : upstream.body, { status: upstream.status, headers: resHeaders });
}

export { proxy as GET, proxy as HEAD, proxy as POST, proxy as PUT, proxy as DELETE };
