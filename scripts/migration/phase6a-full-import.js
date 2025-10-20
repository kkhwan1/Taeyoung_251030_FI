/**
 * Phase 6A: 전체 데이터 Import
 *
 * Excel MCP를 통해 전체 매입매출 데이터를 읽어서 DB에 저장
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Statistics
const stats = {
  companiesCreated: 0,
  itemsCreated: 0,
  salesImported: 0,
  purchasesImported: 0,
  salesSkipped: 0,
  purchasesSkipped: 0,
  errors: []
};

// Caches
const companyCache = new Map();
const itemCache = new Map();

// Excel 데이터 파싱 (CSV 형식)
function parseCSVRow(csvRow) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csvRow.length; i++) {
    const char = csvRow[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseCSV(csvString) {
  return csvString.trim().split('\n').map(parseCSVRow);
}

function createTransactionDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function generateTransactionNo(type, date, sequence) {
  const datePart = date.replace(/-/g, '');
  const seqPart = String(sequence).padStart(4, '0');
  return `${type}-${datePart}-${seqPart}`;
}

async function getOrCreateCompany(companyCode, companyType = '고객사') {
  const cacheKey = `${companyCode}_${companyType}`;
  if (companyCache.has(cacheKey)) return companyCache.get(cacheKey);

  let { data } = await supabase
    .from('companies')
    .select('company_id')
    .eq('company_code', companyCode)
    .eq('company_type', companyType)
    .maybeSingle();

  if (data) {
    companyCache.set(cacheKey, data.company_id);
    return data.company_id;
  }

  const { data: newCompany, error } = await supabase
    .from('companies')
    .insert({
      company_code: companyCode,
      company_name: companyCode,
      company_type: companyType,
      is_active: true
    })
    .select()
    .single();

  if (error || !newCompany) {
    stats.errors.push({ type: 'company_create', code: companyCode, error: error?.message });
    return null;
  }

  stats.companiesCreated++;
  companyCache.set(cacheKey, newCompany.company_id);
  return newCompany.company_id;
}

async function getOrCreateItem(itemCode, itemName) {
  if (itemCache.has(itemCode)) return itemCache.get(itemCode);

  let { data } = await supabase
    .from('items')
    .select('item_id')
    .eq('item_code', itemCode)
    .maybeSingle();

  if (data) {
    itemCache.set(itemCode, data.item_id);
    return data.item_id;
  }

  const { data: newItem, error } = await supabase
    .from('items')
    .insert({
      item_code: itemCode,
      item_name: itemName,
      category: '상품',
      unit: 'EA',
      is_active: true
    })
    .select()
    .single();

  if (error || !newItem) {
    stats.errors.push({ type: 'item_create', code: itemCode, error: error?.message });
    return null;
  }

  stats.itemsCreated++;
  itemCache.set(itemCode, newItem.item_id);
  return newItem.item_id;
}

function parseSalesRow(row, year, month, startDayCol = 6) {
  const transactions = [];
  const customerCode = row[1];
  const itemCode = row[2];
  const itemName = row[3];
  const vehicleModel = row[4];
  const unitPrice = parseFloat(row[5]) || 0;

  if (!customerCode || !itemCode) return transactions;

  for (let day = 1; day <= 31; day++) {
    const colIndex = startDayCol + day - 1;
    const quantity = parseFloat(row[colIndex]) || 0;

    if (quantity > 0) {
      const transactionDate = createTransactionDate(year, month, day);
      const supplyAmount = Math.round(quantity * unitPrice);
      const taxAmount = Math.round(supplyAmount * 0.1);
      const totalAmount = supplyAmount + taxAmount;

      transactions.push({
        transaction_date: transactionDate,
        customer_code: customerCode,
        item_code: itemCode,
        item_name: itemName,
        vehicle_model: vehicleModel,
        quantity: quantity,
        unit: 'EA',
        unit_price: unitPrice,
        supply_amount: supplyAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_status: 'PENDING'
      });
    }
  }

  return transactions;
}

function parsePurchaseRow(row, year, month, startDayCol = 9) {
  const transactions = [];
  const supplierCode = row[2];
  const itemCode = row[6];
  const itemName = row[7];
  const vehicleModel = row[5];
  const unitPrice = parseFloat(row[8]) || 0;

  if (!supplierCode || !itemCode) return transactions;

  for (let day = 1; day <= 31; day++) {
    const colIndex = startDayCol + day - 1;
    const quantity = parseFloat(row[colIndex]) || 0;

    if (quantity > 0) {
      const transactionDate = createTransactionDate(year, month, day);
      const supplyAmount = Math.round(quantity * unitPrice);
      const taxAmount = Math.round(supplyAmount * 0.1);
      const totalAmount = supplyAmount + taxAmount;

      transactions.push({
        transaction_date: transactionDate,
        supplier_code: supplierCode,
        item_code: itemCode,
        item_name: itemName,
        vehicle_model: vehicleModel,
        quantity: quantity,
        unit: 'EA',
        unit_price: unitPrice,
        supply_amount: supplyAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_status: 'PENDING'
      });
    }
  }

  return transactions;
}

async function saveSalesTransaction(transaction, sequence) {
  const customerId = await getOrCreateCompany(transaction.customer_code, '고객사');
  const itemId = await getOrCreateItem(transaction.item_code, transaction.item_name);

  if (!customerId || !itemId) {
    stats.salesSkipped++;
    return null;
  }

  const transactionNo = generateTransactionNo('S', transaction.transaction_date, sequence);

  const { data, error } = await supabase
    .from('sales_transactions')
    .insert({
      transaction_no: transactionNo,
      transaction_date: transaction.transaction_date,
      customer_id: customerId,
      customer_name: transaction.customer_code,
      item_id: itemId,
      item_name: transaction.item_name,
      vehicle_model: transaction.vehicle_model,
      quantity: transaction.quantity,
      unit: transaction.unit,
      unit_price: transaction.unit_price,
      supply_amount: transaction.supply_amount,
      tax_amount: transaction.tax_amount,
      total_amount: transaction.total_amount,
      payment_status: transaction.payment_status
    })
    .select()
    .single();

  if (error) {
    stats.errors.push({ type: 'sales_insert', transaction: transactionNo, error: error.message });
    stats.salesSkipped++;
    return null;
  }

  stats.salesImported++;
  return data;
}

async function savePurchaseTransaction(transaction, sequence) {
  const supplierId = await getOrCreateCompany(transaction.supplier_code, '공급사');
  const itemId = await getOrCreateItem(transaction.item_code, transaction.item_name);

  if (!supplierId || !itemId) {
    stats.purchasesSkipped++;
    return null;
  }

  const transactionNo = generateTransactionNo('P', transaction.transaction_date, sequence);

  const { data, error } = await supabase
    .from('purchase_transactions')
    .insert({
      transaction_no: transactionNo,
      transaction_date: transaction.transaction_date,
      supplier_id: supplierId,
      supplier_name: transaction.supplier_code,
      item_id: itemId,
      item_name: transaction.item_name,
      vehicle_model: transaction.vehicle_model,
      quantity: transaction.quantity,
      unit: transaction.unit,
      unit_price: transaction.unit_price,
      supply_amount: transaction.supply_amount,
      tax_amount: transaction.tax_amount,
      total_amount: transaction.total_amount,
      payment_status: transaction.payment_status
    })
    .select()
    .single();

  if (error) {
    stats.errors.push({ type: 'purchase_insert', transaction: transactionNo, error: error.message });
    stats.purchasesSkipped++;
    return null;
  }

  stats.purchasesImported++;
  return data;
}

function printProgress(current, total, type) {
  const percent = Math.round((current / total) * 100);
  const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
  process.stdout.write(`\r${type}: [${bar}] ${percent}% (${current}/${total})`);
}

function printStats() {
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 Full Import Statistics');
  console.log('='.repeat(60));
  console.log(`\n🏢 Companies Created: ${stats.companiesCreated}`);
  console.log(`📦 Items Created: ${stats.itemsCreated}`);
  console.log(`\n✅ Sales Imported: ${stats.salesImported}`);
  console.log(`✅ Purchases Imported: ${stats.purchasesImported}`);
  console.log(`⏭️  Sales Skipped: ${stats.salesSkipped}`);
  console.log(`⏭️  Purchases Skipped: ${stats.purchasesSkipped}`);
  console.log(`\n❌ Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0 && stats.errors.length <= 10) {
    console.log('\nError Details:');
    stats.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. [${err.type}] ${err.code || err.transaction}: ${err.error}`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// Export for external use
export {
  parseCSV,
  parseSalesRow,
  parsePurchaseRow,
  saveSalesTransaction,
  savePurchaseTransaction,
  printProgress,
  printStats,
  stats
};
