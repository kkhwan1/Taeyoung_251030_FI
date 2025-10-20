# Phase P5: Frontend UI 작업 가이드 (Cursor AI용)

## ✅ Backend 상태
**완료**: `/api/price-analysis/trends` API 이미 구현됨 (379줄)
- 위치: `src/app/api/price-analysis/trends/route.ts`
- 기능: 가격 추세 분석 + 예측 (linear regression)
- 캐싱: In-memory cache (60s TTL)

## 🎯 Frontend 작업 범위

### 필수 작업 (2-3시간)

#### 1. TrendChart 컴포넌트 생성 (~100줄)
**파일**: `src/components/charts/TrendChart.tsx`

**요구사항**:
- Recharts `LineChart` 사용
- Props 인터페이스:
```typescript
interface TrendChartProps {
  data: Array<{
    period: string;
    price: number;
    change_pct: number;
  }>;
  itemName?: string;
  height?: number;
}
```

**기능**:
- X축: period (날짜)
- Y축: price (가격)
- 툴팁: 날짜, 가격, 변동률(%) 표시
- 반응형 디자인
- 기본 높이: 300px

**참고 컴포넌트**:
- 기존 차트가 있다면 패턴 참고
- shadcn/ui Card 컴포넌트로 감싸기

**코드 예시**:
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function TrendChart({ data, itemName, height = 300 }: TrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{itemName ? `${itemName} 가격 추세` : '가격 추세'}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload?.[0]) {
                  return (
                    <div className="bg-white p-2 border rounded shadow">
                      <p>{payload[0].payload.period}</p>
                      <p className="font-bold">가격: {payload[0].value?.toLocaleString('ko-KR')}원</p>
                      <p className={payload[0].payload.change_pct >= 0 ? 'text-green-600' : 'text-red-600'}>
                        변동: {payload[0].payload.change_pct}%
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

---

#### 2. price-analysis 페이지 생성 (~150줄)
**파일**: `src/app/price-analysis/page.tsx`

**요구사항**:
- 품목 선택 드롭다운 (items 테이블에서 조회)
- 기간 선택 버튼 (7일 / 30일 / 90일)
- TrendChart 표시
- 통계 요약 테이블

**레이아웃**:
```
┌─────────────────────────────────────┐
│  품목 선택: [드롭다운]              │
│  기간: [7일] [30일] [90일]          │
├─────────────────────────────────────┤
│  통계                                │
│  - 평균 가격: 15,000원              │
│  - 최소/최대: 14,000 / 16,000원     │
│  - 변동성: 5.2%                     │
│  - 추세: 상승                        │
├─────────────────────────────────────┤
│  [TrendChart 컴포넌트]              │
└─────────────────────────────────────┘
```

**API 호출 예시**:
```typescript
const fetchTrends = async (itemId: number, days: number) => {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const res = await fetch(
    `/api/price-analysis/trends?item_id=${itemId}&start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate}&granularity=day`
  );

  const json = await res.json();
  return json.data;
};
```

**상태 관리**:
```typescript
'use client';

import { useState, useEffect } from 'react';
import { TrendChart } from '@/components/charts/TrendChart';

export default function PriceAnalysisPage() {
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [days, setDays] = useState(30);
  const [trendData, setTrendData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedItem) {
      loadTrends();
    }
  }, [selectedItem, days]);

  // ... 구현
}
```

---

#### 3. 통합 테스트 작성 (~80줄)
**파일**: `src/__tests__/api/price-analysis-trends.test.ts`

**테스트 케이스**:
```typescript
describe('Price Trends Analysis API', () => {
  it('should return trends for specific item', async () => {
    const response = await fetch('/api/price-analysis/trends?item_id=1&days=30');
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.time_series).toBeDefined();
    expect(json.data.statistics.trend).toMatch(/RISING|FALLING|STABLE/);
  });

  it('should handle invalid days parameter', async () => {
    const response = await fetch('/api/price-analysis/trends?item_id=1&days=999');
    const json = await response.json();

    expect(json.success).toBe(false);
  });

  it('should return empty data for item without history', async () => {
    const response = await fetch('/api/price-analysis/trends?item_id=99999&days=30');
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.chart_data).toHaveLength(0);
  });
});
```

---

## 📋 체크리스트

**Cursor AI 작업**:
- [ ] TrendChart 컴포넌트 생성 (`src/components/charts/TrendChart.tsx`)
- [ ] price-analysis 페이지 생성 (`src/app/price-analysis/page.tsx`)
- [ ] 통합 테스트 작성 (`src/__tests__/api/price-analysis-trends.test.ts`)

**선택 사항 (시간 있으면)**:
- [ ] 대시보드에 미니 위젯 추가
- [ ] 예측 기능 활성화 (`include_forecast=true`)

---

## 🚀 실행 순서

1. **TrendChart 먼저 생성** (독립 컴포넌트)
2. **price-analysis 페이지 생성** (TrendChart import)
3. **테스트 작성** (API 동작 검증)

---

## 📌 주의사항

1. **한글 인코딩**: 품목명 표시 시 한글 깨짐 없도록
2. **로딩 상태**: API 호출 시 로딩 스피너 표시
3. **에러 처리**: API 실패 시 사용자 친화적 메시지
4. **반응형**: 모바일에서도 차트 정상 표시

---

## 🎯 완료 기준

✅ TrendChart가 가격 데이터를 정상 표시
✅ 품목 선택 시 차트 업데이트
✅ 기간 변경 시 차트 업데이트
✅ 통계 정보 정확히 표시
✅ 테스트 3개 모두 통과

---

**예상 작업 시간**: 2-3시간 (컴포넌트 1h + 페이지 1h + 테스트 30분)
