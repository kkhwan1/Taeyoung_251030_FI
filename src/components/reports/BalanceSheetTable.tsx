import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  Check
} from 'lucide-react';

interface BalanceSheetTableProps {
  data: {
    자산: any[];
    부채: any[];
    자본: any[];
    summary: {
      total_assets: number;
      total_liabilities: number;
      total_equity: number;
      balance_check: boolean;
    };
  };
}

export default function BalanceSheetTable({ data }: BalanceSheetTableProps) {
  const formatCurrency = (value: number) => {
    return `₩${value.toLocaleString('ko-KR')}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const renderSection = (title: string, items: any[], isTotal?: boolean) => {
    return (
      <>
        <TableRow className="bg-gray-100 font-bold">
          <TableCell colSpan={6}>{title}</TableCell>
        </TableRow>
        {items.map((item, index) => (
          <TableRow key={`${title}-${index}`} className="hover:bg-gray-50">
            <TableCell className="pl-8">{item.category}</TableCell>
            <TableCell>{item.account_name}</TableCell>
            <TableCell className="text-right">
              {formatCurrency(item.current_period || 0)}
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(item.prior_period || 0)}
            </TableCell>
            <TableCell className="text-right">
              <span
                className={cn(
                  item.change_amount > 0
                    ? 'text-gray-600'
                    : item.change_amount < 0
                    ? 'text-gray-600'
                    : 'text-gray-600'
                )}
              >
                {formatCurrency(item.change_amount || 0)}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <span
                className={cn(
                  item.change_rate > 0
                    ? 'text-gray-600'
                    : item.change_rate < 0
                    ? 'text-gray-600'
                    : 'text-gray-600'
                )}
              >
                {item.change_rate !== null && item.change_rate !== undefined
                  ? formatPercentage(item.change_rate)
                  : '-'}
              </span>
            </TableCell>
          </TableRow>
        ))}
        {isTotal && (
          <TableRow className="bg-gray-200 font-bold">
            <TableCell colSpan={2}>{title} 합계</TableCell>
            <TableCell className="text-right">
              {formatCurrency(
                items.reduce((sum, item) => sum + (item.current_period || 0), 0)
              )}
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(
                items.reduce((sum, item) => sum + (item.prior_period || 0), 0)
              )}
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(
                items.reduce((sum, item) => sum + (item.change_amount || 0), 0)
              )}
            </TableCell>
            <TableCell className="text-right">-</TableCell>
          </TableRow>
        )}
      </>
    );
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="font-bold">분류</TableHead>
            <TableHead className="font-bold">계정과목</TableHead>
            <TableHead className="text-right font-bold">당기말</TableHead>
            <TableHead className="text-right font-bold">전기말</TableHead>
            <TableHead className="text-right font-bold">증감액</TableHead>
            <TableHead className="text-right font-bold">증감률(%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* 자산 섹션 */}
          {renderSection('자산', data.자산, true)}

          {/* 부채 섹션 */}
          {renderSection('부채', data.부채, true)}

          {/* 자본 섹션 */}
          {renderSection('자본', data.자본, true)}

          {/* 총계 행 */}
          <TableRow className="bg-gray-100 font-bold text-lg">
            <TableCell colSpan={2}>자산 총계</TableCell>
            <TableCell className="text-right">
              {formatCurrency(data.summary.total_assets)}
            </TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">-</TableCell>
          </TableRow>

          <TableRow className="bg-gray-100 font-bold text-lg">
            <TableCell colSpan={2}>부채 + 자본 총계</TableCell>
            <TableCell className="text-right">
              {formatCurrency(
                data.summary.total_liabilities + data.summary.total_equity
              )}
            </TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">-</TableCell>
          </TableRow>

          {/* 균형 확인 */}
          <TableRow
            className={cn(
              'font-bold',
              data.summary.balance_check ? 'bg-gray-50' : 'bg-gray-50'
            )}
          >
            <TableCell colSpan={2}>재무상태 균형</TableCell>
            <TableCell
              colSpan={4}
              className={cn(
                'text-center',
                data.summary.balance_check ? 'text-gray-600' : 'text-gray-600'
              )}
            >
              <div className="flex items-center justify-center gap-2">
                {data.summary.balance_check ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>균형 (자산 = 부채 + 자본)</span>
                  </>
                ) : (
                  <>
                    
                    <span>불균형 - 데이터 확인 필요</span>
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      {/* 추가 정보 */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-bold mb-2">재무 비율 분석</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">부채비율</p>
            <p className="font-bold">
              {data.summary.total_equity > 0
                ? formatPercentage(
                    (data.summary.total_liabilities / data.summary.total_equity) * 100
                  )
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">자기자본비율</p>
            <p className="font-bold">
              {data.summary.total_assets > 0
                ? formatPercentage(
                    (data.summary.total_equity / data.summary.total_assets) * 100
                  )
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">유동비율</p>
            <p className="font-bold">
              {data.summary.total_liabilities > 0
                ? formatPercentage(
                    (data.summary.total_assets / data.summary.total_liabilities) * 100
                  )
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">안정성 등급</p>
            <p className="font-bold">
              {data.summary.total_equity > data.summary.total_liabilities
                ? '양호'
                : '주의'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}