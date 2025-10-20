/**
 * Phase P4: Price Master Test Data
 * 
 * 이 파일은 Phase P4 기능들의 테스트를 위한 샘플 데이터를 제공합니다.
 * - CSV 샘플 데이터 (대량 업로드 테스트용)
 * - BOM 테스트 데이터 (계산 테스트용)
 * - 중복 단가 데이터 (정리 테스트용)
 */

// ============================================================================
// 1. CSV 샘플 데이터 (대량 업로드 테스트)
// ============================================================================

/**
 * 유효한 CSV 데이터 샘플 (100개 품목)
 */
export const validCSVData = `품목코드,품목명,단가,적용일,비고
PART-001,브레이크 패드,15000,2025-01-15,전면용
PART-002,브레이크 디스크,25000,2025-01-15,벤틸레이티드
PART-003,브레이크 캘리퍼,45000,2025-01-15,4피스톤
PART-004,브레이크 호스,8000,2025-01-15,고압용
PART-005,브레이크 마스터 실린더,35000,2025-01-15,ABS용
PART-006,엔진 오일 필터,5000,2025-01-15,합성유용
PART-007,에어 필터,12000,2025-01-15,고성능
PART-008,연료 필터,8000,2025-01-15,고압용
PART-009,스파크 플러그,3000,2025-01-15,이리듐
PART-010,점화 코일,25000,2025-01-15,고성능
PART-011,타이밍 벨트,18000,2025-01-15,정밀
PART-012,워터 펌프,22000,2025-01-15,전자식
PART-013,라디에이터,35000,2025-01-15,알루미늄
PART-014,서모스탯,5000,2025-01-15,전자식
PART-015,냉각수 호스,6000,2025-01-15,실리콘
PART-016,배터리,80000,2025-01-15,리튬이온
PART-017,알터네이터,120000,2025-01-15,고출력
PART-018,스타터 모터,85000,2025-01-15,고토크
PART-019,전구,2000,2025-01-15,LED
PART-020,헤드라이트,45000,2025-01-15,어댑티브
PART-021,테일라이트,15000,2025-01-15,LED
PART-022,방향지시등,8000,2025-01-15,LED
PART-023,안개등,12000,2025-01-15,LED
PART-024,번호판등,5000,2025-01-15,LED
PART-025,실내등,3000,2025-01-15,LED
PART-026,클러치 디스크,55000,2025-01-15,고마찰
PART-027,클러치 플레이트,35000,2025-01-15,스프링
PART-028,클러치 베어링,15000,2025-01-15,고강도
PART-029,클러치 마스터 실린더,25000,2025-01-15,압력용
PART-030,클러치 슬레이브 실린더,18000,2025-01-15,압력용
PART-031,변속기 오일,12000,2025-01-15,합성유
PART-032,변속기 필터,8000,2025-01-15,고성능
PART-033,변속기 마운트,15000,2025-01-15,고강도
PART-034,드라이브 샤프트,45000,2025-01-15,카본
PART-035,CV 조인트,25000,2025-01-15,고강도
PART-036,휠 허브 베어링,35000,2025-01-15,세라믹
PART-037,휠 스터드,8000,2025-01-15,고강도
PART-038,휠 너트,2000,2025-01-15,스테인리스
PART-039,휠 볼트,3000,2025-01-15,고강도
PART-040,휠 스페이서,5000,2025-01-15,알루미늄
PART-041,타이어 밸브,1000,2025-01-15,TPMS
PART-042,타이어 밸브 캡,500,2025-01-15,알루미늄
PART-043,타이어 밸브 스템,800,2025-01-15,고강도
PART-044,타이어 밸브 코어,300,2025-01-15,니켈
PART-045,타이어 밸브 가스켓,200,2025-01-15,고무
PART-046,서스펜션 스트럿,65000,2025-01-15,가변댐핑
PART-047,서스펜션 스프링,25000,2025-01-15,고강도
PART-048,서스펜션 마운트,18000,2025-01-15,고강도
PART-049,서스펜션 부시,8000,2025-01-15,폴리우레탄
PART-050,서스펜션 링크,15000,2025-01-15,고강도
PART-051,스티어링 랙,85000,2025-01-15,전동식
PART-052,스티어링 컬럼,45000,2025-01-15,틸트
PART-053,스티어링 휠,35000,2025-01-15,가죽
PART-054,스티어링 부시,12000,2025-01-15,폴리우레탄
PART-055,스티어링 링크,18000,2025-01-15,고강도
PART-056,파워 스티어링 펌프,55000,2025-01-15,전자식
PART-057,파워 스티어링 호스,15000,2025-01-15,고압용
PART-058,파워 스티어링 오일,8000,2025-01-15,합성유
PART-059,파워 스티어링 필터,5000,2025-01-15,고성능
PART-060,파워 스티어링 쿨러,25000,2025-01-15,알루미늄
PART-061,에어컨 컴프레서,120000,2025-01-15,전자식
PART-062,에어컨 콘덴서,45000,2025-01-15,알루미늄
PART-063,에어컨 에바포레이터,35000,2025-01-15,알루미늄
PART-064,에어컨 드라이어,15000,2025-01-15,고성능
PART-065,에어컨 필터,8000,2025-01-15,HEPA
PART-066,에어컨 호스,12000,2025-01-15,고압용
PART-067,에어컨 벨브,5000,2025-01-15,전자식
PART-068,에어컨 센서,8000,2025-01-15,디지털
PART-069,에어컨 모터,25000,2025-01-15,BLDC
PART-070,에어컨 팬,15000,2025-01-15,고성능
PART-071,히터 코어,25000,2025-01-15,알루미늄
PART-072,히터 밸브,8000,2025-01-15,전자식
PART-073,히터 호스,6000,2025-01-15,고온용
PART-074,히터 필터,5000,2025-01-15,고성능
PART-075,히터 모터,18000,2025-01-15,BLDC
PART-076,히터 팬,12000,2025-01-15,고성능
PART-077,히터 저항,3000,2025-01-15,세라믹
PART-078,히터 릴레이,2000,2025-01-15,고신뢰성
PART-079,히터 퓨즈,500,2025-01-15,고속
PART-080,히터 스위치,1500,2025-01-15,디지털
PART-081,윈드실드 와이퍼,8000,2025-01-15,실리콘
PART-082,윈드실드 워셔액,3000,2025-01-15,겨울용
PART-083,윈드실드 워셔호스,2000,2025-01-15,고압용
PART-084,윈드실드 워셔모터,12000,2025-01-15,고성능
PART-085,윈드실드 워셔노즐,1000,2025-01-15,분사식
PART-086,윈드실드 워셔팔,5000,2025-01-15,고강도
PART-087,윈드실드 워셔링크,3000,2025-01-15,고강도
PART-088,윈드실드 워셔스위치,2000,2025-01-15,디지털
PART-089,윈드실드 워셔퓨즈,500,2025-01-15,고속
PART-090,윈드실드 워셔릴레이,1000,2025-01-15,고신뢰성
PART-091,도어 핸들,15000,2025-01-15,크롬
PART-092,도어 록,12000,2025-01-15,전자식
PART-093,도어 힌지,8000,2025-01-15,고강도
PART-094,도어 시트,25000,2025-01-15,가죽
PART-095,도어 트림,18000,2025-01-15,카본
PART-096,도어 웨더스트립,6000,2025-01-15,실리콘
PART-097,도어 스피커,15000,2025-01-15,고음질
PART-098,도어 스위치,3000,2025-01-15,디지털
PART-099,도어 모터,25000,2025-01-15,고성능
PART-100,도어 센서,8000,2025-01-15,초음파`;

