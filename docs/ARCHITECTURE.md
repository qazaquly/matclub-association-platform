# Architecture summary

## Product boundaries

Phase 1 is split into four surfaces that share one domain model:

1. **Public institutional site** — static and read-only public information.
2. **Membership intake** — validated public form, terms acceptance, regional assignment, and protected uploads.
3. **Role-scoped workspace** — member, branch, department, and central-administration views.
4. **Institutional history** — membership status history and an append-only audit ledger.

Competition and olympiad functions are explicitly outside this system boundary.

## Domain flow

```text
public form
  → identify region
  → create one PersonProfile
  → create MembershipApplication
  → append applicant status history
  → assign branch
  → branch review
      ├─ rejected → append rejected history
      ├─ reserve  → append reserve history
      └─ approved → member status + append history + member role (when a user exists)
```

The workflow never creates a second profile when status changes. Application decisions and membership status are related but deliberately stored separately.

## Persistence

D1 stores structured state and relational metadata. R2 stores document bytes. `uploaded_documents` contains only metadata, checksum, ownership, visibility, and an unguessable object key. R2 is never publicly bound to a static URL.

`db/schema.ts` is the canonical Drizzle schema. `drizzle/` contains versioned migrations. `db/bootstrap.ts` provides an idempotent local bootstrap for the Sites development runtime and fictional data only.

## Authorization

Authentication identifies a user. Authorization is evaluated again on every sensitive server route. UI visibility is a convenience, not a security boundary.

- central users receive global scope;
- branch roles carry an explicit `branch` scope ID;
- department roles carry a department scope and use a professional-field projection;
- members are always bound to their own profile ID.

Mutations obtain the target's scope from the database before checking authorization. Client-submitted branch IDs do not grant access.

## Audit and history

Membership status history is append-only by application behavior. Audit records are stronger: the database migration and local bootstrap install triggers that abort every `UPDATE` or `DELETE` against `audit_logs`.

Administrative mutations write business state, status history, and audit event in a D1 batch. Audit rows capture actor, timestamp, action, target, prior/new JSON, reason, IP, and session ID where applicable.

## Extensibility

The public and dashboard routes depend on `db/queries.ts`, not on storage details. Future modules should add new domain tables and route modules instead of expanding `person_profiles` into a catch-all record.

Configurable application-field definitions and values are already separated so later fields do not require rebuilding the core profile workflow. Locale keys are isolated in `lib/i18n.ts`; Russian and English dictionaries can be added without changing authorization or persistence code.
