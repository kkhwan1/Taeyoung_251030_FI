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
  Settings,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List
} from 'lucide-react';
import Modal from '@/components/Modal';
import BOMForm from '@/components/BOMForm';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';
import { BOMExportButton } from '@/components/ExcelExportButton';
import PrintButton from '@/components/PrintButton';
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Pie } from 'recharts';

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
  // 원가 정보 추가
  unit_price?: number;
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
type ViewMode = 'table' | 'grouped';
type CoilSpecsViewMode = 'table' | 'card';
type CostAnalysisViewMode = 'overview' | 'table' | 'charts';

export default function BOMPage() {
  // State management
  const [activeTab, setActiveTab] = useState<TabType>('structure');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [coilSpecsViewMode, setCoilSpecsViewMode] = useState<CoilSpecsViewMode>('table');
  const [costAnalysisViewMode, setCostAnalysisViewMode] = useState<CostAnalysisViewMode>('overview');
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
  const [priceMonth, setPriceMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showFilters, setShowFilters] = useState(false); // 필터 토글 (모바일용)
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set()); // 그룹화 뷰 확장/축소

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
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const data = await safeFetchJson('/api/items?limit=1000', {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });
      
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
      params.append('price_month', priceMonth + '-01'); // 기준 월 추가

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const data = await safeFetchJson(`/api/bom?${params}`, {}, {
        timeout: 30000, // 30초 타임아웃 (대량 데이터 처리)
        maxRetries: 3,
        retryDelay: 1000
      });

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
          is_active: item.is_active !== undefined ? item.is_active : true,
          // 원가 정보 추가
          unit_price: item.unit_price || 0,
          material_cost: item.material_cost || 0,
          net_cost: item.net_cost || 0
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
  }, [selectedParentItem, showActiveOnly, priceMonth]);

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

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson('/api/bom/upload', {
        method: 'POST',
        body: formData
      }, {
        timeout: 120000,
        maxRetries: 1,
        retryDelay: 2000
      });

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

  // 모품목별 그룹화 함수
  const groupBOMByParent = useCallback((bomList: BOM[]): Map<number, BOM[]> => {
    const grouped = new Map<number, BOM[]>();
    bomList.forEach(bom => {
      const parentId = bom.parent_item_id;
      if (!grouped.has(parentId)) {
        grouped.set(parentId, []);
      }
      grouped.get(parentId)!.push(bom);
    });
    return grouped;
  }, []);

  // 그룹화된 데이터 (메모이제이션)
  const groupedBOMData = useMemo(() => {
    if (viewMode !== 'grouped' || selectedParentItem) return null;
    return groupBOMByParent(filteredData);
  }, [filteredData, viewMode, selectedParentItem, groupBOMByParent]);

  // 확장/축소 토글 함수
  const toggleParent = useCallback((parentId: number) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }, []);

  // 모두 확장/축소 함수
  const toggleAllParents = useCallback((expand: boolean) => {
    if (!groupedBOMData) return;
    if (expand) {
      const allParentIds = Array.from(groupedBOMData.keys());
      setExpandedParents(new Set(allParentIds));
    } else {
      setExpandedParents(new Set());
    }
  }, [groupedBOMData]);

  // 검색어가 있을 때 관련 모품목 자동 확장
  useEffect(() => {
    if (!groupedBOMData || !filters.searchTerm) return;

    const searchTerm = filters.searchTerm.toLowerCase();
    const matchingParentIds = new Set<number>();

    groupedBOMData.forEach((bomEntries, parentId) => {
      const parentItem = items.find(item => item.item_id === parentId);
      const matchesParent = 
        parentItem?.item_code?.toLowerCase().includes(searchTerm) ||
        parentItem?.item_name?.toLowerCase().includes(searchTerm);
      
      const matchesChild = bomEntries.some(bom =>
        bom.child_item_code?.toLowerCase().includes(searchTerm) ||
        bom.child_item_name?.toLowerCase().includes(searchTerm)
      );

      if (matchesParent || matchesChild) {
        matchingParentIds.add(parentId);
      }
    });

    if (matchingParentIds.size > 0) {
      setExpandedParents(prev => {
        const next = new Set(prev);
        matchingParentIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [filters.searchTerm, groupedBOMData, items]);

  // CRUD handlers
  const handleDelete = async (bom: BOM) => {
    const deleteAction = async () => {
      setDeletingBomId(bom.bom_id);
      try {
        const { safeFetchJson } = await import('@/lib/fetch-utils');
        const data = await safeFetchJson(`/api/bom?id=${bom.bom_id}`, {
          method: 'DELETE'
        }, {
          timeout: 15000,
          maxRetries: 2,
          retryDelay: 1000
        });

        if (!data.success) {
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
      // API는 quantity_required를 기대하므로 변환
      const apiBody = {
        ...bomData,
        quantity_required: bomData.quantity,
      };
      delete (apiBody as any).quantity; // quantity 제거
      
      const body = editingBOM
        ? { ...apiBody, bom_id: editingBOM.bom_id }
        : apiBody;

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson('/api/bom', {
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

      if (result.success) {
        const successMessage = editingBOM ? 'BOM이 성공적으로 수정되었습니다.' : 'BOM이 성공적으로 등록되었습니다.';
        success(editingBOM ? 'BOM 수정 완료' : 'BOM 등록 완료', successMessage);
        setShowAddModal(false);
        setEditingBOM(null);
        fetchBOMData();
      } else {
        error('저장 실패', result.error || '저장에 실패했습니다.');
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

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specs)
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

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

  const handleTemplateDownload = async () => {
    try {
      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch('/api/download/template/bom', {}, {
        timeout: 30000,
        maxRetries: 2,
        retryDelay: 1000
      });
      if (!response.ok) {
        throw new Error('템플릿 다운로드에 실패했습니다.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'BOM_템플릿.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      success('템플릿 다운로드 완료', 'BOM 템플릿 파일이 다운로드되었습니다.');
    } catch (err) {
      console.error('Failed to download template:', err);
      error('다운로드 실패', '템플릿 파일을 다운로드하지 못했습니다.');
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
        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
          <div className="flex items-center" style={{ paddingLeft: `${(bom.level || 0) * 20}px` }}>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {bom.parent_item_code || '-'}
            </span>
          </div>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4">
          <span className="text-sm text-gray-900 dark:text-white">
            {bom.parent_item_name || '-'}
          </span>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {bom.child_item_code || '-'}
          </span>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {bom.child_item_name || '-'}
          </span>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
          {parseFloat((bom.quantity || 0).toString()).toLocaleString()}
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
          EA
        </td>
        {/* 원가 정보 추가 */}
        <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-right text-gray-900 dark:text-white">
          {bom.unit_price?.toLocaleString() || '-'}
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-right font-semibold text-gray-900 dark:text-white">
          {bom.material_cost?.toLocaleString() || '-'}
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300">
            {bom.item_type === 'internal_production' ? '내부생산' : bom.item_type === 'external_purchase' ? '외부구매' : '-'}
          </span>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600 dark:text-gray-400">
          {bom.notes || '-'}
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300">
            {bom.is_active ? '활성' : '비활성'}
          </span>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => handleCopyBOM(bom)}
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
              title="BOM 복사"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setEditingBOM(bom);
                setShowAddModal(true);
              }}
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
              title="수정"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(bom)}
              disabled={deletingBomId === bom.bom_id}
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title="삭제"
            >
              {deletingBomId === bom.bom_id ? (
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </td>
      </tr>
    ));
  };

  // 그룹화 뷰 렌더링 함수
  const renderGroupedView = () => {
    if (!groupedBOMData || groupedBOMData.size === 0) {
      return (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-12 text-center text-gray-500">
            {loading ? '데이터를 불러오는 중...' : '등록된 BOM이 없습니다'}
          </div>
        </div>
      );
    }

    const parentIds = Array.from(groupedBOMData.keys()).sort((a, b) => {
      const itemA = items.find(item => item.item_id === a);
      const itemB = items.find(item => item.item_id === b);
      const codeA = itemA?.item_code || '';
      const codeB = itemB?.item_code || '';
      return codeA.localeCompare(codeB);
    });

    return (
      <div className="space-y-4">
        {/* 모두 확장/축소 버튼 */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            총 <span className="font-semibold text-gray-900 dark:text-white">{parentIds.length}개</span> 모품목
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleAllParents(true)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              모두 확장
            </button>
            <button
              onClick={() => toggleAllParents(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              모두 축소
            </button>
          </div>
        </div>

        {/* 모품목별 그룹 */}
        {parentIds.map(parentId => {
          const bomEntries = groupedBOMData.get(parentId) || [];
          const parentItem = items.find(item => item.item_id === parentId);
          const isExpanded = expandedParents.has(parentId);
          const bomCount = bomEntries.length;

          return (
            <div
              key={parentId}
              className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
            >
              {/* 모품목 헤더 */}
              <div
                className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => toggleParent(parentId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {parentItem?.item_code || `ID: ${parentId}`}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {parentItem?.item_name || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      BOM 항목: <span className="font-medium text-gray-700 dark:text-gray-300">{bomCount}개</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* BOM 항목 테이블 */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                          자품번
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                          자품명
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                          소요량
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                          단위
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                          단가 (₩)
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                          재료비 (₩)
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                          구분
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                          비고
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                          상태
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                          작업
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {renderBOMRows(bomEntries)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderCoilSpecsTab = () => {
    const coilItems = filteredData.filter(entry => entry.material_grade);

    // 재질등급별 그룹화 (useMemo는 함수 내부에서 사용 불가하므로 직접 계산)
    const groupedByGrade = (() => {
      const grouped = new Map<string, typeof coilItems>();
      coilItems.forEach(item => {
        const grade = item.material_grade || '기타';
        if (!grouped.has(grade)) {
          grouped.set(grade, []);
        }
        grouped.get(grade)!.push(item);
      });
      return grouped;
    })();

    if (coilSpecsViewMode === 'card') {
      return (
        <div className="coil-specs-tab space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">코일 품목 목록</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                재질등급이 설정된 코일 품목 {coilItems.length}개
              </p>
            </div>
            <div className="p-4">
              {groupedByGrade.size === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  코일 품목이 없습니다
                </div>
              ) : (
                <div className="space-y-6">
                  {Array.from(groupedByGrade.entries()).map(([grade, items]) => (
                    <div key={grade} className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">
                        재질등급: {grade} ({items.length}개)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {items.map(item => (
                          <div
                            key={item.child_item_id}
                            className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="font-semibold text-sm text-gray-900 dark:text-white">
                                  {item.child_item_code}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  {item.child_item_name}
                                </div>
                              </div>
                              <button
                                onClick={() => setSelectedCoilItem(item.child_item_id)}
                                className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 flex-shrink-0 ml-2"
                                title="설정"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-600 dark:text-gray-400">재질등급:</span>
                                <span className="font-medium text-gray-900 dark:text-white">{grade}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs mt-1">
                                <span className="text-gray-600 dark:text-gray-400">EA중량:</span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {item.weight_per_piece?.toFixed(3) || '-'} kg
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 테이블 뷰 (기본)
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
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    품목코드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    품목명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    재질등급
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    EA중량 (kg)
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
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
                          className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
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

    // 차트 뷰만
    if (costAnalysisViewMode === 'charts') {
      return (
        <div className="cost-analysis-tab space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">총 재료비</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    ₩{(costSummary?.total_material_cost || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    기준월: {priceMonth}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">스크랩 수익</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    ₩{costSummary.total_scrap_revenue?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">순 원가</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    ₩{(costSummary?.total_net_cost || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">품목 구성</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {filteredData.length}개
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    코일 {costSummary.coil_count || 0} / 구매 {costSummary.purchased_count || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 차트 섹션 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 원가 구성비 파이 차트 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">원가 구성비</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={[
                        { name: '재료비', value: costSummary?.total_material_cost || 0, color: '#4B5563' },
                        { name: '스크랩 수익', value: costSummary?.total_scrap_revenue || 0, color: '#525252' },
                        { name: '순 원가', value: costSummary?.total_net_cost || 0, color: '#6B7280' }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={(props: any) => `${props.name} ${((props.percent ?? 0) * 100).toFixed(1)}%`}
                    >
                      {[
                        { name: '재료비', value: costSummary?.total_material_cost || 0, color: '#4B5563' },
                        { name: '스크랩 수익', value: costSummary?.total_scrap_revenue || 0, color: '#525252' },
                        { name: '순 원가', value: costSummary?.total_net_cost || 0, color: '#6B7280' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`₩${Number(value).toLocaleString()}`, '금액']} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 레벨별 원가 분석 바 차트 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">레벨별 원가 분석</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredData.map(item => ({
                    level: `L${item.level || 1}`,
                    cost: item.net_cost || 0,
                    materialCost: item.material_cost || 0
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="level" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`₩${Number(value).toLocaleString()}`, '원가']} />
                    <Legend />
                    <Bar dataKey="cost" fill="#4B5563" name="순 원가" />
                    <Bar dataKey="materialCost" fill="#6B7280" name="재료비" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 수율 분석 섹션 */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">수율 분석</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">내부생산 품목</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-600 dark:text-gray-400">
                  {filteredData.filter(item => item.item_type === 'internal_production').length}개
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">외부구매 품목</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-600 dark:text-gray-400">
                  {filteredData.filter(item => item.item_type === 'external_purchase').length}개
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">평균 레벨</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-600 dark:text-gray-400">
                  {filteredData.length > 0 ? (filteredData.reduce((sum, item) => sum + (item.level || 1), 0) / filteredData.length).toFixed(1) : '0'}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 테이블 뷰만
    if (costAnalysisViewMode === 'table') {
      return (
        <div className="cost-analysis-tab space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">상세 원가 분석</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      품목코드
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      품목명
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      재료비
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      스크랩 수익
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      순 원가
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      레벨
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      구분
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
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
                        <td className="px-6 py-4 text-sm text-right text-gray-600 dark:text-gray-400">
                          ₩{item.item_scrap_revenue?.toLocaleString() || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900 dark:text-white">
                          ₩{item.net_cost?.toLocaleString() || '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                            L{item.level || 1}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300">
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
    }

    // 개요 뷰 (기본 - 전체)
    return (
      <div className="cost-analysis-tab space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">총 재료비</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  ₩{(costSummary?.total_material_cost || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  기준월: {priceMonth}
                </p>
              </div>
              
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">스크랩 수익</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  ₩{costSummary.total_scrap_revenue?.toLocaleString() || 0}
                </p>
              </div>
              
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">순 원가</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  ₩{costSummary.total_net_cost?.toLocaleString() || 0}
                </p>
              </div>
              
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">품목 구성</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {filteredData.length}개
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  코일 {costSummary.coil_count || 0} / 구매 {costSummary.purchased_count || 0}
                </p>
              </div>
              
            </div>
          </div>
        </div>

        {/* 차트 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 원가 구성비 파이 차트 */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">원가 구성비</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={[
                      { name: '재료비', value: costSummary?.total_material_cost || 0, color: '#4B5563' },
                      { name: '스크랩 수익', value: costSummary?.total_scrap_revenue || 0, color: '#525252' },
                      { name: '순 원가', value: costSummary?.total_net_cost || 0, color: '#6B7280' }
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={(props: any) => `${props.name} ${((props.percent ?? 0) * 100).toFixed(1)}%`}
                  >
                    {[
                      { name: '재료비', value: costSummary?.total_material_cost || 0, color: '#4B5563' },
                      { name: '스크랩 수익', value: costSummary?.total_scrap_revenue || 0, color: '#525252' },
                      { name: '순 원가', value: costSummary?.total_net_cost || 0, color: '#6B7280' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`₩${Number(value).toLocaleString()}`, '금액']} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 레벨별 원가 분석 바 차트 */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">레벨별 원가 분석</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredData.map(item => ({
                  level: `L${item.level || 1}`,
                  cost: item.net_cost || 0,
                  materialCost: item.material_cost || 0
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`₩${Number(value).toLocaleString()}`, '원가']} />
                  <Legend />
                  <Bar dataKey="cost" fill="#4B5563" name="순 원가" />
                  <Bar dataKey="materialCost" fill="#6B7280" name="재료비" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 수율 분석 섹션 */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">수율 분석</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">내부생산 품목</p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-600 dark:text-gray-400">
                {filteredData.filter(item => item.item_type === 'internal_production').length}개
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">외부구매 품목</p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-600 dark:text-gray-400">
                {filteredData.filter(item => item.item_type === 'external_purchase').length}개
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">평균 레벨</p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-600 dark:text-gray-400">
                {filteredData.length > 0 ? (filteredData.reduce((sum, item) => sum + (item.level || 1), 0) / filteredData.length).toFixed(1) : '0'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">상세 원가 분석</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    품목코드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    품목명
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    재료비
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    스크랩 수익
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    순 원가
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    레벨
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    구분
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
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
                      <td className="px-6 py-4 text-sm text-right text-gray-600 dark:text-gray-400">
                        ₩{item.item_scrap_revenue?.toLocaleString() || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900 dark:text-white">
                        ₩{item.net_cost?.toLocaleString() || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                          L{item.level || 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300">
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
        // 뷰 모드에 따라 테이블 또는 그룹화 뷰 선택
        // 모품목이 선택된 경우 항상 테이블 뷰
        if (viewMode === 'grouped' && !selectedParentItem) {
          return renderGroupedView();
        }
        
        // 테이블 뷰 (기본)
        return (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      모품번
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      모품명
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      자품번
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      자품명
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      소요량
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      단위
                    </th>
                    {/* 원가 정보 컬럼 추가 */}
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      단가 (₩)
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      재료비 (₩)
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      구분
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      비고
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      상태
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                        데이터를 불러오는 중...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
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
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Network className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600 dark:text-gray-400" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">BOM 관리</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">부품 구성표(Bill of Materials)를 관리합니다</p>
            </div>
          </div>
          <div className="flex flex-nowrap gap-1.5 items-center overflow-x-auto pb-1">
            {/* 그룹 1: 자동 새로고침 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <label className="flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-gray-600 focus:ring-gray-400 dark:focus:ring-gray-500"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">자동갱신</span>
              </label>

              {autoRefresh && (
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs whitespace-nowrap"
                >
                  <option value={10000}>10초</option>
                  <option value={30000}>30초</option>
                  <option value={60000}>1분</option>
                  <option value={300000}>5분</option>
                </select>
              )}
            </div>

            {/* 구분선 */}
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>

            {/* 그룹 2: 주요 액션 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={fetchBOMData}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                갱신
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors whitespace-nowrap text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                BOM 등록
              </button>
            </div>

            {/* 구분선 */}
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>

            {/* 그룹 3: 파일 관련 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={handleTemplateDownload}
                className="flex items-center gap-1 px-2 py-1 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors whitespace-nowrap text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                템플릿
              </button>

              <label
                className={`flex items-center gap-1 px-2 py-1 border-2 border-dashed rounded-lg cursor-pointer transition-colors whitespace-nowrap text-xs ${
                  dragActive
                    ? 'border-gray-500 bg-gray-50 dark:bg-gray-900/20'
                    : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'
                } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? '중...' : '업로드'}
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
                className="flex items-center gap-1 px-2 py-1 bg-gray-800 text-white rounded-lg hover:bg-gray-700 whitespace-nowrap text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                내보내기
              </button>

              <PrintButton
                data={printableBOMData}
                columns={printColumns}
                title="BOM 구조도"
                subtitle={selectedParentItem ? `모품목 필터 적용` : undefined}
                orientation="landscape"
                className="bg-gray-800 hover:bg-gray-700 text-white whitespace-nowrap text-xs px-2 py-1 flex items-center gap-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col gap-4">
          {/* 첫 번째 줄: 검색창만 */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="품번, 품명으로 검색..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
              />
            </div>
          </div>
          
          {/* 두 번째 줄: 필터 토글 버튼 (모바일에서만 표시) */}
          <div className="md:hidden">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? '필터 접기' : '필터 보기'}
            </button>
          </div>
          
          {/* 세 번째 줄: 필터 영역 */}
          <div className={`${showFilters ? 'flex' : 'hidden md:flex'} flex-nowrap gap-2 items-end overflow-x-auto pb-1`}>
            {/* 기준 월 선택 */}
            <div className="flex flex-col gap-1 flex-shrink-0">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                기준 월
              </label>
              <input
                type="month"
                value={priceMonth}
                onChange={(e) => setPriceMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm whitespace-nowrap"
              />
            </div>

            <select
              value={filters.level || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                level: e.target.value ? parseInt(e.target.value) : null
              }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm flex-shrink-0 whitespace-nowrap"
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
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm flex-shrink-0 whitespace-nowrap"
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
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm flex-shrink-0 whitespace-nowrap"
            />

            <span className="flex items-center text-gray-500 flex-shrink-0 whitespace-nowrap">~</span>

            <input
              type="number"
              placeholder="최대 원가"
              value={filters.maxCost || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                maxCost: e.target.value ? parseFloat(e.target.value) : null
              }))}
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm flex-shrink-0 whitespace-nowrap"
            />

            <select
              value={selectedParentItem}
              onChange={(e) => setSelectedParentItem(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm flex-shrink-0 whitespace-nowrap min-w-[180px]"
            >
              <option value="">전체 모품목</option>
              {items.filter(item => item.category === '제품').map(item => (
                <option key={item.item_id} value={item.item_id}>
                  {item.item_code} - {item.item_name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg flex-shrink-0 whitespace-nowrap">
              <input
                type="checkbox"
                id="activeOnly"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="rounded border-gray-300 text-gray-600 focus:ring-gray-400 dark:focus:ring-gray-500"
              />
              <label htmlFor="activeOnly" className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
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
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm flex-shrink-0 whitespace-nowrap"
            >
              초기화
            </button>

            {/* 뷰 모드 토글 버튼 (모든 탭에서 표시) */}
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>
            <div className="flex items-center gap-1 border border-gray-300 dark:border-gray-700 rounded-lg p-1 flex-shrink-0">
              {activeTab === 'structure' && (
                <>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      viewMode === 'table'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="테이블 뷰"
                  >
                    <List className="w-3.5 h-3.5" />
                    테이블
                  </button>
                  <button
                    onClick={() => setViewMode('grouped')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      viewMode === 'grouped'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="그룹화 뷰"
                    disabled={!!selectedParentItem}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    그룹화
                  </button>
                </>
              )}
              {activeTab === 'coil-specs' && (
                <>
                  <button
                    onClick={() => setCoilSpecsViewMode('table')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      coilSpecsViewMode === 'table'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="테이블 뷰"
                  >
                    <List className="w-3.5 h-3.5" />
                    테이블
                  </button>
                  <button
                    onClick={() => setCoilSpecsViewMode('card')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      coilSpecsViewMode === 'card'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="카드 뷰"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    카드
                  </button>
                </>
              )}
              {activeTab === 'cost-analysis' && (
                <>
                  <button
                    onClick={() => setCostAnalysisViewMode('overview')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      costAnalysisViewMode === 'overview'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="개요 뷰"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    개요
                  </button>
                  <button
                    onClick={() => setCostAnalysisViewMode('table')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      costAnalysisViewMode === 'table'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="테이블 뷰"
                  >
                    <List className="w-3.5 h-3.5" />
                    테이블
                  </button>
                  <button
                    onClick={() => setCostAnalysisViewMode('charts')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      costAnalysisViewMode === 'charts'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="차트 뷰"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    차트
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('structure')}
              className={`px-3 sm:px-6 py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'structure'
                  ? 'border-gray-500 text-gray-600 dark:text-gray-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Network className="w-3 h-3 sm:w-4 sm:h-4" />
                BOM 구조
              </div>
            </button>
            <button
              onClick={() => setActiveTab('coil-specs')}
              className={`px-3 sm:px-6 py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'coil-specs'
                  ? 'border-gray-500 text-gray-600 dark:text-gray-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
                코일 규격
              </div>
            </button>
            <button
              onClick={() => setActiveTab('cost-analysis')}
              className={`px-3 sm:px-6 py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'cost-analysis'
                  ? 'border-gray-500 text-gray-600 dark:text-gray-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                
                원가 분석
              </div>
            </button>
          </nav>
        </div>

        <div className="p-3 sm:p-6">
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
