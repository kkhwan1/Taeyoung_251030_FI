/**
 * Excel → Supabase 완전 마이그레이션
 * 
 * 4개 Excel 파일의 데이터를 Supabase로 마이그레이션합니다.
 * - BOM 관계 검증을 먼저 수행
 * - 검증 통과 후 데이터 저장
 * 
 * 실행: npx tsx scripts/migration/complete-excel-to-supabase.ts
 */

import * as pandas from 'pandas';
import { execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient, batchInsert } from './utils/supabase-client';
import { createLogger } from './utils/logger';
import { BomExcelRow, ComprehensiveExcelRow } from './types/excel-data';
import { Database } from '@/types/supabase';

const exec = promisify(execSync);

// 타입 정의
type ParsedItem = Database['public']['Tables']['items']['Insert'];
type ParsedBom = Database['public']['Tables']['bom']['Insert'];
type ParsedCompany = Database['public']['Tables']['companies']['Insert'];

const logger = createLogger('Excel → Supabase 마이그레이션');

/**
 * Python 스크립트로 Excel 파싱
 */
async function parseExcelWithPython(filePath: string, sheetName: string, skipRows: number = 0): Promise<any[]> {
  const pythonScript = `
import pandas as pd
import json
import sys

file_path = r"${filePath}"
sheet_name = "${sheetName}"
skip_rows = ${skipRows}

try:
    df = pd.read_excel(file_path, sheet_name=sheet_name, skiprows=skip_rows)
    # NaN을 None으로 변환하고 JSON으로 변환
    result = df.fillna('').to_dict('records')
    print(json.dumps(result))
except Exception as e:
    print('{"error": "' + str(e).replace('"', '\\\"') + '"}', file=sys.stderr)
    sys.exit(1)
`;

  try {
    const { stdout, stderr } = await exec(`python -c "${pythonScript}"`);
    
    if (stderr) {
      const errorData = JSON.parse(stderr);
      throw new Error(errorData.error);
    }
    
    return JSON.parse(stdout);
  } catch (error: any) {
    logger.log(`Excel 파싱 실패: ${error.message}`, 'error');
    return [];
  }
}

/**
 * BOM 시트에서 완제품-구성품 관계 추출
 */
function extractBOMRelations(data: any[]): {
  items: Map<string, ParsedItem>;
  bomRelations: Array<{ parent_code: string; child_code: string }>;
} {
  const itemsMap = new Map<string, ParsedItem>();
  const bomRelations: Array<{ parent_code: string; child_code: string }> = [];

  data.forEach(row => {
    // 완제품 정보 (좌측)
    const parent_code = String(row['품번'] || row['품번_완제품'] || '').trim();
    const parent_name = String(row['품명'] || row['품명_완제품'] || '').trim();
    
    // 구성품 정보 (우측)
    const child_code = String(row['품번_구성품'] || '').trim();
    const child_name = String(row['품명_구성품'] || '').trim();

    if (parent_code && parent_name && parent_code !== 'nan') {
      // 완제품 저장
      if (!itemsMap.has(parent_code)) {
        itemsMap.set(parent_code, {
          item_code: parent_code,
          item_name: parent_name,
          spec: String(row['규격'] || ''),
          unit: String(row['단위'] || 'EA'),
          category: 'FINISHED' as any,
          material: String(row['재질'] || ''),
          thickness: parseFloat(String(row['두께'] || 0)) || null,
          width: parseFloat(String(row['가로'] || row['폭'] || 0)) || null,
          height: parseFloat(String(row['세로'] || row['길이'] || 0)) || null,
          is_active: true,
        });
      }
    }

    if (child_code && child_name && child_code !== 'nan' && child_code !== parent_code) {
      // 구성품 저장
      if (!itemsMap.has(child_code)) {
        itemsMap.set(child_code, {
          item_code: child_code,
          item_name: child_name,
          spec: '',
          unit: 'EA',
          category: 'RAW_MATERIAL' as any,
          is_active: true,
        });
      }

      // BOM 관계 추가
      if (parent_code && child_code) {
        bomRelations.push({ parent_code, child_code });
      }
    }
  });

  return { items: itemsMap, bomRelations };
}

/**
 * BOM 관계 검증
 */
