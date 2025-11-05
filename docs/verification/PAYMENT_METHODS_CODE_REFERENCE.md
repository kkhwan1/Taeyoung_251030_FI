# Payment Methods - Code Reference Guide

## Quick Reference

### Payment Method Values
- `CASH` = 현금 (Cash)
- `TRANSFER` = 계좌이체 (Bank Transfer)
- `CHECK` = 수표 (Check/Cheque) ✅
- `CARD` = 카드 (Card)
- `BILL` = 어음 (Bill of Exchange) ✅

---

## File 1: Type Definitions

**Location**: `src/types/invoice.ts` (lines 57, 72, 86, 87)

### Payment Method Union Type
```typescript
// Line 57 - PaymentSplit interface
payment_method: 'CASH' | 'CARD' | 'BILL' | 'CHECK' | 'CREDIT';

// Line 72 - PaymentSplitCreate interface
payment_method: 'CASH' | 'CARD' | 'BILL' | 'CHECK' | 'CREDIT';
```

### Display Labels Mapping
```typescript
// Lines 83-89
export const PAYMENT_METHOD_LABELS: Record<PaymentSplit['payment_method'], string> = {
  CASH: '현금',
  CARD: '카드',
  BILL: '어음',        // ← CHECK/BILL here
  CHECK: '수표',       // ← CHECK/BILL here
  CREDIT: '외상'
};
```

---

## File 2: Component Implementation

**Location**: `src/components/forms/PaymentForm.tsx`

### 1. Type Definition (Line 14)
```typescript
type PaymentMethod = 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD' | 'BILL';
```

### 2. Payment Method Options Array (Lines 50-56)
```typescript
const PAYMENT_METHOD_OPTIONS = [
  { value: 'CASH', label: '현금' },
  { value: 'TRANSFER', label: '계좌이체' },
  { value: 'CHECK', label: '수표' },          // ← Displays as "수표"
  { value: 'CARD', label: '카드' },
  { value: 'BILL', label: '어음' }            // ← Displays as "어음"
];
```

### 3. Form Data Interface (Lines 16-32)
```typescript
type Payment = {
  payment_id?: number;
  payment_date: string;
  purchase_transaction_id: number;
  paid_amount: number;
  payment_method: PaymentMethod;
  bank_name?: string;
  account_number?: string;
  check_number?: string;              // ← For CHECK
  card_number?: string;
  bill_number?: string;               // ← For BILL
  bill_date?: string;                 // ← For BILL
  bill_drawer?: string;               // ← For BILL
  notes?: string;
  is_active?: boolean;
  remaining_balance?: number;
};
```

### 4. Dropdown Rendering (Lines 533-547)
```typescript
<select
  name="payment_method"
  value={formData.payment_method}
  onChange={handleChange}
  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
    errors.payment_method ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
  }`}
  required
>
  {PAYMENT_METHOD_OPTIONS.map((option) => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ))}
</select>
```

**Result when rendered**:
```html
<select name="payment_method">
  <option value="CASH">현금</option>
  <option value="TRANSFER">계좌이체</option>
  <option value="CHECK">수표</option>           ← User sees "수표"
  <option value="CARD">카드</option>
  <option value="BILL">어음</option>            ← User sees "어음"
</select>
```

### 5. CHECK Conditional Fields (Lines 601-622)

**Triggers when**: `formData.payment_method === 'CHECK'`

```typescript
{formData.payment_method === 'CHECK' && (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      <Hash className="w-4 h-4 inline mr-2" />
      수표번호 <span className="text-gray-500">*</span>
    </label>
    <input
      type="text"
      name="check_number"
      value={formData.check_number}
      onChange={handleChange}
      className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
        errors.check_number ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
      }`}
      placeholder="예: CHK-2024-001"
      required
    />
    {errors.check_number && (
      <p className="mt-1 text-sm text-gray-500">{errors.check_number}</p>
    )}
  </div>
)}
```

**Rendered when user selects "수표"**:
```html
<div>
  <label>
    <svg class="w-4 h-4">...</svg>
    수표번호 <span style="color: #999;">*</span>
  </label>
  <input type="text" placeholder="예: CHK-2024-001" required />
</div>
```

### 6. BILL Conditional Fields (Lines 650-706)

**Triggers when**: `formData.payment_method === 'BILL'`

```typescript
{formData.payment_method === 'BILL' && (
  <>
    {/* Field 1: Bill Number */}
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        <Hash className="w-4 h-4 inline mr-2" />
        어음 번호 <span className="text-gray-500">*</span>
      </label>
      <input
        type="text"
        name="bill_number"
        value={formData.bill_number ?? ''}
        onChange={handleChange}
        className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
          errors.bill_number ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
        }`}
        placeholder="어음 번호 입력"
        required
      />
      {errors.bill_number && (
        <p className="mt-1 text-sm text-gray-500">{errors.bill_number}</p>
      )}
    </div>

    {/* Field 2: Due Date (만기일) */}
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        <Calendar className="w-4 h-4 inline mr-2" />
        만기일 <span className="text-gray-500">*</span>
      </label>
      <input
        type="date"
        name="bill_date"
        value={formData.bill_date ?? ''}
        onChange={handleChange}
        className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
          errors.bill_date ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
        }`}
        required
      />
      {errors.bill_date && (
        <p className="mt-1 text-sm text-gray-500">{errors.bill_date}</p>
      )}
    </div>

    {/* Field 3: Drawer (발행자) - Optional */}
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        <Building2 className="w-4 h-4 inline mr-2" />
        발행자
      </label>
      <input
        type="text"
        name="bill_drawer"
        value={formData.bill_drawer ?? ''}
        onChange={handleChange}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        placeholder="발행자 입력"
      />
    </div>
  </>
)}
```

