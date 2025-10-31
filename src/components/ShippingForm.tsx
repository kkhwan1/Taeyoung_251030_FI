'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save,
  Loader2,
  Calendar,
  Building2,
  Plus,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import {
  CompanyForComponent,
  Product,
  ShippingItem,
  ShippingFormData,
  ShippingFormProps,
  ItemForComponent as Item
} from '@/types/inventory';
import { Database } from '@/types/supabase';
import ItemSelect from '@/components/ItemSelect';
import CompanySelect from '@/components/CompanySelect';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useToastNotification } from '@/hooks/useToast';

// Company type from unified Supabase layer
type Company = Database['public']['Tables']['companies']['Row'];

// Define a type alias for customer to maintain compatibility
type Customer = CompanyForComponent;

export default function ShippingForm({ onSubmit, onCancel }: ShippingFormProps) {
  const [formData, setFormData] = useState<ShippingFormData>({
    transaction_date: new Date().toISOString().split('T')[0],
    customer_id: undefined,
    items: [],
    reference_no: '',
    delivery_address: '',
    delivery_date: '',
    notes: '',
    created_by: 1 // Default user ID
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockCheckComplete, setStockCheckComplete] = useState(false);
  const [stockChecking, setStockChecking] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const toast = useToastNotification();

  // 재고 확인을 위한 debounce 타이머
  const stockCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // 최신 items를 참조하기 위한 ref
  const itemsRef = useRef(formData.items);
  useEffect(() => {
    itemsRef.current = formData.items;
  }, [formData.items]);

  // 재고 확인 함수를 메모이제이션하여 불필요한 재생성 방지
  const checkStockAvailability = useCallback(async () => {
    const currentItems = itemsRef.current;
    if (currentItems.length === 0) {
      setStockCheckComplete(false);
      return;
    }

    setStockChecking(true);
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const response = await safeFetchJson('/api/inventory/shipping/stock-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          items: currentItems.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity
          }))
        }),
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (response.success && response.data && response.data.stock_check_results) {
        const stockCheckResults = response.data.stock_check_results;
        
        // 최신 items 다시 가져오기 (동시 업데이트 방지)
        const latestItems = itemsRef.current;
        const updatedItems = latestItems.map(item => {
          const stockInfo = stockCheckResults.find((s: any) => s.item_id === item.item_id);
          if (stockInfo?.error) {
            // 에러가 있는 항목은 사용자에게 알림
            toast.warning('재고 확인 실패', `${item.item_name || item.item_code}: ${stockInfo.error}`);
          }
          return {
            ...item,
            current_stock: stockInfo?.current_stock ?? item.current_stock,
            sufficient_stock: stockInfo ? stockInfo.sufficient : item.sufficient_stock ?? false
          };
        });

        setFormData(prev => ({ ...prev, items: updatedItems }));
        setStockCheckComplete(true);
      } else {
        const errorMsg = response.error || '재고 확인에 실패했습니다.';
        toast.error('재고 확인 오류', errorMsg);
        setStockCheckComplete(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '재고 확인 중 오류가 발생했습니다.';
      toast.error('재고 확인 오류', errorMessage);
      setStockCheckComplete(false);
    } finally {
      setStockChecking(false);
    }
  }, [toast]);

  // Debounce된 재고 확인 함수
  const debouncedCheckStock = useDebounce(checkStockAvailability, 500);

  // items의 길이와 각 item의 핵심 정보를 추적하여 재고 확인
  const itemsKey = formData.items.map(item => `${item.item_id}:${item.quantity}`).join(',');
  
  // items가 변경될 때 debounced 재고 확인 실행
  useEffect(() => {
    if (formData.items.length > 0) {
      // Debounce된 재고 확인 실행
      debouncedCheckStock();
    } else {
      setStockCheckComplete(false);
      setStockChecking(false);
    }
  }, [itemsKey, debouncedCheckStock]);

  const fetchInitialData = async () => {
    try {
      // Import safeFetchAllJson utility
      const { safeFetchAllJson } = await import('@/lib/fetch-utils');

      // Fetch customers, products, and stock in parallel with timeout and retry
      const [customersData, productsData, stockData] = await safeFetchAllJson([
        { url: '/api/companies?type=CUSTOMER' },
        { url: '/api/items?type=PRODUCT' },
        { url: '/api/stock' }
      ], {
        timeout: 15000, // 15초 타임아웃
        maxRetries: 2,  // 최대 2회 재시도
        retryDelay: 1000 // 1초 간격
      });

      // Process customers data
      if (customersData.success) {
        setCustomers(customersData.data);
      } else {
        toast.warning('고객사 목록 불러오기 실패', customersData.error || '고객사 목록을 불러올 수 없습니다.');
      }

      // Process products and stock data
      if (productsData.success && stockData.success) {
        const stockMap = new Map(stockData.data.map((item: Record<string, any>) => [item.item_id, item.current_stock]));

        const productsWithStock = Array.isArray(productsData.data)
          ? productsData.data
              .filter((item: Product) => item.category === '제품')
              .map((item: Product) => ({
                ...item,
                current_stock: stockMap.get(item.id) || 0
              }))
          : [];

        setProducts(productsWithStock);
      } else {
        const errorMsg = !productsData.success ? productsData.error : 
                         !stockData.success ? stockData.error : '제품 목록을 불러올 수 없습니다.';
        toast.warning('제품 목록 불러오기 실패', errorMsg);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '초기 데이터를 불러오는 중 오류가 발생했습니다.';
      toast.error('데이터 로딩 오류', errorMessage);
    }
  };


  const handleChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'number' ? (value ? parseFloat(value) : 0) : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // 예정일이 변경되고 품목이 추가되어 있으면 해당 월의 단가를 자동으로 업데이트
    if ((name === 'delivery_date' || name === 'transaction_date') && formData.items.length > 0) {
      const targetDate = name === 'delivery_date' ? value : (name === 'transaction_date' ? value : formData.delivery_date || formData.transaction_date || '');
      if (targetDate) {
        // 모든 품목의 단가를 업데이트
        const updatedItems = await Promise.all(
          formData.items.map(async (shipItem) => {
            const monthlyPrice = await fetchMonthlyPrice(shipItem.item_id, targetDate);
            if (monthlyPrice > 0) {
              return {
                ...shipItem,
                unit_price: monthlyPrice,
                total_amount: shipItem.quantity * monthlyPrice,
                isMonthlyPriceApplied: true
              };
            }
            return {
              ...shipItem,
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

  // 예정일 기준 월별 단가 조회 함수 (에러 발생 시 폴백 처리)
  const fetchMonthlyPrice = async (itemId: number, dateString: string): Promise<number> => {
    try {
      // 날짜에서 YYYY-MM 형식 추출
      const month = dateString ? dateString.substring(0, 7) : new Date().toISOString().substring(0, 7);
      
      // Import safeFetchJson utility
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/price-history?month=${month}`, {}, {
        timeout: 10000, // 10초 타임아웃
        maxRetries: 2,  // 최대 2회 재시도
        retryDelay: 1000 // 1초 간격
      });

      if (result.success && result.data) {
        const priceItem = result.data.find((p: any) => p.item_id === itemId);
        if (priceItem && priceItem.unit_price) {
          return priceItem.unit_price;
        }
      }
    } catch (error) {
      // 월별 단가 조회 실패는 심각한 오류가 아니므로 조용히 처리 (폴백)
      // 기본 단가를 사용하도록 0 반환
    }
    return 0; // 0 반환 시 기본 단가 사용
  };

  const handleAddProduct = async (item: Item | null) => {
    if (!item) {
      toast.warning('제품 선택 오류', '유효하지 않은 제품입니다.');
      return;
    }

    // item_id 유효성 검사
    if (!item.item_id) {
      toast.error('제품 추가 오류', '제품 ID가 없습니다.');
      return;
    }

    // Check if product is already added
    const existingItem = formData.items.find(shipItem => shipItem.item_id === item.item_id);
    if (existingItem) {
      toast.warning('제품 중복', '이미 추가된 제품입니다.');
      return;
    }

    setAddingProduct(true);
    try {
      // 예정일이 있으면 해당 월의 단가를 조회, 없으면 현재 품목 단가 사용
      const targetDate = formData.delivery_date || formData.transaction_date || '';
      let unitPrice = item.unit_price || 0;
      let isMonthly = false;
      
      if (targetDate && item.item_id) {
        try {
          const monthlyPrice = await fetchMonthlyPrice(item.item_id, targetDate);
          if (monthlyPrice > 0) {
            unitPrice = monthlyPrice;
            isMonthly = true;
          }
        } catch (error) {
          // 월별 단가 조회 실패는 조용히 처리하고 기본 단가 사용
          console.warn('월별 단가 조회 실패, 기본 단가 사용:', error);
        }
      }

      const newItem: ShippingItem = {
        item_id: item.item_id,
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        unit: item.unit || 'EA',
        unit_price: unitPrice,
        current_stock: item.current_stock || 0,
        quantity: 1,
        total_amount: unitPrice,
        sufficient_stock: (item.current_stock || 0) >= 1,
        isMonthlyPriceApplied: isMonthly
      };

      setFormData(prev => ({
        ...prev,
        items: [...prev.items, newItem]
      }));

      setStockCheckComplete(false);
      
      // 제품 추가 성공 알림은 제품 목록에 표시되므로 생략
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '제품을 추가하는 중 오류가 발생했습니다.';
      toast.error('제품 추가 오류', errorMessage);
    } finally {
      setAddingProduct(false);
    }
  };

  const handleCustomerChange = (customerId: number | null, customer?: Company) => {
    // 고객사 정보 자동 입력
    setFormData(prev => ({
      ...prev,
      customer_id: customerId || undefined,
      // 고객사 주소를 배송주소로 자동 입력 (배송주소가 비어있을 때만)
      delivery_address: customer?.address && !prev.delivery_address ? customer.address : prev.delivery_address
    }));

    // Clear customer error
    if (errors.customer_id) {
      setErrors(prev => ({ ...prev, customer_id: '' }));
    }
  };

  const handleItemQuantityChange = (itemId: number, quantity: number) => {
    if (quantity < 0) {
      toast.warning('수량 오류', '수량은 0 이상이어야 합니다.');
      return;
    }

    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.item_id === itemId
          ? {
              ...item,
              quantity: quantity,
              total_amount: quantity * item.unit_price,
              sufficient_stock: item.current_stock >= quantity
            }
          : item
      )
    }));
    // 수량 변경 시 재고 확인은 debounce된 함수가 자동으로 처리
    setStockCheckComplete(false);
  };

  const handleItemUnitPriceChange = (itemId: number, unitPrice: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.item_id === itemId
          ? {
              ...item,
              unit_price: unitPrice,
              total_amount: item.quantity * unitPrice,
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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.transaction_date) {
      newErrors.transaction_date = '출고일자는 필수입니다';
    }

    if (formData.items.length === 0) {
      newErrors.items = '출고할 제품을 하나 이상 추가해주세요';
    }

    // Check if any item has insufficient stock
    const insufficientItems = formData.items.filter(item => !item.sufficient_stock || item.current_stock < item.quantity);
    if (insufficientItems.length > 0) {
      newErrors.stock = '재고가 부족한 제품이 있습니다. 수량을 확인해주세요.';
    }

    // Check if any item has zero or negative quantity
    const invalidQuantityItems = formData.items.filter(item => item.quantity <= 0);
    if (invalidQuantityItems.length > 0) {
      newErrors.quantity = '모든 제품의 수량이 0보다 커야 합니다';
    }

    if (formData.delivery_date && formData.delivery_date < formData.transaction_date) {
      newErrors.delivery_date = '배송일은 출고일자보다 뒤여야 합니다';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      // 유효성 검사 실패 시 에러 메시지 표시
      if (errors.items) {
        toast.warning('입력 오류', errors.items);
      } else if (errors.stock) {
        toast.warning('재고 확인', errors.stock);
      } else if (errors.quantity) {
        toast.warning('수량 오류', errors.quantity);
      }
      return;
    }

    // 최종 재고 확인이 완료되지 않았다면 한 번 더 확인
    if (!stockCheckComplete && formData.items.length > 0) {
      toast.warning('재고 확인 필요', '제출 전에 재고 확인을 완료해주세요.');
      return;
    }

    setLoading(true);
    try {
      const submissionData = {
        ...formData,
        created_by: 1 // Default user ID, should be from auth context
      };

      // Remove empty optional fields
      Object.keys(submissionData).forEach(key => {
        if (key !== 'items' && (submissionData[key as keyof typeof submissionData] === '' ||
            submissionData[key as keyof typeof submissionData] === undefined)) {
          delete submissionData[key as keyof typeof submissionData];
        }
      });

      await onSubmit(submissionData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '출고 등록 중 오류가 발생했습니다.';
      toast.error('출고 등록 실패', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const generateShippingOrder = () => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
    return `SHP-${timestamp}`;
  };

  const handleGenerateReference = () => {
    setFormData(prev => ({
      ...prev,
      reference_no: generateShippingOrder()
    }));
  };

  const calculateTotalAmount = () => {
    return formData.items.reduce((total, item) => total + item.total_amount, 0);
  };

  const hasInsufficientStock = () => {
    return formData.items.some(item => !item.sufficient_stock || item.current_stock < item.quantity);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 출고일자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            출고 예정일 <span className="text-gray-500">*</span>
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

        {/* 고객사 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Building2 className="w-4 h-4 inline mr-2" />
            고객사
          </label>
          <CompanySelect
            value={formData.customer_id}
            onChange={handleCustomerChange}
            companyType="CUSTOMER"
            placeholder="고객사를 선택하세요"
            required={false}
            error={errors.customer_id}
          />
        </div>

        {/* 출고번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            
            출고번호
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="reference_no"
              value={formData.reference_no}
              onChange={handleChange}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: SHP-20240101001"
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

        {/* 배송일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            배송 예정일
          </label>
          <input
            type="date"
            name="delivery_date"
            value={formData.delivery_date}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.delivery_date ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
          />
          {errors.delivery_date && (
            <p className="mt-1 text-sm text-gray-500">{errors.delivery_date}</p>
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
      </div>

      {/* Product Search and Selection */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ItemSelect
            key={`item-select-${formData.items.length}`}
            onChange={handleAddProduct}
            label="출고 제품 추가"
            placeholder="제품 품번 또는 품명으로 검색하여 추가..."
            required={true}
            showPrice={true}
            itemType="PRODUCT"
            className="flex-1"
            error={errors.items}
            disabled={addingProduct}
          />
          {addingProduct && (
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>추가 중...</span>
            </div>
          )}
        </div>
        {errors.items && (
          <div className="mt-1 flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span>{errors.items}</span>
          </div>
        )}
      </div>

      {/* Selected Items */}
      {formData.items.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
              출고 제품 목록
            </h4>
            <div className="flex items-center gap-2">
              {stockChecking && (
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>재고 확인 중...</span>
                </div>
              )}
              {!stockCheckComplete && !stockChecking && (
                <button
                  type="button"
                  onClick={checkStockAvailability}
                  className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  재고 확인
                </button>
              )}
              {stockCheckComplete && (
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  <span>재고 확인 완료</span>
                </div>
              )}
            </div>
          </div>

          {hasInsufficientStock() && stockCheckComplete && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  일부 제품의 재고가 부족합니다
                </span>
              </div>
            </div>
          )}

          {errors.stock && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">{errors.stock}</p>
            </div>
          )}

          {errors.quantity && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">{errors.quantity}</p>
            </div>
          )}

          <div className="space-y-3">
            {formData.items.map((item) => (
              <div
                key={item.item_id}
                className={`p-4 border rounded-lg ${
                  stockCheckComplete && !item.sufficient_stock
                    ? 'border-gray-300 bg-gray-50 dark:bg-gray-900/10'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.item_code} - {item.item_name}
                      </span>
                      {stockCheckComplete && item.sufficient_stock && (
                        <CheckCircle className="w-4 h-4 text-gray-500" />
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                          현재고
                        </label>
                        <span className="text-sm text-gray-900 dark:text-white">
                          {item.current_stock.toLocaleString()} {item.unit}
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          합계금액
                        </label>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          ₩{item.total_amount.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {stockCheckComplete && !item.sufficient_stock && (
                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        재고 부족: 필요 {item.quantity.toLocaleString()}{item.unit},
                        보유 {item.current_stock.toLocaleString()}{item.unit}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.item_id)}
                    className="ml-4 p-1 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Total Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                총 출고 금액:
              </span>
              <span className="text-lg font-bold text-gray-600 dark:text-gray-400">
                ₩{calculateTotalAmount().toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 출고 요약 */}
      {formData.items.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            출고 요약
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">품목 수:</span>
              <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                {formData.items.length}개
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">총 수량:</span>
              <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                {formData.items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">총 금액:</span>
              <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                ₩{calculateTotalAmount().toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 메모 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          메모
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="출고 관련 특이사항이나 메모를 입력하세요"
        />
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
          disabled={loading || hasInsufficientStock() || formData.items.length === 0}
          className="flex items-center gap-2 px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              출고 중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              출고 등록
            </>
          )}
        </button>
      </div>
    </form>
  );
}