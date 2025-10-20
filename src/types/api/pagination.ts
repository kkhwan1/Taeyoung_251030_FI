// Cursor-based pagination types
export interface CursorPaginationMeta {
  limit: number;
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  direction: 'next' | 'prev';
}

export interface OffsetPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export type PaginationMeta = CursorPaginationMeta | OffsetPaginationMeta;

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    pagination: PaginationMeta;
    summary?: {
      byItemType?: Record<string, number>;
      byMaterialType?: Record<string, number>;
    };
  };
  filters?: Record<string, any>;
}

// Cursor pagination request parameters
export interface CursorPaginationParams {
  cursor?: string;
  direction?: 'next' | 'prev';
  limit?: number;
}

// Offset pagination request parameters (backward compatibility)
export interface OffsetPaginationParams {
  page?: number;
  limit?: number;
}

export type PaginationParams = CursorPaginationParams | OffsetPaginationParams;
