'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Calendar, Building2, Package, DollarSign, Hash, FileText, Truck } from 'lucide-react';
import CompanySelect from '@/components/CompanySelect';
import ItemSelect from '@/components/ItemSelect';

type PaymentStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

type SalesTransaction = {
  transaction_id: number;
  transaction_date: string;
  transaction_no: string;
  customer_id: number;
  item_id: number;
  item_name: string;
  spec?: string;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  tax_amount?: number;
  total_amount: number;
  payment_status?: PaymentStatus;
  payment_due_date?: string;
  delivery_address?: string;
  delivery_date?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  customer?: {
    company_id: number;
    company_name: string;
    company_code: string;
  };
  item?: {
    item_id: number;
    item_name: string;
    item_code: string;
  };
};

interface SalesTransactionFormProps {
  transaction?: SalesTransaction | null;
  onSave: (data: Partial<SalesTransaction>) => Promise<void>;
  onCancel: () => void;
}

const PAYMENT_STATUS_OPTIONS = [
  { value: 'PENDING', label: '대기', color: 'text-yellow-600 dark:text-yellow-400' },
  { value: 'PARTIAL', label: '부분', color: 'text-blue-600 dark:text-blue-400' },
  { value: 'COMPLETED', label: '완료', color: 'text-green-600 dark:text-green-400' }
];

