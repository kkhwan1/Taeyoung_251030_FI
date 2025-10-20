# Cursor AI 스타일 가이드 - Phase P4

> 이 문서는 Cursor AI가 일관된 UI 컴포넌트를 개발하기 위한 스타일 가이드입니다.

## 1. 컴포넌트 라이브러리

### shadcn/ui 사용

**모든 UI 컴포넌트는 shadcn/ui를 사용합니다:**

```bash
# 필요한 컴포넌트 설치
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add table
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add progress
```

**사용 예시:**

```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>제목</CardTitle>
      </CardHeader>
      <CardContent>
        <Input placeholder="입력..." />
        <Button>확인</Button>
      </CardContent>
    </Card>
  );
}
```

## 2. 기존 스타일 참조

### 참조할 파일: `src/app/price-master/page.tsx`

**현재 가격 마스터 페이지의 스타일을 따라야 합니다:**

1. **레이아웃 구조**
   ```typescript
   <div className="min-h-screen bg-gray-50">
     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
       {/* 컨텐츠 */}
     </div>
   </div>
   ```

2. **카드 스타일**
   ```typescript
   <Card className="shadow-sm">
     <CardHeader className="bg-white border-b">
       <CardTitle className="text-lg font-semibold text-gray-900">
         제목
       </CardTitle>
     </CardHeader>
     <CardContent className="p-6">
       {/* 내용 */}
     </CardContent>
   </Card>
   ```

3. **버튼 스타일**
   ```typescript
   // Primary 버튼
   <Button className="bg-blue-600 hover:bg-blue-700 text-white">
     확인
   </Button>

   // Secondary 버튼
   <Button variant="outline" className="border-gray-300">
     취소
   </Button>

   // Danger 버튼
   <Button variant="destructive">
     삭제
   </Button>
   ```

4. **입력 필드**
   ```typescript
   <Input
     className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
     placeholder="입력..."
   />
   ```

## 3. Tailwind CSS 클래스 규칙

### 색상 팔레트

- **Primary**: `blue-600`, `blue-700` (버튼, 링크)
- **Success**: `green-600`, `green-700` (성공 메시지)
- **Warning**: `yellow-600`, `yellow-700` (경고)
- **Danger**: `red-600`, `red-700` (에러, 삭제)
- **Gray**: `gray-50` ~ `gray-900` (배경, 텍스트, 테두리)

### 간격 규칙

- **섹션 간격**: `mb-6` 또는 `mb-8`
- **컴포넌트 간격**: `space-y-4` 또는 `gap-4`
- **패딩**: `p-4`, `p-6`, `px-4 py-6`
- **마진**: `mt-4`, `mb-4`, `mx-auto`

### 반응형 디자인

```typescript
// Mobile First 접근
<div className="w-full sm:w-1/2 lg:w-1/3">
  {/* 모바일: 100%, 태블릿: 50%, 데스크탑: 33% */}
</div>

// 그리드 레이아웃
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 모바일: 1열, 태블릿: 2열, 데스크탑: 3열 */}
</div>
```

## 4. TypeScript 타입 사용

### API 타입 Import

```typescript
import type {
  BulkUploadRequest,
  BulkUploadResponse,
  BOMCalculationRequest,
  BOMCalculationResponse,
  DuplicateGroup,
  DuplicatesCleanupRequest
} from '@/types/api/price-master';
```

### Props 타입 정의

```typescript
interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  acceptedTypes?: string[];
  maxSize?: number;
  disabled?: boolean;
}

export function FileUploadZone({
  onFileSelect,
  acceptedTypes = ['.csv', '.xlsx'],
  maxSize = 5 * 1024 * 1024, // 5MB
  disabled = false
}: FileUploadZoneProps) {
  // ...
}
```

## 5. 한글 텍스트 가이드

### UI 레이블 및 메시지

**모든 사용자 대면 텍스트는 한글을 사용합니다:**

```typescript
// ✅ 올바른 예
<CardTitle>대량 가격 업데이트</CardTitle>
<Button>파일 업로드</Button>
<p className="text-sm text-gray-500">
  CSV 또는 Excel 파일을 업로드하세요 (최대 5MB)
</p>

// ❌ 잘못된 예
<CardTitle>Bulk Price Update</CardTitle>
<Button>Upload File</Button>
```

### 에러 메시지

```typescript
// 사용자 친화적인 한글 메시지
if (file.size > maxSize) {
  throw new Error('파일 크기가 5MB를 초과합니다.');
}

if (!validFormats.includes(fileType)) {
  throw new Error('CSV 또는 Excel 파일만 업로드 가능합니다.');
}
```

## 6. 상태 관리

### React Hook 사용

```typescript
import { useState, useCallback } from 'react';

export function MyComponent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BulkUploadResponse | null>(null);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/price-master/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [requestData]);

  return (
    // ...
  );
}
```

## 7. 파일 구조

### 컴포넌트 파일 구조

```
src/app/price-master/bulk-update/
├── page.tsx                    # 메인 페이지
├── components/
│   ├── FileUploadZone.tsx      # 파일 업로드 영역
│   ├── DataPreviewTable.tsx    # 데이터 미리보기 테이블
│   ├── ValidationResultPanel.tsx  # 검증 결과 패널
│   └── BulkUpdateButton.tsx    # 업데이트 실행 버튼
└── hooks/
    └── useBulkUpload.ts        # 커스텀 훅 (선택사항)
```

### Import 순서

```typescript
// 1. React 및 Next.js
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// 2. 외부 라이브러리
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';

// 3. shadcn/ui 컴포넌트
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// 4. 내부 타입 및 유틸
import type { BulkUploadRequest, BulkUploadResponse } from '@/types/api/price-master';
import { formatDate, formatCurrency } from '@/lib/utils';

// 5. 스타일 (있다면)
import './styles.css';
```

## 8. 접근성 (Accessibility)

### 필수 요소

```typescript
// aria-label 사용
<button aria-label="파일 업로드">
  <UploadIcon />
</button>

// role 속성
<div role="alert" aria-live="polite">
  {errorMessage}
</div>

// 키보드 접근성
<button
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  클릭
</button>
```

## 9. 로딩 및 에러 상태

### 로딩 상태 표시

```typescript
import { Loader2 } from 'lucide-react';

{loading && (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    <span className="ml-2 text-gray-600">처리 중...</span>
  </div>
)}
```

### 에러 메시지 표시

```typescript
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>오류</AlertTitle>
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

## 10. 테스트 가능한 코드

### 테스트 ID 추가

```typescript
<button data-testid="bulk-upload-submit">
  업로드
</button>

<div data-testid="validation-results">
  {validationResults.map((result) => (
    <div key={result.id} data-testid={`result-${result.id}`}>
      {result.message}
    </div>
  ))}
</div>
```

---

## 체크리스트

Cursor AI는 컴포넌트 개발 시 다음 사항을 확인하세요:

- [ ] shadcn/ui 컴포넌트 사용
- [ ] 기존 price-master 페이지 스타일 일치
- [ ] TypeScript 타입 정의 사용 (`@/types/api/price-master`)
- [ ] 한글 UI 텍스트 사용
- [ ] 반응형 디자인 적용 (Mobile First)
- [ ] 접근성 속성 추가 (aria-label, role 등)
- [ ] 로딩/에러 상태 처리
- [ ] 테스트 ID 추가 (data-testid)
- [ ] Import 순서 준수
- [ ] 파일 구조 규칙 준수
