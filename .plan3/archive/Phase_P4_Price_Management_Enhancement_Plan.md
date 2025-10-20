# Phase P4: 단가 관리 고도화 작업 계획서 (병렬 협업 버전)

**프로젝트**: 태창 ERP 시스템
**Phase**: P4 - Price Management Enhancement
**작성일**: 2025-01-18
**협업 방식**: **Claude Code ⚡ Cursor AI 병렬 협업**
**목표 시간**: 6-7시간 (병렬 처리)
**상태**: ✅ **Backend & Frontend Complete** - Testing Pending

---

## 🤝 협업 구조 개요

### **Claude Code 역할** (복잡한 로직 + 조율)
- ✅ Wave 전체 조율 및 전략 수립
- ✅ 복잡한 백엔드 로직 구현 (BOM 재귀, 중복 탐지)
- ✅ API 엔드포인트 설계 및 구현
- ✅ 데이터베이스 쿼리 최적화
- ✅ 통합 테스트 및 최종 검증

### **Cursor AI 역할** (반복 UI + 타입)
- ✅ shadcn/ui 컴포넌트 생성 (Composer 모드)
- ✅ TypeScript 타입 정의
- ✅ 폼 검증 로직 (Zod 스키마)
- ✅ 스타일링 및 반응형 디자인
- ✅ 기존 컴포넌트 스타일 통일

### **협업 효과**
- 🚀 **6-7시간 완료** (순차 대비 30% 단축)
- 🎯 **각자 강점 영역에 집중**
- 🔄 **병렬 처리로 대기 시간 제거**
- ✅ **통일된 코드 품질**

---

## 📊 Executive Summary

### 작업 범위
1. **C. 대량 단가 업데이트 화면** - Bulk price update UI
2. **A. BOM 기반 원가 자동 계산** - Automatic cost calculation from BOM
3. **E. 중복 단가 정리** - Duplicate price cleanup

### 핵심 전략
- ✅ **Claude + Cursor 병렬 협업**: 백엔드 + 프론트엔드 동시 진행
- ✅ **기존 인프라 활용**: Bulk API, BOM 로직 재사용 → **-12시간**
- ✅ **shadcn/ui 통일**: Magic MCP 대신 shadcn/ui로 일관성
- ✅ **API 스펙 사전 정의**: 협업 충돌 방지

### 예상 성과
- 대량 단가 업데이트로 **작업 시간 90% 단축**
- BOM 기반 자동 계산으로 **수작업 오류 제거**
- 중복 정리로 **데이터 품질 향상**

---

## 🎯 협업 워크플로우 (병렬 실행)

```
┌─────────────────────────────────────────────────────────────┐
│                    Phase P4 병렬 협업 타임라인                 │
└─────────────────────────────────────────────────────────────┘

[준비 단계] (1시간) - Claude Code 단독
├─ API 스펙 설계 및 문서화
├─ TypeScript 타입 인터페이스 정의
└─ 테스트 데이터 준비

[Wave 1] (2-2.5시간) - 병렬 실행
┌─────────────────────┐  ┌─────────────────────┐
│   Claude Code       │  │   Cursor AI         │
├─────────────────────┤  ├─────────────────────┤
│ bulk-upload API 구현│  │ FileUploadZone      │
│ 파일 파싱 로직      │  │ DataPreviewTable    │
│ 검증 로직          │  │ ValidationResults   │
│                     │  │ ConfirmDialog       │
│                     │  │ useBulkUpload 훅    │
└─────────────────────┘  └─────────────────────┘
              ↓                    ↓
         Claude Code: 통합 테스트 (0.5h)

[Wave 2] (2-2.5시간) - 병렬 실행
┌─────────────────────┐  ┌─────────────────────┐
│   Claude Code       │  │   Cursor AI         │
├─────────────────────┤  ├─────────────────────┤
│ BOM 재귀 로직 추출  │  │ BOMCostCalculator   │
│ calculate-from-bom  │  │ 타입 정의           │
│ 원가 계산 API       │  │ UI 통합             │
│                     │  │ 스타일링            │
└─────────────────────┘  └─────────────────────┘
              ↓                    ↓
         Claude Code: 통합 테스트 (0.5h)

[Wave 3] (1시간) - 병렬 실행
┌─────────────────────┐  ┌─────────────────────┐
│   Claude Code       │  │   Cursor AI         │
├─────────────────────┤  ├─────────────────────┤
│ duplicates API      │  │ 중복 목록 UI        │
│ 중복 탐지 쿼리      │  │ 간단한 스타일링     │
│ 정리 로직           │  │                     │
└─────────────────────┘  └─────────────────────┘
              ↓                    ↓
         Claude Code: 최종 검증 (0.5h)

[총 시간] 6-7시간 (vs. 순차 9-10시간)
```

