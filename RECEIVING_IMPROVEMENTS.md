# 입고 등록 페이지 개선사항

## 📋 개요

출고 등록 페이지와의 일관성을 위해 입고 등록 페이지에 필요한 개선사항을 정리했습니다.

**주요 개선사항:**

1. "거래일자" → "입고 예정일" 레이블 변경 (출고와 일관성)
2. 입고번호 자동생성 기능 추가 (RCV-YYYYMMDDHHMM 형식)
3. "도착 예정일" 필드 추가 (delivery_date와 유사)

---

## 🔍 현재 상태 분석

### ReceivingForm.tsx 현재 필드 구조

```typescript
// 현재 필드 (src/components/ReceivingForm.tsx)
- 거래일자 (transaction_date) - line 141 ⚠️
- 공급업체 (company_id) - line 160
- 품목 (item_id) - line 175
- 수량 (quantity) - line 190
- 단가 (unit_price) - line 215
- 참조번호 (reference_no) - line 237 ⚠️
- LOT 번호 (lot_no) - line 252
- 만료일 (expiry_date) - line 267
- 입고 위치 (to_location) - line 286
- 메모 (notes)
```

### ShippingForm.tsx 비교 (참고용)

```typescript
// 출고 폼의 개선된 필드 (src/components/ShippingForm.tsx)
- 출고 예정일 (transaction_date) - line 311 ✅
- 고객사 (customer_id) - line 330
- 출고번호 (reference_no) - line 345 + 자동생성 버튼 ✅
- 배송 예정일 (delivery_date) - line 372 ✅
- 배송주소 (delivery_address)
- 출고 제품 추가 (다중 품목 지원)
```

---

## 📝 개선 계획

### 1. 레이블 변경: "거래일자" → "입고 예정일"

**목적**: 출고 폼과 일관성 유지

**변경 위치**: `src/components/ReceivingForm.tsx:141`

**변경 전:**
```tsx
<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
  <Calendar className="w-4 h-4 inline mr-2" />
  거래일자 <span className="text-gray-500">*</span>
</label>
```

**변경 후:**
```tsx
<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
  <Calendar className="w-4 h-4 inline mr-2" />
  입고 예정일 <span className="text-gray-500">*</span>
</label>
```

---

### 2. 입고번호 자동생성 기능 추가

**목적**: 출고번호 자동생성(SHP-YYYYMMDDHHMM)처럼 입고번호도 자동 생성

**추가 위치**: `src/components/ReceivingForm.tsx:237` (참조번호 필드)

**구현 패턴** (ShippingForm.tsx:358-366 참고):

```tsx
// 자동생성 함수
const handleGenerateReference = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const referenceNo = `RCV-${year}${month}${day}${hours}${minutes}`;
  setFormData(prev => ({ ...prev, reference_no: referenceNo }));
};
```

**UI 변경:**

**변경 전:**
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
    참조번호
  </label>
  <input
    type="text"
    name="reference_no"
    value={formData.reference_no}
    onChange={handleChange}
    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg..."
    placeholder="예: PO-2024-001"
  />
</div>
```

**변경 후:**
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
    입고번호
  </label>
  <div className="flex gap-2">
    <input
      type="text"
      name="reference_no"
      value={formData.reference_no}
      onChange={handleChange}
      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg..."
      placeholder="예: RCV-20251029143000"
    />
    <button
      type="button"
      onClick={handleGenerateReference}
      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      title="자동 생성"
    >
      <Plus className="w-4 h-4" />
    </button>
  </div>
</div>
```

---

### 3. "도착 예정일" 필드 추가

**목적**: 출고의 "배송 예정일"처럼 입고도 예상 도착일을 관리

**추가 위치**: `src/components/ReceivingForm.tsx` (공급업체 필드 다음, line 172 이후)

**데이터베이스 스키마**:
- 테이블: `inventory_transactions`
- 컬럼: `arrival_date DATE` (nullable)
- 마이그레이션 필요: `20250129_add_arrival_date_to_inventory_transactions.sql`

**새 필드 코드:**

```tsx
{/* 도착 예정일 */}
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
    도착 예정일
  </label>
  <input
    type="date"
    name="arrival_date"
    value={formData.arrival_date || ''}
    onChange={handleChange}
    className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      errors.arrival_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
    }`}
  />
  {errors.arrival_date && (
    <p className="mt-1 text-sm text-red-500">{errors.arrival_date}</p>
  )}
</div>
```

**FormData 타입 업데이트**:
```typescript
// src/types/inventory.ts
export interface ReceivingFormData {
  transaction_date: string;
  arrival_date?: string; // 새로 추가
  item_id: number;
  quantity: number;
  unit_price: number;
  company_id?: number;
  reference_no: string;
  lot_no: string;
  expiry_date: string;
  to_location: string;
  notes: string;
  created_by: number;
}
```

**Validation 추가**:
```typescript
// arrival_date는 transaction_date 이후여야 함
if (formData.arrival_date && formData.arrival_date < formData.transaction_date) {
  newErrors.arrival_date = '도착 예정일은 입고 예정일보다 뒤여야 합니다';
}
```

---

## 🗄️ 데이터베이스 마이그레이션

### 필요 마이그레이션

**파일명**: `supabase/migrations/20250129_add_arrival_date_to_inventory_transactions.sql`

```sql
-- 입고 거래에 도착 예정일 필드 추가
ALTER TABLE inventory_transactions
ADD COLUMN arrival_date DATE;

-- 코멘트 추가
COMMENT ON COLUMN inventory_transactions.arrival_date IS '도착 예정일 (입고 거래용)';

