/**
 * Excel 파일 구조 분석
 * 
 * PyHub MCP를 사용하여 Excel 파일의 실제 구조를 분석합니다.
 * 
 * 실행: npx tsx scripts/migration/analyze-excel-structure.ts
 */

import { createLogger } from './utils/logger';

async function analyzeExcelStructure() {
  const logger = createLogger('Excel 구조 분석');
  logger.startMigration();

  const excelFiles = [
    { name: '태창금속 BOM.xlsx', type: 'BOM' },
    { name: '09월 원자재 수불관리.xlsx', type: '재고' },
    { name: '2025년 9월 종합관리 SHEET.xlsx', type: '종합관리' },
    { name: '2025년 9월 매입매출 보고현황.xlsx', type: '매입매출' }
  ];

  logger.log('\n📋 열려있는 Excel 파일 분석 시작\n', 'info');

  for (const file of excelFiles) {
    try {
      logger.log(`\n📄 ${file.name} (${file.type})`, 'info');
      
      // PyHub MCP 함수 직접 호출
      // 실제 열려있는 Excel에서 데이터 읽기
      const { default: XLSX } = await import('xlsx');
      const fs = await import('fs');
      const path = await import('path');
      
      const filePath = path.resolve(process.cwd(), '.example', file.name);
      
      if (!fs.existsSync(filePath)) {
        logger.log(`  ❌ 파일 없음: ${filePath}`, 'error');
        continue;
      }

      const workbook = XLSX.readFile(filePath, { type: 'file' });
      
      logger.log(`  시트 개수: ${workbook.SheetNames.length}`, 'info');
      
      // 각 시트의 구조 분석
      for (let i = 0; i < Math.min(3, workbook.SheetNames.length); i++) {
        const sheetName = workbook.SheetNames[i];
        const worksheet = workbook.Sheets[sheetName];
        
        logger.log(`\n  시트 ${i + 1}: ${sheetName}`, 'info');
        
        // 첫 3행 읽기 (컬럼명 확인용)
        const rawData = XLSX.utils.sheet_to_json(worksheet, { 
          header: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'], 
          range: 1 
        });
        
        if (rawData.length > 0) {
          logger.log(`  컬럼 데이터:`, 'info');
          Object.keys(rawData[0]).forEach((key, idx) => {
            if (idx < 10) {
              logger.log(`    ${key}: ${rawData[0][key]}`, 'info');
            }
          });
        }
      }
      
    } catch (error: any) {
      logger.log(`  ❌ 오류: ${error.message}`, 'error');
    }
  }

  logger.log('\n✅ Excel 구조 분석 완료', 'success');
  logger.endMigration(true);
}

// 실행
analyzeExcelStructure().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

