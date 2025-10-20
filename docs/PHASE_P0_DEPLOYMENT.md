# PHASE P0 배포 가이드 (Production Deployment Guide)

## 📋 개요 (Overview)

### 목적 및 범위
**PHASE_P0**는 태창 ERP 시스템의 핵심 재고 관리 기능을 강화하는 중요 배포입니다.

**주요 기능:**
1. **BOM 자동 차감 시스템** - 생산 거래 시 원자재 자동 차감 (Multi-level BOM 지원)
2. **성능 최적화 인덱스** - BOM 및 재고 조회 성능 94% 개선
3. **일일 재고 캘린더** - 날짜별 재고 현황 추적 (Materialized View)

**시스템 요구사항:**
- PostgreSQL 14.0 이상 (Supabase 기본 지원)
- pg_trgm Extension (한글 전문 검색)
- 데이터베이스 쓰기 권한 (Supabase Admin/Service Role)

**예상 배포 시간:**
- 개발 환경: 약 15분
- 운영 환경: 약 30분 (검증 단계 포함)

---

## ⚠️ 배포 전 필수 체크리스트

### 1. 데이터베이스 백업
```bash
# Supabase CLI를 사용한 백업 (권장)
supabase db dump -f backup_phase_p0_$(date +%Y%m%d_%H%M%S).sql

# PostgreSQL pg_dump 사용 (대안)
pg_dump -h [supabase-host] -U postgres -d postgres \
  --schema=public \
  --format=custom \
  --file=backup_phase_p0_$(date +%Y%m%d_%H%M%S).dump
```

**백업 검증:**
```sql
-- 백업 파일 크기 확인 (최소 1MB 이상)
-- 주요 테이블 레코드 수 확인
SELECT
  'items' AS table_name, COUNT(*) AS row_count FROM items
UNION ALL
SELECT 'bom', COUNT(*) FROM bom
UNION ALL
SELECT 'inventory_transactions', COUNT(*) FROM inventory_transactions;
```

### 2. 테스트 환경 검증
- [ ] 테스트 데이터베이스에서 마이그레이션 성공 확인
- [ ] BOM 자동 차감 트리거 정상 작동 테스트
- [ ] 일일 재고 캘린더 API 응답 확인
- [ ] 성능 측정 완료 (Before/After 비교)

### 3. 롤백 계획 수립
- [ ] 롤백 SQL 스크립트 준비 완료 (각 섹션 하단 참조)
- [ ] 롤백 담당자 지정 및 연락 가능 상태 확인
- [ ] 롤백 실행 권한 확인

### 4. 성능 베이스라인 측정
```sql
-- BOM 조회 성능 측정
\timing on
EXPLAIN ANALYZE
SELECT b.*, i.item_code, i.item_name
FROM bom b
INNER JOIN items i ON b.child_item_id = i.item_id
WHERE b.parent_item_id = 1 AND b.is_active = true;

-- 재고 거래 이력 조회 성능 측정
EXPLAIN ANALYZE
SELECT * FROM inventory_transactions
WHERE transaction_type = '생산입고'
  AND transaction_date >= CURRENT_DATE - INTERVAL '1 month'
ORDER BY transaction_date DESC
LIMIT 100;

-- 결과를 기록하여 배포 후 비교
```

---

## 🚀 마이그레이션 실행 순서

### Step 1: BOM 자동 차감 시스템 배포

**파일:** `supabase/migrations/20250115_bom_auto_deduction.sql`

**주요 변경사항:**
- `bom_deduction_log` 테이블 생성 (차감 이력 추적)
- `auto_deduct_bom_materials()` 트리거 함수 생성
- `trg_auto_deduct_bom` 트리거 등록
- BOM 성능 인덱스 4개 추가

**실행 명령어:**
```bash
# Supabase CLI 사용 (권장)
supabase db push

# 또는 PostgreSQL psql 사용
psql -h [supabase-host] -U postgres -d postgres \
  -f supabase/migrations/20250115_bom_auto_deduction.sql
```

**예상 실행 시간:** 10-30초

**검증 쿼리:**
```sql
-- 1. 테이블 생성 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'bom_deduction_log';
-- 예상 결과: 1 row (bom_deduction_log)

-- 2. 트리거 생성 확인
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'inventory_transactions'
  AND trigger_name = 'trg_auto_deduct_bom';
-- 예상 결과: 1 row (INSERT 이벤트)

-- 3. 인덱스 생성 확인
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_bom_parent_child',
    'idx_bom_deduction_log_transaction',
    'idx_bom_deduction_log_parent',
    'idx_bom_deduction_log_child'
  );
-- 예상 결과: 4 rows

-- 4. 트리거 함수 존재 확인
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'auto_deduct_bom_materials';
-- 예상 결과: 1 row
```

