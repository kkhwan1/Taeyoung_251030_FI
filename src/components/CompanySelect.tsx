'use client';

import { useState, useEffect, useRef } from 'react';
import { Database } from '@/types/supabase';

// Company type from unified Supabase layer
type Company = Database['public']['Tables']['companies']['Row'];

interface CompanySelectProps {
  value?: number | null;
  onChange: (companyId: number | null, company?: Company | undefined) => void;
  companyType?: 'SUPPLIER' | 'CUSTOMER' | 'OTHER';
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}

export default function CompanySelect({
  value,
  onChange,
  companyType,
  placeholder = "거래처를 선택하세요",
  disabled = false,
  required = false,
  error
}: CompanySelectProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭으로 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // 거래처 목록 조회
  const fetchCompanies = async (searchTerm: string = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (companyType) {
        params.append('type', companyType);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/companies?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setCompanies(result.data.data);
      } else {
        console.error('Failed to fetch companies:', result.error);
        setCompanies([]);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 초기 데이터 로드
  useEffect(() => {
    fetchCompanies();
  }, [companyType]);

  // 검색어 변경 시 거래처 목록 재조회
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (isOpen) {
        fetchCompanies(search);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [search, isOpen]);

  // 선택된 값 변경 시 해당 거래처 정보 설정
  useEffect(() => {
    if (value && companies.length > 0) {
      const company = companies.find(c => c.company_id === value);
      setSelectedCompany(company || null);
    } else {
      setSelectedCompany(null);
    }
  }, [value, companies]);

  const handleSelect = (company: Company) => {
    setSelectedCompany(company);
    onChange(company.company_id, company);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    setSelectedCompany(null);
    onChange(null);
    setSearch('');
  };

  const handleToggle = () => {
    if (disabled) return;

    setIsOpen(!isOpen);
    if (!isOpen) {
      // 드롭다운 열 때 검색 입력창에 포커스
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (company.business_number && company.business_number.includes(search)) ||
    (company.representative && company.representative.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 선택된 거래처 표시 / 드롭다운 토글 버튼 */}
      <div
        className={`
          min-h-[40px] px-3 py-2 border rounded-md cursor-pointer
          flex items-center justify-between
          ${disabled
            ? 'bg-gray-100 cursor-not-allowed'
            : 'bg-white hover:border-gray-400'
          }
          ${error
            ? 'border-red-500'
            : isOpen
              ? 'border-blue-500 ring-1 ring-blue-500'
              : 'border-gray-300'
          }
        `}
        onClick={handleToggle}
      >
        <div className="flex-1 min-w-0">
          {selectedCompany ? (
            <div className="flex items-center justify-between">
              <div className="truncate">
                <span className="font-medium">{selectedCompany.company_name}</span>
                {selectedCompany.business_number && (
                  <span className="text-sm text-gray-500 ml-2">
                    ({selectedCompany.business_number})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="ml-2 text-gray-400 hover:text-gray-600"
                disabled={disabled}
              >
                ✕
              </button>
            </div>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>

        <div className="ml-2 text-gray-400">
          {isOpen ? '▲' : '▼'}
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}

      {/* 드롭다운 목록 */}
      {isOpen && (
        <div className="absolute z-[9999] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-hidden">
          {/* 검색 입력창 */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-600">
            <input
              ref={searchInputRef}
              type="text"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="거래처명, 사업자번호, 담당자로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
            />
          </div>

          {/* 거래처 목록 */}
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="p-3 text-center text-gray-500 dark:text-gray-400">검색 중...</div>
            ) : filteredCompanies.length > 0 ? (
              filteredCompanies.map((company) => (
                <div
                  key={company.company_id}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(company);
                  }}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{company.company_name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    {company.business_number && (
                      <span>사업자: {company.business_number}</span>
                    )}
                    {company.representative && (
                      <span>대표자: {company.representative}</span>
                    )}
                    {company.phone && (
                      <span>전화: {company.phone}</span>
                    )}
                  </div>
                  {company.company_type && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span className={`
                        px-2 py-0.5 rounded-full text-xs
                        ${company.company_type === '공급사'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : company.company_type === '고객사'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }
                      `}>
                        {company.company_type === '공급사' ? '공급업체' :
                         company.company_type === '고객사' ? '고객사' : '기타'}
                      </span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-3 text-center text-gray-500 dark:text-gray-400">
                {search ? '검색 결과가 없습니다.' : '등록된 거래처가 없습니다.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}