# Excel Inventory Management System Analysis

## File: 2025년 9월 19일 종합관리 SHEET (1).xlsx

**Analyzed Date:** 2025-10-14
**Total Sheets:** 5
**Analysis Scope:** Inventory calculation logic, vendor tracking, price calculations, BOM integration

---

## 📊 Sheet Overview

| Sheet Name | Purpose | Dimensions | Items |
|-----------|---------|------------|-------|
| **종합재고** | Comprehensive consolidated inventory view | 393 rows × 233 cols | Master reference |
| **COIL 입고현황** | COIL material receiving tracking | 389 rows × 268 cols | ~66 items |
| **SHEET 입고현황** | SHEET material receiving tracking | 381 rows × 268 cols | ~66 items |
| **생산실적** | Production performance tracking | 96 rows × 86 cols | Daily production |
| **Sheet1** | Auxiliary data | 44 rows × 8 cols | Supporting info |

---

## 🔑 Core Inventory Calculation Logic

### Master Formula (SHEET 입고현황)

```excel
월말재고 (T8) = SUM(R5 + T5 - T6 - T7)
```

**Where:**
- `R5` = **기초재고 (Opening Inventory)** = Initial month inventory (N5)
- `T5` = **COIL 입고 (COIL Receiving)** = Reference to `COIL 입고현황!T6`
- `T6` = **생산실적 (Production Performance)** = Reference to `생산실적!L4`
- `T7` = **불량실적 (Defect/Scrap)**

**Inventory Flow:**
```
Opening Stock + COIL Received - Production Used - Defects = Ending Stock
```

---

## 📋 Sheet Structure Details

### 1. 종합재고 (Comprehensive Inventory)

**Purpose:** Master consolidated view linking all inventory sources

**Key Columns:**
- A: 거래처 (Customer/Vendor)
- B: 차종 (Vehicle Model)
- C: 완제품 품번 (Finished Product Part No)
- D: 부번 (Part Number)
- E: 품명 (Part Name)
- F: 재질 (Material)
- G-I: 규격 (Specification: 두께/가로/세로)
- J: 비중 (Specific Gravity: 7.85 for steel)
- K: **MM중량 (MM Weight)** = `=G*H*I*J/1000000`
- M: 단가 (Unit Price)
- N: 재고현황 COIL = Reference to `COIL 입고현황!O5:O8`
- O: 재고현황 SHEET = Reference to `SHEET 입고현황!O5:O8`

**Formula Pattern:**
```excel
K5: =G5*H5*I5*J5/1000000  // Weight = Thickness × Width × Length × Density / 1M
N5: ='COIL 입고현황'!O5:O8  // Link to COIL current inventory
O5: ='SHEET 입고현황'!O5:O8  // Link to SHEET current inventory
```

---

### 2. COIL 입고현황 (COIL Receiving)

**Purpose:** Track COIL material receiving and daily inventory

**Key Column Structure:**
- A-M: Master data (same as 종합재고)
- N: 재고현황 - 기초 (Opening Inventory)
- O: 재고현황 - 현재 (Current Inventory) = `=BB8`
- P: 입고현황 - 실적 (Receiving Performance) = `=BB5`
- Q: 생산현황 - 실적 (Production Performance) = `=BB6`
- R: 월말재고 (Month-End Inventory) = `=N5/K5`
- S: 구분 (Category: 입고실적/생산실적/불량실적)
- T-BA: **Daily columns** (월/화/수/목/금/토/일 × multiple weeks)
- BB: **총계 (Total)** = `=SUM(T5:BA5)`

**Daily Tracking Pattern:**
Each item has 4 rows:
1. **Row 5:** 입고실적 (Receiving) - Daily receiving quantities
2. **Row 6:** 생산실적 (Production) - Daily production consumption
3. **Row 7:** 불량실적 (Defects) - Daily defect quantities
4. **Row 8:** 월말재고 (Ending Inventory) - Calculated balance

**Key Formulas:**
```excel
// Current inventory = Last day's ending inventory
O5: =BB8

// Total receiving = Sum of daily receiving
BB5: =SUM(T5:BA5)

// Total production = Sum of daily production
BB6: =SUM(T6:BA6)

// Ending inventory for last day
BB8: =BA8
```

---

### 3. SHEET 입고현황 (SHEET Receiving)

**Purpose:** Track SHEET material receiving with COIL integration

**Unique Features:**
- Similar structure to COIL 입고현황
- **Integrates COIL data:** `T5 = 'COIL 입고현황'!T6`
- **Integrates Production data:** `T6 = 생산실적!L4`

**Critical Inventory Formula:**
```excel
T8 (월말재고): =SUM(R5 + T5 - T6 - T7)

Where:
- R5 = 월말재고(1일 기준) = N5 (Opening inventory)
- T5 = COIL 입고현황!T6 (COIL receiving for that day)
- T6 = 생산실적!L4 (Production performance from production sheet)
- T7 = 불량실적 (Defects)
```

**Data Flow:**
```
COIL Sheet → SHEET Sheet → Production Sheet → Inventory Balance
```

