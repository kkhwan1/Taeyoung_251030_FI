# 제조 공정 자동화 구현 계획
## 코일 → 판재 → 납품 자동 재고 이동 시스템

**프로젝트**: 태창 ERP 현장 프로세스 자동화
**목표**: 조성진 차장님 요구사항 100% 충족
**기간**: 9-10일 (Wave 기반 병렬 실행)
**우선순위**: CRITICAL - 완벽한 구현 필수

---

## 🎯 핵심 요구사항 (조성진 차장님)

### 1. 코일 → 판재 → 납품 자동 재고 이동
**현재 문제**: 공정 완료 시 재고가 수동으로만 이동됨
**해결책**: `auto_process_stock_movement()` 트리거로 완전 자동화

### 2. BOM과 실제 공정 데이터 흐름 일치
**현재 문제**: BOM은 있지만 공정 흐름과 분리됨
**해결책**:
- process_chain_definitions 테이블로 공정 체인 정의
- auto_next_operation으로 자동 다음 공정 시작
- LOT genealogy로 코일→판재→완제품 추적

---

## 📊 Wave 실행 전략 (9-10일)

### Wave 1: Foundation Design (Day 1-2) - 3 Parallel Tracks
**Track A**: Database Schema Design
- Agent: database-architect
- Tasks: 6개 마이그레이션 설계
- Output: SQL migration files

**Track B**: API Architecture Planning
- Agent: backend-architect
- Tasks: 5개 API 엔드포인트 설계
- Output: API specification

**Track C**: UI Component Design
- Agent: frontend-developer
- Tasks: 컴포넌트 와이어프레임
- Output: Component specifications

### Wave 2: Core Implementation (Day 3-5) - 4 Parallel Tracks
**Track A**: Database Migrations
- Agent: database-architect + supabase-schema-architect
- Tasks: 6개 마이그레이션 적용
- Critical: Migration 3 (auto_process_stock_movement trigger)

**Track B**: Backend APIs
- Agent: backend-architect
- Tasks: 5개 API 구현
- Critical: POST /api/process/complete (트리거 활성화)

**Track C**: Frontend Components
- Agent: frontend-developer
- Tasks: 3+ React 컴포넌트
- Features: Batch mode, Chain mode UI

**Track D**: RLS Policies
- Agent: supabase-schema-architect
- Tasks: 보안 정책 구현

### Wave 3: Advanced Features (Day 6-7) - 3 Parallel Tracks
**Track A**: Batch Processing
- Agent: backend-architect + frontend-developer
- Feature: 다중 공정 동시 실행

**Track B**: Chain Automation
- Agent: backend-architect
- Feature: 코일→판재→납품 자동 체인

**Track C**: Real-time Dashboard
- Agent: frontend-developer
- Feature: 공정 현황 실시간 모니터링

### Wave 4: Testing & Optimization (Day 8-9) - 2 Parallel Tracks
**Track A**: E2E Testing
- Agent: qa persona
- Critical Test: 코일 → 판재 → 납품 전체 흐름
- Validation: 재고 자동 이동, LOT 추적

**Track B**: Performance Optimization
- Agent: performance persona
- Tasks: 쿼리 최적화, 인덱스 튜닝

### Wave 5: Production Deployment (Day 10) - 1 Track
**Track A**: Deployment & Monitoring
- Agent: devops persona
- Tasks: 마이그레이션 배포, 모니터링 설정

---

## 🗄️ Database Migrations (6개)

### Migration 1: create_stock_history.sql
**목적**: 모든 재고 이동의 완전한 감사 추적
**위험도**: LOW (신규 테이블)

```sql
-- Migration: create_stock_history.sql
-- Purpose: Complete audit trail for all inventory movements
-- Risk: LOW - New table, no existing data affected

CREATE TABLE IF NOT EXISTS stock_history (
  history_id BIGSERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,

  -- Change tracking
  change_type VARCHAR(50) NOT NULL CHECK (change_type IN (
    'PURCHASE', 'SALES', 'PRODUCTION', 'ADJUSTMENT', 'TRANSFER', 'RETURN',
    'PROCESS_INPUT', 'PROCESS_OUTPUT', 'BLANKING', 'PRESS', 'ASSEMBLY',
    'LOT_TRANSFER', 'SHIPPING', 'SCRAP', 'QUALITY_FAIL'
  )),

  quantity_change DECIMAL(15, 2) NOT NULL,
  stock_before DECIMAL(15, 2) NOT NULL,
  stock_after DECIMAL(15, 2) NOT NULL,

  -- Reference tracking
  reference_type VARCHAR(50), -- 'process_operation', 'inventory_transaction', etc.
  reference_id INTEGER,

  -- LOT tracking
  lot_number VARCHAR(100),
  batch_number VARCHAR(100),

  -- Metadata
  notes TEXT,
  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_stock_history_item_date ON stock_history(item_id, created_at DESC);
CREATE INDEX idx_stock_history_reference ON stock_history(reference_type, reference_id);
CREATE INDEX idx_stock_history_lot ON stock_history(lot_number) WHERE lot_number IS NOT NULL;
CREATE INDEX idx_stock_history_recent ON stock_history(created_at DESC) WHERE created_at > NOW() - INTERVAL '30 days';

-- Enable RLS
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all authenticated users to read
CREATE POLICY "Allow authenticated read on stock_history"
  ON stock_history FOR SELECT
  USING (true);

-- RLS Policy: Only system can insert (via triggers)
CREATE POLICY "System only insert on stock_history"
  ON stock_history FOR INSERT
  WITH CHECK (created_by IS NOT NULL);

COMMENT ON TABLE stock_history IS '재고 변동 이력 추적 - 모든 재고 이동의 완전한 감사 추적';
COMMENT ON COLUMN stock_history.change_type IS '변동 유형 - BLANKING(코일→판재), PRESS(판재→성형품) 등';
COMMENT ON COLUMN stock_history.lot_number IS 'LOT 번호 - BLK-YYYYMMDD-XXX 형식';
```

### Migration 2: extend_process_operations.sql
**목적**: process_operations 테이블 확장 (공정 체인, LOT 추적)
**위험도**: MEDIUM (기존 테이블 변경)

