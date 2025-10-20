'use client';

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, BarChart3, RefreshCcw, Download, Loader2, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import TrendChart from '@/components/charts/TrendChart';
import ComparisonTable from '@/components/tables/ComparisonTable';
import { useToast } from '@/components/ui/use-toast';
import { useToastNotification } from '@/hooks/useToast';

interface TrendData {
  date: string;
  month: string;
  item_id: number;
  item_name: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  price_changes: number;
}

interface ComparisonData {
  item_id: number;
  item_code: string;
  item_name: string;
  spec: string;
  unit: string;
  current_price: number;
  avg_price_3m: number;
  avg_price_6m: number;
  min_price_6m: number;
  max_price_6m: number;
  price_variance: number;
  price_volatility: number;
  trend_direction: 'UP' | 'DOWN' | 'STABLE';
}

interface AnalysisStats {
  total_items: number;
  items_with_increases: number;
  items_with_decreases: number;
  avg_price_change: number;
  most_volatile_item: string;
  most_stable_item: string;
}

export default function PriceAnalysisPage() {
  const [trendsData, setTrendsData] = useState<TrendData[]>([]);
  const [comparisonsData, setComparisonsData] = useState<ComparisonData[]>([]);
  const [stats, setStats] = useState<AnalysisStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'trends' | 'comparisons'>('trends');
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '12m'>('6m');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const toastNotif = useToastNotification();

  useEffect(() => {
    fetchAnalysisData();
  }, [timeRange]);

  const fetchAnalysisData = async () => {
    setLoading(true);
    try {
      // Fetch trends data
      const trendsResponse = await fetch(`/api/price-analysis?type=trends&months=${getMonthsFromRange(timeRange)}`);
      const trendsResult = await trendsResponse.json();

      if (trendsResult.success) {
        const trendsItems = trendsResult.data.items || [];
        setTrendsData(trendsItems);

        // Calculate statistics from trends data
        const calculatedStats = calculateStats(trendsItems);
        setStats(calculatedStats);
      } else {
        throw new Error(trendsResult.error || '가격 추세 데이터 로드 실패');
      }

      // Fetch comparisons data
      const comparisonsResponse = await fetch(`/api/price-analysis?type=comparisons&months=${getMonthsFromRange(timeRange)}`);
      const comparisonsResult = await comparisonsResponse.json();

      if (comparisonsResult.success) {
        setComparisonsData(comparisonsResult.data.items || []);
      } else {
        throw new Error(comparisonsResult.error || '가격 비교 데이터 로드 실패');
      }

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '데이터 로드 실패',
        description: error.message || '가격 분석 데이터를 불러올 수 없습니다'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (trendsItems: any[]): AnalysisStats => {
    if (!trendsItems || trendsItems.length === 0) {
      return {
        total_items: 0,
        items_with_increases: 0,
        items_with_decreases: 0,
        avg_price_change: 0,
        most_volatile_item: '-',
        most_stable_item: '-'
      };
    }

    const itemsWithIncreases = trendsItems.filter(item => (item.avg_change_rate_pct || 0) > 0).length;
    const itemsWithDecreases = trendsItems.filter(item => (item.avg_change_rate_pct || 0) < 0).length;
    const avgPriceChange = trendsItems.reduce((sum, item) => sum + (item.avg_change_rate_pct || 0), 0) / trendsItems.length;

    // Find most volatile (highest volatility)
    const mostVolatile = trendsItems.reduce((max, item) =>
      (item.volatility || 0) > (max.volatility || 0) ? item : max, trendsItems[0]);

    // Find most stable (lowest volatility)
    const mostStable = trendsItems.reduce((min, item) =>
      (item.volatility || 0) < (min.volatility || 0) ? item : min, trendsItems[0]);

    return {
      total_items: trendsItems.length,
      items_with_increases: itemsWithIncreases,
      items_with_decreases: itemsWithDecreases,
      avg_price_change: avgPriceChange,
      most_volatile_item: mostVolatile?.item_name || '-',
      most_stable_item: mostStable?.item_name || '-'
    };
  };

  const getMonthsFromRange = (range: '3m' | '6m' | '12m'): number => {
    switch (range) {
      case '3m': return 3;
      case '6m': return 6;
      case '12m': return 12;
      default: return 6;
    }
  };

  const handleExport = async () => {
    try {
      toastNotif.정보('Excel 파일 생성 중...');

      const response = await fetch(`/api/price-analysis/export?months=${getMonthsFromRange(timeRange)}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `가격분석_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toastNotif.저장완료('Excel 파일이 다운로드되었습니다');
    } catch (error) {
      toastNotif.저장실패('Excel 파일 생성 중 오류가 발생했습니다');
    }
  };

  const handleImport = async (file: File) => {
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toastNotif.입력오류('Excel 파일(.xlsx, .xls)만 업로드할 수 있습니다.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      toastNotif.정보('Excel 파일 처리 중...');

      const response = await fetch('/api/price-history/import', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Excel 가져오기 실패');
      }

      const result = await response.json();
      toastNotif.저장완료(`${result.data.successful}개 항목 가져오기 완료`);

      if (result.data.failed > 0) {
        toastNotif.경고(`${result.data.failed}개 항목 실패`);
      }

      // Refresh data after import
      await fetchAnalysisData();
    } catch (error: any) {
      toastNotif.저장실패(error.message || 'Excel 가져오기 중 오류가 발생했습니다');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">가격 분석 대시보드</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(['3m', '6m', '12m'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {range === '3m' ? '3개월' : range === '6m' ? '6개월' : '12개월'}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchAnalysisData}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="새로고침"
          >
            <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Import Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
            className="hidden"
          />
          <button
            onClick={handleImportClick}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors font-medium"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Excel 가져오기</span>
          </button>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Excel 내보내기</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards - 6 cards in 2 rows */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          {/* Row 1: First 3 cards */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">총 품목 수</div>
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.total_items.toLocaleString('ko-KR')}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">가격 상승</div>
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-red-600">
              {stats.items_with_increases.toLocaleString('ko-KR')}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">가격 하락</div>
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 rotate-180" />
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.items_with_decreases.toLocaleString('ko-KR')}
            </div>
          </div>

          {/* Row 2: Next 3 cards */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">평균 변동률</div>
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className={`text-2xl font-bold ${stats.avg_price_change >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
              {stats.avg_price_change >= 0 ? '+' : ''}{stats.avg_price_change.toFixed(2)}%
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">변동성 높음</div>
              <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="text-sm font-bold text-gray-900 dark:text-white truncate" title={stats.most_volatile_item || '-'}>
              {stats.most_volatile_item || '-'}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">가장 안정적</div>
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="text-sm font-bold text-gray-900 dark:text-white truncate" title={stats.most_stable_item || '-'}>
              {stats.most_stable_item || '-'}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-t-lg shadow-sm">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('trends')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'trends'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            가격 추세 분석
          </button>
          <button
            onClick={() => setActiveTab('comparisons')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'comparisons'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            품목 간 비교
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white dark:bg-gray-800 rounded-b-lg shadow-sm p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : activeTab === 'trends' ? (
          <TrendChart
            data={trendsData}
            loading={loading}
            timeRange={timeRange}
          />
        ) : (
          <ComparisonTable
            data={comparisonsData}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
