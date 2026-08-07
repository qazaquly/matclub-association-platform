# ҚМРҚ digital platform — Phase 1

Phase 1 of the digital institutional platform for the Republican Association of Mathematicians of Kazakhstan.

This is an Association-management platform, **not an olympiad platform**. It intentionally contains no competition registration, testing, scoring, protocols, certificates, diplomas, or competition operations.

## What Phase 1 includes

- Kazakh-first public website with the requested information architecture
- public membership application with terms acceptance and QR URL
- automatic regional-branch assignment
- private supporting-document storage
- branch-scoped review with reject, reserve, and approve decisions
- one permanent person profile with separate membership status and system role
- Level A–D server-side authorization
- member self-service limited to explicitly editable fields
- central member, branch, and role administration
- append-only membership history and database-enforced immutable audit log
- fictional Kazakh development data for all requested test roles

## Stack

- Vinext `1.0.0-beta.2`, using the Next.js App Router programming model
- React `19.2.6` and TypeScript `5.9.3`
- Tailwind CSS `4.2.1` plus a project-specific design system
- Cloudflare D1 and Drizzle ORM `0.45.2`
- private Cloudflare R2 binding for uploaded documents
- PBKDF2-SHA256 password hashing and signed, HttpOnly, SameSite session cookies
- Zod validation, server route authorization, origin checks, rate limiting

The brief described PostgreSQL and Prisma as the preferred stack. This implementation uses the Sites capability runtime's relational D1/R2 bindings and Drizzle while preserving the same normalized domain boundaries. The data and authorization modules are isolated so a PostgreSQL/Prisma adapter can replace the persistence layer without redesigning membership workflows or UI routes.

## Local setup

Requirements: Node.js `>=22.13.0` and pnpm `11.16.0`.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

On Windows PowerShell, copy the environment template with:

```powershell
Copy-Item .env.example .env
```

Replace `AUTH_SECRET` in `.env` before using authenticated routes. Open `http://localhost:3000`.

The local runtime creates project-local D1 and R2 development state under `.wrangler/`; it is ignored by Git. Schema creation and fictional seed data are idempotently applied on first database access.

## Development accounts

All sample identities are fictional. The shared local-only password is `RamkDemo2026!`.

| Scenario | Email | Access |
|---|---|---|
| President | `president@ramk.test` | A — full |
| Vice President 1 | `vp1@ramk.test` | A — full |
| Vice President 2 | `vp2@ramk.test` | B — department |
| Department head | `department@ramk.test` | B — department |
| Almaty branch director | `branch@ramk.test` | C — own branch |
| Ordinary member | `member@ramk.test` | D — own profile |
| Applicant | `applicant@ramk.test` | applicant fixture |
| Reserve applicant | `reserve@ramk.test` | reserve fixture |

These credentials are for local development only. Remove or replace every seeded account before real deployment. A local ignored copy is also available in `LOCAL_TEST_ACCOUNTS.md`.

## Validation

```bash
pnpm typecheck
pnpm test
pnpm lint
```

`pnpm test` performs a production build, verifies the Kazakh public render, applies the migration to an in-memory SQLite database, proves that audit updates/deletes are rejected, and checks sensitive routes for server-side authorization.

After changing `db/schema.ts`, generate a migration with:

```bash
pnpm db:generate
```

Inspect generated SQL before committing. Custom append-only audit triggers must remain present in the migration.

## Project structure

```text
app/                   public pages, protected dashboard, server API routes
app/components/        shared public and internal interface components
db/schema.ts           normalized relational schema
db/bootstrap.ts        idempotent local schema + fictional seed data
db/queries.ts          scoped reads and append-only audit helper
drizzle/               versioned database migrations
lib/auth.ts            request/session identity loading
lib/authorization.ts   Level A–D server authorization rules
lib/security.ts        password, session, CSRF/origin, checksum helpers
lib/i18n.ts            Kazakh-first localization contract, RU/EN-ready
worker/                 application worker and security response headers
docs/                   architecture, RBAC, security, and roadmap
tests/                  build, migration, audit, and authorization checks
```

## Key invariants

1. One person has one permanent `person_profiles` record.
2. `membership_status` and assigned system roles are independent.
3. Every decision appends `membership_status_history`; history is never overwritten.
4. Branch access is filtered by server-side branch scope.
5. Department access exposes only the professional fields needed for its mandate.
6. Members can update only the allowlisted fields in `/api/profile`.
7. Private document bytes live in R2 and are returned only by an authenticated, authorized download route.
8. Audit rows cannot be updated or deleted: SQLite triggers reject both operations.

## Further documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Roles and permissions](docs/ROLES_AND_PERMISSIONS.md)
- [Security model](docs/SECURITY.md)
- [Phase 2 and Phase 3 roadmap](docs/ROADMAP.md)

## Private repository readiness

The repository ignores environment files, secrets, local database state, private uploads, runtime state, local test credential notes, output artifacts, and dependencies. `.env.example` contains placeholders only. Do not commit real member data or private documents.
