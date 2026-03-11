# 소셜 로그인 설정 가이드

## 1. Supabase 프로젝트 설정

### 1-1. Supabase 프로젝트 생성 (이미 있으면 스킵)
1. https://supabase.com/dashboard 접속
2. "New Project" 클릭
3. 프로젝트 이름: `mealpoint`
4. 비밀번호 설정 후 생성

### 1-2. API 키 복사
1. Settings > API 메뉴
2. 아래 두 값을 `.env.local` 파일에 입력:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 1-3. Site URL 설정
1. Authentication > URL Configuration
2. Site URL: `http://localhost:3000` (개발) / 배포 후 실제 도메인으로 변경
3. Redirect URLs에 추가:
   - `http://localhost:3000/auth/callback`
   - `https://your-domain.com/auth/callback` (배포 후)

---

## 2. 카카오 로그인 설정

### 2-1. 카카오 개발자 앱 등록
1. https://developers.kakao.com 접속 → 로그인
2. "내 애플리케이션" → "애플리케이션 추가하기"
3. 앱 이름: `밀포인트`

### 2-2. 카카오 앱 키 확인
1. 앱 선택 → "앱 키" 메뉴
2. **REST API 키** 복사 (= Client ID)

### 2-3. 카카오 로그인 활성화
1. "제품 설정" → "카카오 로그인" → 활성화 ON
2. "Redirect URI" 추가:
   - `https://xxxxxxxx.supabase.co/auth/v1/callback`
   - (xxxxxxxx = Supabase 프로젝트 ID)

### 2-4. 동의 항목 설정
1. "제품 설정" → "카카오 로그인" → "동의항목"
2. 최소 필요 항목:
   - 닉네임: 필수
   - 프로필 사진: 선택
   - 카카오계정(이메일): 필수 (비즈앱 전환 필요할 수 있음)

### 2-5. 카카오 Client Secret 발급
1. "제품 설정" → "카카오 로그인" → "보안" 메뉴
2. Client Secret 코드 발급 → 활성화 상태: 사용함

### 2-6. Supabase에 카카오 연동
1. Supabase Dashboard → Authentication → Providers
2. "Kakao" 찾아서 Enable
3. 입력:
   - Client ID: REST API 키
   - Client Secret: 위에서 발급한 Secret

---

## 3. 네이버 로그인 설정

### 3-1. 네이버 개발자 앱 등록
1. https://developers.naver.com 접속 → 로그인
2. Application → 애플리케이션 등록
3. 앱 이름: `밀포인트`
4. 사용 API: "네이버 로그인" 선택
5. 제공 정보: 이름, 이메일, 프로필 사진

### 3-2. 환경 설정
1. 서비스 URL: `http://localhost:3000` (개발용)
2. Callback URL:
   - `https://xxxxxxxx.supabase.co/auth/v1/callback`

### 3-3. Client ID / Secret 확인
1. 애플리케이션 정보에서 Client ID, Client Secret 복사

### 3-4. Supabase에 네이버 연동 (커스텀 OIDC)
1. Supabase Dashboard → Authentication → Providers
2. 방법 A: "Custom OIDC" 사용 (Supabase에서 네이버 공식 지원 없음)
   - Provider name: `naver`
   - Issuer URL: 직접 설정 필요
   - Client ID / Secret 입력
3. 방법 B: Supabase Edge Function으로 직접 OAuth 처리 (더 안정적)

> **참고**: 네이버는 표준 OIDC를 완벽 지원하지 않아서, 카카오보다 연동이 복잡합니다.
> 카카오 먼저 연동 후 네이버를 추가하는 것을 권장합니다.

---

## 4. 설정 완료 후 알려줄 값

코드 구현을 위해 아래 값들을 준비해주세요:

| 항목 | 값 |
|------|---|
| Supabase URL | `https://xxxxxxxx.supabase.co` |
| Supabase Anon Key | `eyJhbGciOi...` |
| 카카오 REST API 키 | |
| 카카오 Client Secret | |
| 네이버 Client ID | |
| 네이버 Client Secret | |

`.env.local` 파일에 넣을 내용:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> 카카오/네이버 키는 Supabase 대시보드에서 설정하므로 .env.local에는 넣지 않아도 됩니다.

---

## 5. 설정 완료 후 코드 구현 범위

위 설정이 끝나면 아래 코드를 자동 생성합니다:
- `/login` 페이지 (소셜 로그인 버튼 UI)
- `/auth/callback` 라우트 (OAuth 콜백 처리)
- 미들웨어 (`/admin` 경로 보호)
- 사이드바 로그아웃 버튼
- 사용자 프로필 표시
