# Phase P3: 월별 단가 관리 MVP (6시간 구축 계획)

## 📋 MVP 범위 정의

**핵심 목표**: 품목별 월별 단가 이력 관리 기본 기능만 구현

### ✅ MVP에 포함되는 기능 (Core Only)
1. **월별 단가 저장**: 품목별로 특정 월의 단가 기록
2. **월별 단가 조회**: 선택한 월의 모든 품목 단가 조회
3. **단가 수정**: 기존 단가 업데이트
4. **재고 금액 계산**: 현재 재고 × 월별 단가 = 재고 금액

### ❌ MVP에서 제외되는 기능 (Phase 2로 이월)
- Excel 가져오기/내보내기
- 재고 금액 대시보드 (차트, 그래프)
- 월별 정리 보드 (업체별/카테고리별 집계)
- 트렌드 분석 및 예측
- PostgreSQL views/functions (최적화)
- 고급 유틸리티 라이브러리
- 자동화된 E2E 테스트 (수동 테스트만)

---

## ⚡ 6시간 병렬 실행 전략

### 타임라인 개요

| 시간 | Agent | 병렬 작업 | 산출물 |
|------|-------|----------|--------|
| **0-2h** | supabase-schema-architect | DB 마이그레이션 생성 및 적용 | `item_price_history` 테이블 |
| **0-2h** | backend-architect (parallel) | API 2개 구현 | POST/GET `/api/price-history` |
| **0-2h** | frontend-developer (parallel) | UI 페이지 구현 | `/price-management` 페이지 |
| **2-4h** | All agents | API-UI 통합 및 버그 수정 | 통합 완료 |
| **4-6h** | Manual testing | 수동 테스트 및 프로덕션 배포 | 배포 완료 |

### 병렬 실행 포인트
- **Hour 0-2**: 3명의 에이전트가 **독립적으로** 동시 작업
  - DB 스키마는 API/UI와 독립적
  - API는 DB 스키마만 필요 (TypeScript 타입 자동 생성)
  - UI는 API 스펙만 필요 (mock 데이터로 개발 가능)
- **Hour 2-4**: 통합 단계에서 협업
- **Hour 4-6**: 최종 검증 및 배포

---

## 🗄️ 1단계: 데이터베이스 (Hour 0-2)

### Agent: `supabase-schema-architect`

### 마이그레이션 파일 생성

**파일**: `supabase/migrations/20250116_mvp_price_history.sql`

```sql
-- ============================================
-- Phase P3 MVP: 월별 단가 관리
-- 목적: 품목별 월별 단가 이력 추적
-- 작성일: 2025-01-16
-- 예상 소요 시간: 1시간
-- ============================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS item_price_history (
  price_history_id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  price_month DATE NOT NULL,  -- 'YYYY-MM-01' 형식 (매월 1일로 통일)
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- 제약 조건: 품목당 월별로 하나의 단가만 존재
  CONSTRAINT unique_item_month UNIQUE (item_id, price_month)
);

-- 2. 인덱스 생성
CREATE INDEX idx_price_month ON item_price_history(price_month DESC);
CREATE INDEX idx_item_price ON item_price_history(item_id, price_month DESC);

-- 3. 코멘트 추가
COMMENT ON TABLE item_price_history IS '품목별 월별 단가 이력 (MVP)';
COMMENT ON COLUMN item_price_history.price_month IS '단가 적용 월 (매월 1일)';
COMMENT ON COLUMN item_price_history.unit_price IS '해당 월의 품목 단가';

-- 4. RLS 정책 (나중에 인증 구현 시)
-- ALTER TABLE item_price_history ENABLE ROW LEVEL SECURITY;
```

### 적용 방법

```bash
# Supabase MCP를 통한 마이그레이션 적용
npm run migrate:up

# 또는 Supabase CLI
npx supabase db push
```

### 검증 쿼리

```sql
-- 테이블 존재 확인
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name = 'item_price_history';

-- 인덱스 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'item_price_history';

-- 제약 조건 확인
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'item_price_history'::regclass;
```

---

## 🔌 2단계: API 구현 (Hour 0-2)

### Agent: `backend-architect`

### 파일 생성: `src/app/api/price-history/route.ts`

