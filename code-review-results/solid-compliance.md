# 태창 ERP SOLID 원칙 준수도 분석 보고서

## 1. SOLID 원칙 종합 평가

### 전체 점수: 68/100

| 원칙 | 점수 | 등급 |
|------|------|------|
| **S**ingle Responsibility | 62/100 | C |
| **O**pen/Closed | 75/100 | B |
| **L**iskov Substitution | 85/100 | B+ |
| **I**nterface Segregation | 70/100 | B- |
| **D**ependency Inversion | 48/100 | D |

---

## 2. Single Responsibility Principle (SRP): 62/100

### 평가
시스템 전반적으로 단일 책임 원칙이 부분적으로만 준수됨. 특히 대형 파일들이 과도한 책임을 가지고 있음.

### 주요 위반 사례

#### 1. **db-unified.ts (792줄)**
```typescript
// 문제: 너무 많은 책임
// - Supabase 클라이언트 생성 (3가지 타입)
// - Query Builder 클래스
// - Domain Helpers (items, companies, transactions, bom)
// - 에러 처리
// - 응답 포맷팅
```
**위치**: src/lib/db-unified.ts:1-792
**문제**: 데이터베이스 연결, 쿼리 빌더, 도메인 로직이 한 파일에 혼재

#### 2. **transactionManager.ts (1617줄)**
```typescript
// 문제: 레거시 코드와 새 코드 혼재
// - MySQL 트랜잭션 관리 (사용 안 함)
// - 감사 로깅
// - 비즈니스 규칙 검증
// - 재고 검증
// - BOM 검증
```
**위치**: src/lib/transactionManager.ts:1-1617
**문제**: 사용되지 않는 레거시 코드와 다양한 검증 로직 혼재

#### 3. **API Routes의 비즈니스 로직**
```typescript
// src/app/api/items/route.ts
// 문제: API 라우트에 비즈니스 로직 포함
function computeMmWeight(payload: {...}): number | null {
  // 비즈니스 계산 로직이 API 레이어에 존재
}
```
**위치**: 여러 API 라우트 파일
**문제**: 프레젠테이션 레이어에 비즈니스 로직 포함

### 개선 제안

#### 리팩토링 방안 1: Repository 패턴
```typescript
// src/repositories/ItemRepository.ts
export class ItemRepository {
  constructor(private db: SupabaseClient) {}

  async findAll(filters?: ItemFilters) { /* ... */ }
  async findById(id: number) { /* ... */ }
  async create(data: ItemCreateDTO) { /* ... */ }
  async update(id: number, data: ItemUpdateDTO) { /* ... */ }
  async delete(id: number) { /* ... */ }
}

// src/services/ItemService.ts
export class ItemService {
  constructor(private repo: ItemRepository) {}

  async calculateMmWeight(item: Item) { /* 비즈니스 로직 */ }
  async validateStock(item: Item, quantity: number) { /* ... */ }
}
```

#### 리팩토링 방안 2: 도메인별 모듈 분리
```
src/domains/
├── items/
│   ├── repository.ts
│   ├── service.ts
│   ├── validation.ts
│   └── types.ts
├── companies/
├── transactions/
└── bom/
```

---

## 3. Open/Closed Principle (OCP): 75/100

### 평가
확장에는 비교적 열려있으나, 수정에 완전히 닫혀있지는 않음. 새로운 기능 추가 시 기존 코드 수정이 필요한 경우가 있음.

### 강점

#### 1. **Validation 시스템**
```typescript
// Zod 스키마는 확장 가능
export const ItemCreateSchema = z.object({...});
export const ItemUpdateSchema = ItemCreateSchema.partial();

// 새로운 검증 규칙 추가가 용이
export const ExtendedItemSchema = ItemCreateSchema.extend({
  newField: z.string()
});
```

#### 2. **SupabaseQueryBuilder 패턴**
```typescript
class SupabaseQueryBuilder {
  // 메서드 체이닝으로 확장 가능
  select().filter().orderBy().paginate()
}
```

### 약점

#### 1. **하드코딩된 비즈니스 로직**
```typescript
// src/app/api/companies/route.ts
const prefixMap: Record<string, string> = {
  '고객사': 'CUS',
  '공급사': 'SUP',
  '협력사': 'PAR',
  '기타': 'OTH'
};
// 새로운 타입 추가 시 코드 수정 필요
```