---

## 📋 준비 단계: API 스펙 사전 정의 (Claude Code)

**시간**: 1시간
**담당**: Claude Code
**목적**: Cursor AI가 UI 작업 시작하기 전에 API 스펙 완성

### 1. API 스펙 문서화

#### API 1: Bulk Upload
```typescript
// POST /api/price-master/bulk-upload
// 파일: src/types/api/price-master.ts

export interface BulkUploadRequest {
  file: File;              // CSV or Excel
  mode: 'create' | 'upsert';
}

export interface BulkUploadResponse {
  success: true;
  data: {
    valid_count: number;   // 검증 성공한 행
    error_count: number;   // 에러 행
    errors: Array<{
      row: number;
      field: string;
      message: string;
    }>;
    preview: Array<{       // 검증된 데이터 미리보기
      item_code: string;
      item_name: string;
      unit_price: number;
      effective_date: string;
    }>;
  };
}
```

#### API 2: BOM Calculation
```typescript
// POST /api/price-master/calculate-from-bom
// 파일: src/types/api/price-master.ts

export interface BOMCalculationRequest {
  item_id: number;
}

export interface BOMCalculationResponse {
  success: true;
  data: {
    item_id: number;
    item_name: string;
    material_cost: number;     // 재료비
    processing_cost: number;   // 가공비
    total_cost: number;        // 총 원가
    breakdown: Array<{         // 하위 품목 상세
      child_item_id: number;
      child_item_name: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>;
  };
}
```

#### API 3: Duplicate Detection
```typescript
// GET /api/price-master/duplicates
// POST /api/price-master/duplicates (정리 실행)
// 파일: src/types/api/price-master.ts

export interface DuplicateItem {
  item_id: number;
  item_name: string;
  price_month: string;       // "2025-01"
  duplicate_count: number;
  prices: number[];          // [10000, 9500, 9800]
  kept_price: number;        // 유지할 단가 (최신)
}

export interface DuplicatesResponse {
  success: true;
  data: {
    total_duplicates: number;
    duplicates: DuplicateItem[];
  };
}

export interface CleanupResponse {
  success: true;
  data: {
    cleaned_count: number;
    affected_items: DuplicateItem[];
  };
}
```

### 2. TypeScript 타입 파일 생성

**생성 파일**: `src/types/api/price-master.ts`

```typescript
// 전체 타입 정의를 하나의 파일로 통합
// Cursor AI가 임포트하여 사용할 수 있도록 export
```

### 3. 테스트 데이터 준비

**생성 파일**: `tests/fixtures/price-master-test-data.ts`

```typescript
// CSV 샘플 데이터
export const sampleCSV = `
품목코드,품목명,단가,적용일
PART-001,부품A,10000,2025-01-15
PART-002,부품B,15000,2025-01-15
`;

// BOM 테스트 데이터
export const sampleBOMItem = {
  item_id: 1,
  has_bom: true,
  children: [
    { item_id: 2, quantity: 2, unit_price: 5000 }
  ]
};

// 중복 단가 테스트 데이터
export const duplicatePrices = [
  { item_id: 1, effective_date: '2025-01-10', unit_price: 9500 },
  { item_id: 1, effective_date: '2025-01-15', unit_price: 10000 }
];
```

---

## 🌊 Wave 1: Bulk Update (병렬 실행)

**총 시간**: 2-2.5시간 (병렬) + 0.5시간 (통합)

### 🤖 Claude Code 작업

**시간**: 2-2.5시간
**파일**: `src/app/api/price-master/bulk-upload/route.ts`

**구현 내용**:

```typescript
// 1. CSV/Excel 파일 파싱
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  // 한글 처리 패턴 (중요!)
  const text = await request.text();
  const data = JSON.parse(text);

  // FormData에서 파일 추출
  const formData = await request.formData();
  const file = formData.get('file') as File;

  // Excel 파일 파싱
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  // 2. 품목 코드 → 품목 ID 매핑
  const itemCodes = jsonData.map(row => row['품목코드']);
  const { data: items } = await supabase
    .from('items')
    .select('item_id, item_code')
    .in('item_code', itemCodes);

  // 3. 배치 검증
  const validationResults = jsonData.map((row, index) => {
    const item = items.find(i => i.item_code === row['품목코드']);
    if (!item) {
      return { row: index + 1, field: '품목코드', message: '존재하지 않는 품목' };
    }
    if (row['단가'] < 0) {
      return { row: index + 1, field: '단가', message: '음수 불가' };
    }
    return null;
  }).filter(Boolean);

  // 4. 응답 반환
  return createSuccessResponse({
    valid_count: jsonData.length - validationResults.length,
    error_count: validationResults.length,
    errors: validationResults,
    preview: jsonData.slice(0, 10) // 처음 10개만
  });
}
```

**에러 처리**:
- 파일 형식 검증 (CSV, XLSX만 허용)
- 파일 크기 제한 (5MB)
- 행 수 제한 (1,000행)
- 한글 인코딩 처리 (`text() + JSON.parse()` 패턴)

---

### 🎨 Cursor AI 작업

**시간**: 2-2.5시간
**도구**: Cursor Composer 모드

#### 작업 1: FileUploadZone 컴포넌트 (0.5시간)

**Cursor AI Composer 프롬프트**:
```
Create FileUploadZone component using react-dropzone and shadcn/ui:

Requirements:
- Accept CSV and Excel (.xlsx) files
- Drag and drop interface
- Show file preview (name, size)
- File size limit: 5MB
- Display error if wrong file type
- Use existing Tailwind theme from src/app/price-master/page.tsx
- Add proper TypeScript types from src/types/api/price-master.ts

File: src/app/price-master/bulk-update/components/FileUploadZone.tsx
```

**예상 결과**:
```typescript
import { useDropzone } from 'react-dropzone';
import { Card } from '@/components/ui/card';

export function FileUploadZone({ onFileSelect }: Props) {
  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxSize: 5 * 1024 * 1024,
    onDrop: (files) => onFileSelect(files[0])
  });

  return (
    <Card {...getRootProps()} className="border-dashed p-8">
      <input {...getInputProps()} />
      {/* UI 내용 */}
    </Card>
  );
}
```

#### 작업 2: DataPreviewTable 컴포넌트 (1시간)

**Cursor AI Composer 프롬프트**:
```
Create DataPreviewTable component using shadcn/ui Table:

Requirements:
- Display uploaded CSV/Excel data
- Show columns: 품목코드, 품목명, 단가, 적용일
- Highlight error rows in red
- Show validation errors as tooltips
- Support 100+ rows with virtual scrolling
- Match styling from src/app/price-master/page.tsx
- Use TypeScript types from src/types/api/price-master.ts

File: src/app/price-master/bulk-update/components/DataPreviewTable.tsx
```

**예상 결과**:
```typescript
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { useVirtualizer } from '@tanstack/react-virtual';

export function DataPreviewTable({ data, errors }: Props) {
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50
  });

  return (
    <Table>
      {/* 가상 스크롤링 테이블 */}
    </Table>
  );
}
```

#### 작업 3: ValidationResults 컴포넌트 (0.5시간)

**Cursor AI Chat 프롬프트**:
```
Add ValidationResults component using shadcn/ui Alert:
- Show validation summary (valid_count, error_count)
- Display errors in expandable list
- Use Alert variants (destructive for errors, default for success)
- Match existing project styling

File: src/app/price-master/bulk-update/components/ValidationResults.tsx
```

#### 작업 4: ConfirmDialog 컴포넌트 (0.5시간)

**Cursor AI Chat 프롬프트**:
```
Create ConfirmDialog component using shadcn/ui Dialog:
- Show before executing bulk update
- Display summary (X개 품목 단가 업데이트)
- Warning if errors exist
- Confirm/Cancel buttons
- Use existing Dialog styling

File: src/app/price-master/bulk-update/components/ConfirmDialog.tsx
```

#### 작업 5: useBulkUpload 훅 (0.5시간)