```sql
-- Migration: extend_process_operations.sql
-- Purpose: Extend process_operations for chain management and LOT tracking
-- Risk: MEDIUM - Altering existing table

-- Add new columns for process chain management
ALTER TABLE process_operations
  ADD COLUMN IF NOT EXISTS parent_operation_id INTEGER REFERENCES process_operations(operation_id),
  ADD COLUMN IF NOT EXISTS chain_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS chain_sequence INTEGER,

  -- LOT tracking
  ADD COLUMN IF NOT EXISTS lot_number VARCHAR(100) UNIQUE,
  ADD COLUMN IF NOT EXISTS parent_lot_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS child_lot_number VARCHAR(100),

  -- Batch tracking
  ADD COLUMN IF NOT EXISTS batch_id VARCHAR(100),

  -- Auto-processing flags
  ADD COLUMN IF NOT EXISTS auto_next_operation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS next_operation_type VARCHAR(50),

  -- Additional metrics
  ADD COLUMN IF NOT EXISTS scrap_quantity DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_status VARCHAR(20) DEFAULT 'PASS' CHECK (quality_status IN ('PASS', 'FAIL', 'PENDING'));

-- Indexes
CREATE INDEX idx_process_operations_chain ON process_operations(chain_id, chain_sequence) WHERE chain_id IS NOT NULL;
CREATE INDEX idx_process_operations_lot ON process_operations(lot_number) WHERE lot_number IS NOT NULL;
CREATE INDEX idx_process_operations_parent_lot ON process_operations(parent_lot_number) WHERE parent_lot_number IS NOT NULL;
CREATE INDEX idx_process_operations_batch ON process_operations(batch_id) WHERE batch_id IS NOT NULL;

-- Function: Generate LOT number
-- Format: {OPERATION_TYPE_PREFIX}-YYYYMMDD-XXX
-- Example: BLK-20250205-001, PRS-20250205-001
CREATE OR REPLACE FUNCTION generate_lot_number(
  p_operation_type VARCHAR,
  p_item_id INTEGER
)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR(3);
  v_date_str VARCHAR(8);
  v_sequence INTEGER;
  v_lot_number VARCHAR(100);
BEGIN
  -- Determine prefix based on operation type
  v_prefix := CASE p_operation_type
    WHEN 'BLANKING' THEN 'BLK'
    WHEN 'PRESS' THEN 'PRS'
    WHEN 'ASSEMBLY' THEN 'ASM'
    WHEN 'WELDING' THEN 'WLD'
    WHEN 'PAINTING' THEN 'PNT'
    WHEN 'SHIPPING' THEN 'SHP'
    ELSE 'OTH'
  END;

  -- Get current date string (YYYYMMDD)
  v_date_str := TO_CHAR(NOW(), 'YYYYMMDD');

  -- Get next sequence number for today
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(lot_number FROM LENGTH(v_prefix || '-' || v_date_str || '-') + 1) AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM process_operations
  WHERE lot_number LIKE v_prefix || '-' || v_date_str || '-%';

  -- Format: BLK-20250205-001
  v_lot_number := v_prefix || '-' || v_date_str || '-' || LPAD(v_sequence::TEXT, 3, '0');

  RETURN v_lot_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_lot_number IS 'LOT 번호 자동 생성 - BLK-YYYYMMDD-XXX 형식';
COMMENT ON COLUMN process_operations.chain_id IS '공정 체인 ID - 연결된 공정들의 그룹 식별자';
COMMENT ON COLUMN process_operations.lot_number IS '현재 LOT 번호';
COMMENT ON COLUMN process_operations.parent_lot_number IS '부모 LOT 번호 (이전 공정의 LOT)';
COMMENT ON COLUMN process_operations.child_lot_number IS '자식 LOT 번호 (다음 공정의 LOT)';
```

### Migration 3: create_auto_stock_movement_trigger.sql (🔥 CRITICAL)
**목적**: 공정 완료 시 재고 자동 이동 (코일 → 판재 핵심 기능!)
**위험도**: HIGH (핵심 비즈니스 로직)

```sql
-- Migration: create_auto_stock_movement_trigger.sql
-- Purpose: Automatic stock movement when process completes
-- Risk: HIGH - Critical business logic automation
-- THIS IS THE CORE OF 코일 → 판재 → 납품 AUTOMATION!

CREATE OR REPLACE FUNCTION auto_process_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_available_stock DECIMAL(15, 2);
  v_stock_before_input DECIMAL(15, 2);
  v_stock_before_output DECIMAL(15, 2);
  v_stock_after_input DECIMAL(15, 2);
  v_stock_after_output DECIMAL(15, 2);
  v_next_operation_id INTEGER;
  v_child_lot VARCHAR(100);
  v_input_item_name VARCHAR(200);
  v_output_item_name VARCHAR(200);
BEGIN
  -- Only process when status changes to COMPLETED
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN

    RAISE NOTICE '=== 공정 완료 재고 이동 시작 ===';
    RAISE NOTICE 'Operation ID: %, Type: %', NEW.operation_id, NEW.operation_type;
    RAISE NOTICE 'Input Item: % (Qty: %)', NEW.input_item_id, NEW.input_quantity;
    RAISE NOTICE 'Output Item: % (Qty: %)', NEW.output_item_id, NEW.output_quantity;

    -- Get item names for logging
    SELECT item_name INTO v_input_item_name FROM items WHERE item_id = NEW.input_item_id;
    SELECT item_name INTO v_output_item_name FROM items WHERE item_id = NEW.output_item_id;

    -- 1. VALIDATE STOCK AVAILABILITY
    SELECT current_stock INTO v_available_stock
    FROM items
    WHERE item_id = NEW.input_item_id;

    IF v_available_stock < NEW.input_quantity THEN
      RAISE EXCEPTION '재고 부족: % (필요: %, 현재: %)',
        v_input_item_name, NEW.input_quantity, v_available_stock;
    END IF;

    RAISE NOTICE '재고 검증 완료: % 현재고 %', v_input_item_name, v_available_stock;

    -- 2. CAPTURE STOCK LEVELS BEFORE CHANGE
    SELECT current_stock INTO v_stock_before_input
    FROM items WHERE item_id = NEW.input_item_id;

    SELECT current_stock INTO v_stock_before_output
    FROM items WHERE item_id = NEW.output_item_id;

    RAISE NOTICE '이동 전 재고: Input(%) %, Output(%) %',
      v_input_item_name, v_stock_before_input,
      v_output_item_name, v_stock_before_output;

    -- 3. UPDATE STOCKS (코일 → 판재 자동 재고 이동!)
    -- Deduct input item stock
    UPDATE items
    SET current_stock = current_stock - NEW.input_quantity,
        updated_at = NOW()
    WHERE item_id = NEW.input_item_id;

    -- Add output item stock
    UPDATE items
    SET current_stock = current_stock + NEW.output_quantity,
        updated_at = NOW()
    WHERE item_id = NEW.output_item_id;

    RAISE NOTICE '재고 이동 완료!';

    -- 4. CAPTURE STOCK LEVELS AFTER CHANGE
    SELECT current_stock INTO v_stock_after_input
    FROM items WHERE item_id = NEW.input_item_id;

    SELECT current_stock INTO v_stock_after_output
    FROM items WHERE item_id = NEW.output_item_id;

    RAISE NOTICE '이동 후 재고: Input(%) %, Output(%) %',
      v_input_item_name, v_stock_after_input,
      v_output_item_name, v_stock_after_output;

    -- 5. RECORD INPUT STOCK HISTORY (감소)
    INSERT INTO stock_history (
      item_id, change_type, quantity_change,
      stock_before, stock_after,
      reference_type, reference_id,
      lot_number, notes, created_at
    )
    VALUES (
      NEW.input_item_id,
      NEW.operation_type || '_INPUT',
      -NEW.input_quantity,
      v_stock_before_input,
      v_stock_after_input,
      'process_operation',
      NEW.operation_id,
      NEW.lot_number,
      FORMAT('공정 완료 투입: %s → %s (LOT: %s)',
        v_input_item_name, NEW.operation_type, NEW.lot_number),
      NOW()
    );

    -- 6. RECORD OUTPUT STOCK HISTORY (증가)
    INSERT INTO stock_history (
      item_id, change_type, quantity_change,
      stock_before, stock_after,
      reference_type, reference_id,
      lot_number, notes, created_at
    )
    VALUES (
      NEW.output_item_id,
      NEW.operation_type || '_OUTPUT',
      NEW.output_quantity,
      v_stock_before_output,
      v_stock_after_output,
      'process_operation',
      NEW.operation_id,
      NEW.lot_number,
      FORMAT('공정 완료 산출: %s 생산 (LOT: %s)',
        NEW.operation_type, NEW.lot_number),
      NOW()
    );

    RAISE NOTICE '재고 이력 기록 완료';

    -- 7. AUTO-START NEXT OPERATION (체인 자동화)
    IF NEW.auto_next_operation = TRUE AND NEW.next_operation_type IS NOT NULL THEN
      RAISE NOTICE '다음 공정 자동 시작: %', NEW.next_operation_type;

      -- Generate child LOT number
      v_child_lot := generate_lot_number(NEW.next_operation_type, NEW.output_item_id);

      RAISE NOTICE '자식 LOT 생성: %', v_child_lot;

      -- Create next operation
      INSERT INTO process_operations (
        operation_type,
        input_item_id,
        input_quantity,
        output_item_id,
        output_quantity,
        parent_operation_id,
        chain_id,
        chain_sequence,
        lot_number,
        parent_lot_number,
        status,
        scheduled_date,
        created_at
      )
      SELECT
        NEW.next_operation_type,
        NEW.output_item_id, -- 이전 공정의 output이 다음 공정의 input!
        NEW.output_quantity,
        NEW.output_item_id, -- Placeholder, actual output 결정은 나중에
        NEW.output_quantity, -- Expected output
        NEW.operation_id,
        NEW.chain_id,
        COALESCE(NEW.chain_sequence, 0) + 1,
        v_child_lot,
        NEW.lot_number,
        'PENDING',
        NOW(),
        NOW()
      RETURNING operation_id INTO v_next_operation_id;

      -- Update current operation's child LOT
      UPDATE process_operations
      SET child_lot_number = v_child_lot
      WHERE operation_id = NEW.operation_id;

      RAISE NOTICE '다음 공정 생성 완료: Operation ID %', v_next_operation_id;
    END IF;

    RAISE NOTICE '=== 공정 완료 재고 이동 종료 ===';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_process_stock_movement ON process_operations;

CREATE TRIGGER trigger_auto_process_stock_movement
  AFTER UPDATE ON process_operations
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_stock_movement();

COMMENT ON FUNCTION auto_process_stock_movement IS '공정 완료 시 재고 자동 이동 및 다음 공정 자동 시작 - 코일→판재→납품 자동화의 핵심';
```

