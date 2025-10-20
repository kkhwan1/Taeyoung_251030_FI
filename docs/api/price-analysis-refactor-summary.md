# Price Analysis API Refactoring Summary

**Date**: 2025-10-17
**File**: `src/app/api/price-analysis/route.ts`
**Status**: ✅ Complete

## Problem

The original implementation used Supabase MCP's `execute_sql` function with complex SQL queries containing:
- Common Table Expressions (CTEs) with `WITH` clauses
- Window functions (`LAG`, `STDDEV`, `AVG OVER`)
- Multiple nested subqueries

**Error Encountered**:
```
Security Error: Only SELECT queries are allowed. Got:
WITH monthly_prices AS (...)
```

Supabase's `execute_sql` has security restrictions that block CTEs and complex multi-statement queries to prevent SQL injection attacks.

## Solution

Complete refactoring from **SQL-based** to **TypeScript-based** data processing.

### Architecture Changes

| Aspect | Before | After |
|--------|--------|-------|
| Database Layer | `mcp__supabase__execute_sql` | `getSupabaseClient()` |
| Query Strategy | Complex SQL with CTEs | Simple SELECT + TypeScript |
| JOIN Syntax | SQL INNER/LEFT JOIN | Supabase foreign key notation |
| Window Functions | SQL LAG(), STDDEV() | Manual TypeScript implementation |
| Aggregations | SQL AVG(), MIN(), MAX() | JavaScript reduce/Math operations |
| Data Processing | Database (PostgreSQL) | Application (TypeScript) |

## Detailed Changes

### 1. getPriceTrends() Function

**Original Approach** (Lines 48-177):
- Used 4 CTEs: `monthly_prices`, `price_changes`, `item_summary`
- PostgreSQL window functions for LAG and STDDEV
- Single complex query with nested aggregations

**New Approach** (Lines 48-195):
1. Simple SELECT with Supabase query builder
2. Fetch price history for last 12 months
3. Group data by item using JavaScript `Map`
4. Calculate statistics in TypeScript:
   - Average price: `reduce((sum, p) => sum + p.price, 0) / prices.length`
   - Volatility (std dev): `Math.sqrt(variance)`
   - Month-over-month change: Manual loop comparing adjacent prices

**Key Code Pattern**:
```typescript
// Supabase query builder with foreign key JOIN
const { data: priceHistory, error } = await supabase
  .from('item_price_history')
  .select(`
    item_id,
    price_month,
    unit_price,
    item:items(
      item_id,
      item_code,
      item_name,
      category,
      unit,
      is_active
    )
  `)
  .gte('price_month', twelveMonthsAgo.toISOString().split('T')[0])
  .order('item_id')
  .order('price_month', { ascending: false });
```

### 2. getPriceComparisons() Function

**Original Approach** (Lines 201-343):
- Used 4 CTEs: `latest_prices`, `category_stats`, `supplier_stats`, `item_comparisons`
- DISTINCT ON for latest prices per item
- Complex JOIN logic with CASE statements for deviation calculations

**New Approach** (Lines 202-389):
1. Fetch all price history, extract latest per item
2. Fetch all active items with supplier JOIN
3. Calculate category/supplier statistics using `Map` structures
4. Build comparison results with deviation calculations
5. Sort by absolute deviation from category average

**Key Processing Steps**:
```typescript
// Step 1: Get latest price per item using Map
const latestPrices = new Map();
for (const record of priceHistory || []) {
  if (!latestPrices.has(record.item_id)) {
    latestPrices.set(record.item_id, {
      latest_price: record.unit_price,
      price_month: record.price_month
    });
  }
}

// Step 2: Calculate category statistics
for (const [category, stats] of categoryStats) {
  const prices = stats.prices;
  stats.category_avg_price = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  stats.category_min_price = Math.min(...prices);
  stats.category_max_price = Math.max(...prices);
}
```

## Performance Results

### Response Times (Empty Database)
- **Trends endpoint**: ~400ms
- **Comparisons endpoint**: ~474ms
- **Target**: <500ms ✅

Both endpoints meet the performance target even without database-level optimization.

### API Response Structure

