/**
 * Excel vs DB 데이터 누락 분석 스크립트
 *
 * 목적:
 * - 4개 Excel 파일의 모든 시트 분석
 * - Supabase DB 실제 저장 데이터와 비교
 * - 누락된 데이터 식별 및 원인 분석
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase 연결
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 환경 변수 누락: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Excel 파일 경로
const EXCEL_DIR = path.join(process.cwd(), '.example');
const EXCEL_FILES = [
  '태창금속 BOM.xlsx',
  '2025년 9월 매입매출 보고현황.xlsx',
  '2025년 9월 종합관리 SHEET.xlsx',
  '09월 원자재 수불관리.xlsx'
];

/**
 * Excel 파일 분석
 */
async function analyzeExcelFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n📄 분석 중: ${fileName}`);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  파일 없음: ${filePath}`);
    return null;
  }

  const workbook = XLSX.readFile(filePath);
  const analysis = {
    fileName,
    totalSheets: workbook.SheetNames.length,
    sheets: [],
    totalRecords: 0,
    estimatedTables: new Set()
  };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // 빈 행 제외하고 실제 데이터 행 계산
    const dataRows = data.filter(row =>
      row.some(cell => cell !== null && cell !== undefined && cell !== '')
    );

    const headers = dataRows.length > 0 ? dataRows[0] : [];
    const recordCount = dataRows.length > 1 ? dataRows.length - 1 : 0;

    // 헤더 기반으로 예상 테이블 추정
    const headersStr = headers.join('|').toLowerCase();
    let estimatedTable = 'unknown';

    if (headersStr.includes('품목') && headersStr.includes('수량')) {
      if (headersStr.includes('입고') || headersStr.includes('출고')) {
        estimatedTable = 'inventory_transactions';
      } else if (headersStr.includes('자품목') || headersStr.includes('모품목')) {
        estimatedTable = 'bom';
      } else {
        estimatedTable = 'items';
      }
    } else if (headersStr.includes('단가') || headersStr.includes('가격')) {
      estimatedTable = 'price_master';
    } else if (headersStr.includes('고객') || headersStr.includes('공급')) {
      estimatedTable = 'companies';
    } else if (headersStr.includes('매출') || headersStr.includes('매입')) {
      estimatedTable = 'sales_transactions or purchases';
    }

    analysis.sheets.push({
      sheetName,
      recordCount,
      headers: headers.slice(0, 10), // 첫 10개 컬럼만
      estimatedTable,
      sampleData: dataRows.slice(1, 4) // 샘플 3행
    });

    analysis.totalRecords += recordCount;
    if (estimatedTable !== 'unknown') {
      analysis.estimatedTables.add(estimatedTable);
    }
  }

  return analysis;
}

/**
 * DB 데이터 조회
 */
async function queryDatabaseStats() {
  console.log('\n🗄️  Supabase DB 데이터 조회 중...\n');

  const tables = [
    'items',
    'companies',
    'bom',
    'inventory_transactions',
    'price_master',
    'sales_transactions',
    'purchase_transactions',
    'inbound_transactions',
    'outbound_transactions',
    'production_transactions'
  ];

  const stats = {};

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (error) throw error;

      stats[table] = count || 0;
      console.log(`✅ ${table.padEnd(30)} ${count} 건`);
    } catch (error) {
      console.log(`⚠️  ${table.padEnd(30)} 조회 실패: ${error.message}`);
      stats[table] = 0;
    }
  }

  return stats;
}

/**
 * 품목 코드 검증 (DB에 존재하는지 확인)
 */
async function validateItemCodes(itemCodes) {
  if (!itemCodes || itemCodes.length === 0) return { valid: 0, invalid: 0, missing: [] };

  const { data, error } = await supabase
    .from('items')
    .select('item_code')
    .in('item_code', itemCodes);

  if (error) {
    console.error('품목 코드 검증 실패:', error.message);
    return { valid: 0, invalid: itemCodes.length, missing: itemCodes };
  }

  const existingCodes = new Set(data.map(item => item.item_code));
  const missingCodes = itemCodes.filter(code => !existingCodes.has(code));

  return {
    valid: existingCodes.size,
    invalid: missingCodes.length,
    missing: missingCodes
  };
}

/**
 * 회사 코드 검증
 */
async function validateCompanyCodes(companyCodes) {
  if (!companyCodes || companyCodes.length === 0) return { valid: 0, invalid: 0, missing: [] };

  const { data, error } = await supabase
    .from('companies')
    .select('company_code')
    .in('company_code', companyCodes);

  if (error) {
    console.error('회사 코드 검증 실패:', error.message);
    return { valid: 0, invalid: companyCodes.length, missing: companyCodes };
  }

  const existingCodes = new Set(data.map(c => c.company_code));
  const missingCodes = companyCodes.filter(code => !existingCodes.has(code));

  return {
    valid: existingCodes.size,
    invalid: missingCodes.length,
    missing: missingCodes
  };
}

