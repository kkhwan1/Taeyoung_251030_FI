# Excel → Supabase 데이터베이스 컬럼 매핑

**작성일**: 2025-01-16
**목적**: Excel 파일의 실제 컬럼명을 Supabase 테이블 컬럼에 정확히 매핑

---

## 📊 매핑 원칙

1. **한글 컬럼명 → 영문 컬럼명** 변환
2. **수식 → 실제 계산값** 변환
3. **Excel 타입 → PostgreSQL 타입** 변환
4. **NULL/빈 값** 처리 규칙 정의
5. **외래 키 참조** 매핑 및 검증

---

## 1. companies (거래처) 테이블

### Supabase 스키마
```typescript
{
  company_id: number;              // PK, auto-increment
  company_code: string;            // UNIQUE, NOT NULL (예: CUS001, SUP001)
  company_name: string;            // NOT NULL
  company_type: 'CUSTOMER' | 'SUPPLIER' | 'PARTNER' | 'OTHER';
  company_category?: string;       // Phase 2 추가 (원자재/외주/소모품/기타)
  business_number?: string;
  representative?: string;
  phone?: string;
  email?: string;
  fax?: string;
  address?: string;
  description?: string;
  business_info?: Json;            // Phase 2 추가 JSONB 필드
  is_active: boolean;              // default true
  created_at: timestamp;
  updated_at: timestamp;
}
```

### Excel 소스: 태창금속 BOM.xlsx - 최신단가 시트

| Excel 컬럼명 | Supabase 컬럼 | 타입 변환 | 비고 |
|-------------|--------------|---------|------|
| 공급사명 | company_name | string | NOT NULL |
| - (생성) | company_code | string | 자동 생성: SUP001, SUP002... |
| - (고정값) | company_type | enum | '공급사' (SUPPLIER) |
| 업종 | business_info.business_type | JSONB | Phase 2 필드 |
| 업태 | business_info.business_item | JSONB | Phase 2 필드 |
| 사업자번호 | business_number | string | 하이픈 제거 |
| 대표자 | representative | string | |
| 전화번호 | phone | string | |
| 팩스 | fax | string | |
| 주소 | address | string | |

### 생성 로직

```typescript
// 1. company_code 자동 생성
const prefixMap = {
  '고객사': 'CUS',
  '공급사': 'SUP',
  '협력사': 'PAR',
  '기타': 'OTH'
};

// 2. 중복 체크 후 순번 증가
const existingCodes = await supabase
  .from('companies')
  .select('company_code')
  .like('company_code', `${prefix}%`);

const maxNumber = Math.max(...existingCodes.map(c =>
  parseInt(c.company_code.slice(3))
));

const newCode = `${prefix}${String(maxNumber + 1).padStart(3, '0')}`;
```

---

## 2. items (품목) 테이블

### Supabase 스키마
```typescript
{
  item_id: number;                 // PK, auto-increment
  item_code: string;               // UNIQUE, NOT NULL
  item_name: string;               // NOT NULL
  category: 'RAW_MATERIAL' | 'SUBSIDIARY' | 'SEMI_FINISHED' | 'FINISHED' | 'PRODUCT';
  item_type?: string;              // 완제품/원자재/COIL/SHEET 등
  spec?: string;
  material?: string;               // 재질
  material_type?: string;
  thickness?: number;              // 두께 (mm)
  width?: number;                  // 폭 (mm)
  height?: number;
  blank_size?: number;
  vehicle_model?: string;          // 차종
  unit: string;                    // default 'EA'
  price?: number;                  // 기본 단가
  current_stock?: number;          // default 0
  safety_stock?: number;
  daily_requirement?: number;
  mm_weight?: number;              // mm당 중량
  specific_gravity?: number;       // 비중
  supplier_id?: number;            // FK → companies
  location?: string;
  description?: string;
  is_active: boolean;              // default true
  created_at: timestamp;
  updated_at: timestamp;
}
```

### Excel 소스 1: 태창금속 BOM.xlsx - 5개 고객사 시트

