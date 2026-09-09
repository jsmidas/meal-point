#!/usr/bin/env bash
# 뭄바이 → 서울 DB 전환(컷오버) 스크립트. 여러 번 실행해도 안전 (신 DB public 스키마를 통째로 재구성).
# 순서: 구 DB 전체 덤프 → 신 DB public 스키마 드롭/재생성 → 복원 → 기본권한 → URL 교체 → 행 수 대조 → Storage 증분 복사
# 사용: bash scripts/migrate-supabase/cutover.sh   (프로젝트 루트에서, .env.local 에 비밀번호/키 필요)
set -euo pipefail
cd "$(dirname "$0")/../.."

env_get() { grep "^$1=" .env.local | cut -d= -f2- | tr -d '\r"'; }
PSQL="/c/Program Files/PostgreSQL/17/bin/psql"
PGDUMP="/c/Program Files/PostgreSQL/17/bin/pg_dump"
OLD_REF=lrctaritoeqgliaewpfe; OLD_HOST=aws-1-ap-south-1.pooler.supabase.com
NEW_REF=xfajuncqjnqdykvucakg; NEW_HOST=aws-0-ap-northeast-2.pooler.supabase.com
OLD_URL="https://$OLD_REF.supabase.co"; NEW_URL="https://$NEW_REF.supabase.co"
OLD_SK=$(env_get SUPABASE_SERVICE_ROLE_KEY); NEW_SK=$(env_get SEOUL_SUPABASE_SERVICE_ROLE_KEY)
export PGSSLMODE=require
STAMP=$(date +%Y%m%d-%H%M%S); DUMP="dump/cutover-$STAMP.sql"; mkdir -p dump

echo "[1/7] 구 DB 덤프 → $DUMP"
PGPASSWORD=$(env_get SUPABASE_MUMBAI_DB_PASSWORD) "$PGDUMP" -h $OLD_HOST -p 5432 -U postgres.$OLD_REF -d postgres \
  --schema=public --no-owner --exclude-table=_prisma_migrations -f "$DUMP"
# 신 프로젝트에서 실행 불가/불필요한 문장 제거
sed -i -e 's/^CREATE SCHEMA public;/-- &/' -e 's/^COMMENT ON SCHEMA public /-- &/' -e '/FOR ROLE supabase_admin/d' "$DUMP"
echo "    tables=$(grep -c '^CREATE TABLE' "$DUMP") copy=$(grep -c '^COPY ' "$DUMP") policies=$(grep -c '^CREATE POLICY' "$DUMP")"

NEWPG=( "$PSQL" -h $NEW_HOST -p 5432 -U postgres.$NEW_REF -d postgres -v ON_ERROR_STOP=1 -q )
export PGPASSWORD=$(env_get SUPABASE_SEOUL_DB_PASSWORD)

echo "[2/7] 신 DB public 스키마 재생성"
"${NEWPG[@]}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role; GRANT ALL ON SCHEMA public TO postgres;"

echo "[3/7] 복원"
"${NEWPG[@]}" -f "$DUMP"

echo "[4/7] URL 호스트 교체 + 검증 (모두 0, 마지막 줄만 >0 이어야 함)"
sed "s/NEW_REF/$NEW_REF/g" scripts/migrate-supabase/rewrite-urls.sql | "${NEWPG[@]}" -tA

echo "[5/7] 스키마 객체 수"
"${NEWPG[@]}" -tA -c "select 'tables='||count(*) from pg_tables where schemaname='public' union all select 'rls_on='||count(*) from pg_tables where schemaname='public' and rowsecurity union all select 'policies='||count(*) from pg_policies where schemaname='public' union all select 'triggers='||count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal"

echo "[6/7] 행 수 대조 (구 vs 신)"
node scripts/migrate-supabase/count-rows.mjs "$OLD_URL" "$OLD_SK" > dump/counts-old-$STAMP.txt
node scripts/migrate-supabase/count-rows.mjs "$NEW_URL" "$NEW_SK" > dump/counts-new-$STAMP.txt
if diff dump/counts-old-$STAMP.txt dump/counts-new-$STAMP.txt; then echo "    행 수 일치 ✔"; else echo "    !!! 행 수 불일치"; exit 1; fi

echo "[7/7] Storage 증분 복사 (x-upsert)"
node scripts/migrate-supabase/copy-storage.mjs "$OLD_URL" "$OLD_SK" "$NEW_URL" "$NEW_SK" logos | tail -1

echo "완료. 다음: Vercel 환경변수 교체 + 재배포"
