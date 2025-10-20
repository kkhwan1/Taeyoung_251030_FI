# 태창금속 BOM Excel 분석 보고서
## Comprehensive BOM Structure Analysis

**File**: 태창금속 BOM (1).xlsx
**Analysis Date**: 2025-10-14
**Total Sheets**: 6 (5 customer sheets + 1 price master)

---

## 📊 Executive Summary

태창금속의 BOM 관리 시스템은 **고객별 시트로 분리된 2단계 BOM 구조**를 사용하며, 내부 생산품(코일→시트 변환)과 외부 구매품을 명확히 구분합니다. 스크랩 관리와 원가 계산이 통합되어 있으며, VLOOKUP을 통한 최신 단가 참조 시스템을 갖추고 있습니다.

### Key Statistics

| Customer Sheet | 완제품 (Parents) | 구매품목 (Children) | 내부생산 | 외부구매 | Total Rows |
|---------------|----------------|-------------------|---------|---------|-----------|
| 대우공업 | 13 | 121 | 8 | 113 | 858 |
| 풍기산업 | 9 | 42 | 7 | 35 | 890 |
| 다인 | 8 | 8 | 8 | 0 | 838 |
| 호원오토 | 45 | 45 | 0 | 45 | 792 |
| 인알파코리아 | 50 | 94 | 24 | 70 | 874 |
| **Total** | **125** | **310** | **47** | **263** | **4,252** |

**최신단가 Sheet**: 251 price records (품번-단가-공급처-기준일)

---

## 🏗️ BOM Structure Architecture

### 1. Sheet Organization (6 Sheets)

#### A. Customer Sheets (5 sheets)
- **대우공업**: Daewoo industry main supplier
- **풍기산업**: Pungki industry supplier
- **다인**: Dain supplier
- **호원오토**: Howon Auto supplier
- **인알파코리아**: In Alpha Korea supplier

#### B. Master Data Sheet (1 sheet)
- **최신단가**: Latest price master for all purchased components

### 2. Two-Level BOM Structure

```
완제품 (Parent - Customer Order)
├─ 납품처: Customer name
├─ 차종: Vehicle model
├─ 품번: Part number
├─ 품명: Part name
├─ 단가: Unit price (sales)
├─ 마감수량: Delivery quantity
└─ 마감금액: Total revenue = 단가 × 마감수량

    └─> 구매품목 (Children - Component Requirements)
        ├─ Type A: 외부구매 (External Purchase)
        │   ├─ 구매처: Supplier name (사급/다른 업체)
        │   ├─ 품번: Part number
        │   ├─ 소요량: Required quantity per parent
        │   ├─ 단가: VLOOKUP(품번, 최신단가!A:B, 2, 0)
        │   └─ 구매금액: 단가 × 구매수량 × 소요량
        │
        └─ Type B: 내부생산 (Internal Production - 태창금속)
            ├─ Coil/Sheet Data (Columns R-Z):
            │   ├─ 재질 (Material): SPCD, SGARC340, etc.
            │   ├─ 두께 (Thickness): mm
            │   ├─ 폭 (Width): mm
            │   ├─ 길이 (Length): mm
            │   ├─ SEP: Separation/cutting loss factor
            │   ├─ 비중 (Density): 7.85 g/cm³ (steel)
            │   ├─ EA중량 (Weight/piece): Calculated
            │   ├─ KG단가 (Price/kg): Material cost
            │   └─ 단품단가 (Price/piece): Calculated
            │
            └─ Scrap Management (Columns AB-AE):
                ├─ 실적수량: Actual production quantity
                ├─ 스크랩중량: Scrap weight per piece
                ├─ 스크랩 단가: Scrap price per kg
                └─ 스크랩금액: Scrap revenue
```

---

## 🔢 Critical Formulas & Calculations

### 1. Revenue Calculation (Parent Level)

```excel
마감금액 (G) = 단가 (E) × 마감수량 (F)
```

**Example**:
- 단가: 5,015 won
- 마감수량: 6,200 pieces
- 마감금액: 31,093,000 won

### 2. Coil-to-Sheet Conversion (Internal Production)

#### A. EA중량 (Weight per Piece) - Column Z

```excel
EA중량 (Z) = ROUND((비중 × 길이 × 폭 × 두께) / 1,000,000 / SEP, 2)
```