| Excel 컬럼명 | Supabase 컬럼 | 타입 변환 | 비고 |
|-------------|--------------|---------|------|
| 품번 | item_code | string | NOT NULL, UNIQUE |
| 품명 | item_name | string | NOT NULL |
| 차종 | vehicle_model | string | |
| 규격 / 사이즈 | spec | string | |
| 재질 | material | string | |
| 두께(T) | thickness | number | mm 단위 |
| 가로(L) | width | number | mm 단위 |
| 세로(W) | height | number | mm 단위 |
| BLANK SIZE | blank_size | number | |
| 단위 | unit | string | default 'EA' |
| 구매단가 | price | number | |
| - (계산) | category | enum | 완제품='제품', 원자재='원자재' |
| - (고정값) | item_type | string | '완제품' or '원자재' |

### Excel 소스 2: 태창금속 BOM.xlsx - 최신단가 시트 (원자재)

| Excel 컬럼명 | Supabase 컬럼 | 타입 변환 | 비고 |
|-------------|--------------|---------|------|
| 코드 | item_code | string | UNIQUE |
| 품명 | item_name | string | NOT NULL |
| 규격 | spec | string | |
| 재질 | material | string | |
| 재질타입 | material_type | string | |
| 두께 | thickness | number | |
| 폭 | width | number | |
| 비중 | specific_gravity | number | |
| KG단가 | price | number | 기본 단가 |
| - (고정값) | category | enum | '원자재' |
| - (고정값) | item_type | string | 'COIL' or 'SHEET' |

### Excel 소스 3: 종합관리 SHEET.xlsx (재고 품목)

| Excel 컬럼명 | Supabase 컬럼 | 타입 변환 | 비고 |
|-------------|--------------|---------|------|
| 품명 | item_name | string | 매칭 기준 |
| 규격 | spec | string | |
| 차종 | vehicle_model | string | |
| - (추론) | item_code | string | 품명+규격으로 생성 |

### 생성 로직

```typescript
// 1. category 결정
const determineCategory = (row: ExcelRow): ItemCategory => {
  // 최신단가 시트 → 원자재
  if (row.source === '최신단가') return '원자재';

  // BOM 시트에서 parent인 품목 → 제품
  if (row.isParent) return '제품';

  // BOM 시트에서 child인 품목 → 원자재
  return '원자재';
};

// 2. item_code 생성 (없는 경우)
const generateItemCode = (itemName: string, spec?: string): string => {
  const prefix = itemName.slice(0, 3).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${random}`;
};

// 3. 중복 품목 통합
const mergeItems = (items: ExcelItem[]): Item[] => {
  const itemMap = new Map<string, Item>();

  for (const item of items) {
    const key = `${item.item_name}|${item.spec || ''}`;

    if (!itemMap.has(key)) {
      itemMap.set(key, item);
    } else {
      // 중복 품목은 데이터 병합 (단가는 최신값 우선)
      const existing = itemMap.get(key)!;
      if (item.price && !existing.price) {
        existing.price = item.price;
      }
    }
  }

  return Array.from(itemMap.values());
};
```

---

## 3. bom (BOM 관계) 테이블

### Supabase 스키마
```typescript
{
  bom_id: number;                  // PK, auto-increment
  parent_item_id: number;          // FK → items (완제품)
  child_item_id: number;           // FK → items (원자재)
  quantity_required: number;       // 소요량
  level_no: number;                // 1=완제품, 2=원자재
  is_active: boolean;              // default true
  created_at: timestamp;
  updated_at: timestamp;
}
```

### Excel 소스: 태창금속 BOM.xlsx - 5개 고객사 시트

| Excel 컬럼명 | Supabase 컬럼 | 타입 변환 | 비고 |
|-------------|--------------|---------|------|
| 품번 (상단) | parent_item_id | FK | items 테이블 조회 |
| 품번 (하위) | child_item_id | FK | items 테이블 조회 |
| 소요량 | quantity_required | number | default 1 |
| - (계산) | level_no | number | parent=1, child=2 |

### 생성 로직

```typescript
// 1. parent_item_id 찾기
const parentItem = await supabase
  .from('items')
  .select('item_id')
  .eq('item_code', row.parent_item_code)
  .single();

