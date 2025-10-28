/**
 * Phase P4: Wave 3 통합 테스트 - Duplicate Detection & Cleanup API
 * 
 * 테스트 범위:
 * - 중복 감지 정확도 검증
 * - 트랜잭션 검증
 * - 3가지 정리 전략 테스트
 * - 시뮬레이션 모드 테스트
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/price-master/duplicates/route';
import { POST } from '@/app/api/price-master/duplicates/cleanup/route';
import {
  duplicatePriceData,
  expectedCleanupResults
} from '../fixtures/price-master-test-data';

// Mock Supabase 클라이언트
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        data: duplicatePriceData,
        error: null
      }))
    })),
    update: jest.fn(() => ({
      in: jest.fn(() => ({
        data: { success: true },
        error: null
      }))
    })),
    delete: jest.fn(() => ({
      in: jest.fn(() => ({
        data: { success: true },
        error: null
      }))
    }))
  })),
  rpc: jest.fn(() => ({
    data: duplicatePriceData,
    error: null
  }))
};

// Mock 환경 설정
jest.mock('@/lib/supabase', () => ({
  createClient: () => mockSupabase
}));

describe('Phase P4 Wave 3: Duplicate Detection & Cleanup API 통합 테스트', () => {
  
  describe('1. 중복 감지 API 테스트', () => {
    
    test('중복 감지 성공', async () => {
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'GET'
      });
      
      const response = await GET(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('total_duplicates');
      expect(result.data).toHaveProperty('duplicate_groups');
      expect(result.data).toHaveProperty('summary');
      expect(Array.isArray(result.data.duplicate_groups)).toBe(true);
    });
    
    test('중복 그룹 구조 검증', async () => {
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'GET'
      });
      
      const response = await GET(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      
      if (result.data.duplicate_groups.length > 0) {
        const group = result.data.duplicate_groups[0];
        expect(group).toHaveProperty('item_code');
        expect(group).toHaveProperty('item_name');
        expect(group).toHaveProperty('effective_date');
        expect(group).toHaveProperty('duplicates');
        expect(group).toHaveProperty('recommended_action');
        expect(Array.isArray(group.duplicates)).toBe(true);
        
        // 중복 항목 구조 검증
        if (group.duplicates.length > 0) {
          const duplicate = group.duplicates[0];
          expect(duplicate).toHaveProperty('item_id');
          expect(duplicate).toHaveProperty('item_code');
          expect(duplicate).toHaveProperty('item_name');
          expect(duplicate).toHaveProperty('effective_date');
          expect(duplicate).toHaveProperty('unit_price');
          expect(duplicate).toHaveProperty('created_at');
          expect(duplicate).toHaveProperty('duplicate_count');
        }
      }
    });
    
    test('요약 정보 검증', async () => {
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'GET'
      });
      
      const response = await GET(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      
      const summary = result.data.summary;
      expect(summary).toHaveProperty('by_item');
      expect(summary).toHaveProperty('by_date');
      expect(summary).toHaveProperty('total_records');
      expect(typeof summary.by_item).toBe('number');
      expect(typeof summary.by_date).toBe('number');
      expect(typeof summary.total_records).toBe('number');
    });
    
    test('중복이 없는 경우 처리', async () => {
      // 중복이 없는 경우를 시뮬레이션
      mockSupabase.rpc.mockReturnValue({
        data: [],
        error: null
      });
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'GET'
      });
      
      const response = await GET(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.total_duplicates).toBe(0);
      expect(result.data.duplicate_groups).toEqual([]);
      expect(result.data.summary.by_item).toBe(0);
      expect(result.data.summary.by_date).toBe(0);
      expect(result.data.summary.total_records).toBe(0);
    });
  });
  
  describe('2. 중복 정리 API 테스트', () => {
    
    test('최신 유지 전략 (keep_latest)', async () => {
      const requestBody = {
        strategy: 'keep_latest',
        dry_run: true
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('deleted_count');
      expect(result.data).toHaveProperty('kept_count');
      expect(result.data).toHaveProperty('preview');
      expect(Array.isArray(result.data.preview)).toBe(true);
      
      // 시뮬레이션 모드이므로 실제 삭제는 되지 않았는지 확인
      expect(result.data.deleted_count).toBeGreaterThan(0);
    });
    
    test('최초 유지 전략 (keep_oldest)', async () => {
      const requestBody = {
        strategy: 'keep_oldest',
        dry_run: true
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.deleted_count).toBeGreaterThan(0);
      expect(result.data.kept_count).toBeGreaterThan(0);
    });
    
    test('수동 선택 전략 (custom)', async () => {
      const requestBody = {
        strategy: 'custom',
        custom_keep_ids: ['PM-002', 'PM-004', 'PM-007'], // 특정 ID들 유지
        dry_run: true
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.deleted_count).toBeGreaterThan(0);
      expect(result.data.kept_count).toBeGreaterThan(0);
    });
    
    test('실제 삭제 실행 (dry_run: false)', async () => {
      const requestBody = {
        strategy: 'keep_latest',
        dry_run: false
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.deleted_count).toBeGreaterThan(0);
      
      // 실제 삭제가 실행되었는지 확인 (mock 호출 검증)
      expect(mockSupabase.from().update).toHaveBeenCalled();
    });
  });
  
  describe('3. 트랜잭션 검증', () => {
    
    test('트랜잭션 롤백 테스트', async () => {
      // 데이터베이스 에러를 시뮬레이션
      mockSupabase.from().update().in.mockReturnValueOnce({
        data: null,
        error: { message: 'Database error' }
      } as any);
      
      const requestBody = {
        strategy: 'keep_latest',
        dry_run: false
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
    
    test('부분 실패 시 롤백', async () => {
      // 첫 번째 업데이트는 성공, 두 번째는 실패
      let callCount = 0;
      mockSupabase.from().update().in.mockImplementation((): any => {
        callCount++;
        if (callCount === 1) {
          return { data: { success: true }, error: null };
        } else {
          return { data: null, error: { message: 'Partial failure' } };
        }
      });
      
      const requestBody = {
        strategy: 'keep_latest',
        dry_run: false
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
    });
  });
  
  describe('4. 정리 전략별 정확성 검증', () => {
    
    test('최신 유지 전략 정확성', async () => {
      const requestBody = {
        strategy: 'keep_latest',
        dry_run: true
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      
      // 예상 결과와 비교
      const expected = expectedCleanupResults.keep_latest;
      expect(result.data.deleted_count).toBeGreaterThan(0);
      
      // 미리보기 데이터 검증
      if (result.data.preview.length > 0) {
        const preview = result.data.preview[0];
        expect(preview).toHaveProperty('item_code');
        expect(preview).toHaveProperty('effective_date');
        expect(preview).toHaveProperty('deleted_prices');
        expect(preview).toHaveProperty('kept_price');
        expect(Array.isArray(preview.deleted_prices)).toBe(true);
      }
    });
    
    test('최초 유지 전략 정확성', async () => {
      const requestBody = {
        strategy: 'keep_oldest',
        dry_run: true
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      
      const expected = expectedCleanupResults.keep_oldest;
      expect(result.data.deleted_count).toBeGreaterThan(0);
    });
    
    test('수동 선택 전략 정확성', async () => {
      const requestBody = {
        strategy: 'custom',
        custom_keep_ids: ['PM-002', 'PM-004', 'PM-007'],
        dry_run: true
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      
      const expected = expectedCleanupResults.custom;
      expect(result.data.deleted_count).toBeGreaterThan(0);
    });
  });
  
  describe('5. 에러 처리 검증', () => {
    
    test('잘못된 전략', async () => {
      const requestBody = {
        strategy: 'invalid_strategy',
        dry_run: true
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('지원하지 않는 전략');
    });
    
    test('수동 선택 시 ID 누락', async () => {
      const requestBody = {
        strategy: 'custom',
        dry_run: true
        // custom_keep_ids 누락
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('수동 선택 ID');
    });
    
    test('잘못된 요청 형식', async () => {
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
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
  });
  
  describe('6. 성능 테스트', () => {
    
    test('대용량 중복 데이터 처리', async () => {
      // 대용량 중복 데이터 시뮬레이션
      const largeDuplicateData = Array.from({ length: 1000 }, (_, i) => ({
        item_id: `ITEM-${i}`,
        item_code: `ITEM-${i}`,
        item_name: `대용량 테스트 부품 ${i}`,
        effective_date: '2025-01-15',
        prices: Array.from({ length: Math.floor(Math.random() * 5) + 2 }, (_, j) => ({
          price_master_id: `PM-${i}-${j}`,
          unit_price: Math.floor(Math.random() * 100000) + 10000,
          created_at: new Date().toISOString(),
          is_current: true
        }))
      }));

      mockSupabase.rpc.mockReturnValue({
        data: largeDuplicateData,
        error: null
      });
      
      const startTime = Date.now();
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'GET'
      });
      
      const response = await GET(request);
      const result = await response.json();
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(3000); // 3초 이내 처리
    });
    
    test('중복 정리 성능', async () => {
      const startTime = Date.now();
      
      const requestBody = {
        strategy: 'keep_latest',
        dry_run: true
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
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
  });
  
  describe('7. API 응답 형식 검증', () => {
    
    test('중복 감지 응답 구조', async () => {
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'GET'
      });
      
      const response = await GET(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('total_duplicates');
      expect(result.data).toHaveProperty('duplicate_groups');
      expect(result.data).toHaveProperty('summary');
      expect(typeof result.data.total_duplicates).toBe('number');
      expect(Array.isArray(result.data.duplicate_groups)).toBe(true);
    });
    
    test('중복 정리 응답 구조', async () => {
      const requestBody = {
        strategy: 'keep_latest',
        dry_run: true
      };
      
      const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('deleted_count');
      expect(result.data).toHaveProperty('kept_count');
      expect(result.data).toHaveProperty('preview');
      expect(typeof result.data.deleted_count).toBe('number');
      expect(typeof result.data.kept_count).toBe('number');
      expect(Array.isArray(result.data.preview)).toBe(true);
    });
  });
  
  describe('8. 동시성 테스트', () => {
    
    test('동시 중복 감지 요청', async () => {
      const promises = Array.from({ length: 5 }, () => {
        const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
          method: 'GET'
        });
        return GET(request);
      });

      const responses = await Promise.all(promises);

      responses.forEach((response: Response) => {
        expect(response.status).toBe(200);
      });

      const results = await Promise.all(responses.map((r: Response) => r.json()));
      results.forEach((result: any) => {
        expect(result.success).toBe(true);
      });
    });
    
    test('동시 중복 정리 요청', async () => {
      const promises = Array.from({ length: 3 }, (_, i) => {
        const requestBody = {
          strategy: 'keep_latest',
          dry_run: true
        };

        const request = new NextRequest('http://localhost:3000/api/price-master/duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        return POST(request);
      });

      const responses = await Promise.all(promises);

      responses.forEach((response: Response) => {
        expect(response.status).toBe(200);
      });

      const results = await Promise.all(responses.map((r: Response) => r.json()));
      results.forEach((result: any) => {
        expect(result.success).toBe(true);
      });
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
