# Coating Status - Screenshot Capture Guide

**Purpose**: Visual documentation of coating_status UI implementation
**Page**: `http://localhost:5000/master/items`
**Total Screenshots**: 12 recommended

---

## Screenshot Setup

### Browser Configuration
- **Browser**: Chrome (latest) or Firefox
- **Window Size**: 1920x1080 (desktop) or 375x667 (mobile)
- **Zoom**: 100% (no zoom in/out)
- **Theme**: Capture both light and dark mode if possible

### Capture Tools
- **Windows**: Snipping Tool (Win + Shift + S)
- **Mac**: Cmd + Shift + 4
- **Browser Extension**: Full Page Screen Capture (for full page shots)
- **DevTools**: F12 → Right-click element → Capture node screenshot

### File Naming Convention
```
coating-status-{number}-{description}.png

Examples:
coating-status-01-filter-dropdown.png
coating-status-02-table-badges.png
coating-status-03-filter-applied.png
```

### Save Location
```
tests/integration/screenshots/coating-status/
```

---

## Screenshot Checklist

### 📸 Screenshot 1: Filter Dropdown (Expanded)
**Filename**: `coating-status-01-filter-dropdown.png`

**Setup**:
1. Navigate to `/master/items`
2. Click coating status dropdown to expand
3. Ensure all 4 options are visible

**Capture Area**:
- Dropdown menu and immediate surrounding area
- Include label if visible
- Show all 4 options clearly

**Expected Elements**:
- [ ] "전체 도장상태" (default)
- [ ] "도장 불필요"
- [ ] "도장 전"
- [ ] "도장 후"
- [ ] Focus ring on dropdown (if applicable)

**Annotations** (optional):
- Arrow pointing to dropdown
- Circle around selected option

---

### 📸 Screenshot 2: Table with Badge Colors
**Filename**: `coating-status-02-table-badges.png`

**Setup**:
1. Ensure at least 5 items visible
2. Items should have different coating statuses (mix of gray/yellow/blue)
3. Scroll to show "도장상태" column clearly

**Capture Area**:
- Full table width showing item name, coating status column, and actions
- At least 5-7 rows visible

**Expected Elements**:
- [ ] "도장상태" column header
- [ ] Gray badge ("도장 불필요")
- [ ] Yellow badge ("도장 전")
- [ ] Blue badge ("도장 후")
- [ ] Badges are clearly readable

**Annotations**:
- Label each badge color (Gray/Yellow/Blue)
- Highlight "도장상태" column

---

### 📸 Screenshot 3: Filter Applied - "도장 전"
**Filename**: `coating-status-03-filter-yellow.png`

**Setup**:
1. Select "도장 전" from dropdown
2. Wait for table to update
3. Ensure only yellow badges are visible

**Capture Area**:
- Full page (filter bar + table)
- Show dropdown selection + filtered results

**Expected Elements**:
- [ ] Dropdown shows "도장 전" selected
- [ ] Table contains only items with yellow badges
- [ ] No gray or blue badges visible
- [ ] Item count indicator (if present)

**Annotations**:
- Highlight dropdown selection
- Circle or arrow to yellow badges

---

### 📸 Screenshot 4: Filter Applied - "도장 후"
**Filename**: `coating-status-04-filter-blue.png`

**Setup**:
1. Select "도장 후" from dropdown
2. Wait for table to update
3. Ensure only blue badges are visible

**Capture Area**:
- Full page or filter bar + table

**Expected Elements**:
- [ ] Dropdown shows "도장 후" selected
- [ ] Table contains only blue badge items
- [ ] No gray or yellow badges visible

---

### 📸 Screenshot 5: Filter Applied - "도장 불필요"
**Filename**: `coating-status-05-filter-gray.png`

**Setup**:
1. Select "도장 불필요" from dropdown
2. Wait for table to update
3. Ensure only gray badges are visible

**Capture Area**:
- Filter bar + table with results

**Expected Elements**:
- [ ] Dropdown shows "도장 불필요" selected
- [ ] Table contains only gray badge items
- [ ] No yellow or blue badges visible

---

### 📸 Screenshot 6: Create Item Modal
**Filename**: `coating-status-06-create-modal.png`

**Setup**:
1. Click "품목 등록" button
2. Scroll in modal to show coating status field
3. Expand coating status dropdown

**Capture Area**:
- Full modal dialog
- Focus on coating status dropdown section

**Expected Elements**:
- [ ] Modal title: "품목 등록"
- [ ] Coating status dropdown field
- [ ] All 3 options visible or dropdown expanded
- [ ] Default selection shown

**Annotations**:
- Highlight coating status field
- Show default value

---

### 📸 Screenshot 7: Edit Item Modal (Pre-filled)
**Filename**: `coating-status-07-edit-modal.png`

**Setup**:
1. Click edit button on item with "도장 전" status
2. Modal should show with pre-filled data
3. Coating status dropdown should show "도장 전"

**Capture Area**:
- Full modal dialog
- Coating status field visible

