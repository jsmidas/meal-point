# 소셜 로그인 설정 가이드

> **이 문서는 현재 구현 기준입니다.**
> 소셜 로그인은 Supabase Auth Provider가 **아니라**, 앱이 직접 OAuth를 처리하는
> 자체 라우트(`/api/auth/{provider}`)로 구현돼 있습니다.
> - 카카오/구글/네이버 키는 **Supabase 대시보드가 아니라 `.env.local`(및 Vercel 환경변수)** 에 넣습니다.
> - Supabase는 **회원 DB(`members` 테이블)** 로만 쓰입니다. 세션은 자체 쿠키(`mp_admin_token`)입니다.
> - 현재 **운영에서 실제 사용 중인 건 카카오뿐**입니다. 구글·네이버 라우트는 구현돼 있으나 선택사항입니다.

관련 코드:
- 카카오: [`src/app/api/auth/kakao/route.ts`](../src/app/api/auth/kakao/route.ts)
- 구글: [`src/app/api/auth/google/route.ts`](../src/app/api/auth/google/route.ts)
- 네이버: [`src/app/api/auth/naver/route.ts`](../src/app/api/auth/naver/route.ts)
- 회원 조회/생성·세션 발급: [`src/lib/auth/social.ts`](../src/lib/auth/social.ts)

---

## 0. 동작 흐름 (공통)

```
[/trial 등] → "카카오로 로그인" 클릭
   → GET /api/auth/kakao?next=/trial
   → state 쿠키 발급 후 카카오 인증 페이지로 리다이렉트
   → 사용자가 카카오에서 로그인/동의
   → 카카오가 redirect_uri 로 복귀: /api/auth/kakao?action=callback&code=...&state=...
   → 서버가 code 로 토큰 발급 → 프로필 조회
   → members 테이블에서 findOrCreateMember (provider, provider_id 기준)
   → 자체 세션 쿠키(mp_admin_token) 발급 → next 경로로 복귀
```

- **Redirect URI 형식**(모든 provider 공통): `{사이트주소}/api/auth/{provider}?action=callback`
- 콜백 주소의 `{사이트주소}`는 `NEXTAUTH_URL` 환경변수 → 없으면 요청 도메인 순으로 결정됩니다.
  운영에서는 프리뷰 배포 도메인으로 콜백이 새지 않도록 **`NEXTAUTH_URL`을 운영 도메인으로 고정**하는 것을 권장합니다.

---

## 1. 카카오 로그인 설정 (현재 사용 중)

### 1-1. 개발자 앱 준비
1. https://developers.kakao.com → 로그인 → 내 애플리케이션
2. 앱이 없으면 "애플리케이션 추가하기"로 생성 (예: `밀포인트`)
   - 카카오톡 채널을 운영 중이면 **같은 카카오 비즈니스 계정**으로 만들면 관리가 편합니다.

### 1-2. REST API 키 = `KAKAO_CLIENT_ID`
1. 앱 설정 → **플랫폼 키** → **REST API 키**
2. 로그인 전용으로 만든 키(예: "밀포인트 웹")의 REST API 키 값을 사용합니다.
   - 새 콘솔은 키마다 리다이렉트 URI·시크릿을 따로 관리합니다.
     **`KAKAO_CLIENT_ID`와 `KAKAO_CLIENT_SECRET`은 반드시 같은 키의 짝**이어야 합니다.

### 1-3. Client Secret = `KAKAO_CLIENT_SECRET`
1. 해당 키의 **클라이언트 시크릿** → "카카오 로그인" 코드 발급(없으면 생성)
2. **활성화 ON** (비활성 상태면 토큰 발급이 실패)
3. ⚠️ "비즈니스 인증" 코드가 아니라 **"카카오 로그인" 코드**를 써야 합니다.

### 1-4. 카카오 로그인 활성화 + Redirect URI 등록
1. 제품 설정 → 카카오 로그인 → **활성화 ON**
2. **로그인 리다이렉트 URI**에 아래 2개 등록:
   ```
   https://meal-point-ochre.vercel.app/api/auth/kakao?action=callback
   http://localhost:3000/api/auth/kakao?action=callback
   ```

