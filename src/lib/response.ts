import { NextResponse } from 'next/server';

/**
 * UTF-8 인코딩을 명시적으로 설정한 JSON 응답 생성
 */
export function createUTF8Response(data: any, status: number = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  
  // UTF-8 인코딩 명시적 설정
  response.headers.set('Content-Type', 'application/json; charset=utf-8');
  response.headers.set('Content-Encoding', 'utf-8');
  
  return response;
}

/**
 * 성공 응답 생성
 */
export function createSuccessResponse(data: any, message?: string): NextResponse {
  return createUTF8Response({
    success: true,
    data,
    message: message || '성공적으로 처리되었습니다.'
  });
}

/**
 * 에러 응답 생성
 */
export function createErrorResponse(error: string, status: number = 500): NextResponse {
  return createUTF8Response({
    success: false,
    error,
    timestamp: new Date().toISOString()
  }, status);
}

/**
 * 페이지네이션 응답 생성
 */
export function createPaginatedResponse(
  data: any[],
  total: number,
  page: number,
  limit: number
): NextResponse {
  const totalPages = Math.ceil(total / limit);
  
  return createUTF8Response({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
}

/**
 * 파일 다운로드 응답 생성
 */
export function createFileResponse(
  buffer: Buffer,
  filename: string,
  contentType: string = 'application/octet-stream'
): NextResponse {
  const response = new NextResponse(buffer);
  
  // UTF-8 인코딩 명시적 설정
  response.headers.set('Content-Type', `${contentType}; charset=utf-8`);
  response.headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  response.headers.set('Content-Encoding', 'utf-8');
  
  return response;
}

/**
 * Excel 파일 다운로드 응답 생성
 */
export function createExcelResponse(buffer: Buffer, filename: string): NextResponse {
  return createFileResponse(
    buffer,
    filename,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}
