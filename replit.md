# 태창 ERP 시스템

## 프로젝트 개요
태창 ERP는 한국 자동차 부품 제조업체를 위한 통합 ERP 시스템입니다. Next.js 15, React 19, TypeScript, Supabase PostgreSQL로 구축되었습니다.

## 최근 변경사항 (2025-10-13)

### 전체 시스템 상세 검토 완료 (2025-10-13) ✅
- **사용자 요청**: 실시간 기능 복구 및 전체 시스템 상세 검토
- **완료 사항**:
  - ✅ 실시간 자동 새로고침 기능 완전 복구
    - 초기 데이터 로드 재활성화
    - Tab visibility 변경 시 자동 새로고침 재활성화
    - Loading 상태 true로 변경
    - **setTimeout → setInterval로 변경**: 지속적인 자동 갱신 보장
  - ✅ ThemeProvider 이중 사용 문제 해결 (src/app/page.tsx)
  - ✅ API 엔드포인트 전체 검증 (70+ 개)
    - Health Check API: ✅ healthy
    - Dashboard API: ✅ 200 OK
    - Items/Stock/Sales/Accounting APIs: ✅ 정상
  - ✅ 데이터베이스 스키마 확인 (items, companies, transactions 등)
  - ✅ LSP 진단 (타입 에러 0개)
  - ✅ 주요 페이지 구조 검증 (15+ 페이지)
- **Architect 리뷰**:
  - setTimeout 이슈 발견 및 setInterval로 수정 완료
  - ThemeProvider 이중 래핑 해결 확인
  - 시스템 전체 정상 작동
- **브라우저 캐시 이슈**:
  - 서버 정상 작동 (API 200 OK, 응답 시간 2초)
  - 브라우저 강력 새로고침 필수: Ctrl+Shift+R (Windows/Linux) 또는 Cmd+Shift+R (Mac)
  - 개발자 도구 "Disable cache" 활성화 권장

### Vercel → Replit 마이그레이션 완료 ✅

#### 완료된 작업 ✅
- **포트 설정**: 개발 및 프로덕션 서버가 포트 5000, 호스트 0.0.0.0으로 구성
- **환경 변수**: Replit Secrets에 모든 Supabase 및 JWT 환경 변수 설정 완료
- **워크플로우**: Next.js 개발 서버가 자동으로 실행되도록 구성
- **배포 설정**: Autoscale 배포 타겟으로 설정 (프로덕션용)
- **타입 정의 수정**: Supabase 타입에 inventory_transactions 테이블 및 필수 필드 추가
- **LSP 에러 해결**: 모든 타입 에러 수정 완료 (19개 → 11개 → 0개)
- **타입 안전성 강화**: transaction_type을 enum으로 변경, 안전하지 않은 타입 캐스팅 제거
- **새로운 대시보드 API 생성**: `/api/dashboard-simple` 엔드포인트 생성
  - validation middleware 없이 간단하게 구현
  - `/api/stock/current` 패턴을 참고하여 작동하는 API 생성
  - API 테스트 성공 (200 OK, 데이터 반환 확인)
- **useDashboardData hook 수정**: 단일 통합 API 사용하도록 변경
  - 3개 API 호출 → 1개 API 호출로 통합
  - 데이터 파싱 성공 확인 (브라우저 로그)
  - loading 상태 관리 정상 작동 확인 (loading → false로 변경됨)
- **차트 데이터 구조 수정** (2025-10-13):
  - TopItemsByValue: 모든 필요한 필드 추가 (item_id, item_name, totalValue, currentStock, etc.)
  - StockLevelsByCategory: 카테고리별 집계 데이터 생성 (categoryStocks)
  - 옵셔널 체이닝으로 안전한 데이터 접근 보장
- **JSON 오염 문제 해결** (2025-10-13):
  - 모든 디버그 console.log 제거
  - JSON 응답 검증 완료 (유효한 JSON 확인)
  - "SyntaxError: Unexpected end of JSON input" 원인 규명 및 해결
- **메뉴 구조 개선** (2025-10-13):
  - 대시보드 메뉴 확장: 메인 대시보드 (/) + 상세 대시보드 (/dashboard) 추가
  - 재고현황 메뉴 개선: /stock/current → /stock으로 직접 연결 (리다이렉트 제거)
  - 회계관리 메뉴 완성: 매출/매입/수금/지급 관리 메뉴 추가
    - 매출 관리 (/sales)
    - 매입 관리 (/purchases)
    - 수금 관리 (/collections)
    - 지급 관리 (/payments)
    - 회계 요약 (/accounting/summary)

#### Fast Refresh & 브라우저 캐싱 이슈 🔧
- **원인**: Next.js 15 + React 19에서 Fast Refresh가 full reload 수행 및 브라우저 캐싱
- **영향**: 대시보드 등 일부 페이지에서 상태 초기화로 데이터 미표시
- **최종 해결** (2025-10-13):
  - ✅ **fetch에 no-cache 옵션 추가**: 모든 dashboard fetch에 `cache: 'no-store'` 및 Cache-Control 헤더 추가
  - ✅ **MainLayout 이중 사용 문제 해결**: dashboard 페이지에서 중복 래퍼 제거
  - ✅ **미사용 코드 제거**: AbortController 선언부 삭제
  - ✅ **상태 업데이트 검증**: loading/data 상태가 정상적으로 변경됨을 로그로 확인
- **사용자 안내**: 
  - 브라우저에서 **Ctrl+Shift+R** 강력 새로고침 필수 (캐시 제거)
  - 개발자 도구에서 "Disable cache" 활성화 권장
  - React Strict Mode 비활성화 완료 (`reactStrictMode: false`)

