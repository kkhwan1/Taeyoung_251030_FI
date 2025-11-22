# 공정 추적성 테이블 뷰 구현 문서

## 개요

공정 추적성 조회 기능에 테이블 형식 뷰를 추가하여 대용량 데이터(하루 수십~수백 건)를 효율적으로 조회할 수 있도록 개선했습니다.

**구현 일자**: 2025-11-22
**구현 방식**: 기존 페이지에 탭 UI 추가 (신규 페이지 생성 없음)

---

## Wave 실행 요약

### Wave 1: 핵심 기능 (병렬 실행)
| Task | 내용 | 상태 | 파일 |
|------|------|------|------|
| TASK 1 | 일괄 조회 API | ✅ 완료 | `/api/coil/traceability/list/route.ts` (292줄) |
| TASK 2 | 테이블 컴포넌트 | ✅ 완료 | `/components/process/ProcessTraceabilityTable.tsx` (732줄) |

### Wave 2: UI 통합 및 내보내기 (병렬 실행)
| Task | 내용 | 상태 | 파일 |
|------|------|------|------|
| TASK 3 | 탭 UI 통합 | ✅ 완료 | `/app/traceability/page.tsx` (124줄) |
| TASK 4 | Excel 내보내기 API | ✅ 완료 | `/api/export/traceability/route.ts` (230줄) |

### Wave 3: 검증 및 문서화 (순차 실행)
| Task | 내용 | 상태 | 결과 |
|------|------|------|------|
| TASK 5 | Codex 품질 검증 | ✅ 완료 | 8개 발견사항 (모두 기존 이슈) |
| TASK 6 | 구현 문서화 | ✅ 완료 | 현재 문서 |

---

## API 엔드포인트

### 1. 일괄 조회 API

**엔드포인트**: `GET /api/coil/traceability/list`

**Query Parameters**:
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `start_date` | string | - | 시작일 (YYYY-MM-DD) |
| `end_date` | string | - | 종료일 (YYYY-MM-DD) |
| `status` | string | `all` | 상태 필터 (all, pending, in_progress, completed) |
| `process_type` | string | - | 공정 유형 (slitting, cutting, coating, assembly, other) |
| `page` | number | `1` | 페이지 번호 |
| `limit` | number | `50` | 페이지당 항목 수 (최대 100) |
| `sort_by` | string | `process_date` | 정렬 기준 |
| `sort_order` | string | `desc` | 정렬 방향 (asc, desc) |

**응답 구조**:
```typescript
{
  success: true,
  data: {
    items: ProcessHistoryItem[],
    summary: {
      total_count: number,
      pending_count: number,
      in_progress_count: number,
      completed_count: number,
      total_input_quantity: number,
      total_output_quantity: number,
      average_yield_rate: number
    },
    pagination: {
      page: number,
      limit: number,
      total_pages: number,
      total_count: number
    }
  },
  message: string
}
```

### 2. Excel 내보내기 API

**엔드포인트**: `GET /api/export/traceability`

**Query Parameters**:
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `start_date` | string | 시작일 |
| `end_date` | string | 종료일 |
| `status` | string | 상태 필터 |
| `process_type` | string | 공정 유형 |

**응답**: Excel 파일 (3-Sheet 표준 패턴)
- Sheet 1: 내보내기 정보 (메타데이터)
- Sheet 2: 통계 (요약 통계)
- Sheet 3: 공정 이력 (상세 데이터, 한글 헤더)

---

## 컴포넌트 인터페이스

### ProcessTraceabilityTable

**위치**: `src/components/process/ProcessTraceabilityTable.tsx`

**Props**:
```typescript
interface ProcessTraceabilityTableProps {
  onItemClick?: (processId: number) => void;  // 항목 클릭 시 콜백
  className?: string;                          // 추가 CSS 클래스
}
```

**주요 기능**:
- 날짜 범위 필터 (프리셋: 전체, 오늘, 1주일, 1개월, 3개월, 1년, 직접 입력)
- 상태 필터 (전체, 대기, 진행중, 완료)
- 공정 유형 필터 (전체, 슬리팅, 재단, 코팅, 조립, 기타)
- 페이지네이션 (페이지당 10/25/50/100건)
- 클라이언트 사이드 정렬 (컬럼 헤더 클릭)
- 통계 요약 카드 (총 공정 수, 상태별 카운트, 투입량, 산출량, 평균 수율)
- Excel 내보내기 버튼
- 수율 색상 표시 (≥95% 초록, 90-95% 노랑, <90% 빨강)

