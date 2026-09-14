# Codex handoff: Build Phase 1 association platform

This file preserves the continuation context for moving the local Codex task from Windows to macOS.

## Source task

- Title: `Build Phase 1 association platform`
- Source thread ID: `019fdb93-c173-77d0-8011-b1dc70b3f003`
- Windows working directory: `C:\Users\Admin\Documents\Codex\2026-08-07\files-mentioned-by-the-user-you`
- The Windows copy must remain unchanged and must not be deleted during migration.

## User constraints

- Continue Phase 1 only. Do not start Phase 2.
- Preserve the existing domain model, membership workflow, RBAC rules, branch scoping, audit history, tests, application behavior, visual concept, and slogan.
- Official organization name: `Республикалық математиктер бірлестігі`.
- Slogan: `Математика — ортақ тіл. Бірлестік — ортақ күш.`
- Do not invent organization names, slogans, official statements, leadership information, or public content.
- Keep private file storage behind an S3-compatible abstraction. Do not tightly couple it to Cloudflare R2.
- Keep the PostgreSQL audit log append-only and immutable.
- Do not configure GitHub or another remote repository unless the user explicitly asks.
- Do not discard, reset, overwrite, or clean existing working-tree changes.

## Current implementation state

- D1 was replaced with PostgreSQL and Prisma.
- Local PostgreSQL previously ran at `127.0.0.1:55432/rmb_phase_one`; this address is Windows-local and must not be assumed to exist on the Mac.
- Prisma migrations were at 14/14 and up to date on the Windows local database.
- Registration uses email, password, and password confirmation. Public account creation and password reset require at least 7 characters; the stronger production leadership-bootstrap password rule remains separate.
- Email verification is persistent, expiring, single-use, resendable, and checked atomically against PostgreSQL time.
- An unverified email can be corrected inside the same User/PersonProfile; old tokens are invalidated.
- Forgot/reset password is implemented with neutral responses and single-use tokens.
- Membership application is a three-step flow.
- The Applications queue shows only newly registered profiles and applicants; the Members directory shows only approved members.
- Full birth date is required for new applications; legacy birth year is preserved without inventing a date.
- Workplace and position are optional; education level and joining purpose are required; joining purpose is limited to 500 characters.
- Application documents are optional, 0-3 files, behind private storage abstraction with signature/checksum and draft persistence.
- Additional private profile documents can be uploaded later; other ordinary members cannot access them.
- Draft autosave/resume and logout/login restoration are implemented.
- Duplicate User/Profile/application creation is prevented.
- Rejected profiles are hidden from active people lists, member reports/analytics, Branch-workspace people panels, and direct administrative profile detail; the rejected application remains visible in the application workflow. President/VP2 can reopen an accidentally rejected application from its detail page. Reopening returns the same application to `awaiting_review` and the same saved profile to `applicant`; the original rejection and the new correction reason remain in immutable status history and audit. Branch roles cannot perform this reversal.
- President/VP2 have a separate permanent-erasure action for any other account, regardless of membership status. It requires typing `ӨШІРУ` and a reason, disables and anonymizes the login/profile, scrubs and archives applications, removes drafts, private document metadata/bytes, notes, and configurable values, revokes active access, ends assignments, and anonymizes retained Event/Project participation. Self-erasure is blocked; append-only status/audit tombstones remain.
- Duplicate-person detection was intentionally removed from this scope.
- Legacy `fullName` is not split: it remains in `givenName`; `surname` and `patronymic` remain empty.

## Last verified checks on Windows

- TypeScript: passed.
- ESLint: passed.
- Production build: passed.
- Full automated suite: 15/15 passed.
- RBAC, branch, document, and immutable-audit boundary tests: passed.
- Prisma status: 14/14 migrations up to date on the Windows local database.
- Local browser checks passed for the home page, membership navigation, registration page, and password visibility controls.

## Deployment status and blocker

- The latest Phase 1 account-flow changes were intentionally **not deployed to production**.
- Production had `AUTH_SECRET` and `DATABASE_URL` configured.
- `RESEND_API_KEY` and `EMAIL_FROM` were not configured.
- Do not deploy the new email-verification flow until the email provider is configured and real verification/reset delivery has been tested.
- Never copy secret values into this handoff file or commit them to Git.

## First actions on the Mac

1. Open the copied project folder as a local Codex project.
2. Read this file, `AGENTS.md` if present, `README.md`, and the relevant documents under `docs/`.
3. Inspect the complete working tree without resetting or cleaning it.
4. Detect the package manager and required runtime versions from the repository files.
5. Check whether local environment files and required secrets exist without printing secret values.
6. Set up or connect a Mac-local PostgreSQL instance. Do not reuse the Windows-local address blindly.
7. Run Prisma status before applying any migration.
8. Run TypeScript, lint, production build, automated tests, and access-boundary tests.
9. Report any Windows-to-macOS differences before changing code.
10. Do not deploy or begin Phase 2 without explicit user approval.

## Prompt to start the Mac task

Use this prompt after opening the copied folder in Codex on the Mac:

