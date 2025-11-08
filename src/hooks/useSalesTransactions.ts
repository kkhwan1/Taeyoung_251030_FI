import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionKeys, type TransactionFilters, getStaleTime } from '@/lib/query-keys';

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    totalCount: number;
  };
}

// Sales Transaction interface
export interface SalesTransaction {
  transaction_id: number;
  transaction_no: string;
  transaction_date: string;
  customer_id: number;
  customer_name?: string;
  items: SalesItem[];
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  collected_amount: number;
  payment_status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
  shipping_address?: string;
  notes?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface SalesItem {
  item_id: number;
  item_code?: string;
  item_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  tax_rate?: number;
  tax_amount?: number;
}

// Create sales transaction data
export type CreateSalesData = Omit<SalesTransaction, 'transaction_id' | 'transaction_no' | 'created_at' | 'updated_at' | 'customer_name'>;

// Update sales transaction data
export type UpdateSalesData = Partial<CreateSalesData> & { id: number };

// ==================== API FUNCTIONS ====================

async function fetchSalesTransactions(filters: TransactionFilters = {}): Promise<SalesTransaction[]> {
  const searchParams = new URLSearchParams();

  if (filters.companyId) searchParams.append('customer_id', filters.companyId.toString());
  if (filters.dateFrom) searchParams.append('date_from', filters.dateFrom);
  if (filters.dateTo) searchParams.append('date_to', filters.dateTo);
  if (filters.status) searchParams.append('payment_status', filters.status);
  if (filters.search) searchParams.append('search', filters.search);
  if (filters.page) searchParams.append('page', filters.page.toString());
  if (filters.limit) searchParams.append('limit', filters.limit.toString());

  const response = await fetch(`/api/sales-transactions?${searchParams}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<SalesTransaction[]> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch sales transactions');
  }

  return data.data || [];
}

async function fetchSalesDetail(id: number): Promise<SalesTransaction> {
  const response = await fetch(`/api/sales-transactions/${id}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<SalesTransaction> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch sales transaction detail');
  }

  return data.data!;
}

async function createSalesTransaction(salesData: CreateSalesData): Promise<SalesTransaction> {
  const response = await fetch('/api/sales-transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(salesData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<SalesTransaction> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to create sales transaction');
  }

  return data.data!;
}

async function updateSalesTransaction(salesData: UpdateSalesData): Promise<SalesTransaction> {
  const response = await fetch('/api/sales-transactions', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(salesData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<SalesTransaction> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to update sales transaction');
  }

  return data.data!;
}

async function deleteSalesTransaction(id: number): Promise<void> {
  const response = await fetch(`/api/sales-transactions?id=${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<void> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to delete sales transaction');
  }
}

async function fetchSalesSummary(filters: Omit<TransactionFilters, 'page' | 'limit'> = {}) {
  const searchParams = new URLSearchParams();

  if (filters.dateFrom) searchParams.append('date_from', filters.dateFrom);
  if (filters.dateTo) searchParams.append('date_to', filters.dateTo);
  if (filters.status) searchParams.append('payment_status', filters.status);

  const response = await fetch(`/api/sales-transactions/summary?${searchParams}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<any> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch sales summary');
  }

  return data.data;
}

// ==================== REACT QUERY HOOKS ====================

/**
 * Hook for fetching sales transactions with caching
 */
export function useSalesTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: transactionKeys.salesList(filters),
    queryFn: () => fetchSalesTransactions(filters),
    staleTime: getStaleTime('transactions'), // 2 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for fetching sales transaction detail
 */
export function useSalesDetail(id: number) {
  return useQuery({
    queryKey: transactionKeys.salesDetail(id),
    queryFn: () => fetchSalesDetail(id),
    staleTime: getStaleTime('transactions'),
    gcTime: 10 * 60 * 1000,
    enabled: !!id && id > 0,
    retry: 2,
  });
}

/**
 * Hook for creating sales transactions with optimistic updates
 */
export function useCreateSalesTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSalesTransaction,
    onSuccess: (newSales) => {
      // Invalidate sales queries
      queryClient.invalidateQueries({ queryKey: transactionKeys.sales() });

      // Invalidate transaction summary
      queryClient.invalidateQueries({ queryKey: transactionKeys.summary('sales') });

      // Invalidate dashboard stats (affected by new sales)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      // Optimistic update for list
      queryClient.setQueriesData<SalesTransaction[]>(
        { queryKey: transactionKeys.sales() },
        (oldSales) => {
          if (!oldSales) return [newSales];
          return [newSales, ...oldSales];
        }
      );
    },
    onError: (error) => {
      console.error('Failed to create sales transaction:', error);
    },
  });
}

/**
 * Hook for updating sales transactions with optimistic updates
 */
export function useUpdateSalesTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSalesTransaction,
    onSuccess: (updatedSales) => {
      // Invalidate sales queries
      queryClient.invalidateQueries({ queryKey: transactionKeys.sales() });

      // Invalidate specific detail
      queryClient.invalidateQueries({ queryKey: transactionKeys.salesDetail(updatedSales.transaction_id) });

      // Invalidate summary
      queryClient.invalidateQueries({ queryKey: transactionKeys.summary('sales') });

      // Invalidate dashboard
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      // Update specific sales in cache
      queryClient.setQueriesData<SalesTransaction[]>(
        { queryKey: transactionKeys.sales() },
        (oldSales) => {
          if (!oldSales) return [updatedSales];
          return oldSales.map(sales =>
            sales.transaction_id === updatedSales.transaction_id ? updatedSales : sales
          );
        }
      );
    },
    onError: (error) => {
      console.error('Failed to update sales transaction:', error);
    },
  });
}

/**
 * Hook for deleting sales transactions
 */
export function useDeleteSalesTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSalesTransaction,
    onSuccess: (_, deletedId) => {
      // Invalidate all sales queries
      queryClient.invalidateQueries({ queryKey: transactionKeys.sales() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.summary('sales') });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      // Remove from cache
      queryClient.setQueriesData<SalesTransaction[]>(
        { queryKey: transactionKeys.sales() },
        (oldSales) => {
          if (!oldSales) return [];
          return oldSales.filter(sales => sales.transaction_id !== deletedId);
        }
      );
    },
    onError: (error) => {
      console.error('Failed to delete sales transaction:', error);
    },
  });
}

/**
 * Hook for fetching sales summary
 */
export function useSalesSummary(filters: Omit<TransactionFilters, 'page' | 'limit'> = {}) {
  return useQuery({
    queryKey: [...transactionKeys.summary('sales'), filters],
    queryFn: () => fetchSalesSummary(filters),
    staleTime: getStaleTime('transactions'),
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

/**
 * Hook for prefetching sales data
 */
export function usePrefetchSales() {
  const queryClient = useQueryClient();

  return {
    prefetchSalesTransactions: (filters: TransactionFilters = {}) => {
      queryClient.prefetchQuery({
        queryKey: transactionKeys.salesList(filters),
        queryFn: () => fetchSalesTransactions(filters),
        staleTime: getStaleTime('transactions'),
      });
    },
    prefetchSalesDetail: (id: number) => {
      if (!id || id <= 0) return;
      queryClient.prefetchQuery({
        queryKey: transactionKeys.salesDetail(id),
        queryFn: () => fetchSalesDetail(id),
        staleTime: getStaleTime('transactions'),
      });
    },
  };
}
