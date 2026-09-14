# Республикалық математиктер бірлестігі — Phase 1 + Phase 2 management platform

The production platform contains the completed Phase 1 membership foundation and the agreed Phase 2 management platform: dynamic public content, Events and participation, internal Projects, a unified Branch workspace, scoped reports, management indicators, and a permanent internal institutional document registry. Phase 3 is intentionally deferred until enough real operational data has accumulated. Competition management remains out of scope.

Slogan: “Математика — ортақ тіл. Бірлестік — ортақ күш.”

## Stack

- Vinext, React 19, TypeScript, and Tailwind CSS
- PostgreSQL
- Prisma ORM 7 with the PostgreSQL driver adapter
- Zod validation and server-enforced RBAC
- provider-neutral private object storage contract, with a PostgreSQL-backed Phase 1 provider
- a separate provider-neutral public-media contract for CMS images
- automatic 60-day cleanup for archived news, never-published archived CMS drafts, and unused archived public media, while membership and audit history remain protected
- permanent Event records with audited lifecycle state and structured results
- explicit Event-to-News announcement/result relations; generated News always starts as a draft
- internal full-member registration with capacity enforcement and pre-start self-cancellation
- scoped participant/reception/attendance/seating capabilities and immutable participation history
- automatic Event participation history on the existing PersonProfile only after attendance is confirmed
- scoped internal Project lifecycle, stages, team roles, results, and private documents
- centrally assigned Projects can target every Branch at once or one selected Branch
- batch Project-stage entry: prepare up to 30 stages in the browser and save them in one operation
- automatic completed Project participation in the same PersonProfile activity history
- unified branch workspace with current operations and date-filtered branch reporting
- scoped management reports for members, applications, Events, and Projects with Excel/PDF export
- date-filtered management indicators with period comparison, attendance rates, activity trends, branch comparison, and attention signals
- permanent institutional document registry with number/date/type metadata, national or branch scope, responsible structure, visibility levels, immutable file versions, archive/restore, and audit history
- combined people search by name/keyword, exact age bounds, workplace, position, locality, branch, membership state, and professional category

## Local setup

Requirements: Node.js 22.13+ and PostgreSQL. A development-only embedded PostgreSQL runner is included for local verification.

```powershell
Copy-Item .env.example .env
pnpm db:local
```

Replace every placeholder in the ignored `.env` file with the local development values before starting Prisma or the application.

Leave PostgreSQL running, then use a second terminal:

```powershell
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The default embedded development URL is:

The included runner listens on `127.0.0.1:55432` and uses the persistent `rmb_phase_one` development database.

Production must supply its own `DATABASE_URL`, optional migration-only `DIRECT_URL`, and strong `AUTH_SECRET`.

## Verification commands

```powershell
pnpm db:migrate
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

`pnpm test` expects the migrations and fictional seed to have been applied to `DATABASE_URL`, and validates the production worker output in `dist/`.

## Fictional test accounts

All local accounts are explicit test fixtures and do not represent real leadership or members. Shared password: `PhaseOneDemo2026!`.

| Access scenario | Email |
|---|---|
| A — president role | `president@example.test` |
| B — first vice-president, mathematics/content/professional role | `vp1@example.test` |
| A — second vice-president, organization/institutional-development role | `vp2@example.test` |
| B — department-head role | `department@example.test` |
| C — Almaty branch-director role | `branch@example.test` |
| D — member role | `member@example.test` |
| Applicant fixture | `applicant@example.test` |
| Reserve fixture | `reserve@example.test` |

## Persistence and storage

`prisma/schema.prisma` is the canonical relational model. Versioned SQL lives in `prisma/migrations/`; `prisma migrate deploy` applies it. Phase 1 includes an administrator-managed organizational hierarchy on top of explicit department scopes and person-to-department assignments, while `private_objects` remains the storage provider's internal byte store.

