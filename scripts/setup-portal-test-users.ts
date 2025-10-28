/**
 * Setup Portal Test Users
 *
 * Creates test portal users with Korean usernames for E2E testing
 * Run: npx tsx scripts/setup-portal-test-users.ts
 */

import { getSupabaseClient } from '../src/lib/db-unified';
import { hashPortalPassword } from '../src/lib/portal-auth';

interface TestUser {
  username: string;
  password: string;
  email: string;
  role: 'CUSTOMER' | 'SUPPLIER' | 'ADMIN';
  companyName: string;
  companyType: string;
}

const testUsers: TestUser[] = [
  {
    username: '김철수_고객사',
    password: 'test123!',
    email: 'kim@customer-a.com',
    role: 'CUSTOMER',
    companyName: '테스트 고객사 A',
    companyType: '고객사',
  },
  {
    username: '이영희_공급사',
    password: 'test123!',
    email: 'lee@supplier-b.com',
    role: 'SUPPLIER',
    companyName: '테스트 공급사 B',
    companyType: '공급사',
  },
  {
    username: 'admin_portal',
    password: 'admin123!',
    email: 'admin@taechang.com',
    role: 'ADMIN',
    companyName: '태창자동차',
    companyType: '기타',
  },
];

async function setupPortalTestUsers() {
  const supabase = getSupabaseClient();

  console.log('🚀 Starting portal test user setup...\n');

  for (const user of testUsers) {
    try {
      console.log(`📝 Creating user: ${user.username} (${user.role})`);

      // 1. Check if company exists, create if not
      let companyId: number;
      const { data: existingCompanies } = await supabase
        .from('companies')
        .select('company_id')
        .eq('company_name', user.companyName)
        .limit(1);

      if (existingCompanies && existingCompanies.length > 0) {
        companyId = existingCompanies[0].company_id;
        console.log(`   ✓ Found existing company: ${user.companyName} (ID: ${companyId})`);
      } else {
        // Create company
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({
            company_name: user.companyName,
            company_type: user.companyType,
            contact_person: user.username,
            email: user.email,
            is_active: true,
          })
          .select('company_id')
          .single();

        if (companyError || !newCompany) {
          throw new Error(`Failed to create company: ${companyError?.message}`);
        }

        companyId = newCompany.company_id;
        console.log(`   ✓ Created new company: ${user.companyName} (ID: ${companyId})`);
      }

      // 2. Check if portal user exists
      const { data: existingUsers } = await supabase
        .from('portal_users')
        .select('portal_user_id, username')
        .eq('username', user.username)
        .limit(1);

      if (existingUsers && existingUsers.length > 0) {
        console.log(`   ⚠️  User already exists: ${user.username}`);
        console.log(`   📌 Updating password...`);

        // Update password
        const passwordHash = await hashPortalPassword(user.password);
        const { error: updateError } = await supabase
          .from('portal_users')
          .update({
            password_hash: passwordHash,
            email: user.email,
            role: user.role,
            company_id: companyId,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('portal_user_id', existingUsers[0].portal_user_id);

        if (updateError) {
          throw new Error(`Failed to update user: ${updateError.message}`);
        }

        console.log(`   ✓ Updated user: ${user.username}\n`);
      } else {
        // Create new portal user
        const passwordHash = await hashPortalPassword(user.password);

        const { error: insertError } = await supabase
          .from('portal_users')
          .insert({
            company_id: companyId,
            username: user.username,
            password_hash: passwordHash,
            email: user.email,
            role: user.role,
            is_active: true,
          });

        if (insertError) {
          throw new Error(`Failed to create user: ${insertError.message}`);
        }

        console.log(`   ✓ Created user: ${user.username}\n`);
      }
    } catch (error) {
      console.error(`   ❌ Error creating user ${user.username}:`, error);
      console.error('');
    }
  }

  console.log('✅ Portal test users setup complete!\n');
  console.log('📋 Test Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  testUsers.forEach((user) => {
    console.log(`👤 ${user.username}`);
    console.log(`   Password: ${user.password}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Company: ${user.companyName}`);
    console.log('');
  });
}

// Run setup
setupPortalTestUsers()
  .then(() => {
    console.log('🎉 Setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Setup failed:', error);
    process.exit(1);
  });
