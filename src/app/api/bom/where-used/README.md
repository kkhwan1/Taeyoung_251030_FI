# BOM Where-Used API Documentation

## Overview

This directory contains two where-used APIs with different capabilities:

1. **Query String API** (`route.ts`) - Simple parent lookup with cost calculations
2. **Dynamic Route API** (`[child_item_id]/route.ts`) - **Recursive multi-level ancestor tracking**

## API Endpoints

### 1. Simple Where-Used (Query String)
**Endpoint**: `GET /api/bom/where-used?child_item_id=123`

**Features**:
- Direct parent lookup only (single level)
- Cost calculations included
- Grouping by parent item

**Response**:
```json
{
  "success": true,
  "data": {
    "child_item": {
      "item_id": 123,
      "item_code": "PART-001",
      "item_name": "베어링"
    },
    "parent_items": [
      {
        "parent_item_id": 456,
        "parent_item_code": "ASSY-001",
        "parent_item_name": "모터 조립품",
        "usage_details": [
          {
            "bom_id": 789,
            "required_quantity": 2.0,
            "unit": "EA",
            "material_cost": 5000,
            "net_cost": 4800
          }
        ]
      }
    ],
    "summary": {
      "used_in_count": 3,
      "total_usage_count": 5,
      "total_material_cost": 15000
    }
  }
}
```

### 2. Recursive Where-Used (Dynamic Route) ⭐ NEW!
**Endpoint**: `GET /api/bom/where-used/123`

**Features**:
- ✅ **Recursive upward traversal** - Finds ALL ancestors (parents, grandparents, etc.)
- ✅ **Multi-level hierarchy** - Shows full usage path from top-level to child
- ✅ **Circular reference detection** - Prevents infinite loops
- ✅ **Cumulative quantity tracking** - Calculates total quantity needed at each level
- ✅ **Usage path display** - Shows complete ancestry chain

**Response**:
```json
{
  "success": true,
  "data": {
    "child_item": {
      "item_id": 123,
      "item_code": "PART-001",
      "item_name": "베어링",
      "item_type": "purchased",
      "spec": "6205-2RS",
      "unit": "EA"
    },
    "where_used": [
      {
        "parent_item_id": 456,
        "parent_item_name": "모터 조립품",
        "parent_item_code": "ASSY-001",
        "parent_item_type": "assembly",
        "quantity_required": 2.0,
        "unit": "EA",
        "level_no": 1,
        "usage_path": "모터 조립품 > 베어링",
        "bom_id": 789
      },
      {
        "parent_item_id": 789,
        "parent_item_name": "펌프 시스템",
        "parent_item_code": "PUMP-001",
        "parent_item_type": "assembly",
        "quantity_required": 6.0,
        "unit": "EA",
        "level_no": 2,
        "usage_path": "펌프 시스템 > 모터 조립품 > 베어링",
        "bom_id": 1012
      },
      {
        "parent_item_id": 1023,
        "parent_item_name": "완제품 A",
        "parent_item_code": "FG-A001",
        "parent_item_type": "finished_good",
        "quantity_required": 12.0,
        "unit": "EA",
        "level_no": 3,
        "usage_path": "완제품 A > 펌프 시스템 > 모터 조립품 > 베어링",
        "bom_id": 1345
      }
    ],
    "summary": {
      "direct_parents": 2,
      "total_ancestors": 5,
      "max_level": 3
    }
  }
}
```

**Empty Result** (item not used anywhere):
```json
{
  "success": true,
  "data": {
    "child_item": {
      "item_id": 999,
      "item_code": "PART-999",
      "item_name": "미사용 부품"
    },
    "where_used": [],
    "summary": {
      "direct_parents": 0,
      "total_ancestors": 0,
      "max_level": 0,
      "message": "이 품목은 현재 어떤 상위 품목에도 사용되지 않습니다."
    }
  }
}
```

## Algorithm Details

### Recursive Upward Traversal Algorithm