/**
 * 비교 분석 및 리포트 생성
 */
function generateGapReport(excelAnalysis, dbStats) {
  const report = {
    timestamp: new Date().toLocaleString('ko-KR'),
    summary: {
      excelFiles: excelAnalysis.length,
      totalExcelRecords: 0,
      totalDbRecords: 0,
      estimatedGap: 0,
      gapPercentage: 0
    },
    excelBreakdown: [],
    dbBreakdown: [],
    gaps: [],
    recommendations: []
  };

  // Excel 분석 요약
  for (const analysis of excelAnalysis) {
    if (!analysis) continue;

    report.summary.totalExcelRecords += analysis.totalRecords;
    report.excelBreakdown.push({
      file: analysis.fileName,
      sheets: analysis.totalSheets,
      records: analysis.totalRecords,
      estimatedTables: Array.from(analysis.estimatedTables),
      details: analysis.sheets.map(s => ({
        sheet: s.sheetName,
        records: s.recordCount,
        table: s.estimatedTable
      }))
    });
  }

  // DB 통계 요약
  report.summary.totalDbRecords = Object.values(dbStats).reduce((sum, count) => sum + count, 0);
  report.dbBreakdown = Object.entries(dbStats).map(([table, count]) => ({
    table,
    records: count
  }));

  // 갭 분석
  report.summary.estimatedGap = report.summary.totalExcelRecords - report.summary.totalDbRecords;
  report.summary.gapPercentage = report.summary.totalExcelRecords > 0
    ? ((report.summary.estimatedGap / report.summary.totalExcelRecords) * 100).toFixed(2)
    : 0;

  // 테이블별 갭 분석
  const tableMapping = {
    'items': ['items'],
    'bom': ['bom'],
    'inventory_transactions': ['inventory_transactions', 'inbound_transactions', 'outbound_transactions', 'production_transactions'],
    'price_master': ['price_master'],
    'companies': ['companies']
  };

  for (const [excelTable, dbTables] of Object.entries(tableMapping)) {
    const excelCount = report.excelBreakdown.reduce((sum, file) => {
      const sheets = file.details.filter(s => s.table === excelTable);
      return sum + sheets.reduce((s, sheet) => s + sheet.records, 0);
    }, 0);

    const dbCount = dbTables.reduce((sum, table) => sum + (dbStats[table] || 0), 0);

    if (excelCount > 0) {
      const gap = excelCount - dbCount;
      const gapPct = ((gap / excelCount) * 100).toFixed(2);

      report.gaps.push({
        table: excelTable,
        excelRecords: excelCount,
        dbRecords: dbCount,
        gap,
        gapPercentage: gapPct,
        status: gap > 0 ? '❌ 누락' : gap < 0 ? '⚠️  초과' : '✅ 일치'
      });
    }
  }

  // 권장사항
  if (dbStats.price_master === 0) {
    report.recommendations.push({
      priority: 'HIGH',
      issue: 'price_master 테이블 완전 비어있음',
      action: 'Excel 최신단가 시트 임포트 필요'
    });
  }

  const bomGap = report.gaps.find(g => g.table === 'bom');
  if (bomGap && bomGap.gap > 100) {
    report.recommendations.push({
      priority: 'HIGH',
      issue: `BOM 데이터 ${bomGap.gap}건 누락 (${bomGap.gapPercentage}%)`,
      action: '품목 코드 매핑 실패 해결 후 재임포트'
    });
  }

  return report;
}

/**
 * 리포트 출력
 */
function printReport(report) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 Excel vs DB 데이터 누락 분석 리포트');
  console.log('='.repeat(80));
  console.log(`생성 시간: ${report.timestamp}\n`);

  console.log('📈 전체 요약');
  console.log('-'.repeat(80));
  console.log(`Excel 파일 수:      ${report.summary.excelFiles}개`);
  console.log(`Excel 총 레코드:    ${report.summary.totalExcelRecords.toLocaleString()}건`);
  console.log(`DB 총 레코드:       ${report.summary.totalDbRecords.toLocaleString()}건`);
  console.log(`예상 누락:          ${report.summary.estimatedGap.toLocaleString()}건`);
  console.log(`누락률:             ${report.summary.gapPercentage}%\n`);

  console.log('📄 Excel 파일별 분석');
  console.log('-'.repeat(80));
  for (const file of report.excelBreakdown) {
    console.log(`\n${file.file}`);
    console.log(`  - 시트 수: ${file.sheets}개`);
    console.log(`  - 레코드: ${file.records}건`);
    console.log(`  - 예상 테이블: ${file.estimatedTables.join(', ')}`);
    for (const detail of file.details) {
      console.log(`    └─ ${detail.sheet}: ${detail.records}건 → ${detail.table}`);
    }
  }

  console.log('\n🗄️  DB 테이블별 저장 현황');
  console.log('-'.repeat(80));
  for (const db of report.dbBreakdown) {
    console.log(`${db.table.padEnd(30)} ${db.records.toLocaleString().padStart(10)}건`);
  }

  console.log('\n❌ 테이블별 데이터 갭');
  console.log('-'.repeat(80));
  console.log('테이블                    Excel      DB    누락    누락률   상태');
  console.log('-'.repeat(80));
  for (const gap of report.gaps) {
    console.log(
      `${gap.table.padEnd(20)} ` +
      `${gap.excelRecords.toString().padStart(7)} ` +
      `${gap.dbRecords.toString().padStart(7)} ` +
      `${gap.gap.toString().padStart(7)} ` +
      `${(gap.gapPercentage + '%').padStart(8)} ` +
      `${gap.status}`
    );
  }

  if (report.recommendations.length > 0) {
    console.log('\n💡 권장 조치사항');
    console.log('-'.repeat(80));
    for (const rec of report.recommendations) {
      console.log(`[${rec.priority}] ${rec.issue}`);
      console.log(`      → ${rec.action}\n`);
    }
  }

  console.log('='.repeat(80));
}

