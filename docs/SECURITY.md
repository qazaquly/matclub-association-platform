# Security model

## Authentication

- Passwords use PBKDF2-HMAC-SHA256 with a random 128-bit salt and 210,000 iterations.
- HMAC-signed sessions expire after 12 hours and use HttpOnly, SameSite=Lax cookies; HTTPS adds Secure.
- Production refuses to sign sessions without `AUTH_SECRET`.
- Login attempts are rate-limited by normalized email and client IP through an atomic PostgreSQL upsert.
- Membership validation failures do not consume the valid-submission limit. Unauthenticated draft-creation floods retain a separate higher-volume abuse limit, while fully valid submissions use per-IP and per-user limits.

## Requests and authorization

- Sensitive POST routes enforce same-origin checks when `Origin` is present.
- Zod validates public and administrative payloads.
- Prisma parameterizes database values.
- Server routes load both actor and target before evaluating role and branch scope.
- Only President and VP2 pass the server-side role/scoped-access governance predicate; client forms never authorize a role change.
- Access mutations are serialized, reject duplicate active assignments, preserve at least one full-global administrator, and append complete before/after role or department-access snapshots to the immutable audit ledger.
- Organizational-structure writes use the same President/VP2-only predicate and serialized transaction lock. PostgreSQL and server checks reject hierarchy cycles, duplicate normalized sibling names, archive-in-use operations, and physical deletion; every accepted create, update, or archive appends previous/new values and the stated reason to the immutable audit ledger.
- Professional-category catalog and assignment routes require dedicated server-side capabilities. Active assignments have a PostgreSQL partial unique index, removals are historical end-dates, and each create/update/assign/remove operation appends previous/new values to the immutable audit ledger.
- Security headers deny framing, MIME sniffing, camera, microphone, and geolocation access.

## Documents

- Intake accepts 1–3 PDF, JPEG, or PNG files, each at most 5 MB, and validates file signatures.
- Filenames are metadata; object keys use random UUID paths.
- Every file receives a SHA-256 checksum.
- Bytes are available only through `PrivateObjectStorage`; there is no public object URL.
- Downloads require the profile owner or an authorized central/own-branch role.
- Responses use `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`.

## Dynamic public content and media

- Dynamic material is private while in `DRAFT`; anonymous list and detail queries require `PUBLISHED` and a non-archived record.
- Create/edit and publish/archive are separate server-side capabilities. President and VP2 receive both initially.
- Restricted Markdown is converted to React elements without raw HTML injection. `javascript:` links and executable HTML constructs are rejected.
- CMS images accept JPEG, PNG, WebP, or AVIF up to 8 MB, receive random object keys and SHA-256 checksums, and use a separate public-storage abstraction rather than private membership document storage.
- Draft media is not publicly retrievable. Public delivery requires a live reference from published content or an active partner and includes MIME-sniffing protection and a restrictive content security policy.
- Create, edit, publish, archive, restore, and partner visibility changes preserve complete immutable before/after audit records.
- Retention cleanup runs once daily. It deletes only archived news, archived never-published CMS drafts, and public media that has remained both archived and unreferenced for 60 days. Media deletion is claimed before bytes are removed and is retried after failures. Profile, application, decision/status, attendance, private-document, and audit records are excluded from automatic deletion.
- Event-linked News is excluded from automatic deletion because the explicit relation is part of institutional history. Public-media cleanup also treats Event covers as active references.

## Events

- Event create/edit, publication, status changes, structured result updates, and generated News links use server-side capability checks and immutable audit rows.
- A branch actor cannot select a national scope, another branch ID, or a responsible profile outside the stored branch scope. Branch submissions remain private until an actor with `events.publish` approves them.
- Draft and submitted Events are never returned by public queries. Previously published postponed, cancelled, and completed Events remain public with their current status and explanation.
- Generated announcement and result News records always start in `DRAFT`; the Event route has no automatic News publication path.
- PostgreSQL rejects physical deletion of any published or historical Event.
- Internal self-registration requires an authenticated profile in full `member` status, locks the Event row while enforcing capacity, and is idempotent for the same Event/person pair. There is no public name lookup and no waitlist.
- Registration and attendance are independent. Only a scoped actor with `events.attendance.manage` can mark `PRESENT` or `ABSENT`; a present linked member activates a direct Event-to-PersonProfile activity record.
- Participant names, emails, phones, organizations, reception search, and seat assignments require both a dedicated capability and stored Event scope. Ordinary participants never receive another participant's record.
- The public live endpoint returns aggregate counts only. PostgreSQL triggers reject physical deletion of registration, attendance, and person-activity history.

