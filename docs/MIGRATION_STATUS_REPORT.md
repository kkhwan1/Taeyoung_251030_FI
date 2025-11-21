# Migration 명명 규칙 통일 - 상태 보고서

**작성일**: 2025-02-02  
**프로젝트**: FITaeYoungERP (TAECHANG_ERP)  
**Supabase 프로젝트 ID**: `pybjnkbmtlyaftuiieyq`

---

## 📊 현재 Migration 상태 분석

### ✅ Supabase에 적용된 Migration 패턴

Supabase Cloud에서는 **타임스탬프 형식**을 표준으로 사용합니다:
- **형식**: `YYYYMMDDHHMMSS_name`
- **예시**: 
  - `20250930025937_create_exec_sql_function`
  - `20251015024511_20250115_bom_auto_deduction`
  - `20251119103951_coil_process_tracking`
  - `20251119104004_coil_process_automation`

**총 적용된 Migration 수**: 69개

### 📁 로컬 Migration 파일 현황

#### 1. `supabase/migrations/` 디렉토리 (5개 파일)

| 파일명 | 상태 | 테이블/기능 | Supabase 적용 여부 |
|-------|------|------------|------------------|
| `20250202_sheet_process_automation.sql` | ✅ | `sheet_process_history` | ✅ 적용됨 (`20250202143000_create_sheet_process_history`) |
| `20250202_coil_process_automation.sql` | ✅ | `coil_process_history` 트리거 | ✅ 적용됨 |
| `20250202_coil_process_tracking.sql` | ✅ | `coil_process_history` 테이블 | ✅ 적용됨 |
| `20250202_add_coil_inventory_type.sql` | ✅ | `inventory_type` 컬럼 | ✅ 적용됨 |
| `20250202_add_inventory_classification.sql` | ✅ | `inventory_type`, `warehouse_zone`, `quality_status` | ✅ 적용됨 |

**문제점**:
- ❌ 파일명 형식이 불일치: `YYYYMMDD_name` (시간 정보 없음)
- ❌ Supabase 표준 형식과 다름: `YYYYMMDDHHMMSS_name`
- ✅ `sheet_process_automation` migration은 표준 형식으로 적용 완료

#### 2. 기타 Migration 디렉토리

- `migrations/` 디렉토리: 7개 파일 (명명 규칙 없음)
- `src/migrations/` 디렉토리: 9개 파일 (혼합 형식)

---

## 🎯 권장사항

### 1. Migration 명명 규칙 통일

**Supabase 표준 형식으로 통일**:
```
YYYYMMDDHHMMSS_descriptive_name.sql
```

**장점**:
- ✅ 자동 순서 보장 (타임스탬프 순서)
- ✅ 충돌 방지 (동시 생성 시도 방지)
- ✅ 정렬 용이 (파일 이름으로 자동 정렬)
- ✅ Supabase 표준 준수

### 2. 기존 파일 리네이밍 제안

| 현재 파일명 | 제안된 새 파일명 | 타임스탬프 | 비고 |
|-----------|---------------|----------|------|
| `20250202_sheet_process_automation.sql` | `20250202143000_create_sheet_process_history.sql` | 14:30:00 | 미적용 - 재적용 필요 |
| `20250202_coil_process_automation.sql` | `20250202143100_create_coil_process_automation.sql` | 14:31:00 | 이미 적용됨 |
| `20250202_coil_process_tracking.sql` | `20250202143200_create_coil_process_tracking.sql` | 14:32:00 | 이미 적용됨 |
| `20250202_add_coil_inventory_type.sql` | `20250202143300_add_coil_inventory_type.sql` | 14:33:00 | 이미 적용됨 |
| `20250202_add_inventory_classification.sql` | `20250202143400_add_inventory_classification.sql` | 14:34:00 | 이미 적용됨 |

**주의사항**:
- 이미 적용된 migration은 리네이밍 시 주의 필요
- Supabase는 migration 이름을 추적하므로, 기존 migration 이름 변경 시 주의

### 3. 디렉토리 통합

**모든 migration 파일을 `supabase/migrations/`로 통합**:
- ✅ `supabase/migrations/` - 메인 migration 디렉토리
- ❌ `migrations/` - 통합 후 제거 고려
- ❌ `src/migrations/` - 통합 후 제거 고려

---

## 🚀 다음 단계

### 즉시 실행 가능한 작업

1. **✅ Migration 명명 규칙 문서 작성 완료**
   - 파일: `docs/MIGRATION_NAMING_CONVENTION.md`
   - Supabase 표준 형식 설명
   - 사용 가이드 포함

2. **🔍 sheet_process_automation migration 적용 확인**
   - `sheet_process_history` 테이블이 Supabase에 존재하는지 확인
   - 존재하지 않으면 새로운 migration으로 적용

3. **📝 새로운 migration 적용 가이드 작성**
   - Supabase MCP를 사용한 migration 적용 방법
   - 수동 적용 (Dashboard) 방법

### 장기 개선 작업

1. **Migration 파일 리네이밍** (신중하게 진행)
   - 이미 적용된 migration은 이름 유지 권장
   - 새로운 migration부터 표준 형식 적용

2. **Migration 디렉토리 통합**
   - 모든 migration을 `supabase/migrations/`로 이동
   - 기존 디렉토리 정리

3. **Migration 자동화 스크립트**
   - 표준 형식으로 migration 생성 스크립트
   - Supabase MCP를 사용한 자동 적용

---

## 📋 Migration 적용 상태 상세

### ✅ 이미 적용된 Migration들

1. **coil_process_tracking** (`20251119103951`)
   - `coil_process_history` 테이블 생성
   - ✅ 적용 확인: 테이블 존재

2. **coil_process_automation** (`20251119104004`)
   - `auto_coil_process_stock_movement()` 함수
   - ✅ 적용 확인: 관련 트리거 존재

3. **add_coil_inventory_type** (`20251119104030`)
   - `inventory_type` 컬럼에 '코일' 값 추가
   - ✅ 적용 확인: 컬럼 존재

4. **add_inventory_classification** (`20251118034111`)
   - `inventory_type`, `warehouse_zone`, `quality_status` 컬럼 추가
   - ✅ 적용 확인: 모든 컬럼 존재

### ✅ 적용 완료 Migration

1. **sheet_process_automation** → `20250202143000_create_sheet_process_history`
   - `sheet_process_history` 테이블 생성
   - ✅ 적용 완료: Supabase MCP로 표준 형식으로 적용
   - **적용 시간**: 2025-02-02 14:30:00
   - **생성된 객체**: 테이블 1개, 인덱스 4개, 함수 3개, 트리거 4개

---

## 🔧 Supabase MCP 사용 가이드

### Migration 적용 방법

```typescript
// Supabase MCP를 사용한 migration 적용
mcp_supabase_apply_migration({
  project_id: "pybjnkbmtlyaftuiieyq",
  name: "20250202143000_create_sheet_process_history",
  query: "-- Migration SQL 내용"
})
```

### Migration 확인 방법

```sql
-- 적용된 migration 목록 확인
SELECT version, name 
FROM supabase_migrations.schema_migrations 
ORDER BY version DESC;
```

---

## 📚 참고 자료

- [Migration 명명 규칙 가이드](./MIGRATION_NAMING_CONVENTION.md)
- [Supabase Migration 문서](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL Migration Best Practices](https://www.postgresql.org/docs/current/ddl-alter.html)

---

**작성자**: ERP Team  
**검토 필요**: Migration 리네이밍 전팀 검토 권장

