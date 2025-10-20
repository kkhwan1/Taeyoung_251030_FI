const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCompanyCodes() {
  const { data, error } = await supabase
    .from('companies')
    .select('company_id, company_code, company_name, company_type')
    .order('company_id', { ascending: true })
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Sample company codes:');
  console.table(data);
  
  // Check pattern
  const customerCodes = data.filter(c => c.company_type === '고객사');
  const supplierCodes = data.filter(c => c.company_type === '공급사');
  
  console.log('\nCustomer codes:', customerCodes.map(c => c.company_code));
  console.log('Supplier codes:', supplierCodes.map(c => c.company_code));
}

checkCompanyCodes();
