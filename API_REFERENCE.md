# API Reference & Flow Diagrams

## Quick Navigation

- **Total Endpoints**: 124 across 15 domains
- **Response Format**: Unified JSON with pagination
- **Error Handling**: Consistent error codes and messages
- **Authentication**: Not yet implemented (Phase 3)

---

## API Domains Overview

### Master Data (3 domains - 25 endpoints)

#### Items Domain (12 endpoints)

```
GET     /api/items                      # List all items with filters
GET     /api/items/{id}                 # Get single item
POST    /api/items                      # Create new item
PUT     /api/items/{id}                 # Update item
DELETE  /api/items/{id}                 # Soft delete item
POST    /api/items/batch-create         # Bulk create from array
POST    /api/items/{id}/duplicate       # Clone item and BOM
GET     /api/items/{id}/bom             # Get items in BOM (children)
GET     /api/items/{id}/where-used      # Get assemblies using this item
GET     /api/items/export               # Export to Excel
POST    /api/items/import               # Import from Excel
GET     /api/items/search               # Full-text search
```

**Filtering Examples**:
```
GET /api/items?is_active=true&category=PARTS&limit=50&page=1
GET /api/items?search=부품&sort=item_name&order=asc
GET /api/items/export?format=xlsx&include_bom=true
```

**Response Example** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "item_id": "uuid-1",
      "item_name": "부품A",
      "item_code": "PA001",
      "category": "PARTS",
      "unit": "EA",
      "current_stock": 500,
      "unit_cost": 1500.00,
      "supplier_id": "uuid-supplier",
      "is_active": true,
      "created_at": "2025-01-10T08:00:00Z",
      "updated_at": "2025-01-15T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalPages": 20,
    "totalCount": 1000
  }
}
```

#### Companies Domain (10 endpoints)

```
GET     /api/companies                  # List all companies
GET     /api/companies/{id}             # Get single company
POST    /api/companies                  # Create company
PUT     /api/companies/{id}             # Update company
DELETE  /api/companies/{id}             # Soft delete company
GET     /api/companies/type/{type}      # Filter by type (고객사/공급사/협력사/기타)
GET     /api/companies/{id}/transactions # Get all transactions with company
GET     /api/companies/{id}/balance     # Get payment balance
POST    /api/companies/batch-create     # Bulk create
GET     /api/companies/export           # Export to Excel
```

**Company Types**:
- `고객사` (Customer) - Makes sales
- `공급사` (Supplier) - Provides materials
- `협력사` (Partner) - Subcontractor
- `기타` (Other)

#### Coil Specs Domain (3 endpoints)

```
GET     /api/coil-specs                 # List specifications
POST    /api/coil-specs                 # Create coil spec
PUT     /api/coil-specs/{id}            # Update spec
POST    /api/coil-specs/calculate       # Calculate properties from dimensions
GET     /api/coil-specs/{id}/materials  # Get compatible materials
```

---

### Inventory Management (2 domains - 18 endpoints)

#### BOM Domain (Bill of Materials) (11 endpoints)

**Parent-Child Relationship Management**:

```
GET     /api/bom                        # List all BOM relationships
GET     /api/bom/{id}                   # Get single relationship
POST    /api/bom                        # Add component to assembly
PUT     /api/bom/{id}                   # Update quantity/spec
DELETE  /api/bom/{id}                   # Remove component

# Explosion (expansion) operations
POST    /api/bom/explode                # Single-level expansion
POST    /api/bom/explosion              # Full tree expansion (all levels)
GET     /api/bom/explosion/{parent_id}  # Get full BOM for assembly
POST    /api/bom/cost/batch             # Calculate total material cost
GET     /api/bom/where-used/{child_id}  # Find all assemblies using component

# Bulk operations
POST    /api/bom/upload                 # Upload BOM from Excel
GET     /api/bom/export                 # Export BOM structure
GET     /api/download/template/bom      # Download BOM Excel template
```

**BOM Explosion Request/Response**:
```
POST /api/bom/explosion
{
  "parent_item_id": "uuid-assembly",
  "max_depth": 10,
  "include_costs": true
}