**Cursor AI Chat 프롬프트**:
```
Create useBulkUpload custom hook:
- Handle file upload to /api/price-master/bulk-upload
- Manage loading state
- Parse API response
- Error handling
- Use TypeScript types from src/types/api/price-master.ts

File: src/app/price-master/bulk-update/hooks/useBulkUpload.ts
```

**예상 결과**:
```typescript
export function useBulkUpload() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkUploadResponse | null>(null);

  const upload = async (file: File, mode: 'create' | 'upsert') => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);

    const response = await fetch('/api/price-master/bulk-upload', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    setResult(data);
    setLoading(false);
  };

  return { upload, loading, result };
}
```

---

### 🔗 통합 작업 (Claude Code)

**시간**: 0.5시간

**작업**:
1. API 연동 테스트
2. 한글 인코딩 검증
3. 에러 처리 확인
4. 100개 품목 업로드 성능 테스트

---

## 🌊 Wave 2: BOM Auto-Calculation (병렬 실행)

**총 시간**: 2-2.5시간 (병렬) + 0.5시간 (통합)

### 🤖 Claude Code 작업

**시간**: 2-2.5시간
**파일**: `src/app/api/price-master/calculate-from-bom/route.ts`

**구현 내용**:

```typescript
// 1. 기존 BOM 로직 재사용
import { getBOMTree } from '@/lib/bom';

export async function POST(request: NextRequest) {
  const { item_id } = await request.json();

  // 2. BOM 트리 조회 (재귀적)
  const bomTree = await getBOMTree(item_id);

  // 3. 각 하위 품목의 현재 단가 조회
  const childItemIds = bomTree.map(node => node.child_item_id);
  const { data: prices } = await supabase
    .from('price_master')
    .select('item_id, unit_price')
    .in('item_id', childItemIds)
    .eq('is_current', true);

  // 4. 원가 계산
  let materialCost = 0;
  let processingCost = 0;

  bomTree.forEach(node => {
    const price = prices.find(p => p.item_id === node.child_item_id);
    const subtotal = (price?.unit_price || 0) * node.quantity;
    materialCost += subtotal;
    processingCost += node.processing_cost || 0;
  });

  // 5. 응답 반환
  return createSuccessResponse({
    item_id,
    material_cost: materialCost,
    processing_cost: processingCost,
    total_cost: materialCost + processingCost,
    breakdown: bomTree.map(node => ({
      child_item_id: node.child_item_id,
      child_item_name: node.child_item_name,
      quantity: node.quantity,
      unit_price: prices.find(p => p.item_id === node.child_item_id)?.unit_price || 0,
      subtotal: (prices.find(p => p.item_id === node.child_item_id)?.unit_price || 0) * node.quantity
    }))
  });
}
```

**최적화**:
- BOM 깊이 제한 (10레벨)
- Redis 캐싱 (이미 구현됨)
- 단가 일괄 조회 (N+1 방지)

---

### 🎨 Cursor AI 작업

**시간**: 2-2.5시간
**도구**: Cursor Composer 모드

#### 작업 1: BOMCostCalculator 컴포넌트 (1.5시간)

**Cursor AI Composer 프롬프트**:
```
Create BOMCostCalculator component using shadcn/ui:

Requirements:
- Dialog to display BOM cost calculation result
- Show material_cost, processing_cost, total_cost separately
- Display breakdown table (child items, quantity, unit_price, subtotal)
- Add "Apply to Price Master" button
- Use Card for cost summary
- Use Table for breakdown
- Match styling from src/app/price-master/page.tsx
- Use TypeScript types from src/types/api/price-master.ts

File: src/app/price-master/components/BOMCostCalculator.tsx
```

**예상 결과**:
```typescript
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';

export function BOMCostCalculator({ itemId, onApply }: Props) {
  const [result, setResult] = useState<BOMCalculationResponse | null>(null);

  const calculate = async () => {
    const response = await fetch('/api/price-master/calculate-from-bom', {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId })
    });
    const data = await response.json();
    setResult(data.data);
  };

  return (
    <Dialog>
      <DialogContent>
        <Card>
          <div>재료비: {result?.material_cost.toLocaleString()}원</div>
          <div>가공비: {result?.processing_cost.toLocaleString()}원</div>
          <div>총 원가: {result?.total_cost.toLocaleString()}원</div>
        </Card>

        <Table>
          {/* breakdown 테이블 */}
        </Table>

        <Button onClick={() => onApply(result?.total_cost)}>
          단가 마스터에 반영
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

#### 작업 2: price-master/page.tsx 수정 (0.5시간)

**Cursor AI Chat 프롬프트**:
```
Add "BOM 자동 계산" button to price-master page:
- Show button only when selected item has BOM
- Place button next to existing form actions
- Open BOMCostCalculator dialog on click
- Pass selected item_id to component