**기능 테스트:**
```sql
-- 테스트 1: 단순 BOM 차감 (1단계)
-- 준비: 테스트 품목 및 BOM 생성
INSERT INTO items (item_code, item_name, item_type, current_stock, price)
VALUES
  ('TEST-FINISH-001', '테스트 완제품', '완제품', 0, 100000),
  ('TEST-RAW-001', '테스트 원자재', '원자재', 100, 5000);

INSERT INTO bom (parent_item_id, child_item_id, quantity_required, level_no)
VALUES (
  (SELECT item_id FROM items WHERE item_code = 'TEST-FINISH-001'),
  (SELECT item_id FROM items WHERE item_code = 'TEST-RAW-001'),
  2.5,
  1
);

-- 실행: 생산입고 (완제품 10개 생산 → 원자재 25개 차감 예상)
INSERT INTO inventory_transactions (
  transaction_type, item_id, quantity, unit_price,
  total_amount, transaction_date, status, created_by
) VALUES (
  '생산입고',
  (SELECT item_id FROM items WHERE item_code = 'TEST-FINISH-001'),
  10,
  100000,
  1000000,
  CURRENT_DATE,
  '완료',
  1
);

-- 검증: 원자재 재고 확인 (100 - 25 = 75 예상)
SELECT item_code, item_name, current_stock
FROM items
WHERE item_code = 'TEST-RAW-001';
-- 예상 결과: current_stock = 75

-- 검증: 차감 로그 확인
SELECT
  parent_quantity,
  quantity_required,
  deducted_quantity,
  stock_before,
  stock_after
FROM bom_deduction_log
WHERE transaction_id = (SELECT MAX(transaction_id) FROM inventory_transactions);
-- 예상 결과: deducted_quantity = 25, stock_before = 100, stock_after = 75

-- 정리
DELETE FROM inventory_transactions WHERE item_id IN (
  SELECT item_id FROM items WHERE item_code LIKE 'TEST-%'
);
DELETE FROM bom WHERE parent_item_id IN (
  SELECT item_id FROM items WHERE item_code LIKE 'TEST-%'
);
DELETE FROM items WHERE item_code LIKE 'TEST-%';
```

**롤백 명령어:**
```sql
BEGIN;

-- 트리거 삭제
DROP TRIGGER IF EXISTS trg_auto_deduct_bom ON inventory_transactions CASCADE;

-- 함수 삭제
DROP FUNCTION IF EXISTS auto_deduct_bom_materials() CASCADE;

-- 테이블 삭제
DROP TABLE IF EXISTS bom_deduction_log CASCADE;

-- 인덱스 삭제
DROP INDEX IF EXISTS idx_bom_parent_child;
DROP INDEX IF EXISTS idx_bom_deduction_log_transaction;
DROP INDEX IF EXISTS idx_bom_deduction_log_parent;
DROP INDEX IF EXISTS idx_bom_deduction_log_child;
DROP INDEX IF EXISTS idx_bom_deduction_log_created;
DROP INDEX IF EXISTS idx_items_active_stock;

COMMIT;
```

---

### Step 2: 성능 최적화 인덱스 배포

**파일:** `supabase/migrations/20250115_bom_performance_indexes.sql`

**주요 변경사항:**
- BOM 테이블 인덱스 4개 추가 (복합 인덱스, 부분 인덱스)
- 재고 거래 인덱스 4개 추가 (날짜 범위, 타입 필터링)
- 품목 테이블 인덱스 2개 추가 (코드 조회, 한글 전문 검색)
- BOM 차감 로그 인덱스 2개 추가
- 중복 인덱스 정리
- 인덱스 사용률 모니터링 뷰 생성

**실행 명령어:**
```bash
# Supabase CLI 사용
supabase db push

# 또는 PostgreSQL psql 사용
psql -h [supabase-host] -U postgres -d postgres \
  -f supabase/migrations/20250115_bom_performance_indexes.sql
```

**⚠️ 중요 사항:**
- `CREATE INDEX CONCURRENTLY` 사용으로 운영 중단 없이 인덱스 생성
- 인덱스 생성 중에도 일반 SELECT/INSERT/UPDATE 가능
- 인덱스 생성 시간: 데이터 규모에 따라 1-10분 소요

**예상 실행 시간:**
- 소규모 (< 10,000 rows): 1-2분
- 중규모 (10,000-100,000 rows): 5-7분
- 대규모 (> 100,000 rows): 10분 이상

**검증 쿼리:**
```sql
-- 1. 모든 인덱스 생성 확인 (12개 예상)
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_indexes
JOIN pg_stat_user_indexes USING (schemaname, tablename, indexname)
WHERE schemaname = 'public'
  AND tablename IN ('bom', 'inventory_transactions', 'items', 'bom_deduction_log')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
-- 예상 결과: 12+ rows

-- 2. 필수 인덱스 존재 확인
SELECT
  CASE
    WHEN COUNT(*) = 12 THEN '✅ 모든 인덱스 생성 완료'
    ELSE '❌ 인덱스 누락: ' || (12 - COUNT(*))::text || '개'
  END AS status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_bom_parent_child_active',
    'idx_bom_active_level',
    'idx_bom_child_active',
    'idx_bom_updated_at',
    'idx_inventory_item_date',
    'idx_inventory_type_date',
    'idx_inventory_date_range',
    'idx_inventory_reference',
    'idx_items_code_active',
    'idx_items_name_trgm',
    'idx_bom_deduction_transaction',
    'idx_bom_deduction_child_item'
  );

-- 3. 인덱스 사용률 모니터링 뷰 확인
SELECT * FROM v_index_usage_stats
ORDER BY index_scans DESC
LIMIT 10;
-- 예상 결과: 인덱스별 사용 통계 표시

-- 4. 인덱스 분석 함수 실행
SELECT * FROM analyze_index_performance();
-- 예상 결과: 인덱스별 성능 권장사항
```

