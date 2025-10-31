const fs = require('fs');
const path = require('path');

// 추출된 엑셀 데이터 읽기
const extractedDataPath = path.join(process.cwd(), 'data', 'extracted-excel-data.json');
const extractedData = JSON.parse(fs.readFileSync(extractedDataPath, 'utf8'));

// DB에 추가할 데이터만 필터링
const newData = {
  items: [],
  companies: [],
  bom: [],
  inventory_transactions: [],
  price_history: extractedData.price_history // 단가 이력은 모두 추가
};

// DB에서 기존 데이터 확인을 위한 쿼리 생성
const sqlQueries = {
  // 신규 품목 찾기
  findNewItems: `
    WITH excel_items AS (
      SELECT UNNEST(ARRAY[
${extractedData.items.map(item => `'${item.item_code.replace(/'/g, "''")}'`).join(',\n')}
      ]) AS item_code
    )
    SELECT excel_items.item_code
    FROM excel_items
    LEFT JOIN items ON items.item_code = excel_items.item_code
    WHERE items.item_code IS NULL;
  `,
  
  // 신규 거래처 찾기
  findNewCompanies: `
    WITH excel_companies AS (
      SELECT UNNEST(ARRAY[
${extractedData.companies.map(comp => `'${comp.company_name.replace(/'/g, "''")}'`).join(',\n')}
      ]) AS company_name
    )
    SELECT excel_companies.company_name
    FROM excel_companies
    LEFT JOIN companies ON companies.company_name = excel_companies.company_name
    WHERE companies.company_name IS NULL;
  `
};

// SQL 파일로 저장
const sqlDir = path.join(process.cwd(), 'data', 'sql');
if (!fs.existsSync(sqlDir)) {
  fs.mkdirSync(sqlDir, { recursive: true });
}

fs.writeFileSync(
  path.join(sqlDir, 'find-new-data.sql'),
  `-- 엑셀에서 추출한 신규 데이터 찾기\n\n` +
  `-- 1. 신규 품목 코드\n${sqlQueries.findNewItems}\n\n` +
  `-- 2. 신규 거래처명\n${sqlQueries.findNewCompanies}\n`,
  'utf8'
);

console.log('=== DB에 추가할 데이터 필터링 ===\n');
console.log(`엑셀 추출 데이터:`);
console.log(`  - 품목: ${extractedData.items.length}개`);
console.log(`  - 거래처: ${extractedData.companies.length}개`);
console.log(`  - 재고 거래: ${extractedData.inventory_transactions.length}개`);
console.log(`  - 단가 이력: ${extractedData.price_history.length}개\n`);

console.log('SQL 쿼리가 data/sql/find-new-data.sql에 저장되었습니다.');
console.log('\n다음 단계:');
console.log('1. find-new-data.sql을 실행하여 신규 데이터 확인');
console.log('2. 신규 데이터만 필터링하여 INSERT SQL 생성');
console.log('3. Supabase execute_sql로 데이터 추가');

