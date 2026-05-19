/**
 * 토스페이먼츠 서버 사이드 헬퍼.
 * secretKey 는 서버 전용 환경변수(TOSS_SECRET_KEY)에서만 읽는다.
 * 클라이언트에 노출되는 키는 NEXT_PUBLIC_TOSS_CLIENT_KEY 뿐이다.
 */

const TOSS_API = "https://api.tosspayments.com/v1";

export function getTossClientKey(): string {
  // 테스트 키: test_ck_xxx / 운영 키: live_ck_xxx
  return process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "";
}

function getSecretKey(): string {
  const key = process.env.TOSS_SECRET_KEY;
  if (!key) {
    throw new Error(
      "TOSS_SECRET_KEY 환경 변수가 설정되지 않았습니다. " +
        "토스페이먼츠 개발자센터에서 시크릿 키를 발급받아 .env.local 에 추가하세요.",
    );
  }
  return key;
}

export interface TossConfirmResult {
  paymentKey: string;
  orderId: string;
  status: string; // DONE | CANCELED | ...
  totalAmount: number;
  method: string | null; // 카드 / 간편결제 등
  approvedAt: string | null;
  receipt: { url: string } | null;
}

/**
 * 결제 승인. 반드시 서버에서 호출하며, amount 는 우리 DB 값을 그대로 넘긴다.
 */
export async function confirmTossPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<{ ok: true; data: TossConfirmResult } | { ok: false; code: string; message: string }> {
  const auth = Buffer.from(`${getSecretKey()}:`).toString("base64");

  const res = await fetch(`${TOSS_API}/payments/confirm`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const json = await res.json();

  if (!res.ok) {
    return {
      ok: false,
      code: json?.code || "UNKNOWN",
      message: json?.message || "결제 승인에 실패했습니다.",
    };
  }

  return {
    ok: true,
    data: {
      paymentKey: json.paymentKey,
      orderId: json.orderId,
      status: json.status,
      totalAmount: json.totalAmount,
      method: json.method ?? null,
      approvedAt: json.approvedAt ?? null,
      receipt: json.receipt ?? null,
    },
  };
}

/** Asia/Seoul 기준 YYYY-MM-DD */
export function seoulDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
