import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type CompanyOption = {
  company_id: number;
  company_name: string;
  company_code: string | null;
};

/**
 * GET /api/companies/options
 *
 * 거래처 필터링용 옵션 목록 조회
 * Returns company list for dropdown filtering with caching
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('company_id, company_name, company_code')
      .eq('is_active', true)
      .order('company_name', { ascending: true });

    if (error) throw error;

    // Null-safe 데이터 매핑
    const companies = (data || []).map((company: CompanyOption) => ({
      company_id: company.company_id,
      company_name: company.company_name ?? '미등록 거래처',
      company_code: company.company_code ?? null,
      label: `${company.company_name ?? '미등록 거래처'} (${company.company_code ?? '코드 없음'})`
    }));

    return NextResponse.json({
      success: true,
      data: companies
    }, {
      headers: {
        // 5분 캐싱, 10분 동안 stale content 허용
        'Cache-Control': 'max-age=300, stale-while-revalidate=600'
      }
    });
  } catch (error) {
    console.error('거래처 목록 조회 실패:', error);
    return NextResponse.json({
      success: false,
      error: '거래처 목록을 불러오지 못했습니다.'
    }, { status: 500 });
  }
}
