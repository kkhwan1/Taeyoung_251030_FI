import { NextRequest } from 'next/server';
import { checkPermission } from '@/lib/auth';
import { validateContract } from '@/lib/contractValidation';
import { createSuccessResponse, handleSupabaseError, getSupabaseClient } from '@/lib/db-unified';

/**
 * GET /api/contracts/[id] - 계약 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error } = await checkPermission('user');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const contractId = parseInt(params.id);
  const supabase = getSupabaseClient();

  const { data, error: dbError } = await supabase
    .from('contracts')
    .select(`
      *,
      company:companies(*),
      creator:users!created_by(user_id, name, username)
    `)
    .eq('contract_id', contractId)
    .eq('is_active', true)
    .single();

  if (dbError) {
    return handleSupabaseError('select', 'contracts', dbError);
  }

  return createSuccessResponse(data);
}

/**
 * PUT /api/contracts/[id] - 계약 수정 (작성자 또는 admin)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error, user } = await checkPermission('manager');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const contractId = parseInt(params.id);

  // 한글 처리 패턴
  const text = await request.text();
  const body = JSON.parse(text);

  const supabase = getSupabaseClient();

  // 권한 확인: 작성자이거나 관리자만 수정 가능
  const { data: existingContract } = await supabase
    .from('contracts')
    .select('created_by')
    .eq('contract_id', contractId)
    .single();

  if (existingContract && existingContract.created_by !== user!.user_id && user!.role !== 'admin') {
    return Response.json({
      success: false,
      error: '이 계약을 수정할 권한이 없습니다.'
    }, { status: 403 });
  }

  // 검증 (중요 필드가 변경되는 경우만)
  if (body.company_id && body.contract_type && body.start_date && body.end_date && body.total_amount !== undefined) {
    const validation = await validateContract(
      {
        company_id: body.company_id,
        contract_type: body.contract_type,
        start_date: body.start_date,
        end_date: body.end_date,
        total_amount: body.total_amount
      },
      { 
        checkDuplicate: false, // 수정 시 중복 검증 생략
        excludeContractId: contractId 
      }
    );

    if (!validation.valid) {
      return Response.json({
        success: false,
        error: validation.error,
        warning: validation.warning
      }, { status: 400 });
    }
  }

  // 업데이트할 데이터 구성
  const updateData: any = {};

  if (body.contract_name !== undefined) updateData.contract_name = body.contract_name;
  if (body.contract_type !== undefined) updateData.contract_type = body.contract_type;
  if (body.contract_date !== undefined) updateData.contract_date = body.contract_date;
  if (body.start_date !== undefined) updateData.start_date = body.start_date;
  if (body.end_date !== undefined) updateData.end_date = body.end_date;
  if (body.total_amount !== undefined) updateData.total_amount = body.total_amount;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.terms !== undefined) updateData.terms = body.terms;
  if (body.notes !== undefined) updateData.notes = body.notes;

  const { data, error: dbError } = await supabase
    .from('contracts')
    .update(updateData)
    .eq('contract_id', contractId)
    .select(`
      *,
      company:companies(company_id, company_name, company_type)
    `)
    .single();

  if (dbError) {
    return handleSupabaseError('update', 'contracts', dbError);
  }

  return createSuccessResponse(data);
}

/**
 * DELETE /api/contracts/[id] - 계약 소프트 삭제 (admin만)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error } = await checkPermission('admin');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const contractId = parseInt(params.id);
  const supabase = getSupabaseClient();

  // 소프트 삭제
  const { data, error: dbError } = await supabase
    .from('contracts')
    .update({ is_active: false })
    .eq('contract_id', contractId)
    .select()
    .single();

  if (dbError) {
    return handleSupabaseError('update', 'contracts', dbError);
  }

  return createSuccessResponse(data);
}
