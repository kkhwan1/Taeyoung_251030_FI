# Items API - Coating Status Documentation

**Version**: 1.0.0
**Last Updated**: 2025-01-19
**Endpoint Base**: `/api/items`

## Overview

The Items API supports coating status tracking for items in the ERP system. This feature enables filtering, creation, and updates of items based on their coating status.

**Coating Status Values**:
- `no_coating` - 도장 없음 (No coating)
- `before_coating` - 도장 전 (Before coating)
- `after_coating` - 도장 후 (After coating)

---

## Table of Contents

1. [GET /api/items - List Items with Coating Status Filter](#get-items)
2. [POST /api/items - Create Item with Coating Status](#post-items)
3. [PUT /api/items - Update Item Coating Status](#put-items)
4. [Error Codes](#error-codes)
5. [cURL Examples](#curl-examples)

---

## GET /api/items

### List Items with Coating Status Filter

Retrieve a list of items with optional filtering by coating status.

**Endpoint**: `GET /api/items`

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `coating_status` | string | No | Filter by coating status | `no_coating`, `before_coating`, `after_coating` |
| `search` | string | No | Search by item code, name, or spec | `부품A` |
| `category` | string | No | Filter by category | `원자재` |
| `itemType` | string | No | Filter by item type (RAW, SUB, FINISHED) | `RAW` |
| `materialType` | string | No | Filter by material type (COIL, SHEET, OTHER) | `COIL` |
| `vehicleModel` | string | No | Filter by vehicle model | `소나타` |
| `minDaily` | integer | No | Minimum daily requirement | `100` |
| `maxDaily` | integer | No | Maximum daily requirement | `1000` |
| `page` | integer | No | Page number (default: 1) | `1` |
| `limit` | integer | No | Items per page (default: 20) | `20` |
| `use_cursor` | boolean | No | Use cursor-based pagination | `true` |
| `cursor` | string | No | Cursor for pagination | `ITEM001` |
| `direction` | string | No | Pagination direction (next/prev) | `next` |

### Response Format

**Success Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "item_id": 1,
        "item_code": "ITEM001",
        "item_name": "부품A",
        "category": "원자재",
        "unit": "EA",
        "item_type": "RAW",
        "material_type": "COIL",
        "vehicle_model": "소나타",
        "material": "철강",
        "spec": "SPEC-001",
        "thickness": 1.5,
        "width": 100,
        "height": 200,
        "specific_gravity": 7.85,
        "mm_weight": 0.2355,
        "daily_requirement": 500,
        "blank_size": 150,
        "price": 1000,
        "safety_stock": 100,
        "current_stock": 500,
        "location": "A-01",
        "description": "설명",
        "coating_status": "before_coating",
        "is_active": true,
        "created_at": "2025-01-19T00:00:00.000Z",
        "updated_at": "2025-01-19T00:00:00.000Z"
      }
    ],
    "summary": {
      "byItemType": {
        "RAW": 10,
        "SUB": 5,
        "FINISHED": 3
      },
      "byMaterialType": {
        "COIL": 8,
        "SHEET": 7,
        "OTHER": 3
      }
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 18,
      "totalPages": 1,
      "hasMore": false
    }
  },
  "filters": {
    "search": null,
    "category": null,
    "itemType": null,
    "materialType": null,
    "vehicleModel": null,
    "minDaily": null,
    "maxDaily": null
  }
}
```

### Request Examples

**Example 1: Filter by coating_status = 'no_coating'**

```http
GET /api/items?coating_status=no_coating&limit=10
```

**Example 2: Filter by coating_status = 'before_coating' with search**

```http
GET /api/items?coating_status=before_coating&search=부품A&page=1&limit=20
```

**Example 3: Filter by coating_status = 'after_coating' with cursor pagination**

```http
GET /api/items?coating_status=after_coating&use_cursor=true&limit=20
```

### Error Responses

**400 Bad Request** - Invalid coating_status value:

```json
{
  "success": false,
  "error": "품목 정보를 조회하지 못했습니다.",
  "details": "Invalid coating_status value. Must be one of: no_coating, before_coating, after_coating"
}
```

**500 Internal Server Error** - Database query failure:

```json
{
  "success": false,
  "error": "품목 정보를 조회하지 못했습니다."
}
```

---

## POST /api/items

### Create Item with Coating Status

Create a new item with an optional coating status.

**Endpoint**: `POST /api/items`

### Request Body

**Required Fields**:
- `item_code` (string, max 50): Unique item code (English/numbers only)
- `item_name` (string, max 255): Item name (Korean/English/numbers)
- `category` (string): Item category
- `unit` (string, max 20): Unit of measure (e.g., "EA", "KG")

**Optional Fields**:
- `coating_status` (enum): One of `no_coating`, `before_coating`, `after_coating`
- `item_type` (enum): One of `RAW`, `SUB`, `FINISHED` (default: `RAW`)
- `material_type` (enum): One of `COIL`, `SHEET`, `OTHER` (default: `OTHER`)
- `vehicle_model` (string): Vehicle model
- `material` (string): Material description
- `spec` (string): Specification
- `thickness` (number): Thickness in mm
- `width` (number): Width in mm
- `height` (number): Height in mm
- `specific_gravity` (number): Specific gravity (default: 7.85)
- `mm_weight` (number): Weight per mm (auto-calculated if not provided)
- `daily_requirement` (integer): Daily requirement quantity
- `blank_size` (integer): Blank size
- `price` (number): Unit price
- `safety_stock` (integer): Safety stock level
- `current_stock` (integer): Current stock quantity
- `location` (string): Storage location
- `description` (string): Item description

### Request Example

```json
{
  "item_code": "ITEM002",
  "item_name": "부품B",
  "category": "원자재",
  "unit": "EA",
  "coating_status": "before_coating",
  "item_type": "RAW",
  "material_type": "SHEET",
  "vehicle_model": "아반떼",
  "material": "철강",
  "spec": "SPEC-002",
  "thickness": 2.0,
  "width": 150,
  "height": 250,
  "specific_gravity": 7.85,
  "daily_requirement": 300,
  "blank_size": 200,
  "price": 1500,
  "safety_stock": 50,
  "current_stock": 200,
  "location": "B-02",
  "description": "도장 전 원자재"
}
```

### Response Format

**Success Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "item_id": 2,
    "item_code": "ITEM002",
    "item_name": "부품B",
    "category": "원자재",
    "unit": "EA",
    "coating_status": "before_coating",
    "item_type": "RAW",
    "material_type": "SHEET",
    "vehicle_model": "아반떼",
    "material": "철강",
    "spec": "SPEC-002",
    "thickness": 2.0,
    "width": 150,
    "height": 250,
    "specific_gravity": 7.85,
    "mm_weight": 0.589,
    "daily_requirement": 300,
    "blank_size": 200,
    "price": 1500,
    "safety_stock": 50,
    "current_stock": 200,
    "location": "B-02",
    "description": "도장 전 원자재",
    "is_active": true,
    "created_at": "2025-01-19T10:30:00.000Z",
    "updated_at": "2025-01-19T10:30:00.000Z"
  },
  "message": "품목이 등록되었습니다."
}
```

### Default Behavior

**coating_status Default**: If not provided, the field will be `null`.

**Auto-calculated Fields**:
- `mm_weight`: Automatically calculated from thickness, width, height, blank_size, and specific_gravity
- Formula: `mm_weight = (thickness_cm × width_cm × length_cm × specific_gravity) / 1000`

### Error Responses

**400 Bad Request** - Missing required fields:

```json
{
  "success": false,
  "error": "필수 입력값을 확인해주세요.",
  "details": [
    {
      "field": "item_code",
      "message": "item_code는 필수 입력 항목입니다"
    },
    {
      "field": "item_name",
      "message": "item_name는 필수 입력 항목입니다"
    }
  ]
}
```

**400 Bad Request** - Invalid coating_status value:

```json
{
  "success": false,
  "error": "필수 입력값을 확인해주세요.",
  "details": "coating_status must be one of: no_coating, before_coating, after_coating"
}
```

**409 Conflict** - Duplicate item_code:

```json
{
  "success": false,
  "error": "이미 사용 중인 품목 코드입니다.",
  "details": {
    "item_code": "ITEM002"
  }
}
```

**422 Unprocessable Entity** - Validation failure (Zod validation):

```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "coating_status": "Invalid enum value. Expected 'no_coating' | 'before_coating' | 'after_coating'"
  }
}
```

---

## PUT /api/items

### Update Item Coating Status

Update an existing item's coating status or other fields.

**Endpoint**: `PUT /api/items`

### Request Body

**Required Fields**:
- `item_id` (integer) OR `id` (integer): Item ID to update

**Optional Fields** (at least one required):
- All fields from POST /api/items are supported for partial updates
- `coating_status` (enum): One of `no_coating`, `before_coating`, `after_coating`

### Request Example

**Example 1: Update only coating_status**

```json
{
  "item_id": 1,
  "coating_status": "after_coating"
}
```

**Example 2: Update coating_status with other fields**

```json
{
  "item_id": 1,
  "coating_status": "after_coating",
  "price": 2000,
  "description": "도장 완료된 부품"
}
```

### Response Format

**Success Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "item_id": 1,
    "item_code": "ITEM001",
    "item_name": "부품A",
    "category": "원자재",
    "unit": "EA",
    "coating_status": "after_coating",
    "item_type": "RAW",
    "material_type": "COIL",
    "vehicle_model": "소나타",
    "material": "철강",
    "spec": "SPEC-001",
    "thickness": 1.5,
    "width": 100,
    "height": 200,
    "specific_gravity": 7.85,
    "mm_weight": 0.2355,
    "daily_requirement": 500,
    "blank_size": 150,
    "price": 2000,
    "safety_stock": 100,
    "current_stock": 500,
    "location": "A-01",
    "description": "도장 완료된 부품",
    "is_active": true,
    "created_at": "2025-01-19T00:00:00.000Z",
    "updated_at": "2025-01-19T11:00:00.000Z"
  },
  "message": "품목 정보가 수정되었습니다."
}
```

### Validation Rules

**Partial Updates**: Only provided fields will be updated. Missing fields are ignored.

**coating_status Validation**: If provided, must be one of the valid enum values.

**item_code Uniqueness**: If updating item_code, it must not conflict with existing items.

### Error Responses

**400 Bad Request** - Missing item_id:

```json
{
  "success": false,
  "error": "품목 ID가 필요합니다."
}
```

**400 Bad Request** - No fields to update:

```json
{
  "success": false,
  "error": "수정할 값이 없습니다."
}
```

**400 Bad Request** - Invalid coating_status:

```json
{
  "success": false,
  "error": "품목 수정 중 오류가 발생했습니다.",
  "details": "Invalid coating_status. Must be one of: no_coating, before_coating, after_coating"
}
```

**404 Not Found** - Item not found:

```json
{
  "success": false,
  "error": "수정 대상 품목을 찾을 수 없습니다."
}
```

**409 Conflict** - Duplicate item_code:

```json
{
  "success": false,
  "error": "이미 사용 중인 품목 코드입니다.",
  "details": {
    "item_code": "ITEM999"
  }
}
```

---

## Error Codes

### HTTP Status Codes

| Status Code | Description | Common Scenarios |
|-------------|-------------|------------------|
| 200 | Success | Successful GET, POST, PUT, DELETE operations |
| 400 | Bad Request | Invalid parameters, missing required fields, invalid enum values |
| 404 | Not Found | Item not found for update/delete |
| 409 | Conflict | Duplicate item_code |
| 422 | Unprocessable Entity | Zod validation failure |
| 500 | Internal Server Error | Database connection error, unexpected errors |

### Error Messages (Korean)

| Error Code | Korean Message | English Equivalent |
|------------|---------------|-------------------|
| REQUIRED_FIELD | "필수 입력값을 확인해주세요." | "Please check required input values." |
| DUPLICATE_CODE | "이미 사용 중인 품목 코드입니다." | "Item code already in use." |
| ITEM_NOT_FOUND | "수정 대상 품목을 찾을 수 없습니다." | "Cannot find target item." |
| NO_UPDATE_FIELDS | "수정할 값이 없습니다." | "No values to update." |
| INVALID_ENUM | "Invalid coating_status value." | "Invalid coating_status value." |
| QUERY_FAILED | "품목 정보를 조회하지 못했습니다." | "Failed to retrieve item information." |
| CREATE_FAILED | "품목을 등록하지 못했습니다." | "Failed to register item." |
| UPDATE_FAILED | "품목 정보를 수정하지 못했습니다." | "Failed to update item information." |

---

## cURL Examples

### Example 1: Filter items by coating_status = 'no_coating'

```bash
curl -X GET "http://localhost:5000/api/items?coating_status=no_coating&limit=10" \
  -H "Content-Type: application/json"
