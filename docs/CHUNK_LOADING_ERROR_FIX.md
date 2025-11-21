# Next.js Chunk Loading Error 해결 가이드

## 문제 상황

브라우저에서 다음 에러가 발생했습니다:

```
Loading chunk _app-pages-browser_src_components_Modal_tsx failed.
(error: http://localhost:5000/_next/static/chunks/_app-pages-browser_src_components_Modal_tsx.js)
```

## 원인

1. **빌드 캐시 불일치**: `.next` 폴더의 빌드 캐시가 손상되거나 오래된 상태
2. **파일 잠금 문제**: 개발 서버 실행 중 `.next` 폴더 삭제 시도
3. **브라우저 캐시**: 브라우저가 오래된 청크 파일을 캐시하고 있음
4. **Hot Module Replacement (HMR) 문제**: 개발 중 모듈 변경 후 청크 해시 불일치

## 해결 방법

### 방법 1: 자동 스크립트 실행 (권장)

```powershell
# 프로젝트 루트에서 실행
powershell -ExecutionPolicy Bypass -File ./scripts/fix-chunk-error.ps1
```

### 방법 2: 수동 해결

#### 1단계: 개발 서버 종료

```powershell
# 실행 중인 Next.js 프로세스 확인
Get-Process -Name node | Where-Object { $_.Path -like "*node*" }

# 개발 서버 종료 (Ctrl+C 또는)
npm run dev:stop
```

#### 2단계: 캐시 폴더 삭제

```powershell
# .next 폴더 삭제
Remove-Item -Path ".next" -Recurse -Force

# node_modules/.cache 삭제 (있는 경우)
Remove-Item -Path "node_modules/.cache" -Recurse -Force -ErrorAction SilentlyContinue

# .turbo 폴더 삭제 (Turbopack 사용 시)
Remove-Item -Path ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
```

#### 3단계: 개발 서버 재시작

```powershell
npm run dev
```

#### 4단계: 브라우저 캐시 클리어

1. **Chrome/Edge**: `Ctrl + Shift + R` (하드 리프레시)
2. **또는**: 개발자 도구(F12) → Network 탭 → "Disable cache" 체크
3. **또는**: 브라우저 설정 → 캐시 및 쿠키 삭제

## 예방 방법

### 1. 정상적인 서버 종료

개발 서버를 종료할 때는 반드시 `Ctrl+C`를 눌러 정상 종료하세요.

### 2. 정기적인 캐시 정리

주기적으로 `.next` 폴더를 정리하세요:

```powershell
npm run clean
```

### 3. .gitignore 확인

`.next`, `node_modules/.cache`, `.turbo` 폴더가 `.gitignore`에 포함되어 있는지 확인하세요.

## 추가 문제 해결

### 문제가 계속 발생하는 경우

1. **Node.js 버전 확인**:
   ```powershell
   node --version
   ```
   권장: Node.js 18.x 이상

2. **의존성 재설치**:
   ```powershell
   Remove-Item -Path "node_modules" -Recurse -Force
   Remove-Item -Path "package-lock.json" -Force
   npm install
   ```

3. **포트 충돌 확인**:
   ```powershell
   netstat -ano | findstr :5000
   ```
   다른 프로세스가 포트 5000을 사용 중이면 종료하세요.

4. **Next.js 버전 업데이트**:
   ```powershell
   npm update next
   ```

## 관련 파일

- `scripts/fix-chunk-error.ps1` - 자동 캐시 정리 스크립트
- `.next/` - Next.js 빌드 캐시 폴더
- `node_modules/.cache/` - Node.js 모듈 캐시
- `.turbo/` - Turbopack 캐시 (사용 시)

## 참고

- Next.js 공식 문서: [Error Recovery](https://nextjs.org/docs/app/building-your-application/configuring/error-handling)
- Next.js GitHub Issues: [Chunk Loading Error](https://github.com/vercel/next.js/issues?q=chunk+loading+failed)