export default function SalesTransactionForm({ transaction, onSave, onCancel }: SalesTransactionFormProps) {
  const [formData, setFormData] = useState<Partial<SalesTransaction>>({
    transaction_date: new Date().toISOString().split('T')[0],
    customer_id: undefined,
    item_id: undefined,
    item_name: '',
    spec: '',
    quantity: 1,
    unit_price: 0,
    supply_amount: 0,
    tax_amount: 0,
    total_amount: 0,
    payment_status: 'PENDING',
    payment_due_date: '',
    delivery_address: '',
    delivery_date: '',
    notes: '',
    is_active: true
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (transaction) {
      setFormData({
        ...transaction,
        transaction_date: transaction.transaction_date || new Date().toISOString().split('T')[0],
        payment_due_date: transaction.payment_due_date || '',
        delivery_date: transaction.delivery_date || ''
      });
    }
  }, [transaction]);

  // 금액 계산
  useEffect(() => {
    const supplyAmount = (formData.quantity || 0) * (formData.unit_price || 0);
    const taxAmount = supplyAmount * 0.1; // 10% 부가세
    const totalAmount = supplyAmount + taxAmount;

    setFormData(prev => ({
      ...prev,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount
    }));
  }, [formData.quantity, formData.unit_price]);

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

  const handleCustomerChange = (customerId: number | null) => {
    setFormData(prev => ({ ...prev, customer_id: customerId || undefined }));
    if (errors.customer_id) {
      setErrors(prev => ({ ...prev, customer_id: '' }));
    }
  };

  const handleItemChange = (item: any) => {
    if (item) {
      setFormData(prev => ({
        ...prev,
        item_id: item.item_id,
        item_name: item.item_name,
        spec: item.spec || '',
        unit_price: item.unit_price || 0
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        item_id: undefined,
        item_name: '',
        spec: '',
        unit_price: 0
      }));
    }

    if (errors.item_id) {
      setErrors(prev => ({ ...prev, item_id: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.transaction_date) {
      newErrors.transaction_date = '거래일자는 필수입니다';
    }

    if (!formData.customer_id) {
      newErrors.customer_id = '고객사를 선택해주세요';
    }

    if (!formData.item_id) {
      newErrors.item_id = '품목을 선택해주세요';
    }

    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = '수량은 0보다 커야 합니다';
    }

    if (!formData.unit_price || formData.unit_price < 0) {
      newErrors.unit_price = '단가는 0 이상이어야 합니다';
    }

    if (formData.payment_due_date && formData.transaction_date &&
        formData.payment_due_date < formData.transaction_date) {
      newErrors.payment_due_date = '납기일은 거래일자 이후여야 합니다';
    }

    if (formData.delivery_date && formData.transaction_date &&
        formData.delivery_date < formData.transaction_date) {
      newErrors.delivery_date = '배송일은 거래일자 이후여야 합니다';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // transaction_no는 서버에서 자동 생성되므로 제거
      const { transaction_no, customer, item, created_at, updated_at, ...dataToSave } = formData as any;

      // 빈 문자열 필드 정리
      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key] === '') {
          delete dataToSave[key];
        }
      });

      await onSave(dataToSave);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 거래일자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            거래일자 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="transaction_date"
            value={formData.transaction_date}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.transaction_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            required
          />
          {errors.transaction_date && (
            <p className="mt-1 text-sm text-red-500">{errors.transaction_date}</p>
          )}
        </div>

        {/* 고객사 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Building2 className="w-4 h-4 inline mr-2" />
            고객사 <span className="text-red-500">*</span>
          </label>
          <CompanySelect
            value={formData.customer_id}
            onChange={handleCustomerChange}
            companyType="CUSTOMER"
            placeholder="고객사를 선택하세요"
            required={true}
            error={errors.customer_id}
          />
        </div>

        {/* 품목 선택 */}
        <div className="md:col-span-2">
          <ItemSelect
            value={formData.item_id}
            onChange={handleItemChange}
            label="품목"
            placeholder="품목을 검색하여 선택하세요"
            required={true}
            showPrice={true}
            itemType="PRODUCT"
            className=""
            error={errors.item_id}
          />
        </div>

        {/* 품목명 (읽기 전용) */}
        {formData.item_name && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Package className="w-4 h-4 inline mr-2" />
              품목명
            </label>
            <input
              type="text"
              value={formData.item_name}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            />
          </div>
        )}

        {/* 규격 (읽기 전용) */}
        {formData.spec && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              규격
            </label>
            <input
              type="text"
              value={formData.spec}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            />
          </div>
        )}

        {/* 수량 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Hash className="w-4 h-4 inline mr-2" />
            수량 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            min="0"
            step="0.01"
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.quantity ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            required
          />
          {errors.quantity && (
            <p className="mt-1 text-sm text-red-500">{errors.quantity}</p>
          )}
        </div>

        {/* 단가 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <DollarSign className="w-4 h-4 inline mr-2" />
            단가 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="unit_price"
            value={formData.unit_price}
            onChange={handleChange}
            min="0"
            step="0.01"
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.unit_price ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            required
          />
          {errors.unit_price && (
            <p className="mt-1 text-sm text-red-500">{errors.unit_price}</p>
          )}
        </div>

        {/* 공급가액 (자동 계산) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            공급가액
          </label>
          <input
            type="text"
            value={`₩ ${(formData.supply_amount || 0).toLocaleString()}`}
            disabled
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
          />
        </div>

        {/* 세액 (자동 계산) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            세액 (10%)
          </label>
          <input
            type="text"
            value={`₩ ${(formData.tax_amount || 0).toLocaleString()}`}
            disabled
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
          />
        </div>

        {/* 총액 (자동 계산) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            총액
          </label>
          <input
            type="text"
            value={`₩ ${(formData.total_amount || 0).toLocaleString()}`}
            disabled
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-bold"
          />
        </div>

        {/* 수금 상태 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            수금 상태
          </label>
          <select
            name="payment_status"
            value={formData.payment_status}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PAYMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 납기일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            납기일
          </label>
          <input
            type="date"
            name="payment_due_date"
            value={formData.payment_due_date}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.payment_due_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
          />
          {errors.payment_due_date && (
            <p className="mt-1 text-sm text-red-500">{errors.payment_due_date}</p>
          )}
        </div>

        {/* 배송일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Truck className="w-4 h-4 inline mr-2" />
            배송일
          </label>
          <input
            type="date"
            name="delivery_date"
            value={formData.delivery_date}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.delivery_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
          />
          {errors.delivery_date && (
            <p className="mt-1 text-sm text-red-500">{errors.delivery_date}</p>
          )}
        </div>

        {/* 배송주소 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            배송주소
          </label>
          <input
            type="text"
            name="delivery_address"
            value={formData.delivery_address}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: 서울시 강남구 테헤란로 123"
          />
        </div>

        {/* 비고 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            비고
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="판매 관련 특이사항이나 메모를 입력하세요"
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
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {transaction ? '수정' : '등록'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}