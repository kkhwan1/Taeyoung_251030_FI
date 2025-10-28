'use client';

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  Search,
  Calendar,
  Weight
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ScrapTracking {
  tracking_id: number;
  tracking_date: string;
  item_id: number;
  production_quantity: number;
  scrap_weight: number;
  scrap_unit_price: number;
  scrap_revenue: number;
  notes: string | null;
  items: {
    item_code: string;
    item_name: string;
    spec: string;
    unit: string;
  };
  created_at: string;
}

export default function ScrapTrackingTable() {
  const [trackings, setTrackings] = useState<ScrapTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchTrackings();
  }, []);

  const fetchTrackings = async () => {
    setLoading(true);
    try {
      let url = '/api/scrap-tracking?limit=1000';

      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setTrackings(data.data.data || []);
      } else {
        toast({
          type: 'error',
          title: '조회 실패',
          message: data.error || '스크랩 이력을 불러올 수 없습니다'
        });
      }
    } catch (error) {
      toast({
        type: 'error',
        title: '오류 발생',
        message: '스크랩 이력을 불러오는 중 오류가 발생했습니다'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTrackings = trackings.filter(tracking => {
    const matchesSearch =
      tracking.items.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tracking.items.item_code.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  // Calculate totals
  const totalScrapWeight = filteredTrackings.reduce((sum, t) => sum + t.scrap_weight, 0);
  const totalScrapRevenue = filteredTrackings.reduce((sum, t) => sum + t.scrap_revenue, 0);

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
        <div className="flex gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[150px]"
            placeholder="시작일"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[150px]"
            placeholder="종료일"
          />
        </div>
        <Button onClick={fetchTrackings} variant="outline">
          새로고침
        </Button>
      </div>

      {/* Summary Cards */}
      {filteredTrackings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              
              <span className="text-sm font-medium">총 기록 수</span>
            </div>
            <p className="text-2xl font-bold">{filteredTrackings.length}건</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Weight className="h-4 w-4" />
              <span className="text-sm font-medium">총 스크랩 무게</span>
            </div>
            <p className="text-2xl font-bold">{totalScrapWeight.toFixed(2)} kg</p>
          </div>
          <div className="rounded-lg border bg-card p-4 bg-gray-50 dark:bg-gray-950/20">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-2">
              
              <span className="text-sm font-medium">총 스크랩 수익</span>
            </div>
            <p className="text-2xl font-bold text-gray-700 dark:text-gray-400">
              {totalScrapRevenue.toLocaleString('ko-KR')}원
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {filteredTrackings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          
          <p>스크랩 이력이 없습니다</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">추적일자</TableHead>
                <TableHead>품목정보</TableHead>
                <TableHead className="text-right">생산수량</TableHead>
                <TableHead className="text-right">스크랩무게</TableHead>
                <TableHead className="text-right">단가</TableHead>
                <TableHead className="text-right">수익</TableHead>
                <TableHead>비고</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrackings.map((tracking) => (
                <TableRow key={tracking.tracking_id}>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {new Date(tracking.tracking_date).toLocaleDateString('ko-KR')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{tracking.items.item_name}</div>
                      <div className="text-xs text-muted-foreground">
                        [{tracking.items.item_code}] {tracking.items.spec}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      
                      <span>{tracking.production_quantity.toLocaleString('ko-KR')}</span>
                      <span className="text-xs text-muted-foreground">{tracking.items.unit}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Weight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{tracking.scrap_weight.toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground">kg</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      
                      <span>{tracking.scrap_unit_price.toLocaleString('ko-KR')}</span>
                      <span className="text-xs text-muted-foreground">/kg</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      
                      <span className="font-semibold text-gray-700 dark:text-gray-400">
                        {tracking.scrap_revenue.toLocaleString('ko-KR')}
                      </span>
                      <span className="text-xs text-muted-foreground">원</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {tracking.notes ? (
                      <span className="text-sm">{tracking.notes}</span>
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
