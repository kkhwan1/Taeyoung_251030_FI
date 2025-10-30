/**
 * 빈 필드 채우기 스크립트
 *
 * 엑셀 파일에서 추가 정보를 추출하여 items 테이블과 inventory_transactions 테이블의
 * 빈 필드들을 채웁니다.
 *
 * 채우는 필드:
 * - items.spec (규격)
 * - items.vehicle_model (차종)
 * - items.supplier_id (거래처 ID)
 * - items.description (설명)
 * - inventory_transactions.company_id (거래처 ID)
 *
 * 실행: npx tsx scripts/migration/fill-empty-fields.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';
import { Database } from '@/types/supabase';

const INVENTORY_EXCEL = '09월 원자재 수불관리.xlsx';
const BOM_EXCEL = '태창금속 BOM.xlsx';
const EXCEL_DIR = path.resolve(process.cwd(), '.example');

type Item = Database['public']['Tables']['items']['Row'];
type Company = Database['public']['Tables']['companies']['Row'];

interface ItemFieldUpdate {
  item_code: string;
  spec?: string | null;
  vehicle_model?: string | null;
  description?: string | null;
  supplier_id?: number | null;
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
 * 일반 공급사 시트에서 규격(spec) 정보 추출
 */
function extractSpecFromVendorSheets(): Map<string, string> {
  const specMap = new Map<string, string>();

  try {
    const workbook = readExcelFile(INVENTORY_EXCEL);
    
    // 일반 공급사 시트 목록
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
      const itemNameCol = 4;
      const specCol = 6;

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
 * 재고관리 및 입고현황 시트에서 차종(vehicle_model) 정보 추출
 */
function extractVehicleModelFromSheets(): Map<string, string> {
  const vehicleMap = new Map<string, string>();

  try {
    const workbook = readExcelFile(INVENTORY_EXCEL);
    
    // 재고관리 시트
    const inventorySheets = ['MV1 , SV (재고관리)', 'TAM,KA4,인알파', 'DL3 GL3 (재고관리)'];
    
    for (const sheetName of inventorySheets) {
      if (!workbook.SheetNames.includes(sheetName)) continue;

      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false,
        range: 1 // 헤더 포함
      }) as any[][];

      const VEHICLE_COL = 0;
      const PARENT_CODE_COL = 1;
      const CHILD_CODE_COL = 5;

      let currentVehicle = '';

      for (let i = 2; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const vehicle = String(row[VEHICLE_COL] || '').trim();
        if (vehicle && vehicle !== '') {
          currentVehicle = vehicle;
        }

        const parentCode = String(row[PARENT_CODE_COL] || '').trim();
        const childCode = String(row[CHILD_CODE_COL] || '').trim();

        if (currentVehicle) {
          if (parentCode && !vehicleMap.has(parentCode)) {
            vehicleMap.set(parentCode, currentVehicle);
          }
          if (childCode && !vehicleMap.has(childCode)) {
            vehicleMap.set(childCode, currentVehicle);
          }
        }
      }
    }

    // 입고현황 시트
    const receivingSheets = ['대우사급 입고현황', '호원사급 입고현황', '협력업체 입고현황'];
    
    for (const sheetName of receivingSheets) {
      if (!workbook.SheetNames.includes(sheetName)) continue;

      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false,
        range: 0
      }) as any[][];

      const VEHICLE_COL = 2;
      const ITEM_CODE_COL = 3;

      for (let i = 2; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const vehicleModel = String(row[VEHICLE_COL] || '').trim();
        const itemCode = String(row[ITEM_CODE_COL] || '').trim();

        if (itemCode && vehicleModel && !vehicleMap.has(itemCode)) {
          vehicleMap.set(itemCode, vehicleModel);
        }
      }
    }

    // 태창금속 (전착도장) 시트
    if (workbook.SheetNames.includes('태창금속 (전착도장)')) {
      const worksheet = workbook.Sheets['태창금속 (전착도장)'];
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false,
        range: 2
      }) as any[][];

      const VEHICLE_COL = 0;
      const ITEM_CODE_COL = 2;

      for (let i = 2; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const vehicleModel = String(row[VEHICLE_COL] || '').trim();
        const itemCode = String(row[ITEM_CODE_COL] || '').trim();

        if (itemCode && vehicleModel && !vehicleMap.has(itemCode)) {
          vehicleMap.set(itemCode, vehicleModel);
        }
      }
    }

    // 실적 취합 시트
    if (workbook.SheetNames.includes('실적 취합')) {
      const worksheet = workbook.Sheets['실적 취합'];
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false,
        range: 1
      }) as any[][];

      const VEHICLE_COL = 1;
      const ITEM_CODE_COL = 2;

      for (let i = 2; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const vehicleModel = String(row[VEHICLE_COL] || '').trim();
        const itemCode = String(row[ITEM_CODE_COL] || '').trim();

        if (itemCode && vehicleModel && !vehicleMap.has(itemCode)) {
          vehicleMap.set(itemCode, vehicleModel);
        }
      }
    }
  } catch (error: any) {
    console.error(`차종 추출 오류: ${error.message}`);
  }

  return vehicleMap;
}

