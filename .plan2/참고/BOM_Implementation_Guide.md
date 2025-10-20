# BOM 시스템 구현 가이드
## Implementation Guide for Taechang Metal BOM System

---

## 🎯 Quick Reference

### Core Formula Summary

| Formula | Purpose | Example |
|---------|---------|---------|
| `EA중량 = (비중×길이×폭×두께) / 1M / SEP` | Calculate piece weight | 2.95 kg |
| `단품단가 = KG단가 × EA중량` | Calculate piece price | 3,083 won |
| `구매금액 = 단가 × 수량 × 소요량` | Calculate component cost | 8,046,630 won |
| `스크랩금액 = 실적수량 × 스크랩중량 × 스크랩단가` | Calculate scrap revenue | 1,388,885 won |

---

## 📊 Visual BOM Structure

### System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    최신단가 (Price Master)                    │
│  - 품번: Part number                                         │
│  - 단가: Latest unit price                                   │
│  - 공급처: Supplier name                                      │
│  - 기준일: Effective date                                     │
└────────────────────┬────────────────────────────────────────┘
                     │ VLOOKUP
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              Customer Sheets (고객별 시트)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 완제품 (Parent Product)                              │   │
│  │ ┌─────────────┬─────────────┬──────────┬─────────┐ │   │
│  │ │ 납품처      │ 품번        │ 단가     │ 수량    │ │   │
│  │ │ Customer    │ Part#       │ Price    │ Qty     │ │   │
│  │ └─────────────┴─────────────┴──────────┴─────────┘ │   │
│  │      │                                              │   │
│  │      ├─> Child 1: 외부구매 (External Purchase)      │   │
│  │      │   ├─ VLOOKUP(품번 → 최신단가)                │   │
│  │      │   ├─ 구매처: 사급/외부업체                    │   │
│  │      │   └─ 구매금액 = 단가 × 수량 × 소요량         │   │
│  │      │                                              │   │
│  │      └─> Child 2: 내부생산 (Internal Production)    │   │
│  │          ├─ 구매처: 태창금속                         │   │
│  │          ├─ Coil Specs: 재질/두께/폭/길이          │   │
│  │          ├─ EA중량 = f(dimensions)                  │   │
│  │          ├─ 단품단가 = KG단가 × EA중량              │   │
│  │          └─ Scrap: 스크랩중량 × 스크랩단가          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Material Flow (Coil to Sheet)
```
┌──────────────────────────────────────────────────────────────┐
│                    Raw Material (코일)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Steel Coil                                           │   │
│  │ - 재질: SPCD/SGARC340/etc                            │   │
│  │ - 두께: 0.65 ~ 2.0 mm                                │   │
│  │ - 폭: 500 ~ 1,500 mm                                 │   │
│  │ - 비중: 7.85 g/cm³                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────┬─────────────────────────────────────────────────┘
             │
             ↓ Unroll & Cut
┌──────────────────────────────────────────────────────────────┐
│                  Sheet Blanks (시트)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Cut Sheet                                            │   │
│  │ - 길이: Part-specific length                         │   │
│  │ - EA중량: Calculated weight/piece                    │   │
│  │ - SEP factor: Cutting efficiency                     │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────┬─────────────────────────────────────────────────┘
             │
             ↓ Press/Stamping
┌──────────────────────────────────────────────────────────────┐
│              Finished Component + Scrap                       │
│  ┌──────────────────────────┬────────────────────────────┐  │
│  │ Finished Part            │ Scrap Material             │  │
│  │ - Net weight             │ - 스크랩중량 (waste)        │  │
│  │ - Ready for assembly     │ - Sold back as scrap       │  │
│  │ - → Customer delivery    │ - 스크랩금액 (revenue)      │  │
│  └──────────────────────────┴────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Cost Flow Diagram
```
┌────────────────────────────────────────────────────────────┐
│                   Revenue (매출)                            │
│  마감금액 = 단가 × 마감수량                                 │
│  Example: 5,015 won × 6,200 = 31,093,000 won              │
└────────────┬───────────────────────────────────────────────┘
             │
             ↓