// 2. child_item_id 찾기
const childItem = await supabase
  .from('items')
  .select('item_id')
  .eq('item_code', row.child_item_code)
  .single();

// 3. BOM 관계 생성
const bomEntry = {
  parent_item_id: parentItem.item_id,
  child_item_id: childItem.item_id,
  quantity_required: row.quantity_required || 1,
  level_no: 2, // 2-레벨 BOM
  is_active: true
};
```

---

## 4. coil_specs (COIL 스펙) 테이블

### Supabase 스키마
```typescript
{
  item_id: number;                 // PK, FK → items
  material_grade: string;          // 재질 등급
  thickness: number;               // 두께 (mm)
  width: number;                   // 폭 (mm)
  length: number;                  // 길이 (mm)
  sep_factor: number;              // SEP 계수
  density: number;                 // 비중
  kg_unit_price?: number;          // KG 단가
  piece_unit_price?: number;       // EA 단가 (계산)
  weight_per_piece?: number;       // EA당 중량 (계산)
  created_at: timestamp;
  updated_at: timestamp;
}
```

### Excel 소스: 태창금속 BOM.xlsx - 최신단가 시트 (COIL 품목)

| Excel 컬럼명 | Supabase 컬럼 | 타입 변환 | 수식 |
|-------------|--------------|---------|------|
| 코드 | item_id | FK | items 테이블 조회 |
| 재질 | material_grade | string | |
| 두께 | thickness | number | mm |
| 폭 | width | number | mm |
| 길이 | length | number | mm |
| SEP | sep_factor | number | |
| 비중 | density | number | |
| KG단가 | kg_unit_price | number | |
| EA중량 | weight_per_piece | number | **(비중×길이×폭×두께) / 1M / SEP** |
| 단품단가 | piece_unit_price | number | **KG단가 × EA중량** |

### 계산 로직

```typescript
const calculateCoilSpecs = (row: CoilExcelRow) => {
  // EA중량 = (비중 × 길이 × 폭 × 두께) / 1,000,000 / SEP
  const weight_per_piece =
    (row.density * row.length * row.width * row.thickness) /
    1_000_000 /
    row.sep_factor;

  // 단품단가 = KG단가 × EA중량
  const piece_unit_price = row.kg_unit_price * weight_per_piece;

  return {
    item_id: findItemId(row.item_code),
    material_grade: row.material,
    thickness: row.thickness,
    width: row.width,
    length: row.length,
    sep_factor: row.sep_factor,
    density: row.density,
    kg_unit_price: row.kg_unit_price,
    weight_per_piece,
    piece_unit_price
  };
};
```

---

## 5. price_master (단가표) 테이블

### Supabase 스키마
```typescript
{
  price_id: number;                // PK, auto-increment
  item_id: number;                 // FK → items
  unit_price: number;              // 단가
  effective_date: date;            // 적용일
  is_current: boolean;             // 현재 단가 여부 (item당 1개만 true)
  price_type?: string;             // KG/EA 등
  notes?: string;
  created_at: timestamp;
  updated_at: timestamp;
}
```

### Excel 소스: 태창금속 BOM.xlsx - 최신단가 시트

| Excel 컬럼명 | Supabase 컬럼 | 타입 변환 | 비고 |
|-------------|--------------|---------|------|
| 코드 | item_id | FK | items 테이블 조회 |
| KG단가 | unit_price | number | price_type='KG' |
| 단품단가 | unit_price | number | price_type='EA' |
| - (고정값) | effective_date | date | 2025-09-01 (기준일) |
| - (고정값) | is_current | boolean | true |

### 생성 로직

```typescript
// 1. 기존 현재 단가 해제
await supabase
  .from('price_master')
  .update({ is_current: false })
  .eq('item_id', itemId);

// 2. 새 단가 등록
const prices = [];

// KG 단가
if (row.kg_unit_price) {
  prices.push({
    item_id: itemId,
    unit_price: row.kg_unit_price,
    price_type: 'KG',
    effective_date: '2025-09-01',
    is_current: true
  });
}