-- 인덱스 추가 (도착 예정일 기준 조회 성능 향상)
CREATE INDEX idx_inventory_transactions_arrival_date
ON inventory_transactions(arrival_date)
WHERE arrival_date IS NOT NULL;
```

**실행 명령어**:
```bash
npm run migrate:up
npm run db:types
```

---

## 🔧 API 엔드포인트 수정

### POST /api/inventory/receiving

**현재 구조** (src/app/api/inventory/receiving/route.ts:84-93):
```typescript
const {
  transaction_date,
  item_id,
  quantity,
  unit_price,
  company_id,
  reference_number,
  reference_no,
  notes
} = body;
```

**수정 후**:
```typescript
const {
  transaction_date,
  arrival_date,      // 새로 추가
  item_id,
  quantity,
  unit_price,
  company_id,
  reference_number,
  reference_no,
  notes
} = body;
```

**RPC 호출 수정** (line 111-120):
```typescript
const { data, error } = await supabase.rpc('create_receiving_transaction', {
  p_item_id: item_id,
  p_quantity: quantity,
  p_unit_price: unit_price,
  p_total_amount: total_amount,
  p_company_id: company_id,
  p_reference_number: reference_no || reference_number,
  p_transaction_date: transaction_date,
  p_arrival_date: arrival_date,  // 새로 추가
  p_notes: notes
});
```

**Supabase RPC 함수 업데이트 필요**:
- 함수명: `create_receiving_transaction`
- 파라미터 추가: `p_arrival_date DATE DEFAULT NULL`

---

## ✅ 테스트 체크리스트

### UI 테스트

- [ ] "입고 예정일" 레이블 표시 확인
- [ ] "도착 예정일" 필드 표시 확인
- [ ] 입고번호 자동생성 버튼 동작
- [ ] 자동생성된 번호 형식 확인 (RCV-YYYYMMDDHHMM)
- [ ] 날짜 검증 (도착일 >= 입고일)
- [ ] 폼 제출 정상 동작
- [ ] 성공 메시지 표시
- [ ] 테이블에 새 레코드 표시

### 데이터 검증

- [ ] arrival_date가 데이터베이스에 저장
- [ ] 날짜 형식 올바름 (YYYY-MM-DD)
- [ ] null 허용됨 (선택사항)
- [ ] 수정 시 업데이트 정상 동작

### API 테스트

- [ ] POST /api/inventory/receiving 정상 응답
- [ ] GET /api/inventory/receiving에 arrival_date 포함
- [ ] 입고번호 중복 허용 여부 확인

---

## 📊 우선순위

### 높음 (즉시 구현 권장)

1. **레이블 변경**: "거래일자" → "입고 예정일"
   - 난이도: 매우 낮음
   - 영향도: UI 일관성 향상
   - 예상 시간: 5분

2. **입고번호 자동생성 기능**
   - 난이도: 낮음
   - 영향도: 사용자 편의성 대폭 향상
   - 예상 시간: 30분

### 중간 (계획 후 구현)

3. **도착 예정일 필드 추가**
   - 난이도: 중간
   - 영향도: 데이터베이스 스키마 변경 필요
   - 예상 시간: 2시간
   - 작업 범위:
     - 데이터베이스 마이그레이션
     - 프론트엔드 폼 수정
     - API 라우트 수정
     - Supabase RPC 함수 수정
     - 타입 정의 업데이트

---

## 🔄 구현 순서

### Phase 1: UI 일관성 개선 (30분)

1. 레이블 변경: "거래일자" → "입고 예정일"
2. 입고번호 자동생성 기능 추가
3. 테스트

### Phase 2: 도착 예정일 기능 (2시간)

1. 데이터베이스 마이그레이션 작성 및 실행
2. TypeScript 타입 업데이트
3. ReceivingForm.tsx에 arrival_date 필드 추가
4. API 라우트 수정
5. Supabase RPC 함수 수정
6. 테스트

### Phase 3: 검증 및 문서화 (30분)

1. 전체 입고 프로세스 테스트
2. 테스트 가이드 문서 작성
3. 개발자 문서 업데이트

---

## 📚 참고 파일

### 주요 수정 대상 파일

1. **프론트엔드 컴포넌트**
   - `src/components/ReceivingForm.tsx`
   - `src/types/inventory.ts`

2. **API 라우트**
   - `src/app/api/inventory/receiving/route.ts`

3. **데이터베이스**
   - `supabase/migrations/20250129_add_arrival_date_to_inventory_transactions.sql` (신규)

### 참고용 파일 (출고 폼 패턴)

- `src/components/ShippingForm.tsx:311-386` (레이블, 자동생성, 배송일)
- `src/app/api/inventory/shipping/route.ts:62-75` (API 처리)
- `supabase/migrations/20250129_add_delivery_date_to_inventory_transactions.sql` (마이그레이션 예시)

---

## 🚨 주의사항

### 한글 인코딩

- API 요청 시 `request.text()` + `JSON.parse()` 패턴 사용 필수
- 현재 `/api/inventory/receiving`은 `request.json()` 사용 중 ⚠️
- 한글 입력 시 깨짐 발생 가능성 있음

### 데이터베이스 마이그레이션

- 마이그레이션 실행 전 백업 필수
- Production 환경에서는 `arrival_date` 컬럼 추가 시 기존 데이터 영향 없음 (nullable)

### API 호환성

- Supabase RPC 함수 수정 시 기존 호출부 영향 확인 필요
- 파라미터 추가는 `DEFAULT NULL`로 하여 하위 호환성 유지

---

**작성일**: 2025-10-29
**버전**: 1.0
**대상**: 입고 등록 페이지 개선
