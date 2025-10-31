import { NextResponse } from 'next/server';

/**
 * Temporary authentication endpoint
 * TODO: Implement proper authentication system
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    user: {
      id: 'temp-user-1',
      name: '관리자',
      email: 'admin@taechang.com',
      role: 'admin'
    }
  });
}
