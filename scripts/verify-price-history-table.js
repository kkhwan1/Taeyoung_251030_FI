/**
 * Verify Phase P3 MVP Price History Table
 *
 * This script performs comprehensive verification of the item_price_history table.
 */

const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.SUPABASE_DB_URL;

async function verifyTable() {
  console.log('='.repeat(70));
  console.log('Phase P3 MVP: item_price_history Table Verification');
  console.log('='.repeat(70));
  console.log('');

  if (!DB_URL) {
    console.error('❌ SUPABASE_DB_URL not found in environment');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DB_URL });

  try {
    // 1. Verify table exists
    console.log('1. Table Existence Check');
    console.log('-'.repeat(70));

    const tableCheck = await pool.query(`
      SELECT
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'item_price_history'
    `);

    if (tableCheck.rows.length > 0) {
      console.log('✓ Table exists');
      console.log(`  Name: ${tableCheck.rows[0].table_name}`);
      console.log(`  Type: ${tableCheck.rows[0].table_type}`);
    } else {
      console.error('❌ Table not found');
      process.exit(1);
    }

    // 2. Verify columns
    console.log('');
    console.log('2. Column Structure');
    console.log('-'.repeat(70));

    const columnCheck = await pool.query(`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'item_price_history'
      ORDER BY ordinal_position
    `);

    console.log(`✓ Found ${columnCheck.rows.length} columns:`);
    columnCheck.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const type = col.character_maximum_length
        ? `${col.data_type}(${col.character_maximum_length})`
        : col.data_type;
      console.log(`  - ${col.column_name.padEnd(20)} ${type.padEnd(20)} ${nullable}`);
    });

    // 3. Verify indexes
    console.log('');
    console.log('3. Index Verification');
    console.log('-'.repeat(70));

    const indexCheck = await pool.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'item_price_history'
      ORDER BY indexname
    `);

    if (indexCheck.rows.length > 0) {
      console.log(`✓ Found ${indexCheck.rows.length} indexes:`);
      indexCheck.rows.forEach(idx => {
        console.log(`  - ${idx.indexname}`);
        console.log(`    ${idx.indexdef}`);
      });
    } else {
      console.warn('⚠ No indexes found');
    }

    // 4. Verify constraints
    console.log('');
    console.log('4. Constraint Verification');
    console.log('-'.repeat(70));

    const constraintCheck = await pool.query(`
      SELECT
        con.conname,
        con.contype,
        pg_get_constraintdef(con.oid) as definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'item_price_history'
      ORDER BY con.conname
    `);

    if (constraintCheck.rows.length > 0) {
      console.log(`✓ Found ${constraintCheck.rows.length} constraints:`);
      constraintCheck.rows.forEach(con => {
        const type = {
          'p': 'PRIMARY KEY',
          'u': 'UNIQUE',
          'f': 'FOREIGN KEY',
          'c': 'CHECK'
        }[con.contype] || con.contype;
        console.log(`  - ${con.conname} (${type})`);
        console.log(`    ${con.definition}`);
      });
    } else {
      console.warn('⚠ No constraints found');
    }

    // 5. Verify foreign key relationship
    console.log('');
    console.log('5. Foreign Key Relationship');
    console.log('-'.repeat(70));

    const fkCheck = await pool.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'item_price_history'
        AND tc.constraint_type = 'FOREIGN KEY'
    `);

    if (fkCheck.rows.length > 0) {
      console.log('✓ Foreign key relationships:');
      fkCheck.rows.forEach(fk => {
        console.log(`  - ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    } else {
      console.warn('⚠ No foreign key relationships found');
    }

    // 6. Verify table comments
    console.log('');
    console.log('6. Table and Column Comments');
    console.log('-'.repeat(70));

    const commentCheck = await pool.query(`
      SELECT
        obj_description('item_price_history'::regclass) as table_comment
    `);

    if (commentCheck.rows[0].table_comment) {
      console.log('✓ Table comment:');
      console.log(`  "${commentCheck.rows[0].table_comment}"`);
    } else {
      console.log('  No table comment found');
    }

    const columnCommentCheck = await pool.query(`
      SELECT
        a.attname as column_name,
        col_description('item_price_history'::regclass, a.attnum) as comment
      FROM pg_attribute a
      WHERE a.attrelid = 'item_price_history'::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND col_description('item_price_history'::regclass, a.attnum) IS NOT NULL
      ORDER BY a.attnum
    `);

    if (columnCommentCheck.rows.length > 0) {
      console.log('✓ Column comments:');
      columnCommentCheck.rows.forEach(row => {
        console.log(`  - ${row.column_name}: "${row.comment}"`);
      });
    }

    // 7. Test basic operations
    console.log('');
    console.log('7. Basic Operations Test');
    console.log('-'.repeat(70));

    // Get a sample item_id from items table
    const itemResult = await pool.query(`
      SELECT item_id FROM items WHERE is_active = true LIMIT 1
    `);

    if (itemResult.rows.length === 0) {
      console.warn('⚠ No active items found, skipping insert test');
    } else {
      const testItemId = itemResult.rows[0].item_id;
      const testMonth = '2025-01-01';
      const testPrice = 15000.00;

      try {
        // Insert test record
        await pool.query(`
          INSERT INTO item_price_history (item_id, price_month, unit_price, note)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (item_id, price_month)
          DO UPDATE SET unit_price = EXCLUDED.unit_price
        `, [testItemId, testMonth, testPrice, 'Migration verification test']);

        console.log('✓ INSERT operation successful');

        // Select test record
        const selectResult = await pool.query(`
          SELECT * FROM item_price_history
          WHERE item_id = $1 AND price_month = $2
        `, [testItemId, testMonth]);

        if (selectResult.rows.length > 0) {
          console.log('✓ SELECT operation successful');
          console.log(`  Found record: item_id=${selectResult.rows[0].item_id}, price=${selectResult.rows[0].unit_price}`);
        }

        // Clean up test record
        await pool.query(`
          DELETE FROM item_price_history
          WHERE item_id = $1 AND price_month = $2
        `, [testItemId, testMonth]);

        console.log('✓ DELETE operation successful');
        console.log('✓ All CRUD operations working correctly');

      } catch (err) {
        console.error('❌ CRUD operation failed:', err.message);
      }
    }

    // 8. Summary
    console.log('');
    console.log('='.repeat(70));
    console.log('✓ Verification Complete');
    console.log('='.repeat(70));
    console.log('');
    console.log('Summary:');
    console.log(`  - Table: item_price_history`);
    console.log(`  - Columns: ${columnCheck.rows.length}`);
    console.log(`  - Indexes: ${indexCheck.rows.length}`);
    console.log(`  - Constraints: ${constraintCheck.rows.length}`);
    console.log(`  - Foreign Keys: ${fkCheck.rows.length}`);
    console.log('');
    console.log('✓ Table is ready for use!');
    console.log('');

  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyTable();
