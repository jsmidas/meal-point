-- =========================================================
-- 운영 DB 점검 (읽기 전용 — 아무것도 바꾸지 않는다)
--
-- Supabase SQL Editor 에서 전체를 붙여 넣고 실행한다. 여러 번 실행해도 된다.
-- 결과의 "상태"가 모두 OK 면 정상이다. "확인"은 아래 설명을 보고 판단한다.
--
-- 먼저 프로젝트가 맞는지 확인할 것: 브라우저 주소에 운영 프로젝트(xfajuncqjnqdykvucakg)가 들어 있어야 한다.
-- (예전 프로젝트 lrctaritoeqgliaewpfe 에서 실행하면 v43·v44 항목이 "확인"으로 나온다 — 그 DB 에는 적용하지 않았다)
-- =========================================================

WITH checks AS (
  -- 1) 공개 키로 읽을 수 있는 통로가 없는가
  SELECT 1 AS no, '공개 읽기 정책 수 (0이어야 함)' AS item,
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public') AS result,
         CASE WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') = 0 THEN 'OK' ELSE '확인' END AS status
  UNION ALL
  SELECT 2, 'RLS 가 꺼진 테이블 (없어야 함)',
         COALESCE((SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
                   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                   WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity), '없음'),
         CASE WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                           WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity)
              THEN '확인' ELSE 'OK' END
  UNION ALL
  -- 공개 키로 실행할 수 있는 함수(권한을 올려 실행되는 것만). 목록이 예상과 같은지 본다.
  SELECT 3, '공개 키로 실행 가능한 SECURITY DEFINER 함수',
         COALESCE((SELECT string_agg(p.proname, ', ' ORDER BY p.proname)
                   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                   WHERE n.nspname = 'public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')), '없음'),
         CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                           WHERE n.nspname = 'public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE'))
              THEN '확인' ELSE 'OK' END

  -- 2) 스키마: 코드가 읽고 쓰는 컬럼이 모두 있는가
  UNION ALL
  SELECT 10, 'v42 auth_throttle 테이블',
         COALESCE(to_regclass('public.auth_throttle')::text, '없음'),
         CASE WHEN to_regclass('public.auth_throttle') IS NULL THEN '확인' ELSE 'OK' END
  UNION ALL
  SELECT 11, 'v43 inventory_logs.amount',
         COALESCE((SELECT data_type FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'inventory_logs' AND column_name = 'amount'), '없음'),
         CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_schema = 'public' AND table_name = 'inventory_logs' AND column_name = 'amount')
              THEN 'OK' ELSE '확인' END
  UNION ALL
  SELECT 12, 'v44 company_prices.box_price',
         COALESCE((SELECT data_type FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'company_prices' AND column_name = 'box_price'), '없음'),
         CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_schema = 'public' AND table_name = 'company_prices' AND column_name = 'box_price')
              THEN 'OK' ELSE '확인' END
  UNION ALL
  SELECT 13, 'v44 company_price_history.box_price',
         COALESCE((SELECT data_type FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'company_price_history' AND column_name = 'box_price'), '없음'),
         CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_schema = 'public' AND table_name = 'company_price_history' AND column_name = 'box_price')
              THEN 'OK' ELSE '확인' END
  UNION ALL
  SELECT 14, 'v44 products.selling_box_price',
         COALESCE((SELECT data_type FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'selling_box_price'), '없음'),
         CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'selling_box_price')
              THEN 'OK' ELSE '확인' END

  -- 3) v42 의 보호 장치가 실제로 걸렸는가 (조건이 안 맞으면 v42 가 "건너뜀"으로 넘어간다)
  UNION ALL
  SELECT 20, '체험 사용권 회원당 1건 제약 (uq_trial_grants_member_active)',
         COALESCE(to_regclass('public.uq_trial_grants_member_active')::text, '없음 — v42 가 건너뜀'),
         CASE WHEN to_regclass('public.uq_trial_grants_member_active') IS NULL THEN '확인' ELSE 'OK' END
  UNION ALL
  SELECT 21, '아이디 대소문자 중복 차단 (uq_members_login_id_lower)',
         COALESCE(to_regclass('public.uq_members_login_id_lower')::text, '없음 — v42 가 건너뜀'),
         CASE WHEN to_regclass('public.uq_members_login_id_lower') IS NULL THEN '확인' ELSE 'OK' END
  UNION ALL
  SELECT 22, '상품 삭제 시 입출고 이력 보호 (RESTRICT 여야 함)',
         COALESCE((SELECT string_agg(CASE con.confdeltype WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
                                       WHEN 'n' THEN 'SET NULL' WHEN 'a' THEN 'NO ACTION' ELSE con.confdeltype::text END, ', ')
                   FROM pg_constraint con
                   WHERE con.conrelid = 'public.inventory_logs'::regclass AND con.contype = 'f'
                     AND con.confrelid = 'public.products'::regclass), '외래키 없음'),
         CASE WHEN EXISTS (SELECT 1 FROM pg_constraint con
                           WHERE con.conrelid = 'public.inventory_logs'::regclass AND con.contype = 'f'
                             AND con.confrelid = 'public.products'::regclass AND con.confdeltype = 'c')
              THEN '확인' ELSE 'OK' END

  -- 4) 데이터: 금액 규칙이 지켜지고 있는가
  UNION ALL
  -- 명세서 한 건의 합계 = 공급가 + 부가세 + 배송비
  SELECT 30, '합계가 안 맞는 명세서 (공급가+부가세+배송비 ≠ 합계)',
         (SELECT count(*)::text FROM public.statements
          WHERE total_amount <> supply_amount + tax_amount + COALESCE(shipping_fee, 0)),
         CASE WHEN EXISTS (SELECT 1 FROM public.statements
                           WHERE total_amount <> supply_amount + tax_amount + COALESCE(shipping_fee, 0))
              THEN '확인' ELSE 'OK' END
  UNION ALL
  -- 명세서 공급가 = 항목 금액의 합
  SELECT 31, '공급가가 항목 합과 다른 명세서',
         (SELECT count(*)::text FROM public.statements s
          WHERE s.supply_amount <> COALESCE((SELECT sum(i.amount) FROM public.statement_items i WHERE i.statement_id = s.id), 0)),
         CASE WHEN EXISTS (SELECT 1 FROM public.statements s
                           WHERE s.supply_amount <> COALESCE((SELECT sum(i.amount) FROM public.statement_items i WHERE i.statement_id = s.id), 0))
              THEN '확인' ELSE 'OK' END
  UNION ALL
  -- 청구의 입금액 = 그 청구에 달린 입금의 합
  SELECT 32, '입금액이 입금 내역 합과 다른 청구',
         (SELECT count(*)::text FROM public.billings b
          WHERE COALESCE(b.paid_amount, 0) <> COALESCE((SELECT sum(p.amount) FROM public.payments p WHERE p.billing_id = b.id), 0)),
         CASE WHEN EXISTS (SELECT 1 FROM public.billings b
                           WHERE COALESCE(b.paid_amount, 0) <> COALESCE((SELECT sum(p.amount) FROM public.payments p WHERE p.billing_id = b.id), 0))
              THEN '확인' ELSE 'OK' END
  UNION ALL
  -- 박스 금액이 따로 기록된 판매 (v43 이후 등록분). 0건이어도 정상이다.
  SELECT 33, '금액이 따로 기록된 판매 건수 (참고)',
         (SELECT count(*)::text FROM public.inventory_logs WHERE amount IS NOT NULL), '참고'
  UNION ALL
  SELECT 34, '박스 금액이 등록된 거래처 단가 건수 (참고)',
         (SELECT count(*)::text FROM public.company_prices WHERE box_price IS NOT NULL), '참고'
  UNION ALL
  -- 지금 적용 중인 단가(company_prices)가 단가 이력의 최신값과 같은가 — 적용일이 오늘 이하인 이력 기준
  SELECT 35, '이력과 다른 현재 판매 단가',
         (SELECT count(*)::text FROM public.company_prices cp
          WHERE cp.custom_price <> COALESCE((
            SELECT h.price FROM public.company_price_history h
            WHERE h.company_id = cp.company_id AND h.product_id = cp.product_id AND h.price_type = 'sell'
              AND h.effective_from <= (now() AT TIME ZONE 'Asia/Seoul')::date
            ORDER BY h.effective_from DESC, h.created_at DESC LIMIT 1), cp.custom_price)),
         CASE WHEN EXISTS (SELECT 1 FROM public.company_prices cp
                           WHERE cp.custom_price <> COALESCE((
                             SELECT h.price FROM public.company_price_history h
                             WHERE h.company_id = cp.company_id AND h.product_id = cp.product_id AND h.price_type = 'sell'
                               AND h.effective_from <= (now() AT TIME ZONE 'Asia/Seoul')::date
                             ORDER BY h.effective_from DESC, h.created_at DESC LIMIT 1), cp.custom_price))
              THEN '확인' ELSE 'OK' END

  -- 5) 계정
  UNION ALL
  SELECT 40, '대소문자만 다른 아이디',
         (SELECT count(*)::text FROM (SELECT lower(login_id) FROM public.members WHERE login_id IS NOT NULL
                                      GROUP BY lower(login_id) HAVING count(*) > 1) d),
         CASE WHEN EXISTS (SELECT 1 FROM public.members WHERE login_id IS NOT NULL
                           GROUP BY lower(login_id) HAVING count(*) > 1) THEN '확인' ELSE 'OK' END
  UNION ALL
  SELECT 41, '활성 체험 사용권이 2건 이상인 회원',
         (SELECT count(*)::text FROM (SELECT member_id FROM public.meal_trial_grants WHERE status = 'active'
                                      GROUP BY member_id HAVING count(*) > 1) d),
         CASE WHEN EXISTS (SELECT 1 FROM public.meal_trial_grants WHERE status = 'active'
                           GROUP BY member_id HAVING count(*) > 1) THEN '확인' ELSE 'OK' END
)
SELECT no AS "번호", item AS "항목", result AS "결과", status AS "상태"
FROM checks
ORDER BY no;

-- "확인"이 나왔을 때
--   1·2   공개 키로 읽히는 테이블이 있다 → schema-v35-lockdown.sql, schema-v42-hardening.sql 을 다시 실행
--   3     함수 이름을 보고 공개 호출이 필요한 것인지 판단한다 (체험 계정 배정용 함수는 서버가 호출한다)
--   10~14 해당 버전의 SQL 이 이 DB 에 실행되지 않았다 → 그 파일을 실행
--   20·21 v42 가 조건에 걸려 건너뛴 것 → 40·41 의 중복을 정리한 뒤 v42 를 다시 실행
--   22    v42 를 다시 실행
--   30·31 금액이 어긋난 명세서가 있다 → 명세서 관리에서 해당 건을 열어 다시 저장
--   32    입금 합계가 어긋난 청구가 있다 → 정산 화면에서 해당 월을 열어 확인
--   35    단가 관리 화면을 한 번 열면 맞춰진다(적용일이 된 예약 단가 반영). 그래도 남으면 알려 줄 것
--         (적용일을 기다리지 않고 바로 적용됐던 2026-11-19 이전 저장분은 이 점검에서 "확인"으로 잡힐 수 있다)
