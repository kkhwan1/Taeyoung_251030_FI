'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Package, Plus, Search, Edit2, Trash2, RotateCcw, Upload, Download } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';
import { ItemsExportButton } from '@/components/ExcelExportButton';
import PrintButton from '@/components/PrintButton';
import type { ItemCategory, ItemTypeCode, MaterialTypeCode } from '@/types/supabase';
import {
  type CoatingStatus,
  COATING_STATUS_OPTIONS,
  getCoatingStatusLabel,
  getCoatingStatusColor
} from '@/lib/constants/coatingStatus';

const Modal = dynamic(() => import('@/components/Modal'), { ssr: false });
const ItemForm = dynamic(() => import('@/components/ItemForm'), { ssr: false });
const ExcelUploadModal = dynamic(() => import('@/components/upload/ExcelUploadModal'), { ssr: false });

type Item = {
  item_id: number;
  item_code: string;
  item_name: string;
  category: ItemCategory | string;
  item_type?: ItemTypeCode | string | null;
  material_type?: MaterialTypeCode | string | null;
  vehicle_model?: string | null;
  material?: string | null;
  spec?: string | null;
  unit: string;
  thickness?: number | null;
  width?: number | null;
  height?: number | null;
  specific_gravity?: number | null;
  mm_weight?: number | null;
  daily_requirement?: number | null;
  blank_size?: number | null;
  current_stock?: number | null;
  safety_stock?: number | null;
  price?: number | null;
  location?: string | null;
  description?: string | null;
  coating_status?: CoatingStatus | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

const CATEGORY_OPTIONS: ItemCategory[] = ['원자재', '부자재', '반제품', '완제품', '폐제품'];
const ITEM_TYPE_OPTIONS: { value: ItemTypeCode; label: string }[] = [
  { value: 'RAW', label: '원자재 (RAW)' },
  { value: 'SUB', label: '부자재 (SUB)' },
  { value: 'FINISHED', label: '완제품 (FINISHED)' }
];
const MATERIAL_TYPE_OPTIONS: { value: MaterialTypeCode; label: string }[] = [
  { value: 'COIL', label: 'COIL' },
  { value: 'SHEET', label: 'SHEET' },
  { value: 'OTHER', label: '기타 (OTHER)' }
];
// COATING_STATUS_OPTIONS now imported from @/lib/constants/coatingStatus

const ITEM_TYPE_LABEL: Record<string, string> = {
  RAW: 'RAW',
  SUB: 'SUB',
  FINISHED: 'FINISHED'
};

const formatNumberValue = (value?: number | null, fractionDigits = 0) => {
  if (value === null || value === undefined) {
    return '-';
  }

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
};

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined) {
    return '-';
  }

  return `₩${Number(value).toLocaleString()}`;
};