┌────────────────────────────────────────────────────────────┐
│                Component Costs (원가)                       │
│  ┌──────────────────────┬──────────────────────────────┐  │
│  │ External Purchase    │ Internal Production         │  │
│  │ ─────────────────    │ ──────────────────          │  │
│  │ VLOOKUP(최신단가)    │ Material Cost:              │  │
│  │ × 수량 × 소요량      │   KG단가 × EA중량 × 수량    │  │
│  │                      │ - Scrap Revenue:            │  │
│  │                      │   스크랩금액                │  │
│  │                      │ = Net Material Cost         │  │
│  └──────────────────────┴──────────────────────────────┘  │
└────────────┬───────────────────────────────────────────────┘
             │
             ↓
┌────────────────────────────────────────────────────────────┐
│              Gross Profit (매출총이익)                      │
│  = Revenue - Total Component Costs                         │
│  = 마감금액 - (구매금액 합계 - 스크랩금액 합계)              │
└────────────────────────────────────────────────────────────┘
```

---

## 🔧 Database Implementation

### 1. Core Tables (ERD)

```sql
┌─────────────────────┐         ┌─────────────────────┐
│      companies      │         │       items         │
├─────────────────────┤         ├─────────────────────┤
│ company_id (PK)     │◄───────┤ supplier_id (FK)    │
│ company_code        │         │ item_id (PK)        │
│ company_name        │         │ item_code           │
│ company_type        │         │ item_name           │
│ is_active           │         │ item_type           │
└─────────────────────┘         │ current_stock       │
                                │ unit_price          │
                                │ is_active           │
                                └─────────┬───────────┘
                                          │
                      ┌───────────────────┼───────────────────┐
                      │                   │                   │
                      ↓                   ↓                   ↓
        ┌─────────────────────┐ ┌─────────────────┐ ┌──────────────────┐
        │        bom          │ │   coil_specs    │ │  scrap_tracking  │
        ├─────────────────────┤ ├─────────────────┤ ├──────────────────┤
        │ bom_id (PK)         │ │ item_id (PK,FK) │ │ item_id (PK,FK)  │
        │ parent_item_id (FK) │ │ material_grade  │ │ scrap_weight     │
        │ child_item_id (FK)  │ │ thickness       │ │ scrap_unit_price │
        │ quantity_required   │ │ width           │ └──────────────────┘
        │ level_no            │ │ length          │
        │ is_active           │ │ sep_factor      │
        └─────────────────────┘ │ density         │
                                │ kg_unit_price   │
                                └─────────────────┘

                  ┌──────────────────────┐
                  │    price_master      │
                  ├──────────────────────┤
                  │ price_id (PK)        │
                  │ item_code            │
                  │ unit_price           │
                  │ supplier_name        │
                  │ effective_date       │
                  │ is_active            │
                  └──────────────────────┘
```

### 2. SQL Schema

```sql
-- Core items table (extends existing)
ALTER TABLE items ADD COLUMN IF NOT EXISTS item_type VARCHAR(20);
ALTER TABLE items ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES companies(company_id);

-- BOM relationships
CREATE TABLE bom (
  bom_id SERIAL PRIMARY KEY,
  parent_item_id INTEGER NOT NULL REFERENCES items(item_id),
  child_item_id INTEGER NOT NULL REFERENCES items(item_id),
  quantity_required DECIMAL(10,4) NOT NULL DEFAULT 1.0,
  level_no INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT bom_parent_child_unique UNIQUE (parent_item_id, child_item_id),
  CONSTRAINT bom_no_self_reference CHECK (parent_item_id <> child_item_id)
);

CREATE INDEX idx_bom_parent ON bom(parent_item_id) WHERE is_active = true;
CREATE INDEX idx_bom_child ON bom(child_item_id) WHERE is_active = true;

