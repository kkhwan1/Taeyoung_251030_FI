---
name: erp-phase-tester
description: Automated testing expert for ERP phases. Specializes in Jest API tests, Playwright E2E tests, and Korean data validation. Use this skill when creating test suites for new phases or validating implementations.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Bash
metadata:
  project: TaeYoungERP
  frameworks: "Jest@30.2.0, Playwright@1.x"
  test-coverage: "Unit + Integration + E2E"
  version: "1.0.0"
---

# ERP Phase Tester Expert

**태창 ERP 시스템**의 Phase별 테스트 자동화 전문 스킬입니다. Jest API 테스트와 Playwright E2E 테스트를 생성하고 한글 데이터 검증을 수행합니다.

## 🎯 테스트 전략

### Phase별 테스트 커버리지

| Phase | API Tests | E2E Tests | 커버리지 | 상태 |
|-------|-----------|-----------|----------|------|
| Phase 1 | ✅ 100% | ✅ 95% | 97% | ✅ Complete |
| Phase 2 | ✅ 100% | ✅ 90% | 95% | ✅ Complete |
| Phase P3 | ✅ 95% | ✅ 85% | 92% | ✅ Complete |
| Phase P4 | ✅ 100% | ✅ 90% | 96% | ✅ Complete |
| Phase P5 | ⏳ 진행중 | ⏳ 진행중 | 80% | 🔄 In Progress |

## Jest API 테스트 패턴

### 1. 기본 API 테스트 템플릿

```typescript
// src/__tests__/api/[feature].test.ts
import { createMocks } from 'node-mocks-http';
import { GET, POST, PUT, DELETE } from '@/app/api/[feature]/route';

describe('[Feature] API', () => {
  describe('GET /api/[feature]', () => {
    it('should return all items with Korean text', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      });

      const response = await GET(req);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);

      // 한글 데이터 검증
      if (data.data.length > 0) {
        expect(data.data[0].item_name).toBeTruthy();
        expect(data.data[0].item_name).not.toContain('�'); // 깨진 문자 없음
      }
    });

    it('should handle filtering', async () => {
      const { req } = createMocks({
        method: 'GET',
        query: {
          is_active: 'true',
          category: 'Parts'
        }
      });

      const response = await GET(req);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.every((item: any) => item.is_active === true)).toBe(true);
    });

    it('should handle pagination', async () => {
      const { req } = createMocks({
        method: 'GET',
        query: {
          page: '1',
          limit: '10'
        }
      });

      const response = await GET(req);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
    });
  });

  describe('POST /api/[feature]', () => {
    it('should create item with Korean text', async () => {
      const { req } = createMocks({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item_name: '테스트 부품',
          item_code: 'TEST001',
          spec: '사양-001',
          unit_price: 10000,
          is_active: true
        })
      });

      const response = await POST(req);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.item_name).toBe('테스트 부품');
      expect(data.data.spec).toBe('사양-001');
    });

    it('should validate required fields', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: JSON.stringify({
          // item_name 누락
          item_code: 'TEST001'
        })
      });

      const response = await POST(req);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should prevent duplicate codes', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: JSON.stringify({
          item_name: '중복 테스트',
          item_code: 'EXISTING001', // 이미 존재하는 코드
          is_active: true
        })
      });

      const response = await POST(req);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('중복');
    });
  });

  describe('PUT /api/[feature]/[id]', () => {
    it('should update item with Korean text', async () => {
      const itemId = 'existing-item-id';

      const { req } = createMocks({
        method: 'PUT',
        body: JSON.stringify({
          item_name: '수정된 부품명',
          spec: '업데이트된 사양',
          unit_price: 15000
        })
      });

      const response = await PUT(req, { params: { id: itemId } });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.item_name).toBe('수정된 부품명');
      expect(data.data.spec).toBe('업데이트된 사양');
    });

    it('should return 404 for non-existent item', async () => {
      const { req } = createMocks({
        method: 'PUT',
        body: JSON.stringify({
          item_name: '수정 시도'
        })
      });

      const response = await PUT(req, { params: { id: 'non-existent-id' } });
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/[feature]/[id]', () => {
    it('should soft delete item (is_active = false)', async () => {
      const itemId = 'existing-item-id';

      const { req } = createMocks({
        method: 'DELETE'
      });

      const response = await DELETE(req, { params: { id: itemId } });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.is_active).toBe(false);
    });
  });
});
```

### 2. 한글 인코딩 검증 테스트

