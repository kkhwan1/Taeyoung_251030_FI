# SUPERCLAUDE.md

SuperClaude 프레임워크 통합 및 AI 에이전트 사용 가이드

> 💡 **프로젝트별 개발 패턴 및 기술 문서**: [CLAUDE.md](./CLAUDE.md) 참조

---

## SuperClaude Framework Integration

This project uses the **SuperClaude framework** configured in `C:\Users\USER\.claude\`:

- **Entry Point**: `@C:\Users\USER\.claude\CLAUDE.md`
- **Core Commands**: `/build`, `/analyze`, `/improve`, `/implement`, `/test`
- **Key Flags**: `--seq`, `--c7`, `--magic`, `--play`, `--uc`, `--think`, `--persona-*`
- **MCP Servers**: Context7 (docs), Sequential (analysis), Magic (UI), Playwright (testing)
- **11 Personas**: Auto-activation based on task context (architect, frontend, backend, security, performance, analyzer, qa, refactorer, devops, mentor, scribe)

**Full Documentation**: See `C:\Users\USER\.claude\` for complete COMMANDS.md, FLAGS.md, PERSONAS.md, MCP.md, and MODES.md reference.

---

## Project-Specific Agents & Commands

### Available Agents

**`erp-specialist`** - Korean automotive ERP specialist (`.claudeCode/agents/erp-specialist.md`)
- **Expertise**: Next.js 15, React 19, Supabase PostgreSQL, Korean language handling
- **Use Cases**: ERP features with Korean data, inventory transactions (입고/생산/출고), BOM operations, Excel integration
- **Example**: `Use erp-specialist agent to implement 입고 transaction API with proper Korean encoding`

**`fullstack-developer`** - Complete stack development (`~/.claude-code-templates/agents/fullstack-developer.md`)
- **Expertise**: React/Next.js, TypeScript, Node.js/Express, PostgreSQL, Authentication
- **Use Cases**: End-to-end feature implementation, API integration, authentication
- **Example**: `Use fullstack-developer for implementing user authentication system`

### Custom Commands

**`/erp:build`** - ERP-specific build and deployment
- Validates Korean character encoding, checks Supabase connection, generates types, performs production build
- Usage: `/erp:build --env production`

**`/erp:migrate`** - Database migration management
- Applies migrations, generates TypeScript types, validates safety, supports rollback
- Usage: `/erp:migrate --check` or `/erp:migrate --apply`

**`/erp:test`** - Comprehensive ERP testing suite
- API endpoint tests with Korean data, Excel functionality, inventory logic, encoding validation
- Usage: `/erp:test --coverage` or `/erp:test --api`

---

## Essential SuperClaude Commands for ERP

### `/build` - Build ERP Features
```bash
# Build with validation
/build --focus quality --validate

# Build dashboard with UI optimization
/build @src/components/dashboard --persona-frontend --magic

# Build API with database integration
/build @src/app/api --persona-backend --seq --c7
```

### `/implement` - Implement New Features
```bash
# Implement with type specification
/implement "입고 처리 API 엔드포인트" --type api --persona-backend

# Implement UI component
/implement "재고 현황 차트" --type component --magic --c7

# Implement with validation
/implement "품목 엑셀 업로드" --focus quality --validate
```

### `/analyze` - Analyze Codebase
```bash
# Performance analysis
/analyze --focus performance --think-hard --seq

# Quality analysis
/analyze @src/app/api --focus quality --uc

# Security analysis
/analyze --focus security --persona-security --ultrathink
```

**Thinking Depth**: `--think` (4K tokens) → `--think-hard` (10K tokens) → `--ultrathink` (32K tokens)

### `/improve` - Enhance Code Quality
```bash
# Performance improvement
/improve @src/lib/db-unified.ts --focus performance --seq

# Accessibility improvement
/improve @src/components/dashboard --focus accessibility --magic

# Iterative improvement
/improve @src --loop --iterations 3
```

### `/test` - Testing Workflows
```bash
# E2E testing
/test --type e2e --play

# API testing with Korean data
/test @src/app/api --focus quality --persona-qa

