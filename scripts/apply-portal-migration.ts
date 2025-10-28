/**
 * Apply Portal Authentication Migration
 *
 * This script applies the portal authentication schema to Supabase using MCP.
 * It creates portal_users, portal_sessions, and portal_access_logs tables.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Import Supabase MCP function
const applyMigration = async (migrationName: string, sqlContent: string) => {
  const projectId = process.env.SUPABASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('SUPABASE_PROJECT_ID is not set in environment variables');
  }

  console.log(`\n📋 Applying migration: ${migrationName}`);
  console.log(`   Project ID: ${projectId}`);
  console.log(`   SQL length: ${sqlContent.length} characters\n`);

  // This would use the Supabase MCP server in production
  // For now, we'll use the Supabase client directly
  const { getSupabaseClient } = await import('@/lib/db-unified');
  const supabase = getSupabaseClient();

  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent
    });

    if (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }

    console.log('✅ Migration applied successfully!');
    return { success: true, data };
  } catch (error: any) {
    console.error('❌ Migration error:', error.message);
    throw error;
  }
};

const main = async () => {
  try {
    console.log('🚀 Portal Authentication Migration Tool');
    console.log('=========================================\n');

    // Read migration file
    const migrationPath = join(process.cwd(), 'src/migrations/004-create-portal-tables.sql');
    console.log(`📖 Reading migration file: ${migrationPath}`);

    const sqlContent = readFileSync(migrationPath, 'utf-8');

    // Apply migration
    await applyMigration('004-create-portal-tables', sqlContent);

    console.log('\n✅ All migrations completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: npm run portal:create-test-users');
    console.log('   2. Test login at: http://localhost:5000/portal/login');
    console.log('   3. Run E2E tests: npm run test:e2e tests/portal-auth-e2e.spec.ts\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

export { applyMigration, main };
