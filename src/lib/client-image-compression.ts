import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  initialQuality?: number;
}

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  originalDimensions: { width: number; height: number };
  compressedDimensions: { width: number; height: number };
}

/**
 * 클라이언트 사이드 이미지 압축
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxSizeMB = 2,
    maxWidthOrHeight = 1920,
    useWebWorker = true,
    initialQuality = 0.8
  } = options;

  try {
    const compressedFile = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight,
      useWebWorker,
      initialQuality
    });

    return compressedFile;
  } catch (error) {
    console.error('이미지 압축 오류:', error);
    throw new Error('이미지 압축에 실패했습니다.');
  }
}

/**
 * 압축 전후 통계
 */
export async function getCompressionStats(
  originalFile: File,
  compressedFile: File
): Promise<CompressionStats> {
  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('이미지 로드 실패'));
      };

      img.src = url;
    });
  };

  const [originalDimensions, compressedDimensions] = await Promise.all([
    getImageDimensions(originalFile),
    getImageDimensions(compressedFile)
  ]);

  const compressionRatio = Math.round(
    (1 - compressedFile.size / originalFile.size) * 100
  );

  return {
    originalSize: originalFile.size,
    compressedSize: compressedFile.size,
    compressionRatio,
    originalDimensions,
    compressedDimensions
  };
}

/**
 * 파일 크기 포맷 (MB, KB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

