# Inventory Management APIs

This document describes the comprehensive inventory management API endpoints for the ERP system.

## Overview

The inventory management system consists of three main API routes:

1. **Receiving API** - Handle material purchases (`입고` transactions)
2. **Production API** - Handle production with BOM deduction (`생산입고`/`생산출고` transactions)
3. **Shipping API** - Handle product shipments (`출고` transactions)

## Database Schema

### Inventory Transactions Table
```sql
inventory_transactions:
- id: Auto-increment primary key
- transaction_date: Date of transaction
- transaction_type: '입고' | '출고' | '생산입고' | '생산출고' | '이동' | '조정' | '폐기'
- item_id: Foreign key to items table
- quantity: Decimal(15,3) - quantity of items
- unit_price: Decimal(15,2) - price per unit
- total_amount: Decimal(15,2) - calculated total (quantity × unit_price)
- from_location: Source location (nullable)
- to_location: Destination location (nullable)
- company_id: Foreign key to companies table (nullable)
- reference_no: Reference number for grouping transactions (nullable)
- lot_no: Lot number for tracking (nullable)
- expiry_date: Expiration date (nullable)
- notes: Additional notes (nullable)
- created_by: Foreign key to users table
- created_at: Timestamp
- updated_at: Timestamp
```

## API Endpoints

### 1. Receiving API (`/api/inventory/receiving`)

Handle material purchases and incoming inventory.

#### GET - List Receiving History
```http
GET /api/inventory/receiving?start_date=2024-01-01&end_date=2024-12-31&limit=100&offset=0
```

