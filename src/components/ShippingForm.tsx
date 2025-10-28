'use client';

import { useState, useEffect } from 'react';
import {
  Save,
  Loader2,
  Calendar,
  Building2,
  Plus,
  X,
  CheckCircle
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

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (formData.items.length > 0) {
      checkStockAvailability();
    } else {
      setStockCheckComplete(false);
    }
  }, [formData.items]);

  const fetchInitialData = async () => {
    try {
      // Fetch customers (companies with type CUSTOMER or BOTH)
      const customersResponse = await fetch('/api/companies?type=CUSTOMER');
      const customersData = await customersResponse.json();
      if (customersData.success) {
        setCustomers(customersData.data);
      }

      // Fetch products only
      const productsResponse = await fetch('/api/items?type=PRODUCT');
      const productsData = await productsResponse.json();
      if (productsData.success) {
        // Get current stock for each product
        const stockResponse = await fetch('/api/stock');
        const stockData = await stockResponse.json();
        if (stockData.success) {
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
        }
      }
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    }
  };

  const checkStockAvailability = async () => {
    try {
      const response = await fetch('/api/inventory/shipping/stock-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          items: formData.items.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity
          }))
        }),
      });

      const data = await response.json();
      if (data.success && data.data && data.data.stock_check_results) {
        const stockCheckResults = data.data.stock_check_results;
        const updatedItems = formData.items.map(item => {
          const stockInfo = stockCheckResults.find((s: any) => s.item_id === item.item_id);
          return {
            ...item,
            current_stock: stockInfo?.current_stock || 0,
            sufficient_stock: stockInfo ? stockInfo.sufficient : false
          };
        });

        setFormData(prev => ({ ...prev, items: updatedItems }));
        setStockCheckComplete(true);
      } else {
        console.error('Invalid stock check response:', data);
        setStockCheckComplete(false);
      }
    } catch (error) {
      console.error('Failed to check stock availability:', error);
      setStockCheckComplete(false);
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

  const handleAddProduct = (item: Item | null) => {
    if (!item) return;

    // Check if product is already added
    const existingItem = formData.items.find(shipItem => shipItem.item_id === item.item_id);
    if (existingItem) {
      alert('이미 추가된 제품입니다.');
      return;
    }

    const newItem: ShippingItem = {
      item_id: item.item_id,
      item_code: item.item_code,
      item_name: item.item_name,
      unit: item.unit,
      unit_price: item.unit_price || 0,
      current_stock: item.current_stock || 0,
      quantity: 1,
      total_amount: item.unit_price || 0,
      sufficient_stock: (item.current_stock || 0) >= 1
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    setStockCheckComplete(false);
  };

  const handleCustomerChange = (customerId: number | null, customer?: Company) => {
    setFormData(prev => ({ ...prev, customer_id: customerId || undefined }));

    // Clear customer error
    if (errors.customer_id) {
      setErrors(prev => ({ ...prev, customer_id: '' }));
    }
  };

  const handleItemQuantityChange = (itemId: number, quantity: number) => {
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
              total_amount: item.quantity * unitPrice
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
    if (!validate()) return;

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
            출고일자 <span className="text-gray-500">*</span>
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
        <ItemSelect
          onChange={handleAddProduct}
          label="출고 제품 추가"
          placeholder="제품 품번 또는 품명으로 검색하여 추가..."
          required={true}
          showPrice={true}
          itemType="PRODUCT"
          className=""
          error={errors.items}
        />
      </div>

      {/* Selected Items */}
      {formData.items.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
              출고 제품 목록
            </h4>
            {!stockCheckComplete && (
              <button
                type="button"
                onClick={checkStockAvailability}
                className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                재고 확인
              </button>
            )}
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
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => handleItemUnitPriceChange(item.item_id, parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
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
            <div className="flex justify-between items-center">
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