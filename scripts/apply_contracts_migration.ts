import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

async function applyContractMigration() {
  try {
    console.log('🚀 Starting Contract Management migration...');
    console.log('📊 This will fix 28 TypeScript errors by creating missing tables');

    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'src', 'migrations', '20250123_create_contracts_fix_types.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Split SQL statements by semicolon
    const statements = sql
      .split(/;(?=(?:[^']*'[^']*')*[^']*$)/) // Split by semicolon not inside quotes
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 60).replace(/\n/g, ' ');

      console.log(`\n[${i + 1}/${statements.length}] Executing: ${preview}...`);

      // For Supabase, we need to execute raw SQL through the SQL editor API
      // Since we can't directly execute DDL, we'll use the Supabase dashboard
      // However, we can check if tables exist and provide feedback

      if (statement.includes('CREATE TABLE contracts')) {
        // Check if contracts table already exists
        const { data, error } = await supabase
          .from('contracts')
          .select('contract_id')
          .limit(1);

        if (error && error.code === '42P01') { // Table doesn't exist
          console.log('  ⚠️  contracts table does not exist - needs creation');
        } else if (!error) {
          console.log('  ✅ contracts table already exists');
        }
      }

      if (statement.includes('CREATE TABLE contract_documents')) {
        // Check if contract_documents table already exists
        const { data, error } = await supabase
          .from('contract_documents')
          .select('document_id')
          .limit(1);

        if (error && error.code === '42P01') { // Table doesn't exist
          console.log('  ⚠️  contract_documents table does not exist - needs creation');
        } else if (!error) {
          console.log('  ✅ contract_documents table already exists');
        }
      }
    }

    console.log('\n📋 Migration SQL prepared. Next steps:');
    console.log('1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/pybjnkbmtlyaftuiieyq/sql');
    console.log('2. Open the SQL Editor');
    console.log('3. Copy and paste the content from: src/migrations/20250123_create_contracts_fix_types.sql');
    console.log('4. Click "Run" to execute the migration');
    console.log('5. After successful execution, run: npm run db:types');
    console.log('\nThis will fix all 28 TypeScript errors! 🎉');

    // Also create the Storage bucket via Supabase Storage API
    console.log('\n📦 Creating Storage bucket for contract documents...');

    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (!bucketsError) {
      const bucketExists = buckets?.some(b => b.id === 'contract-documents' || b.name === 'contract-documents');

      if (!bucketExists) {
        const { data, error } = await supabase.storage.createBucket('contract-documents', {
          public: false,
          fileSizeLimit: 52428800, // 50MB
          allowedMimeTypes: [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          ]
        });

        if (error) {
          console.log('  ⚠️  Could not create storage bucket:', error.message);
        } else {
          console.log('  ✅ Storage bucket "contract-documents" created successfully');
        }
      } else {
        console.log('  ✅ Storage bucket "contract-documents" already exists');
      }
    } else {
      console.log('  ⚠️  Could not list storage buckets:', bucketsError.message);
    }

    console.log('\n✨ Migration preparation complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
applyContractMigration()
  .then(() => {
    console.log('\n🎯 Next step: Execute the SQL in Supabase Dashboard');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });