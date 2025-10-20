# Phase 2 Accounting API - Quick Reference Card

## Database Schema Quick Reference

### Companies Table - New Columns

```typescript
company_category: '협력업체-원자재' | '협력업체-외주' | '소모품업체' | '기타' | null
business_info: {
  business_type?: string;    // 업태 (e.g., 제조업, 도매업)
  business_item?: string;    // 종목 (e.g., 자동차부품, 금형가공)
  main_products?: string;    // 주요품목 (e.g., 엔진부품, 구동계부품)
}
```

### View: v_monthly_accounting

```sql
-- Columns (13 total)
month, company_id, company_code, company_name, company_category, business_info,
business_number, representative, sales_amount, sales_count, purchase_amount,
purchase_count, net_amount
```

### View: v_category_monthly_summary

```sql
-- Columns (12 total)
month, company_category, total_sales, total_sales_transactions, total_purchases,
total_purchase_transactions, net_amount, company_count, avg_sales_per_company,
avg_purchase_per_company, sales_percentage, purchase_percentage
```

---

## API Endpoints to Implement

### 1. GET /api/accounting/monthly-summary

**Purpose**: Query monthly accounting by company

**Query Parameters**:
```typescript
{
  start_month?: string;        // YYYY-MM format
  end_month?: string;          // YYYY-MM format
  company_category?: string;   // Filter by category
  company_code?: string;       // Filter by specific company
  company_name?: string;       // Search company name (ILIKE)
  min_sales_amount?: number;   // Minimum sales filter
  order_by?: 'month' | 'sales_amount' | 'purchase_amount' | 'net_amount';
  order_direction?: 'asc' | 'desc';
  page?: number;
  limit?: number;              // Default 20, max 100
}
```

**Response**:
```typescript
{
  success: true,
  data: MonthlyAccounting[],
  pagination: {
    page: 1,
    limit: 20,
    total_pages: 5,
    total_count: 87
  }
}
```

**Implementation Example**:
```typescript
// src/app/api/accounting/monthly-summary/route.ts
import { getSupabaseClient } from '@/lib/db-supabase';

export async function GET(request: Request) {
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);

  let query = supabase
    .from('v_monthly_accounting')
    .select('*', { count: 'exact' });

  // Apply filters
  const start_month = searchParams.get('start_month');
  const end_month = searchParams.get('end_month');
  const category = searchParams.get('company_category');

  if (start_month) query = query.gte('month', start_month);
  if (end_month) query = query.lte('month', end_month);
  if (category) query = query.eq('company_category', category);

  // Pagination
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  return Response.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
      total_count: count || 0
    }
  });
}
```

---

### 2. GET /api/accounting/category-summary

**Purpose**: Query category-level monthly summaries

**Query Parameters**:
```typescript
{
  start_month?: string;        // YYYY-MM format
  end_month?: string;          // YYYY-MM format
  company_category?: string;   // Filter by specific category
  order_by?: 'month' | 'total_sales' | 'total_purchases' | 'net_amount';
  order_direction?: 'asc' | 'desc';
}
```

**Response**:
```typescript
{
  success: true,
  data: CategoryMonthlySummary[]
}
```

**Implementation Example**:
```typescript
// src/app/api/accounting/category-summary/route.ts
import { getSupabaseClient } from '@/lib/db-supabase';

export async function GET(request: Request) {
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);

  let query = supabase
    .from('v_category_monthly_summary')
    .select('*');

  // Apply filters
  const start_month = searchParams.get('start_month');
  const end_month = searchParams.get('end_month');
  const category = searchParams.get('company_category');

  if (start_month) query = query.gte('month', start_month);
  if (end_month) query = query.lte('month', end_month);
  if (category) query = query.eq('company_category', category);

  // Default ordering
  const orderBy = searchParams.get('order_by') || 'month';
  const orderDir = searchParams.get('order_direction') || 'desc';
  query = query.order(orderBy, { ascending: orderDir === 'asc' });

  const { data, error } = await query;

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, data });
}
```

---

### 3. PUT /api/companies/:id/category

**Purpose**: Update company category and business info

