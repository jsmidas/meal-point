"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Company, Statement, StatementItem, BillingWithPayments, Payment } from "@/lib/supabase/types";
import { formatNumber, generateBillingNumber, numberToKorean } from "@/lib/utils";
import { dbInsert, dbUpdate, dbDelete } from "@/lib/db";
import { matchSalesToStatements, summarizeMismatch, type SalesLineForMatch } from "@/lib/billing-match";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Receipt,
  CreditCard,
  X,
  CheckCircle2,
  Circle,
  Plus,
  ExternalLink,
  AlertTriangle,
  Split,
} from "lucide-react";
import { useRouter } from "next/navigation";

// 잔액 부호 표기: 미수(거래처가 덜 냄)는 '-', 과입금(더 냄)은 '+' 로 표시.
// 입력 unpaid = 청구액 - 입금액 (양수=미수, 음수=과입금) → 표시 시 부호 반전.
function formatBalance(unpaid: number) {
  const v = -unpaid;
  return `${v > 0 ? "+" : ""}${formatNumber(v)}원`;
}

type SalesLog = { id: string; company_id: string; quantity: number; unit_price: number; log_date: string; reason: string | null; product_id: string | null; products: { name: string; unit: string } | null };
type SalesData = { amount: number; count: number; logs: SalesLog[] };
// 명세서에 발행 지점(거래처) 정보를 조인해 보존 — 합산 카드에서 지점명 라벨용
type StatementWithItems = Statement & {
  statement_items: StatementItem[];
  companies?: { id: string; name: string; biz_number: string } | null;
};

type CompanyRow = {
  id: string; // 그룹 대표(primary) company_id
  name: string; // 대표 상호명
  sales: SalesData;
  statements: StatementWithItems[];
  billing: BillingWithPayments | null;
  members: Company[]; // 같은 사업자번호로 묶인 지점 거래처들 (대표 포함)
  groupBizNumber: string;
  strayBillings?: { companyName: string; billingMonth: string }[]; // 비-primary 멤버의 기존 billing (경고용)
};

// 명세서 합계(공급가 → 세액 10% 가산)로 가정산 청구액 산출.
// billings의 자동 동기화 로직(total = supply + round(supply*0.1))과 동일 규칙.
function statementBasedTotal(statements: StatementWithItems[]): number {
  const supply = statements.reduce((s, st) => s + (st.supply_amount || 0), 0);
  return supply + Math.round(supply * 0.1);
}

// 출고 로그 → 매칭용 라인 변환
function logToSalesLine(log: SalesLog): SalesLineForMatch {
  return {
    id: log.id,
    product_name: log.products?.name || log.reason || "기타",
    quantity: log.quantity,
    unit_price: log.unit_price || 0,
    amount: log.quantity * (log.unit_price || 0),
    log_date: log.log_date,
    unit: log.products?.unit || undefined,
  };
}

