/**
 * 누락된 거래처 및 제외된 데이터 추가 스크립트
 *
 * 1. 누락된 거래처 추가 (7개)
 * 2. company_id가 NULL인 거래의 company_id 매핑 개선
 * 3. reference_number 형식 개선으로 매핑 재시도
 *
 * 실행: npx tsx scripts/migration/add-missing-data.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';
import { Database } from '@/types/supabase';

type Company = Database['public']['Tables']['companies']['Insert'];

const EXCEL_DIR = path.resolve(process.cwd(), '.example');

/**
 * 누락된 거래처 추가
 */
async function addMissingCompanies(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<number> {
  // 누락된 거래처 목록
  const missingCompanies: Company[] = [
    {
      company_code: 'COMP-PUNGGISEOSAN',
      company_name: '풍기서산',
      company_type: '공급사' as const,
      is_active: true
    },
    {
      company_code: 'COMP-DAEWOOPOSEUNG',
      company_name: '대우포승',
      company_type: '공급사' as const,
      is_active: true
    },
    {
      company_code: 'COMP-HOWONAUTO',
      company_name: '호원오토',
      company_type: '공급사' as const,
      is_active: true
    },
    {
      company_code: 'COMP-SINSEONGTECH',
      company_name: '신성테크',
      company_type: '협력사' as const,
      is_active: true
    },
    {
      company_code: 'COMP-CHANGGYUNGESTECH',
      company_name: '창경에스테크',
      company_type: '협력사' as const,
      is_active: true
    },
    {
      company_code: 'COMP-JAYESTECH',
      company_name: '제이에스테크',
      company_type: '협력사' as const,
      is_active: true
    },
    {
      company_code: 'COMP-DAEILCFT',
      company_name: '대일씨에프티',
      company_type: '협력사' as const,
      is_active: true
    }
  ];

  let added = 0;

  for (const company of missingCompanies) {
    // 중복 체크
    const { data: existing } = await supabase
      .from('companies')
      .select('company_id')
      .eq('company_name', company.company_name)
      .single();

    if (existing) {
      logger.log(`  ℹ️  ${company.company_name}: 이미 존재`, 'info');
      continue;
    }

    const { data, error } = await supabase
      .from('companies')
      .insert(company)
      .select('company_id')
      .single();

    if (error) {
      logger.log(`  ⚠️  ${company.company_name}: ${error.message}`, 'warn');
    } else {
      logger.log(`  ✅ ${company.company_name}: 추가 완료`, 'success');
      added++;
    }
  }

  return added;
}

/**
 * reference_number에서 거래처 이름을 더 정확하게 추출
 */
function extractCompanyNameFromRef(ref: string | null): string | null {
  if (!ref) return null;

  // 형식: AUTO-{거래처명}-...
  // 다양한 패턴 처리
  const patterns = [
    /AUTO-([^-]+(?:\(사급\))?)-/,
    /AUTO-([^-\d]+?)(?:-|$)/,
    /([가-힣]+(?:사급|테크|산업|금속)?)/
  ];

  for (const pattern of patterns) {
    const match = ref.match(pattern);
    if (match && match[1]) {
      let companyName = match[1].trim();
      
      // 정리
      companyName = companyName.replace(/\(사급\)/g, '').trim();
      companyName = companyName.replace(/-/g, '').trim();
      
      // 유효한 거래처 이름인지 확인 (너무 짧거나 숫자만 있으면 제외)
      if (companyName.length >= 2 && /[가-힣a-zA-Z]/.test(companyName)) {
        return companyName;
      }
    }
  }

  return null;
}

/**
 * 시트명에서 거래처 이름 매핑
 */
function getCompanyNameFromSheetName(sheetName: string): string | null {
  // 시트명 패턴 매핑
  const sheetNameMap: Record<string, string> = {
    '풍기서산(사급)': '풍기서산',
    '세원테크(사급)': '세원테크',
    '대우포승(사급)': '대우포승',
    '호원오토(사급)': '호원오토',
    '웅지테크': '웅지테크',
    '태영금속': '태영금속',
    'JS테크': 'JS테크',
    '에이오에스': '에이오에스',
    '창경테크': '창경테크',
    '신성테크': '신성테크',
    '광성산업': '광성산업'
  };

  return sheetNameMap[sheetName] || null;
}

/**
 * company_id가 NULL인 거래의 company_id 업데이트 (개선된 로직)
 */
async function updateTransactionCompanyIds(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<number> {
  // 1. 모든 거래처 조회
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('company_id, company_name');

  if (companyError) {
    throw new Error(`거래처 조회 실패: ${companyError.message}`);
  }

  const companyNameToIdMap = new Map<string, number>();
  const companyNameVariations = new Map<string, number>(); // 변형된 이름도 매핑

  companies?.forEach(company => {
    companyNameToIdMap.set(company.company_name, company.company_id);
    
    // 변형된 이름도 추가
    const variations = [
      company.company_name.replace(/\(사급\)/g, '').trim(),
      company.company_name.replace(/사급/g, '').trim(),
      company.company_name + '(사급)'
    ];
    
    variations.forEach(variation => {
      if (variation && variation !== company.company_name) {
        companyNameVariations.set(variation, company.company_id);
      }
    });
  });

  // 2. company_id가 NULL인 거래 조회 (더 많이)
  const { data: transactions, error: fetchError } = await supabase
    .from('inventory_transactions')
    .select('transaction_id, reference_number, description')
    .is('company_id', null)
    .limit(2000);

  if (fetchError) {
    throw new Error(`거래 조회 실패: ${fetchError.message}`);
  }

  if (!transactions || transactions.length === 0) {
    logger.log('업데이트할 거래가 없습니다', 'info');
    return 0;
  }

  logger.log(`${transactions.length}개 거래 처리 시작`, 'info');

  let updated = 0;
  let matched = 0;
  const unmatchedRefs = new Set<string>();

  // 3. 각 거래의 reference_number에서 거래처 추출 및 매핑
  for (const txn of transactions) {
    const ref = txn.reference_number;
    let companyId: number | null = null;

    // reference_number에서 거래처 이름 추출
    const companyName = extractCompanyNameFromRef(ref);

    if (companyName) {
      // 직접 매칭
      companyId = companyNameToIdMap.get(companyName) || null;

      // 변형된 이름으로 매칭
      if (!companyId) {
        companyId = companyNameVariations.get(companyName) || null;
      }

      // 부분 매칭 시도 (예: "풍기서산"이 "풍기서산(사급)"에 포함)
      if (!companyId) {
        for (const [name, id] of companyNameToIdMap.entries()) {
          if (name.includes(companyName) || companyName.includes(name)) {
            companyId = id;
            break;
          }
        }
      }
    }

    // description에서도 시도
    if (!companyId && txn.description) {
      const descCompanyName = extractCompanyNameFromRef(txn.description);
      if (descCompanyName) {
        companyId = companyNameToIdMap.get(descCompanyName) || 
                   companyNameVariations.get(descCompanyName) || null;
      }
    }

    if (companyId) {
      const { error } = await supabase
        .from('inventory_transactions')
        .update({ company_id: companyId })
        .eq('transaction_id', txn.transaction_id);

      if (error) {
        logger.log(`  ⚠️  거래 ${txn.transaction_id}: ${error.message}`, 'warn');
      } else {
        updated++;
        matched++;
      }
    } else {
      unmatchedRefs.add(ref || '');
    }
  }

  if (unmatchedRefs.size > 0) {
    logger.log(`⚠️  매칭 실패한 reference_number: ${unmatchedRefs.size}개`, 'warn');
    Array.from(unmatchedRefs).slice(0, 10).forEach(ref => {
      logger.log(`  - ${ref}`, 'warn');
    });
  }

  return updated;
}

/**
 * 시트명 기반으로 거래의 company_id 업데이트
 */
async function updateTransactionCompanyIdsBySheetName(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<number> {
  // reference_number 형식: AUTO-{시트명}-T{days}
  // 시트명에서 거래처 추출

  const { data: transactions, error: fetchError } = await supabase
    .from('inventory_transactions')
    .select('transaction_id, reference_number')
    .is('company_id', null)
    .like('reference_number', 'AUTO-%')
    .limit(1000);

  if (fetchError) {
    throw new Error(`거래 조회 실패: ${fetchError.message}`);
  }

  if (!transactions || transactions.length === 0) {
    return 0;
  }

  // 거래처 이름 매핑
  const { data: companies } = await supabase
    .from('companies')
    .select('company_id, company_name');

  const companyMap = new Map<string, number>();
  companies?.forEach(c => {
    companyMap.set(c.company_name, c.company_id);
  });

  let updated = 0;

  for (const txn of transactions) {
    const ref = txn.reference_number || '';
    const match = ref.match(/AUTO-([^-]+)-/);
    
    if (match) {
      let sheetName = match[1].trim();
      const companyName = getCompanyNameFromSheetName(sheetName) || sheetName.replace(/[^가-힣a-zA-Z]/g, '');

      let companyId = companyMap.get(companyName) || null;

      // 부분 매칭
      if (!companyId) {
        for (const [name, id] of companyMap.entries()) {
          if (name.includes(companyName) || companyName.includes(name)) {
            companyId = id;
            break;
          }
        }
      }

      if (companyId) {
        const { error } = await supabase
          .from('inventory_transactions')
          .update({ company_id: companyId })
          .eq('transaction_id', txn.transaction_id);

        if (!error) {
          updated++;
        }
      }
    }
  }

  return updated;
}

/**
 * Main function
 */
async function main() {
  const logger = createLogger('누락 데이터 추가');
  logger.startMigration();

  const supabase = createAdminClient();

  // Step 1: 연결 테스트
  logger.startPhase('Supabase 연결 테스트');
  const connected = await testConnection(supabase);
  if (!connected) {
    logger.log('Supabase 연결 실패', 'error');
    logger.endMigration(false);
    process.exit(1);
  }
  logger.endPhase();

  // Step 2: 누락된 거래처 추가
  logger.startPhase('누락된 거래처 추가');
  const companiesAdded = await addMissingCompanies(supabase, logger);
  logger.log(`✅ ${companiesAdded}개 거래처 추가 완료`, 'success');
  logger.endPhase();

  // Step 3: company_id 업데이트 (개선된 로직)
  logger.startPhase('company_id 업데이트 (개선된 로직)');
  const updated1 = await updateTransactionCompanyIds(supabase, logger);
  logger.log(`✅ ${updated1}개 거래 업데이트 완료`, 'success');
  logger.endPhase();

  // Step 4: 시트명 기반 company_id 업데이트
  logger.startPhase('시트명 기반 company_id 업데이트');
  const updated2 = await updateTransactionCompanyIdsBySheetName(supabase, logger);
  logger.log(`✅ ${updated2}개 거래 업데이트 완료`, 'success');
  logger.endPhase();

  // Step 5: 최종 확인
  logger.startPhase('최종 상태 확인');
  const { count: nullCompanyCount } = await supabase
    .from('inventory_transactions')
    .select('*', { count: 'exact', head: true })
    .is('company_id', null);

  logger.log(`남은 company_id NULL 거래: ${nullCompanyCount || 0}개`, 'info');
  logger.endPhase();

  // Step 6: 결과 요약
  logger.divider('=');
  logger.log('\n📊 누락 데이터 추가 결과\n', 'info');
  
  logger.table({
    '추가된 거래처': companiesAdded,
    'company_id 업데이트 (개선)': updated1,
    'company_id 업데이트 (시트명)': updated2,
    '총 업데이트': updated1 + updated2,
    '남은 NULL 거래': nullCompanyCount || 0
  });

  logger.endMigration(true);
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

