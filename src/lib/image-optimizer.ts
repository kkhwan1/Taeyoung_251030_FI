import sharp from 'sharp';

export interface ImageSizes {
  thumbnail: Buffer;
  medium: Buffer;
  full: Buffer;
}

export interface OptimizeOptions {
  maxThumbnailSize?: number;
  maxMediumSize?: number;
  maxFullSize?: number;
  quality?: number;
}

/**
 * 이미지를 여러 크기로 최적화
 */
export async function optimizeImage(
  buffer: Buffer,
  options: OptimizeOptions = {}
): Promise<ImageSizes> {
  const {
    maxThumbnailSize = 150,
    maxMediumSize = 600,
    maxFullSize = 1920,
    quality = 80
  } = options;

  // 메타데이터 제거 및 자동 회전
  const image = sharp(buffer)
    .rotate() // EXIF 기반 자동 회전
    .withMetadata(false); // 메타데이터 제거

  // 썸네일 (정사각형)
  const thumbnail = await image
    .clone()
    .resize(maxThumbnailSize, maxThumbnailSize, {
      fit: 'cover',
      position: 'center'
    })
    .webp({ quality })
    .toBuffer();

  // 중간 크기 (가로세로 비율 유지)
  const medium = await image
    .clone()
    .resize(maxMediumSize, maxMediumSize, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality })
    .toBuffer();

  // 전체 크기 (가로세로 비율 유지)
  const full = await image
    .clone()
    .resize(maxFullSize, maxFullSize, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 85 })
    .toBuffer();

  return { thumbnail, medium, full };
}

/**
 * 압축률 계산
 */
export function calculateCompressionRatio(
  originalSize: number,
  compressedSize: number
): number {
  return Math.round((1 - compressedSize / originalSize) * 100);
}

/**
 * 이미지 메타데이터 추출
 */
export async function getImageMetadata(buffer: Buffer) {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: metadata.size,
    hasAlpha: metadata.hasAlpha,
    orientation: metadata.orientation
  };
}

