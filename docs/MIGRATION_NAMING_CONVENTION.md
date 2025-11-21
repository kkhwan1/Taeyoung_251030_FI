# Migration 파일 명명 규칙 통일 가이드

## 📋 현재 상황 분석

### Supabase에 적용된 Migration 패턴
Supabase Cloud에서는 **타임스탬프 형식**을 사용합니다:
- 형식: `YYYYMMDDHHMMSS_name.sql`
- 예시: `20250930025937_create_exec_sql_function`
- 장점: 자동 순서 보장, 충돌 방지, 정렬 용이

### 로컬 Migration 파일 현황

#### 1. `supabase/migrations/` 디렉토리
- 형식: `YYYYMMDD_name.sql`
- 예시: 
  - `20250202_sheet_process_automation.sql`
  - `20250202_coil_process_automation.sql`
  - `20250202_coil_process_tracking.sql`
  - `20250202_add_coil_inventory_type.sql`
  - `20250202_add_inventory_classification.sql`

#### 2. `migrations/` 디렉토리
- 형식: `create_*.sql`, `add_*.sql`
- 예시:
  - `create_invoice_items_table.sql`
  - `add_update_stock_trigger.sql`

#### 3. `src/migrations/` 디렉토리
- 혼합 형식
- 예시:
  - `20250122_create_contracts.sql`
  - `004-create-portal-tables.sql`

## 🎯 통일된 명명 규칙

### 권장 형식: Supabase 표준 타임스탬프 형식

```
YYYYMMDDHHMMSS_descriptive_name.sql
```

### 규칙 상세

1. **타임스탬프**: `YYYYMMDDHHMMSS`
   - 년도 4자리
   - 월 2자리 (01-12)
   - 일 2자리 (01-31)
   - 시간 2자리 (00-23)
   - 분 2자리 (00-59)
   - 초 2자리 (00-59)

2. **설명 이름**: `snake_case`
   - 소문자 사용
   - 단어 구분은 언더스코어(`_`)
   - 간결하고 설명적인 이름
   - 동사로 시작 (create, add, modify, drop, etc.)

3. **예시**:
   - ✅ `20250202140300_create_sheet_process_history.sql`
   - ✅ `20250202140400_add_coil_inventory_type.sql`
   - ✅ `20250202140500_create_coil_process_tracking.sql`
   - ❌ `20250202_sheet_process_automation.sql` (시간 없음)
   - ❌ `create_invoice_items_table.sql` (타임스탬프 없음)

### Migration 파일 구조

```sql
-- Migration: [간단한 설명]
-- Date: YYYY-MM-DD HH:MM:SS
-- Purpose: [목적 설명]
-- Related: [관련 이슈 또는 요구사항]
-- Author: [작성자 또는 팀]

-- Step 1: [단계 설명]
-- ... SQL 코드 ...

-- Step 2: [단계 설명]
-- ... SQL 코드 ...

-- Verification queries (commented out)
-- SELECT ...
```

## 🔄 Migration 파일 통합 계획

### 단계 1: 기존 파일 리네이밍

| 현재 파일 | 새로운 이름 | 타임스탬프 |
|---------|-----------|----------|
| `20250202_sheet_process_automation.sql` | `20250202143000_create_sheet_process_history.sql` | 추정 |
| `20250202_coil_process_automation.sql` | `20250202143100_create_coil_process_automation.sql` | 추정 |
| `20250202_coil_process_tracking.sql` | `20250202143200_create_coil_process_tracking.sql` | 추정 |
| `20250202_add_coil_inventory_type.sql` | `20250202143300_add_coil_inventory_type.sql` | 추정 |
| `20250202_add_inventory_classification.sql` | `20250202143400_add_inventory_classification.sql` | 추정 |

### 단계 2: 디렉토리 통합

모든 migration 파일을 `supabase/migrations/` 디렉토리로 통합:
- ✅ `supabase/migrations/` - 메인 migration 디렉토리 (유지)
- ❌ `migrations/` - 통합 후 제거 또는 문서화
- ❌ `src/migrations/` - 통합 후 제거 또는 문서화

### 단계 3: Supabase에 적용

Supabase MCP를 사용하여 migration 적용:
1. 타임스탬프 순서대로 확인
2. 아직 적용되지 않은 migration 확인
3. 순차적으로 적용

## 📝 Migration 작성 체크리스트

- [ ] 파일명에 타임스탬프 포함 (`YYYYMMDDHHMMSS`)
- [ ] 설명적인 이름 사용 (`snake_case`)
- [ ] 파일 헤더에 메타데이터 포함
- [ ] 단계별 주석 추가
- [ ] 롤백 가능한 경우 롤백 스크립트 포함
- [ ] 검증 쿼리 주석 처리로 포함

## 🚀 적용 방법

### Supabase MCP 사용

```bash
# Migration 적용
mcp_supabase_apply_migration(
  project_id: "프로젝트ID",
  name: "YYYYMMDDHHMMSS_descriptive_name",
  query: "SQL 쿼리 내용"
)
```

### 수동 적용 (Supabase Dashboard)

1. Supabase Dashboard → SQL Editor 이동
2. Migration SQL 복사
3. 실행 및 결과 확인

## 📚 참고 자료

- [Supabase Migration 가이드](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL Migration Best Practices](https://www.postgresql.org/docs/current/ddl-alter.html)

---

**마지막 업데이트**: 2025-02-02
**작성자**: ERP Team

