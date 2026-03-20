"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Company, Product, CompanyPrice, OrderWithItems } from "@/lib/supabase/types";
import { generateStatementNumber, formatNumber, formatDate } from "@/lib/utils";
import { Plus, Trash2, ArrowLeft, ShoppingCart } from "lucide-react";
import Link from "next/link";

interface StatementItemDraft {
  product_id: string | null;
  product_name: string;
  specification: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

function NewStatementForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const logIds = searchParams.get("logIds")?.split(",").filter(Boolean) || [];
  const presetCompanyId = searchParams.get("companyId") || "";

  const supabase = createClient();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyPrices, setCompanyPrices] = useState<CompanyPrice[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [statementDate, setStatementDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<StatementItemDraft[]>([]);
  const [linkedOrderId, setLinkedOrderId] = useState<string | null>(
    orderId || null,
  );
  const [shippingFee, setShippingFee] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showSalesImport, setShowSalesImport] = useState(false);
  const [salesDateFrom, setSalesDateFrom] = useState("");
  const [salesDateTo, setSalesDateTo] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [salesLogs, setSalesLogs] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      const [cRes, pRes] = await Promise.all([
        db.from("companies").select("*").eq("is_active", true).order("name"),
        db.from("products").select("*").eq("is_active", true).order("name"),
      ]);
      setCompanies(cRes.data || []);
      setProducts(pRes.data || []);

      // 주문에서 자동 채움
      if (orderId) {
        const { data: order } = await db
          .from("orders")
          .select("*, companies(*), order_items(*)")
          .eq("id", orderId)
          .single();

        if (order) {
          const o = order as OrderWithItems;
          setCompanyId(o.company_id);
          setItems(
            o.order_items.map((item) => ({
              product_id: item.product_id || null,
              product_name: item.product_name,
              specification: "",
              unit: item.unit,
              quantity: item.quantity,
              unit_price: item.unit_price,
              amount: item.amount,
            })),
          );
          const { data: prices } = await db
            .from("company_prices")
            .select("*")
            .eq("company_id", o.company_id);
          setCompanyPrices(prices || []);
        }
      }

      // 판매 로그 ID 기반 자동 채움
      if (logIds.length > 0) {
        const cId = presetCompanyId || "";
        if (cId) {
          setCompanyId(cId);
          const { data: prices } = await db.from("company_prices").select("*").eq("company_id", cId);
          setCompanyPrices(prices || []);
        }
        const { data: logs } = await db
          .from("inventory_logs")
          .select("*, products(*)")
          .in("id", logIds)
          .order("log_date");
        if (logs && logs.length > 0) {
          if (!cId && logs[0]?.company_id) {
            setCompanyId(logs[0].company_id);
            const { data: prices } = await db.from("company_prices").select("*").eq("company_id", logs[0].company_id);
            setCompanyPrices(prices || []);
          }
          const productMap = new Map<string, StatementItemDraft>();
          for (const log of logs) {
            const key = log.product_id || `manual_${log.reason || "기타"}`;
            const existing = productMap.get(key);
            if (existing) {
              existing.quantity += log.quantity;
              existing.amount = existing.quantity * existing.unit_price;
            } else {
              productMap.set(key, {
                product_id: log.product_id || null,
                product_name: log.products?.name || log.reason || "기타",
                specification: log.products?.box_quantity > 1 ? `1박스/${log.products.box_quantity}${log.products.unit || "EA"}` : "",
                unit: log.products?.unit || "식",
                quantity: log.quantity,
                unit_price: log.unit_price || 0,
                amount: log.quantity * (log.unit_price || 0),
              });
            }
          }
          setItems(Array.from(productMap.values()));
          // 최신 날짜로 명세서 날짜 설정
          const lastDate = logs[logs.length - 1]?.log_date;
          if (lastDate) setStatementDate(lastDate);
        }
      }

      // 판매 데이터에서 자동 채움 (URL 파라미터)
      const salesCompanyId = searchParams.get("salesCompanyId");
      const salesFrom = searchParams.get("salesFrom");
      const salesTo = searchParams.get("salesTo");
      if (salesCompanyId && salesFrom && salesTo) {
        setCompanyId(salesCompanyId);
        // 단가 로드
        const { data: prices } = await db
          .from("company_prices")
          .select("*")
          .eq("company_id", salesCompanyId);
        setCompanyPrices(prices || []);
        // 판매 데이터 로드
        const { data: logs } = await db
          .from("inventory_logs")
          .select("*, products(*)")
          .eq("type", "out")
          .eq("company_id", salesCompanyId)
          .gte("log_date", salesFrom)
          .lte("log_date", salesTo)
          .order("log_date");
        if (logs && logs.length > 0) {
          // 상품별로 집계
          const productMap = new Map<string, StatementItemDraft>();
          for (const log of logs) {
            const key = log.product_id || `manual_${log.reason || "기타"}`;
            const existing = productMap.get(key);
            if (existing) {
              existing.quantity += log.quantity;
              existing.amount = existing.quantity * existing.unit_price;
            } else {
              productMap.set(key, {
                product_id: log.product_id || null,
                product_name: log.products?.name || log.reason || "기타",
                specification: log.products?.box_quantity > 1 ? `1박스/${log.products.box_quantity}${log.products.unit || "EA"}` : "",
                unit: log.products?.unit || "식",
                quantity: log.quantity,
                unit_price: log.unit_price || 0,
                amount: log.quantity * (log.unit_price || 0),
              });
            }
          }
          setItems(Array.from(productMap.values()));
          setStatementDate(salesTo);
        }
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // 거래처 변경 시 해당 거래처의 커스텀 단가 로드
  async function handleCompanyChange(newCompanyId: string) {
    setCompanyId(newCompanyId);
    if (newCompanyId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("company_prices")
        .select("*")
        .eq("company_id", newCompanyId);
      setCompanyPrices(data || []);
    } else {
      setCompanyPrices([]);
    }
  }

  // 상품의 실제 적용 단가 (거래처별 단가 > 기본 판매가)
  function getProductPrice(product: Product): number {
    const cp = companyPrices.find((p) => p.product_id === product.id);
    return cp ? cp.custom_price : product.selling_price;
  }

  // 판매 데이터 검색
  async function searchSalesData() {
    if (!companyId || !salesDateFrom || !salesDateTo) {
      alert("거래처와 기간을 선택해주세요.");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data } = await db
      .from("inventory_logs")
      .select("*, products(*)")
      .eq("type", "out")
      .eq("company_id", companyId)
      .gte("log_date", salesDateFrom)
      .lte("log_date", salesDateTo)
      .order("log_date");
    setSalesLogs(data || []);
  }

  // 판매 데이터 → 명세서 항목으로 변환 (상품별 집계)
  function importSalesData() {
    if (salesLogs.length === 0) return;
    const productMap = new Map<string, StatementItemDraft>();
    for (const log of salesLogs) {
      const key = log.product_id || `manual_${log.reason || "기타"}`;
      const existing = productMap.get(key);
      if (existing) {
        existing.quantity += log.quantity;
        existing.amount = existing.quantity * existing.unit_price;
      } else {
        productMap.set(key, {
          product_id: log.product_id || null,
          product_name: log.products?.name || log.reason || "기타",
          specification: "",
          unit: log.products?.unit || "식",
          quantity: log.quantity,
          unit_price: log.unit_price || 0,
          amount: log.quantity * (log.unit_price || 0),
        });
      }
    }
    setItems(Array.from(productMap.values()));
    setShowSalesImport(false);
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        product_id: null,
        product_name: "",
        specification: "",
        unit: "EA",
        quantity: 1,
        unit_price: 0,
        amount: 0,
      },
    ]);
  }

  function updateItem(index: number, field: string, value: string | number | null) {
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };

      // 상품 선택 시 자동 채움 (box_quantity 반영)
      if (field === "product_id" && value) {
        const p = products.find((pr) => pr.id === value);
        if (p) {
          item.product_name = p.name;
          const eaPrice = getProductPrice(p);
          const boxQty = p.box_quantity || 1;
          if (boxQty > 1) {
            item.unit = "박스";
            item.unit_price = eaPrice * boxQty;
            item.specification = `1박스/${boxQty}${p.unit || "EA"}`;
          } else {
            item.unit = p.unit || "EA";
            item.unit_price = eaPrice;
            item.specification = "";
          }
        }
      }

      // 수량 또는 단가 변경 시 금액 자동 계산
      if (field === "quantity" || field === "unit_price" || field === "product_id") {
        item.amount = item.quantity * item.unit_price;
      }

      copy[index] = item;
      return copy;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const supplyAmount = items.reduce((sum, i) => sum + i.amount, 0);
  const taxAmount = Math.round(supplyAmount * 0.1);
  const totalAmount = supplyAmount + taxAmount + shippingFee; // 배송비는 비과세

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || items.length === 0) return;
    setSaving(true);

    const statementNumber = generateStatementNumber();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: statement, error } = await db.from("statements").insert({
      statement_number: statementNumber,
      order_id: linkedOrderId || null,
      company_id: companyId,
      statement_date: statementDate,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      shipping_fee: shippingFee,
      notes: notes || null,
    }).select().single();

    if (error || !statement) {
      alert("생성 실패: " + (error?.message || "알 수 없는 오류"));
      setSaving(false);
      return;
    }

    const stItems = items.map((item) => ({
      statement_id: statement.id,
      product_name: item.product_name,
      specification: item.specification || null,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
    }));

    await db.from("statement_items").insert(stItems);

    router.push(`/admin/statements/${statement.id}`);
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/statements"
          className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">
          거래명세서 작성
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {/* 기본 정보 */}
        <div className="rounded-2xl border border-border bg-bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">기본 정보</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                거래처 <span className="text-red-400">*</span>
              </label>
              <select
                value={companyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">거래처 선택</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                작성일
              </label>
              <input
                type="date"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
                title="작성일"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              비고
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="비고 사항을 입력하세요"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
        </div>

        {/* 판매 데이터 불러오기 */}
        {showSalesImport && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                <ShoppingCart size={18} /> 판매 데이터 불러오기
              </h2>
              <button type="button" onClick={() => setShowSalesImport(false)} className="text-text-muted hover:text-text-primary text-sm">닫기</button>
            </div>
            <p className="text-xs text-text-muted">선택한 거래처 + 기간의 판매(출고) 데이터를 상품별로 집계하여 명세서 항목에 채웁니다.</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">시작일</label>
                <input type="date" value={salesDateFrom} onChange={(e) => setSalesDateFrom(e.target.value)} title="시작일"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">종료일</label>
                <input type="date" value={salesDateTo} onChange={(e) => setSalesDateTo(e.target.value)} title="종료일"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="flex items-end">
                <button type="button" onClick={searchSalesData}
                  className="w-full px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-colors">
                  검색
                </button>
              </div>
            </div>
            {!companyId && <p className="text-xs text-red-400">거래처를 먼저 선택해주세요.</p>}
            {salesLogs.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-text-secondary">
                  {salesLogs.length}건의 판매 데이터 ({formatNumber(salesLogs.reduce((s: number, l: any) => s + l.quantity * (l.unit_price || 0), 0))}원)
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-bg-dark">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border text-text-muted">
                      <th className="px-3 py-2 text-left">날짜</th><th className="px-3 py-2 text-left">품목</th>
                      <th className="px-3 py-2 text-right">수량</th><th className="px-3 py-2 text-right">단가</th><th className="px-3 py-2 text-right">금액</th>
                    </tr></thead>
                    <tbody>
                      {salesLogs.map((log: any, i: number) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="px-3 py-1.5 text-text-muted">{formatDate(log.log_date)}</td>
                          <td className="px-3 py-1.5 text-text-primary">{log.products?.name || log.reason || "-"}</td>
                          <td className="px-3 py-1.5 text-right text-text-secondary">{formatNumber(log.quantity)}</td>
                          <td className="px-3 py-1.5 text-right text-text-secondary">{formatNumber(log.unit_price || 0)}</td>
                          <td className="px-3 py-1.5 text-right text-text-primary font-medium">{formatNumber(log.quantity * (log.unit_price || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={importSalesData}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 transition-colors">
                  상품별 집계하여 항목에 채우기
                </button>
              </div>
            )}
            {salesLogs.length === 0 && salesDateFrom && salesDateTo && companyId && (
              <p className="text-xs text-text-muted text-center py-2">검색 결과가 없습니다.</p>
            )}
          </div>
        )}

        {/* 항목 */}
        <div className="rounded-2xl border border-border bg-bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">항목</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowSalesImport(!showSalesImport); setSalesLogs([]); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
              >
                <ShoppingCart size={16} /> 판매 데이터 불러오기
              </button>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                <Plus size={16} /> 항목 추가
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-center py-8 text-text-muted">
              항목을 추가해주세요.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="hidden lg:grid grid-cols-12 gap-3 text-xs text-text-muted px-1">
                <div className="col-span-3">품목</div>
                <div className="col-span-2">규격</div>
                <div className="col-span-1">단위</div>
                <div className="col-span-1">수량</div>
                <div className="col-span-2">단가</div>
                <div className="col-span-2 text-right">금액</div>
                <div className="col-span-1" />
              </div>

              {items.map((item, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center rounded-xl border border-border p-3"
                >
                  <div className="lg:col-span-3">
                    <select
                      value={item.product_id || ""}
                      onChange={(e) => updateItem(i, "product_id", e.target.value || null)}
                      title="품목 선택"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="">직접 입력</option>
                      {products.map((p) => {
                        const price = getProductPrice(p);
                        const isCustom = companyPrices.some((cp) => cp.product_id === p.id);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatNumber(price)}원{isCustom ? " ★" : ""})
                          </option>
                        );
                      })}
                    </select>
                    {!item.product_id && (
                      <input
                        type="text"
                        placeholder="품목명 직접 입력"
                        value={item.product_name}
                        onChange={(e) => updateItem(i, "product_name", e.target.value)}
                        required
                        className="w-full mt-2 px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                      />
                    )}
                  </div>
                  <div className="lg:col-span-2">
                    <input
                      type="text"
                      placeholder="규격"
                      value={item.specification}
                      onChange={(e) =>
                        updateItem(i, "specification", e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(i, "unit", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(i, "quantity", Number(e.target.value))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <input
                      type="number"
                      min={0}
                      value={item.unit_price}
                      onChange={(e) =>
                        updateItem(i, "unit_price", Number(e.target.value))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="lg:col-span-2 text-right text-text-primary font-medium">
                    {formatNumber(item.amount)}원
                  </div>
                  <div className="lg:col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="p-1.5 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">공급가액</span>
              <span className="text-text-primary">
                {formatNumber(supplyAmount)}원
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">세액 (10%)</span>
              <span className="text-text-primary">
                {formatNumber(taxAmount)}원
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-secondary">배송비 <span className="text-xs text-text-muted">(비과세)</span></span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={shippingFee}
                  onChange={(e) => setShippingFee(Number(e.target.value))}
                  placeholder="0"
                  className="w-32 px-3 py-1.5 rounded-lg border border-border bg-bg-dark text-text-primary text-sm text-right focus:outline-none focus:border-primary"
                />
                <span className="text-text-primary">원</span>
              </div>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-text-secondary font-medium">합계</span>
              <span className="text-2xl font-bold text-text-primary">
                {formatNumber(totalAmount)}원
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/admin/statements"
            className="flex-1 py-3 text-center rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={saving || !companyId || items.length === 0}
            className="flex-1 py-3 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? "저장 중..." : "거래명세서 저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewStatementPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-text-muted">로딩 중...</div>}>
      <NewStatementForm />
    </Suspense>
  );
}
