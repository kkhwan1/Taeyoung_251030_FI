/**
 * Phase P4: Wave 1 통합 테스트 - Bulk Upload API
 * 
 * 테스트 범위:
 * - API 연동 테스트
 * - 한글 인코딩 검증
 * - 성능 테스트 (1000개 품목)
 * - 에러 처리 검증
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/price-master/bulk-upload/route';
import { 
  validCSVData, 
  errorCSVData, 
  koreanCSVData, 
  generateLargeDataset,
  createTestFormData,
  csvToFile
} from '../fixtures/price-master-test-data';

// Mock Supabase 클라이언트
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      in: jest.fn(() => ({
        data: [
          { item_id: 1, item_code: 'PART-001' },
          { item_id: 2, item_code: 'PART-002' },
          { item_id: 3, item_code: 'PART-003' }
        ],
        error: null
      }))
    })),
    insert: jest.fn(() => ({
      data: { success: true },
      error: null
    }))
  }))
};

// Mock 환경 설정
jest.mock('@/lib/supabase', () => ({
  createClient: () => mockSupabase
}));

describe('Phase P4 Wave 1: Bulk Upload API 통합 테스트', () => {
  
  describe('1. 기본 API 연동 테스트', () => {
    
    test('유효한 CSV 데이터 업로드 성공', async () => {
      const formData = createTestFormData(validCSVData, 'create');
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.valid_count).toBeGreaterThan(0);
      expect(result.data.error_count).toBe(0);
      expect(result.data.preview).toBeDefined();
    });
    
    test('에러가 포함된 CSV 데이터 처리', async () => {
      const formData = createTestFormData(errorCSVData, 'create');
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.error_count).toBeGreaterThan(0);
      expect(result.data.errors).toBeDefined();
      expect(result.data.errors.length).toBeGreaterThan(0);
    });
    
    test('upsert 모드로 업로드', async () => {
      const formData = createTestFormData(validCSVData, 'upsert');
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });
  
  describe('2. 한글 인코딩 검증', () => {
    
    test('한글 품목명 처리', async () => {
      const formData = createTestFormData(koreanCSVData, 'create');
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      
      // 한글 품목명이 올바르게 파싱되었는지 확인
      const koreanItems = result.data.preview.filter((item: any) => 
        item.item_name.includes('한국') || item.item_name.includes('대한민국')
      );
      expect(koreanItems.length).toBeGreaterThan(0);
    });
    
    test('UTF-8 인코딩 처리', async () => {
      const utf8Data = `품목코드,품목명,단가,적용일,비고
UTF-001,한글 테스트 부품,15000,2025-01-15,UTF-8 인코딩 테스트
UTF-002,특수문자 !@#$%^&*(),25000,2025-01-15,특수문자 테스트
UTF-003,이모지 테스트 🚗🔧,35000,2025-01-15,이모지 테스트`;
      
      const formData = createTestFormData(utf8Data, 'create');
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });
  
  describe('3. 성능 테스트', () => {
    
    test('1000개 품목 대량 업로드 성능', async () => {
      const largeData = generateLargeDataset(1000);
      const formData = createTestFormData(largeData, 'create');
      
      const startTime = Date.now();
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(5000); // 5초 이내 처리
      expect(result.data.valid_count).toBe(1000);
    });
    
    test('메모리 사용량 최적화', async () => {
      const largeData = generateLargeDataset(500);
      const formData = createTestFormData(largeData, 'create');
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB 이내 증가
    });
  });
  
  describe('4. 에러 처리 검증', () => {
    
    test('잘못된 파일 형식 처리', async () => {
      const invalidFile = new File(['invalid content'], 'test.txt', { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', invalidFile);
      formData.append('mode', 'create');
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('지원하지 않는 파일 형식');
    });
    
    test('파일 크기 제한 검증', async () => {
      // 10MB 초과 데이터 생성
      const oversizedData = generateLargeDataset(10000);
      const formData = createTestFormData(oversizedData, 'create');
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('파일 크기');
    });
    
    test('빈 파일 처리', async () => {
      const emptyData = '품목코드,품목명,단가,적용일,비고\n';
      const formData = createTestFormData(emptyData, 'create');
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('데이터가 없습니다');
    });
  });
  
  describe('5. 데이터 검증 로직', () => {
    
    test('필수 필드 검증', async () => {
      const missingFieldsData = `품목코드,품목명,단가,적용일,비고
PART-001,,15000,2025-01-15,품목명 누락
PART-002,브레이크 패드,,2025-01-15,단가 누락
PART-003,브레이크 패드,15000,,비고,적용일 누락`;
      
      const formData = createTestFormData(missingFieldsData, 'create');
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.error_count).toBe(3);
      
      const errors = result.data.errors;
      expect(errors.some((e: any) => e.field === '품목명')).toBe(true);
      expect(errors.some((e: any) => e.field === '단가')).toBe(true);
      expect(errors.some((e: any) => e.field === '적용일')).toBe(true);
    });
    
    test('데이터 타입 검증', async () => {
      const invalidTypesData = `품목코드,품목명,단가,적용일,비고
PART-001,브레이크 패드,abc,2025-01-15,문자 단가
PART-002,브레이크 패드,15000,invalid-date,잘못된 날짜
PART-003,브레이크 패드,-1000,2025-01-15,음수 단가`;
      
      const formData = createTestFormData(invalidTypesData, 'create');
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.error_count).toBe(3);
    });
    
    test('날짜 형식 검증', async () => {
      const invalidDatesData = `품목코드,품목명,단가,적용일,비고
PART-001,브레이크 패드,15000,2025-13-01,잘못된 월
PART-002,브레이크 패드,15000,2025-01-32,잘못된 일
PART-003,브레이크 패드,15000,25-01-15,잘못된 연도
PART-004,브레이크 패드,15000,2025/01/15,잘못된 구분자`;
      
      const formData = createTestFormData(invalidDatesData, 'create');
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.error_count).toBe(4);
    });
  });
  
  describe('6. API 응답 형식 검증', () => {
    
    test('성공 응답 구조', async () => {
      const formData = createTestFormData(validCSVData, 'create');
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('valid_count');
      expect(result.data).toHaveProperty('error_count');
      expect(result.data).toHaveProperty('errors');
      expect(result.data).toHaveProperty('preview');
      expect(Array.isArray(result.data.errors)).toBe(true);
      expect(Array.isArray(result.data.preview)).toBe(true);
    });
    
    test('에러 응답 구조', async () => {
      const invalidFile = new File(['invalid'], 'test.txt');
      const formData = new FormData();
      formData.append('file', invalidFile);
      formData.append('mode', 'create');
      
      const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData
      });
      
      const response = await POST(request);
      const result = await response.json();
      
      expect(response.status).toBe(400);
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });
  });
  
  describe('7. 동시성 테스트', () => {
    
    test('동시 업로드 처리', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => {
        const testData = `품목코드,품목명,단가,적용일,비고
CONCURRENT-${i}-001,동시 테스트 부품 ${i},15000,2025-01-15,동시성 테스트 ${i}`;
        
        const formData = createTestFormData(testData, 'create');
        
        const request = new NextRequest('http://localhost:3000/api/price-master/bulk-upload', {
          method: 'POST',
          body: formData
        });
        
        return POST(request);
      });
      
      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      const results = await Promise.all(responses.map(r => r.json()));
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});

// 테스트 설정
beforeAll(() => {
  // 테스트 환경 설정
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: 'test',
    writable: true
  });
});

afterAll(() => {
  // 테스트 정리
  jest.clearAllMocks();
});
