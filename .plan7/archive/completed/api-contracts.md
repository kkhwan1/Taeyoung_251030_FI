# API Contract Documentation

**FROZEN after Wave 1 - No changes allowed during Wave 2**

Last Updated: 2025-02-01
Version: 1.0.0
Status: **LOCKED FOR WAVE 2 DEPENDENCIES**

---

## Standard API Response Format

All API endpoints return this format:

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    totalCount: number;
  };
}
```

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "작업 성공"
}
```

### Error Response
```json
{
  "success": false,
  "error": "에러 메시지"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "totalCount": 95
  }
}
```

---

## Core CRUD Routes (60 Routes Total)

### 1. Items API (품목 관리)

**Base Route**: `/api/items`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | /api/items | List all items | ✅ Active |
| POST | /api/items | Create item | ✅ Active |
| GET | /api/items/[id] | Get item by ID | ✅ Active |
| PUT | /api/items/[id] | Update item | ✅ Active |
| DELETE | /api/items/[id] | Delete item (soft) | ✅ Active |

**Query Parameters** (GET /api/items):
- `page`: number (default: 1)
- `limit`: number (default: 20)
- `search`: string (searches item_code, item_name, spec)
- `orderBy`: string (default: item_name)
- `orderDirection`: 'asc' | 'desc' (default: asc)
- `item_type`: string (filter by type)
- `category`: string (filter by category)

**Request Body** (POST/PUT):
```json
{
  "item_code": "ITEM001",
  "item_name": "부품A",
  "item_type": "원자재",
  "spec": "SPEC-001",
  "unit": "EA",
  "safety_stock": 100,
  "price": 10000,
  "category": "원자재",
  "material_type": "Steel",
  "coating_status": "no_coating"
}
```

---

### 2. Companies API (거래처 관리)

**Base Route**: `/api/companies`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | /api/companies | List all companies | ✅ Active |
| POST | /api/companies | Create company | ✅ Active |
| GET | /api/companies/[id] | Get company by ID | ✅ Active |
| PATCH | /api/companies/[id] | Update company | ✅ Active |
| DELETE | /api/companies/[id] | Delete company (soft) | ✅ Active |

**Query Parameters** (GET /api/companies):
- `page`: number (default: 1)
- `limit`: number (default: 20)
- `search`: string (searches company_name, company_code, business_number)
- `company_type`: '고객사' | '공급사'
- `company_category`: '협력업체-원자재' | '협력업체-외주' | '소모품업체' | '기타'

**Request Body** (POST/PATCH):
```json
{
  "company_name": "태창제강",
  "company_type": "공급사",
  "company_category": "협력업체-원자재",
  "business_number": "123-45-67890",
  "business_info": {
    "business_type": "제조업",
    "business_item": "철강",
    "main_products": "강판, 코일"
  },
  "phone": "02-1234-5678",
  "email": "info@taechang.com",
  "address": "서울시 강남구"
}
```

**Note**: `company_code` is auto-generated: CUS001, SUP001, etc.

---

### 3. BOM API (자재명세서)

**Base Route**: `/api/bom`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | /api/bom | List BOM entries | ✅ Active |
| POST | /api/bom | Create BOM entry | ✅ Active |
| PUT | /api/bom | Update BOM entry | ✅ Active |
| DELETE | /api/bom?id=[bom_id] | Delete BOM (soft) | ✅ Active |
| GET | /api/bom/[id] | Get BOM by ID | ✅ Active |
| PUT | /api/bom/[id] | Update BOM by ID | ✅ Active |
| DELETE | /api/bom/[id] | Delete BOM by ID | ✅ Active |

**Query Parameters** (GET /api/bom):
- `parent_item_id`: number (filter by parent)
- `child_item_id`: number (filter by child)
- `level_no`: number (filter by level)
- `price_month`: string (YYYY-MM-DD, default: current month)
- `limit`: number (default: 100)
- `offset`: number (default: 0)

