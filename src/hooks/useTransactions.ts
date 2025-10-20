import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Transaction interface matching the actual database schema
export interface InventoryTransaction {
  transaction_id: number;
  transaction_date: string; // ISO date string
  transaction_type: '입고' | '출고' | '생산입고' | '생산출고' | '이동' | '조정' | '폐기';
  item_id: number;
  item_code?: string;
  item_name?: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  from_location?: string;
  to_location?: string;
  company_id?: number;
  company_name?: string;
  reference_no?: string;
  lot_no?: string;
  expiry_date?: string; // ISO date string
  notes?: string;
  created_by: number;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

// Create transaction data type (without transaction_id and timestamps)
export type CreateTransactionData = Omit<InventoryTransaction, 'transaction_id' | 'created_at' | 'updated_at' | 'item_code' | 'item_name' | 'company_name'>;

// Update transaction data type
export type UpdateTransactionData = Partial<CreateTransactionData> & { id: number };

// Transactions query parameters
export interface TransactionsQueryParams {
  type?: string;
  item_id?: number;
  company_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// Query key factory for transactions
export const transactionsKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionsKeys.all, 'list'] as const,
  list: (params: TransactionsQueryParams) => [...transactionsKeys.lists(), params] as const,
  details: () => [...transactionsKeys.all, 'detail'] as const,
  detail: (id: number) => [...transactionsKeys.details(), id] as const,
  summary: () => [...transactionsKeys.all, 'summary'] as const,
};

// Fetch transactions with optional filtering
async function fetchTransactions(params: TransactionsQueryParams = {}): Promise<InventoryTransaction[]> {
  const searchParams = new URLSearchParams();

  if (params.type) searchParams.append('type', params.type);
  if (params.item_id) searchParams.append('item_id', params.item_id.toString());
  if (params.company_id) searchParams.append('company_id', params.company_id.toString());
  if (params.date_from) searchParams.append('date_from', params.date_from);
  if (params.date_to) searchParams.append('date_to', params.date_to);
  if (params.search) searchParams.append('search', params.search);
  if (params.page) searchParams.append('page', params.page.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());

  const response = await fetch(`/api/inventory/transactions?${searchParams}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<InventoryTransaction[]> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch transactions');
  }

  return data.data || [];
}

// Create new transaction
async function createTransaction(transactionData: CreateTransactionData): Promise<InventoryTransaction> {
  const response = await fetch('/api/inventory/transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(transactionData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<InventoryTransaction> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to create transaction');
  }

  return data.data!;
}

// Update existing transaction
async function updateTransaction(transactionData: UpdateTransactionData): Promise<InventoryTransaction> {
  const response = await fetch('/api/inventory/transactions', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(transactionData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<InventoryTransaction> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to update transaction');
  }

  return data.data!;
}

// Delete transaction
async function deleteTransaction(id: number): Promise<void> {
  const response = await fetch(`/api/inventory/transactions?id=${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<void> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to delete transaction');
  }
}

// Fetch transaction summary/statistics
async function fetchTransactionSummary(params: Omit<TransactionsQueryParams, 'page' | 'limit'> = {}) {
  const searchParams = new URLSearchParams();

  if (params.type) searchParams.append('type', params.type);
  if (params.item_id) searchParams.append('item_id', params.item_id.toString());
  if (params.company_id) searchParams.append('company_id', params.company_id.toString());
  if (params.date_from) searchParams.append('date_from', params.date_from);
  if (params.date_to) searchParams.append('date_to', params.date_to);

  const response = await fetch(`/api/inventory/transactions/summary?${searchParams}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<any> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch transaction summary');
  }

  return data.data;
}

// Hook for fetching transactions with caching and error handling
export function useTransactions(params: TransactionsQueryParams = {}) {
  return useQuery({
    queryKey: transactionsKeys.list(params),
    queryFn: () => fetchTransactions(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

// Hook for creating transactions with optimistic updates
export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTransaction,
    onSuccess: (newTransaction) => {
      // Invalidate transactions queries
      queryClient.invalidateQueries({ queryKey: transactionsKeys.lists() });

      // Invalidate summary data
      queryClient.invalidateQueries({ queryKey: transactionsKeys.summary() });

      // Invalidate stock status as transactions affect inventory
      queryClient.invalidateQueries({ queryKey: ['stock'] });

      // Optionally add optimistic update
      queryClient.setQueriesData<InventoryTransaction[]>(
        { queryKey: transactionsKeys.lists() },
        (oldTransactions) => {
          if (!oldTransactions) return [newTransaction];
          return [newTransaction, ...oldTransactions];
        }
      );
    },
    onError: (error) => {
      console.error('Failed to create transaction:', error);
    },
  });
}

// Hook for updating transactions with optimistic updates
export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTransaction,
    onSuccess: (updatedTransaction) => {
      // Invalidate transactions queries
      queryClient.invalidateQueries({ queryKey: transactionsKeys.lists() });

      // Invalidate summary data
      queryClient.invalidateQueries({ queryKey: transactionsKeys.summary() });

      // Invalidate stock status as transactions affect inventory
      queryClient.invalidateQueries({ queryKey: ['stock'] });

      // Update specific transaction in cache
      queryClient.setQueriesData<InventoryTransaction[]>(
        { queryKey: transactionsKeys.lists() },
        (oldTransactions) => {
          if (!oldTransactions) return [updatedTransaction];
          return oldTransactions.map(transaction =>
            transaction.transaction_id === updatedTransaction.transaction_id
              ? updatedTransaction
              : transaction
          );
        }
      );
    },
    onError: (error) => {
      console.error('Failed to update transaction:', error);
    },
  });
}

// Hook for deleting transactions with optimistic updates
export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: (_, deletedId) => {
      // Invalidate transactions queries
      queryClient.invalidateQueries({ queryKey: transactionsKeys.lists() });

      // Invalidate summary data
      queryClient.invalidateQueries({ queryKey: transactionsKeys.summary() });

      // Invalidate stock status as transactions affect inventory
      queryClient.invalidateQueries({ queryKey: ['stock'] });

      // Remove transaction from cache
      queryClient.setQueriesData<InventoryTransaction[]>(
        { queryKey: transactionsKeys.lists() },
        (oldTransactions) => {
          if (!oldTransactions) return [];
          return oldTransactions.filter(transaction => transaction.transaction_id !== deletedId);
        }
      );
    },
    onError: (error) => {
      console.error('Failed to delete transaction:', error);
    },
  });
}

// Hook for fetching transaction summary
export function useTransactionSummary(params: Omit<TransactionsQueryParams, 'page' | 'limit'> = {}) {
  return useQuery({
    queryKey: [...transactionsKeys.summary(), params],
    queryFn: () => fetchTransactionSummary(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

// Hook for prefetching transactions (useful for hover states, etc.)
export function usePrefetchTransactions() {
  const queryClient = useQueryClient();

  return (params: TransactionsQueryParams = {}) => {
    queryClient.prefetchQuery({
      queryKey: transactionsKeys.list(params),
      queryFn: () => fetchTransactions(params),
      staleTime: 5 * 60 * 1000,
    });
  };
}