import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dashboardCache } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { mockDashboardData } from '@/lib/mock-dashboard-data';

export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Mock 데이터 사용 안함 - 실제 DB 데이터 사용
    const useMockData = false; // process.env.USE_MOCK_DATA === 'true';
    
    if (useMockData) {
      logger.info('Using mock dashboard data');
      return NextResponse.json({
        success: true,
        data: mockDashboardData,
        fromCache: false,
        isMockData: true,
        lastUpdated: new Date().toISOString()
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    // 캐시 키 생성 (날짜별로 캐시)
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `dashboard_simple_${today}`;
    
    // 캐시 확인
    const cached = dashboardCache.get(cacheKey);
    if (cached) {
      logger.info('Dashboard cache hit', { cacheKey, duration: Date.now() - startTime });
      return NextResponse.json({ 
        success: true, 
        data: cached, 
        fromCache: true,
        lastUpdated: new Date().toISOString()
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        }
      });
    }

    logger.info('Dashboard cache miss, fetching from DB', { cacheKey });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 최적화된 데이터 조회 - 집계 쿼리 사용
    const [itemsResult, companiesResult, statsResult, lowStockResult, categoryResult, transactionsResult, monthlyTrendsResult] = await Promise.all([
      // 품목 데이터 (차트용)
      supabase
        .from('items')
        .select('item_id, item_code, item_name, category, current_stock, price, safety_stock')
        .eq('is_active', true)
        .order('current_stock', { ascending: false })
        .limit(20),
      
      // 거래처 수
      supabase
        .from('companies')
        .select('company_id', { count: 'exact' })
        .eq('is_active', true),
      
      // 기본 통계 (집계 쿼리)
      supabase
        .from('items')
        .select('current_stock, price')
        .eq('is_active', true)
        .not('current_stock', 'is', null)
        .not('price', 'is', null),
      
      // 재고 부족 품목 수 (더 간단한 쿼리로 수정)
      supabase
        .from('items')
        .select('item_id', { count: 'exact' })
        .eq('is_active', true)
        .lte('current_stock', 0),

      // 카테고리별 재고 현황
      supabase
        .from('items')
        .select('category, current_stock, price')
        .eq('is_active', true)
        .not('current_stock', 'is', null)
        .not('price', 'is', null),

      // 최근 거래 데이터 (월별 동향용)
      supabase
        .from('inventory_transactions')
        .select('transaction_type, quantity, transaction_date, unit_price')
        .gte('transaction_date', new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0])
        .order('transaction_date', { ascending: false })
        .limit(100),
      
      // 월별 동향 데이터
      supabase
        .from('inventory_transactions')
        .select('transaction_type, quantity, transaction_date, unit_price')
        .gte('transaction_date', new Date(new Date().setMonth(new Date().getMonth() - 12)).toISOString().split('T')[0])
        .order('transaction_date', { ascending: true })
    ]);

    // 에러 처리
    if (itemsResult.error) {
      throw new Error(`Items query failed: ${itemsResult.error.message}`);
    }
    if (companiesResult.error) {
      throw new Error(`Companies query failed: ${companiesResult.error.message}`);
    }
    if (statsResult.error) {
      throw new Error(`Stats query failed: ${statsResult.error.message}`);
    }
    if (lowStockResult.error) {
      throw new Error(`Low stock query failed: ${lowStockResult.error.message}`);
    }
    if (categoryResult.error) {
      throw new Error(`Category query failed: ${categoryResult.error.message}`);
    }
    if (transactionsResult.error) {
      throw new Error(`Transactions query failed: ${transactionsResult.error.message}`);
    }
    if (monthlyTrendsResult.error) {
      throw new Error(`Monthly trends query failed: ${monthlyTrendsResult.error.message}`);
    }

    const items = itemsResult.data || [];
    const companies = companiesResult.data || [];
    const statsData = statsResult.data || [];
    const lowStockCount = lowStockResult.count || 0;
    const categoryData = categoryResult.data || [];
    const transactionsData = transactionsResult.data || [];
    const monthlyTrendsData = monthlyTrendsResult.data || [];

    // 최적화된 통계 계산
    const totalItems = items.length;
    const activeCompanies = companies.length;
    
    // 재고 가치 계산 (서버에서 집계)
    const totalStockValue = statsData.reduce((sum, item) => {
      const currentStock = item.current_stock || 0;
      const price = item.price || 0;
        return sum + (currentStock * price);
    }, 0);

    const stats = {
      totalItems,
      activeCompanies,
      totalStockValue,
      monthlyVolume: 0,
      lowStockItems: lowStockCount,
      volumeChange: 0,
      trends: {
        items: 0,
        companies: 0,
        volume: 0,
        lowStock: 0,
        stockValue: 0
      }
    };

    // 최적화된 차트 데이터 생성 (이미 정렬된 데이터 사용)
    const stocksChart = items.map((item, index) => ({
        name: item.item_name || '',
        현재고: item.current_stock || 0,
      최소재고: Number(item.safety_stock) || 0,
      안전재고: Number(item.safety_stock) || 0,
        code: item.item_code || '',
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
      stockStatus: 'normal',
        rank: index + 1
      }));

    // 카테고리별 재고 현황 생성
    const categoryMap = new Map();
    categoryData.forEach(item => {
      const category = item.category || '미분류';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          totalStock: 0,
          totalValue: 0,
          itemCount: 0
        });
      }
      const categoryData = categoryMap.get(category);
      categoryData.totalStock += item.current_stock || 0;
      categoryData.totalValue += (item.current_stock || 0) * (item.price || 0);
      categoryData.itemCount += 1;
    });

    const categoryStocks = Array.from(categoryMap.values()).map(item => ({
      category: item.category,
      현재고: item.totalStock,
      최소재고: 0, // Not available in current data
      안전재고: 0, // Not available in current data
      최대재고: 0, // Not available in current data
      품목수: item.itemCount,
      재고가치: item.totalValue,
      회전율: 0, // Not available in current data
      부족품목수: 0, // Not available in current data
      과재고품목수: 0 // Not available in current data
    }));

    // 거래 유형 분포 생성
    const transactionTypeMap = new Map();
    transactionsData.forEach(transaction => {
      const type = transaction.transaction_type || 'unknown';
      if (!transactionTypeMap.has(type)) {
        transactionTypeMap.set(type, {
          type,
          count: 0,
          quantity: 0,
          amount: 0
        });
      }
      const typeData = transactionTypeMap.get(type);
      typeData.count += 1;
      typeData.quantity += transaction.quantity || 0;
      typeData.amount += (transaction.quantity || 0) * (transaction.unit_price || 0);
    });

    const transactionDistribution = Array.from(transactionTypeMap.values()).map(item => ({
      type: item.type,
      count: item.count,
      volume: item.quantity,
      value: item.amount,
      percentage: 0, // Will be calculated in frontend
      items: 0, // Not available in current data
      avgPerTransaction: item.count > 0 ? item.quantity / item.count : 0,
      companies: 0 // Not available in current data
    }));

    // 월별 동향 데이터 생성
    const monthlyMap = new Map();
    monthlyTrendsData.forEach(transaction => {
      const date = new Date(transaction.transaction_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: monthKey,
          입고: 0,
          출고: 0,
          생산: 0,
          조정: 0
        });
      }
      
      const monthData = monthlyMap.get(monthKey);
      const type = transaction.transaction_type || 'unknown';
      const quantity = transaction.quantity || 0;
      
      if (monthData.hasOwnProperty(type)) {
        monthData[type] += quantity;
      }
    });

    const monthlyTrends = Array.from(monthlyMap.values()).map(item => ({
      month: item.month,
      date: new Date(item.month + '-01'),
      총재고량: item.입고 + item.출고 + item.생산 + item.조정,
      입고: item.입고,
      출고: item.출고,
      생산: item.생산,
      조정: item.조정,
      순증감: item.입고 - item.출고 + item.생산 + item.조정,
      거래건수: 0, // Not available in current data
      거래금액: 0, // Not available in current data
      회전율: 0 // Not available in current data
    })).sort((a, b) => a.month.localeCompare(b.month));

    const charts = {
      stocks: stocksChart,
      categoryStocks,
      transactions: transactionsData.slice(0, 10), // 최근 10개 거래
      transactionDistribution,
      monthlyTrends
    };

    const alerts = {
      lowStockItems: [],
      recentTransactions: []
    };

    const responseData = {
      stats,
      charts,
      alerts
    };

    // 캐시에 저장 (5분 TTL)
    dashboardCache.set(cacheKey, responseData, 300);

    const duration = Date.now() - startTime;
    logger.info('Dashboard data fetched successfully', { duration, cacheKey });

    return NextResponse.json({
      success: true,
      data: {
        ...responseData,
        lastUpdated: new Date().toISOString()
      },
      fromCache: false
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error fetching dashboard data', error as Error, { duration });
    
    return NextResponse.json(
      {
        success: false,
        error: '대시보드 데이터 조회에 실패했습니다.',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}