**Expected Elements**:
- [ ] Modal title: "품목 수정"
- [ ] Coating status shows current value
- [ ] Form fields pre-populated

**Annotations**:
- Highlight pre-selected coating status
- Show it matches item's current status

---

### 📸 Screenshot 8: No Results Message
**Filename**: `coating-status-08-no-results.png`

**Setup**:
1. Apply a coating status filter with no matching items
2. OR combine filters to yield empty result

**Capture Area**:
- Full table area showing empty state

**Expected Elements**:
- [ ] "조건에 맞는 품목이 없습니다." message
- [ ] Filter bar showing active filter
- [ ] No table rows visible

---

### 📸 Screenshot 9: Reset Filters
**Filename**: `coating-status-09-reset-filters.png`

**Setup**:
1. Apply coating status filter + other filters
2. Hover over or highlight "초기화" button

**Capture Area**:
- Filter bar with all filters applied
- "초기화" button prominent

**Expected Elements**:
- [ ] Multiple filters applied (visible in dropdowns)
- [ ] "초기화" button with rotating arrows icon
- [ ] Hover state if possible

**Annotations**:
- Arrow pointing to reset button
- List active filters

---

### 📸 Screenshot 10: Dark Mode - Table Badges
**Filename**: `coating-status-10-dark-mode.png`

**Setup**:
1. Enable dark mode (if theme toggle exists)
2. View items table with mixed coating statuses

**Capture Area**:
- Full table showing dark theme
- Multiple badge colors visible

**Expected Elements**:
- [ ] Dark background
- [ ] Dark mode badge variants:
  - Gray: `bg-gray-700 text-gray-300`
  - Yellow: `bg-yellow-900 text-yellow-300`
  - Blue: `bg-blue-900 text-blue-300`
- [ ] Badges still readable

**Annotations**:
- Note "Dark Mode"
- Highlight badge color differences

---

### 📸 Screenshot 11: Mobile View (Responsive)
**Filename**: `coating-status-11-mobile.png`

**Setup**:
1. Resize browser to 375px width (mobile)
2. OR use DevTools device emulation (iPhone SE)
3. Show how filters stack vertically

**Capture Area**:
- Full mobile viewport
- Filter bar + table (or horizontally scrollable)

**Expected Elements**:
- [ ] Filters stack vertically
- [ ] Coating status dropdown still functional
- [ ] Table is scrollable or cards view
- [ ] Badges visible on mobile

---

### 📸 Screenshot 12: Browser DevTools Network Tab
**Filename**: `coating-status-12-api-request.png`

**Setup**:
1. Open DevTools (F12) → Network tab
2. Apply coating status filter
3. Highlight the API request showing `coating_status` parameter

**Capture Area**:
- DevTools Network tab
- Request URL showing query parameter
- Response preview (optional)

**Expected Elements**:
- [ ] Request URL: `/api/items?coating_status=...`
- [ ] Status: 200 OK
- [ ] Request method: GET
- [ ] Query parameters visible

**Annotations**:
- Highlight `coating_status` parameter
- Show response structure

---

## Bonus Screenshots (Optional)

### 📸 Bonus 1: Multiple Filters Combined
**Filename**: `coating-status-bonus-01-multi-filter.png`

**Setup**:
- Apply category + coating status + search filters
- Show how filters work together

### 📸 Bonus 2: Pagination with Filter
**Filename**: `coating-status-bonus-02-pagination.png`

**Setup**:
- Apply coating status filter on large dataset
- Show pagination controls active

### 📸 Bonus 3: Keyboard Focus States
**Filename**: `coating-status-bonus-03-keyboard-focus.png`

**Setup**:
- Tab to coating status dropdown
- Capture focus ring/outline

### 📸 Bonus 4: Loading State
**Filename**: `coating-status-bonus-04-loading.png`

**Setup**:
- Apply filter and capture loading spinner/skeleton
- Fast hands required or slow network simulation!

---

## Screenshot Annotation Tools

### Recommended Tools
- **Windows**:
  - Snip & Sketch (built-in annotations)
  - Greenshot (free, powerful)
- **Mac**:
  - Preview (built-in annotations)
  - Skitch (free from Evernote)
- **Cross-Platform**:
  - Canva (web-based)
  - GIMP (free, open source)

### Annotation Best Practices
- ✅ Use **red arrows** for pointing
- ✅ Use **yellow highlights** for important text
- ✅ Use **numbered circles** for step-by-step
- ✅ Add **text labels** for clarity
- ❌ Avoid cluttering with too many annotations
- ❌ Don't cover important UI elements

---

## Screenshot Validation Checklist

Before saving each screenshot, verify:

- [ ] **High Resolution**: Readable text, clear badges
- [ ] **Correct Elements**: All expected UI elements visible
- [ ] **No Sensitive Data**: No real customer/company data exposed
- [ ] **Proper Filename**: Follows naming convention
- [ ] **Annotations Clear**: If annotated, annotations are helpful
- [ ] **File Size**: Reasonably optimized (<500KB per screenshot)

---

