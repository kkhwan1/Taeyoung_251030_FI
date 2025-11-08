/**
 * Filter Store - Centralized filter state management
 * Manages filters for items, companies, transactions with URL sync
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Item Filters
export interface ItemFilters {
  search?: string;
  category?: string[];
  item_type?: string[];
  material_type?: string[];
  coating_status?: string[];
  is_active?: boolean;
  min_stock?: number;
  max_stock?: number;
  min_price?: number;
  max_price?: number;
}

// Company Filters
export interface CompanyFilters {
  search?: string;
  company_type?: string[];
  is_active?: boolean;
  category?: string[];
}

// Transaction Filters
export interface TransactionFilters {
  search?: string;
  transaction_type?: string[];
  payment_status?: string[];
  start_date?: string;
  end_date?: string;
  customer_id?: number;
  supplier_id?: number;
  min_amount?: number;
  max_amount?: number;
}

// BOM Filters
export interface BOMFilters {
  search?: string;
  parent_item_id?: number;
  is_active?: boolean;
}

// Inventory Filters
export interface InventoryFilters {
  search?: string;
  transaction_type?: string[];
  start_date?: string;
  end_date?: string;
  item_id?: number;
  warehouse?: string[];
}

interface FilterState {
  // State
  itemFilters: ItemFilters;
  companyFilters: CompanyFilters;
  transactionFilters: TransactionFilters;
  bomFilters: BOMFilters;
  inventoryFilters: InventoryFilters;

  // Actions
  setItemFilters: (filters: Partial<ItemFilters>) => void;
  resetItemFilters: () => void;

  setCompanyFilters: (filters: Partial<CompanyFilters>) => void;
  resetCompanyFilters: () => void;

  setTransactionFilters: (filters: Partial<TransactionFilters>) => void;
  resetTransactionFilters: () => void;

  setBOMFilters: (filters: Partial<BOMFilters>) => void;
  resetBOMFilters: () => void;

  setInventoryFilters: (filters: Partial<InventoryFilters>) => void;
  resetInventoryFilters: () => void;

  resetAllFilters: () => void;
}

const initialState = {
  itemFilters: {} as ItemFilters,
  companyFilters: {} as CompanyFilters,
  transactionFilters: {} as TransactionFilters,
  bomFilters: {} as BOMFilters,
  inventoryFilters: {} as InventoryFilters,
};

export const useFilterStore = create<FilterState>()(
  devtools(
    (set) => ({
      ...initialState,

      // Item Filters
      setItemFilters: (filters) => {
        set(
          (state) => ({
            itemFilters: { ...state.itemFilters, ...filters },
          }),
          false,
          'setItemFilters'
        );
      },

      resetItemFilters: () => {
        set({ itemFilters: {} }, false, 'resetItemFilters');
      },

      // Company Filters
      setCompanyFilters: (filters) => {
        set(
          (state) => ({
            companyFilters: { ...state.companyFilters, ...filters },
          }),
          false,
          'setCompanyFilters'
        );
      },

      resetCompanyFilters: () => {
        set({ companyFilters: {} }, false, 'resetCompanyFilters');
      },

      // Transaction Filters
      setTransactionFilters: (filters) => {
        set(
          (state) => ({
            transactionFilters: { ...state.transactionFilters, ...filters },
          }),
          false,
          'setTransactionFilters'
        );
      },

      resetTransactionFilters: () => {
        set({ transactionFilters: {} }, false, 'resetTransactionFilters');
      },

      // BOM Filters
      setBOMFilters: (filters) => {
        set(
          (state) => ({
            bomFilters: { ...state.bomFilters, ...filters },
          }),
          false,
          'setBOMFilters'
        );
      },

      resetBOMFilters: () => {
        set({ bomFilters: {} }, false, 'resetBOMFilters');
      },

      // Inventory Filters
      setInventoryFilters: (filters) => {
        set(
          (state) => ({
            inventoryFilters: { ...state.inventoryFilters, ...filters },
          }),
          false,
          'setInventoryFilters'
        );
      },

      resetInventoryFilters: () => {
        set({ inventoryFilters: {} }, false, 'resetInventoryFilters');
      },

      // Reset All
      resetAllFilters: () => {
        set(initialState, false, 'resetAllFilters');
      },
    }),
    {
      name: 'FilterStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// Selectors
export const selectItemFilters = (state: FilterState) => state.itemFilters;
export const selectCompanyFilters = (state: FilterState) => state.companyFilters;
export const selectTransactionFilters = (state: FilterState) => state.transactionFilters;
export const selectBOMFilters = (state: FilterState) => state.bomFilters;
export const selectInventoryFilters = (state: FilterState) => state.inventoryFilters;