**Rendered when user selects "어음"**:
```html
<div>
  <label>
    <svg class="w-4 h-4">...</svg>
    어음 번호 <span style="color: #999;">*</span>
  </label>
  <input type="text" placeholder="어음 번호 입력" required />
</div>

<div>
  <label>
    <svg class="w-4 h-4">...</svg>
    만기일 <span style="color: #999;">*</span>
  </label>
  <input type="date" required />
</div>

<div>
  <label>
    <svg class="w-4 h-4">...</svg>
    발행자
  </label>
  <input type="text" placeholder="발행자 입력" />
</div>
```

### 7. Validation Logic (Lines 318-333)

**CHECK Validation**:
```typescript
if (formData.payment_method === 'CHECK' && !formData.check_number) {
  newErrors.check_number = '수표번호는 필수입니다';
}
```

**BILL Validation**:
```typescript
if (formData.payment_method === 'BILL') {
  if (!formData.bill_number) {
    newErrors.bill_number = '어음 번호는 필수입니다';
  }
  if (!formData.bill_date) {
    newErrors.bill_date = '만기일은 필수입니다';
  }
}
```

### 8. Form Submission Cleanup (Lines 356-376)

```typescript
// Clean up conditional fields based on payment method
const cleanedData = { ...dataToSave };

if (cleanedData.payment_method !== 'TRANSFER') {
  delete cleanedData.bank_name;
  delete cleanedData.account_number;
}

if (cleanedData.payment_method !== 'CHECK') {
  delete cleanedData.check_number;           // ← Remove if not CHECK
}

if (cleanedData.payment_method !== 'CARD') {
  delete cleanedData.card_number;
}

if (cleanedData.payment_method !== 'BILL') {
  delete cleanedData.bill_number;            // ← Remove if not BILL
  delete cleanedData.bill_date;              // ← Remove if not BILL
  delete cleanedData.bill_drawer;            // ← Remove if not BILL
}
```

---

## User Interaction Flow

### Scenario 1: User Selects "수표" (CHECK)

```
1. Page Loads
   └─ form.payment_method = 'CASH' (default)
   └─ CHECK conditional fields NOT visible

2. User Clicks Dropdown
   └─ Shows all 5 options:
      - 현금 (CASH)
      - 계좌이체 (TRANSFER)
      - 수표 (CHECK) ← User clicks this
      - 카드 (CARD)
      - 어음 (BILL)

3. User Selects "수표" (CHECK)
   └─ form.payment_method = 'CHECK'
   └─ Component re-renders
   └─ CHECK conditional fields NOW visible:
      - Input: 수표번호 (check_number)

4. User Enters Check Number
   └─ formData.check_number = 'CHK-2024-001'

5. User Submits Form
   └─ Validation runs:
      - ✓ payment_method = 'CHECK'
      - ✓ check_number is not empty → PASS
   └─ cleanedData prepared:
      - { payment_method: 'CHECK', check_number: 'CHK-2024-001', ... }
      - bank_name, account_number removed (if present)
      - bill_number, bill_date, bill_drawer removed (if present)
      - card_number removed (if present)
   └─ API Call: POST /api/payments { payment_method: 'CHECK', check_number: '...', ... }
```

### Scenario 2: User Selects "어음" (BILL)

```
1. Page Loads
   └─ form.payment_method = 'CASH' (default)
   └─ BILL conditional fields NOT visible

2. User Clicks Dropdown
   └─ Shows all 5 options:
      - 현금 (CASH)
      - 계좌이체 (TRANSFER)
      - 수표 (CHECK)
      - 카드 (CARD)
      - 어음 (BILL) ← User clicks this

3. User Selects "어음" (BILL)
   └─ form.payment_method = 'BILL'
   └─ Component re-renders
   └─ BILL conditional fields NOW visible:
      - Input: 어음 번호 (bill_number) *Required
      - DatePicker: 만기일 (bill_date) *Required
      - Input: 발행자 (bill_drawer) *Optional

4. User Fills in Fields
   └─ formData.bill_number = 'BILL-001'
   └─ formData.bill_date = '2025-12-31'
   └─ formData.bill_drawer = '태창금속' (optional)

5. User Submits Form
   └─ Validation runs:
      - ✓ payment_method = 'BILL'
      - ✓ bill_number is not empty → PASS
      - ✓ bill_date is not empty → PASS
   └─ cleanedData prepared:
      - { payment_method: 'BILL', bill_number: 'BILL-001', bill_date: '2025-12-31', bill_drawer: '태창금속', ... }
      - bank_name, account_number removed
      - check_number removed
      - card_number removed
   └─ API Call: POST /api/payments { payment_method: 'BILL', bill_number: 'BILL-001', bill_date: '2025-12-31', bill_drawer: '태창금속', ... }
```

