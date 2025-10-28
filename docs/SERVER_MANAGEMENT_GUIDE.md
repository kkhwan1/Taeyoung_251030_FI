# 서버 관리 가이드 및 트러블슈팅

## 🚀 서버 관리 명령어

### 기본 명령어
```bash
# 안전한 서버 시작 (포트 충돌 자동 감지)
npm run dev:safe

# 서버 상태 확인
npm run dev:status

# 서버 안전하게 종료
npm run dev:stop

# 서버 재시작 (종료 → 시작)
npm run dev:restart

# 빌드 캐시 안전 삭제
npm run clean

# 빌드 캐시 삭제 후 서버 시작
npm run clean:all
```

### 기존 명령어 (호환성 유지)
```bash
# 기본 서버 시작 (포트 충돌 시 오류 발생 가능)
npm run dev

# Windows용 캐시 삭제
npm run clean:windows
```

## 🔧 서버 관리 스크립트

### `scripts/server-manager.ps1`
- **기능**: 포트 충돌 감지, 안전한 서버 시작/종료/재시작
- **사용법**: 
  - `npm run dev:safe` (시작)
  - `npm run dev:stop` (종료)
  - `npm run dev:restart` (재시작)
  - `npm run dev:status` (상태 확인)

### `scripts/clean-build.ps1`
- **기능**: 서버 실행 중 안전한 빌드 캐시 삭제
- **사용법**: `npm run clean`
- **특징**: 서버가 실행 중이면 사용자 확인 후 종료

## 🚨 트러블슈팅

### 1. 포트 5000 충돌 오류
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:5000
```

**해결 방법:**
```bash
# 방법 1: 안전한 서버 관리 사용
npm run dev:stop
npm run dev:safe

# 방법 2: 수동으로 프로세스 종료
netstat -ano | findstr :5000
taskkill /F /PID <PID>
```

### 2. 빌드 캐시 오류
```
Error: UNKNOWN: unknown error, open 'webpack-runtime.js'
```

**해결 방법:**
```bash
# 안전한 캐시 삭제
npm run clean
npm run dev:safe
```

### 3. Import 오류 (getSupabaseClient 등)
```
Attempted import error: 'getSupabaseClient' is not exported
```

**해결 방법:**
```bash
# 빌드 캐시 삭제 후 재시작
npm run clean:all
```

### 4. 서버가 시작되지 않음

**진단 단계:**
```bash
# 1. 서버 상태 확인
npm run dev:status

# 2. 포트 사용 확인
netstat -ano | findstr :5000

# 3. 프로세스 확인
Get-Process node -ErrorAction SilentlyContinue
```

**해결 방법:**
```bash
# 모든 서버 프로세스 정리
npm run dev:stop
npm run clean
npm run dev:safe
```

## 📋 권장 작업 흐름

### ✅ 정상적인 서버 시작
```bash
npm run dev:safe
```

### ✅ 서버 문제 발생 시
```bash
# 1. 상태 확인
npm run dev:status

# 2. 안전하게 종료
npm run dev:stop

# 3. 캐시 삭제 (필요시)
npm run clean

# 4. 재시작
npm run dev:safe
```

### ✅ 개발 중 빌드 문제 발생 시
```bash
# 캐시 삭제 후 재시작
npm run clean:all
```

## ⚠️ 주의사항

### ❌ 하지 말아야 할 것
1. **서버 실행 중 `.next` 폴더 직접 삭제**
   - `webpack-runtime.js` 오류 발생 가능
   - 대신 `npm run clean` 사용

2. **백그라운드 모드로 서버 시작**
   - 프로세스 추적 어려움
   - 대신 `npm run dev:safe` 사용

3. **포트 확인 없이 `npm run dev` 반복 실행**
   - 포트 충돌 오류 발생
   - 대신 `npm run dev:safe` 사용

4. **모든 Node.js 프로세스 강제 종료**
   - `taskkill /F /IM node.exe`
   - 다른 프로젝트에 영향 가능

### ✅ 권장사항
1. **항상 `npm run dev:safe` 사용**
2. **문제 발생 시 `npm run dev:status`로 상태 확인**
3. **빌드 문제 시 `npm run clean` 사용**
4. **서버 재시작 시 `npm run dev:restart` 사용**

## 🔍 서버 상태 모니터링

### 포트 사용 확인
```bash
netstat -ano | findstr :5000
```

### 프로세스 확인
```bash
Get-Process node -ErrorAction SilentlyContinue
```

### 서버 로그 확인
- 터미널에서 실시간 로그 확인
- 오류 발생 시 스택 트레이스 확인

## 📊 성능 최적화

### 메모리 사용량 모니터링
```bash
npm run dev:status
# 출력: 메모리 사용: XXX MB
```

### 빌드 캐시 정리 주기
- 개발 중 빌드 오류 발생 시
- 의존성 변경 후
- 코드 변경이 반영되지 않을 때

## 🆘 긴급 상황 대응

### 서버가 완전히 응답하지 않을 때
```bash
# 1. 강제 종료
taskkill /F /IM node.exe

# 2. 포트 확인
netstat -ano | findstr :5000

# 3. 남은 프로세스 종료
taskkill /F /PID <PID>

# 4. 캐시 삭제
npm run clean

# 5. 재시작
npm run dev:safe
```

### PowerShell 실행 정책 오류
```bash
# 실행 정책 변경
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📝 변경 이력

- **2025-10-23**: 서버 관리 스크립트 추가
- **2025-10-23**: 포트 충돌 방지 메커니즘 구축
- **2025-10-23**: 안전한 빌드 캐시 삭제 기능 추가
- **2025-10-23**: 트러블슈팅 가이드 작성
