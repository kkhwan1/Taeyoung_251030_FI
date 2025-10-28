import { createSupabaseBrowserClient } from '@/lib/supabase';

export interface UploadResult {
  path: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface UploadOptions {
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
}

/**
 * 파일 업로드
 */
export async function uploadDocument(
  options: UploadOptions
): Promise<UploadResult> {
  const { bucket, path, file, upsert = false } = options;
  const supabase = createSupabaseBrowserClient();

  // 파일 크기 검증 (10MB)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('파일 크기는 10MB를 초과할 수 없습니다.');
  }

  // MIME 타입 검증
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('지원하지 않는 파일 형식입니다.');
  }

  // Storage에 업로드
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert
    });

  if (error) {
    throw new Error(`파일 업로드 실패: ${error.message}`);
  }

  // Public URL 생성 (비공개 버킷이므로 signed URL 사용)
  const { data: urlData } = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.path, 3600); // 1시간 유효

  return {
    path: data.path,
    url: urlData?.signedUrl || '',
    size: file.size,
    mimeType: file.type
  };
}

/**
 * 파일 삭제
 */
export async function deleteDocument(
  bucket: string,
  path: string
): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    throw new Error(`파일 삭제 실패: ${error.message}`);
  }
}

/**
 * Signed URL 생성
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`서명된 URL 생성 실패: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * 다중 파일 업로드
 */
export async function uploadMultipleDocuments(
  bucket: string,
  files: File[],
  getPath: (file: File, index: number) => string
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = getPath(file, i);

    try {
      const result = await uploadDocument({ bucket, path, file });
      results.push(result);
    } catch (error) {
      console.error(`파일 업로드 실패 (${file.name}):`, error);
      throw error;
    }
  }

  return results;
}

