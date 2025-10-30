# 입고 등록 페이지 테스트 가이드

## 📋 개요

입고 등록 페이지의 수동 테스트 절차 및 출고 등록과의 일관성 검증 가이드입니다.

**현재 상태:**

- 기본 입고 등록 기능 정상 작동
- 출고 등록과 일관성 개선 필요 (상세 내용은 `RECEIVING_IMPROVEMENTS.md` 참조)

**테스트 목적:**

1. 현재 입고 등록 기능 검증
2. 출고 등록과의 일관성 비교
3. 개선사항 적용 후 검증

---

## 🚀 테스트 전 준비사항

### 1. 개발 서버 시작

```bash
npm run dev:safe
# 또는
npm run dev
```

### 2. 브라우저 접속

```
http://localhost:5000/inventory?tab=receiving
```

---

## ✅ 현재 상태 테스트

### 시나리오 1: 입고 등록 폼 UI 확인

#### 단계 1: 페이지 접속

1. 브라우저에서 http://localhost:5000/inventory 접속
2. **"입고 관리"** 탭 클릭 (기본 선택됨)
3. **"입고 등록"** 버튼 클릭

#### 단계 2: 필드 확인

입고 등록 폼에서 다음 필드들이 표시되는지 확인:

✅ **현재 필드 목록:**

- [ ] **"거래일자"** 레이블 (현재 상태 - 개선 필요 ⚠️)
- [ ] 거래일자 날짜 선택 필드 (transaction_date)
- [ ] "공급업체" 드롭다운 (company_id)
- [ ] "품목" 검색 필드 (item_id)
- [ ] "수량" 입력 필드 (quantity)
- [ ] **"단가 (₩)"** 입력 필드 (unit_price) - 수동 입력
- [ ] "참조번호" 텍스트 필드 (현재: 자동생성 없음 ⚠️)
- [ ] "LOT 번호" 텍스트 필드
- [ ] "만료일" 날짜 선택 필드
- [ ] "입고 위치" 텍스트 필드
- [ ] "메모" 텍스트 영역
- [ ] "입고 등록" 버튼

**⚠️ 출고와 비교한 차이점:**

| 항목 | 입고 등록 (현재) | 출고 등록 (개선됨) | 일관성 |
|------|-----------------|-------------------|--------|
| 날짜 레이블 | "거래일자" | "출고 예정일" | ❌ 불일치 |
| 참조번호 자동생성 | 없음 | 있음 (SHP-YYYYMMDDHHMM) | ❌ 불일치 |
| 배송/도착 예정일 | 없음 | "배송 예정일" 있음 | ❌ 불일치 |
| 단가 입력 | 수동 입력 | 월별 단가 마스터 자동 조회 | ❌ 불일치 |

### 시나리오 2: 입고 등록 완료 테스트

#### 단계 1: 기본 정보 입력

1. **거래일자 설정**
   - 기본값: 오늘 날짜 (자동 설정됨)
   - 원하는 날짜로 변경 가능

2. **공급업체 선택** (선택사항)
   - 드롭다운 클릭
   - 공급업체 선택 (예: "테스트 공급사 1")

3. **품목 선택**
   - "품목" 검색 필드 클릭
   - 품번 또는 품명 입력 (예: "65554")
   - 검색 결과에서 품목 선택
   - 단가가 자동으로 표시됨

4. **수량 입력**
   - 수량 필드에 값 입력 (예: 10)
   - 단위 표시 확인 (예: "단위: EA")

5. **단가 확인**
   - 품목 선택 시 자동으로 표시된 단가 확인
   - 필요 시 수동 수정 가능

6. **참조번호 입력** (선택사항)
   - 수동으로 입력 (예: "PO-2024-001")
   - **개선 필요**: 자동생성 기능 없음 ⚠️

7. **LOT 번호, 만료일, 입고 위치** (선택사항)
   - 필요 시 입력

#### 단계 2: 등록 완료

1. **제출**
   - "입고 등록" 버튼 클릭

2. **성공 메시지 확인**
   - 알림 다이얼로그 표시
   - 메시지: "입고가 성공적으로 등록되었습니다."

