"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Company } from "@/lib/supabase/types";
import {
  KeyRound,
  Plus,
  Power,
  Search,
  Trash2,
  Users,
} from "lucide-react";

interface Account {
  id: string;
  login_id: string | null;
  name: string;
  is_active: boolean;
  company_id: string | null;
  created_at: string;
  companies: { name: string } | null;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    login_id: "",
    password: "",
    name: "",
    company_id: "",
  });

  const supabase = createClient();

  // 발주 계정 발급 대상 거래처 (판매처/양쪽)
  const sellableCompanies = useMemo(
    () =>
      companies.filter((c) => {
        const ct = (c as unknown as { company_type?: string }).company_type || "customer";
        return ct === "customer" || ct === "both";
      }),
    [companies],
  );

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/accounts");
    const data = await res.json();
    if (data.ok) setAccounts(data.accounts);
    else setError(data.error || "목록을 불러오지 못했습니다.");
    setLoading(false);
  }, []);

  const loadCompanies = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .order("name");
    setCompanies(data || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAccounts();
    loadCompanies();
  }, [loadAccounts, loadCompanies]);

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
    if (!form.login_id || !form.password || !form.name || !form.company_id) {
      setError("아이디, 비밀번호, 담당자명, 거래처를 모두 입력하세요.");
      return;
    }
    if (await post({ action: "create", ...form })) {
      setForm({ login_id: "", password: "", name: "", company_id: "" });
      setAdding(false);
      loadAccounts();
    }
  }

  async function handleChangeCompany(a: Account, company_id: string) {
    if (await post({ action: "update", id: a.id, company_id })) loadAccounts();
  }

  async function handleToggle(a: Account) {
    if (await post({ action: "toggle_active", id: a.id, is_active: !a.is_active }))
      loadAccounts();
  }

  async function handleReset(a: Account) {
    const pw = prompt(`'${a.login_id}' 계정의 새 비밀번호 (4자 이상)`);
    if (!pw) return;
    if (await post({ action: "reset_password", id: a.id, password: pw }))
      alert("비밀번호가 변경되었습니다.");
  }

  async function handleDelete(a: Account) {
    if (!confirm(`'${a.login_id}' 발주 계정을 삭제하시겠습니까?`)) return;
    if (await post({ action: "delete", id: a.id })) loadAccounts();
  }

  const filtered = accounts.filter((a) => {
    const q = search.trim();
    if (!q) return true;
    return (
      (a.login_id || "").includes(q) ||
      a.name.includes(q) ||
      (a.companies?.name || "").includes(q)
    );
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">발주 계정 관리</h1>
          <p className="text-sm text-text-muted mt-1">
            거래처가 직접 발주할 수 있는 로그인 계정과 연결 거래처를 관리합니다.
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => {
              setAdding(true);
              setError(null);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
          >
            <Plus size={18} /> 계정 발급
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 발급 폼 */}
      {adding && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-2xl border border-border bg-bg-card p-4">
          <input
            type="text"
            placeholder="아이디 (4자+)"
            value={form.login_id}
            onChange={(e) => setForm({ ...form, login_id: e.target.value })}
            className="px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
          <input
            type="text"
            placeholder="비밀번호 (4자+)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
          <input
            type="text"
            placeholder="담당자명"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
          <select
            value={form.company_id}
            onChange={(e) => setForm({ ...form, company_id: e.target.value })}
            aria-label="연결 거래처 선택"
            className="px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-sm text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="">거래처 선택...</option>
            {sellableCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
            <button
              onClick={() => {
                setAdding(false);
                setForm({ login_id: "", password: "", name: "", company_id: "" });
              }}
              className="px-4 py-2 rounded-xl border border-border text-text-secondary text-sm hover:bg-bg-card-hover transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleCreate}
              disabled={busy}
              className="px-5 py-2 rounded-xl bg-primary text-bg-dark text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              발급
            </button>
          </div>
        </div>
      )}

      {/* 검색 */}
      <div className="relative mb-6">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          placeholder="아이디, 담당자, 거래처 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">
            {search ? "검색 결과가 없습니다." : "발급된 발주 계정이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left px-4 py-3 text-text-secondary font-medium">아이디</th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">담당자</th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">연결 거래처</th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">상태</th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-border hover:bg-bg-card-hover transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-text-primary">{a.login_id}</td>
                  <td className="px-4 py-3 text-text-secondary">{a.name}</td>
                  <td className="px-4 py-3">
                    <select
                      value={a.company_id || ""}
                      onChange={(e) => handleChangeCompany(a, e.target.value)}
                      aria-label="연결 거래처 변경"
                      className="px-3 py-1.5 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                    >
                      {!a.company_id && <option value="">미지정</option>}
                      {sellableCompanies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.is_active
                          ? "bg-emerald-400/10 text-emerald-400"
                          : "bg-red-400/10 text-red-400"
                      }`}
                    >
                      {a.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggle(a)}
                        title={a.is_active ? "비활성화" : "활성화"}
                        className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-bg-card transition-colors"
                      >
                        <Power size={16} />
                      </button>
                      <button
                        onClick={() => handleReset(a)}
                        title="비밀번호 초기화"
                        className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-bg-card transition-colors"
                      >
                        <KeyRound size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(a)}
                        title="삭제"
                        className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-bg-card transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
