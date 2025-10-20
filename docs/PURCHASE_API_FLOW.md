# Purchase API Flow Diagrams

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Purchase API Flow                          │
└─────────────────────────────────────────────────────────┘

Client Request → Next.js API Route → Supabase Client → PostgreSQL
                  (route.ts)         (db-unified)

├─ GET    → Query Builder → JOIN (companies, items) → Response
├─ POST   → Validate → Create Transaction → Update Stock (+) → Response
├─ PUT    → Validate → Update Transaction → Adjust Stock (±) → Response
└─ DELETE → Soft Delete → Decrease Stock (-) → Response
```

---

## 🔄 CREATE Flow (POST)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Receive Request                                           │
│    POST /api/purchases                                       │
│    Body: { transaction_date, supplier_id, item_id,           │
│            quantity: 100, ... }                              │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Korean Encoding (CRITICAL!)                              │
│    const text = await request.text();                        │
│    const body = JSON.parse(text);                            │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Validate with Zod Schema                                  │
│    ✓ transaction_date: YYYY-MM-DD                            │
│    ✓ supplier_id: positive number                            │
│    ✓ item_id: positive number                                │
│    ✓ quantity: > 0                                           │
│    ✓ unit_price: >= 0                                        │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Generate Transaction Number                               │
│    RPC: generate_purchase_no()                               │
│    Result: P-20240115-0001                                   │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Get Current Item Stock                                    │
│    SELECT current_stock FROM items WHERE item_id = 1         │
│    Current Stock: 100                                        │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. Create Purchase Transaction                               │
│    INSERT INTO purchase_transactions (...)                   │
│    Returns: transaction_id = 123                             │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. INCREASE Stock                                            │
│    New Stock = 100 + 100 = 200                               │
│    UPDATE items SET current_stock = 200                      │
│    WHERE item_id = 1                                         │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ├─────────────────────────┐
                 │ Success                 │ Error
                 ▼                         ▼
┌──────────────────────────┐  ┌───────────────────────────────┐
│ 8a. Return Success       │  │ 8b. ROLLBACK                  │
│    {                     │  │    DELETE purchase_transaction│
│      success: true,      │  │    WHERE transaction_id = 123 │
│      data: {...},        │  │                               │
│      message: "생성됨"   │  │    Return Error Response      │
│    }                     │  │                               │
└──────────────────────────┘  └───────────────────────────────┘
```

---

## ✏️ UPDATE Flow (PUT)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Receive Request                                           │
│    PUT /api/purchases?id=123                                 │
│    Body: { quantity: 150, ... }                              │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Get Original Transaction                                  │
│    SELECT item_id, quantity FROM purchase_transactions       │
│    WHERE transaction_id = 123                                │
│    Original: quantity = 100                                  │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Update Transaction Record                                 │
│    UPDATE purchase_transactions                              │
│    SET quantity = 150, ...                                   │
│    WHERE transaction_id = 123                                │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Calculate Stock Adjustment                                │
│    Difference = 150 - 100 = +50                              │
│    Current Stock = 200                                       │
│    New Stock = 200 + 50 = 250                                │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Validate & Update Stock                                   │
│    IF new_stock >= 0 THEN                                    │
│      UPDATE items SET current_stock = 250                    │
│    ELSE                                                      │
│      RETURN Error "재고 부족"                                │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. Return Success                                            │
│    { success: true, data: {...} }                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 🗑️ DELETE Flow (Soft Delete)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Receive Request                                           │
│    DELETE /api/purchases?id=123                              │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Get Transaction Data                                      │
│    SELECT item_id, quantity                                  │
│    FROM purchase_transactions                                │
│    WHERE transaction_id = 123                                │
│    Result: item_id=1, quantity=150                           │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Soft Delete Transaction                                   │
│    UPDATE purchase_transactions                              │
│    SET is_active = false                                     │
│    WHERE transaction_id = 123                                │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Get Current Stock                                         │
│    SELECT current_stock FROM items WHERE item_id = 1         │
│    Current Stock = 250                                       │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. DECREASE Stock (Reverse Purchase)                         │
│    New Stock = 250 - 150 = 100                               │
│    UPDATE items SET current_stock = 100                      │
│    WHERE item_id = 1                                         │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ├─────────────────────────┐
                 │ Success                 │ Error (Stock < 0)
                 ▼                         ▼