### Migration 4: create_material_types.sql
**목적**: 자재 유형 분류 (코일, 판재, 완제품 등)
**위험도**: LOW (신규 테이블)

```sql
-- Migration: create_material_types.sql
-- Purpose: Material type classification for manufacturing process
-- Risk: LOW - New table

CREATE TABLE IF NOT EXISTS material_types (
  type_id SERIAL PRIMARY KEY,
  type_code VARCHAR(20) UNIQUE NOT NULL,
  type_name_ko VARCHAR(100) NOT NULL,
  type_name_en VARCHAR(100),
  description TEXT,
  process_stage VARCHAR(50), -- 'RAW', 'SEMI', 'FINISHED'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert standard material types
INSERT INTO material_types (type_code, type_name_ko, type_name_en, process_stage) VALUES
  ('RAW_MATERIAL', '원자재', 'Raw Material', 'RAW'),
  ('COIL', '코일', 'Coil', 'RAW'),
  ('PLATE', '판재', 'Plate', 'SEMI'),
  ('SEMI_FINISHED', '반제품', 'Semi-Finished Product', 'SEMI'),
  ('FINISHED_PRODUCT', '완제품', 'Finished Product', 'FINISHED'),
  ('COMPONENT', '부품', 'Component', 'SEMI'),
  ('CONSUMABLE', '소모품', 'Consumable', 'RAW');

-- Add material_type_id to items table
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS material_type_id INTEGER REFERENCES material_types(type_id);

-- Update existing items (manual classification needed later)
UPDATE items SET material_type_id = (
  SELECT type_id FROM material_types WHERE type_code = 'RAW_MATERIAL'
) WHERE material_type_id IS NULL;

CREATE INDEX idx_items_material_type ON items(material_type_id);

COMMENT ON TABLE material_types IS '자재 유형 분류 - 코일, 판재, 완제품 등';
```

### Migration 5: create_process_chain_definitions.sql
**목적**: 공정 체인 정의 (코일 → 판재 → 납품 경로)
**위험도**: LOW (신규 테이블)

```sql
-- Migration: create_process_chain_definitions.sql
-- Purpose: Define standard process chains (e.g., Coil → Plate → Delivery)
-- Risk: LOW - New table

CREATE TABLE IF NOT EXISTS process_chain_definitions (
  chain_definition_id SERIAL PRIMARY KEY,
  chain_name VARCHAR(200) NOT NULL,
  chain_description TEXT,

  -- Chain structure (JSON array of steps)
  -- Example: [
  --   {"step": 1, "operation_type": "BLANKING", "input_type": "COIL", "output_type": "PLATE"},
  --   {"step": 2, "operation_type": "PRESS", "input_type": "PLATE", "output_type": "SEMI_FINISHED"},
  --   {"step": 3, "operation_type": "SHIPPING", "input_type": "SEMI_FINISHED", "output_type": "FINISHED_PRODUCT"}
  -- ]
  chain_steps JSONB NOT NULL,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert standard chain: 코일 → 판재 → 납품
INSERT INTO process_chain_definitions (chain_name, chain_description, chain_steps) VALUES
(
  '코일 → 판재 → 납품',
  '표준 제조 공정: 코일 블랭킹 → 판재 프레스 → 완제품 출하',
  '[
    {
      "step": 1,
      "operation_type": "BLANKING",
      "operation_name": "블랭킹 (코일 → 판재)",
      "input_material_type": "COIL",
      "output_material_type": "PLATE",
      "auto_next": true
    },
    {
      "step": 2,
      "operation_type": "PRESS",
      "operation_name": "프레스 (판재 → 성형품)",
      "input_material_type": "PLATE",
      "output_material_type": "SEMI_FINISHED",
      "auto_next": true
    },
    {
      "step": 3,
      "operation_type": "SHIPPING",
      "operation_name": "출하 (성형품 → 납품)",
      "input_material_type": "SEMI_FINISHED",
      "output_material_type": "FINISHED_PRODUCT",
      "auto_next": false
    }
  ]'::JSONB
);

CREATE INDEX idx_process_chain_definitions_active ON process_chain_definitions(is_active);

COMMENT ON TABLE process_chain_definitions IS '공정 체인 정의 - 코일→판재→납품 등 표준 제조 경로';
COMMENT ON COLUMN process_chain_definitions.chain_steps IS '공정 단계 정의 (JSONB 배열)';
```