---

## 페이지 구조

### /traceability 페이지

**탭 구성**:
| 탭 ID | 라벨 | 컴포넌트 | 설명 |
|-------|------|----------|------|
| `list` | 전체 목록 | `ProcessTraceabilityTable` | 테이블 형식 일괄 조회 |
| `detail` | 품목별 상세 | `CoilTraceabilityView` | 카드 형식 상세 조회 |

**동작**:
- 기본 탭: `list` (전체 목록)
- 테이블에서 항목 클릭 시 `detail` 탭으로 자동 전환
- Dynamic import로 코드 스플리팅 적용

---

## 데이터베이스 연동

### 조회 테이블
- `coil_process_history`: 공정 이력 메인 테이블
- `items`: 품목 정보 (source_item, target_item JOIN)
- `process_operations`: 공정 작업 정보 (lot_number, chain_id 등)

### JOIN 관계
```sql
coil_process_history
├── items (source_item_id → source_item)
├── items (target_item_id → target_item)
└── process_operations (coil_process_id → process_operation)
```

---

## Codex 품질 검증 결과

**검증 일자**: 2025-11-22
**총 발견사항**: 8개 (모두 기존 이슈, 신규 구현과 무관)

### 발견사항 요약

| 심각도 | 개수 | 내용 |
|--------|------|------|
| CRITICAL | 1 | Stock history 탭 company filter 무시 (기존 이슈) |
| HIGH | 2 | Inventory company filter 클라이언트 전용, useCompanyFilter 중복 |
| MEDIUM | 3 | Company filter 드롭다운 중복, CategoryFilter 중복, alert/toast 혼용 |
| LOW | 2 | Loading indicator 차이, 한글 UTF-8 패턴 중복 |

**결론**: 신규 구현된 공정 추적성 테이블 뷰에서는 품질 이슈가 발견되지 않았습니다.

---

## 사용 예시

### 1. 테이블 뷰 접근
```
http://localhost:5000/traceability
```
기본적으로 "전체 목록" 탭이 활성화되어 테이블 뷰가 표시됩니다.

### 2. API 직접 호출
```bash
# 기본 조회
curl "http://localhost:5000/api/coil/traceability/list"

# 필터링 조회
curl "http://localhost:5000/api/coil/traceability/list?start_date=2025-11-01&end_date=2025-11-22&status=completed&page=1&limit=20"

# Excel 내보내기
curl "http://localhost:5000/api/export/traceability?start_date=2025-11-01" -o traceability.xlsx
```

### 3. 컴포넌트 재사용
```tsx
import ProcessTraceabilityTable from '@/components/process/ProcessTraceabilityTable';

export default function MyPage() {
  const handleItemClick = (processId: number) => {
    console.log('Selected process:', processId);
  };

  return (
    <ProcessTraceabilityTable
      onItemClick={handleItemClick}
      className="my-custom-class"
    />
  );
}
```

---

## 파일 변경 목록

### 신규 생성
- `src/app/api/coil/traceability/list/route.ts` (292줄)
- `src/components/process/ProcessTraceabilityTable.tsx` (732줄)
- `src/app/api/export/traceability/route.ts` (230줄)
- `docs/TRACEABILITY_TABLE_IMPLEMENTATION.md` (현재 문서)

### 수정
- `src/app/traceability/page.tsx` - 탭 UI 추가 (124줄)

---

## 향후 개선 사항

1. **서버 사이드 정렬**: 현재 클라이언트 정렬을 서버 정렬로 전환 (대용량 데이터 대응)
2. **가상 스크롤링**: 1000건 이상 데이터 시 `@tanstack/react-virtual` 적용
3. **실시간 업데이트**: WebSocket 기반 실시간 공정 상태 업데이트
4. **고급 필터**: 복합 조건 필터링 (AND/OR 조합)
5. **차트 시각화**: 기간별 공정 현황 차트 추가

---

## 관련 문서

- [CLAUDE.md](./CLAUDE.md) - 프로젝트 개발 가이드
- [README.md](../README.md) - 프로젝트 소개
