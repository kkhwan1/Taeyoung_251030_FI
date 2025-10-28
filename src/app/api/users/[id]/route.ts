import { NextRequest } from 'next/server';
import { checkPermission, hashPassword } from '@/lib/auth';
import { createSuccessResponse, handleSupabaseError, getSupabaseClient } from '@/lib/db-unified';

/**
 * GET /api/users/[id] - 사용자 상세 조회 (본인 또는 manager 이상)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error, user } = await checkPermission('user', request);
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const userId = parseInt(params.id);

  // 본인 또는 manager 이상만 조회 가능
  if (userId !== user!.user_id && !['manager', 'admin'].includes(user!.role)) {
    return Response.json({
      success: false,
      error: '다른 사용자의 정보를 조회할 권한이 없습니다.'
    }, { status: 403 });
  }

  const supabase = getSupabaseClient();
  const { data, error: dbError } = await supabase
    .from('users')
    .select('user_id, username, name, email, phone, role, department, is_active, created_at, updated_at')
    .eq('user_id', userId)
    .single();

  if (dbError) {
    const errorResponse = handleSupabaseError('select', 'users', dbError);
    return Response.json(errorResponse, { status: 500 });
  }

  return Response.json({ success: true, data });
}

/**
 * PUT /api/users/[id] - 사용자 수정 (본인 또는 admin)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error, user } = await checkPermission('user', request);
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const userId = parseInt(params.id);

  // 한글 처리 패턴
  const text = await request.text();
  const body = JSON.parse(text);

  // 본인 또는 admin만 수정 가능
  if (userId !== user!.user_id && user!.role !== 'admin') {
    return Response.json({
      success: false,
      error: '다른 사용자의 정보를 수정할 권한이 없습니다.'
    }, { status: 403 });
  }

  // 일반 사용자는 role 변경 불가
  if (userId === user!.user_id && body.role && body.role !== user!.role) {
    return Response.json({
      success: false,
      error: '자신의 역할은 변경할 수 없습니다.'
    }, { status: 403 });
  }

  const supabase = getSupabaseClient();

  // 업데이트할 데이터 구성
  const updateData: any = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.email !== undefined) updateData.email = body.email;
  if (body.phone !== undefined) updateData.phone = body.phone;
  if (body.department !== undefined) updateData.department = body.department;

  // admin만 role과 is_active 변경 가능
  if (user!.role === 'admin') {
    if (body.role !== undefined) updateData.role = body.role;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
  }

  // 비밀번호 변경
  if (body.password) {
    updateData.password = await hashPassword(body.password);
  }

  const { data, error: dbError } = await supabase
    .from('users')
    .update(updateData)
    .eq('user_id', userId)
    .select('user_id, username, name, email, phone, role, department, is_active, created_at, updated_at')
    .single();

  if (dbError) {
    const errorResponse = handleSupabaseError('update', 'users', dbError);
    return Response.json(errorResponse, { status: 500 });
  }

  return Response.json({ success: true, data });
}

/**
 * DELETE /api/users/[id] - 사용자 비활성화 (admin만, 소프트 삭제)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error, user } = await checkPermission('admin', request);
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const userId = parseInt(params.id);

  // 자기 자신은 삭제 불가
  if (userId === user!.user_id) {
    return Response.json({
      success: false,
      error: '자기 자신을 삭제할 수 없습니다.'
    }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // 소프트 삭제 (is_active = false)
  const { data, error: dbError } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('user_id', userId)
    .select('user_id, username, name, email, phone, role, department, is_active, created_at, updated_at')
    .single();

  if (dbError) {
    const errorResponse = handleSupabaseError('update', 'users', dbError);
    return Response.json(errorResponse, { status: 500 });
  }

  return Response.json({ success: true, data });
}