// EA 단가
if (row.piece_unit_price) {
  prices.push({
    item_id: itemId,
    unit_price: row.piece_unit_price,
    price_type: 'EA',
    effective_date: '2025-09-01',
    is_current: true
  });
}

await supabase.from('price_master').insert(prices);
```

---

## 6. scrap_tracking (스크랩 추적) 테이블

### Supabase 스키마
```typescript
{
  scrap_id: number;                // PK, auto-increment
  item_id: number;                 // FK → items
  tracking_date: date;             // 추적일
  production_quantity: number;     // 생산 수량
  scrap_weight: number;            // 스크랩 중량 (KG)
  scrap_unit_price: number;        // 스크랩 단가 (원/KG)
  scrap_revenue?: number;          // 스크랩 수익 (계산)
  notes?: string;
  is_active: boolean;              // default true
  created_at: timestamp;
  updated_at: timestamp;
}
```

### Excel 소스: 태창금속 BOM.xlsx - 각 고객사 시트

| Excel 컬럼명 | Supabase 컬럼 | 타입 변환 | 수식 |
|-------------|--------------|---------|------|
| 품번 | item_id | FK | items 테이블 조회 |
| - (고정값) | tracking_date | date | 2025-09-01 |
| 실적수량 | production_quantity | number | |
| 스크랩중량 | scrap_weight | number | KG |
| 스크랩단가 | scrap_unit_price | number | 원/KG |
| 스크랩금액 | scrap_revenue | number | **실적수량 × 스크랩중량 × 스크랩단가** |

### 계산 로직

```typescript
const calculateScrapRevenue = (row: ScrapExcelRow) => {
  const scrap_revenue =
    row.production_quantity *
    row.scrap_weight *
    row.scrap_unit_price;

  return {
    item_id: findItemId(row.item_code),
    tracking_date: '2025-09-01',
    production_quantity: row.production_quantity,
    scrap_weight: row.scrap_weight,
    scrap_unit_price: row.scrap_unit_price,
    scrap_revenue,
    is_active: true
  };
};
```

---

## 7. inventory_transactions (재고 거래) 테이블

### Supabase 스키마
```typescript
{
  transaction_id: number;          // PK, auto-increment
  item_id: number;                 // FK → items
  transaction_type: '입고' | '출고' | '생산입고' | '생산출고' | '조정';
  quantity: number;                // 수량 (항상 양수)
  transaction_date: date;          // 거래일
  unit_price?: number;
  total_amount?: number;
  warehouse_id?: number;           // FK → warehouses
  company_id?: number;             // FK → companies
  reference_number?: string;
  document_number?: string;
  lot_number?: string;
  expiry_date?: date;
  location?: string;
  notes?: string;
  status: '대기' | '완료' | '취소';
  created_at: timestamp;
  updated_at: timestamp;
}
```

### Excel 소스: 2025년 9월 19일 종합관리 SHEET.xlsx

**시트 1: 종합재고** (393 rows)
**시트 2: COIL 입고현황** (389 rows)
**시트 3: SHEET 입고현황** (381 rows)
**시트 4: 생산실적** (96 rows)

#### 컬럼 구조 (시계열 데이터)
- 품명 (item_name)
- 규격 (spec)
- 차종 (vehicle_model)
- T1, T2, T3, ..., T268 (268개 일별 데이터 컬럼)

### 변환 로직

```typescript
const parseInventoryTransactions = async (
  excelRows: ExcelRow[],
  sheetType: 'COIL입고' | 'SHEET입고' | '생산실적'
) => {
  const transactions: InventoryTransaction[] = [];
  const baseDate = new Date('2025-01-01'); // 시작일

  for (const row of excelRows) {
    const itemId = await findItemId(row.품명, row.규격);

    // 268개 일별 컬럼 순회
    for (let day = 1; day <= 268; day++) {
      const columnName = `T${day}`;
      const quantity = row[columnName];

      if (!quantity || quantity === 0) continue;

      // 거래 유형 결정
      let transactionType: TransactionType;
      if (sheetType === 'COIL입고' || sheetType === 'SHEET입고') {
        transactionType = quantity > 0 ? '입고' : '출고';
      } else if (sheetType === '생산실적') {
        transactionType = '생산입고';
      }

      // 거래일 계산 (baseDate + day)
      const transactionDate = new Date(baseDate);
      transactionDate.setDate(transactionDate.getDate() + day - 1);

      transactions.push({
        item_id: itemId,
        transaction_type: transactionType,
        quantity: Math.abs(quantity),
        transaction_date: transactionDate.toISOString().split('T')[0],
        status: '완료',
        notes: `${sheetType} - ${row.품명}`
      });
    }
  }

  return transactions;
};
```

### 예시 데이터 변환

**Excel 원본:**
```
품명     | 규격 | 차종    | T1  | T2  | T3  | ...
부품A   | S01  | 소나타  | 100 | -50 | 200 | ...
```

**변환 후 (3개 거래):**
```typescript
[
  {
    item_id: 1,
    transaction_type: '입고',
    quantity: 100,
    transaction_date: '2025-01-01',
    status: '완료'
  },
  {
    item_id: 1,
    transaction_type: '출고',
    quantity: 50,
    transaction_date: '2025-01-02',
    status: '완료'
  },
  {
    item_id: 1,
    transaction_type: '입고',
    quantity: 200,
    transaction_date: '2025-01-03',
    status: '완료'
  }
]
```

---

## 8. purchase_transactions (매입 거래) 테이블

### Supabase 스키마
```typescript
{
  transaction_id: number;          // PK, auto-increment
  transaction_no: string;          // UNIQUE (PUR-202509-001)
  transaction_date: date;          // 거래일
  supplier_id: number;             // FK → companies
  supplier_name?: string;          // 중복 데이터 (검색 최적화)
  item_id: number;                 // FK → items
  item_name?: string;              // 중복 데이터
  quantity: number;
  unit: string;
  unit_price: number;
  supply_amount: number;           // 공급가
  tax_amount?: number;             // 세액 (10%)
  total_amount: number;            // 합계
  spec?: string;
  material_type?: string;
  vehicle_model?: string;
  warehouse_location?: string;
  receiving_date?: date;           // 입고일
  payment_due_date?: date;         // 지급기한
  payment_status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
  paid_amount?: number;            // 지급액 (자동 계산)
  tax_invoice_id?: number;
  tax_invoice_received?: boolean;
  notes?: string;
  is_active: boolean;              // default true
  created_at: timestamp;
  updated_at: timestamp;
}
```

### Excel 소스 1: 2025년 9월 매입매출 보고현황.xlsx

| Excel 컬럼명 | Supabase 컬럼 | 타입 변환 | 비고 |
|-------------|--------------|---------|------|
| 매입일자 | transaction_date | date | |
| 공급사명 | supplier_id | FK | companies 조회 |
| 품명 | item_name | string | item_id 찾기 참고 |
| 품번 | item_id | FK | items 조회 |
| 규격 | spec | string | |
| 수량 | quantity | number | |
| 단위 | unit | string | |
| 단가 | unit_price | number | |
| 공급가 | supply_amount | number | |
| 세액 | tax_amount | number | |
| 합계 | total_amount | number | |
| 입고일 | receiving_date | date | |
| 비고 | notes | string | |
| - (자동생성) | transaction_no | string | PUR-202509-001 |
| - (계산) | payment_status | enum | paid_amount 기준 |

### Excel 소스 2: 2025년 09월 매입 수불관리.xlsx (상세 데이터)

_동일한 매핑 + 추가 필드_

| Excel 컬럼명 | Supabase 컬럼 | 타입 변환 | 비고 |
|-------------|--------------|---------|------|
| 차종 | vehicle_model | string | |
| 재질타입 | material_type | string | |
| 창고위치 | warehouse_location | string | |
| 지급기한 | payment_due_date | date | |
| 세금계산서번호 | tax_invoice_id | number | |

### 생성 로직

```typescript
const createPurchaseTransaction = async (row: PurchaseExcelRow) => {
  // 1. supplier_id 찾기
  const supplier = await supabase
    .from('companies')
    .select('company_id')
    .eq('company_name', row.supplier_name)
    .single();

  // 2. item_id 찾기
  const item = await supabase
    .from('items')
    .select('item_id')
    .eq('item_name', row.item_name)
    .eq('spec', row.spec)
    .single();

  // 3. transaction_no 생성 (PUR-202509-001)
  const transactionNo = await generateTransactionNo('PUR', '202509');

  // 4. payment_status 계산
  const payment_status =
    row.paid_amount === 0 ? 'PENDING' :
    row.paid_amount < row.total_amount ? 'PARTIAL' :
    'COMPLETED';

  return {
    transaction_no: transactionNo,
    transaction_date: row.transaction_date,
    supplier_id: supplier.company_id,
    supplier_name: row.supplier_name,
    item_id: item.item_id,
    item_name: row.item_name,
    quantity: row.quantity,
    unit: row.unit || 'EA',
    unit_price: row.unit_price,
    supply_amount: row.supply_amount,
    tax_amount: row.tax_amount || row.supply_amount * 0.1,
    total_amount: row.total_amount,
    spec: row.spec,
    material_type: row.material_type,
    vehicle_model: row.vehicle_model,
    warehouse_location: row.warehouse_location,
    receiving_date: row.receiving_date,
    payment_due_date: row.payment_due_date,
    payment_status,
    paid_amount: row.paid_amount || 0,
    tax_invoice_id: row.tax_invoice_id,
    tax_invoice_received: !!row.tax_invoice_id,
    notes: row.notes,
    is_active: true
  };
};
```

---

## 9. sales_transactions (매출 거래) 테이블

### Supabase 스키마
```typescript
{
  transaction_id: number;          // PK, auto-increment
  transaction_no: string;          // UNIQUE (SAL-202509-001)
  transaction_date: date;          // 거래일
  customer_id: number;             // FK → companies
  customer_name?: string;          // 중복 데이터
  item_id: number;                 // FK → items
  item_name?: string;              // 중복 데이터
  quantity: number;
  unit: string;
  unit_price: number;
  supply_amount: number;           // 공급가
  tax_amount?: number;             // 세액 (10%)
  total_amount: number;            // 합계
  spec?: string;
  material_type?: string;
  vehicle_model?: string;
  delivery_address?: string;       // 배송지
  delivery_date?: date;            // 배송일
  payment_due_date?: date;         // 수금기한
  payment_status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
  paid_amount?: number;            // 수금액 (자동 계산)
  tax_invoice_id?: number;
  tax_invoice_issued?: boolean;
  notes?: string;
  is_active: boolean;              // default true
  created_at: timestamp;
  updated_at: timestamp;
}
```

### Excel 소스: 2025년 9월 매입매출 보고현황.xlsx

| Excel 컬럼명 | Supabase 컬럼 | 타입 변환 | 비고 |
|-------------|--------------|---------|------|
| 매출일자 | transaction_date | date | |
| 고객사명 | customer_id | FK | companies 조회 |
| 품명 | item_name | string | item_id 찾기 참고 |
| 품번 | item_id | FK | items 조회 |
| 규격 | spec | string | |
| 수량 | quantity | number | |
| 단위 | unit | string | |
| 단가 | unit_price | number | |
| 공급가 | supply_amount | number | |
| 세액 | tax_amount | number | |
| 합계 | total_amount | number | |
| 차종 | vehicle_model | string | |
| 배송지 | delivery_address | string | |
| 배송일 | delivery_date | date | |
| 비고 | notes | string | |
| - (자동생성) | transaction_no | string | SAL-202509-001 |
| - (계산) | payment_status | enum | paid_amount 기준 |

### 생성 로직

_purchase_transactions와 동일한 패턴, prefix만 'SAL'_

---

## 🔍 데이터 검증 규칙

### 1. 외래 키 검증

```sql
-- 고아 레코드 체크 (items.supplier_id)
SELECT COUNT(*)
FROM items i
LEFT JOIN companies c ON i.supplier_id = c.company_id
WHERE i.supplier_id IS NOT NULL AND c.company_id IS NULL;

