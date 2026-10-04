/** 세션 역할 정의 — 클라이언트/서버 공용(비밀값 없음). */
export type SessionRole = "super_admin" | "admin" | "company" | "member";

/** 관리자 화면(/admin)과 관리자 API에 접근할 수 있는 역할 */
export const ADMIN_ROLES: ReadonlySet<string> = new Set(["super_admin", "admin"]);

export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && ADMIN_ROLES.has(role);
}

/** 역할별 로그인 후 기본 진입 경로 */
export function homeForRole(role: string | null | undefined): string {
  if (isAdminRole(role)) return "/admin";
  return "/";
}
