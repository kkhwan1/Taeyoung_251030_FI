const fs = require('fs');
const path = require('path');
const { mcp_supabase_execute_sql } = require('./tool-code');

const projectId = 'pybjnkbmtlyaftuiieyq';
const sqlPath = path.join(process.cwd(), 'data', 'sql', 'insert-new-data.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('=== 신규 데이터 SQL 적용 시작 ===\n');

// SQL을 섹션별로 분할
const sections = [];

// 1. Items 섹션
const itemsMatch = sql.match(/-- =+\n-- 1\. 신규 품목 추가\n-- =+\n([\s\S]*?)(?=-- =+\n-- 2\. |$)/);
if (itemsMatch) {
  sections.push({ 
    name: '품목', 
    sql: itemsMatch[1].trim(),
    countQuery: 'SELECT COUNT(*) as count FROM items WHERE is_active = true;'
  });
}

// 2. Companies 섹션
const companiesMatch = sql.match(/-- =+\n-- 2\. 신규 거래처 추가\n-- =+\n([\s\S]*?)(?=-- =+\n-- 3\. |$)/);
if (companiesMatch) {
  sections.push({ 
    name: '거래처', 
    sql: companiesMatch[1].trim(),
    countQuery: 'SELECT COUNT(*) as count FROM companies WHERE is_active = true;'
  });
}

// 3. Price History 섹션
const priceHistoryMatch = sql.match(/-- =+\n-- 3\. 신규 단가 이력 추가\n-- =+\n([\s\S]*?)(?=-- =+\n-- 4\. |$)/);
if (priceHistoryMatch) {
  sections.push({ 
    name: '단가 이력', 
    sql: priceHistoryMatch[1].trim(),
    countQuery: 'SELECT COUNT(*) as count FROM item_price_history;'
  });
}

// 4. Inventory Transactions 섹션
const inventoryMatch = sql.match(/-- =+\n-- 4\. 신규 재고 거래 추가\n-- =+\n([\s\S]*)$/);
if (inventoryMatch) {
  sections.push({ 
    name: '재고 거래', 
    sql: inventoryMatch[1].trim(),
    countQuery: 'SELECT COUNT(*) as count FROM inventory_transactions;'
  });
}

async function applySqlSections() {
  for (const section of sections) {
    if (!section.sql) {
      console.log(`⚠️ ${section.name} 섹션 SQL이 비어 있습니다. 건너뜁니다.\n`);
      continue;
    }

    console.log(`\n--- ${section.name} 섹션 적용 시작 ---`);
    console.log(`SQL 길이: ${section.sql.length}자`);

    // Before count
    let beforeCount = 0;
    try {
      const beforeResult = await mcp_supabase_execute_sql({ project_id: projectId, query: section.countQuery });
      beforeCount = beforeResult[0].count;
      console.log(`  적용 전 ${section.name} 개수: ${beforeCount}`);
    } catch (error) {
      console.error(`  ❌ 적용 전 ${section.name} 개수 조회 중 오류 발생:`, error.message);
    }

    // Apply SQL
    try {
      await mcp_supabase_execute_sql({ project_id: projectId, query: section.sql });
      console.log(`  ✅ ${section.name} SQL 적용 완료.`);
    } catch (error) {
      console.error(`  ❌ ${section.name} SQL 적용 중 오류 발생:`, error.message);
      console.error(`  오류 상세:`, error);
      // continue; // 오류 발생 시에도 다음 섹션 계속 진행
    }

    // After count
    let afterCount = 0;
    try {
      const afterResult = await mcp_supabase_execute_sql({ project_id: projectId, query: section.countQuery });
      afterCount = afterResult[0].count;
      console.log(`  적용 후 ${section.name} 개수: ${afterCount}`);
      console.log(`  추가된 ${section.name} 개수: ${afterCount - beforeCount}`);
    } catch (error) {
      console.error(`  ❌ 적용 후 ${section.name} 개수 조회 중 오류 발생:`, error.message);
    }
    console.log(`--- ${section.name} 섹션 적용 완료 ---\n`);
  }
  console.log('=== 모든 SQL 섹션 적용 완료 ===');
}

applySqlSections().catch(error => {
  console.error('SQL 섹션 적용 중 치명적인 오류 발생:', error);
  process.exit(1);
});

