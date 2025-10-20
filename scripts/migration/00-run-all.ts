/**
 * Phase 0: 마스터 마이그레이션 오케스트레이터
 *
 * 모든 마이그레이션 스크립트를 올바른 순서로 실행합니다.
 *
 * 실행 순서:
 * 1. Phase 1: 기존 데이터 삭제 (01-delete-existing-data.ts)
 * 2. Phase 2: Excel 파일 파싱 (02-parse-excel-files.ts)
 * 3. Phase 3: 데이터 검증 (03-validate-data.ts)
 * 4. Phase 4: 마스터 데이터 임포트
 *    - Group 1 (병렬): 04-companies, 03-warehouses
 *    - Group 2 (순차): 05-items → 06-bom, 07-coil-specs
 * 5. Phase 5: 거래 데이터 임포트 (병렬 실행 가능)
 *    - 08-inventory, 09-purchase-sales, 10-price-master, 11-scrap-tracking
 * 6. Phase 6: 최종 검증 (병렬 실행 가능)
 *    - 12-verify-integrity, 13-verify-calculations
 *
 * 실행:
 * - 순차 모드: npm run migrate:all
 * - 병렬 모드: npm run migrate:all -- --parallel
 * - Dry Run: npm run migrate:all -- --dry-run
 */

import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import { createLogger } from './utils/logger';
import * as path from 'path';

interface MigrationScript {
  id: string;
  name: string;
  description: string;
  phase: number;
  group?: number;
  parallel_group?: number;
  dependencies?: string[];
  estimated_time?: string;
}

interface ExecutionResult {
  script: MigrationScript;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

interface PhaseResult {
  phase: number;
  phase_name: string;
  scripts: ExecutionResult[];
  success: boolean;
  duration: number;
}

/**
 * 마이그레이션 스크립트 정의
 *
 * 각 스크립트의 실행 순서와 병렬 실행 가능 여부를 정의합니다.
 */
const MIGRATION_SCRIPTS: MigrationScript[] = [
  // Phase 1: 삭제
  {
    id: '01-delete',
    name: '01-delete-existing-data.ts',
    description: '기존 데이터 삭제',
    phase: 1,
    estimated_time: '~1분'
  },

  // Phase 2: 파싱
  {
    id: '02-parse',
    name: '02-parse-excel-files.ts',
    description: 'Excel 파일 파싱',
    phase: 2,
    dependencies: ['01-delete'],
    estimated_time: '~3분'
  },

  // Phase 3: 검증
  {
    id: '03-validate',
    name: '03-validate-data.ts',
    description: '데이터 검증',
    phase: 3,
    dependencies: ['02-parse'],
    estimated_time: '~2분'
  },

  // Phase 4 - Group 1: 마스터 데이터 (병렬 가능)
  {
    id: '03-warehouses',
    name: '03-import-warehouses.ts',
    description: '창고 임포트',
    phase: 4,
    group: 1,
    parallel_group: 1,
    dependencies: ['03-validate'],
    estimated_time: '~30초'
  },
  {
    id: '04-companies',
    name: '04-import-companies.ts',
    description: '거래처 임포트',
    phase: 4,
    group: 1,
    parallel_group: 1,
    dependencies: ['03-validate'],
    estimated_time: '~1분'
  },

  // Phase 4 - Group 2: 품목 및 관련 데이터 (순차)
  {
    id: '05-items',
    name: '05-import-items.ts',
    description: '품목 임포트',
    phase: 4,
    group: 2,
    dependencies: ['04-companies'],
    estimated_time: '~2분'
  },
  {
    id: '06-bom',
    name: '06-import-bom.ts',
    description: 'BOM 임포트',
    phase: 4,
    group: 2,
    dependencies: ['05-items'],
    estimated_time: '~1분'
  },
  {
    id: '07-coil',
    name: '07-import-coil-specs.ts',
    description: 'COIL 스펙 임포트',
    phase: 4,
    group: 2,
    dependencies: ['05-items'],
    estimated_time: '~30초'
  },

  // Phase 5: 거래 데이터 (병렬 가능)
  {
    id: '08-inventory',
    name: '08-import-inventory-transactions.ts',
    description: '재고 거래 임포트',
    phase: 5,
    parallel_group: 2,
    dependencies: ['05-items', '03-warehouses'],
    estimated_time: '~2분'
  },
  {
    id: '09-purchase-sales',
    name: '09-import-purchase-sales.ts',
    description: '매입/매출 거래 임포트',
    phase: 5,
    parallel_group: 2,
    dependencies: ['04-companies', '05-items'],
    estimated_time: '~2분'
  },
  {
    id: '10-price',
    name: '10-import-price-master.ts',
    description: '단가 마스터 임포트',
    phase: 5,
    parallel_group: 2,
    dependencies: ['05-items'],
    estimated_time: '~1분'
  },
  {
    id: '11-scrap',
    name: '11-import-scrap-tracking.ts',
    description: '스크랩 추적 임포트',
    phase: 5,
    parallel_group: 2,
    dependencies: ['05-items'],
    estimated_time: '~1분'
  },

  // Phase 6: 최종 검증 (병렬 가능)
  {
    id: '12-integrity',
    name: '12-verify-integrity.ts',
    description: '무결성 검증',
    phase: 6,
    parallel_group: 3,
    dependencies: ['08-inventory', '09-purchase-sales', '10-price', '11-scrap'],
    estimated_time: '~2분'
  },
  {
    id: '13-calculations',
    name: '13-verify-calculations.ts',
    description: '계산 검증',
    phase: 6,
    parallel_group: 3,
    dependencies: ['08-inventory', '09-purchase-sales', '10-price', '11-scrap'],
    estimated_time: '~2분'
  }
];

/**
 * 스크립트 실행
 *
 * npx tsx를 사용하여 TypeScript 파일을 실행합니다.
 */
async function executeScript(
  script: MigrationScript,
  logger: ReturnType<typeof createLogger>
): Promise<ExecutionResult> {
  const scriptPath = path.join(__dirname, script.name);
  const startTime = performance.now();

  logger.log(`\n▶️  실행 중: ${script.description} (${script.estimated_time})`, 'info');

  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', scriptPath], {
      stdio: 'inherit',
      shell: true
    });

    let output = '';
    let error = '';

    child.on('close', (code) => {
      const duration = performance.now() - startTime;
      const success = code === 0;

      if (success) {
        logger.log(`✅ 완료: ${script.description} (${(duration / 1000).toFixed(2)}초)`, 'success');
      } else {
        logger.log(`❌ 실패: ${script.description} (exit code: ${code})`, 'error');
      }

      resolve({
        script,
        success,
        duration,
        output: output || undefined,
        error: error || undefined
      });
    });
  });
}

