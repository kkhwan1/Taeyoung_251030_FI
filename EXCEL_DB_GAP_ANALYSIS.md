# Excel vs DB 데이터 누락 분석 리포트

**생성 시간**: 2025. 10. 31. 오전 8:31:30

## 📈 전체 요약

| 항목 | 값 |
|------|----|
| Excel 파일 수 | 4개 |
| Excel 총 레코드 | 4,842건 |
| DB 총 레코드 | 1,021건 |
| 예상 누락 | 3,821건 |
| 누락률 | 78.91% |

## 📄 Excel 파일별 분석

### 태창금속 BOM.xlsx

- **시트 수**: 6개
- **총 레코드**: 834건
- **예상 테이블**: 

| 시트명 | 레코드 수 | 예상 테이블 |
|--------|-----------|-------------|
| 대우공업 | 140건 | unknown |
| 풍기산업 | 55건 | unknown |
| 다인 | 20건 | unknown |
| 호원오토 | 227건 | unknown |
| 인알파코리아 | 149건 | unknown |
| 최신단가 | 243건 | unknown |

### 2025년 9월 매입매출 보고현황.xlsx

- **시트 수**: 18개
- **총 레코드**: 2336건
- **예상 테이블**: companies, sales_transactions or purchases

| 시트명 | 레코드 수 | 예상 테이블 |
|--------|-----------|-------------|
| 일일업무보고 일일매치 작업용 | 75건 | companies |
| Sheet1 | 0건 | unknown |
| 정리 | 242건 | unknown |
| 태창금속 | 80건 | unknown |
| 협력사 | 110건 | unknown |
| 보고용 | 27건 | unknown |
| 매입부자재(구매) | 176건 | unknown |
| 납품수량(영업) | 385건 | unknown |
| 일일업무보고 일일매치 | 77건 | unknown |
| 물류 | 29건 | unknown |
| 일일매출 보고용 | 24건 | unknown |
| 협력사 매입매출 | 15건 | sales_transactions or purchases |
| 결재 | 0건 | unknown |
| 재고현황보고 | 10건 | unknown |
| 종합 일일매출 보고용 | 530건 | unknown |
| 호원오토 | 103건 | unknown |
| 대우공업 다인 | 132건 | unknown |
| 인알파 | 321건 | unknown |

### 2025년 9월 종합관리 SHEET.xlsx

- **시트 수**: 5개
- **총 레코드**: 721건
- **예상 테이블**: 

| 시트명 | 레코드 수 | 예상 테이블 |
|--------|-----------|-------------|
| 종합재고 | 68건 | unknown |
| COIL 입고현황 | 266건 | unknown |
| SHEET 입고현황 | 266건 | unknown |
| 생산실적 | 87건 | unknown |
| Sheet1 | 34건 | unknown |

### 09월 원자재 수불관리.xlsx

- **시트 수**: 21개
- **총 레코드**: 951건
- **예상 테이블**: 

| 시트명 | 레코드 수 | 예상 테이블 |
|--------|-----------|-------------|
| 풍기서산(사급) | 19건 | unknown |
| 세원테크(사급) | 40건 | unknown |
| 대우포승(사급) | 16건 | unknown |
| 호원오토(사급) | 12건 | unknown |
| 웅지테크 | 14건 | unknown |
| 태영금속 | 9건 | unknown |
| JS테크 | 27건 | unknown |
| 에이오에스 | 21건 | unknown |
| 창경테크 | 8건 | unknown |
| 신성테크 | 5건 | unknown |
| 광성산업 | 5건 | unknown |
| MV1 , SV (재고관리) | 38건 | unknown |
| TAM,KA4,인알파 | 60건 | unknown |
| DL3 GL3 (재고관리) | 81건 | unknown |
| 태창금속 (전착도장) | 115건 | unknown |
| 인알파 (주간계획) | 163건 | unknown |
| 실적 취합 | 83건 | unknown |
| 협력업체 (C.O 납품현황) | 26건 | unknown |
| 대우사급 입고현황 | 30건 | unknown |
| 호원사급 입고현황 | 69건 | unknown |
| 협력업체 입고현황 | 110건 | unknown |

## 🗄️ DB 테이블별 저장 현황

| 테이블 | 레코드 수 |
|--------|----------|
| items | 731건 |
| companies | 61건 |
| bom | 138건 |
| inventory_transactions | 0건 |
| price_master | 0건 |
| sales_transactions | 51건 |
| purchase_transactions | 40건 |
| inbound_transactions | 0건 |
| outbound_transactions | 0건 |
| production_transactions | 0건 |

## ❌ 테이블별 데이터 갭

| 테이블 | Excel | DB | 누락 | 누락률 | 상태 |
|--------|-------|----|----|-------|------|
| companies | 75 | 61 | 14 | 18.67% | ❌ 누락 |

## 💡 권장 조치사항

### [HIGH] price_master 테이블 완전 비어있음

**조치**: Excel 최신단가 시트 임포트 필요

