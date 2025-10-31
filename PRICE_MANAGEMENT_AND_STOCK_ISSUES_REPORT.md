# 월별 단가 관리 및 재고 현황 페이지 문제 진단 보고서

## 작성일시
2025-01-20

## 발견된 문제

### 1. 월별 단가 관리 페이지 (`/price-management`)

**증상:**
- "데이터를 불러오는 중..." 메시지가 계속 표시됨
- 페이지가 로딩 상태에서 멈춤

**원인 분석:**

#### API 엔드포인트 확인
- `/api/price-history?month=2025-01`: ✅ 정상 동작 (718개 품목 반환)
- `/api/bom/cost/batch`: ✅ 정상 동작 (단일 품목 테스트 성공)

#### 프론트엔드 로직 분석
```85:148:src/app/price-management/page.tsx
  const fetchPriceHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/price-history?month=${selectedMonth}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch price history: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.success) {
        const items = result.data || [];
        
        // 1. 모든 item_id 추출
        const itemIds = items.map((item: PriceHistoryItem) => item.item_id);
        
        // 2. 배치 BOM 원가 조회 (단일 요청)
        let bomCostMap: { [key: number]: any } = {};
        if (itemIds.length > 0) {
          try {
            const bomResponse = await fetch('/api/bom/cost/batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                item_ids: itemIds,
                price_month: selectedMonth
              })
            });
            
            if (bomResponse.ok) {
              const bomResult = await bomResponse.json();
              bomCostMap = bomResult.data || {};
              console.log(`Batch BOM cost loaded: ${Object.keys(bomCostMap).length} items`);
            }
          } catch (err) {
            console.warn('Failed to fetch batch BOM cost:', err);
          }
        }
        
        // 3. 결과 매핑
        const dataWithBomCost = items.map((item: PriceHistoryItem) => {
          const bomData = bomCostMap[item.item_id];
          return {
            ...item,
            bom_cost: bomData?.cost_breakdown?.net_cost || 0,
            has_bom: bomData?.has_bom || false,
            bom_cost_breakdown: bomData?.cost_breakdown
          };
        });
        
        setPriceHistory(dataWithBomCost);
        calculateSummaryStats(dataWithBomCost);
      } else {
        throw new Error(result.error || 'Failed to fetch price history');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching price history';
      setError(errorMessage);
      console.error('Error fetching price history:', err);
    } finally {
      setLoading(false);
    }
  };
```

**문제점:**
1. **대량 데이터 처리**: 718개 품목에 대해 BOM cost 배치 API 호출 시 매우 오래 걸릴 수 있음
2. **타임아웃 가능성**: 배치 API가 718개 품목을 처리하는 데 시간이 오래 걸려 프론트엔드에서 타임아웃 발생 가능
3. **에러 처리 부족**: BOM cost API 호출이 실패해도 에러가 무시되고 있으나, 응답이 오지 않으면 무한 대기 가능

**해결 방안:**
1. **타임아웃 추가**: BOM cost 배치 API 호출에 타임아웃 설정
2. **에러 처리 개선**: BOM cost API 실패 시에도 기본 데이터 표시
3. **점진적 로딩**: BOM cost가 있는 품목만 별도로 로드하거나, lazy loading 적용
4. **배치 크기 제한**: 한 번에 처리하는 품목 수를 제한 (예: 100개씩)

---

### 2. 재고 현황 페이지 (`/stock`)

**증상:**
- 초기 로딩 시 "Failed to fetch" 오류 발생
- 재시도 로직으로 인해 정상 작동하지만, 원인 확인 필요

**원인 분석:**

#### API 엔드포인트 확인
- `/api/stock`: ✅ 정상 동작 (731개 품목 반환)

#### 프론트엔드 로직 분석
```91:140:src/app/stock/page.tsx
  const fetchStockItems = async (showLoading = true, retryCount = 0) => {
    const MAX_RETRIES = 3;
    if (showLoading) {
    setLoading(true);
    }
    try {
      const response = await fetch('/api/stock', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        setStockItems(result.data);
      } else {
        // 응답 구조가 예상과 다를 때만 오류 처리
        if (showLoading) {
          console.warn('재고 조회 응답 구조 이상:', result);
        }
        // 기존 데이터 유지 (빈 배열로 리셋하지 않음)
      }
    } catch (error) {
      console.error('재고 조회 오류:', error);
      
      // 재시도 로직 (최대 3회, 1초 간격)
      if (retryCount < MAX_RETRIES && error instanceof TypeError) {
        console.log(`재고 조회 재시도 ${retryCount + 1}/${MAX_RETRIES}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchStockItems(showLoading, retryCount + 1);
      }

      // 최종 실패 시 사용자 알림은 showLoading이 true일 때만
      if (showLoading) {
        alert('재고 조회 중 오류가 발생했습니다. 페이지를 새로고침해주세요.');
      }
      // 주기적 업데이트 실패 시에는 기존 데이터 유지
    } finally {
      if (showLoading) {
      setLoading(false);
      }
    }
  };
```

**문제점:**
1. **초기 네트워크 지연**: 페이지 로드 직후 API 호출 시 네트워크 준비가 완료되지 않았을 수 있음
2. **재시도 로직 제한**: `TypeError`만 재시도하므로 다른 네트워크 오류는 재시도되지 않음
3. **에러 원인 불명확**: 초기 오류의 정확한 원인 파악 필요

**해결 방안:**
1. **초기 로딩 지연**: `useEffect`에 약간의 지연 추가 (예: 100ms)
2. **재시도 로직 개선**: 모든 네트워크 오류에 대해 재시도 적용
3. **에러 로깅**: 오류 발생 시 상세 정보를 콘솔에 기록하여 원인 파악
4. **로딩 상태 개선**: 재시도 중임을 사용자에게 표시

---

## 권장 조치 사항

### 우선순위 1: 월별 단가 관리 페이지
1. BOM cost 배치 API 호출에 타임아웃 추가
2. BOM cost 로딩 실패 시에도 기본 데이터 표시
3. 배치 크기 제한 (100개씩 나누어 처리)

### 우선순위 2: 재고 현황 페이지
1. 초기 로딩 지연 추가
2. 재시도 로직 개선 (모든 네트워크 오류 재시도)
3. 에러 로깅 강화

---

## 테스트 결과

### API 엔드포인트 테스트
- ✅ `/api/price-history?month=2025-01`: 718개 품목 반환 성공
- ✅ `/api/bom/cost/batch`: 단일 배치 처리 성공
- ✅ `/api/stock`: 731개 품목 반환 성공

### 프론트엔드 로직 테스트
- ⚠️ 월별 단가 관리: 대량 데이터 처리 시 성능 저하 가능
- ⚠️ 재고 현황: 초기 로딩 시 간헐적 오류 발생

---

## 참고사항
- 모든 API 엔드포인트는 정상 작동 중
- 문제는 프론트엔드의 대량 데이터 처리 및 네트워크 타이밍 이슈로 판단됨
- 인증 쿠키(`cookies.txt`)를 사용한 테스트에서 모든 API가 정상 응답

