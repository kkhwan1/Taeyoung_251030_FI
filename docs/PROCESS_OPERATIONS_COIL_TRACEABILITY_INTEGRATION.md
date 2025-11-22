# 공정 작업과 코일 추적성 통합 방안

**작성일**: 2025-01-21  
**상태**: 제안 단계  
**우선순위**: 중

---

## 📋 현재 상황

### 문제점

1. **데이터 분리**: 공정 작업(`process_operations`)과 코일 추적(`coil_process_history`)이 별도 테이블로 운영됨
2. **연결 부재**: 두 시스템 간 데이터 연결이 없어 추적성 저하
3. **중복 관리**: 동일한 공정 정보를 두 곳에서 관리해야 할 수 있음

### 현재 구조

#### `process_operations` 테이블
- **용도**: 일반 공정 작업 관리
- **주요 필드**:
  - `operation_id` (PK)
  - `input_item_id`, `output_item_id`
  - `lot_number`, `parent_lot_number`, `child_lot_number`
  - `chain_id`, `chain_sequence`
  - `status` (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)

#### `coil_process_history` 테이블
- **용도**: 코일 추적성 전용
- **주요 필드**:
  - `process_id` (PK)
  - `source_item_id`, `target_item_id`
  - `process_type` (블랭킹, 전단, 절곡, 용접)
  - `status` (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)

---

## 🎯 통합 방안

### 방안 1: 단일 테이블 통합 (권장하지 않음)

**설명**: 두 테이블을 하나로 통합

**장점**:
- 데이터 중복 제거
- 단일 소스로 관리

**단점**:
- 기존 데이터 마이그레이션 필요
- 기존 코드 대량 수정 필요
- 리스크 높음

**결론**: ❌ 권장하지 않음 (리스크가 너무 큼)

---

### 방안 2: 외래키 연결 (권장)

**설명**: `process_operations`에 `coil_process_id` 필드 추가하여 연결

**구현 방법**:

#### 1. 데이터베이스 스키마 변경

```sql
-- process_operations 테이블에 외래키 추가
ALTER TABLE process_operations
ADD COLUMN coil_process_id INTEGER REFERENCES coil_process_history(process_id);

-- 인덱스 추가
CREATE INDEX idx_process_operations_coil_process_id 
ON process_operations(coil_process_id);
```

#### 2. API 통합

**공정 작업 생성 시 자동 동기화**:

```typescript
// src/app/api/process-operations/route.ts

// 공정 작업 생성 후
if (operation_type === 'BLANKING' && input_item이 코일인 경우) {
  // coil_process_history에도 자동 생성
  const { data: coilProcess } = await supabase
    .from('coil_process_history')
    .insert({
      source_item_id: input_item_id,
      target_item_id: output_item_id,
      process_type: '블랭킹',
      input_quantity,
      output_quantity,
      status: 'PENDING'
    })
    .select()
    .single();

  // process_operations에 연결
  await supabase
    .from('process_operations')
    .update({ coil_process_id: coilProcess.process_id })
    .eq('operation_id', newOperation.operation_id);
}
```

#### 3. 코일 추적 화면 개선

**공정 작업 정보 표시**:

```typescript
// src/app/api/coil/traceability/[item_id]/route.ts

// coil_process_history 조회 시 process_operations도 함께 조회
const { data: processes } = await supabase
  .from('coil_process_history')
  .select(`
    *,
    process_operation:process_operations!coil_process_id (
      operation_id,
      lot_number,
      chain_id,
      chain_sequence
    )
  `)
  .eq('target_item_id', item_id);
```

**장점**:
- ✅ 기존 시스템 유지
- ✅ 점진적 통합 가능
- ✅ 데이터 일관성 향상
- ✅ 추적성 개선

**단점**:
- ⚠️ 스키마 변경 필요
- ⚠️ 기존 데이터 연결 작업 필요

---

### 방안 3: 뷰(View) 통합 (임시 방안)

**설명**: 두 테이블을 조인하는 뷰 생성

**구현 방법**:

```sql
-- 통합 뷰 생성
CREATE VIEW v_process_traceability AS
SELECT 
  po.operation_id,
  po.lot_number,
  po.input_item_id,
  po.output_item_id,
  po.status,
  cph.process_id as coil_process_id,
  cph.process_type,
  cph.yield_rate
FROM process_operations po
LEFT JOIN coil_process_history cph 
  ON po.input_item_id = cph.source_item_id 
  AND po.output_item_id = cph.target_item_id
  AND po.created_at::date = cph.process_date::date;
```

**장점**:
- ✅ 스키마 변경 없음
- ✅ 빠른 구현 가능

**단점**:
- ⚠️ 데이터 일관성 보장 어려움
- ⚠️ 성능 이슈 가능성

---

