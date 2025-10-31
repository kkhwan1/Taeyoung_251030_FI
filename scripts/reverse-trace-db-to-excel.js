/**
 * DB 데이터 역추적 스크립트
 * 현재 DB에 있는 데이터가 어느 Excel 시트에서 왔는지 추적
 */

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 환경 변수 누락: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const EXCEL_DIR = 'C:\\Users\\USER\\claude_code\\FITaeYoungERP\\.example';
const EXCEL_FILES = [
  '태창금속 BOM.xlsx',
  '2025년 9월 매입매출 보고현황.xlsx',
  '2025년 9월 종합관리 SHEET.xlsx',
  '09월 원자재 수불관리.xlsx'
];

/**
 * DB에서 품목 샘플 가져오기
 */
async function getDBItemSamples(limit = 20) {
  const { data, error } = await supabase
    .from('items')
    .select('item_id, item_code, item_name, spec, material, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('DB 조회 에러:', error);
    return [];
  }

  return data || [];
}

/**
 * DB에서 BOM 샘플 가져오기
 */
async function getDBBOMSamples(limit = 20) {
  const { data, error } = await supabase
    .from('bom')
    .select(`
      bom_id,
      parent_item:items!bom_parent_item_id_fkey(item_code, item_name),
      child_item:items!bom_child_item_id_fkey(item_code, item_name),
      quantity,
      created_at
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('BOM 조회 에러:', error);
    return [];
  }

  return data || [];
}

/**
 * DB에서 거래처 샘플 가져오기
 */
async function getDBCompaniesSamples(limit = 20) {
  const { data, error } = await supabase
    .from('companies')
    .select('company_id, company_code, company_name, company_type, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('거래처 조회 에러:', error);
    return [];
  }

  return data || [];
}

/**
 * Excel에서 품목코드로 검색
 */
function searchItemInExcel(itemCode, itemName, excelFiles) {
  const results = [];

  for (const fileName of excelFiles) {
    const filePath = path.join(EXCEL_DIR, fileName);

    try {
      const workbook = XLSX.readFile(filePath, { cellDates: true });

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
          const row = data[rowIndex];

          // 품목코드 필드 찾기
          const possibleCodeFields = [
            'P/NO', 'P/N', 'PNO', 'PN',
            '품목코드', '품번', '부품번호', '부번',
            'item_code', 'itemCode'
          ];

          const possibleNameFields = [
            '품목명', '품명', 'item_name', 'itemName',
            '제품명', '부품명'
          ];

          let foundCode = null;
          let foundName = null;

          // 코드 찾기
          for (const field of possibleCodeFields) {
            if (row[field]) {
              const code = String(row[field]).trim();
              if (code === itemCode) {
                foundCode = code;
                break;
              }
            }
          }

          // 이름 찾기
          for (const field of possibleNameFields) {
            if (row[field]) {
              foundName = String(row[field]).trim();
              break;
            }
          }

          if (foundCode || (foundName && foundName.includes(itemName))) {
            results.push({
              fileName,
              sheetName,
              rowIndex: rowIndex + 2, // Excel 행 번호 (헤더 +1)
              matchType: foundCode ? 'code' : 'name',
              excelData: row
            });
          }
        }
      }
    } catch (error) {
      console.error(`Excel 파일 읽기 에러 (${fileName}):`, error.message);
    }
  }

  return results;
}

/**
 * Excel에서 BOM 관계 검색
 */
function searchBOMInExcel(parentCode, childCode, excelFiles) {
  const results = [];

  for (const fileName of excelFiles) {
    const filePath = path.join(EXCEL_DIR, fileName);

    try {
      const workbook = XLSX.readFile(filePath, { cellDates: true });

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
          const row = data[rowIndex];

          // 모품목/자품목 필드 찾기
          const possibleParentFields = ['모품목', '완제품 품번', 'parent', 'Parent'];
          const possibleChildFields = ['자품목', '부번', '부품번호', 'child', 'Child', 'P/NO'];

          let foundParent = null;
          let foundChild = null;

          for (const field of possibleParentFields) {
            if (row[field] && String(row[field]).trim() === parentCode) {
              foundParent = String(row[field]).trim();
              break;
            }
          }

          for (const field of possibleChildFields) {
            if (row[field] && String(row[field]).trim() === childCode) {
              foundChild = String(row[field]).trim();
              break;
            }
          }

          if (foundParent && foundChild) {
            results.push({
              fileName,
              sheetName,
              rowIndex: rowIndex + 2,
              excelData: row
            });
          }
        }
      }
    } catch (error) {
      console.error(`Excel 파일 읽기 에러 (${fileName}):`, error.message);
    }
  }

  return results;
}

/**
 * Excel에서 거래처명으로 검색
 */
function searchCompanyInExcel(companyName, excelFiles) {
  const results = [];

  for (const fileName of excelFiles) {
    const filePath = path.join(EXCEL_DIR, fileName);

    try {
      const workbook = XLSX.readFile(filePath, { cellDates: true });

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
          const row = data[rowIndex];

          // 거래처명 필드 찾기
          const possibleFields = [
            '거래처', '거래처명', '회사명', '업체명',
            'company', 'Company', 'customer', 'Customer',
            'supplier', 'Supplier'
          ];

          let found = false;

          for (const field of possibleFields) {
            if (row[field]) {
              const name = String(row[field]).trim();
              if (name.includes(companyName) || companyName.includes(name)) {
                found = true;
                break;
              }
            }
          }

          if (found) {
            results.push({
              fileName,
              sheetName,
              rowIndex: rowIndex + 2,
              excelData: row
            });
          }
        }
      }
    } catch (error) {
      console.error(`Excel 파일 읽기 에러 (${fileName}):`, error.message);
    }
  }

  return results;
}

/**
 * 메인 분석 함수
 */
async function analyzeDBToExcelTrace() {
  console.log('🔍 DB → Excel 역추적 분석 시작\n');

  const report = {
    items: [],
    bom: [],
    companies: [],
    summary: {
      items_traced: 0,
      items_found_in_excel: 0,
      bom_traced: 0,
      bom_found_in_excel: 0,
      companies_traced: 0,
      companies_found_in_excel: 0
    }
  };

  // 1. 품목 추적
  console.log('📦 품목(Items) 역추적 (최근 20개)\n');
  console.log('='.repeat(100));

  const dbItems = await getDBItemSamples(20);
  report.summary.items_traced = dbItems.length;

  for (const item of dbItems) {
    const excelMatches = searchItemInExcel(item.item_code, item.item_name, EXCEL_FILES);

    const traceResult = {
      db_item_code: item.item_code,
      db_item_name: item.item_name,
      db_spec: item.spec,
      found_in_excel: excelMatches.length > 0,
      excel_sources: excelMatches.map(m => ({
        file: m.fileName,
        sheet: m.sheetName,
        row: m.rowIndex,
        match_type: m.matchType
      }))
    };

    report.items.push(traceResult);

    if (excelMatches.length > 0) {
      report.summary.items_found_in_excel++;
      console.log(`✅ ${item.item_code} | ${item.item_name}`);
      for (const match of excelMatches) {
        console.log(`   📄 ${match.fileName} > ${match.sheetName} (행 ${match.rowIndex}) [${match.matchType} match]`);
      }
    } else {
      console.log(`❌ ${item.item_code} | ${item.item_name} - Excel에서 찾을 수 없음`);
    }
  }

  console.log('\n' + '-'.repeat(100));
  console.log(`품목 총계: ${report.summary.items_traced}개 중 ${report.summary.items_found_in_excel}개 Excel에서 발견 (${((report.summary.items_found_in_excel/report.summary.items_traced)*100).toFixed(1)}%)`);

  // 2. BOM 추적
  console.log('\n\n🔗 BOM 관계 역추적 (최근 20개)\n');
  console.log('='.repeat(100));

  const dbBOMs = await getDBBOMSamples(20);
  report.summary.bom_traced = dbBOMs.length;

  for (const bom of dbBOMs) {
    const parentCode = bom.parent_item?.item_code || 'N/A';
    const childCode = bom.child_item?.item_code || 'N/A';

    const excelMatches = searchBOMInExcel(parentCode, childCode, EXCEL_FILES);

    const traceResult = {
      parent_code: parentCode,
      parent_name: bom.parent_item?.item_name,
      child_code: childCode,
      child_name: bom.child_item?.item_name,
      quantity: bom.quantity,
      found_in_excel: excelMatches.length > 0,
      excel_sources: excelMatches.map(m => ({
        file: m.fileName,
        sheet: m.sheetName,
        row: m.rowIndex
      }))
    };

    report.bom.push(traceResult);

    if (excelMatches.length > 0) {
      report.summary.bom_found_in_excel++;
      console.log(`✅ ${parentCode} → ${childCode} (수량: ${bom.quantity})`);
      for (const match of excelMatches) {
        console.log(`   📄 ${match.fileName} > ${match.sheetName} (행 ${match.rowIndex})`);
      }
    } else {
      console.log(`❌ ${parentCode} → ${childCode} - Excel에서 찾을 수 없음`);
    }
  }

  console.log('\n' + '-'.repeat(100));
  console.log(`BOM 총계: ${report.summary.bom_traced}개 중 ${report.summary.bom_found_in_excel}개 Excel에서 발견 (${((report.summary.bom_found_in_excel/report.summary.bom_traced)*100).toFixed(1)}%)`);

  // 3. 거래처 추적
  console.log('\n\n🏢 거래처(Companies) 역추적 (최근 20개)\n');
  console.log('='.repeat(100));

  const dbCompanies = await getDBCompaniesSamples(20);
  report.summary.companies_traced = dbCompanies.length;

  for (const company of dbCompanies) {
    const excelMatches = searchCompanyInExcel(company.company_name, EXCEL_FILES);

    const traceResult = {
      db_company_code: company.company_code,
      db_company_name: company.company_name,
      db_company_type: company.company_type,
      found_in_excel: excelMatches.length > 0,
      excel_sources: excelMatches.map(m => ({
        file: m.fileName,
        sheet: m.sheetName,
        row: m.rowIndex
      }))
    };

    report.companies.push(traceResult);

    if (excelMatches.length > 0) {
      report.summary.companies_found_in_excel++;
      console.log(`✅ ${company.company_code} | ${company.company_name} (${company.company_type})`);
      for (const match of excelMatches) {
        console.log(`   📄 ${match.fileName} > ${match.sheetName} (행 ${match.rowIndex})`);
      }
    } else {
      console.log(`❌ ${company.company_code} | ${company.company_name} - Excel에서 찾을 수 없음`);
    }
  }

  console.log('\n' + '-'.repeat(100));
  console.log(`거래처 총계: ${report.summary.companies_traced}개 중 ${report.summary.companies_found_in_excel}개 Excel에서 발견 (${((report.summary.companies_found_in_excel/report.summary.companies_traced)*100).toFixed(1)}%)`);

  // 최종 요약
  console.log('\n\n' + '='.repeat(100));
  console.log('📊 최종 역추적 요약');
  console.log('='.repeat(100));
  console.log(`
품목(Items):
  - DB 샘플: ${report.summary.items_traced}개
  - Excel 발견: ${report.summary.items_found_in_excel}개
  - 발견율: ${((report.summary.items_found_in_excel/report.summary.items_traced)*100).toFixed(1)}%

BOM 관계:
  - DB 샘플: ${report.summary.bom_traced}개
  - Excel 발견: ${report.summary.bom_found_in_excel}개
  - 발견율: ${((report.summary.bom_found_in_excel/report.summary.bom_traced)*100).toFixed(1)}%

거래처(Companies):
  - DB 샘플: ${report.summary.companies_traced}개
  - Excel 발견: ${report.summary.companies_found_in_excel}개
  - 발견율: ${((report.summary.companies_found_in_excel/report.summary.companies_traced)*100).toFixed(1)}%
  `);

  // JSON 리포트 저장
  const reportPath = path.join(process.cwd(), 'DB_TO_EXCEL_TRACE_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n✅ 상세 리포트 저장: ${reportPath}`);
}

// 실행
analyzeDBToExcelTrace().catch(console.error);
