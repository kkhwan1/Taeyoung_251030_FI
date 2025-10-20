import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// API Response types

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Item interface matching the actual database schema
export interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  category: string | null;
  item_type: string | null;
  material_type: string | null;
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
  current_stock: number;
  safety_stock?: number | null;
  price?: number | null;
  unit_price?: number | null;
  min_stock_level?: number | null;
  location?: string | null;
  description?: string | null;
  coating_status?: string | null;
  is_active: boolean;
}

export type CreateItemData = Omit<Item, 'item_id'>;
export type UpdateItemData = Partial<CreateItemData> & { id: number };

export interface ItemsQueryParams {
  category?: string;
  itemType?: string;
  materialType?: string;
  vehicleModel?: string;
  search?: string;
}

// Query key factory for items
export const itemsKeys = {
  all: ['items'] as const,
  lists: () => [...itemsKeys.all, 'list'] as const,
  list: (params: ItemsQueryParams) => [...itemsKeys.lists(), params] as const,
  details: () => [...itemsKeys.all, 'detail'] as const,
  detail: (id: number) => [...itemsKeys.details(), id] as const,
};

// Fetch items with optional filtering
async function fetchItems(params: ItemsQueryParams = {}): Promise<Item[]> {
  const searchParams = new URLSearchParams();

  if (params.category) {
    searchParams.append('category', params.category);
  }

  if (params.itemType && params.itemType !== 'ALL') {
    searchParams.append('itemType', params.itemType);
  }

  if (params.materialType && params.materialType !== 'ALL') {
    searchParams.append('materialType', params.materialType);
  }

  if (params.vehicleModel) {
    searchParams.append('vehicleModel', params.vehicleModel);
  }

  if (params.search) {
    searchParams.append('search', params.search);
  }

  const queryString = searchParams.toString();
  const response = await fetch(queryString ? `/api/items?${queryString}` : '/api/items');

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<{ items?: Item[] }> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch items');
  }

  if (Array.isArray(data.data)) {
    return data.data as unknown as Item[];
  }

  if (data.data && Array.isArray((data.data as any).items)) {
    return (data.data as any).items as Item[];
  }

  return [];
}

// Create new item
async function createItem(itemData: CreateItemData): Promise<Item> {
  const response = await fetch('/api/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(itemData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<Item> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to create item');
  }

  return data.data!;
}

// Update existing item
async function updateItem(itemData: UpdateItemData): Promise<Item> {
  const response = await fetch('/api/items', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(itemData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<Item> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to update item');
  }

  return data.data!;
}

// Delete item (soft delete)
async function deleteItem(id: number): Promise<void> {
  const response = await fetch(`/api/items?id=${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<void> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to delete item');
  }
}

// Hook for fetching items with caching and error handling
export function useItems(params: ItemsQueryParams = {}) {
  return useQuery({
    queryKey: itemsKeys.list(params),
    queryFn: () => fetchItems(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

// Hook for creating items with optimistic updates
export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createItem,
    onSuccess: (newItem) => {
      // Invalidate and refetch items queries
      queryClient.invalidateQueries({ queryKey: itemsKeys.lists() });

      // Optionally add optimistic update
      queryClient.setQueriesData<Item[]>(
        { queryKey: itemsKeys.lists() },
        (oldItems) => {
          if (!oldItems) return [newItem];
          return [newItem, ...oldItems];
        }
      );
    },
    onError: (error) => {
      console.error('Failed to create item:', error);
    },
  });
}

// Hook for updating items with optimistic updates
export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateItem,
    onSuccess: (updatedItem) => {
      // Invalidate and refetch items queries
      queryClient.invalidateQueries({ queryKey: itemsKeys.lists() });

      // Update specific item in cache
      queryClient.setQueriesData<Item[]>(
        { queryKey: itemsKeys.lists() },
        (oldItems) => {
          if (!oldItems) return [updatedItem];
          return oldItems.map(item =>
            item.item_id === updatedItem.item_id ? updatedItem : item
          );
        }
      );
    },
    onError: (error) => {
      console.error('Failed to update item:', error);
    },
  });
}

// Hook for deleting items with optimistic updates
export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteItem,
    onSuccess: (_, deletedId) => {
      // Invalidate and refetch items queries
      queryClient.invalidateQueries({ queryKey: itemsKeys.lists() });

      // Remove item from cache
      queryClient.setQueriesData<Item[]>(
        { queryKey: itemsKeys.lists() },
        (oldItems) => {
          if (!oldItems) return [];
          return oldItems.filter(item => item.item_id !== deletedId);
        }
      );
    },
    onError: (error) => {
      console.error('Failed to delete item:', error);
    },
  });
}

// Hook for prefetching items (useful for hover states, etc.)
export function usePrefetchItems() {
  const queryClient = useQueryClient();

  return (params: ItemsQueryParams = {}) => {
    queryClient.prefetchQuery({
      queryKey: itemsKeys.list(params),
      queryFn: () => fetchItems(params),
      staleTime: 5 * 60 * 1000,
    });
  };
}