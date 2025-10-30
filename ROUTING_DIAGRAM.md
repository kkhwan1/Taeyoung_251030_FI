# Routing Architecture Diagram

## Route Hierarchy & Data Flow

```
                          ERP Dashboard
                               |
           ____________________________________________
           |                   |                       |
      /inventory          /production               /stock
    (Main Page)        (Standalone)            (Main Page)
           |                   |                   |
      +--------+               |              +--------+
      |        |               |              |        |
   Tab:     Tab:           [Entry]         Tab:    Tab:
 receiving production      [History]      current  history
   |         |               |             |         |
   |         |          Independent        |         |
   |         |          Interface          |         |
   |         |               |             |         |
   └─────────────────────────────────────────────────┘
            | (Shared Inventory Context)

     ┌─────────────────────────────────────┐
     │   Redirected Routes                 │
     ├─────────────────────────────────────┤
     │ /inventory/receiving ───→ /inventory│
     │ /stock/current ──────────→ /stock   │
     └─────────────────────────────────────┘
```

## URL Navigation Flows

### Inventory Management
```
User Path 1: Direct Access
/inventory
    │
    ├─ ?tab=receiving (Default)
    │   └─ ReceivingForm + Transaction History
    │
    ├─ ?tab=production
    │   └─ ProductionForm + Production History
    │
    └─ ?tab=shipping
        └─ ShippingForm + Shipping History

User Path 2: Alternative Access
/inventory/receiving ──[REDIRECT]──→ /inventory?tab=receiving
```

### Stock Management
```
User Path 1: Direct Access
/stock
    │
    ├─ ?tab=current (Default)
    │   └─ Stock Levels Table + Stats
    │
    ├─ ?tab=history
    │   └─ Stock Movement History
    │
    └─ ?tab=adjustment
        └─ Stock Adjustment Form

User Path 2: Alternative Access
/stock/current ──[REDIRECT]──→ /stock?tab=current

User Path 3: From Inventory History
/stock?history_id=123
    └─ Filters to specific transaction
```

### Production Management
```
User Path 1: Dedicated Interface
/production
    │
    ├─ [Entry Tab]
    │   └─ ProductionEntryForm (Independent)
    │
    └─ [History Tab]
        └─ ProductionHistoryTable (Independent)

User Path 2: Inventory Tabbed Access
/inventory?tab=production
    │
    ├─ [Form]
    │   └─ ProductionForm (Same functionality)
    │
    └─ [History]
        └─ Production History Table
```

## Route Component Relationships

```
Next.js Route Structure:
├── app/
├── inventory/
│   ├── page.tsx ────────────────────┐
│   │                                │
│   └── receiving/                   │
│       └── page.tsx ──[REDIRECT]─────┼──→ /inventory
│                                    │
├── stock/                           │
│   ├── page.tsx ───┐               │
│   │               │                │
│   ├── history/    │                │
│   │   └── page.tsx│ (Sub-routes)   │
│   │               │                │
│   └── current/    │                │
│       └── page.tsx ──[REDIRECT]────┘
│
└── production/
    └── page.tsx ──────────────────[STANDALONE]
```

## State Management Architecture

```
                    ┌──────────────────────────┐
                    │  Next.js Router Context  │
                    │  (useRouter hook)        │
                    └──────────────────────────┘
                              |
                ______________|______________
                |                           |
         ┌──────────────┐          ┌─────────────────┐
         │ Inventory    │          │ Stock           │
         │ Page Context │          │ Page Context    │
         ├──────────────┤          ├─────────────────┤
         │              │          │                 │
         │ activeTab    │          │ activeTab       │
         │ state        │          │ state           │
         │              │          │                 │
         │ API calls:   │          │ API calls:      │
         │ - receiving  │          │ - current       │
         │ - production │          │ - history       │
         │ - shipping   │          │ - adjustment    │
         │              │          │                 │
         └──────────────┘          └─────────────────┘

         ┌──────────────────────────────────────┐
         │ Production Page Context (STANDALONE) │
         ├──────────────────────────────────────┤
         │                                      │
         │ Independent state management         │
         │ - refreshKey state                   │
         │ - Local form handling                │
         │                                      │
         └──────────────────────────────────────┘
```

## API Endpoint Routing

```
Frontend Routes          →    Backend API Routes
────────────────────────────────────────────────

/inventory
  └─ ?tab=receiving     →    /api/inventory?type=입고
  └─ ?tab=production    →    /api/inventory/production
  └─ ?tab=shipping      →    /api/inventory/shipping

/production
  └─ [Entry]            →    /api/inventory/production
  └─ [History]          →    /api/inventory/production

/stock
  └─ ?tab=current       →    /api/stock
  └─ ?tab=history       →    /api/stock/history
  └─ ?tab=adjustment    →    /api/stock/adjustment
```

## Optimal User Navigation Paths

```
Scenario 1: User needs to enter receiving transaction
  Entry:    /inventory
  Click:    "입고 관리" tab
  URL:      /inventory?tab=receiving
  Action:   Fill form, submit
  Result:   Transaction created, history refreshed

Scenario 2: User wants dedicated production view
  Entry:    /production
  Click:    "생산 등록" tab or "생산 내역" tab
  URL:      /production
  Action:   Enter data or view history
  Result:   Production recorded, BOM deducted

Scenario 3: User viewing stock, needs production reference
  Current:  /stock
  Click:    History row (transaction_type = 생산입고)
  Route:    /inventory?tab=production&transaction_id=xxx
  Result:   Shows relevant production transaction

Scenario 4: User arrives at deprecated URL
  Visits:   /inventory/receiving
  Action:   Page redirects (client-side)
  New URL:  /inventory?tab=receiving
  Result:   No error, seamless transition
```

## Performance Implications

```
Route Type        │ Initial Load │ Tab Switch │ Benefits
────────────────────────────────────────────────────────
/inventory        │ ~500ms       │ ~50ms      │ Unified, fast tab switching
/inventory/receiv │ ~500ms       │ (redirects)│ SEO-friendly, prevents duplication
/production       │ ~500ms       │ ~50ms      │ Focused, dedicated UI
/stock            │ ~500ms       │ ~50ms      │ Unified, comprehensive view
```

## Summary

The routing architecture follows Next.js best practices:
- ✅ Clean URL patterns with query parameters for state
- ✅ Redirects prevent duplicate content
- ✅ Clear semantic separation (tabbed vs standalone)
- ✅ Efficient client-side navigation
- ✅ Both consolidated and dedicated access patterns
