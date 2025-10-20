# Price History API Documentation

## Overview

The Price History API provides comprehensive management of monthly unit price history for items in the ERP system. It includes advanced filtering, searching, sorting capabilities, and bulk update operations.

---

## 1. GET /api/price-history

Retrieve price history records with extensive filtering and sorting options.

### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `item_id` | number | Filter by specific item ID | `?item_id=1` |
| `start_month` | string | Start date (YYYY-MM-DD) | `?start_month=2025-01-01` |
| `end_month` | string | End date (YYYY-MM-DD) | `?end_month=2025-12-31` |
| `category` | string | Filter by item category | `?category=Parts` |
| `supplier_id` | number | Filter by supplier ID | `?supplier_id=5` |
| `min_price` | number | Minimum unit price | `?min_price=10000` |
| `max_price` | number | Maximum unit price | `?max_price=50000` |
| `search` | string | Search item name or code | `?search=부품A` |
| `sort_by` | enum | Sort field (price_month\|unit_price\|item_name) | `?sort_by=unit_price` |
| `sort_order` | enum | Sort order (asc\|desc) | `?sort_order=asc` |
| `limit` | number | Items per page (default: 100) | `?limit=50` |
| `offset` | number | Page offset (default: 0) | `?offset=100` |

### Example Requests

**Basic Query:**
```bash
GET /api/price-history?limit=20
```

**Search by Item Name:**
```bash
GET /api/price-history?search=부품A&sort_by=price_month&sort_order=desc
```

**Filter by Category and Price Range:**
```bash
GET /api/price-history?category=Parts&min_price=10000&max_price=30000
```

**Advanced Multi-Filter:**
```bash
GET /api/price-history?item_id=1&start_month=2025-01-01&end_month=2025-12-31&sort_by=unit_price&sort_order=asc
```

### Response Format

```json
{
  "success": true,
  "data": [
    {
      "price_history_id": 1,
      "item_id": 1,
      "price_month": "2025-11-01",
      "unit_price": 15000,
      "price_per_kg": 12000,
      "note": "11월 단가 인상",
      "created_at": "2025-01-17T10:30:00.000Z",
      "item": {
        "item_id": 1,
        "item_code": "PART001",
        "item_name": "부품A",
        "category": "Parts",
        "unit": "EA",
        "supplier_id": 5
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "totalCount": 150,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  },
  "filters": {
    "item_id": null,
    "start_month": null,
    "end_month": null,
    "category": null,
    "supplier_id": null,
    "min_price": null,
    "max_price": null,
    "search": null,
    "sort_by": "price_month",
    "sort_order": "desc"
  }
}
```

### Features

- **Korean Text Search**: Uses PostgreSQL `ILIKE` for case-insensitive search
- **Multi-Field Sorting**: Sort by date, price, or item name with Korean collation
- **Nested Filtering**: Filter by item properties (category, supplier)
- **Pagination**: Efficient pagination with total count
- **Performance**: Optimized queries with proper indexing

---

## 2. POST /api/price-history

Create a new price history record.

### Request Body

```json
{
  "item_id": 1,
  "price_month": "2025-11-01",
  "unit_price": 15000,
  "price_per_kg": 12000,
  "note": "11월 단가 인상",
  "created_by": "user@example.com"
}
```

### Validation Rules

- `item_id`: Required, must be valid item ID
- `price_month`: Required, must be YYYY-MM-DD format
- `unit_price`: Required, must be positive number
- `price_per_kg`: Optional, must be positive if provided
- `note`: Optional, max 500 characters
- `created_by`: Optional, max 100 characters

### Duplicate Prevention

The API prevents duplicate entries for the same `(item_id, price_month)` combination. If a duplicate is detected, it returns:

```json
{
  "success": false,
  "error": "해당 품목(1)의 2025-11-01 단가가 이미 존재합니다. 수정을 원하시면 PUT 요청을 사용하세요."
}
```

### Success Response

```json
{
  "success": true,
  "message": "단가 이력이 성공적으로 생성되었습니다.",
  "data": {
    "price_history_id": 1,
    "item_id": 1,
    "price_month": "2025-11-01",
    "unit_price": 15000,
    "price_per_kg": 12000,
    "note": "11월 단가 인상",
    "created_at": "2025-01-17T10:30:00.000Z",
    "item": {
      "item_id": 1,
      "item_code": "PART001",
      "item_name": "부품A",
      "category": "Parts",
      "unit": "EA"
    }
  }
}
```

