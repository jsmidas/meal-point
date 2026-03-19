"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Company, Product, CompanyPrice, QuoteWithItems } from "@/lib/supabase/types";
import { generateQuoteNumber, formatNumber, formatDate } from "@/lib/utils";
import { Plus, Trash2, ArrowLeft, Building2, PenLine, Copy, X } from "lucide-react";
import Link from "next/link";

interface QuoteItemDraft {
  product_id: string | null;
  product_name: string;
  specification: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
  ea_price: number;
  box_qty: number;
}

export default function NewQuotePage() {
  const router = useRouter();
  const supabase = createClient();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyPrices, setCompanyPrices] = useState<CompanyPrice[]>([]);
  const [inputMode, setInputMode] = useState<"select" | "manual">("select");
  const [companyId, setCompanyId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientCeoName, setRecipientCeoName] = useState("");
  const [recipientBizNumber, setRecipientBizNumber] = useState("");
  const [recipientBizType, setRecipientBizType] = useState("");
  const [recipientBizCategory, setRecipientBizCategory] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<QuoteItemDraft[]>([]);
  const [shippingFee, setShippingFee] = useState(0);
  const [saving, setSaving] = useState(false);

  // 이전 견적서 불러오기
  const [showQuoteLoader, setShowQuoteLoader] = useState(false);
  const [pastQuotes, setPastQuotes] = useState<QuoteWithItems[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);

  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [c, p] = await Promise.all([
        db.from("companies").select("*").eq("is_active", true).order("name"),
        db.from("products").select("*").eq("is_active", true).order("name"),
      ]);
      setCompanies(c.data || []);
      setProducts(p.data || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 거래처별 단가 로드
  async function loadCompanyPrices(cid: string) {
    if (!cid) { setCompanyPrices([]); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("company_prices").select("*").eq("company_id", cid);
    setCompanyPrices(data || []);
  }

  function getProductPrice(product: Product): number {
    const cp = companyPrices.find((p) => p.product_id === product.id);
    return cp ? cp.custom_price : product.selling_price;
  }

  function handleCompanySelect(id: string) {
    setCompanyId(id);
    loadCompanyPrices(id);
    if (id) {
      const c = companies.find((co) => co.id === id);
      if (c) {
        setRecipientName(c.name);
        setRecipientCeoName(c.ceo_name);
        setRecipientBizNumber(c.biz_number);
        setRecipientBizType(c.biz_type || "");
        setRecipientBizCategory(c.biz_category || "");
        setRecipientAddress(c.address || "");
        setRecipientPhone(c.phone || "");
      }
    }
  }

  // 이전 견적서 목록 불러오기
  async function loadPastQuotes() {
    setShowQuoteLoader(true);
    setLoadingPast(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data } = await db
      .from("quotes")
      .select("*, companies(*), quote_items(*)")
      .order("created_at", { ascending: false })
      .limit(20);
    setPastQuotes((data as QuoteWithItems[]) || []);
    setLoadingPast(false);
  }

  // 이전 견적서에서 항목 복사 (box_quantity 반영)
  function importFromQuote(q: QuoteWithItems) {
    setItems(
      q.quote_items.map((item) => {
        const p = item.product_id ? products.find((pr) => pr.id === item.product_id) : null;
        if (p) {
          const eaPrice = getProductPrice(p);
          const boxQty = p.box_quantity || 1;
          if (boxQty > 1) {
            const boxPrice = eaPrice * boxQty;
            return {
              product_id: item.product_id || null,
              product_name: item.product_name,
              specification: `${boxQty}EA/박스`,
              unit: "박스",
              quantity: item.quantity,
              unit_price: boxPrice,
              amount: item.quantity * boxPrice,
              ea_price: eaPrice,
              box_qty: boxQty,
            };
          }
          return {
            product_id: item.product_id || null,
            product_name: item.product_name,
            specification: item.specification || "",
            unit: p.unit || "EA",
            quantity: item.quantity,
            unit_price: eaPrice,
            amount: item.quantity * eaPrice,
            ea_price: eaPrice,
            box_qty: 1,
          };
        }
        return {
          product_id: item.product_id || null,
          product_name: item.product_name,
          specification: item.specification || "",
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          ea_price: item.unit_price,
          box_qty: 1,
        };
      }),
    );
    setShippingFee(q.shipping_fee || 0);
    if (q.notes) setNotes(q.notes);
    setShowQuoteLoader(false);
  }

  function addItem() {
    setItems((prev) => [...prev, {
      product_id: null,
      product_name: "",
      specification: "",
      unit: "EA",
      quantity: 1,
      unit_price: 0,
      amount: 0,
      ea_price: 0,
      box_qty: 1,
    }]);
  }

  function updateItem(index: number, field: string, value: string | number | null) {
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };
      if (field === "product_id" && value) {
        const p = products.find((pr) => pr.id === value);
        if (p) {
          item.product_name = p.name;
          const eaPrice = getProductPrice(p);
          const boxQty = p.box_quantity || 1;
          item.ea_price = eaPrice;
          item.box_qty = boxQty;
          if (boxQty > 1) {
            item.unit = "박스";
            item.unit_price = eaPrice * boxQty;
            item.specification = `${boxQty}EA/박스`;
          } else {
            item.unit = p.unit || "EA";
            item.unit_price = eaPrice;
          }
        }
      }
      // EA단가 변경 시 박스 단위면 unit_price 자동 계산
      if (field === "ea_price") {
        item.ea_price = value as number;
        if (item.unit === "박스" && item.box_qty > 1) {
          item.unit_price = (value as number) * item.box_qty;
        } else {
          item.unit_price = value as number;
        }
      }
      // 단위 변경 시 박스↔EA 전환
      if (field === "unit") {
        if (value === "박스" && item.box_qty > 1) {
          item.unit_price = item.ea_price * item.box_qty;
        } else {
          item.unit_price = item.ea_price;
        }
      }
      item.amount = item.quantity * item.unit_price;
      copy[index] = item;
      return copy;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const supplyAmount = items.reduce((sum, i) => sum + i.amount, 0);
  const taxAmount = Math.round(supplyAmount * 0.1);
  const totalAmount = supplyAmount + taxAmount + shippingFee;

  const isRecipientValid = inputMode === "select" ? !!companyId : !!recipientName.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isRecipientValid || items.length === 0) return;
    setSaving(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: quote, error } = await db.from("quotes").insert({
      quote_number: generateQuoteNumber(),
      company_id: inputMode === "select" ? companyId : null,
      quote_date: quoteDate,
      valid_until: validUntil || null,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      shipping_fee: shippingFee,
      notes: notes || null,
      recipient_name: recipientName || null,
      recipient_ceo_name: recipientCeoName || null,
      recipient_biz_number: recipientBizNumber || null,
      recipient_biz_type: recipientBizType || null,
      recipient_biz_category: recipientBizCategory || null,
      recipient_address: recipientAddress || null,
      recipient_phone: recipientPhone || null,
    }).select().single();

    if (error || !quote) {
      alert("생성 실패: " + (error?.message || "알 수 없는 오류"));
      setSaving(false);
      return;
    }

    await db.from("quote_items").insert(
      items.map((item) => ({
        quote_id: quote.id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        specification: item.specification || null,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
      })),
    );

    router.push(`/admin/quotes/${quote.id}`);
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/quotes" className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">견적서 작성</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {/* 거래처 정보 */}
        <div className="rounded-2xl border border-border bg-bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">거래처 정보</h2>
            <div className="flex rounded-xl border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setInputMode("select")}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                  inputMode === "select"
                    ? "bg-primary text-bg-dark"
                    : "bg-bg-dark text-text-secondary hover:text-text-primary"
                }`}
              >
                <Building2 size={14} /> 거래처 선택
              </button>
              <button
                type="button"
                onClick={() => { setInputMode("manual"); setCompanyId(""); setCompanyPrices([]); }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                  inputMode === "manual"
                    ? "bg-primary text-bg-dark"
                    : "bg-bg-dark text-text-secondary hover:text-text-primary"
                }`}
              >
                <PenLine size={14} /> 직접 입력
              </button>
            </div>
          </div>

          {inputMode === "select" ? (
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                거래처 <span className="text-red-400">*</span>
              </label>
              <select
                value={companyId}
                onChange={(e) => handleCompanySelect(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">거래처 선택</option>
                {companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              {companyPrices.length > 0 && (
                <p className="text-xs text-emerald-400 mt-1">이 거래처의 별도 단가가 {companyPrices.length}개 적용됩니다.</p>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  상호명 <span className="text-red-400">*</span>
                </label>
                <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required
                  placeholder="거래처 상호명"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">대표자명</label>
                <input type="text" value={recipientCeoName} onChange={(e) => setRecipientCeoName(e.target.value)}
                  placeholder="대표자명"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">사업자번호</label>
                <input type="text" value={recipientBizNumber} onChange={(e) => setRecipientBizNumber(e.target.value)}
                  placeholder="000-00-00000"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">업태</label>
                  <input type="text" value={recipientBizType} onChange={(e) => setRecipientBizType(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">종목</label>
                  <input type="text" value={recipientBizCategory} onChange={(e) => setRecipientBizCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">주소</label>
                <input type="text" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">연락처</label>
                <input type="text" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="000-0000-0000"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors" />
              </div>
            </div>
          )}
        </div>

        {/* 기본 정보 */}
        <div className="rounded-2xl border border-border bg-bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">견적 정보</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">견적일</label>
              <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} title="견적일" className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">유효기간</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} title="유효기간" className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">비고</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="비고 사항을 입력하세요" className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors resize-none" />
          </div>
        </div>

        {/* 견적 항목 */}
        <div className="rounded-2xl border border-border bg-bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">견적 항목</h2>
            <div className="flex gap-2">
              <button type="button" onClick={loadPastQuotes} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors">
                <Copy size={16} /> 이전 견적서 불러오기
              </button>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
                <Plus size={16} /> 항목 추가
              </button>
            </div>
          </div>

          {/* 이전 견적서 불러오기 모달 */}
          {showQuoteLoader && (
            <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary">이전 견적서에서 항목 불러오기</h3>
                <button type="button" onClick={() => setShowQuoteLoader(false)} className="p-1 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary" aria-label="닫기">
                  <X size={16} />
                </button>
              </div>
              {loadingPast ? (
                <p className="text-sm text-text-muted text-center py-4">로딩 중...</p>
              ) : pastQuotes.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-4">이전 견적서가 없습니다.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {pastQuotes.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => importFromQuote(q)}
                      className="w-full text-left px-4 py-3 rounded-lg bg-bg-dark hover:bg-bg-card-hover border border-border transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-mono text-text-muted">{q.quote_number}</span>
                          <span className="mx-2 text-text-primary font-medium">
                            {q.companies?.name || q.recipient_name || "—"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-text-primary">{formatNumber(q.total_amount)}원</span>
                          <span className="ml-2 text-xs text-text-muted">{formatDate(q.quote_date)}</span>
                        </div>
                      </div>
                      <div className="text-xs text-text-muted mt-1">
                        {q.quote_items.map((item) => item.product_name).join(", ")}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {items.length === 0 ? (
            <p className="text-center py-8 text-text-muted">항목을 추가해주세요.</p>
          ) : (
            <div className="space-y-3">
              <div className="hidden lg:grid gap-3 text-xs text-text-muted px-1" style={{ gridTemplateColumns: "2.5fr 2fr 1.2fr 1.3fr 1.5fr 1.5fr 2fr 0.5fr" }}>
                <div>품목</div>
                <div>규격</div>
                <div>단위</div>
                <div>수량</div>
                <div>단가(EA)</div>
                <div className="text-right">박스단가</div>
                <div className="text-right">금액</div>
                <div />
              </div>
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-1 lg:gap-3 items-center rounded-xl border border-border p-3" style={{ gridTemplateColumns: "2.5fr 2fr 1.2fr 1.3fr 1.5fr 1.5fr 2fr 0.5fr" }}>
                  <div>
                    <select value={item.product_id || ""} onChange={(e) => updateItem(i, "product_id", e.target.value || null)} title="품목 선택" className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary">
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
                      <input type="text" placeholder="품목명 직접 입력" value={item.product_name} onChange={(e) => updateItem(i, "product_name", e.target.value)} className="w-full mt-2 px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary" required />
                    )}
                  </div>
                  <div>
                    <input type="text" placeholder="규격" value={item.specification} onChange={(e) => updateItem(i, "specification", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <select value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} title="단위 선택" className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary">
                      <option value="EA">EA</option>
                      <option value="박스">박스</option>
                      <option value="세트">세트</option>
                      <option value="팩">팩</option>
                      <option value="롤">롤</option>
                      <option value="장">장</option>
                      <option value="개">개</option>
                    </select>
                  </div>
                  <div>
                    <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <input type="text" inputMode="numeric" value={item.ea_price ? formatNumber(item.ea_price) : ""} onChange={(e) => { const num = Number(e.target.value.replace(/,/g, "")); if (!isNaN(num)) updateItem(i, "ea_price", num); }} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm text-right focus:outline-none focus:border-primary" />
                  </div>
                  <div className="text-right text-sm">
                    {item.unit === "박스" && item.box_qty > 1 ? (
                      <span className="text-amber-400 font-medium">{formatNumber(item.unit_price)}원</span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </div>
                  <div className="text-right text-text-primary font-medium">{formatNumber(item.amount)}원</div>
                  <div className="text-right">
                    <button type="button" onClick={() => removeItem(i)} className="p-1.5 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">공급가액</span>
              <span className="text-text-primary">{formatNumber(supplyAmount)}원</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">세액 (10%)</span>
              <span className="text-text-primary">{formatNumber(taxAmount)}원</span>
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
              <span className="text-2xl font-bold text-text-primary">{formatNumber(totalAmount)}원</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/admin/quotes" className="flex-1 py-3 text-center rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</Link>
          <button type="submit" disabled={saving || !isRecipientValid || items.length === 0} className="flex-1 py-3 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50">
            {saving ? "저장 중..." : "견적서 저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
