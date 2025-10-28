/**
 * Production API Type Definitions
 *
 * Types for production inventory transactions and BOM auto-deduction
 */

import type { InventoryTransaction, AutoDeduction } from '../inventory';

/**
 * Production API Response
 * Returned from POST /api/inventory/production
 */
export interface ProductionResponse {
  success: boolean;
  message: string;
  data: {
    transaction?: InventoryTransaction;
    auto_deductions?: AutoDeduction[];
  };
}

/**
 * Production Error Response
 */
export interface ProductionErrorResponse {
  success: false;
  error: string;
  details?: string;
}

/**
 * Union type for all production responses
 */
export type ProductionApiResponse = ProductionResponse | ProductionErrorResponse;
