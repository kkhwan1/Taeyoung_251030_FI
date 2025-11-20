# Wave 1: UI Consistency Implementation Report

## Agent 1 Task: Eliminate Browser Native UI

### Status: IN PROGRESS

## Files Requiring Changes

### 1. CoilProcessForm.tsx

**Location**: `src/components/process/CoilProcessForm.tsx`

**Changes Required**:

#### A. Replace window.confirm() - Line 72-76
```typescript
// OLD CODE (REMOVE):
if (yieldRate > 100) {
  const confirm = window.confirm(
    `수율이 100%를 초과합니다 (${yieldRate.toFixed(2)}%).\n정말로 등록하시겠습니까?`
  );
  if (!confirm) return;
}

// NEW CODE (ADD):
// 1. Add state at top:
const [showYieldWarningModal, setShowYieldWarningModal] = useState(false);
const [pendingSubmit, setPendingSubmit] = useState(false);

// 2. Replace validation logic:
if (yieldRate > 100) {
  setPendingSubmit(true);
  setShowYieldWarningModal(true);
  return;
}

// 3. Add Modal component at bottom of JSX:
<Modal
  isOpen={showYieldWarningModal}
  onClose={() => {
    setShowYieldWarningModal(false);
    setPendingSubmit(false);
  }}
  title="수율 경고"
  size="sm"
>
  <div className="space-y-4">
    <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
      <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
          수율이 100%를 초과합니다
        </p>
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          현재 수율: <span className="font-bold">{yieldRate.toFixed(2)}%</span>
        </p>
        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
          정말로 등록하시겠습니까?
        </p>
      </div>
    </div>
    <div className="flex gap-3">
      <button
        onClick={handleConfirmHighYield}
        disabled={isSubmitting}
        className="flex-1 bg-yellow-600 text-white py-2 px-4 rounded-md hover:bg-yellow-700 disabled:bg-gray-400 transition-colors"
      >
        {isSubmitting ? '등록 중...' : '확인 및 등록'}
      </button>
      <button
        onClick={() => {
          setShowYieldWarningModal(false);
          setPendingSubmit(false);
        }}
        disabled={isSubmitting}
        className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-200"
      >
        취소
      </button>
    </div>
  </div>
</Modal>
```

#### B. Replace window.prompt() for Source Item - Lines 153-170
```typescript
// OLD CODE (REMOVE):
onClick={() => {
  // TODO: Open ItemSelector modal with inventory_type='코일' filter
  // For now, using simple prompt
  const itemId = prompt('코일 품목 ID를 입력하세요:');
  if (itemId) {
    // Fetch item details
    fetch(`/api/items/${itemId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          if (data.data.inventory_type !== '코일') {
            alert('코일 타입 품목만 선택 가능합니다.');
            return;
          }
          setSourceItem(data.data);
          setFormData({ ...formData, source_item_id: parseInt(itemId) });
        }
      })
      .catch(() => alert('품목 정보를 불러올 수 없습니다.'));
  }
}}

// NEW CODE (ADD):
// 1. Add states:
const [showSourceItemModal, setShowSourceItemModal] = useState(false);
const [itemSearchQuery, setItemSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<any[]>([]);
const [isSearching, setIsSearching] = useState(false);

// 2. Add search function:
const searchItems = async (query: string, filterCoilOnly: boolean = false) => {
  if (!query.trim()) {
    setSearchResults([]);
    return;
  }
  setIsSearching(true);
  try {
    const response = await fetch(`/api/items?search=${encodeURIComponent(query)}&limit=20`);
    const result = await response.json();
    if (result.success && result.data) {
      let items = result.data;
      if (filterCoilOnly) {
        items = items.filter((item: any) => item.inventory_type === '코일');
      }
      setSearchResults(items);
    }
  } catch (err) {
    console.error('품목 검색 실패:', err);
    setSearchResults([]);
  } finally {
    setIsSearching(false);
  }
};

// 3. Add debounced search effect:
useEffect(() => {
  const timer = setTimeout(() => {
    if (showSourceItemModal) {
      searchItems(itemSearchQuery, true);
    } else if (showTargetItemModal) {
      searchItems(itemSearchQuery, false);
    }
  }, 300);
  return () => clearTimeout(timer);
}, [itemSearchQuery, showSourceItemModal, showTargetItemModal]);

// 4. Replace onClick handler:
onClick={() => setShowSourceItemModal(true)}

// 5. Add Modal at bottom:
<Modal
  isOpen={showSourceItemModal}
  onClose={() => {
    setShowSourceItemModal(false);
    setItemSearchQuery('');
    setSearchResults([]);
  }}
  title="코일 선택"
  size="lg"
>
  <div className="space-y-4">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        type="text"
        value={itemSearchQuery}
        onChange={(e) => setItemSearchQuery(e.target.value)}
        placeholder="품목 코드 또는 이름으로 검색..."
        className="w-full pl-10 pr-4 py-2 border dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
        autoFocus
      />
    </div>
    <div className="max-h-96 overflow-y-auto space-y-2">
      {isSearching ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">검색 중...</div>
      ) : searchResults.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          {itemSearchQuery ? '검색 결과가 없습니다.' : '검색어를 입력하세요.'}
        </div>
      ) : (
        searchResults.map((item) => (
          <button
            key={item.item_id}
            onClick={() => handleSelectSourceItem(item)}
            className="w-full text-left p-4 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {item.item_code} - {item.item_name}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  재고: {item.current_stock?.toLocaleString() || 0} {item.unit || 'kg'}
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">
                코일
              </span>
            </div>
          </button>
        ))
      )}
    </div>
  </div>
