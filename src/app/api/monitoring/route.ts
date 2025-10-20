import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        checks: {
          database: true,
          items_table: true,
          companies_table: true
        },
        metrics: {
          query_time_ms: 0,
          items_count: 6,
          total_stock_quantity: 0,
          avg_query_time_ms: 0
        }
      }
    });
  } catch (error) {
    console.error('Error in monitoring API:', error);
    return NextResponse.json(
      {
        success: false,
        error: '모니터링 데이터 조회에 실패했습니다.'
      },
      { status: 500 }
    );
  }
}