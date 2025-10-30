'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import ItemSelect from './ItemSelect';
import { ItemForComponent } from '@/types/inventory';

interface StockAdjustmentFormProps {
  onSubmit: (formData: any) => void;
  onCancel: () => void;
}

interface FormData {
  item_id: number | null;
  adjustment_type: 'INCREASE' | 'DECREASE' | 'SET';
  quantity: number;
  reason: string;
  reference_no: string;
  notes: string;
}

const ADJUSTMENT_TYPES = [
  { value: 'INCREASE', label: '재고 증가' },
  { value: 'DECREASE', label: '재고 감소' },
  { value: 'SET', label: '재고 설정' }
];

const ADJUSTMENT_REASONS = [
  '실사 조정',
  '손상품 처리',
  '유통기한 만료',
  '도난/분실',
  '시스템 오류 수정',
  '공정 손실',
  '기타'
];

export default function StockAdjustmentForm({ onSubmit, onCancel }: StockAdjustmentFormProps) {
  const [formData, setFormData] = useState<FormData>({
    item_id: null,
    adjustment_type: 'INCREASE',
    quantity: 0,
    reason: '',
    reference_no: '',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedItemStock, setSelectedItemStock] = useState<{
    current_stock: number;
    unit: string;
    item_code: string;
    item_name: string;
  } | null>(null);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.item_id) {
      newErrors.item_id = '품목을 선택해주세요.';
    }

    if (!formData.quantity || formData.quantity === 0) {
      newErrors.quantity = '조정 수량을 입력해주세요.';
    } else if (formData.quantity < 0) {
      newErrors.quantity = '수량은 0보다 커야 합니다.';
    }

    if (!formData.reason) {
      newErrors.reason = '조정 사유를 선택해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Add created_by (임시로 1로 설정 - 실제로는 로그인한 사용자 ID 사용)
    const submitData = {
      ...formData,
      created_by: 1
    };

    onSubmit(submitData);
  };

  const handleItemSelect = (item: ItemForComponent | null) => {
    if (!item) {
      setSelectedItemStock(null);
      return;
    }
    setFormData(prev => ({
      ...prev,
      item_id: item.item_id
    }));
    if (errors.item_id) {
      setErrors(prev => ({ ...prev, item_id: '' }));
    }
    // 선택된 품목의 현재재고 정보 저장
    setSelectedItemStock({
      current_stock: item.current_stock || 0,
      unit: item.unit || 'EA',
      item_code: item.item_code,
      item_name: item.item_name || item.name || ''
    });
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setFormData(prev => ({
      ...prev,
      quantity: value
    }));
    if (errors.quantity) {
      setErrors(prev => ({ ...prev, quantity: '' }));
    }
  };

  const handleReasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      reason: e.target.value
    }));
    if (errors.reason) {
      setErrors(prev => ({ ...prev, reason: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 품목 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          품목 <span className="text-gray-500">*</span>
        </label>
        <ItemSelect
          onChange={handleItemSelect}
          placeholder="품목을 선택하세요"
          showPrice={true}
        />
        {errors.item_id && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{errors.item_id}</p>
        )}
        {/* 현재재고 정보 표시 */}
        {selectedItemStock && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
              현재재고 정보
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <span className="font-medium">{selectedItemStock.item_code}</span>
              {selectedItemStock.item_name && (
                <span className="text-gray-600 dark:text-gray-400 ml-2">
                  {selectedItemStock.item_name}
                </span>
              )}
            </div>
            <div className="text-base font-semibold text-blue-900 dark:text-blue-100 mt-2">
              현재재고: {selectedItemStock.current_stock.toLocaleString('ko-KR')} {selectedItemStock.unit}
            </div>
          </div>
        )}
      </div>

      {/* 조정 유형 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          조정 유형 <span className="text-gray-500">*</span>
        </label>
        <select
          value={formData.adjustment_type}
          onChange={(e) => setFormData(prev => ({ ...prev, adjustment_type: e.target.value as any }))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        >
          {ADJUSTMENT_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* 수량 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          수량 <span className="text-gray-500">*</span>
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.quantity || ''}
            onChange={handleQuantityChange}
            placeholder="조정할 수량을 입력하세요"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          {selectedItemStock && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
              <span className="text-xs text-gray-600 dark:text-gray-400">현재재고:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedItemStock.current_stock.toLocaleString('ko-KR')} {selectedItemStock.unit}
              </span>
            </div>
          )}
        </div>
        {formData.adjustment_type === 'SET' && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            ⓘ 현재 재고를 이 값으로 설정합니다.
            {selectedItemStock && ` (현재: ${selectedItemStock.current_stock.toLocaleString('ko-KR')} ${selectedItemStock.unit})`}
          </p>
        )}
        {selectedItemStock && formData.quantity > 0 && (
          <div className="mt-2 text-sm">
            {formData.adjustment_type === 'INCREASE' && (
              <span className="text-green-600 dark:text-green-400">
                → 조정 후 예상 재고: {(selectedItemStock.current_stock + formData.quantity).toLocaleString('ko-KR')} {selectedItemStock.unit}
              </span>
            )}
            {formData.adjustment_type === 'DECREASE' && (
              <span className={`${selectedItemStock.current_stock - formData.quantity >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                → 조정 후 예상 재고: {Math.max(0, selectedItemStock.current_stock - formData.quantity).toLocaleString('ko-KR')} {selectedItemStock.unit}
                {selectedItemStock.current_stock - formData.quantity < 0 && (
                  <span className="ml-2 font-medium">⚠️ 재고가 부족합니다!</span>
                )}
              </span>
            )}
            {formData.adjustment_type === 'SET' && (
              <span className="text-blue-600 dark:text-blue-400">
                → 설정 후 재고: {formData.quantity.toLocaleString('ko-KR')} {selectedItemStock.unit}
              </span>
            )}
          </div>
        )}
        {errors.quantity && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{errors.quantity}</p>
        )}
      </div>

      {/* 조정 사유 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          조정 사유 <span className="text-gray-500">*</span>
        </label>
        <select
          value={formData.reason}
          onChange={handleReasonChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        >
          <option value="">사유를 선택하세요</option>
          {ADJUSTMENT_REASONS.map(reason => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </select>
        {errors.reason && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{errors.reason}</p>
        )}
      </div>

      {/* 참조번호 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          참조번호
        </label>
        <input
          type="text"
          value={formData.reference_no}
          onChange={(e) => setFormData(prev => ({ ...prev, reference_no: e.target.value }))}
          placeholder="참조번호 (선택사항)"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
      </div>

      {/* 비고 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          비고
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="추가 설명이나 비고사항을 입력하세요"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
        />
      </div>

      {/* 버튼 */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
          취소
        </button>
        <button
          type="submit"
          className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          조정 등록
        </button>
      </div>
    </form>
  );
}