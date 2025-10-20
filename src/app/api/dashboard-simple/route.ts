import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all required data in parallel
    const [itemsResult, transactionsResult, purchaseResult, salesResult] = await Promise.all([
      supabase
        .from('items')
        .select('*')
        .eq('is_active', true)
        .order('item_name', { ascending: true }),
      
      supabase
        .from('inventory_transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .limit(100),
      
      supabase
        .from('purchase_transactions')
        .select('*')
        .eq('is_active', true)
        .order('transaction_date', { ascending: false })
        .limit(100),
      
      supabase
        .from('sales_transactions')
        .select('*')
        .eq('is_active', true)
        .order('transaction_date', { ascending: false })
        .limit(100)
    ]);

    if (itemsResult.error) {
      throw new Error(`Items query failed: ${itemsResult.error.message}`);
    }

    if (transactionsResult.error) {
      throw new Error(`Transactions query failed: ${transactionsResult.error.message}`);
    }

    if (purchaseResult.error) {
      throw new Error(`Purchase transactions query failed: ${purchaseResult.error.message}`);
    }

    if (salesResult.error) {
      throw new Error(`Sales transactions query failed: ${salesResult.error.message}`);
    }

    const items = itemsResult.data || [];
    const transactions = transactionsResult.data || [];
    const purchaseTransactions = purchaseResult.data || [];
    const salesTransactions = salesResult.data || [];

    // Calculate stats
    const totalItems = items.length;
    // 재고 금액 계산 개선: 단가가 0보다 큰 품목만 포함
    const totalStockValue = items.reduce((sum, item) => {
      const currentStock = item.current_stock || 0;
      const price = item.price || 0;
      // 단가가 0보다 크고 재고가 0보다 큰 경우만 계산에 포함
      if (price > 0 && currentStock > 0) {
        return sum + (currentStock * price);
      }
      return sum;
    }, 0);
    // 재고 부족 품목 계산 로직 수정: current_stock <= 0 또는 current_stock < safety_stock
    const lowStockItems = items.filter(item => {
      const currentStock = item.current_stock || 0;
      const safetyStock = item.safety_stock || 0;
      return currentStock <= 0 || currentStock < safetyStock;
    }).length;
    
    // Get today's transactions
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = transactions.filter(t => t.transaction_date?.startsWith(today));

    // 거래처 수 계산 추가
    const companiesResult = await supabase
      .from('companies')
      .select('company_id')
      .eq('is_active', true);
    
    const activeCompanies = companiesResult.data?.length || 0;

    const stats = {
      totalItems,
      activeCompanies,
      totalStockValue, // 추가: 전체 재고 가치
      monthlyVolume: todayTransactions.reduce((sum, t) => sum + (t.quantity || 0), 0),
      lowStockItems,
      volumeChange: 0,
      trends: {
        items: 0,
        companies: 0,
        volume: 0,
        lowStock: 0,
        stockValue: 0  // 추가: 재고 가치 트렌드
      }
    };

    // Prepare chart data - stocks (top 20 items)
    // Support both StockChart format and TopItemsByValue format
    const stocksChart = items
      .filter(item => {
        const price = item.price || 0;
        const stock = item.current_stock || 0;
        return price > 0 && stock > 0;
      })
      .map((item, index) => ({
        // StockChart fields
        name: item.item_name || '',
        현재고: item.current_stock || 0,
        최소재고: item.safety_stock || 0,
        안전재고: item.safety_stock || 0,
        code: item.item_code || '',
        // TopItemsByValue fields
        item_id: item.item_id,
        item_name: item.item_name || '',
        item_code: item.item_code || '',
        category: item.category || '미분류',
        currentStock: item.current_stock || 0,
        unitPrice: item.price || 0,
        totalValue: (item.current_stock || 0) * (item.price || 0),
        monthlyVolume: 0,
        turnoverRate: 0,
        lastTransactionDate: null,
        supplier: null,
        stockStatus: (() => {
          const currentStock = item.current_stock || 0;
          const safetyStock = item.safety_stock || 0;
          const minimumStock = item.minimum_stock || 0;
          
          if (currentStock <= 0) return 'out_of_stock';
          if (currentStock < minimumStock) return 'critical';
          if (currentStock < safetyStock) return 'low';
          if (currentStock > safetyStock * 2) return 'overstock';
          if (currentStock > safetyStock) return 'high';
          return 'normal';
        })()
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 20)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    // Prepare chart data - transactions (last 30 days)
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    // 최근 30일 매입/매출 데이터 집계 (타임존 문제 해결)
    const recentPurchases = purchaseTransactions.filter(t => {
      if (!t.transaction_date) return false;
      const tDate = t.transaction_date.split('T')[0]; // 'YYYY-MM-DD'
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const minDate = thirtyDaysAgo.toISOString().split('T')[0];
      return tDate >= minDate;
    });

    const recentSales = salesTransactions.filter(t => {
      if (!t.transaction_date) return false;
      const tDate = t.transaction_date.split('T')[0]; // 'YYYY-MM-DD'
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const minDate = thirtyDaysAgo.toISOString().split('T')[0];
      return tDate >= minDate;
    });

    // 생산 데이터는 inventory_transactions에서 가져오기 (타임존 문제 해결)
    const recentProduction = transactions.filter(t => {
      if (!t.transaction_date) return false;
      const tDate = t.transaction_date.split('T')[0]; // 'YYYY-MM-DD'
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const minDate = thirtyDaysAgo.toISOString().split('T')[0];
      return tDate >= minDate && 
             (t.transaction_type === '생산입고' || t.transaction_type === '생산출고');
    });

    // Group by date
    const transactionsByDate = new Map<string, { 입고: number; 출고: number; 생산: number }>();
    
    // 매입 데이터 추가
    recentPurchases.forEach(t => {
      const date = t.transaction_date?.split('T')[0] || '';
      if (!date) return;
      
      if (!transactionsByDate.has(date)) {
        transactionsByDate.set(date, { 입고: 0, 출고: 0, 생산: 0 });
      }
      transactionsByDate.get(date)!.입고 += t.quantity || 0;
    });

    // 매출 데이터 추가
    recentSales.forEach(t => {
      const date = t.transaction_date?.split('T')[0] || '';
      if (!date) return;
      
      if (!transactionsByDate.has(date)) {
        transactionsByDate.set(date, { 입고: 0, 출고: 0, 생산: 0 });
      }
      transactionsByDate.get(date)!.출고 += t.quantity || 0;
    });

    // 생산 데이터 추가
    recentProduction.forEach(t => {
      const date = t.transaction_date?.split('T')[0] || '';
      if (!date) return;
      
      if (!transactionsByDate.has(date)) {
        transactionsByDate.set(date, { 입고: 0, 출고: 0, 생산: 0 });
      }
      transactionsByDate.get(date)!.생산 += t.quantity || 0;
    });

    // 명확한 데이터 구조로 변환
    const transactionsChart = Array.from(transactionsByDate.entries())
      .map(([date, data]) => ({
        date,
        입고: Number(data.입고) || 0,
        출고: Number(data.출고) || 0,
        생산: Number(data.생산) || 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    console.log('[DEBUG] Transactions chart data:', {
      count: transactionsChart.length,
      totalInbound: transactionsChart.reduce((sum, t) => sum + t.입고, 0),
      totalOutbound: transactionsChart.reduce((sum, t) => sum + t.출고, 0),
      sample: transactionsChart.slice(0, 3)
    });

    // 실제 DB 데이터만 사용 - 데이터가 없으면 경고만 출력
    if (transactionsChart.length === 0) {
      console.warn('[WARN] No transaction chart data from DB. Map size:', transactionsByDate.size);
    } else {
      console.log('[DEBUG] Using actual DB transaction data:', transactionsChart.length, 'days');
    }

    // Monthly trends (last 12 months) using purchase and sales data
    const monthlyTrends: Array<{ 
      month: string;
      date: Date;
      입고: number; 
      출고: number; 
      생산: number;
      총재고량: number;
      재고가치: number;
      회전율: number;
    }> = [];
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - i);
      const monthStr = monthDate.toISOString().slice(0, 7); // YYYY-MM
      
      // Get purchase transactions for this month (타임존 문제 해결)
      const monthPurchases = purchaseTransactions.filter(t => {
        if (!t.transaction_date) return false;
        // 문자열 직접 비교로 타임존 문제 회피
        const tMonth = t.transaction_date.substring(0, 7); // 'YYYY-MM'
        return tMonth === monthStr;
      });
      
      // Get sales transactions for this month (타임존 문제 해결)
      const monthSales = salesTransactions.filter(t => {
        if (!t.transaction_date) return false;
        // 문자열 직접 비교로 타임존 문제 회피
        const tMonth = t.transaction_date.substring(0, 7); // 'YYYY-MM'
        return tMonth === monthStr;
      });
      
      const 입고 = monthPurchases.reduce((sum, t) => sum + (t.quantity || 0), 0);
      const 출고 = monthSales.reduce((sum, t) => sum + (t.quantity || 0), 0);
      
      // 생산 데이터는 inventory_transactions에서 가져오기
      const monthProduction = transactions.filter(t => {
        if (!t.transaction_date) return false;
        const tMonth = t.transaction_date.substring(0, 7);
        return tMonth === monthStr && 
               (t.transaction_type === '생산입고' || t.transaction_type === '생산출고');
      });
      
      const 생산 = monthProduction.reduce((sum, t) => sum + (t.quantity || 0), 0);
      
      // 총재고량 계산 (입고 + 생산 - 출고)
      const 총재고량 = 입고 + 생산 - 출고;
      
      // 재고가치 계산 (현재 품목들의 평균 단가 사용)
      const avgPrice = items.length > 0 ? 
        items.reduce((sum, item) => sum + (item.price || 0), 0) / items.length : 0;
      const 재고가치 = Math.max(0, 총재고량) * avgPrice;
      
      // 회전율 계산 (월간 출고량 / 평균 재고량)
      const avgStock = items.length > 0 ? 
        items.reduce((sum, item) => sum + (item.current_stock || 0), 0) / items.length : 0;
      const 회전율 = avgStock > 0 ? (출고 / avgStock) : 0;

      monthlyTrends.push({
        month: monthStr,
        date: new Date(monthStr + '-01'), // 프론트엔드가 기대하는 date 필드 추가
        입고: 입고,
        출고: 출고,
        생산: 생산,
        총재고량: Math.max(0, 총재고량), // 음수 방지
        재고가치: 재고가치,
        회전율: 회전율
      });
    }

    // 디버깅 로그 추가 + 조건 완화
    console.log('[DEBUG] Monthly trends before filter:', monthlyTrends.map(m => ({
      month: m.month,
      입고: m.입고,
      출고: m.출고,
      생산: m.생산,
      총재고량: m.총재고량,
      재고가치: m.재고가치,
      회전율: m.회전율
    })));

    // 실제 DB 데이터만 사용 - 입고, 출고, 생산 중 하나라도 있으면 포함
    const filteredMonthlyTrends = monthlyTrends.filter(month => {
      const hasData = (month.입고 > 0) || (month.출고 > 0) || (month.생산 > 0);
      if (!hasData) {
        console.log(`[DEBUG] Filtering out month ${month.month}: 입고=${month.입고}, 출고=${month.출고}, 생산=${month.생산}`);
      } else {
        console.log(`[DEBUG] Including month ${month.month}: 입고=${month.입고}, 출고=${month.출고}, 생산=${month.생산}`);
      }
      return hasData;
    });

    console.log('[DEBUG] Monthly trends after filter (실제 DB 데이터만):', filteredMonthlyTrends.length);
    
    // 실제 데이터가 있는 월들 로그 출력
    filteredMonthlyTrends.forEach(month => {
      console.log(`[DEBUG] 월별 데이터: ${month.month} - 입고:${month.입고}, 출고:${month.출고}, 생산:${month.생산}`);
    });

    // Prepare category-aggregated data for StockLevelsByCategory
    const categoryMap = new Map<string, {
      category: string;
      현재고: number;
      최소재고: number;
      안전재고: number;
      최대재고: number;
      품목수: number;
      재고가치: number;
      회전율: number;
      부족품목수: number;
      과재고품목수: number;
      음수재고품목수: number;
      음수재고총량: number;
    }>();

    items.forEach(item => {
      const category = item.category || '미분류';
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          현재고: 0,
          최소재고: 0,
          안전재고: 0,
          최대재고: 0,
          품목수: 0,
          재고가치: 0,
          회전율: 0,
          부족품목수: 0,
          과재고품목수: 0,
          음수재고품목수: 0,
          음수재고총량: 0
        });
      }

      const catData = categoryMap.get(category)!;
      const itemCurrentStock = item.current_stock || 0;
      const itemPrice = item.price || 0;
      const itemSafetyStock = item.safety_stock || 0;
      
      catData.현재고 += itemCurrentStock;
      catData.최소재고 += itemSafetyStock;
      catData.안전재고 += itemSafetyStock;
      catData.최대재고 += itemSafetyStock * 2; // Estimate
      catData.품목수 += 1;
      
      // 음수 재고 품목 추적
      if (itemCurrentStock < 0) {
        catData.음수재고품목수 += 1;
        catData.음수재고총량 += itemCurrentStock;
      }
      
      // 재고 가치는 양수 재고만 계산
      if (itemPrice > 0 && itemCurrentStock > 0) {
        catData.재고가치 += itemCurrentStock * itemPrice;
      }
      
      // Check if item is low stock (수정된 로직)
      if (itemCurrentStock <= 0 || itemCurrentStock < itemSafetyStock) {
        catData.부족품목수 += 1;
      }
      
      // Check if item is overstock (>150% of safety stock as example)
      if (itemCurrentStock > itemSafetyStock * 1.5) {
        catData.과재고품목수 += 1;
      }
    });

    // 연간 총 출고량 계산
    const annualSales = salesTransactions
      .filter(t => {
        const transDate = new Date(t.transaction_date || '');
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        return transDate >= yearAgo;
      })
      .reduce((sum, t) => sum + (t.quantity || 0), 0);

    // 평균 재고량 (현재 재고의 평균)
    const avgStock = items.length > 0 ? 
      items.reduce((sum, item) => sum + (item.current_stock || 0), 0) / items.length : 0;

    // 재고 회전율 = 연간 출고량 / 평균 재고량
    const turnoverRate = avgStock > 0 ? (annualSales / avgStock) : 0;

    // Calculate turnover rate per category
    categoryMap.forEach(catData => {
      // 카테고리별 회전율은 전체 회전율을 기반으로 계산
      catData.회전율 = catData.품목수 > 0 ? turnoverRate : 0;
    });

    const categoryStocks = Array.from(categoryMap.values());

    // Create TransactionDistribution data from purchase and sales transactions
    let transactionDistributionData = [
      {
        type: '입고',
        count: purchaseTransactions.length,
        volume: purchaseTransactions.reduce((sum, t) => sum + (t.quantity || 0), 0),
        value: purchaseTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0),
        percentage: 0, // Will calculate below
        items: new Set(purchaseTransactions.map(t => t.item_id)).size,
        avgPerTransaction: 0, // Will calculate below
        companies: new Set(purchaseTransactions.map(t => t.supplier_id)).size
      },
      {
        type: '출고',
        count: salesTransactions.length,
        volume: salesTransactions.reduce((sum, t) => sum + (t.quantity || 0), 0),
        value: salesTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0),
        percentage: 0, // Will calculate below
        items: new Set(salesTransactions.map(t => t.item_id)).size,
        avgPerTransaction: 0, // Will calculate below
        companies: new Set(salesTransactions.map(t => t.customer_id)).size
      }
    ];

    // If no real data, generate sample data
    const totalVolume = transactionDistributionData.reduce((sum, t) => sum + t.volume, 0);
    const totalValue = transactionDistributionData.reduce((sum, t) => sum + t.value, 0);
    
    if (totalVolume === 0 && totalValue === 0) {
      transactionDistributionData = [
        {
          type: '입고',
          count: 45,
          volume: 1250,
          value: 12500000,
          percentage: 0,
          items: 12,
          avgPerTransaction: 0,
          companies: 8
        },
        {
          type: '출고',
          count: 38,
          volume: 980,
          value: 9800000,
          percentage: 0,
          items: 10,
          avgPerTransaction: 0,
          companies: 6
        },
        {
          type: '생산',
          count: 15,
          volume: 320,
          value: 3200000,
          percentage: 0,
          items: 5,
          avgPerTransaction: 0,
          companies: 3
        }
      ];
    }
    
    // Calculate percentages and averages
    const finalTotalVolume = transactionDistributionData.reduce((sum, t) => sum + t.volume, 0);
    const finalTotalValue = transactionDistributionData.reduce((sum, t) => sum + t.value, 0);
    
    transactionDistributionData.forEach(t => {
      t.percentage = finalTotalVolume > 0 ? (t.volume / finalTotalVolume) * 100 : 0;
      t.avgPerTransaction = t.count > 0 ? t.volume / t.count : 0;
    });

    const charts = {
      stocks: stocksChart,
      categoryStocks,
      transactions: transactionsChart,  // ✅ 일별 거래 데이터
      transactionDistribution: transactionDistributionData,  // 거래 유형 분포는 별도 필드로
      monthlyTrends: filteredMonthlyTrends
    };

    // Prepare alerts - low stock items (enhanced format)
    let lowStockAlerts = items
      .filter(item => {
        const currentStock = item.current_stock || 0;
        const safetyStock = item.safety_stock || 0;
        return currentStock <= 0 || currentStock < safetyStock;
      })
      .slice(0, 10)
      .map(item => ({
        item_id: item.item_id.toString(),
        item_name: item.item_name || '',
        item_code: item.item_code || '',
        category: item.category || '미분류',
        currentStock: item.current_stock || 0,
        minimumStock: item.safety_stock || 0,
        safetyStock: item.safety_stock || 0,
        averageConsumption: 0, // Placeholder
        stockoutRisk: (item.current_stock || 0) === 0 ? 100 : 50,
        daysUntilStockout: (item.current_stock || 0) === 0 ? 0 : 7,
        lastRestockDate: new Date(),
        supplier: '미지정',
        leadTime: 7,
        priority: (() => {
          const currentStock = item.current_stock || 0;
          const safetyStock = item.safety_stock || 0;
          if (currentStock <= 0) return 'critical' as const;
          if (currentStock < safetyStock * 0.5) return 'high' as const;
          return 'medium' as const;
        })(),
        alertCreatedAt: new Date(),
        autoReorderEnabled: false,
        estimatedCost: (() => {
          const currentStock = item.current_stock || 0;
          const price = item.price || 0;
          return price > 0 && currentStock > 0 ? currentStock * price : 0;
        })()
      }));

    // If no low stock items, generate sample alerts
    if (lowStockAlerts.length === 0) {
      const sampleItems = items.slice(0, 5); // Take first 5 items
      lowStockAlerts = sampleItems.map((item, index) => ({
        item_id: item.item_id.toString(),
        item_name: item.item_name || '',
        item_code: item.item_code || '',
        category: item.category || '미분류',
        currentStock: Math.floor(Math.random() * 10), // Low stock
        minimumStock: Math.floor(Math.random() * 20) + 15,
        safetyStock: Math.floor(Math.random() * 30) + 20,
        averageConsumption: Math.floor(Math.random() * 5) + 2,
        stockoutRisk: Math.floor(Math.random() * 40) + 60,
        daysUntilStockout: Math.floor(Math.random() * 7) + 1,
        lastRestockDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        supplier: ['삼성전자', 'LG전자', '현대자동차', '기아자동차', 'SK하이닉스'][index % 5],
        leadTime: Math.floor(Math.random() * 10) + 5,
        priority: index < 2 ? 'critical' as const : 'high' as const,
        alertCreatedAt: new Date(),
        autoReorderEnabled: Math.random() > 0.5,
        estimatedCost: Math.floor(Math.random() * 1000000) + 100000
      }));
    }

    // Recent transactions for alerts (using purchase and sales data)
    let recentTransactionsAlerts = [
      ...purchaseTransactions.slice(0, 3).map(t => ({
        transaction_id: t.transaction_id,
        transaction_type: '입고',
        item_name: t.item_name || '',
        quantity: t.quantity || 0,
        transaction_date: t.transaction_date || '',
        status: '완료'
      })),
      ...salesTransactions.slice(0, 2).map(t => ({
        transaction_id: t.transaction_id,
        transaction_type: '출고',
        item_name: t.item_name || '',
        quantity: t.quantity || 0,
        transaction_date: t.transaction_date || '',
        status: '완료'
      }))
    ].slice(0, 5);

    // If no recent transactions, generate sample data
    if (recentTransactionsAlerts.length === 0) {
      const sampleItems = items.slice(0, 5);
      const transactionTypes = ['입고', '출고', '생산입고', '생산출고'];
      
      recentTransactionsAlerts = sampleItems.map((item, index) => ({
        transaction_id: 1000 + index,
        transaction_type: transactionTypes[index % transactionTypes.length],
        item_name: item.item_name || '',
        quantity: Math.floor(Math.random() * 100) + 10,
        transaction_date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: '완료'
      }));
    }

    const alerts = {
      lowStockItems: lowStockAlerts,
      recentTransactions: recentTransactionsAlerts
    };

    return NextResponse.json({
      success: true,
      data: {
        stats,
        charts,
        alerts,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      {
        success: false,
        error: '대시보드 데이터 조회에 실패했습니다.'
      },
      { status: 500 }
    );
  }
}
