/**
 * Payments API Tests
 * 지급 관리 API 통합 테스트
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { supabaseAdmin } from '@/lib/supabase';

const API_BASE = 'http://localhost:3009/api/payments';

// Test data IDs
let testSupplierId: number;
let testItemId: number;
let testPurchaseTransactionId: number;
let testPaymentId: number;

describe('Payments API Integration Tests', () => {
  // Setup: Create test data
  beforeAll(async () => {
    // Create test supplier (공급사)
    const { data: supplier, error: supplierError } = await supabaseAdmin
      .from('companies')
      .insert({
        company_name: 'TEST_지급_공급사',
        company_code: 'TEST_PAYMENT_SUP',
        company_type: '공급사',
        is_active: true
      })
      .select('company_id')
      .single();

    if (supplierError) throw supplierError;
    testSupplierId = supplier!.company_id;

    // Create test item
    const { data: item, error: itemError } = await supabaseAdmin
      .from('items')
      .insert({
        item_name: 'TEST_지급_품목',
        item_code: 'TEST_PAY_ITEM',
        category: '원자재',
        spec: 'TEST_SPEC',
        unit: 'EA',
        current_stock: 0,
        is_active: true
      })
      .select('item_id')
      .single();

    if (itemError) throw itemError;
    testItemId = item!.item_id;

    // Create test purchase transaction
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('purchase_transactions')
      .insert({
        transaction_no: 'TEST_PURCHASE_001',
        transaction_date: '2025-01-28',
        supplier_id: testSupplierId,
        item_id: testItemId,
        item_name: 'TEST_지급_품목',
        spec: 'TEST_SPEC',
        unit: 'EA',
        quantity: 10,
        unit_price: 1000,
        supply_amount: 10000,
        tax_amount: 1000,
        total_amount: 11000,
        payment_status: 'PENDING',
        paid_amount: 0,
        is_active: true
      })
      .select('transaction_id')
      .single();

    if (purchaseError) throw purchaseError;
    testPurchaseTransactionId = purchase!.transaction_id;
  });

  // Cleanup: Delete test data
  afterAll(async () => {
    // Delete in correct order (foreign key constraints)
    if (testPaymentId) {
      await supabaseAdmin
        .from('payments')
        .delete()
        .eq('payment_id', testPaymentId);
    }

    if (testPurchaseTransactionId) {
      await supabaseAdmin
        .from('purchase_transactions')
        .delete()
        .eq('transaction_id', testPurchaseTransactionId);
    }

    if (testItemId) {
      await supabaseAdmin
        .from('items')
        .delete()
        .eq('item_id', testItemId);
    }

    if (testSupplierId) {
      await supabaseAdmin
        .from('companies')
        .delete()
        .eq('company_id', testSupplierId);
    }
  });

  describe('POST /api/payments - Create Payment', () => {
    it('should create payment with valid data', async () => {
      const paymentData = {
        payment_date: '2025-01-28',
        purchase_transaction_id: testPurchaseTransactionId,
        paid_amount: 5000,
        payment_method: 'TRANSFER',
        bank_name: '국민은행',
        account_number: '123-456-789',
        notes: '1차 지급'
      };

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.paid_amount).toBe(5000);
      expect(result.data.payment_method).toBe('TRANSFER');
      expect(result.data.payment_no).toMatch(/^PAY-\d{8}-\d{4}$/);

      testPaymentId = result.data.payment_id;
    });

    it('should update purchase transaction status to PARTIAL after first payment', async () => {
      const { data: purchaseTx } = await supabaseAdmin
        .from('purchase_transactions')
        .select('payment_status, paid_amount')
        .eq('transaction_id', testPurchaseTransactionId)
        .single();

      expect(purchaseTx?.payment_status).toBe('PARTIAL');
      expect(purchaseTx?.paid_amount).toBe(5000);
    });

    it('should create second payment and update status to COMPLETED', async () => {
      const paymentData = {
        payment_date: '2025-01-28',
        purchase_transaction_id: testPurchaseTransactionId,
        paid_amount: 6000,
        payment_method: 'CASH',
        notes: '2차 지급 (잔액 완납)'
      };

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      // Verify purchase transaction status updated to COMPLETED
      const { data: purchaseTx } = await supabaseAdmin
        .from('purchase_transactions')
        .select('payment_status, paid_amount')
        .eq('transaction_id', testPurchaseTransactionId)
        .single();

      expect(purchaseTx?.payment_status).toBe('COMPLETED');
      expect(purchaseTx?.paid_amount).toBe(11000);

      // Clean up second payment
      await supabaseAdmin
        .from('payments')
        .delete()
        .eq('payment_id', result.data.payment_id);

      // Reset purchase transaction for next tests
      await supabaseAdmin
        .from('purchase_transactions')
        .update({
          payment_status: 'PARTIAL',
          paid_amount: 5000
        })
        .eq('transaction_id', testPurchaseTransactionId);
    });

    it('should reject payment exceeding remaining balance', async () => {
      const paymentData = {
        payment_date: '2025-01-28',
        purchase_transaction_id: testPurchaseTransactionId,
        paid_amount: 7000, // Exceeds remaining 6000
        payment_method: 'CASH'
      };

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('잔액을 초과');
    });

    it('should reject invalid payment_date format', async () => {
      const paymentData = {
        payment_date: '28-01-2025', // Wrong format
        purchase_transaction_id: testPurchaseTransactionId,
        paid_amount: 1000,
        payment_method: 'CASH'
      };

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('날짜 형식');
    });

    it('should reject invalid payment_method', async () => {
      const paymentData = {
        payment_date: '2025-01-28',
        purchase_transaction_id: testPurchaseTransactionId,
        paid_amount: 1000,
        payment_method: 'INVALID'
      };

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
    });

    it('should reject negative paid_amount', async () => {
      const paymentData = {
        payment_date: '2025-01-28',
        purchase_transaction_id: testPurchaseTransactionId,
        paid_amount: -1000,
        payment_method: 'CASH'
      };

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
    });

    it('should reject invalid purchase_transaction_id', async () => {
      const paymentData = {
        payment_date: '2025-01-28',
        purchase_transaction_id: 999999,
        paid_amount: 1000,
        payment_method: 'CASH'
      };

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('유효하지 않은');
    });

    it('should handle Korean characters in notes', async () => {
      const paymentData = {
        payment_date: '2025-01-28',
        purchase_transaction_id: testPurchaseTransactionId,
        paid_amount: 1000,
        payment_method: 'CASH',
        notes: '긴급 지급 처리 - 한글 테스트'
      };

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.notes).toBe('긴급 지급 처리 - 한글 테스트');

      // Cleanup
      await supabaseAdmin
        .from('payments')
        .delete()
        .eq('payment_id', result.data.payment_id);

      // Reset purchase transaction
      await supabaseAdmin
        .from('purchase_transactions')
        .update({ payment_status: 'PARTIAL', paid_amount: 5000 })
        .eq('transaction_id', testPurchaseTransactionId);
    });
  });

  describe('GET /api/payments - List Payments', () => {
    it('should return paginated payments list', async () => {
      const response = await fetch(`${API_BASE}?page=1&limit=10`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should filter by date range', async () => {
      const response = await fetch(`${API_BASE}?startDate=2025-01-01&endDate=2025-01-31`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
    });

    it('should filter by payment_method', async () => {
      const response = await fetch(`${API_BASE}?payment_method=TRANSFER`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      if (result.data.length > 0) {
        result.data.forEach((payment: { payment_method: string }) => {
          expect(payment.payment_method).toBe('TRANSFER');
        });
      }
    });

    it('should search by payment_no', async () => {
      const response = await fetch(`${API_BASE}?search=PAY-`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
    });

    it('should order by payment_date descending by default', async () => {
      const response = await fetch(API_BASE);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      if (result.data.length >= 2) {
        const firstDate = new Date(result.data[0].payment_date);
        const secondDate = new Date(result.data[1].payment_date);
        expect(firstDate >= secondDate).toBe(true);
      }
    });

    it('should include joined purchase_transaction data', async () => {
      const response = await fetch(API_BASE);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      if (result.data.length > 0) {
        expect(result.data[0].purchase_transaction).toBeDefined();
        expect(result.data[0].purchase_transaction.transaction_no).toBeDefined();
      }
    });

    it('should include joined supplier data', async () => {
      const response = await fetch(API_BASE);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      if (result.data.length > 0) {
        expect(result.data[0].supplier).toBeDefined();
        expect(result.data[0].supplier.company_name).toBeDefined();
      }
    });
  });

  describe('PUT /api/payments - Update Payment', () => {
    it('should update payment amount and recalculate status', async () => {
      const updateData = {
        paid_amount: 4000 // Changed from 5000 to 4000
      };

      const response = await fetch(`${API_BASE}?id=${testPaymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.paid_amount).toBe(4000);

      // Verify purchase transaction status updated
      const { data: purchaseTx } = await supabaseAdmin
        .from('purchase_transactions')
        .select('payment_status, paid_amount')
        .eq('transaction_id', testPurchaseTransactionId)
        .single();

      expect(purchaseTx?.payment_status).toBe('PARTIAL');
      expect(purchaseTx?.paid_amount).toBe(4000);
    });

    it('should update payment_date', async () => {
      const updateData = {
        payment_date: '2025-01-29'
      };

      const response = await fetch(`${API_BASE}?id=${testPaymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.payment_date).toBe('2025-01-29');
    });

    it('should update notes only', async () => {
      const updateData = {
        notes: '수정된 비고 내용'
      };

      const response = await fetch(`${API_BASE}?id=${testPaymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.notes).toBe('수정된 비고 내용');
    });

    it('should reject update exceeding remaining balance', async () => {
      const updateData = {
        paid_amount: 12000 // Exceeds total_amount
      };

      const response = await fetch(`${API_BASE}?id=${testPaymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('잔액을 초과');
    });

    it('should reject update with invalid date format', async () => {
      const updateData = {
        payment_date: 'invalid-date'
      };

      const response = await fetch(`${API_BASE}?id=${testPaymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
    });

    it('should reject update without payment ID', async () => {
      const updateData = {
        paid_amount: 5000
      };

      const response = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('ID가 필요');
    });

    it('should reject update with non-existent ID', async () => {
      const updateData = {
        paid_amount: 5000
      };

      const response = await fetch(`${API_BASE}?id=999999`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error).toContain('찾을 수 없습니다');
    });
  });

  describe('DELETE /api/payments - Delete Payment', () => {
    it('should soft delete payment and recalculate status', async () => {
      const response = await fetch(`${API_BASE}?id=${testPaymentId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      // Verify soft delete
      const { data: deletedPayment } = await supabaseAdmin
        .from('payments')
        .select('is_active')
        .eq('payment_id', testPaymentId)
        .single();

      expect(deletedPayment?.is_active).toBe(false);

      // Verify purchase transaction status reset to PENDING
      const { data: purchaseTx } = await supabaseAdmin
        .from('purchase_transactions')
        .select('payment_status, paid_amount')
        .eq('transaction_id', testPurchaseTransactionId)
        .single();

      expect(purchaseTx?.payment_status).toBe('PENDING');
      expect(purchaseTx?.paid_amount).toBe(0);
    });

    it('should reject delete without payment ID', async () => {
      const response = await fetch(API_BASE, {
        method: 'DELETE'
      });

      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('ID가 필요');
    });

    it('should reject delete with non-existent ID', async () => {
      const response = await fetch(`${API_BASE}?id=999999`, {
        method: 'DELETE'
      });

      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error).toContain('찾을 수 없습니다');
    });
  });

  describe('Performance Tests', () => {
    it('should respond within 200ms for GET request', async () => {
      const startTime = Date.now();
      const response = await fetch(API_BASE);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(200);
    });

    it('should respond within 200ms for POST request', async () => {
      const paymentData = {
        payment_date: '2025-01-28',
        purchase_transaction_id: testPurchaseTransactionId,
        paid_amount: 1000,
        payment_method: 'CASH'
      };

      const startTime = Date.now();
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(200);

      // Cleanup
      const result = await response.json();
      await supabaseAdmin
        .from('payments')
        .delete()
        .eq('payment_id', result.data.payment_id);
    });
  });
});
