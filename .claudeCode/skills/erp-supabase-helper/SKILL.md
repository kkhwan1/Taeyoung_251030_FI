---
name: erp-supabase-helper
description: Supabase query pattern expert for ERP system. Master of db-unified Domain Helpers, SupabaseQueryBuilder, and JSONB queries. Use this skill when implementing database operations, complex queries, or optimizing Supabase interactions.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Bash
metadata:
  project: TaeYoungERP
  database: Supabase PostgreSQL
  library: "@supabase/supabase-js@2.58.0"
  version: "1.0.0"
---

# ERP Supabase Helper Expert

**태창 ERP 시스템**의 Supabase 데이터베이스 쿼리 전문 스킬입니다. `db-unified.ts`의 4가지 쿼리 방법을 마스터하고 최적의 패턴을 선택합니다.

## 🎯 4가지 쿼리 방법 선택 가이드

| 상황 | 추천 방법 | 복잡도 | 성능 |
|------|----------|--------|------|
| 기본 CRUD | **Domain Helpers** | ⭐ | ⚡⚡⚡ |
| 동적 필터/검색 | **SupabaseQueryBuilder** | ⭐⭐ | ⚡⚡⚡ |
| 간단한 JOIN | **Supabase Client** | ⭐⭐ | ⚡⚡ |
| 복잡한 집계/분석 | **Supabase MCP** | ⭐⭐⭐ | ⚡ |

## 방법 1: Domain Helpers (가장 간단, 추천) ⭐⭐⭐

### 개요
타입 안전하고 간결한 CRUD 작업을 위한 도메인별 헬퍼 함수들입니다.

### 사용 가능한 Domain Helpers

```typescript
import { db } from '@/lib/db-unified';

// 사용 가능한 도메인
db.items.*           // 품목 관리
db.companies.*       // 거래처 관리
db.transactions.*    // 거래 관리
db.bom.*             // BOM 관리
```

### 기본 CRUD 패턴

#### 1. 전체 조회 (getAll)

```typescript
import { db } from '@/lib/db-unified';

// 전체 조회
const items = await db.items.getAll();

// 필터링
const activeItems = await db.items.getAll({
  filters: { is_active: true }
});

// 정렬
const sortedItems = await db.items.getAll({
  orderBy: { field: 'item_name', ascending: true }
});

// 필터 + 정렬
const filtered = await db.items.getAll({
  filters: { is_active: true, category: 'Parts' },
  orderBy: { field: 'item_name', ascending: true }
});
```

#### 2. 단일 조회 (getById)

```typescript
// ID로 조회
const item = await db.items.getById('item-uuid-here');

if (!item) {
  throw new Error('품목을 찾을 수 없습니다');
}

console.log(item.item_name); // 타입 안전
```

#### 3. 생성 (create)

```typescript
// 새 품목 생성
const newItem = await db.items.create({
  item_name: '신규부품',
  item_code: 'NEW001',
  spec: 'SPEC-001',
  unit_price: 10000,
  current_stock: 100,
  is_active: true
});

console.log('생성됨:', newItem.item_id);
```

#### 4. 업데이트 (update)

```typescript
// 품목 수정
const updated = await db.items.update('item-uuid-here', {
  item_name: '수정된 부품명',
  unit_price: 12000,
  current_stock: 150
});

if (!updated) {
  throw new Error('업데이트 실패');
}
```

#### 5. 소프트 삭제 (delete)

```typescript
// is_active = false로 설정
const deleted = await db.items.delete('item-uuid-here');

console.log('삭제됨:', deleted);
```

### 거래처 관리 예시

```typescript
import { db } from '@/lib/db-unified';

// 고객사만 조회
const customers = await db.companies.getAll({
  filters: { company_type: '고객사', is_active: true }
});

// 중복 코드 확인
const isDuplicate = await db.companies.checkDuplicateCode('CUS001');

if (isDuplicate) {
  throw new Error('이미 존재하는 거래처 코드입니다');
}

// 새 고객사 생성
const newCustomer = await db.companies.create({
  company_name: '삼성전자',
  company_code: 'CUS001',
  company_type: '고객사',
  business_number: '123-45-67890',
  is_active: true
});
```

## 방법 2: SupabaseQueryBuilder (동적 쿼리) ⭐⭐

### 개요
복잡한 필터링, 검색, 페이지네이션을 지원하는 쿼리 빌더입니다.

