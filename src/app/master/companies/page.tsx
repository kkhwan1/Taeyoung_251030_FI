'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Building2, Plus, Search, Edit2, Trash2, Filter, Phone, Mail, Upload, Download, ChevronDown, ChevronUp, Grid, List } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';
import { CompaniesExportButton } from '@/components/ExcelExportButton';
import PrintButton from '@/components/PrintButton';

// Dynamic imports for form components
const Modal = dynamic(() => import('@/components/Modal'), {
  loading: () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
          <div className="h-64 bg-gray-300 dark:bg-gray-600 rounded"></div>
        </div>
      </div>
    </div>
  ),
  ssr: false
});

const CompanyForm = dynamic(() => import('@/components/CompanyForm'), {
  loading: () => (
    <div className="animate-pulse">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
        <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
      <div className="h-32 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
      <div className="flex justify-end gap-2">
        <div className="h-10 w-20 bg-gray-300 dark:bg-gray-600 rounded"></div>
        <div className="h-10 w-20 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
    </div>
  ),
  ssr: false
});

const ExcelUploadModal = dynamic(() => import('@/components/upload/ExcelUploadModal'), {
  loading: () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
          <div className="h-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
        </div>
      </div>
    </div>
  ),
  ssr: false
});

interface Company {
  company_id: number;
  company_name: string;
  company_type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  business_registration_no?: string;
  contact_person?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  address?: string;
  payment_terms?: number;
  contact_info?: string;
  notes?: string;
  is_active: boolean;
  company_category?: string;
  business_info?: {
    business_type?: string;
    business_item?: string;
    main_products?: string;
  };
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingCompanyId, setDeletingCompanyId] = useState<number | null>(null);
  
  // Mobile optimization states
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  
  const { success, error } = useToast();
  const { deleteWithToast, ConfirmDialog } = useConfirm();

  const companyTypes = [
    { value: 'CUSTOMER', label: '고객사' },
    { value: 'SUPPLIER', label: '공급사' },
    { value: 'BOTH', label: '고객사/공급사' }
  ];

  // 인쇄용 컬럼 정의
  const printColumns = [
    { key: 'company_name', label: '거래처명', align: 'left' as const, width: '25%' },
    { key: 'company_type', label: '구분', align: 'center' as const, width: '10%' },
    { key: 'business_number', label: '사업자번호', align: 'left' as const, width: '15%' },
    { key: 'contact_person', label: '담당자', align: 'left' as const, width: '15%' },
    { key: 'phone', label: '전화번호', align: 'left' as const, width: '15%' },
    { key: 'fax', label: '팩스', align: 'left' as const, width: '12%' },
    { key: 'address', label: '주소', align: 'left' as const, width: '20%' }
  ];

  useEffect(() => {
    fetchCompanies();
  }, [selectedType]);

  const fetchCompanies = async (bustCache = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedType) params.append('type', selectedType);
      if (bustCache) params.append('_t', Date.now().toString()); // Cache busting

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const data = await safeFetchJson(`/api/companies?${params}`, {
        cache: bustCache ? 'no-store' : 'default'
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      console.log('[DEBUG] fetchCompanies response:', data);

      if (data.success) {
        // Handle paginated response structure
        const companiesData = data.data?.data || [];
        console.log('[DEBUG] Setting companies:', companiesData.length, 'items');
        setCompanies(Array.isArray(companiesData) ? companiesData : []);
      } else {
        error('데이터 로드 실패', '거래처 목록을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to fetch companies:', err);
      error('네트워크 오류', '서버와의 연결에 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (company: Company) => {
    const deleteAction = async () => {
      setDeletingCompanyId(company.company_id);
      try {
        const { safeFetchJson } = await import('@/lib/fetch-utils');
        const data = await safeFetchJson(`/api/companies?id=${company.company_id}`, {
          method: 'DELETE'
        }, {
          timeout: 15000,
          maxRetries: 2,
          retryDelay: 1000
        });

        if (!data.success) {
          throw new Error(data.error || '거래처 삭제에 실패했습니다.');
        }

        fetchCompanies(true); // Force cache refresh after delete
      } catch (err) {
        console.error('Failed to delete company:', err);
        throw err;
      } finally {
        setDeletingCompanyId(null);
      }
    };

    await deleteWithToast(deleteAction, {
      title: '거래처 삭제',
      itemName: `${company.company_name}`,
      successMessage: '거래처가 성공적으로 삭제되었습니다.',
      errorMessage: '거래처 삭제에 실패했습니다.'
    });
  };

  const handleSaveCompany = async (companyData: Omit<Company, 'company_id' | 'is_active'>) => {
    try {
      const method = editingCompany ? 'PUT' : 'POST';
      const body = editingCompany
        ? { ...companyData, company_id: editingCompany.company_id }
        : companyData;

      console.log('[DEBUG] Saving company:', method, body);

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const responseData = await safeFetchJson('/api/companies', {
        method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (responseData.success) {
        console.log('[DEBUG] Save response:', responseData);
        
        const successMessage = editingCompany ? '거래처가 성공적으로 수정되었습니다.' : '거래처가 성공적으로 등록되었습니다.';
        success(editingCompany ? '거래처 수정 완료' : '거래처 등록 완료', successMessage);
        setShowAddModal(false);
        setEditingCompany(null);
        
        // Add small delay to ensure DB consistency before refetching
        await new Promise(resolve => setTimeout(resolve, 300));
        console.log('[DEBUG] Calling fetchCompanies with cache busting...');
        await fetchCompanies(true); // Force cache refresh
        console.log('[DEBUG] fetchCompanies completed');
      } else {
        console.error('[DEBUG] Save failed:', responseData);
        error('저장 실패', responseData.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to save company:', err);
      error('네트워크 오류', '서버와의 연결에 문제가 발생했습니다.');
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingCompany(null);
  };

  const handleUploadSuccess = () => {
    success('엑셀 업로드 완료', '거래처 데이터가 성공적으로 업로드되었습니다.');
    setShowUploadModal(false);
    fetchCompanies(true); // Force cache refresh after upload
  };

  const handleTemplateDownload = async () => {
    try {
      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch('/api/download/template/companies', {}, {
        timeout: 30000,
        maxRetries: 2,
        retryDelay: 1000
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '거래처_템플릿.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      success('템플릿 다운로드 완료', '거래처 템플릿 파일이 다운로드되었습니다.');
    } catch (err) {
      console.error('Failed to download template:', err);
      error('다운로드 실패', '템플릿 다운로드에 실패했습니다.');
    }
  };

  const getTypeLabel = (type: string) => {
    const found = companyTypes.find(t => t.value === type);
    return found ? found.label : type;
  };

  const getTypeBadgeColor = (type: string) => {
    // SAP-style border-only badges for all types
    return 'border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300';
  };

  const filteredCompanies = companies.filter(company =>
    company.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.business_registration_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 인쇄용 데이터 변환 (타입 라벨 변환)
  const printableCompanies = filteredCompanies.map(company => ({
    ...company,
    company_type: getTypeLabel(company.company_type)
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600 dark:text-gray-400" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">거래처 관리</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">고객사 및 공급사 정보를 관리합니다</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrintButton
              data={printableCompanies}
              columns={printColumns}
              title="거래처 목록"
              subtitle={selectedType ? getTypeLabel(selectedType) : undefined}
              orientation="portrait"
              className="bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600"
            />
            <button
              onClick={handleTemplateDownload}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">템플릿 다운로드</span>
              <span className="sm:hidden">템플릿</span>
            </button>
            <CompaniesExportButton
              companies={filteredCompanies}
              filtered={searchTerm !== '' || selectedType !== ''}
              className="text-sm sm:text-base"
            />
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">엑셀 업로드</span>
              <span className="sm:hidden">업로드</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">거래처 등록</span>
              <span className="sm:hidden">등록</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
        {/* Mobile Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="sm:hidden flex items-center justify-between w-full mb-3 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">필터</span>
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="거래처명, 사업자번호, 담당자로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
              />
            </div>
          </div>
          <div className={`flex gap-2 ${showFilters || 'hidden'} sm:flex`}>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
            >
              <option value="">전체 타입</option>
              {companyTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <Filter className="w-5 h-5" />
              필터
            </button>
          </div>
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* View Toggle (Mobile Only) */}
        <div className="sm:hidden flex items-center justify-end gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <List className="w-3 h-3" />
            테이블
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'card'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Grid className="w-3 h-3" />
            카드
          </button>
        </div>

        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className={`w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700 ${viewMode === 'card' ? 'hidden' : 'table'}`}>
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="w-[180px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  거래처명
                </th>
                <th className="w-[100px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  타입
                </th>
                <th className="w-[130px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  사업자번호
                </th>
                <th className="w-[100px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  담당자
                </th>
                <th className="w-[140px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  연락처
                </th>
                <th className="w-[120px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  팩스
                </th>
                <th className="w-[200px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  이메일
                </th>
                <th className="w-[250px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  주소
                </th>
                <th className="w-[90px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  결제조건
                </th>
                <th className="w-[90px] px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-3 sm:p-6">
                    <TableSkeleton rows={6} columns={11} showHeader={false} />
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 sm:px-6 py-12 text-center text-gray-500">
                    등록된 거래처가 없습니다
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr key={company.company_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={company.company_name}>
                        {company.company_name}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadgeColor(company.company_type)} whitespace-nowrap`}>
                        {getTypeLabel(company.company_type)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {company.business_registration_no || '-'}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <div className="text-sm text-gray-900 dark:text-white truncate" title={company.contact_person}>
                        {company.contact_person || '-'}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <div className="flex flex-col gap-1">
                        {company.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 overflow-hidden">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{company.phone}</span>
                          </div>
                        )}
                        {company.mobile && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {company.mobile}
                          </div>
                        )}
                        {!company.phone && !company.mobile && (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {(company as any).fax || '-'}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      {company.email ? (
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 overflow-hidden">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate" title={company.email}>{company.email}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <div className="text-sm text-gray-900 dark:text-white truncate" title={company.address}>
                        {company.address || '-'}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <div className="text-sm text-gray-900 dark:text-white truncate">
                        {company.payment_terms ? `${company.payment_terms}일` : '-'}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingCompany(company);
                            setShowAddModal(true);
                          }}
                          className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(company)}
                          disabled={deletingCompanyId === company.company_id}
                          className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingCompanyId === company.company_id ? (
                            <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Card View (Mobile Only) */}
        {viewMode === 'card' && (
          <div className="sm:hidden p-3 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                등록된 거래처가 없습니다
              </div>
            ) : (
              filteredCompanies.map((company) => (
                <div key={company.company_id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {company.company_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {company.business_registration_no || '-'}
                      </p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadgeColor(company.company_type)}`}>
                      {getTypeLabel(company.company_type)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 text-xs text-gray-600 dark:text-gray-400 mb-3">
                    <div>
                      <span className="font-medium">담당자:</span> {company.contact_person || '-'}
                    </div>
                    {company.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{company.phone}</span>
                      </div>
                    )}
                    {company.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{company.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-500">
                      {company.payment_terms ? `결제조건: ${company.payment_terms}일` : '결제조건: -'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingCompany(company);
                          setShowAddModal(true);
                        }}
                        className="p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                        title="거래처 수정"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(company)}
                        disabled={deletingCompanyId === company.company_id}
                        className="p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="거래처 삭제"
                      >
                        {deletingCompanyId === company.company_id ? (
                          <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal for Add/Edit Company */}
      <Modal
        isOpen={showAddModal || !!editingCompany}
        onClose={handleCloseModal}
        title={editingCompany ? '거래처 수정' : '거래처 등록'}
        size="lg"
      >
        <CompanyForm
          company={editingCompany}
          onSubmit={handleSaveCompany}
          onCancel={handleCloseModal}
        />
      </Modal>

      {/* Excel Upload Modal */}
      <ExcelUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        uploadUrl="/api/upload/companies"
        title="거래처 엑셀 업로드"
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
}