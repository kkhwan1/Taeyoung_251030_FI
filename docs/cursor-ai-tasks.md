# Cursor AI 태스크 체크리스트 - Phase P4

> 이 문서는 Cursor AI가 수행할 UI 개발 작업 목록입니다.
> 각 작업은 **Composer 모드** 또는 **Chat 모드**로 수행합니다.

## 📋 전체 작업 개요

- **총 7개 파일** 생성
- **예상 소요 시간**: 5.5시간 (Claude Code와 병렬 진행)
- **Git 브랜치**: `phase-p4-frontend`

---

## 🎯 Wave 1: Bulk Update UI (2.5시간)

### 필수 사전 작업
1. shadcn/ui 컴포넌트 설치 확인
   ```bash
   npx shadcn-ui@latest add button input table card dialog alert badge progress
   ```
2. `@/types/api/price-master.ts` 파일 존재 확인
3. `docs/cursor-ai-style-guide.md` 읽기

---

### Task 1.1: FileUploadZone 컴포넌트 (30분) - Composer

**파일 위치**: `src/app/price-master/bulk-update/components/FileUploadZone.tsx`

**Composer 프롬프트**:
```
Create FileUploadZone component using react-dropzone and shadcn/ui:

- Accept CSV and Excel (.xlsx) files
- Drag and drop interface with visual feedback
- Show file preview (name, size, upload date)
- File size limit: 5MB
- Display error if wrong file type or too large
- Use existing Tailwind theme from src/app/price-master/page.tsx
- Add proper TypeScript types from @/types/api/price-master
- Include loading state during file processing
- Accessible: aria-labels, keyboard navigation
- Add data-testid attributes for testing

Style requirements:
- Card component with dashed border for drop zone
- Blue-600 accent color for active state
- Gray-300 border for inactive state
- Lucide-react icons (UploadCloud, File, X)
```

**체크리스트**:
- [ ] react-dropzone 설치 (`npm install react-dropzone`)
- [ ] CSV/Excel 파일만 허용
- [ ] 5MB 파일 크기 제한
- [ ] 드래그 앤 드롭 시각적 피드백
- [ ] 파일 미리보기 표시
- [ ] 에러 메시지 표시
- [ ] 접근성 속성 추가
- [ ] 테스트 ID 추가

---

### Task 1.2: DataPreviewTable 컴포넌트 (40분) - Composer

**파일 위치**: `src/app/price-master/bulk-update/components/DataPreviewTable.tsx`

**Composer 프롬프트**:
```
Create DataPreviewTable component for displaying bulk upload data preview:

- Use shadcn/ui Table component
- Display columns: 품목코드, 품목명, 단가, 적용일, 상태
- Show validation status per row (valid/error)
- Color-code status: green for valid, red for error
- Maximum 100 rows with pagination
- Sort by column (품목코드, 적용일)
- Search filter by 품목코드 or 품목명
- Export preview to CSV button
- Use types from @/types/api/price-master (BulkPriceItem)
- Responsive: stack on mobile

Style requirements:
- Follow src/app/price-master/page.tsx table styling
- Stripe rows (even/odd coloring)
- Hover effect on rows
- Badge component for status
```

**체크리스트**:
- [ ] Table 컴포넌트 사용
- [ ] 행별 검증 상태 표시
- [ ] 정렬 기능 (품목코드, 적용일)
- [ ] 검색 필터
- [ ] 페이지네이션 (최대 100행)
- [ ] CSV 내보내기 버튼
- [ ] 반응형 디자인
- [ ] 상태별 색상 표시

---

### Task 1.3: ValidationResultPanel 컴포넌트 (30분) - Composer

**파일 위치**: `src/app/price-master/bulk-update/components/ValidationResultPanel.tsx`

**Composer 프롬프트**:
```
Create ValidationResultPanel component for showing validation results:

- Use shadcn/ui Alert and Card components
- Display summary: total items, valid count, error count
- List validation errors with row number, field, message
- Group errors by type (missing field, invalid format, etc.)
- Show success message if no errors
- Download errors as CSV button
- Use types from @/types/api/price-master (ValidationError)
- Collapsible error details

Style requirements:
- Green alert for success
- Red alert for errors
- Yellow alert for warnings
- Use AlertCircle, CheckCircle icons from lucide-react
```

