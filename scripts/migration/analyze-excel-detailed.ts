/**
 * Excel 파일 상세 구조 분석
 * 
 * 실제 데이터 구조를 확인하여 파싱 스크립트를 작성할 수 있도록 합니다.
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './utils/logger';

async function analyzeExcelDetailed() {
  const logger = createLogger('Excel 상세 분석');
  logger.startMigration();

  const excelDir = path.resolve(process.cwd(), '.example');

  logger.log('\n📋 Excel 파일 상세 구조 분석\n', 'info');

  // 1. 태창금속 BOM.xlsx 분석
  logger.log('\n📄 태창금속 BOM.xlsx', 'info');
  try {
    const bomPath = path.join(excelDir, '태창금속 BOM.xlsx');
    const bomWorkbook = XLSX.readFile(bomPath);
    
    logger.log(`  시트: ${bomWorkbook.SheetNames.join(', ')}`, 'info');
    
    // 첫 번째 시트 상세 분석
    if (bomWorkbook.SheetNames.length > 0) {
      const firstSheet = bomWorkbook.Sheets[bomWorkbook.SheetNames[0]];
      const bomData = XLSX.utils.sheet_to_json<any>(firstSheet, { defval: '' });
      
      if (bomData.length > 0) {
        logger.log(`  데이터 행 수: ${bomData.length}`, 'info');
        logger.log(`  첫 5개 레코드 컬럼:`, 'info');
        Object.keys(bomData[0]).forEach((key, idx) => {
          if (idx < 15) {
            const sampleValue = bomData[0][key];
            logger.log(`    ${key}: "${sampleValue}"`, 'info');
          }
        });
      }
    }
  } catch (error: any) {
    logger.log(`  ❌ 오류: ${error.message}`, 'error');
  }

  // 2. 종합관리 SHEET.xlsx 분석 (가장 구조가 명확함)
  logger.log('\n📄 2025년 9월 종합관리 SHEET.xlsx', 'info');
  try {
    const compPath = path.join(excelDir, '2025년 9월 종합관리 SHEET.xlsx');
    const compWorkbook = XLSX.readFile(compPath);
    
    logger.log(`  시트: ${compWorkbook.SheetNames.join(', ')}`, 'info');
    
    // 종합재고 시트 분석
    const summarySheet = compWorkbook.Sheets['종합재고'];
    if (summarySheet) {
      const summaryData = XLSX.utils.sheet_to_json<any>(summarySheet, { defval: '' });
      
      if (summaryData.length > 0) {
        logger.log(`  데이터 행 수: ${summaryData.length}`, 'info');
        logger.log(`  컬럼 구조:`, 'info');
        Object.keys(summaryData[0]).forEach((key) => {
          const sampleValue = summaryData[0][key];
          logger.log(`    "${key}": "${sampleValue}"`, 'info');
        });
        
        // 처음 3개 행 샘플 출력
        logger.log(`\n  처음 3개 행 샘플:`, 'info');
        for (let i = 0; i < Math.min(3, summaryData.length); i++) {
          logger.log(`    행 ${i + 1}:`, 'info');
          const row = summaryData[i];
          Object.keys(row).forEach((key) => {
            logger.log(`      ${key}: ${row[key]}`, 'info');
          });
        }
      }
    }
  } catch (error: any) {
    logger.log(`  ❌ 오류: ${error.message}`, 'error');
  }

  // 3. 매입매출 보고현황.xlsx 분석
  logger.log('\n📄 2025년 9월 매입매출 보고현황.xlsx', 'info');
  try {
    const psPath = path.join(excelDir, '2025년 9월 매입매출 보고현황.xlsx');
    const psWorkbook = XLSX.readFile(psPath);
    
    logger.log(`  시트: ${psWorkbook.SheetNames.join(', ')}`, 'info');
    
    // 정리 시트 분석
    if (psWorkbook.SheetNames.includes('정리')) {
      const psSheet = psWorkbook.Sheets['정리'];
      const psData = XLSX.utils.sheet_to_json<any>(psSheet, { defval: '' });
      
      if (psData.length > 0) {
        logger.log(`  데이터 행 수: ${psData.length}`, 'info');
        logger.log(`  컬럼 구조:`, 'info');
        Object.keys(psData[0]).forEach((key) => {
          const sampleValue = psData[0][key];
          logger.log(`    "${key}": "${sampleValue}"`, 'info');
        });
      }
    }
  } catch (error: any) {
    logger.log(`  ❌ 오류: ${error.message}`, 'error');
  }

  logger.log('\n✅ Excel 상세 분석 완료', 'success');
  logger.endMigration(true);
}

// 실행
analyzeExcelDetailed().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