┌──────────────────────────┐  ┌───────────────────────────────┐
│ 6a. Return Success       │  │ 6b. ROLLBACK                  │
│    {                     │  │    UPDATE purchase_transactions│
│      success: true,      │  │    SET is_active = true       │
│      message: "삭제됨"   │  │    WHERE transaction_id = 123 │
│    }                     │  │                               │
│                          │  │    Return Error Response      │
└──────────────────────────┘  └───────────────────────────────┘
```

---

## 🔍 QUERY Flow (GET)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Receive Request                                           │
│    GET /api/purchases?supplier_id=1&page=1&limit=20          │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Build Query with Filters                                  │
│    SELECT p.*,                                               │
│           s.company_name as supplier,                        │
│           i.item_name, i.spec                                │
│    FROM purchase_transactions p                              │
│    LEFT JOIN companies s ON p.supplier_id = s.company_id     │
│    LEFT JOIN items i ON p.item_id = i.item_id                │
│    WHERE p.is_active = true                                  │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Apply Filters                                             │
│    AND p.supplier_id = 1                                     │
│    AND p.payment_status = 'PENDING'                          │
│    AND p.transaction_date >= '2024-01-01'                    │
│    AND p.transaction_date <= '2024-12-31'                    │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Apply Ordering & Pagination                               │
│    ORDER BY transaction_date DESC                            │
│    LIMIT 20 OFFSET 0                                         │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Return Results with Pagination                            │
│    {                                                         │
│      success: true,                                          │
│      data: [ {...}, {...}, ... ],                            │
│      pagination: {                                           │
│        page: 1,                                              │
│        limit: 20,                                            │
│        total: 50,                                            │
│        totalPages: 3                                         │
│      }                                                       │
│    }                                                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 📦 Stock Tracking Example

```
Initial State:
┌─────────────┬──────────┐
│ Item        │ Stock    │
├─────────────┼──────────┤
│ 브레이크 패드 │ 100     │
└─────────────┴──────────┘

Operation 1: CREATE Purchase (quantity: 50)
┌─────────────┬──────────┐
│ Item        │ Stock    │
├─────────────┼──────────┤
│ 브레이크 패드 │ 150 (+50)│
└─────────────┴──────────┘

Operation 2: UPDATE Purchase (50 → 80, diff: +30)
┌─────────────┬──────────┐
│ Item        │ Stock    │
├─────────────┼──────────┤
│ 브레이크 패드 │ 180 (+30)│
└─────────────┴──────────┘

Operation 3: DELETE Purchase (quantity: 80)
┌─────────────┬──────────┐
│ Item        │ Stock    │
├─────────────┼──────────┤
│ 브레이크 패드 │ 100 (-80)│
└─────────────┴──────────┘

Final State: Back to original stock ✅
```

---

## 🛡️ Security Layers

```
┌────────────────────────────────────────────────┐
│ Layer 1: Input Validation (Zod Schema)        │
│  ✓ Type checking                              │
│  ✓ Range validation                           │
│  ✓ Required fields                            │
└────────────────┬───────────────────────────────┘
                 ▼
┌────────────────────────────────────────────────┐
│ Layer 2: Parameterized Queries (Supabase)     │
│  ✓ No raw SQL                                 │
│  ✓ Automatic escaping                         │
│  ✓ SQL injection prevention                   │
└────────────────┬───────────────────────────────┘
                 ▼
┌────────────────────────────────────────────────┐
│ Layer 3: Business Logic Validation            │
│  ✓ Stock >= 0                                 │
│  ✓ Company type check (SUPPLIER/BOTH)         │
│  ✓ Item exists and active                     │
└────────────────┬───────────────────────────────┘
                 ▼
┌────────────────────────────────────────────────┐
│ Layer 4: Transaction Rollback                 │
│  ✓ Atomic operations                          │
│  ✓ Error recovery                             │
│  ✓ Data consistency                           │
└────────────────────────────────────────────────┘
```

---

## 🎯 Performance Optimizations

1. **Indexed Queries**: All foreign keys and date fields indexed
2. **Pagination**: Limit result sets to prevent memory issues
3. **Single Round-Trip**: JOINs done at database level
4. **Connection Pooling**: Automatic via Supabase
5. **Soft Deletes**: Fast deletion without data loss