const formatItemTypeLabel = (itemType?: string | null) => {
  if (!itemType) return '-';
  return ITEM_TYPE_LABEL[itemType] ?? itemType;
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedItemType, setSelectedItemType] = useState('');
  const [selectedMaterialType, setSelectedMaterialType] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [selectedCoatingStatus, setSelectedCoatingStatus] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  
  // Pagination state
  const [pagination, setPagination] = useState<any>(null);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [currentDirection, setCurrentDirection] = useState<'next' | 'prev'>('next');
  const [useCursorPagination, setUseCursorPagination] = useState(true);
  
  const { success, error } = useToast();
  const { deleteWithToast, ConfirmDialog } = useConfirm();

  // Pagination handlers
  const handlePageChange = (page: number) => {
    fetchItems(null, 'next');
  };

  const handleCursorChange = (cursor: string | null, direction: 'next' | 'prev') => {
    fetchItems(cursor, direction);
  };

  // Search handler
  const handleSearch = () => {
    fetchItems(null, 'next');
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentCursor(null);
    setCurrentDirection('next');
    fetchItems(null, 'next');
  }, [selectedCategory, selectedItemType, selectedMaterialType, vehicleFilter, selectedCoatingStatus]);

  const fetchItems = async (cursor?: string | null, direction: 'next' | 'prev' = 'next') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedItemType) params.append('itemType', selectedItemType);
      if (selectedMaterialType) params.append('materialType', selectedMaterialType);
      if (vehicleFilter) params.append('vehicleModel', vehicleFilter);
      if (selectedCoatingStatus) params.append('coating_status', selectedCoatingStatus);
      if (searchTerm) params.append('search', searchTerm);
      
      // Pagination parameters
      if (useCursorPagination) {
        params.append('use_cursor', 'true');
        params.append('limit', '20');
        if (cursor) {
          params.append('cursor', cursor);
          params.append('direction', direction);
        }
      } else {
        params.append('page', '1');
        params.append('limit', '20');
      }

      const response = await fetch(`/api/items?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '품목 정보를 불러오지 못했습니다.');
      }

      setItems(data.data?.items ?? []);
      setPagination(data.data?.pagination ?? null);
      setCurrentCursor(cursor || null);
      setCurrentDirection(direction);
    } catch (err) {
      console.error('Failed to fetch items:', err);
      error('데이터 로드 실패', '품목 데이터를 가져오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item: Item) => {
    const deleteAction = async () => {
      setDeletingItemId(item.item_id);
      try {
        const response = await fetch('/api/items', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ item_id: item.item_id })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '품목 삭제에 실패했습니다.');
        }

        success('삭제 완료', '품목이 비활성화되었습니다.');
        fetchItems();
      } finally {
        setDeletingItemId(null);
      }
    };

    await deleteWithToast(deleteAction, {
      title: '품목 삭제',
      itemName: `${item.item_name} (${item.item_code})`,
      successMessage: '품목이 비활성화되었습니다.',
      errorMessage: '품목 삭제 중 오류가 발생했습니다.'
    });
  };

  const handleSaveItem = async (payload: Record<string, unknown>) => {
    try {
      const method = editingItem ? 'PUT' : 'POST';
      const body = editingItem ? { ...payload, item_id: editingItem.item_id } : payload;

      const response = await fetch('/api/items', {
        method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '품목 저장 요청에 실패했습니다.');
      }

      const message = editingItem ? '품목이 수정되었습니다.' : '품목이 등록되었습니다.';
      success(editingItem ? '수정 완료' : '등록 완료', message);
      setShowAddModal(false);
      setEditingItem(null);
      fetchItems();
    } catch (err) {
      console.error('Failed to save item:', err);
      error('요청 실패', '품목 정보를 저장하는 중 오류가 발생했습니다.');
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingItem(null);
  };

  const handleUploadSuccess = () => {
    success('업로드 완료', '품목 데이터가 성공적으로 업로드되었습니다.');
    setShowUploadModal(false);
    fetchItems();
  };

  const handleTemplateDownload = async () => {
    try {
      const response = await fetch('/api/download/template/items');
      if (!response.ok) {
        throw new Error('템플릿 다운로드에 실패했습니다.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'items_template.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download template:', err);
      error('다운로드 실패', '템플릿 파일을 다운로드하지 못했습니다.');
    }
  };

  const resetFilters = () => {
    setSelectedCategory('');
    setSelectedItemType('');
    setSelectedMaterialType('');
    setVehicleFilter('');
    setSelectedCoatingStatus('');
    setSearchTerm('');
    setCurrentCursor(null);
    setCurrentDirection('next');
    fetchItems(null, 'next');
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!normalizedSearch) {
      return items;
    }

    return items.filter((item) => {
      const codeMatch = item.item_code?.toLowerCase().includes(normalizedSearch);
      const nameMatch = item.item_name?.toLowerCase().includes(normalizedSearch);
      const specMatch = item.spec?.toLowerCase().includes(normalizedSearch);
      const materialMatch = item.material?.toLowerCase().includes(normalizedSearch);
      const vehicleMatch = item.vehicle_model?.toLowerCase().includes(normalizedSearch);
      return Boolean(codeMatch || nameMatch || specMatch || materialMatch || vehicleMatch);
    });
  }, [items, normalizedSearch]);

  const filtersApplied = Boolean(
    selectedCategory || selectedItemType || selectedMaterialType || vehicleFilter || selectedCoatingStatus || normalizedSearch
  );

  const printColumns = [
    { key: 'item_code', label: '품목코드', align: 'left' as const, width: '12%' },
    { key: 'item_name', label: '품목명', align: 'left' as const, width: '18%' },
    { key: 'category', label: '분류', align: 'center' as const, width: '8%' },
    { key: 'item_type', label: '타입', align: 'center' as const, width: '8%' },
    { key: 'material_type', label: '소재형태', align: 'center' as const, width: '10%' },
    { key: 'vehicle_model', label: '차종', align: 'left' as const, width: '10%' },
    { key: 'spec', label: '규격', align: 'left' as const, width: '15%' },
    { key: 'coating_status', label: '도장상태', align: 'center' as const, width: '8%' },
    { key: 'mm_weight', label: '단위중량', align: 'right' as const, width: '8%', type: 'number' as const },
    { key: 'current_stock', label: '현재고', align: 'right' as const, width: '8%', type: 'number' as const },
    { key: 'safety_stock', label: '안전재고', align: 'right' as const, width: '8%', type: 'number' as const },
    { key: 'price', label: '기준단가', align: 'right' as const, width: '9%', type: 'currency' as const }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark$text-white">품목 관리</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">자동차 부품 및 원자재 품목을 관리합니다.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <PrintButton
              data={filteredItems}
              columns={printColumns}
              title="품목 목록"
              subtitle={filtersApplied ? '필터 적용됨' : undefined}
              orientation="landscape"
              className="bg-purple-500 hover:bg-purple-600"
            />
            <button
              onClick={handleTemplateDownload}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <Download className="w-5 h-5" />
              템플릿 다운로드
            </button>
            <ItemsExportButton items={filteredItems} filtered={filtersApplied} />
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <Upload className="w-5 h-5" />
              일괄 업로드
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              품목 등록
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="품목코드, 품목명, 규격, 소재로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:w-auto">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체 분류</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              value={selectedItemType}
              onChange={(e) => setSelectedItemType(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체 타입</option>
              {ITEM_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={selectedMaterialType}
              onChange={(e) => setSelectedMaterialType(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체 소재</option>
              {MATERIAL_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              placeholder="차종 필터"
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={selectedCoatingStatus}
              onChange={(e) => setSelectedCoatingStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {COATING_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              초기화
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  품목코드
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  품목명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  분류
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  타입
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  소재형태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  차종
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  규격 / 소재
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  단위중량(kg)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  현재고
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  안전재고
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  기준단가
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  도장상태
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={13} className="p-6">
                    <TableSkeleton rows={8} columns={13} showHeader={false} />
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-gray-500">
                    조건에 맞는 품목이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.item_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.item_code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {item.item_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {item.category ?? '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.item_type === 'FINISHED'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                            : item.item_type === 'SUB'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
                            : item.item_type === 'RAW'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {formatItemTypeLabel(item.item_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {item.material_type ?? '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {item.vehicle_model || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {item.spec || item.material || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {formatNumberValue(item.mm_weight, 4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {formatNumberValue(item.current_stock)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {formatNumberValue(item.safety_stock)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCoatingStatusColor(item.coating_status)}`}>
                        {getCoatingStatusLabel(item.coating_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setShowAddModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deletingItemId === item.item_id}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingItemId === item.item_id ? (
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
        
        {/* Pagination */}
        {pagination && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <Pagination
              pagination={pagination}
              onPageChange={handlePageChange}
              onCursorChange={handleCursorChange}
              loading={loading}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={showAddModal || !!editingItem}
        onClose={handleCloseModal}
        title={editingItem ? '품목 수정' : '품목 등록'}
        size="lg"
      >
        <ItemForm item={editingItem} onSubmit={handleSaveItem} onCancel={handleCloseModal} />
      </Modal>

      <ExcelUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        uploadUrl="/api/upload/items"
        title="품목 데이터 업로드"
        onUploadSuccess={handleUploadSuccess}
      />

      <ConfirmDialog />
    </div>
  );
}