### Migration 6: create_performance_indexes.sql
**목적**: 성능 최적화 인덱스
**위험도**: LOW (인덱스만 추가)

```sql
-- Migration: create_performance_indexes.sql
-- Purpose: Performance optimization indexes for process operations
-- Risk: LOW - Index creation only

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_process_operations_status_date
  ON process_operations(status, scheduled_date DESC)
  WHERE status IN ('PENDING', 'IN_PROGRESS');

CREATE INDEX IF NOT EXISTS idx_process_operations_completed_recent
  ON process_operations(completed_at DESC)
  WHERE status = 'COMPLETED' AND completed_at > NOW() - INTERVAL '90 days';

-- Index for chain queries
CREATE INDEX IF NOT EXISTS idx_process_operations_chain_active
  ON process_operations(chain_id, chain_sequence, status)
  WHERE chain_id IS NOT NULL;

-- Index for item-based queries
CREATE INDEX IF NOT EXISTS idx_process_operations_input_item
  ON process_operations(input_item_id, status);

CREATE INDEX IF NOT EXISTS idx_process_operations_output_item
  ON process_operations(output_item_id, status);

-- Partial index for recent operations (performance optimization)
CREATE INDEX IF NOT EXISTS idx_process_operations_recent_90days
  ON process_operations(created_at DESC, status)
  WHERE created_at > NOW() - INTERVAL '90 days';

-- Stock history performance indexes
CREATE INDEX IF NOT EXISTS idx_stock_history_change_type_date
  ON stock_history(change_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_history_item_recent
  ON stock_history(item_id, created_at DESC)
  WHERE created_at > NOW() - INTERVAL '90 days';

COMMENT ON INDEX idx_process_operations_status_date IS '진행 중/대기 중 공정 빠른 조회';
COMMENT ON INDEX idx_process_operations_chain_active IS '공정 체인 조회 최적화';
```

---

## 🔌 Backend API Implementation (5개)

### API 1: POST /api/process/start
**목적**: 새로운 공정 시작
**파일**: `src/app/api/process/start/route.ts`

```typescript
// src/app/api/process/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ProcessStartSchema = z.object({
  operation_type: z.enum(['BLANKING', 'PRESS', 'ASSEMBLY', 'WELDING', 'PAINTING', 'SHIPPING']),
  input_item_id: z.number().int().positive(),
  input_quantity: z.number().positive(),
  output_item_id: z.number().int().positive(),
  expected_output_quantity: z.number().positive().optional(),
  scheduled_date: z.string().datetime().optional(),
  auto_next_operation: z.boolean().default(false),
  next_operation_type: z.string().optional(),
  notes: z.string().optional(),
  created_by: z.number().int().default(1)
});

export async function POST(request: NextRequest) {
  try {
    // Korean text handling
    const text = await request.text();
    const body = JSON.parse(text);

    // Validate
    const validated = ProcessStartSchema.parse(body);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. Validate stock availability
    const { data: inputItem, error: itemError } = await supabase
      .from('items')
      .select('item_name, current_stock')
      .eq('item_id', validated.input_item_id)
      .single();

    if (itemError || !inputItem) {
      return NextResponse.json({
        success: false,
        error: '투입 품목을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    if (inputItem.current_stock < validated.input_quantity) {
      return NextResponse.json({
        success: false,
        error: `재고 부족: ${inputItem.item_name} (필요: ${validated.input_quantity}, 현재: ${inputItem.current_stock})`
      }, { status: 400 });
    }

    // 2. Generate LOT number
    const { data: lotNumber, error: lotError } = await supabase.rpc('generate_lot_number', {
      p_operation_type: validated.operation_type,
      p_item_id: validated.input_item_id
    });

    if (lotError) {
      return NextResponse.json({
        success: false,
        error: 'LOT 번호 생성 실패',
        details: lotError.message
      }, { status: 500 });
    }

    // 3. Create process operation
    const { data: operation, error: createError } = await supabase
      .from('process_operations')
      .insert({
        operation_type: validated.operation_type,
        input_item_id: validated.input_item_id,
        input_quantity: validated.input_quantity,
        output_item_id: validated.output_item_id,
        output_quantity: validated.expected_output_quantity || validated.input_quantity,
        status: 'PENDING',
        lot_number: lotNumber,
        scheduled_date: validated.scheduled_date || new Date().toISOString(),
        auto_next_operation: validated.auto_next_operation,
        next_operation_type: validated.next_operation_type,
        notes: validated.notes,
        created_by: validated.created_by
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json({
        success: false,
        error: '공정 생성 실패',
        details: createError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        operation,
        message: `공정 시작: ${validated.operation_type} (LOT: ${lotNumber})`
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: '입력 검증 실패',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: '서버 오류',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
```

### API 2: POST /api/process/complete (🔥 CRITICAL - 트리거 활성화!)
**목적**: 공정 완료 및 자동 재고 이동
**파일**: `src/app/api/process/complete/route.ts`

```typescript
// src/app/api/process/complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ProcessCompleteSchema = z.object({
  operation_id: z.number().int().positive(),
  actual_output_quantity: z.number().positive(),
  scrap_quantity: z.number().nonnegative().default(0),
  quality_status: z.enum(['PASS', 'FAIL', 'PENDING']).default('PASS'),
  completion_notes: z.string().optional(),
  completed_by: z.number().int().default(1)
});

export async function POST(request: NextRequest) {
  try {
    // Korean text handling
    const text = await request.text();
    const body = JSON.parse(text);

    // Validate
    const validated = ProcessCompleteSchema.parse(body);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. Get operation details
    const { data: operation, error: opError } = await supabase
      .from('process_operations')
      .select('*, input_item:items!input_item_id(item_name), output_item:items!output_item_id(item_name)')
      .eq('operation_id', validated.operation_id)
      .single();

    if (opError || !operation) {
      return NextResponse.json({
        success: false,
        error: '공정을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    if (operation.status === 'COMPLETED') {
      return NextResponse.json({
        success: false,
        error: '이미 완료된 공정입니다.'
      }, { status: 400 });
    }

    // 2. Calculate efficiency
    const efficiency = operation.output_quantity > 0
      ? (validated.actual_output_quantity / operation.output_quantity) * 100
      : 0;

    // 3. Generate child LOT number (if auto_next_operation is true)
    let childLot = null;
    if (operation.auto_next_operation && operation.next_operation_type) {
      const { data: childLotData } = await supabase.rpc('generate_lot_number', {
        p_operation_type: operation.next_operation_type,
        p_item_id: operation.output_item_id
      });
      childLot = childLotData;
    }

    // 4. ⚠️ UPDATE OPERATION STATUS - THIS TRIGGERS auto_process_stock_movement()!
    const { data: completed, error: updateError } = await supabase
      .from('process_operations')
      .update({
        status: 'COMPLETED',
        output_quantity: validated.actual_output_quantity,
        scrap_quantity: validated.scrap_quantity,
        quality_status: validated.quality_status,
        efficiency: efficiency,
        child_lot_number: childLot,
        completed_at: new Date().toISOString(),
        notes: validated.completion_notes
          ? `${operation.notes || ''}\n완료: ${validated.completion_notes}`
          : operation.notes
      })
      .eq('operation_id', validated.operation_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: '공정 완료 처리 실패',
        details: updateError.message
      }, { status: 500 });
    }

    // 5. Fetch updated stock levels (트리거가 이미 재고를 업데이트했음)
    const { data: updatedStocks } = await supabase
      .from('items')
      .select('item_id, item_name, current_stock')
      .in('item_id', [operation.input_item_id, operation.output_item_id]);

    // 6. Fetch stock history (트리거가 기록한 이력)
    const { data: stockHistory } = await supabase
      .from('stock_history')
      .select('*')
      .eq('reference_type', 'process_operation')
      .eq('reference_id', validated.operation_id)
      .order('created_at', { ascending: false });

    // 7. Check if next operation was auto-created
    let nextOperation = null;
    if (operation.auto_next_operation && childLot) {
      const { data: nextOp } = await supabase
        .from('process_operations')
        .select('*')
        .eq('parent_lot_number', operation.lot_number)
        .eq('lot_number', childLot)
        .single();

      nextOperation = nextOp;
    }

    return NextResponse.json({
      success: true,
      data: {
        operation: completed,
        stock_movements: stockHistory,
        updated_stocks: updatedStocks,
        next_operation: nextOperation,
        message: '공정이 완료되었고 재고가 자동으로 이동되었습니다.',
        summary: {
          input_item: operation.input_item?.item_name,
          input_quantity: operation.input_quantity,
          output_item: operation.output_item?.item_name,
          output_quantity: validated.actual_output_quantity,
          scrap_quantity: validated.scrap_quantity,
          efficiency: `${efficiency.toFixed(2)}%`,
          lot_number: operation.lot_number,
          child_lot_number: childLot
        }
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: '입력 검증 실패',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: '서버 오류',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
```

