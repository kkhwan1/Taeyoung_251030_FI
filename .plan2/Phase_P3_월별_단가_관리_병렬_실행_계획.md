# Phase P3: 월별 단가 관리 및 재고 금액 추적 시스템 (병렬 실행 계획)

## 📋 요구사항 분석 (대화 내용 기반)

### 핵심 요구사항
1. **월별 단가 변동 추적**: 부품 특성상 월마다 단가가 다름 (예: 10월 1,000원 → 11월 1,100원)
2. **중량→금액 환산**: 단가를 곱하여 중량(kg)을 금액(₩)으로 변환
3. **재고 금액 계산**: 업체별/품목별/카테고리별 재고 금액 자동 계산
4. **월별 집계**: 매출/매입/수금/지급 + 재고 금액의 월별 추이 분석
5. **엑셀 대체**: 현재 Excel 10개 시트 + 복잡한 수식을 웹 ERP로 전환

### 현재 Excel 워크플로우 (대체 대상)
- **정리 보드**: 업체별/구분별 금액 정리 (고객사/협력사/원자재/부자재/완제품)
- **월별 집계**: 1일~30일 매출/매입/수금 + 재고 현황
- **단가 관리**: 월마다 단가 수정 시 해당 월부터 적용
- **재고 금액**: 현재고 × 단가 = 재고 금액 (업체별/품목별)

## 🎯 목표

**MVP 기능**: 월별 단가 관리 + 재고 금액 자동 계산 + 월별 재무 대시보드

## 📊 3-Wave 병렬 실행 전략

### Wave 1: 데이터베이스 스키마 + 단가 이력 API (3-4일)
- **목적**: 월별 단가 이력 저장 구조 + CRUD API 구축
- **병렬 작업**: 5개 태스크 동시 진행

### Wave 2: 재고 금액 계산 엔진 + 월별 집계 로직 (4-5일)
- **목적**: 재고 금액 자동 계산 + 카테고리별 집계 + Excel 대체 로직
- **병렬 작업**: 3개 태스크 동시 진행

### Wave 3: 프론트엔드 대시보드 + 엑셀 Export (4-5일)
- **목적**: 월별 단가 관리 UI + 재고 금액 대시보드 + 정리 보드 화면
- **병렬 작업**: 3개 태스크 동시 진행

### Integration & Testing (1일)
- **목적**: E2E 테스트 + 기존 데이터 마이그레이션 + 성능 검증

**총 예상 기간**: 12-15일 (병렬 실행 기준)

---

## 📋 Wave 1: 데이터베이스 + 단가 이력 API (3-4일)

### Task 1.1: 월별 단가 이력 테이블 생성 (supabase-schema-architect)
**담당 에이전트**: `supabase-schema-architect`
**우선순위**: P0 (차단 조건)
**소요 시간**: 6-8시간

#### 작업 내용
1. `item_price_history` 테이블 생성 (월별 단가 이력)
2. `stock_valuation_monthly` 뷰 생성 (월별 재고 금액 집계)
3. 인덱스 최적화 (월별 조회 성능)

#### 데이터베이스 마이그레이션
```sql
-- supabase/migrations/20250116_create_item_price_history.sql

-- 1. 월별 단가 이력 테이블
CREATE TABLE item_price_history (
  price_history_id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,

  -- 월별 단가 (기준일: 매월 1일)
  price_month DATE NOT NULL,  -- 예: 2025-10-01, 2025-11-01
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),

  -- 중량 기반 단가 (코일 등)
  price_per_kg DECIMAL(15,2) DEFAULT NULL CHECK (price_per_kg >= 0 OR price_per_kg IS NULL),

  -- 메타데이터
  note TEXT,  -- 단가 변경 사유
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100),

  -- 월별 단가는 한 품목당 한 달에 하나씩만
  UNIQUE(item_id, price_month)
);

-- 2. 인덱스: 월별 조회 최적화
CREATE INDEX idx_price_history_month ON item_price_history(price_month DESC);
CREATE INDEX idx_price_history_item_month ON item_price_history(item_id, price_month DESC);

-- 3. 트리거: updated_at 자동 갱신
CREATE TRIGGER update_price_history_timestamp
  BEFORE UPDATE ON item_price_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. PostgreSQL View: 월별 재고 금액 집계
CREATE OR REPLACE VIEW v_stock_valuation_monthly AS
SELECT
  DATE_TRUNC('month', CURRENT_DATE) AS valuation_month,
  i.item_id,
  i.item_code,
  i.item_name,
  i.category,
  i.current_stock,
  c.company_name AS supplier_name,
  c.company_category,

  -- 최신 단가 (해당 월 or 가장 최근 과거 단가)
  COALESCE(
    (SELECT unit_price
     FROM item_price_history iph
     WHERE iph.item_id = i.item_id
       AND iph.price_month <= DATE_TRUNC('month', CURRENT_DATE)
     ORDER BY iph.price_month DESC
     LIMIT 1),
    i.unit_price  -- 기본값: items 테이블의 unit_price
  ) AS current_unit_price,

  -- 재고 금액 = 현재고 × 단가
  i.current_stock * COALESCE(
    (SELECT unit_price
     FROM item_price_history iph
     WHERE iph.item_id = i.item_id
       AND iph.price_month <= DATE_TRUNC('month', CURRENT_DATE)
     ORDER BY iph.price_month DESC
     LIMIT 1),
    i.unit_price
  ) AS stock_value

FROM items i
LEFT JOIN companies c ON i.supplier_id = c.company_id
WHERE i.is_active = true AND i.current_stock > 0;

-- 5. 카테고리별 재고 금액 집계 뷰
CREATE OR REPLACE VIEW v_stock_value_by_category AS
SELECT
  DATE_TRUNC('month', CURRENT_DATE) AS valuation_month,

  -- 카테고리별 집계
  CASE
    WHEN c.company_category = '협력업체-원자재' THEN '원자재'
    WHEN c.company_category = '협력업체-외주' THEN '부자재'
    WHEN i.category LIKE '%완제품%' THEN '완제품'
    WHEN i.category LIKE '%반제품%' THEN '공정재고'
    ELSE '기타'
  END AS inventory_category,

  COUNT(DISTINCT i.item_id) AS item_count,
  SUM(i.current_stock) AS total_quantity,
  SUM(i.current_stock * COALESCE(
    (SELECT unit_price
     FROM item_price_history iph
     WHERE iph.item_id = i.item_id
       AND iph.price_month <= DATE_TRUNC('month', CURRENT_DATE)
     ORDER BY iph.price_month DESC
     LIMIT 1),
    i.unit_price
  )) AS total_value

FROM items i
LEFT JOIN companies c ON i.supplier_id = c.company_id
WHERE i.is_active = true AND i.current_stock > 0
GROUP BY inventory_category;

COMMENT ON TABLE item_price_history IS '품목별 월별 단가 이력 추적';
COMMENT ON VIEW v_stock_valuation_monthly IS '월별 재고 금액 평가 (품목별)';
COMMENT ON VIEW v_stock_value_by_category IS '카테고리별 재고 금액 집계 (원자재/부자재/완제품/공정재고)';
```

#### 검증 기준
- [ ] 테이블 생성 성공 (item_price_history)
- [ ] 뷰 2개 생성 성공 (v_stock_valuation_monthly, v_stock_value_by_category)
- [ ] 인덱스 생성 확인 (EXPLAIN ANALYZE로 성능 검증)
- [ ] 제약 조건 테스트 (UNIQUE, CHECK 제약)

---

### Task 1.2: 단가 이력 CRUD API 구현 (backend-architect)
**담당 에이전트**: `backend-architect`
**우선순위**: P0
**소요 시간**: 8-10시간

#### API 엔드포인트 (4개)

##### 1. GET /api/price-history/[itemId]
**기능**: 특정 품목의 단가 이력 조회 (월별)