# Comprehensive testing
/test --all --coverage --validate
```

---

## MCP Server Usage

### Context7 - Documentation & Patterns
**When**: External library questions, framework patterns, best practices
**Use**: `--c7` flag or auto-activates on import statements
```bash
# Get framework patterns
/analyze --c7 "Supabase real-time subscriptions"
/implement --c7 "Next.js 15 API route with Korean text"
```

### Sequential - Complex Analysis
**When**: Complex debugging, business logic design, systematic analysis
**Use**: `--seq` flag or auto-activates with `--think` flags
```bash
# Multi-step analysis
/analyze @src/app/api/bom --seq --think-hard
/troubleshoot "Korean characters corrupted" --seq
```

### Magic - UI Component Generation
**When**: React components, dashboard widgets, design system
**Use**: `--magic` flag or auto-activates for UI work
```bash
# Generate UI components
/implement "KPI 카드 컴포넌트" --magic --persona-frontend
/build "가상 스크롤링 품목 테이블" --magic --c7
```

### Playwright - E2E Testing & Automation
**When**: End-to-end testing, browser automation, performance monitoring
**Use**: `--play` flag or auto-activates for testing
```bash
# E2E testing
/test "품목 엑셀 업로드 E2E" --play
/test @src/components/dashboard --play --focus performance
```

---

## Persona Auto-Activation

**Backend Operations** → `--persona-backend` (API routes, database, Supabase)
**Frontend Development** → `--persona-frontend` (React components, UI design, accessibility)
**Korean Documentation** → `--persona-scribe=ko` (README, comments, commit messages)
**Performance Optimization** → `--persona-performance` (bottleneck identification, optimization)
**Security Analysis** → `--persona-security` (threat modeling, vulnerability assessment)
**Code Quality** → `--persona-refactorer` (technical debt, code simplification)
**Quality Assurance** → `--persona-qa` (comprehensive testing, edge cases)

---

## Common ERP Task Patterns

**Korean Data**: `/analyze @src/app/api --think --seq --persona-scribe=ko`
**Dashboard**: `/build @src/components/dashboard --magic --c7 --persona-frontend`
**Database**: `/analyze @src/lib/db-unified.ts --seq --c7 --think-hard`
**Performance**: `/analyze --focus performance --persona-performance --ultrathink`
**Security**: `/analyze --focus security --persona-security --validate`
**Excel**: `/implement "품목 엑셀 업로드" --c7 --validate --persona-backend`

---

## Integration Best Practices

1. **Start Simple, Scale Up**: Begin with basic analysis, add `--think` for depth, use `--ultrathink` for complex issues
2. **Combine Complementary Tools**: Use `--c7 --seq` for documentation + implementation, `--magic --persona-frontend` for UI + accessibility
3. **Use Project Context**: Leverage `erp-specialist` for Korean ERP work, `fullstack-developer` for end-to-end features
4. **Optimize Performance**: Use `--uc` for large operations, disable unused MCP servers with `--no-magic --no-play`
5. **Quality Gates**: Always `--validate` critical paths, use `--loop` for iterative improvement, `--safe-mode` for production

---

## Global AI Agents Integration (27 Specialized Experts)

### Agent Discovery System

**Location**: `C:\Users\USER\.claude\agents\` (27 agents)

**Auto-Selection Algorithm**:
- **Keyword Matching** (40%): Task keywords vs agent expertise
- **Context Relevance** (30%): Project context vs agent capabilities
- **Historical Success** (20%): Past performance on similar tasks
- **Tool Availability** (10%): Required tools accessible
- **Confidence Threshold**: ≥75% for automatic activation

### ERP-Critical Agents (Top 5)

#### 1. `supabase-schema-architect` ⭐⭐⭐ (Supabase 특화!)
- **Expertise**: Supabase PostgreSQL, RLS policies, migrations, schema design
- **Keywords**: Supabase, PostgreSQL, RLS, migration, schema design
- **Confidence**: 91%
- **Use Cases**:
```bash
/design --agent supabase-schema-architect "inventory_transactions RLS 정책"
/plan --agent supabase-schema-architect "재고 스키마 확장"
/analyze --agent supabase-schema-architect @src/lib/db-unified.ts
```

#### 2. `database-optimizer` ⭐⭐⭐ (쿼리 최적화)
- **Expertise**: Query optimization, indexing strategies, N+1 problems
- **Keywords**: query, performance, index, optimization, slow query
- **Confidence**: 89%
- **Use Cases**:
```bash
/improve --agent database-optimizer @src/lib/db-unified.ts --focus performance
/analyze --agent database-optimizer "재고 조회 쿼리 성능 개선"
```

#### 3. `backend-architect` ⭐⭐⭐ (API 설계)
- **Expertise**: RESTful APIs, microservices, scalability, system architecture
- **Keywords**: API, server, microservices, architecture, scalability
- **Confidence**: 90%
- **Use Cases**:
```bash
/design --agent backend-architect "재고 관리 REST API 엔드포인트"
/analyze --agent backend-architect --focus scalability @src/app/api
```

#### 4. `frontend-developer` ⭐⭐⭐ (React 컴포넌트)
- **Expertise**: React/Vue/Angular, responsive design, accessibility, performance
- **Keywords**: component, UI, responsive, accessibility, CSS, Tailwind
- **Confidence**: 92%
- **Use Cases**:
```bash
/implement --agent frontend-developer "재고 현황 대시보드 컴포넌트"
/build --agent frontend-developer @src/components/dashboard --focus accessibility
```

#### 5. `code-reviewer` ⭐⭐⭐ (코드 품질)
- **Expertise**: Code quality, best practices, refactoring, clean code
- **Keywords**: review, quality, best practices, refactor, clean code
- **Confidence**: 90%
- **Use Cases**:
```bash
/improve --agent code-reviewer @src/app/api --focus quality
/analyze --agent code-reviewer @src/lib --focus maintainability
```

### Additional Available Agents (22 agents)

| Agent | Category | Expertise | ERP 활용도 |
|-------|---------|-----------|----------|
| `database-architect` | Backend | Schema design, data modeling, normalization | ⭐⭐ 권장 |
| `database-optimization` | Backend | Execution plan analysis, query tuning | ⭐⭐ 권장 |
| `database-admin` | Backend | Backup, replication, monitoring | ⭐ 선택 |
| `web-accessibility-checker` | Frontend | WCAG compliance, screen reader compatibility | ⭐⭐ 권장 |
| `architect-reviewer` | Quality | SOLID principles, design patterns | ⭐⭐ 권장 |
| `dependency-manager` | Quality | npm packages, vulnerabilities, licenses | ⭐⭐ 권장 |
| `documentation-expert` | Docs | API docs, README, technical writing | ⭐⭐ 권장 |
| `technical-writer` | Docs | Tutorials, user guides, instructions | ⭐⭐ 권장 |
| `business-analyst` | Business | KPI tracking, metrics, BI | ⭐⭐ 권장 |
| `product-strategist` | Business | Product strategy, roadmap, market analysis | ⭐ 선택 |
| `competitive-intelligence-analyst` | Business | Competitor analysis, industry trends | ⭐ 선택 |
| `content-marketer` | Marketing | Content marketing, SEO, blog | - |
| `marketing-attribution-analyst` | Marketing | Attribution, campaign tracking, ROI | - |
| `mcp-expert` | Expert | MCP server integration | ⭐⭐ 권장 |
| `command-expert` | Expert | CLI commands, terminal automation | ⭐ 선택 |
| `task-decomposition-expert` | Expert | Complex task breakdown, workflow design | ⭐⭐ 권장 |
| `query-clarifier` | Expert | Query analysis, requirement clarification | ⭐ 선택 |
| `search-specialist` | Expert | Web search, research, information gathering | ⭐ 선택 |
| `computer-vision-engineer` | Expert | Image analysis, OCR, object detection | - |
| `hackathon-ai-strategist` | Expert | Hackathon strategy, ideation | - |
| `url-link-extractor` | Expert | URL extraction, link cataloging | - |
| `url-context-validator` | Expert | URL validation, link checking | - |

### ERP-Specific Agent Selection

**Database Operations**: `supabase-schema-architect` → `database-optimizer` → `database-architect`
**API Development**: `backend-architect` → `code-reviewer` → `documentation-expert`
**UI Development**: `frontend-developer` → `web-accessibility-checker` → `documentation-expert`
**Performance**: `database-optimizer` → `frontend-developer` → `database-optimization`
**Documentation**: `technical-writer` → `documentation-expert` → `--persona-scribe=ko`
**Business Analysis**: `business-analyst` → `product-strategist` → `competitive-intelligence-analyst`

### Multi-Agent Workflows

**Full-Stack Feature** (4 stages):
```bash
/design --agent supabase-schema-architect "데이터베이스 스키마"
/design --agent backend-architect "REST API 엔드포인트"
/implement --agent frontend-developer "사용자 인터페이스"
/improve --agent code-reviewer "전체 기능 품질 검토"
```

**Performance Optimization** (3 stages):
```bash
/analyze --agent database-optimizer --focus performance
/improve --agent database-optimization "느린 쿼리 개선"
/analyze --agent frontend-developer --focus performance @src/components
```

**Security & Quality Audit** (3 stages):
```bash
/analyze --agent dependency-manager --security
/analyze --agent code-reviewer --focus security @src/app/api
/analyze --agent web-accessibility-checker @src/components
```

### Agent Usage Best Practices

**✅ Do**: Specify explicit agents (`--agent supabase-schema-architect`), use domain experts (database-* for DB work), provide sufficient context (file paths + goals)

**❌ Don't**: Use generic agents when specialists exist, attempt complex work without agents, use UI agents for database work

### Integration with SuperClaude

**Agents + Personas**: `--agent database-optimizer @src/lib --persona-backend`
**Agents + MCP**: `--agent supabase-schema-architect "스키마" --c7 --seq`
**Agents + Flags**: `--agent database-optimizer @src/lib --think-hard --loop`
