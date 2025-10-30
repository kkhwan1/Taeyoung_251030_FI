# 데이터 마이그레이션 가이드

## 작업 완료 내역

### 1. 테스트 데이터 삭제 ✅

**날짜**: 2025-01-27  
**방법**: Supabase MCP를 사용하여 SQL 직접 실행

**삭제된 데이터:**
- bom_deduction_log: 32개
- inventory_transactions: 43개  
- bom: 20개
- item_price_history: 1,456개
- items: 208개
- companies: 14개

**유지된 데이터:**
- users: 3개 (운영 계정)

---

## 2. 엑셀 데이터 마이그레이션 준비 완료

### 스크립트 정보

**파일**: `scripts/migration/import-inventory-excel.ts`

**기능:**
1. PyHub MCP를 사용하여 엑셀 파일 (`09월 원자재 수불관리.xlsx`) 읽기
2. 각 시트에서 품목 정보 추출
3. T1~T268 일별 데이터를 재고 거래(inventory_transactions)로 변환
4. 품목 데이터를 `items` 테이블에 삽입
5. 거래 데이터를 `inventory_transactions` 테이블에 삽입

### 실행 전 준비 사항

1. **PyHub MCP 설정 확인**
   - Cursor에서 PyHub MCP 서버가 등록되어 있는지 확인
   - `.claude/settings.local.json` 또는 `.cursor/settings.json` 확인

2. **엑셀 파일 위치 확인**
   - 파일 경로: `.example/09월 원자재 수불관리.xlsx`
   - 엑셀 파일이 열려있어야 PyHub MCP가 읽을 수 있음

3. **환경 변수 확인**
   - `.env` 파일에 Supabase 설정이 올바른지 확인

### 실행 방법

```bash
# 프로젝트 루트에서 실행
npx tsx scripts/migration/import-inventory-excel.ts
```

### 예상 결과

1. 각 시트별로 품목 및 거래 데이터 추출
2. 품목 데이터를 `items` 테이블에 배치 삽입
3. 품목 코드 → ID 매핑 생성
4. 거래 데이터를 `inventory_transactions` 테이블에 배치 삽입
5. 진행 상황 및 결과 통계 출력

### 문제 해결

**PyHub MCP 오류:**
- Cursor를 재시작
- 엑셀 파일이 열려있는지 확인
- PyHub MCP 서버 로그 확인

**데이터 삽입 오류:**
- 외래 키 제약 조건 확인
- 중복 데이터 확인 (item_code)
- 데이터 타입 확인

---

## 참고 파일

- `scripts/migration/01-delete-existing-data.ts` - 데이터 삭제 스크립트 (완료)
- `scripts/migration/import-inventory-excel.ts` - 엑셀 마이그레이션 스크립트 (준비 완료)
- `scripts/migration/utils/supabase-client.ts` - Supabase 클라이언트 유틸리티
- `scripts/migration/utils/logger.ts` - 로거 유틸리티
- `scripts/migration/types/excel-data.ts` - 엑셀 데이터 타입 정의

