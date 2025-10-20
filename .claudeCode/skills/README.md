# 태창 ERP 시스템 - 전용 Skills

이 디렉토리는 태창 ERP 프로젝트를 위한 맞춤형 Claude Code Skills를 포함합니다.

## 📚 사용 가능한 Skills

### 1. **erp-korean-encoding** 🔤
한글 텍스트 인코딩 전문가 - Next.js API에서 한글 깨짐 방지

**사용 시기**:
- API Route 작성 시 (POST/PUT)
- 한글 데이터 처리가 필요한 경우
- UTF-8 인코딩 문제 디버깅

**예시**:
```
Use erp-korean-encoding skill to fix Korean text encoding in this API route
```

### 2. **erp-excel-integration** 📊
Excel 3-Sheet 내보내기 패턴 전문가

**사용 시기**:
- Excel 내보내기 API 작성
- 통계 리포트 생성
- 다중 시트 워크북 생성

**예시**:
```
Use erp-excel-integration skill to create sales export API with 3 sheets
```

### 3. **erp-supabase-helper** 🗄️
Supabase 쿼리 패턴 전문가

**사용 시기**:
- 데이터베이스 쿼리 작성
- Domain Helpers 활용
- JSONB 필드 작업

**예시**:
```
Use erp-supabase-helper skill to implement company filtering with JSONB
```

### 4. **erp-phase-tester** 🧪
Phase별 테스트 자동화 전문가

**사용 시기**:
- 새로운 Phase 구현 시
- API 엔드포인트 테스트
- 한글 데이터 검증

**예시**:
```
Use erp-phase-tester skill to create test suite for Phase P5
```

---

## 🚀 Quick Start

### Skills 사용 방법

1. **Skill 명시적 호출**:
```
Use [skill-name] skill to [task description]
```

2. **자동 활성화**:
Skills는 작업 컨텍스트에 따라 자동으로 활성화될 수 있습니다.

### 설치 확인

```bash
# 프로젝트 루트에서
ls .claudeCode/skills/
```

다음 4개 디렉토리가 보여야 합니다:
- `erp-korean-encoding/`
- `erp-excel-integration/`
- `erp-supabase-helper/`
- `erp-phase-tester/`

---

## 📖 상세 문서

각 스킬 디렉토리의 `SKILL.md` 파일에서 상세 가이드를 확인하세요:

- [erp-korean-encoding/SKILL.md](./erp-korean-encoding/SKILL.md)
- [erp-excel-integration/SKILL.md](./erp-excel-integration/SKILL.md)
- [erp-supabase-helper/SKILL.md](./erp-supabase-helper/SKILL.md)
- [erp-phase-tester/SKILL.md](./erp-phase-tester/SKILL.md)

---

## 🔧 커스터마이징

새로운 스킬 추가 방법:

1. **디렉토리 생성**:
```bash
mkdir .claudeCode/skills/my-new-skill
```

2. **SKILL.md 작성**:
```markdown
---
name: my-new-skill
description: Clear description of what this skill does and when to use it
---

# My New Skill

[Instructions for Claude to follow...]
```

3. **프로젝트에서 테스트**:
```
Use my-new-skill skill to [task]
```

---

## 📝 Skills 업데이트 이력

- **2025-10-19**: 초기 4개 스킬 생성
  - erp-korean-encoding
  - erp-excel-integration
  - erp-supabase-helper
  - erp-phase-tester

---

## 🔗 관련 문서

- [CLAUDE.md](../../CLAUDE.md) - 전체 프로젝트 가이드
- [SUPERCLAUDE.md](../../SUPERCLAUDE.md) - SuperClaude 통합 정보
- [Anthropic Skills 공식 문서](https://support.claude.com/en/articles/12512176-what-are-skills)

---

**Last Updated**: 2025-10-19
**프로젝트**: 태창 ERP 시스템 (Phase P4 완료)
