---
name: erp-excel-integration
description: Excel 3-Sheet export pattern specialist for ERP system. Expert in creating metadata + statistics + data sheets with Korean headers. Use this skill when implementing Excel export APIs or generating reports.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Bash
metadata:
  project: TaeYoungERP
  library: xlsx@0.18.5
  pattern: 3-sheet-export
  version: "1.0.0"
---

# ERP Excel Integration Expert

**태창 ERP 시스템**의 Excel 통합 전문 스킬입니다. 3-Sheet 표준 패턴(메타데이터 + 통계 + 데이터)을 사용한 Excel 내보내기 API를 생성합니다.

## 핵심 패턴: 3-Sheet Export

모든 Excel 내보내기 API는 다음 구조를 따릅니다:

### Sheet 1: 메타데이터 📋
- 내보내기 정보
- 생성 날짜/시간
- 총 레코드 수
- 필터 조건 (있는 경우)

### Sheet 2: 통계 📊
- 집계 정보
- 총액, 평균, 최대/최소값
- 카테고리별 요약
- 기간별 통계

### Sheet 3: 상세 데이터 📄
- 실제 거래 내역
- 한글 헤더 사용
- 포맷팅된 숫자/날짜
- 전체 컬럼 정보

## 표준 구현 템플릿

### 기본 3-Sheet Export API

```typescript
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseClient } from '@/lib/db-unified';

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient();

    // 1. 데이터 조회
    const { data, error } = await supabase
      .from('sales_transactions')
      .select(`
        *,
        customer:companies!customer_id(company_name)
      `)
      .order('transaction_date', { ascending: false });

    if (error) throw error;

    // 2. 통계 계산
    const totalAmount = data.reduce((sum, row) => sum + row.total_amount, 0);
    const avgAmount = totalAmount / data.length;
    const recordCount = data.length;

    // 3. Workbook 생성
    const workbook = XLSX.utils.book_new();

    // 4. Sheet 1: 메타데이터
    const metadataSheet = XLSX.utils.aoa_to_sheet([
      ['내보내기 정보', ''],
      ['보고서 유형', '매출 거래 내역'],
      ['내보낸 날짜', new Date().toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })],
      ['총 레코드 수', recordCount.toLocaleString('ko-KR')],
      ['', ''],
      ['주의사항', ''],
      ['', '• 이 데이터는 자동 생성되었습니다.'],
      ['', '• 수정 시 원본 데이터와 동기화되지 않습니다.']
    ]);

    // 5. Sheet 2: 통계
    const statsSheet = XLSX.utils.aoa_to_sheet([
      ['통계 항목', '값'],
      ['총 거래 금액', `₩${totalAmount.toLocaleString('ko-KR')}`],
      ['평균 거래 금액', `₩${Math.round(avgAmount).toLocaleString('ko-KR')}`],
      ['거래 건수', recordCount.toLocaleString('ko-KR')],
      ['', ''],
      ['결제 상태별 통계', ''],
      ['미결제 건수', data.filter(r => r.payment_status === 'PENDING').length],
      ['부분결제 건수', data.filter(r => r.payment_status === 'PARTIAL').length],
      ['완납 건수', data.filter(r => r.payment_status === 'COMPLETED').length]
    ]);

    // 6. Sheet 3: 데이터 (한글 헤더)
    const koreanData = data.map(row => ({
      '거래ID': row.transaction_id,
      '거래번호': row.transaction_no,
      '거래일자': new Date(row.transaction_date).toLocaleDateString('ko-KR'),
      '고객사명': row.customer?.company_name || '',
      '총액': row.total_amount,
      '수금액': row.collected_amount || 0,
      '잔액': row.total_amount - (row.collected_amount || 0),
      '결제상태': row.payment_status === 'COMPLETED' ? '완납' :
                  row.payment_status === 'PARTIAL' ? '부분결제' : '미결제',
      '비고': row.notes || ''
    }));

    const dataSheet = XLSX.utils.json_to_sheet(koreanData);

    // 7. 컬럼 너비 자동 조정
    const columnWidths = [
      { wch: 10 },  // 거래ID
      { wch: 15 },  // 거래번호
      { wch: 12 },  // 거래일자
      { wch: 25 },  // 고객사명
      { wch: 15 },  // 총액
      { wch: 15 },  // 수금액
      { wch: 15 },  // 잔액
      { wch: 12 },  // 결제상태
      { wch: 30 }   // 비고
    ];
    dataSheet['!cols'] = columnWidths;

    // 8. 워크북에 시트 추가
    XLSX.utils.book_append_sheet(workbook, metadataSheet, '내보내기 정보');
    XLSX.utils.book_append_sheet(workbook, statsSheet, '통계');
    XLSX.utils.book_append_sheet(workbook, dataSheet, '거래 내역');

    // 9. 파일 생성
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    });

    // 10. 응답 반환
    const filename = `매출거래_${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '파일 생성 실패'
    }, { status: 500 });
  }
}
```

## 고급 패턴

### 1. 필터링 + 페이지네이션

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // 쿼리 파라미터 파싱
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const status = searchParams.get('status');

  // 필터 적용
  let query = supabase
    .from('sales_transactions')
    .select('*')
    .order('transaction_date', { ascending: false });

  if (startDate) {
    query = query.gte('transaction_date', startDate);
  }

  if (endDate) {
    query = query.lte('transaction_date', endDate);
  }

  if (status) {
    query = query.eq('payment_status', status);
  }

  const { data, error } = await query;

  // 메타데이터에 필터 정보 추가
  const metadataSheet = XLSX.utils.aoa_to_sheet([
    ['내보내기 정보', ''],
    ['내보낸 날짜', new Date().toLocaleString('ko-KR')],
    ['총 레코드 수', data.length],
    ['', ''],
    ['필터 조건', ''],
    ['시작일', startDate || '전체'],
    ['종료일', endDate || '전체'],
    ['결제상태', status || '전체']
  ]);

  // ... 나머지 시트 생성
}
```

