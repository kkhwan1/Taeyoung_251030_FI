'use client';

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Calendar, Package, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ProductionTransaction {
  transaction_id: number;
  transaction_date: string;
  transaction_type: string;
  reference_number: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  notes: string | null;
  items: {
    item_code: string;
    item_name: string;
    spec: string;
    unit: string;
  };
  users: {
    username: string;
  };
  created_at: string;
}

export default function ProductionHistoryTable() {
  const [transactions, setTransactions] = useState<ProductionTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/inventory/production');
      const data = await response.json();

      if (data.success) {
        setTransactions(data.data.transactions || []);
      } else {
        toast({
          variant: 'destructive',
          title: '조회 실패',
          description: data.error || '생산 내역을 불러올 수 없습니다'
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '생산 내역을 불러오는 중 오류가 발생했습니다'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch =
      transaction.items?.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.items?.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (transaction.reference_number && transaction.reference_number.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'all' || transaction.transaction_type === typeFilter;

    return matchesSearch && matchesType;
  });

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
            placeholder="품목명, 품목코드, 참조번호로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="거래유형 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="생산입고">생산입고</SelectItem>
            <SelectItem value="생산출고">생산출고</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={fetchTransactions} variant="outline">
          새로고침
        </Button>
      </div>

      {/* Table */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>생산 내역이 없습니다</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">거래일자</TableHead>
                <TableHead className="w-[100px]">거래유형</TableHead>
                <TableHead>품목정보</TableHead>
                <TableHead className="text-right">수량</TableHead>
                <TableHead className="text-right">단가</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead>참조번호</TableHead>
                <TableHead>작성자</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => (
                <TableRow key={transaction.transaction_id}>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {new Date(transaction.transaction_date).toLocaleDateString('ko-KR')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={transaction.transaction_type === '생산입고' ? 'default' : 'secondary'}
                    >
                      {transaction.transaction_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{transaction.items?.item_name ?? '(품목 정보 없음)'}</div>
                      <div className="text-xs text-muted-foreground">
                        [{transaction.items?.item_code ?? 'N/A'}] {transaction.items?.spec ?? ''}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {transaction.quantity.toLocaleString('ko-KR')} {transaction.items?.unit ?? ''}
                  </TableCell>
                  <TableCell className="text-right">
                    {transaction.unit_price.toLocaleString('ko-KR')}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {transaction.total_amount.toLocaleString('ko-KR')}
                  </TableCell>
                  <TableCell>
                    {transaction.reference_number ? (
                      <div className="flex items-center gap-1 text-sm">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        {transaction.reference_number}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {transaction.users?.username ?? '(작성자 정보 없음)'}
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
