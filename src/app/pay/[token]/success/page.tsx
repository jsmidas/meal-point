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

  // 결제 승인 요청의 결과
  const [confirmState, setState] = useState<"loading" | "ok" | "fail">("loading");
  const [confirmMessage, setMessage] = useState("");
  const amount = Number(search.get("amount")) || 0;

  // 주소에 결제 정보가 없으면 승인 요청 없이 바로 실패로 안내한다
  const paymentKey = search.get("paymentKey");
  const orderId = search.get("orderId");
  const invalid = !paymentKey || !orderId;
  const state = invalid ? "fail" : confirmState;
  const message = invalid ? "결제 정보가 올바르지 않습니다." : confirmMessage;

  useEffect(() => {
    if (invalid) return;
    (async () => {
      let errorMessage = "결제 승인에 실패했습니다.";
      try {
        const res = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, paymentKey, orderId, amount }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          setState("ok");
          return;
        }
        if (json?.error) errorMessage = json.error;
      } catch {
        errorMessage = "서버와 통신하지 못했습니다.";
      }

      // 승인 요청이 실패로 보여도 실제로는 결제가 끝났을 수 있다(새로고침·중복 탭 등) → 현재 상태를 한 번 더 확인
      try {
        const check = await fetch(`/api/payments/${token}`, { cache: "no-store" });
        const cj = await check.json().catch(() => null);
        if (check.ok && cj?.data?.status === "paid") {
          setState("ok");
          return;
        }
      } catch {
        // 확인 실패 — 아래에서 실패로 안내
      }
      setState("fail");
      setMessage(errorMessage);
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
              결제 여부가 확실하지 않으면 다시 결제하지 마시고, 이 화면을 새로고침하거나
              판매자에게 문의해 주세요.
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