/**
 * 스크립트 병렬 실행
 *
 * 여러 스크립트를 동시에 실행합니다.
 */
async function executeScriptsParallel(
  scripts: MigrationScript[],
  logger: ReturnType<typeof createLogger>
): Promise<ExecutionResult[]> {
  logger.log(`\n⚡ 병렬 실행: ${scripts.map(s => s.description).join(', ')}`, 'info');

  const promises = scripts.map(script => executeScript(script, logger));
  return Promise.all(promises);
}

/**
 * 스크립트 순차 실행
 *
 * 스크립트를 하나씩 순서대로 실행합니다.
 */
async function executeScriptsSequential(
  scripts: MigrationScript[],
  logger: ReturnType<typeof createLogger>
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  for (const script of scripts) {
    const result = await executeScript(script, logger);
    results.push(result);

    // 실패 시 중단
    if (!result.success) {
      logger.log(`\n⚠️  ${script.description} 실패로 인해 마이그레이션 중단`, 'error');
      break;
    }
  }

  return results;
}

/**
 * Phase별 스크립트 그룹화
 */
function groupScriptsByPhase(scripts: MigrationScript[]): Map<number, MigrationScript[]> {
  const groups = new Map<number, MigrationScript[]>();

  scripts.forEach(script => {
    if (!groups.has(script.phase)) {
      groups.set(script.phase, []);
    }
    groups.get(script.phase)!.push(script);
  });

  return groups;
}

/**
 * 병렬 그룹별 스크립트 그룹화
 */
function groupScriptsByParallelGroup(scripts: MigrationScript[]): Map<number, MigrationScript[]> {
  const groups = new Map<number, MigrationScript[]>();

  scripts.forEach(script => {
    if (script.parallel_group !== undefined) {
      if (!groups.has(script.parallel_group)) {
        groups.set(script.parallel_group, []);
      }
      groups.get(script.parallel_group)!.push(script);
    }
  });

  return groups;
}

/**
 * Phase 실행
 *
 * Phase 내 스크립트를 병렬 또는 순차로 실행합니다.
 */
