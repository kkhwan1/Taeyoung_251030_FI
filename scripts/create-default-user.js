require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function createDefaultUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('user_id')
      .eq('user_id', 1)
      .single();

    if (existingUser) {
      console.log('Default user (user_id: 1) already exists');
      return;
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create default user
    const { data, error } = await supabase
      .from('users')
      .insert({
        user_id: 1,
        username: 'admin',
        password: hashedPassword,
        name: '시스템 관리자',
        email: 'admin@example.com',
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('Error creating default user:', error);
      process.exit(1);
    }

    console.log('Default user created successfully:', data);
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

createDefaultUser();
