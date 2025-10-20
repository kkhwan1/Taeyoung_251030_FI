import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Company interface matching the actual database schema
export interface Company {
  company_id: number;
  company_code: string;
  company_name: string;
  company_type: 'CUSTOMER' | 'SUPPLIER' | 'PARTNER' | 'OTHER';
  business_number?: string;
  ceo_name?: string;
  phone?: string;
  fax?: string;
  email?: string;
  address?: string;
  contact_person?: string;
  contact_phone?: string;
  payment_terms?: string;
  credit_limit?: number;
  notes?: string;
  is_active: boolean;
}

// Create company data type (without company_id)
export type CreateCompanyData = Omit<Company, 'company_id'>;

// Update company data type
export type UpdateCompanyData = Partial<CreateCompanyData> & { id: number };

// Companies query parameters
export interface CompaniesQueryParams {
  type?: string;
  search?: string;
}

// Query key factory for companies
export const companiesKeys = {
  all: ['companies'] as const,
  lists: () => [...companiesKeys.all, 'list'] as const,
  list: (params: CompaniesQueryParams) => [...companiesKeys.lists(), params] as const,
  details: () => [...companiesKeys.all, 'detail'] as const,
  detail: (id: number) => [...companiesKeys.details(), id] as const,
};

// Fetch companies with optional filtering
async function fetchCompanies(params: CompaniesQueryParams = {}): Promise<Company[]> {
  const searchParams = new URLSearchParams();

  if (params.type) {
    searchParams.append('type', params.type);
  }

  if (params.search) {
    searchParams.append('search', params.search);
  }

  const response = await fetch(`/api/companies?${searchParams}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<Company[]> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch companies');
  }

  return data.data || [];
}

// Create new company
async function createCompany(companyData: CreateCompanyData): Promise<Company> {
  const response = await fetch('/api/companies', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(companyData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<Company> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to create company');
  }

  return data.data!;
}

// Update existing company
async function updateCompany(companyData: UpdateCompanyData): Promise<Company> {
  const response = await fetch('/api/companies', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(companyData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<Company> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to update company');
  }

  return data.data!;
}

// Delete company (soft delete)
async function deleteCompany(id: number): Promise<void> {
  const response = await fetch(`/api/companies?id=${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<void> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to delete company');
  }
}

// Hook for fetching companies with caching and error handling
export function useCompanies(params: CompaniesQueryParams = {}) {
  return useQuery({
    queryKey: companiesKeys.list(params),
    queryFn: () => fetchCompanies(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

// Hook for creating companies with optimistic updates
export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCompany,
    onSuccess: (newCompany) => {
      // Invalidate and refetch companies queries
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });

      // Optionally add optimistic update
      queryClient.setQueriesData<Company[]>(
        { queryKey: companiesKeys.lists() },
        (oldCompanies) => {
          if (!oldCompanies) return [newCompany];
          return [newCompany, ...oldCompanies];
        }
      );
    },
    onError: (error) => {
      console.error('Failed to create company:', error);
    },
  });
}

// Hook for updating companies with optimistic updates
export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCompany,
    onSuccess: (updatedCompany) => {
      // Invalidate and refetch companies queries
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });

      // Update specific company in cache
      queryClient.setQueriesData<Company[]>(
        { queryKey: companiesKeys.lists() },
        (oldCompanies) => {
          if (!oldCompanies) return [updatedCompany];
          return oldCompanies.map(company =>
            company.company_id === updatedCompany.company_id ? updatedCompany : company
          );
        }
      );
    },
    onError: (error) => {
      console.error('Failed to update company:', error);
    },
  });
}

// Hook for deleting companies with optimistic updates
export function useDeleteCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCompany,
    onSuccess: (_, deletedId) => {
      // Invalidate and refetch companies queries
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });

      // Remove company from cache
      queryClient.setQueriesData<Company[]>(
        { queryKey: companiesKeys.lists() },
        (oldCompanies) => {
          if (!oldCompanies) return [];
          return oldCompanies.filter(company => company.company_id !== deletedId);
        }
      );
    },
    onError: (error) => {
      console.error('Failed to delete company:', error);
    },
  });
}

// Hook for prefetching companies (useful for hover states, etc.)
export function usePrefetchCompanies() {
  const queryClient = useQueryClient();

  return (params: CompaniesQueryParams = {}) => {
    queryClient.prefetchQuery({
      queryKey: companiesKeys.list(params),
      queryFn: () => fetchCompanies(params),
      staleTime: 5 * 60 * 1000,
    });
  };
}