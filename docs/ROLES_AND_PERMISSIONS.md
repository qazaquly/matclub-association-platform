# Roles and permissions

Membership status and system role are independent. A person can be a `member` while also holding a scoped administrative role; changing one does not silently change the other.

## Access matrix

| Capability | A — President / VP1 / super admin | B — VP2 / department | C — branch | D — member |
|---|---:|---:|---:|---:|
| View all person profiles | Yes | No | No | No |
| View professional projection | Yes through full member view | Yes | Own branch only | Own profile only |
| View applications | All | No | Own branch | No |
| View private application documents | All | No | Own branch | Own permitted documents only |
| Decide application | All | No | Own branch | No |
| View branch-internal notes | All | No | Own branch | No |
| View central-only notes | Yes | No | No | No |
| Change membership status/branch | Yes | No | No | No |
| Manage roles | Yes | No | No | No |
| Manage branch status/name | Yes | No | No | No |
| View audit ledger | Yes | No | No | No |
| Edit own permitted fields | Yes | Yes | Yes | Yes |

## Server enforcement

- `lib/authorization.ts` defines role families and scope helpers.
- dashboard pages call the same server authorization rules used by API routes;
- branch reads add a database `branch_id` predicate;
- application detail and document download load the stored branch before checking scope;
- central-only mutations require `isFullAccess`;
- member self-update uses an explicit field allowlist and has no SQL assignment for official or internal fields.

No ordinary route can edit or delete an audit record.
