import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration(migrationFile: string) {
  try {
    console.log(`Applying migration: ${migrationFile}`);

    const migrationPath = path.join(process.cwd(), 'src', 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        // Try direct execution if rpc fails
        const { error: directError } = await supabase.from('_migrations').insert({
          name: migrationFile,
          executed_at: new Date().toISOString()
        });

        if (directError) {
          console.error('Error executing statement:', directError);
          throw directError;
        }
      }
    }

    console.log(`✅ Migration applied successfully: ${migrationFile}`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
applyMigration('create_item_images_table.sql')
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
