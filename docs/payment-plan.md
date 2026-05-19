# 개인결제(비상품 결제) 페이지 구현 계획

> 카페24 "개인결제" 기능을 자체 사이트(Next.js + Supabase)로 이전
> PG: **토스페이먼츠** / 계약: 신규 가맹 신청부터 시작

---

## 0. 개념 정리

- 상품마다 결제를 붙이는 것이 아니라, 관리자가 **금액·상품명을 직접 입력해 결제 링크를 발급**하고
  거래처가 그 링크로 카드결제하는 방식.
- 카페24 MID는 재사용 불가 → 토스페이먼츠 **일반결제 가맹을 신규 신청**.
- 카드정보는 우리 서버에 절대 저장하지 않음(PCI). PG 결제창이 모든 카드처리를 담당.

---

## 1단계: 토스페이먼츠 가맹 신청 (코드와 병행 가능)

| 항목 | 내용 |
|---|---|
| 신청 | https://www.tosspayments.com → 가입 → 사업자 정보 등록 |
| 필요서류 | 사업자등록증, 대표자 신분증, 정산 통장사본, 홈페이지 URL(Vercel 주소) |
| 심사 | 통상 2~5영업일 |
| 수수료 | 카드 약 2.x%대 (계약 시 확정), 정산 보통 D+2~D+5 |
| 키 발급 | **테스트 키는 가입 즉시 발급** → 계약 심사 중에도 개발/테스트 가능 |

> 핵심: **테스트 clientKey/secretKey 로 전체 개발을 끝내두고**, 계약 승인되면
> 라이브 키로 환경변수만 교체하면 운영 전환 완료.

---

## 2단계: DB 스키마 (supabase/schema-v25.sql)

`payment_requests` 테이블 신설:

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| token | text unique | 공개 결제링크용 추측 불가 토큰 |
| company_id | uuid FK→companies | 거래처(선택) |
| order_name | text | 결제창에 표시될 상품명 |
| amount | integer | 결제 금액(원) |
| customer_name | text | 주문자명 |
| status | text | `pending` / `paid` / `canceled` / `expired` |
| payment_key | text | 토스 결제 식별자(승인 후 기록) |
| toss_order_id | text | 우리가 생성한 주문번호(멱등성 키) |
| method | text | 카드/간편결제 등 결제수단 |
| paid_at | timestamptz | 승인 시각 |
| expires_at | timestamptz | 링크 만료(예: 발급 후 7일) |
| memo | text | 관리자 메모 |
| created_at | timestamptz default now() | |

- RLS: `pending` 상태 조회는 token 기준으로만 허용, 쓰기는 service role(API)만.
- 정산관리(`billings`/`payments`) 연동은 4단계 참고.

---

## 3단계: 라우트 / 파일 구성

| 경로 | 종류 | 역할 |
|---|---|---|
| `/admin/payments` | 관리자 page | 결제건 목록·생성, 링크 복사, 상태 확인, 수동 취소 |
| `/pay/[token]` | 공개 page | 거래처가 여는 결제 페이지, 토스 SDK 결제창 호출 |
| `/pay/[token]/success` | 공개 page | 결제창 redirect 수신 → confirm API 호출 → 완료 화면 |
| `/pay/[token]/fail` | 공개 page | 결제 실패/취소 안내 |
| `/api/payments/create` | route | (관리자) 결제건 생성 + token 발급 |
| `/api/payments/confirm` | route | **결제 승인·금액 검증 (보안 핵심)** |
| `/api/payments/webhook` | route | 토스 비동기 이벤트(가상계좌 입금 등) 수신 |

기존 패턴 재사용: 관리자 페이지는 `force-dynamic`,
Supabase 쿼리는 `as any` 캐스팅, API는 `src/app/api/*` 구조 그대로.

---

## 4단계: 결제 플로우 (토스페이먼츠 SDK v2 기준)

