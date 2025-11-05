'use client';

/**
 * ProcessOperationForm Component
 *
 * Form for creating and editing process operations (Blanking, Press, Assembly)
 * Handles input/output items, quantities, and stock validation
 */

import { useState, useEffect } from 'react';
import { Save, Loader2, Calendar, Package, User, Play, CheckCircle, XCircle } from 'lucide-react';
import ItemSelect from '@/components/ItemSelect';
import { ItemForComponent as Item } from '@/types/inventory';

type OperationType = 'BLANKING' | 'PRESS' | 'ASSEMBLY';
type OperationStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface ProcessOperation {
  operation_id?: number;
  operation_type: OperationType;
  input_item_id: number;
  output_item_id: number;
  input_quantity: number;
  output_quantity: number;
  status?: OperationStatus;
  operator_id?: string;
  notes?: string;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
}

interface ProcessOperationFormProps {
  operation?: ProcessOperation | null;
  onSave: (data: Partial<ProcessOperation>) => Promise<void>;
  onCancel: () => void;
}

const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  'BLANKING': 'Blanking 공정',
  'PRESS': 'Press 공정',
  'ASSEMBLY': '조립 공정'
};

export default function ProcessOperationForm({ operation, onSave, onCancel }: ProcessOperationFormProps) {
  const [formData, setFormData] = useState<Partial<ProcessOperation>>({
    operation_type: 'BLANKING',
    input_item_id: undefined,
    output_item_id: undefined,
    input_quantity: 0,
    output_quantity: 0,
    operator_id: '',
    notes: '',
    status: 'PENDING'
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [inputItemStock, setInputItemStock] = useState<number>(0);
  const [outputItemStock, setOutputItemStock] = useState<number>(0);

  useEffect(() => {
    if (operation) {
      setFormData({
        ...operation,
        operator_id: operation.operator_id || '',
        notes: operation.notes || ''
      });
    }
  }, [operation]);

  // 투입재료 재고 조회
  useEffect(() => {
    if (formData.input_item_id) {
      fetchItemStock(formData.input_item_id, 'input');
    }
  }, [formData.input_item_id]);

  // 산출제품 재고 조회
  useEffect(() => {
    if (formData.output_item_id) {
      fetchItemStock(formData.output_item_id, 'output');
    }
  }, [formData.output_item_id]);

  const fetchItemStock = async (itemId: number, type: 'input' | 'output') => {
    try {
      const response = await fetch(`/api/items/${itemId}`);
      const result = await response.json();

      if (result.success && result.data) {
        const stock = result.data.current_stock || 0;
        if (type === 'input') {
          setInputItemStock(stock);
        } else {
          setOutputItemStock(stock);
        }
      }
    } catch (error) {
      console.error('Failed to fetch item stock:', error);
    }
  };

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

  const handleInputItemChange = (item: Item | null) => {
    setFormData(prev => ({ ...prev, input_item_id: item?.item_id }));
    if (errors.input_item_id) {
      setErrors(prev => ({ ...prev, input_item_id: '' }));
    }
  };

  const handleOutputItemChange = (item: Item | null) => {
    setFormData(prev => ({ ...prev, output_item_id: item?.item_id }));
    if (errors.output_item_id) {
      setErrors(prev => ({ ...prev, output_item_id: '' }));
    }
  };

  // 수율 계산
  const calculateEfficiency = () => {
    if (formData.input_quantity && formData.output_quantity) {
      return ((formData.output_quantity / formData.input_quantity) * 100).toFixed(2);
    }
    return '0.00';
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.operation_type) {
      newErrors.operation_type = '공정유형을 선택해주세요';
    }

    if (!formData.input_item_id) {
      newErrors.input_item_id = '투입재료를 선택해주세요';
    }

    if (!formData.output_item_id) {
      newErrors.output_item_id = '산출제품을 선택해주세요';
    }

    if (!formData.input_quantity || formData.input_quantity <= 0) {
      newErrors.input_quantity = '투입수량을 입력해주세요';
    } else if (formData.input_quantity > inputItemStock) {
      newErrors.input_quantity = `재고 부족 (현재 재고: ${inputItemStock})`;
    }

    if (!formData.output_quantity || formData.output_quantity <= 0) {
      newErrors.output_quantity = '산출수량을 입력해주세요';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await onSave(formData);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: OperationStatus) => {
    if (!operation) return;

    setLoading(true);
    try {
      await onSave({ ...formData, status: newStatus });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 공정유형 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Package className="w-4 h-4 inline mr-2" />
            공정유형 <span className="text-red-500">*</span>
          </label>
          <select
            name="operation_type"
            value={formData.operation_type}
            onChange={handleChange}
            disabled={!!operation}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              errors.operation_type ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            required
          >
            {Object.entries(OPERATION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {errors.operation_type && (
            <p className="mt-1 text-sm text-red-500">{errors.operation_type}</p>
          )}
        </div>

        {/* 작업자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <User className="w-4 h-4 inline mr-2" />
            작업자
          </label>
          <input
            type="text"
            name="operator_id"
            value={formData.operator_id}
            onChange={handleChange}
            placeholder="작업자 ID 또는 이름"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 투입재료 */}
        <div>
          <ItemSelect
            value={formData.input_item_id}
            onChange={handleInputItemChange}
            label="투입재료"
            placeholder="원자재 (코일) 검색..."
            required={true}
            error={errors.input_item_id}
            itemType="RAW_MATERIAL"
          />
          {formData.input_item_id && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              현재 재고: {inputItemStock.toLocaleString('ko-KR')}
            </p>
          )}
        </div>

        {/* 산출제품 */}
        <div>
          <ItemSelect
            value={formData.output_item_id}
            onChange={handleOutputItemChange}
            label="산출제품"
            placeholder="반제품 또는 완제품 검색..."
            required={true}
            error={errors.output_item_id}
            itemType="ALL"
          />
          {formData.output_item_id && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              현재 재고: {outputItemStock.toLocaleString('ko-KR')}
            </p>
          )}
        </div>

        {/* 투입수량 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            투입수량 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="input_quantity"
            value={formData.input_quantity}
            onChange={handleChange}
            min="0"
            step="0.01"
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.input_quantity ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            required
          />
          {errors.input_quantity && (
            <p className="mt-1 text-sm text-red-500">{errors.input_quantity}</p>
          )}
        </div>

        {/* 산출수량 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            산출수량 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="output_quantity"
            value={formData.output_quantity}
            onChange={handleChange}
            min="0"
            step="0.01"
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.output_quantity ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            required
          />
          {errors.output_quantity && (
            <p className="mt-1 text-sm text-red-500">{errors.output_quantity}</p>
          )}
        </div>

        {/* 수율 (계산) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            수율
          </label>
          <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium">
            {calculateEfficiency()}%
          </div>
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
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="공정 관련 특이사항이나 메모를 입력하세요"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-between gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          {operation && operation.status === 'PENDING' && (
            <button
              type="button"
              onClick={() => handleStatusChange('IN_PROGRESS')}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              작업 시작
            </button>
          )}
          {operation && operation.status === 'IN_PROGRESS' && (
            <button
              type="button"
              onClick={() => handleStatusChange('COMPLETED')}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" />
              작업 완료
            </button>
          )}
          {operation && operation.status !== 'CANCELLED' && operation.status !== 'COMPLETED' && (
            <button
              type="button"
              onClick={() => handleStatusChange('CANCELLED')}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle className="w-4 h-4" />
              작업 취소
            </button>
          )}
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
                {operation ? '수정' : '등록'}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