### 기본 사용법

```typescript
import { SupabaseQueryBuilder } from '@/lib/db-unified';

const queryBuilder = new SupabaseQueryBuilder();

// 복잡한 쿼리
const result = await queryBuilder.select('items', {
  filters: { is_active: true, category: 'Parts' },
  search: { field: 'item_name', value: '부품' },
  pagination: { page: 1, limit: 20 },
  orderBy: { field: 'item_name', ascending: true }
});

console.log('데이터:', result.data);
console.log('페이지 정보:', result.pagination);
```

### 고급 기능

#### 1. 다중 필터 + 검색

```typescript
const result = await queryBuilder.select('sales_transactions', {
  filters: {
    payment_status: 'PENDING',
    is_active: true
  },
  search: {
    field: 'transaction_no',
    value: 'SA-2025'
  },
  pagination: {
    page: 1,
    limit: 50
  },
  orderBy: {
    field: 'transaction_date',
    ascending: false
  }
});

// 응답 구조
{
  data: [...],
  pagination: {
    page: 1,
    limit: 50,
    totalCount: 150,
    totalPages: 3
  }
}
```

#### 2. 데이터 삽입 (자동 에러 처리)

```typescript
const insertResult = await queryBuilder.insert('items', {
  item_name: '신규부품',
  item_code: 'NEW001',
  spec: 'SPEC-001',
  is_active: true
});

if (insertResult.error) {
  console.error('삽입 실패:', insertResult.error);
} else {
  console.log('생성됨:', insertResult.data);
}
```

#### 3. 업데이트

```typescript
const updateResult = await queryBuilder.update('items', itemId, {
  item_name: '수정된 부품명',
  unit_price: 15000
});

if (updateResult.error) {
  console.error('업데이트 실패:', updateResult.error);
}
```

#### 4. 소프트 삭제

```typescript
// is_active = false로 설정
const deleteResult = await queryBuilder.delete('items', itemId, true);

if (deleteResult.success) {
  console.log('삭제 성공');
}
```

### API Route 통합 패턴

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { SupabaseQueryBuilder } from '@/lib/db-unified';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const queryBuilder = new SupabaseQueryBuilder();

  // 쿼리 파라미터 파싱
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';

  // 동적 필터 구성
  const filters: any = { is_active: true };
  if (category) filters.category = category;

  // 쿼리 실행
  const result = await queryBuilder.select('items', {
    filters,
    search: search ? { field: 'item_name', value: search } : undefined,
    pagination: { page, limit },
    orderBy: { field: 'item_name', ascending: true }
  });

  return NextResponse.json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
}
```

## 방법 3: Supabase Client 직접 사용 ⭐⭐

### 간단한 쿼리

```typescript
import { getSupabaseClient } from '@/lib/db-unified';

const supabase = getSupabaseClient();

// SELECT
const { data, error } = await supabase
  .from('items')
  .select('*')
  .eq('is_active', true)
  .order('item_name');

if (error) throw error;
```

### JOIN 쿼리

#### 1. 단일 JOIN

```typescript
// 매출 거래 + 고객사 정보
const { data } = await supabase
  .from('sales_transactions')
  .select(`
    *,
    customer:companies!customer_id(
      company_name,
      business_number
    )
  `)
  .eq('is_active', true);

// 결과 사용
data.forEach(transaction => {
  console.log('고객:', transaction.customer.company_name);
  console.log('금액:', transaction.total_amount);
});
```

#### 2. 다중 JOIN

```typescript
// BOM + 품목 + 공급사
const { data } = await supabase
  .from('bom')
  .select(`
    *,
    parent_item:items!parent_item_id(
      item_name,
      item_code
    ),
    child_item:items!child_item_id(
      item_name,
      spec,
      supplier:companies!supplier_id(
        company_name
      )
    )
  `)
  .eq('is_active', true);

// 결과 구조
{
  parent_item: { item_name: '완제품A', item_code: 'FG001' },
  child_item: {
    item_name: '부품B',
    spec: 'SPEC-001',
    supplier: { company_name: '공급사X' }
  },
  quantity: 5,
  unit: 'EA'
}
```

### 집계 함수

```typescript
// COUNT
const { count } = await supabase
  .from('items')
  .select('*', { count: 'exact', head: true })
  .eq('is_active', true);

console.log('총 품목 수:', count);