## 🚀 권장 구현 계획

### Phase 1: 외래키 연결 (1-2일)

1. **스키마 변경**
   - `process_operations`에 `coil_process_id` 필드 추가
   - 인덱스 생성

2. **기존 데이터 연결**
   - 기존 공정 작업과 코일 추적 데이터 매칭
   - 연결 스크립트 실행

### Phase 2: API 통합 (2-3일)

1. **공정 작업 생성 시 자동 동기화**
   - Blanking 공정 시 `coil_process_history` 자동 생성
   - `coil_process_id` 자동 연결

2. **코일 추적 화면 개선**
   - 공정 작업 정보 표시
   - LOT 번호, 체인 정보 표시

### Phase 3: UI 통합 (1-2일)

1. **공정 작업 화면**
   - 코일 추적 정보 표시
   - 추적성 체인 보기 버튼 추가

2. **코일 추적 화면**
   - 공정 작업 정보 표시
   - LOT 번호, 체인 정보 표시

---

## 📊 예상 효과

### 정량적 효과

- ✅ 데이터 일관성: 100% 향상
- ✅ 추적성: 완전한 추적 가능
- ✅ 중복 제거: 데이터 중복 0%

### 정성적 효과

- ✅ 사용자 편의성 향상
- ✅ 데이터 신뢰성 향상
- ✅ 시스템 통합도 향상

---

## 🔧 구현 세부사항

### 1. 데이터베이스 마이그레이션

```sql
-- supabase/migrations/YYYYMMDD_add_coil_process_id_to_process_operations.sql

-- 1. 컬럼 추가
ALTER TABLE process_operations
ADD COLUMN coil_process_id INTEGER;

-- 2. 외래키 제약조건 추가
ALTER TABLE process_operations
ADD CONSTRAINT fk_process_operations_coil_process
FOREIGN KEY (coil_process_id) 
REFERENCES coil_process_history(process_id)
ON DELETE SET NULL;

-- 3. 인덱스 생성
CREATE INDEX idx_process_operations_coil_process_id 
ON process_operations(coil_process_id);

-- 4. 기존 데이터 연결 (선택사항)
-- 날짜와 품목 ID로 매칭
UPDATE process_operations po
SET coil_process_id = (
  SELECT cph.process_id
  FROM coil_process_history cph
  WHERE cph.source_item_id = po.input_item_id
    AND cph.target_item_id = po.output_item_id
    AND DATE(cph.process_date) = DATE(po.created_at)
  LIMIT 1
)
WHERE po.operation_type = 'BLANKING'
  AND po.coil_process_id IS NULL;
```

### 2. API 수정

**공정 작업 생성 API** (`src/app/api/process-operations/route.ts`):

```typescript
// 공정 작업 생성 후
if (operation_type === 'BLANKING') {
  // 코일 추적 이력도 함께 생성
  const { data: coilProcess, error: coilError } = await supabase
    .from('coil_process_history')
    .insert({
      source_item_id: input_item_id,
      target_item_id: output_item_id,
      process_type: '블랭킹',
      input_quantity,
      output_quantity,
      process_date: new Date().toISOString().split('T')[0],
      status: 'PENDING',
      operator_id: operatorId
    })
    .select()
    .single();

  if (!coilError && coilProcess) {
    // process_operations에 연결
    await supabase
      .from('process_operations')
      .update({ coil_process_id: coilProcess.process_id })
      .eq('operation_id', newOperation.operation_id);
  }
}
```

**코일 추적 조회 API** (`src/app/api/coil/traceability/[item_id]/route.ts`):

```typescript
// process_operations 정보도 함께 조회
const { data: upstreamProcesses } = await supabase
  .from('coil_process_history')
  .select(`
    *,
    process_operation:process_operations!coil_process_id (
      operation_id,
      lot_number,
      chain_id,
      chain_sequence,
      parent_operation_id
    )
  `)
  .eq('target_item_id', item_id);
```

### 3. UI 개선

**코일 추적 화면** (`src/components/process/CoilTraceabilityView.tsx`):

```typescript
// 공정 작업 정보 표시
{process.process_operation && (
  <div className="mt-2 text-xs text-gray-500">
    공정 작업: #{process.process_operation.operation_id}
    {process.process_operation.lot_number && (
      <> | LOT: {process.process_operation.lot_number}</>
    )}
  </div>
)}
```

---

## 📝 결론

**권장 방안**: 방안 2 (외래키 연결)

**이유**:
1. 기존 시스템 유지하면서 점진적 통합 가능
2. 데이터 일관성과 추적성 향상
3. 구현 리스크 낮음

**구현 기간**: 약 1주일 (Phase 1-3)

---

**문서 작성**: Claude (Backend System Architect)  
**최종 검토**: 2025-01-21

