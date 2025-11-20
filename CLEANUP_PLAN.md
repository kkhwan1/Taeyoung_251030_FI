# 🧹 FITaeYoungERP 정리 계획서

**작성일**: 2025년 2월 1일
**분석 도구**: Codex GPT-5 (High Reasoning Mode)
**분석 범위**: 프로젝트 전체 파일 시스템 + 코드 의존성
**웹 서버 상태**: ✅ localhost:5000 정상 작동 확인

---

## 📊 분석 개요

### 총 삭제 가능 파일
- **즉시 삭제 가능**: ~15개 파일 (테스트 스크립트, 로그, 임시 파일, 빌드 아티팩트)
- **백업 후 삭제**: 11개 파일 (데이터베이스 백업 4개 + 계획 디렉토리 7개)
- **절대 보존**: src/, scripts/, .plan8/, ProcessStartButton.tsx, ProcessCompleteButton.tsx

### 예상 절약 공간
- **빌드 아티팩트**: ~200MB (.next/, coverage/, node_modules/.cache/)
- **로그 파일**: ~5MB (dev-server.log, logs/)
- **임시 파일**: ~2MB (inventory-page-*.txt, test_*.txt)
- **계획 문서**: ~50MB (.plan~.plan7/)
- **총 절약**: ~260MB

---

## ✅ Phase 1: 즉시 삭제 가능 (코드 참조 없음)

### 1.1 테스트 스크립트 (Root)
```bash
# Git grep 결과: 코드 참조 없음
✓ create-test-items.js                    # 테스트 데이터 생성 (완료됨)
✓ test-process-buttons.js                 # 버튼 기능 테스트 (성공 확인)
✓ verify-test-items.js                    # 테스트 아이템 검증
✓ open-browser-test.js                    # 브라우저 테스트
```

**삭제 이유**:
- 모든 테스트가 이미 성공적으로 완료됨
- ProcessStartButton, ProcessCompleteButton 정상 작동 검증 완료
- 테스트 데이터 (TEST-RAW-001, TEST-FIN-001) 데이터베이스에 존재
- package.json에 해당 스크립트 참조 없음

### 1.2 임시 파일
```bash
✓ inventory-page-current.txt              # 페이지 스냅샷 임시 파일
✓ inventory-page-snapshot.txt             # 페이지 스냅샷 임시 파일
✓ wave2-*.txt (5개 파일)                  # Wave 2 테스트 임시 파일
✓ test_contract_document.txt              # 계약서 테스트 파일
```

**삭제 이유**:
- 개발 중 생성된 임시 스냅샷 파일
- 코드에서 참조되지 않음
- 재생성 가능

### 1.3 로그 파일
```bash
✓ dev-server.log                          # 서버 시작 로그 (과거 기록)
✓ logs/ 디렉토리 전체                     # 개발 서버 로그 디렉토리
```

**삭제 이유**:
- 과거 서버 시작 로그 (현재 런타임에 불필요)
- Git에 커밋할 필요 없음
- .gitignore에 추가 권장

### 1.4 빌드 아티팩트 (재생성 가능)
```bash
✓ .next/                                  # Next.js 빌드 캐시 (~150MB)
✓ coverage/                               # 테스트 커버리지 리포트 (~50MB)
✓ tsconfig.tsbuildinfo                    # TypeScript 빌드 정보
✓ node_modules/.cache/                    # npm 캐시
```

**삭제 이유**:
- `npm run build` 또는 `npm run dev`로 재생성 가능
- Git에 커밋하지 않는 파일들 (.gitignore 적용됨)
- 개발 환경 정리 시 항상 삭제 가능

### 1.5 예외: 보존해야 할 테스트 파일
```bash
🔒 test-chain-automation.js                # .claude/settings.local.json:9 참조
🔒 test-full-chain.js                      # 체인 테스트 (참조됨)
🔒 test-stock-history-data.js              # 재고 이력 테스트
```

**보존 이유**:
- .claude/settings.local.json에서 test-full-chain.js 참조
- 체인 자동화 테스트에 필요
- 재고 이력 검증에 사용 중

---

## ⚠️ Phase 2: 백업 후 삭제 권장