// SUM (PostgreSQL 함수 사용)
const { data } = await supabase
  .rpc('calculate_total_stock_value');
```

### 범위 쿼리

```typescript
// 날짜 범위
const { data } = await supabase
  .from('sales_transactions')
  .select('*')
  .gte('transaction_date', '2025-01-01')
  .lte('transaction_date', '2025-01-31')
  .order('transaction_date', { ascending: false });

// 가격 범위
const { data } = await supabase
  .from('items')
  .select('*')
  .gte('unit_price', 10000)
  .lte('unit_price', 50000);
```

## 방법 4: Supabase MCP (복잡한 쿼리) ⭐⭐⭐

### 언제 사용하나?
- 다중 테이블 JOIN + 집계
- 윈도우 함수 (ROW_NUMBER, RANK 등)
- 복잡한 GROUP BY + HAVING
- CTE (Common Table Expressions)
- 고급 PostgreSQL 기능

### 기본 사용법

```typescript
import { mcp__supabase__execute_sql } from '@/lib/supabase-mcp';

const result = await mcp__supabase__execute_sql({
  project_id: process.env.SUPABASE_PROJECT_ID!,
  query: `
    SELECT
      i.item_id,
      i.item_name,
      i.current_stock,
      c.company_name as supplier_name,
      COUNT(t.transaction_id) as transaction_count,
      SUM(t.quantity) as total_quantity
    FROM items i
    LEFT JOIN companies c ON i.supplier_id = c.company_id
    LEFT JOIN inventory_transactions t ON i.item_id = t.item_id
    WHERE i.is_active = true
    GROUP BY i.item_id, i.item_name, i.current_stock, c.company_name
    ORDER BY i.item_name
  `
});

console.log('결과:', result.data);
```

### 윈도우 함수 예시

```typescript
const result = await mcp__supabase__execute_sql({
  project_id: process.env.SUPABASE_PROJECT_ID!,
  query: `
    SELECT
      item_name,
      category,
      unit_price,
      ROW_NUMBER() OVER (
        PARTITION BY category
        ORDER BY unit_price DESC
      ) as price_rank
    FROM items
    WHERE is_active = true
    ORDER BY category, price_rank
  `
});

// 카테고리별 가격 순위
```

### CTE (Common Table Expression) 예시

```typescript
const result = await mcp__supabase__execute_sql({
  project_id: process.env.SUPABASE_PROJECT_ID!,
  query: `
    WITH monthly_sales AS (
      SELECT
        DATE_TRUNC('month', transaction_date) as month,
        SUM(total_amount) as total
      FROM sales_transactions
      WHERE is_active = true
      GROUP BY DATE_TRUNC('month', transaction_date)
    ),
    monthly_avg AS (
      SELECT AVG(total) as avg_monthly_sales
      FROM monthly_sales
    )
    SELECT
      ms.month,
      ms.total,
      ma.avg_monthly_sales,
      CASE
        WHEN ms.total > ma.avg_monthly_sales THEN '평균 이상'
        ELSE '평균 이하'
      END as performance
    FROM monthly_sales ms
    CROSS JOIN monthly_avg ma
    ORDER BY ms.month DESC
  `
});
```

## JSONB 필드 쿼리 패턴

### business_info 구조

```typescript
business_info: {
  business_type?: string;      // 업종 (예: 제조업)
  business_item?: string;      // 업태 (예: 철강)
  main_products?: string;      // 주요 취급 품목
}
```

### JSONB 쿼리 방법

#### 1. contains 연산자

```typescript
// JSONB 필드 내 검색 (GIN 인덱스 최적화)
const { data } = await supabase
  .from('companies')
  .select('*')
  .contains('business_info', { business_type: '제조업' });
```

#### 2. 화살표 연산자 (->)

```typescript
// SQL 직접 실행
const result = await mcp__supabase__execute_sql({
  project_id: process.env.SUPABASE_PROJECT_ID!,
  query: `
    SELECT
      company_name,
      business_info->>'business_type' as business_type,
      business_info->>'business_item' as business_item
    FROM companies
    WHERE business_info->>'business_type' = '제조업'
  `
});
```

#### 3. JSONB 집계

```typescript
const result = await mcp__supabase__execute_sql({
  project_id: process.env.SUPABASE_PROJECT_ID!,
  query: `
    SELECT
      business_info->>'business_type' as type,
      COUNT(*) as count
    FROM companies
    WHERE is_active = true
    GROUP BY business_info->>'business_type'
    ORDER BY count DESC
  `
});
```

## 에러 처리 패턴

### handleSupabaseError 사용

```typescript
import { handleSupabaseError } from '@/lib/db-unified';

