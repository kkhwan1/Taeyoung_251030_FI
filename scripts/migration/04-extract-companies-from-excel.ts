import * as XLSX from 'xlsx';
import * as path from 'path';

console.log('\n================================================================================');
console.log('🚀 Excel 파일에서 거래처 추출 시작');
console.log('================================================================================\n');

// Excel 파일 경로
const EXCEL_DIR = path.resolve(process.cwd(), '.example');
const COMPREHENSIVE_FILE = path.join(EXCEL_DIR, '2025년 9월 종합관리 SHEET.xlsx');
const BOM_FILE = path.join(EXCEL_DIR, '태창금속 BOM.xlsx');

try {
  const companiesSet = new Set<string>();
  
  // 1. 종합관리 시트에서 추출
  console.log('📄 2025년 9월 종합관리 SHEET.xlsx 분석...');
  const workbook1 = XLSX.readFile(COMPREHENSIVE_FILE);
  
  // 모든 시트 확인
  for (const sheetName of workbook1.SheetNames) {
    const sheet = workbook1.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { 
      header: 1,
      defval: null
    }) as any[];
    
    console.log(`\n   시트: ${sheetName} (${rows.length}행)`);
    
    // 각 행에서 거래처명 추출
    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const row = rows[i];
      if (!row) continue;
      
      // 각 셀을 확인하여 거래처명 패턴 찾기
      for (let j = 0; j < row.length; j++) {
        const cellValue = row[j];
        if (cellValue && typeof cellValue === 'string') {
          const trimmed = cellValue.trim();
          // 거래처명 패턴 (한글 회사명)
          if (trimmed.length > 1 && trimmed.length < 20 && 
              /^[가-힣]+/.test(trimmed) && 
              !trimmed.includes('종합') &&
              !trimmed.includes('시트') &&
              !trimmed.includes('요약') &&
              !trimmed.includes('재고') &&
              !trimmed.includes('SHEET')) {
            companiesSet.add(trimmed);
          }
        }
      }
    }
  }
  
  // 2. BOM 파일에서 추출
  console.log('\n📄 태창금속 BOM.xlsx 분석...');
  const workbook2 = XLSX.readFile(BOM_FILE);
  
  for (const sheetName of workbook2.SheetNames) {
    if (companiesSet.size >= 10) break; // 충분한 거래처 수집
    
    const sheet = workbook2.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { 
      header: 1,
      defval: null
    }) as any[];
    
    console.log(`   시트: ${sheetName}`);
    
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const row = rows[i];
      if (!row) continue;
      
      for (let j = 0; j < row.length; j++) {
        const cellValue = row[j];
        if (cellValue && typeof cellValue === 'string') {
          const trimmed = cellValue.trim();
          if (trimmed.length > 1 && trimmed.length < 20 && 
              /^[가-힣]+/.test(trimmed)) {
            companiesSet.add(trimmed);
          }
        }
      }
    }
  }
  
  const companies = Array.from(companiesSet).filter(name => 
    name !== '종합' && 
    name !== '시트' && 
    name !== '입고현황' &&
    name !== '생산실적'
  );
  
  console.log(`\n✅ 발견된 거래처: ${companies.length}개\n`);
  
  companies.forEach((name, index) => {
    console.log(`   ${index + 1}. ${name}`);
  });
  
  console.log('\n================================================================================');
  console.log('✅ 거래처 추출 완료');
  console.log('================================================================================\n');
  
} catch (error) {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
}