**Request Body**:
```typescript
{
  company_category: '협력업체-원자재' | '협력업체-외주' | '소모품업체' | '기타';
  business_info?: {
    business_type?: string;
    business_item?: string;
    main_products?: string;
  };
}
```

**Response**:
```typescript
{
  success: true,
  data: CompanyExtended
}
```

**Implementation Example**:
```typescript
// src/app/api/companies/[id]/category/route.ts
import { getSupabaseClient } from '@/lib/db-supabase';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseClient();

  // CRITICAL: Use text() + JSON.parse() for Korean text
  const text = await request.text();
  const { company_category, business_info } = JSON.parse(text);

  // Validate category
  const validCategories = [
    '협력업체-원자재',
    '협력업체-외주',
    '소모품업체',
    '기타'
  ];

  if (company_category && !validCategories.includes(company_category)) {
    return Response.json(
      { success: false, error: 'Invalid company category' },
      { status: 400 }
    );
  }

  // Update company
  const { data, error } = await supabase
    .from('companies')
    .update({
      company_category,
      business_info: business_info || {},
      updated_at: new Date().toISOString()
    })
    .eq('company_id', params.id)
    .select()
    .single();

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, data });
}
```

---

### 4. GET /api/accounting/dashboard

**Purpose**: Get comprehensive dashboard summary

**Query Parameters**:
```typescript
{
  month?: string;  // Default: current month (YYYY-MM)
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    current_month: '2025-10',
    sales_growth_rate: 15.3,      // % vs previous month
    purchase_growth_rate: -5.2,   // % vs previous month
    category_summaries: CategoryMonthlySummary[],  // Current month only
    top_companies: MonthlyAccounting[],            // Top 10 by net_amount
    monthly_trend: [                               // Last 12 months
      { month: '2025-10', total_sales: 50000000, total_purchases: 30000000, net_amount: 20000000 },
      // ... more months
    ]
  }
}
```

**Implementation Example**:
```typescript
// src/app/api/accounting/dashboard/route.ts
import { getSupabaseClient } from '@/lib/db-supabase';
import { formatMonth, getPreviousMonth, getLastNMonths } from '@/types/accounting.types';

export async function GET(request: Request) {
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);

  const current_month = searchParams.get('month') || formatMonth(new Date());
  const previous_month = getPreviousMonth(current_month);
  const { start_month } = getLastNMonths(12);

  // Get category summaries for current month
  const { data: category_summaries } = await supabase
    .from('v_category_monthly_summary')
    .select('*')
    .eq('month', current_month);

  // Get top 10 companies by net_amount
  const { data: top_companies } = await supabase
    .from('v_monthly_accounting')
    .select('*')
    .eq('month', current_month)
    .order('net_amount', { ascending: false })
    .limit(10);

  // Get 12-month trend
  const { data: monthly_data } = await supabase
    .from('v_category_monthly_summary')
    .select('*')
    .gte('month', start_month)
    .lte('month', current_month)
    .order('month', { ascending: false });

  // Aggregate monthly trend
  const monthly_trend = Object.values(
    monthly_data?.reduce((acc, row) => {
      if (!acc[row.month]) {
        acc[row.month] = {
          month: row.month,
          total_sales: 0,
          total_purchases: 0,
          net_amount: 0
        };
      }
      acc[row.month].total_sales += row.total_sales || 0;
      acc[row.month].total_purchases += row.total_purchases || 0;
      acc[row.month].net_amount += row.net_amount || 0;
      return acc;
    }, {} as any) || {}
  );

  // Calculate growth rates
  const current_total = monthly_trend.find(m => m.month === current_month);
  const previous_total = monthly_trend.find(m => m.month === previous_month);

  const sales_growth_rate = previous_total?.total_sales
    ? ((current_total?.total_sales || 0) - previous_total.total_sales) / previous_total.total_sales * 100
    : 0;

  const purchase_growth_rate = previous_total?.total_purchases
    ? ((current_total?.total_purchases || 0) - previous_total.total_purchases) / previous_total.total_purchases * 100
    : 0;

  return Response.json({
    success: true,
    data: {
      current_month,
      sales_growth_rate: Math.round(sales_growth_rate * 10) / 10,
      purchase_growth_rate: Math.round(purchase_growth_rate * 10) / 10,
      category_summaries: category_summaries || [],
      top_companies: top_companies || [],
      monthly_trend
    }
  });
}
```