3. **폼 초기화 확인**
   - 등록 후 폼이 초기 상태로 리셋되는지 확인

#### 단계 3: 등록된 데이터 확인

1. **입고 관리 테이블 확인**
   - 페이지 하단의 "최근 거래 내역" 테이블 확인
   - 방금 등록한 입고 건이 최상단에 표시되는지 확인

2. **데이터 필드 검증**
   - 거래일자 올바른지 확인
   - 품목 정보 올바른지 확인
   - 수량 및 단가 올바른지 확인
   - 공급업체 이름 표시 확인
   - 참조번호 표시 확인

### 시나리오 3: 데이터베이스 검증

#### API 조회 테스트

```bash
curl -s "http://localhost:5000/api/inventory/receiving?limit=5"
```

**확인 사항:**

- `transaction_type` = "입고"
- `transaction_date` 올바른 형식 (YYYY-MM-DD)
- `item_id`, `quantity`, `unit_price` 값 존재
- `company_id` 값 (선택한 경우)
- `reference_no` 값 (입력한 경우)

**예상 응답 형식:**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "transaction_id": 123,
        "transaction_date": "2025-10-29",
        "transaction_type": "입고",
        "item_id": 1,
        "quantity": 10,
        "unit_price": 5000,
        "total_amount": 50000,
        "company_id": 1,
        "reference_no": "PO-2024-001",
        "item": {
          "item_code": "65554",
          "item_name": "테스트 품목",
          "unit": "EA"
        },
        "company": {
          "company_name": "테스트 공급사 1"
        }
      }
    ],
    "summary": {
      "total_count": 1,
      "total_quantity": 10,
      "total_value": 50000
    }
  }
}
```

---

## 🔄 개선사항 적용 후 테스트

**참고**: `RECEIVING_IMPROVEMENTS.md`의 개선사항 적용 후 다음 테스트 수행

### Phase 1 테스트: UI 일관성 개선

#### 1. "입고 예정일" 레이블 변경 확인

**테스트 항목:**

- [ ] "거래일자" → "입고 예정일" 레이블 변경 확인
- [ ] 날짜 선택 기능 정상 동작
- [ ] 폼 제출 시 `transaction_date` 필드로 정상 저장

#### 2. 입고번호 자동생성 기능 확인

**테스트 항목:**

- [ ] "참조번호" → "입고번호" 레이블 변경 확인
- [ ] 자동생성 버튼 표시 확인 (Plus 아이콘)
- [ ] 버튼 클릭 시 `RCV-YYYYMMDDHHMM` 형식 생성 확인
- [ ] 생성된 번호가 필드에 자동 입력됨
- [ ] 수동 입력도 여전히 가능

**자동생성 번호 형식 예시:**

```
RCV-202510291430
RCV-202510291545
```

**API 테스트:**

```bash
curl -X POST http://localhost:5000/api/inventory/receiving \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "transaction_date": "2025-10-29",
    "item_id": 1,
    "quantity": 10,
    "unit_price": 5000,
    "company_id": 1,
    "reference_no": "RCV-202510291430",
    "notes": "자동생성 번호 테스트"
  }'
```

**예상 응답:**

```json
{
  "success": true,
  "message": "입고가 성공적으로 등록되었습니다.",
  "data": {
    "transaction_id": 124,
    "reference_number": "RCV-202510291430"
  }
}
```

### Phase 2 테스트: 도착 예정일 기능

#### 1. 도착 예정일 필드 확인

**테스트 항목:**

- [ ] "도착 예정일" 필드 표시 확인
- [ ] 날짜 선택 캘린더 정상 동작
- [ ] 입고 예정일보다 미래 날짜만 선택 가능한지 검증
- [ ] 선택사항으로 비워두고 제출 가능

**UI 위치 확인:**

```
┌─────────────────────────────────────┐
│ 입고 예정일 *     │ 공급업체        │
├─────────────────────────────────────┤
│ 입고번호          │ 도착 예정일 ⭐  │
├─────────────────────────────────────┤
│ 품목 검색                            │
└─────────────────────────────────────┘
```

#### 2. 데이터베이스 스키마 확인

**마이그레이션 실행 확인:**

```bash
npm run migrate:up
npm run db:types
```

**스키마 검증 쿼리:**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'inventory_transactions'
  AND column_name = 'arrival_date';
```

