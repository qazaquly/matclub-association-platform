# Architecture summary

## Phase 1 foundation and Phase 2 management platform

Phase 1 has four surfaces sharing one domain model:

1. Public institutional site.
2. Validated membership intake with regional assignment and protected uploads.
3. Member, branch, department, and central role-scoped workspaces.
4. Membership history and an append-only audit ledger.

Phase 2.1 adds dynamic news, publications, partners, public project information, and public media. Phase 2.2 adds the permanent Event core, public calendar, structured results, and explicit Event-News relationships. Phase 2.3 adds internal member registration, invited guests, scoped reception, attendance, seating, and PersonProfile activity history. The Projects block adds internal national/branch Projects, accountable structures and leaders, stages, participants, results, private documents, and direct Project participation records in that same history. Competition-management functions remain outside this release.

## Dynamic public CMS

The fixed `public_content` key/value layer remains responsible for protected page text and destinations. Phase 2.1 adds stable-ID domain records in `news`, `publications`, `partners`, and `public_projects`; none of these replace the fixed layer. News, publications, and public projects move through `DRAFT`, `PUBLISHED`, and `ARCHIVED`. Partners use `active` and `inactive`. Restoring a previously published record returns it to `PUBLISHED`, not `DRAFT`; the approved retention rules below determine which archived records can later be physically removed.

Create/edit capability is separate from publish/archive capability. Body fields use restricted Markdown rendered as React nodes without `dangerouslySetInnerHTML`, raw HTML execution, or JavaScript URLs. Phase 2.2 links News through `event_news_links` with an explicit `EVENT_ANNOUNCEMENT` or `EVENT_RESULT` relation and a real Event foreign key; title matching and generic source-ID placeholders are not used.

CMS images use a separate `PublicObjectStorage` contract and `public_media` metadata. Draft media is available only to an authenticated content manager; anonymous delivery begins only when an active media record is referenced by published content or an active partner.

Archived news is physically removed after 60 days except when it is explicitly linked to an Event record. Archived, never-published publication and public-project drafts follow the same retention rule; previously published publications and projects remain archived. Public media is removed only after it has been unreferenced by CMS content, partners, and Events and archived for 60 days, using a retryable two-stage purge. The daily scheduled cleanup never targets Events, people, membership applications, membership decisions or status history, private membership documents, or the append-only audit ledger. A future Event cleanup may remove only empty test drafts; published or historical Events are already protected from physical deletion at the PostgreSQL layer.

## Event core

`events` is the single source for public lists, monthly calendar cells, the nearest homepage Event, detail pages, lifecycle state, registration, attendance, seating, and activity relations. It supports `NATIONAL` and `BRANCH` scope plus `DRAFT`, `SUBMITTED`, `PUBLISHED`, `POSTPONED`, `CANCELLED`, `COMPLETED`, and `ARCHIVED` states. Only records with an original publication timestamp and a live public lifecycle state are available anonymously; postponed, cancelled, and completed Events remain visible as institutional history.

Branch directors and explicitly assigned branch Event coordinators may create and edit drafts only for the branch ID carried by their role scope. They may submit for central review but cannot publish through a changed client payload. President and VP2 initially receive global management and publication capabilities. Event result data is stored once in `event_results`; a separate News draft can be generated from the Event or result without duplicating the Event record or automatically publishing News.

## Event participation

`event_registrations` stores full members and separately identified invited guests. Capacity checks run under an Event row lock; there is no waitlist. A full member may self-register once and cancel only before the stored start time. `event_attendance` stores `PENDING`, `PRESENT`, or `ABSENT` independently from registration state. Only `PRESENT` for a linked member activates a direct-FK `person_activities` record on the existing profile; reversing attendance revokes rather than deletes that history. Seating uses optional Event-owned rows or tables with database-enforced unique seats. Registration, attendance, and activity rows cannot be physically deleted.

Participant names are available only to an actor with the participant capability and matching Event scope. The public live endpoint returns Event metadata and aggregate registered/present/absent/remaining counts without names, emails, phones, or organizations.

## Internal Projects

