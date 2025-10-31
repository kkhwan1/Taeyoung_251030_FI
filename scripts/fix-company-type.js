const fs = require('fs');
const path = require('path');

const sqlPath = path.join(process.cwd(), 'data', 'sql', 'insert-excel-data-fixed.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

// company_type 값을 한글로 변환
const fixed = sql
  .replace(/'SUPPLIER'/g, "'공급사'::company_type")
  .replace(/'CUSTOMER'/g, "'고객사'::company_type")
  .replace(/'BOTH'/g, "'협력사'::company_type");

fs.writeFileSync(
  path.join(process.cwd(), 'data', 'sql', 'insert-excel-data-fixed.sql'),
  fixed,
  'utf8'
);

console.log('SQL 파일 수정 완료 - company_type 한글 값으로 변경');

