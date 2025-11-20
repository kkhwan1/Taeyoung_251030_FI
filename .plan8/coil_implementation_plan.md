# Coil Process Tracking Implementation Plan
**Project**: FITaeYoungERP - Coil Processing Features
**Date**: 2025-02-02
**Requested By**: 조성원 차장 (Deputy Manager Jo)

## Executive Summary

Implementing 3 advanced features for coil inventory management based on user request:
1. **공정 흐름 추적** (Process Flow Tracking): Coil → Blanking → Plate conversion history
2. **BOM 연결** (BOM Connection): Coil as raw material in BOM relationships
3. **재고 이동 자동화** (Stock Automation): Auto stock adjustment during blanking process

**Key Insight**: By parallelizing independent work tracks, total implementation time reduced from 13-17 hours to 7-10 hours (40-47% faster).

---

## Implementation Phases with Parallel Execution

### Phase 1: Database Foundation (BLOCKING - 2-3 hours)
**Dependencies**: None
**Can Run Parallel**: No (blocking phase)

#### Tasks:
1. **Create coil_process_history table**
   - File: `supabase/migrations/20250202_coil_process_tracking.sql` (NEW, ~150 lines)
   - Columns: process_id, source_item_id, process_type, target_item_id, input/output quantities, yield_rate (computed), process_date, operator_id, notes, status
   - Constraints: CHECK on process_type ('블랭킹','전단','절곡','용접'), CHECK on status ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED')
   - Indexes: source_item_id, target_item_id, process_date DESC, status (partial)

2. **Create auto_coil_process_stock_movement trigger**
   - File: `supabase/migrations/20250202_coil_process_automation.sql` (NEW, ~100 lines)
   - Trigger on UPDATE of coil_process_history when status changes to 'COMPLETED'
   - Creates 생산출고 transaction for source coil (negative stock adjustment)
   - Creates 생산입고 transaction for target plate (positive stock adjustment)
   - Updates current_stock on both items
   - Transaction number format: COIL-YYYYMMDD-{process_id}

3. **Apply migrations**
   ```bash
   npm run migrate:up
   npm run db:types
   ```

**Deliverable**: Database schema ready, triggers functional
**Test Document**: Milestone 1 (see below)

---

### Phase 2: API Layer (3 PARALLEL TRACKS - 2-3 hours total)

#### Track 2A: Core Process API (2-3 hours)
**Dependencies**: Phase 1
**Parallel**: Can run with 2B and 2C

**Files**:
1. `src/types/coil.ts` (NEW, ~80 lines) - TypeScript interfaces
2. `src/app/api/coil/process/route.ts` (NEW, ~150 lines)
   - POST: Create process, validate source is coil type
   - GET: List processes with filters (status, item_id), join with items and users
3. `src/app/api/coil/process/complete/route.ts` (NEW, ~100 lines)
   - POST: Update status to COMPLETED (triggers stock automation)

**Key Pattern - UTF-8 Encoding** (CRITICAL for Korean text):
```typescript
const text = await request.text();
const body = JSON.parse(text);
// NEVER use request.json() - causes Korean text corruption!
```

**Test Document**: Milestone 2A

#### Track 2B: Traceability API (1-2 hours)
**Dependencies**: Phase 1
**Parallel**: Can run with 2A and 2C

**Files**:
1. `src/app/api/coil/traceability/[item_id]/route.ts` (NEW, ~100 lines)
   - GET: Returns upstream (processes that produced this item) and downstream (processes using this item)
   - Recursive query to build full traceability chain

**Test Document**: Milestone 2B

#### Track 2C: BOM Integration API (1 hour)
**Dependencies**: Phase 1
**Parallel**: Can run with 2A and 2B

**Files**:
1. `src/app/api/bom/route.ts` (MODIFY, +20 lines) - Add `?coil_only=true` filter
2. `src/app/api/bom/coil-materials/route.ts` (NEW, ~60 lines) - Dedicated endpoint for coil materials

**Test Document**: Milestone 2C

---

### Phase 3: UI Layer (3 TRACKS - 4-5 hours total)

#### Track 3A: Process Management UI (3-4 hours)
**Dependencies**: Phase 2A complete
**Parallel**: Can run with 3B after 2B completes

**Files**:
1. `src/components/coil/CoilProcessForm.tsx` (NEW, ~350 lines)
   - Dropdowns for source coil (filtered by inventory_type='코일') and target item
   - Process type selector, quantity inputs
   - Real-time yield rate calculation: (output/input * 100)%
   - Submit creates process with status='PENDING'

2. `src/components/coil/CoilProcessHistory.tsx` (NEW, ~250 lines)
   - Table showing all processes with source/target items, quantities, yield rates
   - Status badges (PENDING/IN_PROGRESS/COMPLETED)
   - Date filtering, sortable columns