**성능 개선 확인:**
```sql
-- BOM 조회 성능 테스트 (Before: 500ms, After: 30ms 예상)
\timing on
EXPLAIN ANALYZE
SELECT b.*, i.item_code, i.item_name
FROM bom b
INNER JOIN items i ON b.child_item_id = i.item_id
WHERE b.parent_item_id = 1 AND b.is_active = true
ORDER BY i.item_code;
-- "Index Scan using idx_bom_parent_child_active" 메시지 확인

-- 재고 거래 이력 성능 테스트 (Before: 300ms, After: 60ms 예상)
EXPLAIN ANALYZE
SELECT * FROM inventory_transactions
WHERE transaction_type = '생산입고'
  AND transaction_date >= CURRENT_DATE - INTERVAL '1 month'
ORDER BY transaction_date DESC
LIMIT 100;
-- "Index Scan using idx_inventory_type_date" 메시지 확인

-- 한글 품목명 검색 성능 테스트 (LIKE → Full-text)
EXPLAIN ANALYZE
SELECT * FROM items
WHERE item_name LIKE '%부품%';
-- "Bitmap Index Scan on idx_items_name_trgm" 메시지 확인
```

**롤백 명령어:**
```sql
-- ⚠️ 주의: DROP INDEX CONCURRENTLY 사용으로 운영 중단 방지
BEGIN;

-- BOM 테이블 인덱스 삭제
DROP INDEX CONCURRENTLY IF EXISTS idx_bom_parent_child_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_bom_active_level;
DROP INDEX CONCURRENTLY IF EXISTS idx_bom_child_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_bom_updated_at;

-- 재고 거래 인덱스 삭제
DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_item_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_type_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_date_range;
DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_reference;

-- 품목 테이블 인덱스 삭제
DROP INDEX CONCURRENTLY IF EXISTS idx_items_code_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_items_name_trgm;

-- BOM 차감 로그 인덱스 삭제
DROP INDEX CONCURRENTLY IF EXISTS idx_bom_deduction_transaction;
DROP INDEX CONCURRENTLY IF EXISTS idx_bom_deduction_child_item;

-- 모니터링 뷰 및 함수 삭제
DROP VIEW IF EXISTS v_index_usage_stats;
DROP FUNCTION IF EXISTS analyze_index_performance();

-- 기존 인덱스 복원 (필요 시)
CREATE INDEX idx_bom_parent ON bom(parent_item_id) WHERE is_active = true;
CREATE INDEX idx_bom_child ON bom(child_item_id) WHERE is_active = true;

COMMIT;
```

---

### Step 3: 일일 재고 캘린더 배포

**파일:** `supabase/migrations/20250129_daily_stock_tracking.sql`

**주요 변경사항:**
- `mv_daily_stock_calendar` Materialized View 생성
- 날짜별 품목별 재고 현황 추적 (기초재고, 입출고, 기말재고, 재고금액)
- 자동 갱신 트리거 (재고 거래 변경 시 자동 REFRESH)
- 성능 인덱스 3개 추가 (날짜, 품목, 재고금액)
- 최근 2년 데이터 자동 생성

**실행 명령어:**
```bash
# Supabase CLI 사용
supabase db push

# 또는 PostgreSQL psql 사용
psql -h [supabase-host] -U postgres -d postgres \
  -f supabase/migrations/20250129_daily_stock_tracking.sql
```

**⚠️ 중요 사항:**
- 초기 데이터 생성 시간: 품목 수 × 730일 (약 15,000-50,000 rows 생성)
- Materialized View 크기: 데이터 2-5MB + 인덱스 3-8MB = 총 5-13MB
- REFRESH CONCURRENTLY로 조회 중단 없이 갱신 가능

**예상 실행 시간:**
- 초기 생성: 10-30초 (데이터 규모에 따라)
- 자동 갱신: 1-3초 (재고 거래 발생 시)

**검증 쿼리:**
```sql
-- 1. Materialized View 생성 확인
SELECT schemaname, matviewname, ispopulated
FROM pg_matviews
WHERE matviewname = 'mv_daily_stock_calendar';
-- 예상 결과: ispopulated = true

-- 2. 데이터 건수 확인 (품목 수 × 730일)
SELECT
  COUNT(*) AS total_rows,
  COUNT(DISTINCT item_id) AS unique_items,
  COUNT(DISTINCT calendar_date) AS unique_dates,
  MIN(calendar_date) AS earliest_date,
  MAX(calendar_date) AS latest_date
FROM mv_daily_stock_calendar;
-- 예상 결과: total_rows ≈ 품목수 × 730, earliest_date ≈ 2년 전

-- 3. 인덱스 생성 확인 (4개: PK + 3개)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'mv_daily_stock_calendar'
ORDER BY indexname;
-- 예상 결과: 4 rows

-- 4. 트리거 생성 확인
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trg_refresh_daily_stock';
-- 예상 결과: 1 row (INSERT, UPDATE, DELETE)

-- 5. 트리거 함수 존재 확인
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'refresh_daily_stock_calendar';
-- 예상 결과: 1 row
```

