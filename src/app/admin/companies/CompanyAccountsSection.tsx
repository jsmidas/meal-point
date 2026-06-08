"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Power, Trash2, UserPlus } from "lucide-react";

interface Account {
  id: string;
  login_id: string | null;
  name: string;
  is_active: boolean;
  company_id: string | null;
  created_at: string;
}

interface Props {
  companyId: string;
}

/** 거래처 편집 모달 내부 — 이 거래처에 연결된 발주 계정 관리. */
export default function CompanyAccountsSection({ companyId }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ login_id: "", password: "", name: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/accounts?company_id=${companyId}`);
    const data = await res.json();
    if (data.ok) setAccounts(data.accounts);
    else setError(data.error || "목록을 불러오지 못했습니다.");
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setError(data.error || "처리에 실패했습니다.");
      return false;
    }
    return true;
  }

  async function handleCreate() {
    if (!form.login_id || !form.password || !form.name) {
      setError("아이디, 비밀번호, 담당자명을 모두 입력하세요.");
      return;
    }
    const ok = await post({ action: "create", company_id: companyId, ...form });
    if (ok) {
      setForm({ login_id: "", password: "", name: "" });
      setAdding(false);
      load();
    }
  }

  async function handleToggle(a: Account) {
    if (await post({ action: "toggle_active", id: a.id, is_active: !a.is_active })) load();
  }

  async function handleReset(a: Account) {
    const pw = prompt(`'${a.login_id}' 계정의 새 비밀번호 (4자 이상)`);
    if (!pw) return;
    if (await post({ action: "reset_password", id: a.id, password: pw })) {
      alert("비밀번호가 변경되었습니다.");
    }
  }

  async function handleDelete(a: Account) {
    if (!confirm(`'${a.login_id}' 발주 계정을 삭제하시겠습니까?`)) return;
    if (await post({ action: "delete", id: a.id })) load();
  }

  return (
    <div className="rounded-xl border border-border bg-bg-dark/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <UserPlus size={16} className="text-primary" />
          발주 계정
          <span className="text-xs font-normal text-text-muted">
            이 거래처가 직접 발주할 수 있는 로그인 계정
          </span>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setError(null);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            <Plus size={14} /> 계정 발급
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {adding && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg border border-border bg-bg-card p-3">
          <input
            type="text"
            placeholder="아이디 (4자+)"
            value={form.login_id}
            onChange={(e) => setForm({ ...form, login_id: e.target.value })}
            className="px-3 py-2 rounded-lg border border-border bg-bg-dark text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
          <input
            type="text"
            placeholder="비밀번호 (4자+)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="px-3 py-2 rounded-lg border border-border bg-bg-dark text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
          <input
            type="text"
            placeholder="담당자명"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2 rounded-lg border border-border bg-bg-dark text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
          <div className="sm:col-span-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setForm({ login_id: "", password: "", name: "" });
              }}
              className="px-3 py-1.5 rounded-lg border border-border text-text-secondary text-xs hover:bg-bg-card-hover transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-primary text-bg-dark text-xs font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              발급
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-text-muted py-2">불러오는 중...</p>
      ) : accounts.length === 0 ? (
        <p className="text-xs text-text-muted py-2">
          발급된 발주 계정이 없습니다.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <span className="font-mono text-sm text-text-primary">{a.login_id}</span>
                <span className="ml-2 text-xs text-text-secondary">{a.name}</span>
                <span
                  className={`ml-2 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                    a.is_active
                      ? "bg-emerald-400/10 text-emerald-400"
                      : "bg-red-400/10 text-red-400"
                  }`}
                >
                  {a.is_active ? "활성" : "비활성"}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggle(a)}
                  title={a.is_active ? "비활성화" : "활성화"}
                  className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-bg-card-hover transition-colors"
                >
                  <Power size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleReset(a)}
                  title="비밀번호 초기화"
                  className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-bg-card-hover transition-colors"
                >
                  <KeyRound size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(a)}
                  title="삭제"
                  className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-bg-card-hover transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
