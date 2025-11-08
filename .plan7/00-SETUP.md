# Phase 0: 초기 설정 및 준비

**예상 시간**: 30분
**상태**: 진행 중

---

## 📋 체크리스트

### 1. 폴더 구조 생성
- [x] `.plan7/` 디렉토리 생성
- [x] `README.md` 작성
- [ ] `logs/` 디렉토리 생성
- [ ] `checkpoints/` 디렉토리 생성
- [ ] `metrics/` 디렉토리 생성

### 2. Git 브랜치 생성
- [ ] `feature/plan7-optimization` 브랜치 생성
- [ ] 현재 상태 커밋

### 3. 베이스라인 메트릭 수집
- [ ] 번들 크기 측정
- [ ] 페이지 로딩 시간 측정
- [ ] 메모리 사용량 측정
- [ ] API 응답 시간 측정

### 4. 체크포인트 백업
- [ ] `checkpoints/baseline/` 생성
- [ ] 전체 소스 코드 복사

---

## 🛠️ 실행 명령어

### 1. 디렉토리 생성
```bash
# Windows
mkdir C:\Users\USER\claude_code\FITaeYoungERP\.plan7\logs
mkdir C:\Users\USER\claude_code\FITaeYoungERP\.plan7\checkpoints
mkdir C:\Users\USER\claude_code\FITaeYoungERP\.plan7\checkpoints\baseline
mkdir C:\Users\USER\claude_code\FITaeYoungERP\.plan7\checkpoints\pre-wave1
mkdir C:\Users\USER\claude_code\FITaeYoungERP\.plan7\checkpoints\post-wave1
mkdir C:\Users\USER\claude_code\FITaeYoungERP\.plan7\checkpoints\pre-wave2
mkdir C:\Users\USER\claude_code\FITaeYoungERP\.plan7\checkpoints\post-wave2
mkdir C:\Users\USER\claude_code\FITaeYoungERP\.plan7\checkpoints\pre-wave3
mkdir C:\Users\USER\claude_code\FITaeYoungERP\.plan7\checkpoints\post-wave3
mkdir C:\Users\USER\claude_code\FITaeYoungERP\.plan7\metrics
```

### 2. Git 브랜치 생성
```bash
cd C:\Users\USER\claude_code\FITaeYoungERP

# 현재 상태 커밋
git add .
git commit -m "chore: prepare for Plan 7 optimization

- Create .plan7 directory structure
- Add baseline checkpoint
- Prepare for Codex-Claude loop execution"

# 새 브랜치 생성
git checkout -b feature/plan7-optimization
```

### 3. 베이스라인 메트릭 수집

#### 3.1 번들 크기 측정
```bash
npm run build
npm run analyze  # webpack-bundle-analyzer

# 결과를 metrics/baseline.json에 저장
```

**예상 결과**:
```json
{
  "bundleSize": {
    "total": "500KB",
    "javascript": "400KB",
    "css": "50KB",
    "images": "50KB"
  },
  "timestamp": "2025-02-01T00:00:00Z"
}
```

#### 3.2 페이지 로딩 시간 측정
```bash
# Chrome DevTools로 수동 측정
# 1. http://localhost:5000 접속
# 2. Network 탭 → Disable cache
# 3. 각 페이지 3회 측정 후 평균

# 측정 페이지:
# - Dashboard: /dashboard
# - Items: /master/items
# - Companies: /master/companies
# - Sales: /sales/transactions
```

**수집 데이터**:
```json
{
  "pageLoadTimes": {
    "dashboard": {
      "average": "2.8s",
      "p50": "2.7s",
      "p95": "3.2s"
    },
    "items": {
      "average": "2.1s",
      "p50": "2.0s",
      "p95": "2.5s"
    },
    "companies": {
      "average": "1.9s",
      "p50": "1.8s",
      "p95": "2.3s"
    },
    "sales": {
      "average": "2.5s",
      "p50": "2.4s",
      "p95": "2.9s"
    }
  },
  "timestamp": "2025-02-01T00:15:00Z"
}
```

#### 3.3 메모리 사용량 측정
```bash
# Chrome DevTools → Performance → Memory
# 1. Start profiling
# 2. Navigate through pages
# 3. Stop profiling
# 4. Check heap size
```

**수집 데이터**:
```json
{
  "memoryUsage": {
    "initial": "45MB",
    "afterNavigation": "80MB",
    "peak": "120MB"
  },
  "timestamp": "2025-02-01T00:20:00Z"
}
```

#### 3.4 API 응답 시간 측정
```bash
# Postman or curl로 측정
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:5000/api/items"

# curl-format.txt:
#    time_total:  %{time_total}s\n
```

**수집 데이터**:
```json
{
  "apiResponseTimes": {
    "/api/items": "120ms",
    "/api/companies": "95ms",
    "/api/sales-transactions": "180ms",
    "/api/dashboard/stats": "250ms"
  },
  "timestamp": "2025-02-01T00:25:00Z"
}
```

### 4. 통합 메트릭 저장
```json
// .plan7/metrics/baseline.json
{
  "timestamp": "2025-02-01T00:30:00Z",
  "bundle": {
    "total": "500KB",
    "javascript": "400KB",
    "css": "50KB",
    "images": "50KB"
  },
  "performance": {
    "pageLoadAverage": "2.3s",
    "dashboardLoad": "2.8s",
    "itemsLoad": "2.1s"
  },
  "memory": {
    "initial": "45MB",
    "peak": "120MB"
  },
  "api": {
    "averageResponse": "160ms",
    "slowestEndpoint": "/api/dashboard/stats (250ms)"
  },
  "codeMetrics": {
    "totalFiles": 379,
    "totalLines": 114000,
    "apiRoutes": 128,
    "components": 90,
    "manualFetches": 73
  }
}
```

### 5. 체크포인트 백업
```bash
# 전체 소스 복사
robocopy "C:\Users\USER\claude_code\FITaeYoungERP" "C:\Users\USER\claude_code\FITaeYoungERP\.plan7\checkpoints\baseline" /E /XD node_modules .next .git .plan7

# 또는 git archive 사용
git archive -o .plan7/checkpoints/baseline/baseline.zip HEAD
```

---

## ✅ 완료 조건

- [x] `.plan7/` 폴더 구조 완성
- [ ] Git 브랜치 생성 완료
- [ ] `metrics/baseline.json` 파일 생성
- [ ] `checkpoints/baseline/` 백업 완료
- [ ] 모든 명령어 실행 성공

---

## 📝 다음 단계

Phase 0 완료 후 → [Phase 1: Codex 초기 검증](./01-CODEX-INITIAL.md)

---

**시작 시간**: 2025-02-01 00:00
**예상 완료**: 2025-02-01 00:30
**실제 완료**: (기록 예정)
