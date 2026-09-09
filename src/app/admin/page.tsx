"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatNumber, ORDER_STATUS } from "@/lib/utils";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Wallet,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

/* ───────── 타입 ───────── */

interface WeekOrder {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  total_amount: number;
  company_id: string;
  companyName: string;
  saleRegistered: boolean; // 같은 날·같은 거래처 판매(출고) 등록 여부
}

interface UnpaidRow {
  companyId: string;
  companyName: string;
  outstanding: number;
  months: string[]; // 미수가 남은 청구월
}

interface RecentSale {
  key: string;
  date: string;
  companyName: string;
  amount: number;
  itemCount: number;
}

interface DashboardData {
  companies: number;
  products: number;
  monthSales: number; // 이번 달 판매액 (출고 로그 기준)
  monthPaid: number; // 이번 달 입금액
  totalUnpaid: number; // 누계 미수금 (청구 - 입금)
  pendingPortalOrders: number; // 승인 대기 포털 발주
  weekOrders: WeekOrder[];
  unpaid: UnpaidRow[];
  recentSales: RecentSale[];
}

/* ───────── 날짜 유틸 ───────── */

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 이번 주 월~일 */
function thisWeekRange(now: Date) {
  const day = now.getDay(); // 0=일
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  return { start: ymd(mon), end: ymd(sun) };
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
function shortDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAY[d.getDay()]})`;
}

/* ───────── 페이지 ───────── */

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const today = useMemo(() => ymd(new Date()), []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      const now = new Date();
      const monthStart = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
      const monthEnd = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const week = thisWeekRange(now);

      const [compRes, prodRes, salesRes, payRes, billRes, pendingRes, weekOrderRes, weekSaleRes, recentRes] =
        await Promise.all([
          db.from("companies").select("id", { count: "exact", head: true }).eq("is_active", true),
          db.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
          // 이번 달 판매(출고) 로그
          db.from("inventory_logs").select("quantity, unit_price").eq("type", "out").gte("log_date", monthStart).lte("log_date", monthEnd),
          // 이번 달 입금
          db.from("payments").select("amount").gte("payment_date", monthStart).lte("payment_date", monthEnd),
          // 전체 청구 (미수 계산: 청구 - 입금)
          db.from("billings").select("company_id, billing_month, total_amount, paid_amount, companies(name)"),
          // 승인 대기 포털 발주
          db.from("orders").select("id", { count: "exact", head: true }).eq("source", "portal").eq("status", "pending"),
          // 금주 출고 예정 주문
          db.from("orders").select("id, order_number, order_date, status, total_amount, company_id, companies(name)")
            .gte("order_date", week.start).lte("order_date", week.end).neq("status", "cancelled")
            .order("order_date", { ascending: true }),
          // 금주 판매 등록 여부 확인용
          db.from("inventory_logs").select("company_id, log_date").eq("type", "out").gte("log_date", week.start).lte("log_date", week.end),
          // 최근 판매 등록
          db.from("inventory_logs").select("id, company_id, log_date, quantity, unit_price, created_at, companies(name)")
            .eq("type", "out").order("log_date", { ascending: false }).order("created_at", { ascending: false }).limit(60),
        ]);

      // 이번 달 판매액
      const monthSales = (salesRes.data || []).reduce(
        (s: number, l: { quantity: number; unit_price: number }) => s + (l.quantity || 0) * (l.unit_price || 0), 0);
      // 이번 달 입금액
      const monthPaid = (payRes.data || []).reduce((s: number, p: { amount: number }) => s + (p.amount || 0), 0);

      // 미수금: 거래처별 (청구 - 입금) 합산. 정산 관리와 동일하게 과입금(음수)도 총액에 반영
      let totalUnpaid = 0;
      const unpaidMap = new Map<string, UnpaidRow>();
      for (const b of billRes.data || []) {
        const out = (b.total_amount || 0) - (b.paid_amount || 0);
        totalUnpaid += out;
        if (out <= 0) continue;
        const row: UnpaidRow = unpaidMap.get(b.company_id) || {
          companyId: b.company_id,
          companyName: b.companies?.name || "(거래처 없음)",
          outstanding: 0,
          months: [],
        };
        row.outstanding += out;
        row.months.push(b.billing_month);
        unpaidMap.set(b.company_id, row);
      }
      const unpaid = Array.from(unpaidMap.values())
        .map((r) => ({ ...r, months: r.months.sort() }))
        .sort((a, b) => b.outstanding - a.outstanding);

      // 금주 출고 예정 + 판매 등록 여부
      const saleKeys = new Set<string>(
        (weekSaleRes.data || []).map((l: { company_id: string | null; log_date: string }) => `${l.log_date?.slice(0, 10)}_${l.company_id}`),
      );
      const weekOrders: WeekOrder[] = (weekOrderRes.data || []).map(
        (o: { id: string; order_number: string; order_date: string; status: string; total_amount: number; company_id: string; companies?: { name: string } | null }) => ({
          id: o.id,
          order_number: o.order_number,
          order_date: o.order_date?.slice(0, 10),
          status: o.status,
          total_amount: o.total_amount || 0,
          company_id: o.company_id,
          companyName: o.companies?.name || "—",
          saleRegistered: saleKeys.has(`${o.order_date?.slice(0, 10)}_${o.company_id}`),
        }),
      );

      // 최근 판매 등록: 날짜+거래처 단위로 묶어 5건
      const recentMap = new Map<string, RecentSale>();
      for (const l of recentRes.data || []) {
        const date = l.log_date?.slice(0, 10);
        const key = `${date}_${l.company_id}`;
        if (!recentMap.has(key) && recentMap.size >= 5) continue;
        const row = recentMap.get(key) || { key, date, companyName: l.companies?.name || "(거래처 없음)", amount: 0, itemCount: 0 };
        row.amount += (l.quantity || 0) * (l.unit_price || 0);
        row.itemCount += 1;
        recentMap.set(key, row);
      }
      const recentSales = Array.from(recentMap.values()).slice(0, 5);

      setData({
        companies: compRes.count || 0,
        products: prodRes.count || 0,
        monthSales,
        monthPaid,
        totalUnpaid,
        pendingPortalOrders: pendingRes.count || 0,
        weekOrders,
        unpaid,
        recentSales,
      });
    }
    load();
  }, []);

  const loading = data === null;
  const v = (n: number | undefined, unit = "원") => (loading ? "—" : `${formatNumber(n || 0)}${unit}`);

  const quickActions = [
    { href: "/admin/sales?new=1", label: "판매 등록", desc: "출고·판매 입력", icon: ArrowUpCircle, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
    { href: "/admin/inbound", label: "입고 등록", desc: "매입 입고 처리", icon: ArrowDownCircle, color: "text-sky-400 bg-sky-400/10 border-sky-400/20" },
    { href: "/admin/quotes/new", label: "견적서 작성", desc: "신규 견적 발행", icon: ClipboardList, color: "text-accent bg-accent/10 border-accent/20" },
    { href: "/admin/statements/new", label: "거래명세서 작성", desc: "명세서 발행", icon: FileText, color: "text-primary bg-primary/10 border-primary/20" },
    { href: "/admin/billing", label: "정산 관리", desc: "입금·미수 처리", icon: Receipt, color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  ];

  const kpis = [
    { label: "이번 달 판매액", value: v(data?.monthSales), icon: TrendingUp, color: "text-emerald-400 bg-emerald-400/10", href: "/admin/sales" },
    { label: "이번 달 입금액", value: v(data?.monthPaid), icon: Wallet, color: "text-sky-400 bg-sky-400/10", href: "/admin/billing" },
    { label: "누계 미수금", value: v(data?.totalUnpaid), icon: AlertCircle, color: "text-red-400 bg-red-400/10", href: "/admin/billing", danger: (data?.totalUnpaid || 0) > 0 },
    { label: "승인 대기 발주", value: v(data?.pendingPortalOrders, "건"), icon: ShoppingCart, color: "text-yellow-400 bg-yellow-400/10", href: "/admin/orders", danger: (data?.pendingPortalOrders || 0) > 0 },
  ];

  // 금주 출고 예정 날짜별 묶기
  const weekByDate = useMemo(() => {
    const m = new Map<string, WeekOrder[]>();
    for (const o of data?.weekOrders || []) {
      if (!m.has(o.order_date)) m.set(o.order_date, []);
      m.get(o.order_date)!.push(o);
    }
    return Array.from(m.entries());
  }, [data]);
  const weekTotal = (data?.weekOrders || []).reduce((s, o) => s + o.total_amount, 0);
  const unpaidTop = (data?.unpaid || []).slice(0, 6);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">대시보드</h1>
        <p className="text-sm text-text-muted">
          거래처 <span className="text-text-secondary font-medium">{v(data?.companies, "")}</span>곳 · 상품{" "}
          <span className="text-text-secondary font-medium">{v(data?.products, "")}</span>개
        </p>
      </div>

      {/* 바로가기 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {quickActions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors hover:brightness-110 ${a.color}`}
          >
            <a.icon size={22} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary leading-tight">{a.label}</p>
              <p className="text-[11px] text-text-muted truncate">{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* KPI */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="rounded-2xl border border-border bg-bg-card p-5 hover:bg-bg-card-hover transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-text-secondary">{k.label}</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.color}`}>
                <k.icon size={18} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${k.danger ? "text-red-400" : "text-text-primary"}`}>{k.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* 금주 출고 예정 */}
        <section className="rounded-2xl border border-border bg-bg-card">
          <header className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
              <CalendarDays size={18} className="text-primary" /> 금주 출고 예정
              <span className="text-xs font-normal text-text-muted">주문 기준</span>
            </h2>
            <div className="flex items-center gap-3 text-xs">
              {!loading && <span className="text-text-secondary">{formatNumber(data!.weekOrders.length)}건 · {formatNumber(weekTotal)}원</span>}
              <Link href="/admin/orders" className="text-primary hover:underline">주문 관리</Link>
            </div>
          </header>
          <div className="p-3">
            {loading ? (
              <p className="py-10 text-center text-text-muted text-sm">로딩 중...</p>
            ) : weekByDate.length === 0 ? (
              <p className="py-10 text-center text-text-muted text-sm">이번 주 출고 예정 주문이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {weekByDate.map(([date, list]) => {
                  const isToday = date === today;
                  const isPast = date < today;
                  return (
                    <div key={date}>
                      <p className={`px-2 mb-1 text-xs font-semibold ${isToday ? "text-primary" : isPast ? "text-text-muted" : "text-text-secondary"}`}>
                        {shortDate(date)}{isToday && " · 오늘"}
                      </p>
                      <ul className="space-y-1">
                        {list.map((o) => {
                          const st = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
                          return (
                            <li key={o.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-bg-card-hover transition-colors">
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[11px] font-medium ${st.color}`}>{st.label}</span>
                              <Link href={`/admin/orders/${o.id}`} className="flex-1 min-w-0 truncate text-sm text-text-primary hover:text-primary">
                                {o.companyName}
                                <span className="ml-2 text-xs text-text-muted">{o.order_number}</span>
                              </Link>
                              <span className="shrink-0 text-sm font-medium text-text-secondary">{formatNumber(o.total_amount)}원</span>
                              {o.saleRegistered ? (
                                <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-emerald-400" title="판매 등록 완료">
                                  <CheckCircle2 size={13} /> 판매등록
                                </span>
                              ) : (
                                <Link
                                  href="/admin/sales?new=1"
                                  className={`shrink-0 text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                                    isPast
                                      ? "border-red-400/40 text-red-400 hover:bg-red-400/10"
                                      : "border-border text-text-muted hover:text-primary hover:border-primary/40"
                                  }`}
                                  title="판매 관리에서 출고 입력"
                                >
                                  {isPast ? "미등록" : "판매 입력"}
                                </Link>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 미입금 거래처 */}
        <section className="rounded-2xl border border-border bg-bg-card">
          <header className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
              <AlertCircle size={18} className="text-red-400" /> 미입금 거래처
              <span className="text-xs font-normal text-text-muted">청구 − 입금</span>
            </h2>
            <div className="flex items-center gap-3 text-xs">
              {!loading && <span className="text-text-secondary">{formatNumber(data!.unpaid.length)}곳</span>}
              <Link href="/admin/billing" className="text-primary hover:underline">정산 관리</Link>
            </div>
          </header>
          <div className="p-3">
            {loading ? (
              <p className="py-10 text-center text-text-muted text-sm">로딩 중...</p>
            ) : unpaidTop.length === 0 ? (
              <p className="py-10 text-center text-emerald-400 text-sm">미입금 청구가 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {unpaidTop.map((r) => (
                  <li key={r.companyId} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-bg-card-hover transition-colors">
                    <Building2 size={16} className="shrink-0 text-text-muted" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-text-primary">{r.companyName}</p>
                      <p className="text-[11px] text-text-muted truncate">
                        {r.months.map((m) => m.replace("-", ".")).join(", ")} 청구
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-red-400">{formatNumber(r.outstanding)}원</span>
                  </li>
                ))}
                {data!.unpaid.length > unpaidTop.length && (
                  <li className="px-3 pt-1 text-xs text-text-muted">외 {data!.unpaid.length - unpaidTop.length}곳 — 정산 관리에서 확인</li>
                )}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* 최근 판매 등록 */}
      <section className="rounded-2xl border border-border bg-bg-card">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <Package size={18} className="text-emerald-400" /> 최근 판매 등록
          </h2>
          <Link href="/admin/sales" className="text-xs text-primary hover:underline">판매 관리</Link>
        </header>
        <div className="p-3">
          {loading ? (
            <p className="py-8 text-center text-text-muted text-sm">로딩 중...</p>
          ) : data!.recentSales.length === 0 ? (
            <p className="py-8 text-center text-text-muted text-sm">등록된 판매가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data!.recentSales.map((s) => (
                <li key={s.key} className="flex items-center gap-4 px-3 py-2.5 text-sm">
                  <span className={`w-20 shrink-0 text-xs ${s.date === today ? "text-primary font-semibold" : "text-text-muted"}`}>{shortDate(s.date)}</span>
                  <span className="flex-1 min-w-0 truncate text-text-primary">{s.companyName}</span>
                  <span className="shrink-0 text-xs text-text-muted">{s.itemCount}품목</span>
                  <span className="shrink-0 font-medium text-text-secondary">{formatNumber(s.amount)}원</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
