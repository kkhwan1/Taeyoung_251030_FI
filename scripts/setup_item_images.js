const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupItemImages() {
  console.log('🚀 Setting up item_images table and storage bucket...\n');

  try {
    // Create storage bucket
    console.log('📦 Creating storage bucket: item-images');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('Error listing buckets:', listError);
    }

    const bucketExists = buckets?.some(b => b.name === 'item-images');

    if (!bucketExists) {
      const { data: bucket, error: bucketError } = await supabase.storage.createBucket('item-images', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      });

      if (bucketError) {
        console.error('❌ Error creating bucket:', bucketError);
      } else {
        console.log('✅ Storage bucket created successfully');
      }
    } else {
      console.log('✅ Storage bucket already exists');
    }

    // Note: Table creation should be done via Supabase Dashboard SQL Editor
    // because Supabase JS client doesn't support DDL operations
    console.log('\n📝 Please run the following SQL in Supabase Dashboard SQL Editor:\n');
    console.log('   https://supabase.com/dashboard/project/pybjnkbmtlyaftuiieyq/sql\n');
    console.log('Copy and paste the SQL from: src/migrations/create_item_images_table.sql\n');
    console.log('✅ Setup complete! Remember to run the SQL migration in Supabase Dashboard.');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupItemImages();
