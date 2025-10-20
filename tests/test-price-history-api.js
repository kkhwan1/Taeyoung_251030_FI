/**
 * Phase P3 Wave 1 Task 1.4: Price History API 테스트
 * 목적: 5개 엔드포인트 전체 CRUD 테스트
 */

const BASE_URL = 'http://localhost:5000';

// 테스트 결과 저장
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// 테스트용 데이터
let createdPriceHistoryId = null;
const testItemId = 1; // 기존 품목 ID (items 테이블에 존재해야 함)

function logTest(name, passed, details) {
  results.total++;
  if (passed) {
    results.passed++;
    console.log(`✅ ${name}`);
  } else {
    results.failed++;
    console.error(`❌ ${name}`);
    console.error(`   상세: ${details}`);
  }
  results.tests.push({ name, passed, details });
}

async function testPOST() {
  console.log('\n============================================================');
  console.log('TEST 1: POST /api/price-history - 단가 등록');
  console.log('============================================================\n');

  const testData = {
    item_id: testItemId,
    price_month: '2025-01-01',
    unit_price: 5000.00,
    price_per_kg: 50.00,  // 새로 추가된 컬럼
    note: 'API 테스트용 단가',
    created_by: 'test_user'  // 새로 추가된 컬럼
  };

  try {
    const response = await fetch(`${BASE_URL}/api/price-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      createdPriceHistoryId = data.data.price_history_id;
      logTest('POST: 단가 등록 성공', true, `ID: ${createdPriceHistoryId}`);

      // 데이터 검증 (숫자형 비교)
      const isValid =
        data.data.item_id === testItemId &&
        data.data.unit_price === 5000 &&
        data.data.price_per_kg === 50 &&
        data.data.created_by === 'test_user';

      logTest('POST: 반환 데이터 검증', isValid, JSON.stringify(data.data, null, 2));
    } else {
      logTest('POST: 단가 등록 실패', false, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    logTest('POST: 요청 실패', false, error.message);
  }
}

async function testGETList() {
  console.log('\n============================================================');
  console.log('TEST 2: GET /api/price-history - 목록 조회');
  console.log('============================================================\n');

  try {
    const response = await fetch(`${BASE_URL}/api/price-history?item_id=${testItemId}`);
    const data = await response.json();

    if (response.ok && data.success) {
      logTest('GET List: 목록 조회 성공', true, `${data.data.length}개 항목`);

      // 방금 생성한 데이터가 포함되어 있는지 확인
      const found = data.data.find(item => item.price_history_id === createdPriceHistoryId);
      logTest('GET List: 생성한 데이터 포함 확인', !!found, found ? '찾음' : '없음');

      // price_per_kg와 created_by 컬럼 존재 확인
      if (data.data.length > 0) {
        const hasNewColumns =
          data.data[0].hasOwnProperty('price_per_kg') &&
          data.data[0].hasOwnProperty('created_by');
        logTest('GET List: 새 컬럼 포함 확인', hasNewColumns,
          hasNewColumns ? 'price_per_kg, created_by 존재' : '새 컬럼 없음');
      }
    } else {
      logTest('GET List: 목록 조회 실패', false, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    logTest('GET List: 요청 실패', false, error.message);
  }
}

async function testGETById() {
  console.log('\n============================================================');
  console.log('TEST 3: GET /api/price-history/[id] - 상세 조회');
  console.log('============================================================\n');

  if (!createdPriceHistoryId) {
    logTest('GET ById: 테스트 건너뜀', false, 'POST에서 ID를 받지 못함');
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/price-history/${createdPriceHistoryId}`);
    const data = await response.json();

    if (response.ok && data.success) {
      logTest('GET ById: 상세 조회 성공', true, `ID: ${data.data.price_history_id}`);

      // 데이터 검증 (숫자형 비교)
      const isValid =
        data.data.price_history_id === createdPriceHistoryId &&
        data.data.item_id === testItemId &&
        data.data.price_per_kg === 50 &&
        data.data.created_by === 'test_user';

      logTest('GET ById: 데이터 검증', isValid, JSON.stringify(data.data, null, 2));
    } else {
      logTest('GET ById: 상세 조회 실패', false, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    logTest('GET ById: 요청 실패', false, error.message);
  }
}

async function testPUT() {
  console.log('\n============================================================');
  console.log('TEST 4: PUT /api/price-history/[id] - 단가 수정');
  console.log('============================================================\n');

  if (!createdPriceHistoryId) {
    logTest('PUT: 테스트 건너뜀', false, 'POST에서 ID를 받지 못함');
    return;
  }

  const updateData = {
    unit_price: 5500.00,
    price_per_kg: 55.00,  // 수정
    note: 'API 테스트용 단가 (수정됨)',
    created_by: 'test_user_modified'  // 수정
  };

  try {
    const response = await fetch(`${BASE_URL}/api/price-history/${createdPriceHistoryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      logTest('PUT: 단가 수정 성공', true, `ID: ${createdPriceHistoryId}`);

      // 수정된 데이터 검증 (숫자형 비교)
      const isValid =
        data.data.unit_price === 5500 &&
        data.data.price_per_kg === 55 &&
        data.data.created_by === 'test_user_modified';

      logTest('PUT: 수정 데이터 검증', isValid, JSON.stringify(data.data, null, 2));
    } else {
      logTest('PUT: 단가 수정 실패', false, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    logTest('PUT: 요청 실패', false, error.message);
  }
}

async function testDELETE() {
  console.log('\n============================================================');
  console.log('TEST 5: DELETE /api/price-history/[id] - 단가 삭제');
  console.log('============================================================\n');

  if (!createdPriceHistoryId) {
    logTest('DELETE: 테스트 건너뜀', false, 'POST에서 ID를 받지 못함');
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/price-history/${createdPriceHistoryId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (response.ok && data.success) {
      logTest('DELETE: 단가 삭제 성공', true, `ID: ${createdPriceHistoryId}`);

      // 삭제 확인 (GET 요청으로 404 확인)
      const checkResponse = await fetch(`${BASE_URL}/api/price-history/${createdPriceHistoryId}`);
      const checkData = await checkResponse.json();

      const isDeleted = !checkResponse.ok || !checkData.success;
      logTest('DELETE: 삭제 확인', isDeleted, isDeleted ? '데이터 없음 확인' : '아직 존재함');
    } else {
      logTest('DELETE: 단가 삭제 실패', false, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    logTest('DELETE: 요청 실패', false, error.message);
  }
}

async function runAllTests() {
  console.log('============================================================');
  console.log('Phase P3 Wave 1 Task 1.4: Price History API 테스트');
  console.log('============================================================');
  console.log(`테스트 대상: ${BASE_URL}`);
  console.log(`시작 시간: ${new Date().toLocaleString('ko-KR')}\n`);

  // 순차적으로 테스트 실행
  await testPOST();
  await testGETList();
  await testGETById();
  await testPUT();
  await testDELETE();

  // 최종 결과 출력
  console.log('\n============================================================');
  console.log('테스트 결과 요약');
  console.log('============================================================');
  console.log(`총 테스트: ${results.total}`);
  console.log(`✅ 성공: ${results.passed}`);
  console.log(`❌ 실패: ${results.failed}`);
  console.log(`성공률: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('============================================================\n');

  if (results.failed > 0) {
    console.log('실패한 테스트:');
    results.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`  - ${t.name}: ${t.details}`));
    console.log('');
  }

  console.log(`종료 시간: ${new Date().toLocaleString('ko-KR')}\n`);

  // 테스트 실패 시 exit code 1
  process.exit(results.failed > 0 ? 1 : 0);
}

// 테스트 실행
runAllTests().catch(error => {
  console.error('테스트 실행 중 오류:', error);
  process.exit(1);
});