**체크리스트**:
- [ ] 요약 정보 표시 (총 항목, 유효, 에러)
- [ ] 에러 목록 표시 (행 번호, 필드, 메시지)
- [ ] 에러 타입별 그룹화
- [ ] 성공/에러/경고 Alert 사용
- [ ] 에러 CSV 다운로드 버튼
- [ ] 접기/펼치기 기능

---

### Task 1.4: BulkUpdateButton 컴포넌트 (20분) - Chat

**파일 위치**: `src/app/price-master/bulk-update/components/BulkUpdateButton.tsx`

**Chat 프롬프트**:
```
Create BulkUpdateButton component:
- Primary button that triggers bulk update API call
- Disabled when no valid data or during loading
- Show loading spinner (Loader2 from lucide-react)
- Confirmation dialog before actual update
- Use shadcn/ui Button and Dialog components
- API endpoint: POST /api/price-master/bulk-upload
- Handle success/error responses
```

**체크리스트**:
- [ ] 버튼 비활성화 조건 (유효 데이터 없음, 로딩 중)
- [ ] 로딩 스피너 표시
- [ ] 확인 다이얼로그
- [ ] API 호출 및 응답 처리

---

### Task 1.5: Bulk Update 메인 페이지 (30분) - Composer

**파일 위치**: `src/app/price-master/bulk-update/page.tsx`

**Composer 프롬프트**:
```
Create main page for bulk price update feature:

- Layout: 3-column grid (upload zone, preview, validation results)
- Integrate all 4 components created above
- State management for uploaded file, preview data, validation results
- API integration with /api/price-master/bulk-upload
- Success/error toast notifications
- Breadcrumb navigation (가격 마스터 > 대량 업데이트)
- Page title and description
- Use layout from src/app/price-master/page.tsx

Workflow:
1. User uploads file → FileUploadZone
2. Parse and preview data → DataPreviewTable
3. Validate data → ValidationResultPanel
4. User clicks update → BulkUpdateButton
5. Show success/error toast
```

**체크리스트**:
- [ ] 4개 컴포넌트 통합
- [ ] 상태 관리 (파일, 미리보기, 검증 결과)
- [ ] API 연동
- [ ] Toast 알림
- [ ] Breadcrumb 내비게이션
- [ ] 레이아웃 일관성

---

## 🎯 Wave 2: BOM Calculator UI (2.5시간)

### Task 2.1: BOMCostCalculator 컴포넌트 (2.5시간) - Composer

**파일 위치**: `src/app/price-master/components/BOMCostCalculator.tsx`

**Composer 프롬프트**:
```
Create BOMCostCalculator component for calculating costs from BOM:

- Item selector (autocomplete dropdown with search)
- Date picker for effective date (기준일)
- Checkboxes: include labor cost, include overhead cost
- Calculate button that calls API
- Results display:
  - Total material cost (총 재료비)
  - Total labor cost (총 노무비)
  - Total overhead cost (총 간접비)
  - Final calculated price (계산된 원가)
- BOM tree visualization (recursive, collapsible)
  - Show item code, name, quantity, unit price, subtotal
  - Indent by level (0=product, 1=parts, 2=sub-parts, ...)
  - Highlight items with missing prices in red
- Export calculation to PDF button
- Use types from @/types/api/price-master (BOMCalculationRequest, BOMCalculationResponse, BOMItem)

API endpoint: POST /api/price-master/calculate-from-bom

Style requirements:
- Card layout with sections
- Tree view with indent and lines
- Color-coded by level (blue, green, yellow)
- Missing prices in red with alert icon
```

**체크리스트**:
- [ ] 품목 선택 (자동완성)
- [ ] 날짜 선택기
- [ ] 옵션 체크박스 (노무비, 간접비)
- [ ] 계산 버튼 및 API 호출
- [ ] 결과 표시 (재료비, 노무비, 간접비, 총 원가)
- [ ] BOM 트리 시각화 (재귀적, 접기/펼치기)
- [ ] 레벨별 들여쓰기
- [ ] 가격 없는 항목 강조
- [ ] PDF 내보내기

---

## 🎯 Wave 3: Duplicate Cleanup UI (1.5시간)

### Task 3.1: 중복 감지/정리 UI 추가 (1.5시간) - Chat

**파일 위치**: `src/app/price-master/page.tsx` (기존 파일 수정)

