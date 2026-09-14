# Roles and permissions

Membership status and system role are independent. A person can be a `member` while also holding a scoped administrative role; changing one does not silently change the other.

## Access matrix

| Capability | A — President / VP2 | B — VP1 / department | C — branch | D — member |
|---|---:|---:|---:|---:|
| View all person profiles | Yes | No | No | No |
| View professional projection | Yes through full member view | VP1 nationwide; department roles only explicit department assignments | Own branch only | Own profile only |
| View applications | All | No | Own branch | No |
| View private application documents | All | No | Own branch | Own permitted documents only |
| Decide application | All | No | Own branch | No |
| Reopen a rejected application | President and VP2 only | No | No | No |
| Permanently erase any other account | President and VP2 only | No | No | No |
| View branch-internal notes | All | No | Own branch | No |
| View central-only notes | Yes | No | No | No |
| Change membership status/branch | Yes | No | No | No |
| Manage roles and scoped access | President and VP2 only | No | No | No |
| Create, edit, and archive organizational units | President and VP2 only | No | No | No |
| Manage branch status/name | Yes | No | No | No |
| Open unified Branch workspace | All branches | No | Own branch | No |
| View audit ledger | Yes | No | No | No |
| Manage public-site content | Yes, through `public_content.manage` | No | No | No |
| Create and edit dynamic public content | Yes, through `dynamic_content.manage` | No | No | No |
| Publish and archive dynamic public content | Yes, through `dynamic_content.publish` | No | No | No |
| Manage public CMS media | Yes, through `public_media.manage` | No | No | No |
| Create/edit national Events | Yes, through `events.manage_global` | No | No | No |
| Create/edit own-branch Event drafts | Yes | No | Branch director or scoped Event coordinator through `events.manage_branch` | No |
| Publish/postpone/cancel/complete Events | Yes, through `events.publish` | No | No | No |
| Save own-branch Event results | Yes | No | Scoped Event manager through `events.results.manage` | No |
| Generate linked Event News drafts | Yes | No | Scoped Event manager through `events.news.generate` | No |
| View Event participant list | Yes | No | Director/Event manager for own Event branch | Participants cannot see each other |
| Add/cancel Event participants | Yes | No | Director/Event manager for own Event branch | Self-register/cancel before start only |
| Mark attendance and manage seating | Yes | No | Director/Event manager for own Event branch | No |
| Manage national Projects | Yes, through `projects.manage_global` | Department head only for an assigned department | No | Designated leader only for own Project |
| Manage branch Projects | Yes | No | Director/scoped Project coordinator for own branch | Designated leader only for own Project |
| Manage Project stages, participants, results, documents | Yes | Department head within department scope | Director/Project coordinator within branch scope | Designated leader only for own Project |
| View Project participation in profile history | Yes | Scoped profile view only | Own-branch profile view | Own profile only |
| Manage professional-category catalog | President and VP2 through `professional_categories.catalog.manage` | No | No | No |
| Assign official professional categories | President and VP2 through `professional_categories.assign` | No | No | No |
| Filter professional profiles by category | Global | VP1 nationwide; department roles only explicit department assignments | Own branch only | No |
| Edit own permitted fields | Yes | Yes | Yes | Yes |
| Read internal official documents | All authorized levels | Responsible department and member-visible documents | Own branch responsible and member-visible documents | Member-visible national and own-branch documents |
| Manage internal official documents | All | Department head within assigned department | Branch director within own branch | No |

## Server enforcement

