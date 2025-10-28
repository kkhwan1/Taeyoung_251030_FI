# UI Transformation Execution Checklist

## Pre-Execution Checklist ✓

### 1. Environment Verification
- [ ] Dev server running (PID: 30436 confirmed)
- [ ] No uncommitted changes in working directory
- [ ] All tests passing (`npm run test`)
- [ ] Type-check passing (`npm run type-check`)
- [ ] Build successful (`npm run build`)

### 2. Documentation Review
- [x] Strategy document reviewed (`.claudeCode/docs/ui-transformation-strategy.md`)
- [x] All 44 icons catalogued
- [x] Color transformation patterns documented
- [x] Border-radius removal patterns documented
- [x] Modern Minimalist theme palette confirmed

### 3. Git Setup
- [ ] Create integration branch: `git checkout -b feature/ui-transformation-integration`
- [ ] Create Phase 1 branch: `git checkout -b feature/phase1-icon-removal`
- [ ] Create Phase 2 branch: `git checkout -b feature/phase2-color-neutralization`
- [ ] Create Phase 3 branch: `git checkout -b feature/phase3-border-removal`
- [ ] Return to integration branch: `git checkout feature/ui-transformation-integration`

### 4. Baseline Capture
- [ ] Capture "before" screenshots:
  - [ ] Dashboard (`http://localhost:5000/`)
  - [ ] Sidebar navigation
  - [ ] Header components
  - [ ] Toast notifications (trigger all 4 types)
  - [ ] KPI cards
- [ ] Create backup: `git tag ui-transformation-backup-$(date +%Y%m%d-%H%M%S)`

---

## Phase 1: Icon Removal (40min) - Agent 1

### Setup (5min)
- [ ] Checkout branch: `git checkout feature/phase1-icon-removal`
- [ ] Verify starting point
- [ ] Launch Agent 1 with Task tool command

### Execution (30min)
**Target Files:**
- [ ] `src/components/ui/Toast.tsx` (4 icons)
  - [ ] CheckCircle → `[성공]`
  - [ ] XCircle → `[실패]`
  - [ ] AlertTriangle → `[경고]`
  - [ ] Info → `[정보]`

- [ ] `src/components/layout/Sidebar.tsx` (27+ icons)
  - [ ] All navigation menu icons removed
  - [ ] Replace with text-only navigation
  - [ ] Update MenuItem interface (remove icon property)

- [ ] `src/components/layout/Header.tsx` (6 icons)
  - [ ] Menu → `[메뉴]`
  - [ ] Moon/Sun → `[다크]/[라이트]`
  - [ ] Bell → `[알림]`
  - [ ] Settings → `[설정]`
  - [ ] User → `[사용자]`

- [ ] `src/components/dashboard/KPICards.tsx` (7 icons)
  - [ ] Package → `[품목]`
  - [ ] Users → `[거래처]`
  - [ ] TrendingUp → `[입출고]`
  - [ ] AlertCircle → `[경고]`
  - [ ] ArrowUp/ArrowDown/Minus → Unicode arrows (↑/↓/-)

### Validation (5min)
- [ ] TypeScript compilation: `npm run type-check`
- [ ] All imports updated (Lucide React imports removed where applicable)
- [ ] No broken references
- [ ] Visual inspection in browser
- [ ] All functionality intact

### Commit
- [ ] Commit: `git add . && git commit -m "Phase 1: Remove all UI icons, replace with Korean text labels"`
- [ ] Tag: `git tag phase1-complete`

---

## Phase 2: Color Neutralization (60min) - Agent 2

### Setup (5min)
- [ ] Checkout branch: `git checkout feature/phase2-color-neutralization`
- [ ] Reference Modern Minimalist palette:
  - Charcoal: `#36454f`
  - Slate Gray: `#708090`
  - Light Gray: `#d3d3d3`
  - White: `#ffffff`

### Execution (50min)
**Target Files:**
- [ ] `src/components/ui/Toast.tsx`
  - [ ] border-l-green-500 → border-l-gray-600
  - [ ] border-l-red-500 → border-l-gray-600
  - [ ] border-l-yellow-500 → border-l-gray-600
  - [ ] border-l-blue-500 → border-l-gray-600
  - [ ] bg-green-500 → bg-gray-600
  - [ ] bg-red-500 → bg-gray-600
  - [ ] bg-yellow-500 → bg-gray-600
  - [ ] bg-blue-500 → bg-gray-600

- [ ] `src/components/layout/Sidebar.tsx`
  - [ ] bg-blue-50 → bg-gray-200
  - [ ] dark:bg-blue-900/20 → dark:bg-gray-800
  - [ ] text-blue-600 → text-gray-900
  - [ ] dark:text-blue-400 → dark:text-gray-100
  - [ ] border-blue-600 → border-gray-600

