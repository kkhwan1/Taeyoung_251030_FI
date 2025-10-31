'use client';

import { useState, useEffect } from 'react';
import {
  Save,
  Loader2,
  Calendar,
  CheckCircle,
  Factory,
  Wrench
} from 'lucide-react';
import {
  Product,
  BOMItem,
  ProductionFormData,
  ProductionFormProps,
  ItemForComponent as Item,
  ProductionResponse,
  AutoDeduction
} from '@/types/inventory';
import ItemSelect from '@/components/ItemSelect';
import { useBomCheck } from '@/lib/hooks/useBomCheck';
import { useDebounce } from '@/lib/hooks/useDebounce';
import BOMPreviewPanel from '@/components/inventory/BOMPreviewPanel';

export default function ProductionForm({ onSubmit, onCancel }: ProductionFormProps) {
  const [formData, setFormData] = useState<ProductionFormData>({
    transaction_date: new Date().toISOString().split('T')[0],
    product_item_id: 0,
    quantity: 0,
    reference_no: '',
    notes: '',
    use_bom: true,
    scrap_quantity: 0,
    created_by: 1 // Default user ID
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [productionResult, setProductionResult] = useState<ProductionResponse | null>(null);
  const [savedBomCheckData, setSavedBomCheckData] = useState<any>(null);

  // New hooks for BOM checking with debounce
  const { data: bomCheckData, loading: bomLoading, error: bomError, checkBom } = useBomCheck();
  const debouncedCheckBom = useDebounce(checkBom, 500);

  // Real-time BOM check when product or quantity changes
  useEffect(() => {
    if (selectedProduct && formData.quantity > 0 && formData.use_bom) {
      const productId = selectedProduct.item_id || selectedProduct.id;
      if (productId > 0) {
        debouncedCheckBom(productId, formData.quantity);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, formData.quantity, formData.use_bom]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? (value ? parseFloat(value) : 0) : value
    }));

    // Clear error when field is modified
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleProductSelect = (item: Item | null) => {
    if (item) {
      const product = item as Product;
      const productId = product.item_id || product.id;
      
      setSelectedProduct({ ...product, item_id: productId, id: productId } as Product);
      setFormData(prev => ({
        ...prev,
        product_item_id: productId
      }));

      // Clear product selection error
      if (errors.product_item_id) {
        setErrors(prev => ({ ...prev, product_item_id: '' }));
      }
    } else {
      setSelectedProduct(null);
      setFormData(prev => ({ ...prev, product_item_id: 0 }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.transaction_date) {
      newErrors.transaction_date = '생산일자는 필수입니다';
    }

    if (!formData.product_item_id || formData.product_item_id === 0) {
      newErrors.product_item_id = '생산할 제품을 선택해주세요';
    }

    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = '생산수량은 0보다 커야 합니다';
    }

    if (formData.scrap_quantity && formData.scrap_quantity < 0) {
      newErrors.scrap_quantity = '스크랩 수량은 0 이상이어야 합니다';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Show confirmation modal with BOM preview
    setShowConfirmModal(true);
  };

  const handleConfirmProduction = async () => {
    setShowConfirmModal(false);
    setLoading(true);

    try {
      // API가 기대하는 형식으로 데이터 변환
      const itemId = selectedProduct?.item_id || selectedProduct?.id || formData.product_item_id;
      
      // 데이터 타입 강제 변환
      const parsedQuantity = Math.floor(Number(formData.quantity)); // 정수로 강제 변환
      const parsedUnitPrice = parseFloat(
        String(selectedProduct?.price || selectedProduct?.unit_price || 0)
      ); // 명시적 변환 및 기본값 보장
      
      const submissionData: ProductionFormData = {
        transaction_date: formData.transaction_date,
        product_item_id: itemId,
        quantity: parsedQuantity,
        reference_no: formData.reference_no,
        notes: formData.notes,
        use_bom: formData.use_bom,
        scrap_quantity: formData.scrap_quantity,
        created_by: 1 // Default user ID
      };

      // Remove empty optional fields
      Object.keys(submissionData).forEach(key => {
        if (submissionData[key as keyof typeof submissionData] === '' ||
            submissionData[key as keyof typeof submissionData] === undefined) {
          delete submissionData[key as keyof typeof submissionData];
        }
      });

      const result = await onSubmit(submissionData);

      // Show result modal with auto-deduction details
      setProductionResult(result);
      setSavedBomCheckData(bomCheckData); // Save BOM check data for result modal
      setShowResultModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshBom = () => {
    if (selectedProduct && formData.quantity > 0) {
      checkBom(selectedProduct.id, formData.quantity);
    }
  };

  const generateProductionOrder = () => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
    return `PRD-${timestamp}`;
  };

  const handleGenerateReference = () => {
    setFormData(prev => ({
      ...prev,
      reference_no: generateProductionOrder()
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 생산일자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            생산일자 <span className="text-gray-500">*</span>
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

        {/* 생산오더 번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Factory className="w-4 h-4 inline mr-2" />
            생산오더 번호
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="reference_no"
              value={formData.reference_no}
              onChange={handleChange}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: PRD-20240101001"
            />
            <button
              type="button"
              onClick={handleGenerateReference}
              className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              title="자동 생성"
            >
              <Wrench className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 제품 검색 */}
        <div className="md:col-span-2">
          <ItemSelect
            value={formData.product_item_id > 0 ? formData.product_item_id : undefined}
            onChange={handleProductSelect}
            label="생산 제품"
            placeholder="제품 품번 또는 품명으로 검색..."
            required={true}
            error={errors.product_item_id}
            showPrice={true}
            itemType="PRODUCT"
          />
        </div>

        {/* 생산수량 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            생산수량 <span className="text-gray-500">*</span>
          </label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            min="0"
            step="0.01"
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.quantity ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            placeholder="0"
          />
          {selectedProduct && (
            <p className="mt-1 text-sm text-gray-500">단위: {selectedProduct.unit}</p>
          )}
          {errors.quantity && (
            <p className="mt-1 text-sm text-gray-500">{errors.quantity}</p>
          )}
        </div>

        {/* 스크랩 수량 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            스크랩 수량
          </label>
          <input
            type="number"
            name="scrap_quantity"
            value={formData.scrap_quantity}
            onChange={handleChange}
            min="0"
            step="0.01"
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.scrap_quantity ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            placeholder="0"
          />
          {selectedProduct && (
            <p className="mt-1 text-sm text-gray-500">불량품 또는 스크랩 발생량</p>
          )}
          {errors.scrap_quantity && (
            <p className="mt-1 text-sm text-gray-500">{errors.scrap_quantity}</p>
          )}
        </div>

        {/* BOM 사용 여부 */}
        <div className="md:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="use_bom"
              checked={formData.use_bom}
              onChange={handleChange}
              className="w-4 h-4 text-gray-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              BOM(Bill of Materials)을 사용하여 자재 자동 차감
            </span>
          </label>
          <p className="mt-1 text-sm text-gray-500">
            체크 시 등록된 BOM에 따라 필요한 자재가 자동으로 출고됩니다.
          </p>
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
            placeholder="생산 관련 특이사항이나 메모를 입력하세요"
          />
        </div>
      </div>

      {/* BOM Preview Panel */}
      {formData.use_bom && selectedProduct && formData.quantity > 0 && (
        <BOMPreviewPanel
          bomCheckData={bomCheckData}
          loading={bomLoading}
          error={bomError}
          onRefresh={handleRefreshBom}
        />
      )}

      {/* Stock Error Display */}
      {errors.stock && (
        <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">{errors.stock}</p>
        </div>
      )}

      {/* Production Summary */}
      {selectedProduct && formData.quantity > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">생산 요약</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">제품:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {selectedProduct.item_code}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">수량:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {formData.quantity.toLocaleString()} {selectedProduct.unit}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">BOM 사용:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {formData.use_bom ? '예' : '아니오'}
              </span>
            </div>
            {formData.use_bom && bomCheckData && (
              <>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">재고 상태:</span>
                  <span className={`ml-2 font-medium ${bomCheckData.can_produce ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {bomCheckData.can_produce ? '충분' : '부족'}
                  </span>
                </div>
                {!bomCheckData.can_produce && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">최대 생산가능:</span>
                    <span className="ml-2 font-bold text-orange-600 dark:text-orange-400">
                      {bomCheckData.summary.max_producible_quantity}개
                    </span>
                  </div>
                )}
              </>
            )}
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
          disabled={loading || bomLoading}
          className="flex items-center gap-2 px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              생산 중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {formData.use_bom && bomCheckData && !bomCheckData.can_produce ? '재고 부족 - 그래도 생산 등록' : '생산 등록'}
            </>
          )}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && bomCheckData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                생산 확인
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                아래 정보를 확인하시고 생산을 진행해주세요.
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Production Details */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">생산 정보</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">생산일자:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {formData.transaction_date}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">생산오더:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {formData.reference_no || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">제품:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {bomCheckData.product_info.item_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">생산수량:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {formData.quantity.toLocaleString()} {bomCheckData.product_info.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* BOM Preview in Modal */}
              {formData.use_bom && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">자재 소요</h4>
                  <BOMPreviewPanel
                    bomCheckData={bomCheckData}
                    loading={false}
                    error={null}
                    onRefresh={handleRefreshBom}
                  />
                </div>
              )}

              {/* Warning if cannot produce */}
              {formData.use_bom && !bomCheckData.can_produce && (
                <div className="p-4 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    
                    <div>
                      <h5 className="font-medium text-gray-800 dark:text-gray-300 mb-1">
                        생산 불가능
                      </h5>
                      <p className="text-sm text-gray-700 dark:text-gray-400">
                        재고가 부족한 자재가 있어 현재 생산이 불가능합니다. 자재를 입고한 후 다시 시도해주세요.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmProduction}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                생산 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {showResultModal && productionResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-gray-500" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  생산 완료
                </h3>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                생산이 성공적으로 등록되었습니다.
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Production Result Summary */}
              <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">생산 결과</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">거래번호:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {productionResult.data.transaction?.transaction_no}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">생산수량:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {productionResult.data.transaction?.quantity.toLocaleString()} {productionResult.data.transaction?.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">제품재고 변화:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400 font-medium">
                      +{productionResult.data.transaction?.quantity.toLocaleString()} {productionResult.data.transaction?.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">등록일시:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {productionResult.data.transaction?.created_at ? new Date(productionResult.data.transaction.created_at).toLocaleString('ko-KR') : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stock Shortage Warning */}
              {productionResult.data.stock_warning && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-2">
                        재고 부족 경고
                      </h4>
                      <div className="space-y-1 text-sm text-orange-700 dark:text-orange-400">
                        <p>
                          현재 재고로는 <span className="font-bold">{productionResult.data.stock_warning.max_producible.toLocaleString()}</span>까지만 생산 가능합니다.
                        </p>
                        <p>
                          희망 수량: <span className="font-semibold">{formData.quantity.toLocaleString()}</span> → 
                          부족 수량: <span className="font-bold text-red-600 dark:text-red-400">{productionResult.data.stock_warning.shortage_quantity.toLocaleString()}</span>
                        </p>
                        {productionResult.data.stock_warning.bottleneck_materials && productionResult.data.stock_warning.bottleneck_materials.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-orange-600 dark:text-orange-500 font-medium mb-1">부족한 원자재:</p>
                            {productionResult.data.stock_warning.bottleneck_materials.map((item: any, idx: number) => (
                              <p key={idx} className="text-xs text-orange-600 dark:text-orange-500">
                                • {item.item_name} ({item.item_code}): 필요 {item.required.toLocaleString()} / 현재 {item.available.toLocaleString()}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Auto Deduction Details */}
              {productionResult.data.auto_deductions && productionResult.data.auto_deductions.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    자재 자동 차감 내역
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">품목코드</th>
                          <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">품목명</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">차감수량</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">차감 전</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">차감 후</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productionResult.data.auto_deductions?.map((deduction, index) => (
                          <tr key={index} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <td className="py-2 px-3 text-gray-900 dark:text-white font-mono text-xs">
                              {deduction.item_code}
                            </td>
                            <td className="py-2 px-3 text-gray-900 dark:text-white">
                              {deduction.item_name}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400 font-medium">
                              -{deduction.deducted_quantity.toLocaleString()} {deduction.unit}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                              {deduction.stock_before.toLocaleString()} {deduction.unit}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900 dark:text-white font-medium">
                              {deduction.stock_after.toLocaleString()} {deduction.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowResultModal(false);
                  setProductionResult(null);
                  onCancel(); // Close the form and return to list
                }}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}