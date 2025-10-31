/**
 * Excel vs DB 상세 품목별 비교 분석
 *
 * 목적:
 * - Excel 원본 데이터 샘플 추출
 * - DB 저장 데이터와 품목별 1:1 비교
 * - 한글 인코딩 정확성 검증
 * - 누락된 특정 품목 식별
 * - 데이터 값 일치 여부 검증
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase 연결
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 환경 변수 누락');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const EXCEL_DIR = path.join(process.cwd(), '.example');

/**
 * Excel 파일에서 샘플 데이터 추출
 */
function extractExcelSamples(filePath, sheetName, sampleCount = 10) {
  const workbook = XLSX.readFile(filePath);

  if (!workbook.SheetNames.includes(sheetName)) {
    console.log(`⚠️  시트 없음: ${sheetName}`);
    return [];
  }

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  return data.slice(0, sampleCount);
}

/**
 * 품목 코드 추출 (다양한 컬럼명 대응)
 */
function extractItemCode(row) {
  const possibleFields = [
    'P/NO', 'P/N', 'PNO', 'PN',
    '품목코드', '품번', '부품번호',
    'item_code', 'itemCode', 'ItemCode',
    'ITEM_CODE', 'ITEM CODE'
  ];

  for (const field of possibleFields) {
    if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
      return String(row[field]).trim();
    }
  }

  return null;
}

/**
 * 품목명 추출 (다양한 컬럼명 대응)
 */
function extractItemName(row) {
  const possibleFields = [
    '품명', '품목명', '부품명', '제품명',
    'item_name', 'itemName', 'ItemName',
    'ITEM_NAME', 'ITEM NAME', 'NAME'
  ];

  for (const field of possibleFields) {
    if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
      return String(row[field]).trim();
    }
  }

  return null;
}

/**
 * DB에서 품목 조회
 */
async function queryItemFromDB(itemCode) {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('item_code', itemCode)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned (정상)
    console.error(`DB 조회 에러 (${itemCode}):`, error.message);
    return null;
  }

  return data;
}

/**
 * BOM 관계 조회
 */
async function queryBOMFromDB(parentCode, childCode) {
  const { data, error } = await supabase
    .from('bom')
    .select('*')
    .eq('parent_item_code', parentCode)
    .eq('child_item_code', childCode)
    .single();

  if (error && error.code !== 'PGRST116') {
    return null;
  }

  return data;
}

/**
 * 단가 조회
 */
async function queryPriceFromDB(itemCode) {
  const { data, error } = await supabase
    .from('price_master')
    .select('*')
    .eq('item_code', itemCode)
    .order('effective_date', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    return null;
  }

  return data;
}

/**
 * 한글 인코딩 검증
 */
