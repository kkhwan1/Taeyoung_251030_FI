# 수동 데이터 입력 가이드

## 개요
Excel 파일에서 추출한 16개 품목 샘플 데이터를 웹 UI에서 수동으로 입력하여 시스템이 정상 작동하는지 검증합니다.

## 데이터 구성

### 거래처 (Company)
- **거래처명**: 풍기광주
- **유형**: 협력사

### 품목 (Items) - 16개

다음 항목들을 수동으로 입력합니다:

#### 1. HOOD INR (66421-P1000)
- 재질: SGACC
- 규격: 0.6
- 두께: 0.6mm
- 가로: 1325mm
- 세로: 1720mm
- 비중: 7.85
- MM중량: 10.73409 kg
- 차종: NQ5

#### 2. EXTN-RR FLOOR FR (65521-P2000)
- 재질: SGAFC590DP
- 규격: 0.7
- 두께: 0.7mm
- 가로: 1660mm
- 세로: 650mm
- 비중: 7.85
- MM중량: 5.929105 kg
- 차종: NQ5

#### 3. EXTN-RR FLOOR FR (65522-P4000)
- 재질: SGAFC590DP
- 규격: 0.7
- 두께: 0.7mm
- 가로: 1630mm
- 세로: 450mm
- 비중: 7.85
- MM중량: 4.0305825 kg
- 차종: NQ5

#### 4. REINF RR FLOOR FR CROSS (65631-P4000)
- 재질: SGAFC590
- 규격: 0.7
- 두께: 0.7mm
- 가로: 1470mm
- 세로: 214mm
- 비중: 7.85
- MM중량: 1.7286171 kg
- 차종: NQ5

#### 5. MBR BATTERY MT'G RR SIDE LH/RH (657A6/B6-P4000)
- 재질: SGAFC590
- 규격: 1.4
- 두께: 1.4mm
- 가로: 1170mm
- 세로: 250mm
- 비중: 7.85
- MM중량: 3.214575 kg
- 차종: NQ5

#### 6. MBR ASSY-RR FLR SD EXTN,LH (65614-CV000)
- 재질: SGAFC780DP
- 규격: 1.6
- 두께: 1.6mm
- 가로: 690mm
- 세로: 352.5mm
- 비중: 7.85
- MM중량: 3.054906 kg
- 차종: CV1

#### 7. MBR ASSY-RR FLR SD EXTN,RH (65624-CV000)
- 재질: SGAFC780DP
- 규격: 1.6
- 두께: 1.6mm
- 가로: 690mm
- 세로: 352.5mm
- 비중: 7.85
- MM중량: 3.054906 kg
- 차종: CV1

#### 8. MEBER ASSY-RR FLOOR CTR CROSS (65852-CV000)
- 재질: SGAFC590DP
- 규격: 1.2
- 두께: 1.2mm
- 가로: 1060mm
- 세로: 305mm
- 비중: 7.85
- MM중량: 3.045486 kg
- 차종: CV1

#### 9. PILLAR-CTR INR UPR,LH (71714-AT000)
- 재질: SPFC980Y
- 규격: 0.9
- 두께: 0.9mm
- 가로: 917mm
- 세로: 260mm
- 비중: 7.85
- MM중량: 1.6844373 kg
- 차종: SG2

#### 10. PILLAR-CTR INR UPR,RH (71724-AT000)
- 재질: SPFC980Y
- 규격: 0.9
- 두께: 0.9mm
- 가로: 917mm
- 세로: 260mm
- 비중: 7.85
- MM중량: 1.6844373 kg
- 차종: SG2

#### 11. BATTERY LWR CASE (BP212-AT000)
- 재질: SGACUD
- 규격: 1.0
- 두께: 1.0mm
- 가로: 1425mm
- 세로: 1025mm
- 비중: 7.85
- MM중량: 11.46590625 kg
- 차종: SG2

#### 12. MBR-LWR RR. LH/RH (BP314/24-AT000)
- 재질: SGAFC590DP
- 규격: 2.0
- 두께: 2.0mm
- 가로: 250mm
- 세로: 1200mm
- 비중: 7.85
- MM중량: 4.71 kg
- 차종: SG2

#### 13. MBR ASSY-RR FLR SD EXTN,LH (65614-KL000)
- 재질: SGAFC780DP
- 규격: 1.6
- 두께: 1.6mm
- 가로: 740mm
- 세로: 355mm
- 비중: 7.85
- MM중량: 3.299512 kg
- 차종: CE

#### 14. MBR ASSY-RR FLR SD EXTN,RH (65624-KL000)
- 재질: SGAFC780DP
- 규격: 1.6
- 두께: 1.6mm
- 가로: 740mm
- 세로: 355mm
- 비중: 7.85
- MM중량: 3.299512 kg
- 차종: CE

#### 15. PNL-RR FLOOR FR (65512-M9000)
- 재질: SGACC
- 규격: 0.7
- 두께: 0.7mm
- 가로: 1047mm
- 세로: 1621mm
- 비중: 7.85
- MM중량: 9.326042565 kg
- 차종: IG

#### 16. CROSS MBR-CTR (65272/82-2J100)
- 재질: SGAFC590
- 규격: 0.8
- 두께: 0.8mm
- 가로: 210mm
- 세로: 1260mm
- 비중: 7.85
- MM중량: 1.661688 kg
- 차종: HM

## 입력 순서

### 1단계: 거래처 등록
```
URL: /master/companies
- 거래처명: 풍기광주
- 거래처 코드: 자동 생성
- 거래처 유형: 협력사
```

### 2단계: 품목 등록 (16개)
```
URL: /master/items

각 품목을 위 데이터로 입력:
- 품번: item_code (예: 66421-P1000)
- 품명: item_name (예: HOOD INR)
- 규격: spec (예: 0.6)
- 단위: EA
- 카테고리: 원자재
- 차종: vehicle_model
- 재질: material
- 두께: thickness
- 가로: width
- 세로: height
- 비중: specific_gravity
- MM중량: mm_weight
```

## 검증 사항

### 입력 후 확인:
1. 품목 목록에 16개 모두 표시되는지
2. 각 품목 상세 정보가 정확한지
3. 검색 기능이 정상 작동하는지
4. 수정/삭제가 정상 작동하는지

### BOM 관계 확인:
- 필요시 BOM을 설정하여 부모-자식 관계 검증

## 완료 기준
- ✅ 16개 품목 모두 정상 등록
- ✅ 웹 UI에서 정상 표시
- ✅ 검색/필터 기능 정상 작동
- ✅ BOM 관계 설정 가능

## 파일 위치
- 샘플 데이터: `scripts/migration/sample-data-manual-input.json`

