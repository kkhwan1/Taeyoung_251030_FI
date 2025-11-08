/**
 * Dashboard Hooks
 *
 * Real-time dashboard data with:
 * - 30 second staleTime (most frequent)
 * - 1 minute auto-refresh (refetchInterval)
 * - Stats, charts, alerts, recent activities
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardKeys, type DashboardFilters, getStaleTime, getRefetchInterval } from '@/lib/query-keys';

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ==================== DASHBOARD TYPES ====================

export interface DashboardStats {
  // Sales metrics
  todaySales: number;
  monthlySales: number;
  yearlySales: number;
  salesGrowth: number; // Percentage

  // Purchase metrics
  todayPurchases: number;
  monthlyPurchases: number;
  yearlyPurchases: number;
  purchasesGrowth: number;

  // Inventory metrics
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  inventoryValue: number;

  // Financial metrics
  pendingCollections: number;
  pendingPayments: number;
  netCashFlow: number;
  profitMargin: number;

  // Operational metrics
  activeOrders: number;
  completedOrders: number;
  pendingOrders: number;
  orderFulfillmentRate: number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }[];
}

export interface SalesChartData {
  daily: ChartData;
  weekly: ChartData;
  monthly: ChartData;
}

export interface InventoryChartData {
  stockLevels: ChartData;
  movements: ChartData;
  categories: ChartData;
}

export interface Alert {
  alert_id: string;
  type: 'stock' | 'payment' | 'order' | 'system';
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

export interface RecentActivity {
  activity_id: string;
  type: 'sales' | 'purchase' | 'collection' | 'payment' | 'inventory';
  description: string;
  amount?: number;
  user_name?: string;
  created_at: string;
}

// ==================== API FUNCTIONS ====================

async function fetchDashboardStats(filters: DashboardFilters = {}): Promise<DashboardStats> {
  const searchParams = new URLSearchParams();

  if (filters.period) searchParams.append('period', filters.period);
  if (filters.dateFrom) searchParams.append('date_from', filters.dateFrom);
  if (filters.dateTo) searchParams.append('date_to', filters.dateTo);

  const response = await fetch(`/api/dashboard/stats?${searchParams}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<DashboardStats> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch dashboard stats');
  }

  return data.data!;
}

async function fetchSalesChart(filters: DashboardFilters = {}): Promise<SalesChartData> {
  const searchParams = new URLSearchParams();

  if (filters.period) searchParams.append('period', filters.period);
  if (filters.dateFrom) searchParams.append('date_from', filters.dateFrom);
  if (filters.dateTo) searchParams.append('date_to', filters.dateTo);

  const response = await fetch(`/api/dashboard/charts/sales?${searchParams}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<SalesChartData> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch sales chart data');
  }

  return data.data!;
}

async function fetchPurchasesChart(filters: DashboardFilters = {}): Promise<ChartData> {
  const searchParams = new URLSearchParams();

  if (filters.period) searchParams.append('period', filters.period);
  if (filters.dateFrom) searchParams.append('date_from', filters.dateFrom);
  if (filters.dateTo) searchParams.append('date_to', filters.dateTo);

  const response = await fetch(`/api/dashboard/charts/purchases?${searchParams}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<ChartData> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch purchases chart data');
  }

  return data.data!;
}

async function fetchInventoryChart(filters: DashboardFilters = {}): Promise<InventoryChartData> {
  const searchParams = new URLSearchParams();

  if (filters.period) searchParams.append('period', filters.period);

  const response = await fetch(`/api/dashboard/charts/inventory?${searchParams}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<InventoryChartData> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch inventory chart data');
  }

  return data.data!;
}

async function fetchStockAlerts(): Promise<Alert[]> {
  const response = await fetch('/api/dashboard/alerts/stock');

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<Alert[]> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch stock alerts');
  }

  return data.data || [];
}

async function fetchPaymentAlerts(): Promise<Alert[]> {
  const response = await fetch('/api/dashboard/alerts/payment');

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<Alert[]> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch payment alerts');
  }

  return data.data || [];
}

async function fetchRecentActivities(limit: number = 10): Promise<RecentActivity[]> {
  const response = await fetch(`/api/dashboard/activities?limit=${limit}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<RecentActivity[]> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch recent activities');
  }

  return data.data || [];
}

// ==================== REACT QUERY HOOKS ====================

/**
 * Hook for dashboard stats with auto-refresh
 * - 30 second staleTime
 * - 1 minute refetchInterval
 */
