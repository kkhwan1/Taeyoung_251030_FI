# 태창 ERP 시스템 아키텍처 문서

**작성일**: 2025-01-27  
**버전**: 1.0  
**시스템**: 태창 ERP (FITaeYoungERP)

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [기술 스택](#2-기술-스택)
3. [인증 및 권한 시스템](#3-인증-및-권한-시스템)
4. [데이터베이스 스키마](#4-데이터베이스-스키마)
5. [핵심 비즈니스 로직](#5-핵심-비즈니스-로직)
6. [API 엔드포인트](#6-api-엔드포인트)
7. [프론트엔드 구조](#7-프론트엔드-구조)
8. [테스트 시나리오](#8-테스트-시나리오)

---

## 1. 시스템 개요

### 1.1 목적

태창 ERP는 제조업체의 재고/생산/회계 관리를 통합한 ERP 시스템입니다.

### 1.2 주요 기능

- 마스터 데이터: 품목, 거래처, BOM
- 재고: 입고/출고/생산, BOM 자동 차감
- 생산: 완제품 생산 시 원자재 자동 차감
- 회계: 매출/매입, 수금/지급
- 계약: 계약 정보 및 문서 관리
- 권한: 역할 기반 접근 제어

---

## 2. 기술 스택

| 계층 | 기술 | 버전 | 용도 |
|------|------|------|------|
| Frontend | Next.js | 15.5.4 | React 프레임워크 (App Router) |
| | React | 18.x | UI 컴포넌트 |
| | TypeScript | 5.x | 타입 안정성 |
| | Tailwind CSS | 3.x | 스타일링 |
| | Recharts | Latest | 차트 라이브러리 |
| Backend | Next.js API | 15.5.4 | RESTful API |
| | Supabase Client | Latest | DB 클라이언트 |
| | bcryptjs | Latest | 비밀번호 해싱 |
| Database | PostgreSQL | 15.x | 관계형 데이터베이스 |
| | Supabase | Cloud | 호스팅 |
| Storage | Supabase Storage | - | 파일 저장소 |

---

## 3. 인증 및 권한 시스템

### 3.1 인증 방식

**Cookie 기반 세션 관리**

```
로그인 요청 → bcrypt 검증 → JWT 토큰 생성 → 쿠키 설정 (auth_token, user_id)
```

**주요 파일**: `src/app/api/auth/login/route.ts`, `src/lib/auth.ts`

### 3.2 사용자 역할

```
Level 6: CEO         모든 권한
Level 5: Admin       전체 CRUD
Level 4: Manager     읽기/쓰기/수정/삭제
Level 3: User        읽기/쓰기/수정
Level 3: Accountant 회계 CRUD + 기타 읽기
Level 2: Operator    읽기/쓰기
Level 1: Viewer      읽기만
```

### 3.3 권한 검증

**API 레벨**: `checkAPIResourcePermission(request, 'items', 'read')`

**특수 처리**:
- `accountant`: 회계 리소스 CRUD 가능, 기타 읽기만
- `ceo`: 모든 리소스 전체 권한

---

## 4. 데이터베이스 스키마

### 4.1 핵심 테이블

#### users (사용자)
```
- user_id (PK)
- username (UNIQUE)
- password (bcrypt 해시)
- role (ceo, admin, manager, user, accountant, operator, viewer)
- is_active
```

#### items (품목)
```
- item_id (PK)
- item_code (UNIQUE) - 품번
- item_name - 품명
- category (원자재, 제품, 스크랩, 기타)
- current_stock - 현재 재고
- price - 단가
- supplier_id (FK → companies)
```

#### companies (거래처)
```
- company_id (PK)
- company_code (UNIQUE) - CUS001, SUP001
- company_name - 거래처명
- company_type (고객사, 공급사)
- business_number - 사업자번호
- representative - 대표자
```

#### bom (BOM 구성)
```
- bom_id (PK)
- parent_item_id (FK → items) - 완제품
- child_item_id (FK → items)  - 원자재
- quantity - BOM 수량
```

#### inventory_transactions (재고 거래)
```
- transaction_id (PK)
- transaction_date
- transaction_type (입고, 출고, 생산입고, 생산출고)
- item_id (FK → items)
- quantity
- unit_price
- reference_number
```

#### bom_deduction_log (BOM 차감 로그)
```
- log_id (PK)
- transaction_id (FK → inventory_transactions)
- parent_item_id (FK → items) - 완제품
- child_item_id (FK → items)  - 원자재
- required_quantity - 필요 수량
- actual_deducted - 실제 차감
- stock_before, stock_after
```

#### sales_transactions (매출)
```
- transaction_id (PK)
- transaction_no (UNIQUE) - S-20250127-0001
- transaction_date
- customer_id (FK → companies)
- item_id (FK → items)
- quantity, unit_price, total_amount
- payment_status (PENDING, PARTIAL, COMPLETED)
- payment_due_date
```

#### purchase_transactions (매입)
```
- transaction_id (PK)
- transaction_no (UNIQUE) - P-20250127-0001
- transaction_date
- supplier_id (FK → companies)
- item_id (FK → items)
- quantity, unit_price, total_amount
- payment_status
```

#### collections (수금)
```
- collection_id (PK)
- transaction_no - COLL-20250127-0001
- sales_transaction_id (FK → sales_transactions)
- collection_amount
- payment_method (계좌이체, 카드, 수표)
- bank_name, account_number
```

#### payments (지급)
```
- payment_id (PK)
- transaction_no
- purchase_transaction_id (FK → purchase_transactions)
- payment_amount
- payment_method
- bank_name, account_number
```

#### contracts (계약)
```
- contract_id (PK)
- company_id (FK → companies)
- contract_no (UNIQUE)
- contract_date, start_date, end_date
- total_amount
- status (DRAFT, ACTIVE, EXPIRED, TERMINATED)
```

#### contract_documents (계약 첨부파일)
```
- document_id (PK)
- contract_id (FK → contracts)
- document_url (Supabase Storage 경로)
- is_active (Soft delete)
```

### 4.2 데이터베이스 트리거

#### 1. BOM 자동 차감 트리거

**파일**: `supabase/migrations/20251027_bom_auto_deduction_trigger.sql`

```sql
CREATE TRIGGER process_production_bom_deduction_trigger
AFTER INSERT ON inventory_transactions
FOR EACH ROW
WHEN (NEW.transaction_type IN ('생산입고', '생산출고'))
EXECUTE FUNCTION process_production_bom_deduction();
```

**동작**:
1. 생산입고 거래 감지
2. BOM 조회 (완제품 → 원자재)
3. 필요 수량 계산 (BOM 수량 × 생산 수량)
4. 재고 충분성 검증
5. 부족 시 EXCEPTION → 롤백
6. 충분 시 원자재 생산출고 거래 생성
7. bom_deduction_log 기록

#### 2. 재고 자동 업데이트 트리거

```sql
CREATE TRIGGER update_stock_on_transaction
AFTER INSERT OR UPDATE OR DELETE ON inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION update_stock_on_transaction();
```

**동작**:
- 입고/생산입고: items.current_stock += quantity
- 출고/생산출고: items.current_stock -= quantity

---

## 5. 핵심 비즈니스 로직

### 5.1 BOM 자동 차감 시스템 (이중 검증)

#### Level 1: API 검증

**파일**: `src/app/api/inventory/production/route.ts`

```typescript
생산입고 POST 요청 시:
1. BOM 구성 조회 (완제품 → 원자재)
2. 필요 수량 계산 (BOM 수량 × 생산 수량)
3. 원자재 재고 충분성 검증
4. 재고 부족 시 400 에러 반환
5. 트랜잭션 시작
   → inventory_transactions INSERT (생산입고)
   → 각 원자재에 대해 별도 출고 트랜잭션 생성
   → items.current_stock 업데이트
6. 성공 시 커밋, 실패 시 롤백
```

#### Level 2: 데이터베이스 트리거

**동일한 검증을 DB 레벨에서 재수행**하여 이중으로 안전성 확보

**데이터 흐름**:
```
사용자 입력: 완제품 X 10개 생산
         ↓
API 검증: BOM 조회 → 원자재 A 20개, B 10개 필요
         ↓ (충분)
DB 트랜잭션 시작
         ↓
1. inventory_transactions INSERT (생산입고)
         ↓
2. 트리거 실행
         ↓
3. 원자재 A 생산출고 INSERT
   원자재 B 생산출고 INSERT
         ↓
4. bom_deduction_log INSERT
         ↓
5. update_stock_on_transaction 트리거
         ↓
6. items.current_stock 업데이트
   - 완제품 X: 0 → 10
   - 원자재 A: 100 → 80
   - 원자재 B: 50 → 40
         ↓
트랜잭션 커밋
```

### 5.2 재고 관리

**입고**: POST `/api/inventory/receiving` → items.current_stock += quantity

**출고**: POST `/api/inventory/shipping` → items.current_stock -= quantity

### 5.3 회계 관리

**매출/매입 거래번호 자동 생성**: S-YYYYMMDD-0001, P-YYYYMMDD-0001

**수금/지급**: 전액 수금/지급 버튼, 이전 정보 불러오기 기능

---

## 6. API 엔드포인트

### 6.1 인증 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 현재 사용자 조회 |

### 6.2 마스터 데이터 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/items` | 품목 목록 |
| POST | `/api/items` | 품목 등록 |
| PUT | `/api/items` | 품목 수정 |
| DELETE | `/api/items` | 품목 삭제 |

동일하게 `/api/companies`, `/api/bom` 제공

### 6.3 재고 관리 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/inventory/receiving` | 입고 이력 |
| POST | `/api/inventory/receiving` | 입고 등록 |
| GET | `/api/inventory/production` | 생산 이력 |
| POST | `/api/inventory/production` | 생산 등록 (BOM 차감) |
| GET | `/api/inventory/shipping` | 출고 이력 |
| POST | `/api/inventory/shipping` | 출고 등록 |

### 6.4 회계 관리 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/sales-transactions` | 매출 목록 |
| POST | `/api/sales-transactions` | 매출 등록 |
| GET | `/api/purchases` | 매입 목록 |
| POST | `/api/purchases` | 매입 등록 |
| GET | `/api/collections` | 수금 목록 |
| POST | `/api/collections` | 수금 등록 |
| GET | `/api/payments` | 지급 목록 |
| POST | `/api/payments` | 지급 등록 |

### 6.5 계약 관리 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/contracts` | 계약 목록 |
| POST | `/api/contracts` | 계약 등록 |
| PUT | `/api/contracts` | 계약 수정 |
| DELETE | `/api/contracts` | 계약 삭제 |
| POST | `/api/contracts/[id]/documents` | 첨부파일 업로드 |
| DELETE | `/api/contracts/[id]/documents` | 첨부파일 삭제 |

---

## 7. 프론트엔드 구조

### 7.1 페이지 구조

```
src/app/
├── page.tsx                  # 대시보드 (/)
├── login/                    # 로그인
├── master/
│   ├── items/               # 품목 관리
│   ├── companies/           # 거래처 관리
│   └── bom/                 # BOM 관리
├── inventory/               # 재고 거래
├── stock/                   # 재고 현황
├── sales/                   # 매출 관리
├── purchases/               # 매입 관리
├── collections/             # 수금 관리
├── payments/                # 지급 관리
├── accounting/summary/      # 회계 요약
└── contracts/               # 계약 관리
```

### 7.2 컴포넌트 구조

```
src/components/
├── layout/
│   ├── Header.tsx           # 상단 헤더
│   ├── Sidebar.tsx          # 사이드바 (메뉴, 권한별 필터링)
│   └── MainLayout.tsx       # 전체 레이아웃
├── charts/                  # 차트 컴포넌트
├── dashboard/               # 대시보드 컴포넌트
├── forms/                   # 폼 컴포넌트
└── tables/                  # 테이블 컴포넌트
```

### 7.3 권한별 UI 제어

**사이드바 메뉴 필터링**:
- `accountant`: 회계 관리만 수정 가능, 나머지 읽기만
- `viewer`: 모든 메뉴 읽기만

**버튼 동적 비활성화**:
- `checkResourcePermission()` 결과에 따라 등록/수정/삭제 버튼 비활성화

---

## 8. 테스트 시나리오

### 8.1 준비 사항

**테스트 계정**:
- admin / password123 (전체 권한)
- accountant / password123 (회계 전용)
- ceo / password123 (최고 권한)

### 8.2 테스트 흐름

#### 1단계: 마스터 데이터 등록
```
1. 품목 등록
   - 원자재 A: 재고 0
   - 원자재 B: 재고 0
   - 완제품 X: 재고 0

2. BOM 등록
   - 완제품 X = 원자재 A × 2 + 원자재 B × 1

3. 거래처 등록
   - 공급사 1 (입고용)
   - 고객사 1 (출고용)
```

#### 2단계: 입고 (재고 생성)
```
1. 원자재 A 입고 100개
   → API: POST /api/inventory/receiving
   → DB 확인: items.current_stock (A) = 100

2. 원자재 B 입고 50개
   → DB 확인: items.current_stock (B) = 50
```

#### 3단계: 생산 (BOM 자동 차감)
```
1. 완제품 X 10개 생산 등록
   → API: POST /api/inventory/production
   → 검증: 원자재 A 20개, B 10개 필요
   → 충분: A(100) ≥ 20, B(50) ≥ 10

2. DB 확인:
   - 완제품 X: current_stock = 10
   - 원자재 A: current_stock = 80 (100 - 20)
   - 원자재 B: current_stock = 40 (50 - 10)
   - bom_deduction_log: 2개 레코드

3. 트리거 확인:
   - inventory_transactions: 3개 레코드
     * 생산입고 1개 (완제품)
     * 생산출고 2개 (원자재 A, B)
```

#### 4단계: 재고 부족 테스트
```
1. 완제품 X 50개 생산 시도
   → 원자재 A 100개 필요 (현재 80개)
   → API 400 에러 또는 트리거 EXCEPTION
   → 트랜잭션 롤백

2. DB 확인:
   - 재고 변화 없음 (롤백됨)
```

#### 5단계: 회계 관리
```
1. 매출 등록
   - 고객사: 고객사 1
   - 품목: 완제품 X 5개
   - 단가: 10,000원

2. 수금 등록
   - 전액 수금
   - 결제방법: 계좌이체

3. DB 확인:
   - sales_transactions: payment_status = COMPLETED
   - collections: collection_amount = 50,000
```

#### 6단계: 권한 테스트
```
1. accountant 로그인
   - 품목 페이지: 수정 불가
   - 회계 페이지: 수정 가능

2. ceo 로그인
   - 모든 페이지: 접근 및 수정 가능
```

### 8.3 테스트 체크리스트

- [ ] BOM 자동 차감 (API + DB 이중 검증)
- [ ] 재고 실시간 업데이트
- [ ] 재고 부족 시 차단
- [ ] 권한별 UI 제어 (accountant 특수 처리)
- [ ] 계약 문서 업로드/삭제
- [ ] 트랜잭션 롤백

---

## 부록

### A. 환경 변수

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### B. 주요 상수

```typescript
// src/lib/constants/coatingStatus.ts
export const COATING_STATUS = {
  COATED: '도금',
  NOT_COATED: '무도금',
} as const;
```

### C. 데이터베이스 커넥션

```typescript
// src/lib/db-unified.ts
export function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

---

**문서 끝**
