/**
 * 재질, 규격, 중량 등 상세 정보 추출 및 업데이트
 *
 * 태창금속 BOM.xlsx의 각 시트에서:
 * - 재질 (material)
 * - 두께 (thickness)
 * - 폭 (width)
 * - 길이 (height/length)
 * - 비중 (specific_gravity)
 * - 단위중량 (mm_weight)
 * 
 * 09월 원자재 수불관리.xlsx에서:
 * - 규격/사양 (spec)
 * - U/S (소요량)
 *
 * 실행: npx tsx scripts/migration/extract-material-specs.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';
import { Database } from '@/types/supabase';

const BOM_EXCEL = '태창금속 BOM.xlsx';
const INVENTORY_EXCEL = '09월 원자재 수불관리.xlsx';
const EXCEL_DIR = path.resolve(process.cwd(), '.example');

type Item = Database['public']['Tables']['items']['Update'];

interface MaterialSpecs {
  item_code: string;
  material?: string | null;
  thickness?: number | null;
  width?: number | null;
  height?: number | null;
  specific_gravity?: number | null;
  mm_weight?: number | null;
  spec?: string | null;
}

/**
 * 엑셀 파일 읽기
 */
function readExcelFile(filename: string): XLSX.WorkBook {
  const filePath = path.join(EXCEL_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel 파일을 찾을 수 없습니다: ${filePath}`);
  }

  return XLSX.readFile(filePath, {
    type: 'file',
    cellDates: true,
    cellNF: false,
    cellText: false
  });
}

/**
 * 품번 정규화 (공백 제거, 대문자 변환 등)
 */
function normalizeItemCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * 태창금속 BOM.xlsx에서 재질 및 치수 정보 추출
 */
function extractMaterialSpecsFromBOM(): Map<string, MaterialSpecs> {
  const specsMap = new Map<string, MaterialSpecs>();

  try {
    const workbook = readExcelFile(BOM_EXCEL);
    
    // BOM 시트 목록 (최신단가 제외)
    const bomSheets = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];

    for (const sheetName of bomSheets) {
      if (!workbook.SheetNames.includes(sheetName)) continue;

      const worksheet = workbook.Sheets[sheetName];
      
      // 헤더는 6행 (인덱스 5)
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false,
        range: 5 // A6부터
      }) as any[][];

      // 컬럼 인덱스
      // 완제품 영역: 납품처(0), 차종(1), 품번(2), 품명(3), 단가(4), 마감수량(5)...
      // 구매품목 영역: 구매처(8), 차종(9), 품번(10), 품명(11), 소요량(12), 단가(13)...
      // 재질 정보: 재질(19), 두께(20), 폭(21), 길이(22), SEP(23), 비중(24), EA중량(25)
      const PARENT_CODE_COL = 2;  // 완제품 품번
      const ITEM_CODE_COL = 10;   // 구매품목 품번
      const MATERIAL_COL = 19;    // 재질
      const THICKNESS_COL = 20;   // 두께
      const WIDTH_COL = 21;       // 폭
      const LENGTH_COL = 22;      // 길이
      const GRAVITY_COL = 24;     // 비중
      const EA_WEIGHT_COL = 25;   // EA중량

      // 데이터 행 시작 (헤더 다음 행)
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        // 완제품 품번과 구매품목 품번 모두 추출
        const parentCode = String(row[PARENT_CODE_COL] || '').trim();
        const itemCode = String(row[ITEM_CODE_COL] || '').trim();

        // 재질 및 치수 정보 추출
        const material = String(row[MATERIAL_COL] || '').trim();
        const thicknessStr = String(row[THICKNESS_COL] || '').trim();
        const widthStr = String(row[WIDTH_COL] || '').trim();
        const lengthStr = String(row[LENGTH_COL] || '').trim();
        const gravityStr = String(row[GRAVITY_COL] || '').trim();
        const eaWeightStr = String(row[EA_WEIGHT_COL] || '').trim();

        const thickness = parseFloat(thicknessStr.replace(/[^0-9.-]/g, ''));
        const width = parseFloat(widthStr.replace(/[^0-9.-]/g, ''));
        const length = parseFloat(lengthStr.replace(/[^0-9.-]/g, ''));
        const gravity = parseFloat(gravityStr.replace(/[^0-9.-]/g, ''));
        const eaWeight = parseFloat(eaWeightStr.replace(/[^0-9.-]/g, ''));

        // 완제품 품번 처리
        if (parentCode && parentCode.length >= 3) {
          const normalizedCode = normalizeItemCode(parentCode);
          if (!specsMap.has(normalizedCode)) {
            specsMap.set(normalizedCode, { item_code: normalizedCode });
          }
          
          const spec = specsMap.get(normalizedCode)!;
          if (material && !spec.material) spec.material = material;
          if (!isNaN(thickness) && thickness > 0 && !spec.thickness) spec.thickness = thickness;
          if (!isNaN(width) && width > 0 && !spec.width) spec.width = width;
          if (!isNaN(length) && length > 0 && !spec.height) spec.height = length;
          if (!isNaN(gravity) && gravity > 0 && !spec.specific_gravity) spec.specific_gravity = gravity;
          if (!isNaN(eaWeight) && eaWeight > 0 && !spec.mm_weight) spec.mm_weight = eaWeight;
        }

        // 구매품목 품번 처리
        if (itemCode && itemCode.length >= 3 && itemCode !== parentCode) {
          const normalizedCode = normalizeItemCode(itemCode);
          if (!specsMap.has(normalizedCode)) {
            specsMap.set(normalizedCode, { item_code: normalizedCode });
          }
          
          const spec = specsMap.get(normalizedCode)!;
          if (material && !spec.material) spec.material = material;
          if (!isNaN(thickness) && thickness > 0 && !spec.thickness) spec.thickness = thickness;
          if (!isNaN(width) && width > 0 && !spec.width) spec.width = width;
          if (!isNaN(length) && length > 0 && !spec.height) spec.height = length;
          if (!isNaN(gravity) && gravity > 0 && !spec.specific_gravity) spec.specific_gravity = gravity;
          if (!isNaN(eaWeight) && eaWeight > 0 && !spec.mm_weight) spec.mm_weight = eaWeight;
        }
      }
    }
  } catch (error: any) {
    console.error(`재질 정보 추출 오류: ${error.message}`);
  }

  return specsMap;
}

/**
 * 09월 원자재 수불관리.xlsx에서 규격(spec) 정보 추출
 */
function extractSpecFromInventory(): Map<string, string> {
  const specMap = new Map<string, string>();

  try {
    const workbook = readExcelFile(INVENTORY_EXCEL);
    
    // 일반 공급사 시트
    const vendorSheets = [
      '풍기서산(사급)', '세원테크(사급)', '대우포승(사급)', '호원오토(사급)',
      '웅지테크', '태영금속', 'JS테크', '에이오에스', '창경테크', '신성테크', '광성산업'
    ];

    for (const sheetName of vendorSheets) {
      if (!workbook.SheetNames.includes(sheetName)) continue;

      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false,
        range: 5 // A6부터
      }) as any[][];

      let dataStartRow = 0;
      const itemCodeCol = 3;
      const specCol = 6; // 사양

      // 헤더 확인
      if (rawData.length > 0) {
        const firstRow = rawData[0];
        const firstCell = String(firstRow[0] || '').toLowerCase().trim();
        if (firstCell && isNaN(Number(firstCell)) && 
            (firstCell.includes('품번') || firstCell.includes('품명'))) {
          dataStartRow = 1;
        }
      }

      for (let i = dataStartRow; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const itemCode = String(row[itemCodeCol] || '').trim();
        const spec = specCol < row.length ? String(row[specCol] || '').trim() : '';

        if (itemCode && spec && !specMap.has(itemCode)) {
          specMap.set(itemCode, spec);
        }
      }
    }
  } catch (error: any) {
    console.error(`규격 추출 오류: ${error.message}`);
  }

  return specMap;
}

/**
 * 단위중량(mm_weight) 계산
 */
function calculateMmWeight(
  thickness: number | null | undefined,
  width: number | null | undefined,
  height: number | null | undefined,
  specific_gravity: number | null | undefined
): number | null {
  if (!thickness || !width || !thickness || !width) {
    return null;
  }

  const density = specific_gravity && specific_gravity > 0 ? specific_gravity : 7.85;
  const length = height && height > 0 ? height : 1000; // 기본값 1000mm (1m)

  if (density <= 0 || thickness <= 0 || width <= 0) {
    return null;
  }

  // 두께(cm) × 폭(cm) × 길이(cm) × 비중(g/cm³) / 1000 = 중량(kg)
  const thicknessCm = thickness / 10;
  const widthCm = width / 10;
  const lengthCm = length / 10;
  const volumeCm3 = thicknessCm * widthCm * lengthCm;
  const weightKg = (volumeCm3 * density) / 1000;

  return Number.isFinite(weightKg) ? Number(weightKg.toFixed(4)) : null;
}

/**
 * Items 테이블 업데이트
 */
async function updateItemsWithSpecs(
  supabase: ReturnType<typeof createAdminClient>,
  specsMap: Map<string, MaterialSpecs>,
  specMap: Map<string, string>,
  logger: ReturnType<typeof createLogger>
): Promise<{
  materialUpdated: number;
  thicknessUpdated: number;
  widthUpdated: number;
  heightUpdated: number;
  gravityUpdated: number;
  weightUpdated: number;
  specUpdated: number;
}> {
  // 모든 품목 조회
  const { data: items, error: fetchError } = await supabase
    .from('items')
    .select('item_id, item_code, material, thickness, width, height, specific_gravity, mm_weight, spec');

  if (fetchError) {
    throw new Error(`품목 조회 실패: ${fetchError.message}`);
  }

  if (!items) {
    return {
      materialUpdated: 0,
      thicknessUpdated: 0,
      widthUpdated: 0,
      heightUpdated: 0,
      gravityUpdated: 0,
      weightUpdated: 0,
      specUpdated: 0
    };
  }

  let materialUpdated = 0;
  let thicknessUpdated = 0;
  let widthUpdated = 0;
  let heightUpdated = 0;
  let gravityUpdated = 0;
  let weightUpdated = 0;
  let specUpdated = 0;

  const updates: Array<{ item_id: number; updates: Partial<Item> }> = [];

  for (const item of items) {
    // 품번 정규화 후 매칭
    const normalizedCode = normalizeItemCode(item.item_code);
    const spec = specsMap.get(normalizedCode) || specsMap.get(item.item_code);
    const specValue = specMap.get(item.item_code);
    const updatesToApply: Partial<Item> = {};

    // material 업데이트
    if ((!item.material || item.material === '') && spec?.material) {
      updatesToApply.material = spec.material;
      materialUpdated++;
    }

    // thickness 업데이트
    if ((item.thickness === null || item.thickness === 0) && spec?.thickness) {
      updatesToApply.thickness = spec.thickness;
      thicknessUpdated++;
    }

    // width 업데이트
    if ((item.width === null || item.width === 0) && spec?.width) {
      updatesToApply.width = spec.width;
      widthUpdated++;
    }

    // height 업데이트
    if ((item.height === null || item.height === 0) && spec?.height) {
      updatesToApply.height = spec.height;
      heightUpdated++;
    }

    // specific_gravity 업데이트
    if ((item.specific_gravity === null || item.specific_gravity === 0) && spec?.specific_gravity) {
      updatesToApply.specific_gravity = spec.specific_gravity;
      gravityUpdated++;
    }

    // spec 업데이트 (09월 원자재 수불관리.xlsx에서)
    if ((!item.spec || item.spec === '') && specValue) {
      updatesToApply.spec = specValue;
      specUpdated++;
    }

    // mm_weight 계산 및 업데이트
    if ((item.mm_weight === null || item.mm_weight === 0)) {
      const calculatedWeight = calculateMmWeight(
        spec?.thickness || item.thickness,
        spec?.width || item.width,
        spec?.height || item.height,
        spec?.specific_gravity || item.specific_gravity
      );

      if (calculatedWeight) {
        updatesToApply.mm_weight = calculatedWeight;
        weightUpdated++;
      } else if (spec?.mm_weight) {
        // 엑셀에서 직접 추출한 EA중량 사용
        updatesToApply.mm_weight = spec.mm_weight;
        weightUpdated++;
      }
    }

    if (Object.keys(updatesToApply).length > 0) {
      updates.push({ item_id: item.item_id, updates: updatesToApply });
    }
  }

  // 배치 업데이트
  logger.log(`업데이트 대상: ${updates.length}개 품목`, 'info');

  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);

    for (const { item_id, updates: updateData } of batch) {
      const { error } = await supabase
        .from('items')
        .update(updateData)
        .eq('item_id', item_id);

      if (error) {
        logger.log(`  ⚠️  품목 ${item_id}: ${error.message}`, 'warn');
      }
    }

    if ((i + 100) % 500 === 0 || i + 100 >= updates.length) {
      logger.progress(Math.min(i + 100, updates.length), updates.length, 'items 업데이트');
    }
  }

  return {
    materialUpdated,
    thicknessUpdated,
    widthUpdated,
    heightUpdated,
    gravityUpdated,
    weightUpdated,
    specUpdated
  };
}

/**
 * Main function
 */
async function main() {
  const logger = createLogger('재질 및 규격 정보 추출');
  logger.startMigration();

  const supabase = createAdminClient();

  // Step 1: 연결 테스트
  logger.startPhase('Supabase 연결 테스트');
  const connected = await testConnection(supabase);
  if (!connected) {
    logger.log('Supabase 연결 실패', 'error');
    logger.endMigration(false);
    process.exit(1);
  }
  logger.endPhase();

  // Step 2: 엑셀에서 재질 및 치수 정보 추출
  logger.startPhase('엑셀에서 재질 및 치수 정보 추출');
  
  logger.log('태창금속 BOM.xlsx에서 정보 추출 중...', 'info');
  const specsMap = extractMaterialSpecsFromBOM();
  logger.log(`✅ ${specsMap.size}개 품목의 재질/치수 정보 추출`, 'success');

  logger.log('09월 원자재 수불관리.xlsx에서 규격 추출 중...', 'info');
  const specMap = extractSpecFromInventory();
  logger.log(`✅ ${specMap.size}개 품목의 규격 정보 추출`, 'success');
  
  logger.endPhase();

  // Step 3: Items 테이블 업데이트
  logger.startPhase('Items 테이블 재질/규격 정보 업데이트');
  const result = await updateItemsWithSpecs(supabase, specsMap, specMap, logger);
  
  logger.log(`✅ material: ${result.materialUpdated}개, thickness: ${result.thicknessUpdated}개`, 'success');
  logger.log(`✅ width: ${result.widthUpdated}개, height: ${result.heightUpdated}개`, 'success');
  logger.log(`✅ specific_gravity: ${result.gravityUpdated}개, mm_weight: ${result.weightUpdated}개`, 'success');
  logger.log(`✅ spec: ${result.specUpdated}개`, 'success');
  logger.endPhase();

  // Step 4: 결과 요약
  logger.divider('=');
  logger.log('\n📊 재질 및 규격 정보 업데이트 결과\n', 'info');
  
  logger.table({
    '추출된 재질/치수': specsMap.size,
    '추출된 규격': specMap.size,
    'material 업데이트': result.materialUpdated,
    'thickness 업데이트': result.thicknessUpdated,
    'width 업데이트': result.widthUpdated,
    'height 업데이트': result.heightUpdated,
    'specific_gravity 업데이트': result.gravityUpdated,
    'mm_weight 업데이트': result.weightUpdated,
    'spec 업데이트': result.specUpdated
  });

  logger.endMigration(true);
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

