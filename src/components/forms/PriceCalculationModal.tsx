'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Calculator
} from 'lucide-react';
import { useToastNotification } from '@/hooks/useToast';

export interface PriceCalcResult {
  base_price: number;
  new_price: number;
  increase_rate: number;
  increase_amount: number;
  rounding_unit: number;
}

interface PriceCalculationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (result: PriceCalcResult) => void;
  basePrice?: number;
  itemName?: string;
}

export default function PriceCalculationModal({
  isOpen,
  onClose,
  onSubmit,
  basePrice = 0,
  itemName = '품목'
}: PriceCalculationModalProps) {
  const toast = useToastNotification();

  const [formData, setFormData] = useState({
    base_price: basePrice,
    increase_rate: 0,
    rounding_unit: 1,
    min_price: 0,
    max_price: 0
  });

  const [showWarning, setShowWarning] = useState(false);

  // Reset form when modal opens with new basePrice
  useEffect(() => {
    if (isOpen) {
      setFormData({
        base_price: basePrice,
        increase_rate: 0,
        rounding_unit: 1,
        min_price: 0,
        max_price: 0
      });
      setShowWarning(false);
    }
  }, [isOpen, basePrice]);

  const calculatePrice = () => {
    if (formData.base_price <= 0) return 0;

    // Apply percentage increase
    const increased = formData.base_price * (1 + formData.increase_rate / 100);

    // Apply rounding
    const rounded = Math.round(increased / formData.rounding_unit) * formData.rounding_unit;

    // Apply constraints
    let final = rounded;
    if (formData.min_price > 0 && final < formData.min_price) {
      final = formData.min_price;
    }
    if (formData.max_price > 0 && final > formData.max_price) {
      final = formData.max_price;
    }

    return final;
  };

  const newPrice = calculatePrice();
  const increaseAmount = newPrice - formData.base_price;

  // Check for warnings
  useEffect(() => {
    setShowWarning(formData.increase_rate > 100 || formData.increase_rate < -100);
  }, [formData.increase_rate]);

  const handleSubmit = () => {
    // Validation
    if (formData.base_price <= 0) {
      toast.입력오류('기준 가격은 0보다 커야 합니다.');
      return;
    }

    if (newPrice <= 0) {
      toast.입력오류('계산된 가격이 0 이하입니다. 인상률을 조정하세요.');
      return;
    }

    if (formData.increase_rate > 100) {
      // Show confirmation warning but allow
      toast.경고('인상률이 100%를 초과합니다. 확인 후 진행하세요.');
    }

    // Submit result
    onSubmit({
      base_price: formData.base_price,
      new_price: newPrice,
      increase_rate: formData.increase_rate,
      increase_amount: increaseAmount,
      rounding_unit: formData.rounding_unit
    });

    toast.저장완료('가격 계산이 완료되었습니다.');
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-lg">
              <Calculator className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">가격 계산</h2>
              {itemName && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{itemName}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-6">
          {/* Base Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              기준 가격 <span className="text-gray-500">*</span>
            </label>
            <input
              type="number"
              value={formData.base_price}
              onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0"
              min="0"
              step="100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              현재 가격: {formData.base_price.toLocaleString('ko-KR')}원
            </p>
          </div>

          {/* Increase Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              인상률 (%) <span className="text-gray-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.increase_rate}
                onChange={(e) => setFormData({ ...formData, increase_rate: parseFloat(e.target.value) || 0 })}
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.0"
                step="0.1"
              />
              <TrendingUp className={`w-5 h-5 ${formData.increase_rate >= 0 ? 'text-gray-500' : 'text-gray-500'}`} />
            </div>
            {showWarning && (
              <div className="flex items-center gap-2 mt-2 text-gray-600 dark:text-gray-400 text-sm">
                
                <span>인상률이 ±100%를 초과합니다</span>
              </div>
            )}
          </div>

          {/* Rounding Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              반올림 단위
            </label>
            <select
              value={formData.rounding_unit}
              onChange={(e) => setFormData({ ...formData, rounding_unit: parseInt(e.target.value) })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={1}>1원 단위</option>
              <option value={10}>10원 단위</option>
              <option value={100}>100원 단위</option>
              <option value={1000}>1,000원 단위</option>
              <option value={10000}>10,000원 단위</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              계산된 가격을 선택한 단위로 반올림합니다
            </p>
          </div>

          {/* Min/Max Price (Optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                최소 가격 (선택)
              </label>
              <input
                type="number"
                value={formData.min_price || ''}
                onChange={(e) => setFormData({ ...formData, min_price: parseFloat(e.target.value) || 0 })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                min="0"
                step="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                최대 가격 (선택)
              </label>
              <input
                type="number"
                value={formData.max_price || ''}
                onChange={(e) => setFormData({ ...formData, max_price: parseFloat(e.target.value) || 0 })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                min="0"
                step="100"
              />
            </div>
          </div>

          {/* Preview Section */}
          <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100 mb-3">
              <Calculator className="w-4 h-4" />
              계산 미리보기
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">기준 가격:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formData.base_price.toLocaleString('ko-KR')}원
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">인상률:</span>
                <span className={`font-medium ${formData.increase_rate >= 0 ? 'text-gray-600' : 'text-gray-600'}`}>
                  {formData.increase_rate >= 0 ? '+' : ''}{formData.increase_rate.toFixed(2)}%
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">인상 금액:</span>
                <span className={`font-medium ${increaseAmount >= 0 ? 'text-gray-600' : 'text-gray-600'}`}>
                  {increaseAmount >= 0 ? '+' : ''}{increaseAmount.toLocaleString('ko-KR')}원
                </span>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">계산된 가격:</span>
                  <span className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    {newPrice.toLocaleString('ko-KR')}원
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={formData.base_price <= 0 || newPrice <= 0}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