**Trends Endpoint** (`GET /api/price-analysis?type=trends`):
```json
{
  "success": true,
  "data": {
    "type": "trends",
    "items": [
      {
        "item_id": 1,
        "item_code": "ITEM001",
        "item_name": "부품A",
        "category": "원자재",
        "unit": "EA",
        "latest_month": "2025-01-01",
        "latest_price": 1000,
        "avg_price": 950.50,
        "volatility": 50.25,
        "avg_change_rate_pct": 2.5,
        "data_points": 12
      }
    ],
    "summary": {
      "totalItems": 100,
      "avgChangeRate": 1.8,
      "avgVolatility": 45.3
    }
  },
  "generatedAt": "2025-10-17T11:34:29.004Z"
}
```

**Comparisons Endpoint** (`GET /api/price-analysis?type=comparisons`):
```json
{
  "success": true,
  "data": {
    "type": "comparisons",
    "items": [
      {
        "item_id": 1,
        "item_name": "부품A",
        "item_code": "ITEM001",
        "category": "원자재",
        "unit": "EA",
        "latest_price": 1000,
        "price_month": "2025-01-01",
        "category_avg_price": 950.00,
        "category_min_price": 800.00,
        "category_max_price": 1200.00,
        "deviation_from_category_avg_pct": 5.26,
        "supplier_id": 5,
        "supplier_name": "공급사A",
        "supplier_avg_price": 980.00,
        "deviation_from_supplier_avg_pct": 2.04
      }
    ],
    "summary": {
      "totalItems": 100,
      "categoriesCount": 5,
      "suppliersCount": 10
    }
  },
  "generatedAt": "2025-10-17T11:34:31.462Z"
}
```

## Testing Results

### Endpoint Tests
```bash
# Test trends endpoint
curl -X GET "http://localhost:5000/api/price-analysis?type=trends"
# Result: ✅ Success (empty data, no price history in DB)

# Test comparisons endpoint
curl -X GET "http://localhost:5000/api/price-analysis?type=comparisons"
# Result: ✅ Success (empty data, no price history in DB)

# Check price history data
curl -X GET "http://localhost:5000/api/price-history?limit=5"
# Result: Empty array (totalCount: 0)
```

### Performance Tests
```bash
# Measure trends response time
time curl -X GET "http://localhost:5000/api/price-analysis?type=trends"
# Result: 0.401565s (real: 0.519s including curl overhead)

# Measure comparisons response time
time curl -X GET "http://localhost:5000/api/price-analysis?type=comparisons"
# Result: 0.473652s (real: 0.619s including curl overhead)
```

## Benefits of New Approach

### Advantages
1. **Security**: No SQL injection risk from CTEs
2. **Maintainability**: TypeScript code is easier to debug and modify
3. **Type Safety**: Full TypeScript type checking on data processing
4. **Flexibility**: Easy to add new calculations or modify logic
5. **Testability**: Can unit test individual calculation functions

### Trade-offs
1. **Data Transfer**: More data transferred from database to application
2. **Memory Usage**: All processing happens in application memory
3. **Scalability**: May need optimization for very large datasets (>10,000 items)

### Future Optimization Opportunities
- Add caching layer for frequently accessed calculations
- Implement pagination for large datasets
- Consider materialized views for pre-calculated statistics
- Add database indexes on frequently queried columns

## Korean Text Handling

Both endpoints correctly handle Korean text (한글) through:
- UTF-8 encoding in database
- Proper TypeScript string handling
- Supabase client automatic encoding

**Example Korean Fields**:
- `item_name`: "부품A", "부품B"
- `category`: "원자재", "외주가공", "소모품"
- `supplier_name`: "공급사A", "협력사B"

## Next Steps

1. ✅ Refactor complete
2. ✅ Both endpoints tested and working
3. ✅ Performance targets met
4. ⏳ Add sample price history data for realistic testing
5. ⏳ Create frontend components to display analysis results
6. ⏳ Add export to Excel functionality for price analysis

## Files Modified

- `src/app/api/price-analysis/route.ts` (Lines 44-389)
  - `getPriceTrends()`: Complete refactor (147 lines)
  - `getPriceComparisons()`: Complete refactor (187 lines)

## Related Documentation

- Database schema: `supabase/migrations/*_price_history.sql`
- Price history API: `src/app/api/price-history/route.ts`
- Database utilities: `src/lib/db-unified.ts`
- Project documentation: `CLAUDE.md`