**데이터 검증:**
```sql
-- 최근 7일 데이터 샘플 확인
SELECT
  calendar_date,
  item_code,
  item_name,
  opening_stock,
  receiving_qty,
  shipping_qty,
  closing_stock,
  stock_value
FROM mv_daily_stock_calendar
WHERE calendar_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY calendar_date DESC, item_code
LIMIT 20;

-- 재고금액 상위 10개 품목 (오늘 기준)
SELECT
  item_code,
  item_name,
  closing_stock,
  stock_value,
  RANK() OVER (ORDER BY stock_value DESC) AS rank
FROM mv_daily_stock_calendar
WHERE calendar_date = CURRENT_DATE
  AND stock_value > 0
ORDER BY stock_value DESC
LIMIT 10;

-- 특정 품목 재고 추이 (최근 30일)
SELECT
  calendar_date,
  opening_stock,
  receiving_qty,
  shipping_qty,
  closing_stock
FROM mv_daily_stock_calendar
WHERE item_id = 1  -- 테스트 품목 ID
  AND calendar_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY calendar_date DESC;
```

**성능 확인:**
```sql
-- API 조회 성능 테스트 (<200ms 예상)
\timing on
SELECT * FROM mv_daily_stock_calendar
WHERE calendar_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY calendar_date DESC, item_code
LIMIT 100;
-- 예상: Execution time: 50-200ms

-- 날짜 범위 조회 성능 테스트 (<100ms 예상)
EXPLAIN ANALYZE
SELECT * FROM mv_daily_stock_calendar
WHERE calendar_date BETWEEN '2025-01-01' AND '2025-01-31'
ORDER BY calendar_date DESC;
-- "Index Scan using idx_mv_daily_stock_date" 메시지 확인
```

**롤백 명령어:**
```sql
BEGIN;

-- 트리거 삭제
DROP TRIGGER IF EXISTS trg_refresh_daily_stock ON inventory_transactions;

-- 트리거 함수 삭제
DROP FUNCTION IF EXISTS refresh_daily_stock_calendar();

-- 인덱스 삭제
DROP INDEX IF EXISTS idx_mv_daily_stock_pk;
DROP INDEX IF EXISTS idx_mv_daily_stock_date;
DROP INDEX IF EXISTS idx_mv_daily_stock_item;
DROP INDEX IF EXISTS idx_mv_daily_stock_value;

-- Materialized View 삭제
DROP MATERIALIZED VIEW IF EXISTS mv_daily_stock_calendar;

COMMIT;
```

---

## ✅ 배포 후 검증 절차

### 1. 시스템 헬스 체크

```sql
-- 전체 마이그레이션 상태 확인
SELECT
  'BOM 차감 로그 테이블' AS component,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'bom_deduction_log'
  ) THEN '✅ OK' ELSE '❌ FAIL' END AS status
UNION ALL
SELECT
  'BOM 자동 차감 트리거',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_auto_deduct_bom'
  ) THEN '✅ OK' ELSE '❌ FAIL' END
UNION ALL
SELECT
  '성능 인덱스 (12개)',
  CASE WHEN (
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'idx_bom_parent_child_active',
        'idx_bom_active_level',
        'idx_bom_child_active',
        'idx_bom_updated_at',
        'idx_inventory_item_date',
        'idx_inventory_type_date',
        'idx_inventory_date_range',
        'idx_inventory_reference',
        'idx_items_code_active',
        'idx_items_name_trgm',
        'idx_bom_deduction_transaction',
        'idx_bom_deduction_child_item'
      )
  ) >= 12 THEN '✅ OK' ELSE '❌ FAIL' END
UNION ALL
SELECT
  '일일 재고 캘린더 뷰',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_matviews
    WHERE matviewname = 'mv_daily_stock_calendar'
      AND ispopulated = true
  ) THEN '✅ OK' ELSE '❌ FAIL' END
UNION ALL
SELECT
  '일일 재고 갱신 트리거',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_refresh_daily_stock'
  ) THEN '✅ OK' ELSE '❌ FAIL' END;
```

**예상 결과:** 모든 항목 `✅ OK`

### 2. BOM 자동 차감 기능 검증

