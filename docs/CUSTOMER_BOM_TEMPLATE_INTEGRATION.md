# Customer BOM Template System - Integration Guide

## Overview
Customer BOM Template system allows linking customers to default BOM configurations, enabling auto-population of batch registration forms when a customer is selected.

## Completed Implementation

### ✅ Database Schema
**Table**: `customer_bom_templates`
- `template_id` (SERIAL PRIMARY KEY)
- `customer_id` (INTEGER, FK to companies)
- `bom_id` (INTEGER, FK to bom)
- `is_default` (BOOLEAN, default false)
- `created_at`, `updated_at` (TIMESTAMP)
- **Indexes**: customer_id, (customer_id, is_default) for default lookups
- **Constraints**: UNIQUE(customer_id, bom_id), CASCADE deletes

**Migration**: `supabase/migrations/create_customer_bom_templates.sql`

### ✅ API Endpoints
**Base URL**: `/api/customers/[customerId]/bom-template`

#### GET - Retrieve Default BOM Template
Fetches the default BOM template for a customer with all component items.

**Example Response**:
```json
{
  "success": true,
  "data": {
    "template_id": 1,
    "customer_id": 223,
    "bom": {
      "bom_id": 464,
      "product_item_id": 4601,
      "product_code": "65630-L2000",
      "product_name": "PNL & MBR ASS'Y RR FLR COMPLE 일반 BENCH",
      "product_spec": null,
      "product_unit": "EA",
      "items": [
        {
          "item_id": 4353,
          "item_code": "65852-L2000",
          "item_name": "MBR-RR FLR CTR CROSS",
          "spec": null,
          "unit": "EA",
          "current_stock": 27736,
          "quantity_required": 1,
          "level_no": 1
        }
        // ... more items
      ]
    }
  }
}
```

**Error Handling**:
- 400: Invalid customer ID
- 404: No default template found
- 500: Server error

#### POST - Create/Update BOM Template
Sets or updates a customer's default BOM template.

**Request Body**:
```json
{
  "bom_id": 464,
  "is_default": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "template_id": 1,
    "customer_id": 223,
    "bom_id": 464,
    "is_default": true,
    "created_at": "2025-11-04T05:56:14.672704",
    "updated_at": "2025-11-04T05:56:14.672704"
  }
}
```

#### DELETE - Remove BOM Template
Removes a BOM template for a customer.

**Query Parameters**:
- `bom_id` (required): The BOM ID to remove

**Response**:
```json
{
  "success": true,
  "message": "BOM template removed successfully"
}
```

