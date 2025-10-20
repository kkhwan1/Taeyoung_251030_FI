# Price Trend Analysis API Documentation

## Overview

가격 트렌드 분석 API는 품목별 가격 시계열 데이터를 분석하고 선형 회귀를 사용한 예측 기능을 제공합니다. 일/주/월 단위 집계와 통계 분석, 3기간 예측을 지원합니다.

**Base URL**: `/api/price-analysis/trends`
**Version**: 1.0
**Last Updated**: 2025-01-17

---

## Endpoints

### GET /api/price-analysis/trends

품목의 가격 트렌드를 분석하고 통계 및 예측 데이터를 반환합니다.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| item_id | number | No | All items | 분석할 품목 ID |
| start_date | string | No | 12 months ago | 시작 날짜 (YYYY-MM-DD) |
| end_date | string | No | Today | 종료 날짜 (YYYY-MM-DD) |
| granularity | string | No | month | 집계 단위 (day\|week\|month) |
| include_forecast | boolean | No | false | 예측 포함 여부 (true\|false) |

#### Response Structure

```typescript
interface TrendAnalysisResponse {
  success: boolean;
  data: {
    item_id: number | null;
    item_name: string | null;
    item_code: string | null;
    category: string | null;
    time_series: TimeSeries[];
    statistics: Statistics;
    forecast: Forecast[];
    metadata: Metadata;
  };
}

interface TimeSeries {
  period: string;           // "2025-01", "2025-W02", "2025-01-15"
  price: number;            // 평균 가격
  change_pct: number;       // 전기 대비 변동률 (%)
  record_count: number;     // 해당 기간 데이터 포인트 수
}

interface Statistics {
  avg_price: number;        // 평균 가격
  min_price: number;        // 최소 가격
  max_price: number;        // 최대 가격
  volatility: number;       // 변동성 (표준편차)
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface Forecast {
  period: string;           // 예측 기간
  predicted_price: number;  // 예측 가격
  confidence: 'high' | 'medium' | 'low';  // 신뢰도
}

interface Metadata {
  start_date: string;
  end_date: string;
  granularity: string;
  total_periods: number;    // 시계열 데이터 포인트 수
  data_points: number;      // 원본 데이터 레코드 수
}
```

#### Response Examples

**Example 1: Monthly Trend with Forecast**

Request:
```
GET /api/price-analysis/trends?item_id=48&granularity=month&include_forecast=true
```

Response:
```json
{
  "success": true,
  "data": {
    "item_id": 48,
    "item_name": "CAP NUT M8",
    "item_code": "PN-48",
    "category": "Parts",
    "time_series": [
      {
        "period": "2024-02",
        "price": 450.0,
        "change_pct": 0,
        "record_count": 3
      },
      {
        "period": "2024-03",
        "price": 468.0,
        "change_pct": 4.0,
        "record_count": 2
      },
      {
        "period": "2024-04",
        "price": 486.0,
        "change_pct": 3.8,
        "record_count": 4
      }
    ],
    "statistics": {
      "avg_price": 468.0,
      "min_price": 450.0,
      "max_price": 486.0,
      "volatility": 15.23,
      "trend": "increasing"
    },
    "forecast": [
      {
        "period": "2024-05",
        "predicted_price": 504.0,
        "confidence": "high"
      },
      {
        "period": "2024-06",
        "predicted_price": 522.0,
        "confidence": "medium"
      },
      {
        "period": "2024-07",
        "predicted_price": 540.0,
        "confidence": "low"
      }
    ],
    "metadata": {
      "start_date": "2024-01-01",
      "end_date": "2025-01-17",
      "granularity": "month",
      "total_periods": 3,
      "data_points": 9
    }
  }
}
```

**Example 2: Daily Trend without Forecast**

Request:
```
GET /api/price-analysis/trends?item_id=48&start_date=2025-01-01&end_date=2025-01-31&granularity=day
```

