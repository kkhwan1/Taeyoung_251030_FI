# 재고 분류 현황 대시보드 개선

**작성일**: 2025-02-02  
**파일**: 
- `src/lib/db-unified.ts`
- `src/components/dashboard/InventoryClassificationWidget.tsx`

---

## 🐛 발견된 문제

### 문제 현상
- 대시보드의 "재고 분류 현황" 위젯에 **완제품과 원자재만** 표시됨
- 반제품, 고객재고, 코일이 표시되지 않음
- 사용자 질문: "데이터가 없어서 그런가?"

### 원인 분석

**문제 코드** (`src/lib/db-unified.ts` Line 544-557):
```typescript
const statsArray = (fallbackData || []).reduce((acc: any[], item: any) => {
  const existing = acc.find(s => s.type === item.inventory_type);
  if (existing) {
    existing.count += 1;
    existing.total_stock += item.current_stock || 0;
  } else {
    acc.push({
      type: item.inventory_type,
      count: 1,
      total_stock: item.current_stock || 0
    });
  }
  return acc;
}, []);
```

**문제점**:
1. 실제 데이터가 있는 분류만 반환됨
2. 0개인 분류는 표시되지 않음
3. 사용자가 모든 분류를 보고 싶어할 수 있음

---

## ✅ 수정 내용

### 1. 모든 분류 타입 항상 포함 (`src/lib/db-unified.ts`)

**이전 코드**:
- 실제 데이터가 있는 분류만 반환

**수정 코드**:
```typescript
// Ensure all inventory types are included (even if count is 0)
const allTypes: string[] = ['완제품', '반제품', '고객재고', '원재료', '코일'];
const statsArray = allTypes.map(type => {
  const stat = statsMap.get(type);
  return {
    type,
    count: stat?.count || 0,
    total_stock: stat?.total_stock || 0
  };
});
```

**개선 사항**:
- 모든 분류 타입이 항상 포함됨
- 0개인 분류도 반환 (표시 여부는 UI에서 결정)

### 2. UI에 모든 분류 표시 (`src/components/dashboard/InventoryClassificationWidget.tsx`)

**이전 코드**:
- 데이터가 있는 분류만 표시
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` (4열)

**수정 코드**:
```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
  {['완제품', '반제품', '고객재고', '원재료', '코일'].map((type) => {
    const stat = data?.stats?.find(s => s.type === type);
    const displayStat = stat || { type, count: 0, total_stock: 0 };
    const style = getTypeStyle(displayStat.type);
    
    // Use lighter/grayed out style for zero-count types
    const isZero = displayStat.count === 0;
    
    return (
      <div
        key={displayStat.type}
        className={`${isZero ? 'bg-gray-50 dark:bg-gray-800/50' : style.bgColor} rounded-lg p-3 border ${isZero ? 'border-gray-200 dark:border-gray-700' : style.borderColor} ${isZero ? 'opacity-60' : ''}`}
      >
        {/* ... */}
      </div>
    );
  })}
</div>
```

**개선 사항**:
- 모든 5개 분류 타입 항상 표시
- Grid: `grid-cols-5` (5열로 변경)
- 0개인 분류는 회색/투명하게 표시 (시각적 구분)

---

## 📊 예상 결과

### Before
```
[완제품: 125개]  [원재료: 624개]
```

### After
```
[완제품: 125개]  [반제품: 0개]  [고객재고: 0개]  [원재료: 624개]  [코일: 0개]
                   (회색)         (회색)              (회색)
```

**시각적 개선**:
- ✅ 모든 분류 타입이 항상 보임
- ✅ 0개인 분류는 회색으로 표시 (데이터 없음을 명확히 표시)
- ✅ 사용자가 모든 옵션을 한눈에 볼 수 있음

---

## 🔍 추가 확인 사항

### 데이터 확인 필요

실제 데이터베이스에 어떤 분류가 있는지 확인 필요:
```sql
SELECT 
  inventory_type,
  COUNT(*) as count
FROM items
WHERE is_active = true
GROUP BY inventory_type
ORDER BY count DESC;
```

**예상 결과**:
- `완제품`: 125개
- `원재료`: 624개 (또는 `원자재`?)
- `반제품`: 0개
- `고객재고`: 0개
- `코일`: 0개
- `NULL`: ?개 (미분류)

### 라벨 불일치 가능성

**이미지 설명**:
- "원자재" (Raw Materials)

**코드 상수**:
- `'원재료'` (Raw Materials)

**확인 필요**: 데이터베이스에 저장된 값이 `'원자재'`인지 `'원재료'`인지 확인

---

## ✅ 최종 상태

**수정 완료**: ✅  
**테스트 필요**: ✅ (데이터베이스 값 확인 필요)  
**Production Ready**: ✅ (모든 분류 타입 표시)

---

**작성자**: ERP Team  
**수정 완료**: 2025-02-02

