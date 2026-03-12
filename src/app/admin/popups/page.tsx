"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Popup } from "@/lib/supabase/types";
import { formatDate } from "@/lib/utils";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Bell,
  Image as ImageIcon,
} from "lucide-react";

const emptyPopup = {
  title: "",
  content: "",
  image_url: "",
  link_url: "",
  is_active: true,
  sort_order: 0,
  start_date: "",
  end_date: "",
};

export default function PopupsPage() {
  const supabase = createClient();
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPopup);

  async function fetchData() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("popups")
      .select("*")
      .order("sort_order", { ascending: true });
    setPopups(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditId(null);
    setForm({ ...emptyPopup, sort_order: popups.length });
    setShowModal(true);
  }

  function openEdit(popup: Popup) {
    setEditId(popup.id);
    setForm({
      title: popup.title,
      content: popup.content || "",
      image_url: popup.image_url || "",
      link_url: popup.link_url || "",
      is_active: popup.is_active,
      sort_order: popup.sort_order,
      start_date: popup.start_date || "",
      end_date: popup.end_date || "",
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const payload = {
      title: form.title,
      content: form.content || null,
      image_url: form.image_url || null,
      link_url: form.link_url || null,
      is_active: form.is_active,
      sort_order: form.sort_order,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    };

    if (editId) {
      await db.from("popups").update(payload).eq("id", editId);
    } else {
      await db.from("popups").insert(payload);
    }

    setShowModal(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("popups").delete().eq("id", id);
    fetchData();
  }

  async function toggleActive(popup: Popup) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("popups")
      .update({ is_active: !popup.is_active })
      .eq("id", popup.id);
    fetchData();
  }

  async function moveOrder(popup: Popup, direction: "up" | "down") {
    const idx = popups.findIndex((p) => p.id === popup.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= popups.length) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const other = popups[swapIdx];
    await Promise.all([
      db.from("popups").update({ sort_order: other.sort_order }).eq("id", popup.id),
      db.from("popups").update({ sort_order: popup.sort_order }).eq("id", other.id),
    ]);
    fetchData();
  }

  const activeCount = popups.filter((p) => p.is_active).length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">팝업 관리</h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} /> 새 팝업
        </button>
      </div>

      {/* 요약 */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Bell size={16} className="text-primary" />
            <p className="text-sm text-text-muted">전체 팝업</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{popups.length}개</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Eye size={16} className="text-emerald-400" />
            <p className="text-sm text-text-muted">활성 팝업</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{activeCount}개</p>
        </div>
      </div>

      {/* 팝업 목록 */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : popups.length === 0 ? (
        <div className="text-center py-20">
          <Bell size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">등록된 팝업이 없습니다.</p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm"
          >
            <Plus size={18} /> 첫 팝업 만들기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {popups.map((popup, idx) => (
            <div
              key={popup.id}
              className={`rounded-2xl border bg-bg-card p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center transition-colors ${
                popup.is_active ? "border-border" : "border-border opacity-50"
              }`}
            >
              {/* 이미지 미리보기 */}
              <div className="w-20 h-20 rounded-xl border border-border bg-bg-dark flex items-center justify-center shrink-0 overflow-hidden">
                {popup.image_url ? (
                  <img
                    src={popup.image_url}
                    alt={popup.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon size={24} className="text-text-muted" />
                )}
              </div>

              {/* 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-text-primary truncate">{popup.title}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      popup.is_active
                        ? "bg-emerald-400/10 text-emerald-400"
                        : "bg-red-400/10 text-red-400"
                    }`}
                  >
                    {popup.is_active ? "활성" : "비활성"}
                  </span>
                </div>
                {popup.content && (
                  <p className="text-sm text-text-secondary truncate mb-1">{popup.content}</p>
                )}
                <div className="flex gap-4 text-xs text-text-muted">
                  {popup.start_date && <span>시작: {formatDate(popup.start_date)}</span>}
                  {popup.end_date && <span>종료: {formatDate(popup.end_date)}</span>}
                  <span>순서: {popup.sort_order}</span>
                </div>
              </div>

              {/* 액션 */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => moveOrder(popup, "up")}
                  disabled={idx === 0}
                  title="위로"
                  className="p-2 rounded-lg hover:bg-bg-dark text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  onClick={() => moveOrder(popup, "down")}
                  disabled={idx === popups.length - 1}
                  title="아래로"
                  className="p-2 rounded-lg hover:bg-bg-dark text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  onClick={() => toggleActive(popup)}
                  title={popup.is_active ? "비활성화" : "활성화"}
                  className="p-2 rounded-lg hover:bg-bg-dark text-text-muted hover:text-text-primary transition-colors"
                >
                  {popup.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={() => openEdit(popup)}
                  title="편집"
                  className="p-2 rounded-lg hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(popup.id)}
                  title="삭제"
                  className="p-2 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 팝업 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">
                {editId ? "팝업 수정" : "새 팝업 등록"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-text-muted hover:text-text-primary"
                title="닫기"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  제목 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  placeholder="팝업 제목"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">내용</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={3}
                  placeholder="팝업 내용 (선택사항)"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">이미지 URL</label>
                <input
                  type="text"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                />
                {form.image_url && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-border max-h-40">
                    <img
                      src={form.image_url}
                      alt="미리보기"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">링크 URL</label>
                <input
                  type="text"
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  placeholder="클릭 시 이동할 URL (선택사항)"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">시작일</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    aria-label="팝업 시작일"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">종료일</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    aria-label="팝업 종료일"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-secondary">활성화</span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors"
                >
                  {editId ? "수정" : "등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