**Request Body** (POST/PUT):
```json
{
  "parent_item_id": 1,
  "child_item_id": 2,
  "quantity_required": 5.0,
  "level_no": 1,
  "notes": "메모"
}
```

**Special Features**:
- ✅ Circular reference detection
- ✅ Self-reference prevention
- ✅ Automatic scrap revenue calculation
- ✅ Monthly price history support

---

### 4. Inventory Transactions API (재고 거래)

**Base Route**: `/api/inventory/transactions`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | /api/inventory/transactions | List transactions | ✅ Active |
| POST | /api/inventory/transactions | Create transaction | ✅ Active |
| GET | /api/inventory/transactions/[id] | Get transaction | ✅ Active |
| PUT | /api/inventory/transactions/[id] | Update transaction | ✅ Active |

**Transaction Types**:
- `입고`: Receiving
- `생산입고`: Production receiving
- `생산출고`: Production shipping
- `출고`: Shipping

**Request Body**:
```json
{
  "transaction_type": "입고",
  "transaction_date": "2025-02-01",
  "items": [
    {
      "item_id": 1,
      "quantity": 100,
      "unit_price": 10000
    }
  ],
  "customer_id": 5,
  "notes": "입고 메모"
}
```

---

### 5. Stock API (재고 조회)

**Base Route**: `/api/stock`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | /api/stock/current | Current stock levels | ✅ Active |
| GET | /api/stock/history | Stock history | ✅ Active |
| GET | /api/stock/items | Items with stock | ✅ Active |
| GET | /api/stock/alerts | Stock alerts (low stock) | ✅ Active |

---

### 6. Sales Transactions API (매출)

**Base Route**: `/api/sales-transactions`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | /api/sales-transactions | List sales | ✅ Active |
| POST | /api/sales-transactions | Create sale | ✅ Active |
| GET | /api/sales-transactions/[id] | Get sale | ✅ Active |
| PUT | /api/sales-transactions/[id] | Update sale | ✅ Active |

**Auto-Calculated Fields**:
- `payment_status`: Based on `collected_amount` vs `total_amount`
  - `PENDING`: collected_amount = 0
  - `PARTIAL`: 0 < collected_amount < total_amount
  - `COMPLETED`: collected_amount = total_amount

---

### 7. Purchase Transactions API (매입)

**Base Route**: `/api/purchases` or `/api/purchase-transactions`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | /api/purchases | List purchases | ✅ Active |
| POST | /api/purchases | Create purchase | ✅ Active |
| GET | /api/purchases/[id] | Get purchase | ✅ Active |
| PUT | /api/purchase-transactions/[id] | Update purchase | ✅ Active |

**Auto-Calculated Fields**:
- `payment_status`: Based on `paid_amount` vs `total_amount`

---

### 8. Collections API (수금)

**Base Route**: `/api/collections`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | /api/collections | List collections | ✅ Active |
| POST | /api/collections | Create collection | ✅ Active |
| GET | /api/collections/summary | Collection summary | ✅ Active |

---

### 9. Payments API (지급)

**Base Route**: `/api/payments`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | /api/payments | List payments | ✅ Active |
| POST | /api/payments | Create payment | ✅ Active |
| GET | /api/payments/summary | Payment summary | ✅ Active |

---

### 10. Accounting API (회계)

**Base Route**: `/api/accounting`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | /api/accounting/monthly-summary | Monthly summary | ✅ Active |
| GET | /api/accounting/export | Export accounting data | ✅ Active |

---

### 11. Dashboard API (대시보드)

**Base Route**: `/api/dashboard`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | /api/dashboard/charts | Chart data | ✅ Active |
| GET | /api/dashboard/alerts | System alerts | ✅ Active |

---

### 12. Export API (Excel 내보내기)

