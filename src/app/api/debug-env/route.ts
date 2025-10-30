import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    DISABLE_AUTH: process.env.DISABLE_AUTH,
    NEXT_PUBLIC_DISABLE_AUTH: process.env.NEXT_PUBLIC_DISABLE_AUTH,
    NODE_ENV: process.env.NODE_ENV,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}
