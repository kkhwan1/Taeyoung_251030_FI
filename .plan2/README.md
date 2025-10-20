# .plan2 디렉토리 구조

**최종 업데이트**: 2025-01-15

---

## 📁 현재 문서 구조

```
.plan2/
├── README.md                           ← 이 파일
├── PHASE_P0_DEVELOPMENT_PLAN.md        ← 🎯 현재 개발 계획 (메인 문서)
├── archive/                            ← 과거 분석 문서 보관
│   ├── Phase5_통합_보고서_개발_로드맵.md
│   ├── Phase4_Gap_Analysis_우선순위_매트릭스.md
│   ├── Phase3_현재_웹_BOM_시스템_분석.md
│   ├── PHASE3_INVENTORY_IMPLEMENTATION_PLAN.md
│   ├── Phase1_BOM_Implementation_Plan.md
│   ├── BOM_Migration_Step_by_Step_Guide.md
│   └── BOM_Migration_Manual_Application_Guide.md
└── 참고/                               ← 원본 대화 및 Excel 분석
    ├── 대화 요약본_새로운 노트 메모_작성시간 포함.txt
    ├── EXCEL_INVENTORY_ANALYSIS.md
    └── [4개 Excel 파일]
```

---

## 🎯 개발 시작점

**지금 개발을 시작하려면 여기부터 읽으세요**:

### [PHASE_P0_DEVELOPMENT_PLAN.md](PHASE_P0_DEVELOPMENT_PLAN.md)

**내용**:
- ✅ 4주 개발 일정 (2025-01-15 ~ 2025-02-12)
- ✅ Week 1-2: BOM 자동차감 트리거 구현 (완성된 SQL 스크립트 포함)
- ✅ Week 3-4: 일별 재고 추적 시스템 (Materialized View + API + UI)
- ✅ 테스트 시나리오 및 성공 기준
- ✅ 성능 목표 및 위험 완화 계획

**왜 이 문서인가?**:
- 사용자 대화에서 직접 나온 요구사항 ("알아서 떨려야")
- 실행 가능한 코드 포함 (복사-붙여넣기 가능)
- 비즈니스 임팩트 명확 (90% 시간 절감, 95% 오류 감소)

---

## 📚 참고 자료 (선택적)

### 1. 원본 대화 및 요구사항
- **파일**: `참고/대화 요약본_새로운 노트 메모_작성시간 포함.txt`
- **내용**: 2025.10.13 사용자 미팅 내용
- **핵심 인용**: "bom 구성만 완벽하면 모든 게 다 나옴", "알아서 떨려야"

### 2. Excel 시스템 분석
- **파일**: `참고/EXCEL_INVENTORY_ANALYSIS.md`
- **내용**: 기존 Excel 파일 4개 상세 분석 (781컬럼 구조)
- **용도**: 현재 시스템 이해 및 마이그레이션 참고

### 3. 과거 분석 문서 (archive/)
- **Phase5_통합_보고서_개발_로드맵.md**: 가장 포괄적인 통합 분석 (918 lines)
- **Phase4_Gap_Analysis_우선순위_매트릭스.md**: Gap 분석
- **Phase3_현재_웹_BOM_시스템_분석.md**: 현재 웹 시스템 분석
- 나머지 문서들: 초기 구현 계획 (이제는 P0 계획으로 통합됨)

**왜 archive 폴더인가?**:
- 역사적 맥락 보존
- 새로운 팀원 온보딩 시 참고
- 현재 개발에는 불필요 (P0 계획에 이미 통합됨)

---

## 🚀 빠른 시작 가이드

### Step 1: 현재 계획 읽기
```bash
# Windows
notepad PHASE_P0_DEVELOPMENT_PLAN.md

# VS Code
code PHASE_P0_DEVELOPMENT_PLAN.md
```

### Step 2: 마이그레이션 스크립트 실행
```sql
-- supabase/migrations/20250115_bom_auto_deduction.sql
-- PHASE_P0_DEVELOPMENT_PLAN.md의 Week 1-2 섹션 참조
```

### Step 3: 테스트 실행
```bash
npm run test:api
npm run test -- bom-auto-deduction.test.ts
```

### Step 4: UI 컴포넌트 추가
```bash
# src/components/stock/DailyStockCalendar.tsx
# PHASE_P0_DEVELOPMENT_PLAN.md의 Week 3-4 섹션 참조
```

---

## 📖 문서 사용 가이드

### 새로운 개발자가 왔을 때
1. **이 파일 (README.md)** 읽기
2. **PHASE_P0_DEVELOPMENT_PLAN.md** 읽기
3. **참고/대화 요약본** 읽기 (선택)
4. **archive/** 문서는 필요할 때만 참조

### 버그 수정/기능 추가 시
1. **PHASE_P0_DEVELOPMENT_PLAN.md** 성공 기준 확인
2. 관련 섹션 (Week 1-2 또는 Week 3-4) 참조
3. 코드 복사 → 수정 → 테스트

### 새로운 Phase 시작 시 (P1, P2, ...)
1. **PHASE_P[N]_DEVELOPMENT_PLAN.md** 새로 생성
2. P0 계획을 템플릿으로 사용
3. archive/에서 필요한 분석 참조
4. 이 README 업데이트

---

## 🔍 문서 선택 기준

| 질문 | 읽을 문서 |
|------|-----------|
| "지금 뭘 개발해야 하나?" | **PHASE_P0_DEVELOPMENT_PLAN.md** |
| "왜 자동차감이 필요한가?" | 참고/대화 요약본 |
| "Excel 시스템이 어떻게 생겼나?" | 참고/EXCEL_INVENTORY_ANALYSIS.md |
| "전체 시스템 분석이 궁금해" | archive/Phase5_통합_보고서 |
| "초기 BOM 계획은?" | archive/Phase1_BOM_Implementation_Plan.md |

---

## ⚠️ 주의사항

### 문서 수정 시
- **PHASE_P0_DEVELOPMENT_PLAN.md 만 수정** (다른 문서는 읽기 전용)
- 코드 예제 수정 시 실제 파일과 동기화
- 성공 기준 변경 시 팀 합의 필요

### 문서 추가 시
- 새로운 Phase는 `PHASE_P[N]_DEVELOPMENT_PLAN.md` 형식
- 임시 분석은 `참고/` 폴더에
- 완료된 Phase 계획은 `archive/`로 이동

---

## 📞 도움말

### 문서 관련 질문
- 이 README 다시 읽기
- PHASE_P0_DEVELOPMENT_PLAN.md 상단 Executive Summary 참조

### 기술 질문
- `C:\Users\USER\claude_code\FITaeYoungERP\CLAUDE.md` 참조
- SuperClaude 프레임워크: `C:\Users\USER\.claude\CLAUDE.md`

### 버그 보고
- GitHub Issues 또는 팀 채널 사용

---

**최종 업데이트**: 2025-01-15
**작성자**: Claude Code SuperClaude
**버전**: 1.0.0
