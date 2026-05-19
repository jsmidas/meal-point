"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { XCircle, Loader2 } from "lucide-react";

function FailInner() {
  const params = useParams();
  const search = useSearchParams();
  const token = params.token as string;
  const message = search.get("message") || "결제가 취소되었거나 실패했습니다.";

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-bg-card p-8 text-center">
        <XCircle className="mx-auto text-red-400 mb-4" size={48} />
        <h1 className="text-lg font-bold text-text-primary">결제가 완료되지 않았습니다</h1>
        <p className="text-sm text-text-secondary mt-3">{message}</p>
        <Link
          href={`/pay/${token}`}
          className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
        >
          다시 시도하기
        </Link>
      </div>
    </div>
  );
}

export default function PayFailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-dark flex items-center justify-center">
          <Loader2 className="text-primary animate-spin" size={40} />
        </div>
      }
    >
      <FailInner />
    </Suspense>
  );
}