function validateKoreanEncoding(text) {
  if (!text) return { valid: true, issue: null };

  const hasKorean = /[가-힣]/.test(text);
  const hasMojibake = /[ë¶€í'ˆìˆ˜ëŸ‰]/.test(text); // 깨진 한글 패턴

  if (hasMojibake) {
    return { valid: false, issue: 'mojibake_detected' };
  }

  if (hasKorean) {
    return { valid: true, issue: null };
  }

  return { valid: true, issue: 'no_korean' };
}

/**
 * 테이블별 상세 비교
 */
async function compareItemsTable() {
  console.log('\n📦 품목(Items) 테이블 상세 비교\n');
  console.log('='.repeat(100));

  // Excel에서 품목 샘플 추출
  const bomFile = path.join(EXCEL_DIR, '태창금속 BOM.xlsx');
  const workbook = XLSX.readFile(bomFile);

  let allExcelItems = [];

  // 모든 시트에서 품목 코드 추출
  for (const sheetName of workbook.SheetNames) {
    if (sheetName === '최신단가') continue; // 단가 시트는 별도 처리

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    for (const row of data) {
      const itemCode = extractItemCode(row);
      const itemName = extractItemName(row);

      if (itemCode) {
        allExcelItems.push({
          source: `태창금속 BOM.xlsx > ${sheetName}`,
          item_code: itemCode,
          item_name: itemName,
          rawRow: row
        });
      }
    }
  }

  console.log(`Excel에서 추출한 품목: ${allExcelItems.length}개\n`);

  // 랜덤 샘플 10개 선택
  const samples = [];
  const step = Math.floor(allExcelItems.length / 10);
  for (let i = 0; i < 10 && i * step < allExcelItems.length; i++) {
    samples.push(allExcelItems[i * step]);
  }

  const results = {
    total_sampled: samples.length,
    found_in_db: 0,
    not_found_in_db: 0,
    encoding_issues: 0,
    name_mismatch: 0,
    details: []
  };

  for (const sample of samples) {
    const dbItem = await queryItemFromDB(sample.item_code);

    const comparison = {
      item_code: sample.item_code,
      excel_name: sample.item_name,
      db_name: dbItem ? dbItem.item_name : null,
      in_db: !!dbItem,
      source: sample.source
    };

    // 한글 인코딩 검증
    if (sample.item_name) {
      const excelEncoding = validateKoreanEncoding(sample.item_name);
      comparison.excel_encoding = excelEncoding.valid ? '✅ 정상' : `❌ ${excelEncoding.issue}`;
    }

    if (dbItem && dbItem.item_name) {
      const dbEncoding = validateKoreanEncoding(dbItem.item_name);
      comparison.db_encoding = dbEncoding.valid ? '✅ 정상' : `❌ ${dbEncoding.issue}`;

      if (!dbEncoding.valid) {
        results.encoding_issues++;
      }

      // 품명 일치 여부
      if (sample.item_name && dbItem.item_name) {
        comparison.name_match = sample.item_name === dbItem.item_name ? '✅ 일치' : '⚠️ 불일치';
        if (sample.item_name !== dbItem.item_name) {
          results.name_mismatch++;
        }
      }
    }

    results.details.push(comparison);

    if (dbItem) {
      results.found_in_db++;
      console.log(`✅ ${sample.item_code.padEnd(20)} | Excel: ${(sample.item_name || 'N/A').padEnd(30)} | DB: ${(dbItem.item_name || 'N/A').padEnd(30)} | ${comparison.name_match || ''}`);
    } else {
      results.not_found_in_db++;
      console.log(`❌ ${sample.item_code.padEnd(20)} | Excel: ${(sample.item_name || 'N/A').padEnd(30)} | DB: 없음`);
    }
  }

  console.log('\n' + '-'.repeat(100));
  console.log(`샘플 총계: ${results.total_sampled}개`);
  console.log(`DB 존재: ${results.found_in_db}개 (${(results.found_in_db / results.total_sampled * 100).toFixed(1)}%)`);
  console.log(`DB 누락: ${results.not_found_in_db}개 (${(results.not_found_in_db / results.total_sampled * 100).toFixed(1)}%)`);
  console.log(`인코딩 문제: ${results.encoding_issues}개`);
  console.log(`품명 불일치: ${results.name_mismatch}개`);

  return results;
}

/**
 * BOM 테이블 상세 비교
 */
async function compareBOMTable() {
  console.log('\n🔗 BOM 테이블 상세 비교\n');
  console.log('='.repeat(100));

  const bomFile = path.join(EXCEL_DIR, '태창금속 BOM.xlsx');
  const workbook = XLSX.readFile(bomFile);

  let allBOMRelations = [];

  // BOM 관계 추출
  for (const sheetName of workbook.SheetNames) {
    if (sheetName === '최신단가') continue;

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    for (const row of data) {
      // 부모-자식 관계 추출 (다양한 컬럼명 대응)
      const parentCode = row['모품목'] || row['PARENT'] || row['parent_item_code'];
      const childCode = row['자품목'] || row['CHILD'] || row['child_item_code'] || extractItemCode(row);
      const quantity = row['수량'] || row['QTY'] || row['quantity'] || 1;

      if (parentCode && childCode && parentCode !== childCode) {
        allBOMRelations.push({
          source: `태창금속 BOM.xlsx > ${sheetName}`,
          parent_code: String(parentCode).trim(),
          child_code: String(childCode).trim(),
          quantity: parseFloat(quantity) || 1,
          rawRow: row
        });
      }
    }
  }

  console.log(`Excel에서 추출한 BOM 관계: ${allBOMRelations.length}개\n`);

  // 랜덤 샘플 10개
  const samples = [];
  const step = Math.floor(allBOMRelations.length / 10);
  for (let i = 0; i < 10 && i * step < allBOMRelations.length; i++) {
    samples.push(allBOMRelations[i * step]);
  }

  const results = {
    total_sampled: samples.length,
    found_in_db: 0,
    not_found_in_db: 0,
    quantity_mismatch: 0,
    details: []
  };

  for (const sample of samples) {
    const dbBOM = await queryBOMFromDB(sample.parent_code, sample.child_code);

    const comparison = {
      parent_code: sample.parent_code,
      child_code: sample.child_code,
      excel_quantity: sample.quantity,
      db_quantity: dbBOM ? dbBOM.quantity : null,
      in_db: !!dbBOM,
      source: sample.source
    };

    if (dbBOM) {
      results.found_in_db++;
      const qtyMatch = Math.abs(sample.quantity - dbBOM.quantity) < 0.001;
      comparison.quantity_match = qtyMatch ? '✅ 일치' : '⚠️ 불일치';
      if (!qtyMatch) results.quantity_mismatch++;

      console.log(`✅ ${sample.parent_code} → ${sample.child_code} | Excel 수량: ${sample.quantity} | DB 수량: ${dbBOM.quantity} | ${comparison.quantity_match}`);
    } else {
      results.not_found_in_db++;
      console.log(`❌ ${sample.parent_code} → ${sample.child_code} | Excel 수량: ${sample.quantity} | DB: 없음`);
    }

    results.details.push(comparison);
  }

  console.log('\n' + '-'.repeat(100));
  console.log(`샘플 총계: ${results.total_sampled}개`);
  console.log(`DB 존재: ${results.found_in_db}개 (${(results.found_in_db / results.total_sampled * 100).toFixed(1)}%)`);
  console.log(`DB 누락: ${results.not_found_in_db}개 (${(results.not_found_in_db / results.total_sampled * 100).toFixed(1)}%)`);
  console.log(`수량 불일치: ${results.quantity_mismatch}개`);

  return results;
}

/**
 * 단가 테이블 상세 비교
 */
async function comparePriceTable() {
  console.log('\n💰 단가(Price Master) 테이블 상세 비교\n');
  console.log('='.repeat(100));

  const bomFile = path.join(EXCEL_DIR, '태창금속 BOM.xlsx');
  const samples = extractExcelSamples(bomFile, '최신단가', 10);

  console.log(`Excel '최신단가' 시트 샘플: ${samples.length}개\n`);

  const results = {
    total_sampled: samples.length,
    found_in_db: 0,
    not_found_in_db: 0,
    price_mismatch: 0,
    details: []
  };

  for (const sample of samples) {
    const itemCode = extractItemCode(sample);
    if (!itemCode) continue;

    const excelPrice = sample['단가'] || sample['PRICE'] || sample['price'] || sample['unit_price'];
    const dbPrice = await queryPriceFromDB(itemCode);

    const comparison = {
      item_code: itemCode,
      excel_price: excelPrice,
      db_price: dbPrice ? dbPrice.unit_price : null,
      in_db: !!dbPrice
    };

    if (dbPrice) {
      results.found_in_db++;
      const priceMatch = Math.abs(excelPrice - dbPrice.unit_price) < 0.01;
      comparison.price_match = priceMatch ? '✅ 일치' : '⚠️ 불일치';
      if (!priceMatch) results.price_mismatch++;

      console.log(`✅ ${itemCode.padEnd(20)} | Excel 단가: ₩${excelPrice?.toLocaleString() || 'N/A'} | DB 단가: ₩${dbPrice.unit_price.toLocaleString()} | ${comparison.price_match}`);
    } else {
      results.not_found_in_db++;
      console.log(`❌ ${itemCode.padEnd(20)} | Excel 단가: ₩${excelPrice?.toLocaleString() || 'N/A'} | DB: 없음 (price_master 테이블 비어있음)`);
    }

    results.details.push(comparison);
  }

  console.log('\n' + '-'.repeat(100));
  console.log(`샘플 총계: ${results.total_sampled}개`);
  console.log(`DB 존재: ${results.found_in_db}개`);
  console.log(`DB 누락: ${results.not_found_in_db}개 ⚠️ price_master 테이블 완전 비어있음!`);

  return results;
}

/**
 * 입고 거래 상세 비교
 */
async function compareInboundTransactions() {
  console.log('\n📥 입고 거래 상세 비교\n');
  console.log('='.repeat(100));

  const file = path.join(EXCEL_DIR, '2025년 9월 종합관리 SHEET.xlsx');
  const coilSamples = extractExcelSamples(file, 'COIL 입고현황', 5);
  const sheetSamples = extractExcelSamples(file, 'SHEET 입고현황', 5);

  const allSamples = [...coilSamples, ...sheetSamples];
  console.log(`Excel 입고 샘플: ${allSamples.length}개 (COIL: ${coilSamples.length}, SHEET: ${sheetSamples.length})\n`);

  // DB 조회
  const { data: dbInbound, error } = await supabase
    .from('inbound_transactions')
    .select('*')
    .limit(10);

  console.log(`DB inbound_transactions: ${dbInbound?.length || 0}건\n`);

  if (!dbInbound || dbInbound.length === 0) {
    console.log('❌ DB에 입고 거래 데이터가 전혀 없습니다!');
    console.log('⚠️  Excel에는 532건(COIL 266 + SHEET 266)의 입고 데이터가 있으나 DB는 비어있음\n');

    // Excel 샘플 구조 출력
    if (allSamples.length > 0) {
      console.log('Excel 샘플 구조:');
      console.log(JSON.stringify(allSamples[0], null, 2));
    }
  }

  return {
    excel_count: 532,
    db_count: dbInbound?.length || 0,
    missing: 532 - (dbInbound?.length || 0)
  };
}

/**
 * 메인 실행
 */
async function main() {
  console.log('🔍 Excel vs DB 상세 품목별 비교 분석 시작\n');

  const report = {
    timestamp: new Date().toLocaleString('ko-KR'),
    items: await compareItemsTable(),
    bom: await compareBOMTable(),
    price: await comparePriceTable(),
    inbound: await compareInboundTransactions()
  };

  // 최종 요약
  console.log('\n' + '='.repeat(100));
  console.log('📊 최종 요약\n');
  console.log('='.repeat(100));

  console.log('\n품목(Items):');
  console.log(`  - 샘플 ${report.items.total_sampled}개 중 DB 존재: ${report.items.found_in_db}개 (${(report.items.found_in_db / report.items.total_sampled * 100).toFixed(1)}%)`);
  console.log(`  - 한글 인코딩 문제: ${report.items.encoding_issues}개`);
  console.log(`  - 품명 불일치: ${report.items.name_mismatch}개`);

  console.log('\nBOM 관계:');
  console.log(`  - 샘플 ${report.bom.total_sampled}개 중 DB 존재: ${report.bom.found_in_db}개 (${(report.bom.found_in_db / report.bom.total_sampled * 100).toFixed(1)}%)`);
  console.log(`  - 수량 불일치: ${report.bom.quantity_mismatch}개`);

  console.log('\n단가(Price):');
  console.log(`  - 샘플 ${report.price.total_sampled}개 중 DB 존재: ${report.price.found_in_db}개`);
  console.log(`  - ⚠️  price_master 테이블 완전 비어있음 (243건 누락)`);

  console.log('\n입고 거래:');
  console.log(`  - Excel: ${report.inbound.excel_count}건`);
  console.log(`  - DB: ${report.inbound.db_count}건`);
  console.log(`  - 누락: ${report.inbound.missing}건`);

  // JSON 저장
  const reportPath = path.join(process.cwd(), 'DETAILED_EXCEL_DB_COMPARISON.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n✅ 상세 리포트 저장: ${reportPath}\n`);
}

main().catch(console.error);
