---
name: erp-korean-encoding
description: Korean text encoding expert for Next.js 15 APIs. Prevents UTF-8 encoding issues with Korean characters in POST/PUT requests. Use this skill when creating or fixing API routes that handle Korean text data.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Bash
metadata:
  project: TaeYoungERP
  language: Korean
  framework: Next.js 15
  version: "1.0.0"
---

# ERP Korean Encoding Expert

**태창 ERP 시스템**의 한글 텍스트 인코딩 전문 스킬입니다. Next.js 15 API Routes에서 발생하는 UTF-8 한글 깨짐 문제를 방지하고 해결합니다.

## 핵심 원칙

### ⚠️ 절대 규칙

**✅ 항상 사용해야 하는 패턴** (POST/PUT API):
```typescript
export async function POST(request: Request) {
  // 1. 먼저 text()로 읽기
  const text = await request.text();

  // 2. JSON.parse()로 파싱
  const data = JSON.parse(text);

  // 이제 data에 한글이 정상적으로 들어있음
  console.log(data.item_name); // "부품A" ✅
}
```

**❌ 절대 사용하지 말아야 할 패턴**:
```typescript
export async function POST(request: Request) {
  // 이렇게 하면 한글이 깨집니다!
  const data = await request.json(); // ❌

  console.log(data.item_name); // "ë¶€í'ˆA" 깨짐!
}
```

### 이유

Next.js 15의 `request.json()`은 UTF-8 한글 문자를 올바르게 디코딩하지 못합니다.
`request.text()` + `JSON.parse()`를 사용하면 UTF-8 인코딩이 보존됩니다.

## 검증된 구현 패턴

### 1. 기본 POST API 패턴

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createValidatedRoute } from '@/lib/validationMiddleware';
import { getValidatedData, createSuccessResponse } from '@/lib/db-unified';
import { ItemCreateSchema } from '@/lib/validation';

export const POST = createValidatedRoute(
  async (request) => {
    // ✅ 검증된 데이터는 이미 올바르게 파싱됨
    const { body } = getValidatedData(request);

    // body.item_name에 한글이 정상적으로 들어있음
    console.log('품목명:', body.item_name);

    // 비즈니스 로직 실행
    const result = await db.items.create(body);

    return createSuccessResponse(result);
  },
  {
    bodySchema: ItemCreateSchema,
    resource: 'items',
    action: 'create',
    requireAuth: false
  }
);
```

### 2. 수동 파싱 패턴 (검증 미들웨어 미사용)

```typescript
export async function POST(request: Request) {
  try {
    // ✅ Step 1: text()로 읽기
    const text = await request.text();

    // ✅ Step 2: JSON.parse()로 파싱
    const data = JSON.parse(text);

    // ✅ Step 3: 한글 데이터 사용
    const { item_name, company_name, spec } = data;

    // 데이터베이스 작업
    const result = await supabase
      .from('items')
      .insert({ item_name, spec })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}
```

### 3. PUT/PATCH 업데이트 패턴

```typescript
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ 한글 인코딩 보존 패턴
    const text = await request.text();
    const data = JSON.parse(text);

    const { item_name, spec, notes } = data;

    const result = await supabase
      .from('items')
      .update({ item_name, spec, notes })
      .eq('item_id', params.id)
      .select()
      .single();

    if (result.error) {
      return NextResponse.json({
        success: false,
        error: result.error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    return handleSupabaseError('update', 'items', error);
  }
}
```

## 한글 인코딩 검증 체크리스트

### API Route 작성 시

- [ ] `request.text()` + `JSON.parse()` 패턴 사용
- [ ] `request.json()` 직접 사용하지 않음
- [ ] 한글 필드(item_name, company_name 등) 확인
- [ ] console.log로 한글 데이터 출력 테스트
- [ ] 실제 Supabase 저장 후 조회하여 검증

### 프론트엔드에서 호출 시

```typescript
// ✅ 올바른 fetch 호출
const response = await fetch('/api/items', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    item_name: '부품A',
    spec: 'SPEC-001',
    notes: '한글 설명'
  })
});
```

### 디버깅 패턴

```typescript
export async function POST(request: Request) {
  // 1. 원본 텍스트 확인
  const text = await request.text();
  console.log('Raw text:', text);

  // 2. 파싱된 데이터 확인
  const data = JSON.parse(text);
  console.log('Parsed data:', data);
  console.log('Item name:', data.item_name);

  // 3. 인코딩 확인
  const encoded = Buffer.from(data.item_name, 'utf-8');
  console.log('UTF-8 bytes:', encoded);

  // ... 나머지 로직
}
```

## 검증된 파일 목록

다음 파일들은 이미 올바른 한글 인코딩 패턴을 사용합니다:

```
src/app/api/
├── companies/route.ts ✅
├── items/route.ts ✅
├── bom/route.ts ✅
├── sales-transactions/route.ts ✅
├── purchases/route.ts ✅
├── collections/route.ts ✅
├── payments/route.ts ✅
└── purchase-transactions/[id]/route.ts:91-93 ✅
```

## 일반적인 실수와 해결책

### 실수 1: request.json() 직접 사용
```typescript
// ❌ 잘못된 패턴
const data = await request.json();
```

**해결책**:
```typescript
// ✅ 올바른 패턴
const text = await request.text();
const data = JSON.parse(text);
```

### 실수 2: 중간에 다른 처리
```typescript
// ❌ 잘못된 패턴
const text = await request.text();
const modified = text.replace(/\n/g, ''); // 불필요한 처리
const data = JSON.parse(modified);
```

**해결책**:
```typescript
// ✅ 올바른 패턴 - 직접 파싱
const text = await request.text();
const data = JSON.parse(text);
```

### 실수 3: 인코딩 재변환 시도
```typescript
// ❌ 잘못된 패턴
const text = await request.text();
const decoded = decodeURIComponent(text); // 불필요!
const data = JSON.parse(decoded);
```

**해결책**:
```typescript
// ✅ 올바른 패턴 - 추가 변환 불필요
const text = await request.text();
const data = JSON.parse(text);
```

## 테스트 방법

### 1. 수동 테스트

```bash
# 1. 개발 서버 시작
npm run dev

