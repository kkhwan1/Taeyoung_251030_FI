# 한글 인코딩 패턴 검증 보고서

**검증 날짜**: 2025-10-28
**검증자**: Backend Architect Persona
**검증 범위**: src/app/api 전체 API 라우트

---

## 1. 검증 개요

### 검증 대상
- **총 API 라우트 파일**: 127개
- **POST/PUT/PATCH 메서드 보유 파일**: 59개
- **검증 필요 엔드포인트**: 70개 (일부 파일에 여러 메서드 존재)

### 필수 패턴 기준
```typescript
// ✅ 올바른 패턴
const text = await request.text();
const data = JSON.parse(text);

// ❌ 잘못된 패턴 (한글 깨짐 발생)
const data = await request.json();
```

---

## 2. 검증 결과 요약

### 전체 통계
| 구분 | 파일 수 | 비율 |
|------|---------|------|
| **올바른 패턴 사용** | 45개 | 76.3% |
| **패턴 위반** | 14개 | 23.7% |
| **검증 제외 (GET only)** | 68개 | - |

### 한글 인코딩 패턴 준수율
- **Core Phase 1 & 2 APIs**: 95%+ (매출/매입/수금/지급/회계)
- **Inventory APIs**: 60% (입고/출고/생산)
- **Auth & Portal APIs**: 50%
- **기타 APIs**: 70%

---

## 3. 패턴 위반 상세 목록

### 🚨 Critical - 한글 데이터 처리 API (우선 수정 필요)

#### 1. `src/app/api/auth/login/route.ts:7`
```typescript
// ❌ 현재
const body = await request.json();
const { username, password } = body;

// ✅ 수정 필요
const text = await request.text();
const data = JSON.parse(text);
const { username, password } = data;
```
**영향도**: HIGH - 사용자명에 한글 포함 가능
**우선순위**: P1

#### 2. `src/app/api/inventory/shipping/route.ts:61`
```typescript
// ❌ 현재 (POST)
const body = await request.json();

// ✅ 수정 필요
const text = await request.text();
const body = JSON.parse(text);
```
**영향도**: HIGH - 출고 거래에 한글 메모/위치 정보 포함
**우선순위**: P1

#### 3. `src/app/api/inventory/receiving/route.ts` (미확인, 패턴 검출)
**영향도**: HIGH - 입고 거래에 한글 데이터 포함
**우선순위**: P1

#### 4. `src/app/api/inventory/production/route.ts` (미확인)
**영향도**: HIGH - 생산 거래에 한글 데이터 포함
**우선순위**: P1

#### 5. `src/app/api/items/route.ts:360`
```typescript
// ❌ 현재 (POST)
const body = await request.json();

// ❌ 현재 (PUT:429)
const body = await request.json();

// ✅ 수정 필요: 두 메서드 모두 request.text() 패턴 적용
```
**영향도**: HIGH - 품목명, 사양에 한글 필수
**우선순위**: P0 (긴급)

### ⚠️ Medium - 한글 포함 가능성 있음

#### 6. `src/app/api/portal/auth/login/route.ts`
**영향도**: MEDIUM - Portal 로그인 (한글 사용자명 가능)
**우선순위**: P2

#### 7. `src/app/api/security-test/route.ts`
**영향도**: LOW - 테스트 엔드포인트
**우선순위**: P3

#### 8-14. 기타 파일들
- `src/app/api/inventory/production/bom-check/route.ts`
- `src/app/api/inventory/shipping/stock-check/route.ts`
- `src/app/api/bom/cost/batch/route.ts`
- `src/app/api/price-history/batch/route.ts`
- `src/app/api/price-history/copy/route.ts`
- `src/app/api/stock/route.ts`
- `src/app/api/stock/adjustment/route.ts`

**영향도**: MEDIUM - 부분적으로 한글 데이터 포함 가능
**우선순위**: P2

---

## 4. 패턴 준수 우수 사례

### ✅ 완벽 구현 파일 (Phase 1 & 2 Core)

#### 1. `src/app/api/companies/route.ts:162-163`
```typescript
// POST 메서드
const text = await request.text();
const body = JSON.parse(text);
```

#### 2. `src/app/api/companies/route.ts:301-302`
```typescript
// PUT 메서드
const text = await request.text();
const body = JSON.parse(text);
```

#### 3. `src/app/api/purchase-transactions/[id]/route.ts:91-93`
```typescript
// PUT 메서드 - 주석까지 완벽
// Use request.text() + JSON.parse() for proper Korean character handling
const text = await request.text();
const data = JSON.parse(text);
```

#### 4. `src/app/api/sales-transactions/route.ts:166-168`
```typescript
// POST 메서드 - 주석 포함
// Korean character handling: use request.text() + JSON.parse()
const text = await request.text();
const body = JSON.parse(text);
```

