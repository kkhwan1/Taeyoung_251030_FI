'use client';

import { useState, useEffect } from 'react';
import {
  Save,
  Loader2,
  Calendar,
  Building2,
  Hash,
  ClipboardCopy
} from 'lucide-react';
import { formStorage } from '@/utils/formStorage';

type PaymentMethod = 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD';

type Collection = {
  collection_id?: number;
  collection_date: string;
  sales_transaction_id: number;
  collected_amount: number;
  payment_method: PaymentMethod;
  bank_name?: string;
  account_number?: string;
  check_number?: string;
  card_number?: string;
  notes?: string;
  is_active?: boolean;
  remaining_balance?: number;
};

type SalesTransaction = {
  transaction_id: number;
  transaction_no: string;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  remaining_balance: number;
  payment_status: string;
};

interface CollectionFormProps {
  collection?: Collection | null;
  onSave: (data: Partial<Collection>) => Promise<void>;
  onCancel: () => void;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'CASH', label: '현금' },
  { value: 'TRANSFER', label: '계좌이체' },
  { value: 'CHECK', label: '수표' },
  { value: 'CARD', label: '카드' }
];

export default function CollectionForm({ collection, onSave, onCancel }: CollectionFormProps) {
  const [formData, setFormData] = useState<Partial<Collection>>({
    collection_date: new Date().toISOString().split('T')[0],
    sales_transaction_id: undefined,
    collected_amount: 0,
    payment_method: 'CASH',
    bank_name: '',
    account_number: '',
    check_number: '',
    card_number: '',
    notes: '',
    is_active: true,
    remaining_balance: 0
  });

  const [salesTransactions, setSalesTransactions] = useState<SalesTransaction[]>([]);
  const [selectedSalesTransaction, setSelectedSalesTransaction] = useState<SalesTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastInputAvailable, setLastInputAvailable] = useState(false);

  // Load collection data for edit mode
  useEffect(() => {
    if (collection) {
      setFormData({
        ...collection,
        collection_date: collection.collection_date || new Date().toISOString().split('T')[0]
      });
    }
    
    // 마지막 입력값 확인
    const lastData = formStorage.loadLastInput('collection');
    setLastInputAvailable(!!lastData);
  }, [collection]);

  // Fetch pending sales transactions
  useEffect(() => {
    const fetchSalesTransactions = async () => {
      try {
        setLoadingSales(true);

        // Import safeFetchAllJson utility
        const { safeFetchAllJson } = await import('@/lib/fetch-utils');

        // Fetch PENDING and PARTIAL transactions in parallel with timeout and retry
        const [pendingResult, partialResult] = await safeFetchAllJson([
          { url: '/api/sales-transactions?payment_status=PENDING&limit=100' },
          { url: '/api/sales-transactions?payment_status=PARTIAL&limit=100' }
        ], {
          timeout: 15000, // 15초 타임아웃
          maxRetries: 2,  // 최대 2회 재시도
          retryDelay: 1000 // 1초 간격
        });

        const allTransactions: any[] = [];

        if (pendingResult.success && pendingResult.data?.transactions) {
          allTransactions.push(...pendingResult.data.transactions);
        }

        if (partialResult.success && partialResult.data?.transactions) {
          allTransactions.push(...partialResult.data.transactions);
        }

        const transactions = allTransactions.map((tx: any) => ({
          transaction_id: tx.transaction_id,
          transaction_no: tx.transaction_no,
          customer_name: tx.customer?.company_name || 'Unknown',
          total_amount: tx.total_amount,
          paid_amount: tx.paid_amount || 0,
          remaining_balance: tx.total_amount - (tx.paid_amount || 0),
          payment_status: tx.payment_status
        }));

        setSalesTransactions(transactions);

        // If in edit mode and transaction is not in list, fetch it individually
        if (formData.sales_transaction_id) {
          const found = transactions.find(t => t.transaction_id === formData.sales_transaction_id);
          if (!found) {
            // Fetch the specific transaction with safeFetchJson
            const { safeFetchJson } = await import('@/lib/fetch-utils');
            const result = await safeFetchJson(`/api/sales/${formData.sales_transaction_id}`, {}, {
              timeout: 10000,
              maxRetries: 2,
              retryDelay: 1000
            });
            if (result.success && result.data) {
              const tx = result.data;
              const singleTransaction = {
                transaction_id: tx.transaction_id,
                transaction_no: tx.transaction_no,
                customer_name: tx.customer?.company_name || 'Unknown',
                total_amount: tx.total_amount,
                paid_amount: tx.paid_amount || 0,
                remaining_balance: tx.total_amount - (tx.paid_amount || 0),
                payment_status: tx.payment_status
              };
              setSalesTransactions([singleTransaction, ...transactions]);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching sales transactions:', error);
      } finally {
        setLoadingSales(false);
      }
    };

    fetchSalesTransactions();
  }, [formData.sales_transaction_id]);

  // Auto-calculate remaining balance when sales transaction is selected
  useEffect(() => {
    if (selectedSalesTransaction) {
      const totalAmount = selectedSalesTransaction.total_amount;
      const paidAmount = selectedSalesTransaction.paid_amount || 0;
      const remainingAmount = totalAmount - paidAmount;

      setFormData(prev => ({
        ...prev,
        remaining_balance: remainingAmount
      }));
    }
  }, [selectedSalesTransaction]);

  // Update selected transaction when sales_transaction_id changes
  useEffect(() => {
    if (formData.sales_transaction_id && salesTransactions.length > 0) {
      const transaction = salesTransactions.find(
        t => t.transaction_id === formData.sales_transaction_id
      );
      if (transaction) {
        setSelectedSalesTransaction(transaction);
      }
    }
  }, [formData.sales_transaction_id, salesTransactions]);

  // 금액 검증 함수
  const validateCollectionAmount = (amount: number, remainingBalance: number) => {
    if (amount <= 0) return "수금액은 0보다 커야 합니다";
    if (amount > remainingBalance) return `잔액(₩${remainingBalance.toLocaleString()})을 초과할 수 없습니다`;
    return null;
  };

  // 전액 수금 버튼 핸들러
  const handleFullPayment = () => {
    if (selectedSalesTransaction) {
      const remainingAmount = selectedSalesTransaction.remaining_balance;
      setFormData(prev => ({
        ...prev,
        collected_amount: remainingAmount
      }));
    }
  };

  // 이전 정보 불러오기
  const handleLoadLastInput = () => {
    const lastData = formStorage.loadLastInput('collection');
    if (lastData) {
      setFormData(prev => ({
        ...prev,
        payment_method: lastData.payment_method as PaymentMethod,
        bank_name: lastData.bank_name,
        account_number: lastData.account_number,
        card_number: lastData.card_number
      }));
    }
  };

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'f' && e.ctrlKey) {
        e.preventDefault();
        handleFullPayment();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseFloat(value) : 0) : value
    }));

    // Clear error when field is modified
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSalesTransactionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const transactionId = parseInt(e.target.value);
    const transaction = salesTransactions.find(tx => tx.transaction_id === transactionId);

    setSelectedSalesTransaction(transaction || null);
    setFormData(prev => ({
      ...prev,
      sales_transaction_id: transactionId || undefined
    }));

    if (errors.sales_transaction_id) {
      setErrors(prev => ({ ...prev, sales_transaction_id: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.collection_date) {
      newErrors.collection_date = '수금일자는 필수입니다';
    }

    if (!formData.sales_transaction_id) {
      newErrors.sales_transaction_id = '매출 거래를 선택해주세요';
    }

    if (!formData.collected_amount || formData.collected_amount <= 0) {
      newErrors.collected_amount = '수금금액은 0보다 커야 합니다';
    }

    if (formData.collected_amount && formData.remaining_balance &&
        formData.collected_amount > formData.remaining_balance) {
      newErrors.collected_amount = '수금금액이 미수금액을 초과할 수 없습니다';
    }

    if (!formData.payment_method) {
      newErrors.payment_method = '결제방법을 선택해주세요';
    }

    // Conditional validation based on payment method
    if (formData.payment_method === 'TRANSFER') {
      if (!formData.bank_name) {
        newErrors.bank_name = '은행명은 필수입니다';
      }
      if (!formData.account_number) {
        newErrors.account_number = '계좌번호는 필수입니다';
      }
    }

    if (formData.payment_method === 'CHECK' && !formData.check_number) {
      newErrors.check_number = '수표번호는 필수입니다';
    }

    if (formData.payment_method === 'CARD' && !formData.card_number) {
      newErrors.card_number = '카드번호는 필수입니다';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Remove read-only and relational fields
      const { 
        remaining_balance, 
        sales_transaction, 
        customer, 
        created_at, 
        updated_at,
        is_active,
        ...dataToSave 
      } = formData as any;

      // Clean up conditional fields based on payment method
      const cleanedData = { ...dataToSave };

      if (cleanedData.payment_method !== 'TRANSFER') {
        delete cleanedData.bank_name;
        delete cleanedData.account_number;
      }

      if (cleanedData.payment_method !== 'CHECK') {
        delete cleanedData.check_number;
      }

      if (cleanedData.payment_method !== 'CARD') {
        delete cleanedData.card_number;
      }

      // Remove empty strings but preserve notes
      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key as keyof typeof cleanedData] === '' && key !== 'notes') {
          delete cleanedData[key as keyof typeof cleanedData];
        }
      });

      await onSave(cleanedData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 수금일자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            수금일자 <span className="text-gray-500">*</span>
          </label>
          <input
            type="date"
            name="collection_date"
            value={formData.collection_date}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.collection_date ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            required
          />
          {errors.collection_date && (
            <p className="mt-1 text-sm text-gray-500">{errors.collection_date}</p>
          )}
        </div>

        {/* 매출 거래 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            
            매출 거래 <span className="text-gray-500">*</span>
          </label>
          <select
            name="sales_transaction_id"
            value={formData.sales_transaction_id || ''}
            onChange={handleSalesTransactionChange}
            disabled={loadingSales}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.sales_transaction_id ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            required
          >
            <option value="">매출 거래를 선택하세요</option>
            {salesTransactions.map((tx) => (
              <option key={tx.transaction_id} value={tx.transaction_id}>
                {tx.transaction_no} - {tx.customer_name} (미수: ₩{tx.remaining_balance.toLocaleString()})
              </option>
            ))}
          </select>
          {errors.sales_transaction_id && (
            <p className="mt-1 text-sm text-gray-500">{errors.sales_transaction_id}</p>
          )}
        </div>

        {/* 미수금액 (읽기 전용) */}
        {selectedSalesTransaction && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              미수금액
            </label>
            <input
              type="text"
              value={`₩ ${(formData.remaining_balance || 0).toLocaleString()}`}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-medium"
            />
          </div>
        )}

        {/* 수금금액 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              
              수금금액 <span className="text-gray-500">*</span>
            </label>
            {selectedSalesTransaction && (
              <button
                type="button"
                onClick={handleFullPayment}
                className="text-sm text-gray-600 hover:text-gray-700 flex items-center gap-1 font-medium"
                title="Ctrl+F로 전액 수금"
              >
                
                전액 수금
              </button>
            )}
          </div>
          <input
            type="number"
            name="collected_amount"
            value={formData.collected_amount}
            onChange={handleChange}
            min="0"
            step="0.01"
            max={formData.remaining_balance}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.collected_amount ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            required
          />
          {errors.collected_amount && (
            <p className="mt-1 text-sm text-gray-500">{errors.collected_amount}</p>
          )}
          {selectedSalesTransaction && (
            <p className="mt-1 text-xs text-gray-500">
              남은 잔액: ₩{(formData.remaining_balance || 0).toLocaleString()}
            </p>
          )}
        </div>

        {/* 결제방법 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              
              결제방법 <span className="text-gray-500">*</span>
            </label>
            {lastInputAvailable && (
              <button
                type="button"
                onClick={handleLoadLastInput}
                className="text-sm text-gray-600 hover:text-gray-700 flex items-center gap-1"
              >
                <ClipboardCopy className="w-4 h-4" />
                이전 정보 불러오기
              </button>
            )}
          </div>
          <select
            name="payment_method"
            value={formData.payment_method}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.payment_method ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            required
          >
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.payment_method && (
            <p className="mt-1 text-sm text-gray-500">{errors.payment_method}</p>
          )}
        </div>

        {/* Conditional Fields - Transfer */}
        {formData.payment_method === 'TRANSFER' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                은행명 <span className="text-gray-500">*</span>
              </label>
              <input
                type="text"
                name="bank_name"
                value={formData.bank_name ?? ''}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  errors.bank_name ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
                }`}
                placeholder="예: 국민은행"
                required
              />
              {errors.bank_name && (
                <p className="mt-1 text-sm text-gray-500">{errors.bank_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Hash className="w-4 h-4 inline mr-2" />
                계좌번호 <span className="text-gray-500">*</span>
              </label>
              <input
                type="text"
                name="account_number"
                value={formData.account_number ?? ''}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  errors.account_number ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
                }`}
                placeholder="예: 123-456-789012"
                required
              />
              {errors.account_number && (
                <p className="mt-1 text-sm text-gray-500">{errors.account_number}</p>
              )}
            </div>
          </>
        )}

        {/* Conditional Fields - Check */}
        {formData.payment_method === 'CHECK' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Hash className="w-4 h-4 inline mr-2" />
              수표번호 <span className="text-gray-500">*</span>
            </label>
            <input
              type="text"
              name="check_number"
              value={formData.check_number}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.check_number ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
              }`}
              placeholder="예: CHK-2024-001"
              required
            />
            {errors.check_number && (
              <p className="mt-1 text-sm text-gray-500">{errors.check_number}</p>
            )}
          </div>
        )}

        {/* Conditional Fields - Card */}
        {formData.payment_method === 'CARD' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              
              카드번호 (마지막 4자리) <span className="text-gray-500">*</span>
            </label>
            <input
              type="text"
              name="card_number"
              value={formData.card_number}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.card_number ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
              }`}
              placeholder="예: ****-****-****-1234"
              maxLength={4}
              required
            />
            {errors.card_number && (
              <p className="mt-1 text-sm text-gray-500">{errors.card_number}</p>
            )}
          </div>
        )}

        {/* 비고 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            
            비고
          </label>
          <textarea
            name="notes"
            value={formData.notes ?? ''}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="수금 관련 특이사항이나 메모를 입력하세요"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {collection ? '수정' : '등록'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