export function useDashboardStats(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: dashboardKeys.stats(filters),
    queryFn: () => fetchDashboardStats(filters),
    staleTime: getStaleTime('dashboard'), // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes (shorter for real-time data)
    refetchOnWindowFocus: true,
    refetchInterval: getRefetchInterval('dashboard'), // 1 minute auto-refresh
    retry: 2,
  });
}

/**
 * Hook for sales chart data with auto-refresh
 */
export function useSalesChart(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: dashboardKeys.salesChart(filters),
    queryFn: () => fetchSalesChart(filters),
    staleTime: getStaleTime('dashboard'),
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: getRefetchInterval('dashboard'),
    retry: 2,
  });
}

/**
 * Hook for purchases chart data with auto-refresh
 */
export function usePurchasesChart(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: dashboardKeys.purchasesChart(filters),
    queryFn: () => fetchPurchasesChart(filters),
    staleTime: getStaleTime('dashboard'),
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: getRefetchInterval('dashboard'),
    retry: 2,
  });
}

/**
 * Hook for inventory chart data with auto-refresh
 */
export function useInventoryChart(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: dashboardKeys.inventoryChart(filters),
    queryFn: () => fetchInventoryChart(filters),
    staleTime: getStaleTime('dashboard'),
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: getRefetchInterval('dashboard'),
    retry: 2,
  });
}

/**
 * Hook for stock alerts with frequent refresh
 */
export function useStockAlerts() {
  return useQuery({
    queryKey: dashboardKeys.stockAlerts(),
    queryFn: fetchStockAlerts,
    staleTime: getStaleTime('dashboard'),
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: getRefetchInterval('dashboard'),
    retry: 2,
  });
}

/**
 * Hook for payment alerts with frequent refresh
 */
export function usePaymentAlerts() {
  return useQuery({
    queryKey: dashboardKeys.paymentAlerts(),
    queryFn: fetchPaymentAlerts,
    staleTime: getStaleTime('dashboard'),
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: getRefetchInterval('dashboard'),
    retry: 2,
  });
}

/**
 * Hook for recent activities with auto-refresh
 */
export function useRecentActivities(limit: number = 10) {
  return useQuery({
    queryKey: dashboardKeys.activities(limit),
    queryFn: () => fetchRecentActivities(limit),
    staleTime: getStaleTime('dashboard'),
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: getRefetchInterval('dashboard'),
    retry: 2,
  });
}

/**
 * Hook for prefetching dashboard data
 */
export function usePrefetchDashboard() {
  const queryClient = useQueryClient();

  return {
    prefetchStats: (filters: DashboardFilters = {}) => {
      queryClient.prefetchQuery({
        queryKey: dashboardKeys.stats(filters),
        queryFn: () => fetchDashboardStats(filters),
        staleTime: getStaleTime('dashboard'),
      });
    },
    prefetchCharts: (filters: DashboardFilters = {}) => {
      queryClient.prefetchQuery({
        queryKey: dashboardKeys.salesChart(filters),
        queryFn: () => fetchSalesChart(filters),
        staleTime: getStaleTime('dashboard'),
      });
      queryClient.prefetchQuery({
        queryKey: dashboardKeys.purchasesChart(filters),
        queryFn: () => fetchPurchasesChart(filters),
        staleTime: getStaleTime('dashboard'),
      });
      queryClient.prefetchQuery({
        queryKey: dashboardKeys.inventoryChart(filters),
        queryFn: () => fetchInventoryChart(filters),
        staleTime: getStaleTime('dashboard'),
      });
    },
    prefetchAlerts: () => {
      queryClient.prefetchQuery({
        queryKey: dashboardKeys.stockAlerts(),
        queryFn: fetchStockAlerts,
        staleTime: getStaleTime('dashboard'),
      });
      queryClient.prefetchQuery({
        queryKey: dashboardKeys.paymentAlerts(),
        queryFn: fetchPaymentAlerts,
        staleTime: getStaleTime('dashboard'),
      });
    },
  };
}

/**
 * Utility hook to manually refresh all dashboard data
 */
export function useRefreshDashboard() {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
  };
}

/**
 * Utility hook to pause/resume auto-refresh
 */
export function useDashboardAutoRefresh() {
  const queryClient = useQueryClient();

  const pause = () => {
    queryClient.setQueryDefaults(dashboardKeys.all, {
      refetchInterval: false,
    });
  };

  const resume = () => {
    queryClient.setQueryDefaults(dashboardKeys.all, {
      refetchInterval: getRefetchInterval('dashboard'),
    });
  };

  return { pause, resume };
}
