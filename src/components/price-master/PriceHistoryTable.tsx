'use client';

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2,
  Search,
  Calendar
} from 'lucide-react';
import { useToastNotification } from '@/hooks/useToast';

interface PriceHistory {
  price_id: number;
  item_id: number;
  unit_price: number;
  effective_date: string;
  price_type: string;
  is_current: boolean;
  notes: string | null;
  items: {
    item_code: string;
    item_name: string;
    spec: string;
    unit: string;
  };
  created_at: string;
}

export default function PriceHistoryTable() {
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentFilter, setCurrentFilter] = useState<string>('all');
  const toast = useToastNotification();

  useEffect(() => {
    fetchPriceHistory();
  }, []);

  const fetchPriceHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/price-master');
      const data = await response.json();

      if (data.success) {
        setPriceHistory(data.data.data || []);
      } else {
        toast.error('조회 실패', data.error || '단가 이력을 불러올 수 없습니다');
      }
    } catch (error) {
      toast.error('오류 발생', '단가 이력을 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = priceHistory.filter(price => {
    const matchesSearch =
      price.items.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      price.items.item_code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === 'all' || price.price_type === typeFilter;

    const matchesCurrent =
      currentFilter === 'all' ||
      (currentFilter === 'current' && price.is_current) ||
      (currentFilter === 'history' && !price.is_current);

    return matchesSearch && matchesType && matchesCurrent;
  });

  const getPriceTypeLabel = (type: string) => {
    switch (type) {
      case 'purchase':
        return '매입 단가';
      case 'production':
        return '생산 단가';
      case 'manual':
        return '수동 입력';
      default:
        return type;
    }
  };

  const getPriceTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'default';
      case 'production':
        return 'secondary';
      case 'manual':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="품목명, 품목코드로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="단가 유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="purchase">매입 단가</SelectItem>
            <SelectItem value="production">생산 단가</SelectItem>
            <SelectItem value="manual">수동 입력</SelectItem>
          </SelectContent>
        </Select>
        <Select value={currentFilter} onValueChange={setCurrentFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="현재 단가" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="current">현재 단가만</SelectItem>
            <SelectItem value="history">이력만</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={fetchPriceHistory} variant="outline">
          새로고침
        </Button>
      </div>

      {/* Table */}
      {filteredHistory.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          
          <p>단가 이력이 없습니다</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>품목정보</TableHead>
                <TableHead>단가 유형</TableHead>
                <TableHead className="text-right">단가</TableHead>
                <TableHead className="w-[100px]">적용일자</TableHead>
                <TableHead className="w-[80px]">상태</TableHead>
                <TableHead>비고</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.map((price) => (
                <TableRow key={price.price_id} className={price.is_current ? 'bg-gray-50/50 dark:bg-gray-950/20' : ''}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium flex items-center gap-2">
                        {price.items.item_name}
                        {price.is_current && (
                          <Badge variant="default" className="text-xs bg-gray-600">
                            현재 단가
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        [{price.items.item_code}] {price.items.spec}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPriceTypeBadgeVariant(price.price_type)}>
                      {getPriceTypeLabel(price.price_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      
                      <span className={price.is_current ? 'font-semibold text-gray-700 dark:text-gray-400' : 'font-medium'}>
                        {price.unit_price.toLocaleString('ko-KR')}
                      </span>
                      <span className="text-xs text-muted-foreground">/{price.items.unit}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {new Date(price.effective_date).toLocaleDateString('ko-KR')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {price.is_current ? (
                      <Badge variant="default" className="bg-gray-600">
                        
                        현재
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        이력
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {price.notes ? (
                      <span className="text-sm">{price.notes}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
