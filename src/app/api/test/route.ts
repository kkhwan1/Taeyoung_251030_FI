export async function GET() {
  // 개발 환경에서만 접근 가능
  if (process.env.NODE_ENV !== 'development') {
    return Response.json({
      success: false,
      error: 'Not available in production'
    }, { status: 404 });
  }

  return Response.json({
    success: true,
      message: 'Test API is working with Turbopack - No file lock errors!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
}