```sql
-- 통합 테스트: 2단계 BOM 자동 차감
BEGIN;

-- 준비: 테스트 데이터 생성
INSERT INTO items (item_code, item_name, item_type, current_stock, price)
VALUES
  ('TEST-PRODUCT', '테스트 완제품', '완제품', 0, 150000),
  ('TEST-SEMI', '테스트 반제품', '반제품', 0, 50000),
  ('TEST-MAT-A', '테스트 원자재A', '원자재', 200, 10000),
  ('TEST-MAT-B', '테스트 원자재B', '원자재', 300, 5000);

-- BOM 구성 (2단계)
-- 완제품 1개 = 반제품 3개
INSERT INTO bom (parent_item_id, child_item_id, quantity_required, level_no)
VALUES (
  (SELECT item_id FROM items WHERE item_code = 'TEST-PRODUCT'),
  (SELECT item_id FROM items WHERE item_code = 'TEST-SEMI'),
  3.0,
  1
);
-- 반제품 1개 = 원자재A 2개 + 원자재B 1.5개
INSERT INTO bom (parent_item_id, child_item_id, quantity_required, level_no)
VALUES
  (
    (SELECT item_id FROM items WHERE item_code = 'TEST-SEMI'),
    (SELECT item_id FROM items WHERE item_code = 'TEST-MAT-A'),
    2.0,
    1
  ),
  (
    (SELECT item_id FROM items WHERE item_code = 'TEST-SEMI'),
    (SELECT item_id FROM items WHERE item_code = 'TEST-MAT-B'),
    1.5,
    1
  );

-- 실행: 완제품 10개 생산
-- 예상 차감:
-- - 반제품: 10 × 3.0 = 30개 (차감 불가, 재고 0)
-- - 원자재A: 10 × 3.0 × 2.0 = 60개 (200 - 60 = 140)
-- - 원자재B: 10 × 3.0 × 1.5 = 45개 (300 - 45 = 255)
INSERT INTO inventory_transactions (
  transaction_type, item_id, quantity, unit_price,
  total_amount, transaction_date, status, created_by
) VALUES (
  '생산입고',
  (SELECT item_id FROM items WHERE item_code = 'TEST-PRODUCT'),
  10,
  150000,
  1500000,
  CURRENT_DATE,
  '완료',
  1
);

-- 검증 1: 원자재 재고 확인
SELECT
  item_code,
  item_name,
  current_stock,
  CASE item_code
    WHEN 'TEST-MAT-A' THEN 140  -- 예상 재고
    WHEN 'TEST-MAT-B' THEN 255
    ELSE NULL
  END AS expected_stock,
  CASE
    WHEN current_stock = (
      CASE item_code
        WHEN 'TEST-MAT-A' THEN 140
        WHEN 'TEST-MAT-B' THEN 255
        ELSE NULL
      END
    ) THEN '✅ OK'
    ELSE '❌ FAIL'
  END AS status
FROM items
WHERE item_code IN ('TEST-MAT-A', 'TEST-MAT-B');

-- 검증 2: 차감 로그 확인
SELECT
  i.item_code AS child_item,
  bdl.quantity_required,
  bdl.deducted_quantity,
  bdl.stock_before,
  bdl.stock_after,
  bdl.bom_level
FROM bom_deduction_log bdl
JOIN items i ON bdl.child_item_id = i.item_id
WHERE bdl.transaction_id = (
  SELECT MAX(transaction_id) FROM inventory_transactions
  WHERE item_id = (SELECT item_id FROM items WHERE item_code = 'TEST-PRODUCT')
)
ORDER BY bdl.bom_level, i.item_code;

-- 정리
ROLLBACK;
```

### 3. 성능 지표 확인

```sql
-- 인덱스 사용률 확인
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  CASE
    WHEN idx_scan = 0 THEN '⚠️ UNUSED'
    WHEN idx_scan < 100 THEN '🟡 LOW'
    WHEN idx_scan < 1000 THEN '🟢 MEDIUM'
    ELSE '🔥 HIGH'
  END AS usage_level,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('bom', 'inventory_transactions', 'items', 'bom_deduction_log')
ORDER BY idx_scan DESC;

-- 성능 개선 확인
SELECT * FROM analyze_index_performance();
```

### 4. API 엔드포인트 테스트

```bash
# 일일 재고 캘린더 API 테스트 (최근 30일)
curl -X GET "http://localhost:5000/api/stock/daily-calendar?start_date=2025-01-01&end_date=2025-01-31&limit=20&page=1" \
  -H "Content-Type: application/json"

# 예상 응답 시간: <200ms
# 예상 응답:
# {
#   "success": true,
#   "data": [...],
#   "pagination": { "page": 1, "limit": 20, "totalCount": 620, "totalPages": 31 }
# }

# Excel 내보내기 테스트
curl -X GET "http://localhost:5000/api/stock/daily-calendar?start_date=2025-01-01&end_date=2025-01-31&format=excel" \
  --output daily_stock_test.xlsx

# 파일 크기 확인 (최소 10KB 이상)
ls -lh daily_stock_test.xlsx
```

### 5. 자동 갱신 트리거 테스트

```sql
-- 재고 거래 추가 후 자동 갱신 확인
BEGIN;

-- 현재 갱신 시각 기록
SELECT updated_at FROM mv_daily_stock_calendar
WHERE calendar_date = CURRENT_DATE AND item_id = 1
LIMIT 1;

-- 재고 거래 추가
INSERT INTO inventory_transactions (
  transaction_type, item_id, quantity, unit_price,
  total_amount, transaction_date, status, created_by
) VALUES (
  '입고',
  1,
  50,
  10000,
  500000,
  CURRENT_DATE,
  '완료',
  1
);

-- 갱신 대기 (1-3초)
SELECT pg_sleep(3);

-- 갱신 시각 확인 (변경되어야 함)
SELECT updated_at FROM mv_daily_stock_calendar
WHERE calendar_date = CURRENT_DATE AND item_id = 1
LIMIT 1;

ROLLBACK;
```

