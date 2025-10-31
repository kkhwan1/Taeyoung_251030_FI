'use strict';

// Reads BOM/Receiving excels from .example, compares with DB, and writes reports.

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const { scanFiles } = require('./scan-example-files');
const { buildHeaderMap, mapRow } = require('./header-mapper');

// Environment
require('dotenv').config();
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const REPORT_MD = path.resolve(__dirname, '../../docs/DATA_CONSISTENCY_REPORT.md');
const REPORT_JSON = path.resolve(__dirname, '../../docs/DATA_CONSISTENCY_DETAILS.json');

function safeNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).toString().replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function readFirstSheetRows(file) {
  const wb = XLSX.readFile(file);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
  return { rows, headers, sheetName };
}

async function fetchDbSnapshots() {
  const [bomRes, itemsRes, companiesRes, inboundRes] = await Promise.all([
    supabase.from('bom').select('*').eq('is_active', true),
    supabase.from('items').select('item_id,item_code,item_name'),
    supabase.from('companies').select('company_id,company_code,company_name'),
    supabase.from('inventory_transactions').select('transaction_id,transaction_type,transaction_date,item_id,company_id,quantity')
      .eq('transaction_type', '입고'),
  ]);

  const err = [bomRes.error, itemsRes.error, companiesRes.error, inboundRes.error].filter(Boolean)[0];
  if (err) throw new Error(err.message || String(err));

  return {
    bom: bomRes.data || [],
    items: itemsRes.data || [],
    companies: companiesRes.data || [],
    inbound: inboundRes.data || [],
  };
}

function indexBy(arr, key) {
  const map = new Map();
  for (const it of arr) map.set(it[key], it);
  return map;
}

function compareBOM(excelRows, db, itemsByCode) {
  // Normalize excel rows to keys: parent_item_code, child_item_code, level_no, quantity_required
  const keyOf = (r) => `${r.parent_item_code || ''}||${r.child_item_code || ''}||${String(r.level_no || 1)}`;

  const excelSet = new Map();
  const excelIssues = [];
  for (const r of excelRows) {
    const parent = itemsByCode.get(String(r.parent_item_code || '').trim());
    const child = itemsByCode.get(String(r.child_item_code || '').trim());
    const qty = safeNumber(r.quantity_required);
    const lvl = r.level_no ? Number(r.level_no) : 1;
    const k = keyOf({ ...r, level_no: lvl });
    excelSet.set(k, { ...r, quantity_required: qty, level_no: lvl, parentExists: !!parent, childExists: !!child });
    if (!parent || !child) excelIssues.push({ type: 'mapping', reason: 'item_not_found', row: r });
  }

  // Build DB key set using joined item codes
  const dbSet = new Map();
  for (const b of db.bom) {
    const parent = db.items.find((i) => i.item_id === b.parent_item_id);
    const child = db.items.find((i) => i.item_id === b.child_item_id);
    if (!parent || !child) continue;
    const lvl = b.level_no || 1;
    const k = `${parent.item_code}||${child.item_code}||${String(lvl)}`;
    dbSet.set(k, { ...b, parent_code: parent.item_code, child_code: child.item_code });
  }

  const missingInDb = [];
  const extraInDb = [];
  const valueMismatches = [];

  // Excel -> DB
  for (const [k, ex] of excelSet.entries()) {
    if (!dbSet.has(k)) {
      missingInDb.push({ key: k, excel: ex });
    } else {
      const b = dbSet.get(k);
      const exQty = safeNumber(ex.quantity_required);
      const dbQty = safeNumber(b.quantity_required);
      if (Math.abs(exQty - dbQty) > 1e-9) {
        valueMismatches.push({ key: k, field: 'quantity_required', excel: exQty, db: dbQty });
      }
    }
  }

  // DB -> Excel
  for (const k of dbSet.keys()) {
    if (!excelSet.has(k)) extraInDb.push({ key: k, db: dbSet.get(k) });
  }

  return { excelCount: excelRows.length, dbCount: dbSet.size, missingInDb, extraInDb, valueMismatches, excelIssues };
}

function buildInboundKey(r) {
  const d = String(r.date || r.transaction_date || '').slice(0, 10);
  const ic = String(r.item_code || r.item_id || '').trim();
  const cc = String(r.company_code || r.company_id || '').trim();
  const doc = String(r.doc_no || '').trim();
  return `${d}||${ic}||${cc}||${doc}`;
}

