'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { CreditCard, Plus, Search, Edit2, Trash2, Download } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';

const Modal = dynamic(() => import('@/components/Modal'), { ssr: false });
const PaymentForm = dynamic(() => import('@/components/forms/PaymentForm'), { ssr: false });

type PaymentMethod = 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD';

type Payment = {
  payment_id: number;
  payment_date: string;
  payment_no: string;
  purchase_transaction_id: number;
  purchase_transaction_no?: string;
  supplier_name?: string;
  paid_amount: number;
  payment_method: PaymentMethod;
  bank_name?: string;
  account_number?: string;
  check_number?: string;
  card_number?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

const PAYMENT_METHOD_OPTIONS = [
  { value: 'CASH', label: '현금', color: 'text-green-600 dark:text-green-400' },
  { value: 'TRANSFER', label: '계좌이체', color: 'text-blue-600 dark:text-blue-400' },
  { value: 'CHECK', label: '수표', color: 'text-purple-600 dark:text-purple-400' },
  { value: 'CARD', label: '카드', color: 'text-orange-600 dark:text-orange-400' }
];

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<PaymentMethod | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  // 지급 목록 조회
  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterPaymentMethod) params.append('payment_method', filterPaymentMethod);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(`/api/payments?${params}`);
      const result = await response.json();

      if (result.success) {
        setPayments(result.data);
      } else {
        showToast(result.error || '지급 내역 조회 실패', 'error');
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      showToast('지급 내역 조회 중 오류가 발생했습니다', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [searchTerm, filterPaymentMethod, startDate, endDate]);

  // 지급 등록
  const handleAdd = () => {
    setSelectedPayment(null);
    setIsFormOpen(true);
  };

  // 지급 수정
  const handleEdit = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsFormOpen(true);
  };

  // 지급 삭제
  const handleDelete = async (payment: Payment) => {
    const confirmed = await confirm({
      title: '지급 내역 삭제',
      message: `지급번호 ${payment.payment_no}를 삭제하시겠습니까?\n매입 거래의 지급 금액이 조정됩니다.`,
      confirmText: '삭제',
      cancelText: '취소'
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/payments?id=${payment.payment_id}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        showToast('지급 내역이 삭제되었습니다', 'success');
        fetchPayments();
      } else {
        showToast(result.error || '삭제 실패', 'error');
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      showToast('삭제 중 오류가 발생했습니다', 'error');
    }
  };

  // 폼 저장
  const handleSavePayment = async (data: Partial<Payment>) => {
    try {
      const url = selectedPayment
        ? `/api/payments?id=${selectedPayment.payment_id}`
        : '/api/payments';

      const method = selectedPayment ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        showToast(
          selectedPayment ? '지급 내역이 수정되었습니다' : '지급 내역이 등록되었습니다',
          'success'
        );
        setIsFormOpen(false);
        fetchPayments();
      } else {
        showToast(result.error || '저장 실패', 'error');
      }
    } catch (error) {
      console.error('Error saving payment:', error);
      showToast('저장 중 오류가 발생했습니다', 'error');
    }
  };

  // Excel 다운로드
  const handleExcelDownload = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterPaymentMethod) params.append('payment_method', filterPaymentMethod);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(`/api/export/payments?${params}`);

      if (!response.ok) {
        throw new Error('다운로드 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `지급내역_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('Excel 파일이 다운로드되었습니다', 'success');
    } catch (error) {
      console.error('Error downloading Excel:', error);
      showToast('Excel 다운로드 중 오류가 발생했습니다', 'error');
    }
  };

  // 필터링된 지급 목록
  const filteredPayments = useMemo(() => {
    return payments;
  }, [payments]);

  // 결제방법 색상
  const getPaymentMethodColor = (method?: PaymentMethod) => {
    const option = PAYMENT_METHOD_OPTIONS.find(opt => opt.value === method);
    return option?.color || 'text-gray-600 dark:text-gray-400';
  };

  // 결제방법 라벨
  const getPaymentMethodLabel = (method?: PaymentMethod) => {
    const option = PAYMENT_METHOD_OPTIONS.find(opt => opt.value === method);
    return option?.label || '-';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Section 1: Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">지급 관리</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 ml-11">
          공급사별 지급 내역을 관리합니다
        </p>
      </div>

      {/* Section 2: Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="지급번호, 매입번호, 공급사 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* 결제방법 필터 */}
          <select
            value={filterPaymentMethod}
            onChange={(e) => setFilterPaymentMethod(e.target.value as PaymentMethod | '')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">전체 결제방법</option>
            {PAYMENT_METHOD_OPTIONS.map((option) => (
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
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />

          {/* 종료일 */}
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={handleExcelDownload}
            className="flex items-center gap-2 px-4 py-2 border border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
          >
            <Download className="w-5 h-5" />
            Excel 다운로드
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            지급 등록
          </button>
        </div>
      </div>

      {/* Section 3: Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    지급일자
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    지급번호
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    매입번호
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    공급사명
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    지급금액
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    결제방법
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    비고
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      지급 내역이 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => (
                    <tr key={payment.payment_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {payment.payment_date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {payment.payment_no}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {payment.purchase_transaction_no || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {payment.supplier_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                        ₩ {payment.paid_amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <span className={`font-medium ${getPaymentMethodColor(payment.payment_method)}`}>
                          {getPaymentMethodLabel(payment.payment_method)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        <div className="max-w-xs truncate" title={payment.notes}>
                          {payment.notes || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(payment)}
                            className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                            aria-label="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(payment)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            aria-label="삭제"
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

      {/* Section 4: Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedPayment ? '지급 내역 수정' : '지급 내역 등록'}
      >
        <PaymentForm
          payment={selectedPayment}
          onSave={handleSavePayment}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>
    </div>
  );
}