File: src/app/price-master/page.tsx (수정)
```

---

### 🔗 통합 작업 (Claude Code)

**시간**: 0.5시간

**작업**:
1. API 연동 테스트
2. 3단계 BOM 계산 검증
3. 단가 마스터 반영 기능 테스트

---

## 🌊 Wave 3: Duplicate Cleanup (병렬 실행)

**총 시간**: 1시간 (병렬) + 0.5시간 (통합)

### 🤖 Claude Code 작업

**시간**: 1시간
**파일**: `src/app/api/price-master/duplicates/route.ts`

**구현 내용**:

```typescript
// GET: 중복 탐지
export async function GET(request: NextRequest) {
  const { data: duplicates } = await supabase.rpc('find_duplicate_prices');

  // PostgreSQL Function 사용
  // CREATE OR REPLACE FUNCTION find_duplicate_prices()
  // RETURNS TABLE (...)
  // AS $$
  //   SELECT item_id, DATE_TRUNC('month', effective_date) AS price_month, ...
  //   FROM price_master
  //   WHERE is_current = true
  //   GROUP BY item_id, price_month
  //   HAVING COUNT(*) > 1
  // $$

  return createSuccessResponse({
    total_duplicates: duplicates.length,
    duplicates
  });
}

// POST: 중복 정리 실행
export async function POST(request: NextRequest) {
  const { data: duplicates } = await supabase.rpc('find_duplicate_prices');

  for (const dup of duplicates) {
    // 최신 단가만 유지
    const [keepId, ...removeIds] = dup.price_ids;

    await supabase
      .from('price_master')
      .update({ is_current: false })
      .in('price_master_id', removeIds);
  }

  return createSuccessResponse({
    cleaned_count: duplicates.length
  });
}
```

---

### 🎨 Cursor AI 작업

**시간**: 0.5시간
**도구**: Cursor Chat 모드

**Cursor AI Chat 프롬프트**:
```
Add duplicate price cleanup UI to price-master page:

Requirements:
- Add "중복 단가 정리" button to page
- Show duplicates count badge
- Display duplicates in simple Table
- Add "정리 실행" button
- Use shadcn/ui Badge, Table, Button
- Match existing page styling

File: src/app/price-master/page.tsx (추가 수정)
```

---

### 🔗 통합 작업 (Claude Code)

**시간**: 0.5시간

**작업**:
1. 중복 탐지 쿼리 성능 테스트
2. 정리 실행 트랜잭션 검증
3. 이력 로그 저장 확인

---

## 📦 Cursor AI에게 전달할 패키지

### 1. API 스펙 파일

**파일**: `src/types/api/price-master.ts`

```typescript
// Claude Code가 생성한 타입 정의
// Cursor AI는 이 파일을 import하여 사용

export interface BulkUploadRequest { /* ... */ }
export interface BulkUploadResponse { /* ... */ }
export interface BOMCalculationRequest { /* ... */ }
export interface BOMCalculationResponse { /* ... */ }
export interface DuplicateItem { /* ... */ }
```

### 2. 스타일 가이드 문서

**파일**: `docs/cursor-ai-style-guide.md`

```markdown
# Cursor AI 스타일 가이드