**예상 결과:**

```
column_name  | data_type | is_nullable
-------------|-----------|------------
arrival_date | date      | YES
```

#### 3. 도착 예정일 저장 테스트

**API 테스트:**

```bash
curl -X POST http://localhost:5000/api/inventory/receiving \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "transaction_date": "2025-10-29",
    "arrival_date": "2025-11-05",
    "item_id": 1,
    "quantity": 10,
    "unit_price": 5000,
    "company_id": 1,
    "reference_no": "RCV-202510291430",
    "notes": "도착 예정일 테스트"
  }'
```

**예상 응답:**

```json
{
  "success": true,
  "message": "입고가 성공적으로 등록되었습니다.",
  "data": {
    "transaction_id": 125,
    "transaction_date": "2025-10-29",
    "arrival_date": "2025-11-05",
    "reference_number": "RCV-202510291430"
  }
}
```

#### 4. 조회 API 검증

```bash
curl -s "http://localhost:5000/api/inventory/receiving?limit=5"
```

**확인 사항:**

- [ ] `arrival_date` 필드가 응답에 포함
- [ ] 값이 올바른 날짜 형식 (YYYY-MM-DD 또는 null)

---

## 🔍 일관성 검증 테스트

### 입고 vs 출고 비교 테스트

**동일한 테스트 시나리오를 양쪽에서 수행:**

#### 시나리오: 거래 등록 → 조회 → 수정

| 단계 | 입고 관리 | 출고 관리 | 일관성 확인 |
|------|----------|----------|------------|
| 1. 날짜 레이블 | "입고 예정일" | "출고 예정일" | ✅ 일관성 |
| 2. 참조번호 생성 | RCV-YYYYMMDDHHMM | SHP-YYYYMMDDHHMM | ✅ 패턴 일관성 |
| 3. 배송/도착일 | "도착 예정일" | "배송 예정일" | ✅ 용어 일관성 |
| 4. 단가 처리 | 자동 조회 또는 수동 | 자동 조회 (월별 단가 마스터) | ⚠️ 개선 검토 |
| 5. 폼 레이아웃 | 2열 그리드 | 2열 그리드 | ✅ 일관성 |
| 6. 에러 메시지 | 한글 메시지 | 한글 메시지 | ✅ 일관성 |

---

## 🚨 예상되는 문제 및 해결책

### 문제 1: 한글 깨짐

**원인**: API에서 `request.json()` 사용 시 UTF-8 인코딩 문제

**현재 상태** (`src/app/api/inventory/receiving/route.ts:83`):

```typescript
const body = await request.json(); // ❌ 한글 깨짐 가능성
```

**해결책**:

```typescript
const text = await request.text();
const body = JSON.parse(text); // ✅ 한글 정상 처리
```

### 문제 2: 도착 예정일 필드가 보이지 않음

**원인**: 브라우저 캐시 또는 마이그레이션 미적용

**해결책**:

```bash
# 1. 마이그레이션 확인
npm run migrate:up

# 2. 타입 재생성
npm run db:types

# 3. 개발 서버 재시작
npm run restart

# 4. 브라우저 강력 새로고침
Ctrl + Shift + R
```

### 문제 3: 자동생성 번호 중복

**원인**: 같은 분(minute)에 여러 입고 등록 시 번호 중복

**해결책**:

- 초(seconds) 추가: `RCV-YYYYMMDDHHMMSS`
- 또는 데이터베이스에서 마지막 번호 조회 후 증가

### 문제 4: 날짜 검증 오류

**원인**: 도착 예정일이 입고 예정일보다 이전 날짜

**예상 에러 메시지**: "도착 예정일은 입고 예정일보다 뒤여야 합니다"

**해결책**: 올바른 날짜 선택

---

## ✅ 테스트 체크리스트

### 현재 상태 (개선 전)

#### UI 테스트

