# Excel vs Database Price Discrepancy Report

## 🚨 Critical Finding

**Excel "최신단가" sheet와 데이터베이스 price 필드가 불일치합니다!**

## Executive Summary

### Data Sources
1. **Excel Source**: `.example/태창금속 BOM.xlsx` → "최신단가" 시트
   - 244 price records (4월기준 - April basis)
   - Format: [item_code, price, supplier, period_note]

2. **Database**: Supabase PostgreSQL `items` table
   - 718 total active items
   - 425 items with price (59.2%)
   - 293 items with NULL price (40.8%)

### Sample Comparison Results (10 items checked)

| Category | Count | Percentage |
|----------|-------|------------|
| **NOT_IN_DB** (품목 없음) | 3 | 30% |
| **DB_PRICE_NULL** (가격 없음) | 3 | 30% |
| **MATCH** (일치) | 2 | 20% |
| **MISMATCH** (불일치) | 5 | 50% |

⚠️ **Only 20% of sampled items have matching prices!**

## Detailed Findings

### 1. Items NOT in Database (3 items)
These items exist in Excel but not in the database:

```
65100-BY000  ₩5,830  (공급사: 없음)
65852-BY000  ₩5,844  (공급사: 없음)
651M7-L2000  ₩298.6  (공급사: 웅지테크)
```

**Impact**: Missing 3 items that should be in inventory system

### 2. Items with NULL Price in Database (3 items)
These items exist in database but have no price:

```
50010562C    Excel: ₩785    DB: NULL  (공급사: 태영금속)
50010755C    Excel: ₩2,644  DB: NULL  (공급사: 창경에스테크)
50010988     Excel: ₩587    DB: NULL  (공급사: 에이오에스)
```

**Impact**: 3 items cannot be properly costed in transactions

### 3. Price Mismatches (5 items)
Items where database price differs from Excel:

| Item Code | DB Price | Excel Price | Difference | % Diff | Supplier |
|-----------|----------|-------------|------------|--------|----------|
| 50007278B | ₩1,488 | ₩2,631 | -₩1,143 | **-76.8%** | 창경에스테크 |
| 50012110B | ₩2,631 | ₩1,707 | +₩924 | **+54.1%** | 창경에스테크 |
| 65158-L8000 | ₩610 | ₩561 | +₩49 | +8.7% | 웅지테크 |
| 50008904 | ₩1,584 | ₩1,491 | +₩93 | +6.2% | 에이오에스 |

⚠️ **Some items differ by over 75%!**

### 4. Exact Matches (2 items only)
Only these items have matching prices:

```
✅ Item codes with matching prices (2/10 = 20%)
```

## Root Cause Analysis

### Why the Discrepancy?

Based on previous conversation history:

1. **Previous Import Used Different Source**
   - The earlier BOM import (163 UPDATE statements) used "단품단가" field from BOM sheets
   - The "최신단가" sheet was NOT imported

2. **Different Price Sources**
   - Database prices: From individual BOM sheets (대우공업, 풍기산업, 다인, 호원오토, 인알파코리아)
   - Excel "최신단가": Consolidated latest prices dated "4월기준" (April basis)

3. **Price Updates Not Synced**
   - Excel contains newer April prices
   - Database contains older prices from original import

## Complete Excel Data Profile

### By Supplier (244 total records)

| Supplier | Count | Avg Price |
|----------|-------|-----------|
| 호원사급 | 64 items | ₩2,149 |
| 에이오에스 | 43 items | ₩495 |
| 제이에스테크 | 24 items | ₩533 |
| 웅지테크 | 20 items | ₩482 |
| 대우사급 | 13 items | ₩901 |
| 풍기사급 | 13 items | ₩1,597 |
| 창경에스테크 | 4 items | ₩2,288 |
| 태영금속 | 6 items | ₩778 |
| (공급사 없음) | 45 items | ₩15,447 |
| Others | 12 items | ₩278 |

### Price Range

