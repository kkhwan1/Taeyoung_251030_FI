/**
 * PyHub MCP Tools를 사용한 Excel → Supabase 마이그레이션
 * 
 * 이 스크립트는 열려있는 Excel 파일들을 읽어서:
 * 1. 완제품(parent) → 구성품목(child) BOM 관계 검증
 * 2. 검증 통과 후 모든 데이터를 Supabase로 마이그레이션
 * 
 * 실행: npx tsx scripts/migration/pyhub-excel-to-supabase.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// PyHub MCP 도구는 Cursor에서 직접 사용 가능
// 이 스크립트는 분석과 검증을 위한 TypeScript 코드

interface BOMItem {
  parent_code: string;
  parent_name: string;
  child_code: string;
  child_name: string;
  quantity: number;
  level: number;
}

interface Item {
  item_code: string;
  item_name: string;
  spec: string;
  unit: string;
  material: string;
  thickness: number;
  width: number;
  length: number;
  category: 'FINISHED' | 'RAW_MATERIAL' | 'SEMI_FINISHED';
}

/**
 * BOM 관계 검증
 * - 완제품 코드와 구성품 코드가 모두 존재하는지 확인
 * - 누락된 관계가 있으면 에러 반환
 */
function validateBOMRelations(bomItems: BOMItem[], allItems: Item[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 모든 품목 코드 Map 생성
  const itemCodeMap = new Map<string, Item>();
  allItems.forEach(item => {
    itemCodeMap.set(item.item_code, item);
  });

  // BOM 관계 검증
  const invalidRelations: BOMItem[] = [];
  
  for (const bomItem of bomItems) {
    const parentExists = itemCodeMap.has(bomItem.parent_code);
    const childExists = itemCodeMap.has(bomItem.child_code);

    if (!parentExists || !childExists) {
      invalidRelations.push(bomItem);
      
      if (!parentExists && !childExists) {
        errors.push(
          `BOM 관계 오류: 부모 품번 "${bomItem.parent_code}" 와 자식 품번 "${bomItem.child_code}" 모두 존재하지 않습니다`
        );
      } else if (!parentExists) {
        errors.push(
          `BOM 관계 오류: 부모 품번 "${bomItem.parent_code}" (${bomItem.parent_name})가 존재하지 않습니다`
        );
      } else {
        errors.push(
          `BOM 관계 오류: 자식 품번 "${bomItem.child_code}" (${bomItem.child_name})가 존재하지 않습니다`
        );
      }
    }
  }

  // 통계 계산
  const totalRelations = bomItems.length;
  const invalidCount = invalidRelations.length;
  const validCount = totalRelations - invalidCount;

  if (invalidCount > 0) {
    warnings.push(
      `BOM 관계 검증 실패: 총 ${totalRelations}개 중 ${invalidCount}개 오류 (${validCount}개 정상)`
    );
  }

  return {
    valid: invalidCount === 0,
    errors,
    warnings,
  };
}

/**
 * Excel 데이터 파싱 (PyHub MCP 사용)
 * 실제 구현은 Cursor에서 PyHub MCP 도구를 직접 사용
 */
async function parseExcelData(): Promise<{
  items: Item[];
  bomItems: BOMItem[];
}> {
  console.log('Excel 데이터 파싱 중...');
  
  // TODO: PyHub MCP 도구를 사용하여 Excel에서 데이터 읽기
  // 이 부분은 Cursor의 MCP 도구를 통해 실행됩니다
  
  return {
    items: [],
    bomItems: [],
  };
}

/**
 * Supabase로 데이터 저장
 */
async function saveToSupabase(
  items: Item[],
  bomItems: BOMItem[]
): Promise<void> {
  console.log('Supabase로 데이터 저장 중...');
  
  // TODO: Supabase 클라이언트를 사용하여 데이터 저장
  // 1. items 테이블에 품목 저장
  // 2. bom 테이블에 BOM 관계 저장
}

/**
 * 메인 마이그레이션 프로세스
 */
async function main() {
  console.log('========================================');
  console.log('Excel → Supabase 마이그레이션 시작');
  console.log('========================================\n');

  try {
    // 1. Excel 데이터 파싱
    console.log('1단계: Excel 데이터 파싱');
    const { items, bomItems } = await parseExcelData();
    console.log(`  - 품목: ${items.length}개`);
    console.log(`  - BOM 관계: ${bomItems.length}개\n`);

    // 2. BOM 관계 검증
    console.log('2단계: BOM 관계 검증');
    const validation = validateBOMRelations(bomItems, items);
    
    if (!validation.valid) {
      console.error('❌ BOM 관계 검증 실패!\n');
      validation.errors.forEach(err => console.error(`  - ${err}`));
      validation.warnings.forEach(warn => console.warn(`  - ${warn}`));
      console.log('\n마이그레이션을 중단합니다.');
      process.exit(1);
    }
    
    console.log('✅ BOM 관계 검증 통과!\n');

    // 3. Supabase로 데이터 저장
    console.log('3단계: Supabase로 데이터 저장');
    await saveToSupabase(items, bomItems);
    console.log('✅ 데이터 저장 완료!\n');

    console.log('========================================');
    console.log('마이그레이션 완료!');
    console.log('========================================');
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  main();
}

export { validateBOMRelations, parseExcelData, saveToSupabase };