### 1-5. 동의항목
- 닉네임: 필수 아님이어도 됨(없으면 "카카오 사용자"로 대체)
- 이메일: 선택 (이메일 동의를 받으려면 **비즈앱 전환**이 필요할 수 있음)

---

## 2. (선택) 구글 로그인 설정

쓰려면 Google Cloud Console에서 OAuth 클라이언트를 만들고 아래를 등록합니다.
- 승인된 리디렉션 URI:
  ```
  https://meal-point-ochre.vercel.app/api/auth/google?action=callback
  http://localhost:3000/api/auth/google?action=callback
  ```
- 환경변수: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## 3. (선택) 네이버 로그인 설정

https://developers.naver.com → 애플리케이션 등록 → "네이버 로그인" API 사용.
- Callback URL:
  ```
  https://meal-point-ochre.vercel.app/api/auth/naver?action=callback
  http://localhost:3000/api/auth/naver?action=callback
  ```
- 환경변수: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`

---

## 4. 환경변수 정리

### 로컬 — `.env.local`
```env
# 회원 DB (Supabase는 OAuth가 아니라 DB로만 사용)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# 사이트 주소 / OAuth 콜백 도메인 고정
NEXT_PUBLIC_SITE_URL=https://meal-point-ochre.vercel.app
NEXTAUTH_URL=https://meal-point-ochre.vercel.app   # 로컬에서 localhost 테스트만 한다면 생략 가능(요청 도메인 사용)

# 카카오 로그인 (필수)
KAKAO_CLIENT_ID=...          # "밀포인트 웹" REST API 키
KAKAO_CLIENT_SECRET=...      # 같은 키의 "카카오 로그인" 클라이언트 시크릿

# 구글/네이버 (선택)
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# NAVER_CLIENT_ID=
# NAVER_CLIENT_SECRET=
```
> `.env.local`은 `.gitignore`에 걸려 커밋되지 않습니다. 양식은 [`.env.local.example`](../.env.local.example) 참고.

### 운영 — Vercel
Settings → Environment Variables 에 같은 이름으로 등록 후 **Redeploy**.
- `NEXTAUTH_URL`은 **운영 도메인으로 고정**(프리뷰 도메인 콜백 mismatch 방지).
- `NEXT_PUBLIC_` 접두사 변수는 브라우저에 노출됨(의도된 동작 — 시크릿 금지).

---

## 5. 점검 체크리스트

- [ ] 카카오: REST API 키 / Client Secret이 **같은 키의 짝**인가
- [ ] 카카오: Client Secret **활성화 ON** 인가
- [ ] Redirect URI에 운영·로컬 주소 **2개** 모두 등록됐는가 (`?action=callback` 포함)
- [ ] Vercel에 `KAKAO_CLIENT_ID/SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL` 등록 후 **Redeploy** 했는가
- [ ] `/trial`에서 로그인 버튼 클릭 시 KOE006 없이 카카오 인증 화면이 뜨는가
  - 뜨면 redirect_uri·키 연결 정상. 로그인 완료 시 `members`에 회원 자동 생성.

---

## 부록. 체험 사용권 관련 환경변수

소셜 로그인과 함께 쓰이는 식단관리 체험(`/trial`) 관련 값:
- `NEXT_PUBLIC_MEAL_PLAN_TRIAL_URL` — 외부 체험 사이트 주소(미설정 시 `/trial`에서 "문의하기"로 대체)
- `CRON_SECRET` — 체험 사용권 자동 만료 Cron 인증(Vercel Cron이 `Authorization: Bearer`로 전송).
  Vercel에 이 변수를 등록하면 Cron 호출 시 자동으로 헤더에 실립니다. 스케줄은 [`vercel.json`](../vercel.json) 참고.
- `MEAL_PLAN_RESET_WEBHOOK_URL` (선택) — 만료 시 외부 프로그램 게스트 데이터 초기화 웹훅
</content>
</invoke>
