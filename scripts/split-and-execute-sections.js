const fs = require('fs');
const path = require('path');

/**
 * SQL 파일을 배치로 나누어 실행하는 스크립트
 * 각 배치를 mcp_supabase_execute_sql을 통해 직접 DB에 실행합니다.
 */

const projectId = 'pybjnkbmtlyaftuiieyq';
const batchSize = 50; // 한 번에 처리할 레코드 수

/**
 * VALUES 절에서 레코드를 추출합니다.
 */
function extractValues(sql) {
  // VALUES 위치 찾기
  const valuesIndex = sql.indexOf('VALUES');
  if (valuesIndex === -1) {
    throw new Error('VALUES 절을 찾을 수 없습니다.');
  }
  
  // VALUES 다음부터 ) AS 전까지의 텍스트 추출
  const afterValues = sql.substring(valuesIndex + 6); // 'VALUES'.length = 6
  
  // ) AS 패턴으로 끝 찾기
  const asMatch = afterValues.match(/\s*\)\s*AS\s+\w+\(/);
  if (!asMatch) {
    throw new Error('AS 절을 찾을 수 없습니다.');
  }
  
  const valuesEndIndex = asMatch.index;
  const valuesBlock = afterValues.substring(0, valuesEndIndex);
  
  // 각 레코드 추출 - 정규식으로 ( ... ) 패턴 찾기
  const records = [];
  let depth = 0;
  let inString = false;
  let stringChar = null;
  let currentRecord = '';
  
  for (let i = 0; i < valuesBlock.length; i++) {
    const char = valuesBlock[i];
    const prevChar = i > 0 ? valuesBlock[i - 1] : '';
    
    // 문자열 처리
    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      currentRecord += char;
    } else if (inString && char === stringChar && prevChar !== '\\') {
      inString = false;
      stringChar = null;
      currentRecord += char;
    } else {
      currentRecord += char;
      
      if (!inString) {
        if (char === '(') {
          if (depth === 0) {
            // 새 레코드 시작
            currentRecord = '(';
          }
          depth++;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            // 레코드 완료
            const record = currentRecord.trim();
            if (record && record.length > 2) { // 최소 ( ) 보다 길어야 함
              records.push(record);
            }
            currentRecord = '';
          }
        }
      }
    }
  }
  
  if (records.length === 0) {
    throw new Error('레코드를 추출할 수 없습니다.');
  }
  
  return records;
}

/**
 * SQL 파일을 배치로 나누어 실행합니다.
 */
function splitAndExecuteSQL(sqlFile, sectionName, countQuery) {
  const sqlPath = path.join(process.cwd(), 'data', 'sql', sqlFile);
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ SQL 파일을 찾을 수 없습니다: ${sqlFile}`);
    return;
  }
  
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`\n=== ${sectionName} 배치 실행 시작 ===`);
  console.log(`SQL 파일: ${sqlFile}`);
  console.log(`SQL 길이: ${sql.length}자`);
  
  // VALUES 절에서 레코드 추출
  let records;
  try {
    records = extractValues(sql);
    console.log(`추출된 레코드 수: ${records.length}개`);
  } catch (error) {
    console.error(`❌ 레코드 추출 실패:`, error.message);
    return;
  }
  
  // INSERT 문의 공통 부분 추출 (VALUES 이전까지)
  const insertStart = sql.indexOf('INSERT INTO');
  const fromIndex = sql.indexOf('FROM (');
  if (fromIndex === -1) {
    throw new Error('FROM ( 절을 찾을 수 없습니다.');
  }
  // FROM ( 까지만 headerSQL (FROM ( 포함하지 않음)
  const headerSQL = sql.substring(insertStart, fromIndex).trim();
  
  // FROM 절 이후 부분 추출 () AS ph(...) 이후부터 끝까지)
  const asPattern = /\)\s*AS\s+(\w+)\([^)]*\)\s*/;
  const asMatch = sql.match(asPattern);
  if (!asMatch) {
    console.error('❌ AS 절을 찾을 수 없습니다.');
    return;
  }
  
  // AS 절 전체 추출 (예: ) AS ph(item_code, supplier_name, price_date, unit_price))
  const asClause = asMatch[0].trim();
  const asEndIndex = asMatch.index + asMatch[0].length;
  const footerSQL = sql.substring(asEndIndex).trim();
  
  // 배치별로 나누기
  const batches = [];
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    batches.push(batch);
  }
  
  console.log(`총 ${batches.length}개 배치로 분할 (배치 크기: ${batchSize})`);
  
  // 각 배치 SQL 생성
  const batchSQLs = batches.map((batch, idx) => {
    const batchValues = batch.join(',\n    ');
    const batchSQL = `${headerSQL}
FROM (
  VALUES
    ${batchValues}
${asClause}
${footerSQL}`;
    return {
      batchNumber: idx + 1,
      recordCount: batch.length,
      sql: batchSQL
    };
  });
  
  // 배치 SQL 파일 저장
  const batchDir = path.join(process.cwd(), 'data', 'sql', 'batches');
  fs.mkdirSync(batchDir, { recursive: true });
  
  const sectionDir = path.join(batchDir, sectionName.replace(/\s+/g, '-'));
  fs.mkdirSync(sectionDir, { recursive: true });
  
  batchSQLs.forEach(batch => {
    const batchFile = path.join(sectionDir, `batch-${String(batch.batchNumber).padStart(3, '0')}.sql`);
    fs.writeFileSync(batchFile, batch.sql, 'utf8');
  });
  
  console.log(`✅ 배치 SQL 파일 저장 완료: ${sectionDir}`);
  console.log(`총 ${batchSQLs.length}개 배치 파일 생성`);
  
  // 배치 정보를 JSON으로 저장
  const batchInfo = {
    sectionName,
    sqlFile,
    totalRecords: records.length,
    batchSize,
    totalBatches: batches.length,
    batches: batchSQLs.map(b => ({
      batchNumber: b.batchNumber,
      recordCount: b.recordCount,
      sqlFile: `batches/${sectionName.replace(/\s+/g, '-')}/batch-${String(b.batchNumber).padStart(3, '0')}.sql`
    }))
  };
  
  const infoFile = path.join(sectionDir, 'batch-info.json');
  fs.writeFileSync(infoFile, JSON.stringify(batchInfo, null, 2), 'utf8');
  
  console.log(`\n배치 정보 저장: ${infoFile}`);
  console.log(`\n=== ${sectionName} 배치 분할 완료 ===`);
  console.log(`\n다음 단계: mcp_supabase_execute_sql을 사용하여 각 배치를 실행하세요.`);
  
  return batchInfo;
}

// 메인 실행
const sections = [
  { sqlFile: 'new-section-3.sql', sectionName: '신규 단가 이력 추가', countQuery: 'SELECT COUNT(*) as count FROM item_price_history;' },
  { sqlFile: 'new-section-4.sql', sectionName: '신규 재고 거래 추가', countQuery: 'SELECT COUNT(*) as count FROM inventory_transactions;' },
  { sqlFile: 'new-section-1.sql', sectionName: '신규 품목 추가', countQuery: 'SELECT COUNT(*) as count FROM items WHERE is_active = true;' }
];

console.log('=== SQL 섹션 배치 분할 스크립트 ===\n');

sections.forEach(section => {
  splitAndExecuteSQL(section.sqlFile, section.sectionName, section.countQuery);
});

console.log('\n=== 모든 섹션 배치 분할 완료 ===');

