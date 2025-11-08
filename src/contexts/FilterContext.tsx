/**
 * Filter Context - React Context wrapper for useFilterStore
 * Provides backward compatibility and easy integration
 */

'use client';

import { createContext, useContext, type ReactNode } from 'react';
import {
  useFilterStore,
  type ItemFilters,
  type CompanyFilters,
  type TransactionFilters,
  type BOMFilters,
  type InventoryFilters,
} from '@/stores/useFilterStore';

interface FilterContextValue {
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

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  // Get all values from Zustand store
  const itemFilters = useFilterStore((state) => state.itemFilters);
  const companyFilters = useFilterStore((state) => state.companyFilters);
  const transactionFilters = useFilterStore((state) => state.transactionFilters);
  const bomFilters = useFilterStore((state) => state.bomFilters);
  const inventoryFilters = useFilterStore((state) => state.inventoryFilters);

  const setItemFilters = useFilterStore((state) => state.setItemFilters);
  const resetItemFilters = useFilterStore((state) => state.resetItemFilters);
  const setCompanyFilters = useFilterStore((state) => state.setCompanyFilters);
  const resetCompanyFilters = useFilterStore((state) => state.resetCompanyFilters);
  const setTransactionFilters = useFilterStore((state) => state.setTransactionFilters);
  const resetTransactionFilters = useFilterStore((state) => state.resetTransactionFilters);
  const setBOMFilters = useFilterStore((state) => state.setBOMFilters);
  const resetBOMFilters = useFilterStore((state) => state.resetBOMFilters);
  const setInventoryFilters = useFilterStore((state) => state.setInventoryFilters);
  const resetInventoryFilters = useFilterStore((state) => state.resetInventoryFilters);
  const resetAllFilters = useFilterStore((state) => state.resetAllFilters);

  const value: FilterContextValue = {
    itemFilters,
    companyFilters,
    transactionFilters,
    bomFilters,
    inventoryFilters,
    setItemFilters,
    resetItemFilters,
    setCompanyFilters,
    resetCompanyFilters,
    setTransactionFilters,
    resetTransactionFilters,
    setBOMFilters,
    resetBOMFilters,
    setInventoryFilters,
    resetInventoryFilters,
    resetAllFilters,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}

// Re-export types
export type {
  ItemFilters,
  CompanyFilters,
  TransactionFilters,
  BOMFilters,
  InventoryFilters,
};