`projects` is the internal management record and remains separate from the public CMS `public_projects` record. A central administrator may explicitly link one internal Project to one public Project; the link does not publish internal participants, documents, stages, or results. Projects support national or branch scope, an accountable department, a designated leader, dated stages, role-bearing participants, one structured result, and private checked documents.

President and VP2 manage all Projects. Branch directors and the separately assignable branch Project coordinator manage only Projects whose stored branch matches their role scope. Department heads manage only national Projects assigned to their stored department scope. A designated Project leader may work on their own Project without receiving unrelated administration access. Completed participation activates a direct-foreign-key `PROJECT_PARTICIPATION` entry in the same `person_activities` stream used by confirmed Event attendance; reverting participation revokes rather than deletes that entry. Project, stage, participant, result, document, and activity history cannot be physically deleted.

## Branch workspace

`/dashboard/branches/:id` is a read model over the existing branch-owned records, not a duplicate data store. It combines current membership and application counts, recent profiles and applications, branch Events and Projects, their results, authorized application/Project documents, leadership, and a user-selected reporting period. Central full-access roles may open every branch; branch administration roles may resolve only the branch IDs stored in their role scope. Draft intake documents are excluded, and Project documents appear only when the actor also has the dedicated Project-document capability.

`/dashboard/reports` and `/api/reports/export` use a shared server-side report builder over the canonical records. Filters are applied before rows are returned, exports are capped at 5,000 rows per request, and the actor's stored branch predicate is always intersected with any requested branch. Excel files are generated as standards-compliant XLSX workbooks; PDFs use an embedded Cyrillic-capable font and repeat table headers across pages.

`/dashboard/analytics` is a server-side management read model over those same canonical membership, application, Event, registration, attendance, Project, participant, and result records. It compares a selected period with the immediately preceding equal-length period, produces monthly trends, membership/professional-category distributions, branch comparisons, and attention signals for inactive branches. It creates no duplicate analytics records. President and VP2 receive the national view; branch-scoped actors see only the branch IDs stored in their assignments, regardless of URL parameters.

## People search

The existing member list is also the scoped institutional people-search surface. PostgreSQL predicates combine free text, exact date-of-birth age bounds, workplace, position, locality, branch, membership status, and professional-category assignment. Search predicates are always conjoined with the actor's existing branch scope; no submitted filter can widen access. Cyrillic/Kazakh text variants are generated server-side to avoid relying solely on database collation for case-insensitive matching.

## Institutional document registry

`institutional_documents` is the permanent catalog for orders, protocols, decisions, regulations, official letters, reports, and other governed records. Each record carries its official number and date, national or branch scope, optional responsible department, access level, summary, and active/archive state. The exact number/date/type combination cannot be registered twice.

File replacement never overwrites an earlier file. Every upload appends an immutable `institutional_document_versions` row with an increasing version number, uploader, timestamp, checksum, and mandatory change note after the first version. PostgreSQL rejects version updates/deletes/truncation and rejects physical deletion of catalog records; lifecycle changes use archive/restore and the append-only audit ledger. Private bytes use the existing private object-storage boundary and have no public URL.

Visibility is resolved server-side. `LEADERSHIP` is limited to President and VP2; `RESPONSIBLE` is available to the stored branch or department scope; `MEMBERS` is available to full members nationally or within their own branch. President/VP2 manage all records, branch directors manage their own branch records, and department heads manage national records assigned to their department. Read access never implies create, version, metadata, or archive authority.

## Domain flow

```text
public registration and application form
  → create one User with a password hash
  → resolve active branch from region
  → create one linked PersonProfile
  → create MembershipApplication
  → append applicant status history
  → branch review
      ├─ rejected → append rejected history
      ├─ reserve  → append reserve history
      └─ approved → member status + append history + member role on the same user
```

Status changes never create a second person profile. Application decisions and membership state remain separate records.

Rejected profiles are excluded from the active people directory, member reports and analytics, Branch-workspace people panels, and direct administrative profile detail. The rejected application remains the sole operational entry point, preserving the submitted data and decision history. An accidentally rejected application may be returned to `awaiting_review` only by President or VP2. The same linked profile returns to `applicant` and reappears in active people surfaces, allowing the normal decision workflow to run again without re-entering the form. The prior rejection is not deleted: its membership-status row remains immutable, and the reopening audit record preserves the previous reviewer, timestamp, and decision reason together with the correction reason.

