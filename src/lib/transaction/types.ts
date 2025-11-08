/**
 * Transaction Type Definitions (extracted from legacy transactionManager.ts)
 * These types are preserved for potential future MySQL migration
 * Current system uses Supabase PostgreSQL transactions
 */

export interface TransactionOptions {
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableAuditLog?: boolean;
  userId?: number;
  operation?: string;
}

export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rollbackReason?: string;
  executionTime?: number;
  auditLogId?: number;
  retryCount?: number;
}

export interface StockValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  currentStock: number;
  requiredStock: number;
  availableStock: number;
}

export interface BOMValidationResult {
  isValid: boolean;
  errors: string[];
  circularDependency: boolean;
  materialShortages: MaterialShortage[];
  totalCost: number;
}

export interface MaterialShortage {
  item_id: number;
  item_name: string;
  required: number;
  available: number;
  shortage: number;
}
