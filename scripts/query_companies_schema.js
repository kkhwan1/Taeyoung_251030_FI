const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getTableSchema() {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('Companies table columns:', Object.keys(data[0]));
  } else {
    console.log('No data in companies table');
  }
  
  // Also try to get column info from information_schema
  const { data: columns, error: colError } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'companies'
        ORDER BY ordinal_position;
      `
    });
    
  if (!colError && columns) {
    console.log('\nDetailed column info:', columns);
  }
}

getTableSchema();
