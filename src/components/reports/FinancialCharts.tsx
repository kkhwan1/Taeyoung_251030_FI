'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface FinancialChartsProps {
  balanceSheetData: any;
  cashFlowData: any;
}

export default function FinancialCharts({
  balanceSheetData,
  cashFlowData,
}: FinancialChartsProps) {
  // Balance Sheet Bar Chart Data
  const balanceSheetChartData = {
    labels: ['자산', '부채', '자본'],
    datasets: [
      {
        label: '당기말',
        data: [
          balanceSheetData.summary.total_assets,
          balanceSheetData.summary.total_liabilities,
          balanceSheetData.summary.total_equity,
        ],
        backgroundColor: ['#262626', '#525252', '#737373'],
        borderColor: ['#262626', '#525252', '#737373'],
        borderWidth: 1,
      },
    ],
  };

  const balanceSheetOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: '재무상태표 구성',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += '₩' + context.parsed.y.toLocaleString('ko-KR');
            }
            return label;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value: any) {
            return '₩' + value.toLocaleString('ko-KR');
          },
        },
      },
    },
  };

  // Cash Flow Bar Chart Data
  const cashFlowChartData = {
    labels: ['영업활동', '투자활동', '재무활동', '순현금흐름'],
    datasets: [
      {
        label: '현금흐름',
        data: [
          cashFlowData.summary.operating_cash_flow,
          cashFlowData.summary.investing_cash_flow,
          cashFlowData.summary.financing_cash_flow,
          cashFlowData.summary.net_cash_flow,
        ],
        backgroundColor: (context: any) => {
          const value = context.parsed?.y || 0;
          return value >= 0 ? '#525252' : '#262626';
        },
        borderColor: (context: any) => {
          const value = context.parsed?.y || 0;
          return value >= 0 ? '#525252' : '#262626';
        },
        borderWidth: 1,
      },
    ],
  };

  const cashFlowOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: '현금흐름 분석',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              const value = context.parsed.y;
              const sign = value >= 0 ? '+' : '';
              label += sign + '₩' + Math.abs(value).toLocaleString('ko-KR');
            }
            return label;
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: function (value: any) {
            return '₩' + Math.abs(value).toLocaleString('ko-KR');
          },
        },
      },
    },
  };

  // Financial Ratios Pie Chart
  const financialRatioData = {
    labels: ['자기자본', '타인자본'],
    datasets: [
      {
        label: '자본구성',
        data: [
          balanceSheetData.summary.total_equity,
          balanceSheetData.summary.total_liabilities,
        ],
        backgroundColor: ['#525252', '#737373'],
        borderColor: ['#525252', '#737373'],
        borderWidth: 1,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: '자본구성 비율',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            let label = context.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed !== null) {
              const total =
                balanceSheetData.summary.total_equity +
                balanceSheetData.summary.total_liabilities;
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              label += `₩${context.parsed.toLocaleString(
                'ko-KR'
              )} (${percentage}%)`;
            }
            return label;
          },
        },
      },
    },
  };

  // Trend Line Chart Data (placeholder for now)
  const trendData = {
    labels: ['1월', '2월', '3월', '4월', '5월', '6월'],
    datasets: [
      {
        label: '매출액',
        data: [0, 0, 0, 0, 0, 0], // Placeholder data
        borderColor: '#262626',
        backgroundColor: 'rgba(38, 38, 38, 0.1)',
        tension: 0.4,
      },
      {
        label: '영업이익',
        data: [0, 0, 0, 0, 0, 0], // Placeholder data
        borderColor: '#525252',
        backgroundColor: 'rgba(82, 82, 82, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: '월별 추이 (준비 중)',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += '₩' + context.parsed.y.toLocaleString('ko-KR');
            }
            return label;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value: any) {
            return '₩' + value.toLocaleString('ko-KR');
          },
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* First Row: Balance Sheet and Cash Flow */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg border" style={{ height: '400px' }}>
          <Bar data={balanceSheetChartData} options={balanceSheetOptions} />
        </div>

        <div className="bg-white p-4 rounded-lg border" style={{ height: '400px' }}>
          <Bar data={cashFlowChartData} options={cashFlowOptions} />
        </div>
      </div>

      {/* Second Row: Capital Structure and Trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg border" style={{ height: '400px' }}>
          <Pie data={financialRatioData} options={pieOptions} />
        </div>

        <div className="bg-white p-4 rounded-lg border" style={{ height: '400px' }}>
          <Line data={trendData} options={trendOptions} />
        </div>
      </div>

      {/* Financial Health Score Card */}
      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border">
        <h3 className="text-xl font-bold mb-4">재무 건전성 평가</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-3 rounded">
            <p className="text-sm text-gray-600">부채비율</p>
            <p className="text-2xl font-bold">
              {balanceSheetData.summary.total_equity > 0
                ? (
                    (balanceSheetData.summary.total_liabilities /
                      balanceSheetData.summary.total_equity) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </p>
            <p className="text-xs text-gray-500">
              {balanceSheetData.summary.total_liabilities <
              balanceSheetData.summary.total_equity
                ? '양호'
                : '개선필요'}
            </p>
          </div>

          <div className="bg-white p-3 rounded">
            <p className="text-sm text-gray-600">자기자본비율</p>
            <p className="text-2xl font-bold">
              {balanceSheetData.summary.total_assets > 0
                ? (
                    (balanceSheetData.summary.total_equity /
                      balanceSheetData.summary.total_assets) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </p>
            <p className="text-xs text-gray-500">
              {balanceSheetData.summary.total_equity >
              balanceSheetData.summary.total_liabilities
                ? '안정적'
                : '주의'}
            </p>
          </div>

          <div className="bg-white p-3 rounded">
            <p className="text-sm text-gray-600">영업현금흐름</p>
            <p
              className="text-2xl font-bold text-gray-800 dark:text-gray-200"
            >
              {cashFlowData.summary.operating_cash_flow > 0 ? '+' : ''}
              {(cashFlowData.summary.operating_cash_flow / 1000000).toFixed(1)}M
            </p>
            <p className="text-xs text-gray-500">
              {cashFlowData.summary.operating_cash_flow > 0
                ? '현금창출 양호'
                : '개선 필요'}
            </p>
          </div>

          <div className="bg-white p-3 rounded">
            <p className="text-sm text-gray-600">종합 등급</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {balanceSheetData.summary.total_equity >
                balanceSheetData.summary.total_liabilities &&
              cashFlowData.summary.operating_cash_flow > 0
                ? 'A'
                : balanceSheetData.summary.total_equity >
                  balanceSheetData.summary.total_liabilities ||
                  cashFlowData.summary.operating_cash_flow > 0
                ? 'B'
                : 'C'}
            </p>
            <p className="text-xs text-gray-500">재무 건전성</p>
          </div>
        </div>
      </div>
    </div>
  );
}