#### 2. **Switch/If 문 남발**
```typescript
// 여러 파일에서 발견
if (type === 'CUSTOMER') { /* ... */ }
else if (type === 'SUPPLIER') { /* ... */ }
// 새로운 타입 추가 시 모든 조건문 수정 필요
```

### 개선 제안

#### Strategy 패턴 도입
```typescript
interface CompanyTypeStrategy {
  getPrefix(): string;
  validate(data: any): boolean;
}

class CustomerStrategy implements CompanyTypeStrategy {
  getPrefix() { return 'CUS'; }
  validate(data) { /* ... */ }
}

// 새로운 전략 추가가 기존 코드 수정 없이 가능
```

---

## 4. Liskov Substitution Principle (LSP): 85/100

### 평가
타입 시스템이 잘 구성되어 있으며, 인터페이스 구현이 일관적임. TypeScript의 구조적 타이핑이 LSP 준수에 도움.

### 강점

#### 1. **일관된 Response 타입**
```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: PaginationInfo;
}
// 모든 API가 동일한 인터페이스 준수
```

#### 2. **Database 타입 일관성**
```typescript
type ItemRow = Database['public']['Tables']['items']['Row'];
type ItemInsert = Database['public']['Tables']['items']['Insert'];
type ItemUpdate = Database['public']['Tables']['items']['Update'];
// Supabase 생성 타입으로 일관성 보장
```

### 약점

#### 1. **불완전한 추상화**
```typescript
// 일부 도메인 헬퍼가 다른 인터페이스 사용
db.items.getAll() // QueryResult<Item[]> 반환
db.transactions.create() // APIResponse<Transaction> 반환
// 반환 타입 불일치
```

### 개선 제안
```typescript
// 통합된 Repository 인터페이스
interface Repository<T> {
  findAll(): Promise<Result<T[]>>;
  findById(id: number): Promise<Result<T>>;
  create(data: Partial<T>): Promise<Result<T>>;
  update(id: number, data: Partial<T>): Promise<Result<T>>;
  delete(id: number): Promise<Result<boolean>>;
}
```

---

## 5. Interface Segregation Principle (ISP): 70/100

### 평가
대체로 인터페이스가 적절히 분리되어 있으나, 일부 과도하게 큰 인터페이스 존재.

### 강점

#### 1. **역할별 클라이언트 분리**
```typescript
// 용도별로 분리된 Supabase 클라이언트
export const createSupabaseBrowserClient // 브라우저용
export const supabase                    // 표준 클라이언트
export const supabaseAdmin              // 관리자용
```

#### 2. **도메인별 Validation 스키마**
```typescript
export const ItemCreateSchema    // 생성용
export const ItemUpdateSchema    // 수정용
export const ItemQuerySchema     // 조회용
// 용도별로 분리된 스키마
```

### 약점

#### 1. **과도하게 큰 도메인 헬퍼**
```typescript
// db-unified.ts의 items 헬퍼
items: {
  getAll(),
  getById(),
  getByCode(),
  create(),
  update(),
  delete(),
  checkDuplicateCode(),
  updateStock(),
  // 너무 많은 메서드
}
```

### 개선 제안
```typescript
// 책임별로 인터페이스 분리
interface ItemReader {
  findAll(): Promise<Item[]>;
  findById(id: number): Promise<Item>;
}

interface ItemWriter {
  create(data: ItemCreateDTO): Promise<Item>;
  update(id: number, data: ItemUpdateDTO): Promise<Item>;
}

interface ItemValidator {
  checkDuplicateCode(code: string): Promise<boolean>;
  validateStock(id: number, quantity: number): Promise<boolean>;
}
```

---

## 6. Dependency Inversion Principle (DIP): 48/100

### 평가
가장 약한 부분. 고수준 모듈이 저수준 모듈에 직접 의존하는 경우가 많음.

### 주요 위반 사례

#### 1. **직접적인 Supabase 의존**
```typescript
// API 라우트에서 직접 import
import { getSupabaseClient } from '@/lib/db-unified';

// 구체적 구현에 의존
const supabase = getSupabaseClient();
const { data, error } = await supabase.from('items').select('*');
```

#### 2. **하드코딩된 비즈니스 규칙**
```typescript
// API 라우트에 비즈니스 로직 직접 구현
if (collected_amount === 0) payment_status = 'PENDING';
else if (collected_amount < total_amount) payment_status = 'PARTIAL';
else payment_status = 'COMPLETED';
```