/**
 * 거래처 이름 → company_id 매핑 생성
 */
async function getCompanyIdMap(
  supabase: ReturnType<typeof createAdminClient>
): Promise<Map<string, number>> {
  const { data: companies, error } = await supabase
    .from('companies')
    .select('company_id, company_name');

  if (error) {
    throw new Error(`거래처 조회 실패: ${error.message}`);
  }

  const companyMap = new Map<string, number>();
  companies?.forEach(company => {
    companyMap.set(company.company_name, company.company_id);
  });

  return companyMap;
}

/**
 * Items 테이블의 빈 필드 업데이트
 */
async function updateItemsFields(
  supabase: ReturnType<typeof createAdminClient>,
  specMap: Map<string, string>,
  vehicleMap: Map<string, string>,
  companyMap: Map<string, number>,
  logger: ReturnType<typeof createLogger>
): Promise<{ specUpdated: number; vehicleUpdated: number; supplierUpdated: number; descUpdated: number }> {
  // 1. 모든 품목 조회 (빈 필드 확인)
  const { data: items, error: fetchError } = await supabase
    .from('items')
    .select('item_id, item_code, item_name, spec, vehicle_model, supplier_id, description');

  if (fetchError) {
    throw new Error(`품목 조회 실패: ${fetchError.message}`);
  }

  if (!items) return { specUpdated: 0, vehicleUpdated: 0, supplierUpdated: 0, descUpdated: 0 };

  let specUpdated = 0;
  let vehicleUpdated = 0;
  let supplierUpdated = 0;
  let descUpdated = 0;

  // 2. 업데이트 대상 필터링 및 업데이트
  const updates: Array<{ item_id: number; updates: Partial<Item> }> = [];

  for (const item of items) {
    const updatesToApply: Partial<Item> = {};

    // spec 업데이트 (NULL이고 엑셀에 있으면)
    if ((!item.spec || item.spec === '') && specMap.has(item.item_code)) {
      updatesToApply.spec = specMap.get(item.item_code) || null;
      specUpdated++;
    }

    // vehicle_model 업데이트 (NULL이고 엑셀에 있으면)
    if ((!item.vehicle_model || item.vehicle_model === '') && vehicleMap.has(item.item_code)) {
      updatesToApply.vehicle_model = vehicleMap.get(item.item_code) || null;
      vehicleUpdated++;
    }

    // supplier_id 업데이트 (거래처 정보가 있으면)
    // 시트명에서 거래처 추출하는 로직 추가 가능

    // description 생성 (품명 + 규격 조합)
    if (!item.description && (item.item_name || item.spec)) {
      const parts: string[] = [];
      if (item.item_name) parts.push(item.item_name);
      if (item.spec) parts.push(`규격: ${item.spec}`);
      if (item.vehicle_model) parts.push(`차종: ${item.vehicle_model}`);
      
      if (parts.length > 0) {
        updatesToApply.description = parts.join(' | ');
        descUpdated++;
      }
    }

    if (Object.keys(updatesToApply).length > 0) {
      updates.push({ item_id: item.item_id, updates: updatesToApply });
    }
  }

  // 3. 배치 업데이트
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

  return { specUpdated, vehicleUpdated, supplierUpdated, descUpdated };
}

