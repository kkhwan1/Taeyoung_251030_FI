// Wave 3 Day 4 - Price Trend Analysis API with Forecasting
// src/app/api/price-analysis/trends/route.ts
// Phase 1 Optimization: In-Memory caching with 60s TTL

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { TrendAnalysisQuerySchema } from '@/lib/validation';
import { ERROR_MESSAGES, formatErrorResponse } from '@/lib/errorMessages';
import { ZodError } from 'zod';
import {
  CacheKeys,
  cacheGet,
  cacheSet
} from '@/lib/cache-memory';

/**
 * Simple linear regression for price forecasting
 * Returns slope (m) and intercept (b) for y = mx + b
 */
function linearRegression(xValues: number[], yValues: number[]): { slope: number; intercept: number } {
  const n = xValues.length;

  if (n === 0) {
    return { slope: 0, intercept: 0 };
  }

  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Calculate confidence level based on data consistency
 */
function calculateConfidence(prices: number[], predicted: number): 'high' | 'medium' | 'low' {
  if (prices.length < 3) return 'low';

  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / mean;

  // If prediction deviates significantly from recent trend, lower confidence
  const recentPrices = prices.slice(-3);
  const recentMean = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
  const deviation = Math.abs(predicted - recentMean) / recentMean;

  if (coefficientOfVariation < 0.05 && deviation < 0.1) return 'high';
  if (coefficientOfVariation < 0.15 && deviation < 0.2) return 'medium';
  return 'low';
}

/**
 * Format period based on granularity
 */
function formatPeriod(date: Date, granularity: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (granularity) {
    case 'day':
      return `${year}-${month}-${day}`;
    case 'week':
      // ISO week number
      const weekNum = getWeekNumber(date);
      return `${year}-W${String(weekNum).padStart(2, '0')}`;
    case 'month':
    default:
      return `${year}-${month}`;
  }
}

/**
 * Get ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Add time period based on granularity
 */
function addPeriod(date: Date, granularity: string, amount: number = 1): Date {
  const result = new Date(date);

  switch (granularity) {
    case 'day':
      result.setDate(result.getDate() + amount);
      break;
    case 'week':
      result.setDate(result.getDate() + (7 * amount));
      break;
    case 'month':
    default:
      result.setMonth(result.getMonth() + amount);
      break;
  }

  return result;
}

/**
 * GET /api/price-analysis/trends
 * 가격 트렌드 분석 (시계열 분석 + 예측)
 *
 * Query Parameters:
 * - item_id: 품목 ID (optional, 없으면 전체)
 * - start_date: 시작일 (YYYY-MM-DD, 기본값: 12개월 전)
 * - end_date: 종료일 (YYYY-MM-DD, 기본값: 오늘)
 * - granularity: 집계 단위 (day|week|month, 기본값: month)
 * - include_forecast: 예측 포함 여부 (true|false, 기본값: false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query params (filter out null values)
    const queryParams: any = {
      granularity: searchParams.get('granularity') || 'month',
      include_forecast: searchParams.get('include_forecast') || 'false'
    };

    const item_id_str = searchParams.get('item_id');
    if (item_id_str) queryParams.item_id = item_id_str;

    const start_date_str = searchParams.get('start_date');
    if (start_date_str) queryParams.start_date = start_date_str;

    const end_date_str = searchParams.get('end_date');
    if (end_date_str) queryParams.end_date = end_date_str;

    // Validate with Zod
    const validatedParams = TrendAnalysisQuerySchema.parse(queryParams);
    const { item_id, granularity, include_forecast } = validatedParams;

    // Set default date range (last 12 months)
    const end_date = validatedParams.end_date || new Date().toISOString().split('T')[0];
    const start_date = validatedParams.start_date || (() => {
      const date = new Date(end_date);
      date.setMonth(date.getMonth() - 12);
      return date.toISOString().split('T')[0];
    })();

    // Phase 1 Cache: Try cache first
    const cacheKey = `trends:price:${item_id || 'all'}:${start_date}:${end_date}:${granularity}:${include_forecast}`;
    const cachedTrends = cacheGet(cacheKey);

    if (cachedTrends) {
      return NextResponse.json({
        success: true,
        data: cachedTrends,
        cached: true
      });
    }

    const supabase = getSupabaseClient();

    // Build query for price history
    let query = supabase
      .from('item_price_history')
      .select(`
        price_history_id,
        item_id,
        price_month,
        unit_price,
        price_per_kg,
        created_at,
        item:items (
          item_id,
          item_code,
          item_name,
          category,
          unit
        )
      `)
      .gte('price_month', start_date)
      .lte('price_month', end_date)
      .order('price_month', { ascending: true });

    // Apply item filter if provided
    if (item_id) {
      query = query.eq('item_id', item_id);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          item_id: item_id || null,
          item_name: null,
          time_series: [],
          statistics: {
            avg_price: 0,
            min_price: 0,
            max_price: 0,
            volatility: 0,
            trend: 'stable'
          },
          forecast: []
        }
      });
    }

    // Group data by period and calculate aggregates
    const periodMap = new Map<string, { prices: number[]; dates: Date[] }>();

    data.forEach((record: any) => {
      const date = new Date(record.price_month);
      const period = formatPeriod(date, granularity);

      if (!periodMap.has(period)) {
        periodMap.set(period, { prices: [], dates: [] });
      }

      const periodData = periodMap.get(period)!;
      periodData.prices.push(record.unit_price);
      periodData.dates.push(date);
    });

    // Calculate time series with period-over-period changes
    const periods = Array.from(periodMap.keys()).sort();
    const timeSeries: Array<{
      period: string;
      price: number;
      change_pct: number;
      record_count: number;
    }> = [];

    let prevPrice: number | null = null;

    periods.forEach(period => {
      const periodData = periodMap.get(period)!;
      const avgPrice = periodData.prices.reduce((a, b) => a + b, 0) / periodData.prices.length;

      const changePct = prevPrice !== null
        ? ((avgPrice - prevPrice) / prevPrice) * 100
        : 0;

      timeSeries.push({
        period,
        price: Math.round(avgPrice * 100) / 100,
        change_pct: Math.round(changePct * 10) / 10,
        record_count: periodData.prices.length
      });

      prevPrice = avgPrice;
    });

    // Calculate statistics
    const allPrices = timeSeries.map(ts => ts.price);
    const avgPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);

    // Calculate volatility (standard deviation)
    const variance = allPrices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / allPrices.length;
    const volatility = Math.sqrt(variance);

    // Determine trend direction
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (timeSeries.length >= 2) {
      const firstPrice = timeSeries[0].price;
      const lastPrice = timeSeries[timeSeries.length - 1].price;
      const overallChange = ((lastPrice - firstPrice) / firstPrice) * 100;

      if (overallChange > 5) trend = 'increasing';
      else if (overallChange < -5) trend = 'decreasing';
    }

    const statistics = {
      avg_price: Math.round(avgPrice * 100) / 100,
      min_price: Math.round(minPrice * 100) / 100,
      max_price: Math.round(maxPrice * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
      trend
    };

    // Generate forecast if requested
    const forecast: Array<{
      period: string;
      predicted_price: number;
      confidence: 'high' | 'medium' | 'low';
    }> = [];

    if (include_forecast && timeSeries.length >= 3) {
      // Use linear regression for simple forecasting
      const xValues = timeSeries.map((_, index) => index);
      const yValues = timeSeries.map(ts => ts.price);

      const { slope, intercept } = linearRegression(xValues, yValues);

      // Forecast next 3 periods
      const lastDate = new Date(timeSeries[timeSeries.length - 1].period);

      for (let i = 1; i <= 3; i++) {
        const nextDate = addPeriod(lastDate, granularity, i);
        const nextPeriod = formatPeriod(nextDate, granularity);
        const predictedPrice = slope * (timeSeries.length + i - 1) + intercept;

        // Ensure predicted price is positive
        const finalPrice = Math.max(0, Math.round(predictedPrice * 100) / 100);

        forecast.push({
          period: nextPeriod,
          predicted_price: finalPrice,
          confidence: calculateConfidence(yValues, finalPrice)
        });
      }
    }

    // Get item info for response
    const firstRecord = data[0] as any;
    const itemInfo = firstRecord.item;

    const responseData = {
      item_id: item_id || null,
      item_name: itemInfo?.item_name || null,
      item_code: itemInfo?.item_code || null,
      category: itemInfo?.category || null,
      time_series: timeSeries,
      statistics,
      forecast: include_forecast ? forecast : [],
      metadata: {
        start_date,
        end_date,
        granularity,
        total_periods: timeSeries.length,
        data_points: data.length
      }
    };

    // Phase 1 Cache: Store result with 60s TTL
    cacheSet(cacheKey, responseData, 60);

    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false
    });

  } catch (error) {
    console.error('[trend-analysis] GET error:', error);

    if (error instanceof ZodError) {
      const details = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.VALIDATION_FAILED,
          details
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      formatErrorResponse(error, '트렌드 분석'),
      { status: 500 }
    );
  }
}
