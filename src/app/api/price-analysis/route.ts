// Phase P3 - 가격 분석 API (Trends + Comparisons)
// src/app/api/price-analysis/route.ts

import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/price-analysis?type=trends
 * 품목별 가격 추세 분석 (최근 12개월)
 * - 평균 인상률, 변동성 계산
 * - PostgreSQL LAG 윈도우 함수, STDDEV 집계
 *
 * GET /api/price-analysis?type=comparisons
 * 품목 간 가격 비교
 * - 카테고리별 평균 대비 편차
 * - Supplier별 가격 차이
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisType = searchParams.get('type') || 'trends';

    if (analysisType === 'trends') {
      return await getPriceTrends();
    } else if (analysisType === 'comparisons') {
      return await getPriceComparisons();
    } else {
      return NextResponse.json(
        {
          success: false,
          error: '유효하지 않은 분석 타입입니다. (trends 또는 comparisons)'
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[price-analysis] GET error:', error);
    return NextResponse.json(
      { success: false, error: '가격 분석 실패' },
      { status: 500 }
    );
  }
}

/**
 * Trends: 품목별 가격 추세 (최근 12개월)
 * Simplified version using Supabase client instead of complex CTEs
 */
async function getPriceTrends() {
  const { getSupabaseClient } = await import('@/lib/db-unified');
  const supabase = getSupabaseClient();

  // Get price history for last 12 months with item info
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data: priceHistory, error } = await supabase
    .from('item_price_history')
    .select(`
      item_id,
      price_month,
      unit_price,
      item:items(
        item_id,
        item_code,
        item_name,
        category,
        unit,
        is_active
      )
    `)
    .gte('price_month', twelveMonthsAgo.toISOString().split('T')[0])
    .order('item_id')
    .order('price_month', { ascending: false });

  if (error) {
    console.error('[price-analysis] Supabase error:', error);
    throw new Error(error.message);
  }

  if (!priceHistory || priceHistory.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        type: 'trends',
        items: [],
        summary: {
          totalItems: 0,
          avgChangeRate: 0,
          avgVolatility: 0
        }
      },
      generatedAt: new Date().toISOString()
    });
  }

  // Process data: group by item and calculate statistics
  const itemMap = new Map();

  for (const record of priceHistory) {
    const item = record.item as any;
    if (!item || !item.is_active) continue;

    const itemId = record.item_id;
    if (!itemMap.has(itemId)) {
      itemMap.set(itemId, {
        item_id: itemId,
        item_code: item.item_code,
        item_name: item.item_name,
        category: item.category,
        unit: item.unit,
        prices: []
      });
    }

    itemMap.get(itemId).prices.push({
      month: record.price_month,
      price: record.unit_price
    });
  }

  // Calculate statistics for each item
  const results = [];
  for (const [itemId, itemData] of itemMap) {
    const prices = itemData.prices.sort((a: any, b: any) =>
      new Date(b.month).getTime() - new Date(a.month).getTime()
    );

    if (prices.length === 0) continue;

    const latestPrice = prices[0].price;
    const latestMonth = prices[0].month;

    // Calculate average price
    const avgPrice = prices.reduce((sum: number, p: any) => sum + p.price, 0) / prices.length;

    // Calculate volatility (standard deviation)
    const variance = prices.reduce((sum: number, p: any) =>
      sum + Math.pow(p.price - avgPrice, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance);

    // Calculate month-over-month change rates
    const changeRates: number[] = [];
    for (let i = 0; i < prices.length - 1; i++) {
      const current = prices[i].price;
      const previous = prices[i + 1].price;
      if (previous > 0) {
        changeRates.push(((current - previous) / previous) * 100);
      }
    }

    const avgChangeRate = changeRates.length > 0
      ? changeRates.reduce((sum, rate) => sum + rate, 0) / changeRates.length
      : 0;

    results.push({
      item_id: itemId,
      item_code: itemData.item_code,
      item_name: itemData.item_name,
      category: itemData.category,
      unit: itemData.unit,
      latest_month: latestMonth,
      latest_price: latestPrice,
      avg_price: parseFloat(avgPrice.toFixed(2)),
      volatility: parseFloat(volatility.toFixed(2)),
      avg_change_rate_pct: parseFloat(avgChangeRate.toFixed(2)),
      data_points: prices.length
    });
  }

  // Sort by average change rate (descending)
  results.sort((a, b) => (b.avg_change_rate_pct || 0) - (a.avg_change_rate_pct || 0));

  // Calculate summary statistics
  const totalItems = results.length;
  const avgChangeRate = totalItems > 0
    ? results.reduce((sum, item) => sum + (item.avg_change_rate_pct || 0), 0) / totalItems
    : 0;
  const avgVolatility = totalItems > 0
    ? results.reduce((sum, item) => sum + (item.volatility || 0), 0) / totalItems
    : 0;

  return NextResponse.json({
    success: true,
    data: {
      type: 'trends',
      items: results,
      summary: {
        totalItems,
        avgChangeRate: parseFloat(avgChangeRate.toFixed(2)),
        avgVolatility: parseFloat(avgVolatility.toFixed(2))
      }
    },
    generatedAt: new Date().toISOString()
  });
}

/**
 * Comparisons: 품목 간 가격 비교
 * 카테고리별 평균 대비 편차, Supplier별 가격 차이
 * Simplified version using Supabase client instead of complex CTEs
 */
