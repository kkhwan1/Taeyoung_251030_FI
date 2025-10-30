/**
 * BOM 엑셀 기준 누락된 자식 품목 추가
 * - 자식 품목 코드 수집 → DB 미존재만 삽입
 * - 단가: '태창금속 BOM.xlsx/최신단가'에서 매핑
 * - 단위: 기본 EA
 *
 * 실행: npx tsx scripts/migration/add-missing-bom-children.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';

const BOM_EXCEL = '태창금속 BOM.xlsx';
const PRICE_SHEET = '최신단가';
const EXCEL_DIR = path.resolve(process.cwd(), '.example');

function readExcelFile(filename: string): XLSX.WorkBook {
  const filePath = path.join(EXCEL_DIR, filename);
  if (!fs.existsSync(filePath)) throw new Error(`Excel 파일을 찾을 수 없습니다: ${filePath}`);
  return XLSX.readFile(filePath, { type: 'file', cellDates: true, cellNF: false, cellText: false });
}

function normalize(code: string): string {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

function isLikelyItemCode(code: string): boolean {
  const c = normalize(code);
  if (c.length < 4) return false;
  // 제외 패턴: 차종/그룹/기타 표식
  const stop = /^(DL3|GL3|KA4|KA4PE|LX2|SU2|RS4|NES|MQ4|MX5|ON|FRONT|REAR|CK\/IK)$/i;
  if (stop.test(c)) return false;
  if (/[\s]/.test(c)) return false;
  if (/[\/]/.test(c)) return false;
  // 품번 형태: 영숫자 조합이며, 하이픈 포함 또는 숫자+문자 혼합
  if (/[A-Z0-9]+-[A-Z0-9]+/.test(c)) return true;
  if (/[A-Z]/.test(c) && /[0-9]/.test(c)) return true;
  return false;
}

function buildPriceMap(wb: XLSX.WorkBook): Map<string, number> {
  const ws = wb.Sheets[PRICE_SHEET];
  const map = new Map<string, number>();
  if (!ws) return map;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false }) as any[][];
  for (const row of rows) {
    const code = normalize(row?.[0] || '');
    const price = Number(String(row?.[1] ?? '').replace(/[^0-9.\-]/g, ''));
    if (code && !Number.isNaN(price) && price > 0) map.set(code, price);
  }
  return map;
}

function collectChildCodes(wb: XLSX.WorkBook): Set<string> {
  const sheets = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];
  const set = new Set<string>();
  for (const sheet of sheets) {
    if (!wb.SheetNames.includes(sheet)) continue;
    const ws = wb.Sheets[sheet];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, range: 5 }) as any[][];
    const SUPPLIER1 = 8, SUPPLIER2 = 9, CHILD_CODE = 10;
    for (const row of rows) {
      const supplier1 = String(row?.[SUPPLIER1] || '').trim();
      const supplier2 = String(row?.[SUPPLIER2] || '').trim();
      const childCode = String(row?.[CHILD_CODE] || '').trim();
      if ((supplier1 || supplier2) && childCode && isLikelyItemCode(childCode)) {
        set.add(normalize(childCode));
      }
    }
  }
  return set;
}

async function main() {
  const logger = createLogger('BOM 누락 자식 품목 추가');
  logger.startMigration();

  const supabase = createAdminClient();
  logger.startPhase('연결 테스트');
  if (!(await testConnection(supabase))) {
    logger.log('Supabase 연결 실패', 'error');
    logger.endMigration(false);
    process.exit(1);
  }
  logger.endPhase();

  logger.startPhase('엑셀 로드 및 수집');
  const wb = readExcelFile(BOM_EXCEL);
  const priceMap = buildPriceMap(wb);
  const childCodes = collectChildCodes(wb);
  logger.log(`✅ 수집된 후보 자식 품목 코드: ${childCodes.size}개`, 'success');
  logger.endPhase();

  logger.startPhase('DB 존재 여부 확인');
  const codeList = Array.from(childCodes);
  // 큰 IN 방지: 500개씩 분할 조회
  const existing = new Set<string>();
  for (let i = 0; i < codeList.length; i += 500) {
    const chunk = codeList.slice(i, i + 500);
    const { data, error } = await supabase
      .from('items')
      .select('item_code')
      .in('item_code', chunk);
    if (error) {
      logger.log(`⚠️ 조회 실패(배치 ${Math.floor(i / 500) + 1}): ${error.message}`, 'warn');
      continue;
    }
    data?.forEach(r => existing.add(normalize(r.item_code)));
  }
  const missing = codeList.filter(c => !existing.has(c));
  logger.log(`✅ DB 미존재: ${missing.length}개`, 'success');
  logger.endPhase();

  if (missing.length === 0) {
    logger.endMigration(true);
    return;
  }

  logger.startPhase('누락 품목 삽입');
  let inserted = 0;
  for (let i = 0; i < missing.length; i += 200) {
    const chunk = missing.slice(i, i + 200);
    const records = chunk.map(code => ({
      item_code: code,
      item_name: code,
      unit: 'EA',
      category: '부자재' as const,
      price: priceMap.get(code) ?? 0,
      current_stock: 0,
      is_active: true
    }));
    const { error } = await supabase.from('items').upsert(records, { onConflict: 'item_code' });
    if (!error) inserted += records.length;
    else logger.log(`⚠️ 삽입 실패(배치 ${Math.floor(i / 200) + 1}): ${error.message}`, 'warn');
    logger.progress(Math.min(i + 200, missing.length), missing.length, '누락 품목 삽입');
  }
  logger.log(`✅ 삽입 완료: ${inserted}개`, 'success');
  logger.endPhase();

  logger.endMigration(true);
}

main().catch(err => {
  console.error('❌ 치명적 오류 발생:', err);
  process.exit(1);
});


