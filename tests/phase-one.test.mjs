import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Kazakh public site without competition functionality", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Қазақстан математиктерінің республикалық қауымдастығы/i);
  assert.match(html, /Бірлестікке мүше болу/);
  assert.doesNotMatch(html, /olympiad registration|scoring protocol|diploma/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("database migration enforces append-only audit records", async () => {
  const sql = await readFile(new URL("../drizzle/0000_far_grim_reaper.sql", import.meta.url), "utf8");
  const database = new DatabaseSync(":memory:");
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
    database.exec(statement);
  }
  database.prepare("INSERT INTO audit_logs (id, action_type, target_entity, target_entity_id, created_at) VALUES (?, ?, ?, ?, ?)")
    .run("audit-1", "test.action", "test", "target-1", new Date().toISOString());
  assert.throws(() => database.prepare("UPDATE audit_logs SET action_type = 'changed' WHERE id = 'audit-1'").run(), /immutable/i);
  assert.throws(() => database.prepare("DELETE FROM audit_logs WHERE id = 'audit-1'").run(), /immutable/i);
});

test("all sensitive write routes authenticate and authorize on the server", async () => {
  const files = await Promise.all([
    "app/api/applications/[id]/decision/route.ts",
    "app/api/members/[id]/route.ts",
    "app/api/access/roles/route.ts",
    "app/api/branches/[id]/route.ts",
    "app/api/documents/[id]/route.ts",
  ].map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")));
  for (const source of files) assert.match(source, /authenticateRequest\(request\)/);
  assert.match(files[0], /canAccessBranch/);
  assert.match(files[1], /isFullAccess/);
  assert.match(files[2], /canManageRoles/);
  assert.match(files[4], /Cache-Control.*private, no-store/s);
});

test("member-editable updates cannot change official or internal fields", async () => {
  const source = await readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /membership_status\s*=|branch_id\s*=|membership_started_at\s*=/);
  assert.match(source, /profile\.self_updated/);
  assert.match(source, /audit_logs/);
});