```typescript
describe('Korean Encoding Validation', () => {
  it('should handle Korean text in POST without corruption', async () => {
    const koreanText = '한글 품목명 테스트 特殊文字 ① ② ③';

    const { req } = createMocks({
      method: 'POST',
      body: JSON.stringify({
        item_name: koreanText,
        spec: '사양-001'
      })
    });

    const response = await POST(req);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.item_name).toBe(koreanText);
    expect(data.data.item_name).not.toContain('�');
    expect(data.data.item_name).not.toContain('ë');
  });

  it('should preserve Korean text in PUT updates', async () => {
    const koreanText = '수정된 한글 부품명';

    const { req } = createMocks({
      method: 'PUT',
      body: JSON.stringify({
        item_name: koreanText
      })
    });

    const response = await PUT(req, { params: { id: 'test-id' } });
    const data = await response.json();

    expect(data.data.item_name).toBe(koreanText);
  });
});
```

### 3. 통계/집계 테스트

```typescript
describe('Statistics and Aggregation', () => {
  it('should calculate total amounts correctly', async () => {
    const { req } = createMocks({
      method: 'GET'
    });

    const response = await GET(req);
    const data = await response.json();

    const totalAmount = data.data.reduce(
      (sum: number, item: any) => sum + item.total_amount,
      0
    );

    expect(totalAmount).toBeGreaterThan(0);
    expect(Number.isFinite(totalAmount)).toBe(true);
  });

  it('should group by category correctly', async () => {
    const { req } = createMocks({
      method: 'GET',
      query: { group_by: 'category' }
    });

    const response = await GET(req);
    const data = await response.json();

    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);

    // 카테고리별 그룹화 검증
    const categories = new Set(data.data.map((item: any) => item.category));
    expect(categories.size).toBeGreaterThan(0);
  });
});
```

### 4. 관계형 데이터 테스트 (JOIN)

```typescript
describe('Relational Data (JOIN)', () => {
  it('should include related company data', async () => {
    const { req } = createMocks({
      method: 'GET'
    });

    const response = await GET(req);
    const data = await response.json();

    expect(data.success).toBe(true);

    if (data.data.length > 0) {
      const firstItem = data.data[0];

      // JOIN된 데이터 검증
      if (firstItem.supplier_id) {
        expect(firstItem.supplier).toBeDefined();
        expect(firstItem.supplier.company_name).toBeTruthy();
      }
    }
  });
});
```

## Playwright E2E 테스트 패턴

### 1. 기본 E2E 테스트 템플릿

