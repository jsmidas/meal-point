# Supabase 서울 리전 이관 절차 (뭄바이 ap-south-1 → 서울 ap-northeast-2)

작성: 2026-09-09. 배경: DB가 뭄바이에 있어 쿼리 1회당 0.4~0.6초. 서울로 옮기면 0.03초 수준.

## 영향 범위 (조사 결과)
- DB: public 스키마 24개 테이블, 약 1,800행 (scripts/migrate-supabase/baseline-mumbai.txt)
- Storage: `logos` 버킷(public) 1개 — 로고 1개 + `pages/` 하위 상세페이지 이미지
- DB에 저장된 Storage URL: company_info(로고/직인), products.image_url, companies.biz_cert_image_url,
  popups.image_url, product_pages 이미지 배열 4종 → 호스트 문자열 교체 필요
- Supabase Auth: 미사용(auth.users 0명). 카카오/구글/네이버 로그인은 자체 API 라우트 → 영향 없음
- Vercel 환경변수 3개 교체: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- 이관 중 입력된 데이터는 유실되므로 **사용자가 없는 시간(밤/새벽)** 에 진행. 소요 약 30분.

## 사전 준비 (사장님)
1. https://supabase.com/dashboard → New project
   - Organization: mealpoint / Name: `mealpoint-seoul` / Region: **Northeast Asia (Seoul)** / Plan: 기존 Pro org 안에서 생성
   - Database Password: 새로 생성해 안전한 곳에 기록
2. 신 프로젝트 생성 완료 후 전달할 것
   - Project URL, anon key, service_role key (Settings → API)
   - DB 연결 문자열 2개 (Settings → Database → Connection string, **Session pooler** 탭, IPv4)
     - 구 프로젝트(뭄바이)의 것도 함께 (비밀번호 모르면 Reset database password)

## 실행 순서 (Claude가 진행, 사장님 확인하며)
0. 기준 집계: `node scripts/migrate-supabase/count-rows.mjs <OLD_URL> <OLD_SERVICE_KEY>`
1. 서비스 정지 안내 시점부터 구 DB에 입력 금지
2. 덤프 (스키마+데이터+RLS 정책+함수/트리거 한 번에, FK 는 post-data 라 순서 문제 없음)
   ```
   "C:/Program Files/PostgreSQL/17/bin/pg_dump" "<OLD_POOLER_URI>" \
     --schema=public --no-owner --exclude-table=_prisma_migrations -f dump/mealpoint.sql
   ```
3. 복원
   ```
   "C:/Program Files/PostgreSQL/17/bin/psql" "<NEW_POOLER_URI>" -v ON_ERROR_STOP=1 -f dump/mealpoint.sql
   ```
4. 행 수 검증: `node scripts/migrate-supabase/count-rows.mjs <NEW_URL> <NEW_SERVICE_KEY>` → 0단계와 일치 확인
5. Storage 복사: `node scripts/migrate-supabase/copy-storage.mjs <OLD_URL> <OLD_SK> <NEW_URL> <NEW_SK>`
6. URL 교체: 신 프로젝트 SQL Editor 에서 `scripts/migrate-supabase/rewrite-urls.sql` (NEW_REF 치환 후) 실행 → 검증 쿼리 전부 0
7. 환경변수 교체
   - Vercel: Settings → Environment Variables 3개 수정 (Production) → Redeploy
   - 로컬 `.env.local` 동일하게 수정
8. 동작 확인: 로그인 → 대시보드 → 상품 관리(이미지) → 상세페이지 → 판매 등록 1건 입력 후 삭제 → 정산 관리
9. 1주일 정상 운영 후 구 프로젝트 Pause → 삭제

## 되돌리기
7단계 이전이면 아무것도 바뀐 게 없음. 7단계 이후 문제 시 Vercel 환경변수만 구 값으로 되돌리고 Redeploy.
