'use strict';

// Minimal, resilient header mapping for BOM & Receiving sheets.
// Maps various Korean/English header variants to standard keys used in comparison.

const NORMALIZE = (h) => String(h || '')
  .replace(/\r|\n/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

// BOM headers
const BOM_HEADER_MAP = new Map([
  // parent item code
  ['모품번', 'parent_item_code'],
  ['parent item', 'parent_item_code'],
  ['parent code', 'parent_item_code'],
  ['parent_item_code', 'parent_item_code'],
  ['모품목코드', 'parent_item_code'],
  // parent name (optional)
  ['모품명', 'parent_item_name'],
  ['parent name', 'parent_item_name'],
  // child item code
  ['자품번', 'child_item_code'],
  ['child item', 'child_item_code'],
  ['child code', 'child_item_code'],
  ['child_item_code', 'child_item_code'],
  ['자품목코드', 'child_item_code'],
  // child name (optional)
  ['자품명', 'child_item_name'],
  ['child name', 'child_item_name'],
  // quantity
  ['소요량', 'quantity_required'],
  ['qty', 'quantity_required'],
  ['quantity', 'quantity_required'],
  // unit (optional)
  ['단위', 'unit'],
  ['unit', 'unit'],
  // level
  ['레벨', 'level_no'],
  ['level', 'level_no'],
  ['level_no', 'level_no'],
  // notes/status (optional)
  ['비고', 'notes'],
  ['상태', 'status'],
]);

// Receiving headers
const RECEIVING_HEADER_MAP = new Map([
  // date
  ['일자', 'date'],
  ['날짜', 'date'],
  ['date', 'date'],
  // item code
  ['품번', 'item_code'],
  ['품목코드', 'item_code'],
  ['item code', 'item_code'],
  ['item_code', 'item_code'],
  // item name (optional)
  ['품명', 'item_name'],
  ['item name', 'item_name'],
  // company / vendor
  ['거래처코드', 'company_code'],
  ['거래처', 'company_name'],
  ['vendor', 'company_name'],
  ['company', 'company_name'],
  ['company code', 'company_code'],
  // quantity
  ['수량', 'quantity'],
  ['qty', 'quantity'],
  ['quantity', 'quantity'],
  // optional keys
  ['문서번호', 'doc_no'],
  ['비고', 'notes'],
]);

function buildHeaderMap(rawHeaders, kind) {
  const mapping = {};
  const table = kind === 'bom' ? BOM_HEADER_MAP : RECEIVING_HEADER_MAP;
  for (const raw of rawHeaders) {
    const key = NORMALIZE(raw);
    if (!key) continue;
    if (table.has(key)) {
      const std = table.get(key);
      if (std && !mapping[std]) mapping[std] = raw; // remember original header
    }
  }
  return mapping;
}

function mapRow(row, headerMap) {
  const mapped = {};
  for (const [stdKey, origHeader] of Object.entries(headerMap)) {
    mapped[stdKey] = row[origHeader];
  }
  return mapped;
}

module.exports = {
  buildHeaderMap,
  mapRow,
};