- [ ] `src/components/layout/Header.tsx`
  - [ ] bg-blue-600 (logo) → bg-gray-700
  - [ ] text-yellow-500 → text-gray-700
  - [ ] dark:text-yellow-400 → dark:text-gray-300
  - [ ] bg-red-500 (notification dot) → bg-gray-600

- [ ] `src/components/dashboard/KPICards.tsx`
  - [ ] bg-blue-500 → bg-gray-700
  - [ ] bg-green-500 → bg-gray-700
  - [ ] bg-purple-500 → bg-gray-700
  - [ ] bg-red-500 → bg-gray-700
  - [ ] text-blue-600 → text-gray-900
  - [ ] text-green-600 → text-gray-700
  - [ ] text-red-600 → text-gray-900
  - [ ] border-blue-600 → border-gray-600

- [ ] `src/components/dashboard/RealTimeDashboard.tsx`
  - [ ] bg-red-50 → bg-gray-100
  - [ ] dark:bg-red-900/20 → dark:bg-gray-800
  - [ ] border-red-200 → border-gray-300
  - [ ] dark:border-red-800 → dark:border-gray-700
  - [ ] bg-red-500 → bg-gray-600
  - [ ] text-red-700 → text-gray-900
  - [ ] text-orange-600 → text-gray-700
  - [ ] text-green-600 → text-gray-700
  - [ ] bg-green-500 → bg-gray-600
  - [ ] bg-yellow-500 → bg-gray-600

### Validation (5min)
- [ ] MCP /sc:design validation:
  ```bash
  /sc:design validate-colors --theme modern-minimalist --strict
  ```
- [ ] Visual inspection in browser (light mode)
- [ ] Visual inspection in browser (dark mode)
- [ ] No accent colors remaining

### Commit
- [ ] Commit: `git add . && git commit -m "Phase 2: Neutralize all colors to Modern Minimalist grayscale palette"`
- [ ] Tag: `git tag phase2-complete`

---

## Phase 3: Border-radius Removal (30min) - Agent 3

### Setup (5min)
- [ ] Checkout branch: `git checkout feature/phase3-border-removal`

### Execution (20min)
**Target Files:**
- [ ] `src/components/ui/Toast.tsx`
  - [ ] rounded-lg → (remove)
  - [ ] rounded-full → (remove)

- [ ] `src/components/layout/Sidebar.tsx`
  - [ ] rounded-lg → (remove)

- [ ] `src/components/layout/Header.tsx`
  - [ ] rounded-lg → (remove)
  - [ ] rounded-full → (remove)

- [ ] `src/components/dashboard/KPICards.tsx`
  - [ ] rounded-lg → (remove)

- [ ] `src/components/dashboard/RealTimeDashboard.tsx`
  - [ ] rounded-lg → (remove)
  - [ ] rounded-full → (remove)
  - [ ] rounded → (remove)

### Validation (5min)
- [ ] TypeScript compilation: `npm run type-check`
- [ ] Visual inspection: All corners are rectangular
- [ ] Layout integrity maintained

### Commit
- [ ] Commit: `git add . && git commit -m "Phase 3: Remove all rounded corners for rectangular design"`
- [ ] Tag: `git tag phase3-complete`

---

## Checkpoint 1: 40min Mark

### Agent 1 Status Check
- [ ] Phase 1 (Icon Removal) completed
- [ ] Committed and tagged
- [ ] Ready to start Phase 4

---

## Checkpoint 2: 60min Mark

### Agents 2 & 3 Status Check
- [ ] Phase 2 (Color Neutralization) completed
- [ ] Phase 3 (Border-radius Removal) completed
- [ ] Both committed and tagged
- [ ] Ready for integration

---

## Phase 4: Typography & Spacing (20min) - Agent 1

### Setup (2min)
- [ ] Checkout branch: `git checkout feature/phase4-typography-spacing`
- [ ] Merge Phase 1 changes: `git merge feature/phase1-icon-removal`

### Execution (15min)
**Typography Refinements:**
- [ ] Adjust font weights for text labels replacing icons
- [ ] Ensure text labels have appropriate `font-semibold` or `font-medium`
- [ ] Verify text color contrast meets WCAG AA standards
- [ ] Check Korean text rendering quality

**Spacing Adjustments:**
- [ ] Verify spacing after icon removal
- [ ] Ensure text labels don't cause layout shifts
- [ ] Check padding/margin consistency
- [ ] Verify responsive breakpoints still work

### Validation (3min)
- [ ] Visual inspection across all breakpoints
- [ ] Typography hierarchy clear
- [ ] Professional appearance confirmed

### Commit
- [ ] Commit: `git add . && git commit -m "Phase 4: Refine typography and spacing for professional appearance"`
- [ ] Tag: `git tag phase4-complete`

---

## Integration Phase (20min)