/**
 * Inventory Transactions의 company_id 업데이트
 */
async function updateTransactionCompanyIds(
  supabase: ReturnType<typeof createAdminClient>,
  companyMap: Map<string, number>,
  logger: ReturnType<typeof createLogger>
): Promise<number> {
  // 참고용으로만 - 실제로는 description이나 reference_number에서 거래처 이름을 추출해야 함
  // 현재는 시트명 기반으로 추출했으므로 다시 매핑 필요
  
  // 1. company_id가 NULL인 거래 조회
  const { data: transactions, error: fetchError } = await supabase
    .from('inventory_transactions')
    .select('transaction_id, reference_number, description')
    .is('company_id', null)
    .limit(1000);

  if (fetchError) {
    throw new Error(`거래 조회 실패: ${fetchError.message}`);
  }

  if (!transactions || transactions.length === 0) {
    logger.log('업데이트할 거래가 없습니다', 'info');
    return 0;
  }

  let updated = 0;

  // reference_number에서 거래처 이름 추출 시도
  // 형식: AUTO-{거래처명}-...
  for (const txn of transactions) {
    const ref = txn.reference_number || '';
    const match = ref.match(/AUTO-([^-]+)-/);
    
    if (match) {
      const companyName = match[1].trim();
      const companyId = companyMap.get(companyName);

      if (companyId) {
        const { error } = await supabase
          .from('inventory_transactions')
          .update({ company_id: companyId })
          .eq('transaction_id', txn.transaction_id);

        if (error) {
          logger.log(`  ⚠️  거래 ${txn.transaction_id}: ${error.message}`, 'warn');
        } else {
          updated++;
        }
      }
    }
  }

  return updated;
}

/**
 * Main function
 */
async function main() {
  const logger = createLogger('빈 필드 채우기');
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

  // Step 2: 엑셀에서 정보 추출
  logger.startPhase('엑셀에서 정보 추출');
  
  logger.log('규격(spec) 정보 추출 중...', 'info');
  const specMap = extractSpecFromVendorSheets();
  logger.log(`✅ ${specMap.size}개 품목의 규격 추출`, 'success');

  logger.log('차종(vehicle_model) 정보 추출 중...', 'info');
  const vehicleMap = extractVehicleModelFromSheets();
  logger.log(`✅ ${vehicleMap.size}개 품목의 차종 추출`, 'success');

  logger.log('거래처 ID 매핑 생성 중...', 'info');
  const companyMap = await getCompanyIdMap(supabase);
  logger.log(`✅ ${companyMap.size}개 거래처 매핑 생성`, 'success');
  
  logger.endPhase();

  // Step 3: Items 테이블 업데이트
  logger.startPhase('Items 테이블 빈 필드 업데이트');
  const { specUpdated, vehicleUpdated, supplierUpdated, descUpdated } = 
    await updateItemsFields(supabase, specMap, vehicleMap, companyMap, logger);
  
  logger.log(`✅ spec: ${specUpdated}개, vehicle_model: ${vehicleUpdated}개, description: ${descUpdated}개 업데이트`, 'success');
  logger.endPhase();

  // Step 4: Inventory Transactions 업데이트
  logger.startPhase('Inventory Transactions company_id 업데이트');
  const transactionsUpdated = await updateTransactionCompanyIds(supabase, companyMap, logger);
  logger.log(`✅ ${transactionsUpdated}개 거래의 company_id 업데이트`, 'success');
  logger.endPhase();

  // Step 5: 결과 요약
  logger.divider('=');
  logger.log('\n📊 빈 필드 채우기 결과 요약\n', 'info');
  
  logger.table({
    '추출된 규격': specMap.size,
    '추출된 차종': vehicleMap.size,
    'spec 업데이트': specUpdated,
    'vehicle_model 업데이트': vehicleUpdated,
    'description 업데이트': descUpdated,
    'company_id 업데이트': transactionsUpdated
  });

  logger.endMigration(true);
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