---

### 4. 생산실적 (Production Performance)

**Purpose:** Daily production tracking by item

**Column Structure:**
- A: 업체 (Vendor: 풍기광주, 풍기산업, 대우공업)
- B: 구분 (Line: 1600T, 600T, 400T, etc.)
- C: 차종 (Vehicle Model: NQ5, MQ4, etc.)
- D: 품번 (Part Number)
- E: 품명 (Part Name)
- F: BLK (Blank specification)
- G: 일소요량 (Daily requirement)
- H: PLT 적입량 (Pallet loading quantity: 150, 1000, 300, etc.)
- I: 9/15 재고 (Specific date inventory)
- J: 라인재고 (Line inventory)
- K: **계 (Total)** = `=SUM(L4:AP4)` (Sum of daily production)
- L onwards: **Daily production columns** (dates: 2025-09-01, 09-02, etc.)

**Formula Pattern:**
```excel
K4: =SUM(L4:AP4)  // Total production for the month
L4: 1585          // Production quantity for specific date
```

**Cross-Sheet Integration:**
- `SHEET 입고현황!T6` references `생산실적!L4`
- Production data flows into SHEET inventory calculations

---

## 🏢 Vendor Tracking (업체별)

### Identified Vendors:
1. **풍기광주** (Punggi Gwangju)
2. **풍기산업** (Punggi Industrial)
3. **대우공업** (Daewoo Industrial)

### Vendor Separation Method:
- **Column A (거래처)** contains vendor name
- Items are **grouped by vendor** in sequential rows
- No explicit subtotals found, but vendors are clearly separated
- Each vendor can have multiple items across different vehicle models

### Vendor Item Example:
```
Row 5: 풍기광주 | NQ5 | 66421-P1000 | HOOD INR
Row 77: 풍기산업 | Various | 65712/22-A30/1Y000 | MBR RR FLR SIDE LH/RH
Row 89: 대우공업 | Various | 66798-2J700 | COWL COVER
```

---

## 💰 Price Calculation Logic

### Unit Price Storage:
- **Column M (단가):** Static unit price per item
- Stored in both `종합재고` and `COIL/SHEET 입고현황` sheets
- Example: 1692 KRW for HOOD INR

### Weight Calculation Formula:
```excel
MM중량 (K) = 두께(G) × 가로(H) × 세로(I) × 비중(J) / 1,000,000

Example:
K5 = 0.6 × 1325 × 1720 × 7.85 / 1,000,000 = MM Weight in tons
```

### Price × Quantity Pattern:
- **Unit Price (M)** is stored but not actively used in daily calculations
- Weight calculation (K) is critical for material management
- **Potential for Amount Calculation:** `Amount = Quantity × Unit Price × Weight`
- No explicit amount columns found in current structure

**Note:** Price calculations appear to be done outside this tracking system or in separate sheets not analyzed.

---

## 🔄 Real-Time Inventory Status Tracking

### Update Mechanism:
1. **Daily Entry:** Production data entered in `생산실적` sheet (columns L onwards)
2. **COIL Tracking:** COIL receiving entered in `COIL 입고현황` (columns T onwards)
3. **Auto-Calculation:** SHEET inventory auto-updates via formulas
4. **Total Aggregation:** BB column sums all daily values
5. **Cross-Sheet Links:** `종합재고` pulls current inventory from both COIL and SHEET

### Formula Dependencies:
```
생산실적 (Daily Production)
    ↓ (Reference: 생산실적!L4)
SHEET 입고현황 (SHEET Receiving)
    ↑ (Reference: COIL 입고현황!T6)
COIL 입고현황 (COIL Receiving)
    ↓ (References: O5, P5)
종합재고 (Comprehensive Inventory)
```

### Real-Time Calculation Flow:
1. Enter production in `생산실적!L4` → Updates `SHEET 입고현황!T6`
2. Enter COIL receiving in `COIL 입고현황!T5` → Updates `COIL 입고현황!BB5`
3. SHEET inventory auto-calculates: `T8 = R5 + T5 - T6 - T7`
4. `종합재고` displays consolidated view from both sheets

---

## 🔗 BOM Data Integration

### BOM References Found:
- **Column F (BLK)** in 생산실적: Blank specification for stamping
- **완제품 품번 (Column C):** Finished product part number
- **부번 (Column D):** Component part number
- BOM relationship implied but not explicitly calculated in this file

### BOM Integration Pattern:
1. **Finished Product (완제품 품번):** Parent item in BOM
2. **Component (부번):** Child item in BOM
3. **일소요량 (Daily requirement):** Quantity per finished product
4. **Production links to BOM:** Each production entry should consume raw materials based on BOM

**Note:** Full BOM explosion logic not present in this file. Likely managed in separate BOM master file.

---

## 📈 Sorting and Filtering Mechanisms (솔트)

### Current Organization:
1. **Vendor Grouping:** Items grouped by 거래처 (Column A)
2. **Sequential Layout:** Items listed in production sequence
3. **Vehicle Model Grouping:** Secondary grouping by 차종 (Column B)
4. **No Active Filters:** No Excel AutoFilter detected in current state