-- Coil specifications for internal production
CREATE TABLE coil_specs (
  item_id INTEGER PRIMARY KEY REFERENCES items(item_id),
  material_grade VARCHAR(50) NOT NULL, -- SPCD, SGARC340, etc.
  thickness DECIMAL(10,2) NOT NULL,    -- mm
  width DECIMAL(10,2) NOT NULL,        -- mm
  length DECIMAL(10,2) NOT NULL,       -- mm
  sep_factor DECIMAL(10,4) NOT NULL DEFAULT 1.0,
  density DECIMAL(10,4) NOT NULL DEFAULT 7.85, -- g/cm³
  kg_unit_price DECIMAL(10,2),        -- won/kg
  weight_per_piece DECIMAL(10,4) GENERATED ALWAYS AS (
    ROUND((density * length * width * thickness / 1000000.0 / sep_factor)::numeric, 4)
  ) STORED,
  piece_unit_price DECIMAL(10,2) GENERATED ALWAYS AS (
    ROUND((kg_unit_price * (density * length * width * thickness / 1000000.0 / sep_factor))::numeric, 0)
  ) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT coil_positive_dimensions CHECK (
    thickness > 0 AND width > 0 AND length > 0 AND sep_factor > 0
  )
);

CREATE INDEX idx_coil_specs_material ON coil_specs(material_grade);

-- Scrap tracking (with history support)
CREATE TABLE scrap_tracking (
  scrap_id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  scrap_weight DECIMAL(10,4) NOT NULL DEFAULT 0, -- kg/piece
  scrap_unit_price DECIMAL(10,2) NOT NULL DEFAULT 0, -- won/kg
  actual_quantity INTEGER,  -- Production quantity for revenue calculation
  scrap_revenue DECIMAL(12,2) GENERATED ALWAYS AS (
    ROUND((COALESCE(actual_quantity, 0) * scrap_weight * scrap_unit_price)::numeric, 0)
  ) STORED,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT scrap_positive_values CHECK (
    scrap_weight >= 0 AND scrap_unit_price >= 0
  )
);

CREATE INDEX idx_scrap_tracking_item ON scrap_tracking(item_id) WHERE is_active = true;
CREATE INDEX idx_scrap_tracking_active ON scrap_tracking(is_active);

-- Price master for external purchases (with foreign keys)
CREATE TABLE price_master (
  price_id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'KRW',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  supplier_id INTEGER REFERENCES companies(company_id),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_date_range CHECK (expiry_date IS NULL OR effective_date <= expiry_date)
);

CREATE INDEX idx_price_master_item ON price_master(item_id) WHERE is_active = true;
CREATE INDEX idx_price_master_supplier ON price_master(supplier_id) WHERE is_active = true;
CREATE INDEX idx_price_master_date ON price_master(effective_date DESC);
CREATE INDEX idx_price_master_active_dates ON price_master(effective_date, expiry_date) WHERE is_active = true;

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bom_updated_at BEFORE UPDATE ON bom
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER coil_specs_updated_at BEFORE UPDATE ON coil_specs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER scrap_tracking_updated_at BEFORE UPDATE ON scrap_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER price_master_updated_at BEFORE UPDATE ON price_master
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 3. Views for Common Queries

