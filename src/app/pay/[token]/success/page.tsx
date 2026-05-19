"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

function formatNumber(n: number) {
  return n.toLocaleString("ko-KR");
}

function SuccessInner() {
  const params = useParams();
  const search = useSearchParams();
  const token = params.token as string;

  const [state, setState] = useState<"loading" | "ok" | "fail">("loading");
  const [message, setMessage] = useState("");
  const amount = Number(search.get("amount")) || 0;

  useEffect(() => {
    const paymentKey = search.get("paymentKey");
    const orderId = search.get("orderId");
    if (!paymentKey || !orderId) {
      setState("fail");
      setMessage("결제 정보가 올바르지 않습니다.");
      return;
    }
    (async () => {
      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, paymentKey, orderId, amount }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setState("ok");
      } else {
        setState("fail");
        setMessage(json.error || "결제 승인에 실패했습니다.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-bg-card p-8 text-center">
        {state === "loading" && (
          <>
            <Loader2 className="mx-auto text-primary animate-spin mb-4" size={48} />
            <h1 className="text-lg font-bold text-text-primary">결제 승인 중...</h1>
            <p className="text-sm text-text-muted mt-2">잠시만 기다려 주세요.</p>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="mx-auto text-emerald-400 mb-4" size={48} />
            <h1 className="text-lg font-bold text-text-primary">결제가 완료되었습니다</h1>
            <p className="text-2xl font-bold text-primary mt-3">
              {formatNumber(amount)}원
            </p>
            <p className="text-sm text-text-secondary mt-4">
              결제해 주셔서 감사합니다. 영수증은 판매자를 통해 확인하실 수 있습니다.
            </p>
          </>
        )}
        {state === "fail" && (
          <>
            <AlertTriangle className="mx-auto text-red-400 mb-4" size={48} />
            <h1 className="text-lg font-bold text-text-primary">결제 처리 실패</h1>
            <p className="text-sm text-text-secondary mt-3">{message}</p>
            <p className="text-xs text-text-muted mt-4">
              결제가 중복 청구되지 않았으니 안심하시고, 판매자에게 문의해 주세요.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaySuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-dark flex items-center justify-center">
          <Loader2 className="text-primary animate-spin" size={40} />
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
