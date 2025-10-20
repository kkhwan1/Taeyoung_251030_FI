'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, TrendingDown, Package } from 'lucide-react';

interface BOMDeduction {
  log_id: number;
  child_item_id: number;
  item_code: string;
  item_name: string;
  unit: string;
  deducted_quantity: number;
  usage_rate: number;
  stock_before: number;
  stock_after: number;
}

interface BOMDeductionResultsProps {
  deductions: BOMDeduction[];
}

export default function BOMDeductionResults({ deductions }: BOMDeductionResultsProps) {
  if (!deductions || deductions.length === 0) {
    return null;
  }

  return (
    <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <CardTitle className="text-green-900 dark:text-green-100">
            BOM 자동 차감 완료
          </CardTitle>
        </div>
        <CardDescription className="text-green-700 dark:text-green-300">
          {deductions.length}개 원자재가 BOM에 따라 자동으로 차감되었습니다
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">품목코드</TableHead>
                <TableHead>품목명</TableHead>
                <TableHead className="text-center">단위</TableHead>
                <TableHead className="text-right">사용비율</TableHead>
                <TableHead className="text-right">차감수량</TableHead>
                <TableHead className="text-right">차감전 재고</TableHead>
                <TableHead className="text-right">차감후 재고</TableHead>
                <TableHead className="text-center">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deductions.map((deduction) => {
                const stockDiff = deduction.stock_before - deduction.stock_after;
                const lowStock = deduction.stock_after < 10; // Example threshold

                return (
                  <TableRow key={deduction.log_id}>
                    <TableCell className="font-mono text-sm">
                      {deduction.item_code}
                    </TableCell>
                    <TableCell className="font-medium">
                      {deduction.item_name}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{deduction.unit}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {deduction.usage_rate.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <TrendingDown className="h-3 w-3 text-red-500" />
                        {deduction.deducted_quantity.toLocaleString('ko-KR')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {deduction.stock_before.toLocaleString('ko-KR')}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <span className={lowStock ? 'text-orange-600' : ''}>
                        {deduction.stock_after.toLocaleString('ko-KR')}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {lowStock ? (
                        <Badge variant="destructive" className="text-xs">
                          저재고
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                          정상
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        <div className="mt-4 flex items-center justify-between rounded-md bg-white/60 dark:bg-gray-900/40 p-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">총 차감 품목</span>
          </div>
          <span className="text-lg font-bold">{deductions.length}개</span>
        </div>

        {/* Low Stock Warning */}
        {deductions.some(d => d.stock_after < 10) && (
          <Alert className="mt-4" variant="default">
            <AlertTitle>재고 주의</AlertTitle>
            <AlertDescription>
              일부 원자재의 재고가 낮습니다. 재고 확인 및 발주가 필요합니다.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