function compareReceiving(excelRows, db, itemsByCode, companiesByCode) {
  const excelSet = new Map();
  const excelIssues = [];
  for (const r of excelRows) {
    const item = itemsByCode.get(String(r.item_code || '').trim());
    const comp = companiesByCode.get(String(r.company_code || '').trim());
    const qty = safeNumber(r.quantity);
    if (!qty) excelIssues.push({ type: 'skip', reason: 'zero_quantity', row: r });
    if (!item) excelIssues.push({ type: 'mapping', reason: 'item_not_found', row: r });
    if (!comp) excelIssues.push({ type: 'mapping', reason: 'company_not_found', row: r });
    const k = buildInboundKey(r);
    excelSet.set(k, { ...r, quantity: qty, itemExists: !!item, companyExists: !!comp });
  }

  // Build DB set -> approximate key: date, item_code, company_code, doc_no(empty)
  const itemsById = indexBy(db.items, 'item_id');
  const companiesById = indexBy(db.companies, 'company_id');
  const dbSet = new Map();
  for (const t of db.inbound) {
    const d = String(t.transaction_date || '').slice(0, 10);
    const item = itemsById.get(t.item_id);
    const comp = companiesById.get(t.company_id);
    if (!item || !comp) continue;
    const k = `${d}||${item.item_code}||${comp.company_code}||`;
    const cur = dbSet.get(k) || { qty: 0, rows: 0 };
    cur.qty += safeNumber(t.quantity);
    cur.rows += 1;
    dbSet.set(k, cur);
  }

  let excelTotalQty = 0;
  for (const ex of excelSet.values()) excelTotalQty += safeNumber(ex.quantity);

  const missingInDb = [];
  const extraInDb = [];
  const valueMismatches = [];

  for (const [k, ex] of excelSet.entries()) {
    const dbAgg = dbSet.get(k);
    if (!dbAgg) missingInDb.push({ key: k, excel: ex });
    else if (Math.abs(safeNumber(ex.quantity) - dbAgg.qty) > 1e-9) {
      valueMismatches.push({ key: k, field: 'quantity', excel: safeNumber(ex.quantity), db: dbAgg.qty });
    }
  }

  for (const k of dbSet.keys()) {
    if (!excelSet.has(k)) extraInDb.push({ key: k, db: dbSet.get(k) });
  }

  return {
    excelCount: excelRows.length,
    excelTotalQty,
    dbApproxCountKeys: dbSet.size,
    missingInDb,
    extraInDb,
    valueMismatches,
    excelIssues,
  };
}

function writeReports(report) {
  const md = [];
  md.push('# 데이터 정합성 검증 요약');
  md.push('');
  md.push(`- BOM: 엑셀 ${report.bom.excelCount}행 vs DB ${report.bom.dbCount}건`);
  md.push(`  - 누락: ${report.bom.missingInDb.length}, 과다: ${report.bom.extraInDb.length}, 값불일치: ${report.bom.valueMismatches.length}`);
  md.push(`- 입고: 엑셀 ${report.receiving.excelCount}행 (합계 수량 ${report.receiving.excelTotalQty})`);
  md.push(`  - 누락: ${report.receiving.missingInDb.length}, 과다: ${report.receiving.extraInDb.length}, 값불일치: ${report.receiving.valueMismatches.length}`);
  md.push('');
  md.push('## 주요 이슈 집계');
  const issueCount = (arr, reason) => arr.filter((x) => x.reason === reason).length;
  md.push(`- BOM 매핑 오류(품목 없음): ${issueCount(report.bom.excelIssues, 'item_not_found')}`);
  md.push(`- 입고 무시 사유(0수량): ${issueCount(report.receiving.excelIssues, 'zero_quantity')}`);
  md.push(`- 입고 매핑 오류(품목 없음): ${issueCount(report.receiving.excelIssues, 'item_not_found')}`);
  md.push(`- 입고 매핑 오류(회사 없음): ${issueCount(report.receiving.excelIssues, 'company_not_found')}`);

  fs.mkdirSync(path.dirname(REPORT_MD), { recursive: true });
  fs.writeFileSync(REPORT_MD, md.join('\n'), 'utf8');
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf8');
}

async function main() {
  const scan = scanFiles();
  const notes = [];
  if (scan.errors.length) notes.push(...scan.errors);
  if (!scan.bom.length) notes.push('BOM 엑셀 파일을 찾지 못했습니다 (*BOM* 매칭).');
  if (!scan.receiving.length) notes.push('입고 엑셀 파일을 찾지 못했습니다 (*입고*|*receiv* 매칭).');

  // Parse excels
  const bomRows = [];
  for (const f of scan.bom) {
    const { rows, headers } = readFirstSheetRows(f);
    const hmap = buildHeaderMap(headers, 'bom');
    for (const r of rows) bomRows.push(mapRow(r, hmap));
  }

  const receivingRows = [];
  for (const f of scan.receiving) {
    const { rows, headers } = readFirstSheetRows(f);
    const hmap = buildHeaderMap(headers, 'receiving');
    for (const r of rows) receivingRows.push(mapRow(r, hmap));
  }

  const db = await fetchDbSnapshots();
  const itemsByCode = indexBy(db.items, 'item_code');
  const companiesByCode = indexBy(db.companies, 'company_code');

  const bomCmp = compareBOM(bomRows, db, itemsByCode);
  const recvCmp = compareReceiving(receivingRows, db, itemsByCode, companiesByCode);

  const report = {
    scanned: {
      baseDir: scan.baseDir,
      bomFiles: scan.bom,
      receivingFiles: scan.receiving,
      otherExcelFiles: scan.others,
      notes,
    },
    bom: bomCmp,
    receiving: recvCmp,
    timestamp: new Date().toISOString(),
  };

  writeReports(report);
  console.log('Report written to:', REPORT_MD, 'and', REPORT_JSON);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[verify-excel-vs-db] Failed:', err);
    process.exit(1);
  });
}

module.exports = { main };