```typescript
// tests/e2e/[feature].spec.ts
import { test, expect } from '@playwright/test';

test.describe('[Feature] E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 페이지 이동
    await page.goto('http://localhost:5000/[feature-page]');

    // 로딩 대기
    await page.waitForLoadState('networkidle');
  });

  test('should display page with Korean text', async ({ page }) => {
    // 페이지 제목 확인
    await expect(page.locator('h1')).toContainText('[Feature Name]');

    // 한글 텍스트 표시 확인
    const koreanText = page.locator('text=품목 관리');
    await expect(koreanText).toBeVisible();
  });

  test('should load data table', async ({ page }) => {
    // 테이블 로드 대기
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // 헤더 확인
    await expect(table.locator('th')).toContainText('품목명');

    // 데이터 행 확인
    const rows = table.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should search with Korean keyword', async ({ page }) => {
    // 검색 입력
    const searchInput = page.locator('input[placeholder*="검색"]');
    await searchInput.fill('부품');

    // 검색 버튼 클릭
    await page.click('button:has-text("검색")');

    // 결과 확인
    await page.waitForLoadState('networkidle');
    const results = page.locator('tbody tr');
    const count = await results.count();

    // 최소 1개 이상의 결과
    expect(count).toBeGreaterThan(0);

    // 검색어 포함 확인
    const firstRow = results.first();
    const text = await firstRow.textContent();
    expect(text).toContain('부품');
  });

  test('should create new item with Korean text', async ({ page }) => {
    // 생성 버튼 클릭
    await page.click('button:has-text("추가")');

    // 모달 대기
    await expect(page.locator('dialog')).toBeVisible();

    // 폼 입력
    await page.fill('input[name="item_name"]', '새로운 부품');
    await page.fill('input[name="item_code"]', 'NEW001');
    await page.fill('input[name="spec"]', '사양-001');
    await page.fill('input[name="unit_price"]', '10000');

    // 저장 버튼 클릭
    await page.click('button:has-text("저장")');

    // 성공 메시지 확인
    await expect(page.locator('text=생성되었습니다')).toBeVisible();

    // 테이블에 새 항목 표시 확인
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=새로운 부품')).toBeVisible();
  });

  test('should edit item with Korean text', async ({ page }) => {
    // 첫 번째 행의 수정 버튼 클릭
    await page.locator('tbody tr').first().locator('button:has-text("수정")').click();

    // 모달 대기
    await expect(page.locator('dialog')).toBeVisible();

    // 기존 값 확인
    const nameInput = page.locator('input[name="item_name"]');
    const currentValue = await nameInput.inputValue();
    expect(currentValue).toBeTruthy();

    // 값 수정
    await nameInput.fill('수정된 부품명');

    // 저장
    await page.click('button:has-text("저장")');

    // 성공 메시지
    await expect(page.locator('text=수정되었습니다')).toBeVisible();

    // 변경된 값 확인
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=수정된 부품명')).toBeVisible();
  });

  test('should delete item (soft delete)', async ({ page }) => {
    // 첫 번째 행의 삭제 버튼 클릭
    await page.locator('tbody tr').first().locator('button:has-text("삭제")').click();

    // 확인 다이얼로그
    await expect(page.locator('text=삭제하시겠습니까')).toBeVisible();
    await page.click('button:has-text("확인")');

    // 성공 메시지
    await expect(page.locator('text=삭제되었습니다')).toBeVisible();

    // 테이블에서 제거됨 확인 (소프트 삭제)
    await page.waitForLoadState('networkidle');
  });

  test('should filter by category', async ({ page }) => {
    // 필터 선택
    await page.selectOption('select[name="category"]', 'Parts');

    // 필터 적용 버튼 클릭
    await page.click('button:has-text("필터")');

    // 결과 확인
    await page.waitForLoadState('networkidle');
    const rows = page.locator('tbody tr');
    const count = await rows.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should handle pagination', async ({ page }) => {
    // 페이지네이션 버튼 확인
    const nextButton = page.locator('button:has-text("다음")');
    const isDisabled = await nextButton.isDisabled();

    if (!isDisabled) {
      // 다음 페이지로 이동
      await nextButton.click();
      await page.waitForLoadState('networkidle');

      // URL 변경 확인
      const url = page.url();
      expect(url).toContain('page=2');

      // 이전 버튼 활성화 확인
      const prevButton = page.locator('button:has-text("이전")');
      await expect(prevButton).toBeEnabled();
    }
  });
});
```

### 2. 대시보드 E2E 테스트

```typescript
// tests/e2e/dashboard.spec.ts
test.describe('Dashboard E2E', () => {
  test('should display widgets with Korean labels', async ({ page }) => {
    await page.goto('http://localhost:5000/dashboard');

    // 위젯 카드 확인
    await expect(page.locator('text=총 재고 금액')).toBeVisible();
    await expect(page.locator('text=저재고 알림')).toBeVisible();
    await expect(page.locator('text=최근 거래')).toBeVisible();
  });

  test('should load charts', async ({ page }) => {
    await page.goto('http://localhost:5000/dashboard');

    // 차트 로드 대기
    await page.waitForSelector('canvas', { timeout: 10000 });

    // 차트 개수 확인
    const charts = await page.locator('canvas').count();
    expect(charts).toBeGreaterThan(0);
  });

  test('should auto-refresh data', async ({ page }) => {
    await page.goto('http://localhost:5000/dashboard');

    // 초기 데이터 가져오기
    const initialText = await page.locator('text=총 재고 금액').textContent();

    // 새로고침 버튼 클릭
    await page.click('button:has-text("새로고침")');

    // 로딩 표시 확인
    await expect(page.locator('text=로딩 중...')).toBeVisible();

    // 데이터 업데이트 대기
    await page.waitForLoadState('networkidle');

    // 새 데이터 확인
    const updatedText = await page.locator('text=총 재고 금액').textContent();
    expect(updatedText).toBeTruthy();
  });
});
```

### 3. Excel 내보내기 E2E 테스트

```typescript
test.describe('Excel Export E2E', () => {
  test('should download Excel file with Korean filename', async ({ page }) => {
    await page.goto('http://localhost:5000/sales-transactions');

    // 다운로드 시작
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Excel 내보내기")')
    ]);

    // 파일명 확인
    const filename = download.suggestedFilename();
    expect(filename).toContain('.xlsx');
    expect(filename).toMatch(/매출|거래/); // 한글 파일명

    // 파일 저장
    const path = await download.path();
    expect(path).toBeTruthy();
  });
});
```