> Continue the local task “Build Phase 1 association platform” from the existing working tree. Read `CODEX_HANDOFF.md` completely, then read `AGENTS.md` if present and the repository documentation. Preserve every existing uncommitted change. Do not reset, clean, redesign, deploy, or start Phase 2. First inspect the Mac environment and report what is needed to reproduce the last verified Windows state safely.

## Mac continuation — current state on 2026-09-03

The earlier Phase-1-only restriction above describes the original Windows transfer and has since been superseded by the user's explicit approval to continue and deploy Phase 2 work. Preserve it as migration history, but use this section as the current implementation state.

- Production is live at `https://matclub.kz` on the `matclub` Cloudflare Worker.
- Phase 2.1 Dynamic CMS, Phase 2.2 Event core, and Phase 2.3 registration/attendance/reception/seating/profile activity are implemented and deployed.
- Internal Project management is implemented and deployed: national, all-branches, or one-branch scope; accountable department; designated leader; lifecycle; stages; participant roles/status; structured result; private documents; optional public-CMS Project link; immutable audit; and direct Project participation in `PersonProfile` activity history. President/VP2 can assign one Project to every Branch, making it visible in each Branch workspace, while a single-Branch Project remains scoped to that Branch. New stages can be prepared as a browser-side list of up to 30 rows and then saved in one database operation instead of one page reload per stage.
- The full Branch workspace is implemented: each branch page combines leadership, members, applications, Events, Projects, results, capability-gated documents, and a date-filtered periodic report. President/VP2 can open every branch; branch roles remain limited to their stored branch scope.
- Management reports are implemented for members, applications, Events, and Projects. They support branch/status/date/text filters, an on-screen preview, summary totals, and full XLSX/PDF export. `reports.read` and `reports.export` are assigned to President, VP2, branch director, and branch staff; branch roles remain limited to their assigned branches.
- Management indicators are implemented at `/dashboard/analytics`: current totals, equal-period change, application approval, Event registration/actual attendance, Project participation/beneficiaries, monthly trends, membership and professional-category distributions, branch comparison, and attention signals. They reuse `reports.read`; President/VP2 see the national comparison and branch roles remain limited to their stored branch scope.
- The internal institutional document registry is implemented at `/dashboard/documents`: official number/date/type, national or branch scope, responsible structure, leadership/responsible/member visibility, private file delivery, immutable numbered versions, archive/restore, filters, branch-workspace integration, and append-only audit. President/VP2 manage all records, branch directors manage only their branch, department heads manage only their department, and ordinary members see only active member-visible national or own-branch records.
- The people directory now supports combined keyword, exact age-bound, workplace, position, locality, branch, membership-status, and professional-category filters. Search runs in PostgreSQL and remains conjoined with the actor's stored branch scope.
- The `branch_project_manager` role and eight dedicated `projects.*` capabilities keep Project delegation independent from membership, Event, CMS, role, and audit administration.
- `prisma/migrations/20260904170000_project_all_branches_scope/migration.sql` is applied locally and in production. There are 23 migrations total.
- Production migrations were executed through temporary one-purpose Worker routes and recorded in `_prisma_migrations`; the temporary endpoints, secrets, and source files were removed before the normal application was restored.
- Current production Worker version with the completed Phase 2 platform, institutional document registry, seven-character public password minimum, separated Applications/Members lists, batched Project-stage entry, all-branches Project assignment, and President/VP2 permanent erasure for any other account: `a1cfd22d-ea03-4d26-b396-9bc2aa0b2011`. The daily retention schedule remains installed.
- Final TypeScript, ESLint, production build, Wrangler dry-run, targeted Branch-workspace scope test, targeted advanced people-search test, targeted report scope/export test, targeted management-indicator scope test, targeted institutional-document scope/version/archive test, database immutability checks, XLSX structure check, PDF render check, and live anonymous smoke checks passed. The monolithic full test command repeatedly exhausts the local Miniflare/workerd 1.4 GB heap after 12 passing tests; later failures are cascading fetch failures after that process aborts, not Project, Branch-workspace, search, report, analytics, or institutional-document assertions. Run large regression groups in fresh processes until that test-harness memory issue is split or fixed.
- Permanent erasure was additionally verified with focused integration tests covering President/VP2-only access, exact confirmation, both empty-profile and full-member deletion, self-erasure refusal, permanent account disablement/anonymization, application/draft/document cleanup, private-byte deletion, and retained anonymous history. The production erasure and application-submission transactions now have a 30-second budget so data-rich accounts do not hit Prisma's default interactive-transaction timeout. The focused Applications/Members separation, Branch workspace, advanced search, erasure, registration, navigation, and dashboard tests passed together with TypeScript, ESLint, and the production build. Production smoke checks on Worker version `f3bacac6-36db-4806-a0b3-23b9c81288af` returned `200` for the home page, a login redirect for anonymous Applications access, `422` with the seven-character password rule, and `403` for an anonymous erasure attempt.
- The agreed Phase 2 platform scope is complete, including the final internal-document block. Phase 3 is intentionally deferred until sufficient real operational data has accumulated; no further large module should be inferred without a new product decision.
