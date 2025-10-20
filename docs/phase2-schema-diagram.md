# Phase 2 Schema Architecture Diagram

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         COMPANIES TABLE                         │
│                         (Extended Phase 2)                      │
├─────────────────────────────────────────────────────────────────┤
│ PK  company_id               UUID                               │
│     company_code             VARCHAR(50)      [UNIQUE]          │
│     company_name             VARCHAR(200)                       │
│     business_number          VARCHAR(20)                        │
│     representative           VARCHAR(100)                       │
│     contact                  VARCHAR(50)                        │
│     email                    VARCHAR(100)                       │
│     address                  TEXT                               │
│ >>> company_category         VARCHAR(50)      [NEW - Phase 2]  │
│ >>> business_info            JSONB            [NEW - Phase 2]  │
│     is_active                BOOLEAN                            │
│     created_at               TIMESTAMP                          │
│     updated_at               TIMESTAMP                          │
├─────────────────────────────────────────────────────────────────┤
│ CHECK: company_category IN (                                    │
│   '협력업체-원자재', '협력업체-외주', '소모품업체', '기타'        │
│ )                                                               │
│                                                                 │
│ INDEXES:                                                        │
│   - idx_companies_category (B-tree, partial on is_active)      │
│   - idx_companies_business_info (GIN for JSONB queries)        │
└─────────────────────────────────────────────────────────────────┘
                    │                          │
                    │                          │
           ┌────────┴────────┐        ┌────────┴────────┐
           │                 │        │                 │
           ▼                 │        │                 ▼
┌──────────────────────┐     │        │     ┌──────────────────────┐
│ SALES_TRANSACTIONS   │     │        │     │ PURCHASE_TRANSACTIONS│
├──────────────────────┤     │        │     ├──────────────────────┤
│ transaction_id       │     │        │     │ transaction_id       │
│ transaction_no       │     │        │     │ transaction_no       │
│ transaction_date     │─────┘        └─────│ transaction_date     │
│ customer_id (FK) ────┘                    │ supplier_id (FK) ────┘
│ total_amount         │                    │ total_amount         │
│ collected_amount     │                    │ paid_amount          │
│ payment_status       │                    │ payment_status       │
│ is_active            │                    │ is_active            │
└──────────────────────┘                    └──────────────────────┘
           │                                            │
           │                                            │
           └──────────────┬─────────────────────────────┘
                          │
                          │ Aggregated by TO_CHAR(date, 'YYYY-MM')
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    v_monthly_accounting VIEW                    │
│                         (Phase 2)                               │
├─────────────────────────────────────────────────────────────────┤
│ month                    TEXT           (YYYY-MM format)        │
│ company_id               UUID                                   │
│ company_code             VARCHAR                                │
│ company_name             VARCHAR                                │
│ company_category         VARCHAR        [From companies]        │
│ business_info            JSONB          [From companies]        │
│ business_number          VARCHAR                                │
│ representative           VARCHAR                                │
│ sales_amount             NUMERIC        [SUM from sales]        │
│ sales_count              BIGINT         [COUNT from sales]      │
│ purchase_amount          NUMERIC        [SUM from purchases]    │
│ purchase_count           BIGINT         [COUNT from purchases]  │
│ net_amount               NUMERIC        [sales - purchases]     │
├─────────────────────────────────────────────────────────────────┤
│ Logic:                                                          │
│ - CTEs for sales_monthly and purchase_monthly                   │
│ - LEFT JOINs to include companies with sales OR purchases       │
│ - Only is_active = true companies and transactions              │
│ - Ordered by month DESC, company_name ASC                       │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ GROUP BY month, company_category
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              v_category_monthly_summary VIEW                    │
│                         (Phase 2)                               │
├─────────────────────────────────────────────────────────────────┤
│ month                            TEXT                           │
│ company_category                 VARCHAR                        │
│ total_sales                      NUMERIC    [SUM]               │
│ total_sales_transactions         BIGINT     [SUM]               │
│ total_purchases                  NUMERIC    [SUM]               │
│ total_purchase_transactions      BIGINT     [SUM]               │
│ net_amount                       NUMERIC    [SUM]               │
│ company_count                    BIGINT     [COUNT DISTINCT]    │
│ avg_sales_per_company           NUMERIC    [AVG, ROUNDED]      │
│ avg_purchase_per_company        NUMERIC    [AVG, ROUNDED]      │
│ sales_percentage                NUMERIC    [Window function]   │
│ purchase_percentage             NUMERIC    [Window function]   │
├─────────────────────────────────────────────────────────────────┤
│ Logic:                                                          │
│ - Built on v_monthly_accounting                                 │
│ - Aggregates by month and company_category                      │
│ - Window functions for percentage calculations                  │
│ - Ordered by month DESC, company_category ASC                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INPUT                               │
│   (Company Category & Business Info via UI/API/Excel)          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              PUT /api/companies/:id/category                    │
│   Request Body: { company_category, business_info }            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   COMPANIES TABLE UPDATE                        │
│   UPDATE companies SET                                          │
│     company_category = '협력업체-원자재',                         │
│     business_info = { ... }                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ (Background: Transactions continue)
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
┌──────────────────────┐      ┌──────────────────────┐
│ Sales Transactions   │      │ Purchase Transactions│
│ (Ongoing Operations) │      │ (Ongoing Operations) │
└──────────┬───────────┘      └───────────┬──────────┘
           │                              │
           └──────────────┬───────────────┘
                          │
                          ▼
           ┌──────────────────────────────────┐
           │   Monthly Aggregation Queries    │
           │   (View: v_monthly_accounting)   │
           └──────────────┬───────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                GET /api/accounting/monthly-summary              │