```
[관리자] /admin/payments 에서 금액·상품명 입력
        → POST /api/payments/create
        → payment_requests INSERT (status=pending, token, toss_order_id)
        → 링크 https://meal-point-ochre.vercel.app/pay/{token} 발급
        → 거래처에 카톡/문자 전송

[거래처] /pay/{token} 진입
        → 서버에서 token으로 pending·미만료 확인, 금액 표시
        → @tosspayments/tosspayments-sdk 로 결제창 호출
          (amount, orderId=toss_order_id, orderName, successUrl, failUrl)

[토스]  결제창에서 카드결제 → successUrl 로 redirect
        (paymentKey, orderId, amount 쿼리 전달)

[서버]  /api/payments/confirm
        1) DB에서 toss_order_id 로 조회
        2) ★ DB금액 == 콜백 amount 검증 (위변조 차단)
        3) POST https://api.tosspayments.com/v1/payments/confirm
           Authorization: Basic base64(secretKey + ":")
           body: { paymentKey, orderId, amount }
        4) 응답 성공 → status=paid, payment_key/method/paid_at 기록
        5) (선택) billings/payments 에 입금 반영 → 정산관리 자동 연동

[웹훅]  /api/payments/webhook
        가상계좌 입금완료 등 비동기 상태를 별도 수신해 status 갱신
        (서명 검증 필수, 멱등 처리)
```

### 보안 체크리스트 (반드시)
- 금액은 **항상 서버 DB 값 기준**으로 confirm. 클라이언트가 보낸 amount를 신뢰하지 않음.
- `secretKey`는 서버 환경변수에만(`TOSS_SECRET_KEY`), 절대 클라이언트 노출 금지.
- `clientKey`만 `NEXT_PUBLIC_TOSS_CLIENT_KEY`로 노출.
- token은 추측 불가(UUID/랜덤 32+자), 만료·일회성 처리.
- confirm/webhook은 멱등 처리(중복 호출에도 1건만 paid).

---

## 5단계: 환경변수 (.env.local + Vercel)

```
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxx   # 운영 시 live_ck_xxx
TOSS_SECRET_KEY=test_sk_xxx               # 운영 시 live_sk_xxx (서버 전용)
NEXT_PUBLIC_SITE_URL=https://meal-point-ochre.vercel.app
```

Vercel 대시보드에도 동일 등록. 운영 전환은 키 4개 교체뿐.

---

## 6단계: 작업 순서 (권장)

1. [ ] 토스페이먼츠 가입 → 테스트 키 발급, 가맹 신청서 제출  ← **사용자 작업 (남음)**
2. [x] schema-v25.sql 작성 → types.ts 갱신  *(Supabase 실행은 사용자가 진행)*
3. [x] `/api/payments/create` + `/admin/payments` (생성·링크발급·목록)
4. [x] `/pay/[token]` 결제창 연동
5. [x] `/api/payments/confirm` + success/fail 페이지 (금액검증 포함)
6. [—] `/api/payments/webhook` — 가상계좌 미사용으로 1차 제외
7. [x] 정산관리(billing) 연동 — 결제완료 시 입금 자동 기록
8. [ ] 전체 테스트(성공/실패/중복/만료) → 가맹 승인 후 라이브 키 전환

### 확정된 사양 (사용자 결정)
- 가상계좌(무통장): **미사용** → webhook 제외
- 정산관리: **자동 반영** (거래처 지정 시 해당 월 청구에 card 입금 자동 기록)
- 링크 만료: **기본 7일** (발급 시 변경 가능)
- 환불/부분취소: **1차 제외**

### 사용자가 직접 해야 할 일
1. 토스페이먼츠 가입 → 테스트 `clientKey`/`secretKey` 발급, 가맹 신청서 제출
2. Supabase SQL Editor 에서 `supabase/schema-v25.sql` 실행
3. `.env.local` (및 Vercel 환경변수)에 추가:
   - `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`
4. 가맹 승인 후 키를 `live_*` 로 교체 → 운영 전환 완료

---

## 참고: 카페24 대비 차이

| | 카페24 개인결제 | 자체 구현 |
|---|---|---|
| PG 계약 | 카페24가 중개 | 직접 토스페이먼츠 가맹 |
| 비용 | 카페24 이용료 + 수수료 | PG 수수료만 |
| 확장성 | 카페24 기능 한정 | 정산관리·거래처와 자유 연동 |
| 유지보수 | 카페24 의존 | 우리 코드(이 리포)에서 관리 |

---

## 미결정/확인 필요 사항

- 가상계좌(무통장)도 받을지 → 받으면 webhook 필수
- 결제완료를 정산관리에 자동 반영할지 / 수동 확인 후 반영할지
- 링크 만료 기간(기본 7일 제안)
- 부분취소/환불 기능 필요 여부 (1차 범위에서 제외 가능)