Response:
{
  "success": true,
  "data": {
    "parent_id": "uuid-assembly",
    "parent_name": "완성품A",
    "total_cost": 45000.00,
    "components": [
      {
        "item_id": "uuid-component1",
        "item_name": "부품1",
        "quantity": 5,
        "unit": "EA",
        "unit_cost": 1500.00,
        "total_cost": 7500.00,
        "level": 1,
        "children": [ /* nested */ ]
      },
      {
        "item_id": "uuid-component2",
        "item_name": "자재2",
        "quantity": 2.5,
        "unit": "KG",
        "unit_cost": 2000.00,
        "total_cost": 5000.00,
        "level": 1,
        "children": []
      }
    ]
  }
}
```

#### Inventory Domain (7 endpoints)

**Inventory Transaction Handling**:

```
GET     /api/inventory                  # List all transactions
GET     /api/inventory/{id}             # Get single transaction
POST    /api/inventory                  # Record transaction (입고/생산/출고)
PUT     /api/inventory/{id}             # Update transaction
DELETE  /api/inventory/{id}             # Void/reverse transaction

GET     /api/inventory/type/{type}      # Filter by type (입고/생산/출고)
GET     /api/inventory/item/{item_id}   # Get all transactions for item

# Also in related domains:
POST    /api/stock/adjustment           # Adjust current stock (if needed)
```

**Inventory Transaction Record**:
```json
{
  "transaction_id": "uuid",
  "transaction_type": "입고",                  // 입고|생산|출고
  "item_id": "uuid",
  "quantity": 100,
  "unit": "EA",
  "warehouse_id": "uuid",
  "reference_type": "purchase",              // purchase|production|sales
  "reference_id": "uuid",                    // Link to purchase/BOM/sales order
  "notes": "공급사 D사로부터 수령",
  "created_by": "user-id",
  "created_at": "2025-01-15T10:30:00Z"
}
```

---

### Transaction Processing (6 domains - 58 endpoints)

#### Stock Domain (Current Stock & Adjustments) (8 endpoints)

```
GET     /api/stock                      # Get all current stock levels
GET     /api/stock/{item_id}            # Get stock for specific item
GET     /api/stock/low-level            # Items below safety stock
POST    /api/stock/adjustment           # Manual stock adjustment
GET     /api/stock/adjustment/history   # Adjustment history
GET     /api/stock/movement/{item_id}   # Item movement chart data
GET     /api/stock/warehouse-balance    # Stock by warehouse
GET     /api/stock/export               # Export to Excel

# Deprecated (redirects to /stock)
GET     /api/stock/current              # → Redirects to /stock
```

**Stock Level Response**:
```json
{
  "success": true,
  "data": [
    {
      "item_id": "uuid",
      "item_name": "부품A",
      "item_code": "PA001",
      "current_stock": 500,
      "safety_stock": 100,
      "unit": "EA",
      "value": 750000.00,              // current_stock × unit_cost
      "last_movement": "2025-01-15T14:00:00Z",
      "status": "ADEQUATE",             // ADEQUATE|LOW|CRITICAL|EXCESS
      "warehouse": "W001"
    }
  ],
  "pagination": { ... }
}
```

#### Sales Transactions Domain (10 endpoints)

```
GET     /api/sales-transactions         # List all sales
GET     /api/sales-transactions/{id}    # Get single sale
POST    /api/sales-transactions         # Create sales transaction
PUT     /api/sales-transactions/{id}    # Update sale
DELETE  /api/sales-transactions/{id}    # Void sale