### API 3: POST /api/process/chain
**목적**: 전체 공정 체인 시작 (코일 → 판재 → 납품)
**파일**: `src/app/api/process/chain/route.ts`

```typescript
// src/app/api/process/chain/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const ProcessChainSchema = z.object({
  chain_definition_id: z.number().int().positive(),
  initial_item_id: z.number().int().positive(), // 코일 ID
  initial_quantity: z.number().positive(),
  scheduled_date: z.string().datetime().optional(),
  notes: z.string().optional(),
  created_by: z.number().int().default(1)
});

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    const body = JSON.parse(text);
    const validated = ProcessChainSchema.parse(body);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. Get chain definition (코일 → 판재 → 납품 경로)
    const { data: chainDef, error: chainError } = await supabase
      .from('process_chain_definitions')
      .select('*')
      .eq('chain_definition_id', validated.chain_definition_id)
      .eq('is_active', true)
      .single();

    if (chainError || !chainDef) {
      return NextResponse.json({
        success: false,
        error: '공정 체인 정의를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 2. Generate unique chain ID
    const chainId = `CHAIN-${Date.now()}-${uuidv4().substring(0, 8)}`;

    // 3. Parse chain steps
    const steps = chainDef.chain_steps as Array<{
      step: number;
      operation_type: string;
      operation_name: string;
      input_material_type: string;
      output_material_type: string;
      auto_next: boolean;
    }>;

    // 4. Create first operation only (rest will be auto-created by trigger)
    const firstStep = steps[0];
    const secondStep = steps[1] || null;

    // Generate LOT for first operation
    const { data: lotNumber } = await supabase.rpc('generate_lot_number', {
      p_operation_type: firstStep.operation_type,
      p_item_id: validated.initial_item_id
    });

    // TODO: In real implementation, need to determine output_item_id based on material type
    // For now, using placeholder logic
    const outputItemId = validated.initial_item_id; // Placeholder

    const { data: firstOperation, error: createError } = await supabase
      .from('process_operations')
      .insert({
        operation_type: firstStep.operation_type,
        input_item_id: validated.initial_item_id,
        input_quantity: validated.initial_quantity,
        output_item_id: outputItemId,
        output_quantity: validated.initial_quantity,
        status: 'PENDING',
        chain_id: chainId,
        chain_sequence: firstStep.step,
        lot_number: lotNumber,
        scheduled_date: validated.scheduled_date || new Date().toISOString(),
        auto_next_operation: firstStep.auto_next,
        next_operation_type: secondStep?.operation_type || null,
        notes: `${chainDef.chain_name} - ${firstStep.operation_name}\n${validated.notes || ''}`,
        created_by: validated.created_by
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json({
        success: false,
        error: '공정 체인 시작 실패',
        details: createError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        chain: {
          chain_id: chainId,
          chain_name: chainDef.chain_name,
          total_steps: steps.length
        },
        first_operation: firstOperation,
        message: `공정 체인 시작: ${chainDef.chain_name} (${steps.length}단계)`,
        next_steps: `이후 단계는 각 공정 완료 시 자동으로 시작됩니다.`
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: '입력 검증 실패',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: '서버 오류',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
```

### API 4: POST /api/process/batch
**목적**: 다중 공정 동시 시작
**파일**: `src/app/api/process/batch/route.ts`

```typescript
// src/app/api/process/batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const BatchProcessSchema = z.object({
  operations: z.array(z.object({
    operation_type: z.enum(['BLANKING', 'PRESS', 'ASSEMBLY', 'WELDING', 'PAINTING', 'SHIPPING']),
    input_item_id: z.number().int().positive(),
    input_quantity: z.number().positive(),
    output_item_id: z.number().int().positive(),
    expected_output_quantity: z.number().positive().optional(),
    notes: z.string().optional()
  })),
  batch_id: z.string().optional(),
  scheduled_date: z.string().datetime().optional(),
  created_by: z.number().int().default(1)
});

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    const body = JSON.parse(text);
    const validated = BatchProcessSchema.parse(body);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Generate batch ID
    const batchId = validated.batch_id || `BATCH-${Date.now()}`;

    // Process all operations in parallel
    const results = await Promise.all(
      validated.operations.map(async (op, index) => {
        try {
          // Generate LOT
          const { data: lotNumber } = await supabase.rpc('generate_lot_number', {
            p_operation_type: op.operation_type,
            p_item_id: op.input_item_id
          });

          // Create operation
          const { data, error } = await supabase
            .from('process_operations')
            .insert({
              operation_type: op.operation_type,
              input_item_id: op.input_item_id,
              input_quantity: op.input_quantity,
              output_item_id: op.output_item_id,
              output_quantity: op.expected_output_quantity || op.input_quantity,
              status: 'PENDING',
              batch_id: batchId,
              lot_number: lotNumber,
              scheduled_date: validated.scheduled_date || new Date().toISOString(),
              notes: `배치 ${index + 1}/${validated.operations.length}: ${op.notes || ''}`,
              created_by: validated.created_by
            })
            .select()
            .single();

          if (error) throw error;

          return {
            success: true,
            operation: data,
            lot_number: lotNumber
          };

        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            operation_index: index
          };
        }
      })
    );

    // Aggregate results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return NextResponse.json({
      success: failed.length === 0,
      data: {
        batch_id: batchId,
        total: validated.operations.length,
        successful: successful.length,
        failed: failed.length,
        operations: successful.map(r => r.operation),
        errors: failed
      },
      message: `배치 처리 완료: ${successful.length}/${validated.operations.length} 성공`
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: '입력 검증 실패',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: '서버 오류',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
```