-- 고아 레코드 체크 (bom 관계)
SELECT COUNT(*)
FROM bom b
LEFT JOIN items parent ON b.parent_item_id = parent.item_id
LEFT JOIN items child ON b.child_item_id = child.item_id
WHERE parent.item_id IS NULL OR child.item_id IS NULL;
```

### 2. 데이터 타입 검증

```typescript
// 숫자형 필드 검증
const validateNumericFields = (data: any) => {
  const numericFields = [
    'quantity', 'unit_price', 'total_amount',
    'thickness', 'width', 'height', 'weight'
  ];

  for (const field of numericFields) {
    if (data[field] !== undefined && data[field] !== null) {
      if (isNaN(Number(data[field]))) {
        throw new Error(`${field} must be a number: ${data[field]}`);
      }
      if (Number(data[field]) < 0) {
        throw new Error(`${field} cannot be negative: ${data[field]}`);
      }
    }
  }
};
```

### 3. 계산 검증

```typescript
// 금액 계산 검증 (오차 허용: ±1원)
const validateAmounts = (row: TransactionRow) => {
  const calculated = row.supply_amount + (row.tax_amount || 0);
  const diff = Math.abs(calculated - row.total_amount);

  if (diff > 1) {
    console.warn(
      `Amount mismatch: supply(${row.supply_amount}) + tax(${row.tax_amount}) != total(${row.total_amount})`
    );
  }
};

