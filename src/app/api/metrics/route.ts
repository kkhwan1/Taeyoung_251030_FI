import { NextResponse } from 'next/server';
import { metricsCollector } from '@/lib/metrics';
import { dashboardCache, apiCache, dataCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';


export async function GET() {
  try {
    const metrics = metricsCollector.getMetrics();
    const summary = metricsCollector.getSummary();
    const slowestEndpoints = metricsCollector.getSlowestEndpoints(5);
    const mostErrorEndpoints = metricsCollector.getMostErrorEndpoints(5);

    // 캐시 통계
    const cacheStats = {
      dashboard: dashboardCache.getStats(),
      api: apiCache.getStats(),
      data: dataCache.getStats()
    };

    return NextResponse.json({
      success: true,
      data: {
        summary,
        slowestEndpoints,
        mostErrorEndpoints,
        cacheStats,
        detailed: metrics
      }
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      {
        success: false,
        error: '메트릭 조회에 실패했습니다.'
      },
      { status: 500 }
    );
  }
}