## 테스트 실행 명령어

### Jest 테스트

```bash
# 전체 테스트
npm run test

# Watch 모드
npm run test:watch

# 커버리지 리포트
npm run test:coverage

# API 테스트만
npm run test:api

# 특정 파일
npm run test -- src/__tests__/api/items.test.ts
```

### Playwright 테스트

```bash
# 전체 E2E 테스트
npm run test:e2e

# UI 모드 (개발 중)
npm run test:e2e:ui

# 디버그 모드
npm run test:e2e:debug

# 헤드 모드 (브라우저 표시)
npm run test:e2e:headed

# 특정 테스트
npx playwright test tests/e2e/items.spec.ts
```

## 테스트 데이터 준비

### 1. 테스트 Fixture 생성

```typescript
// tests/fixtures/items.ts
export const testItems = [
  {
    item_name: '테스트 부품 A',
    item_code: 'TEST-001',
    spec: 'SPEC-001',
    unit_price: 10000,
    current_stock: 100,
    is_active: true
  },
  {
    item_name: '테스트 부품 B',
    item_code: 'TEST-002',
    spec: 'SPEC-002',
    unit_price: 15000,
    current_stock: 50,
    is_active: true
  }
];

export const testCompanies = [
  {
    company_name: '테스트 고객사 A',
    company_code: 'CUS-001',
    company_type: '고객사',
    business_number: '123-45-67890',
    is_active: true
  }
];
```

### 2. Setup/Teardown

```typescript
describe('Items API', () => {
  let testItemIds: string[] = [];

  beforeAll(async () => {
    // 테스트 데이터 생성
    for (const item of testItems) {
      const { req } = createMocks({
        method: 'POST',
        body: JSON.stringify(item)
      });

      const response = await POST(req);
      const data = await response.json();
      testItemIds.push(data.data.item_id);
    }
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    for (const id of testItemIds) {
      const { req } = createMocks({ method: 'DELETE' });
      await DELETE(req, { params: { id } });
    }
  });

  // 테스트 케이스들...
});
```

## 커버리지 목표

### Phase별 커버리지 기준

| 테스트 타입 | 목표 | 최소 |
|------------|------|------|
| API Unit Tests | 95% | 80% |
| Integration Tests | 90% | 70% |
| E2E Tests | 85% | 60% |
| 전체 Coverage | 93% | 75% |

### 커버리지 리포트 확인

```bash
# 커버리지 생성
npm run test:coverage

# 리포트 보기 (브라우저)
open coverage/lcov-report/index.html
```

## CI/CD 통합

### GitHub Actions 예시

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run Jest tests
        run: npm run test:coverage

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      - name: Run Playwright tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## 체크리스트

### 새 Phase 테스트 생성 시

- [ ] API 테스트 파일 생성 (`src/__tests__/api/[feature].test.ts`)
- [ ] E2E 테스트 파일 생성 (`tests/e2e/[feature].spec.ts`)
- [ ] 한글 인코딩 검증 테스트 추가
- [ ] CRUD 전체 작업 테스트
- [ ] 에러 케이스 테스트
- [ ] 테스트 Fixture 준비
- [ ] Setup/Teardown 구현
- [ ] 커버리지 95% 이상 달성
- [ ] CI/CD 통합 확인
- [ ] 문서화 업데이트

### 테스트 작성 품질 기준

- [ ] 명확한 테스트 이름 (should...)
- [ ] AAA 패턴 (Arrange-Act-Assert)
- [ ] 단일 책임 (테스트당 하나의 검증)
- [ ] 독립적인 테스트 (순서 무관)
- [ ] 빠른 실행 (<5초)
- [ ] 재현 가능 (매번 동일한 결과)
- [ ] 의미 있는 에러 메시지

## 관련 문서

- [Jest 공식 문서](https://jestjs.io/)
- [Playwright 공식 문서](https://playwright.dev/)
- [CLAUDE.md](../../../CLAUDE.md) - 프로젝트 전체 가이드
- [playwright.config.ts](../../../playwright.config.ts) - Playwright 설정

---

**Last Updated**: 2025-10-19
**Frameworks**: Jest@30.2.0, Playwright@1.x
**프로젝트**: 태창 ERP 시스템