/**
 * 에러가 포함된 CSV 데이터 샘플
 */
export const errorCSVData = `품목코드,품목명,단가,적용일,비고
PART-001,브레이크 패드,15000,2025-01-15,전면용
INVALID-CODE,존재하지 않는 품목,25000,2025-01-15,에러 테스트
PART-003,브레이크 캘리퍼,-5000,2025-01-15,음수 단가 에러
PART-004,브레이크 호스,8000,invalid-date,잘못된 날짜
PART-005,브레이크 마스터 실린더,,2025-01-15,빈 단가
PART-006,엔진 오일 필터,5000,2025-13-45,잘못된 날짜 형식
PART-007,에어 필터,abc,2025-01-15,문자 단가
PART-008,연료 필터,8000,2025-02-30,존재하지 않는 날짜`;

/**
 * 한글이 포함된 CSV 데이터 샘플
 */
export const koreanCSVData = `품목코드,품목명,단가,적용일,비고
한국-001,한국산 브레이크 패드,15000,2025-01-15,국산품
한국-002,대한민국 엔진 오일,25000,2025-01-15,국산 브랜드
한국-003,서울 자동차 부품,35000,2025-01-15,수도권 제조
한국-004,부산 해운대 필터,18000,2025-01-15,남해안 특산
한국-005,제주도 자연 부품,22000,2025-01-15,제주 특산품`;

// ============================================================================
// 2. BOM 테스트 데이터 (계산 테스트용)
// ============================================================================

/**
 * 3단계 BOM 구조 테스트 데이터
 */
