/**
 * 스크랩 중량/단가 반영 스크립트
 * - 관련 엑셀들의 모든 시트에서 스크랩중량/스크랩단가 추출
 * - items 매핑 후 scrap_tracking에 일자별 기록 삽입(동일 일자 기존분 대체)
 *
 * 실행: npx tsx scripts/migration/update-scrap-data.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';

const EXCEL_DIR = path.resolve(process.cwd(), '.example');
const FILES = [
  '태창금속 BOM.xlsx',
  '2025년 9월 종합관리 SHEET.xlsx',
  '2025년 9월 매입매출 보고현황.xlsx',
  '09월 원자재 수불관리.xlsx'
];

const DEFAULT_DATE = process.env.SCRAP_DATE || '2025-09-01';

function readExcelFile(filename: string): XLSX.WorkBook | null {
  const filePath = path.join(EXCEL_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  return XLSX.readFile(filePath, { type: 'file', cellDates: true, cellNF: false, cellText: false });
}

function norm(s: any): string { return String(s ?? '').trim(); }
function normCode(s: any): string { return norm(s).toUpperCase().replace(/\s+/g, ''); }
function num(s: any): number | null {
  const n = Number(String(s ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) && !Number.isNaN(n) ? n : null;
}

type ScrapData = { item_code: string; scrap_weight?: number; scrap_unit_price?: number };

function scanForScrap(wb: XLSX.WorkBook, logger: ReturnType<typeof createLogger>): Map<string, ScrapData> {
  const map = new Map<string, ScrapData>();
  for (const sheet of wb.SheetNames) {
    const ws = wb.Sheets[sheet];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, range: 0 }) as any[][];
    if (!rows || rows.length === 0) continue;

    // 헤더 후보 탐색
    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const line = (rows[i] || []).map((c: any) => norm(c)).join(' ');
      if (/품번|코드|CODE/i.test(line)) { headerIdx = i; break; }
    }
    const start = headerIdx >= 0 ? headerIdx + 1 : 1;
    const header = rows[headerIdx] || rows[0] || [];

    const findCol = (re: RegExp, fb: number | null = null) => {
      const idx = header.findIndex((c: any) => re.test(String(c || '')));
      return idx >= 0 ? idx : fb;
    };

    const colCode = findCol(/품번|코드|CODE/i, 0);
    let colScrapW = findCol(/스크랩.*중량|SCRAP.*WEIGHT|스크랩중량/i, null);
    let colScrapP = findCol(/스크랩.*단가|SCRAP.*PRICE|KG당단가/i, null);

    // BOM 특성상 스크랩중량이 후반 열에 있는 경우(예: 28열) 범용 파서가 못 찾으면 보정 탐색
    if (colScrapW == null) {
      // 후행 열을 훑어 키워드 검색
      for (let c = 0; c < header.length; c++) {
        const v = norm(header[c]).toUpperCase();
        if (v.includes('스크랩') && (v.includes('중량') || v.includes('WEIGHT'))) { colScrapW = c; break; }
      }
    }
    if (colScrapP == null) {
      for (let c = 0; c < header.length; c++) {
        const v = norm(header[c]).toUpperCase();
        if (v.includes('스크랩') && (v.includes('단가') || v.includes('PRICE'))) { colScrapP = c; break; }
      }
    }

    for (let r = start; r < rows.length; r++) {
      const row = rows[r]; if (!row) continue;
      const code = normCode(row[colCode]); if (!code || code.length < 3) continue;
      const w = colScrapW != null ? num(row[colScrapW]) : null;
      const p = colScrapP != null ? num(row[colScrapP]) : null;
      if ((w && w > 0) || (p && p > 0)) {
        const cur = map.get(code) || { item_code: code };
        if (w && w > 0) cur.scrap_weight = cur.scrap_weight ?? w;
        if (p && p > 0) cur.scrap_unit_price = cur.scrap_unit_price ?? p;
        map.set(code, cur);
      }
    }
  }
  logger.log(`  • 스크랩 수집: ${map.size}개`, 'info');
  return map;
}

async function main() {
  const logger = createLogger('스크랩 중량/단가 반영');
  logger.startMigration();

  const supabase = createAdminClient();
  logger.startPhase('연결 테스트');
  if (!(await testConnection(supabase))) {
    logger.log('Supabase 연결 실패', 'error');
    logger.endMigration(false);
    process.exit(1);
  }
  logger.endPhase();

  logger.startPhase('엑셀 스크랩 데이터 수집');
  const merged = new Map<string, ScrapData>();
  for (const f of FILES) {
    const wb = readExcelFile(f); if (!wb) { logger.log(`  ⚠️ 파일 없음: ${f}`, 'warn'); continue; }
    logger.log(`  ▶ 스캔: ${f}`, 'info');
    const part = scanForScrap(wb, logger);
    part.forEach((v, k) => {
      const cur = merged.get(k) || { item_code: k };
      merged.set(k, { ...cur, ...v });
    });
  }
  logger.endPhase();

  if (merged.size === 0) {
    logger.log('스크랩 데이터가 발견되지 않았습니다', 'warn');
    logger.endMigration(true);
    return;
  }

  logger.startPhase('아이템 매핑');
  const { data: items } = await supabase.from('items').select('item_id, item_code');
  const codeToId = new Map<string, number>();
  items?.forEach(i => { codeToId.set(i.item_code, i.item_id); codeToId.set(normCode(i.item_code), i.item_id); });
  const records: { item_id: number; scrap_weight: number; scrap_unit_price: number; production_quantity: number; tracking_date: string; is_active: boolean; notes?: string }[] = [];

  merged.forEach(sd => {
    const id = codeToId.get(sd.item_code) || codeToId.get(normCode(sd.item_code));
    if (!id) return;
    const w = sd.scrap_weight ?? 0;
    const p = sd.scrap_unit_price ?? 0;
    if (w <= 0 && p <= 0) return;
    records.push({
      item_id: id,
      scrap_weight: Math.max(0, w),
      scrap_unit_price: Math.max(0, p),
      production_quantity: 1,
      tracking_date: DEFAULT_DATE,
      is_active: true,
      notes: 'auto-imported from excels'
    });
  });
  logger.log(`  • 반영 대상: ${records.length}건`, 'info');
  logger.endPhase();

  if (records.length === 0) {
    logger.endMigration(true);
    return;
  }

  logger.startPhase('동일 일자 기존 데이터 정리');
  const itemIds = Array.from(new Set(records.map(r => r.item_id)));
  for (let i = 0; i < itemIds.length; i += 500) {
    const chunk = itemIds.slice(i, i + 500);
    const { error } = await supabase
      .from('scrap_tracking')
      .delete()
      .in('item_id', chunk)
      .eq('tracking_date', DEFAULT_DATE);
    if (error) {
      logger.log(`  ⚠️ 삭제 실패(배치 ${Math.floor(i / 500) + 1}): ${error.message}`, 'warn');
    }
    logger.progress(Math.min(i + 500, itemIds.length), itemIds.length, '기존 스크랩 삭제');
  }
  logger.endPhase();

  logger.startPhase('스크랩 데이터 삽입');
  let inserted = 0;
  for (let i = 0; i < records.length; i += 200) {
    const batch = records.slice(i, i + 200);
    const { error } = await supabase.from('scrap_tracking').insert(batch);
    if (!error) inserted += batch.length; else {
      logger.log(`  ⚠️ 삽입 실패(배치 ${Math.floor(i / 200) + 1}): ${error.message}`, 'warn');
    }
    logger.progress(Math.min(i + 200, records.length), records.length, '스크랩 삽입');
  }
  logger.log(`  ✅ 스크랩 삽입: ${inserted}건`, 'success');
  logger.endPhase();

  logger.endMigration(true);
}

main().catch(err => { console.error('❌ 치명적 오류 발생:', err); process.exit(1); });


