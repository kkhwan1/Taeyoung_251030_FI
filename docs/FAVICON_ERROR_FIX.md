# Favicon 에러 해결

## 문제 상황

Next.js 개발 서버에서 다음 에러가 발생했습니다:

```
MODULE_NOT_FOUND: Cannot find module 'favicon.ico/route.js'
ET /favicon.ico 500 in 919ms
```

## 원인

Next.js App Router에서 `src/app/favicon.ico` 파일이 동적 라우트로 처리되려고 했지만, 해당 라우트 핸들러 파일(`route.js`)이 존재하지 않아 발생한 에러입니다.

Next.js App Router의 메타데이터 파일(favicon.ico, icon.ico 등)은 특수 처리되지만, 때로는 동적 라우트로 잘못 인식될 수 있습니다.

## 해결 방법

### 1. Favicon 파일 위치 변경

**이전**: `src/app/favicon.ico` (동적 라우트로 처리 시도)  
**이후**: `public/favicon.ico` (정적 파일로 처리)

### 2. Layout 메타데이터 업데이트

`src/app/layout.tsx`에서 favicon 경로를 명시적으로 지정:

```typescript
export const metadata: Metadata = {
  title: "태창 ERP 시스템",
  description: "태창 자동차 부품 제조 ERP 시스템",
  icons: {
    icon: '/favicon.ico',
  },
};
```

### 3. 빌드 캐시 정리

`.next` 폴더를 삭제하여 잘못된 빌드 캐시를 제거:

```bash
rm -rf .next
# 또는 Windows PowerShell
Remove-Item -Path ".next" -Recurse -Force
```

## 적용된 변경 사항

1. ✅ `src/app/favicon.ico` → `public/favicon.ico` 이동
2. ✅ `src/app/layout.tsx`에 favicon 메타데이터 추가
3. ✅ `.next` 빌드 캐시 정리

## 추가 확인 사항

- `public/favicon.ico` 파일이 존재하는지 확인
- 브라우저에서 `/favicon.ico` 접근 시 정상 작동하는지 확인
- Next.js 개발 서버 재시작 후 에러가 해결되었는지 확인

## 참고

Next.js App Router에서 favicon 처리 방법:
- `public/favicon.ico` - 정적 파일 (권장)
- `app/favicon.ico` - 메타데이터 파일 (특수 처리)
- `app/icon.ico` 또는 `app/icon.png` - App Router 메타데이터 파일

가장 안정적인 방법은 `public` 폴더에 정적 파일로 배치하는 것입니다.

