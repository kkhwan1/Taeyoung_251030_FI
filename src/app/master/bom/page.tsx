'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Network,
  Plus,
  Search,
  Edit2,
  Trash2,
  Filter,
  Copy,
  Upload,
  Download,
  RefreshCw,
  TrendingUp,
  Layers,
  Settings
} from 'lucide-react';
import Modal from '@/components/Modal';
import BOMForm from '@/components/BOMForm';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';
import { BOMExportButton } from '@/components/ExcelExportButton';
import PrintButton from '@/components/PrintButton';

interface BOM {
  bom_id: number;
  parent_item_id: number;
  child_item_id: number;
  parent_item_name?: string;
  child_item_name?: string;
  parent_item_code?: string;
  child_item_code?: string;
  quantity: number;
  level: number;
  notes?: string;
  is_active: boolean;
  material_grade?: string;
  weight_per_piece?: number;
  material_cost?: number;
  net_cost?: number;
  item_scrap_revenue?: number;
  purchase_unit_price?: number;
  item_type?: 'internal_production' | 'external_purchase';
}

interface CoilSpecification {
  coil_spec_id?: number;
  item_id: number;
  material_grade: string;
  thickness: number;
  width: number;
  length?: number;
  coil_weight?: number;
  scrap_rate?: number;
  weight_per_piece?: number;
}

interface FilterState {
  searchTerm: string;
  level: number | null;
  itemType: 'all' | 'internal_production' | 'external_purchase';
  minCost: number | null;
  maxCost: number | null;
}

type TabType = 'structure' | 'coil-specs' | 'cost-analysis';