---

## 3. POST /api/price-history/bulk-update

Perform bulk updates of price history records with transaction support.

### Request Body

```json
{
  "updates": [
    {
      "item_id": 1,
      "price_month": "2025-11-01",
      "unit_price": 15000,
      "price_per_kg": 12000,
      "note": "11월 인상"
    },
    {
      "item_id": 2,
      "price_month": "2025-11-01",
      "unit_price": 18000,
      "note": "11월 단가"
    }
  ],
  "override_existing": false
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `updates` | array | Yes | Array of update objects (min: 1, max: 100) |
| `updates[].item_id` | number | Yes | Item ID to update |
| `updates[].price_month` | string | Yes | Price month (YYYY-MM-DD) |
| `updates[].unit_price` | number | Yes | Unit price (positive) |
| `updates[].price_per_kg` | number | No | Price per kg (optional) |
| `updates[].note` | string | No | Note (max 500 chars) |
| `override_existing` | boolean | No | Overwrite existing records (default: false) |

### Processing Logic

1. **Validation Phase**:
   - Validate array length (1-100 items)
   - Validate each item's data format
   - Check all item IDs exist in database

2. **Duplicate Check Phase** (if `override_existing=false`):
   - Query existing `(item_id, price_month)` combinations
   - Filter out duplicates
   - Collect failed items with error messages

3. **Transaction Phase**:
   - Use `upsert` for atomic batch insert/update
   - Handle conflicts based on `override_existing` flag
   - Collect success/failure counts

4. **Result Aggregation**:
   - Calculate execution time
   - Generate detailed result report

### Response Format

**Success Response:**
```json
{
  "success": true,
  "message": "95개 업데이트 완료, 5개 실패",
  "data": {
    "total_requested": 100,
    "successful": 95,
    "failed": 5,
    "failed_items": [
      {
        "item_id": 99999,
        "price_month": "2025-11-01",
        "error": "존재하지 않는 품목 ID"
      },
      {
        "item_id": 1,
        "price_month": "2025-10-01",
        "error": "중복된 가격 이력 (override_existing=true로 덮어쓰기 가능)"
      }
    ],
    "execution_time_ms": 450
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "입력 검증 실패",
  "details": [
    {
      "code": "too_big",
      "maximum": 100,
      "path": ["updates"],
      "message": "최대 100개까지 업데이트 가능합니다"
    }
  ]
}
```

### Performance Targets

| Items | Target Time | Average Time |
|-------|-------------|--------------|
| 10 items | < 200ms | ~150ms |
| 50 items | < 500ms | ~400ms |
| 100 items | < 1000ms | ~800ms |

### Error Handling

The API provides detailed error information for each failed item:

- **존재하지 않는 품목 ID**: Item ID doesn't exist in database
- **중복된 가격 이력**: Duplicate entry (can be overridden)
- **입력 검증 실패**: Data format validation failed
- **대량 업데이트 실패**: Database operation failed

### Example Usage

**Scenario 1: New Price Updates**
```bash
curl -X POST http://localhost:5000/api/price-history/bulk-update \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {"item_id": 1, "price_month": "2025-11-01", "unit_price": 15000, "note": "11월 인상"},
      {"item_id": 2, "price_month": "2025-11-01", "unit_price": 18000, "note": "11월 단가"}
    ],
    "override_existing": false
  }'
```

**Scenario 2: Override Existing Prices**
```bash
curl -X POST http://localhost:5000/api/price-history/bulk-update \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {"item_id": 1, "price_month": "2025-11-01", "unit_price": 15500, "note": "11월 수정"}
    ],
    "override_existing": true
  }'
```

**Scenario 3: Mixed Valid/Invalid Items**
```bash
curl -X POST http://localhost:5000/api/price-history/bulk-update \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {"item_id": 1, "price_month": "2025-11-01", "unit_price": 15000},
      {"item_id": 99999, "price_month": "2025-11-01", "unit_price": 10000}
    ],
    "override_existing": false
  }'