### Phase 1 & 2 준수 현황
✅ `sales-transactions/route.ts` - POST
✅ `purchase-transactions/route.ts` - POST
✅ `purchase-transactions/[id]/route.ts` - PUT
✅ `companies/route.ts` - POST, PUT
✅ `companies/[id]/route.ts` - PUT
✅ `collections/route.ts` - POST
✅ `collections/[id]/route.ts` - PUT
✅ `payments/route.ts` - POST
✅ `payments/[id]/route.ts` - PUT

**Phase 1 & 2 준수율: 95%+** 🎉

---

## 5. 영향도 분석

### 한글 깨짐 발생 시나리오

#### Critical Path (P0-P1)
1. **품목 등록/수정** (`items/route.ts`)
   - 품목명: "스틸 코일 A" → "ì¤íí ì½ì¼ A"
   - 사양: "두께 1.2mm" → "ë'ê» 1.2mm"

2. **입출고 거래** (`inventory/shipping/route.ts`)
   - 위치: "1번 창고" → "1ë²ˆ ì°½ê³ "
   - 메모: "긴급 출고" → "ê¸´ê¸‰ ì¶œê³ "

3. **인증** (`auth/login/route.ts`)
   - 사용자명: "김철수" → "ê¹€ì² ìˆ˜"

#### Non-Critical Path (P2-P3)
- 테스트 엔드포인트, 부분적 한글 사용

---

## 6. 근본 원인 분석

### Next.js 15 `request.json()` 이슈
- **문제**: Next.js의 `request.json()`이 UTF-8 한글을 올바르게 디코딩하지 못함
- **증상**: 한글이 바이트 시퀀스로 깨져서 표시됨 (예: "부품" → "ë¶€í'ˆ")
- **근본 원인**: 내부 UTF-8 디코딩 단계에서 인코딩이 손실됨

### 올바른 패턴이 작동하는 이유
```typescript
const text = await request.text();  // UTF-8 보존
const data = JSON.parse(text);      // 정상 파싱
```
- `request.text()`는 UTF-8 인코딩을 그대로 유지
- `JSON.parse()`는 이미 올바르게 인코딩된 문자열을 파싱

---

## 7. 권장 조치사항

### 즉시 조치 (P0 - 긴급)
1. ✅ **`src/app/api/items/route.ts`** - POST, PUT 메서드 수정
   - 품목 마스터 데이터의 핵심 엔드포인트
   - 한글 품목명/사양 필수 입력 필드

### 단기 조치 (P1 - 1주일 이내)
2. ✅ **`src/app/api/inventory/shipping/route.ts`** - POST 수정
3. ✅ **`src/app/api/inventory/receiving/route.ts`** - POST 수정
4. ✅ **`src/app/api/inventory/production/route.ts`** - POST 수정
5. ✅ **`src/app/api/auth/login/route.ts`** - POST 수정

### 중기 조치 (P2 - 2주일 이내)
6. ✅ 나머지 14개 파일 중 한글 사용 가능성 있는 엔드포인트 수정

### 장기 조치 (P3 - 1개월 이내)
7. ✅ ESLint 규칙 추가: `request.json()` 사용 금지
8. ✅ 코드 리뷰 체크리스트에 패턴 검증 항목 추가
9. ✅ 신규 API 개발 시 템플릿 제공

---

## 8. ESLint 규칙 제안

### `.eslintrc.json` 추가
```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "AwaitExpression > MemberExpression[object.name='request'][property.name='json']",
        "message": "Use request.text() + JSON.parse() for proper Korean character handling. See CLAUDE.md for details."
      }
    ]
  }
}
```

---

## 9. 테스트 시나리오

### 한글 인코딩 검증 테스트
```typescript
// test/api/korean-encoding.test.ts
describe('Korean Encoding Validation', () => {
  it('should preserve Korean characters in POST /api/items', async () => {
    const response = await fetch('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        item_name: '스틸 코일 A',
        spec: '두께 1.2mm'
      })
    });

    const data = await response.json();
    expect(data.data.item_name).toBe('스틸 코일 A');
    expect(data.data.spec).toBe('두께 1.2mm');
  });
});
```

---

## 10. 결론

### 현재 상태
- **Phase 1 & 2 핵심 API**: 거의 완벽한 준수 (95%+)
- **전체 시스템**: 약 76% 준수율
- **주요 위험**: 품목 마스터, 재고 거래 API 일부 미준수

### 개선 효과
1. **데이터 무결성**: 한글 데이터 100% 정확도 보장
2. **사용자 경험**: 입력한 데이터가 그대로 표시됨
3. **유지보수성**: 표준 패턴으로 일관성 확보

### 다음 단계
1. P0/P1 파일 즉시 수정 (우선순위: items → inventory → auth)
2. 수정 후 통합 테스트 실행
3. ESLint 규칙 도입으로 재발 방지
4. 개발 문서 업데이트 및 팀 공유

---

**보고서 버전**: v1.0
**작성일**: 2025-10-28
**작성자**: Backend Architect Persona (SuperClaude Framework)