│   Query Params: start_month, end_month, company_category       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RESPONSE TO CLIENT                          │
│   { success: true, data: [...], pagination: {...} }            │
└─────────────────────────────────────────────────────────────────┘
```

## JSONB Structure Visualization

```
companies.business_info (JSONB)
│
├── "business_type"      → "제조업" (Manufacturing)
│                        → "도매업" (Wholesale)
│                        → "서비스업" (Service)
│
├── "business_item"      → "자동차부품" (Auto parts)
│                        → "금형가공" (Mold processing)
│                        → "산업용품" (Industrial goods)
│
└── "main_products"      → "엔진부품, 구동계부품" (Engine parts, drivetrain)
                         → "프레스가공, 용접" (Press work, welding)
                         → "공구, 소모품" (Tools, consumables)

Example JSON:
{
  "business_type": "제조업",
  "business_item": "자동차부품",
  "main_products": "엔진부품, 구동계부품, 샤시부품"
}
```

## Category Classification Tree

```
Company Categories (company_category)
│
├── 협력업체-원자재 (Raw Materials Supplier)
│   ├── Examples: Steel suppliers, plastic manufacturers
│   └── Typical business_type: 제조업 (Manufacturing)
│
├── 협력업체-외주 (Outsourcing Supplier)
│   ├── Examples: Processing plants, assembly contractors
│   └── Typical business_type: 제조업 (Manufacturing)
│
├── 소모품업체 (Consumables Supplier)
│   ├── Examples: Tools vendors, maintenance suppliers
│   └── Typical business_type: 도매업 (Wholesale)
│
└── 기타 (Other)
    ├── Examples: Logistics, consulting, services
    └── Typical business_type: 서비스업 (Service)
```

## View Query Performance Path

```
User Query: GET /api/accounting/monthly-summary?month=2025-10&category=협력업체-원자재
│
└─► Supabase Client Query
    │
    ├─► View: v_monthly_accounting
    │   │
    │   ├─► Index Scan: idx_companies_category
    │   │   (Fast lookup: WHERE company_category = '협력업체-원자재')
    │   │
    │   ├─► CTE: sales_monthly
    │   │   │
    │   │   └─► Aggregate: SUM(total_amount), COUNT(*)
    │   │       GROUP BY TO_CHAR(transaction_date, 'YYYY-MM'), customer_id
    │   │       WHERE is_active = true
    │   │
    │   ├─► CTE: purchase_monthly
    │   │   │
    │   │   └─► Aggregate: SUM(total_amount), COUNT(*)
    │   │       GROUP BY TO_CHAR(transaction_date, 'YYYY-MM'), supplier_id
    │   │       WHERE is_active = true
    │   │
    │   └─► LEFT JOIN companies
    │       (Uses primary key: company_id)
    │
    └─► Result Set (Optimized)
        ├─► Filter: month = '2025-10'
        ├─► Filter: company_category = '협력업체-원자재'
        └─► Order: month DESC, company_name ASC

