# Coating Status - Manual Test Checklist

**Page**: `http://localhost:5000/master/items`
**Feature**: Coating Status Filter & Display
**Tester**: ________________
**Date**: ________________

---

## Pre-Test Setup

- [ ] Dev server running (`npm run dev:safe`)
- [ ] Navigate to http://localhost:5000/master/items
- [ ] Page loads successfully
- [ ] At least 5 test items visible with different coating statuses

---

## Test 1: Filter Dropdown Display

**Objective**: Verify coating status dropdown shows all options

- [ ] **Step 1**: Locate coating status dropdown (rightmost filter in top bar)
- [ ] **Step 2**: Click dropdown to expand
- [ ] **Verify**: 4 options visible
  - [ ] "전체 도장상태" (default)
  - [ ] "도장 불필요"
  - [ ] "도장 전"
  - [ ] "도장 후"
- [ ] **Verify**: Dropdown has proper styling (border, padding, focus ring)

**Pass/Fail**: ⬜

---

## Test 2: Table Badge Colors

**Objective**: Verify coating status badges display with correct colors

- [ ] **Step 1**: View items table
- [ ] **Step 2**: Locate "도장상태" column (second from right)
- [ ] **Verify Badge Colors**:
  - [ ] **Gray badge** for "도장 불필요" items
  - [ ] **Yellow badge** for "도장 전" items
  - [ ] **Blue badge** for "도장 후" items
- [ ] **Verify**: Text is centered and readable
- [ ] **Verify**: Badges have rounded corners

**Pass/Fail**: ⬜

---

## Test 3: Filter - "도장 불필요"

**Objective**: Verify filter works for no_coating items

- [ ] **Step 1**: Select "도장 불필요" from dropdown
- [ ] **Verify**: Table updates (loading indicator may appear briefly)
- [ ] **Verify**: Only items with **gray badges** are shown
- [ ] **Verify**: If no items, see "조건에 맞는 품목이 없습니다." message
- [ ] **Verify**: Pagination resets to page 1

**Items Visible**: ________ items
**Pass/Fail**: ⬜

---

## Test 4: Filter - "도장 전"

**Objective**: Verify filter works for before_coating items

- [ ] **Step 1**: Change dropdown to "도장 전"
- [ ] **Verify**: Table updates
- [ ] **Verify**: Only items with **yellow badges** are shown
- [ ] **Verify**: Previous filter results cleared

**Items Visible**: ________ items
**Pass/Fail**: ⬜

---

## Test 5: Filter - "도장 후"

**Objective**: Verify filter works for after_coating items

- [ ] **Step 1**: Change dropdown to "도장 후"
- [ ] **Verify**: Table updates
- [ ] **Verify**: Only items with **blue badges** are shown

**Items Visible**: ________ items
**Pass/Fail**: ⬜

---

## Test 6: Reset Filters

**Objective**: Verify reset button clears coating status filter

- [ ] **Step 1**: Ensure coating status filter is applied (not "전체 도장상태")
- [ ] **Step 2**: Click "초기화" button (with rotating arrows icon)
- [ ] **Verify**: Coating status resets to "전체 도장상태"
- [ ] **Verify**: All filters cleared
- [ ] **Verify**: Table shows all items again
- [ ] **Verify**: Pagination resets

**Pass/Fail**: ⬜

---

## Test 7: Create Item with Coating Status

**Objective**: Verify new items can be created with coating status

- [ ] **Step 1**: Click "품목 등록" button (top right, blue button)
- [ ] **Step 2**: Fill required fields:
  - [ ] Item Code: `TEST_COAT_001`
  - [ ] Item Name: `도장 테스트 품목`
  - [ ] Category: Select any (e.g., "원자재")
- [ ] **Step 3**: Locate "도장상태" dropdown in form
- [ ] **Verify**: Default is "도장 불필요"
- [ ] **Step 4**: Change to "도장 전"
- [ ] **Step 5**: Click submit
- [ ] **Verify**: Success message appears
- [ ] **Verify**: New item appears in table with **yellow badge**

**Pass/Fail**: ⬜

---

## Test 8: Edit Item Coating Status

**Objective**: Verify coating status can be changed on existing items

- [ ] **Step 1**: Find the item created in Test 7 (TEST_COAT_001)
- [ ] **Step 2**: Click edit button (pencil icon)
- [ ] **Verify**: Modal opens with item data
- [ ] **Verify**: Coating status shows "도장 전" (previously selected)
- [ ] **Step 3**: Change coating status to "도장 후"
- [ ] **Step 4**: Click submit
- [ ] **Verify**: Success message appears
- [ ] **Verify**: Item's badge changes from **yellow** to **blue**

**Pass/Fail**: ⬜

---

## Test 9: Multiple Filter Combination

**Objective**: Verify coating status works with other filters

- [ ] **Step 1**: Select Category filter (e.g., "원자재")
- [ ] **Step 2**: Select Coating Status "도장 전"
- [ ] **Verify**: Table shows only items matching **both** filters
- [ ] **Step 3**: Add search term (e.g., type "철판" in search box)
- [ ] **Verify**: Results further filtered by search
- [ ] **Step 4**: Click "초기화"
- [ ] **Verify**: All filters cleared

**Pass/Fail**: ⬜

---

## Test 10: Dark Mode (Optional)

**Objective**: Verify coating status badges work in dark mode