async function executePhase(
  phase: number,
  scripts: MigrationScript[],
  parallelMode: boolean,
  logger: ReturnType<typeof createLogger>
): Promise<PhaseResult> {
  const phaseName = getPhaseName(phase);
  const startTime = performance.now();

  logger.divider('=');
  logger.log(`\n🚀 Phase ${phase}: ${phaseName}\n`, 'info');

  let results: ExecutionResult[] = [];

  if (parallelMode && phase >= 4) {
    // Phase 4 이상: 병렬 그룹 처리
    const parallelGroups = groupScriptsByParallelGroup(scripts);

    // 병렬 그룹이 없으면 순차 실행
    if (parallelGroups.size === 0) {
      results = await executeScriptsSequential(scripts, logger);
    } else {
      // 병렬 그룹 순차 실행 (그룹 내부는 병렬)
      for (const [groupId, groupScripts] of Array.from(parallelGroups.entries()).sort((a, b) => a[0] - b[0])) {
        logger.log(`\n📦 병렬 그룹 ${groupId}`, 'info');
        const groupResults = await executeScriptsParallel(groupScripts, logger);
        results.push(...groupResults);

        // 그룹 내 실패 시 중단
        if (groupResults.some(r => !r.success)) {
          break;
        }
      }

      // 병렬 그룹이 없는 스크립트는 순차 실행
      const nonParallelScripts = scripts.filter(s => s.parallel_group === undefined);
      if (nonParallelScripts.length > 0) {
        const sequentialResults = await executeScriptsSequential(nonParallelScripts, logger);
        results.push(...sequentialResults);
      }
    }
  } else {
    // Phase 1-3: 순차 실행
    results = await executeScriptsSequential(scripts, logger);
  }

  const duration = performance.now() - startTime;
  const success = results.every(r => r.success);

  return {
    phase,
    phase_name: phaseName,
    scripts: results,
    success,
    duration
  };
}

/**
 * Phase 이름 가져오기
 */
function getPhaseName(phase: number): string {
  const phaseNames: { [key: number]: string } = {
    1: '기존 데이터 삭제',
    2: 'Excel 파일 파싱',
    3: '데이터 검증',
    4: '마스터 데이터 임포트',
    5: '거래 데이터 임포트',
    6: '최종 검증'
  };

  return phaseNames[phase] || `Phase ${phase}`;
}

/**
 * 최종 리포트 생성
 */
function generateFinalReport(
  phaseResults: PhaseResult[],
  totalDuration: number,
  logger: ReturnType<typeof createLogger>
): void {
  logger.divider('=');
  logger.log('\n📊 마이그레이션 최종 리포트\n', 'info');

  // 1. Phase별 결과
  logger.log('📋 Phase별 결과:', 'info');
  const phaseTable: { [key: string]: string } = {};
  phaseResults.forEach(pr => {
    const status = pr.success ? '✅' : '❌';
    const duration = (pr.duration / 1000).toFixed(2);
    phaseTable[`Phase ${pr.phase}: ${pr.phase_name}`] = `${status} (${duration}초)`;
  });
  logger.table(phaseTable);

  // 2. 스크립트별 결과
  logger.log('\n📝 스크립트별 결과:', 'info');
  const scriptTable: { [key: string]: string } = {};
  phaseResults.forEach(pr => {
    pr.scripts.forEach(sr => {
      const status = sr.success ? '✅' : '❌';
      const duration = (sr.duration / 1000).toFixed(2);
      scriptTable[sr.script.description] = `${status} (${duration}초)`;
    });
  });
  logger.table(scriptTable);

  // 3. 전체 통계
  const totalScripts = phaseResults.reduce((sum, pr) => sum + pr.scripts.length, 0);
  const successScripts = phaseResults.reduce(
    (sum, pr) => sum + pr.scripts.filter(s => s.success).length,
    0
  );
  const failedScripts = totalScripts - successScripts;

  logger.log('\n📊 전체 통계:', 'info');
  logger.table({
    '총 Phase 수': phaseResults.length,
    '총 스크립트 수': totalScripts,
    '성공': successScripts,
    '실패': failedScripts,
    '성공률': `${((successScripts / totalScripts) * 100).toFixed(2)}%`,
    '총 실행 시간': `${(totalDuration / 1000).toFixed(2)}초`
  });

  // 4. 실패한 스크립트 상세
  const failures = phaseResults
    .flatMap(pr => pr.scripts)
    .filter(sr => !sr.success);

  if (failures.length > 0) {
    logger.log('\n⚠️  실패한 스크립트:', 'warn');
    failures.forEach(f => {
      logger.log(`  - ${f.script.description}`, 'error');
      if (f.error) {
        logger.log(`    에러: ${f.error}`, 'error');
      }
    });
  }

  // 5. 성공 메시지
  const allSuccess = phaseResults.every(pr => pr.success);
  if (allSuccess) {
    logger.log('\n🎉 모든 마이그레이션이 성공적으로 완료되었습니다!', 'success');
  } else {
    logger.log('\n❌ 일부 마이그레이션이 실패했습니다. 위 로그를 확인하세요.', 'error');
  }
}

