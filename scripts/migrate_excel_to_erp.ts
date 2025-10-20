#!/usr/bin/env node
/**
 * 엑셀 데이터를 TAECHANG_ERP 데이터베이스로 마이그레이션하는 스크립트
 * 
 * 실행 순서:
 * 1. 기존 데이터 삭제 (외래키 순서 고려)
 * 2. 협력사/고객 정보 삽입
 * 3. 품목 마스터 삽입
 * 4. BOM 구조 삽입
 * 5. 거래 데이터 삽입
 * 6. 재고 데이터 삽입
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 설정
const PROJECT_ID = 'pybjnkbmtlyaftuiieyq';
const PYHUB_TOOLS_PATH = 'C:\\mcptools\\pyhub.mcptools\\pyhub.mcptools.exe';
const LOG_FILE = 'logs/migration.log';

// 로그 함수
function log(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    
    // 로그 디렉토리 생성
    if (!fs.existsSync('logs')) {
        fs.mkdirSync('logs', { recursive: true });
    }
    
    fs.appendFileSync(LOG_FILE, logMessage);
}

// PyHub MCP Tools 실행 함수
function executePyHubCommand(command: string, args: Record<string, any> = {}) {
    const argString = Object.entries(args)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
    
    const fullCommand = `"${PYHUB_TOOLS_PATH}" tools-call ${command} ${argString}`;
    
    try {
        log(`실행: ${fullCommand}`);
        const result = execSync(fullCommand, { 
            encoding: 'utf8',
            cwd: process.cwd()
        });
        return result;
    } catch (error) {
        log(`오류: ${error}`);
        throw error;
    }
}

// Supabase SQL 실행 함수
function executeSQL(query: string) {
    const command = `npx @supabase/mcp-server-supabase@latest --access-token sbp_b997910cc803caeb95c2ad6224ba7a4133390d49 execute_sql --project-id ${PROJECT_ID} --query "${query}"`;
    
    try {
        log(`SQL 실행: ${query.substring(0, 100)}...`);
        const result = execSync(command, { encoding: 'utf8' });
        return result;
    } catch (error) {
        log(`SQL 오류: ${error}`);
        throw error;
    }
}

// 1단계: 기존 데이터 삭제
async function clearExistingData() {
    log('=== 1단계: 기존 데이터 삭제 시작 ===');
    
    const deleteOrder = [
        'bom_deduction_log',
        'collection_transactions', 
        'collections',
        'payment_transactions',
        'payments',
        'item_price_history',
        'price_master',
        'scrap_tracking',
        'stock_adjustments',
        'warehouse_stock',
        'inventory_transactions',
        'sales_transactions',
        'purchase_transactions',
        'bom',
        'coil_specs',
        'items',
        'companies'
    ];
    
    for (const table of deleteOrder) {
        try {
            const query = `TRUNCATE TABLE ${table} CASCADE;`;
            executeSQL(query);
            log(`✓ ${table} 테이블 데이터 삭제 완료`);
        } catch (error) {
            log(`✗ ${table} 테이블 삭제 실패: ${error}`);
        }
    }
    
    log('=== 기존 데이터 삭제 완료 ===');
}

// 2단계: 협력사/고객 정보 삽입
async function migrateCompanies() {
    log('=== 2단계: 협력사/고객 정보 마이그레이션 시작 ===');
    
    const excelFiles = [
        '태창금속 BOM.xlsx',
        '2025년 9월 매입매출 보고현황.xlsx',
        '09월 원자재 수불관리.xlsx'
    ];
    
    const companies = new Set<string>();
    
    // 각 엑셀 파일에서 협력사 정보 추출
    for (const file of excelFiles) {
        try {
            // BOM 파일의 납품처/구매처 추출
            if (file.includes('BOM')) {
                const sheets = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];
                
                for (const sheet of sheets) {
                    const data = executePyHubCommand('excel_get_values', {
                        book_name: file,
                        sheet_name: sheet,
                        sheet_range: 'A7:AI100', // 헤더 다음부터
                        value_type: 'csv'
                    });
                    
                    // 납품처와 구매처 컬럼에서 회사명 추출
                    const lines = data.split('\n');
                    for (const line of lines) {
                        const columns = line.split(',');
                        if (columns[0] && columns[0].trim()) companies.add(columns[0].trim());
                        if (columns[8] && columns[8].trim()) companies.add(columns[8].trim());
                    }
                }
            }
            
            // 매입매출 파일의 거래처 추출
            if (file.includes('매입매출')) {
                const sheets = ['태창금속', '협력사'];
                
                for (const sheet of sheets) {
                    const data = executePyHubCommand('excel_get_values', {
                        book_name: file,
                        sheet_name: sheet,
                        sheet_range: 'A4:LJ100',
                        value_type: 'csv'
                    });
                    
                    const lines = data.split('\n');
                    for (const line of lines) {
                        const columns = line.split(',');
                        if (columns[1] && columns[1].trim()) companies.add(columns[1].trim());
                    }
                }
            }
            
        } catch (error) {
            log(`파일 ${file} 처리 중 오류: ${error}`);
        }
    }
    
    // 데이터베이스에 협력사 정보 삽입
    let companyId = 1;
    for (const companyName of companies) {
        if (companyName && companyName.length > 0) {
            try {
                const query = `
                    INSERT INTO companies (company_id, company_code, company_name, company_type, is_active, created_at, updated_at)
                    VALUES (${companyId}, '${companyName.substring(0, 10)}', '${companyName}', 'SUPPLIER', true, NOW(), NOW())
                    ON CONFLICT (company_name) DO NOTHING;
                `;
                executeSQL(query);
                log(`✓ 협력사 추가: ${companyName}`);
                companyId++;
            } catch (error) {
                log(`✗ 협력사 추가 실패 (${companyName}): ${error}`);
            }
        }
    }
    
    log(`=== 협력사/고객 정보 마이그레이션 완료 (${companies.size}개) ===`);
}

// 3단계: 품목 마스터 삽입
async function migrateItems() {
    log('=== 3단계: 품목 마스터 마이그레이션 시작 ===');
    
    try {
        // BOM 파일에서 품목 정보 추출
        const sheets = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];
        let itemId = 1;
        
        for (const sheet of sheets) {
            const data = executePyHubCommand('excel_get_values', {
                book_name: '태창금속 BOM.xlsx',
                sheet_name: sheet,
                sheet_range: 'A7:AI100',
                value_type: 'csv'
            });
            
            const lines = data.split('\n');
            for (const line of lines) {
                const columns = line.split(',');
                
                if (columns[2] && columns[3]) { // 품번과 품명이 있는 경우
                    const itemCode = columns[2].trim();
                    const itemName = columns[3].trim();
                    const vehicleModel = columns[1]?.trim() || '';
                    const price = parseFloat(columns[4]) || 0;
                    const material = columns[19]?.trim() || '';
                    const thickness = parseFloat(columns[20]) || null;
                    const width = parseFloat(columns[21]) || null;
                    const height = parseFloat(columns[22]) || null;
                    const specificGravity = parseFloat(columns[24]) || 7.85;
                    const mmWeight = parseFloat(columns[25]) || null;
                    
                    try {
                        const query = `
                            INSERT INTO items (
                                item_id, item_code, item_name, category, spec, unit, price,
                                vehicle_model, material, thickness, width, height, specific_gravity,
                                mm_weight, is_active, created_at, updated_at
                            ) VALUES (
                                ${itemId}, '${itemCode}', '${itemName}', 'RAW', '${material}', '개', ${price},
                                '${vehicleModel}', '${material}', ${thickness}, ${width}, ${height}, ${specificGravity},
                                ${mmWeight}, true, NOW(), NOW()
                            ) ON CONFLICT (item_code) DO NOTHING;
                        `;
                        executeSQL(query);
                        log(`✓ 품목 추가: ${itemCode} - ${itemName}`);
                        itemId++;
                    } catch (error) {
                        log(`✗ 품목 추가 실패 (${itemCode}): ${error}`);
                    }
                }
            }
        }
        
    } catch (error) {
        log(`품목 마스터 마이그레이션 오류: ${error}`);
    }
    
    log('=== 품목 마스터 마이그레이션 완료 ===');
}

// 4단계: BOM 구조 삽입
async function migrateBOM() {
    log('=== 4단계: BOM 구조 마이그레이션 시작 ===');
    
    try {
        let bomId = 1;
        
        // BOM 파일에서 부모-자식 관계 추출
        const sheets = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];
        
        for (const sheet of sheets) {
            const data = executePyHubCommand('excel_get_values', {
                book_name: '태창금속 BOM.xlsx',
                sheet_name: sheet,
                sheet_range: 'A7:AI100',
                value_type: 'csv'
            });
            
            const lines = data.split('\n');
            for (const line of lines) {
                const columns = line.split(',');
                
                // 부모 품목 (납품처 품목)
                const parentCode = columns[2]?.trim();
                const parentName = columns[3]?.trim();
                
                // 자식 품목 (구매처 품목)
                const childCode = columns[10]?.trim();
                const childName = columns[11]?.trim();
                const quantityRequired = parseFloat(columns[12]) || 1;
                
                if (parentCode && childCode && parentCode !== childCode) {
                    try {
                        const query = `
                            INSERT INTO bom (
                                bom_id, parent_item_id, child_item_id, quantity_required, level_no, is_active, created_at, updated_at
                            ) 
                            SELECT 
                                ${bomId}, 
                                p.item_id, 
                                c.item_id, 
                                ${quantityRequired}, 
                                1, 
                                true, 
                                NOW(), 
                                NOW()
                            FROM items p, items c
                            WHERE p.item_code = '${parentCode}' AND c.item_code = '${childCode}'
                            ON CONFLICT DO NOTHING;
                        `;
                        executeSQL(query);
                        log(`✓ BOM 관계 추가: ${parentCode} -> ${childCode}`);
                        bomId++;
                    } catch (error) {
                        log(`✗ BOM 관계 추가 실패: ${error}`);
                    }
                }
            }
        }
        
    } catch (error) {
        log(`BOM 구조 마이그레이션 오류: ${error}`);
    }
    
    log('=== BOM 구조 마이그레이션 완료 ===');
}

// 5단계: 거래 데이터 삽입 (매입/매출)
async function migrateTransactions() {
    log('=== 5단계: 거래 데이터 마이그레이션 시작 ===');
    
    try {
        // 매입 거래 데이터
        const purchaseData = executePyHubCommand('excel_get_values', {
            book_name: '2025년 9월 매입매출 보고현황.xlsx',
            sheet_name: '협력사',
            sheet_range: 'A4:LJ100',
            value_type: 'csv'
        });
        
        let transactionId = 1;
        const lines = purchaseData.split('\n');
        
        for (const line of lines) {
            const columns = line.split(',');
            
            if (columns[1] && columns[2]) { // 거래처와 품번이 있는 경우
                const supplierName = columns[1].trim();
                const itemCode = columns[2].trim();
                const itemName = columns[4]?.trim() || '';
                const quantity = parseFloat(columns[10]) || 0;
                const unitPrice = parseFloat(columns[11]) || 0;
                const totalAmount = quantity * unitPrice;
                
                try {
                    const query = `
                        INSERT INTO purchase_transactions (
                            transaction_id, transaction_date, transaction_no, supplier_id, supplier_name,
                            item_id, item_name, quantity, unit_price, total_amount, is_active, created_at, updated_at
                        )
                        SELECT 
                            ${transactionId}, 
                            '2025-09-01', 
                            'PUR-${transactionId}', 
                            c.company_id, 
                            '${supplierName}',
                            i.item_id, 
                            '${itemName}', 
                            ${quantity}, 
                            ${unitPrice}, 
                            ${totalAmount}, 
                            true, 
                            NOW(), 
                            NOW()
                        FROM companies c, items i
                        WHERE c.company_name = '${supplierName}' AND i.item_code = '${itemCode}'
                        ON CONFLICT DO NOTHING;
                    `;
                    executeSQL(query);
                    log(`✓ 매입 거래 추가: ${supplierName} - ${itemCode}`);
                    transactionId++;
                } catch (error) {
                    log(`✗ 매입 거래 추가 실패: ${error}`);
                }
            }
        }
        
    } catch (error) {
        log(`거래 데이터 마이그레이션 오류: ${error}`);
    }
    
    log('=== 거래 데이터 마이그레이션 완료 ===');
}

// 메인 실행 함수
async function main() {
    try {
        log('=== 엑셀 데이터 마이그레이션 시작 ===');
        
        await clearExistingData();
        await migrateCompanies();
        await migrateItems();
        await migrateBOM();
        await migrateTransactions();
        
        log('=== 엑셀 데이터 마이그레이션 완료 ===');
        
    } catch (error) {
        log(`마이그레이션 실패: ${error}`);
        process.exit(1);
    }
}

// 스크립트 실행
if (require.main === module) {
    main();
}

export { main };
