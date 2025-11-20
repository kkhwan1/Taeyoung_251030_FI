/**
 * API Response Types
 *
 * Centralized type definitions for all API responses
 * to ensure type safety across the application
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Company data from database
 */
export interface CompanyData {
  company_id: number;
  company_name: string;
  company_code: string | null;
  label?: string;
}

/**
 * Company options API response
 */
export interface CompanyOptionsResponse {
  success: boolean;
  data: CompanyData[];
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    totalCount: number;
  };
}
