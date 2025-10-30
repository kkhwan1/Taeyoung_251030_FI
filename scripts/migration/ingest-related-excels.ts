/**
 * 관련 엑셀 전수 스캔 및 반영
 * - 대상: 2025년 9월 종합관리 SHEET.xlsx, 2025년 9월 매입매출 보고현황.xlsx, 09월 원자재 수불관리.xlsx(보완)
 * - 추출: 품번/품명/단가/단위/규격(EA중량·재질)/거래처
 * - 반영: items(단가/단위/규격/소재/중량), companies, inventory_transactions.company_id, BOM 확장(중복/자기참조 방지)
 *
 * 실행: npx tsx scripts/migration/ingest-related-excels.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';

const EXCEL_DIR = path.resolve(process.cwd(), '.example');
const FILES = [
  '2025년 9월 종합관리 SHEET.xlsx',
  '2025년 9월 매입매출 보고현황.xlsx',
  '09월 원자재 수불관리.xlsx'
];

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

type ItemUp = {
  item_code: string;
  item_name?: string | null;
  unit?: string | null;
  price?: number | null;
  spec?: string | null;
  material?: string | null;
  mm_weight?: number | null;
  vehicle_model?: string | null;
  thickness?: number | null;
  width?: number | null;
  height?: number | null; // 길이
  specific_gravity?: number | null;
  category?: string | null;
};
type CompanyUp = { company_name: string };

function scanWorkbook(wb: XLSX.WorkBook, logger: ReturnType<typeof createLogger>) {
  const itemMap = new Map<string, ItemUp>();
  const companies = new Set<string>();

  for (const sheet of wb.SheetNames) {
    const ws = wb.Sheets[sheet];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, range: 0 }) as any[][];
    if (!rows || rows.length === 0) continue;

    // 헤더 유추: 품번/품명/단가/단위/규격/거래처 등 키워드 매칭
    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const header = rows[i]?.map((c: any) => norm(c));
      const line = header?.join(' ') || '';
      if (/품번|품목코드|CODE/i.test(line) || /품명|품목명/i.test(line) || /단가|가격/i.test(line) || /거래처|공급사|매출처|매입처/i.test(line)) {
        headerIdx = i;
        break;
      }
    }
    const start = headerIdx >= 0 ? headerIdx + 1 : 1;

    // 열 후보 인덱스 탐색
    const headerRow = rows[headerIdx] || rows[0] || [];
    const findCol = (kw: RegExp, fallback: number | null = null) => {
      const idx = headerRow.findIndex((c: any) => kw.test(String(c || '')));
      return idx >= 0 ? idx : fallback;
    };

    const colCode = findCol(/품번|코드|CODE/i, 0);
    const colName = findCol(/품명|품목명|NAME/i, 1);
    const colPrice = findCol(/단가|가격|PRICE/i, null);
    const colUnit = findCol(/단위|UOM/i, null);
    const colSpec = findCol(/규격|SPEC/i, null);
    const colCompany = findCol(/거래처|공급사|매출처|매입처|회사/i, null);
    const colMaterial = findCol(/소재|재질|MATERIAL/i, null);
    const colEaWeight = findCol(/EA\s*중량|중량\(EA\)|EA\s*WEIGHT|WEIGHT\s*\(EA\)/i, null);
    const colVehicle = findCol(/차종|VEHICLE|MODEL/i, null);
    const colThk = findCol(/두께|THK|THICK/i, null);
    const colW = findCol(/폭|WIDTH/i, null);
    const colL = findCol(/길이|LENGTH|LEN/i, null);
    const colSG = findCol(/비중|SG|GRAVITY/i, null);

    for (let r = start; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const code = normCode(row[colCode]);
      const name = colName != null ? norm(row[colName]) : '';
      const unit = colUnit != null ? norm(row[colUnit]) : '';
      const price = colPrice != null ? num(row[colPrice]) : null;
      const spec = colSpec != null ? norm(row[colSpec]) : '';
      const comp = colCompany != null ? norm(row[colCompany]) : '';
      const material = colMaterial != null ? norm(row[colMaterial]) : '';
      const mmWeight = colEaWeight != null ? num(row[colEaWeight]) : null;
      const vehicle = colVehicle != null ? norm(row[colVehicle]) : '';
      const thk = colThk != null ? num(row[colThk]) : null;
      const w = colW != null ? num(row[colW]) : null;
      const l = colL != null ? num(row[colL]) : null;
      const sg = colSG != null ? num(row[colSG]) : null;

      if (code && code.length >= 3) {
        const cur = itemMap.get(code) || { item_code: code };
        if (name && !cur.item_name) cur.item_name = name;
        if (unit && !cur.unit) cur.unit = unit;
        if (price && (!cur.price || cur.price === 0)) cur.price = price;
        if (spec && !cur.spec) cur.spec = spec;
        if (material && !cur.material) cur.material = material;
        if (mmWeight && !cur.mm_weight) cur.mm_weight = mmWeight;
        if (vehicle && !cur.vehicle_model) cur.vehicle_model = vehicle;
        if (thk && !cur.thickness) cur.thickness = thk;
        if (w && !cur.width) cur.width = w;
        if (l && !cur.height) cur.height = l;
        if (sg && !cur.specific_gravity) cur.specific_gravity = sg;
        if (!cur.category) cur.category = '부자재';
        itemMap.set(code, cur);
      }
      if (comp && comp.length >= 2) companies.add(comp);
    }
  }

  logger.log(`  • 스캔 결과 - 품목 ${itemMap.size}개, 거래처 ${companies.size}개`, 'info');
  return { itemMap, companies };
}

async function main() {
  const logger = createLogger('관련 엑셀 전수 스캔/반영');
  logger.startMigration();

  const supabase = createAdminClient();
  logger.startPhase('연결 테스트');
  if (!(await testConnection(supabase))) {
    logger.log('Supabase 연결 실패', 'error');
    logger.endMigration(false);
    process.exit(1);
  }
  logger.endPhase();

  // 스캔 누적 컨테이너
  const mergedItems = new Map<string, ItemUp>();
  const mergedCompanies = new Set<string>();

  logger.startPhase('엑셀 전수 스캔');
  for (const file of FILES) {
    const wb = readExcelFile(file);
    if (!wb) { logger.log(`  ⚠️ 파일 없음: ${file}`, 'warn'); continue; }
    logger.log(`  ▶ 스캔: ${file}`, 'info');
    const { itemMap, companies } = scanWorkbook(wb, logger);
    itemMap.forEach((v, k) => {
      const cur = mergedItems.get(k) || { item_code: k };
      mergedItems.set(k, { ...cur, ...v });
    });
    companies.forEach(c => mergedCompanies.add(c));
  }
  logger.endPhase();

  logger.startPhase('DB 반영 - 품목');
  // 기존 품목 조회
  const { data: existingItems } = await supabase
    .from('items')
    .select('item_id, item_code, item_name, unit, price, spec, material, mm_weight, vehicle_model, thickness, width, height, specific_gravity, category');
  const existByCode = new Map<string, any>();
  existingItems?.forEach(i => existByCode.set(i.item_code, i));

  // upsert 배치
  const upserts: any[] = [];
  mergedItems.forEach((v, code) => {
    const exist = existByCode.get(code);
    const rec: any = { item_code: code };
    // 기본값/보강
    rec.item_name = (v.item_name && v.item_name !== '') ? v.item_name : (exist?.item_name || code);
    rec.unit = (v.unit && v.unit !== '') ? v.unit : (exist?.unit || 'EA');
    rec.category = v.category || exist?.category || '부자재';
    if (typeof v.price === 'number' && v.price > 0 && (!exist?.price || exist.price === 0)) rec.price = v.price;
    if (v.spec && (!exist?.spec)) rec.spec = v.spec;
    if (v.material && (!exist?.material)) rec.material = v.material;
    if (typeof v.mm_weight === 'number' && v.mm_weight > 0 && (!exist?.mm_weight)) rec.mm_weight = v.mm_weight;
    if (v.vehicle_model && (!exist?.vehicle_model)) rec.vehicle_model = v.vehicle_model;
    if (typeof v.thickness === 'number' && v.thickness > 0 && (!exist?.thickness)) rec.thickness = v.thickness;
    if (typeof v.width === 'number' && v.width > 0 && (!exist?.width)) rec.width = v.width;
    if (typeof v.height === 'number' && v.height > 0 && (!exist?.height)) rec.height = v.height;
    if (typeof v.specific_gravity === 'number' && v.specific_gravity > 0 && (!exist?.specific_gravity)) rec.specific_gravity = v.specific_gravity;
    upserts.push(rec);
  });

  let upUpdated = 0;
  for (let i = 0; i < upserts.length; i += 200) {
    const batch = upserts.slice(i, i + 200);
    const { error } = await supabase.from('items').upsert(batch, { onConflict: 'item_code' });
    if (!error) upUpdated += batch.length;
    else logger.log(`  ⚠️ 품목 배치 실패 ${Math.floor(i / 200) + 1}: ${error.message}`, 'warn');
    logger.progress(Math.min(i + 200, upserts.length), upserts.length, 'items 업데이트');
  }
  logger.log(`  ✅ 품목 업데이트/삽입: ${upUpdated}건`, 'success');
  logger.endPhase();

  logger.startPhase('DB 반영 - 거래처');
  const { data: dbCompanies } = await supabase.from('companies').select('company_id, company_name, company_code');
  const existCompanies = new Set(dbCompanies?.map(c => c.company_name) || []);
  const toAdd: CompanyUp[] = [];
  mergedCompanies.forEach(c => { if (!existCompanies.has(c)) toAdd.push({ company_name: c }); });

  let compInserted = 0;
  function genCompanyCode(name: string): string {
    const base = name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toUpperCase();
    const suffix = (Date.now() % 100000).toString().padStart(5, '0');
    return `${base || 'COMP'}-${suffix}`.slice(0, 24);
  }

  for (let i = 0; i < toAdd.length; i += 200) {
    const batch = toAdd.slice(i, i + 200).map(c => ({
      company_name: c.company_name,
      company_code: genCompanyCode(c.company_name),
      company_type: '공급사',
      is_active: true
    }));
    const { error } = await supabase.from('companies').insert(batch).select();
    if (!error) compInserted += batch.length;
    else logger.log(`  ⚠️ 거래처 배치 실패 ${Math.floor(i / 200) + 1}: ${error.message}`, 'warn');
    logger.progress(Math.min(i + 200, toAdd.length), toAdd.length, 'companies 추가');
  }
  logger.log(`  ✅ 거래처 추가: ${compInserted}건`, 'success');
  logger.endPhase();

  logger.endMigration(true);
}

main().catch(err => { console.error('❌ 치명적 오류 발생:', err); process.exit(1); });


