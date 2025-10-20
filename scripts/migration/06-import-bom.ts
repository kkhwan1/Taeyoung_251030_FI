/**
 * Phase 5: BOM(Bill of Materials) 관계 임포트
 *
 * 파싱된 BOM 데이터를 사용하여 품목 간 부품 구성 관계를 임포트합니다.
 * - parsed-bom.json → BOM 관계 (parent-child)
 * - item-code-map.json → parent_item_id, child_item_id FK 매핑
 * - level 1 = 직접 하위 부품, level 2 = 간접 하위 부품
 *
 * 실행: npm run migrate:bom
 */

import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient, batchInsert } from './utils/supabase-client';
import { createLogger } from './utils/logger';
import {
  ParseResult,
  BomExcelRow,
  ParsedBom,
  ItemCodeMap
} from './types/excel-data';

const DATA_DIR = path.resolve(process.cwd(), 'scripts/migration/data');
const ITEM_MAP_FILE = path.join(DATA_DIR, 'item-code-map.json');

/**
 * BOM 관계 추출 및 변환
 *
 * BOM Excel 구조:
 * - level 1: 부모 품목 (완제품/반제품)
 * - level 2: 자식 품목 (부품/원자재)
 *
 * 인접한 level 1 행과 level 2 행들을 매칭하여 부모-자식 관계 생성
 */
function extractBomRelationships(
  data: BomExcelRow[],
  itemCodeMap: ItemCodeMap,
  logger: ReturnType<typeof createLogger>
): ParsedBom[] {
  const bomRelationships: ParsedBom[] = [];
  let currentParent: BomExcelRow | null = null;
  let skippedNoParent = 0;
  let skippedNoMapping = 0;

  data.forEach((row, index) => {
    if (row.level === 1) {
      // Level 1: 부모 품목
      currentParent = row;
    } else if (row.level === 2 && currentParent) {
      // Level 2: 자식 품목 (부모가 있어야 함)
      const parentCode = currentParent.품번.trim();
      const childCode = row.품번.trim();

      // FK 매핑 검증
      if (!itemCodeMap.has(parentCode)) {
        logger.log(
          `⚠️  행 ${index + 2}: 부모 품목 코드 '${parentCode}' 매핑 없음`,
          'warn'
        );
        skippedNoMapping++;
        return;
      }

      if (!itemCodeMap.has(childCode)) {
        logger.log(
          `⚠️  행 ${index + 2}: 자식 품목 코드 '${childCode}' 매핑 없음`,
          'warn'
        );
        skippedNoMapping++;
        return;
      }

      const parentItemId = itemCodeMap.get(parentCode)!;
      const childItemId = itemCodeMap.get(childCode)!;

      // BOM 관계 생성
      bomRelationships.push({
        parent_item_id: parentItemId,
        child_item_id: childItemId,
        quantity: 1, // 기본 수량 1 (Excel에 수량 정보 없음)
        unit: row.단위 || 'EA',
        notes: row.규격 ? `규격: ${row.규격}` : undefined
      });
    } else if (row.level === 2 && !currentParent) {
      // Level 2인데 부모가 없음 (데이터 오류)
      logger.log(
        `⚠️  행 ${index + 2}: Level 2 품목인데 부모 품목이 없음 - ${row.품번}`,
        'warn'
      );
      skippedNoParent++;
    }
  });

  if (skippedNoParent > 0) {
    logger.log(`⚠️  부모 없는 Level 2 품목: ${skippedNoParent}개 스킵`, 'warn');
  }

  if (skippedNoMapping > 0) {
    logger.log(`⚠️  매핑 없는 품목 코드: ${skippedNoMapping}개 스킵`, 'warn');
  }

  return bomRelationships;
}

/**
 * 중복 BOM 관계 제거
 *
 * 동일한 parent_item_id + child_item_id 조합이 여러 번 나타날 수 있음
 * → 첫 번째 것만 유지, 나머지는 제거
 */
function deduplicateBomRelationships(
  relationships: ParsedBom[],
  logger: ReturnType<typeof createLogger>
): ParsedBom[] {
  const uniqueMap = new Map<string, ParsedBom>();

  relationships.forEach(rel => {
    const key = `${rel.parent_item_id}_${rel.child_item_id}`;

    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, rel);
    }
  });

  const originalCount = relationships.length;
  const uniqueCount = uniqueMap.size;
  const duplicateCount = originalCount - uniqueCount;

  if (duplicateCount > 0) {
    logger.log(
      `🔄 중복 BOM 관계 ${duplicateCount}개 제거 (${originalCount} → ${uniqueCount})`,
      'info'
    );
  }

  return Array.from(uniqueMap.values());
}