---

## 🔧 트러블슈팅

### 문제 1: 트리거 실행 시 재고 부족 오류

**증상:**
```
ERROR: 재고 부족: 품목 [RAW-001] 원자재A
필요 수량: 100 / 현재 재고: 50
생산 품목: [PROD-001] 완제품A
생산 수량: 10
BOM 레벨: 1
HINT: 원자재 재고를 확인하고 입고 처리 후 다시 시도하세요.
```

**원인:** BOM에 정의된 원자재 재고가 부족하여 생산 불가

**해결 방법:**
```sql
-- 1. 부족한 원자재 확인
SELECT
  c.item_code,
  c.item_name,
  c.current_stock,
  b.quantity_required * 10 AS required_for_production,
  (b.quantity_required * 10) - c.current_stock AS shortage
FROM bom b
JOIN items c ON b.child_item_id = c.item_id
WHERE b.parent_item_id = (SELECT item_id FROM items WHERE item_code = 'PROD-001')
  AND b.is_active = true
  AND c.current_stock < (b.quantity_required * 10);

-- 2. 원자재 입고 처리
INSERT INTO inventory_transactions (
  transaction_type, item_id, quantity, unit_price,
  total_amount, transaction_date, status, created_by
) VALUES (
  '입고',
  (SELECT item_id FROM items WHERE item_code = 'RAW-001'),
  50,  -- 부족 수량
  5000,
  250000,
  CURRENT_DATE,
  '완료',
  1
);

-- 3. 생산 거래 재시도
```

### 문제 2: 인덱스 생성 실패 (CONCURRENTLY 오류)

**증상:**
```
ERROR: canceling statement due to user request
ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
```

**원인:** CONCURRENTLY 옵션은 트랜잭션 블록 내에서 실행 불가

**해결 방법:**
```sql
-- ❌ 잘못된 방법 (BEGIN/COMMIT 내부)
BEGIN;
CREATE INDEX CONCURRENTLY idx_test ON items(item_code);
COMMIT;

-- ✅ 올바른 방법 (트랜잭션 외부)
CREATE INDEX CONCURRENTLY idx_test ON items(item_code);
```

### 문제 3: Materialized View 갱신 실패

**증상:**
```
ERROR: cannot refresh materialized view "mv_daily_stock_calendar" concurrently
HINT: Create a unique index with no WHERE clause on one or more columns of the materialized view.
```

**원인:** UNIQUE 인덱스가 없어서 CONCURRENTLY 갱신 불가

**해결 방법:**
```sql
-- UNIQUE 인덱스 생성 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'mv_daily_stock_calendar'
  AND indexdef LIKE '%UNIQUE%';

-- 없으면 생성
CREATE UNIQUE INDEX idx_mv_daily_stock_pk
  ON mv_daily_stock_calendar (calendar_date, item_id);

-- 이후 CONCURRENTLY 갱신 가능
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_stock_calendar;
```

### 문제 4: 성능 저하 (쿼리 느림)

**증상:** BOM 조회 또는 재고 조회가 500ms 이상 소요

**원인:** 인덱스 미사용 또는 통계 정보 부족

**해결 방법:**
```sql
-- 1. 인덱스 사용 확인
EXPLAIN ANALYZE
SELECT * FROM bom
WHERE parent_item_id = 1 AND is_active = true;
-- "Seq Scan" 대신 "Index Scan" 확인

-- 2. 통계 정보 갱신
ANALYZE bom;
ANALYZE inventory_transactions;
ANALYZE items;

-- 3. 인덱스 재생성 (필요 시)
REINDEX INDEX idx_bom_parent_child_active;

-- 4. VACUUM 실행 (테이블 정리)
VACUUM ANALYZE bom;
```

### 문제 5: API 응답 느림 (>500ms)

**증상:** `/api/stock/daily-calendar` 응답 시간이 500ms 이상

**원인:** Materialized View가 오래되어 갱신이 필요하거나 인덱스 미사용

**해결 방법:**
```sql
-- 1. Materialized View 수동 갱신
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_stock_calendar;

-- 2. 인덱스 사용 확인
EXPLAIN ANALYZE
SELECT * FROM mv_daily_stock_calendar
WHERE calendar_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY calendar_date DESC
LIMIT 100;
-- "Index Scan using idx_mv_daily_stock_date" 확인

-- 3. API 레벨 캐싱 (필요 시)
-- React Query 또는 Next.js 캐싱 적용 고려
```

---

## 📊 예상 성능 개선 지표

### Before (배포 전)

| 쿼리 유형 | 실행 시간 | 방식 |
|-----------|----------|------|
| BOM 조회 (10단계) | 500-1000ms | Sequential Scan |
| 재고 거래 이력 (1개월) | 200-400ms | Sequential Scan + Sort |
| 재고 잔액 계산 | 300-500ms | Full Table Scan |
| 품목 코드 조회 | 50-100ms | Sequential Scan |
| Where-Used 분석 | 300-600ms | Sequential Scan |
| 대시보드 통계 (날짜 범위) | 400-800ms | Multiple Sequential Scans |

### After (배포 후)

