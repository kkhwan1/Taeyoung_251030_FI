/**
 * Phase P7: Create all database tables for parallel implementation
 * - Contract Management
 * - Item Image Management
 * - Portal System
 */

import { getSupabaseClient } from '../src/lib/db-unified';

async function createPhasP7Tables() {
  const supabase = getSupabaseClient();

  console.log('🚀 Creating Phase P7 database tables...\n');

  try {
    // ============================================
    // Contract Management Tables
    // ============================================
    console.log('📄 Creating contract tables...');

    const { error: e1 } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS contracts (
          contract_id SERIAL PRIMARY KEY,
          company_id INTEGER REFERENCES companies(company_id) ON DELETE CASCADE,
          contract_no TEXT UNIQUE NOT NULL,
          contract_date DATE NOT NULL,
          start_date DATE,
          end_date DATE,
          total_amount DECIMAL(15,2),
          status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED')),
          searchable_text TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS contract_documents (
          document_id SERIAL PRIMARY KEY,
          contract_id INTEGER REFERENCES contracts(contract_id) ON DELETE CASCADE,
          document_url TEXT NOT NULL,
          document_type TEXT,
          file_size INTEGER,
          original_filename TEXT,
          page_count INTEGER,
          uploaded_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_contracts_company ON contracts(company_id);
        CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
        CREATE INDEX IF NOT EXISTS idx_contract_docs_contract ON contract_documents(contract_id);
      `
    });

    if (e1) throw new Error(`Contract tables error: ${e1.message}`);
    console.log('✅ Contract tables created');

    // ============================================
    // Item Image Management Table
    // ============================================
    console.log('\n📸 Creating item_images table...');

    const { error: e2 } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS item_images (
          image_id SERIAL PRIMARY KEY,
          item_id INTEGER REFERENCES items(item_id) ON DELETE CASCADE,
          image_url TEXT NOT NULL,
          file_size INTEGER,
          is_primary BOOLEAN DEFAULT FALSE,
          display_order INTEGER DEFAULT 0,
          uploaded_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_item_images_item_id ON item_images(item_id);
        CREATE INDEX IF NOT EXISTS idx_item_images_is_primary ON item_images(is_primary) WHERE is_primary = true;
      `
    });

    if (e2) throw new Error(`Item images table error: ${e2.message}`);
    console.log('✅ Item images table created');

    // ============================================
    // Portal System Tables
    // ============================================
    console.log('\n🔐 Creating portal tables...');

    const { error: e3 } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS portal_users (
          portal_user_id SERIAL PRIMARY KEY,
          company_id INTEGER REFERENCES companies(company_id) ON DELETE CASCADE,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          email TEXT,
          role TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'SUPPLIER', 'ADMIN')),
          is_active BOOLEAN DEFAULT TRUE,
          last_login_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS portal_sessions (
          session_id TEXT PRIMARY KEY,
          portal_user_id INTEGER REFERENCES portal_users(portal_user_id) ON DELETE CASCADE,
          session_token TEXT UNIQUE NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS portal_access_logs (
          log_id SERIAL PRIMARY KEY,
          portal_user_id INTEGER REFERENCES portal_users(portal_user_id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          ip_address TEXT,
          timestamp TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_portal_users_company ON portal_users(company_id);
        CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON portal_sessions(session_token);
        CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires ON portal_sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_portal_logs_user ON portal_access_logs(portal_user_id);
      `
    });

    if (e3) throw new Error(`Portal tables error: ${e3.message}`);
    console.log('✅ Portal tables created');

    console.log('\n✨ All Phase P7 tables created successfully!');
    console.log('\n📋 Summary:');
    console.log('  - contracts');
    console.log('  - contract_documents');
    console.log('  - item_images');
    console.log('  - portal_users');
    console.log('  - portal_sessions');
    console.log('  - portal_access_logs');

  } catch (error) {
    console.error('\n❌ Error creating tables:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createPhasP7Tables()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { createPhasP7Tables };