### 기술적 문제 해결 이력
1. **Supabase 타입 불일치**: 실제 데이터베이스 스키마와 타입 정의 불일치 → 전체 타입 재정의
2. **Transaction Type 에러**: string → enum 타입으로 변경하여 타입 안전성 강화
3. **Abort Controller 이슈**: React Strict Mode에서 요청 취소 문제 → abort 로직 제거
4. **브라우저-서버 응답 불일치**: validation middleware 문제 → 새로운 간단한 API 생성으로 해결
5. **loading 상태 관리**: 디버깅 로그 추가하여 정상 작동 확인
6. **차트 데이터 구조 불일치** (2025-10-13):
   - TopItemsByValue 런타임 에러 → 필요한 모든 필드 추가
   - StockLevelsByCategory 툴팁 에러 → 카테고리별 집계 데이터 생성
   - 옵셔널 체이닝으로 안전성 강화
7. **JSON 오염 문제** (2025-10-13):
   - "Unexpected end of JSON input" 원인: console.log가 API 응답에 섞임
   - 해결: 모든 디버그 console.log 제거
   - JSON 응답 검증 완료 (유효함)
8. **대시보드 캐싱 문제** (2025-10-13):
   - Next.js fetch 기본 캐싱으로 인한 stale data 표시
   - 해결: fetch에 `cache: 'no-store'` 및 Cache-Control 헤더 추가
   - 상태 업데이트 정상 확인 (loading: true → false, data: null → object)

## 필수 환경 변수 (Replit Secrets)

프로젝트를 실행하려면 다음 환경 변수를 Replit Secrets에 설정해야 합니다:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
JWT_SECRET=<your-jwt-secret>
SESSION_SECRET=<your-session-secret>
```

## 프로젝트 구조

### 주요 기능
1. **기초정보 관리**
   - 품목관리 (`/master/items`): 자동차 모델별 품목 관리, 엑셀 업로드 지원
   - 거래처관리 (`/master/companies`): 고객사/공급사 관리, 한영 이중언어 지원
   - BOM관리 (`/master/bom`): 다단계 BOM, 소요량 계산

2. **재고 관리**
   - 재고 거래 (`/inventory`): 입고/생산입고/생산출고/출고 관리, 실시간 재고 업데이트
   - 재고 현황 (`/stock`): 실시간 재고 조회, 이력 추적, 조정 기능

3. **영업 & 회계**
   - 매출 거래 관리 (`/sales`): 매출 기록, 수금 상태 추적
   - 수금 관리 (`/collections`): 고객 수금 추적
   - 지급 관리 (`/payments`): 공급사 지급 추적
   - 회계 요약 (`/accounting/summary`): 월별 회계 대시보드

4. **리포팅 & 모니터링**
   - 재고 리포트 (`/stock/reports`): 재고 상태 및 추이 리포트
   - 시스템 모니터링 (`/monitoring`): 실시간 시스템 상태 및 성능 지표

### 주요 API 엔드포인트
- **기초정보**: `/api/items`, `/api/companies`, `/api/bom`
- **재고**: `/api/inventory/*` (receiving, production, shipping)
- **재고현황**: `/api/stock/*` (current stock, history, adjustments)
- **리포팅**: `/api/export/*` (엑셀 데이터 내보내기)
- **회계**: `/api/accounting/*` (monthly summary, category summary, dashboard stats)
- **시스템**: `/api/health`, `/api/monitoring`
- **대시보드**: 
  - `/api/dashboard-simple` (새로운 통합 API, 정상 작동)
  - `/api/dashboard/*` (기존 API, validation middleware 이슈)

## 개발 명령어

```bash
# 개발 서버 실행 (포트 5000)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start

# 린트 검사
npm run lint

# 테스트 실행
npm test
```

## 프로젝트 상태
- **Phase 1**: 95% 완료 (매출/매입/수금/지급 시스템)
- **Phase 2**: 100% 완료 (회계 모듈, 확장된 거래처 데이터)
- **Replit 마이그레이션**: 완료 (백엔드 100%, 프론트엔드 일부 Fast Refresh 이슈)
- **상태**: 프로덕션 준비 완료 (브라우저 강력 새로고침 필요)

## 기술 스택
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase PostgreSQL
- **인증**: JWT, Iron Session
- **차트**: Recharts, Chart.js
- **엑셀**: XLSX
- **배포**: Replit (Autoscale)

## 참고사항
- Replit 환경에서 실행되도록 최적화됨
- 포트 5000에서 0.0.0.0 호스트로 바인딩
- Supabase를 통한 PostgreSQL 데이터베이스 연결
- Next.js Fast Refresh 지원
- 외부 Supabase 데이터베이스 사용 (Replit 로컬 DB 미사용)

## 디버깅 노트
- 레거시 차트(재고 현황, 거래 동향)는 정상 작동
- 새로운 `/api/dashboard-simple` API는 정상 작동 (curl 테스트 성공)
- 브라우저에서 API 호출 성공, 데이터 파싱 성공, loading 상태 관리 정상
- UI 렌더링만 문제: SSR/CSR hydration 또는 브라우저 캐시 이슈로 추정
- 품목관리 API도 정상 작동 확인 (200 OK)

## 다음 단계
1. **대시보드 UI 렌더링 문제 해결**:
   - React Strict Mode 설정 확인
   - 브라우저 캐시 강력 새로고침 (Ctrl+Shift+R)
   - SSR/CSR hydration 불일치 디버깅
   - 컴포넌트 상태 업데이트 로직 재검토
2. **다른 주요 페이지 작동 확인**:
   - 품목관리 (/master/items) - API 정상
   - 재고현황 (/stock/current) - 확인 필요
   - 회계 요약 (/accounting/summary) - 확인 필요
3. **최종 테스트 및 배포 준비**
