/**
 * BOM 관계 안전 동기화
 * - 엑셀에서 관계 재추출 → DB에 없는 (parent, child)만 삽입
 *
 * 실행: npx tsx scripts/migration/sync-bom-relationships.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';

const BOM_EXCEL = '태창금속 BOM.xlsx';
const EXCEL_DIR = path.resolve(process.cwd(), '.example');

function readExcelFile(filename: string): XLSX.WorkBook {
  const filePath = path.join(EXCEL_DIR, filename);
  if (!fs.existsSync(filePath)) throw new Error(`Excel 파일을 찾을 수 없습니다: ${filePath}`);
  return XLSX.readFile(filePath, { type: 'file', cellDates: true, cellNF: false, cellText: false });
}

function normalize(code: string): string { return String(code || '').trim().toUpperCase().replace(/\s+/g, ''); }

function extractRelationships(wb: XLSX.WorkBook) {
  const sheets = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];
  const rels: { parentCode: string; childCode: string; qty: number }[] = [];
  for (const sheet of sheets) {
    if (!wb.SheetNames.includes(sheet)) continue;
    const ws = wb.Sheets[sheet];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, range: 5 }) as any[][];
    let currentParent: string | null = null;
    const DELIVERY = 0, PARENT_CODE = 2, SUP1 = 8, SUP2 = 9, CHILD_CODE = 10, QTY = 12;
    for (const row of rows) {
      const delivery = String(row?.[DELIVERY] || '').trim();
      const parentCode = String(row?.[PARENT_CODE] || '').trim();
      const sup1 = String(row?.[SUP1] || '').trim();
      const sup2 = String(row?.[SUP2] || '').trim();
      const childCode = String(row?.[CHILD_CODE] || '').trim();
      const qtyStr = String(row?.[QTY] || '').trim();
      if (delivery && parentCode) currentParent = parentCode;
      if (!delivery && (sup1 || sup2) && childCode && currentParent) {
        let qty = 1;
        const num = Number(qtyStr.replace(/[^0-9.\-]/g, ''));
        if (!Number.isNaN(num) && num > 0) qty = num;
        rels.push({ parentCode: currentParent, childCode, qty });
      }
    }
  }
  return rels;
}

async function main() {
  const logger = createLogger('BOM 관계 동기화');
  logger.startMigration();

  const supabase = createAdminClient();
  logger.startPhase('연결 테스트');
  if (!(await testConnection(supabase))) {
    logger.log('Supabase 연결 실패', 'error');
    logger.endMigration(false);
    process.exit(1);
  }
  logger.endPhase();

  logger.startPhase('엑셀 관계 재추출');
  const wb = readExcelFile(BOM_EXCEL);
  const rels = extractRelationships(wb);
  logger.log(`✅ 추출된 관계: ${rels.length}개`, 'success');
  logger.endPhase();

  logger.startPhase('코드→ID 매핑');
  const { data: items } = await supabase.from('items').select('item_id, item_code');
  const codeToId = new Map<string, number>();
  items?.forEach(it => { codeToId.set(it.item_code, it.item_id); codeToId.set(normalize(it.item_code), it.item_id); });
  logger.endPhase();

  logger.startPhase('기존 관계 로드');
  const { data: existing } = await supabase.from('bom').select('parent_item_id, child_item_id');
  const exists = new Set<string>();
  existing?.forEach(r => exists.add(`${r.parent_item_id}_${r.child_item_id}`));
  logger.endPhase();

  logger.startPhase('삽입 대상 선별');
  const toInsert: { parent_item_id: number; child_item_id: number; quantity_required: number; level_no: number; is_active: boolean }[] = [];
  for (const r of rels) {
    const p = codeToId.get(normalize(r.parentCode)) || codeToId.get(r.parentCode);
    const c = codeToId.get(normalize(r.childCode)) || codeToId.get(r.childCode);
    if (!p || !c || p === c) continue;
    const key = `${p}_${c}`;
    if (!exists.has(key)) {
      exists.add(key);
      toInsert.push({ parent_item_id: p, child_item_id: c, quantity_required: r.qty, level_no: 1, is_active: true });
    }
  }
  logger.log(`✅ 신규 삽입 대상: ${toInsert.length}개`, 'success');
  logger.endPhase();

  if (toInsert.length > 0) {
    logger.startPhase('BOM 관계 삽입');
    for (let i = 0; i < toInsert.length; i += 200) {
      const batch = toInsert.slice(i, i + 200);
      const { error } = await supabase.from('bom').insert(batch);
      if (error) logger.log(`⚠️ 배치 ${Math.floor(i / 200) + 1} 실패: ${error.message}`, 'warn');
      logger.progress(Math.min(i + 200, toInsert.length), toInsert.length, 'BOM 관계 삽입');
    }
    logger.endPhase();
  }

  logger.endMigration(true);
}

main().catch(err => { console.error('❌ 치명적 오류 발생:', err); process.exit(1); });


