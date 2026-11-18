/**
 * 토스페이먼츠 서버 사이드 헬퍼.
 * secretKey 는 서버 전용 환경변수(TOSS_SECRET_KEY)에서만 읽는다.
 * 클라이언트에 노출되는 키는 NEXT_PUBLIC_TOSS_CLIENT_KEY 뿐이다.
 */

const TOSS_API = "https://api.tosspayments.com/v1";
const TOSS_TIMEOUT_MS = 20_000;

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

export type TossResult =
  | { ok: true; data: TossConfirmResult }
  | { ok: false; code: string; message: string };

/**
 * 토스 API 호출 공통부.
 * 시간 초과·네트워크 오류·비JSON 응답·키 미설정을 모두 실패 결과로 돌려준다(예외를 던지지 않음).
 */
async function tossRequest(path: string, init: RequestInit): Promise<TossResult> {
  let auth: string;
  try {
    auth = Buffer.from(`${getSecretKey()}:`).toString("base64");
  } catch (err) {
    console.error("[toss]", err instanceof Error ? err.message : err);
    return { ok: false, code: "NOT_CONFIGURED", message: "결제 설정이 완료되지 않았습니다. 판매자에게 문의해 주세요." };
  }

  let res: Response;
  try {
    res = await fetch(`${TOSS_API}${path}`, {
      ...init,
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TOSS_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: "결제사와 통신하지 못했습니다. 잠시 후 다시 확인해 주세요.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    return { ok: false, code: "INVALID_RESPONSE", message: "결제사 응답을 해석하지 못했습니다." };
  }

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

/**
 * 결제 승인. 반드시 서버에서 호출하며, amount 는 우리 DB 값을 그대로 넘긴다.
 */
export async function confirmTossPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<TossResult> {
  return tossRequest("/payments/confirm", { method: "POST", body: JSON.stringify(params) });
}

/**
 * 주문번호로 결제 조회. 승인 요청의 결과를 받지 못했거나(시간 초과) 이미 처리된 결제일 때
 * 실제 결제 상태를 확인하는 데 쓴다.
 */
export async function getTossPaymentByOrderId(orderId: string): Promise<TossResult> {
  return tossRequest(`/payments/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
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
