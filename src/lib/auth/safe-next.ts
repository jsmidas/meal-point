/**
 * 로그인 후 돌아갈 경로(next) 검증 — 클라이언트/서버 공용(비밀값 없음).
 *
 * 같은 사이트 안의 경로만 허용한다. 단순히 "/" 로 시작하는지만 보면
 * "/\evil.com" 이나 "/<탭>/evil.com" 같은 값이 브라우저·URL 해석기에서 "//evil.com"(외부 사이트)로
 * 바뀌어 통과하므로, 허용 문자만으로 이뤄졌는지와 실제 해석 결과가 같은 출처인지를 함께 확인한다.
 */
const ALLOWED = /^\/[A-Za-z0-9\-._~/?&=%+:@,;!*'()[\]]*$/;
const PROBE_ORIGIN = "https://site.invalid";

/** 안전한 내부 경로면 그 값을, 아니면 null 을 돌려준다. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || typeof next !== "string" || next.length > 512) return null;
  if (!ALLOWED.test(next)) return null; // 백슬래시·공백·제어문자 등 차단
  // 연속 슬래시와 상위 경로(..)는 해석 과정에서 "//외부주소"로 바뀔 수 있어 아예 받지 않는다
  const pathPart = next.split("?")[0];
  if (pathPart.includes("//") || /(^|\/)\.\.?(\/|$)/.test(pathPart)) return null;
  try {
    const u = new URL(next, PROBE_ORIGIN);
    if (u.origin !== PROBE_ORIGIN) return null;
    const result = u.pathname + u.search;
    // 해석 결과도 한 번 더 확인 (다시 해석해도 같은 출처여야 한다)
    if (result.startsWith("//") || new URL(result, PROBE_ORIGIN).origin !== PROBE_ORIGIN) return null;
    return result;
  } catch {
    return null;
  }
}

/** 안전한 내부 경로 또는 기본값("/") */
export function safeNextOr(next: string | null | undefined, fallback = "/"): string {
  return safeNextPath(next) ?? fallback;
}
