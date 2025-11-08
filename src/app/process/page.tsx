'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

/**
 * Process Operations Management Page
 *
 * Manages manufacturing process operations (Blanking, Press, Assembly)
 * Features:
 * - Tab-based filtering (In Progress, Completed, All)
 * - Process type and date range filtering
 * - Real-time status updates
 * - Virtual table for performance
 */

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';
import ProcessStatusBadge from '@/components/process/ProcessStatusBadge';

const Modal = dynamic(() => import('@/components/Modal'), { ssr: false });
const ProcessOperationForm = dynamic(() => import('@/components/process/ProcessOperationForm'), { ssr: false });

type OperationType = 'BLANKING' | 'PRESS' | 'ASSEMBLY';
type OperationStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface ProcessOperation {
  operation_id: number;
  operation_type: OperationType;
  input_item_id: number;
  output_item_id: number;
  input_quantity: number;
  output_quantity: number;
  status: OperationStatus;
  operator_id?: string;
  notes?: string;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  input_item?: {
    item_id: number;
    item_name: string;
    item_code: string;
  };
  output_item?: {
    item_id: number;
    item_name: string;
    item_code: string;
  };
}

const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  'BLANKING': 'Blanking 공정',
  'PRESS': 'Press 공정',
  'ASSEMBLY': '조립 공정'
};

const TAB_OPTIONS = [
  { value: 'IN_PROGRESS', label: '진행중' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'ALL', label: '전체' }
];

export default function ProcessPage() {
  const [operations, setOperations] = useState<ProcessOperation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<ProcessOperation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('IN_PROGRESS');
  const [filterType, setFilterType] = useState<OperationType | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  // 공정 작업 목록 조회
  const fetchOperations = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();

      if (activeTab !== 'ALL') {
        params.append('status', activeTab);
      }
      if (searchTerm) params.append('search', searchTerm);
      if (filterType) params.append('operation_type', filterType);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/process-operations?${params}`, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        setOperations(result.data?.operations || result.data || []);
      } else {
        showToast(result.error || '공정 작업 조회 실패', 'error');
      }
    } catch (error) {
      console.error('Error fetching process operations:', error);
      showToast('공정 작업 조회 중 오류가 발생했습니다', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations();
  }, [activeTab, searchTerm, filterType, startDate, endDate]);

  // 공정 작업 추가
  const handleAdd = () => {
    setSelectedOperation(null);
    setIsFormOpen(true);
  };

  // 공정 작업 수정
  const handleEdit = (operation: ProcessOperation) => {
    setSelectedOperation(operation);
    setIsFormOpen(true);
  };

  // 공정 작업 삭제
  const handleDelete = async (operation: ProcessOperation) => {
    const confirmed = await confirm({
      title: '공정 작업 삭제',
      message: `공정번호 ${operation.operation_id}를 삭제하시겠습니까?`,
      confirmText: '삭제',
      cancelText: '취소'
    });

    if (!confirmed) return;

    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/process-operations/${operation.operation_id}`, {
        method: 'DELETE',
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        showToast('공정 작업이 삭제되었습니다', 'success');
        fetchOperations();
      } else {
        showToast(result.error || '삭제 실패', 'error');
      }
    } catch (error) {
      console.error('Error deleting process operation:', error);
      showToast('삭제 중 오류가 발생했습니다', 'error');
    }
  };

  // 폼 저장
  const handleSaveOperation = async (data: Partial<ProcessOperation>) => {
    try {
      const url = selectedOperation
        ? `/api/process-operations/${selectedOperation.operation_id}`
        : '/api/process-operations';

      const method = selectedOperation ? 'PATCH' : 'POST';

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(url, {
        method,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: JSON.stringify(data),
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        showToast(
          selectedOperation ? '공정 작업이 수정되었습니다' : '공정 작업이 등록되었습니다',
          'success'
        );
        setIsFormOpen(false);
        fetchOperations();
      } else {
        showToast(result.error || '저장 실패', 'error');
      }
    } catch (error) {
      console.error('Error saving process operation:', error);
      showToast('저장 중 오류가 발생했습니다', 'error');
    }
  };

  // 수율 계산
  const calculateEfficiency = (inputQty: number, outputQty: number) => {
    if (inputQty > 0) {
      return ((outputQty / inputQty) * 100).toFixed(2);
    }
    return '0.00';
  };

  // 필터링된 작업 목록
  const filteredOperations = useMemo(() => {
    return operations;
  }, [operations]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">공정 관리</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          제조 공정 작업 내역을 관리합니다 (Blanking, Press, 조립)
        </p>
      </div>

      {/* 탭 필터 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex gap-2 overflow-x-auto">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.value
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
        {/* 모바일 필터 토글 버튼 */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="sm:hidden flex items-center justify-between w-full mb-3 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            필터
          </span>
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* 필터 콘텐츠 */}
        <div className={`${showFilters ? 'block' : 'hidden'} sm:block`}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="공정번호, 품목명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>

            {/* 공정 유형 필터 */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as OperationType | '')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="">전체 공정</option>
              {Object.entries(OPERATION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {/* 시작일 */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>

            {/* 종료일 */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleAdd}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs font-medium whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              공정 등록
            </button>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    공정번호
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    공정유형
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    투입재료
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    산출제품
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    투입수량
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    산출수량
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    수율
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    작업자
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {filteredOperations.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 sm:px-6 py-12 text-center text-gray-600 dark:text-gray-400">
                      공정 작업이 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredOperations.map((operation) => (
                    <tr key={operation.operation_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {operation.operation_id}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {OPERATION_TYPE_LABELS[operation.operation_type]}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {operation.input_item?.item_name || '-'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {operation.input_item?.item_code || ''}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {operation.output_item?.item_name || '-'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {operation.output_item?.item_code || ''}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-right">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {operation.input_quantity.toLocaleString('ko-KR')}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-right">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {operation.output_quantity.toLocaleString('ko-KR')}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {calculateEfficiency(operation.input_quantity, operation.output_quantity)}%
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-center">
                        <ProcessStatusBadge status={operation.status} />
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {operation.operator_id || '-'}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(operation)}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(operation)}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 공정 작업 폼 모달 */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedOperation ? '공정 작업 수정' : '공정 작업 등록'}
        size="lg"
      >
        <ProcessOperationForm
          operation={selectedOperation}
          onSave={handleSaveOperation}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>
    </div>
  );
}
