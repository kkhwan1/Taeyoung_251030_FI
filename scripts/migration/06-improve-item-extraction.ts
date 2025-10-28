import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

console.log('\n================================================================================');
console.log('🚀 Excel 파일 품목 추출 개선');
console.log('================================================================================\n');

const EXCEL_DIR = path.resolve(process.cwd(), '.example');
const COMPREHENSIVE_FILE = path.join(EXCEL_DIR, '2025년 9월 종합관리 SHEET.xlsx');

try {
  const workbook = XLSX.readFile(COMPREHENSIVE_FILE);
  const sheet = workbook.Sheets['종합재고'];
  
  if (!sheet) {
    console.log('❌ "종합재고" 시트를 찾을 수 없습니다.');
    process.exit(1);
  }
  
  const rows = XLSX.utils.sheet_to_json(sheet, { 
    header: 1,
    defval: null,
    raw: false
  }) as any[];
  
  console.log(`📊 총 ${rows.length}개 행 발견\n`);
  
  // 헤더 행 찾기
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    if (row && (row[0]?.toString().includes('거래처') || row[0]?.toString().includes('차종'))) {
      headerRowIndex = i;
      break;
    }
  }
  
  console.log(`📋 헤더 행: ${headerRowIndex}\n`);
  
  const items: any[] = [];
  
  // 데이터 행 추출 (헤더 행 + 1부터)
  for (let i = headerRowIndex + 2; i < rows.length; i++) {
    const row = rows[i];
    
    if (!row || !row[0]) continue;
    
    const companyName = String(row[0] || '').trim();
    const vehicleModel = String(row[1] || '').trim();
    const itemCode = String(row[2] || '').trim();
    const partNumber = String(row[3] || '').trim();
    const itemName = String(row[4] || '').trim();
    const material = String(row[5] || '').trim();
    const thickness = parseFloat(String(row[6] || ''));
    const width = parseFloat(String(row[7] || ''));
    const height = parseFloat(String(row[8] || ''));
    const specificGravity = parseFloat(String(row[9] || ''));
    const mmWeight = parseFloat(String(row[10] || ''));
    
    // 최소 필수 필드 검증
    if (!companyName || !itemCode) continue;
    
    // 이미 등록된 품목 제외
    const existingCodes = [
      '66421-P1000', '65521-P2000', '65522-P4000', '65631-P4000',
      'BP314/24-AT000', '657A6/B6-P4000', 'BP212-AT000', '71714-AT000',
      '65272/82-2J100'
    ];
    
    if (existingCodes.includes(itemCode)) continue;
    
    const item = {
      item_code: itemCode,
      item_name: itemName || partNumber,
      spec: thickness?.toString() || '',
      thickness: isNaN(thickness) ? null : thickness,
      width: isNaN(width) ? null : width,
      height: isNaN(height) ? null : height,
      specific_gravity: isNaN(specificGravity) ? null : specificGravity,
      mm_weight: isNaN(mmWeight) ? null : mmWeight,
      material: material || '',
      category: '원자재',
      company_name: companyName,
      vehicle_model: vehicleModel
    };
    
    // 빈 필드 필터링
    if (!item.item_name) continue;
    
    items.push(item);
  }
  
  console.log(`✅ 추출된 품목: ${items.length}개\n`);
  
  // 처음 15개 출력
  if (items.length > 0) {
    console.log('📋 처음 15개 품목:');
    items.slice(0, 15).forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.item_code} - ${item.item_name} (${item.material || 'N/A'})`);
    });
    
    if (items.length > 15) {
      console.log(`\n... ${items.length - 15}개 추가 품목\n`);
    }
  }
  
  // JSON 파일로 저장
  const outputDir = path.join(process.cwd(), 'scripts/migration/data');
  fs.mkdirSync(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, 'additional-items.json');
  fs.writeFileSync(
    outputFile,
    JSON.stringify({ items, total: items.length }, null, 2)
  );
  
  console.log(`📝 파일 저장: ${outputFile}`);
  console.log(`\n💡 총 ${items.length}개 추가 품목을 데이터베이스에 등록할 수 있습니다.`);
  console.log('\n================================================================================');
  console.log('✅ 품목 추출 완료');
  console.log('================================================================================\n');
  
} catch (error) {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
}