```

### Example 2: Filter items by coating_status = 'before_coating' with search

```bash
curl -X GET "http://localhost:5000/api/items?coating_status=before_coating&search=%EB%B6%80%ED%92%88A&page=1&limit=20" \
  -H "Content-Type: application/json"
```

*Note: `%EB%B6%80%ED%92%88A` is URL-encoded "부품A"*

### Example 3: Filter items by coating_status = 'after_coating' with cursor pagination

```bash
curl -X GET "http://localhost:5000/api/items?coating_status=after_coating&use_cursor=true&limit=20" \
  -H "Content-Type: application/json"
```

### Example 4: Create item with coating_status = 'before_coating'

```bash
curl -X POST "http://localhost:5000/api/items" \
  -H "Content-Type: application/json" \
  -d '{
    "item_code": "COAT001",
    "item_name": "도장 전 부품",
    "category": "원자재",
    "unit": "EA",
    "coating_status": "before_coating",
    "item_type": "RAW",
    "material_type": "SHEET",
    "vehicle_model": "소나타",
    "material": "철강",
    "spec": "SPEC-COAT-001",
    "thickness": 1.8,
    "width": 120,
    "height": 220,
    "specific_gravity": 7.85,
    "daily_requirement": 400,
    "blank_size": 180,
    "price": 1200,
    "safety_stock": 80,
    "current_stock": 300,
    "location": "C-03",
    "description": "도장 전 상태의 원자재"
  }'
