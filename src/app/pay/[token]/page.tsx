"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { CreditCard, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

type Info = {
  order_name: string;
  amount: number;
  customer_name: string | null;
  status: string;
  toss_order_id: string;
  client_key: string;
};

function formatNumber(n: number) {
  return n.toLocaleString("ko-KR");
}

export default function PayPage() {
  const params = useParams();
  const token = params.token as string;

  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/payments/${token}`);
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const json = await res.json();
      setInfo(json.data);
      setLoading(false);
    })();
  }, [token]);

  async function handlePay() {
    if (!info || paying) return;
    setError("");
    if (!info.client_key) {
      setError("결제 모듈이 설정되지 않았습니다. 판매자에게 문의하세요.");
      return;
    }
    setPaying(true);
    try {
      const tossPayments = await loadTossPayments(info.client_key);
      const payment = tossPayments.payment({ customerKey: ANONYMOUS });
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: info.amount },
        orderId: info.toss_order_id,
        orderName: info.order_name,
        successUrl: `${window.location.origin}/pay/${token}/success`,
        failUrl: `${window.location.origin}/pay/${token}/fail`,
        customerName: info.customer_name || undefined,
        card: {
          useEscrow: false,
          flowMode: "DEFAULT",
          useCardPoint: false,
          useAppCardOnly: false,
        },
      });
    } catch (e: unknown) {
      // 사용자가 결제창을 닫은 경우 등
      const msg = e instanceof Error ? e.message : "결제를 진행할 수 없습니다.";
      setError(msg);
      setPaying(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-bg-card p-8">
        {loading ? (
          <p className="text-center text-text-muted py-10">불러오는 중...</p>
        ) : notFound ? (
          <Centered
            icon={<AlertTriangle className="text-red-400" size={48} />}
            title="결제 정보를 찾을 수 없습니다"
            desc="링크가 올바른지 확인하거나 판매자에게 문의해 주세요."
          />
        ) : info?.status === "paid" ? (
          <Centered
            icon={<CheckCircle2 className="text-emerald-400" size={48} />}
            title="이미 결제가 완료되었습니다"
            desc={`${info.order_name} · ${formatNumber(info.amount)}원`}
          />
        ) : info?.status === "canceled" ? (
          <Centered
            icon={<AlertTriangle className="text-red-400" size={48} />}
            title="취소된 결제 요청입니다"
            desc="판매자에게 문의해 주세요."
          />
        ) : info?.status === "expired" ? (
          <Centered
            icon={<Clock className="text-yellow-400" size={48} />}
            title="만료된 결제 링크입니다"
            desc="판매자에게 새 결제 링크를 요청해 주세요."
          />
        ) : info ? (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <CreditCard className="text-primary" size={22} />
              <h1 className="text-lg font-bold text-text-primary">밀포인트 카드결제</h1>
            </div>

            <div className="rounded-xl bg-bg-dark border border-border p-5 mb-6">
              <p className="text-sm text-text-muted mb-1">상품명</p>
              <p className="text-base font-semibold text-text-primary mb-4">
                {info.order_name}
              </p>
              {info.customer_name && (
                <>
                  <p className="text-sm text-text-muted mb-1">주문자</p>
                  <p className="text-sm text-text-secondary mb-4">{info.customer_name}</p>
                </>
              )}
              <p className="text-sm text-text-muted mb-1">결제 금액</p>
              <p className="text-2xl font-bold text-primary">
                {formatNumber(info.amount)}원
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400 mb-4 text-center">{error}</p>
            )}

            <button
              onClick={handlePay}
              disabled={paying}
              className="w-full py-3.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {paying ? "결제창 여는 중..." : `${formatNumber(info.amount)}원 카드결제`}
            </button>

            <p className="text-xs text-text-muted text-center mt-4">
              토스페이먼츠 보안 결제 · 카드정보는 저장되지 않습니다
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Centered({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="text-center py-8">
      <div className="flex justify-center mb-4">{icon}</div>
      <h1 className="text-lg font-bold text-text-primary mb-2">{title}</h1>
      <p className="text-sm text-text-secondary">{desc}</p>
    </div>
  );
}
