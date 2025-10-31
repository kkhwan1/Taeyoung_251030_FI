const fs = require('fs');
const path = require('path');

const sqlPath = path.join(process.cwd(), 'data', 'sql', 'insert-excel-data.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

// category 값을 ENUM 타입으로 캐스팅
const fixed = sql
  .replace(/'원자재'/g, "'원자재'::item_category")
  .replace(/'부자재'/g, "'부자재'::item_category")
  .replace(/'반제품'/g, "'반제품'::item_category")
  .replace(/'제품'/g, "'제품'::item_category")
  .replace(/'상품'/g, "'상품'::item_category");

fs.writeFileSync(
  path.join(process.cwd(), 'data', 'sql', 'insert-excel-data-fixed.sql'),
  fixed,
  'utf8'
);

console.log('SQL 파일 수정 완료 - category ENUM 타입 추가');

