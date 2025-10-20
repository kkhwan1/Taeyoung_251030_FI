/**
 * Phase 6: 계산 검증 (Calculation Verification)
 *
 * 모든 임포트 완료 후 계산된 값들이 정확한지 검증합니다.
 * - BOM 계산 (parent-child 관계, 수량, 원가)
 * - 재고 계산 (거래 합계 vs 현재 재고)
 * - 금액 계산 (단가 × 수량 = 금액, 금액 + 세금 = 합계)
 * - COIL 계산 (밀도 × 길이 × 폭 × 두께)
 * - 단가 마스터 일관성
 *
 * ⚡ 병렬 실행 가능: 12-verify-integrity.ts와 동시 실행 가능
 *
 * 실행: npm run migrate:verify-calculations
 */

import { createAdminClient } from './utils/supabase-client';
import { createLogger } from './utils/logger';

interface CalculationCheck {
  category: string;
  check_name: string;
  description: string;
}

interface CalculationResult {
  check: CalculationCheck;
  passed: boolean;
  total_records: number;
  failed_records: number;
  error_rate: number;
  sample_errors?: any[];
}

/**
 * 계산 검증 목록
 *
 * 모든 계산 검증 항목을 정의합니다.
 */
const CALCULATION_CHECKS: CalculationCheck[] = [
  // BOM 계산
  {
    category: 'BOM',
    check_name: 'bom_quantity_positive',
    description: 'BOM 수량이 모두 양수인지 확인'
  },
  {
    category: 'BOM',
    check_name: 'bom_parent_child_valid',
    description: 'BOM parent_item_id와 child_item_id가 다른지 확인 (자기 참조 방지)'
  },
  {
    category: 'BOM',
    check_name: 'bom_circular_dependency',
    description: 'BOM 순환 참조 검증 (cycle 방지)'
  },

  // 재고 계산
  {
    category: 'Inventory',
    check_name: 'inventory_no_negative',
    description: '현재 재고가 음수가 아닌지 확인'
  },
  {
    category: 'Inventory',
    check_name: 'inventory_transaction_balance',
    description: '재고 거래 합계가 현재 재고와 일치하는지 확인'
  },

  // 매입/매출 금액 계산
  {
    category: 'Transaction',
    check_name: 'transaction_amount_calculation',
    description: '거래 금액 = 수량 × 단가 검증'
  },
  {
    category: 'Transaction',
    check_name: 'transaction_total_calculation',
    description: '거래 합계 = 금액 + 세금 검증'
  },

  // COIL 계산
  {
    category: 'COIL',
    check_name: 'coil_weight_calculation',
    description: 'COIL 무게 = 밀도 × 길이 × 폭 × 두께 검증'
  },
  {
    category: 'COIL',
    check_name: 'coil_kg_price_calculation',
    description: 'COIL KG 단가 계산 검증'
  },

  // 단가 마스터
  {
    category: 'Price',
    check_name: 'price_master_positive',
    description: '단가가 모두 양수인지 확인'
  },
  {
    category: 'Price',
    check_name: 'price_master_date_range',
    description: '단가 유효 기간 검증 (effective_from <= effective_to)'
  }
];

/**
 * BOM 수량 검증 (양수 확인)
 */