### Sorting Logic Observed:
- **Primary Sort:** Vendor (거래처)
- **Secondary Sort:** Vehicle Model (차종)
- **Tertiary Sort:** Part Number (품번)

### Filtering Capabilities:
- Manual filtering by vendor, model, or part number possible
- No pivot tables or advanced filtering detected
- Daily columns (T onwards) allow time-based filtering

---

## 🎯 Key Insights for ERP Implementation

### Critical Features to Replicate:

1. **Multi-Level Inventory Tracking:**
   - COIL level (raw material receiving)
   - SHEET level (processed material with COIL integration)
   - Production consumption tracking
   - Real-time balance calculation

2. **Cross-Sheet References:**
   - SHEET references COIL receiving
   - SHEET references Production consumption
   - Comprehensive inventory consolidates both

3. **Daily Time-Series Data:**
   - Horizontal daily columns (월/화/수/목/금/토/일)
   - Total aggregation in BB column
   - Month-to-date accumulation

4. **Vendor Separation:**
   - Items grouped by vendor
   - Each vendor has distinct items
   - Potential for vendor-specific reporting

5. **Weight-Based Calculations:**
   - MM중량 = Thickness × Width × Length × Density / 1M
   - Critical for material management in manufacturing

6. **Formula-Driven Inventory:**
   - Ending Inventory = Opening + Receiving - Production - Defects
   - Auto-calculation reduces manual errors

### Database Schema Implications:

```sql
-- Core tables needed:
- items (master data with specifications)
- vendors (업체 관리)
- inventory_transactions (입고/출고/생산/불량)
- daily_inventory_balance (time-series inventory)
- production_performance (생산실적)
- bom (bill of materials - implied)

-- Key relationships:
- items.vendor_id → vendors.id
- inventory_transactions.item_id → items.id
- inventory_transactions.type (RECEIVING, PRODUCTION, DEFECT)
- daily_inventory_balance auto-calculated from transactions
```

### API Endpoints Needed:

```typescript
// Receiving transactions (입고)
POST /api/inventory/receiving
GET  /api/inventory/receiving?vendor_id=X&date_range=Y

// Production transactions (생산)
POST /api/inventory/production
GET  /api/inventory/production?item_id=X&date_range=Y

// Defect transactions (불량)
POST /api/inventory/defects
GET  /api/inventory/defects?item_id=X&date_range=Y

// Real-time inventory balance
GET  /api/inventory/balance?item_id=X&as_of_date=Y
GET  /api/inventory/balance/vendor?vendor_id=X

// Daily inventory history (time-series)
GET  /api/inventory/daily-history?item_id=X&date_range=Y

// Production performance (생산실적)
POST /api/production/performance
GET  /api/production/performance?vendor_id=X&date_range=Y
```

### Real-Time Dashboard Requirements:

1. **Current Inventory Status** (from 종합재고)
2. **Daily Receiving Trends** (from COIL/SHEET 입고현황)
3. **Production Performance** (from 생산실적)
4. **Vendor-Specific Views** (filtered by 거래처)
5. **Time-Series Charts** (daily columns T-BA visualization)
6. **Low Stock Alerts** (when current inventory < threshold)

---

## 🚨 Challenges and Considerations

### Data Entry Complexity:
- **Manual daily entry** across multiple columns (T-BA)
- **High error potential** with 268 columns per sheet
- **Formula dependencies** can break with incorrect edits

### ERP Simplification Opportunities:
1. **Replace horizontal daily columns** with transaction records
2. **Auto-calculate totals** from transaction database
3. **Provide daily/weekly/monthly views** through date filtering
4. **Implement validation** to prevent invalid entries
5. **Add audit trail** for all inventory changes

### Performance Concerns:
- Large sheets (389 rows × 268 cols) = ~104,452 cells per sheet
- Formula recalculation on every change
- Cross-sheet references slow down Excel
- **ERP advantage:** Database indexing, faster queries

### Data Migration Path:
1. **Extract master data** (items, vendors, specifications)
2. **Import historical transactions** from daily columns
3. **Recalculate inventory balances** using ERP logic
4. **Validate** against Excel ending inventory
5. **Parallel run** Excel + ERP during transition

---

## 📊 Summary

This Excel system is a **sophisticated multi-sheet inventory tracking solution** with:

✅ **Real-time inventory calculation** via formulas
✅ **Multi-level material tracking** (COIL → SHEET → Production)
✅ **Vendor-specific organization**
✅ **Daily time-series data** (daily columns)
✅ **Cross-sheet integration** for comprehensive view
✅ **Weight-based calculations** for material management

❌ **No explicit price × quantity amount calculations**
❌ **No BOM explosion logic** in this file
❌ **Manual data entry** across 268 columns
❌ **Limited filtering/sorting** capabilities
❌ **High maintenance complexity**

**Recommendation:** Replicate core logic in PostgreSQL database with Supabase, implement transaction-based inventory tracking, and provide Excel export for user familiarity.

---

**Analysis Complete** | Claude Code SuperClaude Framework
