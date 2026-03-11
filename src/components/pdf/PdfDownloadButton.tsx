"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Download, Loader2 } from "lucide-react";
import type { StatementWithItems, CompanyInfo } from "@/lib/supabase/types";
import StatementPdf from "./StatementPdf";

interface Props {
  statement: StatementWithItems;
  companyInfo: CompanyInfo | null;
}

export default function PdfDownloadButton({ statement, companyInfo }: Props) {
  const [generating, setGenerating] = useState(false);

  async function handleDownload() {
    setGenerating(true);
    try {
      const blob = await pdf(
        <StatementPdf statement={statement} companyInfo={companyInfo} />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${statement.statement_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF 생성 실패:", err);
      alert("PDF 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={generating}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
    >
      {generating ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Download size={16} />
      )}
      {generating ? "생성 중..." : "PDF 다운로드"}
    </button>
  );
}
