# PyHub MCP 사용 가이드

## PyHub MCP 도구 직접 호출 방법

PyHub MCP는 엑셀 파일이 열려있어도 읽을 수 있는 장점이 있습니다.

## 사용 가능한 MCP 도구

Cursor 환경에서 PyHub MCP 도구를 직접 호출할 수 있습니다.

### 예상되는 도구 이름 형식

- `mcp_pyhub-mcptools_excel_get_values`
- `mcp_pyhub_mcptools_excel_get_values`
- 또는 다른 네이밍 규칙

## 호출 예제

### 1. 엑셀 파일 읽기

```typescript
// Cursor의 MCP 도구 직접 호출 예제
const csvData = await mcp_pyhub-mcptools_excel_get_values({
  book_name: '09월 원자재 수불관리.xlsx',
  sheet_name: '풍기서산(사급)',
  sheet_range: 'A6:L500',
  value_type: 'values'
});
```

### 2. 파라미터 rece.escription

- `book_name`: 엑셀 파일명 (`.example` 폴더에 있는 파일)
- `sheet_name`: 시트 이름
- `sheet_range`: 읽을 범위 (예: 'A1:Z100')
- `value_type`: 'values' 또는 다른 타입

### 3. 반환값

- CSV 형식의 문자열
- 각 행은 쉼표로 구분
- 파싱 필요: `parseCsvToArray()` 함수 사용

### 4. 파라미터 설명

## 검토 대상 엑셀 파일

### 1. 09월 원자재 수불관리.xlsx
**시트 목록:**
- 풍기서산(사급)
- 세원테크(사급)
- 대우포승(사급)
- 호원오토(사급)
- 웅지테크
- 태영금속
- JS테크
- 에이오에스
- 창경테크
- 신성테크
- 광성산업
- MV1 , SV (재고관리)
- TAM,KA4,인알파
- DL3 GL3 (재고관리)
- 태창금속 (전착도장)
- 인알파 (주간계획)
- 실적 취합
- 협력업체 (C.O 납품현황)
- 대우사급 입고현황
- 호원사급 입고현황
- 협력업체 입고현황

### 2. 태창금속 BOM.xlsx
**시트 목록:**
- 대우공업
- 풍기산업
- 다인
- 호원오토
- 인알파코리아
- 최신단가 ⭐ (단가 정보)

### 3. 2025년 9월 종합관리 SHEET.xlsx
**시트:**
- 종합재고

### 4. 2025년 9월 매입매출 보고현황.xlsx
**시트:**
- 정리

## 검토 항목

1. **엑셀 파일 구조 확인**
   - 각 시트의 헤더 위치
   - 컬럼 구조
   - 데이터 시작 행

2. **데이터 샘플 확인**
   - 첫 몇 행의 데이터
   - 데이터 타입 확인
   - 빈 값 처리

3. **품번/단가 매칭 검증**
   - 최신단가 시트에서 품번/단가 추출
   - DB 품목 코드와 매칭 확인
   - 매칭률 계산

4. **데이터 일관성 확인**
   - 엑셀에서 추출한 데이터와 DB 데이터 비교
   - 누락된 항목 확인

## 현재 상태

- ✅ XLSX 라이브러리로 데이터 마이그레이션 완료
- ✅ Supabase MCP로 데이터 검증 완료
- ⚠️ PyHub MCP 직접 호출은 Cursor의 MCP 도구 목록 확인 필요

## 다음 단계

Cursor의 MCP 도구 목록에서 `pyhub` 또는 `pyhub-mcptools` 관련 도구를 찾아 직접 호출하면 됩니다.