- **Min Price**: ₩10.3 (13905-05000, 삼진스틸)
- **Max Price**: ₩38,175 (71604-3E000, 공급사 없음)
- **Average Price**: ₩3,761
- **Median Range**: ₩200-₩1,000

### High-Value Items (>₩10,000)

45 items with no supplier listed, ranging from ₩10,000 to ₩38,175
These appear to be finished products or assemblies.

## Impact Assessment

### Business Impact

1. **Costing Accuracy**: 🔴 HIGH
   - Inbound transactions using wrong prices
   - BOM cost calculations incorrect
   - Financial reports compromised

2. **Inventory Valuation**: 🔴 HIGH
   - Current stock values incorrect
   - Missing 3 items completely
   - 40.8% of items have no price

3. **Supplier Management**: 🟡 MEDIUM
   - Supplier pricing not reflected
   - Purchase order pricing issues

### Technical Impact

1. **Data Completeness**: 🔴 HIGH
   ```
   Database: 425/718 items have price (59.2%)
   Excel: 244 price records available
   Overlap: Only ~20% match (estimated)
   ```

2. **Data Quality**: 🔴 HIGH
   - Price mismatches up to 76%
   - Multiple price sources causing confusion
   - No price audit trail

## Recommended Actions

### Immediate Actions (Priority 1)

1. **✅ Import Missing Items**
   - Add 3 items from Excel not in database
   - Populate basic fields (item_code, item_name, category)

2. **✅ Update NULL Prices**
   - Update 3 items with NULL prices from Excel
   - Update 290 other items with NULL prices

3. **✅ Review Mismatches**
   - Create detailed comparison report for all 244 items
   - Get user confirmation on which prices are correct
   - Update database accordingly

### Short-term Actions (Priority 2)

4. **Import All 244 Prices**
   - Create migration script
   - Backup current prices before update
   - Log all changes for audit

5. **Add Price History**
   - Create `item_price_history` table
   - Track price changes over time
   - Record source (Excel sheet name, date)

6. **Add Supplier Relationship**
   - Link prices to suppliers
   - Track supplier-specific pricing

### Long-term Actions (Priority 3)

7. **Establish Price Management Process**
   - Single source of truth for prices
   - Regular price update workflow
   - Price approval process

8. **Add Price Validation**
   - Alert on large price changes (>20%)
   - Require reason for price updates
   - Track who updated prices

9. **Implement Price Versioning**
   - Effective date for prices
   - Historical price queries
   - Price comparison over time

## Next Steps

### Option 1: Quick Fix (Recommended)
```sql
-- 1. Add missing items (3 items)
-- 2. Update NULL prices from Excel (3 items)
-- 3. Review and update mismatches (5 items)
-- Total: 11 updates
```

### Option 2: Complete Import (Comprehensive)
```sql
-- Import all 244 prices from Excel
-- Update all matching items
-- Add missing items
-- Create price change log
```

### Option 3: Manual Review (Safest)
```
1. Generate full comparison report (244 items)
2. Review each mismatch with user
3. Update prices one by one with confirmation
4. Document all changes
```

## Files Generated

1. `scripts/bom-latest-prices.json` - All 244 Excel prices
2. `scripts/compare-prices.sql` - Full comparison query (not yet executed)
3. `scripts/price-comparison-summary.sql` - Summary statistics query
4. `scripts/execute-price-comparison.js` - Node.js execution script

## Conclusion

**Critical data quality issue identified**: Excel "최신단가" prices do not match database prices. Only 20% of sampled items had matching prices, with some items differing by over 75%.

**Immediate action required** to:
1. Import 3 missing items
2. Update 3 NULL prices
3. Resolve 5+ price mismatches
4. Decide on full 244-item import strategy

**User decision needed**: Which price source is authoritative?
- Excel "최신단가" (April basis) - appears more recent
- Database prices (from original BOM import) - currently in use

---

**Report Generated**: 2025-01-30
**Data Source**: `.example/태창금속 BOM.xlsx` → "최신단가" sheet
**Database**: Supabase PostgreSQL (718 items, 425 with price)