```sql
-- BOM with component details
CREATE VIEW v_bom_details AS
SELECT
  b.bom_id,
  b.parent_item_id,
  p.item_code AS parent_code,
  p.item_name AS parent_name,
  b.child_item_id,
  c.item_code AS child_code,
  c.item_name AS child_name,
  c.item_type AS child_type,
  b.quantity_required,
  c.unit_price AS child_unit_price,
  cs.piece_unit_price AS coil_piece_price,
  CASE
    WHEN c.item_type = 'internal_production' THEN cs.piece_unit_price
    ELSE c.unit_price
  END AS effective_unit_price,
  cs.material_grade,
  cs.weight_per_piece,
  st.scrap_weight,
  st.scrap_unit_price,
  st.actual_quantity,
  st.scrap_revenue AS item_scrap_revenue
FROM bom b
JOIN items p ON b.parent_item_id = p.item_id
JOIN items c ON b.child_item_id = c.item_id
LEFT JOIN coil_specs cs ON c.item_id = cs.item_id
LEFT JOIN scrap_tracking st ON c.item_id = st.item_id
WHERE b.is_active = true
  AND p.is_active = true
  AND c.is_active = true;

-- Latest prices for purchased items (using item_id)
CREATE VIEW v_latest_prices AS
SELECT DISTINCT ON (pm.item_id)
  pm.item_id,
  i.item_code,
  pm.unit_price,
  pm.currency,
  c.company_name AS supplier_name,
  pm.effective_date,
  pm.expiry_date
FROM price_master pm
INNER JOIN items i ON pm.item_id = i.item_id
LEFT JOIN companies c ON pm.supplier_id = c.company_id
WHERE pm.is_active = true
  AND pm.effective_date <= CURRENT_DATE
  AND (pm.expiry_date IS NULL OR pm.expiry_date >= CURRENT_DATE)
ORDER BY pm.item_id, pm.effective_date DESC;

-- BOM cost calculation
CREATE VIEW v_bom_costs AS
SELECT
  b.parent_item_id,
  p.item_code AS parent_code,
  p.item_name AS parent_name,
  SUM(
    b.quantity_required *
    CASE
      WHEN c.item_type = 'internal_production' THEN cs.piece_unit_price
      ELSE COALESCE(pm.unit_price, c.unit_price)
    END
  ) AS total_component_cost,
  SUM(
    CASE
      WHEN c.item_type = 'internal_production'
      THEN COALESCE(st.scrap_revenue, 0)
      ELSE 0
    END
  ) AS total_scrap_revenue,
  SUM(
    b.quantity_required *
    CASE
      WHEN c.item_type = 'internal_production' THEN cs.piece_unit_price
      ELSE COALESCE(pm.unit_price, c.unit_price)
    END
  ) - SUM(
    CASE
      WHEN c.item_type = 'internal_production'
      THEN COALESCE(st.scrap_revenue, 0)
      ELSE 0
    END
  ) AS net_component_cost
FROM bom b
JOIN items p ON b.parent_item_id = p.item_id
JOIN items c ON b.child_item_id = c.item_id
LEFT JOIN coil_specs cs ON c.item_id = cs.item_id
LEFT JOIN scrap_tracking st ON c.item_id = st.item_id AND st.is_active = true
LEFT JOIN v_latest_prices pm ON c.item_id = pm.item_id
WHERE b.is_active = true
GROUP BY b.parent_item_id, p.item_code, p.item_name;
```

---

## 🚀 API Endpoints Design

### 1. BOM Management APIs

```typescript
// GET /api/bom/{parent_item_id} - Get BOM for a product
GET /api/bom/123
Response: {
  parent_item: {
    item_id: 123,
    item_code: "65852-BY000",
    item_name: "MBR-RR FLR CTR CROSS",
    unit_price: 5015
  },
  components: [
    {
      child_item_id: 456,
      item_code: "65852-BY000",
      item_name: "MBR-RR FLR CTR CROSS",
      item_type: "internal_production",
      quantity_required: 1.0,
      unit_price: 5844,
      coil_specs: {
        material_grade: "SGARC340",
        thickness: 1.2,
        width: 1300,
        length: 420,
        weight_per_piece: 5.14,
        kg_unit_price: 1137
      },
      scrap: {
        scrap_weight: 2.1,
        scrap_unit_price: 362,
        scrap_revenue_per_piece: 760.2
      }
    }
  ],
  cost_summary: {
    total_component_cost: 5844,
    total_scrap_revenue: 760.2,
    net_component_cost: 5083.8
  }
}

// POST /api/bom - Create BOM relationship
POST /api/bom
Body: {
  parent_item_id: 123,
  child_item_id: 456,
  quantity_required: 1.0
}

// PUT /api/bom/{bom_id} - Update BOM
PUT /api/bom/789
Body: {
  quantity_required: 2.0
}

// DELETE /api/bom/{bom_id} - Soft delete BOM
DELETE /api/bom/789

// GET /api/bom/explosion/{parent_item_id}?quantity=1000
// Calculate total material requirements
GET /api/bom/explosion/123?quantity=1000
Response: {
  parent_quantity: 1000,
  components: [
    {
      item_id: 456,
      item_code: "65852-BY000",
      required_quantity: 1000,
      current_stock: 500,
      shortage: 500
    }
  ]
}

// GET /api/bom/where-used/{child_item_id}
// Find all parents using this component
GET /api/bom/where-used/456
Response: {
  component: {
    item_id: 456,
    item_code: "65852-BY000"
  },
  used_in: [
    {
      parent_item_id: 123,
      parent_code: "65852-BY000",
      quantity_required: 1.0
    }
  ]
}
```