### 2.1 데이터베이스 백업 파일 (프로덕션 데이터 포함)
```bash
📦 backup_items.json                       # 56개 제품 데이터 (Supabase에 원본 존재)
📦 backup_companies.json                   # 56개 거래처 데이터 (Supabase에 원본 존재)
📦 backup_transactions.json                # 거래 데이터 (Supabase에 원본 존재)
📦 backup_process_operations.json          # 공정 운영 데이터 (Supabase에 원본 존재)
```

**백업 필요 이유**:
- scripts/backup-and-analyze.js가 생성한 프로덕션 데이터 백업
- Supabase에 원본 데이터 존재하지만 로컬 백업본으로 유용
- 긴급 복구 시나리오에 사용 가능

**권장 조치**:
1. 백업 파일을 `backups/` 디렉토리로 이동
2. .gitignore에 `backups/` 추가
3. 주기적으로 최신 백업으로 갱신

### 2.2 프로젝트 계획 디렉토리 (문서 보관용)
```bash
📁 .plan/                                  # Phase 0 계획 (2025-10-30)
📁 .plan2/                                 # Phase 1 계획
📁 .plan3/                                 # Phase 2 계획
📁 .plan4/                                 # Phase 3 계획
📁 .plan5/                                 # 개선 프로젝트 계획 (2025-10-31)
📁 .plan6/                                 # Wave 1-3 계획
📁 .plan7/                                 # 최종 계획
```

**백업 필요 이유**:
- 프로젝트 히스토리 및 설계 문서 포함
- 코드 참조는 없지만 문서 가치 있음
- 개발 과정 추적 및 의사결정 기록

**권장 조치**:
1. `docs/archive/` 디렉토리로 이동
2. 현재 활성 계획만 `.plan8/`에 유지
3. Git에 커밋 (히스토리 보존)

---

## 🔒 Phase 3: 절대 보존 (프로덕션 코드)

### 3.1 소스 코드
```bash
✅ src/                                    # 전체 애플리케이션 소스 코드
✅ src/components/process/ProcessStartButton.tsx
✅ src/components/process/ProcessCompleteButton.tsx
✅ src/components/process/LOTTracker.tsx
✅ src/app/api/process/                   # 공정 관리 API
```

**보존 이유**:
- 프로덕션 런타임 필수 파일
- ProcessStartButton, ProcessCompleteButton은 테스트 완료된 검증된 컴포넌트
- 삭제 시 애플리케이션 중단

### 3.2 프로덕션 스크립트
```bash
✅ scripts/                                # 프로덕션 유틸리티
✅ scripts/server-manager.ps1             # npm run dev:safe
✅ scripts/clean-build.ps1                # npm run clean
✅ scripts/check-port.ps1                 # 포트 충돌 체크
✅ scripts/backup-and-analyze.js          # 데이터베이스 백업 생성
```

**보존 이유**:
- package.json에서 npm scripts로 참조됨
- 서버 관리 및 빌드 프로세스에 필수
- 데이터베이스 백업 자동화에 사용

### 3.3 현재 활성 계획
```bash
✅ .plan8/                                 # 현재 프로젝트 계획 (Active)
```

**보존 이유**:
- 현재 개발 중인 계획서
- 최신 기능 명세 및 구현 가이드

---

## 🎯 권장 실행 순서

### Step 1: 즉시 삭제 (안전)
```bash
# 테스트 스크립트 (Root)
rm create-test-items.js
rm test-process-buttons.js
rm verify-test-items.js
rm open-browser-test.js

# 임시 파일
rm inventory-page-current.txt
rm inventory-page-snapshot.txt
rm wave2-*.txt
rm test_contract_document.txt

# 로그 파일
rm dev-server.log
rm -rf logs/

# 빌드 아티팩트 (또는 npm run clean 사용)
rm -rf .next/
rm -rf coverage/
rm tsconfig.tsbuildinfo
```

### Step 2: 백업 후 정리
```bash
# 데이터베이스 백업 이동
mkdir -p backups/
mv backup_*.json backups/

# .gitignore에 추가
echo "backups/" >> .gitignore

# 계획 디렉토리 아카이브
mkdir -p docs/archive/
mv .plan/ docs/archive/
mv .plan2/ docs/archive/
mv .plan3/ docs/archive/
mv .plan4/ docs/archive/
mv .plan5/ docs/archive/
mv .plan6/ docs/archive/
mv .plan7/ docs/archive/
```