Performance:
✓ Index scan on category: <5ms
✓ Monthly aggregation CTEs: <30ms
✓ Total query time: <50ms (typical)
```

## Integration Points for Frontend

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND COMPONENTS                          │
└─────────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│  Company Form  │ │ Accounting Page│ │   Dashboard    │
│  (Master Data) │ │  (Reporting)   │ │    (Summary)   │
└────────┬───────┘ └────────┬───────┘ └────────┬───────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│  Category      │ │  Monthly Table │ │  KPI Cards     │
│  Dropdown      │ │  with Filters  │ │  & Charts      │
│  (4 options)   │ │  (Virtual Grid)│ │  (Real-time)   │
└────────┬───────┘ └────────┬───────┘ └────────┬───────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Business Info  │ │ Export to      │ │ Growth Rate    │
│ Fields (JSONB) │ │ Excel (Korean) │ │ Indicators     │
└────────────────┘ └────────────────┘ └────────────────┘
```

## Data Volume Projections

```
Current State (Phase 1):
├── Companies: ~500 records
├── Sales Transactions: ~5,000 records (monthly: ~200)
├── Purchase Transactions: ~8,000 records (monthly: ~300)
└── Total Monthly Rows: ~500 transactions/month

After 1 Year:
├── Companies: ~800 records
├── Sales Transactions: ~60,000 records (cumulative)
├── Purchase Transactions: ~100,000 records (cumulative)
└── v_monthly_accounting: ~9,600 rows (800 companies × 12 months)
    └── Performance: Still fast (<100ms) with indexes

After 3 Years:
├── Companies: ~1,200 records
├── Sales Transactions: ~180,000 records (cumulative)
├── Purchase Transactions: ~300,000 records (cumulative)
└── v_monthly_accounting: ~43,200 rows (1,200 companies × 36 months)
    └── Performance: May need materialized view (~200ms threshold)

Materialized View Threshold: ~50K rows in v_monthly_accounting
```

## Migration Safety Features

```
Migration Script: 20251011154500_phase2_accounting_schema.sql
│
├─► Safe Column Addition
│   ├── ADD COLUMN IF NOT EXISTS company_category
│   │   └─► Nullable: existing records unaffected
│   │
│   └── ADD COLUMN IF NOT EXISTS business_info
│       └─► Default '{}'::jsonb: no data loss
│
├─► Safe Index Creation
│   ├── CREATE INDEX IF NOT EXISTS idx_companies_category
│   │   └─► Concurrent-safe, partial index (is_active = true)
│   │
│   └── CREATE INDEX IF NOT EXISTS idx_companies_business_info
│       └─► GIN index for JSONB queries
│
├─► Safe View Creation
│   ├── DROP VIEW IF EXISTS v_monthly_accounting CASCADE
│   │   └─► Re-runnable, no side effects
│   │
│   └── DROP VIEW IF EXISTS v_category_monthly_summary CASCADE
│       └─► Cascades to dependent objects safely
│
└─► Rollback Support
    └─► Complete rollback script provided in docs
        └─► No permanent data loss (only category/business_info)
```

## Monitoring and Observability

```
Performance Metrics to Track:
│
├─► Database Metrics
│   ├── View query execution time (<50ms target)
│   ├── Index hit rate (>95% target)
│   ├── Category filter usage (should use idx_companies_category)
│   └── JSONB query performance (should use GIN index)
│
├─► Application Metrics
│   ├── API response time (<200ms target)
│   ├── Monthly summary endpoint usage
│   ├── Category update frequency
│   └── Dashboard refresh rate
│
└─► Business Metrics
    ├── Category distribution (% companies in each category)
    ├── business_info completion rate (% with data)
    ├── Monthly transaction volume growth
    └── Category-wise revenue trends
```

---

**Diagram Version**: 1.0
**Last Updated**: 2025-10-11 15:45:00
**Format**: ASCII Art for terminal/markdown compatibility
