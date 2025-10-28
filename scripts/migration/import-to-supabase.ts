/**
 * Supabase 데이터 임포트 스크립트
 * 
 * 검증된 BOM 데이터를 Supabase에 저장합니다.
 * 
 * 실행: npx tsx scripts/migration/import-to-supabase.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient, batchInsert, testConnection } from './utils/supabase-client';
import { createLogger } from './utils/logger';
import { Database } from '@/types/supabase';

type ParsedItem = Database['public']['Tables']['items']['Insert'];
type ParsedBom = Database['public']['Tables']['bom']['Insert'];

const logger = createLogger('Supabase 임포트');

/**
 * JSON 파일 읽기
 */
function readJsonFile(filePath: string): any {
  const content = fs.readFileSync(filePath, 'utf-8');
  // stderr 메시지 제거
  const lines = content.split('\n').filter(line => 
    !line.includes('파싱 중:')
  ).join('\n');
  return JSON.parse(lines);
}

/**
 * 품목 데이터 변환
 */
function transformItems(items: any[]): ParsedItem[] {
  return items.map(item => ({
    item_code: item.item_code,
    item_name: item.item_name,
    spec: item.spec || '',
    unit: 'EA',
    category: item.is_parent ? 'FINISHED' : 'RAW_MATERIAL' as any,
    vehicle_model: item.vehicle_model || null,
    location: item.delivery_place || item.supplier || null,
    is_active: true,
  }));
}

/**
 * BOM 관계 데이터 변환
 */
function transformBomRelations(
  bomRelations: Array<{ parent_code: string; child_code: string }>,
  itemIdMap: Map<string, number>
): ParsedBom[] {
  return bomRelations
    .filter(rel => {
      const parentId = itemIdMap.get(rel.parent_code);
      const childId = itemIdMap.get(rel.child_code);
      return parentId && childId;
    })
    .map(rel => ({
      parent_item_id: itemIdMap.get(rel.parent_code)!,
      child_item_id: itemIdMap.get(rel.child_code)!,
      quantity: 1,
      unit: 'EA' as any,
      is_active: true,
    }));
}

/**
 * 메인 실행
 */
async function main() {
  logger.startMigration();

  try {
    // 1. Supabase 연결 테스트
    logger.log('1단계: Supabase 연결 테스트', 'info');
    const supabase = createAdminClient();
    
    const connected = await testConnection(supabase);
    if (!connected) {
      logger.log('❌ Supabase 연결 실패', 'error');
      logger.endMigration(false);
      process.exit(1);
    }

    // 2. 데이터 로드
    logger.log('2단계: 파싱된 데이터 로드', 'info');
    const bomData = readJsonFile(path.resolve('.example/parsed_bom.json'));
    
    logger.log(`  - 품목: ${bomData.total_items}개`, 'info');
    logger.log(`  - BOM 관계: ${bomData.total_bom_relations}개\n`, 'info');

    // 3. 품목 저장
    logger.log('3단계: 품목 데이터 변환 및 저장', 'info');
    const items = transformItems(bomData.items);
    
    const { success: itemsSuccess, failed: itemsFailed } = await batchInsert(
      supabase,
      'items',
      items as any[],
      100,
      (current, total) => {
        logger.log(`  진행: ${current}/${total}`, 'info');
      }
    );

    logger.log(`  ✓ 품목 ${itemsSuccess}개 저장 완료`, itemsFailed > 0 ? 'warn' : 'success');
    if (itemsFailed > 0) {
      logger.log(`  ✗ 품목 ${itemsFailed}개 저장 실패`, 'error');
    }

    // 4. item_id 매핑 생성
    logger.log('4단계: 품목 ID 매핑 생성', 'info');
    const { data: itemRows } = await supabase
      .from('items')
      .select('item_id, item_code');

    if (!itemRows) {
      throw new Error('품목 데이터를 가져올 수 없습니다.');
    }

    const itemIdMap = new Map<string, number>();
    itemRows.forEach(row => {
      itemIdMap.set(row.item_code, row.item_id);
    });

    logger.log(`  ✓ ${itemIdMap.size}개 품목 ID 매핑 생성`, 'success');

    // 5. BOM 관계 저장
    logger.log('5단계: BOM 관계 저장', 'info');
    const bomArray = transformBomRelations(bomData.bom_relations, itemIdMap);
    
    const { success: bomSuccess, failed: bomFailed } = await batchInsert(
      supabase,
      'bom',
      bomArray as any[],
      100,
      (current, total) => {
        logger.log(`  진행: ${current}/${total}`, 'info');
      }
    );

    logger.log(`  ✓ BOM 관계 ${bomSuccess}개 저장 완료`, bomFailed > 0 ? 'warn' : 'success');
    if (bomFailed > 0) {
      logger.log(`  ✗ BOM 관계 ${bomFailed}개 저장 실패`, 'error');
    }

    // 6. 결과 리포트
    logger.endPhase();
    logger.divider('=');
    logger.log('\n📊 마이그레이션 결과 요약\n', 'info');
    logger.log(`  - 품목 저장: ${itemsSuccess}/${items.length}개 성공`, itemsFailed > 0 ? 'warn' : 'success');
    logger.log(`  - BOM 관계 저장: ${bomSuccess}/${bomArray.length}개 성공`, bomFailed > 0 ? 'warn' : 'success');
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

export { transformItems, transformBomRelations };