### API 5: GET /api/process/history
**목적**: 공정 이력 조회 (LOT 추적, 재고 이동 이력)
**파일**: `src/app/api/process/history/route.ts`

```typescript
// src/app/api/process/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lotNumber = searchParams.get('lot_number');
    const chainId = searchParams.get('chain_id');
    const itemId = searchParams.get('item_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Build query
    let query = supabase
      .from('process_operations')
      .select(`
        *,
        input_item:items!input_item_id(item_id, item_code, item_name),
        output_item:items!output_item_id(item_id, item_code, item_name)
      `);

    // Apply filters
    if (lotNumber) {
      query = query.or(`lot_number.eq.${lotNumber},parent_lot_number.eq.${lotNumber},child_lot_number.eq.${lotNumber}`);
    }

    if (chainId) {
      query = query.eq('chain_id', chainId);
    }

    if (itemId) {
      query = query.or(`input_item_id.eq.${itemId},output_item_id.eq.${itemId}`);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    query = query.order('created_at', { ascending: false });

    const { data: operations, error: opError } = await query;

    if (opError) {
      return NextResponse.json({
        success: false,
        error: '공정 이력 조회 실패',
        details: opError.message
      }, { status: 500 });
    }

    // Get stock movements for these operations
    const operationIds = operations?.map(op => op.operation_id) || [];

    const { data: stockMovements } = await supabase
      .from('stock_history')
      .select('*')
      .eq('reference_type', 'process_operation')
      .in('reference_id', operationIds)
      .order('created_at', { ascending: false });

    // Build genealogy tree if lot_number provided
    let genealogy = null;
    if (lotNumber && operations && operations.length > 0) {
      genealogy = await buildLotGenealogy(supabase, lotNumber);
    }

    return NextResponse.json({
      success: true,
      data: {
        operations: operations || [],
        stock_movements: stockMovements || [],
        genealogy,
        summary: {
          total_operations: operations?.length || 0,
          total_stock_movements: stockMovements?.length || 0
        }
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '서버 오류',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to build LOT genealogy tree
async function buildLotGenealogy(supabase: any, lotNumber: string) {
  // Find root operation
  const { data: rootOp } = await supabase
    .from('process_operations')
    .select('*')
    .eq('lot_number', lotNumber)
    .single();

  if (!rootOp) return null;

  // Build tree recursively
  const tree = {
    lot_number: rootOp.lot_number,
    operation_type: rootOp.operation_type,
    status: rootOp.status,
    parent: null as any,
    children: [] as any[]
  };

  // Get parent
  if (rootOp.parent_lot_number) {
    const { data: parentOp } = await supabase
      .from('process_operations')
      .select('lot_number, operation_type, status')
      .eq('lot_number', rootOp.parent_lot_number)
      .single();

    if (parentOp) {
      tree.parent = parentOp;
    }
  }

  // Get children
  if (rootOp.child_lot_number) {
    const { data: childOp } = await supabase
      .from('process_operations')
      .select('lot_number, operation_type, status')
      .eq('lot_number', rootOp.child_lot_number)
      .single();

    if (childOp) {
      tree.children.push(childOp);
    }
  }

  return tree;
}
```

---

## 🎨 Frontend Components (3+개)

### Component 1: ProcessStartForm
**목적**: 공정 시작 폼
**파일**: `src/components/process/ProcessStartForm.tsx`

```typescript
// src/components/process/ProcessStartForm.tsx
'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface ProcessStartFormProps {
  onSuccess?: (operation: any) => void;
}

export default function ProcessStartForm({ onSuccess }: ProcessStartFormProps) {
  const [formData, setFormData] = useState({
    operation_type: 'BLANKING',
    input_item_id: '',
    input_quantity: '',
    output_item_id: '',
    auto_next_operation: false,
    next_operation_type: ''
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/process/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          input_item_id: parseInt(formData.input_item_id),
          input_quantity: parseFloat(formData.input_quantity),
          output_item_id: parseInt(formData.output_item_id)
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.data.message);
        onSuccess?.(result.data.operation);
        // Reset form
        setFormData({
          operation_type: 'BLANKING',
          input_item_id: '',
          input_quantity: '',
          output_item_id: '',
          auto_next_operation: false,
          next_operation_type: ''
        });
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('공정 시작 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-white dark:bg-gray-800 rounded-lg">
      <h2 className="text-xl font-bold">공정 시작</h2>

      <div>
        <label className="block text-sm font-medium mb-1">공정 유형</label>
        <select
          value={formData.operation_type}
          onChange={(e) => setFormData({ ...formData, operation_type: e.target.value })}
          className="w-full px-3 py-2 border rounded dark:bg-gray-700"
        >
          <option value="BLANKING">블랭킹 (코일 → 판재)</option>
          <option value="PRESS">프레스 (판재 → 성형품)</option>
          <option value="ASSEMBLY">조립</option>
          <option value="SHIPPING">출하</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">투입 품목 ID</label>
        <input
          type="number"
          value={formData.input_item_id}
          onChange={(e) => setFormData({ ...formData, input_item_id: e.target.value })}
          className="w-full px-3 py-2 border rounded dark:bg-gray-700"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">투입 수량</label>
        <input
          type="number"
          step="0.01"
          value={formData.input_quantity}
          onChange={(e) => setFormData({ ...formData, input_quantity: e.target.value })}
          className="w-full px-3 py-2 border rounded dark:bg-gray-700"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">산출 품목 ID</label>
        <input
          type="number"
          value={formData.output_item_id}
          onChange={(e) => setFormData({ ...formData, output_item_id: e.target.value })}
          className="w-full px-3 py-2 border rounded dark:bg-gray-700"
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="auto_next"
          checked={formData.auto_next_operation}
          onChange={(e) => setFormData({ ...formData, auto_next_operation: e.target.checked })}
        />
        <label htmlFor="auto_next" className="text-sm">
          완료 시 자동으로 다음 공정 시작
        </label>
      </div>

      {formData.auto_next_operation && (
        <div>
          <label className="block text-sm font-medium mb-1">다음 공정 유형</label>
          <select
            value={formData.next_operation_type}
            onChange={(e) => setFormData({ ...formData, next_operation_type: e.target.value })}
            className="w-full px-3 py-2 border rounded dark:bg-gray-700"
          >
            <option value="">선택...</option>
            <option value="PRESS">프레스</option>
            <option value="ASSEMBLY">조립</option>
            <option value="SHIPPING">출하</option>
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '처리 중...' : '공정 시작'}
      </button>
    </form>
  );
}
```

