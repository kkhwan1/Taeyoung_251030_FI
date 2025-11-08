# FITaeYoungERP 개선 프로젝트 - Plan 7

## 📋 프로젝트 개요

**목표**: 페이지 이동 속도 83% 개선, 코드 품질 향상, 유지보수성 개선
**전략**: Codex-Claude Loop + 병렬 에이전트 실행
**예상 시간**: 20시간 (병렬 실행)

---

## 🎯 성능 목표

| 메트릭 | 현재 | 목표 | 개선율 |
|--------|------|------|--------|
| 페이지 이동 | 2-3초 | 0.3-0.5초 | 83% |
| 초기 로딩 | 3-4초 | 1.5-2초 | 50% |
| 번들 크기 | 500KB | 250KB | 50% |
| API 라우트 | 128개 | 60개 | 53% |
| 코드 품질 | 6.1/10 | 8.5/10 | 39% |

---

## 📁 폴더 구조

```
.plan7/
├── README.md                    # 이 문서
├── 00-SETUP.md                  # 초기 설정 및 준비
├── 01-CODEX-INITIAL.md          # Codex 초기 검증
├── 02-PLAN-REFINEMENT.md        # 계획 수정
├── 03-CODEX-PLAN-VALIDATION.md  # 계획 검증
├── 04-WAVE1-EXECUTION.md        # Wave 1 실행 (병렬)
├── 05-WAVE1-CODEX-REVIEW.md     # Wave 1 Codex 검증
├── 06-WAVE2-EXECUTION.md        # Wave 2 실행 (병렬)
├── 07-WAVE2-CODEX-REVIEW.md     # Wave 2 Codex 검증
├── 08-WAVE3-EXECUTION.md        # Wave 3 실행
├── 09-FINAL-CODEX-REVIEW.md     # 최종 검증
├── 10-DEPLOYMENT.md             # 배포 및 롤백
├── logs/                        # 실행 로그
│   ├── codex-initial.log
│   ├── wave1-agent2.log
│   ├── wave1-agent3.log
│   ├── wave1-agent4.log
│   ├── wave2-agent1.log
│   ├── wave2-agent5.log
│   ├── wave3-agent6.log
│   └── codex-reviews.log
├── checkpoints/                 # 체크포인트 백업
│   ├── pre-wave1/
│   ├── post-wave1/
│   ├── pre-wave2/
│   ├── post-wave2/
│   ├── pre-wave3/
│   └── post-wave3/
└── metrics/                     # 성능 메트릭
    ├── baseline.json
    ├── wave1-results.json
    ├── wave2-results.json
    └── final-results.json
```

---

## 🔄 실행 단계

### Phase 0: 준비 (30분)
- [x] 폴더 구조 생성
- [ ] Git 브랜치 생성 (`feature/plan7-optimization`)
- [ ] 베이스라인 메트릭 수집
- [ ] 체크포인트 백업

**문서**: [00-SETUP.md](./00-SETUP.md)

---

### Phase 1: Codex 초기 검증 (5분)
- [ ] 현재 아키텍처 분석
- [ ] 문제점 식별
- [ ] 우선순위 결정
- [ ] 로그 저장

**문서**: [01-CODEX-INITIAL.md](./01-CODEX-INITIAL.md)
**로그**: `logs/codex-initial.log`
**Codex 명령어**:
```bash
echo "[프롬프트]" | codex exec -m gpt-5-codex --config model_reasoning_effort=high --sandbox read-only
```

---

### Phase 2: 계획 수정 (30분)
- [ ] Codex 피드백 분석
- [ ] 계획 조정
- [ ] 위험 평가
- [ ] 문서 업데이트

**문서**: [02-PLAN-REFINEMENT.md](./02-PLAN-REFINEMENT.md)

---

### Phase 3: 계획 검증 (3분)
- [ ] 수정된 계획 Codex 검증
- [ ] 승인/거부 결정
- [ ] 최종 계획 확정

**문서**: [03-CODEX-PLAN-VALIDATION.md](./03-CODEX-PLAN-VALIDATION.md)
**Codex 명령어**:
```bash
echo "[계획]" | codex exec resume --last
```

---

### Phase 4: Wave 1 실행 (8시간, 병렬)
**에이전트**:
- Agent 2: API 표준화 (backend-architect) - 6-8시간
- Agent 3: 상태 관리 (architect-reviewer) - 3-4시간
- Agent 4: 번들 최적화 (frontend-developer) - 4-5시간

**병렬 실행**:
```typescript
Promise.all([
  Task({ subagent_type: 'backend-architect', ... }),
  Task({ subagent_type: 'architect-reviewer', ... }),
  Task({ subagent_type: 'frontend-developer', ... })
])
```

**문서**: [04-WAVE1-EXECUTION.md](./04-WAVE1-EXECUTION.md)
**로그**:
- `logs/wave1-agent2.log`
- `logs/wave1-agent3.log`
- `logs/wave1-agent4.log`

---

### Phase 5: Wave 1 검증 (30분)
- [ ] 통합 이슈 확인
- [ ] Codex 검증
- [ ] 수정 필요 사항 식별
- [ ] 체크포인트 생성

