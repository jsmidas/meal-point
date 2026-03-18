"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { QuoteWithItems, CompanyInfo, QuoteSendLog } from "@/lib/supabase/types";
import { QUOTE_STATUS, formatNumber, formatDate, generateOrderNumber } from "@/lib/utils";
import { ArrowLeft, Trash2, Printer, ShoppingCart, Send, Clock, Plus } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const QuotePdfDownload = dynamic(
  () => import("@/components/pdf/QuotePdfDownload"),
  { ssr: false },
);

const SEND_METHODS: Record<string, string> = {
  manual: "직접 전달",
  email: "이메일",
  print: "인쇄",
  pdf: "PDF 다운로드",
  fax: "팩스",
};

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [quote, setQuote] = useState<QuoteWithItems | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [sendLogs, setSendLogs] = useState<QuoteSendLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendMethod, setSendMethod] = useState("manual");
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendNotes, setSendNotes] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [qRes, ciRes, logRes] = await Promise.all([
        db.from("quotes").select("*, companies(*), quote_items(*)").eq("id", id).single(),
        db.from("company_info").select("*").limit(1).maybeSingle(),
        db.from("quote_send_logs").select("*").eq("quote_id", id).order("sent_at", { ascending: false }),
      ]);
      setQuote(qRes.data as QuoteWithItems | null);
      setCompanyInfo(ciRes.data as CompanyInfo | null);
      setSendLogs((logRes.data as QuoteSendLog[]) || []);
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
    if (!quote || !quote.company_id) {
      alert("등록된 거래처가 있는 견적서만 주문 전환이 가능합니다.");
      return;
    }
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

  async function handleAddSendLog() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data, error } = await db.from("quote_send_logs").insert({
      quote_id: id,
      sent_method: sendMethod,
      recipient_info: sendRecipient || null,
      notes: sendNotes || null,
    }).select().single();

    if (!error && data) {
      setSendLogs((prev) => [data as QuoteSendLog, ...prev]);
      setShowSendForm(false);
      setSendMethod("manual");
      setSendRecipient("");
      setSendNotes("");
      if (quote?.status === "draft") {
        await updateStatus("sent");
      }
    }
  }

  if (loading) return <div className="text-center py-20 text-text-muted">로딩 중...</div>;
  if (!quote) return <div className="text-center py-20 text-text-muted">견적서를 찾을 수 없습니다.</div>;

  const st = QUOTE_STATUS[quote.status] || QUOTE_STATUS.draft;
  const c = quote.companies;

  // 수신자 정보: 거래처가 있으면 거래처 정보, 없으면 직접입력 정보
  const recipientName = c?.name || quote.recipient_name || "—";
  const recipientCeoName = c?.ceo_name || quote.recipient_ceo_name || "—";
  const recipientBizNumber = c?.biz_number || quote.recipient_biz_number || "—";
  const recipientBizType = c?.biz_type || quote.recipient_biz_type || "—";
  const recipientBizCategory = c?.biz_category || quote.recipient_biz_category || "—";
  const recipientAddress = c?.address || quote.recipient_address || "—";
  const recipientPhone = c?.phone || quote.recipient_phone || "—";

  return (
    <div>
      <div className="flex items-center gap-4 mb-8 print:hidden">
        <Link href="/admin/quotes" className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">{quote.quote_number}</h1>
          <p className="text-sm text-text-secondary">
            {recipientName}
            {!c && <span className="ml-2 text-xs text-yellow-500">(직접입력)</span>}
          </p>
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
          <button onClick={() => setShowSendForm(!showSendForm)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-400/30 text-sm font-semibold hover:bg-emerald-500/20 transition-colors">
            <Send size={16} /> 발송 기록
          </button>
          {quote.status !== "accepted" && quote.company_id && (
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

      {/* 발송 기록 폼 & 이력 */}
      {showSendForm && (
        <div className="mb-6 rounded-2xl border border-border bg-bg-card p-6 print:hidden">
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Clock size={18} /> 발송 이력
          </h3>

          {/* 새 발송 기록 추가 */}
          <div className="flex flex-wrap gap-3 items-end mb-4 pb-4 border-b border-border">
            <div>
              <label className="block text-xs text-text-muted mb-1">발송 방법</label>
              <select value={sendMethod} onChange={(e) => setSendMethod(e.target.value)} title="발송 방법"
                className="px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary">
                {Object.entries(SEND_METHODS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-text-muted mb-1">수신자 정보</label>
              <input type="text" value={sendRecipient} onChange={(e) => setSendRecipient(e.target.value)}
                placeholder="이메일, 전화번호, 담당자명 등"
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-text-muted mb-1">메모</label>
              <input type="text" value={sendNotes} onChange={(e) => setSendNotes(e.target.value)}
                placeholder="발송 관련 메모"
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary" />
            </div>
            <button onClick={handleAddSendLog}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-bg-dark text-sm font-semibold hover:bg-primary-dark transition-colors">
              <Plus size={14} /> 기록 추가
            </button>
          </div>

          {/* 발송 이력 목록 */}
          {sendLogs.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">발송 이력이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {sendLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-bg-dark text-sm">
                  <span className="text-text-muted text-xs whitespace-nowrap">
                    {new Date(log.sent_at).toLocaleString("ko-KR")}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {SEND_METHODS[log.sent_method] || log.sent_method}
                  </span>
                  {log.recipient_info && (
                    <span className="text-text-primary">{log.recipient_info}</span>
                  )}
                  {log.notes && (
                    <span className="text-text-secondary">{log.notes}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 견적서 미리보기 */}
      <div className="bg-white text-black rounded-2xl border border-border max-w-4xl mx-auto print:border-none print:rounded-none print:max-w-none overflow-hidden">
        {/* 상단 헤더 바 */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {companyInfo?.logo_image_url && (
                <img src={companyInfo.logo_image_url} alt={companyInfo?.name || ""} className="h-12 object-contain brightness-0 invert" />
              )}
              <div>
                <h2 className="text-2xl font-bold tracking-wider">견 적 서</h2>
                <p className="text-blue-100 text-xs mt-1">QUOTATION</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-bold text-lg">{quote.quote_number}</p>
              <p className="text-blue-100 text-xs">{formatDate(quote.quote_date)}</p>
              {quote.valid_until && <p className="text-blue-200 text-xs">유효기간: {formatDate(quote.valid_until)}</p>}
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* 합계금액 강조 */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 mb-6 text-center">
            <p className="text-xs text-blue-500 font-medium mb-1">합계금액 (VAT 포함)</p>
            <p className="text-3xl font-black text-blue-700">&#8361; {formatNumber(quote.total_amount)}</p>
            <div className="flex justify-center gap-8 mt-2 text-xs text-gray-500">
              <span>공급가액: {formatNumber(quote.supply_amount)}원</span>
              <span>세액: {formatNumber(quote.tax_amount)}원</span>
              {quote.shipping_fee > 0 && <span>배송비(비과세): {formatNumber(quote.shipping_fee)}원</span>}
            </div>
          </div>

          {/* 공급자 / 공급받는자 */}
          <div className="grid grid-cols-2 gap-5 mb-6">
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-700 text-white text-center py-1.5 text-xs font-bold tracking-wider">공급자</div>
              {companyInfo ? (
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 w-20 bg-gray-50">상호</td><td className="py-2 px-3 font-bold text-sm">{companyInfo.name}</td></tr>
                    <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 bg-gray-50">대표자</td><td className="py-2 px-3">{companyInfo.ceo_name}</td></tr>
                    <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 bg-gray-50">사업자번호</td><td className="py-2 px-3">{companyInfo.biz_number}</td></tr>
                    <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 bg-gray-50">업태/종목</td><td className="py-2 px-3">{companyInfo.biz_type} / {companyInfo.biz_category}</td></tr>
                    <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 bg-gray-50">주소</td><td className="py-2 px-3">{companyInfo.address}</td></tr>
                    <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 bg-gray-50">연락처</td><td className="py-2 px-3">{companyInfo.phone}</td></tr>
                    {companyInfo.email && <tr><td className="py-2 px-3 text-gray-400 bg-gray-50">이메일</td><td className="py-2 px-3">{companyInfo.email}</td></tr>}
                  </tbody>
                </table>
              ) : <p className="text-xs text-gray-400 p-4">공급자 정보 미등록</p>}
            </div>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-blue-600 text-white text-center py-1.5 text-xs font-bold tracking-wider">공급받는자 (귀하)</div>
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 w-20 bg-blue-50/50">상호</td><td className="py-2 px-3 font-bold text-sm">{recipientName}</td></tr>
                  <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 bg-blue-50/50">대표자</td><td className="py-2 px-3">{recipientCeoName}</td></tr>
                  <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 bg-blue-50/50">사업자번호</td><td className="py-2 px-3">{recipientBizNumber}</td></tr>
                  <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 bg-blue-50/50">업태/종목</td><td className="py-2 px-3">{recipientBizType} / {recipientBizCategory}</td></tr>
                  <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 bg-blue-50/50">주소</td><td className="py-2 px-3">{recipientAddress}</td></tr>
                  <tr><td className="py-2 px-3 text-gray-400 bg-blue-50/50">연락처</td><td className="py-2 px-3">{recipientPhone}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 품목 테이블 */}
          <table className="w-full text-sm mb-6 border-collapse">
            <thead>
              <tr className="bg-gray-700 text-white">
                <th className="px-3 py-2.5 text-center w-10 text-xs">No</th>
                <th className="px-3 py-2.5 text-left text-xs">품목</th>
                <th className="px-3 py-2.5 text-left text-xs">규격</th>
                <th className="px-3 py-2.5 text-center text-xs w-16">단위</th>
                <th className="px-3 py-2.5 text-right text-xs w-16">수량</th>
                <th className="px-3 py-2.5 text-right text-xs w-24">단가</th>
                <th className="px-3 py-2.5 text-right text-xs w-28">금액</th>
              </tr>
            </thead>
            <tbody>
              {quote.quote_items.map((item, i) => (
                <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-2 text-center text-gray-400 border-b border-gray-100">{i + 1}</td>
                  <td className="px-3 py-2 font-medium border-b border-gray-100">{item.product_name}</td>
                  <td className="px-3 py-2 text-gray-500 border-b border-gray-100">{item.specification || ""}</td>
                  <td className="px-3 py-2 text-center text-gray-500 border-b border-gray-100">{item.unit}</td>
                  <td className="px-3 py-2 text-right border-b border-gray-100">{formatNumber(item.quantity)}</td>
                  <td className="px-3 py-2 text-right text-gray-600 border-b border-gray-100">{formatNumber(item.unit_price)}</td>
                  <td className="px-3 py-2 text-right font-bold border-b border-gray-100">{formatNumber(item.amount)}</td>
                </tr>
              ))}
              {quote.quote_items.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-300">품목이 없습니다</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-blue-700 text-white font-bold">
                <td colSpan={6} className="px-3 py-2.5 text-right text-sm">합 계</td>
                <td className="px-3 py-2.5 text-right text-sm">{formatNumber(quote.total_amount)}원</td>
              </tr>
            </tfoot>
          </table>

          {/* 비고 */}
          {quote.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm mb-6">
              <span className="text-yellow-700 font-medium">비고: </span>
              <span className="text-gray-600">{quote.notes}</span>
            </div>
          )}

          {/* 계좌정보 & 도장 */}
          <div className="flex items-end justify-between mt-8 pt-6 border-t-2 border-gray-200">
            <div className="text-xs text-gray-500 space-y-1">
              {companyInfo?.bank_name && (
                <p>
                  <span className="font-medium text-gray-700">입금계좌: </span>
                  {companyInfo.bank_name} {companyInfo.bank_account} (예금주: {companyInfo.bank_holder})
                </p>
              )}
              <p className="text-gray-400 mt-3">위 금액으로 견적합니다.</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-700 mb-1">{companyInfo?.name}</p>
              <p className="text-xs text-gray-500 mb-2">대표 {companyInfo?.ceo_name}</p>
              {companyInfo?.stamp_image_url && (
                <img src={companyInfo.stamp_image_url} alt="직인" className="h-16 w-16 object-contain mx-auto" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
