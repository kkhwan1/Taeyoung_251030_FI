# Purchase API Quick Reference

## Endpoint: `/api/purchases`

### 📥 GET - List Purchases
```bash
GET /api/purchases?page=1&limit=20&supplier_id=1&payment_status=PENDING
```

**Response:**
```json
{
  "success": true,
  "data": [ /* purchase transactions */ ],
  "pagination": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 }
}
```

### ➕ POST - Create Purchase (Stock +)
```bash
POST /api/purchases
Content-Type: application/json

{
  "transaction_date": "2024-01-15",
  "supplier_id": 1,
  "item_id": 1,
  "item_name": "품목명",
  "quantity": 100,
  "unit_price": 1000,
  "supply_amount": 100000,
  "tax_amount": 10000,
  "total_amount": 110000
}
```

**What Happens:**
1. ✅ Creates purchase record
2. ✅ Generates transaction number (P-20240115-0001)
3. ✅ **INCREASES item stock by quantity**
4. ✅ Rollback on error

### ✏️ PUT - Update Purchase (Stock Adjust)
```bash
PUT /api/purchases?id=123
Content-Type: application/json

{
  "quantity": 150,
  "unit_price": 1200
}
```

**What Happens:**
1. ✅ Updates purchase record
2. ✅ **Adjusts stock** (new_quantity - old_quantity)
3. ✅ Validates stock won't go negative

### 🗑️ DELETE - Delete Purchase (Stock -)
```bash
DELETE /api/purchases?id=123
```

**What Happens:**
1. ✅ Soft deletes (is_active = false)
2. ✅ **DECREASES item stock by quantity**
3. ✅ Validates stock won't go negative
4. ✅ Rollback on error

---

## Stock Management Summary

| Action | Stock Change | Example |
|--------|--------------|---------|
| **CREATE** | +quantity | Stock: 100 → Purchase 50 → Stock: 150 |
| **UPDATE** | ±difference | Stock: 150 → Change 50→80 (+30) → Stock: 180 |
| **DELETE** | -quantity | Stock: 180 → Delete 80 → Stock: 100 |

---

## Required Fields

```typescript
{
  transaction_date: string;  // YYYY-MM-DD
  supplier_id: number;       // Must be SUPPLIER or BOTH type
  item_id: number;           // Must exist and be active
  item_name: string;         // Required
  quantity: number;          // Must be > 0
  unit_price: number;        // Must be >= 0
  supply_amount: number;     // Must be >= 0
  total_amount: number;      // Must be >= 0
}
```

## Optional Fields
- `spec`, `unit`, `vehicle_model`, `material_type`
- `tax_amount` (default: 0)
- `payment_status` (default: PENDING)
- `payment_amount`, `balance_amount`
- `description`, `reference_no`

---

## Error Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 400 | Validation error, missing fields, negative stock |
| 404 | Transaction not found |
| 500 | Server error, database error |

---

## Testing

```bash
npm run test:api  # Run API tests
npm run test      # Run all tests
```

Test file: `src/__tests__/api/purchases.test.ts`