**Query Parameters:**
- `start_date` (optional): Filter by start date (YYYY-MM-DD)
- `end_date` (optional): Filter by end date (YYYY-MM-DD)
- `item_id` (optional): Filter by specific item
- `company_id` (optional): Filter by specific supplier
- `reference_no` (optional): Filter by reference number
- `limit` (optional): Number of records (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 1,
        "transaction_date": "2024-01-15",
        "transaction_type": "입고",
        "item_id": 1,
        "quantity": 100,
        "unit_price": 15000,
        "total_amount": 1500000,
        "company_id": 1,
        "reference_no": "PO-2024-001",
        "item_code": "MAT-001",
        "item_name": "스틸 플레이트",
        "company_name": "동일철강"
      }
    ],
    "pagination": {
      "total": 50,
      "limit": 100,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

#### POST - Create Receiving Transaction
```http
POST /api/inventory/receiving
Content-Type: application/json

{
  "transaction_date": "2024-01-15",
  "item_id": 1,
  "quantity": 100,
  "unit_price": 15000,
  "company_id": 1,
  "reference_no": "PO-2024-001",
  "lot_no": "LOT-001",
  "to_location": "창고A",
  "notes": "정기 발주",
  "created_by": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Receiving transaction created successfully",
  "data": {
    "id": 1,
    "transaction_date": "2024-01-15",
    "transaction_type": "입고",
    "item_id": 1,
    "quantity": 100,
    "unit_price": 15000,
    "total_amount": 1500000,
    "item_code": "MAT-001",
    "item_name": "스틸 플레이트"
  }
}
```

#### PUT - Update Receiving Transaction
```http
PUT /api/inventory/receiving
Content-Type: application/json

{
  "id": 1,
  "quantity": 120,
  "unit_price": 14500,
  "notes": "수량 변경"
}
```

#### DELETE - Delete Receiving Transaction
```http
DELETE /api/inventory/receiving?id=1
```

### 2. Production API (`/api/inventory/production`)

Handle production transactions with automatic BOM deduction.

#### GET - List Production History
```http
GET /api/inventory/production?start_date=2024-01-01&transaction_type=생산입고
```

**Query Parameters:**
- `start_date` (optional): Filter by start date
- `end_date` (optional): Filter by end date
- `item_id` (optional): Filter by specific item
- `reference_no` (optional): Filter by reference number
- `transaction_type` (optional): '생산입고' or '생산출고'
- `limit` (optional): Number of records (default: 100)
- `offset` (optional): Pagination offset (default: 0)

#### POST - Create Production Transaction
```http
POST /api/inventory/production
Content-Type: application/json

{
  "transaction_date": "2024-01-15",
  "product_item_id": 6,
  "quantity": 10,
  "reference_no": "PRD-2024-001",
  "notes": "정규 생산",
  "created_by": 1,
  "use_bom": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Production transaction created successfully",
  "data": {
    "reference_no": "PRD-2024-001",
    "transactions": [
      {
        "id": 10,
        "transaction_type": "생산입고",
        "item_id": 6,
        "quantity": 10,
        "item_name": "A형 브라켓"
      },
      {
        "id": 11,
        "transaction_type": "생산출고",
        "item_id": 1,
        "quantity": 20,
        "item_name": "스틸 플레이트"
      }
    ],
    "summary": {
      "product_produced": {
        "item_id": 6,
        "item_name": "A형 브라켓",
        "quantity": 10
      },
      "materials_consumed": 3,
      "total_transactions": 4
    }
  }
}
```

#### GET - BOM Availability Check
```http
GET /api/inventory/production/bom-check?product_item_id=6&quantity=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "item_id": 6,
      "item_code": "PRD-001",
      "name": "A형 브라켓",
      "quantity_to_produce": 10
    },
    "can_produce": true,
    "material_requirements": [
      {
        "item_id": 1,
        "item_code": "MAT-001",
        "item_name": "스틸 플레이트",
        "bom_quantity": 2,
        "scrap_rate": 2.0,
        "required_quantity": 20.4,
        "current_stock": 100,
        "sufficient": true,
        "shortage": 0
      }
    ],
    "summary": {
      "total_materials": 3,
      "sufficient_materials": 3,
      "insufficient_materials": 0,
      "total_material_cost": 15300
    }
  }
}
```

### 3. Shipping API (`/api/inventory/shipping`)

Handle product shipments with stock validation.

#### GET - List Shipping History
```http
GET /api/inventory/shipping?start_date=2024-01-01&company_id=1
```

#### POST - Create Shipping Transaction
```http
POST /api/inventory/shipping
Content-Type: application/json

{
  "transaction_date": "2024-01-15",
  "items": [
    {
      "item_id": 6,
      "quantity": 5,
      "unit_price": 45000
    },
    {
      "item_id": 7,
      "quantity": 3,
      "unit_price": 38000
    }
  ],
  "company_id": 1,
  "reference_no": "SHIP-2024-001",
  "from_location": "완제품창고",
  "notes": "정기 출하",
  "created_by": 1,
  "validate_stock": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shipping transaction created successfully",
  "data": {
    "reference_no": "SHIP-2024-001",
    "transactions": [
      {
        "id": 20,
        "transaction_type": "출고",
        "item_id": 6,
        "quantity": 5,
        "unit_price": 45000,
        "total_amount": 225000,
        "item_name": "A형 브라켓"
      }
    ],
    "summary": {
      "total_items": 2,
      "total_quantity": 8,
      "total_amount": 339000,
      "customer": "현대자동차"
    }
  }
}
```

#### GET - Stock Availability Check
```http
GET /api/inventory/shipping/stock-check?items=[{"item_id":6,"quantity":5},{"item_id":7,"quantity":3}]
```

**Response:**
```json
{
  "success": true,
  "data": {
    "can_ship_all": true,
    "stock_check_results": [
      {
        "index": 0,
        "item_id": 6,
        "item_code": "PRD-001",
        "item_name": "A형 브라켓",
        "requested_quantity": 5,
        "current_stock": 10,
        "sufficient": true,
        "shortage": 0,
        "availability_percentage": 100,
        "total_value": 225000
      }
    ],
    "summary": {
      "total_items_requested": 2,
      "sufficient_items": 2,
      "insufficient_items": 0,
      "total_order_value": 339000,
      "fulfillment_rate": 100
    }
  }
}
```

## Features

### 1. Receiving API Features
- ✅ Create, read, update, delete receiving transactions
- ✅ Pagination and filtering
- ✅ Company and item validation
- ✅ Automatic total amount calculation
- ✅ Lot number and expiry date tracking

### 2. Production API Features
- ✅ Automatic BOM material deduction
- ✅ Stock availability validation before production
- ✅ Multi-level BOM support with scrap rate calculation
- ✅ Production and material consumption tracking
- ✅ BOM availability check endpoint
- ✅ Atomic transactions for data consistency

### 3. Shipping API Features
- ✅ Multi-item shipment support
- ✅ Stock validation before shipment
- ✅ Customer order tracking
- ✅ Stock availability check endpoint
- ✅ Comprehensive error handling

## Error Handling

All APIs provide comprehensive error handling with appropriate HTTP status codes:

- `400 Bad Request` - Invalid input data
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server errors

Example error response:
```json
{
  "success": false,
  "error": "Insufficient stock for items: A형 브라켓 (requested: 10, available: 5)"
}
```

## Data Validation

### Stock Validation
- Receiving: No stock validation required (adding inventory)
- Production: Validates material availability using BOM
- Shipping: Validates product availability before shipment

### Business Rules
- All quantities must be positive numbers
- Unit prices cannot be negative
- Items and companies must exist and be active
- Transaction dates must be valid dates
- BOM relationships prevent circular references

## Integration Points

### Current Stock View
All APIs integrate with the `current_stock` view which automatically calculates current inventory levels based on all transaction types.

### BOM Integration
Production API integrates with the `boms` table to automatically calculate material requirements including scrap rates.

### Audit Trail
All transactions include:
- Created by user ID
- Creation timestamp
- Update timestamp
- Reference numbers for traceability

## Performance Considerations

### Database Transactions
- All multi-record operations use database transactions for consistency
- BOM deduction and production recording are atomic operations
- Stock validation happens within transactions to prevent race conditions

### Optimization Features
- Pagination for large datasets
- Index optimization on frequently queried fields
- Efficient stock calculation using database views
- Batch operations for multi-item transactions

## Usage Examples

### Typical Workflows

1. **Material Receiving**
   ```
   POST /api/inventory/receiving
   → Creates 입고 transaction
   → Updates current stock automatically
   ```

2. **Production Process**
   ```
   GET /api/inventory/production/bom-check → Validate materials
   POST /api/inventory/production → Create production + material consumption
   → Creates 생산입고 for product
   → Creates 생산출고 for each material (BOM-based)
   ```

3. **Product Shipping**
   ```
   GET /api/inventory/shipping/stock-check → Validate stock
   POST /api/inventory/shipping → Create shipment
   → Creates 출고 transactions
   → Updates current stock automatically
   ```

This comprehensive API system provides full inventory lifecycle management with robust validation, error handling, and integration capabilities.