export default function BillingPage() {
  const supabase = createClient();
  const router = useRouter();

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [companyRows, setCompanyRows] = useState<CompanyRow[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // 이전 월 누계 미수금: companyId → 미결 청구 상세 배열 (분배 충당용)
  type StatementUnpaid = {
    statementId: string;
    statementNumber: string;
    statementDate: string;
    totalAmount: number;
    paid: number;
    outstanding: number;
    companyName?: string; // 발행 지점명 (합산 그룹에서 어느 지점 명세서인지)
  };
  type PrevUnpaidDetail = {
    billingId: string; // 가정산(청구 미생성)은 `est:<primary>|<month>` 센티넬
    billingMonth: string;
    outstanding: number; // billing 전체 미결 (청구단위 입금 포함)
    statements: StatementUnpaid[]; // outstanding > 0 인 명세서만
    unclassified: number; // 청구단위 입금으로 인해 어느 명세서에 갚았는지 모르는 금액 (양수=미결 중 미분류)
    estimated?: boolean; // 세금계산서/청구 미발행 → 명세서 기준 가정산 미수 (입금 시 청구로 승격)
    estSupply?: number; // 가정산 공급가 합계 (승격 시 billing.total_supply)
    estTotal?: number; // 가정산 합계(세액 포함) (승격 시 billing.total_amount)
  };
  const [prevUnpaidDetailMap, setPrevUnpaidDetailMap] = useState<Record<string, PrevUnpaidDetail[]>>({});
  // 요약/배지용 합계 맵 (상세에서 파생)
  const prevUnpaidMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [cid, list] of Object.entries(prevUnpaidDetailMap)) {
      m[cid] = list.reduce((s, d) => s + d.outstanding, 0);
    }
    return m;
  }, [prevUnpaidDetailMap]);

  // 세금계산서 모달 (CompanyRow 기반으로 변경)
  const [taxModal, setTaxModal] = useState<CompanyRow | null>(null);
  const [taxDate, setTaxDate] = useState(new Date().toISOString().slice(0, 10));
  const [taxNumber, setTaxNumber] = useState("");
  const [taxChecked, setTaxChecked] = useState<Set<string>>(new Set()); // 선택된 명세서 ID
  const [taxSupplyOverride, setTaxSupplyOverride] = useState<number | null>(null); // 수동 금액 입력

  // 입금 모달 (CompanyRow 기반으로 변경 - 청구 없어도 가능)
  const [payModalRow, setPayModalRow] = useState<CompanyRow | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payNotes, setPayNotes] = useState("");
  const [payDepositor, setPayDepositor] = useState("");
  const [payBank, setPayBank] = useState("");
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null); // 수정 모드
  const [splittingPayment, setSplittingPayment] = useState<Payment | null>(null); // 분할 모드 (기존 입금을 명세서별로 재분배)

  // 분배 충당: 패널 열림 여부 + 버킷별 충당액 (key는 billingId, 당월은 "__current__")
  const [payShowAllocation, setPayShowAllocation] = useState(false);
  const [payAllocations, setPayAllocations] = useState<Record<string, number>>({});
  const CURRENT_BUCKET_KEY = "__current__";

  // 판매 상세 모달
  const [salesDetailModal, setSalesDetailModal] = useState<{ companyName: string; logs: SalesLog[]; statements: StatementWithItems[]; billing: BillingWithPayments | null } | null>(null);

  // 명세서 발행 지점 선택 (합산 그룹에서 어느 지점으로 발행할지)
  const [stmtPickerRow, setStmtPickerRow] = useState<CompanyRow | null>(null);

  // 청구 생성 모달
  const [billingModal, setBillingModal] = useState<{ companyId: string; companyName: string; salesAmount: number } | null>(null);
  const [billingSupply, setBillingSupply] = useState(0);
  const [billingTax, setBillingTax] = useState(0);
  const [billingNotes, setBillingNotes] = useState("");

  function changeMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return `${y}년 ${m}월`;
  }, [month]);

  async function fetchData() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const [y, m] = month.split("-").map(Number);
    const from = `${month}-01`;
    const to = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;

    const [salesRes, stmtRes, billRes, compRes, confirmRes, prevBillRes, prevStmtRes] = await Promise.all([
      db.from("inventory_logs").select("id, company_id, quantity, unit_price, log_date, reason, product_id, products(name, unit)").eq("type", "out").gte("log_date", from).lte("log_date", to).order("log_date"),
      db.from("statements").select("*, statement_items(*), companies(id, name, biz_number)").gte("statement_date", from).lte("statement_date", to).order("statement_date", { ascending: false }),
      db.from("billings").select("*, companies(*), payments(*)").eq("billing_month", month),
      db.from("companies").select("*").eq("is_active", true).order("name"),
      db.from("sale_checks").select("company_id, sale_date").gte("sale_date", from).lte("sale_date", to),
      db.from("billings").select("id, company_id, billing_month, total_amount, paid_amount").lt("billing_month", month).order("billing_month", { ascending: true }),
      db.from("statements").select("id, company_id, statement_number, statement_date, supply_amount, total_amount, companies(id, name)").lt("statement_date", from).order("statement_date", { ascending: true }),
    ]);

    // ── 사업자번호 그룹 인덱스 ──
    // 같은 biz_number의 active 거래처(지점)를 한 그룹으로 묶고, 대표(primary)를 정한다.
    // primary = 같은 biz_number 중 company.id 사전순 최소값 (name 변경과 무관, tie 없음).
    // biz_number가 빈값이면 자기 자신을 primary로 (오집계 방지).
    const allCompaniesRaw: Company[] = compRes.data || [];
    const bizGroups = new Map<string, Company[]>(); // biz_number → 멤버들
    for (const c of allCompaniesRaw) {
      const bn = (c.biz_number || "").trim();
      const key = bn || `__self__:${c.id}`;
      const arr = bizGroups.get(key) || [];
      arr.push(c);
      bizGroups.set(key, arr);
    }
    const primaryByCompanyId: Record<string, string> = {};
    const membersByPrimary: Record<string, Company[]> = {};
    for (const members of bizGroups.values()) {
      // 대표 = 가장 먼저 생성된 거래처 (기존 청구·입금 이력 보유자). created_at 동률은 id로.
      const sorted = members.slice().sort((a, b) =>
        (a.created_at || "").localeCompare(b.created_at || "") || a.id.localeCompare(b.id),
      );
      const primary = sorted[0].id;
      membersByPrimary[primary] = sorted;
      for (const m of sorted) primaryByCompanyId[m.id] = primary;
    }
    const toPrimary = (companyId: string | null | undefined): string =>
      (companyId && primaryByCompanyId[companyId]) || companyId || "";

    // 이전 월 명세서별 매칭 입금 합산
    const prevStmtIds: string[] = (prevStmtRes.data || []).map((s: { id: string }) => s.id);
    const { data: prevStmtPayments } = prevStmtIds.length > 0
      ? await db.from("payments").select("statement_id, amount").in("statement_id", prevStmtIds)
      : { data: [] };
    const paidByStmt: Record<string, number> = {};
    for (const p of (prevStmtPayments || []) as Array<{ statement_id: string; amount: number }>) {
      if (!p.statement_id) continue;
      paidByStmt[p.statement_id] = (paidByStmt[p.statement_id] || 0) + p.amount;
    }

    // 이전 월 미수 상세 (청구별 + 그 안의 명세서별)
    // 합산: prevDetail는 그룹 대표(primary) company_id로 키잉한다.
    const prevDetail: Record<string, PrevUnpaidDetail[]> = {};
    // 1) 청구별로 stub 만들기 (paid_amount/total_amount 보존 — FIFO 분배에 사용)
    type DetailWithRaw = PrevUnpaidDetail & { paidAmount: number; totalAmount: number };
    // 명세서→청구 매핑을 견고하게: 원본 (company_id, month) exact 매핑 + 그룹(primary, month) fallback
    const billingByExactKey: Record<string, DetailWithRaw> = {}; // `${orig_company_id}|${month}` → detail
    const detailsByGroupMonth: Record<string, DetailWithRaw[]> = {}; // `${primary}|${month}` → details
    const allDetails: DetailWithRaw[] = [];
    for (const b of prevBillRes.data || []) {
      const u = b.total_amount - b.paid_amount;
      // 완납(u===0)이어도 매핑 인덱스에는 등록해야 함 — 제외하면 그 월 명세서가
      // "청구 없음"으로 오인되어 가정산 미수 stub으로 부활한다 (outstanding 0은 합계에 무해)
      const primary = toPrimary(b.company_id);
      const detail: DetailWithRaw = {
        billingId: b.id,
        billingMonth: b.billing_month,
        outstanding: u,
        statements: [],
        unclassified: 0,
        paidAmount: b.paid_amount,
        totalAmount: b.total_amount,
      };
      billingByExactKey[`${b.company_id}|${b.billing_month}`] = detail;
      const gmKey = `${primary}|${b.billing_month}`;
      (detailsByGroupMonth[gmKey] ||= []).push(detail);
      allDetails.push(detail);
      (prevDetail[primary] ||= []).push(detail);
    }
    // 2) 각 명세서를 청구별로 그룹핑 (statement_id 태깅된 입금만 우선 차감)
    //    - 자기 (company_id, month) 청구가 있으면 거기에(레거시 지점 자체 청구)
    //    - 그룹의 그 달 청구가 있으면 거기에 (지점 명세서 → 대표 합산 청구)
    //    - 청구 자체가 없으면(세금계산서 미발행) 가정산 미수 stub을 만들어 이월 (지점 합산 포함)
    type StmtRow = { id: string; statement_number: string; statement_date: string; total_amount: number; taggedPaid: number; companyName?: string };
    const stmtsByBillingId: Record<string, StmtRow[]> = {};
    const estDetails: DetailWithRaw[] = []; // 가정산 stub (청구 미생성). 명세서 순회 후 금액 확정.
    const estSupplyById: Record<string, number> = {}; // 가정산 stub billingId → 공급가 합계
    for (const s of (prevStmtRes.data || []) as Array<{ id: string; company_id: string; statement_number: string; statement_date: string; supply_amount: number; total_amount: number; companies?: { id: string; name: string } | null }>) {
      const stMonth = s.statement_date.slice(0, 7);
      const primary = toPrimary(s.company_id);
      const gmKey = `${primary}|${stMonth}`;
      const exact = billingByExactKey[`${s.company_id}|${stMonth}`];
      let detail = exact || (detailsByGroupMonth[gmKey] || [])[0];
      if (!detail) {
        // 청구·세금계산서 미발행 → 가정산 미수 stub (그룹+월 단위, 지점 명세서 합산)
        const estId = `est:${gmKey}`;
        detail = {
          billingId: estId,
          billingMonth: stMonth,
          outstanding: 0, // 아래 3.5)에서 확정
          statements: [],
          unclassified: 0,
          paidAmount: 0, // 청구 미생성 → 청구단위 입금 없음
          totalAmount: 0, // 아래 3.5)에서 확정
          estimated: true,
        };
        (detailsByGroupMonth[gmKey] ||= []).push(detail);
        allDetails.push(detail);
        (prevDetail[primary] ||= []).push(detail);
        estDetails.push(detail);
        estSupplyById[estId] = 0;
      }
      if (detail.estimated) estSupplyById[detail.billingId] += s.supply_amount || 0;
      const taggedPaid = paidByStmt[s.id] || 0;
      if (!stmtsByBillingId[detail.billingId]) stmtsByBillingId[detail.billingId] = [];
      stmtsByBillingId[detail.billingId].push({
        id: s.id,
        statement_number: s.statement_number,
        statement_date: s.statement_date,
        total_amount: s.total_amount,
        taggedPaid,
        companyName: s.companies?.name,
      });
    }
    // 3.5) 가정산 stub 금액 확정 — 세액=공급가 합계×10% 반올림 (실제 청구/세금계산서 생성 규칙과 동일)
    for (const d of estDetails) {
      const supply = estSupplyById[d.billingId] || 0;
      const total = supply + Math.round(supply * 0.1);
      const tagged = (stmtsByBillingId[d.billingId] || []).reduce((s, x) => s + x.taggedPaid, 0);
      d.estSupply = supply;
      d.estTotal = total;
      d.totalAmount = total;
      d.paidAmount = tagged;
      d.outstanding = total - tagged;
    }
    // 3) 청구단위 입금(statement_id=NULL)은 명세서 날짜순으로 FIFO 가상 분배
    //    — payments 테이블 자체는 건드리지 않고, 표시 계산만 정리
    for (const detail of allDetails) {
      const stmts = (stmtsByBillingId[detail.billingId] || [])
        .slice()
        .sort((a, b) => a.statement_date.localeCompare(b.statement_date));
      const taggedSum = stmts.reduce((s, x) => s + x.taggedPaid, 0);
      let unclassifiedPaid = Math.max(0, detail.paidAmount - taggedSum); // 청구단위 충당량

      for (const stmt of stmts) {
        const outstandingAfterTag = stmt.total_amount - stmt.taggedPaid;
        const alloc = Math.min(unclassifiedPaid, Math.max(0, outstandingAfterTag));
        unclassifiedPaid -= alloc;
        const effectivePaid = stmt.taggedPaid + alloc;
        const outstanding = stmt.total_amount - effectivePaid;
        if (outstanding > 0) {
          detail.statements.push({
            statementId: stmt.id,
            statementNumber: stmt.statement_number,
            statementDate: stmt.statement_date,
            totalAmount: stmt.total_amount,
            paid: effectivePaid,
            outstanding,
            companyName: stmt.companyName,
          });
        }
      }
      // 분류 미정 = 청구 outstanding - 명세서 outstanding 합
      // (FIFO 분배 후에도 잔액이 남으면 보통 0, 과입금이면 음수)
      const stmtSum = detail.statements.reduce((s, x) => s + x.outstanding, 0);
      detail.unclassified = detail.outstanding - stmtSum;
    }

    const companies: Company[] = compRes.data || [];
    setAllCompanies(companies);

    // 판매관리에서 체크된 거래처 Set
    const confirmedCompanyIds = new Set<string>();
    for (const c of confirmRes.data || []) {
      if (c.company_id) confirmedCompanyIds.add(c.company_id);
    }

    // 판매 집계 (체크된 거래처만) — 그룹 대표(primary) 키로 합산, log엔 원본 company_id 보존
    const salesMap = new Map<string, SalesData>();
    for (const log of salesRes.data || []) {
      if (!log.company_id) continue;
      if (!confirmedCompanyIds.has(log.company_id)) continue;
      const key = toPrimary(log.company_id);
      const ex = salesMap.get(key) || { amount: 0, count: 0, logs: [] as SalesLog[] };
      ex.amount += log.quantity * (log.unit_price || 0);
      ex.count += 1;
      ex.logs.push(log);
      salesMap.set(key, ex);
    }

    // 명세서 집계 (체크된 거래처만) — 그룹 대표 키로 전 지점 명세서 concat
    const stmtMap = new Map<string, StatementWithItems[]>();
    for (const s of stmtRes.data || []) {
      if (!confirmedCompanyIds.has(s.company_id)) continue;
      const key = toPrimary(s.company_id);
      const arr = stmtMap.get(key) || [];
      arr.push(s);
      stmtMap.set(key, arr);
    }

    // 청구 집계 + 명세서 기준 자동 동기화 (그룹 대표 1건)
    // - 대표(primary) 본인 청구만 그룹 청구로 채택, 비-primary 멤버 청구는 stray로 분리(자동 merge 금지)
    const billMap = new Map<string, BillingWithPayments>();
    const strayByPrimary: Record<string, { companyName: string; billingMonth: string }[]> = {};
    for (const b of billRes.data || []) {
      const primary = toPrimary(b.company_id);
      if (b.company_id === primary) {
        billMap.set(primary, b);
      } else {
        (strayByPrimary[primary] ||= []).push({
          companyName: b.companies?.name || "(알 수 없음)",
          billingMonth: b.billing_month,
        });
      }
    }
    // 대표 청구를 그룹 전체 명세서 합으로 자동 보정 (합산 후 round → 세금계산서와 1원 정합)
    for (const [primary, b] of billMap) {
      const stmts = stmtMap.get(primary);
      if (stmts && stmts.length > 0) {
        const stmtSupply = stmts.reduce((s, st) => s + st.supply_amount, 0);
        const stmtTax = Math.round(stmtSupply * 0.1);
        const stmtTotal = stmtSupply + stmtTax;
        if (b.total_amount !== stmtTotal) {
          // DB 업데이트 (비동기, UI 먼저 반영)
          dbUpdate("billings", {
            total_supply: stmtSupply,
            total_tax: stmtTax,
            total_amount: stmtTotal,
          }, { id: b.id });
          // 로컬 데이터 즉시 반영
          b.total_supply = stmtSupply;
          b.total_tax = stmtTax;
          b.total_amount = stmtTotal;
        }
      }
    }

    // 활동이 있는 그룹(대표 키)만 — 모든 키는 이미 primary 기준
    const groupConfirmed = (primary: string) =>
      (membersByPrimary[primary] || []).some((m) => confirmedCompanyIds.has(m.id));
    const activeIds = new Set([...salesMap.keys(), ...stmtMap.keys()]);
    // 청구가 있는 그룹도 포함 (이미 진행 중인 정산)
    for (const key of billMap.keys()) {
      if (groupConfirmed(key)) activeIds.add(key);
    }
    // 이전 월 미수가 남아있는 그룹도 포함 (당월 활동 없어도 분배 입금 가능)
    for (const key of Object.keys(prevDetail)) {
      if (prevDetail[key].some((d) => d.outstanding > 0)) activeIds.add(key);
    }

    const rows: CompanyRow[] = companies
      .filter((c) => primaryByCompanyId[c.id] === c.id && activeIds.has(c.id)) // 대표만 (중복 카드 방지)
      .map((c) => ({
        id: c.id,
        name: c.name,
        sales: salesMap.get(c.id) || { amount: 0, count: 0, logs: [] },
        statements: stmtMap.get(c.id) || [],
        billing: billMap.get(c.id) || null,
        members: membersByPrimary[c.id] || [c],
        groupBizNumber: (c.biz_number || "").trim(),
        strayBillings: strayByPrimary[c.id],
      }))
      .sort((a, b) => b.sales.amount - a.sales.amount);

    setCompanyRows(rows);
    setPrevUnpaidDetailMap(prevDetail);

    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // 요약
  const summary = useMemo(() => {
    let totalSales = 0;
    let stmtIssued = 0;
    let taxUnissued = 0;
    let totalUnpaid = 0;
    let totalEstUnpaid = 0; // 당월 가정산 미수 (세금계산서 미발행이라도 명세서 발행분 포함)
    for (const r of companyRows) {
      totalSales += r.sales.amount;
      if (r.statements.length > 0) stmtIssued++;
      if (r.billing && !r.billing.tax_invoice_issued) taxUnissued++;
      // 과입금(음수)도 누계에 반영 → 거래처 환불/이월 추적
      if (r.billing) totalUnpaid += r.billing.total_amount - r.billing.paid_amount;
      // 가정산: billing 있으면 billing 기준(입금 차감 포함), 없으면 명세서 합계(입금 0)
      if (r.billing) {
        totalEstUnpaid += r.billing.total_amount - r.billing.paid_amount;
      } else if (r.statements.length > 0) {
        totalEstUnpaid += statementBasedTotal(r.statements);
      }
    }
    const totalPrevUnpaid = Object.values(prevUnpaidMap).reduce((s, v) => s + v, 0);
    return { totalSales, stmtIssued, taxUnissued, totalUnpaid, totalEstUnpaid, totalPrevUnpaid };
  }, [companyRows, prevUnpaidMap]);

  // 세금계산서 합산금액 계산 (판매액 기준 동기화)
  const taxComputedSupply = useMemo(() => {
    if (!taxModal) return 0;
    if (taxSupplyOverride !== null) return taxSupplyOverride;
    // 명세서 체크된 경우: 선택된 명세서 합산
    if (taxChecked.size > 0) {
      return taxModal.statements
        .filter((s) => taxChecked.has(s.id))
        .reduce((sum, s) => sum + s.supply_amount, 0);
    }
    // 기본: 판매금액 우선 (판매 데이터가 있으면 판매액, 없으면 기존 청구금액)
    return taxModal.sales.amount || taxModal.billing?.total_supply || 0;
  }, [taxModal, taxChecked, taxSupplyOverride]);

  const taxComputedTax = Math.round(taxComputedSupply * 0.1);
  const taxComputedTotal = taxComputedSupply + taxComputedTax;

  function openTaxModal(row: CompanyRow) {
    setTaxModal(row);
    setTaxDate(new Date().toISOString().slice(0, 10));
    setTaxNumber("");
    setTaxSupplyOverride(null);
    // 명세서 선택 해제 → 판매액 기준으로 시작 (명세서와 판매액이 다를 수 있으므로)
    setTaxChecked(new Set());
  }

  // 세금계산서 발행 처리
  async function handleTaxInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!taxModal) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    let billingId = taxModal.billing?.id;

    // 청구 없으면 자동 생성
    if (!billingId) {
      const { data: newBillingData } = await dbInsert("billings", {
        billing_number: generateBillingNumber(month),
        company_id: taxModal.id,
        billing_month: month,
        total_supply: taxComputedSupply,
        total_tax: taxComputedTax,
        total_amount: taxComputedTotal,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newBilling = (Array.isArray(newBillingData) ? newBillingData[0] : newBillingData) as any;
      billingId = newBilling?.id;
    } else {
      // 기존 청구 금액 업데이트
      await dbUpdate("billings", {
        total_supply: taxComputedSupply,
        total_tax: taxComputedTax,
        total_amount: taxComputedTotal,
      }, { id: billingId });
    }

    await dbUpdate("billings", {
      tax_invoice_issued: true,
      tax_invoice_date: taxDate,
      tax_invoice_number: taxNumber || null,
    }, { id: billingId! });

    setTaxModal(null);
    setTaxNumber("");
    fetchData();
  }

  // 입금 처리 (청구 없어도 자동 생성, 다중 월 분배 지원)
  const [paySubmitting, setPaySubmitting] = useState(false);
  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payModalRow || paySubmitting) return;
    if (payAmount <= 0) {
      alert("입금액을 입력하세요.");
      return;
    }

    // 수정 모드: 단일 row 갱신 (분배 미지원, 기존 동작 유지)
    if (editingPayment) {
      setPaySubmitting(true);
      await dbUpdate("payments", {
        amount: payAmount,
        payment_date: payDate,
        payment_method: payMethod,
        notes: payNotes || null,
        depositor_name: payDepositor || null,
        bank_name: payBank || null,
      }, { id: editingPayment.id });
      await syncBillingPaidById(editingPayment.billing_id);
      closePayModal();
      fetchData();
      return;
    }

    // 분배 패널 검증
    const allocPlan = buildAllocationPlan();
    if (!allocPlan.valid) {
      alert(allocPlan.error || "분배 금액이 입금액과 일치하지 않습니다.");
      return;
    }

    setPaySubmitting(true);
    const groupId = allocPlan.entries.length > 1 ? crypto.randomUUID() : null;
    const affectedBillingIds: string[] = [];
    const estPromoted: Record<string, string> = {}; // 가정산 센티넬 → 승격된 실제 billingId (중복 생성 방지)

    // 분할 모드: 기존 입금 row를 삭제 (반제 처리). 분배 합계 = 입금액 보장됨.
    if (splittingPayment) {
      affectedBillingIds.push(splittingPayment.billing_id);
      await dbDelete("payments", { id: splittingPayment.id });
    }

    // 충당 대상별 insert
    for (const entry of allocPlan.entries) {
      let billingId = entry.billingId;

      // 가정산 미수(청구 미생성)에 충당 → 해당 월 청구를 생성해 승격 (그룹당 1회)
      if (billingId && billingId.startsWith("est:")) {
        const sentinel = billingId;
        if (estPromoted[sentinel]) {
          billingId = estPromoted[sentinel];
        } else {
          const det = (prevUnpaidDetailMap[payModalRow.id] || []).find((d) => d.billingId === sentinel);
          const estMonth = det?.billingMonth || entry.billingMonth || month;
          const supply = det?.estSupply ?? 0;
          const tax = Math.round(supply * 0.1);
          const total = det?.estTotal ?? supply + tax;
          const { data: estBillingData } = await dbInsert("billings", {
            billing_number: generateBillingNumber(estMonth),
            company_id: payModalRow.id,
            billing_month: estMonth,
            total_supply: supply,
            total_tax: tax,
            total_amount: total,
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const estBilling = (Array.isArray(estBillingData) ? estBillingData[0] : estBillingData) as any;
          billingId = estBilling?.id as string;
          estPromoted[sentinel] = billingId;
        }
      }

      // 당월 청구가 없으면 자동 생성
      if (!billingId) {
        const supply = payModalRow.sales.amount || entry.amount;
        const tax = Math.round(supply * 0.1);
        const { data: newBillingData } = await dbInsert("billings", {
          billing_number: generateBillingNumber(month),
          company_id: payModalRow.id,
          billing_month: month,
          total_supply: supply,
          total_tax: tax,
          total_amount: supply + tax,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newBilling = (Array.isArray(newBillingData) ? newBillingData[0] : newBillingData) as any;
        billingId = newBilling?.id as string;
      }

      await dbInsert("payments", {
        billing_id: billingId,
        amount: entry.amount,
        payment_date: payDate,
        payment_method: payMethod,
        notes: payNotes || null,
        depositor_name: payDepositor || null,
        bank_name: payBank || null,
        payment_group_id: groupId,
        statement_id: entry.statementId,
      });
      affectedBillingIds.push(billingId);
    }

    // 각 billing의 paid_amount 재계산
    for (const bid of Array.from(new Set(affectedBillingIds))) {
      await syncBillingPaidById(bid);
    }

    closePayModal();
    fetchData();
  }

  // 입금 모달의 충당 버킷 — 명세서 단위가 기본, 청구단위는 "분류 미정" 잔액용
  type AllocBucket = {
    key: string; // 상태 키 (s:<stmtId> 또는 b:<billingId|sentinel>)
    billingId: string | null; // null = 당월 청구 미생성
    billingMonth: string;
    statementId: string | null; // null = 청구단위 충당 (분류 미정)
    statementNumber?: string;
    statementDate?: string;
    outstanding: number; // 양수=미수, 음수=과입금(청구단위)
    paid?: number; // 이미 충당된 금액 (명세서 단위)
    totalAmount?: number; // 명세서 총액
    companyName?: string; // 발행 지점명 (합산 그룹)
    isCurrent: boolean;
    isStatement: boolean;
  };

  // 당월 명세서별 미결 계산 (billing.payments의 statement_id 기준)
  // splittingPayment이 있으면 그 입금의 영향을 제거 (마치 없는 것처럼 재계산)
  function computeCurrentStatementsUnpaid(row: CompanyRow, excludePayment: Payment | null): StatementUnpaid[] {
    const paidByStmt: Record<string, number> = {};
    for (const p of row.billing?.payments || []) {
      if (excludePayment && p.id === excludePayment.id) continue;
      if (!p.statement_id) continue;
      paidByStmt[p.statement_id] = (paidByStmt[p.statement_id] || 0) + p.amount;
    }
    return row.statements
      .map((s) => {
        const paid = paidByStmt[s.id] || 0;
        return {
          statementId: s.id,
          statementNumber: s.statement_number,
          statementDate: s.statement_date,
          totalAmount: s.total_amount,
          paid,
          outstanding: s.total_amount - paid,
          companyName: s.companies?.name,
        };
      })
      .filter((s) => s.outstanding > 0);
  }

  const allocBuckets = useMemo<AllocBucket[]>(() => {
    if (!payModalRow) return [];
    const buckets: AllocBucket[] = [];
    // 이전 월 미결 명세서들 + 청구단위 미분류 잔액
    // 분할 모드의 입금이 이전 월에 속하는 경우, 그 영향을 제거해 미결을 재계산
    const prev = prevUnpaidDetailMap[payModalRow.id] || [];
    const splitBillingId = splittingPayment?.billing_id;
    const splitStmtId = splittingPayment?.statement_id;
    const splitAmount = splittingPayment?.amount ?? 0;
    for (const detail of prev) {
      const isSplitTargetBilling = splittingPayment && detail.billingId === splitBillingId;
      for (const s of detail.statements) {
        let outstanding = s.outstanding;
        // 분할 대상 입금이 이 명세서를 충당하고 있다면 그 효과를 되돌림
        if (isSplitTargetBilling && splitStmtId === s.statementId) {
          outstanding += splitAmount;
        }
        if (outstanding > 0) {
          buckets.push({
            key: `s:${s.statementId}`,
            billingId: detail.billingId,
            billingMonth: detail.billingMonth,
            statementId: s.statementId,
            statementNumber: s.statementNumber,
            statementDate: s.statementDate,
            outstanding,
            paid: s.totalAmount - outstanding,
            totalAmount: s.totalAmount,
            companyName: s.companyName,
            isCurrent: false,
            isStatement: true,
          });
        }
      }
      // 분류 미정: 분할 대상이 statement_id 없는 청구단위 충당이면 unclassified에 +amount
      let unclassified = detail.unclassified;
      if (isSplitTargetBilling && !splitStmtId) {
        unclassified += splitAmount;
      }
      if (unclassified > 0) {
        buckets.push({
          key: `b:${detail.billingId}`,
          billingId: detail.billingId,
          billingMonth: detail.billingMonth,
          statementId: null,
          outstanding: unclassified,
          isCurrent: false,
          isStatement: false,
        });
      }
    }
    // 당월 명세서들 (splittingPayment 영향 제거)
    const curStmts = computeCurrentStatementsUnpaid(payModalRow, splittingPayment);
    for (const s of curStmts) {
      buckets.push({
        key: `s:${s.statementId}`,
        billingId: payModalRow.billing?.id ?? null,
        billingMonth: month,
        statementId: s.statementId,
        statementNumber: s.statementNumber,
        statementDate: s.statementDate,
        outstanding: s.outstanding,
        paid: s.paid,
        totalAmount: s.totalAmount,
        companyName: s.companyName,
        isCurrent: true,
        isStatement: true,
      });
    }
    // 당월 청구단위 잔액 (overpayment 받기용 — 항상 포함)
    const currentBilling = payModalRow.billing;
    const curStmtSum = curStmts.reduce((s, x) => s + x.outstanding, 0);
    // 청구 outstanding: 분할 대상 입금이 당월 청구에 속하면 그 영향 제거 (+amount)
    let billingOutstanding: number;
    if (currentBilling) {
      billingOutstanding = currentBilling.total_amount - currentBilling.paid_amount;
      if (splittingPayment && splitBillingId === currentBilling.id) {
        billingOutstanding += splitAmount;
      }
    } else {
      billingOutstanding = payModalRow.sales.amount > 0
        ? payModalRow.sales.amount + Math.round(payModalRow.sales.amount * 0.1)
        : 0;
    }
    const curUnclassified = billingOutstanding - curStmtSum;
    buckets.push({
      key: `b:${currentBilling?.id ?? CURRENT_BUCKET_KEY}`,
      billingId: currentBilling?.id ?? null,
      billingMonth: month,
      statementId: null,
      outstanding: curUnclassified,
      isCurrent: true,
      isStatement: false,
    });
    return buckets;
  }, [payModalRow, prevUnpaidDetailMap, month, splittingPayment]);

  // 분배 합계
  const allocSum = useMemo(
    () => Object.values(payAllocations).reduce((s, v) => s + (Number(v) || 0), 0),
    [payAllocations],
  );

  // 분배 계획 작성 (저장 시 사용)
  function buildAllocationPlan(): {
    valid: boolean;
    error?: string;
    entries: Array<{ billingId: string | null; statementId: string | null; amount: number; billingMonth?: string }>;
  } {
    // 분배 패널 미사용: 전액 당월 청구단위에 (기존 동작)
    // 단, 분할 모드는 항상 분배 패널 기반이어야 함 (단일 entry로 빠지면 분할 의미가 없어짐)
    if (!payShowAllocation && !splittingPayment) {
      return {
        valid: true,
        entries: [{ billingId: payModalRow?.billing?.id ?? null, statementId: null, amount: payAmount }],
      };
    }
    // 패널 사용 시: 분배 합계 == 입금액 검증
    if (allocSum !== payAmount) {
      return {
        valid: false,
        error: `분배 합계(${formatNumber(allocSum)}원)가 입금액(${formatNumber(payAmount)}원)과 다릅니다.`,
        entries: [],
      };
    }
    const entries: Array<{ billingId: string | null; statementId: string | null; amount: number; billingMonth?: string }> = [];
    for (const b of allocBuckets) {
      const amt = payAllocations[b.key] || 0;
      if (amt > 0) entries.push({ billingId: b.billingId, statementId: b.statementId, amount: amt, billingMonth: b.billingMonth });
    }
    if (entries.length === 0) {
      return { valid: false, error: "충당할 대상이 없습니다.", entries: [] };
    }
    return { valid: true, entries };
  }

  // 자동 분배: 오래된 명세서부터 FIFO로 채움, 잔액은 당월 청구단위로
  function autoDistribute() {
    if (!payAmount || payAmount <= 0) return;
    let remaining = payAmount;
    const next: Record<string, number> = {};
    // 1단계: 이전 월 명세서 미결 (오래된 순)
    for (const b of allocBuckets) {
      if (b.isCurrent || !b.isStatement || b.outstanding <= 0) continue;
      const fill = Math.min(remaining, b.outstanding);
      if (fill > 0) {
        next[b.key] = fill;
        remaining -= fill;
      }
    }
    // 2단계: 이전 월 청구단위 미분류
    for (const b of allocBuckets) {
      if (b.isCurrent || b.isStatement || b.outstanding <= 0) continue;
      const fill = Math.min(remaining, b.outstanding);
      if (fill > 0) {
        next[b.key] = fill;
        remaining -= fill;
      }
    }
    // 3단계: 당월 명세서 미결
    for (const b of allocBuckets) {
      if (!b.isCurrent || !b.isStatement || b.outstanding <= 0) continue;
      const fill = Math.min(remaining, b.outstanding);
      if (fill > 0) {
        next[b.key] = fill;
        remaining -= fill;
      }
    }
    // 4단계: 잔액은 당월 청구단위로 (overpayment 포함)
    if (remaining > 0) {
      const cur = allocBuckets.find((b) => b.isCurrent && !b.isStatement);
      if (cur) next[cur.key] = (next[cur.key] || 0) + remaining;
    }
    setPayAllocations(next);
  }

  function closePayModal() {
    setPayModalRow(null);
    setPayAmount(0);
    setPayNotes("");
    setPayDepositor("");
    setPayBank("");
    setEditingPayment(null);
    setSplittingPayment(null);
    setPaySubmitting(false);
    setPayShowAllocation(false);
    setPayAllocations({});
  }

  function openEditPayment(payment: Payment, row: CompanyRow) {
    setPayModalRow(row);
    setEditingPayment(payment);
    setSplittingPayment(null);
    setPayAmount(payment.amount);
    setPayDate(payment.payment_date);
    setPayMethod(payment.payment_method || "bank_transfer");
    setPayNotes(payment.notes || "");
    setPayDepositor(payment.depositor_name || "");
    setPayBank(payment.bank_name || "");
    setPayShowAllocation(false);
    setPayAllocations({});
  }

  // 분할/재매칭: 기존 입금을 명세서별로 재분배
  // - 모달의 입금액·입금일 등은 prefill되며 편집 가능
  // - 분배 패널이 강제로 펼쳐지고, 미결 계산에서 이 입금의 영향을 제거함 (마치 없는 것처럼)
  // - 저장 시 기존 row 삭제 + 분배에 따라 다중 insert (반제 처리)
  function openSplitPayment(payment: Payment, row: CompanyRow) {
    setPayModalRow(row);
    setEditingPayment(null);
    setSplittingPayment(payment);
    setPayAmount(payment.amount);
    setPayDate(payment.payment_date);
    setPayMethod(payment.payment_method || "bank_transfer");
    setPayNotes(payment.notes || "");
    setPayDepositor(payment.depositor_name || "");
    setPayBank(payment.bank_name || "");
    setPayShowAllocation(true);
    setPayAllocations({});
  }

  // 입금 삭제 (분할 송금이면 그룹 전체/단일 선택)
  async function handleDeletePayment(payment: Payment, billingId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    if (payment.payment_group_id) {
      const { data: groupRows } = await db
        .from("payments")
        .select("id, billing_id, amount")
        .eq("payment_group_id", payment.payment_group_id);
      const rows = (groupRows || []) as Array<{ id: string; billing_id: string; amount: number }>;
      const groupTotal = rows.reduce((s, p) => s + p.amount, 0);
      const deleteAll = window.confirm(
        `이 입금은 분할 송금의 일부입니다 (총 ${formatNumber(groupTotal)}원, ${rows.length}건).\n\n` +
          `[확인] 분할 전체 삭제\n[취소] 이 항목만 삭제`,
      );
      if (deleteAll) {
        await dbDelete("payments", { payment_group_id: payment.payment_group_id });
        const affected = Array.from(new Set(rows.map((p) => p.billing_id)));
        for (const bid of affected) await syncBillingPaidById(bid);
      } else {
        // 이 항목만 삭제 (재확인)
        if (!window.confirm(`${payment.payment_date} 입금 ${formatNumber(payment.amount)}원만 삭제하시겠습니까?`)) return;
        await dbDelete("payments", { id: payment.id });
        await syncBillingPaidById(billingId);
      }
    } else {
      if (!window.confirm(`${payment.payment_date} 입금 ${formatNumber(payment.amount)}원을 삭제하시겠습니까?`)) return;
      await dbDelete("payments", { id: payment.id });
      await syncBillingPaidById(billingId);
    }

    fetchData();
  }

  // payments 합산으로 billings.paid_amount를 재계산 (동기화 불일치 방지)
  async function syncBillingPaid(billingId: string, totalAmount: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: payments } = await db.from("payments").select("amount").eq("billing_id", billingId);
    const newPaid = (payments || []).reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
    const newStatus = newPaid <= 0 ? "unpaid" : newPaid >= totalAmount ? "paid" : "partial";
    await dbUpdate("billings", {
      paid_amount: newPaid,
      status: newStatus,
      paid_date: newStatus === "paid" ? new Date().toISOString().slice(0, 10) : null,
    }, { id: billingId });
  }

  // billingId만으로 동기화 — total_amount를 DB에서 직접 읽어옴 (이전 월 청구 처리용)
  async function syncBillingPaidById(billingId: string, knownTotal?: number) {
    if (knownTotal !== undefined && knownTotal > 0) {
      await syncBillingPaid(billingId, knownTotal);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: bill } = await db.from("billings").select("total_amount").eq("id", billingId).single();
    await syncBillingPaid(billingId, bill?.total_amount ?? 0);
  }

  // 청구 생성
  async function handleCreateBilling(e: React.FormEvent) {
    e.preventDefault();
    if (!billingModal) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const total = billingSupply + billingTax;
    await dbInsert("billings", {
      billing_number: generateBillingNumber(month),
      company_id: billingModal.companyId,
      billing_month: month,
      total_supply: billingSupply,
      total_tax: billingTax,
      total_amount: total,
      notes: billingNotes || null,
    });
    setBillingModal(null);
    setBillingSupply(0);
    setBillingTax(0);
    setBillingNotes("");
    fetchData();
  }

  function openBillingModal(row: CompanyRow) {
    const supply = row.sales.amount;
    const tax = Math.round(supply * 0.1);
    setBillingModal({ companyId: row.id, companyName: row.name, salesAmount: row.sales.amount });
    setBillingSupply(supply);
    setBillingTax(tax);
    setBillingNotes("");
  }

  // 단계 상태 아이콘
  function StepIcon({ done }: { done: boolean }) {
    return done
      ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
      : <Circle size={16} className="text-text-muted/40 shrink-0" />;
  }

  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const stmtFrom = `${month}-01`;
  const stmtTo = `${month}-${String(lastDay).padStart(2, "0")}`;

  // 특정 지점(company_id)으로 명세서 발행 페이지 이동
  function pushNewStatement(companyId: string) {
    router.push(`/admin/statements/new?salesCompanyId=${companyId}&salesFrom=${stmtFrom}&salesTo=${stmtTo}`);
  }
  // 명세서 발행 시작 — 단일 거래처는 바로, 합산 그룹(지점 2곳+)은 지점 선택 팝업
  function startStatement(row: CompanyRow) {
    if (row.members.length <= 1) pushNewStatement(row.id);
    else setStmtPickerRow(row);
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">정산 관리</h1>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-bg-card">
          <button type="button" onClick={() => changeMonth(-1)} className="p-2.5 text-text-muted hover:text-text-primary transition-colors" title="전월">
            <ChevronLeft size={18} />
          </button>
          <span className="px-3 py-2 text-sm font-semibold text-text-primary min-w-[100px] text-center">{monthLabel}</span>
          <button type="button" onClick={() => changeMonth(1)} className="p-2.5 text-text-muted hover:text-text-primary transition-colors" title="다음월">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">총 판매액</p>
          <p className="text-xl font-bold text-text-primary">{formatNumber(summary.totalSales)}원</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">명세서 발행</p>
          <p className="text-xl font-bold text-emerald-400">{summary.stmtIssued}개사</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">세금계산서 미발행</p>
          <p className={`text-xl font-bold ${summary.taxUnissued > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {summary.taxUnissued}건
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">{summary.totalUnpaid < 0 ? "당월 과입금" : "당월 미수금"}</p>
          <p className={`text-xl font-bold ${summary.totalUnpaid > 0 ? "text-red-400" : summary.totalUnpaid < 0 ? "text-blue-400" : "text-text-primary"}`}>
            {formatBalance(summary.totalUnpaid)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4">
          {(() => {
            const total = summary.totalUnpaid + summary.totalPrevUnpaid;
            return (
              <>
                <p className="text-xs text-text-muted mb-1">{total < 0 ? "누계 과입금" : "누계 미수금"}</p>
                <p className={`text-xl font-bold ${total > 0 ? "text-orange-400" : total < 0 ? "text-blue-400" : "text-text-primary"}`}>
                  {formatBalance(total)}
                </p>
                {summary.totalPrevUnpaid !== 0 && (
                  <p className="text-[10px] text-text-muted mt-0.5">
                    이전 월 {formatBalance(summary.totalPrevUnpaid)}
                  </p>
                )}
              </>
            );
          })()}
        </div>
        {/* 가정산 미수 (명세서 발행분 포함 — 세금계산서 미발행이라도 합산) */}
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          {(() => {
            const total = summary.totalEstUnpaid + summary.totalPrevUnpaid;
            return (
              <>
                <p className="text-xs text-text-muted mb-1">{total < 0 ? "가정산 과입금" : "가정산 미수"}</p>
                <p className={`text-xl font-bold ${total > 0 ? "text-primary" : total < 0 ? "text-blue-400" : "text-text-primary"}`}>
                  {formatBalance(total)}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  당월 명세서 {formatBalance(summary.totalEstUnpaid)}
                </p>
              </>
            );
          })()}
        </div>
      </div>

      {/* 거래처별 카드 */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : companyRows.length === 0 ? (
        <div className="text-center py-20">
          <Receipt size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">{monthLabel} 판매·정산 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {companyRows.map((row) => {
            const billing = row.billing;
            // unpaid 음수 = 과입금
            const unpaid = billing ? billing.total_amount - billing.paid_amount : 0;
            const paidPct = billing && billing.total_amount > 0
              ? Math.min(100, Math.round((billing.paid_amount / billing.total_amount) * 100))
              : 0;

            // 판매(출고) ↔ 명세서 크로스체크
            const matchResult = matchSalesToStatements(
              row.sales.logs.map(logToSalesLine),
              row.statements.flatMap((s) => s.statement_items || []),
            );
            const mismatchSummary = row.statements.length > 0 && row.sales.amount > 0
              ? summarizeMismatch(matchResult)
              : null;

            return (
              <div key={row.id} className="rounded-2xl border border-border bg-bg-card overflow-hidden">
                {/* 카드 헤더 */}
                <div className={`px-6 py-4 border-b ${matchResult.missingLines.length > 0 ? "border-red-500/40 bg-red-500/5" : "border-border bg-bg-dark/40"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-text-primary">{row.name}</h3>
                      {row.members.length > 1 && (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 font-semibold text-indigo-300 bg-indigo-500/15 border border-indigo-500/40"
                          title={`같은 사업자번호(${row.groupBizNumber})의 ${row.members.length}개 지점을 합산 정산합니다: ${row.members.map((mm) => mm.name).join(", ")}`}
                        >
                          합산 {row.members.length}개 지점
                        </span>
                      )}
                      {row.strayBillings && row.strayBillings.length > 0 && (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 font-semibold text-orange-400 bg-orange-500/15 border border-orange-500/40"
                          title={`지점 레코드에 별도 청구가 남아 있어 합산에서 제외됐습니다: ${row.strayBillings.map((sb) => `${sb.companyName}(${sb.billingMonth})`).join(", ")}. 수동 확인이 필요합니다.`}
                        >
                          <AlertTriangle size={11} /> 미합산 청구 {row.strayBillings.length}건
                        </span>
                      )}
                      {mismatchSummary && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-semibold border ${
                            matchResult.missingLines.length > 0
                              ? "text-red-400 bg-red-500/20 border-red-500/50"
                              : "text-yellow-400 bg-yellow-500/15 border-yellow-500/40"
                          }`}
                          title="판매(출고) 합계와 명세서 항목 합계가 일치하지 않습니다"
                        >
                          <AlertTriangle size={12} /> {mismatchSummary}
                        </span>
                      )}
                      {billing && row.sales.amount > 0 && (row.sales.amount + Math.round(row.sales.amount * 0.1)) !== billing.total_amount && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-orange-400 bg-orange-500/10 rounded-full px-2 py-0.5" title="판매액과 청구액이 일치하지 않습니다">
                          <AlertTriangle size={10} /> 청구액 불일치
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-accent shrink-0">{formatNumber(row.sales.amount)}원</span>
                  </div>
                </div>

                {/* 4단계 흐름 */}
                <div className="grid sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">

                  {/* ① 판매 현황 */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StepIcon done={row.sales.count > 0} />
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">① 판매</span>
                    </div>
                    {row.sales.count > 0 ? (
                      <>
                        <p className="text-base font-bold text-text-primary">{formatNumber(row.sales.amount)}원</p>
                        <p className="text-xs text-text-muted mt-0.5">{row.sales.count}건</p>
                      </>
                    ) : (
                      <p className="text-xs text-text-muted">판매 없음</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setSalesDetailModal({ companyName: row.name, logs: row.sales.logs, statements: row.statements, billing: row.billing })}
                      className="mt-2 text-[11px] text-primary/70 hover:text-primary underline"
                    >
                      판매 상세 보기
                    </button>
                  </div>

                  {/* ② 거래명세서 */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StepIcon done={row.statements.length > 0} />
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">② 명세서</span>
                    </div>
                    {row.statements.length > 0 ? (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center mb-1 pb-1 border-b border-border/50">
                          <span className="text-[11px] text-text-muted">{row.statements.length}건 합계</span>
                          <span className="text-xs font-bold text-text-primary">{formatNumber(row.statements.reduce((s, st) => s + st.total_amount, 0))}원</span>
                        </div>
                        {row.statements.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-emerald-400 shrink-0">{s.statement_number}</span>
                              {row.members.length > 1 && s.companies?.name && (
                                <span className="text-[10px] text-indigo-300/80 truncate" title={s.companies.name}>
                                  {s.companies.name}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => router.push(`/admin/statements/${s.id}`)}
                                className="inline-flex items-center gap-0.5 text-[11px] text-text-muted hover:text-primary transition-colors shrink-0"
                              >
                                <ExternalLink size={10} /> PDF
                              </button>
                            </div>
                            <span className="text-[11px] text-text-secondary shrink-0">{formatNumber(s.total_amount)}원</span>
                          </div>
                        ))}
                        {/* 청구에서 빠진 출고 강조 박스 */}
                        {matchResult.missingLines.length > 0 ? (
                          <div className="mt-2 rounded-lg bg-red-500/15 border-2 border-red-500/50 p-2.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 mb-1">
                              <AlertTriangle size={13} />
                              청구 누락 {matchResult.missingLines.length}건 · {formatNumber(matchResult.missingLines.reduce((s, l) => s + l.amount, 0))}원
                            </div>
                            <ul className="space-y-0.5 mb-2">
                              {matchResult.missingLines.slice(0, 3).map((l, i) => (
                                <li key={i} className="flex justify-between text-[10px]">
                                  <span className="text-text-secondary truncate">
                                    <span className="text-text-muted">{(l.log_date ?? "").slice(5)}</span> · {l.product_name}
                                  </span>
                                  <span className="text-red-400 font-medium shrink-0 ml-1">{formatNumber(l.amount)}원</span>
                                </li>
                              ))}
                              {matchResult.missingLines.length > 3 && (
                                <li className="text-[10px] text-text-muted">… 외 {matchResult.missingLines.length - 3}건</li>
                              )}
                            </ul>
                            <button
                              type="button"
                              onClick={() => startStatement(row)}
                              className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-red-500/25 border border-red-500/50 text-red-300 text-[11px] font-bold hover:bg-red-500/35 transition-colors"
                            >
                              <Plus size={11} /> 누락분 명세서 발행
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startStatement(row)}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary"
                          >
                            <Plus size={10} /> 추가 발행
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-text-muted mb-2">미발행</p>
                        <button
                          type="button"
                          onClick={() => startStatement(row)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                        >
                          <FileText size={12} /> 명세서 발행
                        </button>
                      </>
                    )}
                  </div>

                  {/* ③ 세금계산서 */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StepIcon done={!!billing?.tax_invoice_issued} />
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">③ 세금계산서</span>
                    </div>
                    {billing?.tax_invoice_issued ? (
                      <div>
                        <p className="text-xs text-emerald-400 font-medium">발행완료</p>
                        {billing.tax_invoice_date && (
                          <p className="text-[11px] text-text-muted">{billing.tax_invoice_date}</p>
                        )}
                        {billing.tax_invoice_number && (
                          <p className="text-[11px] text-text-muted font-mono">{billing.tax_invoice_number}</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-text-muted mb-2">미발행</p>
                        <button
                          type="button"
                          onClick={() => openTaxModal(row)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 text-xs font-medium hover:bg-yellow-500/20 transition-colors"
                        >
                          <Receipt size={12} /> 발행 처리
                        </button>
                      </>
                    )}
                  </div>

                  {/* ④ 수금 */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StepIcon done={!!billing && unpaid === 0 && billing.paid_amount > 0} />
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">④ 수금</span>
                    </div>
                    {billing ? (
                      <div className="space-y-0.5 mb-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-text-muted">청구액</span>
                          <span className="text-text-primary">{formatNumber(billing.total_amount)}원</span>
                        </div>
                        {/* 판매액과 청구액 차이 경고 */}
                        {(() => {
                          const expectedBilling = row.sales.amount + Math.round(row.sales.amount * 0.1);
                          const diff = expectedBilling - billing.total_amount;
                          return diff !== 0 && row.sales.amount > 0 ? (
                            <div className="flex justify-between text-[10px] bg-yellow-500/10 rounded px-1.5 py-0.5 -mx-1.5">
                              <span className="text-yellow-400">판매 기준 {formatNumber(expectedBilling)}원</span>
                              <span className="text-yellow-400 font-bold">{diff > 0 ? "+" : ""}{formatNumber(diff)}원</span>
                            </div>
                          ) : null;
                        })()}
                        <div className="flex justify-between text-xs">
                          <span className="text-text-muted">입금액</span>
                          <span className="text-emerald-400">{formatNumber(billing.paid_amount)}원</span>
                        </div>
                        {unpaid !== 0 && (
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-text-muted">{unpaid < 0 ? "과입금" : "미수금"}</span>
                            <span className={unpaid < 0 ? "text-blue-400" : "text-red-400"}>
                              {formatBalance(unpaid)}
                            </span>
                          </div>
                        )}
                        {(() => {
                          const prevUnpaid = prevUnpaidMap[row.id] || 0;
                          const totalUnpaid = unpaid + prevUnpaid;
                          return prevUnpaid !== 0 ? (
                            <div className="flex justify-between text-xs font-bold mt-0.5 pt-0.5 border-t border-border/50">
                              <span className="text-text-muted">{totalUnpaid < 0 ? "누계 과입금" : "누계 미수금"}</span>
                              <span className={totalUnpaid < 0 ? "text-blue-400" : "text-orange-400"}>
                                {formatBalance(totalUnpaid)}
                              </span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    ) : (
                      <div className="mb-2 space-y-0.5">
                        <p className="text-xs text-text-muted">당월 입금 내역 없음</p>
                        {(() => {
                          const prevUnpaid = prevUnpaidMap[row.id] || 0;
                          // 세금계산서 미발행이라도 명세서 발행분은 가정산 미수로 계산
                          const estCurrent = row.statements.length > 0 ? statementBasedTotal(row.statements) : 0;
                          return (
                            <>
                              {estCurrent > 0 && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-text-muted">당월 명세서(가정산)</span>
                                  <span className="text-red-400 font-bold">{formatBalance(estCurrent)}</span>
                                </div>
                              )}
                              {prevUnpaid !== 0 && (
                                <div className="flex justify-between text-xs font-bold">
                                  <span className="text-text-muted">{prevUnpaid < 0 ? "이전 월 과입금" : "이전 월 미수금"}</span>
                                  <span className={prevUnpaid < 0 ? "text-blue-400" : "text-orange-400"}>
                                    {formatBalance(prevUnpaid)}
                                  </span>
                                </div>
                              )}
                              {estCurrent > 0 && prevUnpaid !== 0 && (() => {
                                const totalEst = estCurrent + prevUnpaid;
                                return (
                                  <div className="flex justify-between text-xs font-bold mt-0.5 pt-0.5 border-t border-border/50">
                                    <span className="text-text-muted">{totalEst < 0 ? "누계 과입금" : "누계 가정산 미수"}</span>
                                    <span className={totalEst < 0 ? "text-blue-400" : "text-primary"}>
                                      {formatBalance(totalEst)}
                                    </span>
                                  </div>
                                );
                              })()}
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {/* 수금 progress bar (청구 있을 때만) */}
                    {billing && (
                      <div className="h-1.5 rounded-full bg-bg-dark overflow-hidden mb-2">
                        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${paidPct}%` }} aria-label={`수금률 ${paidPct}%`} />
                      </div>
                    )}
                    {/* 입금 처리 버튼 — 항상 노출 (이전 월 미수/조정 입금/과입금 환불 대응) */}
                    <button
                      type="button"
                      onClick={() => {
                        setPayModalRow(row);
                        setEditingPayment(null);
                        setSplittingPayment(null);
                        setPayAmount(0);
                        setPayDate(new Date().toISOString().slice(0, 10));
                        setPayMethod("bank_transfer");
                        setPayNotes("");
                        setPayDepositor("");
                        setPayBank("");
                        // 이전 월 미수가 있으면 분배 패널 자동 펼침 (충당 권장)
                        const hasPrev = (prevUnpaidDetailMap[row.id] || []).some((d) => d.outstanding > 0);
                        setPayShowAllocation(hasPrev);
                        setPayAllocations({});
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                    >
                      <CreditCard size={12} /> 입금 처리
                    </button>
                    {/* 입금 이력 */}
                    {billing && billing.payments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {billing.payments.map((p: Payment) => {
                          const matchedStmt = p.statement_id
                            ? row.statements.find((s) => s.id === p.statement_id)
                            : null;
                          return (
                          <div key={p.id} className="group flex items-start justify-between text-[10px] text-text-muted gap-2">
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{p.payment_date}</span>
                                <span className="text-emerald-400 font-medium">+{formatNumber(p.amount)}원</span>
                                {p.payment_group_id && (
                                  <span
                                    className="inline-flex items-center text-[9px] font-semibold text-purple-400 bg-purple-500/15 border border-purple-500/30 rounded-sm px-1 py-0"
                                    title="다른 월 청구에도 같은 송금에서 분배된 입금이 있습니다"
                                  >
                                    분할
                                  </span>
                                )}
                                {matchedStmt && (
                                  <span
                                    className="inline-flex items-center text-[9px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-sm px-1 py-0"
                                    title={`충당 명세서: ${matchedStmt.statement_number}`}
                                  >
                                    {matchedStmt.statement_number}
                                  </span>
                                )}
                                {p.statement_id && !matchedStmt && (
                                  <span className="inline-flex items-center text-[9px] text-emerald-300/70 bg-emerald-500/5 border border-emerald-500/20 rounded-sm px-1 py-0">
                                    명세서충당
                                  </span>
                                )}
                              </div>
                              {(p.depositor_name || p.bank_name || p.notes) && (
                                <div className="text-[9px] text-text-muted/70 truncate">
                                  {p.depositor_name && <span>{p.depositor_name}</span>}
                                  {p.bank_name && <span>{p.depositor_name ? ` · ${p.bank_name}` : p.bank_name}</span>}
                                  {p.notes && <span className="text-text-muted/50">{(p.depositor_name || p.bank_name) ? ` — ${p.notes}` : p.notes}</span>}
                                </div>
                              )}
                            </div>
                            <span className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => openSplitPayment(p, row)}
                                aria-label="입금 분할/재매칭"
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-purple-400/10 text-text-muted hover:text-purple-400 transition-all"
                                title="입금 분할/재매칭 — 명세서별로 재분배"
                              >
                                <Split size={10} />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditPayment(p, row)}
                                aria-label="입금 수정"
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-blue-400/10 text-text-muted hover:text-blue-400 transition-all"
                                title="입금 수정"
                              >
                                <FileText size={10} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePayment(p, billing.id)}
                                aria-label="입금 삭제"
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-all"
                                title="입금 삭제"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 세금계산서 발행 모달 */}
      {taxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-bg-card z-10">
              <h2 className="text-base font-bold text-text-primary">세금계산서 발행 — {taxModal.name}</h2>
              <button type="button" onClick={() => setTaxModal(null)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleTaxInvoice} className="p-6 space-y-5">

              {/* 발행 전 크로스체크 패널 */}
              {(() => {
                const taxMatch = matchSalesToStatements(
                  taxModal.sales.logs.map(logToSalesLine),
                  taxModal.statements.flatMap((s) => s.statement_items || []),
                );
                const stmtSupply = taxModal.statements.reduce((s, st) => s + st.supply_amount, 0);
                const salesAmount = taxModal.sales.amount;
                const diff = salesAmount - stmtSupply;

                if (taxModal.statements.length === 0 || diff === 0) {
                  return diff === 0 && taxModal.statements.length > 0 ? (
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">판매·명세서 일치 — 발행 준비 완료</span>
                    </div>
                  ) : null;
                }

                return (
                  <div className="rounded-xl bg-red-500/15 border-2 border-red-500/50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={18} className="text-red-400" />
                      <span className="text-sm font-bold text-red-400">발행 전 점검 — 판매액과 명세서 합계 불일치</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-bg-dark/60 px-3 py-2">
                        <p className="text-text-muted mb-0.5">판매액 (출고)</p>
                        <p className="text-text-primary font-bold">{formatNumber(salesAmount)}원</p>
                      </div>
                      <div className="rounded-lg bg-bg-dark/60 px-3 py-2">
                        <p className="text-text-muted mb-0.5">명세서 합계</p>
                        <p className="text-text-primary font-bold">{formatNumber(stmtSupply)}원</p>
                      </div>
                      <div className="rounded-lg bg-red-500/20 px-3 py-2 border border-red-500/40">
                        <p className="text-red-400 mb-0.5">차이</p>
                        <p className="text-red-400 font-bold">{diff > 0 ? "+" : ""}{formatNumber(diff)}원</p>
                      </div>
                    </div>

                    {/* 누락 출고 상세 */}
                    {taxMatch.missingLines.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-text-secondary mb-1.5">미반영 출고 {taxMatch.missingLines.length}건</p>
                        <ul className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {taxMatch.missingLines.map((l, i) => (
                            <li key={i} className="flex justify-between text-xs bg-red-500/10 rounded px-2 py-1.5">
                              <span>
                                <span className="text-text-muted">{l.log_date}</span>
                                <span className="mx-1.5">·</span>
                                <span className="text-text-primary font-medium">{l.product_name}</span>
                                <span className="text-text-muted ml-1">× {formatNumber(l.quantity)}{l.unit || ""}</span>
                              </span>
                              <span className="text-red-400 font-bold">{formatNumber(l.amount)}원</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const r = taxModal;
                          setTaxModal(null);
                          startStatement(r);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/25 border border-red-500/50 text-red-300 text-xs font-bold hover:bg-red-500/35 transition-colors"
                      >
                        <Plus size={12} /> 누락분 명세서 먼저 발행
                      </button>
                      <span className="text-[11px] text-text-muted">또는 ↓ 아래에서 발행 진행</span>
                    </div>
                  </div>
                );
              })()}

              {/* 명세서 합산 선택 */}
              {taxModal.statements.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-text-primary mb-2">포함할 명세서 선택</p>
                  <div className="space-y-1.5 rounded-xl border border-border bg-bg-dark p-3">
                    {taxModal.statements.map((s) => (
                      <label key={s.id} className="flex items-center justify-between gap-3 cursor-pointer hover:bg-bg-card-hover rounded-lg px-2 py-1.5 transition-colors">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={taxChecked.has(s.id)}
                            onChange={(e) => {
                              const next = new Set(taxChecked);
                              if (e.target.checked) next.add(s.id);
                              else next.delete(s.id);
                              setTaxChecked(next);
                              setTaxSupplyOverride(null);
                            }}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-xs text-text-secondary">{s.statement_number}</span>
                          {taxModal.members.length > 1 && s.companies?.name && (
                            <span className="text-[10px] text-indigo-300/80">{s.companies.name}</span>
                          )}
                          <span className="text-[11px] text-text-muted">{s.statement_date}</span>
                        </div>
                        <span className="text-xs font-medium text-text-primary">{formatNumber(s.supply_amount)}원</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 발행 금액 */}
              <div className="rounded-xl border border-border bg-bg-dark p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">공급가액</span>
                  <span className="text-text-primary font-medium">{formatNumber(taxComputedSupply)}원</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">세액 (10%)</span>
                  <span className="text-text-primary">{formatNumber(taxComputedTax)}원</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
                  <span className="text-text-primary">합계</span>
                  <span className="text-accent">{formatNumber(taxComputedTotal)}원</span>
                </div>
                <div className="pt-1">
                  <label className="text-xs text-text-muted">금액 직접 수정</label>
                  <input
                    type="number" min={0}
                    value={taxSupplyOverride ?? taxComputedSupply}
                    onChange={(e) => setTaxSupplyOverride(Number(e.target.value))}
                    aria-label="공급가액 직접 입력"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-bg-card text-text-primary text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">발행일 <span className="text-red-400">*</span></label>
                  <input type="date" value={taxDate} onChange={(e) => setTaxDate(e.target.value)} required
                    aria-label="세금계산서 발행일"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">승인번호 (선택)</label>
                  <input type="text" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)}
                    placeholder="국세청 승인번호" aria-label="국세청 승인번호"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={() => setTaxModal(null)} className="px-5 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-yellow-500 text-bg-dark font-semibold hover:bg-yellow-400 transition-colors">발행 완료</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 입금 처리 모달 */}
      {payModalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">
                {splittingPayment ? "입금 분할/재매칭" : editingPayment ? "입금 수정" : "입금 처리"} — {payModalRow.name}
              </h2>
              <button type="button" onClick={closePayModal} className="text-text-muted hover:text-text-primary" aria-label="모달 닫기"><X size={20} /></button>
            </div>
            <form onSubmit={handlePayment} className="p-6 space-y-4">
              {/* 분할 모드 안내 */}
              {splittingPayment && (
                <div className="rounded-xl bg-purple-500/10 border-2 border-purple-500/40 px-4 py-3 text-xs text-purple-200">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Split size={14} />
                    <span className="font-bold">분할/재매칭 모드 (반제 처리)</span>
                  </div>
                  <p className="text-purple-200/80">
                    기존 입금 <span className="font-mono font-semibold">+{formatNumber(splittingPayment.amount)}원</span>
                    {splittingPayment.payment_date && <> ({splittingPayment.payment_date})</>}
                    {" "}을 명세서별로 재분배합니다. 저장 시 원래 row는 삭제되고 분배 결과로 새로 생성됩니다.
                  </p>
                </div>
              )}
              {payModalRow.billing ? (() => {
                const u = payModalRow.billing.total_amount - payModalRow.billing.paid_amount;
                return (
                  <p className="text-sm text-text-secondary">
                    {u < 0 ? "과입금" : "미수금"}{" "}
                    <span className={`font-bold ${u < 0 ? "text-blue-400" : "text-red-400"}`}>
                      {formatBalance(u)}
                    </span>
                  </p>
                );
              })() : (
                <p className="text-xs text-yellow-500 bg-yellow-500/10 rounded-lg px-3 py-2">
                  청구 내역이 없습니다. 입금 처리 시 판매 금액 기준으로 청구가 자동 생성됩니다.
                </p>
              )}
              {(prevUnpaidMap[payModalRow.id] || 0) !== 0 && !editingPayment && (() => {
                const prev = prevUnpaidMap[payModalRow.id];
                const hasUnpaid = (prevUnpaidDetailMap[payModalRow.id] || []).some((d) => d.outstanding > 0);
                return (
                  <div className={`text-xs rounded-lg px-3 py-2 ${prev < 0 ? "text-blue-400 bg-blue-400/10" : "text-orange-400 bg-orange-400/10"}`}>
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span>이전 월 {prev < 0 ? "과입금" : "미수금"}{" "}
                        <span className="font-bold">{formatBalance(prev)}</span>
                        이 남아있습니다.</span>
                      {hasUnpaid && !splittingPayment && (
                        <button
                          type="button"
                          onClick={() => setPayShowAllocation((v) => !v)}
                          aria-label={payShowAllocation ? "분배 닫기" : "분배 충당"}
                          className="ml-auto text-[11px] font-semibold underline decoration-dotted hover:no-underline shrink-0"
                        >
                          {payShowAllocation ? "분배 닫기" : "분배 충당"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">입금액 <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={payAmount ? formatNumber(payAmount) : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setPayAmount(raw ? Number(raw) : 0);
                    }}
                    required
                    aria-label="입금액"
                    placeholder="0"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary text-right font-mono"
                  />
                  {payAmount > 0 && (
                    <p className="text-xs text-primary mt-1">{numberToKorean(payAmount)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">입금일</label>
                  <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                    aria-label="입금일"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">입금방법</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                    aria-label="입금방법"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary">
                    <option value="bank_transfer">계좌이체</option>
                    <option value="cash">현금</option>
                    <option value="card">카드</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">입금자명</label>
                  <input type="text" value={payDepositor} onChange={(e) => setPayDepositor(e.target.value)}
                    aria-label="입금자명" placeholder="보낸 사람"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">은행명</label>
                  <input type="text" value={payBank} onChange={(e) => setPayBank(e.target.value)}
                    aria-label="은행명" placeholder="국민, 신한 등"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">메모</label>
                  <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)}
                    aria-label="입금 메모" placeholder="메모"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
              </div>

              {/* 충당 분배 패널 — 명세서 1건씩 미결을 표시하고 건별 충당 */}
              {(payShowAllocation || splittingPayment) && !editingPayment && allocBuckets.length > 0 && (() => {
                const sumDiff = payAmount - allocSum;
                const sumOk = payAmount > 0 && sumDiff === 0;
                // 월별로 그룹화
                const byMonth: Record<string, AllocBucket[]> = {};
                const monthOrder: string[] = [];
                for (const b of allocBuckets) {
                  if (!byMonth[b.billingMonth]) {
                    byMonth[b.billingMonth] = [];
                    monthOrder.push(b.billingMonth);
                  }
                  byMonth[b.billingMonth].push(b);
                }
                return (
                  <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-3 space-y-2 max-h-[50vh] overflow-y-auto">
                    <div className="flex items-center justify-between sticky top-0 bg-bg-card pb-1">
                      <p className="text-xs font-semibold text-primary uppercase tracking-wide">건별 충당 분배</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPayAllocations({})}
                          aria-label="충당액 초기화"
                          className="text-[11px] px-2 py-1 rounded-md bg-bg-dark text-text-muted font-medium hover:text-text-primary transition-colors"
                          title="모든 충당액을 0으로"
                        >
                          초기화
                        </button>
                        <button
                          type="button"
                          onClick={autoDistribute}
                          disabled={payAmount <= 0}
                          aria-label="자동 분배 (FIFO)"
                          className="text-[11px] px-2 py-1 rounded-md bg-primary/15 text-primary font-medium hover:bg-primary/25 transition-colors disabled:opacity-40"
                          title="오래된 명세서부터 자동으로 채워줍니다"
                        >
                          자동 분배 (FIFO)
                        </button>
                      </div>
                    </div>
                    {monthOrder.map((mKey) => {
                      const isCurrentMonth = mKey === month;
                      const monthBuckets = byMonth[mKey];
                      const monthOutstanding = monthBuckets.reduce((s, b) => s + b.outstanding, 0);
                      const monthAllocated = monthBuckets.reduce((s, b) => s + (payAllocations[b.key] || 0), 0);
                      return (
                        <div key={mKey} className="space-y-1">
                          <div className="flex items-center justify-between px-1">
                            <span className={`text-[11px] font-bold ${isCurrentMonth ? "text-primary" : "text-text-secondary"}`}>
                              {mKey}{isCurrentMonth ? " (당월)" : ""}
                            </span>
                            <span className="text-[10px] text-text-muted">
                              잔액 {formatBalance(monthOutstanding)}
                              {monthAllocated > 0 && (
                                <span className="text-primary"> · 충당 {formatNumber(monthAllocated)}원</span>
                              )}
                            </span>
                          </div>
                          {monthBuckets.map((b) => {
                            const allocated = payAllocations[b.key] || 0;
                            const remainingAfter = b.outstanding - allocated;
                            const label = b.isStatement
                              ? `${b.statementNumber || "(명세서)"} · ${b.statementDate || ""}`
                              : "(청구 단위 미분류)";
                            return (
                              <div key={b.key} className="flex items-center gap-2 bg-bg-dark/60 rounded-lg px-2.5 py-1.5">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-[11px] truncate ${b.isStatement ? "text-text-primary" : "text-yellow-400/80 italic"}`}>
                                      {label}
                                    </span>
                                    {b.isStatement && payModalRow.members.length > 1 && b.companyName && (
                                      <span className="text-[10px] text-indigo-300/80 shrink-0">{b.companyName}</span>
                                    )}
                                    <span className={`text-[10px] font-medium shrink-0 ${b.outstanding > 0 ? "text-red-400" : b.outstanding < 0 ? "text-blue-400" : "text-text-muted"}`}>
                                      {b.outstanding > 0 ? "미수 " : b.outstanding < 0 ? "과입금 " : "정산 "}
                                      {formatBalance(b.outstanding)}
                                    </span>
                                  </div>
                                  {b.isStatement && typeof b.paid === "number" && typeof b.totalAmount === "number" && b.paid > 0 && (
                                    <p className="text-[9px] text-emerald-400/80 mt-0.5">
                                      이미 입금 {formatNumber(b.paid)}원 / 총 {formatNumber(b.totalAmount)}원
                                    </p>
                                  )}
                                  {allocated > 0 && (
                                    <p className="text-[9px] text-text-muted mt-0.5">
                                      충당 후 잔여 {formatBalance(remainingAfter)}
                                    </p>
                                  )}
                                </div>
                                {b.isStatement && b.outstanding > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setPayAllocations((prev) => ({ ...prev, [b.key]: b.outstanding }))}
                                    aria-label={`${label} 전액 충당`}
                                    className="text-[9px] px-1.5 py-1 rounded bg-emerald-500/10 text-emerald-400 font-medium hover:bg-emerald-500/20 shrink-0"
                                    title="이 명세서 전액 충당"
                                  >
                                    전액
                                  </button>
                                )}
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={allocated ? formatNumber(allocated) : ""}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9]/g, "");
                                    const v = raw ? Number(raw) : 0;
                                    setPayAllocations((prev) => ({ ...prev, [b.key]: v }));
                                  }}
                                  placeholder="0"
                                  aria-label={`${label} 충당액`}
                                  className="w-28 px-2 py-1.5 rounded-md border border-border bg-bg-card text-text-primary text-sm text-right font-mono focus:outline-none focus:border-primary"
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                    <div className={`flex items-center justify-between text-xs pt-1.5 border-t sticky bottom-0 bg-bg-card ${sumOk ? "border-emerald-500/30" : "border-red-500/30"}`}>
                      <span className="text-text-muted">분배 합계 / 입금액</span>
                      <span className={`font-bold ${sumOk ? "text-emerald-400" : "text-red-400"}`}>
                        {formatNumber(allocSum)} / {formatNumber(payAmount)}원
                        {!sumOk && payAmount > 0 && (
                          <span className="ml-1.5 text-[10px] font-normal">
                            ({sumDiff > 0 ? "부족 " : "초과 "}
                            {formatNumber(Math.abs(sumDiff))}원)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={closePayModal} className="px-5 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</button>
                <button
                  type="submit"
                  disabled={paySubmitting || payAmount <= 0 || ((payShowAllocation || !!splittingPayment) && !editingPayment && allocSum !== payAmount)}
                  className={`px-5 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white ${splittingPayment ? "bg-purple-500 hover:bg-purple-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
                >
                  {paySubmitting ? "처리 중..." : splittingPayment ? "분할 저장 (반제)" : editingPayment ? "수정 완료" : "입금 확인"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 명세서 발행 지점 선택 모달 (합산 그룹) */}
      {stmtPickerRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">발행할 지점 선택</h2>
              <button type="button" onClick={() => setStmtPickerRow(null)} className="text-text-muted hover:text-text-primary" aria-label="닫기"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-xs text-text-muted px-1 pb-1">
                {stmtPickerRow.groupBizNumber} · 같은 사업자의 지점이 여러 곳입니다. 어느 지점으로 명세서를 발행할까요?
              </p>
              {stmtPickerRow.members.map((mem) => (
                <button
                  key={mem.id}
                  type="button"
                  onClick={() => {
                    setStmtPickerRow(null);
                    pushNewStatement(mem.id);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-border bg-bg-dark hover:border-primary hover:bg-bg-card-hover transition-colors text-left"
                >
                  <span className="text-sm font-medium text-text-primary">{mem.name}</span>
                  {mem.id === stmtPickerRow.id && (
                    <span className="text-[10px] text-primary bg-primary/10 rounded-full px-2 py-0.5">대표</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 청구 생성 모달 */}
      {billingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">청구 생성 — {billingModal.companyName}</h2>
              <button type="button" onClick={() => setBillingModal(null)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateBilling} className="p-6 space-y-4">
              <p className="text-xs text-text-muted">
                판매 데이터 기준 자동 계산됨 (수정 가능)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">공급가액</label>
                  <input type="text" inputMode="numeric"
                    value={billingSupply ? formatNumber(billingSupply) : ""}
                    aria-label="공급가액"
                    onChange={(e) => { const v = Number(e.target.value.replace(/[^0-9]/g, "") || 0); setBillingSupply(v); setBillingTax(Math.round(v * 0.1)); }}
                    placeholder="0"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary text-right font-mono" />
                  {billingSupply > 0 && <p className="text-xs text-primary mt-1">{numberToKorean(billingSupply)}</p>}
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">세액 (10%)</label>
                  <input type="text" inputMode="numeric"
                    value={billingTax ? formatNumber(billingTax) : ""}
                    aria-label="세액"
                    onChange={(e) => setBillingTax(Number(e.target.value.replace(/[^0-9]/g, "") || 0))}
                    placeholder="0"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary text-right font-mono" />
                </div>
              </div>
              <div className="rounded-xl bg-bg-dark border border-border p-3 flex justify-between items-center">
                <span className="text-sm text-text-muted">합계</span>
                <span className="text-lg font-bold text-accent">{formatNumber(billingSupply + billingTax)}원</span>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">메모</label>
                <input type="text" value={billingNotes} onChange={(e) => setBillingNotes(e.target.value)}
                  aria-label="청구 메모" placeholder="메모"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setBillingModal(null)} className="px-5 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors">청구 생성</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 판매 상세 모달 */}
      {salesDetailModal && (() => {
        const logs = salesDetailModal.logs;
        const supply = logs.reduce((s, l) => s + l.quantity * (l.unit_price || 0), 0);
        const tax = Math.round(supply * 0.1);
        const salesLines = logs.map(logToSalesLine);
        const stmtItemsForMatch = salesDetailModal.statements.flatMap((s) => s.statement_items || []);
        const match = matchSalesToStatements(salesLines, stmtItemsForMatch);
        const hasStatements = salesDetailModal.statements.length > 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <h2 className="text-base font-bold text-text-primary">
                  판매 상세 — {salesDetailModal.companyName}
                  <span className="ml-2 text-sm font-normal text-text-muted">{logs.length}건</span>
                </h2>
                <button type="button" onClick={() => setSalesDetailModal(null)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-bg-dark">
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-text-muted font-medium">날짜</th>
                      <th className="px-4 py-3 text-left text-text-muted font-medium">품목</th>
                      <th className="px-4 py-3 text-right text-text-muted font-medium">수량</th>
                      <th className="px-4 py-3 text-right text-text-muted font-medium">단가</th>
                      <th className="px-4 py-3 text-right text-text-muted font-medium">공급가</th>
                      <th className="px-4 py-3 text-right text-text-muted font-medium">부가세</th>
                      {hasStatements && (
                        <th className="px-4 py-3 text-center text-text-muted font-medium">명세서</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const lineSupply = log.quantity * (log.unit_price || 0);
                      const lineTax = Math.round(lineSupply * 0.1);
                      const status = match.matchedRows.get(log.id);
                      const rowBg =
                        status === "missing_estimated"
                          ? "bg-red-500/15 hover:bg-red-500/20 border-l-4 border-l-red-500"
                          : status === "amount_mismatch"
                            ? "bg-yellow-500/10 hover:bg-yellow-500/15 border-l-4 border-l-yellow-500"
                            : "border-l-4 border-l-transparent hover:bg-bg-card-hover";
                      return (
                        <tr key={log.id} className={`border-b border-border/50 transition-colors ${rowBg}`}>
                          <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">{log.log_date}</td>
                          <td className="px-4 py-3 text-text-primary">
                            {log.products?.name || log.reason || "(기타)"}
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary">
                            {formatNumber(log.quantity)}
                            <span className="text-text-muted text-xs ml-0.5">{log.products?.unit || ""}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary text-xs">{formatNumber(log.unit_price || 0)}</td>
                          <td className="px-4 py-3 text-right font-medium text-accent">{formatNumber(lineSupply)}원</td>
                          <td className="px-4 py-3 text-right text-text-muted text-xs">{formatNumber(lineTax)}원</td>
                          {hasStatements && (
                            <td className="px-4 py-3 text-center text-xs whitespace-nowrap">
                              {status === "included" && (
                                <span className="inline-flex items-center gap-0.5 text-emerald-400" title="명세서에 포함됨">
                                  <CheckCircle2 size={12} />
                                </span>
                              )}
                              {status === "missing_estimated" && (
                                <span className="inline-flex items-center gap-0.5 text-red-400 font-medium" title="이 출고가 명세서에서 누락된 것으로 추정됩니다">
                                  <AlertTriangle size={12} /> 누락
                                </span>
                              )}
                              {status === "amount_mismatch" && (
                                <span className="inline-flex items-center gap-0.5 text-yellow-400" title="같은 품목 합계가 명세서와 다릅니다 (1:1 매칭 불가)">
                                  <AlertTriangle size={12} /> 차이
                                </span>
                              )}
                              {!status && (
                                <span className="text-text-muted/40">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border px-6 py-4 shrink-0 bg-bg-dark/60 space-y-1 overflow-y-auto max-h-[40vh]">
                {/* 청구 누락 강조 박스 (가장 눈에 띄게) */}
                {match.totalDiff > 0 && match.missingLines.length > 0 && (
                  <div className="rounded-xl bg-red-500/15 border-2 border-red-500/50 p-4 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={18} className="text-red-400" />
                      <span className="text-sm font-bold text-red-400">
                        청구 누락 추정 — {match.missingLines.length}건, {formatNumber(match.missingLines.reduce((s, l) => s + l.amount, 0))}원
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mb-2">아래 출고가 어느 명세서에도 포함되지 않아 청구에서 빠졌을 가능성이 큽니다.</p>
                    <ul className="space-y-1">
                      {match.missingLines.map((l, i) => (
                        <li key={i} className="flex justify-between text-xs bg-red-500/10 rounded px-2 py-1.5">
                          <span className="text-text-primary">
                            <span className="text-text-muted">{l.log_date}</span>
                            <span className="mx-1.5">·</span>
                            <span className="font-medium">{l.product_name}</span>
                            <span className="text-text-muted ml-1">× {formatNumber(l.quantity)}{l.unit || ""}</span>
                          </span>
                          <span className="text-red-400 font-bold">{formatNumber(l.amount)}원</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* 합계 불일치 강조 (1:1 매칭 안되는 케이스) */}
                {match.totalDiff !== 0 && match.missingLines.length === 0 && hasStatements && (
                  <div className="rounded-xl bg-yellow-500/15 border-2 border-yellow-500/50 p-4 mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={18} className="text-yellow-400" />
                      <span className="text-sm font-bold text-yellow-400">
                        판매-명세서 합계 차이 {match.totalDiff > 0 ? "+" : ""}{formatNumber(match.totalDiff)}원
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">개별 행 매칭이 어렵습니다. 아래 품목별 비교 표를 확인하세요.</p>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">공급가 합계</span>
                  <span className="font-bold text-text-primary">{formatNumber(supply)}원</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">부가세 (10%)</span>
                  <span className="text-text-primary">{formatNumber(tax)}원</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-border pt-2 mt-1">
                  <span className="text-text-primary">합계</span>
                  <span className="text-accent">{formatNumber(supply + tax)}원</span>
                </div>

                {/* 명세서·청구 비교 */}
                {(() => {
                  const stmts = salesDetailModal.statements;
                  const billing = salesDetailModal.billing;
                  const stmtSupply = stmts.reduce((s, st) => s + st.supply_amount, 0);
                  const supplyDiff = supply - stmtSupply;
                  const billingTotal = billing?.total_amount ?? 0;
                  const expectedBilling = supply + tax;
                  const billingDiff = expectedBilling - billingTotal;
                  return (
                    <div className="border-t border-border pt-3 mt-3 space-y-2">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">명세서·청구 비교</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">명세서 공급가 합계 ({stmts.length}건)</span>
                        <span className={`font-medium ${supplyDiff !== 0 ? "text-yellow-400" : "text-emerald-400"}`}>{formatNumber(stmtSupply)}원</span>
                      </div>
                      {supplyDiff !== 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-yellow-400">판매-명세서 차이</span>
                          <span className="text-yellow-400 font-bold">{supplyDiff > 0 ? "+" : ""}{formatNumber(supplyDiff)}원</span>
                        </div>
                      )}
                      {billing ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-text-muted">청구액 (부가세 포함)</span>
                            <span className={`font-medium ${billingDiff !== 0 ? "text-yellow-400" : "text-emerald-400"}`}>{formatNumber(billingTotal)}원</span>
                          </div>
                          {billingDiff !== 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-red-400">판매 합계와 청구액 차이</span>
                              <span className="text-red-400 font-bold">{billingDiff > 0 ? "+" : ""}{formatNumber(billingDiff)}원</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-text-muted">청구 미생성</div>
                      )}
                    </div>
                  );
                })()}

                {/* 품목별 판매-명세서 비교 표 */}
                {hasStatements && match.itemDiffs.length > 0 && (
                  <div className="border-t border-border pt-3 mt-3">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">품목별 판매·명세서 비교</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="px-2 py-1.5 text-left text-text-muted font-medium">품목</th>
                          <th className="px-2 py-1.5 text-right text-text-muted font-medium">판매</th>
                          <th className="px-2 py-1.5 text-right text-text-muted font-medium">명세서</th>
                          <th className="px-2 py-1.5 text-right text-text-muted font-medium">차이</th>
                        </tr>
                      </thead>
                      <tbody>
                        {match.itemDiffs.map((d) => (
                          <tr key={d.product_name} className={d.diff !== 0 ? "bg-red-500/10 border-l-4 border-l-red-500" : "border-l-4 border-l-transparent"}>
                            <td className={`px-2 py-1.5 ${d.diff !== 0 ? "text-red-400 font-semibold" : "text-text-secondary"}`}>{d.product_name}</td>
                            <td className="px-2 py-1.5 text-right text-text-secondary">{formatNumber(d.salesAmount)}원</td>
                            <td className="px-2 py-1.5 text-right text-text-secondary">{formatNumber(d.statementAmount)}원</td>
                            <td className={`px-2 py-1.5 text-right font-bold ${d.diff > 0 ? "text-red-400" : d.diff < 0 ? "text-yellow-400" : "text-emerald-400"}`}>
                              {d.diff === 0 ? "✓" : `${d.diff > 0 ? "+" : ""}${formatNumber(d.diff)}원`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