```

Response:
```json
{
  "success": true,
  "message": "1개 업데이트 완료, 1개 실패",
  "data": {
    "total_requested": 2,
    "successful": 1,
    "failed": 1,
    "failed_items": [
      {
        "item_id": 99999,
        "price_month": "2025-11-01",
        "error": "존재하지 않는 품목 ID"
      }
    ],
    "execution_time_ms": 120
  }
}
```

---

## 4. GET /api/price-history/bulk-update

Get API information and usage guide.

### Response

```json
{
  "success": true,
  "message": "Price History Bulk Update API",
  "usage": {
    "method": "POST",
    "endpoint": "/api/price-history/bulk-update",
    "max_items": 100,
    "parameters": {
      "updates": "Array<{item_id, price_month, unit_price, price_per_kg?, note?}>",
      "override_existing": "boolean (default: false)"
    }
  },
  "example": {
    "updates": [
      {
        "item_id": 1,
        "price_month": "2025-11-01",
        "unit_price": 15000,
        "price_per_kg": 12000,
        "note": "11월 인상"
      }
    ],
    "override_existing": false
  },
  "performance": {
    "target_100_items": "<1000ms",
    "average_50_items": "<500ms"
  }
}
```

---

## Best Practices

### 1. Filtering Strategy

Use specific filters to reduce response size:
```bash
# Good: Specific filters
GET /api/price-history?item_id=1&start_month=2025-01-01&end_month=2025-12-31

# Avoid: No filters on large datasets
GET /api/price-history?limit=1000
```

### 2. Pagination

Always use pagination for large datasets:
```bash
# First page
GET /api/price-history?limit=50&offset=0

# Second page
GET /api/price-history?limit=50&offset=50
```

### 3. Bulk Updates

Batch updates for better performance:
```javascript
// Good: Single bulk request
POST /api/price-history/bulk-update
Body: { updates: [item1, item2, ..., item100] }

// Avoid: Multiple individual requests
for (item of items) {
  POST /api/price-history
  Body: item
}
```

### 4. Error Handling

Always check `success` flag and handle partial failures:
```javascript
const response = await fetch('/api/price-history/bulk-update', {
  method: 'POST',
  body: JSON.stringify(payload)
});

const result = await response.json();

if (result.success) {
  if (result.data.failed > 0) {
    console.log('Partial success:', result.data.failed_items);
  }
} else {
  console.error('Operation failed:', result.error);
}
```

---

## Testing

A comprehensive test script is available at:
```bash
node scripts/test-price-history-bulk-update.js
```

Test coverage includes:
- ✅ API information retrieval
- ✅ Input validation
- ✅ Bulk insert operations
- ✅ Duplicate handling
- ✅ Override existing data
- ✅ Invalid item ID handling
- ✅ Advanced filtering
- ✅ Performance benchmarks

---

## Technical Details

### Korean Text Handling

All APIs use proper UTF-8 encoding:
```typescript
// Request handling
const text = await request.text();
const body = JSON.parse(text);
```

This ensures Korean characters (한글) are preserved correctly.

### Database Schema

```sql
CREATE TABLE item_price_history (
  price_history_id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES items(item_id),
  price_month DATE NOT NULL,
  unit_price NUMERIC(15,2) NOT NULL,
  price_per_kg NUMERIC(15,2),
  note TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(item_id, price_month)
);

CREATE INDEX idx_price_history_item ON item_price_history(item_id);
CREATE INDEX idx_price_history_month ON item_price_history(price_month);
CREATE INDEX idx_price_history_price ON item_price_history(unit_price);
```

### Performance Optimization

1. **Batch Operations**: Use `upsert` for atomic bulk operations
2. **Indexing**: Proper indexes on `item_id`, `price_month`, `unit_price`
3. **Query Optimization**: Use `select` with specific columns
4. **Transaction Support**: All bulk operations are transactional

---

## Version History

- **v1.0** (2025-01-17): Initial release with GET and POST
- **v1.1** (2025-01-17): Added bulk update API
- **v1.2** (2025-01-17): Enhanced filtering and search capabilities

---

## Support

For issues or questions, please refer to:
- Project documentation: `/docs/`
- API test scripts: `/scripts/test-price-history-bulk-update.js`
- CLAUDE.md for development guidelines