async function getPriceComparisons() {
  const { getSupabaseClient } = await import('@/lib/db-unified');
  const supabase = getSupabaseClient();

  // Step 1: Get all items with their latest prices
  const { data: priceHistory, error: priceError } = await supabase
    .from('item_price_history')
    .select('item_id, unit_price, price_month')
    .order('item_id')
    .order('price_month', { ascending: false });

  if (priceError) {
    console.error('[price-analysis] Price history error:', priceError);
    throw new Error(priceError.message);
  }

  // Get latest price per item
  const latestPrices = new Map();
  for (const record of priceHistory || []) {
    if (!latestPrices.has(record.item_id)) {
      latestPrices.set(record.item_id, {
        latest_price: record.unit_price,
        price_month: record.price_month
      });
    }
  }

  // Step 2: Get all active items with supplier info
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select(`
      item_id,
      item_code,
      item_name,
      category,
      unit,
      supplier_id,
      supplier:companies!supplier_id(company_name)
    `)
    .eq('is_active', true);

  if (itemsError) {
    console.error('[price-analysis] Items error:', itemsError);
    throw new Error(itemsError.message);
  }

  if (!items || items.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        type: 'comparisons',
        items: [],
        summary: {
          totalItems: 0,
          categoriesCount: 0,
          suppliersCount: 0
        }
      },
      generatedAt: new Date().toISOString()
    });
  }

  // Step 3: Calculate category statistics
  const categoryStats = new Map();
  const supplierStats = new Map();

  for (const item of items) {
    const latestPrice = latestPrices.get(item.item_id);
    if (!latestPrice) continue;

    // Category statistics
    if (item.category) {
      if (!categoryStats.has(item.category)) {
        categoryStats.set(item.category, {
          prices: [],
          item_count: 0
        });
      }
      const catStat = categoryStats.get(item.category);
      catStat.prices.push(latestPrice.latest_price);
      catStat.item_count++;
    }

    // Supplier statistics
    if (item.supplier_id) {
      const supplier = item.supplier as any;
      if (!supplierStats.has(item.supplier_id)) {
        supplierStats.set(item.supplier_id, {
          supplier_name: supplier?.company_name || null,
          prices: [],
          item_count: 0
        });
      }
      const suppStat = supplierStats.get(item.supplier_id);
      suppStat.prices.push(latestPrice.latest_price);
      suppStat.item_count++;
    }
  }

  // Calculate averages, mins, maxs for categories
  for (const [category, stats] of categoryStats) {
    const prices = stats.prices;
    stats.category_avg_price = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    stats.category_min_price = Math.min(...prices);
    stats.category_max_price = Math.max(...prices);
  }

  // Calculate averages, mins, maxs for suppliers
  for (const [supplierId, stats] of supplierStats) {
    const prices = stats.prices;
    stats.supplier_avg_price = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    stats.supplier_min_price = Math.min(...prices);
    stats.supplier_max_price = Math.max(...prices);
  }

  // Step 4: Build comparison results
  const results = [];
  for (const item of items) {
    const latestPrice = latestPrices.get(item.item_id);
    if (!latestPrice) continue;

    const catStats = item.category ? categoryStats.get(item.category) : null;
    const suppStats = item.supplier_id ? supplierStats.get(item.supplier_id) : null;
    const supplier = item.supplier as any;

    // Calculate deviation from category average
    const deviationFromCategoryAvg = catStats && catStats.category_avg_price > 0
      ? ((latestPrice.latest_price - catStats.category_avg_price) / catStats.category_avg_price) * 100
      : null;

    // Calculate deviation from supplier average
    const deviationFromSupplierAvg = suppStats && suppStats.supplier_avg_price > 0
      ? ((latestPrice.latest_price - suppStats.supplier_avg_price) / suppStats.supplier_avg_price) * 100
      : null;

    results.push({
      item_id: item.item_id,
      item_name: item.item_name,
      item_code: item.item_code,
      category: item.category,
      unit: item.unit,
      latest_price: latestPrice.latest_price,
      price_month: latestPrice.price_month,
      category_avg_price: catStats ? parseFloat(catStats.category_avg_price.toFixed(2)) : null,
      category_min_price: catStats ? parseFloat(catStats.category_min_price.toFixed(2)) : null,
      category_max_price: catStats ? parseFloat(catStats.category_max_price.toFixed(2)) : null,
      deviation_from_category_avg_pct: deviationFromCategoryAvg !== null
        ? parseFloat(deviationFromCategoryAvg.toFixed(2))
        : null,
      supplier_id: item.supplier_id,
      supplier_name: supplier?.company_name || null,
      supplier_avg_price: suppStats ? parseFloat(suppStats.supplier_avg_price.toFixed(2)) : null,
      deviation_from_supplier_avg_pct: deviationFromSupplierAvg !== null
        ? parseFloat(deviationFromSupplierAvg.toFixed(2))
        : null
    });
  }

  // Sort by absolute deviation from category average (descending)
  results.sort((a, b) => {
    const aDeviation = Math.abs(a.deviation_from_category_avg_pct || 0);
    const bDeviation = Math.abs(b.deviation_from_category_avg_pct || 0);
    return bDeviation - aDeviation;
  });

  // Calculate summary statistics
  const totalItems = results.length;
  const uniqueCategories = new Set(
    results.map(item => item.category).filter(c => c !== null)
  );
  const uniqueSuppliers = new Set(
    results.map(item => item.supplier_id).filter(s => s !== null)
  );

  return NextResponse.json({
    success: true,
    data: {
      type: 'comparisons',
      items: results,
      summary: {
        totalItems,
        categoriesCount: uniqueCategories.size,
        suppliersCount: uniqueSuppliers.size
      }
    },
    generatedAt: new Date().toISOString()
  });
}
