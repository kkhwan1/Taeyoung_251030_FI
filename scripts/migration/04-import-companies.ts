/**
 * Phase 4: 거래처(Companies) 마스터 임포트
 *
 * 종합관리 SHEET와 매입매출 보고현황에서 거래처 데이터를 추출하여 임포트합니다.
 * - parsed-comprehensive.json → 거래처 기본 정보
 * - parsed-purchase-sales.json → 추가 거래처명
 * - 중복 제거 및 자동 company_code 생성
 * - 타입별 접두사: CUS(고객사), SUP(공급사), PAR(협력사), OTH(기타)
 *
 * ⚡ 병렬 실행 가능: warehouses import와 동시 실행 가능 (의존성 없음)
 *
 * 실행: npm run migrate:companies
 */

import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient, batchInsert } from './utils/supabase-client';
import { createLogger } from './utils/logger';
import {
  ParseResult,
  ComprehensiveExcelRow,
  PurchaseSalesExcelRow,
  ParsedCompany,
  CompanyCodeMap
} from './types/excel-data';

const DATA_DIR = path.resolve(process.cwd(), 'scripts/migration/data');
const OUTPUT_FILE = path.join(DATA_DIR, 'company-code-map.json');

/**
 * 거래처 타입별 접두사
 */
const TYPE_PREFIX_MAP: Record<string, string> = {
  '고객사': 'CUS',
  '공급사': 'SUP',
  '협력사': 'PAR',
  '기타': 'OTH'
};

/**
 * 거래처 타입 정규화
 */
function normalizeCompanyType(type: string | undefined): string {
  if (!type) return '기타';

  const typeMapping: { [key: string]: string } = {
    '고객사': '고객사',
    '공급사': '공급사',
    '협력사': '협력사',
    '기타': '기타',
    'CUSTOMER': '고객사',
    'SUPPLIER': '공급사',
    'PARTNER': '협력사',
    'OTHER': '기타',
    'CUS': '고객사',
    'SUP': '공급사',
    'PAR': '협력사',
    'OTH': '기타'
  };

  return typeMapping[type] || '기타';
}

/**
 * company_code 자동 생성
 */
function generateCompanyCode(
  type: string,
  existingCodes: Set<string>,
  sequenceMap: Map<string, number>
): string {
  const prefix = TYPE_PREFIX_MAP[type] || 'OTH';
  let sequence = sequenceMap.get(prefix) || 1;

  let code = `${prefix}${String(sequence).padStart(3, '0')}`;

  // 중복 방지
  while (existingCodes.has(code)) {
    sequence++;
    code = `${prefix}${String(sequence).padStart(3, '0')}`;
  }

  sequenceMap.set(prefix, sequence + 1);
  existingCodes.add(code);

  return code;
}

/**
 * 종합관리 SHEET에서 거래처 추출
 */
function extractCompaniesFromComprehensive(
  data: ComprehensiveExcelRow[]
): Map<string, Partial<ParsedCompany>> {
  const companiesMap = new Map<string, Partial<ParsedCompany>>();

  data.forEach(row => {
    if (!row.거래처명 || row.거래처명.trim() === '') return;

    const name = row.거래처명.trim();

    // 기존 데이터가 없거나 더 상세한 정보가 있으면 업데이트
    if (!companiesMap.has(name)) {
      companiesMap.set(name, {
        company_name: name,
        company_type: '기타', // 기본값, 나중에 추론
        is_active: true
      });
    }

    // 거래처 코드가 있으면 추가
    const existing = companiesMap.get(name)!;
    if (row.거래처코드 && !existing.company_code) {
      existing.company_code = row.거래처코드;
    }
  });

  return companiesMap;
}

/**
 * 매입매출에서 거래처 추출 및 타입 추론
 */
function extractCompaniesFromPurchaseSales(
  data: PurchaseSalesExcelRow[],
  companiesMap: Map<string, Partial<ParsedCompany>>
): void {
  data.forEach(row => {
    if (!row.거래처명 || row.거래처명.trim() === '') return;

    const name = row.거래처명.trim();

    if (!companiesMap.has(name)) {
      companiesMap.set(name, {
        company_name: name,
        company_type: '기타',
        is_active: true
      });
    }

    // 거래구분으로 타입 추론
    const existing = companiesMap.get(name)!;
    if (row.거래구분 === '매출') {
      // 매출이면 고객사
      existing.company_type = '고객사';
    } else if (row.거래구분 === '매입') {
      // 매입이면 공급사
      if (existing.company_type === '기타') {
        existing.company_type = '공급사';
      }
    }
  });
}

/**
 * 거래처 데이터 변환 및 company_code 생성
 */
function transformCompanies(
  companiesMap: Map<string, Partial<ParsedCompany>>,
  logger: ReturnType<typeof createLogger>
): ParsedCompany[] {
  const existingCodes = new Set<string>();
  const sequenceMap = new Map<string, number>();
  const companies: ParsedCompany[] = [];

  companiesMap.forEach((company, name) => {
    // company_code가 없으면 자동 생성
    if (!company.company_code) {
      const type = normalizeCompanyType(company.company_type);
      company.company_code = generateCompanyCode(type, existingCodes, sequenceMap);
    } else {
      existingCodes.add(company.company_code);
    }

    // 타입 정규화
    company.company_type = normalizeCompanyType(company.company_type);

    // 필수 필드 검증
    if (!company.company_name || !company.company_code) {
      logger.log(`⚠️  거래처 스킵: 필수 필드 누락 - ${name}`, 'warn');
      return;
    }

    companies.push({
      company_code: company.company_code,
      company_name: company.company_name,
      company_type: company.company_type,
      is_active: company.is_active ?? true,
      business_registration_number: company.business_registration_number,
      representative_name: company.representative_name,
      contact_number: company.contact_number,
      address: company.address,
      business_info: company.business_info
    });
  });

  return companies;
}