- [ ] "거래일자" 레이블 표시
- [ ] 공급업체 드롭다운 동작
- [ ] 품목 검색 기능
- [ ] 수량, 단가 입력
- [ ] 참조번호 수동 입력
- [ ] LOT 번호, 만료일 입력
- [ ] 입고 위치 입력
- [ ] 폼 제출 정상 동작
- [ ] 성공 메시지 표시
- [ ] 테이블에 레코드 표시

#### 데이터 검증

- [ ] transaction_date 저장 확인
- [ ] item_id, quantity, unit_price 저장
- [ ] company_id 저장 (선택 시)
- [ ] reference_no 저장 (입력 시)
- [ ] total_amount 자동 계산

#### API 테스트

- [ ] POST /api/inventory/receiving 정상 응답
- [ ] GET /api/inventory/receiving 정상 조회
- [ ] 한글 데이터 정상 처리 (깨짐 없음)

### 개선 후 (Phase 1)

#### UI 일관성

- [ ] "입고 예정일" 레이블 변경 확인
- [ ] "입고번호" 레이블 변경 확인
- [ ] 자동생성 버튼 표시
- [ ] 자동생성 번호 형식 확인 (RCV-YYYYMMDDHHMM)
- [ ] 수동 입력도 가능

#### 기능 검증

- [ ] 자동생성 번호로 등록
- [ ] API 응답에 reference_number 포함
- [ ] 중복 번호 처리 확인

### 개선 후 (Phase 2)

#### 도착 예정일 기능

- [ ] "도착 예정일" 필드 표시
- [ ] 날짜 선택 캘린더 동작
- [ ] 날짜 검증 (입고일 이후만 허용)
- [ ] 선택사항으로 비워두고 제출 가능
- [ ] arrival_date 데이터베이스 저장
- [ ] API 응답에 arrival_date 포함

#### 일관성 검증

- [ ] 입고/출고 폼 레이블 일관성
- [ ] 참조번호 생성 패턴 일관성
- [ ] 배송/도착 예정일 용어 일관성

---

## 📊 테스트 완료 기준

### Phase 1 (UI 일관성)

- ✅ "입고 예정일" 레이블 변경
- ✅ 입고번호 자동생성 기능 동작
- ✅ 자동생성 번호로 정상 등록
- ✅ API 응답 검증

### Phase 2 (도착 예정일)

- ✅ 도착 예정일 필드 표시
- ✅ 날짜 검증 정상 동작
- ✅ 데이터베이스 저장 확인
- ✅ API 조회 시 arrival_date 포함

### 전체 일관성

- ✅ 입고/출고 폼 UI 일관성 유지
- ✅ 모든 한글 데이터 정상 처리
- ✅ 에러 메시지 일관성

---

## 📚 참고 파일

### 현재 구현 파일

1. **프론트엔드 컴포넌트**
   - `src/components/ReceivingForm.tsx`
   - `src/app/inventory/page.tsx`

2. **API 라우트**
   - `src/app/api/inventory/receiving/route.ts`

3. **타입 정의**
   - `src/types/inventory.ts`

### 개선사항 문서

- `RECEIVING_IMPROVEMENTS.md` - 상세 개선 계획
- `SHIPPING_TEST_GUIDE.md` - 출고 테스트 참고용

### 출고 폼 참고 파일 (개선 패턴)

- `src/components/ShippingForm.tsx:311-386` (레이블, 자동생성, 배송일)
- `src/app/api/inventory/shipping/route.ts:62-75` (API 처리)

---

## 🔗 관련 문서

- [RECEIVING_IMPROVEMENTS.md](./RECEIVING_IMPROVEMENTS.md) - 입고 등록 개선 계획
- [SHIPPING_TEST_GUIDE.md](./SHIPPING_TEST_GUIDE.md) - 출고 등록 테스트 가이드
- [CLAUDE.md](./CLAUDE.md) - 프로젝트 전체 가이드

---

**작성일**: 2025-10-29
**버전**: 1.0
**테스트 대상**: 입고 등록 페이지

- 현재 상태 검증
- 출고와 일관성 비교
- 개선사항 적용 후 검증