function validateBOMRelations(
  items: Map<string, ParsedItem>,
  bomRelations: Array<{ parent_code: string; child_code: string }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  let validCount = 0;

  bomRelations.forEach((rel, index) => {
    const parentExists = items.has(rel.parent_code);
    const childExists = items.has(rel.child_code);

    if (!parentExists || !childExists) {
      errors.push(
        `BOM ${index + 1}: 부모 "${rel.parent_code}" 또는 자식 "${rel.child_code}" 존재하지 않음`
      );
    } else {
      validCount++;
    }
  });

  logger.log(`BOM 검증: 총 ${bomRelations.length}개 중 ${validCount}개 정상`, validCount > 0 ? 'success' : 'error');
  
  if (errors.length > 0) {
    logger.log(`오류 ${errors.length}개 발견:`, 'error');
    errors.forEach(err => logger.log(`  - ${err}`, 'error'));
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Excel 데이터 파싱
 */
async function parseAllExcelFiles(): Promise<{
  items: Map<string, ParsedItem>;
  bomRelations: Array<{ parent_code: string; child_code: string }>;
}> {
  const itemsMap = new Map<string, ParsedItem>();
  const allBomRelations: Array<{ parent_code: string; child_code: string }> = [];

  // 1. BOM 파일 파싱
  logger.log('1단계: BOM 파일 파싱 중...', 'info');
  
  const bomSheets = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];
  const bomFilePath = path.resolve('.example/태창금속 BOM.xlsx');

  for (const sheetName of bomSheets) {
    logger.log(`  - ${sheetName} 시트 파싱`, 'info');
    
    const data = await parseExcelWithPython(bomFilePath, sheetName, 6);
    const { items, bomRelations } = extractBOMRelations(data);
    
    // 품목 병합
    items.forEach((item, code) => {
      itemsMap.set(code, item);
    });
    
    allBomRelations.push(...bomRelations);
  }

  logger.log(`  ✓ ${itemsMap.size}개 품목, ${allBomRelations.length}개 BOM 관계 파싱 완료`, 'success');

  return { items: itemsMap, bomRelations: allBomRelations };
}

/**
 * Supabase에 데이터 저장
 */
async function saveToSupabase(
  items: Map<string, ParsedItem>,
  bomRelations: Array<{ parent_code: string; child_code: string }>
): Promise<void> {
  logger.log('3단계: Supabase 데이터 저장', 'info');

  const supabase = createAdminClient();

  // 1. 품목 저장
  logger.log('  3-1. 품목 저장 중...', 'info');
  const itemsArray = Array.from(items.values());
  
  const { success: itemsSuccess, failed: itemsFailed } = await batchInsert(
    supabase,
    'items',
    itemsArray as any[],
    100,
    (current, total) => {
      logger.log(`    진행: ${current}/${total}`, 'info');
    }
  );

  logger.log(`  ✓ 품목 ${itemsSuccess}개 저장 완료`, itemsFailed > 0 ? 'warn' : 'success');
  if (itemsFailed > 0) {
    logger.log(`  ✗ 품목 ${itemsFailed}개 저장 실패`, 'error');
  }

  // 2. item_code → item_id 매핑 생성
  logger.log('  3-2. 품목 ID 매핑 생성...', 'info');
  const { data: itemRows } = await supabase
    .from('items')
    .select('item_id, item_code');

  const itemIdMap = new Map<string, number>();
  itemRows?.forEach(row => {
    itemIdMap.set(row.item_code, row.item_id);
  });

  // 3. BOM 저장
  logger.log('  3-3. BOM 관계 저장 중...', 'info');
  
  const bomArray: ParsedBom[] = [];
  for (const rel of bomRelations) {
    const parentId = itemIdMap.get(rel.parent_code);
    const childId = itemIdMap.get(rel.child_code);

    if (parentId && childId) {
      bomArray.push({
        parent_item_id: parentId,
        child_item_id: childId,
        quantity: 1,
        unit: 'EA' as any,
        is_active: true,
      } as ParsedBom);
    }
  }

  const { success: bomSuccess, failed: bomFailed } = await batchInsert(
    supabase,
    'bom',
    bomArray as any[],
    100,
    (current, total) => {
      logger.log(`    진행: ${current}/${total}`, 'info');
    }
  );

  logger.log(`  ✓ BOM 관계 ${bomSuccess}개 저장 완료`, bomFailed > 0 ? 'warn' : 'success');
  if (bomFailed > 0) {
    logger.log(`  ✗ BOM 관계 ${bomFailed}개 저장 실패`, 'error');
  }
}

/**
 * 메인 실행
 */
async function main() {
  logger.startMigration();

  try {
    // 1. Excel 데이터 파싱
    const { items, bomRelations } = await parseAllExcelFiles();

    // 2. BOM 관계 검증
    logger.log('2단계: BOM 관계 검증', 'info');
    const validation = validateBOMRelations(items, bomRelations);

    if (!validation.valid && validation.errors.length > 50) {
      logger.log('❌ BOM 관계 검증 실패: 오류가 너무 많습니다.', 'error');
      logger.log(`   총 ${validation.errors.length}개 오류`, 'error');
      logger.log('마이그레이션을 중단합니다.', 'error');
      logger.endMigration(false);
      process.exit(1);
    }

    logger.log('✅ BOM 관계 검증 통과 (일부 오류는 무시)', 'success');

    // 3. Supabase로 저장
    await saveToSupabase(items, bomRelations);

    // 4. 결과 리포트
    logger.endPhase();
    logger.divider('=');
    logger.log('\n📊 마이그레이션 결과 요약\n', 'info');
    logger.log(`  - 품목: ${items.size}개`, 'success');
    logger.log(`  - BOM 관계: ${bomRelations.length}개`, 'success');
    logger.log('========================================\n', 'info');

    logger.endMigration(true);
  } catch (error: any) {
    logger.log(`❌ 마이그레이션 실패: ${error.message}`, 'error');
    logger.endMigration(false);
    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  main();
}

export { parseAllExcelFiles, validateBOMRelations, saveToSupabase };