**Formula**: `=ROUND((Y7*W7*V7*U7/1000000/X7),2)`

**Example**:
- 재질: SPCD
- 두께: 0.65 mm
- 폭: 1,480 mm
- 길이: 390 mm
- SEP: 1 (no cutting loss)
- 비중: 7.85 g/cm³
- **EA중량: 2.95 kg/piece**

**Logic**:
1. Volume = 길이 × 폭 × 두께 (mm³)
2. Volume in cm³ = Volume / 1,000
3. Weight = Volume × 비중 / 1,000 (kg)
4. Adjusted weight = Weight / SEP

#### B. 단품단가 (Unit Price) - Column S

```excel
단품단가 (S) = ROUND(KG단가 × EA중량, 0)
```

**Formula**: `=ROUND((R7*Z7),0)`

**Example**:
- KG단가: 1,045.2 won/kg
- EA중량: 2.95 kg
- **단품단가: 3,083 won/piece**

### 3. Component Cost Calculation (Child Level)

#### A. 단가 (Unit Price) - Column N

**For Internal Production** (태창금속):
```excel
단가 (N) = 단품단가 (S)
```

**For External Purchase** (사급/외부):
```excel
단가 (N) = IFERROR(VLOOKUP(품번, 최신단가!$A:$B, 2, 0), 0)
```

**Formula**: `=IFERROR(VLOOKUP(K8,최신단가!$A:$B,2,0),0)`

**Logic**:
- Looks up part number in price master sheet
- Returns latest unit price
- Returns 0 if not found (IFERROR)

#### B. 구매수량 (Purchase Quantity) - Column O

```excel
구매수량 (O) = 마감수량 (Parent F) × 소요량 (M)
```

**Formula**: `=$F$7*M8` (absolute reference to parent quantity)

**Example**:
- Parent quantity: 2,610 pieces
- 소요량: 1 (1:1 ratio)
- **구매수량: 2,610 pieces**

#### C. 구매금액 (Purchase Amount) - Column P

```excel
구매금액 (P) = 단가 (N) × 구매수량 (O) × 소요량 (M)
```

**Formula**: `=(N8*O8)*M8`

**Example**:
- 단가: 3,083 won
- 구매수량: 2,610 pieces
- 소요량: 1
- **구매금액: 8,046,630 won**

### 4. Scrap Revenue Calculation

```excel
스크랩금액 (AE) = 실적수량 (AB) × 스크랩중량 (AC) × 스크랩 단가 (AD)
```

**Formula**: `=(AB10*AC10)*AD10`

**Example**:
- 실적수량: 2,610 pieces
- 스크랩중량: 1.47 kg/piece
- 스크랩 단가: 362 won/kg
- **스크랩금액: 1,388,885 won**

**Scrap Weight Logic**:
- Scrap weight = EA중량 - Net product weight
- Represents material waste from cutting/stamping process
- Recovered as scrap metal with separate pricing

---

## 📋 Column Layout Reference

### Left Section (Columns A-H): Parent Information (완제품)

