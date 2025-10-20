# 태창 ERP 에이전트 활용 워크플로우 가이드

## 목차
1. [에이전트 시스템 개요](#에이전트-시스템-개요)
2. [사용 가능한 에이전트 목록](#사용-가능한-에이전트-목록)
3. [ERP 프로젝트 추천 에이전트](#erp-프로젝트-추천-에이전트)
4. [실전 워크플로우 패턴](#실전-워크플로우-패턴)
5. [작업별 에이전트 매핑](#작업별-에이전트-매핑)
6. [베스트 프랙티스](#베스트-프랙티스)

---

## 에이전트 시스템 개요

### SuperClaude 에이전트 프레임워크

태창 ERP 프로젝트는 **SuperClaude 에이전트 프레임워크**를 사용하여 28개의 전문화된 AI 에이전트를 활용할 수 있습니다.

**에이전트 유형**:
- **프로젝트 전용 에이전트**: 1개 (erp-specialist)
- **글로벌 에이전트**: 27개 (SuperClaude 프레임워크)

**에이전트 위치**:
- 프로젝트 에이전트: `C:\Users\USER\claude_code\FITaeYoungERP\.claudeCode\agents\`
- 글로벌 에이전트: `C:\Users\USER\.claude\agents\`
- 템플릿 에이전트: `C:\Users\USER\.claude-code-templates\agents\`

---

## 사용 가능한 에이전트 목록

### 프로젝트 전용 에이전트

#### 1. `erp-specialist` ⭐⭐⭐⭐⭐
- **전문 분야**: 한국 자동차 부품 제조 ERP 시스템
- **핵심 기술**: Next.js 15, React 19, Supabase PostgreSQL, 한국어 UTF-8 처리
- **주요 기능**:
  - 재고 트랜잭션 처리 (입고/생산/출고)
  - BOM 자동 차감 로직
  - 한국어 엑셀 통합 (업로드/다운로드)
  - 매출/매입/수금/지급 관리
  - 한국어 텍스트 인코딩 처리 (`request.text()` + `JSON.parse()` 패턴)

**사용 예시**:
```bash
# 입고 트랜잭션 API 구현
Use erp-specialist agent to implement 입고 transaction API with proper Korean encoding

# BOM 자동 차감 로직 개선
Use erp-specialist to optimize BOM auto-deduction logic
```

---

### 글로벌 에이전트 (데이터베이스 전문)

#### 2. `supabase-schema-architect` ⭐⭐⭐⭐⭐
- **전문 분야**: Supabase PostgreSQL 스키마 설계, RLS 정책, 마이그레이션
- **신뢰도**: 91%
- **주요 작업**:
  - 데이터베이스 스키마 설계 및 정규화
  - Row Level Security (RLS) 정책 설계
  - 안전한 마이그레이션 계획 및 실행
  - PostgreSQL 뷰 및 함수 최적화

**사용 예시**:
```bash
# 재고 스키마 RLS 정책 설계
/design --agent supabase-schema-architect "inventory_transactions RLS 정책"

# 회계 모듈 스키마 확장
/plan --agent supabase-schema-architect "accounting module schema expansion"
```

#### 3. `database-optimizer` ⭐⭐⭐⭐⭐
- **전문 분야**: SQL 쿼리 최적화, 인덱스 전략, 성능 튜닝
- **신뢰도**: 89%
- **주요 작업**:
  - 느린 쿼리 분석 및 최적화 (EXPLAIN ANALYZE)
  - N+1 문제 해결
  - 인덱스 설계 및 구현
  - 데이터베이스 성능 병목 현상 제거

**사용 예시**:
```bash
# 재고 조회 쿼리 성능 개선
/improve --agent database-optimizer @src/lib/db-unified.ts --focus performance

# 대시보드 통계 쿼리 최적화
/analyze --agent database-optimizer "dashboard aggregation queries"
```

#### 4. `database-architect` ⭐⭐⭐⭐
- **전문 분야**: 데이터베이스 아키텍처, 데이터 모델링, 정규화
- **신뢰도**: 93%
- **주요 작업**:
  - 엔터프라이즈급 데이터베이스 설계
  - 확장 가능한 데이터 모델 구축
  - 데이터 무결성 및 제약 조건 설계

**사용 예시**:
```bash
# 회계 모듈 데이터 모델 설계
/design --agent database-architect "accounting module data model"
```

---

### 글로벌 에이전트 (프론트엔드/백엔드)

#### 5. `frontend-developer` ⭐⭐⭐⭐⭐
- **전문 분야**: React 컴포넌트, 반응형 디자인, 접근성, 성능 최적화
- **신뢰도**: 92%
- **주요 작업**:
  - React 19 컴포넌트 개발
  - Tailwind CSS 4 스타일링
  - 가상 스크롤링 및 성능 최적화
  - WCAG 2.1 접근성 준수

**사용 예시**:
```bash
# 재고 현황 대시보드 컴포넌트
/implement --agent frontend-developer "재고 현황 대시보드 컴포넌트"

# 품목 목록 가상 스크롤링
/build --agent frontend-developer @src/components/VirtualTable --focus accessibility
```

#### 6. `backend-architect` ⭐⭐⭐⭐⭐
- **전문 분야**: RESTful API 설계, 마이크로서비스, 확장성
- **신뢰도**: 90%
- **주요 작업**:
  - API 엔드포인트 설계
  - 서비스 경계 정의
  - 확장 가능한 백엔드 아키텍처

**사용 예시**:
```bash
# 재고 관리 REST API 설계
/design --agent backend-architect "inventory management REST API endpoints"

# 회계 모듈 API 아키텍처
/analyze --agent backend-architect --focus scalability @src/app/api/accounting
```

#### 7. `fullstack-developer` ⭐⭐⭐⭐
- **전문 분야**: 풀스택 개발 (React, Next.js, Node.js, PostgreSQL)
- **주요 작업**:
  - 엔드투엔드 기능 구현
  - API 통합
  - 인증 시스템 구현

**사용 예시**:
```bash
# 사용자 인증 시스템 구현
Use fullstack-developer for implementing user authentication system

# 완전한 기능 구현 (프론트엔드 + 백엔드)
/implement --agent fullstack-developer "입출고 승인 워크플로우"
```

---

### 글로벌 에이전트 (코드 품질 & 문서화)

#### 8. `code-reviewer` ⭐⭐⭐⭐⭐
- **전문 분야**: 코드 품질, 베스트 프랙티스, 리팩토링, 클린 코드
- **신뢰도**: 90%
- **주요 작업**:
  - 코드 리뷰 및 품질 분석
  - SOLID 원칙 검증
  - 기술 부채 식별
  - 보안 취약점 검사

**사용 예시**:
```bash
# 전체 API 라우트 품질 검토
/improve --agent code-reviewer @src/app/api --focus quality

# 데이터베이스 레이어 리팩토링 제안
/analyze --agent code-reviewer @src/lib --focus maintainability
```

#### 9. `documentation-expert` ⭐⭐⭐⭐
- **전문 분야**: API 문서, README, 기술 문서 작성
- **신뢰도**: 91%
- **주요 작업**:
  - API 문서 생성 및 유지보수
  - 프로젝트 문서화
  - 코드 주석 개선

**사용 예시**:
```bash
# API 엔드포인트 문서 생성
/document --agent documentation-expert @src/app/api/inventory

# README 업데이트
/improve --agent documentation-expert @README.md
```

#### 10. `technical-writer` ⭐⭐⭐⭐
- **전문 분야**: 튜토리얼, 가이드, 사용자 매뉴얼
- **신뢰도**: 90%
- **주요 작업**:
  - 사용자 가이드 작성
  - 개발자 문서 작성
  - 프로세스 문서화

**사용 예시**:
```bash
# 재고 관리 사용자 가이드
/document --agent technical-writer "inventory management user guide"
```

---

### 글로벌 에이전트 (기타 전문 분야)

#### 11. `business-analyst` ⭐⭐⭐⭐
- **전문 분야**: KPI 추적, 메트릭 분석, 비즈니스 인텔리전스
- **신뢰도**: 86%

#### 12. `web-accessibility-checker` ⭐⭐⭐⭐
- **전문 분야**: WCAG 준수, 접근성 감사
- **신뢰도**: 88%

#### 13. `dependency-manager` ⭐⭐⭐
- **전문 분야**: npm 패키지 관리, 취약점 스캔
- **신뢰도**: 85%

#### 14. `architect-reviewer` ⭐⭐⭐
- **전문 분야**: 아키텍처 리뷰, SOLID 원칙
- **신뢰도**: 88%

#### 15. `database-admin` ⭐⭐⭐
- **전문 분야**: 데이터베이스 관리, 백업, 복제
- **신뢰도**: 86%

#### 16. `database-optimization` ⭐⭐⭐
- **전문 분야**: 실행 계획 분석, 쿼리 튜닝
- **신뢰도**: 87%

기타 전문 에이전트 (12개): product-strategist, competitive-intelligence-analyst, content-marketer, marketing-attribution-analyst, mcp-expert, command-expert, task-decomposition-expert, query-clarifier, search-specialist, computer-vision-engineer, hackathon-ai-strategist, url-link-extractor, url-context-validator

---

## ERP 프로젝트 추천 에이전트

### Top 10 에이전트 (우선순위 순)

| 순위 | 에이전트 | 전문 분야 | 주요 사용 사례 | 우선도 |
|------|---------|---------|---------------|-------|
| 1 | `erp-specialist` | 한국 ERP 시스템 | 재고 트랜잭션, BOM, 한국어 처리 | ⭐⭐⭐⭐⭐ |
| 2 | `supabase-schema-architect` | Supabase 데이터베이스 | 스키마 설계, RLS 정책, 마이그레이션 | ⭐⭐⭐⭐⭐ |
| 3 | `database-optimizer` | 쿼리 최적화 | 성능 튜닝, 인덱스 설계 | ⭐⭐⭐⭐⭐ |
| 4 | `frontend-developer` | React 컴포넌트 | UI 개발, 반응형 디자인 | ⭐⭐⭐⭐⭐ |
| 5 | `backend-architect` | API 설계 | REST API, 확장성 | ⭐⭐⭐⭐⭐ |
| 6 | `code-reviewer` | 코드 품질 | 리팩토링, 베스트 프랙티스 | ⭐⭐⭐⭐⭐ |
| 7 | `database-architect` | 데이터 모델링 | 스키마 설계, 정규화 | ⭐⭐⭐⭐ |
| 8 | `fullstack-developer` | 풀스택 개발 | 엔드투엔드 기능 구현 | ⭐⭐⭐⭐ |
| 9 | `documentation-expert` | 문서화 | API 문서, README | ⭐⭐⭐⭐ |
| 10 | `business-analyst` | 비즈니스 분석 | KPI, 메트릭 분석 | ⭐⭐⭐⭐ |

---

## 실전 워크플로우 패턴

### 워크플로우 1: 풀스택 기능 구현 (4단계)

**시나리오**: 새로운 재고 조정 기능 구현

```bash
# 1단계: 데이터베이스 스키마 설계
/design --agent supabase-schema-architect "stock_adjustments 테이블 설계"
# 출력: 스키마 정의, RLS 정책, 마이그레이션 파일

# 2단계: REST API 엔드포인트 설계
/design --agent backend-architect "재고 조정 REST API 엔드포인트"
# 출력: API 명세, 요청/응답 형식, 에러 처리

# 3단계: React 컴포넌트 구현
/implement --agent frontend-developer "재고 조정 사용자 인터페이스"
# 출력: React 컴포넌트, 폼 유효성 검사, API 통합

# 4단계: 코드 품질 검토
/improve --agent code-reviewer "전체 재고 조정 기능 검토"
# 출력: 코드 개선 사항, 보안 이슈, 성능 최적화 제안
```

**예상 시간**: 2-4시간
**자동화 수준**: 70-80%

---

### 워크플로우 2: 성능 최적화 (3단계)

**시나리오**: 대시보드 로딩 속도 개선

```bash
# 1단계: 데이터베이스 쿼리 최적화
/analyze --agent database-optimizer --focus performance @src/lib/db-unified.ts
# 출력: 느린 쿼리 식별, 인덱스 제안, EXPLAIN ANALYZE 결과

# 2단계: 쿼리 개선 구현
/improve --agent database-optimization "대시보드 집계 쿼리 최적화"
# 출력: 최적화된 쿼리, 인덱스 생성 SQL, 성능 테스트 결과

# 3단계: 프론트엔드 성능 최적화
/analyze --agent frontend-developer --focus performance @src/components/dashboard
# 출력: 번들 크기 최적화, 가상 스크롤링, 메모이제이션 제안
```

**예상 시간**: 1-2시간
**자동화 수준**: 60-70%

---

### 워크플로우 3: 보안 및 품질 감사 (3단계)

**시나리오**: 프로덕션 배포 전 전체 시스템 감사

```bash
# 1단계: 의존성 보안 스캔
/analyze --agent dependency-manager --security
# 출력: 취약점 리포트, 패키지 업데이트 제안, 라이선스 검토

# 2단계: API 보안 검토
/analyze --agent code-reviewer --focus security @src/app/api
# 출력: SQL 인젝션 검사, XSS 취약점, 인증/권한 검토

# 3단계: 접근성 검증
/analyze --agent web-accessibility-checker @src/components
# 출력: WCAG 준수 여부, 스크린 리더 호환성, 키보드 네비게이션
```

**예상 시간**: 1-2시간
**자동화 수준**: 80-90%

---

### 워크플로우 4: 한국어 데이터 처리 개선

**시나리오**: 한국어 텍스트 인코딩 문제 해결

```bash
# 1단계: ERP 전문가 분석
Use erp-specialist to analyze Korean text encoding issues in POST/PUT APIs
# 출력: 문제 API 식별, request.text() 패턴 적용 여부 확인

# 2단계: 백엔드 아키텍트 솔루션 설계
/design --agent backend-architect "standardized Korean text handling middleware"
# 출력: 미들웨어 설계, 전역 인코딩 정책

# 3단계: 코드 리뷰어 검증
/improve --agent code-reviewer @src/app/api --focus "Korean text encoding"
# 출력: 전체 API 라우트 검증, UTF-8 처리 일관성 확인
```

**예상 시간**: 30분-1시간
**자동화 수준**: 90%

---

### 워크플로우 5: 데이터베이스 마이그레이션

**시나리오**: 회계 모듈 스키마 추가

```bash
# 1단계: 스키마 설계
/design --agent supabase-schema-architect "accounting module schema with RLS"
# 출력: 테이블 정의, 관계, 인덱스, RLS 정책

# 2단계: 데이터 모델 검증
/analyze --agent database-architect @supabase/migrations --focus "data integrity"
# 출력: 정규화 검토, 외래 키 검증, 제약 조건 확인

# 3단계: 마이그레이션 실행 및 최적화
/implement --agent database-optimizer "apply accounting schema migration"
# 출력: 마이그레이션 스크립트, 롤백 계획, 성능 테스트
```

**예상 시간**: 2-3시간
**자동화 수준**: 60-70%

---

## 작업별 에이전트 매핑

### 데이터베이스 작업

| 작업 유형 | 추천 에이전트 | 대체 에이전트 | 명령 예시 |
|---------|-------------|--------------|----------|
| 스키마 설계 | `supabase-schema-architect` | `database-architect` | `/design --agent supabase-schema-architect "new table schema"` |
| 쿼리 최적화 | `database-optimizer` | `database-optimization` | `/improve --agent database-optimizer @src/lib/db-unified.ts` |
| RLS 정책 | `supabase-schema-architect` | - | `/implement --agent supabase-schema-architect "RLS policies"` |
| 마이그레이션 | `supabase-schema-architect` | `database-architect` | `/plan --agent supabase-schema-architect "migration strategy"` |
| 성능 분석 | `database-optimizer` | `database-optimization` | `/analyze --agent database-optimizer --focus performance` |

---

### API 개발 작업

| 작업 유형 | 추천 에이전트 | 대체 에이전트 | 명령 예시 |
|---------|-------------|--------------|----------|
| API 설계 | `backend-architect` | `fullstack-developer` | `/design --agent backend-architect "REST API endpoints"` |
| API 구현 | `erp-specialist` | `backend-architect` | `Use erp-specialist to implement inventory API` |
| API 문서화 | `documentation-expert` | `technical-writer` | `/document --agent documentation-expert @src/app/api` |
| 한국어 처리 | `erp-specialist` | - | `Use erp-specialist for Korean text encoding in POST APIs` |

---

### 프론트엔드 작업

| 작업 유형 | 추천 에이전트 | 대체 에이전트 | 명령 예시 |
|---------|-------------|--------------|----------|
| 컴포넌트 개발 | `frontend-developer` | `fullstack-developer` | `/implement --agent frontend-developer "dashboard component"` |
| UI 성능 최적화 | `frontend-developer` | - | `/improve --agent frontend-developer @src/components --focus performance` |
| 접근성 검증 | `web-accessibility-checker` | `frontend-developer` | `/analyze --agent web-accessibility-checker @src/components` |
| 반응형 디자인 | `frontend-developer` | - | `/build --agent frontend-developer "responsive layout"` |

---

### 코드 품질 작업

| 작업 유형 | 추천 에이전트 | 대체 에이전트 | 명령 예시 |
|---------|-------------|--------------|----------|
| 코드 리뷰 | `code-reviewer` | `architect-reviewer` | `/improve --agent code-reviewer @src --focus quality` |
| 리팩토링 | `code-reviewer` | - | `/analyze --agent code-reviewer @src/lib --focus maintainability` |
| 아키텍처 검토 | `architect-reviewer` | `backend-architect` | `/analyze --agent architect-reviewer @src --focus architecture` |
| 보안 감사 | `code-reviewer` | - | `/analyze --agent code-reviewer @src/app/api --focus security` |

---

### ERP 특화 작업

| 작업 유형 | 추천 에이전트 | 대체 에이전트 | 명령 예시 |
|---------|-------------|--------------|----------|
| 재고 트랜잭션 | `erp-specialist` | `backend-architect` | `Use erp-specialist to implement 입고 transaction` |
| BOM 로직 | `erp-specialist` | `backend-architect` | `Use erp-specialist to optimize BOM auto-deduction` |
| 엑셀 통합 | `erp-specialist` | `fullstack-developer` | `Use erp-specialist for Excel upload with Korean headers` |
| 매출/매입 관리 | `erp-specialist` | `business-analyst` | `Use erp-specialist for sales/purchase management` |
| 한국어 인코딩 | `erp-specialist` | - | `Use erp-specialist to fix Korean character corruption` |

---

## 베스트 프랙티스

### 1. 에이전트 선택 원칙

**✅ DO**:
- **전문가 우선**: 작업에 가장 특화된 에이전트 선택
- **프로젝트 에이전트 활용**: `erp-specialist`는 ERP 특화 작업에 최우선
- **충분한 컨텍스트 제공**: 파일 경로, 목표, 제약 사항 명시
- **계층적 접근**: 복잡한 작업은 여러 단계로 분해

**❌ DON'T**:
- **범용 에이전트 남용**: 전문가가 있을 때 범용 에이전트 사용
- **컨텍스트 생략**: 파일 경로나 작업 목표 없이 요청
- **잘못된 도메인 매칭**: UI 작업에 데이터베이스 에이전트 사용
- **에이전트 없이 복잡한 작업**: 전문 지식이 필요한 작업에 에이전트 미사용

---

### 2. 워크플로우 구성 전략

**단일 에이전트 작업** (1-2시간):
```bash
# 간단한 컴포넌트 추가
/implement --agent frontend-developer "품목 검색 컴포넌트"
```

**순차적 다중 에이전트** (2-4시간):
```bash
# 1단계: 설계
/design --agent supabase-schema-architect "stock_adjustments schema"

# 2단계: 구현 (1단계 결과 반영)
/implement --agent backend-architect "stock adjustments API"

# 3단계: 검증 (2단계 결과 반영)
/improve --agent code-reviewer "stock adjustments feature"
```

**병렬 다중 에이전트** (시간 단축):
```bash
# 동시에 여러 에이전트 실행 (독립적 작업)
/analyze --agent database-optimizer @src/lib/db-unified.ts --parallel
/analyze --agent frontend-developer @src/components --parallel
/analyze --agent dependency-manager --security --parallel
```

---

### 3. 에이전트와 SuperClaude 프레임워크 통합

**에이전트 + 페르소나**:
```bash
# 데이터베이스 최적화 + 백엔드 페르소나
/improve --agent database-optimizer @src/lib --persona-backend

# 프론트엔드 개발 + 프론트엔드 페르소나
/implement --agent frontend-developer "dashboard" --persona-frontend
```

**에이전트 + MCP 서버**:
```bash
# Supabase 스키마 설계 + Context7 (문서) + Sequential (분석)
/design --agent supabase-schema-architect "complex schema" --c7 --seq

# 데이터베이스 최적화 + Sequential (분석)
/improve --agent database-optimizer @src/lib --seq --think-hard
```

**에이전트 + 플래그**:
```bash
# 데이터베이스 최적화 + 깊은 사고 + 반복 개선
/improve --agent database-optimizer @src/lib --think-hard --loop

# 프론트엔드 개발 + Magic (UI 생성) + Context7 (패턴)
/implement --agent frontend-developer "차트 컴포넌트" --magic --c7
```

---

### 4. 한국어 처리 베스트 프랙티스

**한국어 데이터가 포함된 모든 작업**:
```bash
# erp-specialist 필수 사용
Use erp-specialist to implement [한국어 기능명] with proper UTF-8 encoding

# 예시: 품목 API 구현
Use erp-specialist to implement 품목 관리 API with Korean text handling
```

**한국어 문서 작성**:
```bash
# 한국어 문서화 (persona-scribe=ko 사용)
/document --persona-scribe=ko @src/app/api

# 한국어 주석 추가
/improve --agent documentation-expert @src/components --persona-scribe=ko
```

---

### 5. 성능 최적화 전략

**단계별 최적화 접근**:
```bash
# 1단계: 병목 현상 식별
/analyze --agent database-optimizer --focus performance @src/lib

# 2단계: 쿼리 최적화
/improve --agent database-optimization "slow dashboard queries"

# 3단계: 프론트엔드 최적화
/analyze --agent frontend-developer --focus performance @src/components

# 4단계: 검증
/test --focus performance
```

---

### 6. 프로덕션 배포 체크리스트

**배포 전 필수 검증** (3단계 워크플로우):
```bash
# 1단계: 보안 감사
/analyze --agent code-reviewer --focus security @src/app/api
/analyze --agent dependency-manager --security

# 2단계: 품질 검증
/improve --agent code-reviewer @src --focus quality
/analyze --agent web-accessibility-checker @src/components

# 3단계: 성능 테스트
/analyze --agent database-optimizer --focus performance
/test --focus performance --coverage
```

---

### 7. 일반적인 사용 패턴

**문제 해결 패턴**:
```bash
# 1. 문제 분석: erp-specialist 또는 관련 전문가
Use erp-specialist to analyze [문제 설명]

# 2. 솔루션 설계: architect 계열
/design --agent backend-architect "solution for [문제]"

# 3. 구현: developer 계열
/implement --agent [적절한 에이전트] "solution implementation"

# 4. 검증: code-reviewer
/improve --agent code-reviewer "implemented solution"
```

**신규 기능 개발 패턴**:
```bash
# 1. 요구사항 분석: business-analyst (선택)
/analyze --agent business-analyst "feature requirements"

# 2. 데이터베이스 설계: supabase-schema-architect
/design --agent supabase-schema-architect "feature database schema"

# 3. API 설계: backend-architect
/design --agent backend-architect "feature REST API"

# 4. UI 구현: frontend-developer
/implement --agent frontend-developer "feature user interface"

# 5. 통합 및 검증: code-reviewer
/improve --agent code-reviewer "complete feature implementation"
```

---

## 부록: 에이전트 빠른 참조

### 데이터베이스
- `supabase-schema-architect`: Supabase 스키마, RLS, 마이그레이션
- `database-optimizer`: 쿼리 최적화, 인덱스
- `database-architect`: 데이터 모델링, 정규화
- `database-optimization`: 실행 계획 분석
- `database-admin`: 백업, 복제, 모니터링

### 개발
- `erp-specialist`: 한국 ERP 시스템 (최우선)
- `fullstack-developer`: 풀스택 개발
- `frontend-developer`: React, UI/UX
- `backend-architect`: API, 마이크로서비스

### 품질 & 문서화
- `code-reviewer`: 코드 리뷰, 리팩토링
- `architect-reviewer`: 아키텍처 검토
- `documentation-expert`: API 문서, README
- `technical-writer`: 가이드, 튜토리얼
- `web-accessibility-checker`: 접근성 검증

### 비즈니스
- `business-analyst`: KPI, 메트릭
- `product-strategist`: 제품 전략
- `competitive-intelligence-analyst`: 경쟁 분석

### 기타
- `dependency-manager`: 패키지 관리, 보안
- `mcp-expert`: MCP 서버 통합
- `task-decomposition-expert`: 복잡한 작업 분해

---

## 문의 및 지원

에이전트 사용과 관련된 질문이나 개선 제안은 다음 파일을 참조하세요:
- SuperClaude 프레임워크: `C:\Users\USER\.claude\`
- 프로젝트 CLAUDE.md: `C:\Users\USER\claude_code\FITaeYoungERP\CLAUDE.md`
- 개별 에이전트 정의: `C:\Users\USER\.claude\agents\`

**마지막 업데이트**: 2025년 10월 15일
**버전**: 1.0
**프로젝트**: 태창 ERP 시스템