```typescript
/**
 * Phase P3 MVP: 월별 단가 관리 API
 *
 * 엔드포인트:
 * - POST /api/price-history - 단가 등록/수정 (UPSERT)
 * - GET /api/price-history?month=YYYY-MM - 월별 단가 조회
 *
 * 작성일: 2025-01-16
 * 예상 소요 시간: 1.5시간
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * POST /api/price-history
 *
 * Request Body:
 * {
 *   item_id: number;
 *   price_month: string;  // 'YYYY-MM' 형식
 *   unit_price: number;
 *   note?: string;
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   data?: PriceHistory;
 *   error?: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ CRITICAL: Korean text handling pattern
    const text = await request.text();
    const body = JSON.parse(text);

    const { item_id, price_month, unit_price, note } = body;

    // 기본 유효성 검증
    if (!item_id || !price_month || unit_price === undefined) {
      return NextResponse.json(
        { success: false, error: '필수 필드 누락: item_id, price_month, unit_price' },
        { status: 400 }
      );
    }

    // 월 형식 변환: 'YYYY-MM' → 'YYYY-MM-01'
    const formattedMonth = `${price_month}-01`;

    // UPSERT: 같은 품목+월이면 업데이트, 없으면 삽입
    const { data, error } = await supabase
      .from('item_price_history')
      .upsert(
        {
          item_id,
          price_month: formattedMonth,
          unit_price,
          note: note || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'item_id,price_month',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('[API] POST /api/price-history failed:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('[API] POST /api/price-history exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/price-history?month=YYYY-MM
 *
 * Query Params:
 * - month: string (optional, default: current month)
 *
 * Response:
 * {
 *   success: boolean;
 *   data?: Array<{
 *     price_history_id: number;
 *     item_id: number;
 *     price_month: string;
 *     unit_price: number;
 *     note: string;
 *     created_at: string;
 *     updated_at: string;
 *     items: {
 *       item_code: string;
 *       item_name: string;
 *       spec: string;
 *       current_stock: number;
 *       unit_price: number;  // 기존 단가
 *     }
 *   }>;
 *   error?: string;
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

    // 월 형식 변환: 'YYYY-MM' → 'YYYY-MM-01'
    const formattedMonth = `${month}-01`;

    const { data, error } = await supabase
      .from('item_price_history')
      .select(`
        price_history_id,
        item_id,
        price_month,
        unit_price,
        note,
        created_at,
        updated_at,
        items (
          item_code,
          item_name,
          spec,
          current_stock,
          unit_price
        )
      `)
      .eq('price_month', formattedMonth)
      .order('item_id', { ascending: true });

    if (error) {
      console.error('[API] GET /api/price-history failed:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error: any) {
    console.error('[API] GET /api/price-history exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류' },
      { status: 500 }
    );
  }
}
```

### API 테스트 (수동)

```bash
# 1. 단가 등록
curl -X POST http://localhost:5000/api/price-history \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 1,
    "price_month": "2025-01",
    "unit_price": 15000,
    "note": "1월 단가"
  }'

# 2. 월별 조회
curl http://localhost:5000/api/price-history?month=2025-01

# 3. 단가 수정 (같은 item_id + month)
curl -X POST http://localhost:5000/api/price-history \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 1,
    "price_month": "2025-01",
    "unit_price": 16000,
    "note": "1월 단가 수정"
  }'
```

---

## 🎨 3단계: 프론트엔드 UI (Hour 0-2)

### Agent: `frontend-developer`

### 파일 생성: `src/app/price-management/page.tsx`