- [ ] **Step 1**: Enable dark mode (if theme toggle available)
- [ ] **Verify Dark Mode Badges**:
  - [ ] Gray badge: Dark gray background, lighter text
  - [ ] Yellow badge: Dark yellow background, lighter text
  - [ ] Blue badge: Dark blue background, lighter text
- [ ] **Verify**: Dropdown has dark mode styling
- [ ] **Verify**: Text remains readable

**Pass/Fail**: ⬜

---

## Test 11: Keyboard Navigation

**Objective**: Verify filter can be used with keyboard only

- [ ] **Step 1**: Tab to coating status dropdown (use Tab key)
- [ ] **Verify**: Dropdown gets focus ring
- [ ] **Step 2**: Press Enter or Space to expand
- [ ] **Step 3**: Use arrow keys (↑↓) to navigate options
- [ ] **Step 4**: Press Enter to select an option
- [ ] **Verify**: Filter applies without mouse

**Pass/Fail**: ⬜

---

## Test 12: Performance - Large Dataset

**Objective**: Verify filter performance with many items

- [ ] **Step 1**: Ensure 50+ items in database (or use test data)
- [ ] **Step 2**: Apply coating status filter
- [ ] **Measure**: Time from filter selection to table update
  - [ ] **Response Time**: ________ ms (target: < 500ms)
- [ ] **Verify**: No lag or freezing
- [ ] **Verify**: Pagination updates correctly

**Pass/Fail**: ⬜

---

## Test 13: Edge Cases

### 13a: No Items Match Filter
- [ ] **Step 1**: Apply a filter combination that yields no results
- [ ] **Verify**: "조건에 맞는 품목이 없습니다." message displays
- [ ] **Verify**: No error occurs

### 13b: All Items Same Coating Status
- [ ] **Step 1**: Select filter matching all items
- [ ] **Verify**: All items display (no filtering error)

### 13c: NULL Coating Status (if any)
- [ ] **Step 1**: If any items have NULL coating_status
- [ ] **Verify**: They display as "도장 불필요" (gray badge)

**Pass/Fail**: ⬜

---

## Test 14: API Response Verification

**Objective**: Verify API returns correct data

**Note**: Use browser DevTools Network tab

- [ ] **Step 1**: Open browser DevTools (F12)
- [ ] **Step 2**: Go to Network tab
- [ ] **Step 3**: Apply coating status filter "도장 전"
- [ ] **Verify Network Request**:
  - [ ] Request URL: `/api/items?coating_status=before_coating&...`
  - [ ] Response status: 200 OK
  - [ ] Response contains only `"coating_status": "before_coating"` items
- [ ] **Verify**: No console errors

**Pass/Fail**: ⬜

---

## Test 15: Cross-Browser (Optional)

**Objective**: Verify functionality across browsers

| Browser | Version | Dropdown Works | Badges Display | Filter Works | Pass/Fail |
|---------|---------|----------------|----------------|--------------|-----------|
| Chrome  | _______ | ⬜             | ⬜             | ⬜           | ⬜        |
| Firefox | _______ | ⬜             | ⬜             | ⬜           | ⬜        |
| Edge    | _______ | ⬜             | ⬜             | ⬜           | ⬜        |
| Safari  | _______ | ⬜             | ⬜             | ⬜           | ⬜        |

---

## Post-Test Cleanup

- [ ] **Step 1**: Delete test item created in Test 7 (TEST_COAT_001)
- [ ] **Step 2**: Click delete button (trash icon)
- [ ] **Verify**: Item removed from table
- [ ] **Step 3**: Reset all filters
- [ ] **Step 4**: Verify page returns to default state

---

## Test Summary

**Tests Executed**: _____ / 15
**Tests Passed**: _____
**Tests Failed**: _____
**Pass Rate**: _____%

---

## Issues Found

| Test # | Issue Description | Severity | Screenshot |
|--------|-------------------|----------|------------|
|        |                   |          |            |
|        |                   |          |            |
|        |                   |          |            |

**Severity Levels**:
- 🔴 **Critical**: Blocking functionality, must fix
- 🟡 **Major**: Significant issue, should fix
- 🟢 **Minor**: Cosmetic or nice-to-have

---

## Screenshots Captured

- [ ] Filter dropdown expanded (all 4 options visible)
- [ ] Table with multiple badge colors
- [ ] Filter applied - "도장 전" selected
- [ ] Create/Edit modal with coating status dropdown
- [ ] Dark mode badges (if applicable)
- [ ] No results message

**Screenshot Location**: ___________________________________

---

## Sign-Off

**Tester Name**: ___________________________________
**Date**: ___________________
**Time Spent**: ___________________
**Overall Result**: ⬜ PASS  ⬜ FAIL  ⬜ PARTIAL

**Recommendations**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Next Steps**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

## Quick Reference

### Coating Status Values
- **no_coating** → "도장 불필요" → Gray badge
- **before_coating** → "도장 전" → Yellow badge
- **after_coating** → "도장 후" → Blue badge

### Expected Badge Colors (Light Mode)
- Gray: `#F3F4F6` background, `#1F2937` text
- Yellow: `#FEF3C7` background, `#92400E` text
- Blue: `#DBEAFE` background, `#1E40AF` text

### Filter Location
- **Page**: `/master/items`
- **Position**: Top filter bar, rightmost dropdown
- **Label**: Shows current selection (e.g., "전체 도장상태")

---

**END OF CHECKLIST**

Print this checklist and check boxes as you complete each test step.