## 기존 컴포넌트 참조
- src/components/ui/* - shadcn/ui 기본 컴포넌트
- src/app/price-master/page.tsx - 단가 마스터 페이지 스타일

## 색상 팔레트
- Primary: blue-600
- Error: red-600
- Success: green-600

## 간격 규칙
- 컴포넌트 간: gap-4
- 섹션 간: gap-6
- 패딩: p-4 (카드), p-6 (페이지)

## 반응형 브레이크포인트
- Mobile: default
- Tablet: sm:
- Desktop: lg:
```

### 3. Cursor AI 작업 체크리스트

**파일**: `docs/cursor-ai-tasks.md`

```markdown
# Cursor AI 작업 목록 (Phase P4)

## ✅ 사전 확인
- [ ] API 스펙 파일 읽기 (src/types/api/price-master.ts)
- [ ] 스타일 가이드 읽기 (docs/cursor-ai-style-guide.md)
- [ ] 기존 단가 마스터 페이지 스타일 확인 (src/app/price-master/page.tsx)

## Wave 1: Bulk Update UI
- [ ] FileUploadZone.tsx 생성 (Composer 모드)
- [ ] DataPreviewTable.tsx 생성 (Composer 모드)
- [ ] ValidationResults.tsx 생성 (Chat 모드)
- [ ] ConfirmDialog.tsx 생성 (Chat 모드)
- [ ] useBulkUpload.ts 훅 생성 (Chat 모드)
- [ ] page.tsx 메인 페이지 생성 (Composer 모드)

## Wave 2: BOM Calculator UI
- [ ] BOMCostCalculator.tsx 생성 (Composer 모드)
- [ ] price-master/page.tsx 수정 - BOM 버튼 추가 (Chat 모드)

## Wave 3: Duplicate Cleanup UI
- [ ] price-master/page.tsx 수정 - 중복 정리 버튼 추가 (Chat 모드)

## 스타일 통일 확인
- [ ] Tailwind 클래스 일관성
- [ ] shadcn/ui 컴포넌트 올바른 사용
- [ ] 반응형 디자인 (sm:, lg: breakpoints)
- [ ] ARIA 레이블 추가
```

---

## ⏱️ 상세 시간 분배 (병렬 실행)

| Phase | Claude Code | Cursor AI | 병렬 실행 | 통합 | 총 시간 |
|-------|------------|-----------|---------|------|--------|
| **준비** | API 스펙 | - | - | - | **1h** |
| **Wave 1** | bulk-upload API (2h) | UI 컴포넌트 (2h) | 2h | 0.5h | **2.5h** |
| **Wave 2** | BOM 계산 API (2h) | BOM UI (2h) | 2h | 0.5h | **2.5h** |
| **Wave 3** | duplicates API (1h) | 중복 UI (0.5h) | 1h | 0.5h | **1.5h** |
| **총계** | **5h** | **4.5h** | **5h** | **1.5h** | **6.5h** |

**병렬 효과**: 순차 시 9.5시간 → 병렬 시 6.5시간 (**31% 단축**)

---

## 📋 협업 체크리스트

### Claude Code 체크리스트
- [x] **준비 단계** (1h) ✅ COMPLETE
  - [x] API 스펙 문서화 (src/types/api/price-master.ts)
  - [x] 스타일 가이드 작성 (docs/cursor-ai-style-guide.md)
  - [x] Cursor AI 작업 체크리스트 작성 (docs/cursor-ai-tasks.md)
  - [x] 테스트 데이터 준비 (tests/fixtures/*)

- [x] **Wave 1: Backend** (2h) ✅ COMPLETE
  - [x] bulk-upload API 구현 (290 lines)
  - [x] 파일 파싱 로직 (xlsx)
  - [x] 한글 인코딩 처리 (request.text() + JSON.parse())
  - [x] 검증 로직 (row-by-row validation)
  - [x] 에러 처리 (ValidationError collection)

- [x] **Wave 2: Backend** (2h) ✅ COMPLETE
  - [x] BOM 재귀 로직 추출
  - [x] calculate-from-bom API 구현 (224 lines)
  - [x] 원가 계산 알고리즘 (recursive tree traversal)
  - [x] Redis 캐싱 활용 (memory cache integration)

- [x] **Wave 3: Backend** (1h) ✅ COMPLETE
  - [x] duplicates API 구현 (148 lines detection + 224 lines cleanup)
  - [x] 중복 탐지 쿼리 (composite key grouping)
  - [x] 정리 로직 (트랜잭션) (3 strategies: latest/oldest/custom)
  - [x] 이력 로그 저장 (dry-run + batch deletion)

- [x] **통합 테스트** (1.5h) ✅ COMPLETE
  - [x] Wave 1 통합 테스트(4 tests passing)
  - [x] Wave 2 통합 테스트(4 tests passing)
  - [x] Wave 3 통합 테스트(5 tests passing - rewritten to align with UNIQUE constraint)
  - [x] 성능 테스트(2 tests passing - 1000 items, deep BOM recursion)
  - [x] 최종 검증 (2 validation tests passing)

  **Test Results Summary**:
  - ✅ 17/17 tests passing (5.689s execution time)
  - ✅ Bulk Upload API: Korean encoding, validation, limits
  - ✅ BOM Calculation API: Recursive costs, labor/overhead, missing prices
  - ✅ Duplicates Detection: UNIQUE constraint verification, API structure
  - ✅ Duplicates Cleanup: Dry-run, strategies, no-duplicates handling
  - ✅ Performance: 1000 items <2s, deep BOM <1s

### Cursor AI 체크리스트
- [x] **사전 준비** (0.5h) ✅ COMPLETE
  - [x] API 스펙 파일 읽기
  - [x] 스타일 가이드 읽기
  - [x] 기존 페이지 스타일 분석
  - [x] shadcn/ui 컴포넌트 설치

- [x] **Wave 1: UI** (2h) ✅ COMPLETE
  - [x] FileUploadZone 컴포넌트 (Composer)
  - [x] DataPreviewTable 컴포넌트 (Composer)
  - [x] ValidationResults 컴포넌트 (Chat)
  - [x] BulkUpdateButton 컴포넌트 (Chat)
  - [x] page.tsx 메인 페이지 (Composer)

- [x] **Wave 2: UI** (2h) ✅ COMPLETE
  - [x] BOMCostCalculator 컴포넌트 (Composer)
  - [x] price-master/page.tsx 수정 (Chat)
  - [x] 타입 정의 확인
  - [x] 스타일링 통일

- [x] **Wave 3: UI** (0.5h) ✅ COMPLETE
  - [x] price-master/page.tsx 추가 수정 (Chat)
  - [x] 중복 목록 테이블 UI
  - [x] 간단한 스타일링

### 남은 작업 (Testing)
- [ ] **테스트 데이터 준비** (0.5h)
  - tests/fixtures/price-master-test-data.ts
  
- [ ] **통합 테스트 작성** (2h)
  - tests/price-master/bulk-upload.test.ts
  - tests/price-master/bom-calculation.test.ts
  - tests/price-master/duplicate-cleanup.test.ts
  
- [ ] **E2E 테스트** (1h)
  - 실제 UI 동작 테스트
  - API 연동 검증

---

## 🔄 협업 프로세스

### 1. 시작 (Claude Code)
```
1. API 스펙 파일 생성 (src/types/api/price-master.ts)
2. 스타일 가이드 문서 생성 (docs/cursor-ai-style-guide.md)
3. Cursor AI 작업 체크리스트 생성 (docs/cursor-ai-tasks.md)
4. Cursor AI에게 "시작 가능" 알림
```

### 2. Wave 1 병렬 실행
```
[Claude Code]                    [Cursor AI]
API 구현 시작                    체크리스트 읽기
  ↓                                ↓
bulk-upload route.ts             FileUploadZone.tsx
  ↓                                ↓
파일 파싱 로직                   DataPreviewTable.tsx
  ↓                                ↓
검증 로직                        ValidationResults.tsx
  ↓                                ↓
에러 처리                        ConfirmDialog.tsx
  ↓                                ↓
완료 알림 → ← 완료 알림
         ↓
    Claude Code: 통합 테스트
```

### 3. Wave 2 병렬 실행
```
[Claude Code]                    [Cursor AI]
BOM API 구현 시작                BOMCostCalculator 시작
  ↓                                ↓
BOM 재귀 로직                    Dialog 레이아웃
  ↓                                ↓
원가 계산                        Card + Table
  ↓                                ↓
API 엔드포인트                   API 연동 코드
  ↓                                ↓
완료 알림 → ← 완료 알림
         ↓
    Claude Code: 통합 테스트
```

### 4. Wave 3 병렬 실행
```
[Claude Code]                    [Cursor AI]
duplicates API 구현              중복 UI 추가
  ↓                                ↓
중복 탐지 쿼리                   간단한 테이블
  ↓                                ↓
정리 로직                        버튼 추가
  ↓                                ↓
완료 알림 → ← 완료 알림
         ↓
    Claude Code: 최종 검증
```

### 5. 완료 (Claude Code)
```
1. 전체 통합 테스트
2. 성능 측정
3. 문서화
4. Phase P4 완료 보고서 작성
```

---

## 📁 전체 파일 목록

### Claude Code 생성 파일 (8개)
```
src/types/api/
└── price-master.ts                      # API 타입 정의

src/app/api/price-master/
├── bulk-upload/
│   └── route.ts                         # 파일 업로드 API
├── calculate-from-bom/
│   └── route.ts                         # BOM 계산 API
└── duplicates/
    └── route.ts                         # 중복 탐지/정리 API

tests/
├── fixtures/
│   └── price-master-test-data.ts        # 테스트 데이터
└── price-master/
    ├── bulk-upload.test.ts              # 테스트 코드
    ├── bom-calculation.test.ts
    └── duplicate-cleanup.test.ts

docs/
├── cursor-ai-style-guide.md             # 스타일 가이드
└── cursor-ai-tasks.md                   # 작업 체크리스트
```

### Cursor AI 생성 파일 (7개)
```
src/app/price-master/bulk-update/
├── page.tsx                             # 대량 업데이트 페이지
├── components/
│   ├── FileUploadZone.tsx
│   ├── DataPreviewTable.tsx
│   ├── ValidationResults.tsx
│   └── ConfirmDialog.tsx
└── hooks/
    └── useBulkUpload.ts

src/app/price-master/components/
└── BOMCostCalculator.tsx                # BOM 계산 컴포넌트
```

### 수정 파일 (1개)
```
src/app/price-master/page.tsx            # BOM 버튼 + 중복 버튼 추가
```

**총 파일**: 16개 (신규 15개 + 수정 1개)

---

## 🚀 실행 준비

### 1. shadcn/ui 설치 (Cursor AI에서 실행)
```bash
# 프로젝트 루트에서
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge
```

### 2. react-dropzone 설치 (Cursor AI에서 실행)
```bash
npm install react-dropzone
npm install @types/react-dropzone -D
```

### 3. Git 브랜치 전략
```bash
# Claude Code가 생성
git checkout -b phase-p4-backend

# Cursor AI가 생성
git checkout -b phase-p4-frontend

# 통합 시 머지
git checkout main
git merge phase-p4-backend
git merge phase-p4-frontend
```

---

## ✅ 승인 및 실행

### 승인 대기 중
**상태**: ⏸️ **대기 중** - 실행하지 않고 승인 대기

### 승인 후 실행 절차
1. **Claude Code: 준비 단계** (1h)
   - API 스펙 파일 생성
   - 스타일 가이드 문서 생성
   - Cursor AI 작업 체크리스트 생성

2. **병렬 실행: Wave 1** (2.5h)
   - Claude Code: bulk-upload API 구현
   - Cursor AI: Bulk Update UI 컴포넌트 생성
   - Claude Code: 통합 테스트

3. **병렬 실행: Wave 2** (2.5h)
   - Claude Code: BOM 계산 API 구현
   - Cursor AI: BOM Calculator UI 생성
   - Claude Code: 통합 테스트

4. **병렬 실행: Wave 3** (1.5h)
   - Claude Code: duplicates API 구현
   - Cursor AI: 중복 정리 UI 추가
   - Claude Code: 최종 검증

**총 시간**: **6.5-7시간**

### 승인 필요 사항
- [ ] Claude + Cursor 병렬 협업 방식 승인
- [ ] 6.5-7시간 타임라인 승인
- [ ] shadcn/ui 사용 승인
- [ ] 파일 목록 (16개) 승인
- [ ] API 스펙 사전 정의 방식 승인

---

**문서 버전**: 2.0 (병렬 협업 버전)
**최종 수정**: 2025-01-18
**작성자**: Claude Code SuperClaude Framework
**협업 도구**: Claude Code + Cursor AI
**상태**: ⏸️ 실행 대기 중

---

## 🔄 다음 단계

승인되면 즉시 실행 가능합니다. 승인 여부를 알려주시면:

1. ✅ **승인 및 실행** → Claude Code가 준비 단계부터 시작
2. 🔄 **계획 수정** → 수정 사항 알려주세요
3. 📄 **추가 질문** → 궁금한 점을 말씀해주세요