```typescript
/**
 * Phase P3 MVP: 월별 단가 관리 페이지
 *
 * 경로: /price-management
 *
 * 기능:
 * 1. 월 선택 (input type="month")
 * 2. 선택한 월의 품목별 단가 조회
 * 3. 인라인 단가 수정
 * 4. 재고 금액 자동 계산 (현재 재고 × 월별 단가)
 *
 * 작성일: 2025-01-16
 * 예상 소요 시간: 1.5시간
 */

'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';

interface PriceItem {
  price_history_id: number;
  item_id: number;
  price_month: string;
  unit_price: number;
  note: string;
  created_at: string;
  updated_at: string;
  items: {
    item_code: string;
    item_name: string;
    spec: string;
    current_stock: number;
    unit_price: number; // 기존 단가
  };
}

export default function PriceManagementPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editNote, setEditNote] = useState('');

  // 월별 단가 조회
  const fetchPrices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/price-history?month=${month}`);
      const data = await res.json();
      if (data.success) {
        setPrices(data.data || []);
      } else {
        alert(`조회 실패: ${data.error}`);
      }
    } catch (error: any) {
      alert(`조회 오류: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 단가 저장
  const handleSave = async (item: PriceItem) => {
    setSaving(true);
    try {
      const res = await fetch('/api/price-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.item_id,
          price_month: month,
          unit_price: parseFloat(editValue),
          note: editNote,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('저장 완료');
        fetchPrices();
        setEditId(null);
        setEditValue('');
        setEditNote('');
      } else {
        alert(`저장 실패: ${data.error}`);
      }
    } catch (error: any) {
      alert(`저장 오류: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 편집 시작
  const handleEdit = (item: PriceItem) => {
    setEditId(item.price_history_id);
    setEditValue(item.unit_price.toString());
    setEditNote(item.note || '');
  };

  // 편집 취소
  const handleCancel = () => {
    setEditId(null);
    setEditValue('');
    setEditNote('');
  };

  // 재고 금액 계산
  const calculateStockValue = (stock: number, price: number) => {
    return (stock * price).toLocaleString('ko-KR');
  };

  // 월 변경 시 자동 조회
  useEffect(() => {
    fetchPrices();
  }, [month]);

  return (
    <MainLayout>
      <div className="p-6 bg-white dark:bg-gray-900 min-h-screen">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 dark:text-white">월별 단가 관리</h1>
          <p className="text-gray-600 dark:text-gray-400">
            품목별 월별 단가를 조회하고 수정할 수 있습니다.
          </p>
        </div>

        {/* 월 선택 */}
        <div className="mb-6 flex items-center gap-4">
          <label className="font-semibold dark:text-white">조회 월:</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={fetchPrices}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                     disabled:bg-gray-400 transition-colors"
          >
            {loading ? '조회 중...' : '조회'}
          </button>
        </div>

        {/* 데이터 테이블 */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">데이터를 불러오는 중...</p>
          </div>
        ) : prices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">
              {month} 월의 단가 데이터가 없습니다.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto shadow-md rounded-lg">
            <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold dark:text-white">품목코드</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold dark:text-white">품목명</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold dark:text-white">규격</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold dark:text-white">현재 재고</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold dark:text-white">기존 단가</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold dark:text-white">
                    {month} 단가
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold dark:text-white">재고 금액</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold dark:text-white">비고</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold dark:text-white">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {prices.map((item) => {
                  const isEditing = editId === item.price_history_id;
                  return (
                    <tr key={item.price_history_id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-3 text-sm dark:text-gray-300">{item.items.item_code}</td>
                      <td className="px-4 py-3 text-sm dark:text-gray-300">{item.items.item_name}</td>
                      <td className="px-4 py-3 text-sm dark:text-gray-300">{item.items.spec || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right dark:text-gray-300">
                        {item.items.current_stock.toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right dark:text-gray-300">
                        ₩{item.items.unit_price.toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full px-2 py-1 border border-blue-500 rounded
                                     bg-white dark:bg-gray-700 text-right
                                     focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() => handleEdit(item)}
                            className="cursor-pointer hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                          >
                            ₩{item.unit_price.toLocaleString('ko-KR')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold dark:text-gray-300">
                        ₩{calculateStockValue(item.items.current_stock, item.unit_price)}
                      </td>
                      <td className="px-4 py-3 text-sm dark:text-gray-300">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="비고 입력"
                            className="w-full px-2 py-1 border border-gray-300 rounded
                                     bg-white dark:bg-gray-700
                                     focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="text-gray-600 dark:text-gray-400">
                            {item.note || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleSave(item)}
                              disabled={saving}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700
                                       disabled:bg-gray-400 transition-colors"
                            >
                              {saving ? '저장 중...' : '저장'}
                            </button>
                            <button
                              onClick={handleCancel}
                              disabled={saving}
                              className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700
                                       disabled:bg-gray-400 transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(item)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700
                                     transition-colors"
                          >
                            수정
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 요약 정보 */}
        {prices.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-gray-800 rounded-lg">
            <h3 className="font-semibold mb-2 dark:text-white">요약</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">총 품목 수:</span>
                <span className="ml-2 font-semibold dark:text-white">{prices.length}개</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">총 재고 금액:</span>
                <span className="ml-2 font-semibold dark:text-white">
                  ₩{prices
                    .reduce((sum, item) => sum + item.items.current_stock * item.unit_price, 0)
                    .toLocaleString('ko-KR')}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">조회 월:</span>
                <span className="ml-2 font-semibold dark:text-white">{month}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
```

### 라우트 추가

**파일**: `src/components/layout/Sidebar.tsx` (네비게이션 추가)

```typescript
// 기존 메뉴 배열에 추가
const menuItems = [
  // ... 기존 메뉴들
  {
    name: '월별 단가 관리',
    path: '/price-management',
    icon: '💰'
  },
];
```

---

## 🔗 4단계: 통합 및 버그 수정 (Hour 2-4)

### Agent: All agents (협업)

### 체크리스트

#### 1. API-DB 연결 확인
- [ ] Supabase 환경 변수 설정 확인 (`.env`)
- [ ] 마이그레이션 적용 완료 확인
- [ ] API 엔드포인트 응답 테스트 (Postman 또는 curl)

#### 2. API-UI 연결 확인
- [ ] 프론트엔드에서 API 호출 성공 확인
- [ ] 네트워크 탭에서 요청/응답 검증
- [ ] CORS 오류 없는지 확인

#### 3. 한글 인코딩 검증
- [ ] 한글 품목명이 정상 표시되는지 확인
- [ ] 한글 비고(note) 저장/조회 테스트
- [ ] `request.text()` + `JSON.parse()` 패턴 사용 확인

#### 4. 예외 처리 검증
- [ ] 필수 필드 누락 시 에러 메시지 확인
- [ ] 잘못된 날짜 형식 입력 시 처리 확인
- [ ] 음수 단가 입력 시 DB 제약 조건 동작 확인

#### 5. UI/UX 개선
- [ ] 로딩 스피너 동작 확인
- [ ] 다크 모드 스타일 확인
- [ ] 반응형 레이아웃 테스트 (모바일/태블릿)

#### 6. 성능 확인
- [ ] 100개 품목 조회 시 렌더링 시간 측정 (<500ms 목표)
- [ ] API 응답 시간 측정 (<200ms 목표)

---

## ✅ 5단계: 수동 테스트 및 배포 (Hour 4-6)

### Agent: Manual testing

### 테스트 시나리오

#### 시나리오 1: 신규 월 단가 등록
1. `/price-management` 페이지 접속
2. 월 선택 (예: 2025-02)
3. 품목 선택 후 "수정" 버튼 클릭
4. 단가 입력 (예: 18000)
5. 비고 입력 (예: "2월 단가")
6. "저장" 버튼 클릭
7. ✅ 성공 메시지 확인
8. ✅ 테이블에서 단가 업데이트 확인

#### 시나리오 2: 기존 단가 수정
1. 같은 품목, 같은 월 선택
2. 단가 수정 (예: 19000)
3. "저장" 버튼 클릭
4. ✅ UPSERT 동작 확인 (새로운 행이 아닌 기존 행 업데이트)

#### 시나리오 3: 다른 월 조회
1. 월 선택 변경 (예: 2025-01)
2. "조회" 버튼 클릭
3. ✅ 해당 월의 단가 데이터만 표시되는지 확인

#### 시나리오 4: 재고 금액 계산 확인
1. 품목의 현재 재고 확인 (예: 100개)
2. 월별 단가 확인 (예: 15000원)
3. ✅ 재고 금액 = 100 × 15000 = 1,500,000원 표시 확인

#### 시나리오 5: 한글 입력 테스트
1. 비고란에 한글 입력 (예: "신규 부품 단가")
2. 저장 후 재조회
3. ✅ 한글이 깨지지 않고 정상 표시되는지 확인

### 배포 전 체크리스트

- [ ] 모든 시나리오 통과
- [ ] 브라우저 콘솔에 에러 없음
- [ ] Network 탭에서 API 호출 성공 (200 OK)
- [ ] DB에 데이터 정상 저장 확인
- [ ] 프로덕션 빌드 성공 (`npm run build`)
- [ ] 프로덕션 환경에서 동작 확인 (`npm run start`)

### 배포 명령어

```bash
# 1. 프로덕션 빌드
npm run build

# 2. 빌드 성공 확인
# ✅ No TypeScript errors
# ✅ No lint errors

# 3. 프로덕션 서버 실행
npm run start

# 4. 브라우저에서 테스트
# http://localhost:5000/price-management

# 5. Vercel 배포 (선택)
# vercel --prod
```

---

## 📊 MVP 성공 기준

### 기능적 요구사항
- [x] 품목별 월별 단가 저장 가능
- [x] 월별 단가 조회 가능
- [x] 기존 단가 수정 가능 (UPSERT)
- [x] 재고 금액 자동 계산 표시

### 비기능적 요구사항
- [x] API 응답 시간 < 200ms
- [x] UI 렌더링 시간 < 500ms (100개 품목 기준)
- [x] 한글 인코딩 문제 없음
- [x] 다크 모드 지원
- [x] 반응형 디자인 (모바일/태블릿)

### 품질 요구사항
- [x] 타입 안정성 (TypeScript strict mode)
- [x] 에러 처리 완비
- [x] 사용자 피드백 제공 (로딩, 성공, 실패)
- [x] 데이터 무결성 (DB 제약 조건)

---

## 🚀 Phase 2로 이월된 기능 (추후 구현)

### 1. Excel 통합 (예상 3-4시간)
- 월별 단가 Excel 업로드
- 단가 이력 Excel 다운로드
- 템플릿 제공

### 2. 대시보드 (예상 4-5시간)
- 재고 금액 차트 (월별 추이)
- 카테고리별 재고 금액 집계
- 업체별 재고 금액 집계

### 3. 정리 보드 (예상 5-6시간)
- 월별 재고 금액 요약
- 업체별/카테고리별 드릴다운
- PDF 출력 기능

### 4. 최적화 (예상 2-3시간)
- PostgreSQL materialized views
- Redis 캐싱
- 쿼리 최적화

### 5. 고급 기능 (예상 6-8시간)
- 단가 트렌드 분석
- 예측 알고리즘
- 이상치 탐지
- 자동 알림

### 6. 테스트 자동화 (예상 3-4시간)
- Jest unit tests
- Playwright E2E tests
- API integration tests

---

## 📝 구현 노트

### 중요 패턴

1. **Korean Text Encoding**:
   ```typescript
   // ✅ ALWAYS use this pattern for POST/PUT
   const text = await request.text();
   const body = JSON.parse(text);

   // ❌ NEVER use this (causes corruption)
   const body = await request.json();
   ```

2. **Date Handling**:
   ```typescript
   // Frontend: 'YYYY-MM' format
   const month = '2025-01';

   // Backend: Convert to 'YYYY-MM-01'
   const formattedMonth = `${month}-01`;
   ```

3. **UPSERT Pattern**:
   ```typescript
   await supabase
     .from('item_price_history')
     .upsert({ ... }, { onConflict: 'item_id,price_month' });
   ```

### 트러블슈팅

#### 문제: 한글이 깨져서 표시됨
**해결**: API에서 `request.text()` + `JSON.parse()` 패턴 사용

#### 문제: 같은 품목+월에 중복 데이터 생성됨
**해결**: DB에 `UNIQUE(item_id, price_month)` 제약 조건 + UPSERT 사용

#### 문제: 월 형식이 일치하지 않음
**해결**: 항상 'YYYY-MM-01' 형식으로 통일 (매월 1일)

---

## 🎯 6시간 완료 체크리스트

### Hour 0-2
- [ ] DB 마이그레이션 생성 (`20250116_mvp_price_history.sql`)
- [ ] 마이그레이션 적용 완료
- [ ] API 파일 생성 (`src/app/api/price-history/route.ts`)
- [ ] Frontend 페이지 생성 (`src/app/price-management/page.tsx`)
- [ ] Sidebar 메뉴 추가

### Hour 2-4
- [ ] API 테스트 (curl 또는 Postman)
- [ ] UI에서 API 호출 성공
- [ ] 한글 인코딩 검증
- [ ] 버그 수정 완료

### Hour 4-6
- [ ] 5개 시나리오 수동 테스트 완료
- [ ] 프로덕션 빌드 성공
- [ ] 배포 완료
- [ ] 최종 검증 완료

---

**작성일**: 2025-01-16
**목표 완료 시간**: 6시간
**병렬 실행 에이전트**: 3명 (DB, API, UI)
**MVP 범위**: 월별 단가 CRUD + 재고 금액 계산만
**Phase 2 이월**: Excel, 대시보드, 정리 보드, 최적화, 고급 기능
