"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { QuoteWithItems, CompanyInfo } from "@/lib/supabase/types";
import { QUOTE_STATUS, formatNumber, formatDate, generateOrderNumber } from "@/lib/utils";
import { ArrowLeft, Trash2, Printer, ShoppingCart } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const QuotePdfDownload = dynamic(
  () => import("@/components/pdf/QuotePdfDownload"),
  { ssr: false },
);

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [quote, setQuote] = useState<QuoteWithItems | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [qRes, ciRes] = await Promise.all([
        db.from("quotes").select("*, companies(*), quote_items(*)").eq("id", id).single(),
        db.from("company_info").select("*").limit(1).maybeSingle(),
      ]);
      setQuote(qRes.data as QuoteWithItems | null);
      setCompanyInfo(ciRes.data as CompanyInfo | null);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function updateStatus(status: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("quotes") as any).update({ status }).eq("id", id);
    setQuote((prev) => prev ? { ...prev, status } : prev);
  }

  async function handleDelete() {
    if (!confirm("이 견적서를 삭제하시겠습니까?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("quotes") as any).delete().eq("id", id);
    router.push("/admin/quotes");
  }

  async function convertToOrder() {
    if (!quote) return;
    if (!confirm("이 견적서를 주문으로 전환하시겠습니까?")) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const totalAmount = quote.quote_items.reduce((sum, i) => sum + i.amount, 0);
    const { data: order, error } = await db.from("orders").insert({
      order_number: generateOrderNumber(),
      company_id: quote.company_id,
      order_date: new Date().toISOString().slice(0, 10),
      total_amount: totalAmount,
      notes: `견적서 ${quote.quote_number}에서 전환`,
    }).select().single();

    if (error || !order) {
      alert("주문 전환 실패");
      return;
    }

    await db.from("order_items").insert(
      quote.quote_items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id || "00000000-0000-0000-0000-000000000000",
        product_name: item.product_name,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
      })),
    );

    await updateStatus("accepted");
    router.push(`/admin/orders/${order.id}`);
  }

  if (loading) return <div className="text-center py-20 text-text-muted">로딩 중...</div>;
  if (!quote) return <div className="text-center py-20 text-text-muted">견적서를 찾을 수 없습니다.</div>;

  const st = QUOTE_STATUS[quote.status] || QUOTE_STATUS.draft;
  const c = quote.companies;

  return (
    <div>
      <div className="flex items-center gap-4 mb-8 print:hidden">
        <Link href="/admin/quotes" className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">{quote.quote_number}</h1>
          <p className="text-sm text-text-secondary">{c.name}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${st.color}`}>{st.label}</span>
      </div>

      {/* Status & Actions */}
      <div className="flex flex-wrap gap-3 mb-6 print:hidden">
        <div className="flex flex-wrap gap-2">
          {Object.entries(QUOTE_STATUS).map(([key, { label, color }]) => (
            <button key={key} onClick={() => updateStatus(key)} disabled={quote.status === key}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                quote.status === key ? `${color} ring-2 ring-current` : "bg-bg-dark text-text-secondary hover:text-text-primary border border-border"
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          {quote.status !== "accepted" && (
            <button onClick={convertToOrder} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-dark transition-colors">
              <ShoppingCart size={16} /> 주문 전환
            </button>
          )}
          <QuotePdfDownload quote={quote} companyInfo={companyInfo} />
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-card border border-border text-text-secondary hover:text-text-primary transition-colors">
            <Printer size={16} /> 인쇄
          </button>
          <button onClick={handleDelete} className="p-2 rounded-xl border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* 견적서 미리보기 */}
      <div className="bg-white text-black rounded-2xl border border-border p-8 max-w-4xl mx-auto print:border-none print:rounded-none print:p-4 print:max-w-none">
        {companyInfo?.logo_image_url && (
          <div className="flex justify-center mb-4">
            <img src={companyInfo.logo_image_url} alt={companyInfo.name} className="h-16 object-contain" />
          </div>
        )}
        <h2 className="text-2xl font-bold text-center mb-8 tracking-widest">견 적 서</h2>

        <div className="flex justify-between text-sm mb-6">
          <span>작성일: {formatDate(quote.quote_date)}</span>
          <span>
            No. {quote.quote_number}
            {quote.valid_until && <> | 유효기간: {formatDate(quote.valid_until)}</>}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border border-gray-300 p-4 text-sm">
            <p className="font-bold mb-2 text-center bg-gray-100 py-1">공급자</p>
            {companyInfo ? (
              <table className="w-full text-xs"><tbody>
                <tr><td className="py-1 text-gray-500 w-20">상호</td><td className="py-1 font-medium">{companyInfo.name}</td></tr>
                <tr><td className="py-1 text-gray-500">대표자</td><td className="py-1">{companyInfo.ceo_name}</td></tr>
                <tr><td className="py-1 text-gray-500">사업자번호</td><td className="py-1">{companyInfo.biz_number}</td></tr>
                <tr><td className="py-1 text-gray-500">업태/종목</td><td className="py-1">{companyInfo.biz_type} / {companyInfo.biz_category}</td></tr>
                <tr><td className="py-1 text-gray-500">주소</td><td className="py-1">{companyInfo.address}</td></tr>
                <tr><td className="py-1 text-gray-500">연락처</td><td className="py-1">{companyInfo.phone}</td></tr>
              </tbody></table>
            ) : <p className="text-xs text-gray-400">공급자 정보 미등록</p>}
          </div>
          <div className="border border-gray-300 p-4 text-sm">
            <p className="font-bold mb-2 text-center bg-gray-100 py-1">공급받는자</p>
            <table className="w-full text-xs"><tbody>
              <tr><td className="py-1 text-gray-500 w-20">상호</td><td className="py-1 font-medium">{c.name}</td></tr>
              <tr><td className="py-1 text-gray-500">대표자</td><td className="py-1">{c.ceo_name}</td></tr>
              <tr><td className="py-1 text-gray-500">사업자번호</td><td className="py-1">{c.biz_number}</td></tr>
              <tr><td className="py-1 text-gray-500">업태/종목</td><td className="py-1">{c.biz_type || "—"} / {c.biz_category || "—"}</td></tr>
              <tr><td className="py-1 text-gray-500">주소</td><td className="py-1">{c.address || "—"}</td></tr>
              <tr><td className="py-1 text-gray-500">연락처</td><td className="py-1">{c.phone || "—"}</td></tr>
            </tbody></table>
          </div>
        </div>

        <div className="grid grid-cols-3 border border-gray-300 mb-6 text-center text-sm">
          <div className="py-2 border-r border-gray-300"><p className="text-gray-500 text-xs">공급가액</p><p className="font-bold">{formatNumber(quote.supply_amount)}원</p></div>
          <div className="py-2 border-r border-gray-300"><p className="text-gray-500 text-xs">세액</p><p className="font-bold">{formatNumber(quote.tax_amount)}원</p></div>
          <div className="py-2"><p className="text-gray-500 text-xs">합계금액</p><p className="font-bold text-lg">{formatNumber(quote.total_amount)}원</p></div>
        </div>

        <table className="w-full border-collapse border border-gray-300 text-sm mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-center w-8">No</th>
              <th className="border border-gray-300 px-3 py-2 text-left">품목</th>
              <th className="border border-gray-300 px-3 py-2 text-left">규격</th>
              <th className="border border-gray-300 px-3 py-2 text-center">단위</th>
              <th className="border border-gray-300 px-3 py-2 text-right">수량</th>
              <th className="border border-gray-300 px-3 py-2 text-right">단가</th>
              <th className="border border-gray-300 px-3 py-2 text-right">금액</th>
            </tr>
          </thead>
          <tbody>
            {quote.quote_items.map((item, i) => (
              <tr key={item.id}>
                <td className="border border-gray-300 px-3 py-2 text-center text-gray-500">{i + 1}</td>
                <td className="border border-gray-300 px-3 py-2">{item.product_name}</td>
                <td className="border border-gray-300 px-3 py-2 text-gray-600">{item.specification || "—"}</td>
                <td className="border border-gray-300 px-3 py-2 text-center">{item.unit}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{formatNumber(item.quantity)}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{formatNumber(item.unit_price)}</td>
                <td className="border border-gray-300 px-3 py-2 text-right font-medium">{formatNumber(item.amount)}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 10 - quote.quote_items.length) }).map((_, i) => (
              <tr key={`e-${i}`}>
                <td className="border border-gray-300 px-3 py-2 text-center text-gray-300">{quote.quote_items.length + i + 1}</td>
                <td className="border border-gray-300 px-3 py-2">&nbsp;</td>
                <td className="border border-gray-300 px-3 py-2" /><td className="border border-gray-300 px-3 py-2" />
                <td className="border border-gray-300 px-3 py-2" /><td className="border border-gray-300 px-3 py-2" />
                <td className="border border-gray-300 px-3 py-2" />
              </tr>
            ))}
          </tbody>
        </table>

        {quote.notes && (
          <div className="border border-gray-300 p-3 text-sm mb-4">
            <span className="text-gray-500">비고: </span>{quote.notes}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          위 금액으로 견적합니다.
        </p>
      </div>
    </div>
  );
}
