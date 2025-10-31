# Invalid P/NO 분석 보고서

생성일시: 2025-01-30
분석 대상: 37건의 Invalid P/NO 레코드

## 📊 요약

### 전체 통계
- **총 Invalid P/NO**: 37건
- **고유 품목 코드**: 27개
- **null 값**: 6건 (16.2%)
- **숫자 전용 코드**: 31건 (83.8%)

### 데이터 품질 점수
- **복구 가능**: 31건 (83.8%) - 품목 추가로 해결 가능
- **null 값 (데이터 부족)**: 6건 (16.2%) - 원본 데이터 확인 필요

## 🔍 패턴 분석

### 1. 숫자 전용 P/NO (31건)

**패턴**: 8자리 숫자 코드 (50007XXX ~ 50012XXX)
**원인**: 품목 코드가 하이픈 없는 순수 숫자 형식
**해결책**: items 테이블에 품목 추가

#### 분류별 통계

| 카테고리 | 개수 | 예시 |
|---------|------|------|
| ROLLO 부품 | 12건 | 50011800, 50011801, 50009877 |
| BRACKET 부품 | 6건 | 50010567, 50010569, 50009770 |
| REINF 부품 | 4건 | 50010988, 50010989, 50010990 |
| CROSS MEMBER | 2건 | 50011384, 50011385 |
| BOLT 부품 | 2건 | 50007315, 50007752 |
| 기타 부품 | 5건 | 50008630, 50010027, 50012234 |

#### 고빈도 코드 (중복)

| P/NO | 빈도 | 품목명 |
|------|------|--------|
| 50011800 | 2회 | B/K ROLLO-LH |
| 50011801 | 2회 | B/K ROLLO-RH |
| 50009877 | 2회 | B/K ROLLO LH |
| 50009878 | 2회 | B/K ROLLO RH |

### 2. Null 값 (6건)

**원인**: 원본 Excel 파일에서 P/NO 셀이 비어있음
**해결책**: 원본 데이터 확인 또는 폐기

| 속성 | 값 |
|------|-----|
| P/NO | null |
| Part Name | null |
| Company | null/undefined |
| Quantity | null/undefined |

## 📋 복구 가능한 품목 목록 (27개)

### ROLLO 시스템 (12개)
1. **50011800** - B/K ROLLO-LH (거래처: 에이오에스)
2. **50011801** - B/K ROLLO-RH
3. **50009877** - B/K ROLLO LH
4. **50009878** - B/K ROLLO RH
5. **50011308** - ROLLO CASSETTE
6. **50011833** - ROLLO BRACKER L/R
7. **50010567** - BRKT ROLLO LH
8. **50010569** - BRKT ROLLO RH
9. **50010992** - B/K ROLLO CASSETTE LH
10. **50010993** - B/K ROLLO CASSETTE RH

### BRACKET & REINF (10개)
11. **50009770** - BRACKET SIDE LH
12. **50009772** - BRACKET SIDE RH
13. **50010988** - FRT SIDE REINF LH
14. **50010989** - FRT SIDE REINF RH
15. **50010990** - REAR SIDE REINF LH
16. **50010991** - REAR SIDE REINF RH

### CROSS MEMBER (2개)
17. **50011384** - CENTER CROSS MEMBER LOWER
18. **50011385** - CENTER CROSS MEMBER UPPER

### BOLT & 기타 (5개)
19. **50007315** - M5 INSERT BOLT
20. **50007752** - M5*16.7 BOLT
21. **50008457** - FRONT B/K LH
22. **50008458** - FRONT B/K RH
23. **50008630** - 2ND ROOM
24. **50010027** - B/K FOR CONNECTOR
25. **50010086** - B/K FOR TUBE
26. **50012234** - REAR BEAM

## 🎯 실행 계획

### Phase 1: 품목 코드 정규화 및 검증 (30분)

**작업**:
1. ✅ 품목 코드 패턴 분석 완료
2. ⏳ items 테이블에서 기존 코드 존재 여부 확인
3. ⏳ 중복 방지 로직 추가

### Phase 2: 품목 생성 스크립트 작성 (1시간)

**작업**:
1. ⏳ 27개 품목에 대한 INSERT 스크립트 생성
2. ⏳ 기본 속성 설정:
   - `item_code`: 숫자 코드 그대로 사용
   - `item_name`: Part Name 사용
   - `category`: 품목명 기반 자동 분류
   - `unit`: 'EA' (기본값)
   - `is_active`: true
3. ⏳ 트랜잭션 기반 일괄 삽입

### Phase 3: 입고 레코드 재처리 (30분)

**작업**:
1. ⏳ 31건의 레코드를 재매핑
2. ⏳ 새로 추가된 품목 코드로 연결
3. ⏳ `import-new-inbound-records.ts` 재실행

### Phase 4: 검증 및 문서화 (30분)

**작업**:
1. ⏳ 신규 입고 거래 확인
2. ⏳ 재고 수량 업데이트 검증
3. ⏳ 최종 보고서 업데이트

## 🚀 예상 효과

### 데이터 복구율
- **이전**: 81/231 = 35.1%
- **예상**: 112/231 = 48.5% (+13.4%p)

### 추가 입고 거래
- **신규 레코드**: 31건 (null 6건 제외)
- **거래처**: 에이오에스 (확인됨) + 기타
- **품목 카테고리**: ROLLO, BRACKET, REINF, BOLT 등

### 시스템 커버리지 향상
- **품목 마스터**: +27개 품목
- **거래 데이터**: +31건 입고 거래
- **데이터 무결성**: Invalid P/NO 83.8% 해결

## ⚠️ 주의사항

### 1. 품목 코드 형식
- **현재 시스템**: 하이픈 포함 (예: 69116-DO000)
- **Invalid P/NO**: 하이픈 없음 (예: 50011800)
- **권장**: 숫자 코드 그대로 사용 (시스템 검증 규칙 완화 필요)

### 2. 거래처 정보
- 대부분 레코드에서 `company: null`
- 에이오에스 1건만 확인됨
- 원본 Excel에서 거래처 정보 보완 필요

### 3. Null 값 레코드 (6건)
- 데이터 부족으로 복구 불가능
- 원본 데이터 소스 재확인 필요
- 영구 폐기 고려

## 📁 생성된 파일

### 분석 결과
- `scripts/analysis/invalid-pno-analysis.json` - 상세 분석 데이터
- `scripts/analysis/analyze-invalid-pno.js` - 분석 스크립트
- `INVALID_PNO_ANALYSIS_REPORT.md` - 본 보고서

### 실행 스크립트 (다음 단계)
- `scripts/migration/add-missing-items.ts` - 품목 추가 스크립트
- `scripts/migration/normalize-item-codes.ts` - 품목 코드 정규화
- `scripts/migration/reimport-numeric-pno.ts` - 재임포트 스크립트

## 🎯 다음 액션

### 즉시 실행 가능
1. **품목 추가 스크립트 실행**:
   ```bash
   npm run tsx scripts/migration/add-missing-items.ts
   ```

2. **재임포트 스크립트 실행**:
   ```bash
   npm run tsx scripts/migration/reimport-numeric-pno.ts
   ```

3. **검증**:
   ```bash
   npm run tsx scripts/verification/verify-invalid-pno-recovery.ts
   ```

### 데이터 정리 필요
1. 원본 Excel 파일에서 null P/NO 확인
2. 거래처 정보 보완
3. 품목 코드 형식 통일 정책 결정

---

**작성자**: Database Optimization Expert
**분석 도구**: Node.js + JSON 패턴 분석
**데이터 소스**: `scripts/migration/data/clean-data/inbound-skipped.json`