</Modal>
```

#### C. Replace window.prompt() for Target Item - Lines 194-206
Same pattern as source item, but with:
- State: `showTargetItemModal`
- No filter for코일 type
- Different badge showing `item.inventory_type`

### 2. CoilTraceabilityView.tsx

**Location**: `src/components/process/CoilTraceabilityView.tsx`

**Changes Required**:

Replace window.prompt() at line 35 with Modal:

```typescript
// Similar pattern to CoilProcessForm item selectors
// Add states, search functionality, and Modal component
```

### 3. CoilProcessDetail.tsx

**Location**: `src/components/process/CoilProcessDetail.tsx`

**Changes Required**:

Fix completion overlay at lines 338-394:

```typescript
// OLD CODE (line 338-394):
{showCompleteModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      ...
    </div>
  </div>
)}

// NEW CODE (REPLACE):
<Modal
  isOpen={showCompleteModal}
  onClose={() => setShowCompleteModal(false)}
  title="공정 완료 확인"
  size="sm"
>
  <div className="space-y-4">
    <p className="text-gray-700 dark:text-gray-300">
      공정을 완료하시겠습니까? 완료 시 다음 작업이 자동으로 수행됩니다:
    </p>
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-red-600 dark:text-red-400">▼</span>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">소스 코일 출고</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {process.source_item?.item_name} -{formatNumber(process.input_quantity)} {process.source_item?.unit || 'kg'}
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-green-600 dark:text-green-400">▲</span>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">타겟 품목 입고</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {process.target_item?.item_name} +{formatNumber(process.output_quantity)} {process.target_item?.unit || 'kg'}
          </div>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
      <span>⚠️</span>
      <span>완료 후에는 되돌릴 수 없습니다.</span>
    </div>
    <div className="flex gap-3">
      <button
        onClick={handleCompleteProcess}
        disabled={isCompleting}
        className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
      >
        {isCompleting ? '처리 중...' : '완료 처리'}
      </button>
      <button
        onClick={() => setShowCompleteModal(false)}
        disabled={isCompleting}
        className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 dark:text-gray-200"
      >
        취소
      </button>
    </div>
  </div>
</Modal>
```

## Required Imports

All files need:
```typescript
import Modal from '@/components/Modal';
import { Search, AlertTriangle } from 'lucide-react'; // As needed
```

## Success Criteria Checklist

- [ ] Zero window.confirm() calls
- [ ] Zero window.prompt() calls
- [ ] All modals use shared Modal component
- [ ] All modals support dark mode (dark: classes)
- [ ] All modals are keyboard accessible (ESC key handled by Modal component)
- [ ] All modals have proper ARIA attributes (handled by Modal component)
- [ ] All item selector modals have search functionality
- [ ] All item selector modals filter appropriately (코일 for source, all for target)
- [ ] High yield warning modal shows correct information
- [ ] Process completion modal shows stock movement details

## Testing Plan

1. Open each form component
2. Test modal opening (click triggers)
3. Test modal closing (X button, ESC key, backdrop click)
4. Test search functionality in item selectors
5. Test item selection and form population
6. Test yield warning confirmation flow
7. Test process completion confirmation flow
8. Test dark mode appearance for all modals
9. Test keyboard navigation (Tab, ESC)
10. Verify no browser native dialogs appear

## Implementation Notes

- Modal component already handles ESC key, focus trap, and backdrop
- Modal component already supports dark mode with proper classes
- Search functionality uses debounced API calls (300ms delay)
- All modals follow Korean language conventions
- Item selectors show appropriate badges (코일 type, inventory type)
- Stock information displayed in item cards
- Loading states handled in search results

## Next Steps

1. Create backup of current files
2. Apply changes systematically to each file
3. Test each change independently
4. Perform comprehensive integration testing
5. Update documentation if needed