**문서**: [05-WAVE1-CODEX-REVIEW.md](./05-WAVE1-CODEX-REVIEW.md)
**체크포인트**: `checkpoints/post-wave1/`

---

### Phase 6: Wave 2 실행 (6시간, 병렬 + 의존성)
**에이전트**:
- Agent 1: TanStack Query (frontend-developer) - 4-6시간 (Agent 3 완료 후)
- Agent 5: 라우팅 최적화 (architect-reviewer) - 2-3시간 (Agent 2 완료 후)

**순차 시작, 병렬 실행**:
```typescript
// Agent 3 완료 확인 후
await Task({ subagent_type: 'frontend-developer', ... });  // Agent 1

// Agent 2 완료 확인 후
await Task({ subagent_type: 'architect-reviewer', ... });  // Agent 5
```

**문서**: [06-WAVE2-EXECUTION.md](./06-WAVE2-EXECUTION.md)
**로그**:
- `logs/wave2-agent1.log`
- `logs/wave2-agent5.log`

---

### Phase 7: Wave 2 검증 (30분)
- [ ] 통합 테스트
- [ ] 성능 측정
- [ ] Codex 검증
- [ ] 체크포인트 생성

**문서**: [07-WAVE2-CODEX-REVIEW.md](./07-WAVE2-CODEX-REVIEW.md)
**체크포인트**: `checkpoints/post-wave2/`

---

### Phase 8: Wave 3 실행 (4시간)
**에이전트**:
- Agent 6: 품질 검증 (code-reviewer) - 3-4시간

```typescript
await Task({ subagent_type: 'code-reviewer', ... });
```

**문서**: [08-WAVE3-EXECUTION.md](./08-WAVE3-EXECUTION.md)
**로그**: `logs/wave3-agent6.log`

---

### Phase 9: 최종 검증 (1시간)
- [ ] 전체 코드 리뷰
- [ ] 성능 메트릭 검증
- [ ] Go/No-Go 결정
- [ ] 최종 체크포인트

**문서**: [09-FINAL-CODEX-REVIEW.md](./09-FINAL-CODEX-REVIEW.md)
**체크포인트**: `checkpoints/post-wave3/`

---

### Phase 10: 배포 (1시간)
- [ ] 프로덕션 빌드
- [ ] 배포 실행
- [ ] 모니터링
- [ ] 롤백 준비

**문서**: [10-DEPLOYMENT.md](./10-DEPLOYMENT.md)

---

## 🔍 Codex 검증 포인트

| Phase | Codex 명령어 | 목적 |
|-------|-------------|------|
| Phase 1 | `codex exec -m gpt-5-codex --config model_reasoning_effort=high` | 초기 아키텍처 분석 |
| Phase 3 | `codex exec resume --last` | 계획 검증 |
| Phase 5 | `codex exec resume --last` | Wave 1 통합 검증 |
| Phase 7 | `codex exec resume --last` | Wave 2 통합 검증 |
| Phase 9 | `codex exec resume --last` | 최종 품질 검증 |

---

## 🤖 에이전트 병렬 실행 전략

### Wave 1 (독립 실행)
```
Agent 2 (API)      ████████ (6-8h)
Agent 3 (State)    ████     (3-4h)
Agent 4 (Bundle)   █████    (4-5h)
─────────────────────────────────
         0  1  2  3  4  5  6  7  8
```

### Wave 2 (의존성 기반)
```
Agent 1 (Query)    (3h 대기) ██████ (4-6h)
Agent 5 (Route)    (6h 대기) ███    (2-3h)
─────────────────────────────────
         0  1  2  3  4  5  6  7  8  9
```

### Wave 3 (순차)
```
Agent 6 (QA)       ████     (3-4h)
─────────────────────────────────
         0  1  2  3  4
```

---

## 📊 메트릭 수집

### 베이스라인 (Phase 0)
```bash
npm run analyze  # 번들 크기
npm run test     # 테스트 통과율
# 페이지 로딩 시간 측정 (Chrome DevTools)
```

**저장**: `metrics/baseline.json`

### Wave별 측정
- Wave 1 후: `metrics/wave1-results.json`
- Wave 2 후: `metrics/wave2-results.json`
- Wave 3 후: `metrics/final-results.json`

---

## 🚨 롤백 전략

### 각 Wave 실패 시
```bash
git checkout checkpoints/pre-wave{N}
npm install
npm run dev
```

### Codex 검증 실패 시
- 해당 Wave 변경사항 되돌리기
- Codex 피드백 분석
- 수정 후 재실행

---

## 📝 진행 상태

- [x] Phase 0: 준비 (폴더 구조 생성)
- [ ] Phase 1: Codex 초기 검증
- [ ] Phase 2: 계획 수정
- [ ] Phase 3: 계획 검증
- [ ] Phase 4: Wave 1 실행
- [ ] Phase 5: Wave 1 검증
- [ ] Phase 6: Wave 2 실행
- [ ] Phase 7: Wave 2 검증
- [ ] Phase 8: Wave 3 실행
- [ ] Phase 9: 최종 검증
- [ ] Phase 10: 배포

---

**시작일**: 2025-02-01
**예상 완료**: 2025-02-03 (20시간 작업)
**담당**: Claude Code + Codex Loop
**상태**: 준비 중
