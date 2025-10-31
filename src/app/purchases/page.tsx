'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Grid,
  List,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';

const Modal = dynamic(() => import('@/components/Modal'), { ssr: false });
const PurchaseForm = dynamic(() => import('@/components/forms/PurchaseForm'), { ssr: false });

type PaymentStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

type PurchaseTransaction = {
  transaction_id: number;
  transaction_date: string;
  transaction_no: string;
  supplier_id: number;
  item_id: number;
  item_name: string;
  spec?: string;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  tax_amount?: number;
  total_amount: number;
  payment_status?: PaymentStatus;
  payment_due_date?: string;
  delivery_date?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  supplier?: {
    company_id: number;
    company_name: string;
    company_code: string;
  };
  item?: {
    item_id: number;
    item_name: string;
    item_code: string;
    spec?: string;
  };
};

const PAYMENT_STATUS_OPTIONS = [
  { value: 'PENDING', label: '대기', color: 'text-gray-600 dark:text-gray-400' },
  { value: 'PARTIAL', label: '부분', color: 'text-gray-600 dark:text-gray-400' },
  { value: 'COMPLETED', label: '완료', color: 'text-gray-600 dark:text-gray-400' }
];

export default function PurchasesPage() {
  const [transactions, setTransactions] = useState<PurchaseTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<PurchaseTransaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  // 매입 거래 목록 조회
  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterStatus) params.append('payment_status', filterStatus);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/purchases?${params}`, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        // Phase 6A API structure: { data: [...] } or { data: { transactions, pagination } }
        setTransactions(Array.isArray(result.data) ? result.data : result.data?.transactions || []);
      } else {
        showToast(result.error || '매입 거래 조회 실패', 'error');
      }
    } catch (error) {
      console.error('Error fetching purchase transactions:', error);
      showToast('매입 거래 조회 중 오류가 발생했습니다', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [searchTerm, filterStatus, startDate, endDate]);

  // 매입 거래 추가
  const handleAdd = () => {
    setSelectedTransaction(null);
    setIsFormOpen(true);
  };

  // 매입 거래 수정
  const handleEdit = (transaction: PurchaseTransaction) => {
    setSelectedTransaction(transaction);
    setIsFormOpen(true);
  };

  // 매입 거래 삭제
  const handleDelete = async (transaction: PurchaseTransaction) => {
    const confirmed = await confirm({
      title: '매입 거래 삭제',
      message: `거래번호 ${transaction.transaction_no}를 삭제하시겠습니까?\n재고가 ${transaction.quantity}만큼 감소됩니다.`,
      confirmText: '삭제',
      cancelText: '취소'
    });

    if (!confirmed) return;

    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/purchases?id=${transaction.transaction_id}`, {
        method: 'DELETE',
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        showToast('매입 거래가 삭제되고 재고가 조정되었습니다', 'success');
        fetchTransactions();
      } else {
        showToast(result.error || '삭제 실패', 'error');
      }
    } catch (error) {
      console.error('Error deleting purchase transaction:', error);
      showToast('삭제 중 오류가 발생했습니다', 'error');
    }
  };

  // 폼 저장
  const handleSaveTransaction = async (data: Partial<PurchaseTransaction>) => {
    try {
      const url = selectedTransaction
        ? `/api/purchases?id=${selectedTransaction.transaction_id}`
        : '/api/purchases';

      const method = selectedTransaction ? 'PUT' : 'POST';

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        showToast(
          selectedTransaction ? '매입 거래가 수정되었습니다' : '매입 거래가 등록되고 재고가 증가되었습니다',
          'success'
        );
        setIsFormOpen(false);
        fetchTransactions();
      } else {
        showToast(result.error || '저장 실패', 'error');
      }
    } catch (error) {
      console.error('Error saving purchase transaction:', error);
      showToast('저장 중 오류가 발생했습니다', 'error');
    }
  };

  // 필터링된 거래 목록
  const filteredTransactions = useMemo(() => {
    return transactions;
  }, [transactions]);

  // 지급 상태별 색상
  const getPaymentStatusColor = (status?: PaymentStatus) => {
    const option = PAYMENT_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.color || 'text-gray-600 dark:text-gray-400';
  };

  // 지급 상태 라벨
  const getPaymentStatusLabel = (status?: PaymentStatus) => {
    const option = PAYMENT_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.label || '-';
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">매입 관리</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          매입 거래 내역을 관리합니다
        </p>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6 mb-6">
        {/* 모바일 필터 토글 버튼 */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="sm:hidden flex items-center justify-between w-full mb-3 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">필터</span>
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
              placeholder="거래번호, 품목명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
          </div>

          {/* 지급 상태 필터 */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as PaymentStatus | '')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          >
            <option value="">전체 상태</option>
            {PAYMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* 시작일 */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          />

          {/* 종료일 */}
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">매입 등록</span>
            <span className="sm:hidden">등록</span>
          </button>
        </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {/* 뷰 전환 토글 (모바일만) */}
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

        {/* 테이블 뷰 */}
        <div className={viewMode === 'card' ? 'hidden' : 'block'}>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
                  <th className="w-[110px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    거래일자
                  </th>
                  <th className="w-[130px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    거래번호
                  </th>
                  <th className="w-[140px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    공급사
                  </th>
                  <th className="w-[180px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    품목
                  </th>
                  <th className="w-[90px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    수량
                  </th>
                  <th className="w-[110px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    단가
                  </th>
                  <th className="w-[120px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    총액
                  </th>
                  <th className="w-[100px] px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    지급상태
                  </th>
                  <th className="w-[90px] px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 sm:px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      매입 거래가 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <tr key={transaction.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                          {transaction.transaction_date}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={transaction.transaction_no}>
                          {transaction.transaction_no}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-900 dark:text-gray-100 truncate" title={transaction.supplier?.company_name || '-'}>
                          {transaction.supplier?.company_name || '-'}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-900 dark:text-gray-100 truncate" title={transaction.item_name || transaction.item?.item_name || '-'}>
                          {transaction.item_name || transaction.item?.item_name || '-'}
                        </div>
                        {(transaction.spec || transaction.item?.spec) && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={transaction.spec || transaction.item?.spec}>
                            {transaction.spec || transaction.item?.spec}
                          </div>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-right text-gray-900 dark:text-gray-100 truncate">
                          {transaction.quantity.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-right text-gray-900 dark:text-gray-100 truncate">
                          {transaction.unit_price.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-right font-medium text-gray-900 dark:text-gray-100 truncate">
                          {transaction.total_amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden text-center">
                        <span className={`font-medium text-sm truncate ${getPaymentStatusColor(transaction.payment_status)}`}>
                          {getPaymentStatusLabel(transaction.payment_status)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(transaction)}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(transaction)}
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

        {/* 카드 뷰 (모바일만) */}
        {viewMode === 'card' && (
          <div className="sm:hidden p-3 space-y-3">
            {isLoading ? (
              <div className="text-center py-8">로딩 중...</div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                매입 거래가 없습니다
              </div>
            ) : (
              filteredTransactions.map((transaction) => (
                <div key={transaction.transaction_id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {transaction.transaction_no}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {transaction.transaction_date}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getPaymentStatusColor(transaction.payment_status)}`}>
                      {getPaymentStatusLabel(transaction.payment_status)}
                    </span>
                  </div>
                  <div className="text-sm mb-2">
                    <div className="font-medium">{transaction.item_name || transaction.item?.item_name || '-'}</div>
                    {(transaction.spec || transaction.item?.spec) && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{transaction.spec || transaction.item?.spec}</div>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400 mb-2">
                    <span>공급사: {transaction.supplier?.company_name || '-'}</span>
                    <span>수량: {transaction.quantity.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      단가: ₩{transaction.unit_price.toLocaleString()}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      ₩{transaction.total_amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(transaction)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                    >
                      <Edit2 className="w-3 h-3" />
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(transaction)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                    >
                      <Trash2 className="w-3 h-3" />
                      삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 매입 거래 폼 모달 */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedTransaction ? '매입 거래 수정' : '매입 거래 등록'}
      >
        <PurchaseForm
          transaction={selectedTransaction}
          onSave={handleSaveTransaction}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>
    </div>
  );
}