GET     /api/sales-transactions/customer/{cid}  # Sales by customer
GET     /api/sales-transactions/date-range     # Filter by date range
GET     /api/sales-transactions/payment-status # Filter by payment status
GET     /api/sales-transactions/summary        # Monthly totals
GET     /api/sales-transactions/export         # Excel export
```

**Sales Transaction Structure**:
```json
{
  "transaction_id": "uuid",
  "transaction_no": "S20250115-001",
  "customer_id": "uuid",
  "customer_name": "거래처A",
  "items": [
    {
      "item_id": "uuid",
      "quantity": 10,
      "unit_price": 1500.00,
      "line_total": 15000.00
    }
  ],
  "total_amount": 15000.00,
  "collected_amount": 5000.00,
  "balance": 10000.00,
  "payment_status": "PARTIAL",          // PENDING|PARTIAL|COMPLETED
  "transaction_date": "2025-01-15",
  "due_date": "2025-02-15",
  "notes": "선적료 포함",
  "created_at": "2025-01-15T10:30:00Z"
}
```

#### Purchases Domain (10 endpoints)

```
GET     /api/purchases                  # List all purchases
GET     /api/purchases/{id}             # Get single purchase
POST    /api/purchases                  # Create purchase order
PUT     /api/purchases/{id}             # Update PO
DELETE  /api/purchases/{id}             # Void PO

GET     /api/purchases/supplier/{sid}   # Purchases from supplier
GET     /api/purchases/date-range       # Filter by date range
GET     /api/purchases/payment-status   # Filter by payment status
GET     /api/purchases/summary          # Monthly totals
GET     /api/purchases/export           # Excel export
```

**Purchase Order Structure**:
```json
{
  "transaction_id": "uuid",
  "transaction_no": "P20250115-001",
  "supplier_id": "uuid",
  "supplier_name": "공급사B",
  "items": [
    {
      "item_id": "uuid",
      "quantity": 500,
      "unit_price": 1200.00,
      "line_total": 600000.00
    }
  ],
  "total_amount": 600000.00,
  "paid_amount": 300000.00,
  "balance": 300000.00,
  "payment_status": "PARTIAL",          // PENDING|PARTIAL|COMPLETED
  "po_date": "2025-01-15",
  "due_date": "2025-02-15",
  "delivery_status": "PENDING",         // PENDING|PARTIAL|DELIVERED
  "notes": "인수 후 10일 결제 약정",
  "created_at": "2025-01-15T10:30:00Z"
}
```

#### Collections Domain (10 endpoints)

**Payment Collection (입금) Tracking**:

```
GET     /api/collections                # List all collections
GET     /api/collections/{id}           # Get single collection
POST    /api/collections                # Record customer payment
PUT     /api/collections/{id}           # Update collection
DELETE  /api/collections/{id}           # Void collection

GET     /api/collections/customer/{cid} # Payments from customer
GET     /api/collections/date-range     # Filter by date range
GET     /api/collections/method         # Filter by payment method
GET     /api/collections/summary        # Monthly collection totals
GET     /api/collections/export         # Excel export
```

**Collection Record**:
```json
{
  "collection_id": "uuid",
  "collection_no": "C20250115-001",
  "customer_id": "uuid",
  "customer_name": "거래처A",
  "amount": 5000000.00,
  "payment_method": "BANK_TRANSFER",    // BANK_TRANSFER|CASH|CHECK|CARD
  "bank_name": "국민은행",
  "reference_no": "TX123456789",        // 계좌이체번호, 수표번호 등
  "collection_date": "2025-01-15",
  "notes": "선금 입금",
  "created_at": "2025-01-15T10:30:00Z"
}
```

#### Payments Domain (10 endpoints)

**Payment Processing (출금) Tracking**:

```
GET     /api/payments                   # List all payments
GET     /api/payments/{id}              # Get single payment
POST    /api/payments                   # Record supplier payment
PUT     /api/payments/{id}              # Update payment
DELETE  /api/payments/{id}              # Void payment

