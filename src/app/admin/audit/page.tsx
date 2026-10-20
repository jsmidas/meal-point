"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import { logTypeLabel } from "@/lib/inventory";
import { ChevronDown, ChevronRight, History, RefreshCw } from "lucide-react";

/** audit_logs 행 */
interface AuditRow {
  id: string;
  at: string;
  actor_role: string;
  actor_id: string | null;
  actor_login: string | null;
  actor_name: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  row_count: number;
  before_data: unknown;
  after_data: unknown;
  filters: unknown;
  ip: string | null;
}

type Row = Record<string, unknown>;

const TABLE_LABELS: Record<string, string> = {
  auth: "로그인",
  inventory_logs: "입출고(입고·판매·자가소비)",
  inventory: "재고",
  sale_checks: "판매 확인",
  companies: "거래처",
  company_prices: "업체 단가",
  company_price_history: "단가 이력",
  products: "상품",
  product_pages: "상세페이지",
  orders: "주문",
  order_items: "주문 품목",
  quotes: "견적서",
  quote_items: "견적 품목",
  quote_send_logs: "견적 발송",
  statements: "거래명세서",
  statement_items: "명세서 품목",
  statement_send_logs: "명세서 발송",
  billings: "청구",
  payments: "입금",
  payment_requests: "개인결제",
  expenses: "비용",
  members: "계정",
  popups: "팝업",
  company_info: "회사 설정",
  meal_guest_accounts: "체험 계정",
  meal_trial_grants: "체험 권한",
};

const ACTION_LABELS: Record<string, string> = {
  insert: "등록",
  update: "수정",
  delete: "삭제",
  upsert: "저장",
  login: "로그인",
  create: "계정 발급",
  reset_password: "비밀번호 초기화",
  toggle_active: "활성/비활성",
  set_role: "권한 변경",
  approve: "가입 승인",
  reject: "가입 거절",
};

const ACTION_BADGE: Record<string, string> = {
  insert: "bg-emerald-400/10 text-emerald-400",
  create: "bg-emerald-400/10 text-emerald-400",
  upsert: "bg-emerald-400/10 text-emerald-400",
  update: "bg-sky-400/10 text-sky-400",
  delete: "bg-red-400/10 text-red-400",
  login: "bg-bg-dark text-text-muted",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "최고관리자",
  admin: "관리자",
  company: "발주 계정",
  member: "회원",
  anonymous: "미확인",
};

/** 행(들)을 배열로 */
function rows(value: unknown): Row[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v) => v && typeof v === "object") as Row[];
  return typeof value === "object" ? [value as Row] : [];
}

const HIDDEN_KEYS = new Set(["id", "created_at", "updated_at", "password_hash", "_truncated", "_bytes", "preview"]);

