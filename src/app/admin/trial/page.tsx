"use client";

import { useEffect, useState, useCallback } from "react";
import { dbInsert, dbUpdate, dbDelete } from "@/lib/db";
import { KeyRound, Plus, Trash2, RotateCcw, Loader2, Users } from "lucide-react";

export const dynamic = "force-dynamic";

type GuestAccount = {
  id: string;
  login_id: string;
  login_pw: string;
  label: string | null;
  status: string; // available | assigned
  is_active: boolean;
  created_at: string;
};

type Grant = {
  id: string;
  guest_account_id: string | null;
  granted_at: string;
  expires_at: string;
  status: string;
  members?: { name: string; email: string | null } | null;
  meal_guest_accounts?: { login_id: string; label: string | null } | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function TrialAdminPage() {
  const [accounts, setAccounts] = useState<GuestAccount[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);

  // 신규 계정 입력
  const [newId, setNewId] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/trial/admin");
    if (res.ok) {
      const d = await res.json();
      setAccounts(d.accounts || []);
      setGrants(d.grants || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newId.trim() || !newPw.trim()) {
      alert("아이디와 비밀번호를 입력하세요.");
      return;
    }
    setAdding(true);
    await dbInsert("meal_guest_accounts", {
      login_id: newId.trim(),
      login_pw: newPw.trim(),
      label: newLabel.trim() || null,
    });
    setNewId("");
    setNewPw("");
    setNewLabel("");
    setAdding(false);
    fetchData();
  }

  async function toggleActive(acc: GuestAccount) {
    await dbUpdate("meal_guest_accounts", { is_active: !acc.is_active }, { id: acc.id });
    fetchData();
  }

  async function deleteAccount(acc: GuestAccount) {
    if (acc.status === "assigned" && !window.confirm("현재 배정 중인 계정입니다. 그래도 삭제하시겠습니까?")) return;
    if (!window.confirm(`게스트 계정 "${acc.login_id}"을(를) 삭제하시겠습니까?`)) return;
    await dbDelete("meal_guest_accounts", { id: acc.id });
    fetchData();
  }

  // 수동 회수: 사용권 revoked + 계정 available 복귀
  async function revokeGrant(grant: Grant) {
    if (!window.confirm(`${grant.members?.name || "회원"}님의 체험을 회수하시겠습니까?`)) return;
    await dbUpdate("meal_trial_grants", { status: "revoked" }, { id: grant.id });
    if (grant.guest_account_id) {
      await dbUpdate("meal_guest_accounts", { status: "available" }, { id: grant.guest_account_id });
    }
    fetchData();
  }

  const availableCount = accounts.filter((a) => a.is_active && a.status === "available").length;
  const assignedCount = accounts.filter((a) => a.status === "assigned").length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <KeyRound className="text-primary" size={24} />
        <h1 className="text-2xl font-bold text-text-primary">체험 관리</h1>
        <span className="text-sm text-text-muted">식단·급식관리 프로그램 게스트 체험</span>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">전체 계정</p>
          <p className="text-xl font-bold text-text-primary">{accounts.length}개</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">사용 가능</p>
          <p className="text-xl font-bold text-emerald-400">{availableCount}개</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">배정 중</p>
          <p className="text-xl font-bold text-yellow-400">{assignedCount}개</p>
        </div>
      </div>

      {/* 계정 추가 */}
      <form onSubmit={addAccount} className="rounded-2xl border border-border bg-bg-card p-5 mb-6">
        <p className="text-sm font-semibold text-text-primary mb-3">게스트 계정 추가</p>
        <div className="flex flex-wrap gap-3">
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="외부 프로그램 아이디"
            className="flex-1 min-w-[160px] px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary text-sm"
          />
          <input
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="비밀번호"
            className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary text-sm"
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="메모 (선택)"
            className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary text-sm"
          />
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            <Plus size={16} /> 추가
          </button>
        </div>
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-text-muted">
          <Loader2 className="animate-spin mr-2" size={20} /> 로딩 중...
        </div>
      ) : (
        <>
          {/* 계정 풀 */}
          <div className="rounded-2xl border border-border bg-bg-card overflow-hidden mb-8">
            <div className="px-5 py-3 border-b border-border bg-bg-dark/40 text-sm font-semibold text-text-primary">
              게스트 계정 풀
            </div>
            {accounts.length === 0 ? (
              <p className="px-5 py-8 text-center text-text-muted text-sm">등록된 게스트 계정이 없습니다. 위에서 추가하세요.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-muted border-b border-border">
                    <th className="px-5 py-2.5 font-medium">아이디</th>
                    <th className="px-5 py-2.5 font-medium">비밀번호</th>
                    <th className="px-5 py-2.5 font-medium">메모</th>
                    <th className="px-5 py-2.5 font-medium">상태</th>
                    <th className="px-5 py-2.5 font-medium text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="border-b border-border/50 last:border-0">
                      <td className="px-5 py-3 font-mono text-text-primary">{acc.login_id}</td>
                      <td className="px-5 py-3 font-mono text-text-secondary">{acc.login_pw}</td>
                      <td className="px-5 py-3 text-text-secondary">{acc.label || "-"}</td>
                      <td className="px-5 py-3">
                        {!acc.is_active ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-text-muted/15 text-text-muted">비활성</span>
                        ) : acc.status === "assigned" ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">배정 중</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">사용 가능</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => toggleActive(acc)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition-colors"
                          >
                            {acc.is_active ? "비활성화" : "활성화"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAccount(acc)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
                            title="삭제"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 현재 배정 현황 */}
          <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-bg-dark/40 text-sm font-semibold text-text-primary flex items-center gap-2">
              <Users size={15} /> 현재 체험 중 ({grants.length}명)
            </div>
            {grants.length === 0 ? (
              <p className="px-5 py-8 text-center text-text-muted text-sm">진행 중인 체험이 없습니다.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-muted border-b border-border">
                    <th className="px-5 py-2.5 font-medium">회원</th>
                    <th className="px-5 py-2.5 font-medium">배정 계정</th>
                    <th className="px-5 py-2.5 font-medium">시작</th>
                    <th className="px-5 py-2.5 font-medium">만료</th>
                    <th className="px-5 py-2.5 font-medium text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {grants.map((g) => (
                    <tr key={g.id} className="border-b border-border/50 last:border-0">
                      <td className="px-5 py-3 text-text-primary">
                        {g.members?.name || "(알 수 없음)"}
                        {g.members?.email && <span className="text-xs text-text-muted ml-1">{g.members.email}</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-text-secondary">{g.meal_guest_accounts?.login_id || "-"}</td>
                      <td className="px-5 py-3 text-text-muted">{formatDate(g.granted_at)}</td>
                      <td className="px-5 py-3 text-text-secondary">{formatDate(g.expires_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => revokeGrant(g)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-border text-text-secondary hover:text-red-400 hover:border-red-400/40 transition-colors"
                        >
                          <RotateCcw size={13} /> 회수
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