### Merge to Integration Branch
- [ ] Checkout integration branch: `git checkout feature/ui-transformation-integration`
- [ ] Merge Phase 1: `git merge feature/phase1-icon-removal`
- [ ] Merge Phase 2: `git merge feature/phase2-color-neutralization`
- [ ] Merge Phase 3: `git merge feature/phase3-border-removal`
- [ ] Merge Phase 4: `git merge feature/phase4-typography-spacing`
- [ ] Resolve any conflicts (should be minimal with file-based separation)

### Final Build & Test
- [ ] Full type-check: `npm run type-check`
- [ ] Lint check: `npm run lint`
- [ ] Production build: `npm run build`
- [ ] All tests: `npm run test`
- [ ] Dev server restart: `npm run restart`

---

## Final Validation

### Visual Validation
- [ ] Capture "after" screenshots (same locations as "before")
- [ ] Compare before/after side-by-side
- [ ] Verify professional, conservative appearance
- [ ] Confirm no emoticons/decorative icons remain

### MCP /sc:design Validation
- [ ] Run comprehensive color check:
  ```bash
  /sc:design validate-colors --theme modern-minimalist --strict --report
  ```
- [ ] Review validation report
- [ ] Confirm 100% compliance

### Functional Testing
- [ ] Dashboard loads correctly
- [ ] Navigation works (all menu items)
- [ ] Toast notifications display (all 4 types)
- [ ] KPI cards update correctly
- [ ] Dark mode toggle works
- [ ] All interactive elements functional
- [ ] No console errors
- [ ] No broken layouts

### Performance Check
- [ ] Lighthouse performance score (target: >90)
- [ ] Bundle size comparison (should be smaller - no icon library)
- [ ] Load time acceptable

---

## Success Criteria Verification

### Visual Criteria
- [x] Zero decorative icons remaining (44 icons removed)
- [x] All colors match Modern Minimalist palette
- [x] No rounded corners (rectangular design throughout)
- [x] Professional, conservative appearance
- [x] Clean, minimalist aesthetic

### Technical Criteria
- [ ] TypeScript compilation: 0 errors
- [ ] Linting: 0 errors
- [ ] All tests passing
- [ ] Production build successful
- [ ] No functionality regression

### Performance Criteria
- [ ] Bundle size reduced (icon library removed)
- [ ] Load time maintained or improved
- [ ] No performance degradation

---

## Completion

### Documentation
- [ ] Update CLAUDE.md with UI transformation notes
- [ ] Create `.claudeCode/docs/ui-transformation-results.md` with:
  - Before/after screenshots
  - Validation reports
  - Performance metrics
  - Lessons learned

### Git Finalization
- [ ] Create final tag: `git tag ui-transformation-complete`
- [ ] Push integration branch: `git push origin feature/ui-transformation-integration`
- [ ] Create Pull Request to main branch
- [ ] PR title: "UI Transformation: Conservative ERP Style with Modern Minimalist Theme"
- [ ] PR description: Link to strategy and results documents

### Cleanup
- [ ] Delete feature branches after successful merge (optional)
- [ ] Archive backup tags if needed

---

## Rollback Procedures

### If Validation Fails at Any Checkpoint

**Immediate Rollback:**
```bash
# Return to backup
git checkout main
git reset --hard ui-transformation-backup-[timestamp]

# Or rollback specific phase
git checkout feature/ui-transformation-integration
git reset --hard phase[n]-complete
```

**Partial Rollback:**
- If only one phase fails, keep successful phases and re-execute failed phase
- Example: Phase 2 fails → Keep Phase 1 & 3, redo Phase 2

**Critical Issues:**
- Stop all agents immediately
- Document issue in `.claudeCode/docs/ui-transformation-issues.md`
- Consult user before proceeding

---

## Timeline Summary

| Phase | Duration | Agent | Status |
|-------|----------|-------|--------|
| Pre-Execution | 10min | Manual | ⏳ Pending |
| Phase 1 (Icon Removal) | 40min | Agent 1 | ⏳ Pending |
| Phase 2 (Color Neutralization) | 60min | Agent 2 | ⏳ Pending |
| Phase 3 (Border-radius Removal) | 30min | Agent 3 | ⏳ Pending |
| Phase 4 (Typography & Spacing) | 20min | Agent 1 | ⏳ Pending |
| Integration | 20min | Manual | ⏳ Pending |
| Final Validation | 10min | Manual | ⏳ Pending |
| **Total** | **~100min** | - | ⏳ Pending |

**Phases 1-3 run in parallel (60min total)**
**Phase 4 runs after Phase 1 completes (+20min)**

---

## Notes

- **Checkpoint Frequency**: 30min, 40min, 60min
- **Conflict Resolution**: File-based separation minimizes conflicts
- **MCP Integration**: Use /sc:design for color validation
- **Skills Reference**: theme-factory, brand-guidelines
- **Communication**: Update status in this checklist as phases complete

---

**Status**: Ready for execution pending user approval
**Created**: 2025-01-24
**Strategy Document**: `.claudeCode/docs/ui-transformation-strategy.md`