---

## Testing Queries

### Test Category Update
```sql
-- Update company category
UPDATE companies
SET
  company_category = '협력업체-원자재',
  business_info = jsonb_build_object(
    'business_type', '제조업',
    'business_item', '자동차부품',
    'main_products', '엔진부품, 구동계부품'
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE company_code = 'SUP-001';
```

### Test Monthly Accounting View
```sql
-- Get monthly summary for October 2025
SELECT
  company_code,
  company_name,
  company_category,
  sales_amount,
  purchase_amount,
  net_amount
FROM v_monthly_accounting
WHERE month = '2025-10'
ORDER BY net_amount DESC
LIMIT 10;
```

### Test Category Summary View
```sql
-- Get category summary with percentages
SELECT
  month,
  company_category,
  total_sales,
  total_purchases,
  net_amount,
  company_count,
  sales_percentage,
  purchase_percentage
FROM v_category_monthly_summary
WHERE month >= '2025-01'
ORDER BY month DESC, total_sales DESC;
```

---

## Common Patterns

### Date Range Filtering
```typescript
// Last 3 months
const { start_month, end_month } = getLastNMonths(3);

// Specific range
const start_month = '2025-01';
const end_month = '2025-10';

// Current month only
const month = formatMonth(new Date());
```

### Category Validation
```typescript
import { COMPANY_CATEGORY_VALUES, isValidCompanyCategory } from '@/types/accounting.types';

if (!isValidCompanyCategory(category)) {
  return Response.json(
    { success: false, error: 'Invalid category' },
    { status: 400 }
  );
}
```

### JSONB Queries
```typescript
// Query companies with specific business_type
const { data } = await supabase
  .from('companies')
  .select('*')
  .contains('business_info', { business_type: '제조업' });

// Query companies with any business_info
const { data } = await supabase
  .from('companies')
  .select('*')
  .not('business_info', 'eq', '{}');
```

---

## Critical Korean Text Handling

**Always use this pattern for POST/PUT APIs**:
```typescript
// ✅ CORRECT - Prevents Korean character corruption
const text = await request.text();
const data = JSON.parse(text);

// ❌ WRONG - Causes Korean character issues
const data = await request.json();
```

---

## Helper Functions Available

```typescript
// Import from types
import {
  formatMonth,
  getCurrentMonth,
  getPreviousMonth,
  getLastNMonths,
  formatCurrency,
  formatPercentage,
  calculateGrowthRate,
  getCategoryLabel,
  getCategoryColor
} from '@/types/accounting.types';

// Usage examples
const month = formatMonth(new Date());           // '2025-10'
const range = getLastNMonths(6);                 // { start_month: '2025-05', end_month: '2025-10' }
const formatted = formatCurrency(1500000);       // '₩1,500,000'
const percent = formatPercentage(15.3);          // '15.3%'
const growth = calculateGrowthRate(150, 100);    // 50
const label = getCategoryLabel('협력업체-원자재');  // '원자재'
```

---

## Performance Tips

1. **Use Views**: Views are pre-optimized with indexes
2. **Pagination**: Always paginate monthly_accounting (can be large)
3. **Date Ranges**: Limit date ranges to reasonable periods (1-12 months)
4. **Caching**: Consider caching dashboard data (refresh every 5-15 minutes)
5. **Indexes**: Automatically used when filtering by category or month

---

## Next Steps Checklist

- [ ] Create 4 API route files
- [ ] Test each endpoint with Korean data
- [ ] Implement validation schemas (Zod)
- [ ] Add error handling and logging
- [ ] Create UI components for category selection
- [ ] Build accounting summary page
- [ ] Add dashboard widgets
- [ ] Test Excel export with new columns

---

**Quick Reference Version**: 1.0
**Last Updated**: 2025-10-11 15:45:00
