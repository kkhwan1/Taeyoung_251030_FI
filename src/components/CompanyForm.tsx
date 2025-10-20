'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';

interface Company {
  company_id?: number;
  company_name: string;
  company_type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  business_registration_no?: string;
  contact_person?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  address?: string;
  payment_terms?: number;
  notes?: string;
  is_active?: boolean;
  company_category?: string;
  business_info?: {
    business_type?: string;
    business_item?: string;
    main_products?: string;
  };
}

interface CompanyFormProps {
  company?: Company | null;
  onSubmit: (data: Company) => Promise<void>;
  onCancel: () => void;
}

export default function CompanyForm({ company, onSubmit, onCancel }: CompanyFormProps) {
  const [formData, setFormData] = useState<Company>({
    company_name: '',
    company_type: 'CUSTOMER',
    business_registration_no: '',
    contact_person: '',
    phone: '',
    mobile: '',
    email: '',
    address: '',
    payment_terms: 0,
    notes: '',
    is_active: true,
    company_category: '',
    business_info: {
      business_type: '',
      business_item: '',
      main_products: ''
    }
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (company) {
      setFormData(company);
    }
  }, [company]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseInt(value) : 0) : value
    }));
    // Clear error when field is modified
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleBusinessInfoChange = (field: 'business_type' | 'business_item' | 'main_products', value: string) => {
    setFormData(prev => ({
      ...prev,
      business_info: {
        ...prev.business_info,
        [field]: value
      }
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name.trim()) {
      newErrors.company_name = '거래처명은 필수입니다';
    }

    if (!formData.company_type) {
      newErrors.company_type = '거래처 타입은 필수입니다';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '올바른 이메일 형식을 입력해주세요';
    }

    if (formData.phone && !/^[\d-]+$/.test(formData.phone)) {
      newErrors.phone = '전화번호는 숫자와 하이픈(-)만 입력 가능합니다';
    }

    if (formData.mobile && !/^[\d-]+$/.test(formData.mobile)) {
      newErrors.mobile = '휴대폰번호는 숫자와 하이픈(-)만 입력 가능합니다';
    }

    if (formData.payment_terms && formData.payment_terms < 0) {
      newErrors.payment_terms = '결제조건은 0 이상이어야 합니다';
    }

    // Validate company_category if provided
    const validCategories = ['협력업체-원자재', '협력업체-외주', '소모품업체', '기타'];
    if (formData.company_category && !validCategories.includes(formData.company_category)) {
      newErrors.company_category = '올바른 거래처 분류를 선택해주세요';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit(formData);
      // 성공 시 자동으로 모달 닫기
      onCancel();
    } catch (error) {
      // 에러는 상위 컴포넌트에서 처리
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* 거래처명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            거래처명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="company_name"
            value={formData.company_name}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.company_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            placeholder="예: 현대자동차"
          />
          {errors.company_name && (
            <p className="mt-1 text-sm text-red-500">{errors.company_name}</p>
          )}
        </div>

        {/* 거래처 타입 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            거래처 타입 <span className="text-red-500">*</span>
          </label>
          <select
            name="company_type"
            value={formData.company_type}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.company_type ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            <option value="CUSTOMER">고객사</option>
            <option value="SUPPLIER">공급사</option>
            <option value="BOTH">고객사/공급사</option>
          </select>
          {errors.company_type && (
            <p className="mt-1 text-sm text-red-500">{errors.company_type}</p>
          )}
        </div>

        {/* 사업자등록번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            사업자등록번호
          </label>
          <input
            type="text"
            name="business_registration_no"
            value={formData.business_registration_no || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: 123-45-67890"
          />
        </div>

        {/* 담당자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            담당자
          </label>
          <input
            type="text"
            name="contact_person"
            value={formData.contact_person || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: 홍길동"
          />
        </div>

        {/* 전화번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            전화번호
          </label>
          <input
            type="text"
            name="phone"
            value={formData.phone || ''}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.phone ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            placeholder="예: 02-1234-5678"
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
          )}
        </div>

        {/* 휴대폰번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            휴대폰번호
          </label>
          <input
            type="text"
            name="mobile"
            value={formData.mobile || ''}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.mobile ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            placeholder="예: 010-1234-5678"
          />
          {errors.mobile && (
            <p className="mt-1 text-sm text-red-500">{errors.mobile}</p>
          )}
        </div>

        {/* 이메일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            이메일
          </label>
          <input
            type="email"
            name="email"
            value={formData.email || ''}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            placeholder="예: admin@company.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email}</p>
          )}
        </div>

        {/* 결제조건 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            결제조건 (일)
          </label>
          <input
            type="number"
            name="payment_terms"
            value={formData.payment_terms}
            onChange={handleChange}
            min="0"
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.payment_terms ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            placeholder="예: 30"
          />
          {errors.payment_terms && (
            <p className="mt-1 text-sm text-red-500">{errors.payment_terms}</p>
          )}
        </div>

        {/* 거래처 분류 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            거래처 분류
          </label>
          <select
            name="company_category"
            value={formData.company_category || ''}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.company_category ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            <option value="">선택 안함</option>
            <option value="협력업체-원자재">협력업체 (원자재)</option>
            <option value="협력업체-외주">협력업체 (외주)</option>
            <option value="소모품업체">소모품업체</option>
            <option value="기타">기타</option>
          </select>
          {errors.company_category && (
            <p className="mt-1 text-sm text-red-500">{errors.company_category}</p>
          )}
        </div>
      </div>

      {/* 주소 - Full width */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          주소
        </label>
        <input
          type="text"
          name="address"
          value={formData.address || ''}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="예: 서울특별시 강남구 테헤란로 123"
        />
      </div>

      {/* 사업자 정보 Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          사업자 정보 <span className="text-sm font-normal text-gray-500">(선택사항)</span>
        </h3>

        <div className="grid grid-cols-2 gap-6">
          {/* 업태 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              업태
            </label>
            <input
              type="text"
              value={formData.business_info?.business_type || ''}
              onChange={(e) => handleBusinessInfoChange('business_type', e.target.value)}
              maxLength={100}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 제조업"
            />
          </div>

          {/* 종목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              종목
            </label>
            <input
              type="text"
              value={formData.business_info?.business_item || ''}
              onChange={(e) => handleBusinessInfoChange('business_item', e.target.value)}
              maxLength={100}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 자동차 부품"
            />
          </div>
        </div>

        {/* 주요품목 - Full width */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            주요품목
          </label>
          <textarea
            value={formData.business_info?.main_products || ''}
            onChange={(e) => handleBusinessInfoChange('main_products', e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
            placeholder="예: 브레이크 패드, 디스크 로터, 캘리퍼 부품"
          />
        </div>
      </div>

      {/* 비고 - Full width */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          비고
        </label>
        <textarea
          name="notes"
          value={formData.notes || ''}
          onChange={handleChange}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
          placeholder="추가 메모 사항을 입력하세요"
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
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              처리중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {company ? '수정' : '등록'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}