### 2. Coil Specs APIs

```typescript
// POST /api/coil-specs - Create coil specifications
POST /api/coil-specs
Body: {
  item_id: 456,
  material_grade: "SGARC340",
  thickness: 1.2,
  width: 1300,
  length: 420,
  sep_factor: 1.0,
  density: 7.85,
  kg_unit_price: 1137
}
Response: {
  item_id: 456,
  weight_per_piece: 5.14,  // auto-calculated
  piece_unit_price: 5844   // auto-calculated
}

// GET /api/coil-specs/{item_id} - Get specs
GET /api/coil-specs/456

// PUT /api/coil-specs/{item_id} - Update specs
PUT /api/coil-specs/456
Body: {
  kg_unit_price: 1200  // Update material price
}
Response: {
  piece_unit_price: 6168  // Auto-recalculated
}

// POST /api/coil-specs/calculate - Preview calculation
POST /api/coil-specs/calculate
Body: {
  thickness: 1.2,
  width: 1300,
  length: 420,
  density: 7.85,
  sep_factor: 1.0,
  kg_unit_price: 1137
}
Response: {
  weight_per_piece: 5.14,
  piece_unit_price: 5844
}
```

### 3. Price Master APIs

```typescript
// GET /api/price-master - Get latest prices
GET /api/price-master?item_code=65852-BY000
Response: {
  item_code: "65852-BY000",
  unit_price: 5844,
  supplier_name: "태창금속",
  effective_date: "2025-10-01"
}

// POST /api/price-master/bulk-update - Batch price update
POST /api/price-master/bulk-update
Body: {
  prices: [
    {
      item_code: "65852-BY000",
      unit_price: 5900,
      supplier_name: "태창금속",
      effective_date: "2025-10-15"
    }
  ]
}

// POST /api/price-master/import-excel - Import from Excel
POST /api/price-master/import-excel
Body: FormData with Excel file
```

### 4. Scrap Tracking APIs

```typescript
// POST /api/scrap-tracking - Create scrap tracking
POST /api/scrap-tracking
Body: {
  item_id: 456,
  scrap_weight_per_piece: 2.1,
  scrap_unit_price: 362
}

// GET /api/scrap-tracking/revenue/{item_id}?quantity=1000
// Calculate scrap revenue for production quantity
GET /api/scrap-tracking/revenue/456?quantity=1000
Response: {
  production_quantity: 1000,
  scrap_weight_per_piece: 2.1,
  total_scrap_weight: 2100,
  scrap_unit_price: 362,
  total_scrap_revenue: 760200
}
```

---

## 📝 Excel Import/Export

### 1. Import Template Structure

**Customer BOM Template** (customer_bom_template.xlsx):
```
Row 1-5: Metadata
Row 6: Headers
  [납품처, 차종, 품번, 품명, 단가, 마감수량, 마감금액,
   , 구매처, 차종, 품번, 품명, 소요량, 단가, 구매수량, 구매금액,
   KG단가, 단품단가, 재질, 두께, 폭, 길이, SEP, 비중, EA중량,
   실적수량, 스크랩중량, 스크랩단가, 스크랩금액]

Row 7+: Data rows
  Parent rows: Column A populated (납품처)
  Child rows: Column A empty, Column I populated (구매처)
```

### 2. Import Logic

```typescript
async function importBOMFromExcel(file: File, sheetName: string) {
  const workbook = XLSX.read(await file.arrayBuffer());
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 6 });

  let currentParent = null;
  const bomEntries = [];

  for (const row of data) {
    if (row[0]) { // Parent row (납품처 exists)
      // Create or find parent item
      currentParent = await createOrFindItem({
        item_code: row[2],
        item_name: row[3],
        unit_price: row[4],
        item_type: 'finished_product'
      });
    } else if (row[8] && currentParent) { // Child row (구매처 exists)
      // Create or find child item
      const child = await createOrFindItem({
        item_code: row[10],
        item_name: row[11],
        item_type: row[8] === '태창금속' ? 'internal_production' : 'purchased'
      });

      // Create BOM relationship
      bomEntries.push({
        parent_item_id: currentParent.item_id,
        child_item_id: child.item_id,
        quantity_required: row[12] || 1.0
      });

      // If internal production, create coil specs
      if (row[8] === '태창금속' && row[19]) { // 재질 exists
        await createCoilSpecs({
          item_id: child.item_id,
          material_grade: row[19],
          thickness: row[20],
          width: row[21],
          length: row[22],
          sep_factor: row[23] || 1.0,
          density: row[24] || 7.85,
          kg_unit_price: row[17]
        });

        // Create scrap tracking if scrap data exists
        if (row[28]) { // 스크랩중량 exists
          await createScrapTracking({
            item_id: child.item_id,
            scrap_weight_per_piece: row[28],
            scrap_unit_price: row[29]
          });
        }
      }
    }
  }

  // Bulk insert BOM entries
  await insertBOMBatch(bomEntries);

  return { imported: bomEntries.length };
}
```

