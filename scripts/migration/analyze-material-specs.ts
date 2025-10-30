/**
 * 엑셀 파일에서 규격, 소재, 단위 중량 등 추가 정보 분석
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const INVENTORY_EXCEL = '09월 원자재 수불관리.xlsx';
const BOM_EXCEL = '태창금속 BOM.xlsx';
const EXCEL_DIR = path.resolve(process.cwd(), '.example');

function readExcelFile(filename: string): XLSX.WorkBook {
  const filePath = path.join(EXCEL_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel 파일을 찾을 수 없습니다: ${filePath}`);
  }

  return XLSX.readFile(filePath, {
    type: 'file',
    cellDates: true,
    cellNF: false,
    cellText: false
  });
}

console.log('=== 엑셀 파일에서 규격, 소재, 중량 정보 찾기 ===\n');

// 1. 09월 원자재 수불관리.xlsx 분석
console.log('1. 09월 원자재 수불관리.xlsx 분석\n');

try {
  const inventoryWorkbook = readExcelFile(INVENTORY_EXCEL);
  
  // 일반 공급사 시트들에서 규격, 소재 정보 확인
  const vendorSheets = [
    '풍기서산(사급)', '세원테크(사급)', '대우포승(사급)', '호원오토(사급)',
    '웅지테크', '태영금속', 'JS테크', '에이오에스', '창경테크', '신성테크', '광성산업'
  ];

  console.log('일반 공급사 시트 샘플 분석 (처음 1개 시트):\n');

  const firstSheet = vendorSheets[0];
  if (inventoryWorkbook.SheetNames.includes(firstSheet)) {
    const worksheet = inventoryWorkbook.Sheets[firstSheet];
    
    // A6부터 데이터 시작
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      range: 4 // A5부터 (헤더 행 포함)
    }) as any[][];

    if (rawData.length > 0) {
      console.log(`시트: ${firstSheet}`);
      console.log('헤더 행 (5행):');
      const headerRow = rawData[0];
      headerRow.forEach((cell, idx) => {
        const cellStr = String(cell || '').trim();
        if (cellStr) {
          console.log(`  [${idx}]: "${cellStr}"`);
        }
      });

      console.log('\n데이터 샘플 (처음 3행):');
      for (let i = 1; i < Math.min(4, rawData.length); i++) {
        const row = rawData[i];
        console.log(`\n행 ${i + 5}:`);
        row.forEach((cell, idx) => {
          const cellStr = String(cell || '').trim();
          if (cellStr) {
            console.log(`  [${idx}]: "${cellStr}"`);
          }
        });
      }
    }
  }

  // 재고관리 시트 분석
  console.log('\n\n재고관리 시트 샘플 분석:\n');
  const inventorySheets = ['MV1 , SV (재고관리)', 'TAM,KA4,인알파', 'DL3 GL3 (재고관리)'];

  for (const sheetName of inventorySheets.slice(0, 1)) {
    if (inventoryWorkbook.SheetNames.includes(sheetName)) {
      const worksheet = inventoryWorkbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        range: 1
      }) as any[][];

      console.log(`시트: ${sheetName}`);
      console.log('헤더 행 (2행):');
      if (rawData.length > 0) {
        const headerRow = rawData[1];
        headerRow.forEach((cell, idx) => {
          const cellStr = String(cell || '').trim();
          if (cellStr) {
            console.log(`  [${idx}]: "${cellStr}"`);
          }
        });

        console.log('\n데이터 샘플 (처음 5행):');
        for (let i = 2; i < Math.min(7, rawData.length); i++) {
          const row = rawData[i];
          console.log(`\n행 ${i + 1}:`);
          row.slice(0, 15).forEach((cell, idx) => {
            const cellStr = String(cell || '').trim();
            if (cellStr) {
              console.log(`  [${idx}]: "${cellStr}"`);
            }
          });
        }
      }
    }
  }
} catch (error: any) {
  console.error(`오류: ${error.message}`);
}

// 2. 태창금속 BOM.xlsx 분석
console.log('\n\n=== 태창금속 BOM.xlsx 분석 ===\n');

try {
  const bomWorkbook = readExcelFile(BOM_EXCEL);
  
  console.log(`시트 목록: ${bomWorkbook.SheetNames.join(', ')}\n`);

  // 각 시트 분석
  for (const sheetName of bomWorkbook.SheetNames) {
    if (sheetName.includes('최신단가')) continue; // 최신단가는 이미 처리됨

    const worksheet = bomWorkbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      range: 0
    }) as any[][];

    console.log(`\n시트: ${sheetName}`);
    
    // 헤더 찾기
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
      if (rowStr.includes('품번') || rowStr.includes('품명') || 
          rowStr.includes('재질') || rowStr.includes('규격') ||
          rowStr.includes('두께') || rowStr.includes('중량')) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex >= 0) {
      console.log(`헤더 행: ${headerRowIndex + 1}행`);
      const headerRow = rawData[headerRowIndex];
      headerRow.forEach((cell, idx) => {
        const cellStr = String(cell || '').trim();
        if (cellStr) {
          const lower = cellStr.toLowerCase();
          if (lower.includes('재질') || lower.includes('규격') || 
              lower.includes('두께') || lower.includes('폭') || 
              lower.includes('길이') || lower.includes('중량') ||
              lower.includes('비중') || lower.includes('weight')) {
            console.log(`  [${idx}] "${cellStr}" ⭐`);
          } else {
            console.log(`  [${idx}]: "${cellStr}"`);
          }
        }
      });

      // 데이터 샘플
      if (rawData.length > headerRowIndex + 1) {
        console.log('\n데이터 샘플 (처음 3행):');
        for (let i = headerRowIndex + 1; i < Math.min(headerRowIndex + 4, rawData.length); i++) {
          const row = rawData[i];
          const itemCode = String(row[0] || '').trim();
          if (itemCode) {
            console.log(`\n행 ${i + 1}:`);
            row.slice(0, 20).forEach((cell, idx) => {
              const cellStr = String(cell || '').trim();
              if (cellStr) {
                console.log(`  [${idx}]: "${cellStr}"`);
              }
            });
          }
        }
      }
    } else {
      console.log('헤더 행을 찾지 못함');
    }
  }

} catch (error: any) {
  console.error(`BOM 파일 오류: ${error.message}`);
}

console.log('\n\n=== 분석 완료 ===');