### Component 2: ProcessCompleteButton
**목적**: 공정 완료 버튼 (재고 자동 이동 트리거)
**파일**: `src/components/process/ProcessCompleteButton.tsx`

```typescript
// src/components/process/ProcessCompleteButton.tsx
'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface ProcessCompleteButtonProps {
  operation: any;
  onSuccess?: (result: any) => void;
}

export default function ProcessCompleteButton({ operation, onSuccess }: ProcessCompleteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [actualOutput, setActualOutput] = useState(operation.output_quantity.toString());
  const [scrap, setScrap] = useState('0');
  const [quality, setQuality] = useState<'PASS' | 'FAIL' | 'PENDING'>('PASS');

  const handleComplete = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/process/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_id: operation.operation_id,
          actual_output_quantity: parseFloat(actualOutput),
          scrap_quantity: parseFloat(scrap),
          quality_status: quality
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.data.message);

        // Show stock movements
        if (result.data.stock_movements && result.data.stock_movements.length > 0) {
          toast.success(`재고 이동 완료: ${result.data.stock_movements.length}건`);
        }

        // Show next operation if auto-created
        if (result.data.next_operation) {
          toast.success(`다음 공정 자동 생성: ${result.data.next_operation.operation_type}`);
        }

        setShowModal(false);
        onSuccess?.(result.data);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('공정 완료 처리 실패');
    } finally {
      setLoading(false);
    }
  };

  if (operation.status === 'COMPLETED') {
    return (
      <span className="text-green-600 font-medium">✓ 완료됨</span>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        공정 완료
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">공정 완료</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">실제 산출 수량</label>
                <input
                  type="number"
                  step="0.01"
                  value={actualOutput}
                  onChange={(e) => setActualOutput(e.target.value)}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">불량 수량</label>
                <input
                  type="number"
                  step="0.01"
                  value={scrap}
                  onChange={(e) => setScrap(e.target.value)}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">품질 상태</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700"
                >
                  <option value="PASS">합격</option>
                  <option value="FAIL">불합격</option>
                  <option value="PENDING">검사 중</option>
                </select>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ 완료 시 재고가 자동으로 이동됩니다.
                </p>
                {operation.auto_next_operation && (
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                    ✓ 다음 공정이 자동으로 시작됩니다.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleComplete}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? '처리 중...' : '완료'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

---

## 🧪 E2E Testing Strategy

### Critical Test: 코일 → 판재 → 납품 전체 흐름
**파일**: `tests/e2e/process/full-chain.spec.ts`

```typescript
// tests/e2e/process/full-chain.spec.ts
import { test, expect } from '@playwright/test';

test.describe('코일 → 판재 → 납품 전체 공정 흐름', () => {
  test('자동 재고 이동 및 공정 체인 검증', async ({ page }) => {
    // 1. 초기 재고 확인
    await page.goto('http://localhost:5000/stock');

    const initialCoilStock = await page.locator('[data-testid="item-stock-COIL001"]').textContent();
    const initialPlateStock = await page.locator('[data-testid="item-stock-PLATE001"]').textContent();

    console.log('초기 재고:', { coil: initialCoilStock, plate: initialPlateStock });

    // 2. 블랭킹 공정 시작 (코일 → 판재)
    await page.goto('http://localhost:5000/process');
    await page.click('[data-testid="start-process-btn"]');

    await page.selectOption('[data-testid="operation-type"]', 'BLANKING');
    await page.fill('[data-testid="input-item-id"]', 'COIL001');
    await page.fill('[data-testid="input-quantity"]', '100');
    await page.fill('[data-testid="output-item-id"]', 'PLATE001');
    await page.check('[data-testid="auto-next-operation"]');
    await page.selectOption('[data-testid="next-operation-type"]', 'PRESS');

    await page.click('[data-testid="submit-process"]');

    // LOT 번호 확인
    const lotNumber = await page.locator('[data-testid="lot-number"]').textContent();
    expect(lotNumber).toMatch(/BLK-\d{8}-\d{3}/);

    console.log('블랭킹 LOT:', lotNumber);

    // 3. 블랭킹 완료
    await page.click(`[data-testid="complete-operation-${lotNumber}"]`);
    await page.fill('[data-testid="actual-output"]', '98'); // 2% 불량
    await page.fill('[data-testid="scrap-quantity"]', '2');
    await page.selectOption('[data-testid="quality-status"]', 'PASS');
    await page.click('[data-testid="confirm-complete"]');

    // 완료 메시지 확인
    await expect(page.locator('.toast-success')).toContainText('재고가 자동으로 이동되었습니다');

    // 4. 재고 이동 검증
    await page.goto('http://localhost:5000/stock');

    const afterBlankingCoilStock = await page.locator('[data-testid="item-stock-COIL001"]').textContent();
    const afterBlankingPlateStock = await page.locator('[data-testid="item-stock-PLATE001"]').textContent();

    expect(parseFloat(afterBlankingCoilStock!)).toBe(parseFloat(initialCoilStock!) - 100);
    expect(parseFloat(afterBlankingPlateStock!)).toBe(parseFloat(initialPlateStock!) + 98);

    console.log('블랭킹 후 재고:', { coil: afterBlankingCoilStock, plate: afterBlankingPlateStock });

    // 5. 다음 공정 자동 생성 확인 (프레스)
    await page.goto('http://localhost:5000/process');

    const pressOperation = await page.locator('[data-testid^="operation-PRS-"]').first();
    await expect(pressOperation).toBeVisible();

    const pressLotNumber = await pressOperation.getAttribute('data-testid');
    expect(pressLotNumber).toMatch(/PRS-\d{8}-\d{3}/);

    console.log('자동 생성된 프레스 LOT:', pressLotNumber);

    // 6. LOT 추적 검증
    await page.goto(`http://localhost:5000/process/history?lot_number=${lotNumber}`);

    const genealogy = await page.locator('[data-testid="lot-genealogy"]');
    await expect(genealogy).toContainText(lotNumber!); // Parent LOT
    await expect(genealogy).toContainText(pressLotNumber!); // Child LOT

    // 7. 재고 이력 검증
    const stockHistory = await page.locator('[data-testid="stock-history"]');
    await expect(stockHistory).toContainText('BLANKING_INPUT'); // 코일 차감
    await expect(stockHistory).toContainText('BLANKING_OUTPUT'); // 판재 추가

    console.log('✅ 전체 공정 흐름 검증 완료');
  });
});
```

---

## 🚀 Deployment Plan

### Migration Deployment Sequence

```bash
# 1. Backup current database
psql $SUPABASE_DB_URL -c "SELECT COUNT(*) FROM process_operations;"

# 2. Apply migrations in order (CRITICAL!)
psql $SUPABASE_DB_URL -f supabase/migrations/20250206_create_stock_history.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20250206_extend_process_operations.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20250206_create_auto_stock_movement_trigger.sql  # 🔥 CORE!
psql $SUPABASE_DB_URL -f supabase/migrations/20250206_create_material_types.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20250206_create_process_chain_definitions.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20250206_create_performance_indexes.sql

# 3. Verify migrations
psql $SUPABASE_DB_URL -c "SELECT * FROM pg_trigger WHERE tgname = 'trigger_auto_process_stock_movement';"

