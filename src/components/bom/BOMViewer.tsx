'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  Plus,
  Search,
  Filter,
  Download,
  Package,
  Wrench,
  Box,
  AlertCircle,
  Check,
  X,
  RefreshCw
} from 'lucide-react';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../hooks/useConfirm';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface BOMEntry {
  bom_id: number;
  parent_item_id: number;
  parent_item_code: string;
  parent_item_name: string;
  child_item_id: number;
  child_item_code: string;
  child_item_name: string;
  quantity_required: number;
  level: number;
  item_type: 'internal_production' | 'external_purchase';
  // Cost data
  piece_unit_price?: number;
  material_cost?: number;
  scrap_revenue?: number;
  net_cost?: number;
  // Specs
  material_grade?: string;
  weight_per_piece?: number;
  is_active: boolean;
}

interface BOMViewerProps {
  parentItemId?: number;
  onUpdate?: (bomId: number, updates: Partial<BOMEntry>) => Promise<void>;
  onDelete?: (bomId: number) => Promise<void>;
  onAdd?: (parentId: number, childId: number, quantity: number) => Promise<void>;
  readOnly?: boolean;
}

interface CostSummary {
  total_material_cost: number;
  total_scrap_revenue: number;
  total_net_cost: number;
  coil_count: number;
  purchased_count: number;
  total_items: number;
}