**Chat 프롬프트**:
```
Add duplicate detection and cleanup features to existing price master page:

1. Add "중복 감지" button in header (next to existing buttons)
2. Add modal dialog for duplicate cleanup:
   - Display duplicate groups (same item_code + effective_date)
   - Show all duplicate prices with timestamps
   - Radio buttons for cleanup strategy:
     * 최신 유지 (keep_latest)
     * 최초 유지 (keep_oldest)
     * 수동 선택 (custom)
   - If custom, show checkboxes to select which prices to keep
   - Preview of what will be deleted
   - "시뮬레이션" button (dry_run=true)
   - "실제 삭제" button (dry_run=false)
3. API integration:
   - GET /api/price-master/duplicates (detect)
   - POST /api/price-master/duplicates/cleanup (cleanup)
4. Use types from @/types/api/price-master

DO NOT create new page. Modify existing src/app/price-master/page.tsx only.
```

**체크리스트**:
- [ ] 헤더에 "중복 감지" 버튼 추가
- [ ] 중복 정리 모달 다이얼로그
- [ ] 중복 그룹 표시
- [ ] 정리 전략 선택 (최신, 최초, 수동)
- [ ] 수동 선택 시 체크박스
- [ ] 삭제 미리보기
- [ ] 시뮬레이션 버튼
- [ ] 실제 삭제 버튼
- [ ] API 연동

---

## 📝 최종 체크리스트

### 코드 품질
- [ ] 모든 컴포넌트 TypeScript 타입 정의 완료
- [ ] shadcn/ui 컴포넌트 일관성 있게 사용
- [ ] 기존 price-master 페이지 스타일 준수
- [ ] 한글 UI 텍스트 사용
- [ ] 에러 처리 및 로딩 상태 구현
- [ ] 접근성 속성 추가 (aria-label, role)
- [ ] 테스트 ID 추가 (data-testid)

### 기능 완성도
- [ ] 파일 업로드 기능 동작
- [ ] 데이터 미리보기 표시
- [ ] 검증 결과 표시
- [ ] BOM 계산 및 트리 시각화
- [ ] 중복 감지 및 정리

### Git 작업
- [ ] 브랜치 생성: `git checkout -b phase-p4-frontend`
- [ ] 커밋 메시지: "feat(price-master): Phase P4 UI - [기능명]"
- [ ] Claude Code 작업과 병합 준비

---

## 🚀 실행 순서

1. **준비** (10분)
   - shadcn/ui 컴포넌트 설치
   - 타입 파일 확인
   - 스타일 가이드 읽기
   - Git 브랜치 생성

2. **Wave 1** (2.5시간)
   - Task 1.1 → 1.2 → 1.3 → 1.4 → 1.5 순서로 진행
   - 각 컴포넌트 완료 후 커밋

3. **Wave 2** (2.5시간)
   - Task 2.1 BOMCostCalculator 구현
   - 완료 후 커밋

4. **Wave 3** (1.5시간)
   - Task 3.1 기존 페이지 수정
   - 완료 후 커밋

5. **테스트** (30분)
   - 각 기능 수동 테스트
   - 에러 케이스 확인
   - 반응형 디자인 확인

---

## 💡 팁

### Composer vs Chat 선택
- **Composer**: 새 파일 생성, 복잡한 로직, 여러 요구사항 (Task 1.1, 1.2, 1.3, 1.5, 2.1)
- **Chat**: 간단한 수정, 기존 파일 편집 (Task 1.4, 3.1)

### 에러 발생 시
1. TypeScript 에러 → `@/types/api/price-master` 타입 확인
2. 스타일 불일치 → `docs/cursor-ai-style-guide.md` 참조
3. API 연동 실패 → Claude Code가 API 완성 대기 중인지 확인

### API 엔드포인트 확인
- Claude Code가 다음 API를 먼저 완성합니다:
  - `/api/price-master/bulk-upload`
  - `/api/price-master/calculate-from-bom`
  - `/api/price-master/duplicates`
  - `/api/price-master/duplicates/cleanup`

### 컴포넌트 재사용
- FileUploadZone은 다른 기능에서도 재사용 가능하도록 범용적으로 작성
- BOMCostCalculator는 독립적인 컴포넌트로 다른 페이지에서도 import 가능

---

**작업 시작 전**: `docs/cursor-ai-style-guide.md`를 반드시 읽어주세요!
**질문 사항**: Claude Code에게 API 스펙 또는 구현 방향 문의