| 쿼리 유형 | 실행 시간 | 방식 | 개선율 |
|-----------|----------|------|--------|
| BOM 조회 (10단계) | 30-50ms | Index Scan | **94%** |
| 재고 거래 이력 (1개월) | 50-100ms | Index Scan | **75-80%** |
| 재고 잔액 계산 | 100-150ms | Index Scan + Materialized View | **70%** |
| 품목 코드 조회 | 5-10ms | Index-Only Scan | **90-95%** |
| Where-Used 분석 | 20-40ms | Index Scan | **93-95%** |
| 대시보드 통계 (날짜 범위) | 80-150ms | Index Scan + Materialized View | **80-85%** |

**총 인덱스 크기:** 약 15-25MB (50,000+ BOM 항목 기준)
**인덱스 히트율:** >95% (최적화된 쿼리)
**쓰기 성능 영향:** <5% (읽기 중심 워크로드)

---

## 📞 긴급 연락처 및 롤백 절차

### 긴급 상황 대응

**배포 중 심각한 오류 발생 시:**
1. 즉시 배포 중단
2. 아래 롤백 담당자에게 연락
3. 전체 롤백 스크립트 실행 (하단 참조)

**롤백 담당자:**
- 주 담당자: [이름] ([전화번호]) - 데이터베이스 관리자
- 부 담당자: [이름] ([전화번호]) - 백엔드 개발자
- 긴급 상황: [이름] ([전화번호]) - 시스템 관리자

### 전체 롤백 스크립트 (운영 중단 최소화)

```sql
-- ============================================================================
-- PHASE P0 전체 롤백 (역순 실행)
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: 일일 재고 캘린더 롤백
-- ============================================================================
RAISE NOTICE '일일 재고 캘린더 롤백 시작...';

DROP TRIGGER IF EXISTS trg_refresh_daily_stock ON inventory_transactions;
DROP FUNCTION IF EXISTS refresh_daily_stock_calendar() CASCADE;
DROP INDEX IF EXISTS idx_mv_daily_stock_pk;
DROP INDEX IF EXISTS idx_mv_daily_stock_date;
DROP INDEX IF EXISTS idx_mv_daily_stock_item;
DROP INDEX IF EXISTS idx_mv_daily_stock_value;
DROP MATERIALIZED VIEW IF EXISTS mv_daily_stock_calendar;

RAISE NOTICE '✅ 일일 재고 캘린더 롤백 완료';

-- ============================================================================
-- Step 2: 성능 인덱스 롤백 (CONCURRENTLY 제거 후)
-- ============================================================================
RAISE NOTICE '성능 인덱스 롤백 시작...';

-- ⚠️ DROP INDEX는 트랜잭션 외부에서 CONCURRENTLY로 실행 권장
-- 이 스크립트는 긴급 롤백용으로 CONCURRENTLY 없이 실행

DROP INDEX IF EXISTS idx_bom_parent_child_active CASCADE;
DROP INDEX IF EXISTS idx_bom_active_level CASCADE;
DROP INDEX IF EXISTS idx_bom_child_active CASCADE;
DROP INDEX IF EXISTS idx_bom_updated_at CASCADE;
DROP INDEX IF EXISTS idx_inventory_item_date CASCADE;
DROP INDEX IF EXISTS idx_inventory_type_date CASCADE;
DROP INDEX IF EXISTS idx_inventory_date_range CASCADE;
DROP INDEX IF EXISTS idx_inventory_reference CASCADE;
DROP INDEX IF EXISTS idx_items_code_active CASCADE;
DROP INDEX IF EXISTS idx_items_name_trgm CASCADE;
DROP INDEX IF EXISTS idx_bom_deduction_transaction CASCADE;
DROP INDEX IF EXISTS idx_bom_deduction_child_item CASCADE;
DROP VIEW IF EXISTS v_index_usage_stats CASCADE;
DROP FUNCTION IF EXISTS analyze_index_performance() CASCADE;

-- 기존 인덱스 복원
CREATE INDEX idx_bom_parent ON bom(parent_item_id) WHERE is_active = true;
CREATE INDEX idx_bom_child ON bom(child_item_id) WHERE is_active = true;

RAISE NOTICE '✅ 성능 인덱스 롤백 완료';

-- ============================================================================
-- Step 3: BOM 자동 차감 시스템 롤백
-- ============================================================================
RAISE NOTICE 'BOM 자동 차감 시스템 롤백 시작...';

DROP TRIGGER IF EXISTS trg_auto_deduct_bom ON inventory_transactions CASCADE;
DROP FUNCTION IF EXISTS auto_deduct_bom_materials() CASCADE;
DROP TABLE IF EXISTS bom_deduction_log CASCADE;
DROP INDEX IF EXISTS idx_bom_parent_child;
DROP INDEX IF EXISTS idx_bom_deduction_log_transaction;
DROP INDEX IF EXISTS idx_bom_deduction_log_parent;
DROP INDEX IF EXISTS idx_bom_deduction_log_child;
DROP INDEX IF EXISTS idx_bom_deduction_log_created;
DROP INDEX IF EXISTS idx_items_active_stock;

RAISE NOTICE '✅ BOM 자동 차감 시스템 롤백 완료';

-- ============================================================================
-- 검증: 롤백 완료 확인
-- ============================================================================
DO $$
DECLARE
  v_remaining_objects INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_remaining_objects
  FROM (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'bom_deduction_log'
    UNION ALL
    SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trg_auto_deduct_bom'
    UNION ALL
    SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trg_refresh_daily_stock'
    UNION ALL
    SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_daily_stock_calendar'
  ) AS objects;

  IF v_remaining_objects > 0 THEN
    RAISE EXCEPTION '롤백 검증 실패: % 개의 객체가 남아있습니다', v_remaining_objects;
  ELSE
    RAISE NOTICE '✅ 모든 PHASE P0 객체가 성공적으로 제거되었습니다';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- 롤백 후 필수 작업
-- ============================================================================
-- 1. 통계 정보 갱신
ANALYZE items;
ANALYZE bom;
ANALYZE inventory_transactions;

-- 2. 테이블 정리
VACUUM ANALYZE items;
VACUUM ANALYZE bom;
VACUUM ANALYZE inventory_transactions;

-- 3. 시스템 상태 확인
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('items', 'bom', 'inventory_transactions')
ORDER BY tablename;
```