### 2. 다중 카테고리 통계

```typescript
// 카테고리별 집계
const categoryStats = data.reduce((acc, row) => {
  const category = row.category || '기타';
  if (!acc[category]) {
    acc[category] = { count: 0, amount: 0 };
  }
  acc[category].count += 1;
  acc[category].amount += row.total_amount;
  return acc;
}, {} as Record<string, { count: number; amount: number }>);

// 통계 시트 생성
const statsData = [
  ['통계 항목', '값'],
  ['전체 통계', ''],
  ['총 거래 금액', `₩${totalAmount.toLocaleString('ko-KR')}`],
  ['평균 거래 금액', `₩${avgAmount.toLocaleString('ko-KR')}`],
  ['', ''],
  ['카테고리별 통계', '']
];

Object.entries(categoryStats).forEach(([category, stats]) => {
  statsData.push([
    category,
    `건수: ${stats.count}, 금액: ₩${stats.amount.toLocaleString('ko-KR')}`
  ]);
});

const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
```

### 3. 조건부 포맷팅 (색상)

```typescript
// 셀 스타일 정의
const cellStyles = {
  header: {
    fill: { fgColor: { rgb: '4472C4' } },
    font: { bold: true, color: { rgb: 'FFFFFF' } }
  },
  pending: {
    fill: { fgColor: { rgb: 'FFC7CE' } }  // 빨간색
  },
  partial: {
    fill: { fgColor: { rgb: 'FFEB9C' } }  // 노란색
  },
  completed: {
    fill: { fgColor: { rgb: 'C6EFCE' } }  // 초록색
  }
};

// 데이터 생성 시 스타일 적용
const dataSheet = XLSX.utils.json_to_sheet(koreanData);

// 결제 상태에 따라 행 색상 변경
koreanData.forEach((row, idx) => {
  const rowNum = idx + 2; // 헤더 제외
  const cellRef = `H${rowNum}`; // 결제상태 컬럼

  if (row['결제상태'] === '미결제') {
    dataSheet[cellRef].s = cellStyles.pending;
  } else if (row['결제상태'] === '부분결제') {
    dataSheet[cellRef].s = cellStyles.partial;
  } else {
    dataSheet[cellRef].s = cellStyles.completed;
  }
});
```

## 검증된 구현 예시

### 1. 매출 거래 내보내기
**파일**: [src/app/api/export/sales/route.ts](../../../src/app/api/export/sales/route.ts)

```typescript
// 3-Sheet 패턴 완벽 구현
// - 메타데이터 시트
// - 통계 시트 (총액, 평균, 결제상태별)
// - 데이터 시트 (한글 헤더, JOIN 포함)
```

### 2. 매입 거래 내보내기
**파일**: [src/app/api/export/purchases/route.ts](../../../src/app/api/export/purchases/route.ts)

```typescript
// 공급사 정보 JOIN
// 결제 상태별 통계
// 한글 파일명 인코딩
```

### 3. 수금 내역 내보내기
**파일**: [src/app/api/export/collections/route.ts](../../../src/app/api/export/collections/route.ts)

```typescript
// 수금 방법별 통계
// 기간별 집계
// 고객사별 그룹화
```

### 4. 지급 내역 내보내기
**파일**: [src/app/api/export/payments/route.ts](../../../src/app/api/export/payments/route.ts)

```typescript
// 지급 방법별 통계
// 공급사별 그룹화
// 잔액 계산
```

## 한글 파일명 처리

### 올바른 파일명 인코딩

```typescript
// ✅ UTF-8 인코딩 처리
const filename = `매출거래_${new Date().toISOString().split('T')[0]}.xlsx`;

return new NextResponse(buffer, {
  headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
  }
});
```

