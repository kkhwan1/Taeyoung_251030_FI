/**
 * BOM 자식 품목 단가/단위 보강
 * - bom 자식 품목 중 price NULL/0 → '태창금속 BOM.xlsx/최신단가'에서 업데이트
 * - unit NULL → 'EA'로 표준화
 *
 * 실행: npx tsx scripts/migration/update-bom-child-prices.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';

const PRICE_EXCEL = '태창금속 BOM.xlsx';
const PRICE_SHEET = '최신단가';
const EXCEL_DIR = path.resolve(process.cwd(), '.example');

function readExcelFile(filename: string): XLSX.WorkBook {
  const filePath = path.join(EXCEL_DIR, filename);
  if (!fs.existsSync(filePath)) throw new Error(`Excel 파일을 찾을 수 없습니다: ${filePath}`);
  return XLSX.readFile(filePath, { type: 'file', cellDates: true, cellNF: false, cellText: false });
}

function normalizeItemCode(code: string): string {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

function buildPriceMap(): Map<string, number> {
  const wb = readExcelFile(PRICE_EXCEL);
  const ws = wb.Sheets[PRICE_SHEET];
  if (!ws) return new Map();
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false }) as any[][];
  const map = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const code = normalizeItemCode(row[0]);
    const priceNum = Number(String(row[1] ?? '').toString().replace(/[^0-9.\-]/g, ''));
    if (code && !Number.isNaN(priceNum) && priceNum > 0) map.set(code, priceNum);
  }
  return map;
}

async function main() {
  const logger = createLogger('BOM 자식 품목 단가/단위 보강');
  logger.startMigration();

  const supabase = createAdminClient();
  logger.startPhase('연결 테스트');
  if (!(await testConnection(supabase))) {
    logger.log('Supabase 연결 실패', 'error');
    logger.endMigration(false);
    process.exit(1);
  }
  logger.endPhase();

  logger.startPhase('최신단가 맵 생성');
  const priceMap = buildPriceMap();
  logger.log(`✅ 최신단가 로드: ${priceMap.size}개`, 'success');
  logger.endPhase();

  logger.startPhase('BOM 자식 품목 조회');
  const { data: bomRows, error } = await supabase
    .from('bom')
    .select('child_item_id')
    .neq('is_active', false);

  if (error) {
    logger.log(`❌ 조회 실패: ${error.message}`, 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  const childIds = Array.from(new Set((bomRows || []).map(r => r.child_item_id).filter(Boolean)));
  let childItems: any[] = [];
  if (childIds.length > 0) {
    const { data: itemsRows, error: itemsErr } = await supabase
      .from('items')
      .select('item_id, item_code, unit, price')
      .in('item_id', childIds);
    if (itemsErr) {
      logger.log(`❌ 품목 조회 실패: ${itemsErr.message}`, 'error');
      logger.endMigration(false);
      process.exit(1);
    }
    childItems = itemsRows || [];
  }
  logger.log(`✅ BOM 자식 품목: ${childItems.length}개`, 'success');
  logger.endPhase();

  logger.startPhase('업데이트 준비');
  const priceUpdates: { item_id: number; price: number }[] = [];
  const unitUpdates: { item_id: number; unit: string }[] = [];

  for (const it of childItems) {
    const codeNorm = normalizeItemCode(it.item_code);
    if ((!it.price || Number(it.price) === 0) && priceMap.has(codeNorm)) {
      priceUpdates.push({ item_id: it.item_id, price: priceMap.get(codeNorm)! });
    }
    if (!it.unit || it.unit.trim() === '') {
      unitUpdates.push({ item_id: it.item_id, unit: 'EA' });
    }
  }

  logger.log(`가격 업데이트 대상: ${priceUpdates.length}개`, 'info');
  logger.log(`단위 업데이트 대상: ${unitUpdates.length}개`, 'info');

  let updatedPrice = 0;
  for (let i = 0; i < priceUpdates.length; i += 200) {
    const batch = priceUpdates.slice(i, i + 200);
    const { error: upErr } = await supabase.from('items').upsert(batch, { onConflict: 'item_id' });
    if (upErr) {
      logger.log(`⚠️ 가격 배치 ${Math.floor(i / 200) + 1} 실패: ${upErr.message}`, 'warn');
    } else {
      updatedPrice += batch.length;
    }
    logger.progress(Math.min(i + 200, priceUpdates.length), priceUpdates.length, '가격 업데이트');
  }

  let updatedUnit = 0;
  for (let i = 0; i < unitUpdates.length; i += 200) {
    const batch = unitUpdates.slice(i, i + 200);
    const { error: upErr } = await supabase.from('items').upsert(batch, { onConflict: 'item_id' });
    if (upErr) {
      logger.log(`⚠️ 단위 배치 ${Math.floor(i / 200) + 1} 실패: ${upErr.message}`, 'warn');
    } else {
      updatedUnit += batch.length;
    }
    logger.progress(Math.min(i + 200, unitUpdates.length), unitUpdates.length, '단위 업데이트');
  }

  logger.table({ updatedPrice, updatedUnit });
  logger.endMigration(true);
}

main().catch(err => {
  console.error('❌ 치명적 오류 발생:', err);
  process.exit(1);
});