interface TreeNode {
  entry: BOMEntry;
  children: TreeNode[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatCurrency = (value?: number): string => {
  if (value === undefined || value === null) return '0';
  return new Intl.NumberFormat('ko-KR').format(value);
};

const getItemIcon = (itemType: string): React.ReactNode => {
  switch (itemType) {
    case 'internal_production':
      return <Wrench className="w-4 h-4 text-blue-500" />;
    case 'external_purchase':
      return <Package className="w-4 h-4 text-green-500" />;
    default:
      return <Box className="w-4 h-4 text-gray-500" />;
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const BOMViewer: React.FC<BOMViewerProps> = ({
  parentItemId,
  onUpdate,
  onDelete,
  onAdd,
  readOnly = false
}) => {
  const toast = useToast();
  const { deleteConfirm } = useConfirm();

  // State management
  const [bomData, setBOMData] = useState<BOMEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [filterItemType, setFilterItemType] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [editingBomId, setEditingBomId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<BOMEntry>>({});

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchBOMData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (parentItemId) {
        params.append('parent_item_id', parentItemId.toString());
      }

      const response = await fetch(`/api/bom?${params}`);
      const result = await response.json();

      if (result.success) {
        setBOMData(result.data.bomEntries || []);
      } else {
        setError(result.error || 'BOM 데이터 로드 실패');
        toast.error('데이터 로드 실패', result.error);
      }
    } catch (err) {
      const errorMsg = 'BOM 데이터 로딩 실패';
      setError(errorMsg);
      toast.error('오류 발생', errorMsg);
      console.error('BOM fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [parentItemId, toast]);

  useEffect(() => {
    fetchBOMData();
  }, [fetchBOMData]);

  // ============================================================================
  // TREE BUILDING
  // ============================================================================

  const buildTree = useCallback((entries: BOMEntry[]): TreeNode[] => {
    const nodeMap = new Map<number, TreeNode>();
    const roots: TreeNode[] = [];

    // Create nodes
    entries.forEach(entry => {
      nodeMap.set(entry.bom_id, { entry, children: [] });
    });

    // Build tree structure
    entries.forEach(entry => {
      const node = nodeMap.get(entry.bom_id);
      if (!node) return;

      if (entry.level === 1) {
        roots.push(node);
      } else {
        // Find parent by matching child_item_id with parent's parent_item_id
        const parentEntry = entries.find(
          e => e.parent_item_id === entry.parent_item_id && e.level === entry.level - 1
        );
        if (parentEntry) {
          const parentNode = nodeMap.get(parentEntry.bom_id);
          if (parentNode) {
            parentNode.children.push(node);
          }
        }
      }
    });

    return roots;
  }, []);

  // ============================================================================
  // FILTERING & SEARCH
  // ============================================================================

  const filteredBOMData = useMemo(() => {
    return bomData.filter(entry => {
      const matchesSearch = searchTerm === '' ||
        entry.child_item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.child_item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.parent_item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.parent_item_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesLevel = filterLevel === null || entry.level === filterLevel;

      const matchesType = filterItemType === 'all' || entry.item_type === filterItemType;

      return matchesSearch && matchesLevel && matchesType;
    });
  }, [bomData, searchTerm, filterLevel, filterItemType]);

  const treeData = useMemo(() => {
    return buildTree(filteredBOMData);
  }, [filteredBOMData, buildTree]);

  // ============================================================================
  // COST CALCULATION
  // ============================================================================

  const costSummary = useMemo((): CostSummary => {
    return filteredBOMData.reduce((acc, entry) => ({
      total_material_cost: acc.total_material_cost + (entry.material_cost || 0),
      total_scrap_revenue: acc.total_scrap_revenue + (entry.scrap_revenue || 0),
      total_net_cost: acc.total_net_cost + (entry.net_cost || 0),
      coil_count: acc.coil_count + (entry.material_grade ? 1 : 0),
      purchased_count: acc.purchased_count + (entry.item_type === 'external_purchase' ? 1 : 0),
      total_items: acc.total_items + 1
    }), {
      total_material_cost: 0,
      total_scrap_revenue: 0,
      total_net_cost: 0,
      coil_count: 0,
      purchased_count: 0,
      total_items: 0
    });
  }, [filteredBOMData]);

  // ============================================================================
  // EXPAND/COLLAPSE HANDLERS
  // ============================================================================

  const toggleExpand = useCallback((bomId: number) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(bomId)) {
        next.delete(bomId);
      } else {
        next.add(bomId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedNodes(new Set(bomData.map(entry => entry.bom_id)));
  }, [bomData]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  // ============================================================================
  // EDIT HANDLERS
  // ============================================================================

  const handleEdit = useCallback((entry: BOMEntry) => {
    setEditingBomId(entry.bom_id);
    setEditValues({ quantity_required: entry.quantity_required });
  }, []);

  const handleSave = async () => {
    if (editingBomId && onUpdate && editValues.quantity_required) {
      try {
        await onUpdate(editingBomId, editValues);
        toast.success('수정 완료', '수량이 성공적으로 업데이트되었습니다');
        setEditingBomId(null);
        setEditValues({});
        await fetchBOMData();
      } catch (error) {
        toast.error('수정 실패', '수량 업데이트에 실패했습니다');
        console.error('Update error:', error);
      }
    }
  };

  const handleCancel = useCallback(() => {
    setEditingBomId(null);
    setEditValues({});
  }, []);

  const handleDelete = async (bomId: number) => {
    if (!onDelete) return;

    const confirmed = await deleteConfirm('삭제 확인', '정말 삭제하시겠습니까?');
    if (!confirmed) return;

    try {
      await onDelete(bomId);
      toast.success('삭제 완료', 'BOM 항목이 삭제되었습니다');
      await fetchBOMData();
    } catch (error) {
      toast.error('삭제 실패', 'BOM 항목 삭제에 실패했습니다');
      console.error('Delete error:', error);
    }
  };

  // ============================================================================
  // EXPORT HANDLER
  // ============================================================================

  const handleExport = async () => {
    try {
      toast.info('내보내기 중...', '엑셀 파일을 생성하고 있습니다');

      const params = new URLSearchParams();
      if (parentItemId) {
        params.append('parent_item_id', parentItemId.toString());
      }
      params.append('include_cost_analysis', 'true');

      const response = await fetch(`/api/bom/export?${params}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BOM_구조_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('내보내기 완료', '엑셀 파일이 다운로드되었습니다');
    } catch (err) {
      toast.error('내보내기 실패', '엑셀 파일 생성에 실패했습니다');
      console.error('Export failed:', err);
    }
  };

  // ============================================================================
  // TREE NODE RENDERER
  // ============================================================================

  const renderTreeNode = useCallback((node: TreeNode, level: number) => {
    const { entry } = node;
    const isExpanded = expandedNodes.has(entry.bom_id);
    const hasChildren = node.children.length > 0;
    const indent = level * 24;
    const isEditing = editingBomId === entry.bom_id;

    return (
      <div key={entry.bom_id} className="bom-tree-node">
        {/* Current Node */}
        <div
          style={{ paddingLeft: `${indent}px` }}
          className={`
            flex items-center py-3 px-4 border-b border-gray-200 dark:border-gray-700
            hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
            ${level > 0 ? 'border-l-2 border-gray-300 dark:border-gray-600' : ''}
          `}
        >
          {/* Expand/Collapse Button */}
          <button
            onClick={() => toggleExpand(entry.bom_id)}
            disabled={!hasChildren}
            className={`
              mr-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700
              ${!hasChildren ? 'invisible' : ''}
            `}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {/* Item Icon */}
          <div className="mr-2">
            {getItemIcon(entry.item_type)}
          </div>

          {/* Item Info */}
          <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
            {/* Item Code & Name */}
            <div className="col-span-4 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900 dark:text-white truncate">
                  {entry.child_item_code}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                  L{entry.level}
                </span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {entry.child_item_name}
              </div>
            </div>

            {/* Quantity */}
            <div className="col-span-2">
              {isEditing ? (
                <input
                  type="number"
                  step="0.01"
                  value={editValues.quantity_required || ''}
                  onChange={(e) => setEditValues({ quantity_required: parseFloat(e.target.value) })}
                  className="w-full px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-blue-400"
                  autoFocus
                />
              ) : (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">수량: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {entry.quantity_required}
                  </span>
                </div>
              )}
            </div>

            {/* Material Cost */}
            {entry.material_cost !== undefined && (
              <div className="col-span-2 text-right">
                <div className="text-xs text-gray-500 dark:text-gray-400">자재비</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  ₩{formatCurrency(entry.material_cost)}
                </div>
              </div>
            )}

            {/* Net Cost */}
            {entry.net_cost !== undefined && (
              <div className="col-span-2 text-right">
                <div className="text-xs text-gray-500 dark:text-gray-400">순원가</div>
                <div className="text-sm font-medium text-green-600 dark:text-green-400">
                  ₩{formatCurrency(entry.net_cost)}
                </div>
              </div>
            )}

            {/* Actions */}
            {!readOnly && (
              <div className="col-span-2 flex justify-end space-x-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                      title="저장"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCancel}
                      className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="취소"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleEdit(entry)}
                      className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                      title="편집"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.bom_id)}
                      className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  }, [expandedNodes, editingBomId, editValues, readOnly, toggleExpand, handleEdit, handleSave, handleCancel, handleDelete]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && bomData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-8">
        <LoadingSpinner size="lg" text="BOM 데이터 로딩 중..." />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            BOM 구조 뷰
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchBOMData}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>새로고침</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>엑셀 내보내기</span>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="품목코드 또는 품목명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filter Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                showFilters
                  ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Filter className="w-5 h-5" />
              필터
            </button>

            {/* Expand/Collapse All */}
            <button
              onClick={expandAll}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              모두 펼치기
            </button>
            <button
              onClick={collapseAll}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              모두 접기
            </button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                레벨 필터
              </label>
              <select
                value={filterLevel ?? ''}
                onChange={(e) => setFilterLevel(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">모든 레벨</option>
                <option value="1">레벨 1</option>
                <option value="2">레벨 2</option>
                <option value="3">레벨 3</option>
                <option value="4">레벨 4</option>
                <option value="5">레벨 5</option>
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                품목 유형
              </label>
              <select
                value={filterItemType}
                onChange={(e) => setFilterItemType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                <option value="internal_production">내부 생산품</option>
                <option value="external_purchase">외부 구매품</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center space-x-2 text-red-700 dark:text-red-300">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Data Info */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          전체 {bomData.length}개 항목 중 {filteredBOMData.length}개 표시
        </div>
      </div>

      {/* Tree View */}
      <div className="max-h-[600px] overflow-y-auto">
        {filteredBOMData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <Box className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">BOM 데이터가 없습니다</p>
            <p className="text-sm">품목에 BOM을 추가해주세요</p>
          </div>
        ) : (
          <div>
            {treeData.map(node => renderTreeNode(node, 0))}
          </div>
        )}
      </div>

      {/* Cost Summary Footer */}
      {filteredBOMData.length > 0 && (
        <div className="p-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            원가 요약
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Material Cost */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">총 자재비</div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                ₩{formatCurrency(costSummary.total_material_cost)}
              </div>
            </div>

            {/* Total Scrap Revenue */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">총 스크랩금액</div>
              <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                ₩{formatCurrency(costSummary.total_scrap_revenue)}
              </div>
            </div>

            {/* Total Net Cost */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">순원가</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                ₩{formatCurrency(costSummary.total_net_cost)}
              </div>
            </div>

            {/* Item Counts */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">품목 구성</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">코일재:</span>
                <span className="font-medium text-gray-900 dark:text-white">{costSummary.coil_count}개</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">구매품:</span>
                <span className="font-medium text-gray-900 dark:text-white">{costSummary.purchased_count}개</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">전체:</span>
                <span className="text-gray-900 dark:text-white">{costSummary.total_items}개</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BOMViewer;
