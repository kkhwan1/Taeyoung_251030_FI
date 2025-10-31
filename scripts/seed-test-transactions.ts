#!/usr/bin/env tsx
/**
 * Test Data Seeding Script for Accounting Tests
 *
 * Creates realistic sales and purchase transactions for testing:
 * - Sales transactions with customers
 * - Purchase transactions with suppliers
 * - Data spread across multiple months (2024-10 to 2025-01)
 * - Various transaction amounts and dates
 *
 * Usage:
 *   npx tsx scripts/seed-test-transactions.ts
 *   npx tsx scripts/seed-test-transactions.ts --clear  # Clear existing test data first
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper: Generate random date within a month
function randomDateInMonth(year: number, month: number): string {
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = Math.floor(Math.random() * daysInMonth) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Helper: Generate random amount
function randomAmount(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

// Helper: Generate transaction number
function generateTransactionNo(prefix: string, index: number, date: string): string {
  const dateStr = date.replace(/-/g, '');
  return `${prefix}-${dateStr}-${String(index).padStart(4, '0')}`;
}

async function clearExistingTestData() {
  console.log('🗑️  Clearing existing test data...');

  const tables = ['collections', 'payments', 'sales_transactions', 'purchase_transactions'];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('transaction_id', 0);
    if (error) {
      console.error(`❌ Error clearing ${table}:`, error.message);
    } else {
      console.log(`✅ Cleared ${table}`);
    }
  }
}

async function seedTransactions() {
  console.log('\n📊 Starting test data seeding...\n');

  // Get companies
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('company_id, company_name, company_type, company_category')
    .eq('is_active', true);

  if (companyError || !companies) {
    console.error('❌ Error fetching companies:', companyError?.message);
    return;
  }

  const customers = companies.filter(c => c.company_type === '고객사' || c.company_type === 'CUSTOMER');
  const suppliers = companies.filter(c => c.company_type === '공급사' || c.company_type === 'SUPPLIER');

  console.log(`📋 Found ${customers.length} customers and ${suppliers.length} suppliers`);

  if (customers.length === 0 || suppliers.length === 0) {
    console.error('❌ Need at least 1 customer and 1 supplier');
    return;
  }

  // Get sample items
  const { data: items, error: itemError } = await supabase
    .from('items')
    .select('item_id, item_name')
    .eq('is_active', true)
    .limit(50);

  if (itemError || !items || items.length === 0) {
    console.error('❌ Error fetching items:', itemError?.message);
    return;
  }

  console.log(`📦 Found ${items.length} items`);

  // Generate transactions for 4 months
  const months = [
    { year: 2024, month: 10, label: '2024-10' },
    { year: 2024, month: 11, label: '2024-11' },
    { year: 2024, month: 12, label: '2024-12' },
    { year: 2025, month: 1, label: '2025-01' }
  ];

  let totalSales = 0;
  let totalPurchases = 0;

  for (const monthInfo of months) {
    console.log(`\n📅 Generating transactions for ${monthInfo.label}...`);

    // Generate 10-15 sales transactions per month
    const salesCount = Math.floor(Math.random() * 6) + 10;
    const salesTransactions = [];

    for (let i = 0; i < salesCount; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const item = items[Math.floor(Math.random() * items.length)];
      const transactionDate = randomDateInMonth(monthInfo.year, monthInfo.month);
      const quantity = Math.floor(Math.random() * 50) + 10;
      const unitPrice = randomAmount(10, 100);
      const supplyAmount = quantity * unitPrice;
      const taxAmount = Math.floor(supplyAmount * 0.1);
      const totalAmount = supplyAmount + taxAmount;

      salesTransactions.push({
        transaction_no: generateTransactionNo('SALE', i + 1, transactionDate),
        transaction_date: transactionDate,
        customer_id: customer.company_id,
        customer_name: customer.company_name,
        item_id: item.item_id,
        item_name: item.item_name,
        quantity,
        unit: 'EA',
        unit_price: unitPrice,
        supply_amount: supplyAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_status: 'PENDING',
        paid_amount: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    const { data: insertedSales, error: salesError } = await supabase
      .from('sales_transactions')
      .insert(salesTransactions)
      .select();

    if (salesError) {
      console.error(`❌ Error inserting sales for ${monthInfo.label}:`, salesError.message);
      continue;
    }

    console.log(`✅ Created ${insertedSales?.length || 0} sales transactions`);
    totalSales += insertedSales?.length || 0;

    // Generate 8-12 purchase transactions per month
    const purchaseCount = Math.floor(Math.random() * 5) + 8;
    const purchaseTransactions = [];

    for (let i = 0; i < purchaseCount; i++) {
      const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
      const item = items[Math.floor(Math.random() * items.length)];
      const transactionDate = randomDateInMonth(monthInfo.year, monthInfo.month);
      const quantity = Math.floor(Math.random() * 100) + 20;
      const unitPrice = randomAmount(5, 80);
      const supplyAmount = quantity * unitPrice;
      const taxAmount = Math.floor(supplyAmount * 0.1);
      const totalAmount = supplyAmount + taxAmount;

      purchaseTransactions.push({
        transaction_no: generateTransactionNo('PURC', i + 1, transactionDate),
        transaction_date: transactionDate,
        supplier_id: supplier.company_id,
        supplier_name: supplier.company_name,
        item_id: item.item_id,
        item_name: item.item_name,
        quantity,
        unit: 'EA',
        unit_price: unitPrice,
        supply_amount: supplyAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_status: 'PENDING',
        paid_amount: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    const { data: insertedPurchases, error: purchaseError } = await supabase
      .from('purchase_transactions')
      .insert(purchaseTransactions)
      .select();

    if (purchaseError) {
      console.error(`❌ Error inserting purchases for ${monthInfo.label}:`, purchaseError.message);
      continue;
    }

    console.log(`✅ Created ${insertedPurchases?.length || 0} purchase transactions`);
    totalPurchases += insertedPurchases?.length || 0;

    // Add some collections and payments (partial)
    if (insertedSales && insertedSales.length > 0) {
      const collectionsToAdd = insertedSales.slice(0, Math.floor(salesCount / 2)).map((sale, idx) => ({
        transaction_id: sale.transaction_id,
        collection_date: randomDateInMonth(monthInfo.year, monthInfo.month),
        collection_amount: Math.floor(sale.total_amount * (0.3 + Math.random() * 0.5)),
        collection_method: idx % 3 === 0 ? '현금' : idx % 3 === 1 ? '계좌이체' : '어음',
        created_at: new Date().toISOString()
      }));

      const { error: collectionError } = await supabase
        .from('collections')
        .insert(collectionsToAdd);

      if (!collectionError) {
        console.log(`✅ Created ${collectionsToAdd.length} collection records`);
      }
    }

    if (insertedPurchases && insertedPurchases.length > 0) {
      const paymentsToAdd = insertedPurchases.slice(0, Math.floor(purchaseCount / 2)).map((purchase, idx) => ({
        transaction_id: purchase.transaction_id,
        payment_date: randomDateInMonth(monthInfo.year, monthInfo.month),
        payment_amount: Math.floor(purchase.total_amount * (0.3 + Math.random() * 0.5)),
        payment_method: idx % 3 === 0 ? '현금' : idx % 3 === 1 ? '계좌이체' : '어음',
        created_at: new Date().toISOString()
      }));

      const { error: paymentError } = await supabase
        .from('payments')
        .insert(paymentsToAdd);

      if (!paymentError) {
        console.log(`✅ Created ${paymentsToAdd.length} payment records`);
      }
    }
  }

  console.log('\n✅ Test data seeding completed!');
  console.log(`📊 Total created: ${totalSales} sales, ${totalPurchases} purchases`);
  console.log('\n🧪 You can now run the accounting tests and E2E tests.');
}

async function main() {
  const args = process.argv.slice(2);
  const shouldClear = args.includes('--clear');

  if (shouldClear) {
    await clearExistingTestData();
  }

  await seedTransactions();
}

main().catch(console.error);