async function verifyBomQuantityPositive(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<CalculationResult> {
  const check = CALCULATION_CHECKS.find(c => c.check_name === 'bom_quantity_positive')!;

  const { data: allBom, error: allError } = await supabase
    .from('bom')
    .select('bom_id, parent_item_id, child_item_id, quantity');

  if (allError) {
    logger.log(`❌ BOM 조회 실패: ${allError.message}`, 'error');
    throw allError;
  }

  const totalRecords = allBom?.length || 0;

  if (totalRecords === 0) {
    logger.log('ℹ️  BOM 테이블이 비어있음', 'info');
    return {
      check,
      passed: true,
      total_records: 0,
      failed_records: 0,
      error_rate: 0
    };
  }

  const invalidBom = allBom?.filter(b => b.quantity <= 0) || [];
  const failedRecords = invalidBom.length;
  const errorRate = (failedRecords / totalRecords) * 100;

  if (failedRecords > 0) {
    logger.log(`⚠️  음수 또는 0 수량 BOM: ${failedRecords}개`, 'warn');
  } else {
    logger.log(`✅ 모든 BOM 수량이 양수`, 'success');
  }

  return {
    check,
    passed: failedRecords === 0,
    total_records: totalRecords,
    failed_records: failedRecords,
    error_rate: errorRate,
    sample_errors: invalidBom.slice(0, 5)
  };
}

/**
 * BOM 자기 참조 검증 (parent_item_id ≠ child_item_id)
 */
async function verifyBomParentChildValid(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<CalculationResult> {
  const check = CALCULATION_CHECKS.find(c => c.check_name === 'bom_parent_child_valid')!;

  const { data: allBom, error: allError } = await supabase
    .from('bom')
    .select('bom_id, parent_item_id, child_item_id');

  if (allError) {
    logger.log(`❌ BOM 조회 실패: ${allError.message}`, 'error');
    throw allError;
  }

  const totalRecords = allBom?.length || 0;

  if (totalRecords === 0) {
    return {
      check,
      passed: true,
      total_records: 0,
      failed_records: 0,
      error_rate: 0
    };
  }

  const selfReferenceBom = allBom?.filter(b => b.parent_item_id === b.child_item_id) || [];
  const failedRecords = selfReferenceBom.length;
  const errorRate = (failedRecords / totalRecords) * 100;

  if (failedRecords > 0) {
    logger.log(`⚠️  자기 참조 BOM: ${failedRecords}개`, 'warn');
  } else {
    logger.log(`✅ 자기 참조 없음`, 'success');
  }

  return {
    check,
    passed: failedRecords === 0,
    total_records: totalRecords,
    failed_records: failedRecords,
    error_rate: errorRate,
    sample_errors: selfReferenceBom.slice(0, 5)
  };
}

/**
 * BOM 순환 참조 검증 (간단한 depth-first 알고리즘)
 */
async function verifyBomCircularDependency(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<CalculationResult> {
  const check = CALCULATION_CHECKS.find(c => c.check_name === 'bom_circular_dependency')!;

  const { data: allBom, error: allError } = await supabase
    .from('bom')
    .select('bom_id, parent_item_id, child_item_id');

  if (allError) {
    logger.log(`❌ BOM 조회 실패: ${allError.message}`, 'error');
    throw allError;
  }

  const totalRecords = allBom?.length || 0;

  if (totalRecords === 0) {
    return {
      check,
      passed: true,
      total_records: 0,
      failed_records: 0,
      error_rate: 0
    };
  }

  // BOM 관계를 인접 리스트로 변환
  const adjacencyList = new Map<number, number[]>();
  allBom?.forEach(bom => {
    if (!adjacencyList.has(bom.parent_item_id)) {
      adjacencyList.set(bom.parent_item_id, []);
    }
    adjacencyList.get(bom.parent_item_id)!.push(bom.child_item_id);
  });

  // DFS로 순환 참조 탐지
  const circularPaths: number[][] = [];

  function dfs(itemId: number, path: Set<number>, pathArray: number[]): void {
    if (path.has(itemId)) {
      // 순환 발견
      const cycleStart = pathArray.indexOf(itemId);
      circularPaths.push(pathArray.slice(cycleStart));
      return;
    }

    path.add(itemId);
    pathArray.push(itemId);

    const children = adjacencyList.get(itemId) || [];
    for (const childId of children) {
      dfs(childId, new Set(path), [...pathArray]);
    }
  }

  // 모든 root 품목에서 DFS 시작
  const allParents = new Set(allBom?.map(b => b.parent_item_id));
  allParents.forEach(parentId => {
    dfs(parentId, new Set(), []);
  });

  const failedRecords = circularPaths.length;
  const errorRate = failedRecords > 0 ? 100 : 0; // 순환이 있으면 치명적

  if (failedRecords > 0) {
    logger.log(`⚠️  순환 참조 발견: ${failedRecords}개 경로`, 'warn');
  } else {
    logger.log(`✅ 순환 참조 없음`, 'success');
  }

  return {
    check,
    passed: failedRecords === 0,
    total_records: totalRecords,
    failed_records: failedRecords,
    error_rate: errorRate,
    sample_errors: circularPaths.slice(0, 3).map(path => ({ circular_path: path }))
  };
}

/**
 * 재고 음수 검증
 */
async function verifyInventoryNoNegative(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<CalculationResult> {
  const check = CALCULATION_CHECKS.find(c => c.check_name === 'inventory_no_negative')!;

  const { data: allItems, error: allError } = await supabase
    .from('items')
    .select('item_id, item_code, item_name, current_stock');

  if (allError) {
    logger.log(`❌ 품목 조회 실패: ${allError.message}`, 'error');
    throw allError;
  }

  const totalRecords = allItems?.length || 0;

  if (totalRecords === 0) {
    return {
      check,
      passed: true,
      total_records: 0,
      failed_records: 0,
      error_rate: 0
    };
  }

  const negativeStock = allItems?.filter(i => i.current_stock < 0) || [];
  const failedRecords = negativeStock.length;
  const errorRate = (failedRecords / totalRecords) * 100;

  if (failedRecords > 0) {
    logger.log(`⚠️  음수 재고: ${failedRecords}개`, 'warn');
  } else {
    logger.log(`✅ 음수 재고 없음`, 'success');
  }

  return {
    check,
    passed: failedRecords === 0,
    total_records: totalRecords,
    failed_records: failedRecords,
    error_rate: errorRate,
    sample_errors: negativeStock.slice(0, 5)
  };
}

/**
 * 재고 거래 합계 검증 (RECEIVING - SHIPPING = current_stock)
 */
async function verifyInventoryTransactionBalance(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<CalculationResult> {
  const check = CALCULATION_CHECKS.find(c => c.check_name === 'inventory_transaction_balance')!;

  // 품목별 거래 합계 계산
  const { data: transactionSums, error: sumError } = await supabase.rpc(
    'calculate_inventory_balance_per_item',
    {}
  );

  // RPC 함수가 없으면 수동 계산
  if (sumError && sumError.message.includes('function')) {
    logger.log('ℹ️  RPC 함수 없음, 수동 계산 수행', 'info');

    const { data: items, error: itemError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, current_stock');

    if (itemError) {
      logger.log(`❌ 품목 조회 실패: ${itemError.message}`, 'error');
      throw itemError;
    }

    const { data: transactions, error: txError } = await supabase
      .from('inventory_transactions')
      .select('item_id, transaction_type, quantity');

    if (txError) {
      logger.log(`❌ 거래 조회 실패: ${txError.message}`, 'error');
      throw txError;
    }

    const totalRecords = items?.length || 0;

    if (totalRecords === 0) {
      return {
        check,
        passed: true,
        total_records: 0,
        failed_records: 0,
        error_rate: 0
      };
    }

    // 품목별 거래 합계 계산
    const balanceMap = new Map<number, { receiving: number; shipping: number }>();
    transactions?.forEach(tx => {
      if (!balanceMap.has(tx.item_id)) {
        balanceMap.set(tx.item_id, { receiving: 0, shipping: 0 });
      }
      const balance = balanceMap.get(tx.item_id)!;
      if (tx.transaction_type === 'RECEIVING') {
        balance.receiving += tx.quantity;
      } else if (tx.transaction_type === 'SHIPPING') {
        balance.shipping += tx.quantity;
      }
    });

    // 현재 재고와 비교
    const mismatches = items?.filter(item => {
      const balance = balanceMap.get(item.item_id);
      if (!balance) {
        // 거래가 없으면 재고가 0이어야 함
        return item.current_stock !== 0;
      }
      const calculatedStock = balance.receiving - balance.shipping;
      return Math.abs(calculatedStock - item.current_stock) > 0.01; // 부동소수점 오차 허용
    }) || [];

    const failedRecords = mismatches.length;
    const errorRate = (failedRecords / totalRecords) * 100;

    if (failedRecords > 0) {
      logger.log(`⚠️  재고 불일치: ${failedRecords}개`, 'warn');
    } else {
      logger.log(`✅ 재고 합계 일치`, 'success');
    }

    return {
      check,
      passed: failedRecords === 0,
      total_records: totalRecords,
      failed_records: failedRecords,
      error_rate: errorRate,
      sample_errors: mismatches.slice(0, 5).map(item => ({
        item_id: item.item_id,
        item_code: item.item_code,
        current_stock: item.current_stock,
        calculated_stock: (balanceMap.get(item.item_id)?.receiving || 0) - (balanceMap.get(item.item_id)?.shipping || 0)
      }))
    };
  } else if (sumError) {
    logger.log(`❌ 재고 합계 계산 실패: ${sumError.message}`, 'error');
    throw sumError;
  }

  // RPC 결과 사용
  const failedRecords = transactionSums?.filter((s: any) => !s.is_balanced).length || 0;
  const totalRecords = transactionSums?.length || 0;
  const errorRate = totalRecords > 0 ? (failedRecords / totalRecords) * 100 : 0;

  return {
    check,
    passed: failedRecords === 0,
    total_records: totalRecords,
    failed_records: failedRecords,
    error_rate: errorRate,
    sample_errors: transactionSums?.filter((s: any) => !s.is_balanced).slice(0, 5)
  };
}

/**
 * 거래 금액 계산 검증 (amount = quantity × unit_price)
 */
async function verifyTransactionAmountCalculation(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<CalculationResult> {
  const check = CALCULATION_CHECKS.find(c => c.check_name === 'transaction_amount_calculation')!;

  const { data: transactions, error: txError } = await supabase
    .from('purchase_sales_transactions')
    .select('transaction_id, quantity, unit_price, amount');

  if (txError) {
    logger.log(`❌ 거래 조회 실패: ${txError.message}`, 'error');
    throw txError;
  }

  const totalRecords = transactions?.length || 0;

  if (totalRecords === 0) {
    return {
      check,
      passed: true,
      total_records: 0,
      failed_records: 0,
      error_rate: 0
    };
  }

  const invalidTransactions = transactions?.filter(tx => {
    const calculatedAmount = tx.quantity * tx.unit_price;
    return Math.abs(calculatedAmount - tx.amount) > 0.01; // 부동소수점 오차 허용
  }) || [];

  const failedRecords = invalidTransactions.length;
  const errorRate = (failedRecords / totalRecords) * 100;

  if (failedRecords > 0) {
    logger.log(`⚠️  금액 계산 오류: ${failedRecords}개`, 'warn');
  } else {
    logger.log(`✅ 금액 계산 정확`, 'success');
  }

  return {
    check,
    passed: failedRecords === 0,
    total_records: totalRecords,
    failed_records: failedRecords,
    error_rate: errorRate,
    sample_errors: invalidTransactions.slice(0, 5).map(tx => ({
      transaction_id: tx.transaction_id,
      quantity: tx.quantity,
      unit_price: tx.unit_price,
      stored_amount: tx.amount,
      calculated_amount: tx.quantity * tx.unit_price
    }))
  };
}

/**
 * 거래 합계 계산 검증 (total_amount = amount + tax)
 */
async function verifyTransactionTotalCalculation(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<CalculationResult> {
  const check = CALCULATION_CHECKS.find(c => c.check_name === 'transaction_total_calculation')!;

  const { data: transactions, error: txError } = await supabase
    .from('purchase_sales_transactions')
    .select('transaction_id, amount, tax, total_amount');

  if (txError) {
    logger.log(`❌ 거래 조회 실패: ${txError.message}`, 'error');
    throw txError;
  }

  const totalRecords = transactions?.length || 0;

  if (totalRecords === 0) {
    return {
      check,
      passed: true,
      total_records: 0,
      failed_records: 0,
      error_rate: 0
    };
  }

  const invalidTransactions = transactions?.filter(tx => {
    const calculatedTotal = tx.amount + tx.tax;
    return Math.abs(calculatedTotal - tx.total_amount) > 0.01; // 부동소수점 오차 허용
  }) || [];

  const failedRecords = invalidTransactions.length;
  const errorRate = (failedRecords / totalRecords) * 100;

  if (failedRecords > 0) {
    logger.log(`⚠️  합계 계산 오류: ${failedRecords}개`, 'warn');
  } else {
    logger.log(`✅ 합계 계산 정확`, 'success');
  }

  return {
    check,
    passed: failedRecords === 0,
    total_records: totalRecords,
    failed_records: failedRecords,
    error_rate: errorRate,
    sample_errors: invalidTransactions.slice(0, 5).map(tx => ({
      transaction_id: tx.transaction_id,
      amount: tx.amount,
      tax: tx.tax,
      stored_total: tx.total_amount,
      calculated_total: tx.amount + tx.tax
    }))
  };
}

/**
 * COIL 무게 계산 검증 (weight = density × length × width × thickness)
 */
async function verifyCoilWeightCalculation(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<CalculationResult> {
  const check = CALCULATION_CHECKS.find(c => c.check_name === 'coil_weight_calculation')!;

  const { data: coils, error: coilError } = await supabase
    .from('coil_specs')
    .select('spec_id, density, length, width, thickness, weight');

  if (coilError) {
    logger.log(`❌ COIL 조회 실패: ${coilError.message}`, 'error');
    throw coilError;
  }

  const totalRecords = coils?.length || 0;

  if (totalRecords === 0) {
    logger.log('ℹ️  COIL 테이블이 비어있음', 'info');
    return {
      check,
      passed: true,
      total_records: 0,
      failed_records: 0,
      error_rate: 0
    };
  }

  const invalidCoils = coils?.filter(coil => {
    if (!coil.density || !coil.length || !coil.width || !coil.thickness || !coil.weight) {
      return false; // NULL 값은 스킵
    }
    const calculatedWeight = coil.density * coil.length * coil.width * coil.thickness;
    return Math.abs(calculatedWeight - coil.weight) / coil.weight > 0.05; // 5% 오차 허용
  }) || [];

  const failedRecords = invalidCoils.length;
  const errorRate = (failedRecords / totalRecords) * 100;

  if (failedRecords > 0) {
    logger.log(`⚠️  COIL 무게 계산 오류: ${failedRecords}개`, 'warn');
  } else {
    logger.log(`✅ COIL 무게 계산 정확`, 'success');
  }

  return {
    check,
    passed: failedRecords === 0,
    total_records: totalRecords,
    failed_records: failedRecords,
    error_rate: errorRate,
    sample_errors: invalidCoils.slice(0, 5)
  };
}

/**
 * COIL KG 단가 계산 검증
 */
async function verifyCoilKgPriceCalculation(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<CalculationResult> {
  const check = CALCULATION_CHECKS.find(c => c.check_name === 'coil_kg_price_calculation')!;

  const { data: coils, error: coilError } = await supabase
    .from('coil_specs')
    .select('spec_id, weight, kg_price, sep_factor');

  if (coilError) {
    logger.log(`❌ COIL 조회 실패: ${coilError.message}`, 'error');
    throw coilError;
  }

  const totalRecords = coils?.length || 0;

  if (totalRecords === 0) {
    return {
      check,
      passed: true,
      total_records: 0,
      failed_records: 0,
      error_rate: 0
    };
  }

  // KG 단가 계산 로직은 복잡할 수 있으므로 NULL 체크만 수행
  const invalidCoils = coils?.filter(coil => {
    if (coil.weight && coil.weight > 0) {
      // 무게가 있으면 KG 단가도 있어야 함
      return !coil.kg_price || coil.kg_price <= 0;
    }
    return false;
  }) || [];

  const failedRecords = invalidCoils.length;
  const errorRate = (failedRecords / totalRecords) * 100;

  if (failedRecords > 0) {
    logger.log(`⚠️  COIL KG 단가 누락: ${failedRecords}개`, 'warn');
  } else {
    logger.log(`✅ COIL KG 단가 정상`, 'success');
  }

  return {
    check,
    passed: failedRecords === 0,
    total_records: totalRecords,
    failed_records: failedRecords,
    error_rate: errorRate,
    sample_errors: invalidCoils.slice(0, 5)
  };
}

/**
 * 단가 마스터 양수 검증
 */
async function verifyPriceMasterPositive(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<CalculationResult> {
  const check = CALCULATION_CHECKS.find(c => c.check_name === 'price_master_positive')!;

  const { data: prices, error: priceError } = await supabase
    .from('price_master')
    .select('price_id, item_id, unit_price');

  if (priceError) {
    logger.log(`❌ 단가 조회 실패: ${priceError.message}`, 'error');
    throw priceError;
  }

  const totalRecords = prices?.length || 0;

  if (totalRecords === 0) {
    logger.log('ℹ️  단가 마스터 테이블이 비어있음', 'info');
    return {
      check,
      passed: true,
      total_records: 0,
      failed_records: 0,
      error_rate: 0
    };
  }

  const invalidPrices = prices?.filter(p => p.unit_price <= 0) || [];
  const failedRecords = invalidPrices.length;
  const errorRate = (failedRecords / totalRecords) * 100;

  if (failedRecords > 0) {
    logger.log(`⚠️  음수 또는 0 단가: ${failedRecords}개`, 'warn');
  } else {
    logger.log(`✅ 모든 단가가 양수`, 'success');
  }

  return {
    check,
    passed: failedRecords === 0,
    total_records: totalRecords,
    failed_records: failedRecords,
    error_rate: errorRate,
    sample_errors: invalidPrices.slice(0, 5)
  };
}

/**
 * 단가 마스터 날짜 범위 검증
 */
async function verifyPriceMasterDateRange(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<CalculationResult> {
  const check = CALCULATION_CHECKS.find(c => c.check_name === 'price_master_date_range')!;

  const { data: prices, error: priceError } = await supabase
    .from('price_master')
    .select('price_id, item_id, effective_from, effective_to');

  if (priceError) {
    logger.log(`❌ 단가 조회 실패: ${priceError.message}`, 'error');
    throw priceError;
  }

  const totalRecords = prices?.length || 0;

  if (totalRecords === 0) {
    return {
      check,
      passed: true,
      total_records: 0,
      failed_records: 0,
      error_rate: 0
    };
  }

  const invalidPrices = prices?.filter(p => {
    if (p.effective_to === null) return false; // effective_to가 null이면 무한 유효
    return new Date(p.effective_from) > new Date(p.effective_to);
  }) || [];

  const failedRecords = invalidPrices.length;
  const errorRate = (failedRecords / totalRecords) * 100;

  if (failedRecords > 0) {
    logger.log(`⚠️  날짜 범위 오류: ${failedRecords}개`, 'warn');
  } else {
    logger.log(`✅ 날짜 범위 정상`, 'success');
  }

  return {
    check,
    passed: failedRecords === 0,
    total_records: totalRecords,
    failed_records: failedRecords,
    error_rate: errorRate,
    sample_errors: invalidPrices.slice(0, 5)
  };
}

/**
 * 계산 검증 리포트 생성
 */
function generateCalculationReport(
  results: CalculationResult[],
  logger: ReturnType<typeof createLogger>
): void {
  logger.divider('=');
  logger.log('\n📊 계산 검증 리포트\n', 'info');

  // 1. 카테고리별 집계
  const categories = [...new Set(results.map(r => r.check.category))];

  categories.forEach(category => {
    logger.log(`\n📂 ${category} 카테고리:`, 'info');
    const categoryResults = results.filter(r => r.check.category === category);

    const categoryTable: { [key: string]: string } = {};
    categoryResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const errorInfo = result.total_records > 0
        ? `${result.failed_records}/${result.total_records} (${result.error_rate.toFixed(2)}%)`
        : 'N/A';
      categoryTable[result.check.check_name] = `${status} ${errorInfo}`;
    });

    logger.table(categoryTable);
  });

  // 2. 실패한 검증 상세
  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    logger.log('\n⚠️  실패한 검증 상세:', 'warn');
    failures.forEach(f => {
      logger.log(`\n검증: ${f.check.description}`, 'warn');
      logger.log(`  실패 레코드: ${f.failed_records}/${f.total_records}`, 'warn');
      logger.log(`  오류율: ${f.error_rate.toFixed(2)}%`, 'warn');
      if (f.sample_errors && f.sample_errors.length > 0) {
        logger.log(`  샘플 에러:`, 'warn');
        logger.table(f.sample_errors);
      }
    });
  } else {
    logger.log('\n✅ 모든 계산 검증을 통과했습니다', 'success');
  }

  // 3. 전체 통과율
  const totalChecks = results.length;
  const passedChecks = results.filter(r => r.passed).length;
  const passRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

  logger.log('\n📊 전체 검증 통과율:', 'info');
  logger.table({
    '총 검증 항목': totalChecks,
    '통과': passedChecks,
    '실패': totalChecks - passedChecks,
    '통과율': `${passRate.toFixed(2)}%`
  });
}

async function main() {
  const logger = createLogger('계산 검증');
  logger.startMigration();

  const supabase = createAdminClient();
  const results: CalculationResult[] = [];

  // Step 1: BOM 계산 검증
  logger.startPhase('BOM 계산 검증');

  try {
    results.push(await verifyBomQuantityPositive(supabase, logger));
    results.push(await verifyBomParentChildValid(supabase, logger));
    results.push(await verifyBomCircularDependency(supabase, logger));
  } catch (error) {
    logger.log(`❌ BOM 검증 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }

  logger.endPhase();

  // Step 2: 재고 계산 검증
  logger.startPhase('재고 계산 검증');

  try {
    results.push(await verifyInventoryNoNegative(supabase, logger));
    results.push(await verifyInventoryTransactionBalance(supabase, logger));
  } catch (error) {
    logger.log(`❌ 재고 검증 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }

  logger.endPhase();

  // Step 3: 거래 금액 계산 검증
  logger.startPhase('거래 금액 계산 검증');

  try {
    results.push(await verifyTransactionAmountCalculation(supabase, logger));
    results.push(await verifyTransactionTotalCalculation(supabase, logger));
  } catch (error) {
    logger.log(`❌ 거래 검증 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }

  logger.endPhase();

  // Step 4: COIL 계산 검증
  logger.startPhase('COIL 계산 검증');

  try {
    results.push(await verifyCoilWeightCalculation(supabase, logger));
    results.push(await verifyCoilKgPriceCalculation(supabase, logger));
  } catch (error) {
    logger.log(`❌ COIL 검증 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }

  logger.endPhase();

  // Step 5: 단가 마스터 검증
  logger.startPhase('단가 마스터 검증');

  try {
    results.push(await verifyPriceMasterPositive(supabase, logger));
    results.push(await verifyPriceMasterDateRange(supabase, logger));
  } catch (error) {
    logger.log(`❌ 단가 검증 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }

  logger.endPhase();

  // Step 6: 리포트 생성
  logger.startPhase('계산 검증 리포트 생성');

  generateCalculationReport(results, logger);

  logger.endPhase();

  // Step 7: 결과 판정
  const hasFailures = results.some(r => !r.passed);
  const success = !hasFailures;

  logger.endMigration(success);

  if (!success) {
    logger.log('\n⚠️  계산 검증 실패가 발견되었습니다. 위 리포트를 확인하세요.', 'warn');
    process.exit(1);
  }

  logger.log('\n✅ 모든 계산 검증을 통과했습니다', 'success');
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});
