# 프론트엔드 개발 계획
**작성일**: 2025-11-18
**상태**: 백엔드 100% 완료 → 프론트엔드 개발 시작

## 📊 현재 상태

### 완료된 항목 ✅
- **데이터베이스**: 100% (material_types, process_chain_definitions 테이블 + 데이터)
- **API 엔드포인트**: 100% (5개 모두 구현 완료)
  - POST /api/process/complete
  - POST /api/process/start
  - GET /api/stock-history/[itemId]
  - GET /api/process/chain/[chainId]
  - GET /api/process/lot/[lotNumber]
- **트리거/함수**: auto_process_stock_movement, generate_lot_number 작동 중
- **TypeScript 타입**: database.types.ts 생성 완료

### 작업 필요 항목 ⏳
- **프론트엔드 컴포넌트**: 4개 필요

## 🎯 개발 우선순위

### Stream C: 프론트엔드 컴포넌트 (4개)

#### C1: ProcessCompleteButton.tsx (최우선) 🔴
**경로**: `src/components/process/ProcessCompleteButton.tsx`
**목적**: 공정 완료 처리
**API**: POST /api/process/complete
**복잡도**: ⭐⭐ (중)
**예상 시간**: 30분

**주요 기능**:
- 공정 완료 버튼 UI
- 확인 모달 (완료하시겠습니까?)
- API 호출 및 에러 처리
- 성공 시 토스트 메시지
- 재고 자동 차감/추가 안내

**참고 파일**:
- `src/components/ProductionForm.tsx` (기존 패턴)
- `src/components/ui/Toast.tsx` (토스트)

#### C2: ProcessStartButton.tsx (2순위) 🟡
**경로**: `src/components/process/ProcessStartButton.tsx`
**목적**: 공정 시작 처리
**API**: POST /api/process/start
**복잡도**: ⭐⭐ (중)
**예상 시간**: 25분

**주요 기능**:
- 공정 시작 버튼 UI
- 확인 모달
- API 호출 및 에러 처리
- 성공 시 토스트 메시지

**참고 파일**:
- ProcessCompleteButton.tsx (동일 패턴)

#### C3: StockHistoryViewer.tsx (3순위) 🟢
**경로**: `src/components/stock/StockHistoryViewer.tsx`
**목적**: 재고 이력 조회
**API**: GET /api/stock-history/[itemId]
**복잡도**: ⭐⭐⭐ (중상)
**예상 시간**: 40분

**주요 기능**:
- 재고 이력 테이블 (VirtualTable 사용)
- 날짜 범위 필터
- 이동 유형 필터 (입고/출고/생산/조정)
- 수량 변화 시각화 (+ / -)
- Excel 내보내기

**참고 파일**:
- `src/components/ui/VirtualTable.tsx`
- `src/app/inventory/page.tsx`

#### C4: LOTTracker.tsx (4순위) 🟢
**경로**: `src/components/process/LOTTracker.tsx`
**목적**: LOT 추적 타임라인
**API**: GET /api/process/lot/[lotNumber]
**복잡도**: ⭐⭐⭐⭐ (상)
**예상 시간**: 50분

**주요 기능**:
- LOT 번호 검색
- 부모-현재-자식 LOT 계보 표시
- 공정 체인 시각화
- 재고 이동 내역 표시
- 타임라인 UI (세로 레이아웃)

**참고 파일**:
- `src/components/dashboard/` (대시보드 레이아웃 참고)

## 🔧 기술 스택 및 패턴

### 사용 기술
- **React 19** + TypeScript
- **Tailwind CSS** - 스타일링
- **VirtualTable** - 대용량 데이터 렌더링
- **Toast** - 알림 메시지
- **한글 UTF-8** - request.text() + JSON.parse() 패턴

### 공통 패턴

#### API 호출 패턴
```typescript
const handleComplete = async () => {
  try {
    const response = await fetch('/api/process/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation_id: operationId })
    });

    const text = await response.text();
    const data = JSON.parse(text); // UTF-8 한글 보존

    if (data.success) {
      toast.success('공정이 완료되었습니다');
    } else {
      toast.error(data.error);
    }
  } catch (error) {
    toast.error('처리 중 오류가 발생했습니다');
  }
};
```

#### 확인 모달 패턴
```typescript
const [showConfirm, setShowConfirm] = useState(false);

// 버튼 클릭
<button onClick={() => setShowConfirm(true)}>
  공정 완료
</button>

// 모달
{showConfirm && (
  <div className="modal">
    <p>공정을 완료하시겠습니까?</p>
    <button onClick={handleComplete}>확인</button>
    <button onClick={() => setShowConfirm(false)}>취소</button>
  </div>
)}
```

## 📂 파일 구조

```
src/
├── components/
│   ├── process/
│   │   ├── ProcessCompleteButton.tsx  (신규)
│   │   ├── ProcessStartButton.tsx     (신규)
│   │   └── LOTTracker.tsx             (신규)
│   ├── stock/
│   │   └── StockHistoryViewer.tsx     (신규)
│   └── ui/
│       ├── VirtualTable.tsx           (기존)
│       └── Toast.tsx                  (기존)
└── app/
    └── inventory/page.tsx             (컴포넌트 통합)
```

## 🚀 병렬 개발 전략

### 3개 에이전트 동시 작업

**Agent 1 (Frontend Developer)**: C1 + C2
- ProcessCompleteButton.tsx
- ProcessStartButton.tsx
- 예상 시간: 55분

**Agent 2 (Frontend Developer)**: C3
- StockHistoryViewer.tsx
- 예상 시간: 40분

**Agent 3 (Frontend Developer)**: C4
- LOTTracker.tsx
- 예상 시간: 50분

### 의존성 순서
```
C1 (ProcessCompleteButton) ─┐
C2 (ProcessStartButton)     ├─> 페이지 통합
C3 (StockHistoryViewer)     │
C4 (LOTTracker)            ─┘
```

모든 컴포넌트는 독립적이므로 완전 병렬 개발 가능.

## ✅ 완료 기준

각 컴포넌트는 다음 조건을 만족해야 함:

1. **TypeScript 타입 안전성**: database.types.ts 사용
2. **한글 UTF-8 처리**: request.text() + JSON.parse()
3. **에러 처리**: try-catch + Toast 메시지
4. **다크 모드 지원**: Tailwind dark: 클래스 사용
5. **반응형 디자인**: 모바일 호환
6. **접근성**: aria-label, role 속성 추가

## 📝 테스트 시나리오

### C1: ProcessCompleteButton
1. 버튼 클릭 → 확인 모달 표시
2. 확인 → API 호출 → 성공 메시지
3. 재고 자동 차감 확인 (stock_history 조회)

### C2: ProcessStartButton
1. 버튼 클릭 → 확인 모달 표시
2. 확인 → API 호출 → 성공 메시지
3. 상태 변경 확인 (PENDING → IN_PROGRESS)

### C3: StockHistoryViewer
1. 품목 선택 → 재고 이력 로드
2. 날짜 필터 적용 → 결과 필터링
3. Excel 내보내기 → 파일 다운로드

### C4: LOTTracker
1. LOT 번호 입력 → 계보 표시
2. 타임라인 확인 → 공정 흐름 시각화
3. 재고 이동 확인 → 상세 내역 표시

## 🎯 최종 목표

**2025-11-18 오늘 안에 모든 컴포넌트 완성**
- 4개 컴포넌트 개발 완료
- 통합 테스트 완료
- Production Ready 상태 달성

---

**다음 단계**: 3개 에이전트 동시 실행 → 병렬 개발 시작