export const bomTestData = {
  // 완제품 (Level 0)
  product: {
    item_id: 'PROD-001',
    item_code: 'CAR-COMPLETE',
    item_name: '완성차',
    level: 0,
    children: [
      {
        item_id: 'ASSY-001',
        item_code: 'ENGINE-ASSY',
        item_name: '엔진 어셈블리',
        level: 1,
        quantity: 1,
        children: [
          {
            item_id: 'PART-001',
            item_code: 'ENGINE-BLOCK',
            item_name: '엔진 블록',
            level: 2,
            quantity: 1,
            unit_price: 500000
          },
          {
            item_id: 'PART-002',
            item_code: 'PISTON-SET',
            item_name: '피스톤 세트',
            level: 2,
            quantity: 4,
            unit_price: 25000
          },
          {
            item_id: 'PART-003',
            item_code: 'CONNECTING-ROD',
            item_name: '연결봉',
            level: 2,
            quantity: 4,
            unit_price: 30000
          }
        ]
      },
      {
        item_id: 'ASSY-002',
        item_code: 'TRANSMISSION-ASSY',
        item_name: '변속기 어셈블리',
        level: 1,
        quantity: 1,
        children: [
          {
            item_id: 'PART-004',
            item_code: 'GEAR-SET',
            item_name: '기어 세트',
            level: 2,
            quantity: 1,
            unit_price: 200000
          },
          {
            item_id: 'PART-005',
            item_code: 'CLUTCH-DISC',
            item_name: '클러치 디스크',
            level: 2,
            quantity: 1,
            unit_price: 80000
          }
        ]
      },
      {
        item_id: 'ASSY-003',
        item_code: 'SUSPENSION-ASSY',
        item_name: '서스펜션 어셈블리',
        level: 1,
        quantity: 4,
        children: [
          {
            item_id: 'PART-006',
            item_code: 'SHOCK-ABSORBER',
            item_name: '쇼크 업소버',
            level: 2,
            quantity: 1,
            unit_price: 120000
          },
          {
            item_id: 'PART-007',
            item_code: 'SPRING',
            item_name: '스프링',
            level: 2,
            quantity: 1,
            unit_price: 45000
          }
        ]
      }
    ]
  },

  // 가격 정보가 없는 부품 (테스트용)
  missingPriceItem: {
    item_id: 'PART-999',
    item_code: 'NO-PRICE-PART',
    item_name: '가격 정보 없는 부품',
    level: 2,
    quantity: 1,
    unit_price: null
  },

  // 노무비 및 간접비 테스트 데이터
  laborOverheadData: {
    labor_cost_per_hour: 50000,
    overhead_rate: 0.15, // 15%
    assembly_time_hours: 8
  }
};

/**
 * BOM 계산 예상 결과
 */
export const expectedBOMCalculation = {
  material_cost: 500000 + (25000 * 4) + (30000 * 4) + 200000 + 80000 + (120000 * 4) + (45000 * 4),
  labor_cost: 50000 * 8, // 400,000
  overhead_cost: (500000 + (25000 * 4) + (30000 * 4) + 200000 + 80000 + (120000 * 4) + (45000 * 4)) * 0.15,
  total_cost: 0 // 계산 결과에 따라 결정
};

// ============================================================================
// 3. 중복 단가 데이터 (정리 테스트용)
// ============================================================================

/**
 * 중복 단가 테스트 데이터
 */
export const duplicatePriceData = [
  // 같은 품목, 같은 날짜에 여러 가격
  {
    item_id: 'PART-001',
    item_code: 'DUPLICATE-001',
    item_name: '중복 테스트 부품 1',
    effective_date: '2025-01-15',
    prices: [
      { price_master_id: 'PM-001', unit_price: 15000, created_at: '2025-01-10T09:00:00Z', is_current: true },
      { price_master_id: 'PM-002', unit_price: 16000, created_at: '2025-01-12T14:30:00Z', is_current: true },
      { price_master_id: 'PM-003', unit_price: 15500, created_at: '2025-01-14T11:15:00Z', is_current: true }
    ]
  },
  {
    item_id: 'PART-002',
    item_code: 'DUPLICATE-002',
    item_name: '중복 테스트 부품 2',
    effective_date: '2025-01-20',
    prices: [
      { price_master_id: 'PM-004', unit_price: 25000, created_at: '2025-01-18T10:00:00Z', is_current: true },
      { price_master_id: 'PM-005', unit_price: 24000, created_at: '2025-01-19T16:45:00Z', is_current: true }
    ]
  },
  {
    item_id: 'PART-003',
    item_code: 'DUPLICATE-003',
    item_name: '중복 테스트 부품 3',
    effective_date: '2025-02-01',
    prices: [
      { price_master_id: 'PM-006', unit_price: 35000, created_at: '2025-01-30T08:00:00Z', is_current: true },
      { price_master_id: 'PM-007', unit_price: 36000, created_at: '2025-01-31T12:30:00Z', is_current: true },
      { price_master_id: 'PM-008', unit_price: 35500, created_at: '2025-02-01T09:15:00Z', is_current: true },
      { price_master_id: 'PM-009', unit_price: 34500, created_at: '2025-02-01T15:20:00Z', is_current: true }
    ]
  }
];

