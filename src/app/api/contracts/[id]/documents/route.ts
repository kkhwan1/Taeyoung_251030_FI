import { NextRequest } from 'next/server';
import { checkPermission } from '@/lib/auth';
import { uploadDocument, deleteDocument } from '@/lib/storage';
import { createSuccessResponse, handleSupabaseError, getSupabaseClient } from '@/lib/db-unified';

/**
 * GET /api/contracts/[id]/documents - 계약 문서 목록 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed, error } = await checkPermission('user', request);
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const { id } = await params;
  const contractId = parseInt(id);
  const supabase = getSupabaseClient();

  const { data, error: dbError } = await supabase
    .from('contract_documents')
    .select('*')
    .eq('contract_id', contractId)
    .order('uploaded_at', { ascending: false });

  if (dbError) {
    const errorResponse = handleSupabaseError('select', 'contract_documents', dbError);
    return Response.json(errorResponse, { status: 500 });
  }

  return Response.json({ success: true, data });
}

/**
 * POST /api/contracts/[id]/documents - 문서 업로드 (manager 이상)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed, error, user } = await checkPermission('manager', request);
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const { id } = await params;
  const contractId = parseInt(id);
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json({
        success: false,
        error: '파일이 없습니다.'
      }, { status: 400 });
    }

    // 파일 이름에서 확장자 추출
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
    const storagePath = `contracts/${contractId}/${timestamp}_${sanitizedName}`;

    // Storage에 업로드
    const uploadResult = await uploadDocument({
      bucket: 'contract-documents',
      path: storagePath,
      file
    });

    // 파일 타입 추출 (확장자 기반)
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'other';
    const documentType = ['pdf', 'doc', 'docx'].includes(fileExt) ? 'contract' : 'attachment';

    // DB에 메타데이터 저장
    const supabase = getSupabaseClient();
    const { data, error: dbError } = await supabase
      .from('contract_documents')
      .insert({
        contract_id: contractId,
        document_type: documentType,
        document_url: uploadResult.url,
        file_path: uploadResult.path,
        file_name: file.name,
        original_filename: file.name,
        mime_type: uploadResult.mimeType,
        file_size: uploadResult.size,
        uploaded_by: user!.user_id
      })
      .select(`
        *,
        uploader:users!uploaded_by(user_id, name, username)
      `)
      .single();

    if (dbError) {
      // DB 저장 실패 시 Storage에서 파일 삭제
      await deleteDocument('contract-documents', uploadResult.path);
      const errorResponse = handleSupabaseError('insert', 'contract_documents', dbError);
      return Response.json(errorResponse, { status: 500 });
    }

    return Response.json({ success: true, data }, { status: 201 });
  } catch (err) {
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : '파일 업로드 실패'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/contracts/[id]/documents - 문서 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed, error, user } = await checkPermission('manager', request);
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  await params; // Consume params even if not directly used

  const { searchParams } = new URL(request.url);
  const docId = searchParams.get('doc_id');

  if (!docId) {
    return Response.json({
      success: false,
      error: '문서 ID가 필요합니다.'
    }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // 문서 정보 조회
  const { data: doc } = await supabase
    .from('contract_documents')
    .select('file_path, uploaded_by')
    .eq('document_id', parseInt(docId))
    .single();

  if (!doc) {
    return Response.json({
      success: false,
      error: '문서를 찾을 수 없습니다.'
    }, { status: 404 });
  }

  // 업로더 본인이거나 admin만 삭제 가능
  if (doc.uploaded_by !== user!.user_id && user!.role !== 'admin') {
    return Response.json({
      success: false,
      error: '이 문서를 삭제할 권한이 없습니다.'
    }, { status: 403 });
  }

  // Storage에서 파일 삭제
  try {
    if (doc.file_path) {
      await deleteDocument('contract-documents', doc.file_path);
    }
  } catch (err) {
    console.error('Storage 파일 삭제 오류:', err);
  }

  // DB에서 소프트 삭제
  const { data, error: dbError } = await supabase
    .from('contract_documents')
    .update({ is_active: false })
    .eq('document_id', parseInt(docId))
    .select()
    .single();

  if (dbError) {
    const errorResponse = handleSupabaseError('update', 'contract_documents', dbError);
    return Response.json(errorResponse, { status: 500 });
  }

  return Response.json({ success: true, data });
}
