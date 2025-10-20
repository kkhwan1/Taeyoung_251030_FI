require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250119_add_coating_status_to_items.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  console.log('📋 Applying coating_status migration...');
  console.log('Migration file:', migrationPath);

  // Execute SQL directly via raw query
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: migrationSQL });

  if (error) {
    console.error('❌ Migration failed:', error);

    // If RPC doesn't exist, try direct execution via Supabase REST API
    console.log('\n⚠️ RPC method failed. Attempting direct SQL execution...');

    const { data: directData, error: directError } = await supabase
      .from('items')
      .select('*')
      .limit(0); // Just to test connection

    if (directError) {
      console.error('❌ Supabase connection test failed:', directError);
      process.exit(1);
    }

    console.log('✅ Supabase connection is working');
    console.log('\n📝 Manual steps required:');
    console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. Navigate to: SQL Editor');
    console.log('3. Copy and execute the SQL from:', migrationPath);
    console.log('4. Verify by running: SELECT column_name FROM information_schema.columns WHERE table_name = \'items\' AND column_name = \'coating_status\';');

    process.exit(1);
  }

  console.log('✅ Migration applied successfully!');
  console.log('Result:', data);

  // Verify the column was created
  const { data: verifyData, error: verifyError } = await supabase
    .from('items')
    .select('coating_status')
    .limit(1);

  if (verifyError) {
    console.error('⚠️ Could not verify coating_status column:', verifyError);
  } else {
    console.log('✅ Verified: coating_status column exists and is queryable');
  }
}

applyMigration().catch(console.error);
