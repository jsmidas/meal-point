"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Company } from "@/lib/supabase/types";
import {
  FileText,
  KeyRound,
  Plus,
  Power,
  Search,
  Trash2,
  UserCheck,
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

interface PendingMember {
  id: string;
  login_id: string | null;
  name: string;
  company_name: string | null;
  biz_number: string | null;
  phone: string | null;
  email: string | null;
  approval_status: string;
  biz_cert_path: string | null;
  approval_requested_at: string | null;
  reject_reason: string | null;
  provider: string;
}

const NEW_COMPANY = "__new__";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pending, setPending] = useState<PendingMember[]>([]);
  const [approveChoice, setApproveChoice] = useState<Record<string, string>>({});
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

  const loadPending = useCallback(async () => {
    const res = await fetch("/api/admin/accounts?pending=1");
    const data = await res.json();
    if (data.ok) setPending(data.members);
  }, []);

  useEffect(() => {
    loadAccounts();
    loadCompanies();
    loadPending();
  }, [loadAccounts, loadCompanies, loadPending]);

  async function viewCert(m: PendingMember) {
    const res = await fetch(`/api/admin/accounts?cert=${m.id}`);
    const data = await res.json();
    if (data.ok && data.url) window.open(data.url, "_blank", "noopener");
    else setError(data.error || "사업자등록증을 열 수 없습니다.");
  }

  async function handleApprove(m: PendingMember) {
    const choice = approveChoice[m.id] ?? NEW_COMPANY;
    const target = choice === NEW_COMPANY ? `새 거래처 '${m.company_name}'을(를) 만들어` : `거래처 '${companies.find((c) => c.id === choice)?.name}'에`;
    if (!confirm(`${m.company_name || m.name} 회원을 ${target} 연결하고 승인합니다.\n승인하면 이 회원은 상품마다 해당 거래처 단가를 보게 됩니다.`)) return;
    const ok = await post(
      choice === NEW_COMPANY ? { action: "approve", id: m.id, create_company: true } : { action: "approve", id: m.id, company_id: choice },
    );
    if (ok) {
      loadPending();
      loadAccounts();
      if (choice === NEW_COMPANY) loadCompanies();
    }
  }

  async function handleReject(m: PendingMember) {
    const reason = prompt(`'${m.company_name || m.name}' 승인을 거절합니다. 사유(회원에게 표시됨, 생략 가능):`);
    if (reason === null) return;
    if (await post({ action: "reject", id: m.id, reason })) loadPending();
  }

  const pendingOnly = pending.filter((m) => m.approval_status === "pending");
  const rejectedOnly = pending.filter((m) => m.approval_status === "rejected");

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

      {/* 가입 승인 대기 */}
      <div className="mb-8 rounded-2xl border border-amber-400/30 bg-bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
            <UserCheck size={16} className="text-amber-400" /> 가입 승인 대기
            <span className="inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1.5 rounded-full bg-amber-400 text-bg-dark text-[11px] font-bold">{pendingOnly.length}</span>
          </h2>
          <span className="text-xs text-text-muted">홈페이지에서 회원가입한 업체 — 사업자등록증 확인 후 거래처에 연결해 승인하세요.</span>
        </div>
        {pendingOnly.length === 0 && rejectedOnly.length === 0 ? (
          <p className="px-5 py-6 text-sm text-text-muted">승인 대기 중인 가입 요청이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 text-text-secondary font-medium">업체명</th>
                  <th className="text-left px-4 py-2.5 text-text-secondary font-medium">사업자번호</th>
                  <th className="text-left px-4 py-2.5 text-text-secondary font-medium">담당자 / 아이디</th>
                  <th className="text-left px-4 py-2.5 text-text-secondary font-medium">연락처</th>
                  <th className="text-left px-4 py-2.5 text-text-secondary font-medium">요청일</th>
                  <th className="text-left px-4 py-2.5 text-text-secondary font-medium">등록증</th>
                  <th className="text-left px-4 py-2.5 text-text-secondary font-medium">연결 거래처</th>
                  <th className="text-right px-4 py-2.5 text-text-secondary font-medium">처리</th>
                </tr>
              </thead>
              <tbody>
                {[...pendingOnly, ...rejectedOnly].map((m) => (
                  <tr key={m.id} className={`border-b border-border ${m.approval_status === "rejected" ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 font-semibold text-text-primary">
                      {m.company_name || <span className="text-text-muted font-normal">(미입력)</span>}
                      {m.approval_status === "rejected" && <span className="ml-2 text-[11px] text-red-400">거절됨</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-text-secondary">{m.biz_number || "-"}</td>
                    <td className="px-4 py-3 text-text-secondary">{m.name}<span className="text-text-muted"> / {m.login_id || m.provider}</span></td>
                    <td className="px-4 py-3 text-text-secondary">{m.phone || "-"}{m.email && <span className="block text-xs text-text-muted">{m.email}</span>}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{m.approval_requested_at ? new Date(m.approval_requested_at).toLocaleDateString("ko-KR") : "-"}</td>
                    <td className="px-4 py-3">
                      {m.biz_cert_path ? (
                        <button onClick={() => viewCert(m)} className="inline-flex items-center gap-1 text-primary hover:underline">
                          <FileText size={14} /> 보기
                        </button>
                      ) : (
                        <span className="text-xs text-red-400">미제출</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={approveChoice[m.id] ?? NEW_COMPANY}
                        onChange={(e) => setApproveChoice({ ...approveChoice, [m.id]: e.target.value })}
                        aria-label="연결할 거래처"
                        className="px-3 py-1.5 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary max-w-[220px]"
                      >
                        <option value={NEW_COMPANY}>새 거래처로 등록 ({m.company_name || "업체명 없음"})</option>
                        {sellableCompanies.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleApprove(m)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/90 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50"
                      >
                        승인
                      </button>
                      {m.approval_status !== "rejected" && (
                        <button
                          onClick={() => handleReject(m)}
                          disabled={busy}
                          className="ml-1.5 px-3 py-1.5 rounded-lg border border-red-400/40 text-red-400 text-xs font-semibold hover:bg-red-400/10 transition-colors disabled:opacity-50"
                        >
                          거절
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