/**
 * company_code → company_id 매핑 생성
 */
async function createCompanyCodeMap(
  supabase: any,
  logger: ReturnType<typeof createLogger>
): Promise<CompanyCodeMap> {
  logger.log('거래처 코드 → ID 매핑 생성 중...', 'info');

  const { data, error } = await supabase
    .from('companies')
    .select('company_id, company_code');

  if (error) {
    throw new Error(`거래처 조회 실패: ${error.message}`);
  }

  const codeMap: CompanyCodeMap = new Map();
  data.forEach((company: any) => {
    codeMap.set(company.company_code, company.company_id);
  });

  logger.log(`✅ ${codeMap.size}개 거래처 매핑 생성 완료`, 'success');
  return codeMap;
}

/**
 * 매핑 데이터 JSON 저장
 */
function saveCompanyCodeMap(
  codeMap: CompanyCodeMap,
  logger: ReturnType<typeof createLogger>
): void {
  const mapObject = Object.fromEntries(codeMap);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mapObject, null, 2), 'utf-8');
  logger.log(`💾 거래처 매핑 저장: ${OUTPUT_FILE}`, 'success');
}

async function main() {
  const logger = createLogger('거래처 임포트');
  logger.startMigration();

  // Step 1: 파싱된 데이터 로드
  logger.startPhase('파싱된 데이터 로드');

  const comprehensivePath = path.join(DATA_DIR, 'parsed-comprehensive.json');
  const purchaseSalesPath = path.join(DATA_DIR, 'parsed-purchase-sales.json');

  if (!fs.existsSync(comprehensivePath) || !fs.existsSync(purchaseSalesPath)) {
    logger.log('❌ 파싱된 데이터 파일이 없습니다. 먼저 02-parse-excel-files.ts를 실행하세요', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  const comprehensiveResult: ParseResult<ComprehensiveExcelRow> = JSON.parse(
    fs.readFileSync(comprehensivePath, 'utf-8')
  );
  const purchaseSalesResult: ParseResult<PurchaseSalesExcelRow> = JSON.parse(
    fs.readFileSync(purchaseSalesPath, 'utf-8')
  );

  logger.log(`종합관리: ${comprehensiveResult.data.length} 레코드`, 'info');
  logger.log(`매입매출: ${purchaseSalesResult.data.length} 레코드`, 'info');
  logger.endPhase();

  // Step 2: 거래처 데이터 추출 및 병합
  logger.startPhase('거래처 데이터 추출');

  const companiesMap = extractCompaniesFromComprehensive(comprehensiveResult.data);
  logger.log(`종합관리에서 ${companiesMap.size}개 거래처 추출`, 'info');

  extractCompaniesFromPurchaseSales(purchaseSalesResult.data, companiesMap);
  logger.log(`매입매출 데이터로 거래처 타입 추론 완료`, 'info');
  logger.log(`총 ${companiesMap.size}개 고유 거래처`, 'success');

  logger.endPhase();

  // Step 3: 거래처 데이터 변환
  logger.startPhase('거래처 데이터 변환');

  const companies = transformCompanies(companiesMap, logger);

  logger.log(`변환 완료: ${companies.length}개 거래처`, 'success');

  // 타입별 통계
  const typeStats: Record<string, number> = {};
  companies.forEach(c => {
    typeStats[c.company_type] = (typeStats[c.company_type] || 0) + 1;
  });

  logger.table({
    '총 거래처': companies.length,
    ...typeStats
  });

  logger.endPhase();

  // Step 4: Supabase 임포트
  logger.startPhase('Supabase 임포트');

  const supabase = createAdminClient();

  const result = await batchInsert(
    supabase,
    'companies',
    companies,
    100,
    (current, total) => {
      logger.progress(current, total, `${current}/${total} 거래처 임포트`);
    }
  );

  if (result.failed > 0) {
    logger.log(`⚠️  ${result.failed}개 거래처 임포트 실패`, 'warn');
    result.errors.forEach(err => {
      logger.log(`  Batch ${err.batch}: ${err.error}`, 'error');
    });
  }

  logger.log(`✅ ${result.success}개 거래처 임포트 완료`, 'success');
  logger.endPhase();

  // Step 5: 거래처 코드 → ID 매핑 생성 및 저장
  logger.startPhase('거래처 매핑 생성');

  const codeMap = await createCompanyCodeMap(supabase, logger);
  saveCompanyCodeMap(codeMap, logger);

  logger.endPhase();

  // Step 6: 결과 요약
  logger.divider('=');
  logger.log('\n📊 거래처 임포트 결과\n', 'info');

  logger.table({
    '임포트 성공': result.success,
    '임포트 실패': result.failed,
    '매핑 생성': codeMap.size
  });

  const success = result.failed === 0;
  logger.endMigration(success);

  if (!success) {
    process.exit(1);
  }
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});