## Screenshot Organization

### Directory Structure
```
tests/integration/screenshots/
├── coating-status/
│   ├── coating-status-01-filter-dropdown.png
│   ├── coating-status-02-table-badges.png
│   ├── coating-status-03-filter-yellow.png
│   ├── coating-status-04-filter-blue.png
│   ├── coating-status-05-filter-gray.png
│   ├── coating-status-06-create-modal.png
│   ├── coating-status-07-edit-modal.png
│   ├── coating-status-08-no-results.png
│   ├── coating-status-09-reset-filters.png
│   ├── coating-status-10-dark-mode.png
│   ├── coating-status-11-mobile.png
│   └── coating-status-12-api-request.png
└── README.md (this file)
```

### Screenshot Index
Create a simple markdown file listing all screenshots with descriptions:

```markdown
# Coating Status Screenshots

## Light Mode - Desktop
1. **Filter Dropdown** - Shows all 4 coating status options
2. **Table Badges** - Gray/Yellow/Blue badges in table
3. **Filter Yellow** - Table filtered for "도장 전"
4. **Filter Blue** - Table filtered for "도장 후"
5. **Filter Gray** - Table filtered for "도장 불필요"

## Modals
6. **Create Modal** - Coating status field in create form
7. **Edit Modal** - Pre-selected coating status in edit form

## Edge Cases
8. **No Results** - Empty state message
9. **Reset Filters** - Reset button highlighted

## Dark Mode
10. **Dark Mode Badges** - Badge colors in dark theme

## Responsive
11. **Mobile View** - Filters and badges on mobile

## Technical
12. **API Request** - Network tab showing coating_status parameter
```

---

## Quality Standards

### Image Quality
- **Format**: PNG (for UI screenshots)
- **Resolution**: At least 1920x1080 for desktop, 750x1334 for mobile
- **Color Depth**: 24-bit (millions of colors)
- **Compression**: Optimized but not lossy

### Content Requirements
- **Clarity**: All text must be readable
- **Context**: Enough surrounding UI for context
- **Relevance**: Only capture what's necessary
- **Consistency**: Same theme/zoom across related screenshots

---

## Post-Capture Checklist

After capturing all screenshots:

- [ ] All 12 core screenshots captured
- [ ] Bonus screenshots captured (optional)
- [ ] Screenshots saved to correct directory
- [ ] Filenames follow naming convention
- [ ] Screenshots are annotated (if needed)
- [ ] Screenshot index created
- [ ] Screenshots referenced in test documentation
- [ ] File sizes optimized (<500KB each)
- [ ] Screenshots reviewed for quality
- [ ] No sensitive data visible

---

## Screenshot Usage

### In Test Documentation
Reference screenshots in test reports:

```markdown
**Visual Evidence**: See `coating-status-02-table-badges.png`
```

### In Bug Reports
Attach relevant screenshots when reporting issues:

```markdown
**Issue**: Badge color incorrect in dark mode
**Screenshot**: coating-status-10-dark-mode.png
**Expected**: Dark blue background
**Actual**: Light blue background (see screenshot)
```

### In User Documentation
Use screenshots to create user guides:

```markdown
## How to Filter by Coating Status
1. Locate the coating status dropdown (see Figure 1)
2. Select desired status (see Figure 2)
3. View filtered results (see Figure 3)

![Figure 1](coating-status-01-filter-dropdown.png)
```

---

## Automation Alternative

For consistent screenshot capture, consider automation:

```javascript
// Playwright screenshot automation
import { test } from '@playwright/test';

test('capture coating status screenshots', async ({ page }) => {
  await page.goto('http://localhost:5000/master/items');

  // Screenshot 1: Filter dropdown
  await page.locator('select[value="selectedCoatingStatus"]').click();
  await page.screenshot({
    path: 'tests/integration/screenshots/coating-status/coating-status-01-filter-dropdown.png'
  });

  // Screenshot 2: Table badges
  await page.screenshot({
    path: 'tests/integration/screenshots/coating-status/coating-status-02-table-badges.png',
    fullPage: false
  });

  // ... more screenshots
});
```

**Benefits**:
- ✅ Consistent capture conditions
- ✅ Repeatable process
- ✅ Faster than manual capture
- ✅ Can run in CI/CD pipeline

**Drawbacks**:
- ❌ Requires Playwright setup
- ❌ Less flexible for annotations
- ❌ May need manual review

---

## Screenshot Review Checklist

Before finalizing screenshots:

| Screenshot | Filename Correct | Elements Visible | Quality Good | Annotated | Reviewed |
|------------|------------------|------------------|--------------|-----------|----------|
| 1 - Dropdown | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 2 - Badges | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 3 - Filter Yellow | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 4 - Filter Blue | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 5 - Filter Gray | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 6 - Create Modal | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 7 - Edit Modal | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 8 - No Results | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 9 - Reset | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 10 - Dark Mode | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 11 - Mobile | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 12 - API | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

---

**END OF SCREENSHOT GUIDE**

Save this guide for future UI feature testing!
