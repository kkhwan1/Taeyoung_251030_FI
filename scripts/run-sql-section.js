const fs = require('fs');
const path = require('path');

// This script reads a SQL file and outputs it for execution
const sqlFile = process.argv[2];

if (!sqlFile) {
  console.error('Usage: node run-sql-section.js <sql-file>');
  process.exit(1);
}

const sqlPath = path.join(process.cwd(), 'data', 'sql', sqlFile);

if (!fs.existsSync(sqlPath)) {
  console.error('SQL 파일을 찾을 수 없습니다:', sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

// Output the SQL to stdout (will be captured by the caller)
console.log(sql);