3. `src/components/coil/CoilProcessCompleteButton.tsx` (NEW, ~100 lines)
   - Confirmation dialog: "공정을 완료하시겠습니까? 재고가 자동으로 조정됩니다."
   - Calls POST /api/coil/process/complete
   - Shows success toast with stock adjustment message

**Test Document**: Milestone 3A

#### Track 3B: Traceability UI (2-3 hours)
**Dependencies**: Phase 2B complete
**Parallel**: Can run with 3A after 2B completes

**Files**:
1. `src/components/coil/CoilTraceabilityChart.tsx` (NEW, ~250 lines)
   - Visual diagram: Coil → Blanking → Plate flow
   - SVG/Canvas rendering or React Flow library
   - Interactive nodes (click to navigate to item details)

**Test Document**: Milestone 3B

#### Track 3C: BOM UI Updates (1 hour)
**Dependencies**: Phase 2C complete
**Parallel**: Can run with 3A and 3B

**Files**:
1. `src/components/BOMForm.tsx` (MODIFY, +30 lines)
   - Add badge/icon for coil type materials (e.g., "🔄 코일 원재료")
   - Visual distinction from other material types

**Test Document**: Milestone 3C

---

## Parallel Execution Timeline

```
Phase 1 (Blocking)          ████████ (2-3h)
                                    ▼
Phase 2A (API - Process)            ████████ (2-3h)
Phase 2B (API - Trace)              ██████ (1-2h)
Phase 2C (API - BOM)                ████ (1h)
                                    ▼     ▼     ▼
Phase 3A (UI - Process)                   ██████████ (3-4h)
Phase 3B (UI - Trace)                         ████████ (2-3h)
Phase 3C (UI - BOM)                               ██ (1h)

TOTAL SERIAL:   13-17 hours
TOTAL PARALLEL:  7-10 hours
SAVINGS:         5-7 hours (40-47%)
```

**Critical Path**: Phase 1 → 2A → 3A (total 7-10 hours)

---

## Test Documents (User Performs Manual Testing)

### Milestone 1: Database Foundation
**When**: After Phase 1
**Duration**: 30 minutes

#### Test Cases:
1. **Schema Verification**
   ```sql
   SELECT * FROM coil_process_history LIMIT 1;
   SELECT indexname FROM pg_indexes WHERE tablename = 'coil_process_history';
   ```
   Expected: 4 indexes (source, target, date, status)

2. **Trigger Verification**
   ```sql
   SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_coil_process_stock_automation';
   SELECT proname FROM pg_proc WHERE proname = 'auto_coil_process_stock_movement';
   ```

3. **TypeScript Types**
   ```bash
   npm run db:types
   ```
   Expected: No errors

**Pass Criteria**: All tests pass

---

### Milestone 2A: Core Process API
**When**: After Phase 2A
**Duration**: 45 minutes

#### Test Cases:
1. **Create Process**
   ```bash
   curl -X POST http://localhost:5000/api/coil/process \
     -H "Content-Type: application/json" \
     -d '{
       "source_item_id": [COIL_ID],
       "process_type": "블랭킹",
       "target_item_id": [PLATE_ID],
       "input_quantity": 100,
       "output_quantity": 95,
       "process_date": "2025-02-02",
       "notes": "테스트"
     }'
   ```
   Expected: `{"success": true, "data": {"process_id": 1, ...}}`

2. **Validation Test (Non-Coil Source)**
   ```bash
   curl -X POST http://localhost:5000/api/coil/process \
     -d '{"source_item_id": [NON_COIL_ID], ...}'
   ```
   Expected: `{"success": false, "error": "원재료 품목은 코일 타입이어야 합니다"}`

3. **List Processes**
   ```bash
   curl http://localhost:5000/api/coil/process
   ```

4. **Filter by Status**
   ```bash
   curl http://localhost:5000/api/coil/process?status=PENDING
   ```

5. **Complete Process**
   ```bash
   curl -X POST http://localhost:5000/api/coil/process/complete \
     -d '{"process_id": 1}'
   ```

6. **Verify Stock Automation**
   ```sql
   SELECT * FROM inventory_transactions
   WHERE reference_type = 'coil_process' AND reference_id = 1;
   -- Expected: 2 rows (생산출고, 생산입고)

   SELECT current_stock FROM items WHERE item_id IN ([COIL_ID], [PLATE_ID]);
   -- Expected: Coil -100, Plate +95
   ```

**Pass Criteria**: All 6 tests pass, stock automation correct

---

### Milestone 2B: Traceability API
**When**: After Phase 2B
**Duration**: 20 minutes

#### Test Cases:
1. **Plate Traceability**
   ```bash
   curl http://localhost:5000/api/coil/traceability/[PLATE_ID]
   ```
   Expected: `{"data": {"upstream": [...], "downstream": []}}`