**Base Route**: `/api/export`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | /api/export/items | Export items | ✅ Active |
| GET | /api/export/inventory | Export inventory | ✅ Active |
| GET | /api/export/stock | Export stock | ✅ Active |
| GET | /api/export/sales | Export sales | ✅ Active |
| GET | /api/export/purchases | Export purchases | ✅ Active |
| GET | /api/export/collections | Export collections | ✅ Active |
| GET | /api/export/payments | Export payments | ✅ Active |

**All exports follow 3-sheet format**:
1. Sheet 1: 내보내기 정보 (Metadata)
2. Sheet 2: 통계 (Statistics)
3. Sheet 3: 데이터 (Data with Korean headers)

---

### 13. Upload/Import API (Excel 업로드)

**Base Route**: `/api/upload` or `/api/import`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | /api/upload/items | Import items | ✅ Active |
| POST | /api/upload/companies | Import companies | ✅ Active |
| POST | /api/bom/upload | Import BOM | ✅ Active |

---

### 14. Batch Registration API (배치등록/생산)

**Base Route**: `/api/batch-registration`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | /api/batch-registration | List batches | ✅ Active |
| POST | /api/batch-registration | Create batch | ✅ Active |
| GET | /api/batch-registration/[id] | Get batch | ✅ Active |
| PATCH | /api/batch-registration/[id] | Update/Complete batch | ✅ Active |

**Auto-Features**:
- ✅ Auto stock movement on completion
- ✅ BOM-based material deduction
- ✅ Multi-item batch support

---

### 15. Price History API (월별 단가)

**Base Route**: `/api/price-history`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | /api/price-history | List price history | ✅ Active |
| POST | /api/price-history | Create price record | ✅ Active |
| GET | /api/price-history/months | Available months | ✅ Active |
| POST | /api/price-history/generate | Generate monthly prices | ✅ Active |

---

## Authentication & Authorization

**Current Status**: ❌ Not implemented (Phase 4)

All routes currently use `requireAuth: false`. When authentication is implemented:

- Header: `Authorization: Bearer {token}`
- User ID: `x-user-id` header
- Request tracking: `x-request-id` header

---

## Rate Limiting

**Current Status**: ❌ Not implemented

**Planned**: 100 requests/minute per IP

---

## Korean Encoding Standard

⚠️ **CRITICAL**: All POST/PUT/PATCH routes MUST use this pattern:

```typescript
// ✅ CORRECT
const text = await request.text();
const data = JSON.parse(text);

// ❌ WRONG (causes Korean character corruption)
const data = await request.json();
```

This pattern is implemented in all handlers via `CRUDHandler.parseRequestBody()`.

---

## Error Codes

| HTTP Code | Meaning | Example |
|-----------|---------|---------|
| 200 | Success | Data retrieved |
| 201 | Created | Resource created |
| 400 | Bad Request | Validation error |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate entry |
| 500 | Server Error | Database error |

---

## Breaking Change Policy

**During Wave 2 (Frontend Refactoring)**:

🔒 **FROZEN** - No changes allowed to:
- Response format (APIResponse structure)
- Route paths and HTTP methods
- Required request fields
- Core business logic

✅ **ALLOWED** - Can modify:
- Internal implementation (as long as contract is maintained)
- Performance optimizations
- Bug fixes that don't change behavior
- Additional optional fields (backwards compatible)

---

## Deprecation Policy

When a route must be deprecated:
1. Mark as `deprecated` in this document
2. Add `X-Deprecated: true` response header
3. Maintain for minimum 2 releases
4. Provide migration guide

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2025-02-01 | Initial API contract | Agent 2 (backend-architect) |

---

## Contact

For API contract questions during Wave 2:
- **DO NOT** modify contracts without approval
- Create issue in `.plan7/issues/` directory
- Tag: `api-contract-change-request`
- Requires: Codex approval + Wave 1 completion verification

---

**END OF API CONTRACT - LOCKED FOR WAVE 2**
