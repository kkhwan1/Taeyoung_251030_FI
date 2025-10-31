'use strict';

const fs = require('fs');
const path = require('path');

const EXAMPLE_DIR = path.resolve(__dirname, '../../.example');

const BOM_PATTERNS = [/bom/i, /bill\s*of\s*materials/i];
const RECEIVING_PATTERNS = [/입고/i, /receiv/i, /inbound/i];

function scanFiles() {
  if (!fs.existsSync(EXAMPLE_DIR)) {
    return { baseDir: EXAMPLE_DIR, bom: [], receiving: [], errors: [`Directory not found: ${EXAMPLE_DIR}`] };
  }
  const entries = fs.readdirSync(EXAMPLE_DIR);
  const excelFiles = entries.filter((f) => /\.(xlsx|xlsm|xls)$/i.test(f));

  const bom = [];
  const receiving = [];
  const others = [];
  for (const f of excelFiles) {
    const full = path.join(EXAMPLE_DIR, f);
    if (BOM_PATTERNS.some((p) => p.test(f))) bom.push(full);
    else if (RECEIVING_PATTERNS.some((p) => p.test(f))) receiving.push(full);
    else others.push(full);
  }

  return { baseDir: EXAMPLE_DIR, bom, receiving, others, errors: [] };
}

if (require.main === module) {
  const result = scanFiles();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { scanFiles };



