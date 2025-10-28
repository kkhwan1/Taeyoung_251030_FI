/**
 * Mock Dashboard Data
 * 3-6 months of test data for dashboard testing
 */

// Generate 6 months of trend data
const generateMonthlyTrends = () => {
  const months = [];
  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    months.push({
      month: monthKey,
      date: date,
      총재고량: 45000 + Math.random() * 20000,
      입고: 3800 + Math.random() * 1500,
      출고: 3200 + Math.random() * 1200,
      생산: 800 + Math.random() * 600,
      조정: Math.random() * 200,
      재고가치: 850000000 + Math.random() * 200000000,
      회전율: 0.15 + Math.random() * 0.15,
      순증감: 600 + Math.random() * 800,
      거래건수: 120 + Math.random() * 50,
      거래금액: 150000000 + Math.random() * 50000000
    });
  }
  
  return months;
};

// Generate category stock data
const generateCategoryStock = () => {
  const categories = [
    { name: '원자재', current: 85000, min: 60000, safety: 70000 },
    { name: '부자재', current: 62000, min: 45000, safety: 50000 },
    { name: '제품', current: 92000, min: 70000, safety: 75000 },
    { name: '반제품', current: 48000, min: 35000, safety: 40000 },
    { name: '상품', current: 75000, min: 55000, safety: 60000 }
  ];
  
  return categories.map(cat => ({
    category: cat.name,
    현재고: cat.current,
    최소재고: cat.min,
    안전재고: cat.safety,
    최대재고: cat.current * 1.5,
    품목수: Math.floor(200 + Math.random() * 100),
    재고가치: cat.current * (15000 + Math.random() * 5000),
    회전율: 0.10 + Math.random() * 0.20,
    부족품목수: Math.floor(Math.random() * 5),
    과재고품목수: Math.floor(Math.random() * 10),
    재고비율: cat.current / cat.safety
  }));
};

// Generate transaction distribution
const generateTransactionDistribution = () => {
  return [
    {
      type: '입고',
      count: 1520,
      volume: 48500,
      value: 920000000,
      percentage: 35,
      items: 450,
      avgPerTransaction: 32,
      companies: 45
    },
    {
      type: '출고',
      count: 1380,
      volume: 42500,
      value: 810000000,
      percentage: 32,
      items: 420,
      avgPerTransaction: 31,
      companies: 52
    },
    {
      type: '생산',
      count: 720,
      volume: 18500,
      value: 350000000,
      percentage: 17,
      items: 180,
      avgPerTransaction: 26,
      companies: 12
    },
    {
      type: '조정',
      count: 450,
      volume: 3200,
      value: 60000000,
      percentage: 10,
      items: 95,
      avgPerTransaction: 7,
      companies: 8
    },
    {
      type: '반품',
      count: 280,
      volume: 8500,
      value: 160000000,
      percentage: 6,
      items: 65,
      avgPerTransaction: 30,
      companies: 15
    }
  ];
};

// Generate top items
const generateTopItems = () => {
  const items = [
    { name: '전선 하네스', code: 'WL-001', category: '제품', stock: 15200, price: 3500 },
    { name: '커넥터 A-100', code: 'CT-100', category: '부자재', stock: 12800, price: 2800 },
    { name: 'PCB 보드', code: 'PCB-200', category: '반제품', stock: 11200, price: 4200 },
    { name: '모터 드라이버', code: 'MD-500', category: '제품', stock: 9800, price: 5500 },
    { name: '센서 모듈', code: 'SM-300', category: '제품', stock: 9200, price: 4800 },
    { name: '전원 어댑터', code: 'PA-150', category: '제품', stock: 8500, price: 3800 },
    { name: '배터리 팩', code: 'BP-200', category: '제품', stock: 7200, price: 12000 },
    { name: 'LED 모듈', code: 'LED-100', category: '부자재', stock: 6800, price: 2200 },
    { name: '플라스틱 케이스', code: 'PC-300', category: '원자재', stock: 5500, price: 1500 },
    { name: '스위치 부품', code: 'SW-400', category: '부자재', stock: 4800, price: 1900 }
  ];
  
  return items.map((item, index) => ({
    item_id: String(1000 + index),
    item_name: item.name,
    item_code: item.code,
    category: item.category,
    currentStock: item.stock,
    minimumStock: item.stock * 0.3,
    safetyStock: item.stock * 0.4,
    unitPrice: item.price,
    totalValue: item.stock * item.price,
    monthlyVolume: item.stock * 0.2,
    turnoverRate: 0.15 + Math.random() * 0.15,
    lastTransactionDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    supplier: `공급업체 ${String.fromCharCode(65 + index)}`,
    stockStatus: item.stock > item.stock * 0.4 ? 'normal' : 'low' as 'normal' | 'low',
    rank: index + 1
  }));
};