```

### Example 5: Create item with coating_status = 'no_coating'

```bash
curl -X POST "http://localhost:5000/api/items" \
  -H "Content-Type: application/json" \
  -d '{
    "item_code": "NOCOAT001",
    "item_name": "도장 없음 부품",
    "category": "원자재",
    "unit": "EA",
    "coating_status": "no_coating",
    "item_type": "RAW",
    "material_type": "COIL",
    "price": 800,
    "safety_stock": 100,
    "current_stock": 500,
    "description": "도장이 필요없는 부품"
  }'
```

### Example 6: Update coating_status to 'after_coating'

```bash
curl -X PUT "http://localhost:5000/api/items" \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 1,
    "coating_status": "after_coating"
  }'
```

### Example 7: Update coating_status with price change

```bash
curl -X PUT "http://localhost:5000/api/items" \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 1,
    "coating_status": "after_coating",
    "price": 2500,
    "description": "도장 완료 - 가격 인상"
  }'
```

### Example 8: Invalid coating_status (error scenario)

```bash
curl -X POST "http://localhost:5000/api/items" \
  -H "Content-Type: application/json" \
  -d '{
    "item_code": "ERROR001",
    "item_name": "에러 테스트",
    "category": "원자재",
    "unit": "EA",
    "coating_status": "invalid_status"
  }'