Response:
```json
{
  "success": true,
  "data": {
    "item_id": 48,
    "item_name": "CAP NUT M8",
    "item_code": "PN-48",
    "category": "Parts",
    "time_series": [
      {
        "period": "2025-01-05",
        "price": 450.0,
        "change_pct": 0,
        "record_count": 1
      },
      {
        "period": "2025-01-12",
        "price": 455.0,
        "change_pct": 1.1,
        "record_count": 2
      }
    ],
    "statistics": {
      "avg_price": 452.5,
      "min_price": 450.0,
      "max_price": 455.0,
      "volatility": 2.5,
      "trend": "stable"
    },
    "forecast": [],
    "metadata": {
      "start_date": "2025-01-01",
      "end_date": "2025-01-31",
      "granularity": "day",
      "total_periods": 2,
      "data_points": 3
    }
  }
}
```

**Example 3: No Data**

Response:
```json
{
  "success": true,
  "data": {
    "item_id": 999,
    "item_name": null,
    "time_series": [],
    "statistics": {
      "avg_price": 0,
      "min_price": 0,
      "max_price": 0,
      "volatility": 0,
      "trend": "stable"
    },
    "forecast": [],
    "metadata": {
      "start_date": "2024-01-17",
      "end_date": "2025-01-17",
      "granularity": "month",
      "total_periods": 0,
      "data_points": 0
    }
  }
}
```

#### Performance

- **Typical Response Time**: 120-200ms (basic query)
- **Complex Query with Forecast**: 200-350ms
- **Database Optimization**: Composite indexes on (item_id, price_month)
- **Threshold Compliance**: 100% (<500ms for complex queries)

---

## Algorithm Details

### 1. Linear Regression Forecasting

예측은 단순 선형 회귀를 사용합니다:

**Formula**: `y = mx + b`

```typescript
function linearRegression(xValues: number[], yValues: number[]) {
  const n = xValues.length;

  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}
```

**Example**:
- Historical prices: [450, 468, 486]
- X values: [0, 1, 2]
- Y values: [450, 468, 486]
- Slope: 18
- Intercept: 450
- Next prediction: 450 + 18 * 3 = 504

### 2. Confidence Calculation

신뢰도는 데이터 일관성을 기반으로 계산됩니다:

```typescript
function calculateConfidence(prices: number[], predicted: number) {
  if (prices.length < 3) return 'low';

  // 1. Calculate coefficient of variation (CV)
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, price) =>
    sum + Math.pow(price - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const CV = stdDev / mean;

  // 2. Calculate prediction deviation from recent trend
  const recentPrices = prices.slice(-3);
  const recentMean = recentPrices.reduce((a, b) => a + b, 0) / 3;
  const deviation = Math.abs(predicted - recentMean) / recentMean;

  // 3. Determine confidence level
  if (CV < 0.05 && deviation < 0.1) return 'high';   // Very stable
  if (CV < 0.15 && deviation < 0.2) return 'medium'; // Moderately stable
  return 'low';                                        // Volatile
}
```

**Confidence Thresholds**:
- **high**: CV < 5% AND deviation < 10%
- **medium**: CV < 15% AND deviation < 20%
- **low**: Otherwise

### 3. Trend Detection

트렌드 방향은 전체 기간 변동률로 결정:

```typescript
const firstPrice = timeSeries[0].price;
const lastPrice = timeSeries[timeSeries.length - 1].price;
const overallChange = ((lastPrice - firstPrice) / firstPrice) * 100;

let trend: 'increasing' | 'decreasing' | 'stable';

if (overallChange > 5) {
  trend = 'increasing';       // 5% 이상 상승
} else if (overallChange < -5) {
  trend = 'decreasing';       // 5% 이상 하락
} else {
  trend = 'stable';           // -5% ~ +5% 범위
}
```

### 4. Period Formatting

**Day Granularity**:
```typescript
// Output: "2025-01-15"
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
return `${year}-${month}-${day}`;
```