export default function AuditPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [days, setDays] = useState(30);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<Record<string, string>>({});
  const [companies, setCompanies] = useState<Record<string, string>>({});

  async function fetchData() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    let q = db.from("audit_logs").select("*").gte("at", since).order("at", { ascending: false }).limit(500);
    if (tableFilter) q = q.eq("table_name", tableFilter);
    if (actorFilter) q = q.eq("actor_login", actorFilter);
    const [logRes, prodRes, compRes] = await Promise.all([
      q,
      db.from("products").select("id, name"),
      db.from("companies").select("id, name"),
    ]);
    setLogs(logRes.data || []);
    setProducts(Object.fromEntries(((prodRes.data || []) as { id: string; name: string }[]).map((p) => [p.id, p.name])));
    setCompanies(Object.fromEntries(((compRes.data || []) as { id: string; name: string }[]).map((c) => [c.id, c.name])));
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableFilter, actorFilter, days]);

  const actors = useMemo(() => [...new Set(logs.map((l) => l.actor_login).filter(Boolean))] as string[], [logs]);

  /** id 참조를 이름으로, 알려진 컬럼은 읽기 쉽게 */
  function fmtValue(key: string, value: unknown): string {
    if (value === null || value === undefined || value === "") return "-";
    if (key === "product_id") return products[String(value)] || String(value).slice(0, 8);
    if (key === "company_id") return companies[String(value)] || String(value).slice(0, 8);
    if (key === "type" && typeof value === "string") return logTypeLabel(value);
    if (typeof value === "number") return formatNumber(value);
    if (typeof value === "boolean") return value ? "예" : "아니오";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  /** 한 줄 요약: 대상 행의 핵심 정보 */
  function summary(log: AuditRow): string {
    if (log.table_name === "auth") return `${log.actor_name || log.actor_login || ""} 로그인`;
    const after = rows(log.after_data);
    const before = rows(log.before_data);
    const r = after[0] || before[0];
    if (!r) return log.record_id ? `id ${log.record_id.slice(0, 8)}` : "";
    const parts: string[] = [];
    if (log.table_name === "inventory_logs") {
      if (r.type) parts.push(fmtValue("type", r.type));
      if (r.product_id) parts.push(fmtValue("product_id", r.product_id));
      else if (r.reason) parts.push(String(r.reason));
      if (r.quantity !== undefined) parts.push(`${fmtValue("quantity", r.quantity)}개`);
      if (r.company_id) parts.push(`→ ${fmtValue("company_id", r.company_id)}`);
      if (r.log_date) parts.push(String(r.log_date));
    } else if (log.table_name === "inventory") {
      if (r.product_id) parts.push(fmtValue("product_id", r.product_id));
      if (r.current_stock !== undefined) parts.push(`재고 ${fmtValue("current_stock", r.current_stock)}`);
      if (r.safety_stock !== undefined) parts.push(`안전재고 ${fmtValue("safety_stock", r.safety_stock)}`);
    } else {
      for (const k of ["name", "login_id", "statement_number", "order_number", "quote_number", "title", "description", "role"]) {
        if (r[k]) { parts.push(String(r[k])); break; }
      }
      if (r.company_id) parts.push(fmtValue("company_id", r.company_id));
      for (const k of ["amount", "total_amount", "custom_price", "sale_date", "payment_date", "billing_month", "statement_date"]) {
        if (r[k] !== undefined && r[k] !== null) parts.push(`${k.replace(/_/g, " ")} ${fmtValue(k, r[k])}`);
      }
    }
    const text = parts.join(" · ");
    return log.row_count > 1 ? `${text} 외 ${log.row_count - 1}건` : text;
  }

  /** 수정이면 바뀐 컬럼만, 등록/삭제면 전체 컬럼 */
  function diffRows(log: AuditRow): { key: string; before: string; after: string }[] {
    const b = rows(log.before_data)[0] || {};
    const a = rows(log.after_data)[0] || {};
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => !HIDDEN_KEYS.has(k));
    const out: { key: string; before: string; after: string }[] = [];
    for (const k of keys) {
      const bv = fmtValue(k, b[k]);
      const av = fmtValue(k, a[k]);
      if (log.action === "update" && bv === av) continue;
      out.push({ key: k, before: bv, after: av });
    }
    return out;
  }

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary inline-flex items-center gap-2">
            <History size={24} className="text-primary" /> 변경 이력
          </h1>
          <p className="text-sm text-text-muted mt-1">
            누가 언제 입고·판매·재고·거래처 등 데이터를 바꿨는지 기록합니다. 관리자 화면에서 저장한 모든 변경과 로그인이 남습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-text-secondary text-sm hover:bg-bg-card-hover transition-colors"
        >
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="기간"
          className="px-3 py-2 rounded-xl border border-border bg-bg-card text-text-primary text-sm focus:outline-none focus:border-primary"
        >
          <option value={7}>최근 7일</option>
          <option value={30}>최근 30일</option>
          <option value={90}>최근 90일</option>
          <option value={365}>최근 1년</option>
        </select>
        <select
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          aria-label="대상"
          className="px-3 py-2 rounded-xl border border-border bg-bg-card text-text-primary text-sm focus:outline-none focus:border-primary"
        >
          <option value="">모든 대상</option>
          {Object.entries(TABLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          aria-label="작업자"
          className="px-3 py-2 rounded-xl border border-border bg-bg-card text-text-primary text-sm focus:outline-none focus:border-primary"
        >
          <option value="">모든 작업자</option>
          {actors.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-text-muted">기록이 없습니다.</div>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-dark">
                  <th className="w-8" />
                  <th className="px-4 py-3 text-left text-text-muted font-medium">일시</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">작업자</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">작업</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">대상</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">내용</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isOpen = open.has(log.id);
                  const diff = isOpen ? diffRows(log) : [];
                  return (
                    <Fragment key={log.id}>
                      <tr
                        onClick={() => toggle(log.id)}
                        className="border-b border-border hover:bg-bg-card-hover transition-colors cursor-pointer"
                      >
                        <td className="pl-3 text-text-muted">
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">
                          {new Date(log.at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-text-primary font-medium">{log.actor_name || log.actor_login || "-"}</span>
                          {log.actor_login && log.actor_name && (
                            <span className="text-text-muted text-xs ml-1 font-mono">{log.actor_login}</span>
                          )}
                          <span className="block text-[11px] text-text-muted">{ROLE_LABELS[log.actor_role] || log.actor_role}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_BADGE[log.action] || "bg-sky-400/10 text-sky-400"}`}>
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                          {TABLE_LABELS[log.table_name] || log.table_name}
                        </td>
                        <td className="px-4 py-3 text-text-primary">{summary(log)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border bg-bg-dark/60">
                          <td />
                          <td colSpan={5} className="px-4 py-3">
                            {log.table_name === "auth" ? (
                              <p className="text-xs text-text-muted">IP {log.ip || "-"}</p>
                            ) : diff.length === 0 ? (
                              <p className="text-xs text-text-muted">상세 내용 없음 {log.record_id && `(id ${log.record_id})`}</p>
                            ) : (
                              <table className="text-xs">
                                <thead>
                                  <tr className="text-text-muted">
                                    <th className="text-left pr-6 pb-1 font-medium">항목</th>
                                    {log.action !== "insert" && log.action !== "create" && <th className="text-left pr-6 pb-1 font-medium">변경 전</th>}
                                    {log.action !== "delete" && <th className="text-left pb-1 font-medium">변경 후</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {diff.map((d) => (
                                    <tr key={d.key}>
                                      <td className="pr-6 py-0.5 text-text-muted font-mono">{d.key}</td>
                                      {log.action !== "insert" && log.action !== "create" && <td className="pr-6 py-0.5 text-red-300/80">{d.before}</td>}
                                      {log.action !== "delete" && <td className="py-0.5 text-emerald-300/90">{d.after}</td>}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            <p className="mt-2 text-[11px] text-text-muted">
                              {log.row_count > 1 && `${log.row_count}건 일괄 · `}
                              {log.ip && `IP ${log.ip}`}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {logs.length >= 500 && (
            <p className="px-4 py-2 text-xs text-text-muted border-t border-border">최근 500건까지만 표시합니다. 기간이나 대상을 좁혀 보세요.</p>
          )}
        </div>
      )}
    </div>
  );
}
