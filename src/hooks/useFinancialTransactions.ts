/**
 * Financial Transactions Hooks
 *
 * Unified hooks for:
 * - Purchase Transactions
 * - Collection Transactions
 * - Payment Transactions
 *
 * All use 2-minute staleTime for transactional data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionKeys, type TransactionFilters, getStaleTime } from '@/lib/query-keys';

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ==================== PURCHASE TRANSACTIONS ====================

export interface PurchaseTransaction {
  transaction_id: number;
  transaction_no: string;
  transaction_date: string;
  supplier_id: number;
  supplier_name?: string;
  items: PurchaseItem[];
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  payment_status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
  notes?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  item_id: number;
  item_code?: string;
  item_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export type CreatePurchaseData = Omit<PurchaseTransaction, 'transaction_id' | 'transaction_no' | 'created_at' | 'updated_at' | 'supplier_name'>;
export type UpdatePurchaseData = Partial<CreatePurchaseData> & { id: number };

// ==================== COLLECTION TRANSACTIONS ====================

export interface CollectionTransaction {
  collection_id: number;
  collection_no: string;
  collection_date: string;
  sales_transaction_id: number;
  sales_transaction_no?: string;
  customer_id: number;
  customer_name?: string;
  collected_amount: number;
  collection_method: 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD' | 'OTHER';
  reference_no?: string;
  notes?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export type CreateCollectionData = Omit<CollectionTransaction, 'collection_id' | 'collection_no' | 'created_at' | 'updated_at' | 'customer_name' | 'sales_transaction_no'>;
export type UpdateCollectionData = Partial<CreateCollectionData> & { id: number };

// ==================== PAYMENT TRANSACTIONS ====================

export interface PaymentTransaction {
  payment_id: number;
  payment_no: string;
  payment_date: string;
  purchase_transaction_id: number;
  purchase_transaction_no?: string;
  supplier_id: number;
  supplier_name?: string;
  paid_amount: number;
  payment_method: 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD' | 'OTHER';
  reference_no?: string;
  notes?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export type CreatePaymentData = Omit<PaymentTransaction, 'payment_id' | 'payment_no' | 'created_at' | 'updated_at' | 'supplier_name' | 'purchase_transaction_no'>;
export type UpdatePaymentData = Partial<CreatePaymentData> & { id: number };

// ==================== PURCHASE API FUNCTIONS ====================

async function fetchPurchases(filters: TransactionFilters = {}): Promise<PurchaseTransaction[]> {
  const searchParams = new URLSearchParams();
  if (filters.companyId) searchParams.append('supplier_id', filters.companyId.toString());
  if (filters.dateFrom) searchParams.append('date_from', filters.dateFrom);
  if (filters.dateTo) searchParams.append('date_to', filters.dateTo);
  if (filters.status) searchParams.append('payment_status', filters.status);
  if (filters.search) searchParams.append('search', filters.search);

  const response = await fetch(`/api/purchases?${searchParams}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data: ApiResponse<PurchaseTransaction[]> = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch purchases');
  return data.data || [];
}

async function createPurchase(purchaseData: CreatePurchaseData): Promise<PurchaseTransaction> {
  const response = await fetch('/api/purchases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(purchaseData),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data: ApiResponse<PurchaseTransaction> = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to create purchase');
  return data.data!;
}

async function updatePurchase(purchaseData: UpdatePurchaseData): Promise<PurchaseTransaction> {
  const response = await fetch('/api/purchases', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(purchaseData),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data: ApiResponse<PurchaseTransaction> = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to update purchase');
  return data.data!;
}

async function deletePurchase(id: number): Promise<void> {
  const response = await fetch(`/api/purchases?id=${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data: ApiResponse<void> = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to delete purchase');
}

// ==================== COLLECTION API FUNCTIONS ====================

async function fetchCollections(filters: TransactionFilters = {}): Promise<CollectionTransaction[]> {
  const searchParams = new URLSearchParams();
  if (filters.companyId) searchParams.append('customer_id', filters.companyId.toString());
  if (filters.dateFrom) searchParams.append('date_from', filters.dateFrom);
  if (filters.dateTo) searchParams.append('date_to', filters.dateTo);
  if (filters.search) searchParams.append('search', filters.search);

  const response = await fetch(`/api/collections?${searchParams}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data: ApiResponse<CollectionTransaction[]> = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch collections');
  return data.data || [];
}

async function createCollection(collectionData: CreateCollectionData): Promise<CollectionTransaction> {
  const response = await fetch('/api/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(collectionData),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data: ApiResponse<CollectionTransaction> = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to create collection');
  return data.data!;
}

async function updateCollection(collectionData: UpdateCollectionData): Promise<CollectionTransaction> {
  const response = await fetch('/api/collections', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(collectionData),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data: ApiResponse<CollectionTransaction> = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to update collection');
  return data.data!;
}

async function deleteCollection(id: number): Promise<void> {
  const response = await fetch(`/api/collections?id=${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data: ApiResponse<void> = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to delete collection');
}

// ==================== PAYMENT API FUNCTIONS ====================

async function fetchPayments(filters: TransactionFilters = {}): Promise<PaymentTransaction[]> {
  const searchParams = new URLSearchParams();
  if (filters.companyId) searchParams.append('supplier_id', filters.companyId.toString());
  if (filters.dateFrom) searchParams.append('date_from', filters.dateFrom);
  if (filters.dateTo) searchParams.append('date_to', filters.dateTo);
  if (filters.search) searchParams.append('search', filters.search);

  const response = await fetch(`/api/payments?${searchParams}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data: ApiResponse<PaymentTransaction[]> = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch payments');
  return data.data || [];
}

async function createPayment(paymentData: CreatePaymentData): Promise<PaymentTransaction> {
  const response = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(paymentData),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data: ApiResponse<PaymentTransaction> = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to create payment');
  return data.data!;
}

async function updatePayment(paymentData: UpdatePaymentData): Promise<PaymentTransaction> {
  const response = await fetch('/api/payments', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(paymentData),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data: ApiResponse<PaymentTransaction> = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to update payment');
  return data.data!;
}

async function deletePayment(id: number): Promise<void> {
  const response = await fetch(`/api/payments?id=${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data: ApiResponse<void> = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to delete payment');
}

// ==================== PURCHASE HOOKS ====================

export function usePurchases(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: transactionKeys.purchasesList(filters),
    queryFn: () => fetchPurchases(filters),
    staleTime: getStaleTime('transactions'),
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.purchases() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.purchases() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeletePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.purchases() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ==================== COLLECTION HOOKS ====================

export function useCollections(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: transactionKeys.collectionsList(filters),
    queryFn: () => fetchCollections(filters),
    staleTime: getStaleTime('transactions'),
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.collections() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.sales() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.collections() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.sales() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.collections() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.sales() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ==================== PAYMENT HOOKS ====================

export function usePayments(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: transactionKeys.paymentsList(filters),
    queryFn: () => fetchPayments(filters),
    staleTime: getStaleTime('transactions'),
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.payments() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.purchases() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.payments() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.purchases() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.payments() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.purchases() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
