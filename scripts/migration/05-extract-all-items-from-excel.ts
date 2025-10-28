import * as XLSX from 'xlsx';
import * as path from 'path';

console.log('\n================================================================================');
console.log('🚀 Excel 파일에서 전체 품목 추출 시작');
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
    defval: null
  }) as any[];
  
  console.log(`📊 총 ${rows.length}개 행 발견\n`);
  
  const items: any[] = [];
  
  // 행 3부터 시작하여 품목 데이터 추출
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    
    // 필수 필드 확인
    const companyName = row[0]?.toString().trim();
    const vehicleModel = row[1]?.toString().trim();
    const itemCode = row[2]?.toString().trim();
    const itemName = row[3]?.toString().trim();
    const material = row[4]?.toString().trim();
    const thickness = parseFloat(row[5]);
    
    if (!companyName || !itemCode || !itemName) continue;
    
    // 수치 데이터 추출
    const width = row[6] ? parseFloat(row[6]) : null;
    const height = row[7] ? parseFloat(row[7]) : null;
    const specificGravity = row[8] ? parseFloat(row[8]) : null;
    const mmWeight = row[9] ? parseFloat(row[9]) : null;
    const spec = thickness?.toString() || '';
    
    const item = {
      item_code: itemCode,
      item_name: itemName,
      spec: spec,
      thickness: thickness,
      width: width,
      height: height,
      specific_gravity: specificGravity,
      mm_weight: mmWeight,
      material: material,
      category: '원자재',
      company_name: companyName,
      vehicle_model: vehicleModel
    };
    
    items.push(item);
  }
  
  console.log(`✅ 추출된 품목: ${items.length}개\n`);
  
  // 처음 20개 출력
  console.log('📋 처음 20개 품목:');
  items.slice(0, 20).forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.item_code} - ${item.item_name} (${item.material})`);
  });
  
  console.log(`\n... ${items.length - 20}개 추가 품목\n`);
  
  // JSON 파일로 저장
  const outputDir = path.join(process.cwd(), 'scripts/migration/data');
  require('fs').mkdirSync(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, 'all-items-from-excel.json');
  require('fs').writeFileSync(
    outputFile,
    JSON.stringify({ items, total: items.length }, null, 2)
  );
  
  console.log(`📝 파일 저장: ${outputFile}`);
  console.log('\n================================================================================');
  console.log(`✅ 품목 추출 완료 (총 ${items.length}개)`);
  console.log('================================================================================\n');
  
} catch (error) {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
}





