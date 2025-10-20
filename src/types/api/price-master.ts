/**
 * Phase P4: Price Master API Type Definitions
 *
 * 이 파일은 Claude Code와 Cursor AI 간 협업을 위한 API 스펙 정의입니다.
 * Cursor AI는 이 타입들을 참조하여 UI 컴포넌트를 구현합니다.
 */

// ============================================================================
// 1. Bulk Upload (대량 가격 업데이트)
// ============================================================================

/**
 * CSV/Excel 파일에서 파싱된 개별 가격 항목
 */
export interface BulkPriceItem {
  item_code: string;           // 품목 코드 (필수)
  item_name?: string;          // 품목명 (선택, 검증용)
  unit_price: number;          // 단가 (필수)
  effective_date: string;      // 적용일 (YYYY-MM-DD, 필수)
  notes?: string;              // 비고 (선택)
}

/**
 * 대량 업로드 요청
 */
export interface BulkUploadRequest {
  items: BulkPriceItem[];
  validate_only?: boolean;     // true면 검증만 수행, false면 실제 업데이트
}

/**
 * 검증 에러 정보
 */
export interface ValidationError {
  row: number;                 // 행 번호 (1부터 시작)
  field: string;               // 에러 발생 필드명
  message: string;             // 에러 메시지
  value?: string;              // 잘못된 값
}

/**
 * 대량 업로드 응답
 */
export interface BulkUploadResponse {
  success: true;
  data: {
    valid_count: number;       // 유효한 항목 수
    error_count: number;       // 에러 항목 수
    errors: ValidationError[]; // 에러 목록
    preview: Array<{           // 미리보기 데이터 (최대 10개)
      item_code: string;
      item_name: string;
      unit_price: number;
      effective_date: string;
      status: 'valid' | 'error';
    }>;
  };
}

// ============================================================================
// 2. BOM Auto-Calculation (BOM 기반 자동 계산)
// ============================================================================

/**
 * BOM 항목 정보 (재귀적 구조)
 */
export interface BOMItem {
  item_id: string;
  item_code: string;
  item_name: string;
  quantity: number;            // 사용 수량
  unit_price?: number;         // 단가 (하위 부품은 계산됨)
  level: number;               // BOM 레벨 (0=완제품, 1=1차 부품, ...)
  children?: BOMItem[];        // 하위 부품들
}

/**
 * BOM 계산 요청
 */
export interface BOMCalculationRequest {
  item_id: string;             // 계산할 품목 ID
  effective_date?: string;     // 기준일 (기본값: 오늘)
  include_labor?: boolean;     // 노무비 포함 여부 (기본값: false)
  include_overhead?: boolean;  // 간접비 포함 여부 (기본값: false)
}

/**
 * BOM 계산 응답
 */
export interface BOMCalculationResponse {
  success: true;
  data: {
    item_id: string;
    item_code: string;
    item_name: string;
    total_material_cost: number;  // 총 재료비
    total_labor_cost: number;     // 총 노무비
    total_overhead_cost: number;  // 총 간접비
    calculated_price: number;     // 계산된 원가
    bom_tree: BOMItem;            // BOM 트리 구조
    calculation_date: string;     // 계산 수행 시각
    missing_prices: Array<{       // 가격 정보 없는 부품들
      item_code: string;
      item_name: string;
      level: number;
    }>;
  };
}

// ============================================================================
// 3. Duplicate Detection & Cleanup (중복 감지 및 정리)
// ============================================================================

/**
 * 중복 항목 정보
 */
export interface DuplicateItem {
  item_id: string;
  item_code: string;
  item_name: string;
  effective_date: string;
  unit_price: number;
  created_at: string;
  duplicate_count: number;     // 중복 개수 (같은 날짜에 여러 가격)
}

/**
 * 중복 그룹
 */
export interface DuplicateGroup {
  item_code: string;
  item_name: string;
  effective_date: string;
  duplicates: DuplicateItem[]; // 중복된 가격 레코드들 (시간순 정렬)
  recommended_action: 'keep_latest' | 'keep_oldest' | 'manual_review';
}

/**
 * 중복 감지 응답
 */
export interface DuplicatesDetectionResponse {
  success: true;
  data: {
    total_duplicates: number;
    duplicate_groups: DuplicateGroup[];
    summary: {
      by_item: number;           // 중복이 있는 품목 수
      by_date: number;           // 중복이 있는 날짜 수
      total_records: number;     // 전체 중복 레코드 수
    };
  };
}

/**
 * 중복 정리 요청
 */
export interface DuplicatesCleanupRequest {
  strategy: 'keep_latest' | 'keep_oldest' | 'custom';
  custom_keep_ids?: string[];  // strategy='custom'일 때 유지할 ID 목록
  dry_run?: boolean;           // true면 시뮬레이션만, false면 실제 삭제
}

/**
 * 중복 정리 응답
 */
export interface DuplicatesCleanupResponse {
  success: true;
  data: {
    deleted_count: number;
    kept_count: number;
    preview: Array<{
      item_code: string;
      effective_date: string;
      deleted_prices: number[];
      kept_price: number;
    }>;
  };
}

// ============================================================================
// 4. Common Types (공통 타입)
// ============================================================================

/**
 * API 에러 응답
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

/**
 * 파일 업로드 메타데이터
 */
export interface FileUploadMetadata {
  filename: string;
  size: number;
  type: string;
  uploaded_at: string;
}

/**
 * 진행 상태
 */
export interface ProgressStatus {
  current: number;
  total: number;
  percentage: number;
  message: string;
}
