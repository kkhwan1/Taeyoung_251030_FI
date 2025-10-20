'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Calendar, Building2 } from 'lucide-react';
import {
  CompanyForComponent as Company,
  ItemForComponent as Item,
  ReceivingFormData,
  ReceivingFormProps,
  SearchOption
} from '@/types/inventory';
import ItemSelect from '@/components/ItemSelect';
import CompanySelect from '@/components/CompanySelect';

export default function ReceivingForm({ onSubmit, onCancel }: ReceivingFormProps) {
  const [formData, setFormData] = useState<ReceivingFormData>({
    transaction_date: new Date().toISOString().split('T')[0],
    item_id: 0,
    quantity: 0,
    unit_price: 0,
    company_id: undefined,
    reference_no: '',
    lot_no: '',
    expiry_date: '',
    to_location: '',
    notes: '',
    created_by: 1 // Default user ID
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);


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

  const handleItemChange = (item: Item | null) => {
    setSelectedItem(item);
    if (item) {
      setFormData(prev => ({
        ...prev,
        item_id: item.item_id,
        unit_price: item.unit_price || 0
      }));
    } else {
      setFormData(prev => ({ ...prev, item_id: 0, unit_price: 0 }));
    }

    // Clear item selection error
    if (errors.item_id) {
      setErrors(prev => ({ ...prev, item_id: '' }));
    }
  };

  const handleCompanyChange = (companyId: number | null, company?: any) => {
    setFormData(prev => ({ ...prev, company_id: companyId || undefined }));
    setSelectedCompany(company || null);

    // Clear company error
    if (errors.company_id) {
      setErrors(prev => ({ ...prev, company_id: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.transaction_date) {
      newErrors.transaction_date = '거래일자는 필수입니다';
    }

    if (!formData.item_id || formData.item_id === 0) {
      newErrors.item_id = '품목을 선택해주세요';
    }

    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = '수량은 0보다 커야 합니다';
    }

    if (formData.unit_price < 0) {
      newErrors.unit_price = '단가는 0 이상이어야 합니다';
    }

    if (formData.expiry_date && formData.expiry_date < formData.transaction_date) {
      newErrors.expiry_date = '만료일은 거래일자보다 뒤여야 합니다';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Prepare submission data
      const submissionData = {
        ...formData,
        created_by: 1 // Default user ID, should be from auth context
      };

      // Remove empty optional fields
      Object.keys(submissionData).forEach(key => {
        if (submissionData[key as keyof typeof submissionData] === '' ||
            submissionData[key as keyof typeof submissionData] === undefined) {
          delete submissionData[key as keyof typeof submissionData];
        }
      });

      await onSubmit(submissionData);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalAmount = () => {
    return formData.quantity * formData.unit_price;
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
          />
          {errors.transaction_date && (
            <p className="mt-1 text-sm text-red-500">{errors.transaction_date}</p>
          )}
        </div>

        {/* 공급업체 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Building2 className="w-4 h-4 inline mr-2" />
            공급업체
          </label>
          <CompanySelect
            value={formData.company_id}
            onChange={handleCompanyChange}
            companyType="SUPPLIER"
            placeholder="공급업체를 선택하세요"
            error={errors.company_id}
          />
        </div>

        {/* 품목 검색 */}
        <div className="md:col-span-2">
          <ItemSelect
            value={formData.item_id || undefined}
            onChange={handleItemChange}
            label="품목"
            placeholder="품번 또는 품명으로 검색..."
            required={true}
            error={errors.item_id}
            showPrice={true}
            itemType="ALL"
            className=""
          />
        </div>

        {/* 수량 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
            placeholder="0"
          />
          {selectedItem && (
            <p className="mt-1 text-sm text-gray-500">단위: {selectedItem.unit}</p>
          )}
          {errors.quantity && (
            <p className="mt-1 text-sm text-red-500">{errors.quantity}</p>
          )}
        </div>

        {/* 단가 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            단가 (₩) <span className="text-red-500">*</span>
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
            placeholder="0"
          />
          {errors.unit_price && (
            <p className="mt-1 text-sm text-red-500">{errors.unit_price}</p>
          )}
        </div>

        {/* 참조번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            참조번호
          </label>
          <input
            type="text"
            name="reference_no"
            value={formData.reference_no}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: PO-2024-001"
          />
        </div>

        {/* LOT 번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            LOT 번호
          </label>
          <input
            type="text"
            name="lot_no"
            value={formData.lot_no}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: LOT-20240101"
          />
        </div>

        {/* 만료일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            만료일
          </label>
          <input
            type="date"
            name="expiry_date"
            value={formData.expiry_date}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.expiry_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
          />
          {errors.expiry_date && (
            <p className="mt-1 text-sm text-red-500">{errors.expiry_date}</p>
          )}
        </div>

        {/* 입고 위치 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            입고 위치
          </label>
          <input
            type="text"
            name="to_location"
            value={formData.to_location}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: A-01-01"
          />
        </div>

        {/* 메모 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            메모
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="추가 메모나 특이사항을 입력하세요"
          />
        </div>
      </div>

      {/* Summary */}
      {formData.quantity > 0 && formData.unit_price > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">입고 요약</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">수량:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {formData.quantity.toLocaleString()} {selectedItem?.unit || ''}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">단가:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                ₩{formData.unit_price.toLocaleString()}
              </span>
            </div>
            <div className="md:col-span-2">
              <span className="text-gray-500 dark:text-gray-400">총 금액:</span>
              <span className="ml-2 font-bold text-lg text-blue-600 dark:text-blue-400">
                ₩{calculateTotalAmount().toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

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
          className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              처리 중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              입고 등록
            </>
          )}
        </button>
      </div>
    </form>
  );
}