### ✅ Testing
**Test Data Created**:
- Customer 223 (현대자동차) → BOM 464 (PNL & MBR ASS'Y RR FLR COMPLE)
- Customer 224 (기아자동차) → BOM 463 (MEMBER ASSY-RR FLOOR CTR CROSS)

**API Tests**:
```bash
# Get template
curl http://localhost:5000/api/customers/223/bom-template

# Create template
curl -X POST http://localhost:5000/api/customers/224/bom-template \
  -H "Content-Type: application/json" \
  -d '{"bom_id": 463, "is_default": true}'

# Delete template
curl -X DELETE "http://localhost:5000/api/customers/224/bom-template?bom_id=463"
```

## UI Integration Guide (For Future Implementation)

### Step 1: Add Customer Selector to BatchRegistrationForm

**Location**: `src/components/batch/BatchRegistrationForm.tsx`

Add customer selection field before the batch date:

```tsx
import { useState, useEffect } from 'react';

// Add to state
const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
const [customers, setCustomers] = useState<any[]>([]);
const [bomTemplateLoading, setBomTemplateLoading] = useState(false);

// Fetch customers on mount
useEffect(() => {
  fetchCustomers();
}, []);

const fetchCustomers = async () => {
  try {
    const response = await fetch('/api/companies?company_type=고객사');
    const result = await response.json();
    if (result.success) {
      setCustomers(result.data);
    }
  } catch (error) {
    console.error('Failed to fetch customers:', error);
  }
};
```

### Step 2: Add Load BOM Template Function

```tsx
const loadBomTemplate = async (customerId: number) => {
  setBomTemplateLoading(true);
  try {
    const response = await fetch(`/api/customers/${customerId}/bom-template`);
    const result = await response.json();

    if (result.success) {
      const { bom } = result.data;

      // Auto-populate INPUT items from BOM
      const inputItems: BatchItem[] = bom.items.map((item: any) => ({
        item_id: item.item_id,
        item_type: 'INPUT',
        quantity: item.quantity_required,
        unit_price: 0, // Will be filled by user
        defect_quantity: 0,
        notes: '',
        // UI helpers
        item_code: item.item_code,
        item_name: item.item_name,
        spec: item.spec,
        unit: item.unit,
      }));

      // Add OUTPUT item (the product)
      const outputItem: BatchItem = {
        item_id: bom.product_item_id,
        item_type: 'OUTPUT',
        quantity: 1, // Default, user can change
        unit_price: 0,
        defect_quantity: 0,
        notes: '',
        item_code: bom.product_code,
        item_name: bom.product_name,
        spec: bom.product_spec,
        unit: bom.product_unit,
      };

      // Update form with template items
      setFormData(prev => ({
        ...prev,
        items: [...inputItems, outputItem]
      }));

      alert(`BOM 템플릿 로드 완료!\n${inputItems.length}개 투입품목, 1개 산출품목`);
    } else if (response.status === 404) {
      alert('이 고객사에 대한 기본 BOM 템플릿이 없습니다.');
    }
  } catch (error) {
    console.error('BOM 템플릿 로드 실패:', error);
    alert('BOM 템플릿을 불러오는데 실패했습니다.');
  } finally {
    setBomTemplateLoading(false);
  }
};
```

### Step 3: Add UI Elements

```tsx
// In the form, before batch_date field
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
    고객사 선택 (선택사항)
  </label>
  <div className="flex gap-2">
    <select
      value={selectedCustomerId || ''}
      onChange={(e) => setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)}
      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">-- 고객사 선택 --</option>
      {customers.map(customer => (
        <option key={customer.company_id} value={customer.company_id}>
          {customer.company_name}
        </option>
      ))}
    </select>

    <button
      type="button"
      onClick={() => selectedCustomerId && loadBomTemplate(selectedCustomerId)}
      disabled={!selectedCustomerId || bomTemplateLoading}
      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
    >
      {bomTemplateLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        'BOM 로드'
      )}
    </button>
  </div>
  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
    고객사를 선택하고 "BOM 로드" 버튼을 클릭하면 기본 BOM 템플릿이 자동으로 입력됩니다.
  </p>
</div>
```

## Benefits

1. **Time Saving**: Eliminates manual entry of repetitive BOM items for regular customers
2. **Error Reduction**: Pre-configured quantities reduce input errors
3. **Consistency**: Ensures standard BOM configurations per customer
4. **Flexibility**: Users can still modify loaded items before submission

## Database Maintenance

### Setting Default BOM for Customer
```sql
-- Set BOM 464 as default for customer 223
INSERT INTO customer_bom_templates (customer_id, bom_id, is_default)
VALUES (223, 464, true)
ON CONFLICT (customer_id, bom_id) DO UPDATE
SET is_default = true;
```

### Query Customer Templates
```sql
-- Get all templates for a customer
SELECT
  t.*,
  b.bom_id,
  p.item_name as product_name
FROM customer_bom_templates t
JOIN bom b ON t.bom_id = b.bom_id
JOIN items p ON b.parent_item_id = p.item_id
WHERE t.customer_id = 223;
```

### Unset Default
```sql
-- Remove default flag (keep template but not default)
UPDATE customer_bom_templates
SET is_default = false
WHERE customer_id = 223;
```

## Future Enhancements

1. **Multiple Templates**: Allow customers to have multiple named templates
2. **Template Versioning**: Track changes to templates over time
3. **Batch Template Application**: Apply template during batch completion, not just registration
4. **Template Analytics**: Track which templates are most frequently used
5. **Template Sharing**: Allow copying templates between customers

## API File Location
`src/app/api/customers/[customerId]/bom-template/route.ts`

## Migration File
Created via Supabase MCP: `create_customer_bom_templates` migration

## Testing Checklist
- [x] Database table created with proper constraints
- [x] Indexes created for performance
- [x] GET endpoint returns correct BOM structure
- [x] POST endpoint creates/updates templates
- [x] DELETE endpoint removes templates
- [x] Foreign key constraints work correctly
- [x] Default template logic (only one per customer)
- [ ] UI integration (optional, not completed)
- [ ] End-to-end batch registration with template

---

**Status**: ✅ Backend Complete (Database + API)
**Next Steps**: UI Integration (optional)
**Created**: 2025-11-04
**Last Updated**: 2025-11-04