#### 3. **구체적 클래스 의존**
```typescript
// 추상화 없이 구체적 구현 사용
import { SupabaseQueryBuilder } from '@/lib/db-unified';
const builder = new SupabaseQueryBuilder();
```

### 개선 제안

#### 1. **Repository 인터페이스 도입**
```typescript
// 인터페이스 정의
interface IItemRepository {
  findAll(filters?: ItemFilters): Promise<Item[]>;
  findById(id: number): Promise<Item>;
  create(data: ItemCreateDTO): Promise<Item>;
}

// 구현
class SupabaseItemRepository implements IItemRepository {
  constructor(private db: Database) {}
  // 구현...
}

// 의존성 주입
class ItemService {
  constructor(private repository: IItemRepository) {}
  // repository 인터페이스에만 의존
}
```

#### 2. **비즈니스 규칙 추상화**
```typescript
interface PaymentStatusCalculator {
  calculate(collected: number, total: number): PaymentStatus;
}

class StandardPaymentCalculator implements PaymentStatusCalculator {
  calculate(collected: number, total: number): PaymentStatus {
    if (collected === 0) return 'PENDING';
    if (collected < total) return 'PARTIAL';
    return 'COMPLETED';
  }
}
```

#### 3. **의존성 주입 컨테이너**
```typescript
// src/container.ts
class DIContainer {
  private services = new Map();

  register<T>(token: string, factory: () => T) {
    this.services.set(token, factory);
  }

  resolve<T>(token: string): T {
    return this.services.get(token)();
  }
}

// 사용
container.register('ItemRepository', () => new SupabaseItemRepository(db));
container.register('ItemService', () => new ItemService(
  container.resolve('ItemRepository')
));
```

---

## 7. 종합 분석 및 개선 로드맵

### 종합 SOLID 점수: 68/100 (C+)

### 아키텍처 등급별 평가
- **A (90-100)**: 달성하지 못함
- **B (75-89)**: OCP(75), LSP(85)
- **C (60-74)**: SRP(62), ISP(70), 종합(68)
- **D (50-59)**: DIP(48)

### 주요 개선 과제 (우선순위)

#### 1. **긴급 (1개월 내)**
- db-unified.ts를 도메인별 Repository로 분할
- transactionManager.ts 레거시 코드 제거
- 500줄 이상 파일 리팩토링

#### 2. **중요 (3개월 내)**
- Service Layer 패턴 도입
- 의존성 주입 구현
- 비즈니스 로직을 API 라우트에서 분리

#### 3. **장기 (6개월 내)**
- 완전한 DDD(Domain-Driven Design) 구조 도입
- CQRS 패턴 검토
- 이벤트 소싱 고려

### 구체적 개선 제안

#### Phase 1: Repository 패턴 도입
```
src/
├── domain/
│   ├── items/
│   │   ├── repository/
│   │   │   ├── IItemRepository.ts
│   │   │   └── SupabaseItemRepository.ts
│   │   ├── service/
│   │   │   └── ItemService.ts
│   │   └── types/
│   │       └── Item.ts
```

#### Phase 2: Service Layer 구현
```typescript
// src/services/ItemService.ts
export class ItemService {
  constructor(
    private repository: IItemRepository,
    private validator: IItemValidator,
    private calculator: IPriceCalculator
  ) {}

  async createItem(data: ItemCreateDTO): Promise<Item> {
    await this.validator.validate(data);
    const price = await this.calculator.calculate(data);
    return this.repository.create({ ...data, price });
  }
}
```

#### Phase 3: 의존성 주입 구현
```typescript
// src/api/items/route.ts
export async function POST(request: Request) {
  const container = getContainer();
  const itemService = container.resolve<ItemService>('ItemService');

  const data = await parseRequest(request);
  const result = await itemService.createItem(data);

  return createSuccessResponse(result);
}
```

### 예상 개선 효과
- **SRP**: 62 → 85 (파일당 단일 책임)
- **OCP**: 75 → 90 (Strategy 패턴 도입)
- **LSP**: 85 → 90 (일관된 인터페이스)
- **ISP**: 70 → 85 (세분화된 인터페이스)
- **DIP**: 48 → 80 (의존성 역전 구현)
- **종합**: 68 → 86 (B+ 등급)

### 리스크 및 고려사항
1. 리팩토링 중 기능 손실 방지를 위한 충분한 테스트 필요
2. 점진적 마이그레이션 전략 수립
3. 팀 교육 및 코드 리뷰 프로세스 강화
4. 성능 영향 모니터링