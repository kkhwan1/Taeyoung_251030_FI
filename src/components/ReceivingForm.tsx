'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Calendar, Building2, Plus, X, CheckCircle } from 'lucide-react';
import {
  CompanyForComponent as Company,
  ItemForComponent as Item,
  ReceivingFormData,
  ReceivingItem,
  ReceivingFormProps,
  SearchOption
} from '@/types/inventory';
import ItemSelect from '@/components/ItemSelect';
import CompanySelect from '@/components/CompanySelect';

export default function ReceivingForm({ onSubmit, onCancel }: ReceivingFormProps) {
  const [formData, setFormData] = useState<ReceivingFormData>({
    transaction_date: new Date().toISOString().split('T')[0],
    items: [],
    company_id: undefined,
    reference_no: '',
    notes: '',
    created_by: 1 // Default user ID
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedCompany, setSelectedCompany] = useState<any>(null);


  const handleChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'number' ? (value ? parseFloat(value) : 0) : value;

    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // 예정일이 변경되고 품목이 추가되어 있으면 해당 월의 단가를 자동으로 업데이트
    if (name === 'transaction_date' && formData.items.length > 0) {
      const targetDate = value || formData.transaction_date || '';
      if (targetDate) {
        // 모든 품목의 단가를 업데이트
        const updatedItems = await Promise.all(
          formData.items.map(async (receiveItem) => {
            const monthlyPrice = await fetchMonthlyPrice(receiveItem.item_id, targetDate);
            if (monthlyPrice > 0) {
              return {
                ...receiveItem,
                unit_price: monthlyPrice,
                isMonthlyPriceApplied: true
              };
            }
            return {
              ...receiveItem,
              isMonthlyPriceApplied: false
            };
          })
        );
        setFormData(prev => ({
          ...prev,
          items: updatedItems
        }));
      }
    }

    // Clear error when field is modified
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // 예정일 기준 월별 단가 조회 함수
  const fetchMonthlyPrice = async (itemId: number, dateString: string): Promise<number> => {
    try {
      // 날짜에서 YYYY-MM 형식 추출
      const month = dateString ? dateString.substring(0, 7) : new Date().toISOString().substring(0, 7);
      
      const response = await fetch(`/api/price-history?month=${month}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const priceItem = result.data.find((p: any) => p.item_id === itemId);
          if (priceItem && priceItem.unit_price) {
            return priceItem.unit_price;
          }
        }
      }
    } catch (error) {
      console.warn('월별 단가 조회 실패:', error);
    }
    return 0;
  };

  const handleAddItem = async (item: Item | null) => {
    if (!item) return;

    // Check if product is already added
    const existingItem = formData.items.find(receiveItem => receiveItem.item_id === (item.item_id || item.id));
    if (existingItem) {
      alert('이미 추가된 제품입니다.');
      return;
    }

    const itemId = item.item_id || item.id;
    
    // 예정일이 있으면 해당 월의 단가를 조회, 없으면 현재 품목 단가 사용
    const targetDate = formData.transaction_date || '';
    let unitPrice = item.unit_price || 0;
    let isMonthly = false;
    
    if (targetDate && itemId) {
      const monthlyPrice = await fetchMonthlyPrice(itemId, targetDate);
      if (monthlyPrice > 0) {
        unitPrice = monthlyPrice;
        isMonthly = true;
      }
    }

    const newItem: ReceivingItem = {
      item_id: itemId,
      item_code: item.item_code || '',
      item_name: item.item_name || item.name || '',
      unit: item.unit || '',
      quantity: 1,
      unit_price: unitPrice,
      isMonthlyPriceApplied: isMonthly
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    // Clear item selection error
    if (errors.items) {
      setErrors(prev => ({ ...prev, items: '' }));
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

  // Generate receiving reference number (RCV-YYYYMMDDHHMM)
  const generateReceivingOrder = (): string => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
    return `RCV-${timestamp}`;
  };

  const handleGenerateReference = () => {
    setFormData(prev => ({
      ...prev,
      reference_no: generateReceivingOrder()
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.transaction_date) {
      newErrors.transaction_date = '입고 예정일은 필수입니다';
    }

    if (formData.items.length === 0) {
      newErrors.items = '입고할 품목을 하나 이상 추가해주세요';
    }

    // Check if any item has zero or negative quantity
    const invalidQuantityItems = formData.items.filter(item => item.quantity <= 0);
    if (invalidQuantityItems.length > 0) {
      newErrors.quantity = '모든 품목의 수량이 0보다 커야 합니다';
    }

    // Check if any item has negative unit price
    const invalidPriceItems = formData.items.filter(item => item.unit_price < 0);
    if (invalidPriceItems.length > 0) {
      newErrors.unit_price = '모든 품목의 단가는 0 이상이어야 합니다';
    }

    // Check expiry dates
    const invalidExpiryItems = formData.items.filter(item => 
      item.expiry_date && item.expiry_date < formData.transaction_date
    );
    if (invalidExpiryItems.length > 0) {
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
      // Prepare submission data - each item will be sent separately or as batch
      const submissionData = {
        ...formData,
        created_by: 1 // Default user ID
      };

      // Remove empty optional fields
      Object.keys(submissionData).forEach(key => {
        if (key !== 'items' && (submissionData[key as keyof typeof submissionData] === '' ||
            submissionData[key as keyof typeof submissionData] === undefined)) {
          delete submissionData[key as keyof typeof submissionData];
        }
      });

      await onSubmit(submissionData);
    } finally {
      setLoading(false);
    }
  };

  const handleItemQuantityChange = (itemId: number, quantity: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.item_id === itemId
          ? { ...item, quantity: quantity }
          : item
      )
    }));
  };

  const handleItemUnitPriceChange = (itemId: number, unitPrice: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.item_id === itemId
          ? {
              ...item,
              unit_price: unitPrice,
              isMonthlyPriceApplied: false // 수동 변경 시 플래그 해제
            }
          : item
      )
    }));
  };

  const removeItem = (itemId: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.item_id !== itemId)
    }));
  };

  const calculateTotalAmount = () => {
    return formData.items.reduce((total, item) => total + (item.quantity * item.unit_price), 0);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 입고 예정일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            입고 예정일 <span className="text-gray-500">*</span>
          </label>
          <input
            type="date"
            name="transaction_date"
            value={formData.transaction_date}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.transaction_date ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
          />
          {errors.transaction_date && (
            <p className="mt-1 text-sm text-gray-500">{errors.transaction_date}</p>
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

        {/* 품목 검색 및 추가 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            품목 <span className="text-gray-500">*</span>
          </label>
          <ItemSelect
            key={`item-select-${formData.items.length}`}
            value={undefined}
            onChange={handleAddItem}
            label=""
            placeholder="품번 또는 품명으로 검색하여 추가..."
            required={false}
            showPrice={true}
            itemType="ALL"
            className=""
          />
          {errors.items && (
            <p className="mt-1 text-sm text-red-500">{errors.items}</p>
          )}
        </div>

        {/* 입고번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            입고번호
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="reference_no"
              value={formData.reference_no}
              onChange={handleChange}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: RCV-202501301430"
            />
            <button
              type="button"
              onClick={handleGenerateReference}
              className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              title="자동 생성"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
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

      {/* Added Items List */}
      {formData.items.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">추가된 품목 목록</h4>
          {errors.items && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.items}</p>
            </div>
          )}
          {errors.quantity && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.quantity}</p>
            </div>
          )}
          {errors.unit_price && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.unit_price}</p>
            </div>
          )}
          {errors.expiry_date && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.expiry_date}</p>
            </div>
          )}

          <div className="space-y-3">
            {formData.items.map((item) => (
              <div
                key={item.item_id}
                className="p-4 border rounded-lg border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.item_code} - {item.item_name}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          수량 ({item.unit})
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemQuantityChange(item.item_id, parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          단가 (₩)
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => handleItemUnitPriceChange(item.item_id, parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                          {item.isMonthlyPriceApplied && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded whitespace-nowrap">
                              월별
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          LOT 번호
                        </label>
                        <input
                          type="text"
                          value={item.lot_no || ''}
                          onChange={(e) => {
                            setFormData(prev => ({
                              ...prev,
                              items: prev.items.map(i =>
                                i.item_id === item.item_id ? { ...i, lot_no: e.target.value } : i
                              )
                            }));
                          }}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          placeholder="예: LOT-20240101"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          만료일
                        </label>
                        <input
                          type="date"
                          value={item.expiry_date || ''}
                          onChange={(e) => {
                            setFormData(prev => ({
                              ...prev,
                              items: prev.items.map(i =>
                                i.item_id === item.item_id ? { ...i, expiry_date: e.target.value } : i
                              )
                            }));
                          }}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          입고 위치
                        </label>
                        <input
                          type="text"
                          value={item.to_location || ''}
                          onChange={(e) => {
                            setFormData(prev => ({
                              ...prev,
                              items: prev.items.map(i =>
                                i.item_id === item.item_id ? { ...i, to_location: e.target.value } : i
                              )
                            }));
                          }}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          placeholder="예: A-01-01"
                        />
                      </div>
                    </div>

                    <div className="mt-2 text-sm">
                      <span className="text-gray-500 dark:text-gray-400">합계금액: </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        ₩{(item.quantity * item.unit_price).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.item_id)}
                    className="ml-4 p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="품목 제거"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {formData.items.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">입고 요약</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">품목 수:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {formData.items.length}개
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">총 수량:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {formData.items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
              </span>
            </div>
            <div className="md:col-span-2">
              <span className="text-gray-500 dark:text-gray-400">총 금액:</span>
              <span className="ml-2 font-bold text-lg text-gray-600 dark:text-gray-400">
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
          className="flex items-center gap-2 px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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