```typescript
// src/app/api/price-history/[itemId]/route.ts
import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params;
    const { searchParams } = new URL(request.url);
    const startMonth = searchParams.get('start_month'); // 예: 2025-01-01
    const endMonth = searchParams.get('end_month');     // 예: 2025-12-01

    const supabase = getSupabaseClient();
    let query = supabase
      .from('item_price_history')
      .select(`
        *,
        item:items!inner(item_code, item_name, spec, category)
      `)
      .eq('item_id', itemId)
      .order('price_month', { ascending: false });

    if (startMonth) {
      query = query.gte('price_month', startMonth);
    }
    if (endMonth) {
      query = query.lte('price_month', endMonth);
    }

    const { data, error } = await query;

    if (error) {
      return Response.json(
        handleSupabaseError('select', 'item_price_history', error),
        { status: 500 }
      );
    }

    return Response.json(
      createSuccessResponse({
        history: data,
        item_id: itemId,
        period: { start: startMonth, end: endMonth }
      })
    );
  } catch (error) {
    console.error('[API] price-history GET error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

##### 2. GET /api/price-history/current
**기능**: 현재 월 기준 모든 품목의 단가 조회

```typescript
// src/app/api/price-history/current/route.ts
import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetMonth = searchParams.get('month') ||
      new Date().toISOString().slice(0, 7) + '-01'; // 예: 2025-10-01

    const category = searchParams.get('category');
    const supplierId = searchParams.get('supplier_id');

    const supabase = getSupabaseClient();

    // 현재 월 단가 조회 (없으면 가장 최근 과거 단가)
    const { data, error } = await supabase.rpc('get_current_item_prices', {
      p_target_month: targetMonth,
      p_category: category,
      p_supplier_id: supplierId ? parseInt(supplierId) : null
    });

    if (error) {
      return Response.json(
        handleSupabaseError('rpc', 'get_current_item_prices', error),
        { status: 500 }
      );
    }

    return Response.json(
      createSuccessResponse({
        items: data,
        target_month: targetMonth,
        total_items: data?.length || 0
      })
    );
  } catch (error) {
    console.error('[API] current prices GET error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

##### 3. POST /api/price-history
**기능**: 월별 단가 등록 (단일 or 대량)

```typescript
// src/app/api/price-history/route.ts
import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';

interface PriceHistoryInput {
  item_id: number;
  price_month: string;  // YYYY-MM-01 형식
  unit_price: number;
  price_per_kg?: number;
  note?: string;
  created_by?: string;
}

export async function POST(request: NextRequest) {
  try {
    // ✅ CRITICAL: 한글 인코딩 패턴 (모든 POST API 필수!)
    const text = await request.text();
    const body = JSON.parse(text);

    const supabase = getSupabaseClient();

    // 단일 등록 vs 대량 등록
    const isArray = Array.isArray(body.prices);
    const prices: PriceHistoryInput[] = isArray ? body.prices : [body];

    // 대량 등록: UPSERT 사용 (충돌 시 UPDATE)
    const { data, error } = await supabase
      .from('item_price_history')
      .upsert(
        prices.map(p => ({
          ...p,
          updated_at: new Date().toISOString()
        })),
        {
          onConflict: 'item_id,price_month',
          ignoreDuplicates: false  // 중복 시 UPDATE
        }
      )
      .select();

    if (error) {
      return Response.json(
        handleSupabaseError('upsert', 'item_price_history', error),
        { status: 500 }
      );
    }

    return Response.json(
      createSuccessResponse({
        prices: data,
        count: data?.length || 0,
        message: `${data?.length || 0}개 품목 단가 ${isArray ? '대량 ' : ''}등록 완료`
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] price-history POST error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

##### 4. PUT /api/price-history/[priceHistoryId]
**기능**: 단가 이력 수정

```typescript
// src/app/api/price-history/[priceHistoryId]/route.ts
import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';

export async function PUT(
  request: NextRequest,
  { params }: { params: { priceHistoryId: string } }
) {
  try {
    const { priceHistoryId } = params;

    // ✅ 한글 인코딩 패턴
    const text = await request.text();
    const body = JSON.parse(text);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('item_price_history')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('price_history_id', priceHistoryId)
      .select()
      .single();

    if (error) {
      return Response.json(
        handleSupabaseError('update', 'item_price_history', error),
        { status: 500 }
      );
    }

    return Response.json(createSuccessResponse(data));
  } catch (error) {
    console.error('[API] price-history PUT error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### PostgreSQL 함수: get_current_item_prices
```sql
-- supabase/migrations/20250116_create_price_functions.sql
CREATE OR REPLACE FUNCTION get_current_item_prices(
  p_target_month DATE,
  p_category TEXT DEFAULT NULL,
  p_supplier_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
  item_id INTEGER,
  item_code VARCHAR,
  item_name VARCHAR,
  spec VARCHAR,
  category VARCHAR,
  current_stock INTEGER,
  supplier_name VARCHAR,
  unit_price DECIMAL(15,2),
  price_month DATE,
  is_historical BOOLEAN  -- true면 과거 단가, false면 현재 월 단가
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.item_id,
    i.item_code,
    i.item_name,
    i.spec,
    i.category,
    i.current_stock,
    c.company_name AS supplier_name,

    -- 현재 월 단가 or 가장 최근 과거 단가
    COALESCE(
      (SELECT iph.unit_price
       FROM item_price_history iph
       WHERE iph.item_id = i.item_id
         AND iph.price_month <= p_target_month
       ORDER BY iph.price_month DESC
       LIMIT 1),
      i.unit_price  -- 기본값
    ) AS unit_price,

    COALESCE(
      (SELECT iph.price_month
       FROM item_price_history iph
       WHERE iph.item_id = i.item_id
         AND iph.price_month <= p_target_month
       ORDER BY iph.price_month DESC
       LIMIT 1),
      NULL
    ) AS price_month,

    -- 과거 단가인지 여부
    COALESCE(
      (SELECT iph.price_month < p_target_month
       FROM item_price_history iph
       WHERE iph.item_id = i.item_id
         AND iph.price_month <= p_target_month
       ORDER BY iph.price_month DESC
       LIMIT 1),
      false
    ) AS is_historical

  FROM items i
  LEFT JOIN companies c ON i.supplier_id = c.company_id
  WHERE i.is_active = true
    AND (p_category IS NULL OR i.category = p_category)
    AND (p_supplier_id IS NULL OR i.supplier_id = p_supplier_id)
  ORDER BY i.item_code;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_current_item_prices IS '지정 월 기준 품목별 현재 단가 조회 (없으면 가장 최근 과거 단가)';
```

#### 검증 기준
- [ ] 4개 API 엔드포인트 동작 확인
- [ ] 대량 단가 등록 성능 테스트 (100개 품목 < 2초)
- [ ] UPSERT 충돌 처리 검증 (같은 월 중복 등록 시 UPDATE)
- [ ] 한글 인코딩 검증 (note 필드에 한글 입력 테스트)
- [ ] PostgreSQL 함수 get_current_item_prices 동작 확인

---

### Task 1.3: 재고 금액 조회 API 구현 (backend-architect)
**담당 에이전트**: `backend-architect`
**우선순위**: P1
**소요 시간**: 6-8시간

#### API 엔드포인트 (3개)

##### 1. GET /api/stock/valuation
**기능**: 품목별 재고 금액 조회

```typescript
// src/app/api/stock/valuation/route.ts
import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ||
      new Date().toISOString().slice(0, 7) + '-01';
    const category = searchParams.get('category');
    const supplierId = searchParams.get('supplier_id');

    const supabase = getSupabaseClient();

    // v_stock_valuation_monthly 뷰 조회
    let query = supabase
      .from('v_stock_valuation_monthly')
      .select('*')
      .order('stock_value', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }
    if (supplierId) {
      query = query.eq('supplier_id', parseInt(supplierId));
    }

    const { data, error } = await query;

    if (error) {
      return Response.json(
        handleSupabaseError('select', 'v_stock_valuation_monthly', error),
        { status: 500 }
      );
    }

    // 집계 통계
    const totalValue = data?.reduce((sum, item) => sum + parseFloat(item.stock_value || '0'), 0) || 0;
    const totalItems = data?.length || 0;
    const avgValue = totalItems > 0 ? totalValue / totalItems : 0;

    return Response.json(
      createSuccessResponse({
        items: data,
        summary: {
          total_items: totalItems,
          total_stock_value: totalValue,
          avg_stock_value: avgValue,
          valuation_month: month
        }
      })
    );
  } catch (error) {
    console.error('[API] stock valuation GET error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

##### 2. GET /api/stock/valuation/category
**기능**: 카테고리별 재고 금액 집계

```typescript
// src/app/api/stock/valuation/category/route.ts
import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ||
      new Date().toISOString().slice(0, 7) + '-01';

    const supabase = getSupabaseClient();

    // v_stock_value_by_category 뷰 조회
    const { data, error } = await supabase
      .from('v_stock_value_by_category')
      .select('*')
      .order('total_value', { ascending: false });

    if (error) {
      return Response.json(
        handleSupabaseError('select', 'v_stock_value_by_category', error),
        { status: 500 }
      );
    }

    // 총합 계산
    const totalValue = data?.reduce((sum, cat) => sum + parseFloat(cat.total_value || '0'), 0) || 0;

    return Response.json(
      createSuccessResponse({
        categories: data,
        summary: {
          total_value: totalValue,
          valuation_month: month,
          category_count: data?.length || 0
        }
      })
    );
  } catch (error) {
    console.error('[API] stock valuation category GET error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

##### 3. GET /api/stock/valuation/supplier
**기능**: 업체별 재고 금액 집계

```typescript
// src/app/api/stock/valuation/supplier/route.ts
import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ||
      new Date().toISOString().slice(0, 7) + '-01';

    const supabase = getSupabaseClient();

    // 업체별 재고 금액 집계 (v_stock_valuation_monthly 기반)
    const { data, error } = await supabase
      .from('v_stock_valuation_monthly')
      .select('supplier_name, company_category, stock_value')
      .order('supplier_name');

    if (error) {
      return Response.json(
        handleSupabaseError('select', 'v_stock_valuation_monthly', error),
        { status: 500 }
      );
    }

    // 업체별 집계
    const supplierMap = new Map<string, {
      supplier_name: string;
      company_category: string;
      total_value: number;
      item_count: number;
    }>();

    data?.forEach(item => {
      const key = item.supplier_name || 'Unknown';
      if (!supplierMap.has(key)) {
        supplierMap.set(key, {
          supplier_name: key,
          company_category: item.company_category || '',
          total_value: 0,
          item_count: 0
        });
      }
      const supplier = supplierMap.get(key)!;
      supplier.total_value += parseFloat(item.stock_value || '0');
      supplier.item_count += 1;
    });

    const suppliers = Array.from(supplierMap.values())
      .sort((a, b) => b.total_value - a.total_value);

    const totalValue = suppliers.reduce((sum, s) => sum + s.total_value, 0);

    return Response.json(
      createSuccessResponse({
        suppliers,
        summary: {
          total_value: totalValue,
          supplier_count: suppliers.length,
          valuation_month: month
        }
      })
    );
  } catch (error) {
    console.error('[API] stock valuation supplier GET error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 검증 기준
- [ ] 3개 API 엔드포인트 동작 확인
- [ ] 재고 금액 계산 정확도 검증 (수동 계산과 비교)
- [ ] 카테고리별 집계 검증 (원자재/부자재/완제품/공정재고)
- [ ] 업체별 집계 검증 (supplier_name 기준)
- [ ] 응답 시간 < 500ms (1000개 품목 기준)

---

### Task 1.4: 월별 재무 집계 API 구현 (backend-architect)
**담당 에이전트**: `backend-architect`
**우선순위**: P1
**소요 시간**: 6-8시간

#### API 엔드포인트 (1개)

##### GET /api/financial/monthly-summary
**기능**: 월별 매출/매입/수금/지급 + 재고 금액 통합 조회 (정리 보드 대체)

```typescript
// src/app/api/financial/monthly-summary/route.ts
import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const month = searchParams.get('month') || (new Date().getMonth() + 1).toString();

    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0)
      .toISOString().slice(0, 10);  // 마지막 날

    const supabase = getSupabaseClient();

    // 1. 매출 집계 (sales_transactions)
    const { data: salesData } = await supabase
      .from('sales_transactions')
      .select('transaction_date, total_amount, customer_id, customer:companies!customer_id(company_name, company_category)')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    // 2. 매입 집계 (purchase_transactions)
    const { data: purchaseData } = await supabase
      .from('purchase_transactions')
      .select('transaction_date, total_amount, supplier_id, supplier:companies!supplier_id(company_name, company_category)')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    // 3. 수금 집계 (collections)
    const { data: collectionsData } = await supabase
      .from('collections')
      .select('collection_date, amount, customer_id, customer:companies!customer_id(company_name)')
      .gte('collection_date', startDate)
      .lte('collection_date', endDate);

    // 4. 지급 집계 (payments)
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('payment_date, amount, supplier_id, supplier:companies!supplier_id(company_name)')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);

    // 5. 재고 금액 (v_stock_valuation_monthly)
    const { data: stockData } = await supabase
      .from('v_stock_valuation_monthly')
      .select('*');

    // 6. 일별 집계 (1일~30일)
    const dailySummary = generateDailySummary(
      salesData || [],
      purchaseData || [],
      collectionsData || [],
      paymentsData || [],
      stockData || [],
      year,
      month
    );

    // 7. 월별 총계
    const totalSales = salesData?.reduce((sum, s) => sum + parseFloat(s.total_amount || '0'), 0) || 0;
    const totalPurchases = purchaseData?.reduce((sum, p) => sum + parseFloat(p.total_amount || '0'), 0) || 0;
    const totalCollections = collectionsData?.reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0) || 0;
    const totalPayments = paymentsData?.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0;
    const totalStockValue = stockData?.reduce((sum, s) => sum + parseFloat(s.stock_value || '0'), 0) || 0;

    // 8. 업체별 집계 (고객사/협력사)
    const customerSummary = aggregateByCompany(salesData || [], collectionsData || []);
    const supplierSummary = aggregateByCompany(purchaseData || [], paymentsData || []);

    return Response.json(
      createSuccessResponse({
        period: { year, month, start_date: startDate, end_date: endDate },
        daily_summary: dailySummary,
        monthly_total: {
          sales: totalSales,
          purchases: totalPurchases,
          collections: totalCollections,
          payments: totalPayments,
          stock_value: totalStockValue,
          net_cash_flow: totalCollections - totalPayments
        },
        customers: customerSummary,
        suppliers: supplierSummary
      })
    );
  } catch (error) {
    console.error('[API] financial monthly-summary GET error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper: 일별 집계 생성 (1일~30일)
function generateDailySummary(
  sales: any[],
  purchases: any[],
  collections: any[],
  payments: any[],
  stock: any[],
  year: string,
  month: string
) {
  const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
  const daily = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    const daySales = sales.filter(s => s.transaction_date === dateStr)
      .reduce((sum, s) => sum + parseFloat(s.total_amount || '0'), 0);

    const dayPurchases = purchases.filter(p => p.transaction_date === dateStr)
      .reduce((sum, p) => sum + parseFloat(p.total_amount || '0'), 0);

    const dayCollections = collections.filter(c => c.collection_date === dateStr)
      .reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0);

    const dayPayments = payments.filter(p => p.payment_date === dateStr)
      .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

    daily.push({
      date: dateStr,
      day,
      sales: daySales,
      purchases: dayPurchases,
      collections: dayCollections,
      payments: dayPayments,
      net_cash_flow: dayCollections - dayPayments
    });
  }

  return daily;
}

// Helper: 업체별 집계
function aggregateByCompany(transactions: any[], payments: any[]) {
  const companyMap = new Map<string, {
    company_name: string;
    company_category: string;
    total_amount: number;
    paid_amount: number;
    outstanding: number;
    transaction_count: number;
  }>();

  transactions.forEach(t => {
    const company = t.customer || t.supplier;
    if (!company) return;

    const key = company.company_name;
    if (!companyMap.has(key)) {
      companyMap.set(key, {
        company_name: key,
        company_category: company.company_category || '',
        total_amount: 0,
        paid_amount: 0,
        outstanding: 0,
        transaction_count: 0
      });
    }
    const entry = companyMap.get(key)!;
    entry.total_amount += parseFloat(t.total_amount || '0');
    entry.transaction_count += 1;
  });

  payments.forEach(p => {
    const company = p.customer || p.supplier;
    if (!company) return;

    const key = company.company_name;
    if (companyMap.has(key)) {
      const entry = companyMap.get(key)!;
      entry.paid_amount += parseFloat(p.amount || '0');
    }
  });

  // 미수금/미지급금 계산
  companyMap.forEach((entry) => {
    entry.outstanding = entry.total_amount - entry.paid_amount;
  });

  return Array.from(companyMap.values())
    .sort((a, b) => b.total_amount - a.total_amount);
}
```

#### 검증 기준
- [ ] API 엔드포인트 동작 확인
- [ ] 일별 집계 정확도 검증 (1일~30일)
- [ ] 업체별 집계 정확도 검증 (고객사/협력사)
- [ ] 응답 시간 < 1초 (1000개 거래 기준)
- [ ] Excel 정리 보드와 비교 검증

---

### Task 1.5: Excel 단가 Import/Export 기능 (erp-specialist)
**담당 에이전트**: `erp-specialist`
**우선순위**: P2
**소요 시간**: 4-6시간

#### Excel 템플릿 다운로드 API
```typescript
// src/app/api/download/template/price-history/route.ts
import * as XLSX from 'xlsx';
import { getSupabaseClient } from '@/lib/db-unified';

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // 현재 품목 목록 조회
    const { data: items } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, spec, category, unit_price')
      .eq('is_active', true)
      .order('item_code');

    const workbook = XLSX.utils.book_new();

    // Sheet 1: 템플릿 설명
    const infoSheet = XLSX.utils.aoa_to_sheet([
      ['월별 단가 Import 템플릿', ''],
      ['작성일', new Date().toLocaleDateString('ko-KR')],
      ['작성 방법', ''],
      ['1. 기준월 입력 (예: 2025-10-01)', ''],
      ['2. 품목별 단가 입력', ''],
      ['3. 파일 업로드', '']
    ]);

    // Sheet 2: 품목 목록 (단가 입력용)
    const priceData = items?.map(item => ({
      '품목코드': item.item_code,
      '품목명': item.item_name,
      '규격': item.spec || '',
      '분류': item.category || '',
      '현재단가': item.unit_price,
      '기준월': '',  // 사용자 입력 필요
      '신규단가': '',  // 사용자 입력 필요
      'kg당단가': '',  // 옵션
      '비고': ''
    })) || [];

    const dataSheet = XLSX.utils.json_to_sheet(priceData);

    XLSX.utils.book_append_sheet(workbook, infoSheet, '템플릿 안내');
    XLSX.utils.book_append_sheet(workbook, dataSheet, '품목단가');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="월별단가템플릿_${new Date().toISOString().slice(0, 10)}.xlsx"`
      }
    });
  } catch (error) {
    console.error('[API] price template download error:', error);
    return Response.json(
      { success: false, error: 'Template generation failed' },
      { status: 500 }
    );
  }
}
```

#### Excel 단가 Import API
```typescript
// src/app/api/upload/price-history/route.ts
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseClient } from '@/lib/db-unified';
import { createSuccessResponse } from '@/lib/db-unified';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // '품목단가' 시트 읽기
    const sheetName = '품목단가';
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return Response.json(
        { success: false, error: `시트 "${sheetName}"를 찾을 수 없습니다` },
        { status: 400 }
      );
    }

    const rows = XLSX.utils.sheet_to_json<{
      품목코드: string;
      기준월: string;
      신규단가: number;
      kg당단가?: number;
      비고?: string;
    }>(worksheet);

    // 검증 및 변환
    const supabase = getSupabaseClient();
    const prices: any[] = [];
    const errors: string[] = [];

    for (const [index, row] of rows.entries()) {
      const rowNum = index + 2;  // Excel 행 번호 (헤더 제외)

      // 필수 필드 검증
      if (!row.품목코드 || !row.기준월 || !row.신규단가) {
        errors.push(`행 ${rowNum}: 품목코드, 기준월, 신규단가는 필수입니다`);
        continue;
      }

      // 품목 존재 확인
      const { data: item } = await supabase
        .from('items')
        .select('item_id')
        .eq('item_code', row.품목코드)
        .eq('is_active', true)
        .single();

      if (!item) {
        errors.push(`행 ${rowNum}: 품목코드 "${row.품목코드}"를 찾을 수 없습니다`);
        continue;
      }

      // 기준월 형식 검증 (YYYY-MM-01)
      const priceMonth = row.기준월.toString();
      if (!/^\d{4}-\d{2}-01$/.test(priceMonth)) {
        errors.push(`행 ${rowNum}: 기준월 형식이 올바르지 않습니다 (예: 2025-10-01)`);
        continue;
      }

      prices.push({
        item_id: item.item_id,
        price_month: priceMonth,
        unit_price: parseFloat(row.신규단가.toString()),
        price_per_kg: row.kg당단가 ? parseFloat(row.kg당단가.toString()) : null,
        note: row.비고 || null,
        created_by: 'Excel Import'
      });
    }

    if (errors.length > 0 && prices.length === 0) {
      return Response.json(
        { success: false, error: '유효한 데이터가 없습니다', validation_errors: errors },
        { status: 400 }
      );
    }

    // 대량 UPSERT
    const { data, error } = await supabase
      .from('item_price_history')
      .upsert(prices, {
        onConflict: 'item_id,price_month',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return Response.json(
      createSuccessResponse({
        imported_count: data?.length || 0,
        validation_errors: errors.length > 0 ? errors : undefined,
        message: `${data?.length || 0}개 품목 단가 등록 완료${errors.length > 0 ? ` (${errors.length}개 오류)` : ''}`
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] price-history upload error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 검증 기준
- [ ] Excel 템플릿 다운로드 동작 확인
- [ ] Excel Import 성공 (100개 품목 < 3초)
- [ ] 검증 오류 핸들링 (품목코드 없음, 날짜 형식 오류)
- [ ] UPSERT 동작 확인 (중복 월 단가 UPDATE)
- [ ] 한글 품목명/비고 인코딩 확인

---

## 📋 Wave 2: 재고 금액 계산 엔진 + 월별 집계 (4-5일)

### Task 2.1: 재고 금액 계산 로직 라이브러리 (backend-architect)
**담당 에이전트**: `backend-architect`
**우선순위**: P0
**소요 시간**: 8-10시간

#### 재고 금액 계산 클래스
```typescript
// src/lib/stock-value-calculator.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

interface StockValuationResult {
  item_id: number;
  item_code: string;
  item_name: string;
  current_stock: number;
  unit_price: number;
  stock_value: number;
  price_month: string;
  is_historical_price: boolean;
}

interface CategoryValuationResult {
  inventory_category: string;
  item_count: number;
  total_quantity: number;
  total_value: number;
}

export class StockValueCalculator {
  private supabase: SupabaseClient<Database>;
  private valuationCache: Map<string, StockValuationResult[]> = new Map();

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 품목별 재고 금액 계산 (지정 월 기준)
   */
  async calculateItemValuation(
    targetMonth: string,  // YYYY-MM-01
    options: {
      itemIds?: number[];
      category?: string;
      supplierId?: number;
      minStock?: number;
    } = {}
  ): Promise<StockValuationResult[]> {
    const cacheKey = `${targetMonth}_${JSON.stringify(options)}`;

    // 캐시 확인 (5분)
    if (this.valuationCache.has(cacheKey)) {
      const cached = this.valuationCache.get(cacheKey)!;
      console.log('[StockValueCalculator] Using cached valuation');
      return cached;
    }

    // 품목별 단가 조회 (PostgreSQL 함수 사용)
    const { data: items, error } = await this.supabase.rpc(
      'get_current_item_prices',
      {
        p_target_month: targetMonth,
        p_category: options.category || null,
        p_supplier_id: options.supplierId || null
      }
    );

    if (error) {
      throw new Error(`Failed to get item prices: ${error.message}`);
    }

    if (!items) {
      return [];
    }

    // 재고 금액 계산
    const valuations: StockValuationResult[] = items
      .filter(item => {
        if (options.itemIds && !options.itemIds.includes(item.item_id)) {
          return false;
        }
        if (options.minStock && item.current_stock < options.minStock) {
          return false;
        }
        return true;
      })
      .map(item => ({
        item_id: item.item_id,
        item_code: item.item_code,
        item_name: item.item_name,
        current_stock: item.current_stock,
        unit_price: parseFloat(item.unit_price || '0'),
        stock_value: item.current_stock * parseFloat(item.unit_price || '0'),
        price_month: item.price_month || targetMonth,
        is_historical_price: item.is_historical || false
      }));

    // 캐시 저장 (5분 TTL)
    this.valuationCache.set(cacheKey, valuations);
    setTimeout(() => this.valuationCache.delete(cacheKey), 5 * 60 * 1000);

    return valuations;
  }

  /**
   * 카테고리별 재고 금액 집계
   */
  async calculateCategoryValuation(
    targetMonth: string
  ): Promise<CategoryValuationResult[]> {
    // v_stock_value_by_category 뷰 조회
    const { data, error } = await this.supabase
      .from('v_stock_value_by_category')
      .select('*')
      .order('total_value', { ascending: false });

    if (error) {
      throw new Error(`Failed to get category valuation: ${error.message}`);
    }

    return (data || []).map(cat => ({
      inventory_category: cat.inventory_category,
      item_count: cat.item_count,
      total_quantity: cat.total_quantity,
      total_value: parseFloat(cat.total_value || '0')
    }));
  }

  /**
   * 업체별 재고 금액 집계
   */
  async calculateSupplierValuation(
    targetMonth: string
  ): Promise<Array<{
    supplier_name: string;
    company_category: string;
    item_count: number;
    total_stock_value: number;
  }>> {
    // v_stock_valuation_monthly 뷰 기반 집계
    const { data, error } = await this.supabase
      .from('v_stock_valuation_monthly')
      .select('supplier_name, company_category, stock_value');

    if (error) {
      throw new Error(`Failed to get supplier valuation: ${error.message}`);
    }

    // 업체별 그룹핑
    const supplierMap = new Map<string, {
      supplier_name: string;
      company_category: string;
      item_count: number;
      total_stock_value: number;
    }>();

    (data || []).forEach(item => {
      const key = item.supplier_name || 'Unknown';
      if (!supplierMap.has(key)) {
        supplierMap.set(key, {
          supplier_name: key,
          company_category: item.company_category || '',
          item_count: 0,
          total_stock_value: 0
        });
      }
      const supplier = supplierMap.get(key)!;
      supplier.item_count += 1;
      supplier.total_stock_value += parseFloat(item.stock_value || '0');
    });

    return Array.from(supplierMap.values())
      .sort((a, b) => b.total_stock_value - a.total_stock_value);
  }

  /**
   * 월별 재고 금액 추이 (3개월~12개월)
   */
  async calculateMonthlyTrend(
    months: number = 6  // 기본 6개월
  ): Promise<Array<{
    month: string;
    total_stock_value: number;
    raw_material_value: number;
    sub_material_value: number;
    finished_goods_value: number;
    wip_value: number;
  }>> {
    const results = [];
    const today = new Date();

    for (let i = 0; i < months; i++) {
      const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = targetDate.toISOString().slice(0, 7) + '-01';

      // 카테고리별 재고 금액 조회
      const categories = await this.calculateCategoryValuation(monthStr);

      const monthData = {
        month: monthStr,
        total_stock_value: categories.reduce((sum, cat) => sum + cat.total_value, 0),
        raw_material_value: categories.find(c => c.inventory_category === '원자재')?.total_value || 0,
        sub_material_value: categories.find(c => c.inventory_category === '부자재')?.total_value || 0,
        finished_goods_value: categories.find(c => c.inventory_category === '완제품')?.total_value || 0,
        wip_value: categories.find(c => c.inventory_category === '공정재고')?.total_value || 0
      };

      results.push(monthData);
    }

    return results.reverse();  // 오래된 것부터
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.valuationCache.clear();
    console.log('[StockValueCalculator] Cache cleared');
  }
}
```

#### 검증 기준
- [ ] 클래스 동작 확인 (모든 메서드 테스트)
- [ ] 재고 금액 계산 정확도 검증
- [ ] 캐시 동작 확인 (5분 TTL)
- [ ] 월별 추이 계산 정확도 검증 (6개월)
- [ ] 성능 테스트 (1000개 품목 < 2초)

---

### Task 2.2: 월별 재무 집계 로직 (backend-architect)
**담당 에이전트**: `backend-architect`
**우선순위**: P1
**소요 시간**: 6-8시간

#### 월별 재무 집계 클래스
```typescript
// src/lib/monthly-financial-aggregator.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

interface DailySummary {
  date: string;
  day: number;
  sales: number;
  purchases: number;
  collections: number;
  payments: number;
  net_cash_flow: number;
  cumulative_cash_flow: number;
}

interface CompanySummary {
  company_name: string;
  company_category: string;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  transaction_count: number;
}

export class MonthlyFinancialAggregator {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 일별 재무 집계 (1일~30일)
   */
  async generateDailySummary(
    year: string,
    month: string
  ): Promise<DailySummary[]> {
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month.padStart(2, '0')}-${daysInMonth.toString().padStart(2, '0')}`;

    // 병렬 조회 (4개 테이블)
    const [salesRes, purchasesRes, collectionsRes, paymentsRes] = await Promise.all([
      this.supabase
        .from('sales_transactions')
        .select('transaction_date, total_amount')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate),

      this.supabase
        .from('purchase_transactions')
        .select('transaction_date, total_amount')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate),

      this.supabase
        .from('collections')
        .select('collection_date, amount')
        .gte('collection_date', startDate)
        .lte('collection_date', endDate),

      this.supabase
        .from('payments')
        .select('payment_date, amount')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
    ]);

    const sales = salesRes.data || [];
    const purchases = purchasesRes.data || [];
    const collections = collectionsRes.data || [];
    const payments = paymentsRes.data || [];

    // 일별 집계 생성
    const daily: DailySummary[] = [];
    let cumulativeCashFlow = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

      const daySales = this.sumByDate(sales, 'transaction_date', dateStr);
      const dayPurchases = this.sumByDate(purchases, 'transaction_date', dateStr);
      const dayCollections = this.sumByDate(collections, 'collection_date', dateStr);
      const dayPayments = this.sumByDate(payments, 'payment_date', dateStr);
      const netCashFlow = dayCollections - dayPayments;
      cumulativeCashFlow += netCashFlow;

      daily.push({
        date: dateStr,
        day,
        sales: daySales,
        purchases: dayPurchases,
        collections: dayCollections,
        payments: dayPayments,
        net_cash_flow: netCashFlow,
        cumulative_cash_flow: cumulativeCashFlow
      });
    }

    return daily;
  }

  /**
   * 고객사별 집계
   */
  async aggregateCustomers(
    year: string,
    month: string
  ): Promise<CompanySummary[]> {
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month.padStart(2, '0')}-${daysInMonth.toString().padStart(2, '0')}`;

    // 매출 거래
    const { data: sales } = await this.supabase
      .from('sales_transactions')
      .select('customer_id, total_amount, customer:companies!customer_id(company_name, company_category)')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    // 수금 내역
    const { data: collections } = await this.supabase
      .from('collections')
      .select('customer_id, amount')
      .gte('collection_date', startDate)
      .lte('collection_date', endDate);

    return this.aggregateByCompany(sales || [], collections || [], 'customer_id');
  }

  /**
   * 협력사별 집계
   */
  async aggregateSuppliers(
    year: string,
    month: string
  ): Promise<CompanySummary[]> {
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month.padStart(2, '0')}-${daysInMonth.toString().padStart(2, '0')}`;

    // 매입 거래
    const { data: purchases } = await this.supabase
      .from('purchase_transactions')
      .select('supplier_id, total_amount, supplier:companies!supplier_id(company_name, company_category)')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    // 지급 내역
    const { data: payments } = await this.supabase
      .from('payments')
      .select('supplier_id, amount')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);

    return this.aggregateByCompany(purchases || [], payments || [], 'supplier_id');
  }

  // Helper: 날짜별 금액 합계
  private sumByDate(
    records: Array<{ [key: string]: any }>,
    dateField: string,
    targetDate: string
  ): number {
    return records
      .filter(r => r[dateField] === targetDate)
      .reduce((sum, r) => sum + parseFloat(r.total_amount || r.amount || '0'), 0);
  }

  // Helper: 업체별 집계
  private aggregateByCompany(
    transactions: any[],
    payments: any[],
    companyIdField: string
  ): CompanySummary[] {
    const companyMap = new Map<number, CompanySummary>();

    // 거래 금액 집계
    transactions.forEach(t => {
      const companyId = t[companyIdField];
      const company = t.customer || t.supplier;
      if (!companyId || !company) return;

      if (!companyMap.has(companyId)) {
        companyMap.set(companyId, {
          company_name: company.company_name,
          company_category: company.company_category || '',
          total_amount: 0,
          paid_amount: 0,
          outstanding: 0,
          transaction_count: 0
        });
      }
      const entry = companyMap.get(companyId)!;
      entry.total_amount += parseFloat(t.total_amount || '0');
      entry.transaction_count += 1;
    });

    // 지급/수금 금액 집계
    payments.forEach(p => {
      const companyId = p[companyIdField];
      if (!companyId || !companyMap.has(companyId)) return;

      const entry = companyMap.get(companyId)!;
      entry.paid_amount += parseFloat(p.amount || '0');
    });

    // 미수금/미지급금 계산
    companyMap.forEach((entry) => {
      entry.outstanding = entry.total_amount - entry.paid_amount;
    });

    return Array.from(companyMap.values())
      .sort((a, b) => b.total_amount - a.total_amount);
  }
}
```

#### 검증 기준
- [ ] 클래스 동작 확인
- [ ] 일별 집계 정확도 검증 (누적 현금 흐름)
- [ ] 업체별 집계 정확도 검증 (미수금/미지급금)
- [ ] 병렬 조회 성능 테스트 (4개 테이블 동시 조회 < 1초)
- [ ] Excel 정리 보드 데이터와 비교

---

### Task 2.3: Excel Export 기능 - 정리 보드 (erp-specialist)
**담당 에이전트**: `erp-specialist`
**우선순위**: P2
**소요 시간**: 4-6시간

#### Excel Export API (정리 보드 형식)
```typescript
// src/app/api/export/financial-summary/route.ts
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseClient } from '@/lib/db-unified';
import { MonthlyFinancialAggregator } from '@/lib/monthly-financial-aggregator';
import { StockValueCalculator } from '@/lib/stock-value-calculator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const month = searchParams.get('month') || (new Date().getMonth() + 1).toString();

    const supabase = getSupabaseClient();
    const financialAgg = new MonthlyFinancialAggregator(supabase);
    const stockCalc = new StockValueCalculator(supabase);

    // 데이터 수집 (병렬)
    const [daily, customers, suppliers, categoryValuation] = await Promise.all([
      financialAgg.generateDailySummary(year, month),
      financialAgg.aggregateCustomers(year, month),
      financialAgg.aggregateSuppliers(year, month),
      stockCalc.calculateCategoryValuation(`${year}-${month.padStart(2, '0')}-01`)
    ]);

    const workbook = XLSX.utils.book_new();

    // Sheet 1: 메타데이터
    const metaSheet = XLSX.utils.aoa_to_sheet([
      ['월별 재무 정리 보드', ''],
      ['기준 년월', `${year}년 ${month}월`],
      ['내보낸 날짜', new Date().toLocaleString('ko-KR')],
      ['작성자', 'SuperClaude ERP']
    ]);

    // Sheet 2: 일별 집계 (1일~30일)
    const dailyData = daily.map(d => ({
      '일자': d.date,
      '일': d.day,
      '매출': d.sales,
      '매입': d.purchases,
      '수금': d.collections,
      '지급': d.payments,
      '당일 현금흐름': d.net_cash_flow,
      '누적 현금흐름': d.cumulative_cash_flow
    }));
    const dailySheet = XLSX.utils.json_to_sheet(dailyData);

    // Sheet 3: 고객사별 집계
    const customerData = customers.map(c => ({
      '고객사명': c.company_name,
      '분류': c.company_category,
      '매출금액': c.total_amount,
      '수금금액': c.paid_amount,
      '미수금': c.outstanding,
      '거래건수': c.transaction_count
    }));
    const customerSheet = XLSX.utils.json_to_sheet(customerData);

    // Sheet 4: 협력사별 집계
    const supplierData = suppliers.map(s => ({
      '협력사명': s.company_name,
      '분류': s.company_category,
      '매입금액': s.total_amount,
      '지급금액': s.paid_amount,
      '미지급금': s.outstanding,
      '거래건수': s.transaction_count
    }));
    const supplierSheet = XLSX.utils.json_to_sheet(supplierData);

    // Sheet 5: 재고 금액 (카테고리별)
    const stockData = categoryValuation.map(cat => ({
      '재고분류': cat.inventory_category,
      '품목수': cat.item_count,
      '총수량': cat.total_quantity,
      '재고금액': cat.total_value
    }));
    const stockSheet = XLSX.utils.json_to_sheet(stockData);

    // Sheet 6: 월별 요약
    const totalSales = daily.reduce((sum, d) => sum + d.sales, 0);
    const totalPurchases = daily.reduce((sum, d) => sum + d.purchases, 0);
    const totalCollections = daily.reduce((sum, d) => sum + d.collections, 0);
    const totalPayments = daily.reduce((sum, d) => sum + d.payments, 0);
    const totalStockValue = categoryValuation.reduce((sum, cat) => sum + cat.total_value, 0);

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['항목', '금액'],
      ['총 매출', totalSales],
      ['총 매입', totalPurchases],
      ['총 수금', totalCollections],
      ['총 지급', totalPayments],
      ['순 현금흐름', totalCollections - totalPayments],
      ['재고 금액', totalStockValue]
    ]);

    // 워크북 조립
    XLSX.utils.book_append_sheet(workbook, metaSheet, '메타데이터');
    XLSX.utils.book_append_sheet(workbook, dailySheet, '일별집계');
    XLSX.utils.book_append_sheet(workbook, customerSheet, '고객사집계');
    XLSX.utils.book_append_sheet(workbook, supplierSheet, '협력사집계');
    XLSX.utils.book_append_sheet(workbook, stockSheet, '재고금액');
    XLSX.utils.book_append_sheet(workbook, summarySheet, '월별요약');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="재무정리보드_${year}년${month}월.xlsx"`
      }
    });
  } catch (error) {
    console.error('[API] financial summary export error:', error);
    return Response.json(
      { success: false, error: 'Export failed' },
      { status: 500 }
    );
  }
}
```

#### 검증 기준
- [ ] Excel Export 동작 확인 (6개 시트)
- [ ] 한글 헤더 인코딩 확인
- [ ] 데이터 정확도 검증 (수동 집계와 비교)
- [ ] 파일 크기 최적화 (<5MB, 1000개 품목 기준)
- [ ] 다운로드 속도 (<5초)

---

## 📋 Wave 3: 프론트엔드 UI + 대시보드 (4-5일)

### Task 3.1: 월별 단가 관리 페이지 (frontend-developer)
**담당 에이전트**: `frontend-developer`
**우선순위**: P0
**소요 시간**: 8-10시간

#### 월별 단가 관리 페이지
```typescript
// src/app/price-management/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import MainLayout from '@/components/layout/MainLayout';