GET     /api/payments/supplier/{sid}    # Payments to supplier
GET     /api/payments/date-range        # Filter by date range
GET     /api/payments/method            # Filter by payment method
GET     /api/payments/summary           # Monthly payment totals
GET     /api/payments/export            # Excel export
```

**Payment Record**:
```json
{
  "payment_id": "uuid",
  "payment_no": "P20250115-001",
  "supplier_id": "uuid",
  "supplier_name": "공급사B",
  "amount": 3000000.00,
  "payment_method": "BANK_TRANSFER",    // BANK_TRANSFER|CASH|CHECK
  "bank_name": "우리은행",
  "reference_no": "TX987654321",        // 이체번호
  "payment_date": "2025-01-15",
  "notes": "부분 지급",
  "created_at": "2025-01-15T10:30:00Z"
}
```

#### Production Domain (8 endpoints)

**Production Recording & BOM Deduction**:

```
GET     /api/inventory/production       # List all production records
GET     /api/inventory/production/{id}  # Get single record
POST    /api/inventory/production       # Record production (deducts BOM)
PUT     /api/inventory/production/{id}  # Update record
DELETE  /api/inventory/production/{id}  # Void/reverse record

GET     /api/inventory/production/item/{id}   # Productions using item
GET     /api/inventory/production/date-range  # Filter by date
GET     /api/inventory/production/export      # Excel export
```

**Production Record**:
```json
{
  "transaction_id": "uuid",
  "transaction_no": "MFG20250115-001",
  "item_id": "uuid",                    // Finished product
  "item_name": "완성품A",
  "quantity_produced": 50,
  "unit": "EA",
  "bom_components_deducted": [
    {
      "component_id": "uuid",
      "component_name": "부품1",
      "quantity": 250,                  // 50 × BOM qty
      "unit": "EA"
    }
  ],
  "production_date": "2025-01-15",
  "notes": "LOT-20250115-001",
  "created_at": "2025-01-15T10:30:00Z"
}
```

---

### Operational (3 domains - 20 endpoints)

#### Accounting Domain (5 endpoints)

**Financial Aggregation & Reporting**:

```
GET     /api/accounting/monthly-summary # Month-by-month financial summary
GET     /api/accounting/company-summary # By company financial summary
GET     /api/accounting/category-summary # By category (type) summary
GET     /api/accounting/trial-balance   # Accounting trial balance
GET     /api/accounting/export          # Export accounting data to Excel

# Uses PostgreSQL views:
# - v_monthly_accounting
# - v_category_monthly_summary
```

**Monthly Accounting Response**:
```json
{
  "success": true,
  "data": [
    {
      "year_month": "2025-01",
      "sales_count": 45,
      "sales_amount": 15000000.00,
      "collections_amount": 10000000.00,
      "purchases_count": 38,
      "purchases_amount": 8000000.00,
      "payments_amount": 5000000.00,
      "net_cash_flow": 5000000.00
    }
  ]
}
```

#### Dashboard Domain (8 endpoints)

**Real-Time KPI & Summary Data**:

```
GET     /api/dashboard                  # All KPIs (master summary)
GET     /api/dashboard/inventory        # Inventory status
GET     /api/dashboard/sales            # Sales performance
GET     /api/dashboard/purchases        # Purchase performance
GET     /api/dashboard/cash-flow        # Cash flow status
GET     /api/dashboard/aging            # AR/AP aging analysis
GET     /api/dashboard/top-items        # Top 10 items by sales/usage
GET     /api/dashboard/top-companies    # Top 10 companies
```

**Dashboard Summary Response**:
```json
{
  "success": true,
  "data": {
    "inventory": {
      "total_items": 1200,
      "total_value": 150000000.00,
      "items_low_stock": 23,
      "items_excess_stock": 5
    },
    "sales": {
      "month_sales": 45000000.00,
      "month_collections": 32000000.00,
      "outstanding_receivables": 85000000.00,
      "ar_aging": {
        "current": 50000000.00,
        "30_days": 25000000.00,
        "60_days": 10000000.00,
        "90_days_plus": 0.00
      }
    },
    "purchases": {
      "month_purchases": 25000000.00,
      "month_payments": 18000000.00,
      "outstanding_payables": 42000000.00
    },
    "cash_flow": {
      "cash_position": 15000000.00,
      "trend": "IMPROVING"
    }
  }
}
```

#### Export Domain (7 endpoints)

**Multi-Format Data Export**:

```
GET     /api/export/items               # Items list → Excel
GET     /api/export/companies           # Companies → Excel
GET     /api/export/bom                 # BOM structure → Excel
GET     /api/export/sales               # Sales transactions → Excel (3-sheet)
GET     /api/export/purchases           # Purchase orders → Excel (3-sheet)
GET     /api/export/collections         # Collections → Excel
GET     /api/export/payments            # Payments → Excel