### 3. Export Logic

```typescript
async function exportBOMToExcel(parentItemId: number) {
  const parent = await getItem(parentItemId);
  const bom = await getBOMWithDetails(parentItemId);

  const rows = [];

  // Parent row
  rows.push([
    parent.customer_name,
    parent.vehicle_model,
    parent.item_code,
    parent.item_name,
    parent.unit_price,
    parent.quantity,
    parent.unit_price * parent.quantity,
    '', // separator
    '', '', '', '', '', '', '', '' // empty child columns
  ]);

  // Child rows
  for (const component of bom.components) {
    const row = [
      '', '', '', '', '', '', '', // empty parent columns
      component.supplier_name || component.item_type,
      component.supplier_name,
      component.vehicle_model,
      component.item_code,
      component.item_name,
      component.quantity_required,
      component.unit_price,
      component.quantity_required * parent.quantity,
      component.quantity_required * component.unit_price * parent.quantity,
      '', // 비고
      component.coil_specs?.kg_unit_price,
      component.coil_specs?.piece_unit_price,
      component.coil_specs?.material_grade,
      component.coil_specs?.thickness,
      component.coil_specs?.width,
      component.coil_specs?.length,
      component.coil_specs?.sep_factor,
      component.coil_specs?.density,
      component.coil_specs?.weight_per_piece,
      '', // separator
      parent.quantity,
      component.scrap?.scrap_weight_per_piece,
      component.scrap?.scrap_unit_price,
      component.scrap
        ? parent.quantity * component.scrap.scrap_weight_per_piece * component.scrap.scrap_unit_price
        : ''
    ];
    rows.push(row);
  }

  const worksheet = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, parent.item_name.substring(0, 31));

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
```

---

## 🧪 Testing Strategy

### 1. Unit Tests

```typescript
describe('Coil Specs Calculations', () => {
  test('calculates EA중량 correctly', () => {
    const specs = {
      thickness: 1.2,
      width: 1300,
      length: 420,
      density: 7.85,
      sep_factor: 1.0
    };

    const weight = calculateWeightPerPiece(specs);
    expect(weight).toBeCloseTo(5.14, 2);
  });

  test('calculates 단품단가 correctly', () => {
    const kgPrice = 1137;
    const weight = 5.14;

    const piecePrice = calculatePiecePrice(kgPrice, weight);
    expect(piecePrice).toBe(5844);
  });
});

describe('BOM Cost Calculation', () => {
  test('calculates total component cost', async () => {
    const parentId = 123;
    const quantity = 1000;

    const cost = await calculateBOMCost(parentId, quantity);
    expect(cost.total_component_cost).toBeGreaterThan(0);
    expect(cost.net_component_cost).toBe(
      cost.total_component_cost - cost.total_scrap_revenue
    );
  });
});
```

### 2. Integration Tests

```typescript
describe('BOM Import from Excel', () => {
  test('imports BOM structure correctly', async () => {
    const file = await fs.readFile('test_bom.xlsx');
    const result = await importBOMFromExcel(file, '대우공업');

    expect(result.imported).toBeGreaterThan(0);

    // Verify parent created
    const parent = await getItemByCode('65852-BY000');
    expect(parent).toBeDefined();
    expect(parent.item_type).toBe('finished_product');

    // Verify BOM relationship
    const bom = await getBOM(parent.item_id);
    expect(bom.components.length).toBeGreaterThan(0);

    // Verify coil specs for internal production
    const internalComponent = bom.components.find(
      c => c.item_type === 'internal_production'
    );
    expect(internalComponent.coil_specs).toBeDefined();
    expect(internalComponent.coil_specs.weight_per_piece).toBeGreaterThan(0);
  });
});
```