interface PriceHistory {
  price_history_id: number;
  item_id: number;
  item: {
    item_code: string;
    item_name: string;
    spec: string;
    category: string;
  };
  price_month: string;
  unit_price: number;
  price_per_kg?: number;
  note?: string;
}

export default function PriceManagementPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [prices, setPrices] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();

  // 월별 단가 조회
  const fetchPrices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/price-history/current?month=${selectedMonth}-01`);
      const data = await res.json();

      if (data.success) {
        setPrices(data.data.items || []);
      } else {
        toast({
          title: '조회 실패',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Price fetch error:', error);
      toast({
        title: '조회 실패',
        description: '서버 오류가 발생했습니다',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, [selectedMonth]);

  // 단가 수정
  const handlePriceUpdate = async (
    priceHistoryId: number,
    updates: Partial<PriceHistory>
  ) => {
    try {
      const res = await fetch(`/api/price-history/${priceHistoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: '수정 완료',
          description: '단가가 성공적으로 수정되었습니다',
          variant: 'default'
        });
        fetchPrices();
        setEditingId(null);
      } else {
        toast({
          title: '수정 실패',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Price update error:', error);
      toast({
        title: '수정 실패',
        description: '서버 오류가 발생했습니다',
        variant: 'destructive'
      });
    }
  };

  // Excel Import
  const handleExcelImport = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload/price-history', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Import 완료',
          description: `${data.data.imported_count}개 품목 단가 등록 완료`,
          variant: 'default'
        });
        fetchPrices();
      } else {
        toast({
          title: 'Import 실패',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Excel import error:', error);
      toast({
        title: 'Import 실패',
        description: '서버 오류가 발생했습니다',
        variant: 'destructive'
      });
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* 헤더 */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">월별 단가 관리</h1>

          <div className="flex gap-4 items-center">
            {/* 월 선택 */}
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            />

            {/* Excel 템플릿 다운로드 */}
            <a
              href="/api/download/template/price-history"
              download
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Excel 템플릿 다운로드
            </a>

            {/* Excel Import */}
            <label className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
              Excel Import
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleExcelImport(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>
        </div>

        {/* 단가 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">품목코드</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">품목명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">규격</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">분류</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">현재 재고</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">단가 (₩)</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">재고 금액 (₩)</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">기준월</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center">로딩 중...</td>
                </tr>
              ) : prices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center">데이터가 없습니다</td>
                </tr>
              ) : (
                prices.map((price) => (
                  <tr key={price.price_history_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{price.item.item_code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{price.item.item_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{price.item.spec}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{price.item.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {price.item.current_stock?.toLocaleString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {editingId === price.price_history_id ? (
                        <input
                          type="number"
                          defaultValue={price.unit_price}
                          className="w-full px-2 py-1 border rounded text-right"
                          onBlur={(e) => {
                            handlePriceUpdate(price.price_history_id, {
                              unit_price: parseFloat(e.target.value)
                            });
                          }}
                          autoFocus
                        />
                      ) : (
                        <span>{price.unit_price.toLocaleString('ko-KR')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                      {(price.unit_price * (price.item.current_stock || 0)).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      {price.price_month?.slice(0, 7)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <button
                        onClick={() => setEditingId(price.price_history_id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        수정
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
```

#### 검증 기준
- [ ] 페이지 렌더링 확인
- [ ] 월 선택 기능 동작 확인
- [ ] 단가 수정 기능 동작 확인
- [ ] Excel Import 동작 확인
- [ ] 재고 금액 자동 계산 확인

---

### Task 3.2: 재고 금액 대시보드 (frontend-developer)
**담당 에이전트**: `frontend-developer`
**우선순위**: P1
**소요 시간**: 8-10시간

#### 재고 금액 대시보드 페이지
```typescript
// src/app/stock/valuation/page.tsx
'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useToast } from '@/components/ui/use-toast';

interface CategoryValuation {
  inventory_category: string;
  item_count: number;
  total_quantity: number;
  total_value: number;
}

interface SupplierValuation {
  supplier_name: string;
  company_category: string;
  item_count: number;
  total_stock_value: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function StockValuationPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [categories, setCategories] = useState<CategoryValuation[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierValuation[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // 재고 금액 조회
  const fetchValuation = async () => {
    setLoading(true);
    try {
      const [catRes, supRes] = await Promise.all([
        fetch(`/api/stock/valuation/category?month=${selectedMonth}-01`),
        fetch(`/api/stock/valuation/supplier?month=${selectedMonth}-01`)
      ]);

      const [catData, supData] = await Promise.all([
        catRes.json(),
        supRes.json()
      ]);

      if (catData.success) {
        setCategories(catData.data.categories || []);
      }
      if (supData.success) {
        setSuppliers(supData.data.suppliers || []);
      }
    } catch (error) {
      console.error('Valuation fetch error:', error);
      toast({
        title: '조회 실패',
        description: '서버 오류가 발생했습니다',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchValuation();
  }, [selectedMonth]);

  const totalValue = categories.reduce((sum, cat) => sum + cat.total_value, 0);

  // Excel Export
  const handleExcelExport = async () => {
    window.open(
      `/api/export/financial-summary?year=${selectedMonth.slice(0, 4)}&month=${selectedMonth.slice(5, 7)}`,
      '_blank'
    );
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* 헤더 */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">재고 금액 현황</h1>

          <div className="flex gap-4 items-center">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            />

            <button
              onClick={handleExcelExport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Excel Export
            </button>
          </div>
        </div>

        {/* KPI 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-500">총 재고 금액</div>
            <div className="text-3xl font-bold mt-2">
              {totalValue.toLocaleString('ko-KR')} 원
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-500">원자재</div>
            <div className="text-3xl font-bold mt-2 text-blue-600">
              {(categories.find(c => c.inventory_category === '원자재')?.total_value || 0).toLocaleString('ko-KR')} 원
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-500">부자재</div>
            <div className="text-3xl font-bold mt-2 text-green-600">
              {(categories.find(c => c.inventory_category === '부자재')?.total_value || 0).toLocaleString('ko-KR')} 원
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-500">완제품</div>
            <div className="text-3xl font-bold mt-2 text-orange-600">
              {(categories.find(c => c.inventory_category === '완제품')?.total_value || 0).toLocaleString('ko-KR')} 원
            </div>
          </div>
        </div>

        {/* 차트 영역 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 카테고리별 원형 차트 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">카테고리별 재고 금액</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="total_value"
                  nameKey="inventory_category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.inventory_category}: ${(entry.total_value / totalValue * 100).toFixed(1)}%`}
                >
                  {categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 업체별 테이블 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">업체별 재고 금액 (Top 10)</h2>
            <div className="overflow-y-auto max-h-[300px]">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">업체명</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">품목수</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">재고 금액</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.slice(0, 10).map((sup, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-4 py-2 text-sm">{sup.supplier_name}</td>
                      <td className="px-4 py-2 text-sm text-right">{sup.item_count}</td>
                      <td className="px-4 py-2 text-sm text-right font-semibold">
                        {sup.total_stock_value.toLocaleString('ko-KR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 카테고리 상세 테이블 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">카테고리별 상세</h2>
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">재고 분류</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">품목 수</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">총 수량</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">재고 금액</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">비중 (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {categories.map((cat, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{cat.inventory_category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{cat.item_count}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{cat.total_quantity.toLocaleString('ko-KR')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                    {cat.total_value.toLocaleString('ko-KR')} 원
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {((cat.total_value / totalValue) * 100).toFixed(1)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
```

#### 검증 기준
- [ ] 페이지 렌더링 확인
- [ ] KPI 카드 데이터 확인
- [ ] 원형 차트 렌더링 확인
- [ ] 업체별/카테고리별 테이블 확인
- [ ] Excel Export 동작 확인

---

### Task 3.3: 월별 재무 정리 보드 페이지 (frontend-developer)
**담당 에이전트**: `frontend-developer`
**우선순위**: P1
**소요 시간**: 8-10시간

#### 월별 재무 정리 보드
```typescript
// src/app/financial/summary/page.tsx
'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useToast } from '@/components/ui/use-toast';

interface DailySummary {
  date: string;
  day: number;
  sales: number;
  purchases: number;
  collections: number;
  payments: number;
  net_cash_flow: number;
  cumulative_cash_flow: number;
}

interface CompanySummary {
  company_name: string;
  company_category: string;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  transaction_count: number;
}

export default function FinancialSummaryPage() {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [dailySummary, setDailySummary] = useState<DailySummary[]>([]);
  const [customers, setCustomers] = useState<CompanySummary[]>([]);
  const [suppliers, setSuppliers] = useState<CompanySummary[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // 월별 재무 집계 조회
  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/financial/monthly-summary?year=${selectedYear}&month=${selectedMonth}`);
      const data = await res.json();

      if (data.success) {
        setDailySummary(data.data.daily_summary || []);
        setCustomers(data.data.customers || []);
        setSuppliers(data.data.suppliers || []);
        setMonthlyTotal(data.data.monthly_total);
      } else {
        toast({
          title: '조회 실패',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Summary fetch error:', error);
      toast({
        title: '조회 실패',
        description: '서버 오류가 발생했습니다',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [selectedYear, selectedMonth]);

  // Excel Export
  const handleExcelExport = () => {
    window.open(
      `/api/export/financial-summary?year=${selectedYear}&month=${selectedMonth}`,
      '_blank'
    );
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* 헤더 */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">월별 재무 정리 보드</h1>

          <div className="flex gap-4 items-center">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              {[2023, 2024, 2025, 2026].map(year => (
                <option key={year} value={year}>{year}년</option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>{month}월</option>
              ))}
            </select>

            <button
              onClick={handleExcelExport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Excel Export
            </button>
          </div>
        </div>

        {/* 월별 요약 KPI */}
        {monthlyTotal && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-xs text-gray-600">총 매출</div>
              <div className="text-xl font-bold text-blue-700 mt-1">
                {monthlyTotal.sales.toLocaleString('ko-KR')} 원
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="text-xs text-gray-600">총 매입</div>
              <div className="text-xl font-bold text-red-700 mt-1">
                {monthlyTotal.purchases.toLocaleString('ko-KR')} 원
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-xs text-gray-600">총 수금</div>
              <div className="text-xl font-bold text-green-700 mt-1">
                {monthlyTotal.collections.toLocaleString('ko-KR')} 원
              </div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="text-xs text-gray-600">총 지급</div>
              <div className="text-xl font-bold text-orange-700 mt-1">
                {monthlyTotal.payments.toLocaleString('ko-KR')} 원
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="text-xs text-gray-600">순 현금흐름</div>
              <div className={`text-xl font-bold mt-1 ${monthlyTotal.net_cash_flow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {monthlyTotal.net_cash_flow.toLocaleString('ko-KR')} 원
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-600">재고 금액</div>
              <div className="text-xl font-bold text-gray-700 mt-1">
                {monthlyTotal.stock_value.toLocaleString('ko-KR')} 원
              </div>
            </div>
          </div>
        )}

        {/* 일별 집계 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h2 className="text-lg font-bold">일별 집계 (1일~30일)</h2>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">일자</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">매출</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">매입</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">수금</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">지급</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">당일 현금흐름</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">누적 현금흐름</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailySummary.map((day) => (
                  <tr key={day.day} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{day.day}일</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-blue-600">
                      {day.sales.toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-red-600">
                      {day.purchases.toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-green-600">
                      {day.collections.toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-orange-600">
                      {day.payments.toLocaleString('ko-KR')}
                    </td>
                    <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-semibold ${day.net_cash_flow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {day.net_cash_flow.toLocaleString('ko-KR')}
                    </td>
                    <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-bold ${day.cumulative_cash_flow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {day.cumulative_cash_flow.toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 고객사/협력사 집계 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 고객사 집계 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 bg-blue-50 border-b">
              <h2 className="text-lg font-bold">고객사별 집계</h2>
            </div>
            <div className="overflow-y-auto max-h-[400px]">
              <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">고객사명</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">매출</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">수금</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">미수금</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {customers.map((customer, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{customer.company_name}</td>
                      <td className="px-4 py-2 text-sm text-right">{customer.total_amount.toLocaleString('ko-KR')}</td>
                      <td className="px-4 py-2 text-sm text-right">{customer.paid_amount.toLocaleString('ko-KR')}</td>
                      <td className="px-4 py-2 text-sm text-right font-semibold text-red-600">
                        {customer.outstanding.toLocaleString('ko-KR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 협력사 집계 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 bg-orange-50 border-b">
              <h2 className="text-lg font-bold">협력사별 집계</h2>
            </div>
            <div className="overflow-y-auto max-h-[400px]">
              <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">협력사명</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">매입</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">지급</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">미지급금</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {suppliers.map((supplier, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{supplier.company_name}</td>
                      <td className="px-4 py-2 text-sm text-right">{supplier.total_amount.toLocaleString('ko-KR')}</td>
                      <td className="px-4 py-2 text-sm text-right">{supplier.paid_amount.toLocaleString('ko-KR')}</td>
                      <td className="px-4 py-2 text-sm text-right font-semibold text-orange-600">
                        {supplier.outstanding.toLocaleString('ko-KR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
```

#### 검증 기준
- [ ] 페이지 렌더링 확인
- [ ] 월별 요약 KPI 확인
- [ ] 일별 집계 테이블 확인 (1일~30일)
- [ ] 고객사/협력사 집계 확인
- [ ] Excel Export 동작 확인
- [ ] Excel 정리 보드와 데이터 비교

---

## 🔗 Integration & Testing (1일)

### E2E 테스트 (qa persona)
**담당 에이전트**: `--persona-qa`
**소요 시간**: 6-8시간

#### 테스트 시나리오

1. **월별 단가 관리**
   - [ ] 단가 이력 조회 (10월, 11월, 12월)
   - [ ] Excel 템플릿 다운로드
   - [ ] Excel Import (100개 품목)
   - [ ] 단가 수정 (개별 수정)

2. **재고 금액 계산**
   - [ ] 품목별 재고 금액 조회
   - [ ] 카테고리별 집계 조회
   - [ ] 업체별 집계 조회
   - [ ] 월별 추이 조회 (6개월)

3. **월별 재무 정리 보드**
   - [ ] 일별 집계 조회 (1일~30일)
   - [ ] 고객사/협력사 집계 조회
   - [ ] Excel Export (6개 시트)
   - [ ] Excel 정리 보드와 데이터 비교

4. **성능 테스트**
   - [ ] 1000개 품목 재고 금액 계산 < 2초
   - [ ] 월별 집계 조회 < 1초
   - [ ] Excel Export < 5초

---

## 📦 최종 Deliverables

### 데이터베이스 (4개)
- [ ] `item_price_history` 테이블 (월별 단가 이력)
- [ ] `v_stock_valuation_monthly` 뷰 (품목별 재고 금액)
- [ ] `v_stock_value_by_category` 뷰 (카테고리별 재고 금액)
- [ ] `get_current_item_prices()` PostgreSQL 함수

### API 엔드포인트 (11개)
- [ ] GET /api/price-history/[itemId] - 품목별 단가 이력
- [ ] GET /api/price-history/current - 현재 월 단가
- [ ] POST /api/price-history - 단가 등록 (대량)
- [ ] PUT /api/price-history/[id] - 단가 수정
- [ ] GET /api/stock/valuation - 품목별 재고 금액
- [ ] GET /api/stock/valuation/category - 카테고리별 재고 금액
- [ ] GET /api/stock/valuation/supplier - 업체별 재고 금액
- [ ] GET /api/financial/monthly-summary - 월별 재무 집계
- [ ] GET /api/download/template/price-history - Excel 템플릿
- [ ] POST /api/upload/price-history - Excel Import
- [ ] GET /api/export/financial-summary - Excel Export

### 프론트엔드 페이지 (3개)
- [ ] /price-management - 월별 단가 관리
- [ ] /stock/valuation - 재고 금액 대시보드
- [ ] /financial/summary - 월별 재무 정리 보드

### 라이브러리 (2개)
- [ ] src/lib/stock-value-calculator.ts - 재고 금액 계산 엔진
- [ ] src/lib/monthly-financial-aggregator.ts - 월별 재무 집계 로직

### 테스트 (1개)
- [ ] E2E 테스트 시나리오 (4개 카테고리, 14개 테스트)

---

## 🎯 성공 기준

1. **기능 완성도**: 모든 Deliverables 100% 구현
2. **데이터 정확도**: Excel 정리 보드와 100% 일치
3. **성능 목표**: 모든 API < 2초, Excel Export < 5초
4. **사용성**: Excel 대체 가능한 UX
5. **품질**: 0 Critical Bug, 0 Korean Encoding Issue

---

## 📅 Timeline Summary

| Wave | 기간 | 태스크 수 | 주요 Deliverables |
|------|------|----------|------------------|
| Wave 1 | 3-4일 | 5개 | DB 스키마, 단가 API (7개), Excel Import/Export |
| Wave 2 | 4-5일 | 3개 | 재고 금액 계산 엔진, 월별 집계 로직, Excel Export |
| Wave 3 | 4-5일 | 3개 | 단가 관리 페이지, 재고 금액 대시보드, 정리 보드 |
| Integration | 1일 | 1개 | E2E 테스트, 데이터 검증 |
| **Total** | **12-15일** | **12개** | **11 APIs + 3 Pages + 4 DB Objects + 2 Libraries** |

---

**작성일**: 2025-10-16
**작성자**: SuperClaude (Phase P3 Planning)
**기반 문서**: 대화 요약본 (2025.10.13 회의록)