2. **Coil Traceability**
   ```bash
   curl http://localhost:5000/api/coil/traceability/[COIL_ID]
   ```
   Expected: `{"data": {"upstream": [], "downstream": [...]}}`

**Pass Criteria**: Correct upstream/downstream chains

---

### Milestone 2C: BOM Integration API
**When**: After Phase 2C
**Duration**: 15 minutes

#### Test Cases:
1. **Coil Materials Only**
   ```bash
   curl http://localhost:5000/api/bom/coil-materials
   ```
   Expected: Only BOM entries with material_item.inventory_type='코일'

2. **Alternative Endpoint**
   ```bash
   curl http://localhost:5000/api/bom?coil_only=true
   ```

**Pass Criteria**: Only coil materials returned

---

### Milestone 3A: Process Management UI
**When**: After Phase 3A
**Duration**: 30 minutes

#### Test Cases:
1. **Form Rendering**
   - Navigate to process page
   - Verify coil dropdown shows only inventory_type='코일' items
   - Check yield rate calculation: type 100 input, 95 output → shows "95.00%"

2. **Create Process**
   - Fill form, submit
   - Verify success toast
   - Check process in history table

3. **Complete Process**
   - Click "완료" button
   - Confirm dialog
   - Verify success message
   - Navigate to inventory page, verify stock updated

**Pass Criteria**: All UI flows work correctly

---

### Milestone 3B: Traceability UI
**When**: After Phase 3B
**Duration**: 20 minutes

#### Test Cases:
1. **Chart Rendering**
   - Select plate item
   - Verify chart shows upstream coil
   - Check process details displayed

2. **Navigation**
   - Click coil node
   - Verify navigation to coil details

**Pass Criteria**: Visual traceability accurate

---

### Milestone 3C: BOM UI
**When**: After Phase 3C
**Duration**: 15 minutes

#### Test Cases:
1. **Coil Badge Display**
   - Open BOM form
   - Verify coil materials have special badge/icon

**Pass Criteria**: Visual distinction working

---

## Risk Assessment & Mitigation

### High Risk
1. **Trigger Function Complexity**
   - **Risk**: Stock automation failure or double-counting
   - **Mitigation**: Test with Milestone 2A #6, verify transaction isolation
   - **Rollback**: `npm run migrate:down`, disable trigger

2. **Concurrent Process Completions**
   - **Risk**: Race condition if two processes complete simultaneously
   - **Mitigation**: PostgreSQL transaction isolation (READ COMMITTED)
   - **Rollback**: Add FOR UPDATE lock in trigger if needed

### Medium Risk
1. **Coil Type Validation**
   - **Risk**: Allow non-coil as source
   - **Mitigation**: Server validation + CHECK constraint
   - **Rollback**: Easy code fix

2. **UI Performance**
   - **Risk**: Slow with large datasets
   - **Mitigation**: Use VirtualTable, server pagination
   - **Rollback**: Add pagination

### Low Risk
1. **BOM Integration**
   - **Risk**: Minimal (just filtering)
   - **Mitigation**: Simple WHERE clause
   - **Rollback**: Remove filter param

---

## Rollback Plan

### Phase 1 Rollback
```bash
npm run migrate:down
psql $DATABASE_URL -c "\d coil_process_history"
# Expected: "Did not find any relation"
```

### Phase 2/3 Rollback
- Delete `src/app/api/coil/*` directories
- Delete `src/components/coil/*` files
- No database state affected (data created but isolated)

---

## Success Criteria

### Technical
- ✅ All 21 test cases pass
- ✅ No TypeScript errors (`npm run type-check`)
- ✅ No ESLint warnings
- ✅ Stock automation 100% accurate
- ✅ API response <500ms

### Business
- ✅ Track coil → plate transformations
- ✅ Yield rates auto-calculated
- ✅ BOM shows coil materials
- ✅ Automatic stock adjustments
- ✅ Traceability from plate to source coil

### User Acceptance
- ✅ Deputy Manager Jo approves
- ✅ All milestone tests pass
- ✅ No regressions in existing features

---

## Estimated Effort

| Phase | Sequential | Parallel | Savings |
|-------|-----------|----------|---------|
| Phase 1 | 2-3h | 2-3h | 0h |
| Phase 2 | 4-6h | 2-3h | 2-3h |
| Phase 3 | 6-8h | 3-4h | 3-4h |
| **Total** | **12-17h** | **7-10h** | **5-7h** |

**Critical Path**: Phase 1 → 2A → 3A (7-10 hours)

---

## Next Steps

1. **User Reviews Plan** → Approve/Request Changes
2. **Send to Codex for Validation** (next step)
3. **If Approved**: Execute Phase 1
4. **User Tests**: Milestone 1, then Milestone 2A/B/C (parallel), then 3A/B/C
5. **Final Acceptance**: Deputy Manager Jo approval

---

**Plan Status**: READY FOR USER REVIEW
**Created**: 2025-02-02