---

## 📝 배포 체크리스트 (인쇄용)

### 배포 전 (Pre-Deployment)
- [ ] 데이터베이스 백업 완료 (파일명: `________________`)
- [ ] 백업 파일 크기 확인 (최소 1MB 이상)
- [ ] 테스트 환경 검증 완료
- [ ] 롤백 담당자 연락 가능 상태 확인
- [ ] 성능 베이스라인 측정 완료

### 배포 중 (Deployment)
- [ ] Step 1: BOM 자동 차감 마이그레이션 실행
- [ ] Step 1 검증: 테이블/트리거/인덱스 생성 확인
- [ ] Step 1 기능 테스트: 단순 BOM 차감 성공
- [ ] Step 2: 성능 인덱스 마이그레이션 실행
- [ ] Step 2 검증: 12개 인덱스 생성 확인
- [ ] Step 2 성능 테스트: BOM 조회 94% 개선 확인
- [ ] Step 3: 일일 재고 캘린더 마이그레이션 실행
- [ ] Step 3 검증: Materialized View 데이터 확인
- [ ] Step 3 API 테스트: 엔드포인트 응답 확인

### 배포 후 (Post-Deployment)
- [ ] 시스템 헬스 체크: 모든 컴포넌트 `✅ OK`
- [ ] BOM 자동 차감 통합 테스트 성공
- [ ] 성능 지표 확인: 인덱스 사용률 >95%
- [ ] API 엔드포인트 테스트: 응답 시간 <200ms
- [ ] 자동 갱신 트리거 테스트 성공
- [ ] 운영 팀에 배포 완료 통보

### 롤백 (필요 시)
- [ ] 롤백 결정 승인
- [ ] 전체 롤백 스크립트 실행
- [ ] 롤백 검증: 모든 객체 제거 확인
- [ ] 통계 정보 갱신 (ANALYZE)
- [ ] 테이블 정리 (VACUUM)
- [ ] 시스템 상태 확인

---

## 📚 참고 자료

### 관련 문서
- **BOM 자동 차감 가이드:** `BOM_AUTO_DEDUCTION_GUIDE.md`
- **데이터베이스 최적화 가이드:** `DATABASE_OPTIMIZATION_QUICK_GUIDE.md`
- **Supabase MCP 설정:** `SUPABASE_MCP_SETUP.md`
- **프로젝트 CLAUDE.md:** `CLAUDE.md`

### 마이그레이션 파일
- `supabase/migrations/20250115_bom_auto_deduction.sql`
- `supabase/migrations/20250115_bom_performance_indexes.sql`
- `supabase/migrations/20250129_daily_stock_tracking.sql`

### API 엔드포인트
- **일일 재고 캘린더:** `GET /api/stock/daily-calendar`
- **BOM 조회:** `GET /api/bom`
- **재고 거래:** `GET /api/inventory/production`

### 데이터베이스 객체
- **테이블:** `bom_deduction_log`
- **Materialized View:** `mv_daily_stock_calendar`
- **트리거:** `trg_auto_deduct_bom`, `trg_refresh_daily_stock`
- **함수:** `auto_deduct_bom_materials()`, `refresh_daily_stock_calendar()`

---

**작성일:** 2025-10-15
**버전:** 1.0
**작성자:** Technical Writing Specialist
**승인자:** [승인자 이름]
**배포 환경:** Supabase PostgreSQL 14+ (Cloud)

---

## 💡 배포 팁

1. **점진적 배포:** 개발 환경 → 스테이징 환경 → 운영 환경 순서로 단계적 배포 권장
2. **모니터링:** 배포 후 24시간 동안 성능 지표 및 에러 로그 집중 모니터링
3. **문서화:** 배포 과정에서 발견된 이슈 및 해결 방법을 이 문서에 추가
4. **백업 보관:** 배포 전 백업 파일을 최소 30일간 안전하게 보관
5. **팀 공유:** 배포 완료 후 변경사항을 모든 개발/운영 팀원에게 공유

**문의사항:** [이메일 주소] 또는 [Slack 채널]
