'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Calendar, CreditCard, Building2, DollarSign, FileText, Hash } from 'lucide-react';

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

  // Load collection data for edit mode
  useEffect(() => {
    if (collection) {
      setFormData({
        ...collection,
        collection_date: collection.collection_date || new Date().toISOString().split('T')[0]
      });
    }
  }, [collection]);

  // Fetch pending sales transactions
  useEffect(() => {
    const fetchSalesTransactions = async () => {
      try {
        setLoadingSales(true);

        // Fetch PENDING and PARTIAL transactions separately and combine
        const [pendingResponse, partialResponse] = await Promise.all([
          fetch('/api/sales-transactions?payment_status=PENDING&limit=100'),
          fetch('/api/sales-transactions?payment_status=PARTIAL&limit=100')
        ]);

        const [pendingResult, partialResult] = await Promise.all([
          pendingResponse.json(),
          partialResponse.json()
        ]);

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
      } catch (error) {
        console.error('Error fetching sales transactions:', error);
      } finally {
        setLoadingSales(false);
      }
    };

    fetchSalesTransactions();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Remove read-only fields
      const { remaining_balance, ...dataToSave } = formData;

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

      // Remove empty strings
      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key as keyof typeof cleanedData] === '') {
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
            수금일자 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="collection_date"
            value={formData.collection_date}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.collection_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            required
          />
          {errors.collection_date && (
            <p className="mt-1 text-sm text-red-500">{errors.collection_date}</p>
          )}
        </div>

        {/* 매출 거래 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <FileText className="w-4 h-4 inline mr-2" />
            매출 거래 <span className="text-red-500">*</span>
          </label>
          <select
            name="sales_transaction_id"
            value={formData.sales_transaction_id || ''}
            onChange={handleSalesTransactionChange}
            disabled={loadingSales}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.sales_transaction_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
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
            <p className="mt-1 text-sm text-red-500">{errors.sales_transaction_id}</p>
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <DollarSign className="w-4 h-4 inline mr-2" />
            수금금액 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="collected_amount"
            value={formData.collected_amount}
            onChange={handleChange}
            min="0"
            step="0.01"
            max={formData.remaining_balance}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.collected_amount ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            required
          />
          {errors.collected_amount && (
            <p className="mt-1 text-sm text-red-500">{errors.collected_amount}</p>
          )}
        </div>

        {/* 결제방법 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <CreditCard className="w-4 h-4 inline mr-2" />
            결제방법 <span className="text-red-500">*</span>
          </label>
          <select
            name="payment_method"
            value={formData.payment_method}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.payment_method ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
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
            <p className="mt-1 text-sm text-red-500">{errors.payment_method}</p>
          )}
        </div>

        {/* Conditional Fields - Transfer */}
        {formData.payment_method === 'TRANSFER' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                은행명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="bank_name"
                value={formData.bank_name}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  errors.bank_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                }`}
                placeholder="예: 국민은행"
                required
              />
              {errors.bank_name && (
                <p className="mt-1 text-sm text-red-500">{errors.bank_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Hash className="w-4 h-4 inline mr-2" />
                계좌번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="account_number"
                value={formData.account_number}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  errors.account_number ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                }`}
                placeholder="예: 123-456-789012"
                required
              />
              {errors.account_number && (
                <p className="mt-1 text-sm text-red-500">{errors.account_number}</p>
              )}
            </div>
          </>
        )}

        {/* Conditional Fields - Check */}
        {formData.payment_method === 'CHECK' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Hash className="w-4 h-4 inline mr-2" />
              수표번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="check_number"
              value={formData.check_number}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.check_number ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
              }`}
              placeholder="예: CHK-2024-001"
              required
            />
            {errors.check_number && (
              <p className="mt-1 text-sm text-red-500">{errors.check_number}</p>
            )}
          </div>
        )}

        {/* Conditional Fields - Card */}
        {formData.payment_method === 'CARD' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <CreditCard className="w-4 h-4 inline mr-2" />
              카드번호 (마지막 4자리) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="card_number"
              value={formData.card_number}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.card_number ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
              }`}
              placeholder="예: ****-****-****-1234"
              maxLength={4}
              required
            />
            {errors.card_number && (
              <p className="mt-1 text-sm text-red-500">{errors.card_number}</p>
            )}
          </div>
        )}

        {/* 비고 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <FileText className="w-4 h-4 inline mr-2" />
            비고
          </label>
          <textarea
            name="notes"
            value={formData.notes}
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
          className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