### 동적 파일명 생성

```typescript
// 날짜 포함
const today = new Date().toISOString().split('T')[0];
const filename = `거래내역_${today}.xlsx`;

// 필터 조건 포함
const statusText = status === 'COMPLETED' ? '완납' :
                   status === 'PARTIAL' ? '부분결제' : '전체';
const filename = `매출_${statusText}_${today}.xlsx`;

// 기간 포함
if (startDate && endDate) {
  const filename = `거래내역_${startDate}_${endDate}.xlsx`;
}
```

## 성능 최적화

### 1. 대용량 데이터 처리

```typescript
// 스트리밍 방식 (10,000+ 레코드)
export async function GET(request: Request) {
  const { data } = await supabase
    .from('sales_transactions')
    .select('*')
    .range(0, 10000); // 페이지네이션

  // 청크 단위로 처리
  const chunkSize = 1000;
  const chunks = [];

  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }

  // 각 청크를 시트에 추가
  const dataSheet = XLSX.utils.json_to_sheet(chunks[0]);

  chunks.slice(1).forEach(chunk => {
    XLSX.utils.sheet_add_json(dataSheet, chunk, {
      skipHeader: true,
      origin: -1
    });
  });

  // ... 나머지 처리
}
```

### 2. 압축 활성화

```typescript
// 파일 크기 감소
const buffer = XLSX.write(workbook, {
  type: 'buffer',
  bookType: 'xlsx',
  compression: true  // ✅ 압축 활성화
});
```

### 3. 선택적 컬럼 내보내기

```typescript
// 필요한 컬럼만 선택
const { data } = await supabase
  .from('sales_transactions')
  .select(`
    transaction_no,
    transaction_date,
    total_amount,
    customer:companies!customer_id(company_name)
  `);

// 불필요한 메타데이터 제외
const koreanData = data.map(row => ({
  '거래번호': row.transaction_no,
  '거래일자': row.transaction_date,
  '고객사': row.customer.company_name,
  '금액': row.total_amount
}));
```

## 에러 처리

### 표준 에러 응답

```typescript
try {
  // ... Excel 생성 로직
} catch (error) {
  console.error('Excel export error:', error);

  return NextResponse.json({
    success: false,
    error: error instanceof Error ? error.message : 'Excel 파일 생성 실패',
    details: process.env.NODE_ENV === 'development' ? error : undefined
  }, { status: 500 });
}
```

### 데이터 검증

```typescript
// 데이터가 없는 경우
if (!data || data.length === 0) {
  return NextResponse.json({
    success: false,
    error: '내보낼 데이터가 없습니다.'
  }, { status: 404 });
}

// Supabase 에러 처리
if (error) {
  return NextResponse.json({
    success: false,
    error: '데이터 조회 실패',
    details: error.message
  }, { status: 500 });
}
```

## 테스트 방법

### 1. 브라우저 테스트

```bash
# 개발 서버 시작
npm run dev

# 브라우저에서 접속
http://localhost:5000/api/export/sales
```

### 2. curl 테스트

```bash
# Windows CMD
curl -o sales.xlsx http://localhost:5000/api/export/sales

# PowerShell
Invoke-WebRequest -Uri http://localhost:5000/api/export/sales -OutFile sales.xlsx
```

### 3. Jest 테스트

```typescript
describe('Excel Export API', () => {
  it('should generate 3-sheet Excel file', async () => {
    const response = await fetch('http://localhost:5000/api/export/sales');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('spreadsheet');

    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer);

    expect(workbook.SheetNames).toHaveLength(3);
    expect(workbook.SheetNames).toContain('내보내기 정보');
    expect(workbook.SheetNames).toContain('통계');
    expect(workbook.SheetNames).toContain('거래 내역');
  });
});
```

## 체크리스트

### Excel Export API 작성 시

- [ ] 3-Sheet 구조 준수 (메타데이터 + 통계 + 데이터)
- [ ] 한글 헤더 사용
- [ ] 한글 파일명 UTF-8 인코딩
- [ ] 컬럼 너비 자동 조정
- [ ] 날짜/숫자 포맷팅
- [ ] 통계 계산 정확성 확인
- [ ] 압축 활성화
- [ ] 에러 처리 구현
- [ ] 대용량 데이터 고려 (10,000+ 레코드)
- [ ] 브라우저 다운로드 테스트

## 관련 문서

- [CLAUDE.md](../../../CLAUDE.md) - 프로젝트 전체 가이드
- [xlsx 라이브러리 문서](https://docs.sheetjs.com/)
- Phase 1 Export APIs - 검증된 구현 예시

---

**Last Updated**: 2025-10-19
**Library**: xlsx@0.18.5
**프로젝트**: 태창 ERP 시스템