```

**Expected Response**:
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "coating_status": "Invalid enum value. Expected 'no_coating' | 'before_coating' | 'after_coating', received 'invalid_status'"
  }
}
```

---

## Integration Notes

### Zod Validation Schema

The coating_status field is validated using Zod schema defined in `src/lib/validation.ts`:

```typescript
coating_status: z.enum(['no_coating', 'before_coating', 'after_coating']).optional()
```

### Database Schema

The coating_status field is stored in the `items` table:

```sql
ALTER TABLE items
ADD COLUMN coating_status VARCHAR(20)
CHECK (coating_status IN ('no_coating', 'before_coating', 'after_coating'));
```

### Frontend Integration

**Filter Component Example**:

```typescript
const coatingStatusOptions = [
  { value: 'no_coating', label: '도장 없음' },
  { value: 'before_coating', label: '도장 전' },
  { value: 'after_coating', label: '도장 후' }
];

// API call with coating_status filter
const fetchItems = async (coatingStatus: string) => {
  const response = await fetch(`/api/items?coating_status=${coatingStatus}`);
  const data = await response.json();
  return data;
};
```

---

## Changelog

### Version 1.0.0 (2025-01-19)

**Added**:
- coating_status field support in GET /api/items with filtering
- coating_status field support in POST /api/items for creation
- coating_status field support in PUT /api/items for updates
- Zod validation schema for coating_status enum
- Database migration for coating_status column
- Comprehensive error messages in Korean and English
- Full cURL example collection

**Validation Rules**:
- coating_status is optional on create (defaults to null)
- coating_status must be one of: `no_coating`, `before_coating`, `after_coating`
- Invalid values are rejected with 400/422 status codes
- Partial updates supported for coating_status changes

---

## Support

**Documentation Owner**: Documentation Expert
**Created**: 2025-01-19
**API Version**: v1.0.0

For questions or issues, please refer to the main project documentation or contact the development team.
