-- Allow one centrally assigned Project to appear in every active Branch workspace.

ALTER TABLE "projects" DROP CONSTRAINT "projects_scope_owner_check";
ALTER TABLE "projects" DROP CONSTRAINT "projects_scope_check";

ALTER TABLE "projects" ADD CONSTRAINT "projects_scope_check"
CHECK ("project_scope" IN ('NATIONAL', 'BRANCH', 'ALL_BRANCHES'));

ALTER TABLE "projects" ADD CONSTRAINT "projects_scope_owner_check" CHECK (
  ("project_scope" = 'NATIONAL' AND "branch_id" IS NULL) OR
  ("project_scope" = 'ALL_BRANCHES' AND "branch_id" IS NULL) OR
  ("project_scope" = 'BRANCH' AND "branch_id" IS NOT NULL)
);

INSERT INTO "audit_logs" ("id", "action_type", "target_entity", "target_entity_id", "new_value", "reason", "created_at") VALUES (
  'audit-project-all-branches-scope-20260904',
  'platform.project_all_branches_scope_installed',
  'platform_schema',
  'project-all-branches-scope',
  '{"projectScope":"ALL_BRANCHES","branchWorkspaceVisibility":true}',
  'Жобаны барлық филиалға бірден тағайындау мүмкіндігі енгізілді',
  CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;
