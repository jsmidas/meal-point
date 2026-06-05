"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { FileText, Loader2 } from "lucide-react";
import type { StatementWithItems, CompanyInfo } from "@/lib/supabase/types";
import DeliveryReceiptPdf from "./DeliveryReceiptPdf";

interface Props {
  statement: StatementWithItems;
  companyInfo: CompanyInfo | null;
}

export default function ReceiptOpenButton({ statement, companyInfo }: Props) {
  const [generating, setGenerating] = useState(false);

  async function handleOpen() {
    setGenerating(true);
    try {
      const blob = await pdf(
        <DeliveryReceiptPdf statement={statement} companyInfo={companyInfo} />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      // 새 탭에서 인수증 PDF 바로 열기 (탭에서 인쇄/저장 가능)
      const win = window.open(url, "_blank");
      if (!win) {
        // 팝업 차단 시 다운로드로 폴백
        const a = document.createElement("a");
        a.href = url;
        a.download = `${statement.statement_number}_인수증.pdf`;
        a.click();
      }
      // 새 탭이 PDF를 로드할 시간을 준 뒤 해제
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("인수증 PDF 생성 실패:", err);
      alert("인수증 PDF 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      onClick={handleOpen}
      disabled={generating}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-400/30 font-semibold text-sm hover:bg-amber-500/20 transition-colors disabled:opacity-50"
    >
      {generating ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <FileText size={16} />
      )}
      {generating ? "생성 중..." : "인수증 (배송기사용)"}
    </button>
  );
}
