#!/usr/bin/env node

/**
 * Backup Current Database State
 * Exports all tables to JSON for rollback capability
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function backupDatabase() {
  console.log('🔄 Starting database backup...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupDir = path.join(__dirname, 'migration', 'backups');
  const backupFile = path.join(backupDir, `pre-migration-${timestamp}.json`);

  // Ensure backup directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backup = {
    timestamp: new Date().toISOString(),
    tables: {}
  };

  const tables = [
    'users', 'companies', 'items', 'warehouses', 'bom',
    'inventory_transactions', 'sales_transactions', 'purchase_transactions',
    'collections', 'payments', 'coil_specs', 'price_master',
    'scrap_tracking', 'warehouse_stock', 'serials', 'bom_deduction_log'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*');

      if (error) throw error;

      backup.tables[table] = data;
      console.log(`✅ ${table}: ${data.length} records backed up`);
    } catch (error) {
      console.error(`❌ Error backing up ${table}:`, error.message);
      backup.tables[table] = { error: error.message };
    }
  }

  // Write backup file
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

  const stats = fs.statSync(backupFile);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n✅ Backup completed!`);
  console.log(`📁 File: ${backupFile}`);
  console.log(`📊 Size: ${fileSizeMB} MB`);
  console.log(`📋 Total tables: ${Object.keys(backup.tables).length}`);

  return backupFile;
}

backupDatabase()
  .then(file => {
    console.log('\n✅ Backup successful!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Backup failed:', error);
    process.exit(1);
  });