### Step 3: Git 커밋
```bash
git add .gitignore backups/ docs/archive/
git commit -m "chore: 프로젝트 정리 - 테스트 파일 삭제, 백업/계획 아카이브"
```

### Step 4: 검증
```bash
# 개발 서버 재시작
npm run dev:safe

# localhost:5000 접속하여 정상 작동 확인
# ✅ 대시보드 로드 확인
# ✅ 품목 관리 페이지 확인
# ✅ 공정 관리 페이지 확인
```

---

## 🔍 Codex 안전성 검증 결과

### Git Grep 분석 요약
```
✅ create-test-items.js: 0 references
✅ test-process-buttons.js: 0 references
✅ verify-test-items.js: 0 references
✅ backup_*.json: docs/DATABASE_CLEANUP_REPORT.md 참조 (문서용)
⚠️ test-full-chain.js: .claude/settings.local.json:9 참조 (보존 필요)
```

### 웹 서버 상태 검증
```bash
$ curl -s http://localhost:5000 | head -20
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8"/>
  <title>태창 ERP 시스템</title>
  ...
</head>

✅ 정상 작동 확인 (2025-02-01 00:24:42 KST)
```

### 백그라운드 서버 프로세스
```
현재 실행 중인 dev 서버: 6개 인스턴스
- bash_id: 207a0c, 6ac9c5, 1c2913, 2d1a22, beec04, e8ef03

권장 조치: npm run restart로 중복 인스턴스 정리
```

---

## 📋 체크리스트

### 삭제 전 확인사항
- [ ] 백업 파일 (backup_*.json) 안전한 위치로 이동
- [ ] 계획 디렉토리 (.plan~.plan7) 아카이브
- [ ] Git 현재 변경사항 커밋
- [ ] 개발 서버 정상 작동 확인 (localhost:5000)

### 삭제 후 검증사항
- [ ] npm run dev:safe 정상 시작
- [ ] 대시보드 페이지 로드 확인
- [ ] 품목 관리 기능 테스트
- [ ] 공정 관리 기능 테스트
- [ ] ProcessStartButton, ProcessCompleteButton 작동 확인
- [ ] 테스트 스위트 실행: npm run test

### 선택적 추가 작업
- [ ] 데이터베이스 테스트 데이터 삭제 (TEST-RAW-001, TEST-FIN-001)
- [ ] 중복 dev 서버 프로세스 정리
- [ ] .gitignore 업데이트 (logs/, backups/, *.log)

---

## 🚨 주의사항

### 절대 삭제하지 말 것
1. **src/** - 전체 소스 코드 디렉토리
2. **scripts/** - 프로덕션 스크립트
3. **ProcessStartButton.tsx** - 검증 완료된 프로덕션 컴포넌트
4. **ProcessCompleteButton.tsx** - 검증 완료된 프로덕션 컴포넌트
5. **test-chain-automation.js** - .claude/settings.local.json에서 참조
6. **test-full-chain.js** - .claude/settings.local.json에서 참조
7. **.plan8/** - 현재 활성 계획

### 복구 방법
만약 실수로 삭제한 경우:
1. **Git**: `git checkout -- <file>` (커밋되지 않은 변경사항)
2. **Supabase 데이터**: scripts/backup-and-analyze.js 재실행
3. **빌드 아티팩트**: `npm run build` 또는 `npm run dev`

---

## 📊 최종 통계

| 항목 | 파일 수 | 예상 절약 |
|------|---------|----------|
| 테스트 스크립트 | 4 | ~100KB |
| 임시 파일 | 8 | ~2MB |
| 로그 파일 | 2+ | ~5MB |
| 빌드 아티팩트 | 4+ | ~200MB |
| 백업/계획 (이동) | 11 | ~50MB |
| **총계** | **29+** | **~260MB** |

---

**분석 완료일**: 2025년 2월 1일
**다음 단계**: 사용자 승인 후 Step 1 실행
**예상 소요 시간**: 5분 (검증 포함)
