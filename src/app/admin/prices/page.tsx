"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbInsert, dbDelete } from "@/lib/db";
import type { Company, Product, CompanyPrice, CompanyPriceHistory } from "@/lib/supabase/types";
import { formatNumber, todayKST } from "@/lib/utils";
import { resolveSellPrice } from "@/lib/box-price";
import { Save, Check, Building2, RotateCcw, History as HistoryIcon, X, ShoppingBag, Truck, ListOrdered, Search } from "lucide-react";

type DirtyMap = Record<string, number>;
type PriceMode = "sell" | "cost";

const CATEGORY_LABELS: Record<string, string> = {
  inner: "내피", outer: "외피", "내피": "내피", "외피": "외피",
  heater: "발열제", film: "필름", set: "세트",
  lunchbox: "도시락 용기", ticket_printer: "식권발행기",
};

export default function PricesPage() {
  const supabase = createClient();

  const [mode, setMode] = useState<PriceMode>("sell");
  const [effectiveFrom, setEffectiveFrom] = useState(() => todayKST());

  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyPrices, setCompanyPrices] = useState<CompanyPrice[]>([]);
  const [history, setHistory] = useState<CompanyPriceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<DirtyMap>({});
  // 박스 금액 수정분 (판매가 모드, 박스 상품만). 0 = 박스 금액 지움 → 개당 단가 × 입수
  const [dirtyBox, setDirtyBox] = useState<DirtyMap>({});
  // 박스 금액을 입력해 개당 단가가 자동으로 채워진 칸 (박스 금액을 고치면 개당 단가도 따라 바뀐다)
  const [autoEaKeys, setAutoEaKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 셀별 이력 모달
  const [historyModal, setHistoryModal] = useState<
    { companyId: string; companyName: string; productId: string; productName: string } | null
  >(null);

  // 전체 이력 리스트 모달
  const [allHistoryOpen, setAllHistoryOpen] = useState(false);
  const [allHistoryFilter, setAllHistoryFilter] = useState<"all" | "sell" | "cost">("all");
  const [allHistorySearch, setAllHistorySearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const [cRes, pRes, prRes, hRes] = await Promise.all([
      db.from("companies").select("*").eq("is_active", true).order("name"),
      db.from("products").select("*").eq("is_active", true).order("category").order("name"),
      db.from("company_prices").select("*"),
      // created_at 2차 정렬: 같은 적용일로 재저장해도 항상 최신 저장분이 먼저 오도록
      db.from("company_price_history").select("*").order("effective_from", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    setCompanies(cRes.data || []);
    setProducts(pRes.data || []);
    setCompanyPrices(prRes.data || []);
    setHistory(hRes.data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 화면을 열 때 적용일이 된 예약 단가를 먼저 반영한다(자정 예약 작업이 못 돌았을 때의 보조).
  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/admin/prices/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      } catch {
        // 반영 실패 — 아래에서 현재 저장된 값을 그대로 보여 준다
      }
      load();
    })();
  }, [load]);

  // 모드 전환 시 dirty 초기화
  useEffect(() => {
    setDirty({});
    setDirtyBox({});
    setSaved(false);
  }, [mode]);

  // 수정된 칸 (개당 단가 또는 박스 금액 중 하나라도 바뀐 거래처·상품)
  const dirtyKeys = useMemo(() => [...new Set([...Object.keys(dirty), ...Object.keys(dirtyBox)])], [dirty, dirtyBox]);

  // 저장하지 않은 수정이 있으면 새로고침/창닫기 시 경고 (수정만 하고 저장을 안 눌러
  // "변경했는데 반영 안 됨"으로 이어지는 실수 방지)
  useEffect(() => {
    if (dirtyKeys.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyKeys]);

  // 모드별 거래처 (sell=판매처/customer, cost=매입처/supplier, both는 양쪽 모두)
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ct = (c as any).company_type || "customer";
      if (mode === "sell") return ct === "customer" || ct === "both";
      return ct === "supplier" || ct === "both";
    });
  }, [companies, mode]);

  const today = todayKST();

  // 모드별 가격 맵 (현재 적용가)
  // sell: company_prices — 서버가 단가 이력의 적용일 기준으로 맞춰 둔 "지금 적용 중인 단가"
  // cost: history(cost) 중 적용일이 오늘 이하인 것 가운데 거래처별·상품별 최신 1건
  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (mode === "sell") {
      for (const cp of companyPrices) {
        map[`${cp.company_id}_${cp.product_id}`] = cp.custom_price;
      }
    } else {
      // history는 effective_from desc, created_at desc 정렬되어 있음 → 첫 등장이 최신
      const seen = new Set<string>();
      for (const h of history) {
        if (h.price_type !== "cost") continue;
        if (!h.company_id) continue; // NULL은 거래처별 그리드 표시 대상 아님
        if (h.effective_from > today) continue; // 아직 적용일 전 — 예약 단가로 따로 표시
        const k = `${h.company_id}_${h.product_id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if (h.price === 0) continue; // 0원 = 기본가 복귀 마커 → 거래처별 단가 없음으로 취급
        map[k] = h.price;
      }
    }
    return map;
  }, [mode, companyPrices, history, today]);

  // 지금 적용 중인 박스 금액 (판매가 모드). 없는 칸은 개당 단가 × 입수
  const boxPriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (mode !== "sell") return map;
    for (const cp of companyPrices) {
      const box = Number(cp.box_price);
      if (box > 0) map[`${cp.company_id}_${cp.product_id}`] = box;
    }
    return map;
  }, [mode, companyPrices]);

  // 예약 단가: 적용일이 아직 오지 않은 이력 중 가장 먼저 적용될 1건 (칸 아래에 "MM-DD부터 ○원"으로 표시)
  const pendingMap = useMemo(() => {
    const map: Record<string, { id: string; price: number; boxPrice: number; date: string; createdAt: string }> = {};
    for (const h of history) {
      if (h.price_type !== mode || !h.company_id) continue;
      if (h.effective_from <= today) continue;
      const k = `${h.company_id}_${h.product_id}`;
      const cur = map[k];
      // 더 이른 적용일 우선, 같은 날이면 나중에 저장한 것
      if (!cur || h.effective_from < cur.date || (h.effective_from === cur.date && h.created_at > cur.createdAt)) {
        map[k] = { id: h.id, price: Number(h.price), boxPrice: Number(h.box_price) || 0, date: h.effective_from, createdAt: h.created_at };
      }
    }
    return map;
  }, [history, mode, today]);

  // 카테고리 그룹
  const categoryGroups = useMemo(() => {
    const groups: { category: string; label: string; items: Product[] }[] = [];
    const catMap = new Map<string, Product[]>();
    for (const p of products) {
      if (!catMap.has(p.category)) catMap.set(p.category, []);
      catMap.get(p.category)!.push(p);
    }
    for (const [cat, items] of catMap) {
      groups.push({ category: cat, label: CATEGORY_LABELS[cat] || cat, items });
    }
    return groups;
  }, [products]);

  function getDisplayPrice(companyId: string, productId: string): string {
    const key = `${companyId}_${productId}`;
    if (key in dirty) return dirty[key] === 0 ? "" : String(dirty[key]);
    const saved = priceMap[key];
    if (saved !== undefined) return String(saved);
    return "";
  }

  function hasCustomPrice(companyId: string, productId: string): boolean {
    const key = `${companyId}_${productId}`;
    return key in dirty || key in priceMap;
  }

  function handlePriceChange(companyId: string, productId: string, value: string) {
    const key = `${companyId}_${productId}`;
    const num = value === "" ? 0 : Number(value);
    setDirty((prev) => ({ ...prev, [key]: num }));
    // 직접 입력한 개당 단가는 박스 금액 입력이 더 이상 덮어쓰지 않는다
    setAutoEaKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setSaved(false);
  }

  function getDisplayBoxPrice(companyId: string, productId: string): string {
    const key = `${companyId}_${productId}`;
    if (key in dirtyBox) return dirtyBox[key] === 0 ? "" : String(dirtyBox[key]);
    const saved = boxPriceMap[key];
    return saved !== undefined ? String(saved) : "";
  }

  // 박스 금액 입력. 개당 단가가 아직 없는 칸이면 박스 금액 ÷ 입수(반올림)로 개당 단가도 채운다
  // (거래처별 단가는 개당 단가가 있어야 저장되고, 낱개 판매에는 개당 단가가 쓰인다).
  function handleBoxPriceChange(companyId: string, productId: string, boxQty: number, value: string) {
    const key = `${companyId}_${productId}`;
    const num = value === "" ? 0 : Number(value);
    setDirtyBox((prev) => ({ ...prev, [key]: num }));
    const currentEa = key in dirty ? dirty[key] : priceMap[key] ?? 0;
    const autoFilled = key in dirty && !(key in priceMap) && autoEaKeys.has(key);
    if (num > 0 && boxQty > 1 && (currentEa === 0 || autoFilled)) {
      setDirty((prev) => ({ ...prev, [key]: Math.round(num / boxQty) }));
      setAutoEaKeys((prev) => new Set(prev).add(key));
    }
    setSaved(false);
  }

  function handleReset() {
    setDirty({});
    setDirtyBox({});
    setAutoEaKeys(new Set());
    setSaved(false);
  }

  async function handleSave() {
    const keys = dirtyKeys;
    if (keys.length === 0) return;
    if (!effectiveFrom) {
      alert("적용 시작일을 입력해주세요.");
      return;
    }
    setSaving(true);

    const errors: string[] = [];
    const savedPairs: { companyId: string; productId: string; price: number }[] = [];
    const isFuture = effectiveFrom > todayKST();

    for (const k of keys) {
      const sepIdx = k.indexOf("_");
      const companyId = k.substring(0, sepIdx);
      const productId = k.substring(sepIdx + 1);
      // 한쪽만 고친 칸은 다른 쪽을 지금 값 그대로 이어 간다 (이력 한 줄이 개당 단가 + 박스 금액을 함께 갖는다)
      const newPrice = k in dirty ? dirty[k] : priceMap[k] ?? 0;
      const newBoxRaw = k in dirtyBox ? dirtyBox[k] : boxPriceMap[k] ?? 0;
      const newBox = mode === "sell" && newPrice > 0 && newBoxRaw > 0 ? newBoxRaw : null;

      // 빈값(0)으로 지운 셀: 기존 거래처별 단가가 있었다면 '기본가 복귀'(0원) 이력을 남긴다.
      // 이 마커가 없으면 (특히 매입가 모드에서) 저장해도 이전 값이 그대로 되살아난다.
      const isClear = newPrice === 0;
      const hadCustom = `${companyId}_${productId}` in priceMap;

      // 1) history insert — 신규 단가 또는 기본가 복귀 마커
      let historyFailed = false;
      if (newPrice > 0 || (isClear && hadCustom)) {
        const { error: hErr } = await dbInsert("company_price_history", {
          company_id: companyId,
          product_id: productId,
          price_type: mode,
          price: newPrice,
          // 매입가 이력에는 보내지 않는다 (박스 금액은 판매가에만 쓴다)
          ...(mode === "sell" ? { box_price: newBox } : {}),
          effective_from: effectiveFrom,
          notes: isClear ? "기본가 복귀" : null,
        });
        if (hErr) {
          console.error("이력 저장 실패:", hErr, { companyId, productId, newPrice });
          errors.push(hErr);
          historyFailed = true;
        }
      }

      // 이력이 저장된 조합만 기록해 두었다가 아래에서 한꺼번에 반영한다
      if (mode === "sell" && !historyFailed && (newPrice > 0 || (isClear && hadCustom))) {
        savedPairs.push({ companyId, productId, price: newPrice });
      }
    }

    // 2) sell 모드: "지금 적용 중인 단가"(company_prices)를 서버가 적용일 기준으로 맞춘다.
    //    적용일이 오늘 이하이면 바로 반영되고, 미래이면 현재 단가를 그대로 둔 채 그 날짜에 반영된다.
    if (mode === "sell" && savedPairs.length > 0) {
      try {
        const res = await fetch("/api/admin/prices/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pairs: savedPairs.map(({ companyId, productId }) => ({ companyId, productId })) }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          errors.push(json?.error || (json?.errors && json.errors[0]) || "현재 단가 반영에 실패했습니다.");
        }
      } catch {
        errors.push("현재 단가 반영 요청에 실패했습니다.");
      }
    }

    if (errors.length > 0) {
      alert(`일부 단가 저장에 실패했습니다 (${errors.length}건):\n${errors[0]}`);
    }

    await load();
    setDirty({});
    setDirtyBox({});
    setAutoEaKeys(new Set());
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);

    if (errors.length === 0 && isFuture && (mode === "cost" || savedPairs.length > 0)) {
      alert(
        `${effectiveFrom}부터 적용되도록 저장했습니다.\n` +
          "그 전까지는 지금 단가가 그대로 쓰이고, 해당 날짜가 되면 자동으로 바뀝니다.\n" +
          "예약된 단가는 각 칸 아래에 표시됩니다.",
      );
    }
  }

  // 예약된 단가 취소: 아직 적용 전인 이력 한 건을 지운다(현재 단가에는 영향 없음)
  async function cancelPending(key: string, label: string) {
    const pending = pendingMap[key];
    if (!pending) return;
    const what = pending.price > 0 ? `${formatNumber(pending.price)}원` : "기본가 복귀";
    if (!window.confirm(`${label}\n${pending.date}부터 적용 예정인 단가(${what})를 취소할까요?`)) return;
    const res = await dbDelete("company_price_history", { id: pending.id });
    if (res.error) {
      alert(`취소 실패: ${res.error}`);
      return;
    }
    await load();
  }

  // 이력 모달용: 선택한 셀의 history 시계열
  const historyForCell = useMemo(() => {
    if (!historyModal) return [];
    return history.filter(
      (h) =>
        h.company_id === historyModal.companyId &&
        h.product_id === historyModal.productId &&
        h.price_type === mode,
    );
  }, [historyModal, history, mode]);

  // 전체 이력 리스트 (필터/검색 적용)
  const companyNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of companies) m[c.id] = c.name;
    return m;
  }, [companies]);

  const productNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of products) m[p.id] = p.name;
    return m;
  }, [products]);

  const allHistoryRows = useMemo(() => {
    const search = allHistorySearch.trim().toLowerCase();
    return history
      .filter((h) => allHistoryFilter === "all" || h.price_type === allHistoryFilter)
      .filter((h) => {
        if (!search) return true;
        const cName = h.company_id ? (companyNameMap[h.company_id] || "") : "(기본가)";
        const pName = productNameMap[h.product_id] || "";
        return cName.toLowerCase().includes(search) || pName.toLowerCase().includes(search);
      });
  }, [history, allHistoryFilter, allHistorySearch, companyNameMap, productNameMap]);

  const dirtyCount = dirtyKeys.length;

  if (loading) {
    return <div className="text-center py-20 text-text-muted">로딩 중...</div>;
  }

  const modeLabel = mode === "sell" ? "판매가" : "매입가";

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">단가 관리</h1>
          <p className="text-sm text-text-muted mt-1">
            {filteredCompanies.length}개 {mode === "sell" ? "판매처" : "매입처"} · {products.length}개 상품 — 셀을 직접 수정하고 저장하세요
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 모드 토글 */}
          <div className="inline-flex items-center rounded-xl border border-border bg-bg-card p-1">
            <button
              type="button"
              onClick={() => setMode("sell")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === "sell" ? "bg-primary text-bg-dark" : "text-text-muted hover:text-text-primary"
              }`}
            >
              <ShoppingBag size={14} /> 판매가
            </button>
            <button
              type="button"
              onClick={() => setMode("cost")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === "cost" ? "bg-primary text-bg-dark" : "text-text-muted hover:text-text-primary"
              }`}
            >
              <Truck size={14} /> 매입가
            </button>
          </div>

          {/* 적용 시작일 */}
          <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-card px-3 py-2">
            <span className="text-xs text-text-muted">적용일</span>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              aria-label="단가 적용 시작일"
              className="bg-transparent text-sm text-text-primary focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setAllHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-text-secondary text-sm hover:bg-bg-card-hover transition-colors"
          >
            <ListOrdered size={16} /> 전체 이력
          </button>

          {dirtyCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-text-secondary text-sm hover:bg-bg-card-hover transition-colors"
            >
              <RotateCcw size={16} /> 되돌리기
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || dirtyCount === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saved ? <Check size={18} /> : <Save size={18} />}
            {saving ? "저장 중..." : saved ? "저장 완료!" : dirtyCount > 0 ? `저장 (${dirtyCount}건)` : "저장"}
          </button>
        </div>
      </div>

      {/* 안내 */}
      <div className="rounded-xl border border-border bg-bg-card/50 p-3 text-xs text-text-muted mb-4">
        변경된 단가는 입력한 <span className="text-primary font-semibold">{effectiveFrom}</span>부터 적용됩니다.
        {effectiveFrom > today
          ? " 미래 날짜라 그 전까지는 지금 단가가 그대로 쓰이고, 해당 날짜가 되면 자동으로 바뀝니다."
          : " 오늘 이전 날짜라 저장 즉시 적용됩니다(더 최근 적용일의 단가가 이미 있으면 그 단가가 유지됩니다)."}
        과거에 저장된 단가는 그대로 보존되며, 셀 옆 시계 아이콘으로 변경 이력을 확인할 수 있습니다.
        {mode === "sell" && " 박스 상품은 개당 단가 아래 칸에 박스 금액을 따로 넣을 수 있습니다. 비워 두면 개당 단가 × 입수로 계산하고, 넣으면 박스 단위 판매·명세서·주문·견적에 그 금액을 씁니다."}
        {mode === "cost" && " 매입가는 매입처별로 관리되며, 입고 시점 단가는 inventory_logs에 기록되어 별도 변경되지 않습니다."}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-5 mb-4 text-xs text-text-muted flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-primary/20 inline-block border border-primary/30" /> 거래처별 단가 설정됨
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-bg-dark inline-block border border-border" /> 미설정 (기본가 적용)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-yellow-500/20 inline-block border border-yellow-500/30" /> 수정됨 (미저장)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-sky-400 font-semibold">12-01부터 5,200</span> 예약된 단가 (적용일 전)
        </span>
      </div>

      {filteredCompanies.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <Building2 size={48} className="mx-auto mb-4 opacity-50" />
          <p>등록된 {mode === "sell" ? "판매처" : "매입처"}가 없습니다.</p>
          <p className="text-sm mt-1">거래처 관리에서 먼저 등록해주세요.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg-dark">
                  <th
                    className="px-4 py-2 text-left text-text-muted font-medium sticky left-0 bg-bg-dark z-20 min-w-[140px]"
                    rowSpan={2}
                  >
                    거래처
                  </th>
                  {categoryGroups.map((g) => (
                    <th
                      key={g.category}
                      colSpan={g.items.length}
                      className="px-2 py-2 text-center text-text-muted font-semibold border-l border-border"
                    >
                      {g.label}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-border bg-bg-dark">
                  {products.map((p, i) => {
                    const isFirst = i === 0 || products[i - 1].category !== p.category;
                    return (
                      <th
                        key={p.id}
                        className={`px-1 py-2 text-center text-text-secondary font-medium min-w-[90px] ${
                          isFirst ? "border-l border-border" : ""
                        }`}
                      >
                        <div className="text-xs leading-tight">
                          {p.name}
                          {(p.box_quantity ?? 1) > 1 && (
                            <div className="text-text-muted font-normal mt-0.5">
                              {p.box_quantity}개/박스
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
                {/* 기본가 행 */}
                <tr className="border-b-2 border-primary/30 bg-primary/5">
                  <td className="px-4 py-2 text-text-primary font-semibold sticky left-0 bg-primary/5 z-20">
                    기본 {modeLabel}
                  </td>
                  {products.map((p, i) => {
                    const isFirst = i === 0 || products[i - 1].category !== p.category;
                    const basePrice = mode === "sell" ? p.selling_price : p.cost_price;
                    // 기본 박스 판매가가 따로 등록돼 있으면 그 금액 (상품 관리에서 입력)
                    const baseBox = mode === "sell" ? resolveSellPrice(p).box : basePrice * p.box_quantity;
                    return (
                      <td
                        key={p.id}
                        className={`px-2 py-2 text-center text-primary font-bold ${
                          isFirst ? "border-l border-border" : ""
                        }`}
                      >
                        {basePrice > 0 ? formatNumber(basePrice) : "-"}
                        {(p.box_quantity ?? 1) > 1 && basePrice > 0 && (
                          <div className="text-xs text-text-muted font-normal">
                            박스 {formatNumber(baseBox)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((company) => (
                  <tr
                    key={company.id}
                    className="border-b border-border hover:bg-bg-card-hover/50 transition-colors"
                  >
                    <td className="px-4 py-2 text-text-primary font-medium sticky left-0 bg-bg-card z-10 border-r border-border">
                      <div className="truncate max-w-[130px]" title={company.name}>
                        {company.name}
                      </div>
                    </td>
                    {products.map((p, i) => {
                      const isFirst = i === 0 || products[i - 1].category !== p.category;
                      const key = `${company.id}_${p.id}`;
                      const isDirty = key in dirty;
                      const hasCustom = hasCustomPrice(company.id, p.id);
                      const displayVal = getDisplayPrice(company.id, p.id);
                      const basePrice = mode === "sell" ? p.selling_price : p.cost_price;
                      // 박스 금액 칸: 판매가 모드의 박스 상품만
                      const boxQty = (p.box_quantity ?? 1) > 1 ? p.box_quantity : 1;
                      const showBox = mode === "sell" && boxQty > 1;
                      const boxVal = showBox ? getDisplayBoxPrice(company.id, p.id) : "";
                      const isBoxDirty = key in dirtyBox;
                      // 비워 두었을 때 적용되는 박스 금액 (개당 단가 × 입수, 거래처 단가가 없으면 기본 박스가)
                      const eaForBox = Number(displayVal) || 0;
                      const boxPlaceholder = eaForBox > 0 ? eaForBox * boxQty : resolveSellPrice(p).box;

                      return (
                        <td
                          key={p.id}
                          className={`px-0.5 py-0.5 text-center relative ${
                            isFirst ? "border-l border-border" : ""
                          }`}
                        >
                          <div className="flex items-center gap-0.5">
                            <input
                              type="number"
                              min={0}
                              value={displayVal}
                              placeholder={String(basePrice)}
                              onChange={(e) => handlePriceChange(company.id, p.id, e.target.value)}
                              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                              aria-label={`${company.name} - ${p.name} ${modeLabel}`}
                              className={`w-full px-1.5 py-1.5 text-center text-xs rounded border focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                                isDirty
                                  ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-300 font-bold"
                                  : hasCustom
                                  ? "border-primary/20 bg-primary/5 text-primary font-medium"
                                  : "border-transparent bg-transparent text-text-muted hover:border-border hover:bg-bg-dark"
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setHistoryModal({ companyId: company.id, companyName: company.name, productId: p.id, productName: p.name })}
                              className="shrink-0 p-1 rounded text-text-muted/40 hover:text-primary hover:bg-bg-dark transition-colors"
                              title={`${company.name} - ${p.name} ${modeLabel} 변경 이력`}
                              aria-label="변경 이력 보기"
                            >
                              <HistoryIcon size={11} />
                            </button>
                          </div>
                          {showBox && (
                            <div className="flex items-center gap-0.5 mt-0.5 pr-[22px]">
                              <span className="shrink-0 text-[10px] text-text-muted pl-0.5">박스</span>
                              <input
                                type="number"
                                min={0}
                                value={boxVal}
                                placeholder={boxPlaceholder > 0 ? String(boxPlaceholder) : ""}
                                onChange={(e) => handleBoxPriceChange(company.id, p.id, boxQty, e.target.value)}
                                onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                                aria-label={`${company.name} - ${p.name} 박스 금액`}
                                title="박스 금액 — 비워 두면 개당 단가 × 입수"
                                className={`w-full px-1 py-1 text-center text-[11px] rounded border focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                                  isBoxDirty
                                    ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-300 font-bold"
                                    : boxVal
                                    ? "border-primary/20 bg-primary/5 text-primary font-medium"
                                    : "border-transparent bg-transparent text-text-muted hover:border-border hover:bg-bg-dark"
                                }`}
                              />
                            </div>
                          )}
                          {pendingMap[key] && (
                            <div
                              className="text-[10px] leading-tight text-sky-400 pb-0.5"
                              title={`${pendingMap[key].date}부터 적용 예정 — 그 전까지는 위 단가가 쓰입니다`}
                            >
                              {pendingMap[key].date.slice(5)}부터 {pendingMap[key].price > 0 ? formatNumber(pendingMap[key].price) : "기본가"}
                              {pendingMap[key].price > 0 && pendingMap[key].boxPrice > 0 && ` · 박스 ${formatNumber(pendingMap[key].boxPrice)}`}
                              <button
                                type="button"
                                onClick={() => cancelPending(key, `${company.name} - ${p.name}`)}
                                className="ml-1 text-text-muted hover:text-red-400"
                                title="예약된 단가 취소"
                                aria-label="예약된 단가 취소"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 변경 이력 모달 */}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-text-primary">
                  {modeLabel} 변경 이력
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {historyModal.companyName} — {historyModal.productName}
                </p>
              </div>
              <button type="button" onClick={() => setHistoryModal(null)} title="닫기" aria-label="닫기" className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {historyForCell.length === 0 ? (
                <p className="px-6 py-10 text-center text-text-muted text-sm">변경 이력이 없습니다.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-bg-dark">
                    <tr className="border-b border-border">
                      <th className="px-4 py-2.5 text-left text-text-muted font-medium">적용 시작일</th>
                      <th className="px-4 py-2.5 text-right text-text-muted font-medium">단가</th>
                      <th className="px-4 py-2.5 text-left text-text-muted font-medium">기록일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyForCell.map((h, idx) => (
                      <tr key={h.id} className="border-b border-border/50">
                        <td className="px-4 py-2.5 text-text-secondary">
                          {h.effective_from === "1900-01-01" ? <span className="text-text-muted">초기값</span> : h.effective_from}
                          {idx === 0 && <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">현재 적용</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium text-text-primary">
                          {h.price === 0 ? <span className="text-text-muted">기본가 복귀</span> : `${formatNumber(h.price)}원`}
                          {h.price > 0 && Number(h.box_price) > 0 && (
                            <span className="block text-xs text-text-muted">박스 {formatNumber(Number(h.box_price))}원</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-text-muted text-xs">
                          {h.created_at ? h.created_at.slice(0, 10) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 전체 이력 리스트 모달 */}
      {allHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-text-primary">단가 변경 이력 — 전체</h2>
                <p className="text-xs text-text-muted mt-0.5">총 {allHistoryRows.length}건</p>
              </div>
              <button
                type="button"
                onClick={() => setAllHistoryOpen(false)}
                title="닫기"
                aria-label="닫기"
                className="text-text-muted hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>

            {/* 필터 */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-bg-dark/40 flex-wrap">
              <div className="inline-flex items-center rounded-lg border border-border bg-bg-card p-1">
                {(["all", "sell", "cost"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAllHistoryFilter(t)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      allHistoryFilter === t ? "bg-primary text-bg-dark" : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    {t === "all" ? "전체" : t === "sell" ? "판매가" : "매입가"}
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-card px-3 py-1.5 flex-1 min-w-[200px] max-w-[400px]">
                <Search size={14} className="text-text-muted" />
                <input
                  type="text"
                  value={allHistorySearch}
                  onChange={(e) => setAllHistorySearch(e.target.value)}
                  placeholder="거래처 또는 상품명 검색"
                  aria-label="이력 검색"
                  className="bg-transparent text-sm text-text-primary focus:outline-none w-full"
                />
              </div>
            </div>

            {/* 표 */}
            <div className="overflow-auto flex-1">
              {allHistoryRows.length === 0 ? (
                <p className="px-6 py-16 text-center text-text-muted text-sm">조건에 맞는 이력이 없습니다.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-bg-dark z-10">
                    <tr className="border-b border-border">
                      <th className="px-4 py-2.5 text-left text-text-muted font-medium">적용일</th>
                      <th className="px-4 py-2.5 text-left text-text-muted font-medium">타입</th>
                      <th className="px-4 py-2.5 text-left text-text-muted font-medium">거래처</th>
                      <th className="px-4 py-2.5 text-left text-text-muted font-medium">상품</th>
                      <th className="px-4 py-2.5 text-right text-text-muted font-medium">단가</th>
                      <th className="px-4 py-2.5 text-left text-text-muted font-medium">기록일</th>
                      <th className="px-4 py-2.5 text-left text-text-muted font-medium">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allHistoryRows.map((h) => {
                      const cName = h.company_id ? (companyNameMap[h.company_id] || "-") : "(기본가)";
                      const pName = productNameMap[h.product_id] || "-";
                      return (
                        <tr key={h.id} className="border-b border-border/50 hover:bg-bg-card-hover/30">
                          <td className="px-4 py-2 text-text-secondary text-xs whitespace-nowrap">
                            {h.effective_from === "1900-01-01" ? <span className="text-text-muted">초기값</span> : h.effective_from}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                              h.price_type === "sell" ? "bg-emerald-500/10 text-emerald-400" : "bg-orange-500/10 text-orange-400"
                            }`}>
                              {h.price_type === "sell" ? "판매" : "매입"}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-text-primary">{cName}</td>
                          <td className="px-4 py-2 text-text-primary">{pName}</td>
                          <td className="px-4 py-2 text-right font-mono font-medium text-text-primary whitespace-nowrap">
                            {h.price === 0 ? <span className="text-text-muted">기본가 복귀</span> : `${formatNumber(h.price)}원`}
                            {h.price > 0 && Number(h.box_price) > 0 && (
                              <span className="ml-2 text-xs text-text-muted">박스 {formatNumber(Number(h.box_price))}원</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-text-muted text-xs whitespace-nowrap">
                            {h.created_at ? h.created_at.slice(0, 10) : "-"}
                          </td>
                          <td className="px-4 py-2 text-text-muted text-xs">{h.notes || ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