/**
 * BOM 관계 통계 생성
 */
function generateBomStats(
  relationships: ParsedBom[],
  logger: ReturnType<typeof createLogger>
): void {
  // 부모 품목별 자식 수
  const parentChildCount = new Map<number, number>();
  relationships.forEach(rel => {
    const count = parentChildCount.get(rel.parent_item_id) || 0;
    parentChildCount.set(rel.parent_item_id, count + 1);
  });

  // 통계
  const uniqueParents = parentChildCount.size;
  const uniqueChildren = new Set(relationships.map(r => r.child_item_id)).size;
  const maxChildren = Math.max(...Array.from(parentChildCount.values()));
  const avgChildren = relationships.length / uniqueParents;

  logger.table({
    '총 BOM 관계': relationships.length,
    '고유 부모 품목': uniqueParents,
    '고유 자식 품목': uniqueChildren,
    '최대 자식 수': maxChildren,
    '평균 자식 수': avgChildren.toFixed(2)
  });
}

async function main() {
  const logger = createLogger('BOM 임포트');
  logger.startMigration();

  // Step 1: 파싱된 데이터 및 매핑 로드
  logger.startPhase('파싱된 데이터 로드');

  const bomPath = path.join(DATA_DIR, 'parsed-bom.json');

  if (!fs.existsSync(bomPath)) {
    logger.log('❌ parsed-bom.json 파일이 없습니다. 먼저 02-parse-excel-files.ts를 실행하세요', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  if (!fs.existsSync(ITEM_MAP_FILE)) {
    logger.log('❌ item-code-map.json 파일이 없습니다. 먼저 05-import-items.ts를 실행하세요', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  const bomResult: ParseResult<BomExcelRow> = JSON.parse(
    fs.readFileSync(bomPath, 'utf-8')
  );
  const itemCodeMap: ItemCodeMap = new Map(
    Object.entries(JSON.parse(fs.readFileSync(ITEM_MAP_FILE, 'utf-8')))
  );

  logger.log(`BOM: ${bomResult.data.length} 레코드`, 'info');
  logger.log(`품목 매핑: ${itemCodeMap.size} 레코드`, 'info');
  logger.endPhase();

  // Step 2: BOM 관계 추출
  logger.startPhase('BOM 관계 추출');

  const rawRelationships = extractBomRelationships(
    bomResult.data,
    itemCodeMap,
    logger
  );

  logger.log(`추출된 BOM 관계: ${rawRelationships.length}개`, 'info');
  logger.endPhase();

  // Step 3: 중복 제거
  logger.startPhase('중복 관계 제거');

  const bomRelationships = deduplicateBomRelationships(rawRelationships, logger);

  logger.log(`최종 BOM 관계: ${bomRelationships.length}개`, 'success');
  logger.endPhase();

  // Step 4: BOM 통계 생성
  logger.startPhase('BOM 통계 생성');

  generateBomStats(bomRelationships, logger);

  logger.endPhase();

  // Step 5: Supabase 임포트
  logger.startPhase('Supabase 임포트');

  if (bomRelationships.length === 0) {
    logger.log('⚠️  임포트할 BOM 관계가 없습니다', 'warn');
    logger.endPhase();
    logger.endMigration(true);
    process.exit(0);
  }

  const supabase = createAdminClient();

  const result = await batchInsert(
    supabase,
    'bom',
    bomRelationships,
    100,
    (current, total) => {
      logger.progress(current, total, `${current}/${total} BOM 관계 임포트`);
    }
  );

  if (result.failed > 0) {
    logger.log(`⚠️  ${result.failed}개 BOM 관계 임포트 실패`, 'warn');
    result.errors.forEach(err => {
      logger.log(`  Batch ${err.batch}: ${err.error}`, 'error');
    });
  }

  logger.log(`✅ ${result.success}개 BOM 관계 임포트 완료`, 'success');
  logger.endPhase();

  // Step 6: 결과 요약
  logger.divider('=');
  logger.log('\n📊 BOM 임포트 결과\n', 'info');

  logger.table({
    '임포트 성공': result.success,
    '임포트 실패': result.failed,
    '고유 부모 품목': new Set(bomRelationships.map(r => r.parent_item_id)).size,
    '고유 자식 품목': new Set(bomRelationships.map(r => r.child_item_id)).size
  });

  const success = result.failed === 0;
  logger.endMigration(success);

  if (!success) {
    process.exit(1);
  }
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});