```typescript
async function findAncestors(
  currentItemId: number,
  currentLevel: number,
  pathPrefix: string,
  quantityMultiplier: number
) {
  // 1. Prevent circular references
  if (visitedItems.has(currentItemId)) {
    console.warn('Circular reference detected');
    return;
  }
  visitedItems.add(currentItemId);

  // 2. Query v_bom_details for direct parents
  const parents = await supabase
    .from('v_bom_details')
    .select('*')
    .eq('child_item_id', currentItemId)
    .eq('is_active', true);

  // 3. Process each parent
  for (const parent of parents) {
    // Calculate cumulative quantity
    const cumulativeQuantity = quantityMultiplier * parent.required_quantity;

    // Build usage path
    const usagePath = parent.parent_item_name + ' > ' + pathPrefix;

    // Store result
    whereUsedItems.push({
      parent_item_id: parent.parent_item_id,
      parent_item_name: parent.parent_item_name,
      quantity_required: cumulativeQuantity,
      level_no: currentLevel,
      usage_path: usagePath
    });

    // 4. Recursive call for grandparents
    await findAncestors(
      parent.parent_item_id,
      currentLevel + 1,
      usagePath,
      cumulativeQuantity
    );
  }

  // 5. Allow alternative paths by removing from visited
  visitedItems.delete(currentItemId);
}
```

### Key Features

**1. Circular Reference Detection**
- Uses `visitedItems` Set to track current recursion path
- Warns when circular reference detected
- Removes from Set after processing to allow alternative paths

**2. Cumulative Quantity Calculation**
- Multiplies quantity at each level
- Example: If 베어링 needs 2 per 모터, and 모터 needs 3 per 펌프
  - Level 1: 2 베어링
  - Level 2: 2 × 3 = 6 베어링

**3. Usage Path Building**
- Builds reverse path from top-level to child
- Example: "완제품 A > 펌프 시스템 > 모터 조립품 > 베어링"
- Shows complete ancestry chain

**4. Level Tracking**
- Level 1 = Direct parent
- Level 2 = Grandparent
- Level 3+ = Great-grandparent and beyond

## Use Cases

### Simple Where-Used API
- Quick parent lookup
- Cost analysis
- Simple relationship queries
- Dashboard widgets

### Recursive Where-Used API
- **Impact Analysis**: "If I change this part, what products are affected?"
- **Material Planning**: "How many of this component do I need for top-level production?"
- **Engineering Changes**: "Which assemblies need to be updated?"
- **Cost Rollup**: "What's the total cost impact across all levels?"
- **Dependency Tracking**: "Show me the complete product hierarchy"

## Error Handling

**400 Bad Request**:
```json
{
  "success": false,
  "error": "유효하지 않은 품목 ID입니다."
}
```

**404 Not Found**:
```json
{
  "success": false,
  "error": "품목을 찾을 수 없습니다."
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "error": "Where-used 조회에 실패했습니다."
}
```

## Performance Considerations

### Simple API
- Single database query
- Fast response (~50-100ms)
- Good for real-time updates

### Recursive API
- Multiple database queries (one per level)
- Response time varies with BOM depth
- Estimated: ~100ms per level
- Example: 4-level BOM = ~400ms

### Optimization Strategies
1. **Caching**: Cache results for frequently accessed items
2. **Max Level Limit**: Set reasonable recursion depth limit
3. **Batch Processing**: Use for offline analysis, not real-time
4. **Database Views**: `v_bom_details` already optimized with indexes

## Database Dependencies

Both APIs rely on:
- **Table**: `bom` - BOM relationships
- **Table**: `items` - Item master data
- **View**: `v_bom_details` - Optimized BOM view with joined item data

## Integration Examples

### Frontend Integration
```typescript
// Simple lookup
const response = await fetch('/api/bom/where-used?child_item_id=123');

// Recursive lookup
const response = await fetch('/api/bom/where-used/123');

const { data } = await response.json();
console.log(`Used in ${data.summary.total_ancestors} parent items`);
console.log(`Max levels: ${data.summary.max_level}`);
```

### CLI Testing
```bash
# Simple API
curl "http://localhost:5000/api/bom/where-used?child_item_id=123"

# Recursive API
curl "http://localhost:5000/api/bom/where-used/123"
```

## Future Enhancements

- [ ] Add caching layer for frequently accessed items
- [ ] Implement GraphQL endpoint for flexible queries
- [ ] Add cost rollup across all levels
- [ ] Export to Excel with hierarchy visualization
- [ ] Real-time notifications when parent BOMs change
- [ ] Batch where-used lookup for multiple items
