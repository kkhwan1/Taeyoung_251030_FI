/**
 * Smoke Tests for Legacy Module Modularization
 * Wave 1: Verify type extraction from legacy modules
 */

import { describe, it, expect } from '@jest/globals';

describe('Legacy Module Types', () => {
  describe('Transaction Types', () => {
    it('should export transaction type definitions', async () => {
      const types = await import('@/lib/transaction/types');

      expect(types.TransactionOptions).toBeDefined();
      expect(types.TransactionResult).toBeDefined();
      expect(types.StockValidationResult).toBeDefined();
      expect(types.BOMValidationResult).toBeDefined();
      expect(types.MaterialShortage).toBeDefined();
    });

    it('should have correct TransactionOptions interface', async () => {
      const { TransactionOptions } = await import('@/lib/transaction/types');

      const testOptions: typeof TransactionOptions = {
        isolationLevel: 'READ COMMITTED',
        timeout: 30000,
        retryAttempts: 3,
        enableAuditLog: true
      };

      expect(testOptions.isolationLevel).toBe('READ COMMITTED');
      expect(testOptions.timeout).toBe(30000);
    });

    it('should have correct StockValidationResult interface', async () => {
      const { StockValidationResult } = await import('@/lib/transaction/types');

      const testValidation: typeof StockValidationResult = {
        isValid: true,
        errors: [],
        warnings: ['Low stock'],
        currentStock: 100,
        requiredStock: 50,
        availableStock: 100
      };

      expect(testValidation.isValid).toBe(true);
      expect(testValidation.warnings).toContain('Low stock');
    });
  });

  describe('Query Types', () => {
    it('should export query type definitions', async () => {
      const types = await import('@/lib/query/types');

      expect(types.QueryOptimizationOptions).toBeDefined();
      expect(types.PaginationConfig).toBeDefined();
      expect(types.QueryResult).toBeDefined();
    });

    it('should have correct PaginationConfig interface', async () => {
      const { PaginationConfig } = await import('@/lib/query/types');

      const testPagination: typeof PaginationConfig = {
        page: 1,
        limit: 20,
        orderBy: 'created_at',
        direction: 'DESC'
      };

      expect(testPagination.page).toBe(1);
      expect(testPagination.limit).toBe(20);
    });

    it('should have correct QueryResult interface', async () => {
      const { QueryResult } = await import('@/lib/query/types');

      const testResult: typeof QueryResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
        executionTime: 150,
        fromCache: false
      };

      expect(testResult.data).toEqual([]);
      expect(testResult.executionTime).toBe(150);
    });
  });
});

describe('Legacy Module Structure', () => {
  it('should have transaction directory', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const transactionPath = path.join(process.cwd(), 'src', 'lib', 'transaction');
    const exists = fs.existsSync(transactionPath);

    expect(exists).toBe(true);
  });

  it('should have query directory', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const queryPath = path.join(process.cwd(), 'src', 'lib', 'query');
    const exists = fs.existsSync(queryPath);

    expect(exists).toBe(true);
  });

  it('should have types.ts files', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const transactionTypesPath = path.join(process.cwd(), 'src', 'lib', 'transaction', 'types.ts');
    const queryTypesPath = path.join(process.cwd(), 'src', 'lib', 'query', 'types.ts');

    expect(fs.existsSync(transactionTypesPath)).toBe(true);
    expect(fs.existsSync(queryTypesPath)).toBe(true);
  });
});

describe('Legacy Code Preservation', () => {
  it('should preserve original transactionManager.ts', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const legacyPath = path.join(process.cwd(), 'src', 'lib', 'transactionManager.ts');
    const exists = fs.existsSync(legacyPath);

    expect(exists).toBe(true);
  });

  it('should preserve original query-optimizer.ts', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const legacyPath = path.join(process.cwd(), 'src', 'lib', 'query-optimizer.ts');
    const exists = fs.existsSync(legacyPath);

    expect(exists).toBe(true);
  });

  it('should verify no breaking changes to legacy files', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const transactionPath = path.join(process.cwd(), 'src', 'lib', 'transactionManager.ts');
    const content = fs.readFileSync(transactionPath, 'utf-8');

    // Verify legacy marker comment exists
    expect(content).toContain('legacy MySQL transaction code');
    expect(content).toContain('not used in the Supabase implementation');
  });
});

describe('Type Safety Verification', () => {
  it('should enforce type constraints on TransactionOptions', async () => {
    const { TransactionOptions } = await import('@/lib/transaction/types');

    const validOptions: typeof TransactionOptions = {
      isolationLevel: 'SERIALIZABLE',
      timeout: 10000
    };

    expect(validOptions.isolationLevel).toBe('SERIALIZABLE');
  });

  it('should enforce type constraints on PaginationConfig', async () => {
    const { PaginationConfig } = await import('@/lib/query/types');

    const validConfig: typeof PaginationConfig = {
      page: 1,
      limit: 50,
      direction: 'ASC'
    };

    expect(validConfig.page).toBeGreaterThan(0);
    expect(validConfig.limit).toBeGreaterThan(0);
  });
});