/**
 * 중복 정리 전략별 예상 결과
 */
export const expectedCleanupResults = {
  keep_latest: {
    PART_001: { kept_price: 15500, deleted_count: 2 },
    PART_002: { kept_price: 24000, deleted_count: 1 },
    PART_003: { kept_price: 34500, deleted_count: 3 }
  },
  keep_oldest: {
    PART_001: { kept_price: 15000, deleted_count: 2 },
    PART_002: { kept_price: 25000, deleted_count: 1 },
    PART_003: { kept_price: 35000, deleted_count: 3 }
  },
  custom: {
    PART_001: { kept_price: 16000, deleted_count: 2 }, // PM-002 선택
    PART_002: { kept_price: 25000, deleted_count: 1 }, // PM-004 선택
    PART_003: { kept_price: 36000, deleted_count: 3 }  // PM-007 선택
  }
};

// ============================================================================
// 4. 성능 테스트 데이터
// ============================================================================

/**
 * 대용량 데이터 생성 함수 (1000개 품목)
 */
export function generateLargeDataset(count: number = 1000): string {
  const headers = '품목코드,품목명,단가,적용일,비고\n';
  const rows: string[] = [];
  
  for (let i = 1; i <= count; i++) {
    const itemCode = `PERF-${i.toString().padStart(4, '0')}`;
    const itemName = `성능 테스트 부품 ${i}`;
    const price = Math.floor(Math.random() * 100000) + 10000; // 10,000 ~ 110,000
    const date = '2025-01-15';
    const note = `테스트 데이터 ${i}`;
    
    rows.push(`${itemCode},${itemName},${price},${date},${note}`);
  }
  
  return headers + rows.join('\n');
}

/**
 * 깊은 BOM 구조 생성 함수 (10레벨)
 */
export function generateDeepBOM(levels: number = 10): any {
  function createLevel(currentLevel: number, maxLevel: number): any {
    if (currentLevel >= maxLevel) {
      return {
        item_id: `LEAF-${currentLevel}`,
        item_code: `LEAF-${currentLevel}`,
        item_name: `리프 부품 ${currentLevel}`,
        level: currentLevel,
        quantity: 1,
        unit_price: Math.floor(Math.random() * 50000) + 10000
      };
    }
    
    return {
      item_id: `LEVEL-${currentLevel}`,
      item_code: `LEVEL-${currentLevel}`,
      item_name: `레벨 ${currentLevel} 부품`,
      level: currentLevel,
      quantity: Math.floor(Math.random() * 5) + 1,
      children: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => 
        createLevel(currentLevel + 1, maxLevel)
      )
    };
  }
  
  return createLevel(0, levels);
}

// ============================================================================
// 5. 유틸리티 함수
// ============================================================================

/**
 * CSV 데이터를 Blob으로 변환
 */
export function csvToBlob(csvData: string): Blob {
  return new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
}

/**
 * CSV 데이터를 File 객체로 변환
 */
export function csvToFile(csvData: string, filename: string = 'test-data.csv'): File {
  const blob = csvToBlob(csvData);
  return new File([blob], filename, { type: 'text/csv' });
}

/**
 * 테스트용 FormData 생성
 */
export function createTestFormData(csvData: string, mode: 'create' | 'upsert' = 'create'): FormData {
  const formData = new FormData();
  const file = csvToFile(csvData);
  formData.append('file', file);
  formData.append('mode', mode);
  return formData;
}

/**
 * API 테스트용 헤더 생성
 */
export function createTestHeaders(): Headers {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');
  return headers;
}

// ============================================================================
// 6. 테스트 시나리오
// ============================================================================

/**
 * 전체 테스트 시나리오
 */
export const testScenarios = {
  // Wave 1: Bulk Upload 테스트
  bulkUpload: {
    validData: validCSVData,
    errorData: errorCSVData,
    koreanData: koreanCSVData,
    largeData: generateLargeDataset(1000)
  },
  
  // Wave 2: BOM Calculation 테스트
  bomCalculation: {
    simpleBOM: bomTestData.product,
    missingPrice: bomTestData.missingPriceItem,
    deepBOM: generateDeepBOM(10),
    laborOverhead: bomTestData.laborOverheadData
  },
  
  // Wave 3: Duplicate Cleanup 테스트
  duplicateCleanup: {
    duplicateData: duplicatePriceData,
    expectedResults: expectedCleanupResults,
    strategies: ['keep_latest', 'keep_oldest', 'custom'] as const
  }
};

export default testScenarios;