try {
  const { data, error } = await supabase
    .from('items')
    .select('*');

  if (error) {
    return handleSupabaseError('select', 'items', error);
  }

  return NextResponse.json({
    success: true,
    data
  });
} catch (error) {
  return handleSupabaseError('select', 'items', error);
}
```

### 커스텀 에러 처리

```typescript
try {
  const item = await db.items.getById(itemId);

  if (!item) {
    return NextResponse.json({
      success: false,
      error: '품목을 찾을 수 없습니다'
    }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: item
  });
} catch (error) {
  console.error('Error fetching item:', error);

  return NextResponse.json({
    success: false,
    error: error instanceof Error ? error.message : '알 수 없는 오류'
  }, { status: 500 });
}
```

## 성능 최적화

### 1. SELECT 컬럼 명시

```typescript
// ❌ 나쁜 예 - 모든 컬럼 조회
const { data } = await supabase
  .from('items')
  .select('*');

// ✅ 좋은 예 - 필요한 컬럼만
const { data } = await supabase
  .from('items')
  .select('item_id, item_name, unit_price, current_stock');
```

### 2. 인덱스 활용

```typescript
// is_active, category 컬럼에 인덱스가 있다면
const { data } = await supabase
  .from('items')
  .select('*')
  .eq('is_active', true)  // 인덱스 사용
  .eq('category', 'Parts'); // 인덱스 사용
```

### 3. LIMIT 사용

```typescript
// 대용량 데이터는 페이지네이션 필수
const { data } = await supabase
  .from('items')
  .select('*')
  .range(0, 99); // 100개만 조회
```

### 4. 불필요한 JOIN 제거

```typescript
// ✅ 필요한 JOIN만
const { data } = await supabase
  .from('sales_transactions')
  .select(`
    transaction_id,
    total_amount,
    customer:companies!customer_id(company_name)
  `); // 고객사 이름만 필요
```

## 트랜잭션 패턴

### RPC 함수 사용 (추천)

```sql
-- Supabase에서 RPC 함수 생성
CREATE OR REPLACE FUNCTION create_transaction_with_stock_update(
  p_item_id uuid,
  p_quantity integer,
  p_transaction_type text
)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  -- 재고 업데이트
  UPDATE items
  SET current_stock = current_stock + p_quantity
  WHERE item_id = p_item_id;

  -- 거래 생성
  INSERT INTO inventory_transactions (item_id, quantity, transaction_type)
  VALUES (p_item_id, p_quantity, p_transaction_type)
  RETURNING json_build_object('transaction_id', transaction_id) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

```typescript
// RPC 호출
const { data, error } = await supabase
  .rpc('create_transaction_with_stock_update', {
    p_item_id: itemId,
    p_quantity: 100,
    p_transaction_type: 'IN'
  });
```

## 체크리스트

### 쿼리 방법 선택 시

- [ ] **Domain Helpers**: 단순 CRUD인가?
- [ ] **SupabaseQueryBuilder**: 동적 필터/검색이 필요한가?
- [ ] **Supabase Client**: JOIN이 필요한가?
- [ ] **Supabase MCP**: 복잡한 집계/윈도우 함수가 필요한가?

### 성능 최적화

- [ ] 필요한 컬럼만 SELECT
- [ ] 인덱스가 있는 컬럼으로 필터링
- [ ] LIMIT/페이지네이션 사용
- [ ] 불필요한 JOIN 제거
- [ ] JSONB 쿼리 시 GIN 인덱스 확인

### 에러 처리

- [ ] `handleSupabaseError` 사용
- [ ] null 체크
- [ ] try-catch 구현
- [ ] 의미 있는 에러 메시지

## 관련 문서

- [src/lib/db-unified.ts](../../../src/lib/db-unified.ts) - 핵심 데이터베이스 레이어
- [CLAUDE.md](../../../CLAUDE.md) - 프로젝트 전체 가이드
- [Supabase 공식 문서](https://supabase.com/docs)

---

**Last Updated**: 2025-10-19
**Library**: @supabase/supabase-js@2.58.0
**프로젝트**: 태창 ERP 시스템
