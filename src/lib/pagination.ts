export type PaginationInput = {
  page?: number;
  limit?: number;
  orderBy?: string; // "created_at:desc,name:asc"
};

export type PaginationParams = {
  page: number;
  offset: number;
  limit: number;
  orderBy: string;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta;
  pagination?: PaginationMeta; // Alias for backward compatibility
};

export function parsePagination(
  input: PaginationInput,
  defaults = { page: 1, limit: 20, maxLimit: 100 }
): PaginationParams {
  // Parse page (minimum 1)
  const page = Math.max(1, Number(input.page) || defaults.page);

  // Parse limit (minimum 1, maximum maxLimit)
  let limit = Number(input.limit) || defaults.limit;
  limit = Math.max(1, Math.min(limit, defaults.maxLimit));

  // Calculate offset
  const offset = (page - 1) * limit;

  // Parse orderBy string
  let orderBy = '';
  if (input.orderBy) {
    const orderParts = input.orderBy.split(',').map(part => {
      const [column, direction = 'asc'] = part.trim().split(':');
      const cleanColumn = column.replace(/[^a-zA-Z0-9_]/g, ''); // SQL injection prevention
      const cleanDirection = direction.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      return `${cleanColumn} ${cleanDirection}`;
    });
    orderBy = orderParts.join(', ');
  }

  return {
    page,
    offset,
    limit,
    orderBy
  };
}

export function buildPaginatedResponse<T>(
  data: T[],
  totalCount: number,
  params: { page: number; limit: number }
): PaginatedResponse<T> {
  const { page, limit } = params;
  const totalPages = Math.ceil(totalCount / limit);

  const meta = {
    page,
    limit,
    totalCount,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };

  return {
    data,
    meta,
    pagination: meta // Include alias for backward compatibility
  };
}

// Helper function to build SQL with pagination
export function buildPaginatedSQL(
  baseSql: string,
  countSql: string,
  params: PaginationParams
): { dataSql: string; countSql: string } {
  let dataSql = baseSql;

  // Add ORDER BY clause if provided
  if (params.orderBy) {
    dataSql += ` ORDER BY ${params.orderBy}`;
  }

  // Add LIMIT and OFFSET
  dataSql += ` LIMIT ${params.limit} OFFSET ${params.offset}`;

  return {
    dataSql,
    countSql
  };
}

// Helper function to extract pagination params from URL search params
export function getPaginationFromSearchParams(searchParams: URLSearchParams): PaginationInput {
  return {
    page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    orderBy: searchParams.get('orderBy') || undefined
  };
}