"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbUpdate, dbDelete } from "@/lib/db";
import type { Company, PaymentRequest } from "@/lib/supabase/types";
import { formatNumber, numberToKorean, formatDate } from "@/lib/utils";
import {
  Plus,
  X,
  CreditCard,
  Copy,
  Check,
  Ban,
  Trash2,
  ExternalLink,
  Receipt,
} from "lucide-react";

type Row = PaymentRequest & { companies: { id: string; name: string } | null };

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "결제대기", color: "bg-yellow-400/10 text-yellow-400" },
  paid: { label: "결제완료", color: "bg-emerald-400/10 text-emerald-400" },
  canceled: { label: "취소", color: "bg-red-400/10 text-red-400" },
  expired: { label: "만료", color: "bg-gray-400/10 text-gray-400" },
};

const emptyForm = {
  company_id: "",
  order_name: "",
  amount: 0,
  customer_name: "",
  customer_phone: "",
  memo: "",
  expires_days: 7,
};

export default function PaymentsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function fetchData() {
    setLoading(true);
    const res = await fetch("/api/payments/list");
    const json = await res.json();
    setRows(json.data || []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: comps } = await (supabase as any)
      .from("companies")
      .select("*")
      .eq("is_active", true)
      .order("name");
    setCompanies(comps || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setCreatedUrl(null);
    setError("");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!form.order_name.trim()) return setError("상품명을 입력하세요.");
    if (form.amount < 100) return setError("결제 금액은 100원 이상이어야 합니다.");

    setSubmitting(true);
    const res = await fetch("/api/payments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_name: form.order_name.trim(),
        amount: form.amount,
        company_id: form.company_id || null,
        customer_name: form.customer_name || null,
        customer_phone: form.customer_phone || null,
        memo: form.memo || null,
        expires_days: form.expires_days,
      }),
    });
    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(json.error || "생성에 실패했습니다.");
      return;
    }
    setCreatedUrl(json.url);
    fetchData();
  }

  async function copyLink(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  function linkOf(token: string) {
    return `${window.location.origin}/pay/${token}`;
  }

  async function handleCancel(row: Row) {
    if (row.status !== "pending") return;
    if (!confirm(`"${row.order_name}" 결제 요청을 취소하시겠습니까?`)) return;
    await dbUpdate("payment_requests", { status: "canceled" }, { id: row.id });
    fetchData();
  }

  async function handleDelete(row: Row) {
    if (!confirm(`"${row.order_name}" 결제 요청 기록을 삭제하시겠습니까?`)) return;
    await dbDelete("payment_requests", { id: row.id });
    fetchData();
  }

  const paidTotal = rows
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.amount, 0);
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">개인결제</h1>
          <p className="text-sm text-text-muted mt-1">
            금액·상품명을 입력해 결제 링크를 발급하고 거래처에 전달하세요. 카드결제 완료 시
            정산관리에 자동 반영됩니다.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors shrink-0"
        >
          <Plus size={18} /> 결제 링크 발급
        </button>
      </div>

      {/* 요약 */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={16} className="text-primary" />
            <p className="text-sm text-text-muted">전체 건수</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{rows.length}건</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={16} className="text-yellow-400" />
            <p className="text-sm text-text-muted">결제대기</p>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{pendingCount}건</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Receipt size={16} className="text-emerald-400" />
            <p className="text-sm text-text-muted">결제완료 합계</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatNumber(paidTotal)}원</p>
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20">
          <CreditCard size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">발급된 결제 링크가 없습니다.</p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm"
          >
            <Plus size={18} /> 첫 결제 링크 발급
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const st = STATUS[row.status] || STATUS.pending;
            return (
              <div
                key={row.id}
                className="rounded-2xl border border-border bg-bg-card p-5 flex flex-col lg:flex-row gap-4 lg:items-center"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-text-primary truncate">
                      {row.order_name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}
                    >
                      {st.label}
                    </span>
                    {row.companies && (
                      <span className="text-xs text-text-muted">
                        · {row.companies.name}
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-bold text-primary">
                    {formatNumber(row.amount)}원
                  </p>
                  <div className="flex gap-x-4 gap-y-1 text-xs text-text-muted mt-1 flex-wrap">
                    {row.customer_name && <span>주문자: {row.customer_name}</span>}
                    <span>발급: {formatDate(row.created_at)}</span>
                    {row.status === "pending" && (
                      <span>만료: {formatDate(row.expires_at)}</span>
                    )}
                    {row.status === "paid" && row.paid_at && (
                      <span className="text-emerald-400">
                        결제: {formatDate(row.paid_at)}
                        {row.method ? ` (${row.method})` : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 flex-wrap">
                  {row.status === "pending" && (
                    <button
                      onClick={() => copyLink(linkOf(row.token), row.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                    >
                      {copiedId === row.id ? (
                        <>
                          <Check size={15} /> 복사됨
                        </>
                      ) : (
                        <>
                          <Copy size={15} /> 링크 복사
                        </>
                      )}
                    </button>
                  )}
                  {row.status === "paid" && row.receipt_url && (
                    <a
                      href={row.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-bg-dark text-text-secondary text-sm hover:text-text-primary transition-colors"
                    >
                      <ExternalLink size={15} /> 영수증
                    </a>
                  )}
                  {row.status === "pending" && (
                    <button
                      onClick={() => handleCancel(row)}
                      title="결제 요청 취소"
                      className="p-2 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors"
                    >
                      <Ban size={16} />
                    </button>
                  )}
                  {row.status !== "paid" && (
                    <button
                      onClick={() => handleDelete(row)}
                      title="삭제"
                      className="p-2 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 생성 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-bg-card p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text-primary">
                {createdUrl ? "결제 링크 발급 완료" : "결제 링크 발급"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-bg-dark text-text-muted hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            {createdUrl ? (
              <div className="space-y-4">
                <p className="text-sm text-text-secondary">
                  아래 링크를 거래처에 카카오톡/문자로 전달하세요. (기본 {form.expires_days}일
                  후 만료)
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={createdUrl}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-bg-dark border border-border text-sm text-text-primary"
                  />
                  <button
                    onClick={() => copyLink(createdUrl, "modal")}
                    className="inline-flex items-center gap-1.5 px-4 rounded-xl bg-primary text-bg-dark text-sm font-semibold"
                  >
                    {copiedId === "modal" ? <Check size={16} /> : <Copy size={16} />}
                    {copiedId === "modal" ? "복사됨" : "복사"}
                  </button>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full py-2.5 rounded-xl bg-bg-dark border border-border text-text-secondary text-sm font-medium hover:text-text-primary"
                >
                  닫기
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">
                    거래처 (선택)
                  </label>
                  <select
                    value={form.company_id}
                    onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-dark border border-border text-sm text-text-primary"
                  >
                    <option value="">미지정 (정산 자동반영 안 함)</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">
                    상품명 <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={form.order_name}
                    onChange={(e) => setForm({ ...form, order_name: e.target.value })}
                    placeholder="예: 1월 급식용기 대금"
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-dark border border-border text-sm text-text-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">
                    결제 금액 <span className="text-red-400">*</span>
                  </label>
                  <input
                    inputMode="numeric"
                    value={form.amount ? formatNumber(form.amount) : ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        amount: Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                      })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-dark border border-border text-sm text-text-primary"
                  />
                  {form.amount > 0 && (
                    <p className="text-xs text-text-muted mt-1">
                      {numberToKorean(form.amount)}원
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">
                      주문자명
                    </label>
                    <input
                      value={form.customer_name}
                      onChange={(e) =>
                        setForm({ ...form, customer_name: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-bg-dark border border-border text-sm text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">
                      연락처
                    </label>
                    <input
                      value={form.customer_phone}
                      onChange={(e) =>
                        setForm({ ...form, customer_phone: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-bg-dark border border-border text-sm text-text-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">
                    링크 유효기간 (일)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.expires_days}
                    onChange={(e) =>
                      setForm({ ...form, expires_days: Number(e.target.value) || 7 })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-dark border border-border text-sm text-text-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">메모</label>
                  <input
                    value={form.memo}
                    onChange={(e) => setForm({ ...form, memo: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-dark border border-border text-sm text-text-primary"
                  />
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {submitting ? "발급 중..." : "결제 링크 발급"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
