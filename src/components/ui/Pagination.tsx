'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CursorPaginationMeta {
  limit: number;
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  direction: 'next' | 'prev';
}

interface OffsetPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

type PaginationMeta = CursorPaginationMeta | OffsetPaginationMeta;

interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onCursorChange: (cursor: string | null, direction: 'next' | 'prev') => void;
  loading?: boolean;
}

export function Pagination({ pagination, onPageChange, onCursorChange, loading = false }: PaginationProps) {
  const isCursorPagination = 'nextCursor' in pagination;
  
  if (isCursorPagination) {
    return <CursorPagination 
      pagination={pagination} 
      onCursorChange={onCursorChange} 
      loading={loading} 
    />;
  }
  
  return <OffsetPagination 
    pagination={pagination} 
    onPageChange={onPageChange} 
    loading={loading} 
  />;
}

function CursorPagination({ 
  pagination, 
  onCursorChange, 
  loading 
}: { 
  pagination: CursorPaginationMeta; 
  onCursorChange: (cursor: string | null, direction: 'next' | 'prev') => void;
  loading: boolean;
}) {
  const { hasMore, nextCursor, prevCursor, direction, total, limit } = pagination;
  
  const handleNext = useCallback(() => {
    if (hasMore && nextCursor) {
      onCursorChange(nextCursor, 'next');
    }
  }, [hasMore, nextCursor, onCursorChange]);
  
  const handlePrev = useCallback(() => {
    if (prevCursor) {
      onCursorChange(prevCursor, 'prev');
    }
  }, [prevCursor, onCursorChange]);
  
  const handleFirst = useCallback(() => {
    onCursorChange(null, 'next');
  }, [onCursorChange]);
  
  const handleLast = useCallback(() => {
    // For cursor pagination, we can't easily jump to last page
    // This would require a different approach
    console.warn('Jump to last page not supported in cursor pagination');
  }, []);

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex-1 flex justify-between sm:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={!prevCursor || loading}
        >
          이전
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={!hasMore || loading}
        >
          다음
        </Button>
      </div>
      
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            총 <span className="font-medium">{total}</span>개 항목 중{' '}
            <span className="font-medium">{limit}</span>개씩 표시
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFirst}
            disabled={!prevCursor || loading}
            title="첫 페이지"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={!prevCursor || loading}
            title="이전 페이지"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center space-x-1">
            <span className="text-sm text-gray-500">
              {direction === 'next' ? '다음' : '이전'} 방향
            </span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={!hasMore || loading}
            title="다음 페이지"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleLast}
            disabled={true}
            title="마지막 페이지 (지원되지 않음)"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function OffsetPagination({ 
  pagination, 
  onPageChange, 
  loading 
}: { 
  pagination: OffsetPaginationMeta; 
  onPageChange: (page: number) => void;
  loading: boolean;
}) {
  const { page, totalPages, hasMore, total, limit } = pagination;
  
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      onPageChange(newPage);
    }
  }, [page, totalPages, onPageChange]);
  
  const handlePrev = useCallback(() => {
    handlePageChange(page - 1);
  }, [page, handlePageChange]);
  
  const handleNext = useCallback(() => {
    handlePageChange(page + 1);
  }, [page, handlePageChange]);
  
  const handleFirst = useCallback(() => {
    handlePageChange(1);
  }, [handlePageChange]);
  
  const handleLast = useCallback(() => {
    handlePageChange(totalPages);
  }, [totalPages, handlePageChange]);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = page - 1; i <= page + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex-1 flex justify-between sm:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={page <= 1 || loading}
        >
          이전
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={page >= totalPages || loading}
        >
          다음
        </Button>
      </div>
      
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            총 <span className="font-medium">{total}</span>개 항목 중{' '}
            <span className="font-medium">{(page - 1) * limit + 1}</span>-
            <span className="font-medium">{Math.min(page * limit, total)}</span>개 표시
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFirst}
            disabled={page <= 1 || loading}
            title="첫 페이지"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={page <= 1 || loading}
            title="이전 페이지"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center space-x-1">
            {getPageNumbers().map((pageNum, index) => (
              <Button
                key={index}
                variant={pageNum === page ? "default" : "outline"}
                size="sm"
                onClick={() => typeof pageNum === 'number' ? handlePageChange(pageNum) : undefined}
                disabled={typeof pageNum === 'string' || loading}
                className="min-w-[40px]"
              >
                {pageNum}
              </Button>
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={page >= totalPages || loading}
            title="다음 페이지"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleLast}
            disabled={page >= totalPages || loading}
            title="마지막 페이지"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