---

## Error Messages

### English to Korean Error Messages

| Trigger | Field | Error Message | 발생 조건 |
|---------|-------|---------------|---------|
| CHECK validation | `check_number` | `'수표번호는 필수입니다'` | Payment method = CHECK AND check_number is empty |
| BILL validation | `bill_number` | `'어음 번호는 필수입니다'` | Payment method = BILL AND bill_number is empty |
| BILL validation | `bill_date` | `'만기일은 필수입니다'` | Payment method = BILL AND bill_date is empty |

---

## Data Models

### Before Submission (formData)
```javascript
{
  payment_id: undefined,
  payment_date: '2025-11-04',
  purchase_transaction_id: 123,
  paid_amount: 100000,
  payment_method: 'CHECK',  // or 'BILL'
  bank_name: '',
  account_number: '',
  check_number: 'CHK-2024-001',  // Only when payment_method = 'CHECK'
  card_number: '',
  bill_number: 'BILL-001',        // Only when payment_method = 'BILL'
  bill_date: '2025-12-31',        // Only when payment_method = 'BILL'
  bill_drawer: '태창금속',         // Only when payment_method = 'BILL'
  notes: '특별 사항 없음',
  is_active: true,
  remaining_balance: 100000
}
```

### After Cleanup (cleanedData for CHECK)
```javascript
{
  payment_date: '2025-11-04',
  purchase_transaction_id: 123,
  paid_amount: 100000,
  payment_method: 'CHECK',
  check_number: 'CHK-2024-001',
  notes: '특별 사항 없음'
}
```

### After Cleanup (cleanedData for BILL)
```javascript
{
  payment_date: '2025-11-04',
  purchase_transaction_id: 123,
  paid_amount: 100000,
  payment_method: 'BILL',
  bill_number: 'BILL-001',
  bill_date: '2025-12-31',
  bill_drawer: '태창금속',
  notes: '특별 사항 없음'
}
```

---

## CSS Classes Used

### Dropdown Select Element
```css
w-full                          /* Full width */
px-4 py-2                       /* Padding */
border rounded-lg               /* Border radius */
bg-white dark:bg-gray-800       /* Dark mode support */
text-gray-900 dark:text-white   /* Text color with dark mode */
focus:outline-none              /* Remove default outline */
focus:ring-2                    /* Focus ring */
focus:ring-purple-500           /* Purple focus ring */
border-gray-300 dark:border-gray-700  /* Border color */
```

### Input Elements (TEXT, DATE)
```css
w-full                          /* Full width */
px-4 py-2                       /* Padding */
border rounded-lg               /* Border radius */
bg-white dark:bg-gray-800       /* Dark mode support */
text-gray-900 dark:text-white   /* Text color with dark mode */
focus:outline-none              /* Remove default outline */
focus:ring-2                    /* Focus ring */
focus:ring-purple-500           /* Purple focus ring */
border-gray-300 dark:border-gray-700  /* Border color */
border-gray-500 (error state)   /* Red border on error */
```

---

## Icons Used

| Icon | Where | Purpose |
|------|-------|---------|
| `<Hash />` | CHECK & BILL | Indicates identifier/number field |
| `<Calendar />` | BILL | Indicates date field (만기일) |
| `<Building2 />` | BILL | Indicates organization/company field (발행자) |

---

## Summary

### CHECK (수표) Implementation
- ✅ Dropdown option: `{ value: 'CHECK', label: '수표' }`
- ✅ Conditional field: `check_number` (text input)
- ✅ Validation: Required when payment_method = 'CHECK'
- ✅ Cleanup: Removed when payment_method ≠ 'CHECK'
- ✅ Icon: Hash
- ✅ Placeholder: "예: CHK-2024-001"

### BILL (어음) Implementation
- ✅ Dropdown option: `{ value: 'BILL', label: '어음' }`
- ✅ Conditional fields:
  - `bill_number` (text input) - Required
  - `bill_date` (date picker) - Required
  - `bill_drawer` (text input) - Optional
- ✅ Validation: bill_number and bill_date required when payment_method = 'BILL'
- ✅ Cleanup: All 3 fields removed when payment_method ≠ 'BILL'
- ✅ Icons: Hash (number), Calendar (date), Building2 (drawer)
- ✅ Placeholders: "어음 번호 입력", "발행자 입력"

---

**Document Version**: 1.0
**Created**: 2025-11-04
**Last Updated**: 2025-11-04
