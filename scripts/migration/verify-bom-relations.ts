/**
 * BOM 관계 검증 스크립트
 * 
 * 파싱된 BOM 데이터에서 완제품-구성품 관계가 정확한지 검증합니다.
 * 
 * 실행: npx tsx scripts/migration/verify-bom-relations.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './utils/logger';

interface BOMData {
  total_items: number;
  total_bom_relations: number;
  items: Array<{
    item_code: string;
    item_name: string;
    delivery_place?: string;
    supplier?: string;
    vehicle_model: string;
    is_parent: boolean;
  }>;
  bom_relations: Array<{
    parent_code: string;
    child_code: string;
  }>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  validCount: number;
  invalidCount: number;
  missingParents: Set<string>;
  missingChildren: Set<string>;
}

/**
 * BOM 관계 검증
 */
function validateBOMRelations(data: BOMData): ValidationResult {
  const logger = createLogger('BOM 검증');
  logger.startMigration();

  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    validCount: 0,
    invalidCount: 0,
    missingParents: new Set(),
    missingChildren: new Set(),
  };

  // 모든 품목 코드를 Set으로 변환
  const itemCodes = new Set<string>(
    data.items.map(item => item.item_code)
  );

  logger.log(`총 품목: ${itemCodes.size}개`, 'info');
  logger.log(`총 BOM 관계: ${data.bom_relations.length}개\n`, 'info');

  // 각 BOM 관계 검증
  data.bom_relations.forEach((relation, index) => {
    const parentExists = itemCodes.has(relation.parent_code);
    const childExists = itemCodes.has(relation.child_code);

    if (!parentExists) {
      result.missingParents.add(relation.parent_code);
      result.invalidCount++;
      result.errors.push(
        `BOM ${index + 1}: 부모 품번 "${relation.parent_code}" 존재하지 않음`
      );
    }

    if (!childExists) {
      result.missingChildren.add(relation.child_code);
      result.invalidCount++;
      result.errors.push(
        `BOM ${index + 1}: 자식 품번 "${relation.child_code}" 존재하지 않음`
      );
    }

    if (parentExists && childExists) {
      result.validCount++;
    }
  });

  // 결과 로깅
  logger.log('📊 검증 결과\n', 'info');
  logger.log(`✅ 정상 관계: ${result.validCount}개`, 'success');
  logger.log(`❌ 오류 관계: ${result.invalidCount}개`, result.invalidCount > 0 ? 'error' : 'success');

  if (result.missingParents.size > 0) {
    logger.log(`\n결과 미존재 부모 품번: ${result.missingParents.size}개`, 'warn');
    result.missingParents.forEach(code => {
      logger.log(`  - ${code}`, 'warn');
    });
  }

  if (result.missingChildren.size > 0) {
    logger.log(`\n결과 미존재 자식 품번: ${result.missingChildren.size}개`, 'warn');
    result.missingChildren.forEach(code => {
      logger.log(`  - ${code}`, 'warn');
    });
  }

  // 최종 판정
  if (result.invalidCount > 0) {
    result.valid = false;
    
    // 오류 비율 확인
    const errorRate = (result.invalidCount / data.bom_relations.length) * 100;
    logger.log(`\n오류 비율: ${errorRate.toFixed(1)}%`, 'error');

    // 오류가 너무 많으면 중단
    if (errorRate > 20) {
      logger.log('❌ 오류가 너무 많아 마이그레이션을 중단합니다.', 'error');
      result.valid = false;
    } else {
      logger.log('⚠️ 일부 오류가 있으나 계속 진행합니다.', 'warn');
    }
  }

  logger.endPhase();

  return result;
}

/**
 * 메인 실행
 */
async function main() {
  const logger = createLogger('BOM 검증');
  logger.startMigration();

  try {
    // 1. 파싱된 JSON 읽기
    logger.log('1단계: 파싱된 데이터 읽기', 'info');
    const jsonPath = path.resolve('.example/parsed_bom.json');
    
    if (!fs.existsSync(jsonPath)) {
      logger.log('❌ 파싱된 데이터 파일을 찾을 수 없습니다.', 'error');
      logger.log(`   경로: ${jsonPath}`, 'error');
      logger.endMigration(false);
      process.exit(1);
    }

    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
    // stderr 출력 제거
    const cleanJson = jsonContent.split('\n').filter(line => 
      !line.includes('파싱 중:')
    ).join('\n');
    
    const data: BOMData = JSON.parse(cleanJson);
    logger.log(`  ✓ 품목: ${data.total_items}개`, 'success');
    logger.log(`  ✓ BOM 관계: ${data.total_bom_relations}개\n`, 'success');

    // 2. BOM 관계 검증
    logger.log('2단계: BOM 관계 검증', 'info');
    const validation = validateBOMRelations(data);

    // 3. 결과 저장
    logger.log('3단계: 검증 결과 저장', 'info');
    const resultPath = path.resolve('.example/bom_validation_result.json');
    fs.writeFileSync(resultPath, JSON.stringify({
      validation,
      summary: {
        totalItems: data.total_items,
        totalBOMRelations: data.bom_relations.length,
        validRelations: validation.validCount,
        invalidRelations: validation.invalidCount,
        errorRate: ((validation.invalidCount / data.bom_relations.length) * 100).toFixed(1) + '%',
      }
    }, null, 2));

    logger.log(`  ✓ 검증 결과 저장: ${resultPath}`, 'success');

    // 4. 최종 판정
    logger.endPhase();
    logger.divider('=');
    logger.log('\n📊 BOM 검증 최종 결과\n', 'info');
    logger.log(`  - 총 품목: ${data.total_items}개`, validation.valid ? 'success' : 'warn');
    logger.log(`  - 총 BOM 관계: ${data.bom_relations.length}개`, validation.valid ? 'success' : 'warn');
    logger.log(`  - 정상 관계: ${validation.validCount}개`, 'success');
    logger.log(`  - 오류 관계: ${validation.invalidCount}개`, validation.invalidCount > 0 ? 'error' : 'success');
    
    if (validation.valid) {
      logger.log('\n✅ BOM 관계 검증 통과!', 'success');
      logger.log('다음 단계: Supabase에 데이터 저장', 'info');
    } else {
      logger.log('\n❌ BOM 관계 검증 실패!', 'error');
      logger.log('마이그레이션을 중단합니다.', 'error');
    }

    logger.endMigration(validation.valid);
    
    if (!validation.valid) {
      process.exit(1);
    }

  } catch (error: any) {
    logger.log(`❌ BOM 검증 실패: ${error.message}`, 'error');
    logger.endMigration(false);
    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  main();
}

export { validateBOMRelations };