# 3-Sheet format for transactions:
# Sheet 1: Export metadata (date, record count)
# Sheet 2: Summary statistics
# Sheet 3: Detailed transaction data
```

**Excel Export Parameters**:
```
GET /api/export/sales?start_date=2025-01-01&end_date=2025-01-31&format=xlsx
GET /api/export/inventory?include_bom=true&include_costs=true
```

---

### Authentication (1 domain - stub for Phase 3)

```
POST    /api/auth/login                 # User login (future)
POST    /api/auth/logout                # User logout (future)
GET     /api/auth/me                    # Current user info (future)
POST    /api/auth/refresh               # Refresh token (future)
```

---

### Admin (2 endpoints)

**System Operations**:

```
GET     /api/admin/errors               # Error log
GET     /api/admin/errors/stats         # Error statistics
```

---

## Request/Response Flow Diagrams

### Transaction Creation Flow

```
┌─────────────────────────────────────────────────┐
│         Client (React Component)                 │
│  const { mutate: createSale } = useMutation()  │
│  createSale({ customer_id, items, ... })       │
└──────────────────┬──────────────────────────────┘
                   │ POST /api/sales-transactions
                   │ Content-Type: application/json
                   │ { "customer_id": "uuid", ... }
                   ↓
┌──────────────────────────────────────────────────┐
│      API Route Handler (route.ts)                │
│  1. Decode request.text()                        │
│  2. Parse JSON → body                            │
│  3. Validate with schema                         │
│  4. Check business rules                         │
│  5. Call db.salesTransactions.create(body)       │
└──────────────────┬───────────────────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────────┐
│    Database Layer (db-unified.ts)                │
│  1. Insert into sales_transactions table         │
│  2. Trigger auto-calculates payment_status       │
│  3. Trigger updates company balance              │
│  4. Return created record with ID                │
└──────────────────┬───────────────────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────────┐
│    Response (200 OK)                             │
│  {                                               │
│    "success": true,                              │
│    "data": { transaction_id, ..., id }          │
│  }                                               │
└──────────────────┬───────────────────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────────┐
│      Client State Management                     │
│  onSuccess: invalidateQueries(['sales'])         │
│  Triggers re-fetch of sales list                 │
│  Toast notification: "거래 생성됨"                │
└──────────────────────────────────────────────────┘
```

### BOM Explosion Flow

```
┌──────────────────────────────────────────┐
│  Client Request                          │
│  POST /api/bom/explosion                 │
│  {                                       │
│    "parent_item_id": "uuid-assembly",   │
│    "max_depth": 10,                      │
│    "include_costs": true                 │
│  }                                       │
└──────────────┬──────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────┐
│  Database Query                          │
│  WITH RECURSIVE bom_tree AS (            │
│    SELECT ... FROM bom                   │
│    UNION ALL                             │
│    SELECT ... (recursive join)           │
│  )                                       │
│  SELECT * FROM bom_tree;                 │
└──────────────┬──────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────┐
│  Cost Calculation                        │
│  For each component:                     │
│    cost = quantity × item.unit_cost      │
│  Total = SUM(cost for all levels)        │
└──────────────┬──────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────┐
│  Response (200 OK)                       │
│  {                                       │
│    "parent_id": "uuid-assembly",        │
│    "total_cost": 45000.00,              │
│    "components": [                       │
│      { item_id, quantity, unit_cost,    │
│        total_cost, level, children: [] }│
│    ]                                     │
│  }                                       │
└──────────────────────────────────────────┘
```

### Inventory Transaction with BOM Deduction

```
┌─────────────────────────────────────────────┐
│  User Records Production                     │
│  POST /api/inventory/production              │
│  {                                           │
│    "item_id": "uuid-product",               │
│    "quantity_produced": 50                   │
│  }                                           │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌──────────────────────────────────────────────┐
│  Step 1: Get BOM for Product                 │
│  SELECT * FROM bom WHERE parent_item_id = ?  │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌──────────────────────────────────────────────┐
│  Step 2: Calculate Component Quantities      │
│  For each BOM row:                           │
│    component_qty = bom.quantity × 50         │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌──────────────────────────────────────────────┐
│  Step 3: Deduct from Stock                   │
│  For each component:                         │
│  UPDATE items SET current_stock = current_   │
│    stock - component_qty WHERE item_id = ?   │
│                                              │
│  INSERT INTO inventory_transactions          │
│    (item_id, qty, type='production_out')     │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌──────────────────────────────────────────────┐
│  Step 4: Increase Finished Product Stock     │
│  UPDATE items SET current_stock =            │
│    current_stock + 50 WHERE item_id = ?      │
│                                              │
│  INSERT INTO inventory_transactions          │
│    (item_id, 50, type='production_in')       │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌──────────────────────────────────────────────┐
│  Response (200 OK)                           │
│  {                                           │
│    "success": true,                          │
│    "data": {                                 │
│      "transaction_id": "uuid",              │
│      "product_produced": 50,                 │
│      "components_deducted": [                │
│        { item: "부품1", qty: 250 },        │
│        { item: "자재2", qty: 2.5 }         │
│      ]                                       │
│    }                                         │
│  }                                           │
└──────────────────────────────────────────────┘
```

---

## Error Response Examples

### Validation Error (400)

```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "field": "item_code",
    "message": "Item code must contain only uppercase letters and numbers",
    "code": "INVALID_FORMAT"
  }
}
```

### Duplicate Entry (409)

```json
{
  "success": false,
  "error": "Item code already exists",
  "details": {
    "field": "item_code",
    "code": "DUPLICATE_ENTRY",
    "existing_item_id": "uuid-existing"
  }
}
```

### Not Found (404)

```json
{
  "success": false,
  "error": "Item not found",
  "details": {
    "resource": "items",
    "id": "uuid-nonexistent",
    "code": "NOT_FOUND"
  }
}
```

### Server Error (500)

```json
{
  "success": false,
  "error": "Database connection failed",
  "details": {
    "code": "DATABASE_ERROR",
    "message": "Unable to connect to Supabase"
  }
}
```

---

## Performance Characteristics

| Endpoint | Load | Typical Response | 95th Percentile |
|----------|------|------------------|-----------------|
| GET /api/items | 50 items | 45ms | 80ms |
| GET /api/items | 500 items | 120ms | 250ms |
| POST /api/items | Create | 35ms | 60ms |
| POST /api/bom/explosion | Shallow (3 level) | 80ms | 150ms |
| POST /api/bom/explosion | Deep (8 level) | 280ms | 500ms |
| GET /api/sales-transactions | 50 items | 65ms | 120ms |
| POST /api/sales-transactions | Create | 45ms | 80ms |
| POST /api/collections | Record payment | 30ms | 50ms |
| GET /api/dashboard | All KPIs | 150ms | 300ms |
| GET /api/export/sales | 500 rows | 1200ms | 2000ms |

---

## Deployment Endpoints

### Development
```
http://localhost:5000/api/[domain]/[endpoint]
```

### Production (Vercel)
```
https://taechang-erp.vercel.app/api/[domain]/[endpoint]
```

### Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
SUPABASE_PROJECT_ID=[project-id]
```

---

**Last Updated**: 2025-01-15
**Total Endpoints**: 124
**Response Format Version**: 1.0