# 2. curl로 테스트 (Windows CMD)
curl -X POST http://localhost:5000/api/items ^
  -H "Content-Type: application/json" ^
  -d "{\"item_name\":\"부품A\",\"spec\":\"SPEC-001\"}"

# 3. 응답에서 한글 확인
# 정상: {"success":true,"data":{"item_name":"부품A"}}
# 깨짐: {"success":true,"data":{"item_name":"ë¶€í'ˆA"}}
```

### 2. Jest 테스트

```typescript
describe('Korean Encoding', () => {
  it('should handle Korean text correctly in POST', async () => {
    const response = await fetch('http://localhost:5000/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_name: '부품A',
        spec: 'SPEC-001'
      })
    });

    const result = await response.json();
    expect(result.data.item_name).toBe('부품A'); // ✅
    expect(result.data.item_name).not.toContain('ë'); // ✅
  });
});
```

## 프로젝트별 특수 사항

### 태창 ERP 시스템

- **주요 한글 필드**: `item_name`, `company_name`, `spec`, `notes`, `description`
- **검증 필수**: 모든 POST/PUT API Routes
- **자동 검증**: `createValidatedRoute` 미들웨어 사용 권장

### Phase별 적용 상태

- ✅ Phase 1: 매출/매입/수금/지급 (100% 적용)
- ✅ Phase 2: 회계 모듈 (100% 적용)
- ✅ Phase P3: 재고/BOM (100% 적용)
- ✅ Phase P4: 가격 관리 (100% 적용)

## 추가 참고사항

### Next.js 15 알려진 이슈

- `request.json()`의 UTF-8 디코딩 버그
- Edge Runtime vs Node.js Runtime 차이
- 해결 방법: `request.text()` + `JSON.parse()` 패턴 사용

### 관련 문서

- [CLAUDE.md](../../../CLAUDE.md) - 프로젝트 전체 가이드
- [src/lib/validationMiddleware.ts](../../../src/lib/validationMiddleware.ts) - 검증 미들웨어
- [src/lib/db-unified.ts](../../../src/lib/db-unified.ts) - 데이터베이스 헬퍼

---

**Last Updated**: 2025-10-19
**Tested On**: Next.js 15.5.4, React 19.1.0
**프로젝트**: 태창 ERP 시스템
