'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Create a client with optimized default settings for ERP system
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5 minutes stale time for ERP data (balance between freshness and performance)
      staleTime: 5 * 60 * 1000,
      // 10 minutes cache time
      gcTime: 10 * 60 * 1000,
      // Refetch on window focus for data consistency
      refetchOnWindowFocus: true,
      // Don't refetch on reconnect to avoid unnecessary requests
      refetchOnReconnect: false,
      // Retry failed requests 2 times
      retry: 2,
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

export default function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Show devtools only in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools
          initialIsOpen={false}
        />
      )}
    </QueryClientProvider>
  );
}

// Export queryClient for use in prefetching or manual invalidation
export { queryClient };