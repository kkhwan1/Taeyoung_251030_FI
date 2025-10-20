'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Building2, Plus, Search, Edit2, Trash2, Filter, Phone, Mail, Upload, Download } from 'lucide-react';
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
    { key: 'business_registration_no', label: '사업자번호', align: 'left' as const, width: '15%' },
    { key: 'contact_person', label: '담당자', align: 'left' as const, width: '15%' },
    { key: 'phone', label: '전화번호', align: 'left' as const, width: '15%' },
    { key: 'address', label: '주소', align: 'left' as const, width: '20%' }
  ];

  useEffect(() => {
    fetchCompanies();
  }, [selectedType]);

  const fetchCompanies = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedType) params.append('type', selectedType);

      const response = await fetch(`/api/companies?${params}`);
      const data = await response.json();

      if (data.success) {
        // Handle paginated response structure
        const companiesData = data.data?.data || [];
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
        const response = await fetch(`/api/companies?id=${company.company_id}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '거래처 삭제에 실패했습니다.');
        }

        fetchCompanies();
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
        ? { ...companyData, id: editingCompany.company_id }
        : companyData;

      const response = await fetch('/api/companies', {
        method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const successMessage = editingCompany ? '거래처가 성공적으로 수정되었습니다.' : '거래처가 성공적으로 등록되었습니다.';
        success(editingCompany ? '거래처 수정 완료' : '거래처 등록 완료', successMessage);
        setShowAddModal(false);
        setEditingCompany(null);
        fetchCompanies();
      } else {
        const errorData = await response.json();
        error('저장 실패', errorData.error || '저장에 실패했습니다.');
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
    fetchCompanies();
  };

  const handleTemplateDownload = async () => {
    try {
      const response = await fetch('/api/download/template/companies');
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
    switch (type) {
      case 'CUSTOMER':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'SUPPLIER':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'BOTH':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
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
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">거래처 관리</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">고객사 및 공급사 정보를 관리합니다</p>
            </div>
          </div>
          <div className="flex gap-2">
            <PrintButton
              data={printableCompanies}
              columns={printColumns}
              title="거래처 목록"
              subtitle={selectedType ? getTypeLabel(selectedType) : undefined}
              orientation="portrait"
              className="bg-purple-500 hover:bg-purple-600"
            />
            <button
              onClick={handleTemplateDownload}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <Download className="w-5 h-5" />
              템플릿 다운로드
            </button>
            <CompaniesExportButton
              companies={filteredCompanies}
              filtered={searchTerm !== '' || selectedType !== ''}
            />
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <Upload className="w-5 h-5" />
              엑셀 업로드
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              거래처 등록
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="거래처명, 사업자번호, 담당자로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  거래처명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  타입
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  사업자번호
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  담당자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  연락처
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  이메일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  결제조건
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6">
                    <TableSkeleton rows={6} columns={8} showHeader={false} />
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    등록된 거래처가 없습니다
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr key={company.company_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {company.company_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadgeColor(company.company_type)}`}>
                        {getTypeLabel(company.company_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {company.business_registration_no || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {company.contact_person || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {company.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                            <Phone className="w-3 h-3" />
                            {company.phone}
                          </div>
                        )}
                        {company.mobile && (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {company.mobile}
                          </div>
                        )}
                        {!company.phone && !company.mobile && (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {company.email ? (
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Mail className="w-3 h-3" />
                          {company.email}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {company.payment_terms ? `${company.payment_terms}일` : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => {
                          setEditingCompany(company);
                          setShowAddModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(company)}
                        disabled={deletingCompanyId === company.company_id}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingCompanyId === company.company_id ? (
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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