/**
 * Dry Run 모드
 *
 * 실제 실행 없이 실행 계획만 출력합니다.
 */
function dryRun(parallelMode: boolean, logger: ReturnType<typeof createLogger>): void {
  logger.divider('=');
  logger.log('\n🔍 Dry Run: 마이그레이션 실행 계획\n', 'info');

  const phaseGroups = groupScriptsByPhase(MIGRATION_SCRIPTS);

  Array.from(phaseGroups.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([phase, scripts]) => {
      const phaseName = getPhaseName(phase);
      logger.log(`\n📦 Phase ${phase}: ${phaseName}`, 'info');

      if (parallelMode && phase >= 4) {
        const parallelGroups = groupScriptsByParallelGroup(scripts);

        if (parallelGroups.size > 0) {
          parallelGroups.forEach((groupScripts, groupId) => {
            logger.log(`  🔀 병렬 그룹 ${groupId} (동시 실행):`, 'info');
            groupScripts.forEach(s => {
              logger.log(`    - ${s.description} (${s.estimated_time})`, 'info');
            });
          });

          const nonParallelScripts = scripts.filter(s => s.parallel_group === undefined);
          if (nonParallelScripts.length > 0) {
            logger.log(`  ➡️  순차 실행:`, 'info');
            nonParallelScripts.forEach(s => {
              logger.log(`    - ${s.description} (${s.estimated_time})`, 'info');
            });
          }
        } else {
          logger.log(`  ➡️  순차 실행:`, 'info');
          scripts.forEach(s => {
            logger.log(`    - ${s.description} (${s.estimated_time})`, 'info');
          });
        }
      } else {
        logger.log(`  ➡️  순차 실행:`, 'info');
        scripts.forEach(s => {
          logger.log(`    - ${s.description} (${s.estimated_time})`, 'info');
        });
      }
    });

  logger.log('\n💡 실제 실행: npm run migrate:all', 'info');
  logger.log('💡 병렬 모드: npm run migrate:all -- --parallel', 'info');
}

async function main() {
  const logger = createLogger('마이그레이션 오케스트레이터');

  // CLI 인자 파싱
  const args = process.argv.slice(2);
  const parallelMode = args.includes('--parallel');
  const dryRunMode = args.includes('--dry-run');

  // Dry Run 모드
  if (dryRunMode) {
    dryRun(parallelMode, logger);
    process.exit(0);
  }

  // 실행 모드 표시
  logger.startMigration();
  logger.log(`\n실행 모드: ${parallelMode ? '⚡ 병렬 (Parallel)' : '➡️  순차 (Sequential)'}`, 'info');

  const totalStartTime = performance.now();
  const phaseResults: PhaseResult[] = [];

  // Phase별 실행
  const phaseGroups = groupScriptsByPhase(MIGRATION_SCRIPTS);

  for (const [phase, scripts] of Array.from(phaseGroups.entries()).sort((a, b) => a[0] - b[0])) {
    const phaseResult = await executePhase(phase, scripts, parallelMode, logger);
    phaseResults.push(phaseResult);

    // Phase 실패 시 중단
    if (!phaseResult.success) {
      logger.log(`\n⚠️  Phase ${phase} 실패로 인해 마이그레이션 중단`, 'error');
      break;
    }
  }

  const totalDuration = performance.now() - totalStartTime;

  // 최종 리포트 생성
  generateFinalReport(phaseResults, totalDuration, logger);

  // 성공 여부 판정
  const allSuccess = phaseResults.every(pr => pr.success);
  logger.endMigration(allSuccess);

  if (!allSuccess) {
    process.exit(1);
  }
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});