Every non-self account has a separate, deliberate erasure path for President and VP2, regardless of membership status. It requires the exact `ӨШІРУ` confirmation and a reason, disables the login, replaces identifying fields with a tombstone identity, removes saved drafts, configurable field values, internal notes, private document metadata and bytes, revokes active roles, ends active assignments, and archives/scrubs linked applications. Event/Project participation rows are retained but stripped of personal details so foreign keys and institutional totals remain valid. Append-only status and audit rows remain as the minimum accountability trail; an administrator cannot erase their own account through this path.

Membership intake now creates the single user and linked `registered_user` profile when a valid draft account is first saved. `membership_application_drafts` holds partial form values and draft document links; it is not a `membership_application` and is never visible to branch review. Explicit final submission validates the complete draft, claims it with a compare-and-set status transition, creates exactly one review application, moves document metadata to that application, assigns the stored active branch, updates the profile to `applicant`, and appends history/audit in one PostgreSQL transaction.

## PostgreSQL and Prisma

`prisma/schema.prisma` is the canonical schema. `prisma/migrations/` contains versioned PostgreSQL SQL, and `db/bootstrap.ts` contains idempotent fictional development fixtures. Runtime access uses Prisma Client with `@prisma/adapter-pg`; no D1 adapter or raw D1 batch remains.

The original Phase 1 tables and relationships are preserved: branches, users and profiles, roles and permissions, scoped assignments, branch staff, applications, status history, uploaded-document metadata, notes, audit history, configurable fields, and rate limits. Structured plain-text public content is stored in `public_content`; field definitions in source constrain types, lengths, and safe destinations so administrators cannot edit layout or executable code. Organizational units retain the existing `departments` identity and assignment relationships while adding an administrator-managed type, parent hierarchy, stable normalized name key, purpose text, and archive-only lifecycle. People can belong to one or several active units without deriving membership from a title or role.

Professional categories use the separate `professional_categories` catalog and `person_professional_category_assignments` many-to-many history. Category IDs are stable while display names remain editable. Ending an assignment sets `removed_at`; deactivating a category does not alter or remove assignments. Membership status, system roles, department assignments, branch scope, and professional categories therefore remain independent concepts.

Administrative writes use Prisma transactions so business state, status history, and audit entries commit or roll back together. Project state, participant state, results, document metadata, and their audit entries follow the same transaction boundary.

## Private file storage

Membership routes depend on `lib/storage/private-object-storage.ts`, not on a vendor SDK or binding. `uploaded_documents` stores metadata and an opaque object key. The current `PostgresPrivateObjectStorage` provider stores bytes in `private_objects`. A future S3-compatible implementation can replace that provider without changing membership workflow, document authorization, or route behavior.

## Authorization

- Central roles have global scope.
- Branch roles carry an explicit branch ID.
- VP1 receives the nationwide professional-field projection.
- Department heads and staff receive that projection only for active person assignments in the department IDs carried by their role scopes.
- A department-head or department-staff role cannot be granted without the ID of an active organizational unit. Names and hierarchy can change without changing that stable scope ID.
- Members are bound to their own profile ID.
- Professional-category catalog and assignment writes use dedicated capabilities. Assignment authorization resolves the target profile's stored branch and active department assignments before applying any future scoped capability.

Sensitive routes load target scope from PostgreSQL before authorizing. Client-submitted branch values never grant access.

Draft documents remain owner-only while `uploaded_documents.draft_id` is set. Final submission clears the draft link and attaches the same private object metadata to the submitted application; file bytes are not uploaded again.

## Immutable audit history

PostgreSQL triggers reject every `UPDATE`, `DELETE`, and `TRUNCATE` on `audit_logs` and `membership_status_history`, including changes attempted through Prisma or direct SQL with the application database role. Audit rows retain actor, timestamp, action, target, previous/new JSON, reason, IP address, and session ID where applicable. Public-content, professional-category, and organizational-structure changes use the same append-only audit ledger. Organizational units cannot be deleted or truncated; a unit can be archived only after active children, people, and role scopes have been explicitly moved or ended. Status-history rows retain every previous/new status pair, actor, timestamp, and reason.