export default function BOMPage() {
  // State management
  const [activeTab, setActiveTab] = useState<TabType>('structure');
  const [bomData, setBomData] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [selectedParentItem, setSelectedParentItem] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBOM, setEditingBOM] = useState<BOM | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [deletingBomId, setDeletingBomId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedCoilItem, setSelectedCoilItem] = useState<number | null>(null);
  const [costSummary, setCostSummary] = useState<any>(null);

  const { success, error, info } = useToast();
  const { warningConfirm, deleteWithToast, ConfirmDialog } = useConfirm();

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    level: null,
    itemType: 'all',
    minCost: null,
    maxCost: null
  });

  // Print columns
  const printColumns = [
    { key: 'level_display', label: '레벨', align: 'left' as const, width: '8%' },
    { key: 'parent_item_code', label: '모품번', align: 'left' as const, width: '15%' },
    { key: 'parent_item_name', label: '모품명', align: 'left' as const, width: '20%' },
    { key: 'child_item_code', label: '자품번', align: 'left' as const, width: '15%' },
    { key: 'child_item_name', label: '자품명', align: 'left' as const, width: '20%' },
    { key: 'quantity', label: '소요량', align: 'right' as const, width: '10%', type: 'number' as const },
    { key: 'unit', label: '단위', align: 'center' as const, width: '6%' },
    { key: 'notes', label: '비고', align: 'left' as const, width: '6%' }
  ];

  // Fetch items
  const fetchItems = useCallback(async () => {
    try {
      const response = await fetch('/api/items');
      const data = await response.json();
      if (data.success) {
        setItems(data.data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    }
  }, []);

  // Fetch BOM data with cost analysis
  const fetchBOMData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedParentItem) params.append('parent_item_id', selectedParentItem);

      const response = await fetch(`/api/bom?${params}`);
      const data = await response.json();

      if (data.success) {
        // API returns bom_entries (snake_case), not bomEntries (camelCase)
        const bomArray = data.data.bom_entries || [];

        const transformedBOM = bomArray.map((item: any) => ({
          ...item,
          // Map snake_case API fields to component expected format
          parent_item_name: item.parent_name || '',
          parent_item_code: item.parent_code || '',
          child_item_name: item.child_name || '',
          child_item_code: item.child_code || '',
          quantity: item.quantity_required || 0,
          level: item.level_no || 1,
          is_active: item.is_active !== undefined ? item.is_active : true
        }));

        const bomList = showActiveOnly
          ? transformedBOM.filter((item: BOM) => item.is_active)
          : transformedBOM;

        setBomData(bomList);
        setCostSummary(data.data.cost_summary);
      } else {
        console.error('API Error:', data.error);
        error('데이터 로딩 실패', data.error || 'BOM 데이터를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to fetch BOM data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedParentItem, showActiveOnly]);

  // Initial fetch
  useEffect(() => {
    fetchBOMData();
    fetchItems();
  }, [fetchBOMData, fetchItems]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      fetchBOMData();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, fetchBOMData]);

  // File upload handlers
  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/bom/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        success('업로드 완료', `${result.stats?.valid_rows || 0}개 항목이 성공적으로 업로드되었습니다`);
        await fetchBOMData();
      } else {
        error('업로드 실패', result.error || '업로드 중 오류가 발생했습니다');
        console.error('Upload errors:', result.details);
      }
    } catch (err) {
      console.error('Upload error:', err);
      error('업로드 실패', '업로드 중 오류가 발생했습니다');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Filter logic
  const applyFilters = (data: BOM[]): BOM[] => {
    return data.filter(entry => {
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const matchesCode = entry.child_item_code?.toLowerCase().includes(term) ||
                           entry.parent_item_code?.toLowerCase().includes(term);
        const matchesName = entry.child_item_name?.toLowerCase().includes(term) ||
                           entry.parent_item_name?.toLowerCase().includes(term);
        if (!matchesCode && !matchesName) return false;
      }

      if (filters.level !== null && entry.level !== filters.level) {
        return false;
      }

      if (filters.itemType !== 'all' && entry.item_type !== filters.itemType) {
        return false;
      }

      if (filters.minCost !== null && (entry.net_cost || 0) < filters.minCost) {
        return false;
      }
      if (filters.maxCost !== null && (entry.net_cost || 0) > filters.maxCost) {
        return false;
      }

      return true;
    });
  };

  const filteredData = useMemo(() => applyFilters(bomData), [bomData, filters]);

  // CRUD handlers
  const handleDelete = async (bom: BOM) => {
    const deleteAction = async () => {
      setDeletingBomId(bom.bom_id);
      try {
        const response = await fetch(`/api/bom?id=${bom.bom_id}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'BOM 삭제에 실패했습니다.');
        }

        fetchBOMData();
      } catch (err) {
        console.error('Failed to delete BOM item:', err);
        throw err;
      } finally {
        setDeletingBomId(null);
      }
    };

    await deleteWithToast(deleteAction, {
      title: 'BOM 삭제',
      itemName: `${bom.parent_item_name || '알 수 없는 품목'} → ${bom.child_item_name || '알 수 없는 품목'}`,
      successMessage: 'BOM 항목이 성공적으로 삭제되었습니다.',
      errorMessage: 'BOM 삭제에 실패했습니다.'
    });
  };

  const handleSaveBOM = async (bomData: Omit<BOM, 'bom_id' | 'is_active' | 'level'>) => {
    try {
      const method = editingBOM ? 'PUT' : 'POST';
      const body = editingBOM
        ? { ...bomData, bom_id: editingBOM.bom_id }
        : bomData;

      const response = await fetch('/api/bom', {
        method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const successMessage = editingBOM ? 'BOM이 성공적으로 수정되었습니다.' : 'BOM이 성공적으로 등록되었습니다.';
        success(editingBOM ? 'BOM 수정 완료' : 'BOM 등록 완료', successMessage);
        setShowAddModal(false);
        setEditingBOM(null);
        fetchBOMData();
      } else {
        const errorData = await response.json();
        error('저장 실패', errorData.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to save BOM:', err);
      error('네트워크 오류', '서버와의 연결에 문제가 발생했습니다.');
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingBOM(null);
  };

  const handleCopyBOM = async (bom: BOM) => {
    const confirmed = await warningConfirm('BOM 복사 확인', `${bom.parent_item_name || '알 수 없는 품목'}의 BOM 구조를 복사하시겠습니까?`);
    if (!confirmed) return;

    info('준비 중', 'BOM 복사 기능은 준비 중입니다.');
  };

  const handleCoilSpecsSave = async (specs: CoilSpecification) => {
    try {
      const url = specs.coil_spec_id ? `/api/coil-specs/${specs.coil_spec_id}` : '/api/coil-specs';
      const method = specs.coil_spec_id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specs)
      });

      const result = await response.json();

      if (result.success) {
        await fetchBOMData();
        success('저장 완료', '코일 규격이 저장되었습니다');
        setSelectedCoilItem(null);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Save failed:', err);
      error('저장 실패', '코일 규격 저장에 실패했습니다');
    }
  };

  const handleExportToExcel = () => {
    const params = new URLSearchParams();
    params.append('include_cost_analysis', 'true');

    window.location.href = `/api/bom/export?${params}`;
  };

  // Render functions
  const renderBOMRows = (bomList: BOM[]): React.ReactElement[] => {
    return bomList.map((bom) => (
      <tr key={bom.bom_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center" style={{ paddingLeft: `${(bom.level || 0) * 20}px` }}>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {bom.parent_item_code || '-'}
            </span>
          </div>
        </td>
        <td className="px-6 py-4">
          <span className="text-sm text-gray-900 dark:text-white">
            {bom.parent_item_name || '-'}
          </span>
        </td>
        <td className="px-6 py-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {bom.child_item_code || '-'}
          </span>
        </td>
        <td className="px-6 py-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {bom.child_item_name || '-'}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
          {parseFloat((bom.quantity || 0).toString()).toLocaleString()}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
          EA
        </td>
        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
          {bom.notes || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            bom.is_active
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
          }`}>
            {bom.is_active ? '활성' : '비활성'}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-center">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => handleCopyBOM(bom)}
              className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
              title="BOM 복사"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setEditingBOM(bom);
                setShowAddModal(true);
              }}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              title="수정"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(bom)}
              disabled={deletingBomId === bom.bom_id}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title="삭제"
            >
              {deletingBomId === bom.bom_id ? (
                <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </td>
      </tr>
    ));
  };

  const renderCoilSpecsTab = () => {
    const coilItems = filteredData.filter(entry => entry.material_grade);

    return (
      <div className="coil-specs-tab space-y-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">코일 품목 목록</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              재질등급이 설정된 코일 품목 {coilItems.length}개
            </p>
          </div>
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
                    재질등급
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    EA중량 (kg)
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {coilItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      코일 품목이 없습니다
                    </td>
                  </tr>
                ) : (
                  coilItems.map(item => (
                    <tr key={item.child_item_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {item.child_item_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {item.child_item_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {item.material_grade}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                        {item.weight_per_piece?.toFixed(3) || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setSelectedCoilItem(item.child_item_id)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Settings className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedCoilItem && (
          <div
            className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
            onClick={() => setSelectedCoilItem(null)}
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">코일 규격 편집</h3>
              <div className="text-center text-gray-600 dark:text-gray-400 py-8">
                <p>코일 규격 편집 폼은 구현 중입니다.</p>
                <p className="text-sm mt-2">품목 ID: {selectedCoilItem}</p>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setSelectedCoilItem(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCostAnalysisTab = () => {
    if (!costSummary) return null;

    return (
      <div className="cost-analysis-tab space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">총 재료비</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  ₩{costSummary.total_material_cost?.toLocaleString() || 0}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">스크랩 수익</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  ₩{costSummary.total_scrap_revenue?.toLocaleString() || 0}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">순 원가</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  ₩{costSummary.total_net_cost?.toLocaleString() || 0}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">품목 구성</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {filteredData.length}개
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  코일 {costSummary.coil_count || 0} / 구매 {costSummary.purchased_count || 0}
                </p>
              </div>
              <Layers className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Detailed Cost Table */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">상세 원가 분석</h3>
          </div>
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    재료비
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    스크랩 수익
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    순 원가
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    구분
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => (
                    <tr key={item.bom_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {item.child_item_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {item.child_item_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                        ₩{item.material_cost?.toLocaleString() || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-green-600 dark:text-green-400">
                        ₩{item.item_scrap_revenue?.toLocaleString() || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900 dark:text-white">
                        ₩{item.net_cost?.toLocaleString() || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.item_type === 'internal_production'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        }`}>
                          {item.item_type === 'internal_production' ? '내부생산' : '외부구매'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'structure':
        return (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      모품번
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      모품명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      자품번
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      자품명
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      소요량
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      단위
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      비고
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                        데이터를 불러오는 중...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                        등록된 BOM이 없습니다
                      </td>
                    </tr>
                  ) : (
                    renderBOMRows(filteredData)
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'coil-specs':
        return renderCoilSpecsTab();

      case 'cost-analysis':
        return renderCostAnalysisTab();

      default:
        return null;
    }
  };

  const printableBOMData = filteredData.map(bom => ({
    ...bom,
    level_display: '├─'.repeat((bom.level || 0)) + (bom.level ? ' ' : ''),
    unit: 'EA'
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Network className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">BOM 관리</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">부품 구성표(Bill of Materials)를 관리합니다</p>
            </div>
          </div>
          <div className="flex gap-2">
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">자동 새로고침</span>
            </label>

            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              >
                <option value={10000}>10초</option>
                <option value={30000}>30초</option>
                <option value={60000}>1분</option>
                <option value={300000}>5분</option>
              </select>
            )}

            <button
              onClick={fetchBOMData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>

            <label
              className={`flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'
              } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-4 h-4" />
              {uploading ? '업로드 중...' : '업로드'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInputChange}
                disabled={uploading}
                className="hidden"
              />
            </label>

            <button
              onClick={handleExportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              <Download className="w-4 h-4" />
              다운로드
            </button>

            <PrintButton
              data={printableBOMData}
              columns={printColumns}
              title="BOM 구조도"
              subtitle={selectedParentItem ? `모품목 필터 적용` : undefined}
              orientation="landscape"
              className="bg-purple-500 hover:bg-purple-600"
            />

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              BOM 등록
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="품번, 품명으로 검색..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filters.level || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                level: e.target.value ? parseInt(e.target.value) : null
              }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">모든 레벨</option>
              <option value="1">Level 1</option>
              <option value="2">Level 2</option>
              <option value="3">Level 3</option>
              <option value="4">Level 4</option>
              <option value="5">Level 5</option>
            </select>

            <select
              value={filters.itemType}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                itemType: e.target.value as FilterState['itemType']
              }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              <option value="all">모든 품목</option>
              <option value="internal_production">내부생산</option>
              <option value="external_purchase">외부구매</option>
            </select>

            <input
              type="number"
              placeholder="최소 원가"
              value={filters.minCost || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                minCost: e.target.value ? parseFloat(e.target.value) : null
              }))}
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm"
            />

            <span className="flex items-center text-gray-500">~</span>

            <input
              type="number"
              placeholder="최대 원가"
              value={filters.maxCost || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                maxCost: e.target.value ? parseFloat(e.target.value) : null
              }))}
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm"
            />

            <select
              value={selectedParentItem}
              onChange={(e) => setSelectedParentItem(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">전체 모품목</option>
              {items.filter(item => item.category === '제품').map(item => (
                <option key={item.item_id} value={item.item_id}>
                  {item.item_code} - {item.item_name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg">
              <input
                type="checkbox"
                id="activeOnly"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="activeOnly" className="text-sm text-gray-700 dark:text-gray-300">
                활성만 표시
              </label>
            </div>

            <button
              onClick={() => setFilters({
                searchTerm: '',
                level: null,
                itemType: 'all',
                minCost: null,
                maxCost: null
              })}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
            >
              초기화
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('structure')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'structure'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4" />
                BOM 구조
              </div>
            </button>
            <button
              onClick={() => setActiveTab('coil-specs')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'coil-specs'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                코일 규격
              </div>
            </button>
            <button
              onClick={() => setActiveTab('cost-analysis')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'cost-analysis'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                원가 분석
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>

      {/* Modal for Add/Edit BOM */}
      <Modal
        isOpen={showAddModal || !!editingBOM}
        onClose={handleCloseModal}
        title={editingBOM ? 'BOM 수정' : 'BOM 등록'}
        size="lg"
      >
        <BOMForm
          bom={editingBOM}
          items={items}
          onSubmit={handleSaveBOM}
          onCancel={handleCloseModal}
        />
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
}
