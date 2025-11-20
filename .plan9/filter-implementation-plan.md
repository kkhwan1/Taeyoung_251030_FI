# 필터 구현 계획 - 최우선 3개 페이지

## 개요
품목관리 페이지의 상세 필터 시스템을 핵심 페이지 3개에 적용합니다.

**총 예상 시간**: 8-12시간
**비즈니스 영향**: 높음 ⭐⭐⭐

---

## Task 1: BOM 페이지 필터 구현 ⭐ (최우선)

### 파일
- `src/app/master/bom/page.tsx`

### 현재 상태
- **기존 필터** (5개): 검색, 레벨, 품목유형, 단가범위, 상위품목

### 추가할 필터
1. **거래처 필터** (공급사) - 사용자 명시적 요청
2. **카테고리 필터** (원자재/부품/완제품)
3. **소재유형 필터** (COIL/SHEET/OTHER)

### 구현 패턴
```typescript
// 1. Import 추가
import { CompanyFilterSelect } from '@/components/filters/CompanyFilterSelect';
import { useCompanyFilter } from '@/contexts/CompanyFilterContext';

// 2. 상태 추가
const [selectedCompany, setSelectedCompany] = useState<number | 'ALL'>('ALL');
const [selectedCategory, setSelectedCategory] = useState('');
const [selectedMaterialType, setSelectedMaterialType] = useState('');
const { companies, loading: companiesLoading } = useCompanyFilter();

// 3. useEffect 의존성 추가
useEffect(() => {
  fetchBOMData();
}, [selectedCompany, selectedCategory, selectedMaterialType, /* 기존 필터들 */]);

// 4. API 파라미터 추가
if (selectedCompany !== 'ALL') params.append('supplier_id', String(selectedCompany));
if (selectedCategory) params.append('category', selectedCategory);
if (selectedMaterialType) params.append('material_type', selectedMaterialType);

// 5. UI 추가 (필터 섹션)
<CompanyFilterSelect
  value={selectedCompany}
  onChange={(value) => setSelectedCompany(value === '' ? 'ALL' : Number(value))}
  label="거래처(공급사)"
  showAllOption={true}
/>

<select
  value={selectedCategory}
  onChange={(e) => setSelectedCategory(e.target.value)}
  className="px-3 py-2 border rounded-md"
>
  <option value="">전체 카테고리</option>
  <option value="원자재">원자재</option>
  <option value="부품">부품</option>
  <option value="완제품">완제품</option>
</select>

<select
  value={selectedMaterialType}
  onChange={(e) => setSelectedMaterialType(e.target.value)}
  className="px-3 py-2 border rounded-md"
>
  <option value="">전체 소재</option>
  <option value="COIL">COIL</option>
  <option value="SHEET">SHEET</option>
  <option value="OTHER">기타</option>
</select>
```

### 예상 시간
4-6시간

### 비즈니스 영향
공급사별 BOM 조회 가능 → 생산 계획 효율성 대폭 향상

---

## Task 2: 매출 거래 페이지 필터 구현

### 파일
- `src/app/sales/page.tsx`

### 현재 상태
- **기존 필터** (4개): 검색, 결제상태, 날짜범위

### 추가할 필터
1. **고객사 필터** - 특정 고객사 매출 조회
2. **금액범위 필터** - 최소/최대 금액 설정

### 구현 패턴
```typescript
// 1. Import 추가
import { CompanyFilterSelect } from '@/components/filters/CompanyFilterSelect';
import { useCompanyFilter } from '@/contexts/CompanyFilterContext';

// 2. 상태 추가
const [selectedCompany, setSelectedCompany] = useState<number | 'ALL'>('ALL');
const [minAmount, setMinAmount] = useState('');
const [maxAmount, setMaxAmount] = useState('');
const { companies, loading: companiesLoading } = useCompanyFilter();

// 3. useEffect 의존성 추가
useEffect(() => {
  fetchTransactions();
}, [selectedCompany, minAmount, maxAmount, /* 기존 필터들 */]);

// 4. API 파라미터 추가 (lines 85-89 근처)
if (selectedCompany !== 'ALL') params.append('customer_id', String(selectedCompany));
if (minAmount) params.append('min_amount', minAmount);
if (maxAmount) params.append('max_amount', maxAmount);

// 5. UI 추가
<CompanyFilterSelect
  value={selectedCompany}
  onChange={(value) => setSelectedCompany(value === '' ? 'ALL' : Number(value))}
  label="고객사"
  showAllOption={true}
/>

<div className="flex gap-2">
  <input
    type="number"
    value={minAmount}
    onChange={(e) => setMinAmount(e.target.value)}
    placeholder="최소 금액"
    className="px-3 py-2 border rounded-md w-32"
  />
  <span className="self-center">~</span>
  <input
    type="number"
    value={maxAmount}
    onChange={(e) => setMaxAmount(e.target.value)}
    placeholder="최대 금액"
    className="px-3 py-2 border rounded-md w-32"
  />
</div>
```

### 예상 시간
2-3시간

### 비즈니스 영향
고객사별 매출 분석 용이 → 재무 관리 효율성 향상

---

## Task 3: 매입 거래 페이지 필터 구현

### 파일
- `src/app/purchases/page.tsx`

