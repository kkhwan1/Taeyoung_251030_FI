/**
 * 엑셀 파일 상태 확인 스크립트
 *
 * 엑셀 파일이 열려있는지, 접근 가능한지 확인합니다.
 *
 * 실행: npx tsx scripts/migration/check-excel-file-status.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';

const EXCEL_DIR = path.resolve(process.cwd(), '.example');
const EXCEL_FILES = [
  '09월 원자재 수불관리.xlsx',
  '태창금속 BOM.xlsx',
  '2025년 9월 종합관리 SHEET.xlsx',
  '2025년 9월 매입매출 보고현황.xlsx'
];

async function checkExcelFileStatus() {
  const logger = createLogger('엑셀 파일 상태 확인');
  logger.startMigration();

  logger.log('\n📄 엑셀 파일 상태 확인', 'info');
  logger.log('─────────────────────────────────────', 'info');

  for (const fileName of EXCEL_FILES) {
    const filePath = path.join(EXCEL_DIR, fileName);

    logger.log(`\n📋 ${fileName}`, 'info');

    // 1. 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      logger.log('  ❌ 파일이 존재하지 않습니다', 'error');
      continue;
    }

    logger.log('  ✅ 파일 존재 확인', 'success');

    // 2. 파일 잠금 상태 확인 (Windows)
    try {
      const fileHandle = fs.openSync(filePath, 'r+');
      fs.closeSync(fileHandle);
      logger.log('  ✅ 파일 접근 가능 (잠금 없음)', 'success');
    } catch (error: any) {
      if (error.code === 'EBUSY' || error.code === 'EACCES') {
        logger.log('  ⚠️  파일이 잠겨있습니다 (다른 프로세스에서 열려있을 수 있음)', 'warn');
        logger.log('  💡 해결 방법: 엑셀 파일을 닫고 다시 시도하세요', 'info');
        continue;
      } else {
        logger.log(`  ⚠️  파일 접근 오류: ${error.message}`, 'warn');
        continue;
      }
    }

    // 3. XLSX 라이브러리로 파일 읽기 시도
    try {
      logger.log('  🔄 XLSX 라이브러리로 읽기 시도...', 'info');
      const workbook = XLSX.readFile(filePath, {
        type: 'file',
        cellDates: true,
        cellNF: false,
        cellText: false
      });

      const sheetNames = workbook.SheetNames;
      logger.log(`  ✅ 파일 읽기 성공 (${sheetNames.length}개 시트)`, 'success');
      
      // 각 시트의 행 수 확인
      for (const sheetName of sheetNames.slice(0, 3)) { // 처음 3개만
        const worksheet = workbook.Sheets[sheetName];
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const rows = range.e.r + 1;
        logger.log(`     - ${sheetName}: ${rows}행`, 'info');
      }

    } catch (error: any) {
      logger.log(`  ❌ XLSX 라이브러리 읽기 실패: ${error.message}`, 'error');
      
      if (error.message.includes('EBUSY') || error.message.includes('locked')) {
        logger.log('  💡 파일이 열려있어 읽을 수 없습니다. 엑셀 파일을 닫고 다시 시도하세요.', 'warn');
      }
    }

    // 4. 임시 파일 확인 (~$ 로 시작하는 파일은 Excel이 열고 있음)
    const tempFileName = `~$${fileName}`;
    const tempFilePath = path.join(EXCEL_DIR, tempFileName);
    if (fs.existsSync(tempFilePath)) {
      logger.log(`  ⚠️  임시 파일 발견: ${tempFileName}`, 'warn');
      logger.log('  💡 Excel에서 파일이 열려있을 가능성이 높습니다', 'info');
      logger.log('  💡 해결 방법: 모든 Excel 창을 닫고 다시 시도하세요', 'info');
    } else {
      logger.log('  ✅ 임시 파일 없음 (파일이 닫혀있음)', 'success');
    }
  }

  logger.log('\n─────────────────────────────────────', 'info');
  logger.log('📊 확인 완료', 'info');
  logger.endMigration(true);
}

checkExcelFileStatus().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

