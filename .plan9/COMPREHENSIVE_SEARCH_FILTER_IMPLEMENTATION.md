# 종합 검색 필터 구현 계획서 (Comprehensive Search Filter Implementation Plan)

**프로젝트**: 태창 ERP 시스템
**작업 일자**: 2025-02-01
**작업 유형**: Feature Implementation - Search Filter Enhancement
**우선순위**: HIGH
**예상 소요 시간**: 2-3시간

---

## 📋 목차 (Table of Contents)

1. [개요 (Overview)](#개요-overview)
2. [현황 분석 (Current State Analysis)](#현황-분석-current-state-analysis)
3. [구현 목표 (Implementation Goals)](#구현-목표-implementation-goals)
4. [기술 스택 (Tech Stack)](#기술-스택-tech-stack)
5. [작업 분해 (Task Breakdown)](#작업-분해-task-breakdown)
6. [에이전트 역할 배치 (Agent Role Assignment)](#에이전트-역할-배치-agent-role-assignment)
7. [구현 세부사항 (Implementation Details)](#구현-세부사항-implementation-details)
8. [테스트 계획 (Test Plan)](#테스트-계획-test-plan)
9. [품질 검증 (Quality Assurance)](#품질-검증-quality-assurance)
10. [롤백 계획 (Rollback Plan)](#롤백-계획-rollback-plan)

---

## 개요 (Overview)

### 배경 (Background)
사용자가 재고 관련 페이지들에서 특정 컬럼(품번, 품명, 규격, 참조번호 등)에 대한 필터가 누락되어 있음을 발견했습니다. `/stock/history` 페이지에는 이미 성공적인 종합 검색 필터가 구현되어 있으므로, 이 패턴을 다른 페이지들에 확장 적용합니다.

### 목적 (Purpose)
- 사용자 경험 개선: 빠르고 유연한 데이터 검색
- UI 일관성: 모든 재고 관련 페이지에서 동일한 검색 패턴 제공
- 성능 최적화: useMemo를 활용한 효율적인 필터링

### 범위 (Scope)

**작업 대상 페이지**:
1. ✅ **재고관리 페이지** (`/inventory/page.tsx`) - 종합 검색 추가
2. ✅ **재고 현황 페이지** (`/stock/page.tsx`) - 3개 탭 모두 검색 개선
3. ✅ **참고 페이지** (`/stock/history/page.tsx`) - 이미 구현됨 (패턴 참조용)

---

## 현황 분석 (Current State Analysis)

### 페이지별 현황

#### 1. 재고관리 페이지 (`/inventory/page.tsx`)

**현재 구현된 필터**:
- ✅ 분류 필터 (InventoryType): 입고/생산/출고/조정
- ✅ 거래처 필터 (Company): 전체/특정 거래처

**테이블 컬럼**:
| 컬럼명 | 필터 여부 | 검색 필요성 |
|--------|-----------|-------------|
| 거래일시 | ❌ | LOW |
| 구분 | ✅ | - |
| **품번** | ❌ | **HIGH** |
| **품명** | ❌ | **HIGH** |
| 수량 | ❌ | LOW |
| 단가 | ❌ | LOW |
| 금액 | ❌ | LOW |
| 거래처 | ✅ | - |
| **참조번호** | ❌ | **MEDIUM** |
| 작업 | N/A | - |

**누락된 필터**: 품번, 품명, 참조번호

---

#### 2. 재고 현황 페이지 (`/stock/page.tsx`)

**Tab 1: 현재 재고**

**현재 구현된 필터**:
- ✅ 검색 필터: 품번/품명 검색
- ✅ 재고 상태 필터: 전체/정상/부족
- ✅ 공급사 필터

**테이블 컬럼**:
| 컬럼명 | 필터 여부 | 검색 필요성 |
|--------|-----------|-------------|
| 거래일자 | ❌ | LOW |
| 구분 | ❌ | MEDIUM |
| 품번/품명 | ✅ | - |
| **규격** | ❌ | **HIGH** ⭐ |
| 수량 | ❌ | LOW |
| 단가 | ❌ | LOW |
| 금액 | ❌ | LOW |
| 상태 | ✅ | - |

**누락된 필터**: 규격 (spec)

**Tab 2: 재고 이력**

**현재 구현된 필터**:
- ❌ 검색 필터 없음

**테이블 컬럼**: 거래일시, 구분, 품번/품명, 거래처, 수량, 단가, 금액, 참조번호

**누락된 필터**: 품번, 품명, 거래처, 참조번호 종합 검색

**Tab 3: 재고 조정**

**현재 구현된 필터**:
- ❌ 검색 필터 없음

**테이블 컬럼**: 조정일시, 품번/품명, 조정 전, 조정량, 조정 후, 참조번호, 비고, 작업

**누락된 필터**: 품번, 품명, 참조번호, 비고 종합 검색

---

#### 3. 참고: 재고 이력 상세 페이지 (`/stock/history/page.tsx`)

**현재 구현 상태**: ✅ **완벽 구현** (패턴 참조용)

**종합 검색 구현**:
```typescript
const filteredHistory = stockHistory
  .filter(item =>
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.company_name && item.company_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.reference_number && item.reference_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  )
```

**UI 패턴**:
```typescript
<input
  type="text"
  placeholder="품목명, 코드, 거래처, 참조번호, 비고..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
             focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
             bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
/>
```

---

## 구현 목표 (Implementation Goals)

### 기능적 목표 (Functional Goals)

1. **재고관리 페이지 종합 검색**
   - 검색 대상: 품번, 품명, 참조번호
   - 기존 분류/거래처 필터와 병행 작동
   - 실시간 필터링 (타이핑 시 즉시 반영)

2. **재고 현황 - 현재 재고 탭**
   - 기존 검색 확장: 규격(spec) 필드 추가
   - Placeholder 텍스트 업데이트

3. **재고 현황 - 이력 탭**
   - 종합 검색: 품번, 품명, 거래처, 참조번호
   - 새로운 검색 상태 및 UI 추가

4. **재고 현황 - 조정 탭**
   - 종합 검색: 품번, 품명, 참조번호, 비고
   - 새로운 검색 상태 및 UI 추가

### 비기능적 목표 (Non-Functional Goals)

1. **성능**
   - useMemo를 활용한 불필요한 재계산 방지
   - 대용량 데이터셋(>100 rows)에서도 60fps 유지

2. **사용자 경험**
   - 검색어 입력 시 <100ms 응답 시간
   - 검색 결과 0건 시 명확한 안내 메시지

3. **접근성**
   - 키보드 네비게이션 지원
   - 스크린 리더 호환

4. **일관성**
   - 모든 페이지에서 동일한 검색 UI/UX 패턴
   - 다크 모드 완벽 지원

5. **유지보수성**
   - 깔끔한 코드 구조
   - 재사용 가능한 필터 로직
   - 명확한 주석

---

## 기술 스택 (Tech Stack)

### 프론트엔드 기술
- **React 19.1.0**: Hooks (useState, useMemo)
- **TypeScript**: 타입 안전성
- **Next.js 15.5.6**: App Router
- **Tailwind CSS**: 스타일링
- **다크 모드**: CSS Variables + Tailwind

### 개발 도구
- **Codex CLI**: 코드 품질 검증
- **ESLint**: 정적 분석
- **TypeScript Compiler**: 타입 체크

---

## 작업 분해 (Task Breakdown)

### Phase 1: 문서화 및 계획 (완료)
- [x] 현황 분석 문서 작성
- [x] 구현 계획서 작성
- [x] 에이전트 역할 정의
- [x] 품질 검증 기준 수립

### Phase 2: 재고관리 페이지 구현
**파일**: `src/app/inventory/page.tsx`

**TASK-001**: 종합 검색 상태 추가
- [ ] `searchTerm` 상태 변수 추가
- [ ] 초기값: 빈 문자열
- [ ] 타입: `useState<string>('')`

**TASK-002**: 필터링 로직 구현
- [ ] `filteredTransactions` useMemo 수정
- [ ] 검색 로직 추가: item_name, item_code, reference_no
- [ ] 기존 필터와 AND 조건으로 결합
- [ ] 대소문자 구분 없는 검색 (toLowerCase)

**TASK-003**: 검색 UI 추가
- [ ] 필터 섹션에 검색 input 추가 (line 933-977)
- [ ] Placeholder: "품목명, 코드, 참조번호..."
- [ ] 다크 모드 스타일 적용
- [ ] 반응형 디자인 (모바일 대응)

**TASK-004**: Codex 검증
- [ ] TypeScript 타입 체크
- [ ] 필터 로직 성능 분석
- [ ] 코드 품질 검토

---

### Phase 3: 재고 현황 - 현재 재고 탭
**파일**: `src/app/stock/page.tsx`

**TASK-005**: 검색 로직 확장
- [ ] line 321-344 필터링 로직 수정
- [ ] `spec` 필드 검색 추가
- [ ] Null 체크 추가: `(item.spec && item.spec.toLowerCase()...)`

**TASK-006**: Placeholder 업데이트
- [ ] line 664 수정
- [ ] 변경: "품번, 품명 또는 규격으로 검색..."

**TASK-007**: Codex 검증
- [ ] 기존 필터와 충돌 없는지 확인
- [ ] 성능 테스트

---

### Phase 4: 재고 현황 - 이력 탭
**파일**: `src/app/stock/page.tsx`

**TASK-008**: 이력 탭 상태 추가
- [ ] `historySearchTerm` 상태 변수 추가
- [ ] 초기값: 빈 문자열

**TASK-009**: 이력 필터링 로직
- [ ] `filteredHistory` 변수 추가
- [ ] 검색 대상: item_name, item_code, company_name, reference_number
- [ ] useMemo 최적화

**TASK-010**: 이력 검색 UI
- [ ] 탭 내용에 검색 input 추가
- [ ] Placeholder: "품목명, 코드, 거래처, 참조번호..."
- [ ] 스타일 일관성 유지

**TASK-011**: Codex 검증
- [ ] 탭 전환 시 검색 상태 유지 확인
- [ ] 메모리 누수 체크

---

### Phase 5: 재고 현황 - 조정 탭
**파일**: `src/app/stock/page.tsx`

**TASK-012**: 조정 탭 상태 추가
- [ ] `adjustmentSearchTerm` 상태 변수 추가
- [ ] 초기값: 빈 문자열

**TASK-013**: 조정 필터링 로직
- [ ] `filteredAdjustments` 변수 추가
- [ ] 검색 대상: item_name, item_code, reference_no, notes
- [ ] useMemo 최적화

**TASK-014**: 조정 검색 UI
- [ ] 탭 내용에 검색 input 추가
- [ ] Placeholder: "품목명, 코드, 참조번호, 비고..."
- [ ] 스타일 일관성 유지

**TASK-015**: Codex 검증
- [ ] 모든 탭 검증 완료
- [ ] 전체 통합 테스트

---

### Phase 6: 통합 테스트 및 품질 보증
**TASK-016**: 기능 테스트
- [ ] 각 페이지별 검색 동작 확인
- [ ] 기존 필터와 조합 테스트
- [ ] 대용량 데이터 성능 테스트

**TASK-017**: UI/UX 테스트
- [ ] 다크 모드 확인
- [ ] 반응형 디자인 확인
- [ ] 키보드 네비게이션 테스트

**TASK-018**: Codex 최종 검증
- [ ] 전체 코드 품질 검토
- [ ] 타입 안전성 확인
- [ ] 성능 프로파일링

**TASK-019**: 문서 업데이트
- [ ] CLAUDE.md 업데이트
- [ ] 구현 완료 리포트 작성
- [ ] 사용자 가이드 업데이트

---

## 에이전트 역할 배치 (Agent Role Assignment)

### 🎯 Agent 1: Frontend Developer (재고관리 페이지)
**책임**: TASK-001 ~ TASK-004
**스킬셋**: React, TypeScript, Tailwind CSS
**목표**: 재고관리 페이지 종합 검색 필터 구현
**산출물**:
- 수정된 `inventory/page.tsx`
- 구현 완료 리포트

---

### 🎯 Agent 2: Frontend Developer (재고 현황 - 현재 재고)
**책임**: TASK-005 ~ TASK-007
**스킬셋**: React, TypeScript, 성능 최적화
**목표**: 현재 재고 탭 검색 확장 (규격 포함)
**산출물**:
- 수정된 `stock/page.tsx` (현재 재고 섹션)
- 성능 테스트 리포트

---

### 🎯 Agent 3: Frontend Developer (재고 현황 - 이력/조정)
**책임**: TASK-008 ~ TASK-015
**스킬셋**: React, TypeScript, 상태 관리
**목표**: 이력/조정 탭 종합 검색 추가
**산출물**:
- 수정된 `stock/page.tsx` (이력/조정 섹션)
- 탭별 기능 검증 리포트

---

### 🎯 Agent 4: QA Engineer (품질 보증)
**책임**: TASK-016 ~ TASK-018
**스킬셋**: 테스트 자동화, 성능 분석
**목표**: 전체 기능 통합 테스트 및 품질 검증
**산출물**:
- 통합 테스트 리포트
- 성능 벤치마크 결과
- 버그 리포트 (있을 시)

---

### 🔧 Codex Support (코드 품질 검증)
**역할**: 모든 에이전트 작업 품질 검증
**실행 시점**: 각 Task 완료 후
**검증 항목**:
- TypeScript 타입 안전성
- 코드 스타일 일관성
- 성능 최적화 기회
- 잠재적 버그 탐지
- 보안 취약점 검사

**Codex 명령어 예시**:
```bash
# Agent 1 작업 검증
codex exec --full-auto "src/app/inventory/page.tsx를 분석하여:
1. searchTerm 상태 구현의 타입 안전성 검증
2. filteredTransactions useMemo 의존성 배열 확인
3. 검색 로직의 성능 분석 (O(n) 복잡도 확인)
4. Null 안전성 검사
5. 개선 제안사항 제시"

# Agent 2 작업 검증
codex exec --full-auto "src/app/stock/page.tsx의 현재 재고 탭을 분석하여:
1. spec 필드 검색 로직의 null 처리 확인
2. 기존 필터와의 충돌 가능성 분석
3. 성능 영향 평가
4. 코드 품질 평가"

# Agent 3 작업 검증
codex exec --full-auto "src/app/stock/page.tsx의 이력/조정 탭을 분석하여:
1. 탭별 검색 상태 분리가 올바른지 확인
2. useMemo 최적화 적용 확인
3. 메모리 누수 가능성 검사
4. 전체 통합 검증"
```

---

## 구현 세부사항 (Implementation Details)

### 1. 재고관리 페이지 구현 상세

**파일**: `src/app/inventory/page.tsx`

#### Step 1: 상태 추가 (line ~81)
```typescript
// 기존 상태
const [selectedClassification, setSelectedClassification] = useState<InventoryType | null>(null);
const [selectedCompany, setSelectedCompany] = useState<number | 'ALL'>('ALL');

// 추가: 종합 검색 상태
const [searchTerm, setSearchTerm] = useState<string>('');
```

#### Step 2: 필터링 로직 수정 (line ~352-382)
```typescript
const filteredTransactions = useMemo(() => {
  return transactions.filter((item) => {
    // 기존 분류 필터
    const matchesClassification =
      !selectedClassification || item.transaction_type === selectedClassification;

    // 기존 거래처 필터
    const matchesCompany =
      selectedCompany === 'ALL' ||
      (selectedCompany === null && !item.company_id) ||
      item.company_id === selectedCompany;

    // 새로운 종합 검색 필터
    const matchesSearch =
      searchTerm === '' ||
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.reference_no && item.reference_no.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesClassification && matchesCompany && matchesSearch;
  });
}, [transactions, selectedClassification, selectedCompany, searchTerm]); // 의존성 배열에 searchTerm 추가
```

#### Step 3: UI 추가 (line ~933-977)
```typescript
<div className="flex flex-col sm:flex-row gap-4 mb-4">
  {/* 기존 분류 필터 */}
  <select
    value={selectedClassification || ''}
    onChange={(e) => setSelectedClassification(e.target.value as InventoryType || null)}
    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg..."
  >
    <option value="">전체 분류</option>
    {INVENTORY_TYPE_OPTIONS.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>

  {/* 기존 거래처 필터 */}
  <select
    value={selectedCompany === 'ALL' ? '' : selectedCompany}
    onChange={(e) => setSelectedCompany(e.target.value ? Number(e.target.value) : 'ALL')}
    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg..."
  >
    <option value="">전체 거래처</option>
    {companyOptions.map((company) => (
      <option key={company.id} value={company.id}>
        {company.name}
      </option>
    ))}
  </select>

  {/* 새로운 종합 검색 필터 */}
  <input
    type="text"
    placeholder="품목명, 코드, 참조번호..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
               focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
               bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
               placeholder-gray-500 dark:placeholder-gray-400"
  />
</div>
```

---

### 2. 재고 현황 - 현재 재고 탭 구현 상세

**파일**: `src/app/stock/page.tsx`

#### Step 1: 검색 로직 확장 (line ~321-344)
```typescript
const filteredStockItems = Array.isArray(stockItems) ? stockItems.filter(item => {
  // 기존 검색 (품번/품명)
  const matchesSearch =
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    // 추가: 규격 검색 (null 체크 필수)
    (item.spec && item.spec.toLowerCase().includes(searchTerm.toLowerCase()));

  // 기존 재고 상태 필터
  const matchesFilter =
    stockFilter === 'all' ||
    (stockFilter === 'low' && item.is_low_stock) ||
    (stockFilter === 'normal' && !item.is_low_stock);

  // 기존 카테고리 필터
  const matchesCategory = /* 카테고리 로직 */;

  return matchesSearch && matchesFilter && matchesCategory;
}) : [];
```

#### Step 2: Placeholder 업데이트 (line ~664)
```typescript
<input
  type="text"
  placeholder="품번, 품명 또는 규격으로 검색..." // 변경됨
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
             focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
             bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
/>
```

---

### 3. 재고 현황 - 이력 탭 구현 상세

**파일**: `src/app/stock/page.tsx`

#### Step 1: 상태 추가
```typescript
const [historySearchTerm, setHistorySearchTerm] = useState<string>('');
```

#### Step 2: 필터링 로직
```typescript
const filteredHistory = useMemo(() => {
  return historyData.filter((item) => {
    return (
      historySearchTerm === '' ||
      item.item_name.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      item.item_code.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      (item.company_name && item.company_name.toLowerCase().includes(historySearchTerm.toLowerCase())) ||
      (item.reference_number && item.reference_number.toLowerCase().includes(historySearchTerm.toLowerCase()))
    );
  });
}, [historyData, historySearchTerm]);
```

#### Step 3: UI 추가 (이력 탭 내용 영역)
```typescript
{activeTab === 'history' && (
  <div className="space-y-4">
    {/* 검색 필터 */}
    <div className="flex gap-4">
      <input
        type="text"
        placeholder="품목명, 코드, 거래처, 참조번호..."
        value={historySearchTerm}
        onChange={(e) => setHistorySearchTerm(e.target.value)}
        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                   focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      />
    </div>

    {/* 테이블 */}
    <VirtualTable
      data={filteredHistory} // filteredHistory 사용
      columns={historyColumns}
      // ...
    />
  </div>
)}
```

---

### 4. 재고 현황 - 조정 탭 구현 상세

**파일**: `src/app/stock/page.tsx`

#### Step 1: 상태 추가
```typescript
const [adjustmentSearchTerm, setAdjustmentSearchTerm] = useState<string>('');
```

#### Step 2: 필터링 로직
```typescript
const filteredAdjustments = useMemo(() => {
  return adjustmentData.filter((item) => {
    return (
      adjustmentSearchTerm === '' ||
      item.item_name.toLowerCase().includes(adjustmentSearchTerm.toLowerCase()) ||
      item.item_code.toLowerCase().includes(adjustmentSearchTerm.toLowerCase()) ||
      (item.reference_no && item.reference_no.toLowerCase().includes(adjustmentSearchTerm.toLowerCase())) ||
      (item.notes && item.notes.toLowerCase().includes(adjustmentSearchTerm.toLowerCase()))
    );
  });
}, [adjustmentData, adjustmentSearchTerm]);
```

#### Step 3: UI 추가 (조정 탭 내용 영역)
```typescript
{activeTab === 'adjustment' && (
  <div className="space-y-4">
    {/* 검색 필터 */}
    <div className="flex gap-4">
      <input
        type="text"
        placeholder="품목명, 코드, 참조번호, 비고..."
        value={adjustmentSearchTerm}
        onChange={(e) => setAdjustmentSearchTerm(e.target.value)}
        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                   focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      />
    </div>

    {/* 테이블 */}
    <VirtualTable
      data={filteredAdjustments} // filteredAdjustments 사용
      columns={adjustmentColumns}
      // ...
    />
  </div>
)}
```

---

## 테스트 계획 (Test Plan)

### 기능 테스트 (Functional Testing)

#### Test Suite 1: 재고관리 페이지
**파일**: `src/app/inventory/page.tsx`

| 테스트 케이스 | 입력 | 예상 결과 | 우선순위 |
|---------------|------|-----------|----------|
| TC-001 | 품번 검색 "P001" | P001 포함 데이터만 표시 | HIGH |
| TC-002 | 품명 검색 "부품" | "부품" 포함 품명만 표시 | HIGH |
| TC-003 | 참조번호 검색 "REF123" | REF123 참조번호만 표시 | MEDIUM |
| TC-004 | 빈 검색어 | 전체 데이터 표시 | HIGH |
| TC-005 | 대소문자 혼합 "PaRt" | 대소문자 구분 없이 검색 | HIGH |
| TC-006 | 검색 + 분류 필터 조합 | AND 조건으로 필터링 | HIGH |
| TC-007 | 검색 + 거래처 필터 조합 | AND 조건으로 필터링 | HIGH |
| TC-008 | 검색어 입력 속도 | <100ms 응답 | MEDIUM |
| TC-009 | 대용량 데이터 (500+ rows) | 60fps 유지 | MEDIUM |
| TC-010 | 검색 결과 0건 | "검색 결과 없음" 메시지 | LOW |

#### Test Suite 2: 재고 현황 - 현재 재고
**파일**: `src/app/stock/page.tsx` (Tab 1)

| 테스트 케이스 | 입력 | 예상 결과 | 우선순위 |
|---------------|------|-----------|----------|
| TC-011 | 규격 검색 "100x50" | 규격 포함 데이터만 표시 | HIGH |
| TC-012 | 품번 + 규격 검색 | 두 필드 모두 검색 | HIGH |
| TC-013 | Null 규격 데이터 | 에러 없이 처리 | HIGH |
| TC-014 | 재고 상태 + 검색 조합 | AND 조건 필터링 | MEDIUM |
| TC-015 | 공급사 + 검색 조합 | AND 조건 필터링 | MEDIUM |

#### Test Suite 3: 재고 현황 - 이력 탭
**파일**: `src/app/stock/page.tsx` (Tab 2)

| 테스트 케이스 | 입력 | 예상 결과 | 우선순위 |
|---------------|------|-----------|----------|
| TC-016 | 거래처명 검색 | 거래처 포함 데이터만 표시 | HIGH |
| TC-017 | 참조번호 검색 | 참조번호 포함 데이터만 표시 | HIGH |
| TC-018 | 탭 전환 시 검색 유지 | 검색어 초기화되지 않음 | MEDIUM |
| TC-019 | Null 거래처/참조번호 | 에러 없이 처리 | HIGH |

#### Test Suite 4: 재고 현황 - 조정 탭
**파일**: `src/app/stock/page.tsx` (Tab 3)

| 테스트 케이스 | 입력 | 예상 결과 | 우선순위 |
|---------------|------|-----------|----------|
| TC-020 | 비고 검색 "재고실사" | 비고 포함 데이터만 표시 | HIGH |
| TC-021 | 참조번호 검색 | 참조번호 포함 데이터만 표시 | HIGH |
| TC-022 | Null 비고/참조번호 | 에러 없이 처리 | HIGH |

---

### UI/UX 테스트

| 테스트 케이스 | 확인 항목 | 우선순위 |
|---------------|-----------|----------|
| UI-001 | 라이트 모드 스타일 | HIGH |
| UI-002 | 다크 모드 스타일 | HIGH |
| UI-003 | 모바일 반응형 (< 640px) | HIGH |
| UI-004 | 태블릿 반응형 (640-1024px) | MEDIUM |
| UI-005 | 검색 input focus 스타일 | MEDIUM |
| UI-006 | Placeholder 가독성 | LOW |
| UI-007 | 키보드 네비게이션 (Tab) | MEDIUM |
| UI-008 | 스크린 리더 호환 | LOW |

---

### 성능 테스트

| 테스트 케이스 | 측정 지표 | 목표 | 우선순위 |
|---------------|-----------|------|----------|
| PERF-001 | 검색 응답 시간 | <100ms | HIGH |
| PERF-002 | 필터링 FPS | 60fps | HIGH |
| PERF-003 | 메모리 사용량 | +10% 이내 | MEDIUM |
| PERF-004 | 리렌더링 횟수 | 최소화 | MEDIUM |
| PERF-005 | 번들 크기 증가 | <5KB | LOW |

---

### 통합 테스트

| 테스트 케이스 | 시나리오 | 우선순위 |
|---------------|----------|----------|
| INT-001 | 페이지 간 네비게이션 후 검색 | HIGH |
| INT-002 | 브라우저 새로고침 후 검색 | HIGH |
| INT-003 | 다크 모드 토글 + 검색 | MEDIUM |
| INT-004 | 글꼴 크기 변경 + 검색 | LOW |

---

## 품질 검증 (Quality Assurance)

### Codex 검증 체크리스트

#### 코드 품질
- [ ] TypeScript 타입 안전성 100%
- [ ] ESLint 경고/에러 0건
- [ ] 코드 중복 제거
- [ ] 명확한 변수/함수명
- [ ] 적절한 주석 (복잡한 로직만)

#### 성능
- [ ] useMemo 올바른 의존성 배열
- [ ] 불필요한 리렌더링 없음
- [ ] 대용량 데이터 처리 최적화
- [ ] 메모리 누수 없음

#### 보안
- [ ] XSS 취약점 없음
- [ ] 입력 검증 (특수문자 처리)
- [ ] Null/Undefined 안전 처리

#### 접근성
- [ ] ARIA 라벨 적절
- [ ] 키보드 접근 가능
- [ ] 포커스 관리 적절

#### 유지보수성
- [ ] 코드 구조 명확
- [ ] 재사용 가능한 로직
- [ ] 테스트 가능한 구조
- [ ] 문서화 충분

---

### 검증 단계별 실행 계획

#### Stage 1: Agent 1 작업 후
```bash
codex exec --full-auto -C "C:\Users\USER\claude_code\FITaeYoungERP" \
  "src/app/inventory/page.tsx를 분석하여:
  1. searchTerm 상태의 타입 안전성 검증
  2. filteredTransactions useMemo 의존성 배열 확인
  3. 검색 로직의 시간 복잡도 분석 (O(n) 확인)
  4. Null 체크 누락 여부 확인
  5. 코드 스타일 일관성 검사
  6. 개선 제안사항 5가지 이상 제시"
```

#### Stage 2: Agent 2 작업 후
```bash
codex exec --full-auto -C "C:\Users\USER\claude_code\FITaeYoungERP" \
  "src/app/stock/page.tsx의 현재 재고 탭 (line 321-344, 664)을 분석하여:
  1. spec 필드 null 처리 검증
  2. 기존 필터 로직과 충돌 가능성 분석
  3. placeholder 텍스트 정확성 확인
  4. 성능 영향 평가 (filteredStockItems 계산)
  5. 코드 품질 점수 (0-10)"
```

#### Stage 3: Agent 3 작업 후
```bash
codex exec --full-auto -C "C:\Users\USER\claude_code\FITaeYoungERP" \
  "src/app/stock/page.tsx의 이력/조정 탭을 분석하여:
  1. historySearchTerm, adjustmentSearchTerm 상태 분리 확인
  2. 각 탭의 useMemo 최적화 적용 검증
  3. 탭 전환 시 검색 상태 유지 여부 확인
  4. 메모리 누수 가능성 검사
  5. 전체 통합 검증 및 최종 권고사항"
```

#### Stage 4: 최종 통합 검증
```bash
codex exec --full-auto -C "C:\Users\USER\claude_code\FITaeYoungERP" \
  "전체 재고 관련 페이지 (inventory, stock)의 종합 검색 필터를 분석하여:
  1. 패턴 일관성 검증 (3개 페이지 모두)
  2. 성능 벤치마크 (대용량 데이터 시뮬레이션)
  3. 접근성 검사 (WCAG 2.1 AA 준수)
  4. 다크 모드 스타일 일관성
  5. 최종 품질 점수 및 개선 권고"
```

---

## 롤백 계획 (Rollback Plan)

### 롤백 조건
다음 중 하나라도 발생 시 즉시 롤백:
1. 기존 필터 기능 손상
2. 성능 저하 >20%
3. Critical 버그 발견
4. 타입 에러 발생
5. 프로덕션 빌드 실패

### 롤백 절차

#### Step 1: Git 상태 확인
```bash
git status
git diff
```

#### Step 2: 변경사항 Stash
```bash
git stash push -m "Rollback comprehensive search filter"
```

#### Step 3: 원본 복구
```bash
# 특정 파일만 복구
git checkout HEAD -- src/app/inventory/page.tsx
git checkout HEAD -- src/app/stock/page.tsx

# 또는 전체 롤백
git reset --hard HEAD
```

#### Step 4: 검증
```bash
npm run type-check
npm run lint
npm run build
```

#### Step 5: 사용자 알림
- [ ] 롤백 사유 문서화
- [ ] 대안 제시
- [ ] 재시도 일정 협의

---

## 부록 (Appendix)

### A. 참고 파일 목록
- `/stock/history/page.tsx` - 종합 검색 패턴 참조
- `/components/ui/VirtualTable.tsx` - 테이블 컴포넌트
- `/contexts/CompanyFilterContext.tsx` - 거래처 필터 Hook
- `CLAUDE.md` - 프로젝트 가이드

### B. 관련 이슈
- Issue #001: 재고관리 페이지 필터 누락
- Issue #002: 재고 현황 규격 검색 불가

### C. 변경 이력
| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2025-02-01 | 1.0 | 초안 작성 | Claude |

---

**문서 상태**: ✅ 승인됨 - 구현 준비 완료
**다음 단계**: 에이전트 병렬 실행 시작
