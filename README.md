# 태창 ERP 시스템 (Taechang ERP System)

한글 자동차 부품 제조업체를 위한 클라우드 네이티브 ERP 시스템

**Tech Stack**: Next.js 15.5.4 + React 19.1.0 + TypeScript + Supabase PostgreSQL

**Production URL**: https://taeyaoung-erp-251017.vercel.app

**GitHub Repository**: https://github.com/kkhwan1/TaeYaoung_ERP_251020.git

## 🚀 빠른 시작

### 사전 요구사항
- Node.js 18.17 이상
- Supabase 프로젝트 (https://supabase.com)
- npm 또는 yarn

### Supabase 설정

1. **프로젝트 생성**: https://supabase.com/dashboard → New Project
2. **환경 변수** (`.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_ID=your-project-id
```
3. **스키마 적용**: Supabase Dashboard → SQL Editor → `database/schema.sql` 실행

### 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 개발 서버 실행 (포트 5000)
npm run dev

# 3. 브라우저에서 접속
http://localhost:5000
```

### 프로덕션 빌드

```bash
# 빌드
npm run build

# 프로덕션 실행
npm start
```

## 💾 데이터베이스

Supabase Dashboard → SQL Editor → `database/schema.sql` 실행

```bash
npm run db:types         # TypeScript 타입 생성
node database/check-schema.js  # 스키마 검증
```

## 🔧 주요 기능

### 마스터 데이터 관리
- **품목 관리** (`/master/items`)
  - 원자재, 제품, 스크랩 분류
  - 차종별 부품 관리
  - Excel 업로드 지원

- **거래처 관리** (`/master/companies`)
  - 고객사/공급사 분류
  - 이중 언어 지원 (한글/영문)

- **BOM 관리** (`/master/bom`)
  - 다단계 구성 지원
  - 자재 소요량 계산

### 재고 관리
- **재고 거래** (`/inventory`)
  - 입고/생산/출고 처리
  - 실시간 재고 업데이트
  - LOT 추적 관리

- **재고 현황** (`/stock`)
  - 실시간 재고 조회
  - 재고 이력 추적
  - 재고 조정 기능

## 📊 주요 API

- `/api/items`, `/api/companies`, `/api/bom` - 마스터 데이터 CRUD
- `/api/inventory/*` - 입고/생산/출고 거래 처리
- `/api/stock/*` - 재고 현황 및 이력 조회
- `/api/upload/*`, `/api/download/template/*` - Excel 업로드/다운로드

## 🛠️ 개발 명령어

```bash
npm run dev:safe         # Windows 최적화 개발 서버 (권장)
npm run build            # 프로덕션 빌드
npm run lint             # ESLint + 타입 체크
npm run test             # 테스트 실행
```

## 📝 프로젝트 현황

**전체 완료도**: 97/100 (Production Ready)

### Phase 1-2: 매출/매입/수금/지급 시스템 ✅ 100%
- ✅ 매출/매입 거래 관리 (8,500+ lines)
- ✅ 수금/지급 관리
- ✅ 자동 결제 상태 계산
- ✅ Excel 3-Sheet 내보내기
- ✅ 회계 모듈 (JSONB, 카테고리 분류)

### Phase 3: 재고 관리 시스템 ✅ 100%
- ✅ 입고/생산/출고 거래
- ✅ LOT 추적 관리
- ✅ 실시간 재고 업데이트

### Phase 4: 프론트엔드 최적화 ✅ 100%
- ✅ 대시보드 실시간 새로고침
- ✅ 가상 스크롤링 (대용량 데이터)
- ✅ React Query 캐싱

### Phase 5: 가격 분석 시스템 ✅ 100%
- ✅ 월별 가격 이력 관리
- ✅ BOM 기반 가격 계산
- ✅ 대량 가격 업데이트
- ✅ 가격 중복 관리

### Phase 6A: 도장 상태 관리 ✅ 100%
- ✅ 도장 전/후 상태 관리
- ✅ 미도장 부품 필터링
- ✅ 품목 데이터 마이그레이션

### 미완료 항목 (3%)
- ⏳ 인증/권한 시스템
- ⏳ 고급 리포팅
- ⏳ 문서 첨부 기능

## 🔐 보안 사항

- 모든 API 엔드포인트는 인증 필요 (현재 미구현)
- 소프트 삭제 패턴 사용 (`is_active` 필드)
- SQL Injection 방지 (Prepared Statements)
- XSS 방지 (React 자동 이스케이핑)

## 📚 문서

- [데이터베이스 스키마](docs/DATABASE.md) - Supabase PostgreSQL 스키마 완전 가이드
- [Claude Code 가이드](CLAUDE.md) - 개발 환경 및 아키텍처 설명
- [Excel 업로드 가이드](docs/excel-upload-guide.md)
- [프로젝트 계획](.plan/plan.md)
- [진행 상황](.plan/progress-tracker.md)

## 🚀 Vercel 배포

### Production 배포 정보
- **URL**: https://taeyaoung-erp-251017.vercel.app
- **Branch**: main
- **Environment**: Production

### 환경 변수 설정 (Vercel Dashboard)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_ID=your-project-id
NODE_ENV=production
```

### 배포 명령어
```bash
# Vercel CLI로 배포
vercel --prod --yes

# 배포 상태 확인
vercel ls

# 환경 변수 변경 후 재배포 (필수!)
vercel --prod --yes
```

⚠️ **중요**: Vercel은 환경 변수 변경 시 자동 재배포하지 않습니다. 수동으로 `vercel --prod --yes` 실행 필수!

## 📄 라이센스

Private - 태창 내부 사용만 허용

---

**마지막 업데이트**: 2025년 1월
**프로젝트 버전**: Phase 6A Complete (97/100 Production Ready)
**Tech Stack**: Next.js 15.5.4 + React 19.1.0 + TypeScript + Supabase PostgreSQL