# 4. Smoke test (create test operation and complete it)
curl -X POST http://localhost:5000/api/process/start \
  -H "Content-Type: application/json" \
  -d '{"operation_type":"BLANKING","input_item_id":1,"input_quantity":10,"output_item_id":2}'

# Get operation ID from response, then complete it
curl -X POST http://localhost:5000/api/process/complete \
  -H "Content-Type: application/json" \
  -d '{"operation_id":XXX,"actual_output_quantity":9.5,"scrap_quantity":0.5}'

# 5. Verify stock movement in database
psql $SUPABASE_DB_URL -c "SELECT * FROM stock_history ORDER BY created_at DESC LIMIT 10;"

# 6. Monitor logs
tail -f logs/process_automation.log
```

### Rollback Scripts

```sql
-- rollback_auto_stock_movement.sql
DROP TRIGGER IF EXISTS trigger_auto_process_stock_movement ON process_operations;
DROP FUNCTION IF EXISTS auto_process_stock_movement();

-- rollback_all_migrations.sql
DROP TABLE IF EXISTS stock_history CASCADE;
DROP TABLE IF EXISTS process_chain_definitions CASCADE;
DROP TABLE IF EXISTS material_types CASCADE;
DROP FUNCTION IF EXISTS generate_lot_number(VARCHAR, INTEGER);

ALTER TABLE process_operations
  DROP COLUMN IF EXISTS parent_operation_id,
  DROP COLUMN IF EXISTS chain_id,
  DROP COLUMN IF EXISTS chain_sequence,
  DROP COLUMN IF EXISTS lot_number,
  DROP COLUMN IF EXISTS parent_lot_number,
  DROP COLUMN IF EXISTS child_lot_number,
  DROP COLUMN IF EXISTS batch_id,
  DROP COLUMN IF EXISTS auto_next_operation,
  DROP COLUMN IF EXISTS next_operation_type,
  DROP COLUMN IF EXISTS scrap_quantity,
  DROP COLUMN IF EXISTS quality_status;
```

---

## 📋 Agent Execution Commands

### Wave 1: Foundation Design (Day 1-2)

```bash
# Track A: Database Schema Design
claude-code --agent database-architect \
  --task "Design 6 database migrations for process automation" \
  --context ".plan8/IMPLEMENTATION_PLAN.md" \
  --output ".plan8/migrations/"

# Track B: API Architecture Planning
claude-code --agent backend-architect \
  --task "Design 5 API endpoints for process management" \
  --context ".plan8/IMPLEMENTATION_PLAN.md" \
  --output ".plan8/api-specs/"

# Track C: UI Component Design
claude-code --agent frontend-developer \
  --task "Design process management UI components" \
  --context ".plan8/IMPLEMENTATION_PLAN.md" \
  --output ".plan8/component-specs/"
```

### Wave 2: Core Implementation (Day 3-5)

```bash
# Track A: Database Migrations
claude-code --agent database-architect \
  --task "Implement and test 6 database migrations" \
  --files "supabase/migrations/20250206_*.sql" \
  --validate

# Track B: Backend APIs
claude-code --agent backend-architect \
  --task "Implement 5 process management APIs" \
  --files "src/app/api/process/**/*.ts" \
  --test

# Track C: Frontend Components
claude-code --agent frontend-developer \
  --task "Implement process management UI" \
  --files "src/components/process/**/*.tsx" \
  --test

# Track D: RLS Policies
claude-code --agent supabase-schema-architect \
  --task "Implement RLS policies for new tables" \
  --files "supabase/migrations/20250206_rls_policies.sql"
```

### Wave 3: Advanced Features (Day 6-7)

```bash
# Track A: Batch Processing
claude-code --agent backend-architect,frontend-developer \
  --task "Implement batch process mode" \
  --files "src/app/api/process/batch/**,src/components/process/BatchProcessGrid.tsx"

# Track B: Chain Automation
claude-code --agent backend-architect \
  --task "Implement process chain automation" \
  --files "src/app/api/process/chain/**"

# Track C: Real-time Dashboard
claude-code --agent frontend-developer \
  --task "Implement real-time process dashboard" \
  --files "src/components/process/ProcessDashboard.tsx"
```

### Wave 4: Testing & Optimization (Day 8-9)

```bash
# Track A: E2E Testing
claude-code --agent qa \
  --task "Run comprehensive E2E tests for process automation" \
  --test "tests/e2e/process/**/*.spec.ts" \
  --critical "코일 → 판재 → 납품 전체 흐름"

# Track B: Performance Optimization
claude-code --agent performance \
  --task "Optimize process queries and triggers" \
  --analyze "Database performance metrics" \
  --optimize
```

### Wave 5: Production Deployment (Day 10)

```bash
# Track A: Deployment
claude-code --agent devops \
  --task "Deploy process automation to production" \
  --deploy \
  --monitor \
  --rollback-ready
```

---

## ✅ Success Criteria

### 조성진 차장님 요구사항 100% 충족 체크리스트

- [ ] **코일 → 판재 자동 재고 이동**: auto_process_stock_movement() 트리거 작동
- [ ] **판재 → 완제품 자동 재고 이동**: 연속 공정 체인 작동
- [ ] **완제품 → 납품 자동 재고 이동**: 출하 공정 재고 이동
- [ ] **BOM과 공정 흐름 일치**: process_chain_definitions로 표준 경로 정의
- [ ] **LOT 추적**: 부모 → 자식 LOT genealogy 완벽 작동
- [ ] **재고 감사 추적**: stock_history에 모든 이동 기록
- [ ] **자동 다음 공정 시작**: auto_next_operation 플래그로 체인 자동화
- [ ] **배치 처리**: 다중 공정 동시 실행 가능
- [ ] **E2E 테스트**: 전체 흐름 검증 완료
- [ ] **Production 배포**: 모든 마이그레이션 성공, 모니터링 활성화

---

## 📊 Timeline Summary

| Wave | Days | Tasks | Critical Path |
|------|------|-------|---------------|
| Wave 1 | 1-2 | 설계 (DB + API + UI) | 마이그레이션 설계 완료 |
| Wave 2 | 3-5 | 핵심 구현 | auto_stock_movement 트리거 |
| Wave 3 | 6-7 | 고급 기능 | 배치 + 체인 자동화 |
| Wave 4 | 8-9 | 테스트 + 최적화 | E2E 전체 흐름 검증 |
| Wave 5 | 10 | 배포 + 모니터링 | Production 배포 |

**Total**: 9-10 days with parallel execution

---

## 🎯 Next Immediate Steps

1. **Read this plan** - User approval
2. **Execute Codex analysis** - Current codebase gaps
3. **Launch Wave 1 Track A** - Database schema design (database-architect)
4. **Launch Wave 1 Track B** - API architecture planning (backend-architect)
5. **Launch Wave 1 Track C** - UI component design (frontend-developer)

---

**Plan Created**: 2025-02-05
**Status**: Ready for Execution
**Priority**: CRITICAL - 완벽한 구현 필수
**Approval**: Awaiting User Confirmation