### 현재 상태
- **기존 필터** (4개): 검색, 결제상태, 날짜범위

### 추가할 필터
1. **공급사 필터** - 특정 공급사 매입 조회
2. **금액범위 필터** - 최소/최대 금액 설정

### 구현 패턴
```typescript
// 1. Import 추가
import { CompanyFilterSelect } from '@/components/filters/CompanyFilterSelect';
import { useCompanyFilter } from '@/contexts/CompanyFilterContext';

// 2. 상태 추가
const [selectedCompany, setSelectedCompany] = useState<number | 'ALL'>('ALL');
const [minAmount, setMinAmount] = useState('');
const [maxAmount, setMaxAmount] = useState('');
const { companies, loading: companiesLoading } = useCompanyFilter();

// 3. useEffect 의존성 추가
useEffect(() => {
  fetchTransactions();
}, [selectedCompany, minAmount, maxAmount, /* 기존 필터들 */]);

// 4. API 파라미터 추가 (lines 85-89 근처)
if (selectedCompany !== 'ALL') params.append('supplier_id', String(selectedCompany));
if (minAmount) params.append('min_amount', minAmount);
if (maxAmount) params.append('max_amount', maxAmount);

// 5. UI 추가
<CompanyFilterSelect
  value={selectedCompany}
  onChange={(value) => setSelectedCompany(value === '' ? 'ALL' : Number(value))}
  label="공급사"
  showAllOption={true}
/>

<div className="flex gap-2">
  <input
    type="number"
    value={minAmount}
    onChange={(e) => setMinAmount(e.target.value)}
    placeholder="최소 금액"
    className="px-3 py-2 border rounded-md w-32"
  />
  <span className="self-center">~</span>
  <input
    type="number"
    value={maxAmount}
    onChange={(e) => setMaxAmount(e.target.value)}
    placeholder="최대 금액"
    className="px-3 py-2 border rounded-md w-32"
  />
</div>
```

### 예상 시간
2-3시간

### 비즈니스 영향
공급사별 매입 분석 용이 → 구매 관리 효율성 향상

---

## 참고: 품목관리 페이지 필터 패턴

### 기준 파일
- `src/app/master/items/page.tsx` (lines 124-214)

### 핵심 패턴
```typescript
// 1. 상태 선언
const [selectedCompany, setSelectedCompany] = useState<number | 'ALL'>('ALL');
const { companies, loading: companiesLoading } = useCompanyFilter();

// 2. useEffect 의존성
useEffect(() => {
  setCurrentCursor(null);
  setCurrentDirection('next');
  fetchItems(null, 'next');
}, [selectedCompany, /* 다른 필터들 */]);

// 3. API 호출
const params = new URLSearchParams();
if (selectedCompany !== 'ALL') params.append('supplier_id', String(selectedCompany));
const response = await fetch(`/api/items?${params}`);

// 4. UI 렌더링
<CompanyFilterSelect
  value={selectedCompany}
  onChange={(value) => setSelectedCompany(value === '' ? 'ALL' : Number(value))}
  label="공급사"
  showAllOption={true}
/>
```

### 재사용 가능한 컴포넌트
- `src/components/filters/CompanyFilterSelect.tsx` (155줄)
- `src/contexts/CompanyFilterContext.tsx` (121줄)
- `src/hooks/useCompanyFilter.ts` (97줄)

---

## 구현 순서

1. **BOM 페이지** (4-6시간) - 사용자 명시적 요청
2. **매출 페이지** (2-3시간) - 재무 관리 핵심
3. **매입 페이지** (2-3시간) - 재무 관리 핵심

---

## 체크리스트

### BOM 페이지
- [ ] CompanyFilterSelect import 및 사용
- [ ] 카테고리 필터 select 추가
- [ ] 소재유형 필터 select 추가
- [ ] useEffect 의존성 배열 업데이트
- [ ] API 파라미터 추가
- [ ] 모바일 반응형 확인
- [ ] 다크모드 스타일 확인
- [ ] 테스트 (공급사별 필터링 동작 확인)

### 매출 페이지
- [ ] CompanyFilterSelect import 및 사용
- [ ] 금액범위 input 추가
- [ ] useEffect 의존성 배열 업데이트
- [ ] API 파라미터 추가
- [ ] 모바일 반응형 확인
- [ ] 다크모드 스타일 확인
- [ ] 테스트 (고객사별, 금액별 필터링 동작 확인)

### 매입 페이지
- [ ] CompanyFilterSelect import 및 사용
- [ ] 금액범위 input 추가
- [ ] useEffect 의존성 배열 업데이트
- [ ] API 파라미터 추가
- [ ] 모바일 반응형 확인
- [ ] 다크모드 스타일 확인
- [ ] 테스트 (공급사별, 금액별 필터링 동작 확인)

---

## 성공 기준

✅ 3개 페이지 모두 필터 추가 완료
✅ 품목관리 페이지와 동일한 UX 패턴 적용
✅ CompanyFilterSelect 컴포넌트 재사용
✅ 모바일 반응형 동작 확인
✅ 다크모드 스타일 적용
✅ 필터링 동작 테스트 통과

---

**작성일**: 2025-02-01
**예상 완료**: 8-12시간 후
**비즈니스 영향**: 높음 ⭐⭐⭐