- `lib/authorization.ts` defines role families and scope helpers.
- dashboard pages call the same server authorization rules used by API routes;
- branch reads add a database `branch_id` predicate;
- branch dashboards, totals, branch lists, members, applications, and documents use the same stored branch scope;
- the unified Branch workspace rechecks the requested branch ID server-side; its Project-document panel remains capability-gated and never exposes application drafts;
- department reads join active `person_department_assignments`; roles and titles do not create department membership;
- organizational units form an acyclic parent hierarchy and are managed without code or deployment changes; active sibling names are Unicode-normalized and unique;
- department-head and department-staff roles always require an active unit scope ID; a branch ID or empty/global scope is rejected server-side;
- organizational units with active children, people, or role scopes cannot be archived, and database triggers prohibit physical deletion;
- application detail and document download load the stored branch before checking scope;
- rejected-application reopening uses a separate President/VP2-only server predicate; branch reviewers can see the retained history but cannot reverse a final rejection;
- rejected applicants are intentionally absent from people/member surfaces and remain available only through the rejected-applications workflow until an authorized reopening restores the same saved profile;
- permanent account erasure is a separate President/VP2-only action with exact-text confirmation and a reason; it works for every membership status, blocks self-erasure, revokes active access, and anonymizes retained operational history;
- central-only mutations require `isFullAccess`;
- role and scoped-access mutations require `canManageRoles`, which accepts only active President or VP2 assignments; every change records the target user's complete previous/new role and capability snapshots;
- protected President/VP2 assignments cannot be self-revoked through the ordinary role-management route, and serialized server-side checks prevent the active full-global administrator count from reaching zero;
- public-content mutations require the dedicated `public_content.manage` capability, currently granted only to President and VP2; it can later be assigned to a limited communications role without granting global administration;
- dynamic CMS create/edit, publish/archive, and image operations require `dynamic_content.manage`, `dynamic_content.publish`, and `public_media.manage` respectively; President and VP2 receive them initially, while a future communications role may receive only these capabilities without global administration;
- Event management uses `events.manage_global`, `events.manage_branch`, `events.publish`, `events.results.manage`, and `events.news.generate`; the branch ID is loaded from the stored role assignment, and only central publishing capability can make a branch submission public;
- the scoped `branch_event_manager` role grants Event draft/result/News-generation work only and does not inherit application, member, document, or other branch-administration access;
- Project management uses separate `projects.*` capabilities. The scoped `branch_project_manager` role can manage only its stored branch Projects and receives no membership, Event, CMS, role, or audit administration;
- department Project access requires both `projects.manage_department` and the Project's stored responsible-department ID to match the actor's active role scope; a designated leader is limited to that one Project;
- President/VP2 can assign a Project to every Branch at once; it then appears in each Branch workspace, while an individually assigned Project remains limited to its stored Branch;
- participant list, participant management, attendance, and seating are four separate capabilities. Every route also checks the stored Event branch against the actor's role scope; self-registration never grants access to another participant;
- professional-category catalog and assignment mutations require their own dedicated capabilities, currently granted only to President and VP2; assignment checks also enforce the actor's stored branch/department scope so future delegation cannot imply global access;
- category and region filters are added to existing database scope predicates and never replace them;
- age, workplace, position, locality, status, category, and keyword search predicates are combined with the same stored branch boundary and never replace it;
- member self-update uses an explicit Prisma data allowlist and never accepts official or internal fields.

No ordinary route can edit or delete an audit or membership-status history record.

### Institutional document registry

- `institutional_documents.read` opens only records allowed by the stored access level and organizational scope.
- `institutional_documents.manage_global` is assigned to President and II vice-president.
- `institutional_documents.manage_branch` lets a branch director register, revise, archive, and restore records only for the branch ID stored in the role assignment.
- `institutional_documents.manage_department` gives a department head the same management actions only for national records assigned to the stored department ID.
- `LEADERSHIP` records remain visible only to President and II vice-president. Adding a new file creates a permanent next version and never replaces or deletes the previous file.
### Management reports

- `reports.read` exposes the report workspace.
- `reports.export` permits Excel/PDF download.
- President and II vice-president have national scope. Branch director and branch staff receive both capabilities, but every query remains limited to their assigned branch IDs.
- The management-indicators workspace also requires `reports.read`; it adds no broader administrative privilege. National comparisons are available only to President and II vice-president, while branch roles receive the same indicators for their stored branch scope.