`uploaded_documents` continues to hold document metadata, checksums, ownership, visibility, and random object keys. Application routes depend only on `PrivateObjectStorage`. The current provider stores private bytes in PostgreSQL; a later S3-compatible provider can implement the same interface without changing membership routes or authorization.

The audit table is append-only at the PostgreSQL layer. Triggers reject `UPDATE`, `DELETE`, and `TRUNCATE`; application mutations insert the audit row in the same Prisma transaction as the business change.

## One-time production administrator bootstrap

President and VP2 production accounts are created only by the explicit `pnpm run bootstrap:production-admin` command. Supply the production database connection and account fields through the current shell environment or another secure secret-injection mechanism, never a tracked file:

```powershell
$env:ENVIRONMENT = "production"
$env:DIRECT_URL = "<production direct PostgreSQL URL>"
$env:BOOTSTRAP_ADMIN_ROLE = "president" # or vice_president_2
$env:BOOTSTRAP_ADMIN_EMAIL = "<real email address>"
$env:BOOTSTRAP_ADMIN_PASSWORD = "<new strong password>"
$env:BOOTSTRAP_ADMIN_FULL_NAME = "<full name>"
$env:BOOTSTRAP_ADMIN_REGION_CODE = "<region code>"
$env:BOOTSTRAP_ADMIN_CITY_DISTRICT = "<city or district>"
$env:BOOTSTRAP_ADMIN_PHONE = "<phone>"
pnpm.cmd run bootstrap:production-admin
```

Run it once for `president` and once for `vice_president_2`, using different real email addresses. The command hashes the password, creates the user/profile/role relationship in one transaction, writes an immutable audit entry, rejects `.example.test` and duplicate emails, and never prints the password. Clear the temporary shell variables after each run. Do not put these values in `.env.example`, seed files, Worker plain-text variables, or source control.

## Important boundaries

- Authentication never substitutes for authorization; every sensitive route checks the actor and stored target scope.
- Branch staff can read and mutate only members, applications, documents, statistics, and branch information assigned to their branch.
- Branch directors can create and submit drafts only for their own branch; a separately assignable branch-event-manager role grants only that Event scope and no membership administration.
- Only an actor with `events.publish` can publish, postpone, cancel, complete, archive, or restore an Event; President and VP2 receive it initially.
- The first vice-president receives the nationwide professional-field projection required for mathematics, content, and professional-development work.
- Event participant lists, participant changes, attendance, and seating use separate capabilities and remain constrained to the Event's stored branch scope; public pages never return participant names.
- Project management uses separate global, branch, department, participant, stage, result, and document capabilities; a branch Project coordinator receives only Project access for the assigned branch.
- Internal Project data never becomes public merely because it is linked to a public CMS Project record.
- Department heads and staff see only members explicitly assigned to the department IDs they manage.
- The second vice-president has the same full global operational access boundary as the president.
- Members can edit only the explicit self-service profile allowlist.
- Membership intake creates one user, one linked profile, and one application; approval adds the member role to that same user.
- Applications is the operational queue for newly registered profiles and applicants; Members contains approved members only.
- Rejected applicants disappear from active people lists, member reports, branch profile panels, and direct administrative profile pages; their application remains available under rejected applications. President and VP2 can return an accidentally rejected application to review, restoring the same saved profile as an applicant while retaining the original rejection and correction reason in immutable history and audit records.
- President and VP2 can permanently erase any other account, regardless of its current membership status, after typing an explicit confirmation and reason. The account is disabled, identifying profile/application data is anonymized, drafts and private document metadata/bytes are removed, active access is revoked, and operational Event/Project history is retained only through a non-identifying participant tombstone. Self-erasure remains blocked and a minimal status/audit trail is preserved.
- Private documents have no public URL and are served with private/no-store headers.
- Audit records and membership-status history have no update or delete path.
- D1, R2, and Drizzle are not application dependencies.

See [architecture](docs/ARCHITECTURE.md), [roles](docs/ROLES_AND_PERMISSIONS.md), and [security](docs/SECURITY.md) for the Phase 1 details.
