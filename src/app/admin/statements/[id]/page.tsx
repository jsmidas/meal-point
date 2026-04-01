"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { StatementWithItems, CompanyInfo, StatementSendLog } from "@/lib/supabase/types";
import { formatNumber, formatDate } from "@/lib/utils";
import { dbUpdate, dbDelete, dbInsert } from "@/lib/db";
import { ArrowLeft, Trash2, Printer, Send, Clock, Plus, Edit2, Save, X } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const PdfDownloadButton = dynamic(
  () => import("@/components/pdf/PdfDownloadButton"),
  { ssr: false },
);

const SEND_METHODS: Record<string, string> = {
  manual: "직접 전달",
  email: "이메일",
  print: "인쇄",
  pdf: "PDF 다운로드",
  fax: "팩스",
};

interface EditItem {
  id: string;
  product_name: string;
  specification: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export default function StatementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [statement, setStatement] = useState<StatementWithItems | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [sendLogs, setSendLogs] = useState<StatementSendLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendMethod, setSendMethod] = useState("manual");
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendNotes, setSendNotes] = useState("");

  // 수정 모드
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [editShippingFee, setEditShippingFee] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const [stRes, ciRes, logRes] = await Promise.all([
      db
        .from("statements")
        .select("*, companies(*), statement_items(*)")
        .eq("id", id)
        .single(),
      db.from("company_info").select("*").limit(1).maybeSingle(),
      db.from("statement_send_logs").select("*").eq("statement_id", id).order("sent_at", { ascending: false }),
    ]);

    setStatement(stRes.data as StatementWithItems | null);
    setCompanyInfo(ciRes.data as CompanyInfo | null);
    setSendLogs((logRes.data as StatementSendLog[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function startEditing() {
    if (!statement) return;
    setEditItems(statement.statement_items.map((item) => ({
      id: item.id,
      product_name: item.product_name,
      specification: item.specification || "",
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
    })));
    setEditShippingFee(statement.shipping_fee || 0);
    setEditNotes(statement.notes || "");
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditItems([]);
  }

  function updateEditItem(index: number, field: string, value: string | number) {
    setEditItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };
      if (field === "quantity" || field === "unit_price") {
        item.amount = Number(item.quantity) * Number(item.unit_price);
      }
      copy[index] = item;
      return copy;
    });
  }

  function addEditItem() {
    setEditItems((prev) => [...prev, {
      id: `new_${Date.now()}`,
      product_name: "",
      specification: "",
      unit: "EA",
      quantity: 1,
      unit_price: 0,
      amount: 0,
    }]);
  }

  function removeEditItem(index: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveEdits() {
    if (!statement || editItems.length === 0) return;
    setSaving(true);

    const supplyAmount = editItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = Math.round(supplyAmount * 0.1);
    const totalAmount = supplyAmount + taxAmount + editShippingFee;

    // 1. statement 업데이트
    await dbUpdate("statements", {
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      shipping_fee: editShippingFee,
      notes: editNotes || null,
    }, { id });

    // 2. 기존 항목 삭제
    await dbDelete("statement_items", { statement_id: id });

    // 3. 새 항목 삽입
    const insertItems = editItems.map((item, i) => ({
      statement_id: id,
      product_name: item.product_name,
      specification: item.specification || null,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      sort_order: i,
    }));
    await dbInsert("statement_items", insertItems);

    setEditing(false);
    setSaving(false);
    await load();
  }

  async function handleDelete() {
    if (!confirm("이 거래명세서를 삭제하시겠습니까?")) return;
    await dbDelete("statements", { id });
    router.push("/admin/statements");
  }

  async function handleAddSendLog() {
    const { data: logData, error } = await dbInsert("statement_send_logs", {
      statement_id: id,
      sent_method: sendMethod,
      recipient_info: sendRecipient || null,
      notes: sendNotes || null,
    });
    const data = Array.isArray(logData) ? logData[0] : logData;

    if (!error && data) {
      setSendLogs((prev) => [data as StatementSendLog, ...prev]);
      setShowSendForm(false);
      setSendMethod("manual");
      setSendRecipient("");
      setSendNotes("");
    }
  }

  // 수정 모드 합계
  const editSupply = editItems.reduce((sum, item) => sum + item.amount, 0);
  const editTax = Math.round(editSupply * 0.1);
  const editTotal = editSupply + editTax + editShippingFee;

  if (loading) {
    return <div className="text-center py-20 text-text-muted">로딩 중...</div>;
  }

  if (!statement) {
    return (
      <div className="text-center py-20 text-text-muted">
        거래명세서를 찾을 수 없습니다.
      </div>
    );
  }

  const c = statement.companies; // 거래처 (공급받는자)

  return (
    <div>
      {/* Action Bar (print 시 숨김) */}
      <div className="flex items-center gap-4 mb-8 print:hidden">
        <Link
          href="/admin/statements"
          className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">
            {statement.statement_number}
          </h1>
        </div>
        {!editing ? (
          <>
            <button onClick={startEditing} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/30 text-sm font-semibold hover:bg-primary/20 transition-colors">
              <Edit2 size={16} /> 수정
            </button>
            <button onClick={() => setShowSendForm(!showSendForm)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-400/30 text-sm font-semibold hover:bg-emerald-500/20 transition-colors">
              <Send size={16} /> 발송 기록
            </button>
            <PdfDownloadButton statement={statement} companyInfo={companyInfo} />
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-card border border-border text-text-secondary hover:text-text-primary transition-colors"
            >
              <Printer size={16} /> 인쇄
            </button>
            <button
              onClick={handleDelete}
              className="p-2 rounded-xl border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </>
        ) : (
          <>
            <button onClick={saveEdits} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50">
              <Save size={16} /> {saving ? "저장 중..." : "저장"}
            </button>
            <button onClick={cancelEditing} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-text-secondary text-sm hover:bg-bg-card-hover transition-colors">
              <X size={16} /> 취소
            </button>
          </>
        )}
      </div>

      {/* 발송 기록 폼 & 이력 */}
      {showSendForm && !editing && (
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
                  <span className="px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 text-xs font-medium">
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

      {/* 수정 모드: 편집 패널 */}
      {editing && (
        <div className="mb-6 rounded-2xl border border-primary/30 bg-bg-card p-6 print:hidden">
          <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
            <Edit2 size={18} /> 명세서 수정
          </h3>

          {/* 품목 편집 */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-2 py-2 text-left text-text-muted text-xs w-8">No</th>
                  <th className="px-2 py-2 text-left text-text-muted text-xs">품목</th>
                  <th className="px-2 py-2 text-left text-text-muted text-xs w-32">규격</th>
                  <th className="px-2 py-2 text-center text-text-muted text-xs w-20">단위</th>
                  <th className="px-2 py-2 text-right text-text-muted text-xs w-20">수량</th>
                  <th className="px-2 py-2 text-right text-text-muted text-xs w-28">단가</th>
                  <th className="px-2 py-2 text-right text-text-muted text-xs w-28">금액</th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {editItems.map((item, i) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="px-2 py-1.5 text-text-muted text-xs">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={item.product_name}
                        onChange={(e) => updateEditItem(i, "product_name", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={item.specification}
                        onChange={(e) => updateEditItem(i, "specification", e.target.value)}
                        placeholder="1박스/300EA"
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={item.unit}
                        onChange={(e) => updateEditItem(i, "unit", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-bg-dark text-text-primary text-sm text-center focus:outline-none focus:border-primary" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} value={item.quantity}
                        onChange={(e) => updateEditItem(i, "quantity", Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-bg-dark text-text-primary text-sm text-right focus:outline-none focus:border-primary" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} value={item.unit_price}
                        onChange={(e) => updateEditItem(i, "unit_price", Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-bg-dark text-text-primary text-sm text-right focus:outline-none focus:border-primary" />
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold text-accent text-sm">
                      {formatNumber(item.amount)}원
                    </td>
                    <td className="px-2 py-1.5">
                      <button type="button" onClick={() => removeEditItem(i)}
                        disabled={editItems.length <= 1}
                        className="p-1 rounded text-text-muted hover:text-red-400 transition-colors disabled:opacity-30">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={addEditItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors mb-4">
            <Plus size={12} /> 항목 추가
          </button>

          {/* 배송비 & 비고 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">배송비 (비과세)</label>
              <input type="number" min={0} value={editShippingFee}
                onChange={(e) => setEditShippingFee(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">비고</label>
              <input type="text" value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="비고"
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>

          {/* 수정 합계 */}
          <div className="rounded-xl bg-bg-dark border border-border p-4 flex items-center justify-between">
            <div className="text-sm text-text-muted space-x-4">
              <span>공급가: <span className="text-text-primary font-bold">{formatNumber(editSupply)}원</span></span>
              <span>세액: <span className="text-text-primary font-bold">{formatNumber(editTax)}원</span></span>
              {editShippingFee > 0 && <span>배송비: <span className="text-text-primary font-bold">{formatNumber(editShippingFee)}원</span></span>}
            </div>
            <span className="text-xl font-black text-accent">{formatNumber(editTotal)}원</span>
          </div>
        </div>
      )}

      {/* 거래명세서 미리보기 (인쇄용) */}
      <div className="bg-white text-black rounded-2xl border border-border max-w-4xl mx-auto print:border-none print:rounded-none print:max-w-none print:m-0 print:shadow-none overflow-hidden">
        {/* 상단 헤더 바 */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-500 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {companyInfo?.logo_image_url && (
                <img src={companyInfo.logo_image_url} alt={companyInfo?.name || ""} className="h-12 object-contain brightness-0 invert" />
              )}
              <div>
                <h2 className="text-2xl font-bold tracking-wider">거 래 명 세 서</h2>
                <p className="text-emerald-100 text-xs mt-1">TRANSACTION STATEMENT</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-bold text-lg">{statement.statement_number}</p>
              <p className="text-emerald-100 text-xs">{formatDate(statement.statement_date)}</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* 합계금액 강조 */}
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5 mb-6 text-center">
            <p className="text-xs text-emerald-500 font-medium mb-1">합계금액 (VAT 포함)</p>
            <p className="text-3xl font-black text-emerald-700">&#8361; {formatNumber(statement.total_amount)}</p>
            <div className="flex justify-center gap-8 mt-2 text-xs text-gray-500">
              <span>공급가액: {formatNumber(statement.supply_amount)}원</span>
              <span>세액: {formatNumber(statement.tax_amount)}원</span>
              {statement.shipping_fee > 0 && <span>배송비(비과세): {formatNumber(statement.shipping_fee)}원</span>}
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
              <div className="bg-emerald-600 text-white text-center py-1.5 text-xs font-bold tracking-wider">공급받는자 (귀하)</div>
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 w-20 bg-emerald-50/50">상호</td><td className="py-2 px-3 font-bold text-sm">{c.name}</td></tr>
                  <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 bg-emerald-50/50">대표자</td><td className="py-2 px-3">{c.ceo_name}</td></tr>
                  <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 bg-emerald-50/50">사업자번호</td><td className="py-2 px-3">{c.biz_number}</td></tr>
                  <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 bg-emerald-50/50">업태/종목</td><td className="py-2 px-3">{c.biz_type || "—"} / {c.biz_category || "—"}</td></tr>
                  <tr className="border-b border-gray-100"><td className="py-2 px-3 text-gray-400 bg-emerald-50/50">주소</td><td className="py-2 px-3">{c.address || "—"}</td></tr>
                  <tr><td className="py-2 px-3 text-gray-400 bg-emerald-50/50">연락처</td><td className="py-2 px-3">{c.phone || "—"}</td></tr>
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
              {statement.statement_items.map((item, i) => (
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
              {statement.statement_items.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-300">품목이 없습니다</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-700 text-white font-bold">
                <td colSpan={6} className="px-3 py-2.5 text-right text-sm">합 계</td>
                <td className="px-3 py-2.5 text-right text-sm">{formatNumber(statement.total_amount)}원</td>
              </tr>
            </tfoot>
          </table>

          {/* 비고 */}
          {statement.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm mb-6">
              <span className="text-yellow-700 font-medium">비고: </span>
              <span className="text-gray-600">{statement.notes}</span>
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
              <p className="text-gray-400 mt-3">위 금액을 명세서와 같이 거래합니다.</p>
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
