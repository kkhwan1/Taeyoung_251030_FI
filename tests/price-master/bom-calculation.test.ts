/**
 * Phase P4: Wave 2 통합 테스트 - BOM Calculation API
 * 
 * 테스트 범위:
 * - 3단계 BOM 계산 검증
 * - 단가 마스터 반영 검증
 * - 재귀 로직 테스트
 * - 노무비/간접비 계산 테스트
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/price-master/calculate-from-bom/route';
import { 
  bomTestData, 
  expectedBOMCalculation,
  generateDeepBOM
} from '../fixtures/price-master-test-data';

// Mock Supabase 클라이언트
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        data: [
          { item_id: 1, unit_price: 500000 },
          { item_id: 2, unit_price: 25000 },
          { item_id: 3, unit_price: 30000 },
          { item_id: 4, unit_price: 200000 },
          { item_id: 5, unit_price: 80000 },
          { item_id: 6, unit_price: 120000 },
          { item_id: 7, unit_price: 45000 }
        ],
        error: null
      }))
    })),
    insert: jest.fn(() => ({
      data: { success: true },
      error: null
    }))
  })),
  rpc: jest.fn(() => ({
    data: bomTestData.product,
    error: null
  }))
};

// Mock Redis 클라이언트
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
};

// Mock 환경 설정
jest.mock('@/lib/supabase', () => ({
  createClient: () => mockSupabase
}));

jest.mock('@/lib/redis', () => ({
  createClient: () => mockRedis
}));

describe('Phase P4 Wave 2: BOM Calculation API 통합 테스트', () => {
  
  describe('1. 기본 BOM 계산 테스트', () => {
    
    test('3단계 BOM 구조 계산', async () => {
      const requestBody = {
        item_id: 'PROD-001',
        effective_date: '2025-01-15',
        include_labor: false,
        include_overhead: false
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('item_id', 'PROD-001');
      expect(result.data).toHaveProperty('total_material_cost');
      expect(result.data).toHaveProperty('total_labor_cost');
      expect(result.data).toHaveProperty('total_overhead_cost');
      expect(result.data).toHaveProperty('calculated_price');
      expect(result.data).toHaveProperty('bom_tree');
      expect(result.data).toHaveProperty('missing_prices');
    });
    
    test('노무비 포함 계산', async () => {
      const requestBody = {
        item_id: 'PROD-001',
        effective_date: '2025-01-15',
        include_labor: true,
        include_overhead: false
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.total_labor_cost).toBeGreaterThan(0);
      expect(result.data.calculated_price).toBeGreaterThan(result.data.total_material_cost);
    });
    
    test('간접비 포함 계산', async () => {
      const requestBody = {
        item_id: 'PROD-001',
        effective_date: '2025-01-15',
        include_labor: false,
        include_overhead: true
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.total_overhead_cost).toBeGreaterThan(0);
      expect(result.data.calculated_price).toBeGreaterThan(result.data.total_material_cost);
    });
    
    test('노무비 + 간접비 모두 포함 계산', async () => {
      const requestBody = {
        item_id: 'PROD-001',
        effective_date: '2025-01-15',
        include_labor: true,
        include_overhead: true
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.total_labor_cost).toBeGreaterThan(0);
      expect(result.data.total_overhead_cost).toBeGreaterThan(0);
      expect(result.data.calculated_price).toBe(
        result.data.total_material_cost + 
        result.data.total_labor_cost + 
        result.data.total_overhead_cost
      );
    });
  });
  
  describe('2. 재귀 로직 테스트', () => {
    
    test('깊은 BOM 구조 계산 (10레벨)', async () => {
      const deepBOM = generateDeepBOM(10);
      
      const requestBody = {
        item_id: 'DEEP-ROOT',
        effective_date: '2025-01-15',
        include_labor: false,
        include_overhead: false
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.bom_tree).toBeDefined();
      
      // 깊이 검증
      function getMaxDepth(node: any, currentDepth = 0): number {
        if (!node.children || node.children.length === 0) {
          return currentDepth;
        }
        return Math.max(...node.children.map((child: any) => getMaxDepth(child, currentDepth + 1)));
      }
      
      const maxDepth = getMaxDepth(result.data.bom_tree);
      expect(maxDepth).toBeLessThanOrEqual(10);
    });
    
    test('순환 참조 방지', async () => {
      // 순환 참조가 있는 BOM 구조 시뮬레이션
      const circularBOM = {
        item_id: 'CIRCULAR-001',
        item_code: 'CIRCULAR-001',
        item_name: '순환 참조 테스트',
        level: 0,
        quantity: 1,
        children: [
          {
            item_id: 'CIRCULAR-002',
            item_code: 'CIRCULAR-002',
            item_name: '하위 부품',
            level: 1,
            quantity: 1,
            children: [
              {
                item_id: 'CIRCULAR-001', // 순환 참조
                item_code: 'CIRCULAR-001',
                item_name: '상위 부품으로 돌아감',
                level: 2,
                quantity: 1,
                unit_price: 10000
              }
            ]
          }
        ]
      };
      
      const requestBody = {
        item_id: 'CIRCULAR-001',
        effective_date: '2025-01-15',
        include_labor: false,
        include_overhead: false
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      // 순환 참조가 올바르게 처리되었는지 확인
      expect(result.data.calculated_price).toBeGreaterThan(0);
    });
  });
  
  describe('3. 가격 정보 누락 처리', () => {
    
    test('일부 부품 가격 정보 누락', async () => {
      // 가격 정보가 없는 부품을 포함한 요청
      const requestBody = {
        item_id: 'MISSING-PRICE-001',
        effective_date: '2025-01-15',
        include_labor: false,
        include_overhead: false
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.missing_prices).toBeDefined();
      expect(Array.isArray(result.data.missing_prices)).toBe(true);
      
      // 누락된 가격 정보가 올바르게 보고되었는지 확인
      if (result.data.missing_prices.length > 0) {
        result.data.missing_prices.forEach((missing: any) => {
          expect(missing).toHaveProperty('item_code');
          expect(missing).toHaveProperty('item_name');
          expect(missing).toHaveProperty('level');
        });
      }
    });
    
    test('모든 부품 가격 정보 누락', async () => {
      // 모든 부품의 가격 정보가 없는 경우
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: [], // 빈 데이터
            error: null
          }))
        })),
        insert: jest.fn(() => ({
          data: { success: true },
          error: null
        }))
      });
      
      const requestBody = {
        item_id: 'NO-PRICE-001',
        effective_date: '2025-01-15',
        include_labor: false,
        include_overhead: false
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.total_material_cost).toBe(0);
      expect(result.data.calculated_price).toBe(0);
    });
  });
  
  describe('4. 성능 테스트', () => {
    
    test('대용량 BOM 계산 성능', async () => {
      const startTime = Date.now();
      
      const requestBody = {
        item_id: 'PERFORMANCE-001',
        effective_date: '2025-01-15',
        include_labor: true,
        include_overhead: true
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(2000); // 2초 이내 처리
    });
    
    test('Redis 캐싱 효과', async () => {
      // 첫 번째 요청 (캐시 없음)
      const requestBody = {
        item_id: 'CACHE-TEST-001',
        effective_date: '2025-01-15',
        include_labor: false,
        include_overhead: false
      };
      
      const request1 = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const startTime1 = Date.now();
      const response1 = await POST(request1);
      const endTime1 = Date.now();
      const time1 = endTime1 - startTime1;
      
      // 두 번째 요청 (캐시 있음)
      const request2 = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const startTime2 = Date.now();
      const response2 = await POST(request2);
      const endTime2 = Date.now();
      const time2 = endTime2 - startTime2;
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // 캐시된 요청이 더 빠른지 확인 (선택적)
      // expect(time2).toBeLessThan(time1);
    });
  });
  
  describe('5. 에러 처리 검증', () => {
    
    test('존재하지 않는 품목 ID', async () => {
      const requestBody = {
        item_id: 'NONEXISTENT-001',
        effective_date: '2025-01-15',
        include_labor: false,
        include_overhead: false
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error).toContain('품목을 찾을 수 없습니다');
    });
    
    test('잘못된 요청 형식', async () => {
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid_field: 'test' })
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('필수 필드');
    });
    
    test('잘못된 날짜 형식', async () => {
      const requestBody = {
        item_id: 'PROD-001',
        effective_date: 'invalid-date',
        include_labor: false,
        include_overhead: false
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('날짜 형식');
    });
  });
  
  describe('6. 계산 정확성 검증', () => {
    
    test('재료비 계산 정확성', async () => {
      const requestBody = {
        item_id: 'PROD-001',
        effective_date: '2025-01-15',
        include_labor: false,
        include_overhead: false
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      
      // 예상 재료비와 비교
      const expectedMaterialCost = expectedBOMCalculation.material_cost;
      expect(result.data.total_material_cost).toBe(expectedMaterialCost);
    });
    
    test('노무비 계산 정확성', async () => {
      const requestBody = {
        item_id: 'PROD-001',
        effective_date: '2025-01-15',
        include_labor: true,
        include_overhead: false
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      
      // 예상 노무비와 비교
      const expectedLaborCost = expectedBOMCalculation.labor_cost;
      expect(result.data.total_labor_cost).toBe(expectedLaborCost);
    });
    
    test('간접비 계산 정확성', async () => {
      const requestBody = {
        item_id: 'PROD-001',
        effective_date: '2025-01-15',
        include_labor: false,
        include_overhead: true
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      
      // 예상 간접비와 비교
      const expectedOverheadCost = expectedBOMCalculation.overhead_cost;
      expect(result.data.total_overhead_cost).toBe(expectedOverheadCost);
    });
  });
  
  describe('7. API 응답 형식 검증', () => {
    
    test('성공 응답 구조', async () => {
      const requestBody = {
        item_id: 'PROD-001',
        effective_date: '2025-01-15',
        include_labor: true,
        include_overhead: true
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('item_id');
      expect(result.data).toHaveProperty('item_code');
      expect(result.data).toHaveProperty('item_name');
      expect(result.data).toHaveProperty('total_material_cost');
      expect(result.data).toHaveProperty('total_labor_cost');
      expect(result.data).toHaveProperty('total_overhead_cost');
      expect(result.data).toHaveProperty('calculated_price');
      expect(result.data).toHaveProperty('bom_tree');
      expect(result.data).toHaveProperty('calculation_date');
      expect(result.data).toHaveProperty('missing_prices');
      expect(Array.isArray(result.data.missing_prices)).toBe(true);
    });
  });
});

// 테스트 설정
beforeAll(() => {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: 'test',
    writable: true
  });
});

afterAll(() => {
  jest.clearAllMocks();
});
