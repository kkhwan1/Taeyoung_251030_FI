require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkTriggers() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Query to get all triggers on inventory_transactions table
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          trigger_name,
          event_manipulation,
          action_timing,
          action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'inventory_transactions'
        ORDER BY trigger_name;
      `
    });

    if (error) {
      console.error('Error checking triggers:', error);
      
      // Try direct SQL query
      console.log('\nTrying alternative method...');
      const { data: triggers, error: directError } = await supabase
        .from('information_schema.triggers')
        .select('*')
        .eq('event_object_table', 'inventory_transactions');
      
      if (directError) {
        console.error('Direct query also failed:', directError);
        console.log('\nTriggers cannot be queried through Supabase client.');
        console.log('Please check the triggers manually in the Supabase dashboard.');
      } else {
        console.log('Triggers found:', triggers);
      }
    } else {
      console.log('Triggers on inventory_transactions table:');
      console.log(data);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkTriggers();
