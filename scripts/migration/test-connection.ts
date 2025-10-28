import { createAdminClient, testConnection } from './utils/supabase-client';

async function main() {
  console.log('Supabase 연결 테스트...\n');
  
  const supabase = createAdminClient();
  const connected = await testConnection(supabase);
  
  if (connected) {
    console.log('✅ Supabase 연결 성공!');
    process.exit(0);
  } else {
    console.log('❌ Supabase 연결 실패!');
    process.exit(1);
  }
}

main();

