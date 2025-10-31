const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// This script will be used to execute SQL files via Supabase CLI or direct connection
// For now, we'll just output the SQL for manual execution or use mcp_supabase_execute_sql

const sqlFile = process.argv[2];

if (!sqlFile) {
  console.error('Usage: node execute-sql-file.js <sql-file>');
  process.exit(1);
}

const sqlPath = path.join(process.cwd(), 'data', 'sql', sqlFile);

if (!fs.existsSync(sqlPath)) {
  console.error('SQL 파일을 찾을 수 없습니다:', sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('SQL 파일 로드 완료:', sqlFile);
console.log('SQL 길이:', sql.length, '자');
console.log('\n=== SQL 내용 (처음 500자) ===');
console.log(sql.substring(0, 500));
console.log('\n=== SQL 내용 (마지막 500자) ===');
console.log(sql.substring(sql.length - 500));

console.log('\n주의: 이 스크립트는 SQL을 출력만 합니다. 실제 실행은 mcp_supabase_execute_sql을 사용하세요.');