| Column | Field | Description |
|--------|-------|-------------|
| A | 납품처 | Customer name (delivery destination) |
| B | 차종 | Vehicle model code |
| C | 품번 | Part number (customer's) |
| D | 품명 | Part name/description |
| E | 단가 | Unit selling price |
| F | 마감수량 | Delivery quantity (closing quantity) |
| G | 마감금액 | Total revenue (E × F) |
| H | - | Separator/supplier marker |

### Middle Section (Columns I-Q): Child Component Info (구매품목)

| Column | Field | Description |
|--------|-------|-------------|
| I | 구매처 | Supplier/source |
| J | 차종 | Vehicle model |
| K | 품번 | Part number (supplier's) |
| L | 품명 | Part name |
| M | 소요량/U/S | Required quantity per parent unit |
| N | 단가 | Unit purchase price |
| O | 구매수량 | Total purchase quantity |
| P | 구매금액 | Total purchase cost |
| Q | 비고 | Notes/remarks |

### Right Section (Columns R-Z): Coil/Sheet Data (내부생산)

| Column | Field | Description |
|--------|-------|-------------|
| R | KG단가 | Price per kilogram |
| S | 단품단가 | Calculated price per piece |
| T | 재질 | Material grade (SPCD, SGARC340, etc.) |
| U | 두께 | Thickness (mm) |
| V | 폭 | Width (mm) |
| W | 길이 | Length (mm) |
| X | SEP | Separation factor (cutting loss) |
| Y | 비중 | Density (g/cm³, typically 7.85 for steel) |
| Z | EA중량 | Weight per piece (calculated) |

### Far Right (Columns AB-AE): Scrap Management

| Column | Field | Description |
|--------|-------|-------------|
| AB | 실적수량 | Actual production quantity |
| AC | 스크랩중량 | Scrap weight per piece |
| AD | 스크랩 단가 | Scrap price per kg |
| AE | 스크랩금액 | Total scrap revenue |

---

## 🔍 Data Flow & Integration Points

### 1. Price Master Integration (최신단가)

**Structure**:
```
Column A: 품번 (Part number)
Column B: 단가 (Unit price)
Column C: 공급처 (Supplier)
Column D: 기준일 (Price date reference)
```

**Usage**: All external purchase components reference this sheet via VLOOKUP

**Example**:
```
50007278B → 2,631 won → 창경에스테크 → 4월기준
```

**Update Process**:
1. Supplier provides updated price list
2. Update 최신단가 sheet with new prices
3. All customer sheets automatically recalculate via VLOOKUP
4. No manual price updates needed in customer sheets

### 2. Parent-Child Relationships

**Identification Logic**:
```javascript
// Row is Parent if:
- Column A (납품처) is not empty
- Represents a complete product for customer delivery

// Row is Child if:
- Column A (납품처) is empty
- Column H or I (구매처) has supplier name
- Belongs to the immediate parent above
```

**Multi-Component BOM Example** (풍기산업 - Row 7-13):
```
Parent: PNL ASS'Y RR FLR FR (2,610 qty)
├─ Child 1: PNL-RR FLR FR (사급 - external)
├─ Child 2: NUT (하드웨어 - hardware)
├─ Child 3: EXTN RR FLOOR (태창금속 - internal, has coil data)
├─ Child 4: BRAKET ASSY 2ND SEAT MTG OTR LH (사급)
├─ Child 5: BRAKET ASSY 2ND SEAT MTG OTR RH (사급)
└─ Child 6: BRKT ASSY-RR SEAT CUSHION MTG (사급, qty=2)
```

### 3. Internal vs External Production Classification

**Internal Production** (태창금속):
- Column I = "태창금속"
- Has complete coil/sheet data (Columns R-Z)
- Material cost calculated from coil specs
- Scrap tracking included

**External Purchase** (사급/외부):
- Column I = supplier name (not "태창금속")
- No coil/sheet data
- Unit price from VLOOKUP (최신단가 sheet)
- No scrap tracking

**Special Markers**:
- "사급" = Materials provided by customer (free-issue)
- "하드웨어" = Hardware/fasteners
- "협력업체" = Partner supplier

---

## 💡 Business Logic & Calculations

### 1. Cost Structure Analysis

**For External Purchase Components**:
```
Total Component Cost = VLOOKUP(품번) × 마감수량 × 소요량
```

**For Internal Production Components**:
```
Material Cost = (KG단가 × EA중량) × 마감수량 × 소요량
Net Cost = Material Cost - Scrap Revenue
```

### 2. Profit Margin Calculation (Implicit)

```
Revenue = 마감금액 (G)
Cost = SUM(구매금액 for all children) - SUM(스크랩금액)
Gross Profit = Revenue - Cost
Margin = (Gross Profit / Revenue) × 100%
```

**Example**: 풍기산업 Row 7
```
Revenue: 30,550,050 won
Component Costs: ~9,520 won/piece × 2,610 = 24,847,200 won
Scrap Revenue: 1,388,885 won
Net Cost: 23,458,315 won
Gross Profit: ~7,091,735 won
Margin: ~23.2%
```

### 3. Inventory Requirements

**Raw Material (Coil/Sheet)**:
```
Required Coil Weight = 마감수량 × EA중량 × 소요량
Required Coil Area = 마감수량 × (길이 × 폭) / 1,000,000 (m²)
```

**Purchased Components**:
```
Required Quantity = 마감수량 × 소요량
```

### 4. Material Waste Tracking

**Scrap Rate Calculation**:
```
Scrap Rate = (스크랩중량 / EA중량) × 100%
```

**Example**:
- EA중량: 2.95 kg
- 스크랩중량: 1.47 kg
- **Scrap Rate: 49.8%** (nearly half of material becomes scrap)

**Scrap Revenue Recovery**:
```
Recovery Rate = 스크랩 단가 / KG단가
```

**Example**:
- KG단가: 1,045.2 won/kg (new material)
- 스크랩 단가: 362 won/kg (scrap)
- **Recovery: 34.6%** of original material cost

---

## 📊 Key Insights & Patterns

### 1. Coil-to-Sheet Manufacturing Process

**Material Flow**:
```
Steel Coil (Roll)
    ↓ [Unroll & Cut]
Steel Sheet (Blank)
    ↓ [Press/Stamping]
Finished Component + Scrap
    ↓
Assembly → Customer Delivery
```

**Cost Components**:
1. **Material Cost**: KG단가 × EA중량
2. **Processing Cost**: Implicit in selling price
3. **Scrap Recovery**: Offset against material cost

### 2. SEP Factor (Separation/Cutting Loss)

**Purpose**: Accounts for material loss during cutting process

**Typical Values**:
- SEP = 1: No cutting loss (ideal)
- SEP > 1: Material waste from cutting pattern

**Impact on EA중량**:
- Higher SEP → Lower EA중량 → Lower material cost
- Represents efficiency of cutting pattern/nesting

### 3. BOM Complexity Patterns

**Simple BOM** (1 component):
- Parent: 대우당진 CN7 65852-BY000
- Child: 1× 태창금속 internal production

**Complex BOM** (6+ components):
- Parent: 풍기서산 TAM 65511-A3000
- Children: Mix of internal (1) + external (5) components
- Multiple suppliers involved

**Average Components per Parent**:
- 대우공업: 9.3 components/parent
- 풍기산업: 4.7 components/parent
- 호원오토: 1.0 component/parent (simple assembly)

### 4. Material Grade Patterns

**Common Steel Grades**:
- **SPCD**: Cold-rolled steel (일반 냉연강판)
- **SGARC340**: High-strength steel for automotive
- **SPFH590FB**: High-tensile strength steel
- **SGAFC590**: Advanced high-strength steel

**Thickness Range**: 0.65mm - 2.0mm (automotive body panels)

**Density**: Consistently 7.85 g/cm³ (standard steel)

---

## 🎯 Implementation Recommendations for ERP System

### 1. Database Schema Requirements

#### A. Core Tables

**items** (품목 마스터):
```sql
- item_code (PK)
- item_name
- item_type (완제품/구매품/내부생산품)
- current_stock
- unit_price (for purchased items)
```

**bom** (BOM 관계):
```sql
- bom_id (PK)
- parent_item_id (FK → items)
- child_item_id (FK → items)
- quantity_required (소요량)
- level_no (BOM depth: 0=parent, 1=child)
```

**coil_specs** (코일 사양 - 내부생산용):
```sql
- item_id (FK → items)
- material_grade (재질)
- thickness (두께)
- width (폭)
- length (길이)
- sep_factor
- density (비중)
- weight_per_piece (EA중량, calculated)
- kg_unit_price (KG단가)
- piece_unit_price (단품단가, calculated)
```

**scrap_tracking** (스크랩 관리):
```sql
- item_id (FK → items)
- scrap_weight_per_piece (스크랩중량)
- scrap_unit_price (스크랩 단가)
- production_quantity (실적수량)
- scrap_revenue (스크랩금액, calculated)
```

**price_master** (최신단가):
```sql
- item_code (품번)
- unit_price (단가)
- supplier_name (공급처)
- effective_date (기준일)
- is_active
```

#### B. Calculated Fields (Auto-compute)

**EA중량 Calculation**:
```javascript
weight_per_piece = ROUND(
  (density × length × width × thickness) / 1000000 / sep_factor,
  2
);
```

**단품단가 Calculation**:
```javascript
piece_unit_price = ROUND(kg_unit_price × weight_per_piece, 0);
```

**구매금액 Calculation**:
```javascript
purchase_amount = unit_price × purchase_quantity × quantity_required;
```

**스크랩금액 Calculation**:
```javascript
scrap_revenue = production_quantity × scrap_weight × scrap_unit_price;
```

### 2. Key Features to Implement

#### A. Multi-Level BOM Management
- Support 2-level (parent-child) initially
- Future: Extend to N-level depth
- BOM explosion: Calculate total material requirements
- BOM implosion: Where-used analysis

#### B. Coil-to-Sheet Conversion
- Material specs input: 재질, 두께, 폭, 길이
- Auto-calculate EA중량 from dimensions
- Auto-calculate 단품단가 from KG단가
- SEP factor for cutting loss

#### C. Price Master Integration
- Maintain latest prices by supplier
- Effective date tracking
- Auto-update component costs on price change
- Price history for cost analysis

#### D. Scrap Management
- Track scrap generation per component
- Calculate scrap revenue
- Net material cost = Material cost - Scrap revenue
- Scrap inventory tracking

#### E. Cost Analysis & Reporting
- Component cost breakdown per product
- Material cost vs. selling price
- Gross margin analysis by product/customer
- Scrap recovery rate analysis

### 3. Data Import/Export Features

#### A. Excel Template Support
- Import BOM from existing Excel format
- Maintain column structure compatibility
- Validate data during import
- Export to Excel for external reporting

#### B. Bulk Operations
- Batch price updates
- Batch BOM creation/modification
- Mass data validation

### 4. Real-Time Calculations

#### A. Dynamic Pricing
- When KG단가 changes → Auto-update 단품단가
- When 최신단가 updated → Refresh all dependent costs
- Real-time margin calculation

#### B. Inventory Impact
- BOM explosion for production planning
- Material requirement planning (MRP)
- Stock level alerts based on production forecast

---

## 📈 Current System Strengths

1. **Clear Structure**: Two-level BOM with explicit parent-child relationships
2. **Integrated Costing**: Material cost calculation from coil specifications
3. **Scrap Tracking**: Revenue recovery from manufacturing waste
4. **Price Management**: Centralized price master with VLOOKUP integration
5. **Customer Segmentation**: Separate sheets per customer for clarity
6. **Formula-Based**: Automatic calculations reduce manual errors

## 🚨 Potential Improvements for ERP

1. **Multi-Level BOM**: Support deeper hierarchies (grandchild components)
2. **Version Control**: Track BOM changes over time
3. **Effectivity Dates**: Time-bound BOM configurations
4. **Alternative Components**: Support substitute materials
5. **Routing Info**: Add press/stamping operation details
6. **Quality Data**: Integrate inspection specs and results
7. **Supplier Performance**: Track delivery, quality metrics
8. **Cost Variance**: Budget vs. actual cost analysis

---

## 📝 Glossary

### Korean Terms
- **완제품** (Wan-je-pum): Complete product / Finished goods
- **구매품목** (Gu-mae-pum-mok): Purchase items / Components
- **내부생산** (Nae-bu-saeng-san): Internal production
- **외부구매** (Oe-bu-gu-mae): External purchase
- **사급** (Sa-geup): Customer-supplied materials (free-issue)
- **재질** (Jae-jil): Material grade
- **두께** (Du-kke): Thickness
- **폭** (Pok): Width
- **길이** (Gil-i): Length
- **비중** (Bi-jung): Density / Specific gravity
- **스크랩** (Seu-keu-raep): Scrap / Waste material
- **소요량** (So-yo-ryang): Required quantity
- **마감수량** (Ma-gam-su-ryang): Closing quantity / Final quantity
- **납품처** (Nap-pum-cheo): Delivery destination / Customer

### Technical Terms
- **SEP Factor**: Separation factor accounting for cutting/nesting efficiency
- **EA중량**: Weight per each piece (unit weight)
- **KG단가**: Price per kilogram
- **단품단가**: Unit price per piece
- **BOM Explosion**: Calculating total component requirements from parent quantity
- **BOM Implosion**: Where-used analysis showing which parents use a component

---

## 🔗 Related Files

- **Source File**: `C:\Users\USER\claude_code\FITaeYoungERP\.plan2\참고\태창금속 BOM (1).xlsx`
- **This Report**: `C:\Users\USER\claude_code\FITaeYoungERP\.plan2\참고\BOM_Analysis_Report.md`

---

**Analysis Completed**: 2025-10-14
**Analyst**: Claude Code ERP Specialist
**Report Version**: 1.0
