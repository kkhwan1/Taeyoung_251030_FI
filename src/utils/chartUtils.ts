/**
 * Chart utilities for ERP dashboard
 * Handles Korean formatting, themes, and chart configurations
 */

import type { ChartOptions } from 'chart.js';

// Korean number formatting
export const formatKoreanNumber = (value: number): string => {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}억`;
  } else if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}만`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}천`;
  }
  return value.toLocaleString('ko-KR');
};

// Korean currency formatting
export const formatKoreanCurrency = (value: number): string => {
  return `₩${formatKoreanNumber(value)}`;
};

// Korean percentage formatting
export const formatKoreanPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

// Date formatting for Korean locale
export const formatKoreanDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Color schemes for different themes
export const colorSchemes = {
  light: {
    primary: '#3B82F6',
    secondary: '#10B981',
    accent: '#8B5CF6',
    warning: '#F59E0B',
    danger: '#EF4444',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    text: '#1F2937',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    gridLines: '#F3F4F6'
  },
  dark: {
    primary: '#60A5FA',
    secondary: '#34D399',
    accent: '#A78BFA',
    warning: '#FBBF24',
    danger: '#F87171',
    background: '#111827',
    surface: '#1F2937',
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    border: '#374151',
    gridLines: '#374151'
  }
};

// Chart.js configuration presets
export const getChartDefaults = (isDark: boolean = false): Partial<ChartOptions<any>> => {
  const theme = isDark ? colorSchemes.dark : colorSchemes.light;

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: theme.text,
          font: {
            family: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif'
          }
        }
      },
      tooltip: {
        backgroundColor: theme.surface,
        titleColor: theme.text,
        bodyColor: theme.text,
        borderColor: theme.border,
        borderWidth: 1,
        cornerRadius: 8,
        titleFont: {
          family: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif'
        },
        bodyFont: {
          family: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif'
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: theme.gridLines
        },
        ticks: {
          color: theme.textSecondary,
          font: {
            family: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif'
          }
        }
      },
      y: {
        grid: {
          color: theme.gridLines
        },
        ticks: {
          color: theme.textSecondary,
          font: {
            family: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif'
          }
        }
      }
    }
  };
};

// Recharts configuration presets
export const getRechartsTheme = (isDark: boolean = false) => {
  const theme = isDark ? colorSchemes.dark : colorSchemes.light;

  return {
    colors: [
      theme.primary,
      theme.secondary,
      theme.accent,
      theme.warning,
      theme.danger,
      '#06B6D4',
      '#84CC16',
      '#F97316'
    ],
    tooltip: {
      contentStyle: {
        backgroundColor: theme.surface,
        color: theme.text,
        border: `1px solid ${theme.border}`,
        borderRadius: '8px',
        fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif'
      }
    },
    cartesianGrid: {
      stroke: theme.gridLines
    },
    xAxis: {
      tick: { fill: theme.textSecondary },
      axisLine: { stroke: theme.border }
    },
    yAxis: {
      tick: { fill: theme.textSecondary },
      axisLine: { stroke: theme.border }
    }
  };
};

// Transaction type colors
export const getTransactionTypeColor = (type: string, isDark: boolean = false) => {
  const theme = isDark ? colorSchemes.dark : colorSchemes.light;

  switch (type) {
    case '입고':
      return theme.secondary;
    case '출고':
      return theme.primary;
    case '생산':
      return theme.warning;
    case '조정':
      return theme.accent;
    default:
      return theme.textSecondary;
  }
};

// Stock level colors
export const getStockLevelColor = (current: number, minimum: number, isDark: boolean = false) => {
  const theme = isDark ? colorSchemes.dark : colorSchemes.light;
  const ratio = current / minimum;

  if (ratio < 0.5) return theme.danger;
  if (ratio < 1) return theme.warning;
  if (ratio < 1.5) return theme.secondary;
  return theme.primary;
};

// Chart data transformation utilities
export const transformStockData = (items: any[]) => {
  return items.map(item => ({
    name: item.item_name || item.name,
    현재고: item.current_stock || item.current || 0,
    최소재고: item.minimum_stock || item.minimum || 0,
    안전재고: (item.minimum_stock || item.minimum || 0) * 1.5,
    code: item.item_code || item.code
  }));
};

interface Transaction {
  transaction_date?: string;
  date?: string;
  transaction_type?: string;
  type?: string;
  quantity?: number;
}

interface GroupedData {
  date: string;
  입고: number;
  출고: number;
  생산: number;
}

export const transformTransactionData = (transactions: Transaction[]) => {
  const grouped = transactions.reduce((acc, transaction) => {
    const date = transaction.transaction_date || transaction.date || '';
    const dateStr = formatKoreanDate(date);

    if (!acc[dateStr]) {
      acc[dateStr] = { date: dateStr, 입고: 0, 출고: 0, 생산: 0 };
    }

    const type = transaction.transaction_type || transaction.type;
    const quantity = transaction.quantity || 0;

    if (type === '입고') acc[dateStr].입고 += quantity;
    else if (type === '출고') acc[dateStr].출고 += quantity;
    else if (type === '생산') acc[dateStr].생산 += quantity;

    return acc;
  }, {} as Record<string, GroupedData>);

  return Object.values(grouped).sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

// Export chart as image
export const exportChartAsImage = (chartRef: any, filename: string = 'chart.png') => {
  if (!chartRef?.current) return;

  const canvas = chartRef.current.canvas || chartRef.current.querySelector('canvas');
  if (!canvas) return;

  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

// Print chart
export const printChart = (chartRef: any) => {
  if (!chartRef?.current) return;

  const canvas = chartRef.current.canvas || chartRef.current.querySelector('canvas');
  if (!canvas) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head><title>차트 인쇄</title></head>
      <body style="margin: 0; text-align: center;">
        <img src="${canvas.toDataURL('image/png')}" style="max-width: 100%; height: auto;" />
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
};

// Performance optimization utilities
export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => void>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Chart animation presets
export const animationPresets = {
  smooth: {
    animateRotate: true,
    animateScale: true,
    duration: 1000,
    easing: 'easeInOutQuart'
  },
  fast: {
    animateRotate: true,
    animateScale: true,
    duration: 300,
    easing: 'easeOutQuart'
  },
  none: {
    animateRotate: false,
    animateScale: false,
    duration: 0
  }
};

// KPI calculation utilities
export const calculateKPIs = (data: {
  items: any[];
  transactions: Transaction[];
  companies: any[];
}) => {
  const { items, transactions, companies } = data;

  // Calculate total items
  const totalItems = items.filter(item => item.is_active).length;

  // Calculate active companies
  const activeCompanies = companies.filter(company => company.is_active).length;

  // Calculate monthly transaction volume
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyTransactions = transactions.filter(transaction => {
    const date = new Date(transaction.transaction_date || transaction.date || '');
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const monthlyVolume = monthlyTransactions.reduce((sum, transaction) => {
    return sum + (transaction.quantity || 0);
  }, 0);

  // Calculate low stock items
  const lowStockItems = items.filter(item => {
    const current = item.current_stock || 0;
    const minimum = item.minimum_stock || 0;
    return current < minimum && item.is_active;
  }).length;

  // Calculate trends (previous month comparison)
  const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const previousMonthTransactions = transactions.filter(transaction => {
    const date = new Date(transaction.transaction_date || transaction.date || '');
    return date.getMonth() === previousMonth && date.getFullYear() === previousYear;
  });

  const previousMonthVolume = previousMonthTransactions.reduce((sum, transaction) => {
    return sum + (transaction.quantity || 0);
  }, 0);

  const volumeChange = previousMonthVolume > 0
    ? ((monthlyVolume - previousMonthVolume) / previousMonthVolume * 100)
    : 0;

  return {
    totalItems,
    activeCompanies,
    monthlyVolume,
    lowStockItems,
    volumeChange,
    trends: {
      items: 0, // Calculate based on historical data if available
      companies: 0, // Calculate based on historical data if available
      volume: volumeChange,
      lowStock: 0 // Calculate based on historical data if available
    }
  };
};