/**
 * 메인 실행
 */
async function main() {
  console.log('🚀 Excel vs DB 데이터 누락 분석 시작\n');

  // 1. Excel 파일 분석
  const excelAnalysis = [];
  for (const file of EXCEL_FILES) {
    const filePath = path.join(EXCEL_DIR, file);
    const analysis = await analyzeExcelFile(filePath);
    excelAnalysis.push(analysis);
  }

  // 2. DB 통계 조회
  const dbStats = await queryDatabaseStats();

  // 3. 비교 분석 및 리포트 생성
  const report = generateGapReport(excelAnalysis, dbStats);

  // 4. 리포트 출력
  printReport(report);

  // 5. JSON 파일로 저장
  const reportPath = path.join(process.cwd(), 'EXCEL_DB_GAP_ANALYSIS.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n✅ 상세 리포트 저장: ${reportPath}`);

  // 6. Markdown 리포트 생성
  const mdReport = generateMarkdownReport(report);
  const mdPath = path.join(process.cwd(), 'EXCEL_DB_GAP_ANALYSIS.md');
  fs.writeFileSync(mdPath, mdReport, 'utf8');
  console.log(`✅ Markdown 리포트 저장: ${mdPath}\n`);
}

/**
 * Markdown 리포트 생성
 */
function generateMarkdownReport(report) {
  let md = '# Excel vs DB 데이터 누락 분석 리포트\n\n';
  md += `**생성 시간**: ${report.timestamp}\n\n`;

  md += '## 📈 전체 요약\n\n';
  md += '| 항목 | 값 |\n';
  md += '|------|----|\n';
  md += `| Excel 파일 수 | ${report.summary.excelFiles}개 |\n`;
  md += `| Excel 총 레코드 | ${report.summary.totalExcelRecords.toLocaleString()}건 |\n`;
  md += `| DB 총 레코드 | ${report.summary.totalDbRecords.toLocaleString()}건 |\n`;
  md += `| 예상 누락 | ${report.summary.estimatedGap.toLocaleString()}건 |\n`;
  md += `| 누락률 | ${report.summary.gapPercentage}% |\n\n`;

  md += '## 📄 Excel 파일별 분석\n\n';
  for (const file of report.excelBreakdown) {
    md += `### ${file.file}\n\n`;
    md += `- **시트 수**: ${file.sheets}개\n`;
    md += `- **총 레코드**: ${file.records}건\n`;
    md += `- **예상 테이블**: ${file.estimatedTables.join(', ')}\n\n`;
    md += '| 시트명 | 레코드 수 | 예상 테이블 |\n';
    md += '|--------|-----------|-------------|\n';
    for (const detail of file.details) {
      md += `| ${detail.sheet} | ${detail.records}건 | ${detail.table} |\n`;
    }
    md += '\n';
  }

  md += '## 🗄️ DB 테이블별 저장 현황\n\n';
  md += '| 테이블 | 레코드 수 |\n';
  md += '|--------|----------|\n';
  for (const db of report.dbBreakdown) {
    md += `| ${db.table} | ${db.records.toLocaleString()}건 |\n`;
  }
  md += '\n';

  md += '## ❌ 테이블별 데이터 갭\n\n';
  md += '| 테이블 | Excel | DB | 누락 | 누락률 | 상태 |\n';
  md += '|--------|-------|----|----|-------|------|\n';
  for (const gap of report.gaps) {
    md += `| ${gap.table} | ${gap.excelRecords} | ${gap.dbRecords} | ${gap.gap} | ${gap.gapPercentage}% | ${gap.status} |\n`;
  }
  md += '\n';

  if (report.recommendations.length > 0) {
    md += '## 💡 권장 조치사항\n\n';
    for (const rec of report.recommendations) {
      md += `### [${rec.priority}] ${rec.issue}\n\n`;
      md += `**조치**: ${rec.action}\n\n`;
    }
  }

  return md;
}

// 실행
main().catch(console.error);
