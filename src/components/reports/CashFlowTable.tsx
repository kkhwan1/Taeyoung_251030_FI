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
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface CashFlowTableProps {
  data: {
    영업활동: any[];
    투자활동: any[];
    재무활동: any[];
    summary: {
      operating_cash_flow: number;
      investing_cash_flow: number;
      financing_cash_flow: number;
      net_cash_flow: number;
      beginning_cash: number;
      ending_cash: number;
    };
  };
}

export default function CashFlowTable({ data }: CashFlowTableProps) {
  const formatCurrency = (value: number) => {
    return `₩${Math.abs(value).toLocaleString('ko-KR')}`;
  };

  const getCashFlowIcon = (amount: number) => {
    if (amount > 0) {
      return <ArrowUp className="w-4 h-4 text-gray-600 inline mr-1" />;
    } else if (amount < 0) {
      return <ArrowDown className="w-4 h-4 text-gray-600 inline mr-1" />;
    }
    return <Minus className="w-4 h-4 text-gray-400 inline mr-1" />;
  };

  const renderSection = (
    title: string,
    items: any[],
    total: number,
    sectionClass?: string
  ) => {
    return (
      <>
        <TableRow className={cn('bg-gray-100 font-bold', sectionClass)}>
          <TableCell colSpan={3}>{title}</TableCell>
        </TableRow>
        {items.map((item, index) => (
          <TableRow key={`${title}-${index}`} className="hover:bg-gray-50">
            <TableCell className="pl-8">{item.activity_name}</TableCell>
            <TableCell className="text-right">
              {getCashFlowIcon(item.amount)}
              <span
                className={cn(
                  item.amount > 0
                    ? 'text-gray-600'
                    : item.amount < 0
                    ? 'text-gray-600'
                    : 'text-gray-600'
                )}
              >
                {formatCurrency(item.amount)}
              </span>
            </TableCell>
            <TableCell className="text-center">
              {item.amount > 0
                ? '유입'
                : item.amount < 0
                ? '유출'
                : '-'}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-gray-200 font-bold">
          <TableCell>{title} 소계</TableCell>
          <TableCell className="text-right">
            {getCashFlowIcon(total)}
            <span
              className={cn(
                total > 0
                  ? 'text-gray-600'
                  : total < 0
                  ? 'text-gray-600'
                  : 'text-gray-600'
              )}
            >
              {formatCurrency(total)}
            </span>
          </TableCell>
          <TableCell className="text-center">
            {total > 0 ? '순유입' : total < 0 ? '순유출' : '-'}
          </TableCell>
        </TableRow>
      </>
    );
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="font-bold">현금흐름 항목</TableHead>
            <TableHead className="text-right font-bold">금액</TableHead>
            <TableHead className="text-center font-bold">구분</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* 영업활동 */}
          {renderSection(
            '영업활동 현금흐름',
            data.영업활동,
            data.summary.operating_cash_flow,
            'bg-gray-50'
          )}

          {/* 투자활동 */}
          {renderSection(
            '투자활동 현금흐름',
            data.투자활동,
            data.summary.investing_cash_flow,
            'bg-gray-50'
          )}

          {/* 재무활동 */}
          {renderSection(
            '재무활동 현금흐름',
            data.재무활동,
            data.summary.financing_cash_flow,
            'bg-gray-50'
          )}

          {/* 현금 증감 요약 */}
          <TableRow className="bg-gray-100 font-bold text-lg">
            <TableCell>기간 중 현금 증감</TableCell>
            <TableCell className="text-right">
              {getCashFlowIcon(data.summary.net_cash_flow)}
              <span
                className={cn(
                  data.summary.net_cash_flow > 0
                    ? 'text-gray-600'
                    : data.summary.net_cash_flow < 0
                    ? 'text-gray-600'
                    : 'text-gray-600'
                )}
              >
                {formatCurrency(data.summary.net_cash_flow)}
              </span>
            </TableCell>
            <TableCell className="text-center">
              {data.summary.net_cash_flow > 0
                ? '증가'
                : data.summary.net_cash_flow < 0
                ? '감소'
                : '-'}
            </TableCell>
          </TableRow>

          {/* 기초 및 기말 현금 */}
          <TableRow className="font-bold">
            <TableCell>기초 현금</TableCell>
            <TableCell className="text-right">
              {formatCurrency(data.summary.beginning_cash)}
            </TableCell>
            <TableCell></TableCell>
          </TableRow>

          <TableRow className="font-bold bg-gray-50">
            <TableCell>기말 현금</TableCell>
            <TableCell className="text-right text-gray-600">
              {formatCurrency(data.summary.ending_cash)}
            </TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>

      {/* 현금흐름 분석 */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-bold mb-2">현금흐름 분석</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">영업활동 비율</p>
            <p className="font-bold">
              {data.summary.net_cash_flow !== 0
                ? `${(
                    (data.summary.operating_cash_flow /
                      Math.abs(data.summary.net_cash_flow)) *
                    100
                  ).toFixed(1)}%`
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">현금 창출 능력</p>
            <p
              className={cn(
                'font-bold',
                data.summary.operating_cash_flow > 0
                  ? 'text-gray-600'
                  : 'text-gray-600'
              )}
            >
              {data.summary.operating_cash_flow > 0 ? '양호' : '주의필요'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">현금 유동성</p>
            <p
              className={cn(
                'font-bold',
                data.summary.ending_cash > 0
                  ? 'text-gray-600'
                  : 'text-gray-600'
              )}
            >
              {data.summary.ending_cash > 0 ? '정상' : '부족'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">현금흐름 상태</p>
            <p className="font-bold">
              {data.summary.operating_cash_flow > 0 &&
              data.summary.net_cash_flow > 0
                ? '건전'
                : data.summary.operating_cash_flow > 0
                ? '보통'
                : '위험'}
            </p>
          </div>
        </div>

        {/* 현금흐름 패턴 분석 */}
        <div className="mt-4 p-3 bg-white rounded border">
          <h5 className="font-semibold mb-2">현금흐름 패턴</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>영업활동:</span>
              <span
                className={cn(
                  'font-semibold',
                  data.summary.operating_cash_flow > 0
                    ? 'text-gray-600'
                    : 'text-gray-600'
                )}
              >
                {data.summary.operating_cash_flow > 0 ? '(+) 유입' : '(-) 유출'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>투자활동:</span>
              <span
                className={cn(
                  'font-semibold',
                  data.summary.investing_cash_flow > 0
                    ? 'text-gray-600'
                    : data.summary.investing_cash_flow < 0
                    ? 'text-gray-600'
                    : 'text-gray-400'
                )}
              >
                {data.summary.investing_cash_flow > 0
                  ? '(+) 유입'
                  : data.summary.investing_cash_flow < 0
                  ? '(-) 유출'
                  : '없음'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>재무활동:</span>
              <span
                className={cn(
                  'font-semibold',
                  data.summary.financing_cash_flow > 0
                    ? 'text-gray-600'
                    : data.summary.financing_cash_flow < 0
                    ? 'text-gray-600'
                    : 'text-gray-400'
                )}
              >
                {data.summary.financing_cash_flow > 0
                  ? '(+) 유입'
                  : data.summary.financing_cash_flow < 0
                  ? '(-) 유출'
                  : '없음'}
              </span>
            </div>
            <hr className="my-2" />
            <div className="font-semibold">
              패턴 진단:{' '}
              {data.summary.operating_cash_flow > 0
                ? '성장기업 패턴 - 영업활동으로 현금 창출'
                : '위험 패턴 - 영업활동 현금흐름 개선 필요'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}