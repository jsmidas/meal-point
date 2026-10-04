"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Clock, FileText, Upload, XCircle } from "lucide-react";

interface Member {
  id: string;
  login_id: string | null;
  name: string;
  company_name: string | null;
  biz_number: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  approval_status: string;
  linked_company_name: string | null;
  has_cert: boolean;
  cert_url: string | null;
  approval_requested_at: string | null;
  approved_at: string | null;
  reject_reason: string | null;
}

const STATUS: Record<string, { label: string; cls: string; icon: React.ElementType; desc: string }> = {
  approved: { label: "승인 완료", cls: "bg-emerald-400/10 text-emerald-400", icon: BadgeCheck, desc: "승인된 업체입니다. 상품마다 귀사에 적용되는 단가가 표시됩니다." },
  pending: { label: "승인 대기", cls: "bg-amber-400/10 text-amber-400", icon: Clock, desc: "관리자가 사업자등록증을 확인하는 중입니다. 승인되면 업체 단가가 표시됩니다." },
  rejected: { label: "승인 거절", cls: "bg-red-400/10 text-red-400", icon: XCircle, desc: "승인이 거절되었습니다. 내용을 보완해 다시 요청해 주세요." },
  none: { label: "미신청", cls: "bg-bg-card text-text-muted", icon: Clock, desc: "업체 정보와 사업자등록증을 올리고 승인을 요청하면 업체 단가를 볼 수 있습니다." },
};

export default function AccountPage() {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [form, setForm] = useState({ company_name: "", biz_number: "", name: "", phone: "", email: "" });
  const [cert, setCert] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/account", { cache: "no-store" });
    if (res.status === 401) { router.push("/login?next=/account"); return; }
    const data = await res.json();
    if (data.ok) {
      const m: Member = data.member;
      setMember(m);
      setForm({ company_name: m.company_name || "", biz_number: m.biz_number || "", name: m.name || "", phone: m.phone || "", email: m.email || "" });
    } else {
      setError(data.error || "정보를 불러오지 못했습니다.");
    }
    setLoading(false);
  }
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setDone("");
    if (!form.company_name.trim()) { setError("업체명을 입력하세요."); return; }
    if (!cert && !member?.has_cert) { setError("사업자등록증 파일을 올려주세요."); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (cert) fd.append("cert", cert);
      const res = await fetch("/api/account", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) {
        setDone(data.approval_status === "approved" ? "업체 정보를 저장했습니다." : "승인 요청을 보냈습니다. 관리자 확인 후 승인됩니다.");
        setCert(null);
        await load();
      } else setError(data.error || "저장에 실패했습니다.");
    } catch { setError("서버 연결에 실패했습니다."); }
    finally { setSaving(false); }
  }

  const status = STATUS[member?.approval_status || "none"] || STATUS.none;
  const StatusIcon = status.icon;
  const isApproved = member?.approval_status === "approved";

  return (
    <div className="min-h-screen bg-bg-dark">
      <nav className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft size={18} /><span className="text-sm">홈으로</span>
          </Link>
          <span className="text-lg font-bold text-text-primary">내 정보 · 업체 승인</span>
          <div className="w-16" />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {loading ? (
          <div className="text-center py-20 text-text-muted">로딩 중...</div>
        ) : !member ? (
          <div className="text-center py-20 text-red-400">{error || "정보를 불러오지 못했습니다."}</div>
        ) : (
          <>
            {/* 상태 카드 */}
            <div className={`rounded-2xl border p-6 mb-8 ${isApproved ? "border-emerald-400/40" : "border-border"} bg-bg-card`}>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${status.cls}`}>
                  <StatusIcon size={16} /> {status.label}
                </span>
                {isApproved && member.linked_company_name && (
                  <span className="text-lg font-bold text-text-primary">{member.linked_company_name}</span>
                )}
                <span className="text-sm text-text-muted">{member.name}님{member.login_id ? ` (${member.login_id})` : ""}</span>
              </div>
              <p className="text-sm text-text-secondary">{status.desc}</p>
              {member.approval_status === "rejected" && member.reject_reason && (
                <p className="mt-2 text-sm text-red-400">사유: {member.reject_reason}</p>
              )}
              {member.approval_status === "pending" && member.approval_requested_at && (
                <p className="mt-2 text-xs text-text-muted">요청일: {new Date(member.approval_requested_at).toLocaleString("ko-KR")}</p>
              )}
              {isApproved && (
                <Link href="/products" className="inline-flex items-center mt-4 px-5 py-2 rounded-full bg-primary text-bg-dark text-sm font-semibold hover:bg-primary-dark transition-colors">
                  업체 단가로 제품 보기 →
                </Link>
              )}
            </div>

            {/* 업체 정보 + 사업자등록증 */}
            <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-bg-card p-6 space-y-4">
              <h2 className="text-base font-semibold text-text-primary">업체 정보</h2>
              {error && <div className="px-4 py-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-sm">{error}</div>}
              {done && <div className="px-4 py-3 rounded-xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-sm">{done}</div>}

              <div className="grid sm:grid-cols-2 gap-4">
                {([
                  ["company_name", "업체명", true, "사업자등록증상의 상호"],
                  ["biz_number", "사업자등록번호", false, "123-45-67890"],
                  ["name", "담당자 이름", true, ""],
                  ["phone", "연락처", false, "010-0000-0000"],
                  ["email", "이메일", false, ""],
                ] as [keyof typeof form, string, boolean, string][]).map(([key, label, required, ph]) => (
                  <div key={key} className={key === "email" ? "sm:col-span-2" : ""}>
                    <label className="block text-sm text-text-secondary mb-1">{label}{required && <span className="text-red-400 ml-1">*</span>}</label>
                    <input
                      type="text"
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      required={required}
                      placeholder={ph}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  사업자등록증 {!member.has_cert && <span className="text-red-400 ml-1">*</span>}
                </label>
                {member.has_cert && member.cert_url && (
                  <p className="text-sm mb-2">
                    <a href={member.cert_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                      <FileText size={15} /> 올려둔 사업자등록증 보기
                    </a>
                    <span className="text-text-muted text-xs ml-2">새 파일을 올리면 교체됩니다.</span>
                  </p>
                )}
                <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border bg-bg-dark cursor-pointer hover:border-primary transition-colors">
                  {cert ? <FileText size={18} className="text-primary shrink-0" /> : <Upload size={18} className="text-text-muted shrink-0" />}
                  <span className={`text-sm truncate ${cert ? "text-text-primary" : "text-text-muted"}`}>
                    {cert ? `${cert.name} (${(cert.size / 1024 / 1024).toFixed(1)}MB)` : "이미지(JPG/PNG) 또는 PDF, 10MB 이하"}
                  </span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => setCert(e.target.files?.[0] || null)} />
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {saving ? "처리 중..." : isApproved ? "업체 정보 저장" : member.approval_status === "pending" ? "정보 수정 후 다시 요청" : "승인 요청"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
