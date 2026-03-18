"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { StatementWithItems, CompanyInfo } from "@/lib/supabase/types";
import { formatNumber, formatDate } from "@/lib/utils";
import { ArrowLeft, Trash2, Printer } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const PdfDownloadButton = dynamic(
  () => import("@/components/pdf/PdfDownloadButton"),
  { ssr: false },
);

export default function StatementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [statement, setStatement] = useState<StatementWithItems | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      const [stRes, ciRes] = await Promise.all([
        db
          .from("statements")
          .select("*, companies(*), statement_items(*)")
          .eq("id", id)
          .single(),
        db.from("company_info").select("*").limit(1).single(),
      ]);

      setStatement(stRes.data as StatementWithItems | null);
      setCompanyInfo(ciRes.data as CompanyInfo | null);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleDelete() {
    if (!confirm("이 거래명세서를 삭제하시겠습니까?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("statements") as any).delete().eq("id", id);
    router.push("/admin/statements");
  }

  function handlePrint() {
    window.print();
  }

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
        <PdfDownloadButton statement={statement} companyInfo={companyInfo} />
        <button
          onClick={handlePrint}
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
      </div>

      {/* 거래명세서 미리보기 (인쇄용) */}
      <div className="bg-white text-black rounded-2xl border border-border p-8 max-w-4xl mx-auto print:border-none print:rounded-none print:p-4 print:max-w-none">
        {/* 로고 */}
        {companyInfo?.logo_image_url && (
          <div className="flex justify-center mb-4">
            <img src={companyInfo.logo_image_url} alt={companyInfo.name} className="h-16 object-contain" />
          </div>
        )}
        {/* 제목 */}
        <h2 className="text-2xl font-bold text-center mb-8 tracking-widest">
          거 래 명 세 서
        </h2>

        {/* 날짜 & 번호 */}
        <div className="flex justify-between text-sm mb-6">
          <span>작성일: {formatDate(statement.statement_date)}</span>
          <span>No. {statement.statement_number}</span>
        </div>

        {/* 공급자 / 공급받는자 정보 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* 공급자 (밀포인트) */}
          <div className="border border-gray-300 p-4 text-sm">
            <p className="font-bold mb-2 text-center bg-gray-100 py-1">
              공급자
            </p>
            {companyInfo ? (
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="py-1 text-gray-500 w-20">상호</td>
                    <td className="py-1 font-medium">{companyInfo.name}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-gray-500">대표자</td>
                    <td className="py-1">{companyInfo.ceo_name}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-gray-500">사업자번호</td>
                    <td className="py-1">{companyInfo.biz_number}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-gray-500">업태/종목</td>
                    <td className="py-1">
                      {companyInfo.biz_type} / {companyInfo.biz_category}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-gray-500">주소</td>
                    <td className="py-1">{companyInfo.address}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-gray-500">연락처</td>
                    <td className="py-1">{companyInfo.phone}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-gray-400">
                공급자 정보가 등록되지 않았습니다.
              </p>
            )}
          </div>

          {/* 공급받는자 (거래처) */}
          <div className="border border-gray-300 p-4 text-sm">
            <p className="font-bold mb-2 text-center bg-gray-100 py-1">
              공급받는자
            </p>
            <table className="w-full text-xs">
              <tbody>
                <tr>
                  <td className="py-1 text-gray-500 w-20">상호</td>
                  <td className="py-1 font-medium">{c.name}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-500">대표자</td>
                  <td className="py-1">{c.ceo_name}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-500">사업자번호</td>
                  <td className="py-1">{c.biz_number}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-500">업태/종목</td>
                  <td className="py-1">
                    {c.biz_type || "—"} / {c.biz_category || "—"}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-500">주소</td>
                  <td className="py-1">{c.address || "—"}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-500">연락처</td>
                  <td className="py-1">{c.phone || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 금액 요약 */}
        <div className="grid grid-cols-3 border border-gray-300 mb-6 text-center text-sm">
          <div className="py-2 border-r border-gray-300">
            <p className="text-gray-500 text-xs">공급가액</p>
            <p className="font-bold">{formatNumber(statement.supply_amount)}원</p>
          </div>
          <div className="py-2 border-r border-gray-300">
            <p className="text-gray-500 text-xs">세액</p>
            <p className="font-bold">{formatNumber(statement.tax_amount)}원</p>
          </div>
          <div className="py-2">
            <p className="text-gray-500 text-xs">합계금액</p>
            <p className="font-bold text-lg">
              {formatNumber(statement.total_amount)}원
            </p>
          </div>
        </div>

        {/* 품목 테이블 */}
        <table className="w-full border-collapse border border-gray-300 text-sm mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-center w-8">
                No
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left">
                품목
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left">
                규격
              </th>
              <th className="border border-gray-300 px-3 py-2 text-center">
                단위
              </th>
              <th className="border border-gray-300 px-3 py-2 text-right">
                수량
              </th>
              <th className="border border-gray-300 px-3 py-2 text-right">
                단가
              </th>
              <th className="border border-gray-300 px-3 py-2 text-right">
                금액
              </th>
            </tr>
          </thead>
          <tbody>
            {statement.statement_items.map((item, i) => (
              <tr key={item.id}>
                <td className="border border-gray-300 px-3 py-2 text-center text-gray-500">
                  {i + 1}
                </td>
                <td className="border border-gray-300 px-3 py-2">
                  {item.product_name}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-gray-600">
                  {item.specification || "—"}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center">
                  {item.unit}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-right">
                  {formatNumber(item.quantity)}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-right">
                  {formatNumber(item.unit_price)}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-right font-medium">
                  {formatNumber(item.amount)}
                </td>
              </tr>
            ))}
            {/* 빈 행 채우기 (최소 10행) */}
            {Array.from({
              length: Math.max(0, 10 - statement.statement_items.length),
            }).map((_, i) => (
              <tr key={`empty-${i}`}>
                <td className="border border-gray-300 px-3 py-2 text-center text-gray-300">
                  {statement.statement_items.length + i + 1}
                </td>
                <td className="border border-gray-300 px-3 py-2">&nbsp;</td>
                <td className="border border-gray-300 px-3 py-2" />
                <td className="border border-gray-300 px-3 py-2" />
                <td className="border border-gray-300 px-3 py-2" />
                <td className="border border-gray-300 px-3 py-2" />
                <td className="border border-gray-300 px-3 py-2" />
              </tr>
            ))}
          </tbody>
        </table>

        {/* 비고 */}
        {statement.notes && (
          <div className="border border-gray-300 p-3 text-sm mb-4">
            <span className="text-gray-500">비고: </span>
            {statement.notes}
          </div>
        )}

        {/* 하단 안내 */}
        <p className="text-center text-xs text-gray-400 mt-8">
          위 금액을 명세서와 같이 거래합니다.
        </p>
      </div>
    </div>
  );
}