## Projects

- Project create/update, lifecycle, stage, participant, result, document, and archive actions load the stored Project scope before checking dedicated server-side capabilities.
- Branch and department roles cannot widen scope with submitted IDs. The independently assignable branch Project coordinator has no member/application, Event, CMS, role, or audit privilege.
- Project documents use the private storage abstraction, random keys, signatures, checksums, 10 MB limits, private/no-store downloads, and MIME-sniffing protection. Archiving hides metadata but preserves institutional bytes and audit history.
- Internal Project records are separate from public CMS Projects. Linking them exposes no internal Project data automatically.
- Only completed Project participation activates `PROJECT_PARTICIPATION` in the member's existing activity history. Reopening or withdrawing the participant revokes the activity; PostgreSQL rejects physical deletion of Project and participation history.

## Personal and institutional data

- Public responses do not expose internal notes, decision history, documents, or audit content.
- Department views omit contact, document, and administrative fields and require an explicit active department assignment for scoped department roles.
- Professional-category filtering is conjoined with the existing nationwide-professional, department, or branch predicate; a submitted filter never broadens scope.
- Branch totals, lists, member records, applications, notes, and documents are filtered by the stored branch ID.
- The unified Branch workspace applies that same stored branch predicate to every member, application, Event, Project, result, attendance, and report query. Project documents additionally require `projects.documents.manage`; draft application documents are never included.
- Management reports require separate `reports.read` and `reports.export` capabilities. URL filters can only narrow the server-derived branch scope and cannot widen it; downloads use private no-store responses and are limited to 5,000 rows.
- Management indicators require `reports.read` and calculate every total, trend, distribution, and branch row after applying the server-derived branch scope. Date and branch query parameters can narrow the view but cannot expose another branch.
- Internal official documents require a dedicated read or management capability plus server-derived visibility and branch/department scope. File downloads re-check the parent record, use private no-store responses, and never expose a public object URL. New uploads append checksum-bearing versions; PostgreSQL rejects version mutation and any physical deletion of the official catalog.
- People-search criteria are database-side refinements of the authorized profile set. Keyword and demographic filters cannot select a branch outside the actor's stored role scope.
- Member updates use an explicit allowlist.
- Public membership intake creates a unique user and linked profile once at the first valid draft save; final submission atomically creates the review application, profile status change, initial history, document linkage, and audit record.
- Draft account creation preserves one user and one profile in `registered_user` state. Debounced draft saves do not create review applications; final submission uses a database compare-and-set and a partial unique index to prevent double-submit duplicates.
- Draft documents are accessible only to their owner. Branch access starts only after final submission attaches the document to an application with a stored branch.
- Reopening a rejected application is restricted to President and VP2, requires a stated reason, and uses a conditional database update so concurrent or repeated requests cannot create duplicate correction history. The original rejection remains in immutable status history and its reviewer, timestamp, and reason are copied into the append-only reopening audit entry.
- Rejection hides the linked profile from active administrative people lists, member reports/analytics, Branch-workspace profile panels, and direct administrative profile detail. It does not physically delete identity, application, consent, decision, or audit evidence; the rejected application remains the controlled recovery path.
- Permanent erasure is available to President/VP2 for any other account, regardless of membership status, and only after exact-text confirmation plus a stated reason. It disables and anonymizes the account/profile, scrubs and archives applications, removes drafts, configurable values, notes, and private document records/bytes, revokes active roles, ends active branch/department/category assignments, and detaches authorship/responsibility links. Event and Project participation history is retained with personal details removed so institutional statistics remain coherent. Self-erasure is blocked; append-only status and audit records remain as a minimal accountability trail and the erased account cannot authenticate.
- PostgreSQL rejects audit and membership-status-history updates, deletes, and truncation independently of application code.

## Before real rollout

- remove fictional fixtures and rotate the test password;
- configure production database credentials and a strong `AUTH_SECRET`;
- configure backups, retention, and centralized monitoring;
- add malware scanning before accepting real documents;
- complete legal and independent security review.
