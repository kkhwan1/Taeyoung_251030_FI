/**
 * Chart utilities for ERP dashboard
 * Universal module supporting both CommonJS and ES6 imports
 * Works for both API routes (require) and client components (import)
 */

// Korean number formatting
function formatKoreanNumber(value) {
  // Null safety guard for undefined, null, and NaN values
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  const num = Number(value);

  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)}억`;
  } else if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}만`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}천`;
  }
  return num.toLocaleString('ko-KR');
}

// Korean currency formatting
function formatKoreanCurrency(value) {
  return `₩${formatKoreanNumber(value)}`;
}

// Korean percentage formatting
function formatKoreanPercent(value) {
  return `${value.toFixed(1)}%`;
}

// Date formatting for Korean locale
function formatKoreanDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Color schemes for different themes
const colorSchemes = {
  light: {
    primary: '#525252',
    secondary: '#525252',
    accent: '#525252',
    warning: '#525252',
    danger: '#262626',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    text: '#1F2937',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    gridLines: '#F3F4F6'
  },
  dark: {
    primary: '#60A5FA',
    secondary: '#525252',
    accent: '#A78BFA',
    warning: '#525252',
    danger: '#525252',
    background: '#111827',
    surface: '#1F2937',
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    border: '#374151',
    gridLines: '#374151'
  }
};

// Chart.js configuration presets
function getChartDefaults(isDark = false) {
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
}

// Recharts configuration presets
function getRechartsTheme(isDark = false) {
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
}

// Transaction type colors
function getTransactionTypeColor(type, isDark = false) {
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
}

// Stock level colors
function getStockLevelColor(current, minimum, isDark = false) {
  const theme = isDark ? colorSchemes.dark : colorSchemes.light;
  const ratio = current / minimum;

  if (ratio < 0.5) return theme.danger;
  if (ratio < 1) return theme.warning;
  if (ratio < 1.5) return theme.secondary;
  return theme.primary;
}

// Chart data transformation utilities
function transformStockData(items) {
  return items.map(item => ({
    name: item.item_name || item.name,
    현재고: item.current_stock || item.current || 0,
    최소재고: item.minimum_stock || item.minimum || 0,
    안전재고: (item.minimum_stock || item.minimum || 0) * 1.5,
    code: item.item_code || item.code
  }));
}

function transformTransactionData(transactions) {
  const grouped = transactions.reduce((acc, transaction) => {
    const date = transaction.transaction_date || transaction.date;
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
  }, {});

  return Object.values(grouped).sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

// Export chart as image
function exportChartAsImage(chartRef, filename = 'chart.png') {
  if (!chartRef?.current) return;

  const canvas = chartRef.current.canvas || chartRef.current.querySelector('canvas');
  if (!canvas) return;

  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// Print chart
function printChart(chartRef) {
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
}

// Performance optimization utilities
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Chart animation presets
const animationPresets = {
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

// KPI calculation function
function calculateKPIs(data) {
  const { items, transactions, companies } = data;

  // Calculate total items
  const totalItems = items.filter(item => item.is_active).length;

  // Calculate active companies
  const activeCompanies = companies.filter(company => company.is_active).length;

  // Calculate monthly transaction volume
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyTransactions = transactions.filter(transaction => {
    const date = new Date(transaction.transaction_date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const monthlyVolume = monthlyTransactions.reduce((sum, transaction) => {
    return sum + (parseFloat(transaction.quantity) || 0);
  }, 0);

  // Calculate low stock items
  const lowStockItems = items.filter(item => {
    const current = item.current_stock || 0;
    const minimum = item.minimum_stock || item.min_stock_level || 0;
    return current < minimum && item.is_active;
  }).length;

  // Calculate trends (previous month comparison)
  const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const previousMonthTransactions = transactions.filter(transaction => {
    const date = new Date(transaction.transaction_date);
    return date.getMonth() === previousMonth && date.getFullYear() === previousYear;
  });

  const previousMonthVolume = previousMonthTransactions.reduce((sum, transaction) => {
    return sum + (parseFloat(transaction.quantity) || 0);
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
}

// ES6 Named Exports (for import statements)
export {
  formatKoreanNumber,
  formatKoreanCurrency,
  formatKoreanPercent,
  formatKoreanDate,
  colorSchemes,
  getChartDefaults,
  getRechartsTheme,
  getTransactionTypeColor,
  getStockLevelColor,
  transformStockData,
  transformTransactionData,
  exportChartAsImage,
  printChart,
  debounce,
  throttle,
  animationPresets,
  calculateKPIs
};

// Default export (for default import)
const chartUtils = {
  formatKoreanNumber,
  formatKoreanCurrency,
  formatKoreanPercent,
  formatKoreanDate,
  colorSchemes,
  getChartDefaults,
  getRechartsTheme,
  getTransactionTypeColor,
  getStockLevelColor,
  transformStockData,
  transformTransactionData,
  exportChartAsImage,
  printChart,
  debounce,
  throttle,
  animationPresets,
  calculateKPIs
};

export default chartUtils;

// CommonJS compatibility for API routes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = chartUtils;

  // Also expose individual exports for CommonJS
  Object.assign(module.exports, {
    formatKoreanNumber,
    formatKoreanCurrency,
    formatKoreanPercent,
    formatKoreanDate,
    colorSchemes,
    getChartDefaults,
    getRechartsTheme,
    getTransactionTypeColor,
    getStockLevelColor,
    transformStockData,
    transformTransactionData,
    exportChartAsImage,
    printChart,
    debounce,
    throttle,
    animationPresets,
    calculateKPIs
  });
}