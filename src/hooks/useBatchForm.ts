import { useState, useCallback } from 'react';

/**
 * useBatchForm - 배치 등록 폼 상태 관리 커스텀 훅
 *
 * 목적: BatchRegistrationForm의 상태 관리 로직을 분리하여 재사용성과 테스트 가능성 향상
 *
 * 기능:
 * - 배치 기본 정보 상태 관리
 * - 품목 목록 동적 추가/삭제
 * - 폼 검증
 * - 제출 로직
 */

export interface BatchItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price?: number;
  lot_number?: string;
  notes?: string;
}

export interface BatchFormData {
  batch_number: string;
  batch_date: string;
  operation_type: 'RECEIVING' | 'PRODUCTION' | 'SHIPPING';
  company_id?: string;
  total_quantity: number;
  notes?: string;
  items: BatchItem[];
}

interface ValidationError {
  field: string;
  message: string;
}

interface UseBatchFormOptions {
  onSubmit?: (data: BatchFormData) => Promise<void>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useBatchForm(options: UseBatchFormOptions = {}) {
  const [formData, setFormData] = useState<BatchFormData>({
    batch_number: '',
    batch_date: new Date().toISOString().split('T')[0],
    operation_type: 'PRODUCTION',
    total_quantity: 0,
    items: []
  });

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * 필드 업데이트
   */
  const updateField = useCallback(<K extends keyof BatchFormData>(
    field: K,
    value: BatchFormData[K]
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field
    setErrors(prev => prev.filter(err => err.field !== field));
  }, []);

  /**
   * 품목 추가
   */
  const addItem = useCallback(() => {
    const newItem: BatchItem = {
      item_id: '',
      item_name: '',
      quantity: 0,
      unit: 'EA'
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  }, []);

  /**
   * 품목 업데이트
   */
  const updateItem = useCallback(<K extends keyof BatchItem>(
    index: number,
    field: K,
    value: BatchItem[K]
  ) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = {
        ...newItems[index],
        [field]: value
      };

      // Recalculate total quantity
      const totalQuantity = newItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

      return {
        ...prev,
        items: newItems,
        total_quantity: totalQuantity
      };
    });

    // Clear error for this item field
    setErrors(prev => prev.filter(err => err.field !== `items.${index}.${field}`));
  }, []);

  /**
   * 품목 삭제
   */
  const removeItem = useCallback((index: number) => {
    setFormData(prev => {
      const newItems = prev.items.filter((_, i) => i !== index);
      const totalQuantity = newItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

      return {
        ...prev,
        items: newItems,
        total_quantity: totalQuantity
      };
    });

    // Clear errors for this item
    setErrors(prev => prev.filter(err => !err.field.startsWith(`items.${index}.`)));
  }, []);

  /**
   * 폼 검증
   */
  const validate = useCallback((): boolean => {
    const newErrors: ValidationError[] = [];

    // Batch number validation
    if (!formData.batch_number.trim()) {
      newErrors.push({
        field: 'batch_number',
        message: '배치 번호는 필수입니다'
      });
    }

    // Batch date validation
    if (!formData.batch_date) {
      newErrors.push({
        field: 'batch_date',
        message: '배치 일자는 필수입니다'
      });
    }

    // Items validation
    if (formData.items.length === 0) {
      newErrors.push({
        field: 'items',
        message: '최소 1개 이상의 품목을 추가해야 합니다'
      });
    }

    // Each item validation
    formData.items.forEach((item, index) => {
      if (!item.item_id) {
        newErrors.push({
          field: `items.${index}.item_id`,
          message: `품목 ${index + 1}: 품목을 선택해주세요`
        });
      }

      if (!item.quantity || item.quantity <= 0) {
        newErrors.push({
          field: `items.${index}.quantity`,
          message: `품목 ${index + 1}: 수량은 0보다 커야 합니다`
        });
      }

      if (!item.unit.trim()) {
        newErrors.push({
          field: `items.${index}.unit`,
          message: `품목 ${index + 1}: 단위는 필수입니다`
        });
      }
    });

    // Company validation for RECEIVING and SHIPPING
    if (['RECEIVING', 'SHIPPING'].includes(formData.operation_type) && !formData.company_id) {
      newErrors.push({
        field: 'company_id',
        message: '거래처는 필수입니다'
      });
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [formData]);

  /**
   * 폼 제출
   */
  const handleSubmit = useCallback(async () => {
    // Validate
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (options.onSubmit) {
        await options.onSubmit(formData);
      }

      if (options.onSuccess) {
        options.onSuccess();
      }

      // Reset form on success
      setFormData({
        batch_number: '',
        batch_date: new Date().toISOString().split('T')[0],
        operation_type: 'PRODUCTION',
        total_quantity: 0,
        items: []
      });
      setErrors([]);

    } catch (error) {
      if (options.onError) {
        options.onError(error as Error);
      }
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validate, options]);

  /**
   * 폼 리셋
   */
  const reset = useCallback(() => {
    setFormData({
      batch_number: '',
      batch_date: new Date().toISOString().split('T')[0],
      operation_type: 'PRODUCTION',
      total_quantity: 0,
      items: []
    });
    setErrors([]);
  }, []);

  /**
   * 특정 필드의 에러 가져오기
   */
  const getFieldError = useCallback((field: string): string | undefined => {
    return errors.find(err => err.field === field)?.message;
  }, [errors]);

  return {
    // State
    formData,
    errors,
    isSubmitting,

    // Field operations
    updateField,

    // Item operations
    addItem,
    updateItem,
    removeItem,

    // Form operations
    validate,
    handleSubmit,
    reset,
    getFieldError
  };
}
