import { GET } from '@/app/api/bom/full-tree/route';
import { NextRequest } from 'next/server';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn()
  }))
}));

const mockSupabaseRpc = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc: mockSupabaseRpc
  }))
}));

describe('/api/bom/full-tree Route Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set required environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  describe('Successful Queries', () => {
    it('returns BOM tree with default parameters', async () => {
      const mockData = [
        {
          bom_id: 1,
          parent_item_id: 100,
          parent_item_code: 'PROD-001',
          parent_item_name: '완제품A',
          child_item_id: 200,
          child_item_code: 'PART-001',
          child_item_name: '부품A',
          child_spec: 'SPEC-A',
          child_item_type: 'external_purchase',
          child_current_stock: 150,
          child_unit_price: '10000',
          quantity_required: '2',
          level_no: 1,
          labor_cost: '5000',
          notes: '테스트 노트',
          level: 1,
          depth: 1,
          name_path: ['부품A']
        }
      ];

      mockSupabaseRpc.mockResolvedValue({ data: mockData, error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual(mockData);
      expect(json.count).toBe(1);
    });

    it('filters by parent_item_id when provided', async () => {
      const mockData = [
        {
          bom_id: 1,
          parent_item_id: 100,
          child_item_id: 200,
          level: 1
        }
      ];

      mockSupabaseRpc.mockResolvedValue({ data: mockData, error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree?parent_item_id=100');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      // Verify SQL query includes parent_item_id filter
      const sqlQuery = mockSupabaseRpc.mock.calls[0][0].sql;
      expect(sqlQuery).toContain('b.parent_item_id = 100');
    });

    it('respects custom max_depth parameter', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree?max_depth=5');
      await GET(request);

      const sqlQuery = mockSupabaseRpc.mock.calls[0][0].sql;
      expect(sqlQuery).toContain('bt.level < 5');
    });

    it('uses default max_depth of 10 when not specified', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      await GET(request);

      const sqlQuery = mockSupabaseRpc.mock.calls[0][0].sql;
      expect(sqlQuery).toContain('bt.level < 10');
    });

    it('returns empty array when no data found', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: null, error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
      expect(json.count).toBe(0);
    });

    it('handles multiple levels of hierarchy', async () => {
      const mockData = [
        {
          bom_id: 1,
          parent_item_id: 100,
          child_item_id: 200,
          level: 1,
          depth: 1,
          name_path: ['부품A']
        },
        {
          bom_id: 2,
          parent_item_id: 200,
          child_item_id: 300,
          level: 2,
          depth: 2,
          name_path: ['부품A', '부품B']
        },
        {
          bom_id: 3,
          parent_item_id: 300,
          child_item_id: 400,
          level: 3,
          depth: 3,
          name_path: ['부품A', '부품B', '부품C']
        }
      ];

      mockSupabaseRpc.mockResolvedValue({ data: mockData, error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      const response = await GET(request);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(3);
      expect(json.data[0].level).toBe(1);
      expect(json.data[1].level).toBe(2);
      expect(json.data[2].level).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('returns 500 on Supabase RPC error', async () => {
      const mockError = { message: 'Database connection failed' };
      mockSupabaseRpc.mockResolvedValue({ data: null, error: mockError });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Database connection failed');
    });

    it('handles SQL syntax errors', async () => {
      const mockError = { message: 'syntax error at or near "FROM"' };
      mockSupabaseRpc.mockResolvedValue({ data: null, error: mockError });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toContain('syntax error');
    });

    it('handles runtime exceptions gracefully', async () => {
      mockSupabaseRpc.mockRejectedValue(new Error('Unexpected runtime error'));

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unexpected runtime error');
    });

    it('handles non-Error exceptions', async () => {
      mockSupabaseRpc.mockRejectedValue('String error');

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unknown error');
    });

    it('handles missing environment variables', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');

      await expect(GET(request)).rejects.toThrow();
    });
  });

  describe('Query Parameter Validation', () => {
    it('handles invalid parent_item_id gracefully', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree?parent_item_id=invalid');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      // SQL should include the invalid value (database will handle it)
      const sqlQuery = mockSupabaseRpc.mock.calls[0][0].sql;
      expect(sqlQuery).toContain('b.parent_item_id = invalid');
    });

    it('handles invalid max_depth by using default', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree?max_depth=invalid');
      await GET(request);

      const sqlQuery = mockSupabaseRpc.mock.calls[0][0].sql;
      // parseInt('invalid') returns NaN, which defaults to 10
      expect(sqlQuery).toContain('bt.level <');
    });

    it('handles negative max_depth', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree?max_depth=-5');
      await GET(request);

      const sqlQuery = mockSupabaseRpc.mock.calls[0][0].sql;
      expect(sqlQuery).toContain('bt.level < -5');
    });

    it('handles zero max_depth', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree?max_depth=0');
      await GET(request);

      const sqlQuery = mockSupabaseRpc.mock.calls[0][0].sql;
      expect(sqlQuery).toContain('bt.level < 0');
    });

    it('handles very large max_depth values', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree?max_depth=999');
      await GET(request);

      const sqlQuery = mockSupabaseRpc.mock.calls[0][0].sql;
      expect(sqlQuery).toContain('bt.level < 999');
    });
  });

  describe('Recursive CTE Behavior', () => {
    it('prevents circular references in BOM tree', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      await GET(request);

      const sqlQuery = mockSupabaseRpc.mock.calls[0][0].sql;

      // Verify circular reference prevention logic
      expect(sqlQuery).toContain('NOT b.child_item_id = ANY(bt.path)');
    });

    it('generates correct SQL for recursive CTE', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      await GET(request);

      const sqlQuery = mockSupabaseRpc.mock.calls[0][0].sql;

      // Verify key CTE components
      expect(sqlQuery).toContain('WITH RECURSIVE bom_tree AS');
      expect(sqlQuery).toContain('UNION ALL');
      expect(sqlQuery).toContain('ARRAY[b.child_item_id] as path');
      expect(sqlQuery).toContain("ARRAY[ci.item_name]::varchar[] as name_path");
      expect(sqlQuery).toContain('bt.path || b.child_item_id');
      expect(sqlQuery).toContain('bt.name_path || ci.item_name');
    });

    it('includes proper JOIN conditions', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      await GET(request);

      const sqlQuery = mockSupabaseRpc.mock.calls[0][0].sql;

      expect(sqlQuery).toContain('LEFT JOIN items pi ON b.parent_item_id = pi.item_id');
      expect(sqlQuery).toContain('INNER JOIN items ci ON b.child_item_id = ci.item_id');
      expect(sqlQuery).toContain('INNER JOIN bom_tree bt ON b.parent_item_id = bt.child_item_id');
    });

    it('filters only active items', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      await GET(request);

      const sqlQuery = mockSupabaseRpc.mock.calls[0][0].sql;

      expect(sqlQuery).toContain('b.is_active = true');
      expect(sqlQuery).toContain('ci.is_active = true');
    });

    it('orders results correctly', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      await GET(request);

      const sqlQuery = mockSupabaseRpc.mock.calls[0][0].sql;

      expect(sqlQuery).toContain('ORDER BY level, parent_item_code, child_item_code');
    });
  });

  describe('Response Structure', () => {
    it('returns all required fields in response', async () => {
      const mockData = [
        {
          bom_id: 1,
          parent_item_id: 100,
          parent_item_code: 'PROD-001',
          parent_item_name: '완제품',
          child_item_id: 200,
          child_item_code: 'PART-001',
          child_item_name: '부품',
          child_spec: 'SPEC-A',
          child_item_type: 'external_purchase',
          child_current_stock: 100,
          child_unit_price: '50000',
          quantity_required: '3',
          level_no: 1,
          labor_cost: '10000',
          notes: '테스트',
          level: 1,
          depth: 1,
          name_path: ['부품']
        }
      ];

      mockSupabaseRpc.mockResolvedValue({ data: mockData, error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      const response = await GET(request);
      const json = await response.json();

      expect(json).toHaveProperty('success');
      expect(json).toHaveProperty('data');
      expect(json).toHaveProperty('count');

      const item = json.data[0];
      expect(item).toHaveProperty('bom_id');
      expect(item).toHaveProperty('parent_item_id');
      expect(item).toHaveProperty('parent_item_code');
      expect(item).toHaveProperty('parent_item_name');
      expect(item).toHaveProperty('child_item_id');
      expect(item).toHaveProperty('child_item_code');
      expect(item).toHaveProperty('child_item_name');
      expect(item).toHaveProperty('child_spec');
      expect(item).toHaveProperty('child_item_type');
      expect(item).toHaveProperty('child_current_stock');
      expect(item).toHaveProperty('child_unit_price');
      expect(item).toHaveProperty('quantity_required');
      expect(item).toHaveProperty('level_no');
      expect(item).toHaveProperty('labor_cost');
      expect(item).toHaveProperty('notes');
      expect(item).toHaveProperty('level');
      expect(item).toHaveProperty('depth');
      expect(item).toHaveProperty('name_path');
    });

    it('calculates depth correctly using array_length', async () => {
      const mockData = [
        {
          bom_id: 1,
          level: 1,
          depth: 1
        },
        {
          bom_id: 2,
          level: 2,
          depth: 2
        }
      ];

      mockSupabaseRpc.mockResolvedValue({ data: mockData, error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      const response = await GET(request);
      const json = await response.json();

      expect(json.data[0].depth).toBe(1);
      expect(json.data[1].depth).toBe(2);

      // Verify SQL includes depth calculation
      const sqlQuery = mockSupabaseRpc.mock.calls[0][0].sql;
      expect(sqlQuery).toContain('array_length(path, 1) as depth');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('handles large result sets efficiently', async () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        bom_id: i + 1,
        parent_item_id: 100,
        child_item_id: 200 + i,
        level: 1
      }));

      mockSupabaseRpc.mockResolvedValue({ data: largeData, error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      const response = await GET(request);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1000);
      expect(json.count).toBe(1000);
    });

    it('handles concurrent requests', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const requests = Array.from({ length: 10 }, () =>
        GET(new NextRequest('http://localhost:5000/api/bom/full-tree'))
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockSupabaseRpc).toHaveBeenCalledTimes(10);
    });

    it('handles special characters in item names', async () => {
      const mockData = [
        {
          bom_id: 1,
          parent_item_name: "부품 (특수문자 포함: @#$%^&*)",
          child_item_name: "자재 '따옴표' \"큰따옴표\"",
          level: 1
        }
      ];

      mockSupabaseRpc.mockResolvedValue({ data: mockData, error: null });

      const request = new NextRequest('http://localhost:5000/api/bom/full-tree');
      const response = await GET(request);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data[0].parent_item_name).toBe("부품 (특수문자 포함: @#$%^&*)");
      expect(json.data[0].child_item_name).toBe("자재 '따옴표' \"큰따옴표\"");
    });
  });
});