// COIL 중량 계산 검증
const validateCoilWeight = (spec: CoilSpec) => {
  const calculated =
    (spec.density * spec.length * spec.width * spec.thickness) /
    1_000_000 /
    spec.sep_factor;

  const diff = Math.abs(calculated - spec.weight_per_piece);

  if (diff > 0.001) { // 1g 오차 허용
    console.warn(
      `Weight mismatch for item ${spec.item_id}: calculated ${calculated} != stored ${spec.weight_per_piece}`
    );
  }
};
```

### 4. 중복 데이터 검증

```sql
-- company_code 중복 체크
SELECT company_code, COUNT(*)
FROM companies
GROUP BY company_code
HAVING COUNT(*) > 1;

-- item_code 중복 체크
SELECT item_code, COUNT(*)
FROM items
GROUP BY item_code
HAVING COUNT(*) > 1;

-- transaction_no 중복 체크
SELECT transaction_no, COUNT(*)
FROM purchase_transactions
GROUP BY transaction_no
HAVING COUNT(*) > 1;
```

---

## 📝 매핑 요약

| Excel 파일 | 대상 테이블 | 예상 레코드 | 복잡도 |
|-----------|----------|-----------|--------|
| 태창금속 BOM - 최신단가 | companies | ~50 | 낮음 |
| 태창금속 BOM - 최신단가 | items | ~300 | 중간 |
| 태창금속 BOM - 최신단가 | price_master | ~300 | 낮음 |
| 태창금속 BOM - 5개 시트 | items | ~125 | 중간 |
| 태창금속 BOM - 5개 시트 | bom | 4,252 | 높음 |
| 태창금속 BOM - 5개 시트 | scrap_tracking | ~200 | 낮음 |
| 태창금속 BOM - COIL | coil_specs | ~100 | 높음 |
| 종합관리 SHEET - 4개 시트 | inventory_transactions | ~6,000 | 매우 높음 |
| 매입매출 보고현황 | purchase_transactions | ~1,500 | 중간 |
| 매입매출 보고현황 | sales_transactions | ~1,000 | 중간 |
| 매입 수불관리 | purchase_transactions | ~3,000 | 중간 |

**총 예상 레코드**: ~16,000개
**총 임포트 시간**: 35-55분 (파싱 15분 + 임포트 20-40분)

---

## 🚀 다음 단계

1. **Excel 파싱 스크립트 작성** - `xlsx` 라이브러리 사용
2. **데이터 변환 함수 작성** - 위 매핑 로직 구현
3. **배치 임포트 스크립트** - Supabase SDK 사용
4. **검증 스크립트 작성** - 위 검증 규칙 구현
5. **롤백 스크립트 준비** - 실패 시 복구 계획