**Week Granularity** (ISO 8601):
```typescript
// Output: "2025-W03"
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

const weekNum = getWeekNumber(date);
return `${year}-W${String(weekNum).padStart(2, '0')}`;
```

**Month Granularity**:
```typescript
// Output: "2025-01"
return `${year}-${month}`;
```

---

## Frontend Integration

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface TrendAnalysisParams {
  itemId?: number;
  startDate?: string;
  endDate?: string;
  granularity?: 'day' | 'week' | 'month';
  includeForecast?: boolean;
}

function usePriceTrends(params: TrendAnalysisParams) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTrends = async () => {
    try {
      setLoading(true);

      const queryParams = new URLSearchParams();
      if (params.itemId) queryParams.append('item_id', params.itemId.toString());
      if (params.startDate) queryParams.append('start_date', params.startDate);
      if (params.endDate) queryParams.append('end_date', params.endDate);
      if (params.granularity) queryParams.append('granularity', params.granularity);
      if (params.includeForecast) queryParams.append('include_forecast', 'true');

      const response = await fetch(
        `/api/price-analysis/trends?${queryParams.toString()}`
      );
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('트렌드 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [
    params.itemId,
    params.startDate,
    params.endDate,
    params.granularity,
    params.includeForecast
  ]);

  return { data, loading, error, refetch: fetchTrends };
}

export default usePriceTrends;
```

### Chart Component Example (with Chart.js)

```typescript
import { Line } from 'react-chartjs-2';
import usePriceTrends from './usePriceTrends';

