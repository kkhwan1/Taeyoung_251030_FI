# API Normalization System

This playbook codifies the remediation sequence documented in `ERP_TEST_RESULTS_REPORT.md`. Running `npm run api:normalize` executes each step in order and reports whether the repository already complies, was fixed automatically, or still needs manual attention.

## Workflow Steps
1. **Detect raw SQL template usage** — flags template literals and `execute_sql` concatenations that risk SQL injection. Review the reported files and migrate the queries to the Supabase client patterns described in the report (Section 1).
2. **Normalize UTF-8 response headers** — auto-patches JSON responses so they emit `application/json; charset=utf-8`, ensuring the localization fixes remain intact.
3. **Align environment placeholders** — synchronises `.env.example` with redacted placeholders (`<project-ref>`, `<anon-key>`, etc.) so secrets never leak while following the recommended configuration.
4. **Run lint/type-check safeguards** — triggers `npm run lint` and `npm run type-check` to surface any regressions after the previous steps. Non-zero exits are reported as `WARN` and require follow-up.

## Usage
```bash
npm run api:normalize
```

The command prints a per-step status:
- `PASS` – already compliant.
- `FIXED` – the script updated files automatically.
- `WARN` – manual work required (see the listed files/commands).
- `ERROR` – the workflow could not complete (e.g., missing `.env.example`).

## Next Actions
- Work through any `WARN` output, prioritising SQL query migrations, then rerun the workflow until it reports only `PASS`.
- Commit the generated changes (`.env.example`, UTF-8 header patches, etc.) alongside your manual fixes.
- Integrate the command into CI or pre-deployment checks to keep the API surface consistently hardened.