// Generate low stock alerts
const generateLowStockAlerts = () => {
  return [
    {
      item_id: '1005',
      item_name: '커넥터 A-100',
      item_code: 'CT-100',
      category: '부자재',
      currentStock: 150,
      minimumStock: 500,
      safetyStock: 600,
      averageConsumption: 180,
      stockoutRisk: 85,
      daysUntilStockout: 5,
      lastRestockDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      supplier: '공급업체 A',
      leadTime: 7,
      priority: 'critical' as const,
      alertCreatedAt: new Date(),
      autoReorderEnabled: true,
      estimatedCost: 420000
    },
    {
      item_id: '1008',
      item_name: 'LED 모듈',
      item_code: 'LED-100',
      category: '부자재',
      currentStock: 280,
      minimumStock: 600,
      safetyStock: 800,
      averageConsumption: 120,
      stockoutRisk: 70,
      daysUntilStockout: 8,
      lastRestockDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      supplier: '공급업체 D',
      leadTime: 10,
      priority: 'high' as const,
      alertCreatedAt: new Date(),
      autoReorderEnabled: true,
      estimatedCost: 560000
    },
    {
      item_id: '1009',
      item_name: '플라스틱 케이스',
      item_code: 'PC-300',
      category: '원자재',
      currentStock: 420,
      minimumStock: 800,
      safetyStock: 1000,
      averageConsumption: 95,
      stockoutRisk: 55,
      daysUntilStockout: 12,
      lastRestockDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      supplier: '공급업체 E',
      leadTime: 14,
      priority: 'medium' as const,
      alertCreatedAt: new Date(),
      autoReorderEnabled: false,
      estimatedCost: 630000
    }
  ];
};

// Generate recent transactions
const generateRecentTransactions = () => {
  const transactions = [];
  const types = ['입고', '출고', '생산', '조정', '반품'];
  const items = ['전선 하네스', '커넥터 A-100', 'PCB 보드', '모터 드라이버', '센서 모듈'];
  
  for (let i = 0; i < 10; i++) {
    transactions.push({
      transaction_id: 10000 + i,
      transaction_type: types[Math.floor(Math.random() * types.length)],
      item_name: items[Math.floor(Math.random() * items.length)],
      quantity: Math.floor(50 + Math.random() * 200),
      transaction_date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: Math.random() > 0.2 ? '완료' : '대기'
    });
  }
  
  return transactions;
};

export const mockDashboardData = {
  stats: {
    totalItems: 1247,
    activeCompanies: 102,
    totalStockValue: 12500000000,
    monthlyVolume: 3580,
    lowStockItems: 3,
    volumeChange: 12.5,
    trends: {
      items: 45,
      companies: 8,
      volume: 520,
      lowStock: 2,
      stockValue: 850000000
    }
  },
  charts: {
    monthlyTrends: generateMonthlyTrends(),
    categoryStocks: generateCategoryStock(),
    transactionDistribution: generateTransactionDistribution(),
    stocks: generateTopItems()
  },
  alerts: {
    lowStockItems: generateLowStockAlerts(),
    recentTransactions: generateRecentTransactions()
  },
  lastUpdated: new Date()
};