function PriceTrendChart({ itemId }: { itemId: number }) {
  const { data, loading, error } = usePriceTrends({
    itemId,
    granularity: 'month',
    includeForecast: true
  });

  if (loading) return <div>차트 로딩 중...</div>;
  if (error) return <div>에러: {error}</div>;
  if (!data || data.time_series.length === 0) {
    return <div>데이터가 없습니다.</div>;
  }

  const chartData = {
    labels: [
      ...data.time_series.map(ts => ts.period),
      ...data.forecast.map(f => f.period)
    ],
    datasets: [
      {
        label: '실제 가격',
        data: data.time_series.map(ts => ts.price),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      },
      {
        label: '예측 가격',
        data: [
          ...Array(data.time_series.length - 1).fill(null),
          data.time_series[data.time_series.length - 1].price,
          ...data.forecast.map(f => f.predicted_price)
        ],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderDash: [5, 5],
        tension: 0.1
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: `${data.item_name} 가격 트렌드`
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `${context.dataset.label}: ₩${context.parsed.y.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: (value) => `₩${value.toLocaleString()}`
        }
      }
    }
  };

  return (
    <div>
      <Line data={chartData} options={options} />

      <div className="statistics">
        <h3>통계</h3>
        <p>평균 가격: ₩{data.statistics.avg_price.toLocaleString()}</p>
        <p>최소/최대: ₩{data.statistics.min_price.toLocaleString()} / ₩{data.statistics.max_price.toLocaleString()}</p>
        <p>변동성: {data.statistics.volatility.toFixed(2)}</p>
        <p>트렌드: {
          data.statistics.trend === 'increasing' ? '상승 📈' :
          data.statistics.trend === 'decreasing' ? '하락 📉' :
          '안정 ➡️'
        }</p>
      </div>
    </div>
  );
}

export default PriceTrendChart;
```

---

## Error Codes

| HTTP Status | Error Type | Description | Solution |
|-------------|------------|-------------|----------|
| 400 | VALIDATION_FAILED | 쿼리 파라미터 검증 실패 | details 필드 확인 |
| 500 | DATABASE_ERROR | 데이터베이스 쿼리 실패 | 서버 로그 확인 |
| 500 | INTERNAL_ERROR | 서버 내부 오류 | 서버 로그 확인 |

---

## Best Practices

### 1. Granularity Selection

```typescript
// Choose appropriate granularity based on date range
function selectGranularity(startDate: Date, endDate: Date): string {
  const days = Math.abs((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  if (days <= 31) return 'day';    // 1 month or less
  if (days <= 180) return 'week';  // 6 months or less
  return 'month';                  // More than 6 months
}
```

### 2. Forecast Interpretation

```typescript
function interpretForecast(forecast: Forecast[]): string {
  const highConfidence = forecast.filter(f => f.confidence === 'high').length;
  const totalForecasts = forecast.length;

  if (highConfidence === totalForecasts) {
    return '예측 신뢰도가 높습니다. 안정적인 트렌드가 예상됩니다.';
  } else if (highConfidence > 0) {
    return '예측 신뢰도가 중간 수준입니다. 단기 예측은 신뢰할 수 있습니다.';
  } else {
    return '예측 신뢰도가 낮습니다. 가격 변동성이 높아 참고용으로만 활용하세요.';
  }
}
```

### 3. Cache Strategy

```typescript
// Cache trends data for 15 minutes
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

const cache = new Map();

function getCachedTrends(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedTrends(key: string, data: any) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}
```

### 4. Performance Optimization

```typescript
// Batch multiple trend requests
async function fetchMultipleTrends(itemIds: number[]) {
  const promises = itemIds.map(itemId =>
    fetch(`/api/price-analysis/trends?item_id=${itemId}&granularity=month`)
      .then(res => res.json())
  );

  const results = await Promise.all(promises);
  return results;
}
```

---

## Database Schema

### item_price_history Table

```sql
CREATE TABLE item_price_history (
  price_history_id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  price_month DATE NOT NULL,
  unit_price NUMERIC(15,2) NOT NULL,
  price_per_kg NUMERIC(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_item_price_history_item_id ON item_price_history(item_id);
CREATE INDEX idx_item_price_history_price_month ON item_price_history(price_month);
CREATE INDEX idx_item_price_history_composite ON item_price_history(item_id, price_month);
```

---

## Performance Metrics

### Response Time Targets

| Query Type | Target | Actual (P50) | Actual (P95) | Compliance |
|------------|--------|--------------|--------------|------------|
| Basic Query (no forecast) | <200ms | 133ms | 200ms | ✅ 100% |
| Complex Query (with forecast) | <500ms | 269ms | 496ms | ✅ 100% |
| Concurrent Load (10 requests) | <500ms | 463ms | 496ms | ✅ 100% |

### Load Test Results

```
Performance Test Results (2025-01-17):
- Concurrent Complex Queries: 10 requests
- Success Rate: 100%
- Average Duration: 451.20ms
- P50: 463ms | P95: 496ms | P99: 496ms
- Threshold Compliance: 100% (<500ms)
```

---

## Testing

### Unit Test Example

```typescript
describe('Price Trend Analysis API', () => {
  it('should calculate linear regression correctly', () => {
    const xValues = [0, 1, 2];
    const yValues = [450, 468, 486];

    const { slope, intercept } = linearRegression(xValues, yValues);

    expect(slope).toBeCloseTo(18, 1);
    expect(intercept).toBeCloseTo(450, 1);
  });

  it('should generate 3-period forecast', async () => {
    const response = await fetch(
      '/api/price-analysis/trends?item_id=48&include_forecast=true'
    );
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.forecast).toHaveLength(3);
    expect(data.data.forecast[0]).toHaveProperty('predicted_price');
    expect(data.data.forecast[0]).toHaveProperty('confidence');
  });

  it('should handle no data gracefully', async () => {
    const response = await fetch(
      '/api/price-analysis/trends?item_id=999'
    );
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.time_series).toHaveLength(0);
    expect(data.data.statistics.avg_price).toBe(0);
  });
});
```

---

## Related Documentation

- [Notifications API](./notifications-api.md)
- [Preferences API](./preferences-api.md)
- [Database Schema](./../supabase/migrations/)

---

**Last Updated**: 2025-01-17
**API Version**: 1.0
**Status**: Production Ready
