# 가격 정보 추출 보고서

## 추출 결과 요약

**추출 시간**: 2025-10-30 15:39:59 (UTC+9)  
**원본 파일**: `.example/태창금속 BOM.xlsx`  
**대상 시트**: `최신단가`  
**저장 위치**: `scripts/migration/data/clean-data/price-master.json`

## 통계

| 항목 | 값 |
|------|-----|
| **추출된 레코드** | 243개 ✅ |
| **제외된 레코드** | 0개 |
| **빈 행 (skip)** | 7개 |
| **처리 대상** | 250행 |
| **파일 크기** | 36.54 KB |

## 가격 정보 분석

### 가격 범위
- **최저가**: 10.3원
- **최고가**: 38,175원
- **평균가**: 3,773.56원
- **중앙값**: 데이터 분포 중심값

### 거래처별 분포 (상위 10)
| 거래처 | 개수 | 점유율 |
|--------|------|--------|
| 호원사급 | 64개 | 26.3% |
| N/A (미지정) | 45개 | 18.5% |
| 에이오에스 | 43개 | 17.7% |
| 제이에스테크 | 24개 | 9.9% |
| 웅지테크 | 20개 | 8.2% |
| 풍기사급 | 14개 | 5.8% |
| 대우사급 | 13개 | 5.3% |
| 태영금속 | 5개 | 2.1% |
| 창경에스테크 | 4개 | 1.6% |
| 삼진스틸 | 3개 | 1.2% |

### 월별 분포
| 월 | 개수 | 설명 |
|----|------|------|
| 2025-04 | 189개 | 4월 기준 단가 |
| 2025-01 | 54개 | 1월 기준 단가 (또는 기본값) |

## 데이터 구조

```json
{
  "source": "태창금속 BOM.xlsx - 최신단가",
  "extracted_at": "2025-10-30T06:39:59.773Z",
  "total_records": 243,
  "invalid_records": 0,
  "skipped_records": 7,
  "prices": [
    {
      "item_code": "69174-DO000",
      "price": 1203,
      "supplier": "태영금속",
      "price_month": "2025-04",
      "valid": true
    }
    // ... 243개 레코드
  ]
}
```

## 데이터 검증 결과

✅ **성공**
- 모든 레코드에 유효한 품목코드 존재
- 모든 레코드에 유효한 단가 정보 존재 (0이 아닌 값)
- 가격 형식 정상화 완료
- 월 정보 정상화 완료 (YYYY-MM 형식)

⚠️ **주의사항**
- 45개 레코드가 거래처 정보 없음 (N/A)
- 54개 레코드의 기준월이 1월 (가능한 기본값)
- 첫 번째 행도 데이터로 포함됨 (헤더 아님)

## 샘플 데이터

### 첫 5개 레코드
```json
[
  { "item_code": "69174-DO000", "price": 1203, "supplier": "태영금속", "price_month": "2025-04" },
  { "item_code": "69184-DO000", "price": 1203, "supplier": "태영금속", "price_month": "2025-04" },
  { "item_code": "69158-DO000", "price": 451, "supplier": "태영금속", "price_month": "2025-04" },
  { "item_code": "69168-DO000", "price": 450, "supplier": "태영금속", "price_month": "2025-04" },
  { "item_code": "69118-DO000", "price": 158, "supplier": "태영금속", "price_month": "2025-04" }
]
```

### 마지막 5개 레코드
```json
[
  { "item_code": "76231-A7000", "price": 1294, "supplier": "N/A", "price_month": "2025-01" },
  { "item_code": "76240-2G010", "price": 20022, "supplier": "N/A", "price_month": "2025-01" },
  { "item_code": "76241-A7000", "price": 1294, "supplier": "N/A", "price_month": "2025-01" },
  { "item_code": "77230-2G010", "price": 20318, "supplier": "N/A", "price_month": "2025-01" },
  { "item_code": "77240-2G010", "price": 20314.35, "supplier": "N/A", "price_month": "2025-01" }
]
```

## 사용 방법

### 1. JSON 파일 로드 (Node.js)
```javascript
const fs = require('fs');
const priceData = JSON.parse(
  fs.readFileSync('scripts/migration/data/clean-data/price-master.json', 'utf-8')
);

console.log(`추출된 단가: ${priceData.total_records}개`);
priceData.prices.forEach(price => {
  console.log(`${price.item_code}: ${price.price}원 (${price.supplier})`);
});
```

### 2. 데이터베이스 임포트
```typescript
import { db } from '@/lib/db-unified';

const priceData = require('./scripts/migration/data/clean-data/price-master.json');

for (const price of priceData.prices) {
  await db.prices.create({
    item_code: price.item_code,
    unit_price: price.price,
    supplier_name: price.supplier !== 'N/A' ? price.supplier : null,
    effective_month: price.price_month
  });
}
```

### 3. TypeScript 타입 정의
```typescript
interface PriceRecord {
  item_code: string;        // 품목코드
  price: number;            // 단가 (원)
  supplier: string;         // 거래처명
  price_month: string;      // 기준월 (YYYY-MM)
  valid: boolean;           // 검증 여부
}

interface PriceExtractionResult {
  source: string;
  extracted_at: string;
  total_records: number;
  invalid_records: number;
  skipped_records: number;
  prices: PriceRecord[];
}
```

## 다음 단계

1. **데이터베이스 임포트**
   ```bash
   npm run excel:price
   ```

2. **데이터 검증**
   - 품목 테이블과의 JOIN 검증
   - 중복 코드 확인
   - 거래처 정보 연결

3. **데이터 활용**
   - 입고/출고 단가 자동 적용
   - 월별 단가 이력 관리
   - 가격 트렌드 분석

---

**생성**: 2025-10-30  
**생성자**: Claude Code - Price Extraction Script  
**상태**: ✅ 완료
