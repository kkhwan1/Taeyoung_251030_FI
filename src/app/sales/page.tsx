'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ShoppingBag, Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';

const Modal = dynamic(() => import('@/components/Modal'), { ssr: false });
const SalesTransactionForm = dynamic(() => import('@/components/sales/SalesTransactionForm'), { ssr: false });

type PaymentStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

type SalesTransaction = {
  transaction_id: number;
  transaction_date: string;
  transaction_no: string;
  customer_id: number;
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
  delivery_address?: string;
  delivery_date?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  customer?: {
    company_id: number;
    company_name: string;
    company_code: string;
  };
  item?: {
    item_id: number;
    item_name: string;
    item_code: string;
  };
};

const PAYMENT_STATUS_OPTIONS = [
  { value: 'PENDING', label: '대기', color: 'text-yellow-600 dark:text-yellow-400' },
  { value: 'PARTIAL', label: '부분', color: 'text-blue-600 dark:text-blue-400' },
  { value: 'COMPLETED', label: '완료', color: 'text-green-600 dark:text-green-400' }
];

export default function SalesPage() {
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<SalesTransaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  // 판매 거래 목록 조회
  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterStatus) params.append('payment_status', filterStatus);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(`/api/sales-transactions?${params}`);
      const result = await response.json();

      if (result.success) {
        // Phase 6A API structure: { data: { transactions, pagination, summary } }
        setTransactions(result.data?.transactions || result.data || []);
      } else {
        showToast(result.error || '판매 거래 조회 실패', 'error');
      }
    } catch (error) {
      console.error('Error fetching sales transactions:', error);
      showToast('판매 거래 조회 중 오류가 발생했습니다', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [searchTerm, filterStatus, startDate, endDate]);

  // 판매 거래 추가
  const handleAdd = () => {
    setSelectedTransaction(null);
    setIsFormOpen(true);
  };

  // 판매 거래 수정
  const handleEdit = (transaction: SalesTransaction) => {
    setSelectedTransaction(transaction);
    setIsFormOpen(true);
  };

  // 판매 거래 삭제
  const handleDelete = async (transaction: SalesTransaction) => {
    const confirmed = await confirm({
      title: '판매 거래 삭제',
      message: `거래번호 ${transaction.transaction_no}를 삭제하시겠습니까?`,
      confirmText: '삭제',
      cancelText: '취소'
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/sales?id=${transaction.transaction_id}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        showToast('판매 거래가 삭제되었습니다', 'success');
        fetchTransactions();
      } else {
        showToast(result.error || '삭제 실패', 'error');
      }
    } catch (error) {
      console.error('Error deleting sales transaction:', error);
      showToast('삭제 중 오류가 발생했습니다', 'error');
    }
  };

  // 폼 저장
  const handleSaveTransaction = async (data: Partial<SalesTransaction>) => {
    try {
      const url = selectedTransaction
        ? `/api/sales?id=${selectedTransaction.transaction_id}`
        : '/api/sales';

      const method = selectedTransaction ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        showToast(
          selectedTransaction ? '판매 거래가 수정되었습니다' : '판매 거래가 등록되었습니다',
          'success'
        );
        setIsFormOpen(false);
        fetchTransactions();
      } else {
        showToast(result.error || '저장 실패', 'error');
      }
    } catch (error) {
      console.error('Error saving sales transaction:', error);
      showToast('저장 중 오류가 발생했습니다', 'error');
    }
  };

  // 필터링된 거래 목록
  const filteredTransactions = useMemo(() => {
    return transactions;
  }, [transactions]);

  // 수금 상태별 색상
  const getPaymentStatusColor = (status?: PaymentStatus) => {
    const option = PAYMENT_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.color || 'text-gray-600 dark:text-gray-400';
  };

  // 수금 상태 라벨
  const getPaymentStatusLabel = (status?: PaymentStatus) => {
    const option = PAYMENT_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.label || '-';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ShoppingBag className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">판매 관리</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 ml-11">
          판매 거래 내역을 관리합니다
        </p>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="거래번호, 품목명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 수금 상태 필터 */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as PaymentStatus | '')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {/* 종료일 */}
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            판매 등록
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    거래일자
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    거래번호
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    고객사
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    품목
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    수량
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    단가
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    총액
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    수금상태
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      판매 거래가 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <tr key={transaction.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {transaction.transaction_date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {transaction.transaction_no}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {transaction.customer?.company_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        <div>{transaction.item_name}</div>
                        {transaction.spec && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{transaction.spec}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                        {transaction.quantity.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                        {transaction.unit_price.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                        {transaction.total_amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <span className={`font-medium ${getPaymentStatusColor(transaction.payment_status)}`}>
                          {getPaymentStatusLabel(transaction.payment_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(transaction)}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(transaction)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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

      {/* 판매 거래 폼 모달 */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedTransaction ? '판매 거래 수정' : '판매 거래 등록'}
      >
        <SalesTransactionForm
          transaction={selectedTransaction}
          onSave={handleSaveTransaction}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>
    </div>
  );
}