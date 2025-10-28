'use client';

import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Search, ArrowUpDown } from 'lucide-react';
import type { BulkPriceItem, ValidationError } from '@/types/api/price-master';

interface DataPreviewTableProps {
  data: BulkPriceItem[];
  errors: ValidationError[];
  loading?: boolean;
}

type SortField = 'item_code' | 'effective_date';
type SortDirection = 'asc' | 'desc';

export function DataPreviewTable({ data, errors, loading = false }: DataPreviewTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('item_code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Create error map for quick lookup
  const errorMap = useMemo(() => {
    const map = new Map<number, ValidationError[]>();
    errors.forEach(error => {
      if (!map.has(error.row)) {
        map.set(error.row, []);
      }
      map.get(error.row)!.push(error);
    });
    return map;
  }, [errors]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter(item => {
      const searchLower = searchTerm.toLowerCase();
      return (
        item.item_code.toLowerCase().includes(searchLower) ||
        (item.item_name && item.item_name.toLowerCase().includes(searchLower))
      );
    });

    // Sort data
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      if (sortField === 'item_code') {
        aValue = a.item_code;
        bValue = b.item_code;
      } else {
        aValue = new Date(a.effective_date).getTime();
        bValue = new Date(b.effective_date).getTime();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [data, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getRowStatus = (index: number): 'valid' | 'error' => {
    const rowNumber = startIndex + index + 1;
    return errorMap.has(rowNumber) ? 'error' : 'valid';
  };

  const exportToCSV = () => {
    const headers = ['품목코드', '품목명', '단가', '적용일', '상태'];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedData.map(item => {
        const rowNumber = data.indexOf(item) + 1;
        const status = errorMap.has(rowNumber) ? '오류' : '유효';
        return [
          `"${item.item_code}"`,
          `"${item.item_name || ''}"`,
          item.unit_price,
          `"${item.effective_date}"`,
          `"${status}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `가격_미리보기_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="text-gray-600">데이터를 불러오는 중...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">업로드된 데이터가 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>데이터 미리보기</CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={data.length === 0}
              data-testid="export-csv-button"
            >
              <Download className="h-4 w-4 mr-2" />
              CSV 내보내기
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search and Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="품목코드 또는 품목명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
                data-testid="search-input"
              />
            </div>
            <p className="text-sm text-gray-500">
              총 {filteredAndSortedData.length}개 항목
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('item_code')}
                >
                  <div className="flex items-center space-x-1">
                    <span>품목코드</span>
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>품목명</TableHead>
                <TableHead>단가</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('effective_date')}
                >
                  <div className="flex items-center space-x-1">
                    <span>적용일</span>
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((item, index) => {
                const status = getRowStatus(index);
                const rowNumber = startIndex + index + 1;
                const rowErrors = errorMap.get(rowNumber) || [];

                return (
                  <TableRow 
                    key={`${item.item_code}-${item.effective_date}`}
                    className={status === 'error' ? 'bg-gray-50' : ''}
                    data-testid={`table-row-${index}`}
                  >
                    <TableCell className="font-medium">
                      {item.item_code}
                    </TableCell>
                    <TableCell>
                      {item.item_name || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unit_price)}원
                    </TableCell>
                    <TableCell>
                      {formatDate(item.effective_date)}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={status === 'valid' ? 'default' : 'destructive'}
                        data-testid={`status-badge-${index}`}
                      >
                        {status === 'valid' ? '유효' : '오류'}
                      </Badge>
                      {rowErrors.length > 0 && (
                        <div className="mt-1 text-xs text-gray-600">
                          {rowErrors.map((error, i) => (
                            <div key={i}>{error.message}</div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredAndSortedData.length)} / {filteredAndSortedData.length}개 항목
            </p>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                이전
              </Button>
              <span className="text-sm">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                다음
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
