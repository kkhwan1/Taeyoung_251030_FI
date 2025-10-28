import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pybjnkbmtlyaftuiieyq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5Ympua2JtdGx5YWZ0dWlpZXlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg3ODY1NCwiZXhwIjoyMDc0NDU0NjU0fQ.rRg1ARqtxlf2mAbvrI-0isAZsupx32I2VlOSbKfvdGc'
);

async function checkTables() {
  const tables = ['item_images', 'portal_users', 'portal_sessions', 'contracts', 'contract_documents'];

  console.log('📋 Checking Database Tables:\n');

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: NOT FOUND (${error.message})`);
      } else {
        console.log(`✅ ${table}: EXISTS (${count || 0} rows)`);
      }
    } catch (err: any) {
      console.log(`❌ ${table}: ERROR (${err.message})`);
    }
  }

  console.log('\n📦 Checking Storage Buckets:\n');

  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    console.log(`❌ Storage: ${error.message}`);
  } else {
    const bucketNames = buckets.map(b => b.name);

    ['item-images', 'contract-documents'].forEach(name => {
      if (bucketNames.includes(name)) {
        console.log(`✅ ${name}: EXISTS`);
      } else {
        console.log(`❌ ${name}: MISSING`);
      }
    });
  }
}

checkTables().catch(console.error);
