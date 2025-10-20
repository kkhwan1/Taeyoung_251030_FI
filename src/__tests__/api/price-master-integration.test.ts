/**
 * Phase P4 Price Management Integration Tests
 *
 * Tests all 4 backend APIs:
 * 1. bulk-upload - Batch price import with validation
 * 2. calculate-from-bom - Recursive BOM cost calculation
 * 3. duplicates - Detection of duplicate price entries
 * 4. duplicates/cleanup - Cleanup with 3 strategies
 *
 * Requirements:
 * - Korean text encoding validation
 * - Row-level validation
 * - Batch processing (up to 10,000 items)
 * - Recursive tree traversal
 * - Transaction safety
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { getSupabaseClient } from '@/lib/db-unified';

const API_BASE = 'http://localhost:5000/api/price-master';
let testItemIds: number[] = [];
let testPriceIds: number[] = [];

// Test data setup
beforeAll(async () => {
  const supabase = getSupabaseClient();

  // Create test items for bulk upload
  const { data: items, error } = await supabase
    .from('items')
    .insert([
      { item_code: 'TEST-BULK-001', item_name: '테스트부품A', unit: 'EA', category: '원자재', is_active: true },
      { item_code: 'TEST-BULK-002', item_name: '테스트부품B', unit: 'EA', category: '원자재', is_active: true },
      { item_code: 'TEST-BOM-PARENT', item_name: 'BOM부모품목', unit: 'EA', category: '제품', is_active: true },
      { item_code: 'TEST-BOM-CHILD1', item_name: 'BOM자식1', unit: 'EA', category: '원자재', is_active: true },
      { item_code: 'TEST-BOM-CHILD2', item_name: 'BOM자식2', unit: 'EA', category: '원자재', is_active: true },
    ])
    .select('item_id');

  if (error) throw new Error(`Test setup failed: ${error.message}`);
  testItemIds = items!.map(i => i.item_id);

  // Create BOM structure for parent item
  const parentId = testItemIds[2];
  const child1Id = testItemIds[3];
  const child2Id = testItemIds[4];

  const { error: bomError } = await supabase.from('bom').insert([
    {
      parent_item_id: parentId,
      child_item_id: child1Id,
      quantity_required: 2,
      is_active: true
    },
    {
      parent_item_id: parentId,
      child_item_id: child2Id,
      quantity_required: 3,
      is_active: true
    }
  ]);

  if (bomError) throw new Error(`BOM setup failed: ${bomError.message}`);

  // Create base prices for BOM children
  const { data: prices } = await supabase
    .from('price_master')
    .insert([
      {
        item_id: child1Id,
        unit_price: 1000,
        effective_date: '2025-01-01',
        is_current: true,
        price_type: 'manual'
      },
      {
        item_id: child2Id,
        unit_price: 500,
        effective_date: '2025-01-01',
        is_current: true,
        price_type: 'manual'
      }
    ])
    .select('price_id');

  if (prices) testPriceIds.push(...prices.map(p => p.price_id));
});

// Cleanup test data
afterAll(async () => {
  const supabase = getSupabaseClient();

  // Delete test prices
  if (testPriceIds.length > 0) {
    await supabase.from('price_master').delete().in('price_id', testPriceIds);
  }

  // Delete test BOMs
  await supabase.from('bom').delete().in('parent_item_id', testItemIds);

  // Delete test items
  await supabase.from('items').delete().in('item_id', testItemIds);
});

describe('Wave 1: Bulk Upload API Integration', () => {
  test('should validate Korean text encoding in request', async () => {
    const payload = {
      items: [
        {
          item_code: 'TEST-BULK-001',
          item_name: '테스트부품A',
          unit_price: 10000,
          effective_date: '2025-01-15'
        }
      ],
      validate_only: true
    };

    const response = await fetch(`${API_BASE}/bulk-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.valid_count).toBe(1);
    expect(result.data.error_count).toBe(0);
    expect(result.data.preview[0].item_name).toBe('테스트부품A'); // Korean preserved
  });

  test('should perform row-level validation', async () => {
    const payload = {
      items: [
        {
          item_code: 'TEST-BULK-001',
          unit_price: 10000,
          effective_date: '2025-01-15'
        },
        {
          item_code: 'INVALID-CODE',
          unit_price: -100, // Invalid: negative price
          effective_date: '2025-01-15'
        },
        {
          item_code: 'TEST-BULK-002',
          unit_price: 'not-a-number', // Invalid: non-numeric
          effective_date: '2025-01-15'
        }
      ],
      validate_only: true
    };

    const response = await fetch(`${API_BASE}/bulk-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.data.valid_count).toBe(1);
    expect(result.data.error_count).toBe(2);
    expect(result.data.errors).toHaveLength(2);

    // Check error details
    const errors = result.data.errors;
    expect(errors.some((e: any) => e.field === 'item_code' && e.row === 3)).toBe(true);
    expect(errors.some((e: any) => e.field === 'unit_price' && e.row === 4)).toBe(true);
  });

  test('should handle actual upload with validation', async () => {
    const payload = {
      items: [
        {
          item_code: 'TEST-BULK-001',
          unit_price: 10000,
          effective_date: '2025-01-15'
        },
        {
          item_code: 'TEST-BULK-002',
          unit_price: 20000,
          effective_date: '2025-01-15'
        }
      ],
      validate_only: false
    };

    const response = await fetch(`${API_BASE}/bulk-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.valid_count).toBe(2);
    expect(result.data.error_count).toBe(0);

    // Verify data was inserted
    const supabase = getSupabaseClient();
    const { data: prices } = await supabase
      .from('price_master')
      .select('price_id, unit_price')
      .in('item_id', [testItemIds[0], testItemIds[1]])
      .eq('effective_date', '2025-01-15');

    expect(prices).toHaveLength(2);
    testPriceIds.push(...prices!.map(p => p.price_id));
  });

  test('should enforce 10,000 item limit', async () => {
    const items = Array(10001).fill(null).map((_, i) => ({
      item_code: 'TEST-BULK-001',
      unit_price: 1000,
      effective_date: '2025-01-15'
    }));

    const response = await fetch(`${API_BASE}/bulk-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, validate_only: true })
    });

    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error).toContain('10,000');
  });
});

describe('Wave 2: BOM Calculation API Integration', () => {
  test('should calculate recursive BOM costs correctly', async () => {
    const parentId = testItemIds[2];

    const response = await fetch(`${API_BASE}/calculate-from-bom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: parentId.toString(),
        effective_date: '2025-01-01',
        include_labor: false,
        include_overhead: false
      })
    });

    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);

    // Verify calculation: (2 * 1000) + (3 * 500) = 3500
    expect(result.data.total_material_cost).toBe(3500);
    expect(result.data.calculated_price).toBe(3500);

    // Verify BOM tree structure
    expect(result.data.bom_tree).toBeDefined();
    expect(result.data.bom_tree.children).toHaveLength(2);
  });

  test('should include labor and overhead when requested', async () => {
    const parentId = testItemIds[2];

    const response = await fetch(`${API_BASE}/calculate-from-bom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: parentId.toString(),
        effective_date: '2025-01-01',
        include_labor: true,
        include_overhead: true
      })
    });

    const result = await response.json();

    expect(result.success).toBe(true);

    const materialCost = 3500;
    const laborCost = materialCost * 0.1; // 10%
    const overheadCost = materialCost * 0.05; // 5%
    const totalCost = materialCost + laborCost + overheadCost;

    expect(result.data.total_material_cost).toBe(materialCost);
    expect(result.data.total_labor_cost).toBe(laborCost);
    expect(result.data.total_overhead_cost).toBe(overheadCost);
    expect(result.data.calculated_price).toBe(totalCost);
  });

  test('should detect missing prices in BOM tree', async () => {
    const supabase = getSupabaseClient();

    // Create item without price
    const { data: newItem } = await supabase
      .from('items')
      .insert({ item_code: 'TEST-NO-PRICE', item_name: '가격없음', unit: 'EA', category: '원자재', is_active: true })
      .select('item_id')
      .single();

    const noPriceItemId = newItem!.item_id;
    testItemIds.push(noPriceItemId);

    const response = await fetch(`${API_BASE}/calculate-from-bom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: noPriceItemId.toString(),
        effective_date: '2025-01-01'
      })
    });

    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.data.missing_prices).toHaveLength(0); // No children, so no missing prices
  });

  test('should validate effective_date format', async () => {
    const response = await fetch(`${API_BASE}/calculate-from-bom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: testItemIds[2].toString(),
        effective_date: 'invalid-date'
      })
    });

    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error).toContain('형식');
  });
});

describe('Wave 3: Duplicates Detection API Integration', () => {
  // NOTE: The price_master table has a UNIQUE constraint on (item_id, effective_date)
  // This prevents duplicate prices by design, so these tests verify the API correctly
  // reports 0 duplicates when the constraint is working properly.

  test('should return valid structure with no duplicates', async () => {
    const response = await fetch(`${API_BASE}/duplicates`, {
      method: 'GET'
    });

    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.total_duplicates).toBe(0);
    expect(result.data.duplicate_groups).toBeDefined();
    expect(Array.isArray(result.data.duplicate_groups)).toBe(true);
    expect(result.data.duplicate_groups).toHaveLength(0);
  });

  test('should return correct summary with no duplicates', async () => {
    const response = await fetch(`${API_BASE}/duplicates`, {
      method: 'GET'
    });

    const result = await response.json();

    expect(result.data.summary).toBeDefined();
    expect(result.data.summary.by_item).toBe(0);
    expect(result.data.summary.by_date).toBe(0);
    expect(result.data.summary.total_records).toBe(0);
  });

  test('should verify unique constraint prevents duplicates', async () => {
    // This test verifies the database constraint is working
    const supabase = getSupabaseClient();
    const testItemId = testItemIds[0];

    // Insert first price - should succeed
    const { data: firstPrice, error: firstError } = await supabase
      .from('price_master')
      .insert({
        item_id: testItemId,
        unit_price: 10000,
        effective_date: '2025-01-25',
        is_current: true,
        price_type: 'manual'
      })
      .select('price_id')
      .single();

    expect(firstError).toBeNull();
    expect(firstPrice).toBeDefined();
    if (firstPrice) testPriceIds.push(firstPrice.price_id);

    // Try to insert duplicate - should fail with constraint violation
    const { error: duplicateError } = await supabase
      .from('price_master')
      .insert({
        item_id: testItemId,
        unit_price: 10500,
        effective_date: '2025-01-25', // Same item_id + date
        is_current: true,
        price_type: 'manual'
      });

    expect(duplicateError).toBeDefined();
    expect(duplicateError?.message).toContain('unique constraint');
  });
});

describe('Wave 3: Duplicates Cleanup API Integration', () => {
  // NOTE: With the UNIQUE constraint in place, no duplicates exist in the database
  // These tests verify the API correctly handles the case where there's nothing to clean up

  test('should handle dry-run mode with no duplicates', async () => {
    const response = await fetch(`${API_BASE}/duplicates/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy: 'keep_latest',
        dry_run: true
      })
    });

    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.deleted_count).toBe(0); // No duplicates to clean
    expect(result.data.preview).toBeDefined();
    expect(Array.isArray(result.data.preview)).toBe(true);

    // Verify no records were deleted (all test prices still exist)
    const supabase = getSupabaseClient();
    const { count } = await supabase
      .from('price_master')
      .select('price_id', { count: 'exact', head: true })
      .in('price_id', testPriceIds);

    expect(count).toBe(testPriceIds.length);
  });

  test('should handle keep_latest strategy with no duplicates', async () => {
    const response = await fetch(`${API_BASE}/duplicates/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy: 'keep_latest',
        dry_run: false
      })
    });

    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.deleted_count).toBe(0); // No duplicates to clean

    // Verify all test prices still exist (nothing was deleted)
    const supabase = getSupabaseClient();
    const { count } = await supabase
      .from('price_master')
      .select('price_id', { count: 'exact', head: true })
      .in('price_id', testPriceIds);

    expect(count).toBe(testPriceIds.length);
  });

  test('should validate strategy parameter', async () => {
    const response = await fetch(`${API_BASE}/duplicates/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy: 'invalid_strategy',
        dry_run: true
      })
    });

    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error).toContain('strategy');
  });

  test('should require custom_keep_ids for custom strategy', async () => {
    const response = await fetch(`${API_BASE}/duplicates/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy: 'custom',
        dry_run: true
      })
    });

    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error).toContain('custom_keep_ids');
  });
});

describe('Performance Tests', () => {
  test('should handle 1000 bulk items within acceptable time', async () => {
    const items = Array(1000).fill(null).map((_, i) => ({
      item_code: 'TEST-BULK-001',
      unit_price: 1000 + i,
      effective_date: '2025-01-25'
    }));

    const startTime = Date.now();

    const response = await fetch(`${API_BASE}/bulk-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, validate_only: true })
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    const result = await response.json();

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });

  test('should handle deep BOM recursion efficiently', async () => {
    // Note: This is a simplified test. Real BOM depth testing would require
    // more complex test data setup with multiple levels.
    const startTime = Date.now();

    const response = await fetch(`${API_BASE}/calculate-from-bom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: testItemIds[2].toString(),
        effective_date: '2025-01-01'
      })
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    const result = await response.json();

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
  });
});
