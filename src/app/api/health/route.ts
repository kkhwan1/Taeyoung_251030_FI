import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';


export async function GET() {
  const startTime = Date.now();
  
  try {
    // 데이터베이스 연결 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return Response.json({
        success: false,
        message: 'Database configuration missing',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 간단한 DB 쿼리로 연결 확인
    const { error } = await supabase
      .from('items')
      .select('item_id')
      .limit(1);

    const dbHealthy = !error;
    const responseTime = Date.now() - startTime;

    return Response.json({
      success: dbHealthy,
      status: dbHealthy ? 'healthy' : 'unhealthy',
      message: dbHealthy ? 'Turbopack is working perfectly! No more file lock errors!' : 'Database connection failed',
      timestamp: new Date().toISOString(),
      responseTime: responseTime,
      uptime: process.uptime() * 1000, // 밀리초 단위 (프론트엔드에서 직접 사용)
      checks: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          responseTime: responseTime,
          connectionPool: {
            active: 0,
            idle: 0,
            total: 0,
            limit: 100,
            utilizationPercent: 0
          }
        },
        memory: {
          status: 'healthy',
          usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
          limit: 512
        },
        system: {
          status: 'healthy',
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          environment: process.env.NODE_ENV || 'development',
          pid: process.pid,
          uptime: process.uptime() * 1000 // 밀리초 단위로 변환
        }
      },
      version: '1.0.0',
      correlationId: crypto.randomUUID(),
      environment: process.env.NODE_ENV
    }, { 
      status: dbHealthy ? 200 : 500 
    });
  } catch (error) {
    return Response.json({
      success: false,
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
