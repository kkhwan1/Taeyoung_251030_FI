import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

// Company type mapping between Korean (DB) and English (API)
const companyTypeMap: Record<string, string> = {
  'CUSTOMER': '고객사',
  'SUPPLIER': '공급사',
  '고객사': '고객사',
  '공급사': '공급사'
};

/**
 * GET /api/companies
 * List companies with filters
 * Query parameters:
 * - type: Filter by company type (accepts both Korean and English values)
 * - search: Search in company name, business registration number, contact person, phone, email
 * - limit: Number of records to return (default: 20)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get Supabase client from unified db layer
    const supabase = getSupabaseClient();

    // Build safe query using Supabase client
    let query = supabase
      .from('companies')
      .select('*')
      .order('company_name', { ascending: true });

    // Apply filters safely - map English to Korean for database query
    if (type) {
      const dbType = companyTypeMap[type] || type;
      query = query.eq('company_type', dbType as '고객사' | '공급사');
    }

    if (search) {
      query = query.or(`company_name.ilike.%${search}%,business_number.ilike.%${search}%,representative.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: companies, error } = (await query) as any;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Get total count for pagination (safe query)
    let countQuery = supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    // Apply same filters for count - use mapped dbType for consistency
    if (type) {
      const dbType = companyTypeMap[type] || type;
      countQuery = countQuery.eq('company_type', dbType as '고객사' | '공급사');
    }

    if (search) {
      countQuery = countQuery.or(`company_name.ilike.%${search}%,business_number.ilike.%${search}%,representative.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { count: totalCount, error: countError } = (await countQuery) as any;

    if (countError) {
      throw new Error(`Count query failed: ${countError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        data: companies || [],
        meta: {
          limit,
          totalCount: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
          hasNext: offset + limit < (totalCount || 0),
          hasPrev: offset > 0
        },
        pagination: {
          limit,
          totalCount: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
          hasNext: offset + limit < (totalCount || 0),
          hasPrev: offset > 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    return NextResponse.json(
      {
        success: false,
        error: '거래처 목록 조회에 실패했습니다.'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/companies
 * Create new company
 * Body: {
 *   company_name: string,
 *   company_type: string,
 *   business_registration_no?: string,
 *   contact_person?: string,
 *   phone?: string,
 *   mobile?: string,
 *   email?: string,
 *   address?: string,
 *   company_category?: string,
 *   business_info?: {
 *     business_type?: string,
 *     business_item?: string,
 *     main_products?: string
 *   },
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Use text() + JSON.parse() for proper UTF-8 Korean character handling
    const text = await request.text();
    const body = JSON.parse(text);
    const {
      company_name,
      company_type,
      business_registration_no,
      contact_person,
      phone,
      mobile,
      email,
      address,
      company_category,
      business_info,
      notes
    } = body;

    // Get Supabase client from unified db layer
    const supabase = getSupabaseClient();

    // 필수 필드 검증
    if (!company_name || !company_type) {
      return NextResponse.json({
        success: false,
        error: '회사명과 회사 유형은 필수입니다.'
      }, { status: 400 });
    }

    // Convert English API value to Korean DB value if needed
    const dbCompanyType = companyTypeMap[company_type] || company_type;

    // Validate company_category if provided
    if (company_category) {
      const validCategories = ['협력업체-원자재', '협력업체-외주', '소모품업체', '기타'];
      if (!validCategories.includes(company_category)) {
        return NextResponse.json({
          success: false,
          error: '올바른 거래처 분류를 선택해주세요.'
        }, { status: 400 });
      }
    }

    // Generate company_code automatically based on company_type
    const prefixMap: Record<string, string> = {
      '고객사': 'CUS',
      '공급사': 'SUP',
      '협력사': 'PAR',
      '기타': 'OTH'
    };

    const prefix = prefixMap[dbCompanyType] || 'COM';

    // Get the last company code with this prefix
    const { data: existingCodes } = (await supabase
      .from('companies')
      .select('company_code')
      .like('company_code', `${prefix}%`)
      .order('company_code', { ascending: false })
      .limit(1)) as any;

    let nextNumber = 1;
    if (existingCodes && existingCodes.length > 0) {
      const lastCode = existingCodes[0].company_code;
      const match = lastCode.match(/\d+$/);
      if (match) {
        nextNumber = parseInt(match[0]) + 1;
      }
    }

    const company_code = `${prefix}${String(nextNumber).padStart(3, '0')}`;

    // Create company using Supabase client
    const { data: company, error } = (await supabase
      .from('companies')
      .insert({
        company_code,
        company_name,
        company_type: dbCompanyType,
        business_number: business_registration_no,  // Map API parameter to correct DB column
        representative: contact_person,  // Map API parameter to correct DB column
        phone,
        // mobile column removed - does not exist in database (only phone and fax columns exist)
        email,
        address,
        company_category: company_category || null,
        business_info: business_info || null,
        // notes field removed - does not exist in database schema
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as any)
      .select()
      .single()) as any;

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '거래처가 성공적으로 등록되었습니다.',
      data: company
    });
  } catch (error) {
    console.error('Error creating company:', error);
    return NextResponse.json(
      {
        success: false,
        error: '거래처 등록에 실패했습니다.'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/companies
 * Update existing company
 * Body: {
 *   company_id: number,
 *   ... other fields to update including company_category and business_info
 * }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Use text() + JSON.parse() for proper UTF-8 Korean character handling
    const text = await request.text();
    const body = JSON.parse(text);
    const { company_id, ...updateData } = body;

    // Get Supabase client from unified db layer
    const supabase = getSupabaseClient();

    if (!company_id) {
      return NextResponse.json({
        success: false,
        error: '회사 ID가 필요합니다.'
      }, { status: 400 });
    }

    // Convert company_type if present in updateData (English API → Korean DB)
    if (updateData.company_type) {
      updateData.company_type = companyTypeMap[updateData.company_type] || updateData.company_type;
    }

    // Validate company_category if provided
    if (updateData.company_category) {
      const validCategories = ['협력업체-원자재', '협력업체-외주', '소모품업체', '기타'];
      if (!validCategories.includes(updateData.company_category)) {
        return NextResponse.json({
          success: false,
          error: '올바른 거래처 분류를 선택해주세요.'
        }, { status: 400 });
      }
    }

    // Update company using Supabase client
    const { data: company, error } = (await (supabase
      .from('companies') as any)
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('company_id', company_id)
      .select()
      .single()) as any;

    if (error) {
      throw new Error(`Database update failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '거래처가 성공적으로 업데이트되었습니다.',
      data: company
    });
  } catch (error) {
    console.error('Error updating company:', error);
    return NextResponse.json(
      {
        success: false,
        error: '거래처 업데이트에 실패했습니다.'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/companies
 * Delete company (soft delete)
 * Query parameter: id - Company ID to delete
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // Get Supabase client from unified db layer
    const supabase = getSupabaseClient();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '회사 ID가 필요합니다.'
      }, { status: 400 });
    }

    // Soft delete by setting is_active to false
    const { error } = (await (supabase
      .from('companies') as any)
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('company_id', id)) as any;

    if (error) {
      throw new Error(`Database delete failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '거래처가 성공적으로 삭제되었습니다.',
      data: { deleted_id: id }
    });
  } catch (error) {
    console.error('Error deleting company:', error);
    return NextResponse.json(
      {
        success: false,
        error: '거래처 삭제에 실패했습니다.'
      },
      { status: 500 }
    );
  }
}