---

## 📚 Usage Examples

### Example 1: Creating Complete BOM Entry

```typescript
// 1. Create parent product
const parent = await createItem({
  item_code: '65852-BY000',
  item_name: 'MBR-RR FLR CTR CROSS',
  item_type: 'finished_product',
  unit_price: 5015
});

// 2. Create internal production component
const component = await createItem({
  item_code: '65852-BY000-BLANK',
  item_name: 'MBR-RR FLR CTR CROSS (Blank)',
  item_type: 'internal_production'
});

// 3. Add coil specifications
await createCoilSpecs({
  item_id: component.item_id,
  material_grade: 'SGARC340',
  thickness: 1.2,
  width: 1300,
  length: 420,
  sep_factor: 1.0,
  density: 7.85,
  kg_unit_price: 1137
});
// Auto-calculated: weight_per_piece = 5.14, piece_unit_price = 5844

// 4. Add scrap tracking
await createScrapTracking({
  item_id: component.item_id,
  scrap_weight_per_piece: 2.1,
  scrap_unit_price: 362
});

// 5. Create BOM relationship
await createBOM({
  parent_item_id: parent.item_id,
  child_item_id: component.item_id,
  quantity_required: 1.0
});
```

### Example 2: Cost Analysis Query

```typescript
// Get complete cost breakdown
const analysis = await analyzeBOMCost(parentItemId, productionQuantity);

console.log('Cost Analysis Report');
console.log('===================');
console.log(`Production Quantity: ${analysis.quantity}`);
console.log(`\nRevenue: ${analysis.revenue.toLocaleString()} won`);
console.log(`\nComponent Costs:`);

for (const component of analysis.components) {
  console.log(`  ${component.item_name}:`);
  console.log(`    Qty: ${component.required_quantity}`);
  console.log(`    Unit: ${component.unit_price.toLocaleString()} won`);
  console.log(`    Total: ${component.total_cost.toLocaleString()} won`);

  if (component.scrap_revenue > 0) {
    console.log(`    Scrap: -${component.scrap_revenue.toLocaleString()} won`);
    console.log(`    Net: ${component.net_cost.toLocaleString()} won`);
  }
}

console.log(`\nTotal Component Cost: ${analysis.total_cost.toLocaleString()} won`);
console.log(`Total Scrap Revenue: -${analysis.scrap_revenue.toLocaleString()} won`);
console.log(`Net Component Cost: ${analysis.net_cost.toLocaleString()} won`);
console.log(`\nGross Profit: ${analysis.gross_profit.toLocaleString()} won`);
console.log(`Margin: ${analysis.margin.toFixed(2)}%`);
```

---

## 🎓 Best Practices

### 1. Data Validation

- **Material Specs**: Validate dimensions are positive, reasonable values
- **SEP Factor**: Typically 1.0-1.5, validate range
- **Prices**: Non-negative, reasonable market values
- **Quantities**: Positive integers or decimals with appropriate precision

### 2. Performance Optimization

- **Index Usage**: Create indexes on foreign keys and frequently queried fields
- **Computed Columns**: Use GENERATED ALWAYS for auto-calculated fields
- **Batch Operations**: Bulk insert for BOM imports
- **View Materialization**: Consider materialized views for complex cost queries

### 3. Audit Trail

- **Timestamps**: Track created_at and updated_at for all tables
- **Price History**: Keep historical prices for cost variance analysis
- **BOM Versions**: Consider versioning for BOM changes over time

### 4. Error Handling

- **Validation**: Server-side validation for all inputs
- **Foreign Key Constraints**: Prevent orphaned records
- **Transaction Safety**: Use database transactions for multi-table operations
- **User Feedback**: Clear error messages with actionable guidance

---

**Document Version**: 1.0
**Last Updated**: 2025-10-14
**Next Review**: Upon Phase 3 implementation
