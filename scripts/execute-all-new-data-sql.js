const fs = require('fs');
const path = require('path');

const projectId = 'pybjnkbmtlyaftuiieyq';

const sections = [
  { name: 'items', file: 'new-1-items.sql', count_query: 'SELECT COUNT(*) as count FROM items WHERE is_active = true;' },
  { name: 'companies', file: 'new-2-companies.sql', count_query: 'SELECT COUNT(*) as count FROM companies WHERE is_active = true;' },
  { name: 'price_history', file: 'new-3-price_history.sql', count_query: 'SELECT COUNT(*) as count FROM item_price_history;' },
  { name: 'inventory_transactions', file: 'new-4-inventory_transactions.sql', count_query: 'SELECT COUNT(*) as count FROM inventory_transactions;' }
];

async function executeSQL(query) {
  // This script is just a helper - actual execution will be done via MCP tools
  throw new Error('This script must be executed via MCP tools. SQL query prepared.');
}

async function applySqlSections() {
  for (const section of sections) {
    const sqlPath = path.join(process.cwd(), 'data', 'sql', section.file);
    
    if (!fs.existsSync(sqlPath)) {
      console.log(`⚠️ ${section.name} SQL 파일이 없습니다: ${section.file}`);
      continue;
    }

    const sql = fs.readFileSync(sqlPath, 'utf8').trim();
    
    if (!sql) {
      console.log(`⚠️ ${section.name} SQL이 비어 있습니다. 건너뜁니다.`);
      continue;
    }

    console.log(`\n=== ${section.name} 섹션 ===`);
    console.log(`SQL 파일: ${section.file}`);
    console.log(`SQL 길이: ${sql.length}자`);
    console.log(`\n다음 SQL을 mcp_supabase_execute_sql로 실행하세요:`);
    console.log(`\n프로젝트 ID: ${projectId}`);
    console.log(`\n--- SQL 시작 ---`);
    console.log(sql);
    console.log(`\n--- SQL 종료 ---\n`);
  }
  
  console.log('\n=== 모든 섹션 확인 완료 ===');
  console.log('각 섹션을 순차적으로 mcp_supabase_execute_sql로 실행하세요.');
}

applySqlSections().catch(error => {
  console.error('오류 발생:', error);
});

