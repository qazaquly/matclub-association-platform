import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/rmb_phase_one?sslmode=disable";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "local-phase-one-verification-secret-2026";
const membershipRegions = [
  "Астана қаласы", "Алматы қаласы", "Шымкент қаласы", "Абай облысы", "Ақмола облысы",
  "Ақтөбе облысы", "Алматы облысы", "Атырау облысы", "Батыс Қазақстан облысы", "Жамбыл облысы",
  "Жетісу облысы", "Қарағанды облысы", "Қостанай облысы", "Қызылорда облысы", "Маңғыстау облысы",
  "Павлодар облысы", "Солтүстік Қазақстан облысы", "Түркістан облысы", "Ұлытау облысы", "Шығыс Қазақстан облысы",
];
const workerCache = new Map();
const appEnv = {
  DATABASE_URL,
  AUTH_SECRET,
  ENVIRONMENT: "production",
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  VINEXT_KV_CACHE: {
    async get(key, type) {
      const value = workerCache.get(key);
      if (value == null) return null;
      if (type === "arrayBuffer") return new TextEncoder().encode(value).buffer;
      if (type === "json") return JSON.parse(value);
      return value;
    },
    async put(key, value) { workerCache.set(key, typeof value === "string" ? value : new TextDecoder().decode(value)); },
    async delete(key) { workerCache.delete(key); },
  },
};
const executionContext = { waitUntil() {}, passThroughOnException() {} };
let workerPromise;
let testServer;
let testAppUrlPromise;

async function worker() {
  workerPromise ??= import(new URL("../dist/server/index.js", import.meta.url).href).then((module) => module.default);
  return workerPromise;
}

async function builtWorkerRequest(path, init = {}) {
  const request = new Request(`http://localhost${path}`, init);
  return (await worker()).fetch(request, appEnv, executionContext);
}

async function testAppUrl() {
  if (process.env.TEST_APP_URL) return new URL(process.env.TEST_APP_URL);
  testAppUrlPromise ??= (async () => {
    const { createServer } = await import("vite");
    testServer = await createServer({
      configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
      server: { host: "127.0.0.1", port: 0, strictPort: true },
    });
    await testServer.listen();
    const address = testServer.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Unable to resolve the integration test server URL.");
    return new URL(`http://127.0.0.1:${address.port}`);
  })();
  return testAppUrlPromise;
}

test.after(async () => {
  if (!testServer) return;
  await Promise.race([
    testServer.close(),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
});

test("Branch workspace unifies branch operations and enforces branch scope", async () => {
  const presidentCookie = await login("president@example.test");
  const branchCookie = await login("branch@example.test");
  const memberCookie = await login("member@example.test");

  const centralResponse = await appRequest("/dashboard/branches/branch-almaty?from=2026-01-01&to=2027-12-31", { headers: authHeaders(presidentCookie) });
  assert.equal(centralResponse.status, 200);
  const centralHtml = visibleMarkup(await centralResponse.text());
  for (const label of ["Филиалдың жұмыс кабинеті", "Мүшелер", "Өтініштер", "Іс-шаралар", "Жобалар", "Құжаттар", "Кезеңдік есеп"]) {
    assert.match(centralHtml, new RegExp(label));
  }
  assert.match(centralHtml, /branchId=branch-almaty/);
  assert.doesNotMatch(centralHtml, /branchId=branch-east/, "another branch must not leak into the workspace");

  const branchResponse = await appRequest("/dashboard/branches/branch-almaty", { headers: authHeaders(branchCookie) });
  assert.equal(branchResponse.status, 200);
  assert.match(visibleMarkup(await branchResponse.text()), /Алматы қалалық филиалы/);
  assert.equal((await appRequest("/dashboard/branches/branch-east", { headers: authHeaders(branchCookie) })).status, 404);
  assert.equal((await appRequest("/dashboard/branches/branch-almaty", { headers: authHeaders(memberCookie) })).status, 404);
});

test("Advanced people search combines age, workplace, position, status, and branch scope", async () => {
  const branchCookie = await login("branch@example.test");
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query("UPDATE person_profiles SET birth_date = DATE '2000-09-03', workplace = '№123 мектеп', position = 'Математика мұғалімі' WHERE id = 'person-member'");
    const query = new URLSearchParams({ ageUnder: "35", workplace: "мектеп", position: "математика мұғалімі", membershipStatus: "member" });
    const response = await appRequest(`/dashboard/members?${query}`, { headers: authHeaders(branchCookie) });
    assert.equal(response.status, 200);
    const html = visibleMarkup(await response.text());
    assert.match(html, /member@example\.test/);
    assert.doesNotMatch(html, /reserve@example\.test/);
    assert.match(html, /Жалпы фильтрлі іздеу/);
  } finally {
    await client.query("UPDATE person_profiles SET birth_date = NULL, workplace = 'Сынақ дерегі', position = 'Математика мұғалімі' WHERE id = 'person-member'");
    await client.end();
  }
});

test("Applications contain only new registrations and applicants while Members contain only approved members", async () => {
  const email = `new-candidate-${randomUUID()}@example.test`;
  const registered = await registerAccount(email, "Seven77");
  assert.equal(registered.response.status, 201, await registered.response.clone().text());
  const presidentCookie = await login("president@example.test");

  const applications = await appRequest("/dashboard/applications", { headers: authHeaders(presidentCookie) });
  assert.equal(applications.status, 200);
  const applicationHtml = visibleMarkup(await applications.text());
  assert.ok(applicationHtml.includes(email), "newly registered account must appear in Applications");
  assert.ok(applicationHtml.includes("applicant@example.test"), "applicant must appear in Applications");
  assert.ok(!applicationHtml.includes("member@example.test"), "approved member must not appear in Applications");
  assert.ok(!applicationHtml.includes("reserve@example.test"), "reserve must not appear in Applications");

  const members = await appRequest("/dashboard/members", { headers: authHeaders(presidentCookie) });
  assert.equal(members.status, 200);
  const memberHtml = visibleMarkup(await members.text());
  assert.ok(memberHtml.includes("member@example.test"), "approved member must appear in Members");
  assert.ok(!memberHtml.includes("applicant@example.test"), "applicant must not appear in Members");
  assert.ok(!memberHtml.includes("reserve@example.test"), "reserve must not appear in Members");
  assert.ok(!memberHtml.includes(email), "newly registered account must not appear in Members");
});

test("Management reports export scoped Excel and PDF files", async () => {
  const branchCookie = await login("branch@example.test");
  const memberCookie = await login("member@example.test");

  const page = await appRequest("/dashboard/reports?kind=members", { headers: authHeaders(branchCookie) });
  assert.equal(page.status, 200);
  const html = visibleMarkup(await page.text());
  assert.match(html, /Есептер және дерек шығару/);
  assert.match(html, /Excel/);
  assert.match(html, /PDF/);

  const xlsx = await appRequest("/api/reports/export?kind=members&format=xlsx", { headers: authHeaders(branchCookie) });
  assert.equal(xlsx.status, 200);
  assert.equal(xlsx.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const xlsxBytes = new Uint8Array(await xlsx.arrayBuffer());
  assert.equal(new TextDecoder().decode(xlsxBytes.slice(0, 2)), "PK");
  const workbookText = new TextDecoder().decode(xlsxBytes);
  assert.match(workbookText, /Алматы қаласы/);
  assert.doesNotMatch(workbookText, /Шығыс Қазақстан облысы/, "branch export must not include another branch");

  const pdf = await appRequest("/api/reports/export?kind=events&format=pdf", { headers: authHeaders(branchCookie) });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(new TextDecoder().decode(new Uint8Array(await pdf.arrayBuffer()).slice(0, 5)), "%PDF-");

  assert.equal((await appRequest("/dashboard/reports", { headers: authHeaders(memberCookie) })).status, 404);
  assert.equal((await appRequest("/api/reports/export?kind=members&format=xlsx", { headers: authHeaders(memberCookie) })).status, 403);
});

test("Management indicators compare national activity without leaking branch scope", async () => {
  const presidentCookie = await login("president@example.test");
  const branchCookie = await login("branch@example.test");
  const memberCookie = await login("member@example.test");

  const national = await appRequest("/dashboard/analytics?from=2026-01-01&to=2027-12-31", { headers: authHeaders(presidentCookie) });
  assert.equal(national.status, 200);
  const nationalHtml = visibleMarkup(await national.text());
  for (const label of ["Басқару көрсеткіштері", "Мүше, іс-шара және жоба динамикасы", "Филиал белсенділігі", "Алматы қаласы", "Шығыс Қазақстан облысы"]) assert.match(nationalHtml, new RegExp(label));

  const branch = await appRequest("/dashboard/analytics?from=2026-01-01&to=2027-12-31", { headers: authHeaders(branchCookie) });
  assert.equal(branch.status, 200);
  const branchHtml = visibleMarkup(await branch.text());
  assert.match(branchHtml, /Алматы қаласы/);
  assert.doesNotMatch(branchHtml, /Шығыс Қазақстан облысы/);
  assert.equal((await appRequest("/dashboard/analytics", { headers: authHeaders(memberCookie) })).status, 404);
});

test("Institutional document registry preserves versions and enforces access scope", async () => {
  const [presidentCookie, branchCookie, memberCookie] = await Promise.all([
    login("president@example.test"),
    login("branch@example.test"),
    login("member@example.test"),
  ]);
  const token = randomUUID().slice(0, 8);
  const pdf = (name) => new File([new TextEncoder().encode("%PDF-1.4\n% registry test\n%%EOF")], name, { type: "application/pdf" });
  const form = ({ title, number, scopeType = "NATIONAL", branchId = "", accessLevel = "RESPONSIBLE", departmentId = "" }) => {
    const body = new FormData();
    body.set("title", title);
    body.set("documentNumber", number);
    body.set("documentDate", "2026-09-03");
    body.set("documentType", "ORDER");
    body.set("scopeType", scopeType);
    body.set("branchId", branchId);
    body.set("responsibleDepartmentId", departmentId);
    body.set("accessLevel", accessLevel);
    body.set("summary", "Ресми құжат қорының құқық және нұсқа тарихын тексеру.");
    body.set("changeNote", "Алғашқы нұсқа");
    body.set("document", pdf(`${number}.pdf`));
    return body;
  };

  const leadershipTitle = `Басшылық бұйрығы ${token}`;
  const leadershipCreate = await appRequest("/api/institutional-documents", {
    method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie },
    body: form({ title: leadershipTitle, number: `L-${token}`, scopeType: "BRANCH", branchId: "branch-almaty", accessLevel: "LEADERSHIP" }),
  });
  assert.equal(leadershipCreate.status, 303);
  const leadershipId = (leadershipCreate.headers.get("location") ?? "").match(/\/dashboard\/documents\/([^?]+)/)?.[1];
  assert.ok(leadershipId);
  const leadershipPage = await appRequest(`/dashboard/documents/${leadershipId}`, { headers: authHeaders(presidentCookie) });
  assert.equal(leadershipPage.status, 200);
  const leadershipHtml = visibleMarkup(await leadershipPage.text());
  assert.match(leadershipHtml, new RegExp(leadershipTitle));
  const leadershipVersionId = leadershipHtml.match(new RegExp(`/api/institutional-documents/${leadershipId}/versions/([^"?]+)`))?.[1];
  assert.ok(leadershipVersionId);
  assert.equal((await appRequest(`/api/institutional-documents/${leadershipId}/versions/${leadershipVersionId}`, { headers: authHeaders(presidentCookie) })).status, 200);
  assert.equal((await appRequest(`/dashboard/documents/${leadershipId}`, { headers: authHeaders(memberCookie) })).status, 404);
  assert.equal((await appRequest(`/dashboard/documents/${leadershipId}`, { headers: authHeaders(branchCookie) })).status, 404);
  assert.equal((await appRequest(`/api/institutional-documents/${leadershipId}/versions/${leadershipVersionId}`, { headers: authHeaders(memberCookie) })).status, 403);
  const forbiddenLeadershipUpdate = form({ title: leadershipTitle, number: `L-${token}`, scopeType: "BRANCH", branchId: "branch-almaty", accessLevel: "RESPONSIBLE" });
  forbiddenLeadershipUpdate.set("action", "update");
  assert.equal((await appRequest(`/api/institutional-documents/${leadershipId}`, { method: "POST", headers: { origin: "http://localhost", cookie: branchCookie }, body: forbiddenLeadershipUpdate })).status, 403);

  const membersTitle = `Мүшелер ережесі ${token}`;
  const membersCreate = await appRequest("/api/institutional-documents", {
    method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie },
    body: form({ title: membersTitle, number: `M-${token}`, accessLevel: "MEMBERS" }),
  });
  const membersId = (membersCreate.headers.get("location") ?? "").match(/\/dashboard\/documents\/([^?]+)/)?.[1];
  assert.ok(membersId);
  const memberList = await appRequest("/dashboard/documents", { headers: authHeaders(memberCookie) });
  assert.equal(memberList.status, 200);
  const memberListHtml = visibleMarkup(await memberList.text());
  assert.match(memberListHtml, new RegExp(membersTitle));
  assert.doesNotMatch(memberListHtml, new RegExp(leadershipTitle));

  const branchTitle = `Алматы филиалы хаттамасы ${token}`;
  const branchCreate = await appRequest("/api/institutional-documents", {
    method: "POST", headers: { origin: "http://localhost", cookie: branchCookie },
    body: form({ title: branchTitle, number: `B-${token}`, scopeType: "BRANCH", branchId: "branch-almaty", accessLevel: "RESPONSIBLE" }),
  });
  assert.equal(branchCreate.status, 303);
  const branchId = (branchCreate.headers.get("location") ?? "").match(/\/dashboard\/documents\/([^?]+)/)?.[1];
  assert.ok(branchId);
  assert.equal((await appRequest(`/dashboard/documents/${branchId}`, { headers: authHeaders(branchCookie) })).status, 200);
  assert.equal((await appRequest(`/dashboard/documents/${branchId}`, { headers: authHeaders(memberCookie) })).status, 404);

  const versionBody = new FormData();
  versionBody.set("changeNote", "Қол қойылған екінші нұсқа");
  versionBody.set("document", pdf(`B-${token}-v2.pdf`));
  const version = await appRequest(`/api/institutional-documents/${branchId}/versions`, { method: "POST", headers: { origin: "http://localhost", cookie: branchCookie }, body: versionBody });
  assert.equal(version.status, 303);
  const versionPage = await appRequest(`/dashboard/documents/${branchId}`, { headers: authHeaders(branchCookie) });
  assert.match(visibleMarkup(await versionPage.text()), /v2/);

  const archiveBody = new URLSearchParams({ action: "status", status: "ARCHIVED", reason: "Сынақ архиві" });
  assert.equal((await appRequest(`/api/institutional-documents/${branchId}`, { method: "POST", headers: { origin: "http://localhost", cookie: branchCookie, "content-type": "application/x-www-form-urlencoded" }, body: archiveBody })).status, 303);
  const activeAfterArchive = visibleMarkup(await (await appRequest("/dashboard/documents", { headers: authHeaders(branchCookie) })).text());
  assert.doesNotMatch(activeAfterArchive, new RegExp(branchTitle));
  const archivedList = visibleMarkup(await (await appRequest("/dashboard/documents?status=ARCHIVED", { headers: authHeaders(branchCookie) })).text());
  assert.match(archivedList, new RegExp(branchTitle));
  const restoreBody = new URLSearchParams({ action: "status", status: "ACTIVE", reason: "Сынақтан кейін қайтарылды" });
  assert.equal((await appRequest(`/api/institutional-documents/${branchId}`, { method: "POST", headers: { origin: "http://localhost", cookie: branchCookie, "content-type": "application/x-www-form-urlencoded" }, body: restoreBody })).status, 303);

  const forbiddenCreate = await appRequest("/api/institutional-documents", {
    method: "POST", headers: { origin: "http://localhost", cookie: memberCookie },
    body: form({ title: `Рұқсатсыз ${token}`, number: `X-${token}`, accessLevel: "MEMBERS" }),
  });
  assert.equal(forbiddenCreate.status, 403);
});

test("Phase 2.2 Event core enforces publication and branch scope while linking one announcement and one result News draft", async () => {
  const [presidentCookie, vp2Cookie, branchCookie] = await Promise.all([
    login("president@example.test"),
    login("vp2@example.test"),
    login("branch@example.test"),
  ]);
  const token = randomUUID().slice(0, 8);
  const nationalTitle = `Республикалық Event сынағы ${token}`;
  const branchTitle = `Филиал Event сынағы ${token}`;
  const baseEvent = ({ title, scope = "NATIONAL", branchId = "", suffix = "national" }) => new URLSearchParams({
    title,
    slug: `phase-2-2-${suffix}-${token}`,
    summary: "Іс-шара өзегінің жариялану және тарих шекарасын тексеру.",
    description: "## Бағдарлама\n- Кәсіби талқылау\n- Өңірлік тәжірибе алмасу",
    startAt: "2027-03-10T10:00",
    endAt: "2027-03-10T17:00",
    eventScope: scope,
    branchId,
    regionName: scope === "NATIONAL" ? "Астана" : "Алматы",
    eventFormat: "OFFLINE",
    venue: "Математика орталығы",
    onlineUrl: "",
    audience: "Бірлестік мүшелері мен шақырылған сарапшылар",
    organizer: "Республикалық математиктер бірлестігі",
    responsibleProfileId: "",
    responsibleDepartmentId: "",
    registrationMode: "EXTERNAL_LINK",
    externalRegistrationUrl: "https://example.test/event-registration",
    participantLimit: "",
    action: "save",
  });

  const createNational = await appRequest("/api/events", {
    method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
    body: baseEvent({ title: nationalTitle }),
  });
  assert.equal(createNational.status, 303);
  const nationalId = (createNational.headers.get("location") ?? "").match(/\/dashboard\/events\/([^?]+)/)?.[1];
  assert.ok(nationalId);
  const unpublishedList = await appRequest("/events?period=all");
  assert.doesNotMatch(await unpublishedList.text(), new RegExp(nationalTitle));

  const vp2EditBody = baseEvent({ title: `${nationalTitle} жаңартылды` });
  const vp2Edit = await appRequest(`/api/events/${nationalId}`, {
    method: "POST", headers: { origin: "http://localhost", cookie: vp2Cookie, "content-type": "application/x-www-form-urlencoded" }, body: vp2EditBody,
  });
  assert.equal(vp2Edit.status, 303);

  const createOtherBranch = await appRequest("/api/events", {
    method: "POST", headers: { origin: "http://localhost", cookie: branchCookie, "content-type": "application/x-www-form-urlencoded" },
    body: baseEvent({ title: `Рұқсатсыз ${token}`, scope: "BRANCH", branchId: "branch-east", suffix: "forbidden" }),
  });
  assert.equal(createOtherBranch.status, 403);

  const createBranch = await appRequest("/api/events", {
    method: "POST", headers: { origin: "http://localhost", cookie: branchCookie, "content-type": "application/x-www-form-urlencoded" },
    body: baseEvent({ title: branchTitle, scope: "BRANCH", branchId: "branch-almaty", suffix: "branch" }),
  });
  assert.equal(createBranch.status, 303);
  const branchId = (createBranch.headers.get("location") ?? "").match(/\/dashboard\/events\/([^?]+)/)?.[1];
  assert.ok(branchId);
  assert.equal((await appRequest(`/dashboard/events/${branchId}`, { headers: authHeaders(branchCookie) })).status, 200);
  assert.equal((await appRequest(`/dashboard/events/${nationalId}`, { headers: authHeaders(branchCookie) })).status, 404);
  const submitBranch = await appRequest(`/api/events/${branchId}`, {
    method: "POST", headers: { origin: "http://localhost", cookie: branchCookie, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ action: "submit" }),
  });
  assert.equal(submitBranch.status, 303);
  const branchPublishForbidden = await appRequest(`/api/events/${branchId}`, {
    method: "POST", headers: { origin: "http://localhost", cookie: branchCookie, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ action: "publish" }),
  });
  assert.equal(branchPublishForbidden.status, 403);

  for (const eventId of [nationalId, branchId]) {
    const publish = await appRequest(`/api/events/${eventId}`, {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "publish" }),
    });
    assert.equal(publish.status, 303);
  }
  const publicList = await appRequest("/events?period=all");
  const publicHtml = await publicList.text();
  assert.match(publicHtml, new RegExp(`${nationalTitle} жаңартылды`));
  assert.match(publicHtml, new RegExp(branchTitle));

  const announcement = () => appRequest(`/api/events/${nationalId}/news`, {
    method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ relationType: "EVENT_ANNOUNCEMENT" }),
  });
  assert.equal((await announcement()).status, 303);
  assert.equal((await announcement()).status, 303);

  const result = await appRequest(`/api/events/${nationalId}/result`, {
    method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      summary: "Кәсіби талқылау өтіп, ортақ жұмыс бағыттары бекітілді.", participantCount: "120",
      audienceDescription: "Математиктер, мұғалімдер және сарапшылар", mainTopics: "Математикалық білім және өңірлік ынтымақтастық",
      outcomes: "Келесі бірлескен бастамалардың жоспары жасалды", decisions: "Жұмыс тобын құру туралы шешім қабылданды",
      speakers: "Шақырылған сарапшылар", materialReferences: "https://example.test/materials", notes: "",
    }),
  });
  assert.equal(result.status, 303);
  const resultDraft = await appRequest(`/api/events/${nationalId}/news`, {
    method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ relationType: "EVENT_RESULT" }),
  });
  assert.equal(resultDraft.status, 303);
  const complete = await appRequest(`/api/events/${nationalId}`, {
    method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ action: "complete" }),
  });
  assert.equal(complete.status, 303);

  const cancelBranch = await appRequest(`/api/events/${branchId}`, {
    method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ action: "cancel", statusNote: "Ұйымдастыру жағдайына байланысты өткізілмейді" }),
  });
  assert.equal(cancelBranch.status, 303);

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const events = await client.query("SELECT id, status, published_at FROM events WHERE id = ANY($1::text[]) ORDER BY id", [[nationalId, branchId]]);
    assert.equal(events.rowCount, 2);
    assert.ok(events.rows.every((row) => row.published_at));
    assert.deepEqual(new Set(events.rows.map((row) => row.status)), new Set(["COMPLETED", "CANCELLED"]));
    const links = await client.query(`
      SELECT enl.relation_type, n.status
      FROM event_news_links enl JOIN news n ON n.id = enl.news_id
      WHERE enl.event_id = $1 ORDER BY enl.relation_type
    `, [nationalId]);
    assert.deepEqual(links.rows, [
      { relation_type: "EVENT_ANNOUNCEMENT", status: "DRAFT" },
      { relation_type: "EVENT_RESULT", status: "DRAFT" },
    ]);
    const linkedAnnouncement = await client.query("SELECT news_id FROM event_news_links WHERE event_id = $1 AND relation_type = 'EVENT_ANNOUNCEMENT'", [nationalId]);
    await client.query("UPDATE news SET status = 'ARCHIVED', archived_at = NOW() - INTERVAL '61 days' WHERE id = $1", [linkedAnnouncement.rows[0].news_id]);
    const retentionRunner = spawnSync(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./retention-runner.ts", import.meta.url))], {
      cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8",
      env: { ...process.env, DATABASE_URL, RETENTION_TEST_NOW: new Date().toISOString() },
    });
    assert.equal(retentionRunner.status, 0, retentionRunner.stderr || retentionRunner.stdout);
    assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM news WHERE id = $1", [linkedAnnouncement.rows[0].news_id])).rows[0].count, 1);
    const audits = await client.query("SELECT action_type FROM audit_logs WHERE target_entity_id = $1", [nationalId]);
    const actions = new Set(audits.rows.map((row) => row.action_type));
    for (const action of ["event.created", "event.updated", "event.published", "event.result_created", "event.announcement_draft_created", "event.result_news_draft_created", "event.completed"]) {
      assert.ok(actions.has(action), `missing Event audit ${action}`);
    }
    const coordinatorPermissions = await client.query(`
      SELECT p.slug FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
      WHERE r.slug = 'branch_event_manager' ORDER BY p.slug
    `);
    assert.deepEqual(coordinatorPermissions.rows.map((row) => row.slug), [
      "events.attendance.manage", "events.manage_branch", "events.news.generate", "events.participants.manage",
      "events.participants.read", "events.results.manage", "events.seating.manage",
    ]);
  } finally {
    await client.end();
  }

  const completedPage = await appRequest(`/events/phase-2-2-national-${token}`);
  assert.equal(completedPage.status, 200);
  assert.match(await completedPage.text(), /Қатысушылар саны.*120/s);
  const cancelledPage = await appRequest(`/events/phase-2-2-branch-${token}`);
  assert.equal(cancelledPage.status, 200);
  assert.match(await cancelledPage.text(), /Болдырылмады/);
});

test("Phase 2.3 separates member registration, attendance, seating, reception, privacy, and immutable profile activity", async () => {
  const [presidentCookie, memberCookie, applicantCookie, branchCookie] = await Promise.all([
    login("president@example.test"), login("member@example.test"), login("applicant@example.test"), login("branch@example.test"),
  ]);
  const token = randomUUID().slice(0, 8);
  const title = `Phase 2.3 қатысу сынағы ${token}`;
  const slug = `phase-2-3-participation-${token}`;
  const eventBody = new URLSearchParams({
    title, slug, summary: "Тіркелу мен нақты қатысудың бөлек сақталуын тексеру.",
    description: "## Іс-шара\nМүшелерге арналған ішкі тіркелу сынағы.",
    startAt: "2027-10-15T10:00", endAt: "2027-10-15T18:00", eventScope: "NATIONAL", branchId: "",
    regionName: "Астана", eventFormat: "OFFLINE", venue: "Математика орталығы", onlineUrl: "",
    audience: "Бірлестік мүшелері", organizer: "Республикалық математиктер бірлестігі",
    responsibleProfileId: "", responsibleDepartmentId: "", registrationMode: "INTERNAL_MEMBERS",
    externalRegistrationUrl: "", participantLimit: "1", seatingType: "NONE", action: "save",
  });
  const created = await appRequest("/api/events", {
    method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" }, body: eventBody,
  });
  assert.equal(created.status, 303);
  const eventId = (created.headers.get("location") ?? "").match(/\/dashboard\/events\/([^?]+)/)?.[1];
  assert.ok(eventId);
  assert.equal((await appRequest(`/api/events/${eventId}`, {
    method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ action: "publish" }),
  })).status, 303);

  const selfRegister = (cookie) => appRequest(`/api/events/${eventId}/registration`, {
    method: "POST", headers: { origin: "http://localhost", cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ action: "register" }),
  });
  const applicantAttempt = await selfRegister(applicantCookie);
  assert.equal(applicantAttempt.status, 303);
  assert.match(applicantAttempt.headers.get("location") ?? "", /error=members-only/);
  assert.equal((await selfRegister(memberCookie)).status, 303);
  assert.equal((await selfRegister(memberCookie)).status, 303, "duplicate self-registration must be idempotent");

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM event_registrations WHERE event_id = $1 AND registration_status = 'REGISTERED'", [eventId])).rows[0].count, 1);
    const publicPage = await appRequest(`/events/${slug}`);
    const publicHtml = visibleMarkup(await publicPage.text());
    assert.match(publicHtml, /1 \/ 1 орын/);
    assert.doesNotMatch(publicHtml, /Мүше рөлі \(сынақ\)/, "public event page must not reveal participant names");
    assert.equal((await appRequest(`/dashboard/events/${eventId}/participants`, { headers: authHeaders(memberCookie) })).status, 404);
    assert.equal((await appRequest(`/dashboard/events/${eventId}/participants`, { headers: authHeaders(branchCookie) })).status, 404, "branch director cannot read a national event list");
    assert.equal((await appRequest(`/dashboard/events/${eventId}/participants`, { headers: authHeaders(presidentCookie) })).status, 200);
    assert.equal((await appRequest(`/dashboard/events/${eventId}/reception`, { headers: authHeaders(presidentCookie) })).status, 200);

    const cancelled = await appRequest(`/api/events/${eventId}/registration`, {
      method: "POST", headers: { origin: "http://localhost", cookie: memberCookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ action: "cancel" }),
    });
    assert.match(cancelled.headers.get("location") ?? "", /success=cancelled/);
    const seating = await appRequest(`/api/events/${eventId}/seating`, {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ seatingType: "TABLES", layout: "1:2\n2:2" }),
    });
    assert.match(seating.headers.get("location") ?? "", /success=seating-saved/);
    const guestName = `Шақырылған қонақ ${token}`;
    const addGuest = await appRequest(`/api/events/${eventId}/participants`, {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, accept: "application/json" },
      body: new URLSearchParams({ action: "add_guest", fullName: guestName, organization: "Сынақ ұйымы", regionName: "Астана" }),
    });
    assert.equal(addGuest.status, 200, await addGuest.clone().text());
    const fullRestore = await appRequest(`/api/events/${eventId}/participants`, {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, accept: "application/json" },
      body: new URLSearchParams({ action: "restore", registrationId: (await client.query("SELECT id FROM event_registrations WHERE event_id = $1 AND person_id = 'person-member'", [eventId])).rows[0].id }),
    });
    assert.equal(fullRestore.status, 409);
    assert.equal((await fullRestore.json()).code, "full");

    const guest = (await client.query("SELECT id FROM event_registrations WHERE event_id = $1 AND participant_type = 'INVITED_GUEST'", [eventId])).rows[0];
    const unit = (await client.query("SELECT id FROM event_seating_units WHERE event_id = $1 AND label = '1'", [eventId])).rows[0];
    const assignGuestSeat = await appRequest(`/api/events/${eventId}/participants`, {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, accept: "application/json" },
      body: new URLSearchParams({ action: "assign_seat", registrationId: guest.id, seatKey: `${unit.id}:1` }),
    });
    assert.equal(assignGuestSeat.status, 200);
    const guestPresent = await appRequest(`/api/events/${eventId}/participants`, {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, accept: "application/json" },
      body: new URLSearchParams({ action: "attendance", registrationId: guest.id, status: "PRESENT" }),
    });
    assert.equal(guestPresent.status, 200);
    assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM person_activities WHERE event_id = $1", [eventId])).rows[0].count, 0, "invited guests do not create member profile history");
    await appRequest(`/api/events/${eventId}/participants`, {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, accept: "application/json" },
      body: new URLSearchParams({ action: "cancel", registrationId: guest.id, reason: "Сынақ үшін орын босатылды" }),
    });
    assert.equal((await selfRegister(memberCookie)).status, 303);
    const memberRegistration = (await client.query("SELECT id FROM event_registrations WHERE event_id = $1 AND person_id = 'person-member'", [eventId])).rows[0];
    const memberPresent = await appRequest(`/api/events/${eventId}/participants`, {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, accept: "application/json" },
      body: new URLSearchParams({ action: "attendance", registrationId: memberRegistration.id, status: "PRESENT" }),
    });
    assert.equal(memberPresent.status, 200);
    assert.equal((await client.query("SELECT status FROM person_activities WHERE registration_id = $1", [memberRegistration.id])).rows[0].status, "ACTIVE");
    const ownProfile = await appRequest("/dashboard/profile", { headers: authHeaders(memberCookie) });
    assert.match(await ownProfile.text(), new RegExp(title));
    const staffProfile = await appRequest("/dashboard/members/person-member", { headers: authHeaders(presidentCookie) });
    assert.match(await staffProfile.text(), new RegExp(title));

    const absent = await appRequest(`/api/events/${eventId}/participants`, {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, accept: "application/json" },
      body: new URLSearchParams({ action: "attendance", registrationId: memberRegistration.id, status: "ABSENT" }),
    });
    assert.equal(absent.status, 200);
    assert.equal((await client.query("SELECT status FROM person_activities WHERE registration_id = $1", [memberRegistration.id])).rows[0].status, "REVOKED");
    await appRequest(`/api/events/${eventId}/participants`, {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, accept: "application/json" },
      body: new URLSearchParams({ action: "attendance", registrationId: memberRegistration.id, status: "PRESENT" }),
    });
    assert.equal((await client.query("SELECT status FROM person_activities WHERE registration_id = $1", [memberRegistration.id])).rows[0].status, "ACTIVE");

    const live = await appRequest(`/api/events/public/${slug}/status`);
    assert.equal(live.status, 200);
    const liveText = await live.text();
    assert.match(liveText, /"registered":1/);
    assert.match(liveText, /"present":1/);
    assert.doesNotMatch(liveText, new RegExp(guestName));
    assert.doesNotMatch(liveText, /member@example\.test/);

    await client.query("UPDATE events SET start_at = '2000-01-01T00:00:00.000Z' WHERE id = $1", [eventId]);
    const lateCancel = await appRequest(`/api/events/${eventId}/registration`, {
      method: "POST", headers: { origin: "http://localhost", cookie: memberCookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ action: "cancel" }),
    });
    assert.match(lateCancel.headers.get("location") ?? "", /error=event-started/);
    await client.query("UPDATE events SET start_at = '2027-10-15T05:00:00.000Z' WHERE id = $1", [eventId]);

    await assert.rejects(client.query("DELETE FROM event_registrations WHERE id = $1", [memberRegistration.id]), /cannot be physically deleted/i);
    const auditActions = new Set((await client.query(`
      SELECT action_type FROM audit_logs
      WHERE target_entity_id = $1
        OR target_entity_id IN (SELECT id FROM event_registrations WHERE event_id = $1)
        OR target_entity_id IN (
          SELECT ea.id FROM event_attendance ea JOIN event_registrations er ON er.id = ea.registration_id WHERE er.event_id = $1
        )
    `, [eventId])).rows.map((row) => row.action_type));
    for (const action of ["event.registration.created", "event.registration.cancelled", "event.participant.guest_added", "event.seat.assigned", "event.attendance.present"]) assert.ok(auditActions.has(action), `missing Phase 2.3 audit ${action}`);
  } finally {
    await client.end();
  }
});

test("internal projects enforce scope, preserve workflow history, protect documents, and feed one profile activity stream", async () => {
  const [presidentCookie, branchCookie, departmentCookie, memberCookie] = await Promise.all([
    login("president@example.test"), login("branch@example.test"), login("department@example.test"), login("member@example.test"),
  ]);
  const token = randomUUID().slice(0, 8);
  const projectBody = ({ title, scope, branchId = "", departmentId = "", leaderId = "" }) => new URLSearchParams({
    title, code: `PRJ-${randomUUID().slice(0, 8).toUpperCase()}`, projectScope: scope, branchId,
    responsibleDepartmentId: departmentId, leaderProfileId: leaderId, publicProjectId: "",
    startDate: "2027-01-10", endDate: "2027-12-20", summary: "Жоба құқықтарын, жұмыс кезеңдерін және ортақ қызмет тарихын тексеру.",
    description: "Ішкі басқарылатын жоба.",
  });

  const nationalTitle = `Республикалық жоба ${token}`;
  const national = await appRequest("/api/projects", {
    method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
    body: projectBody({ title: nationalTitle, scope: "NATIONAL" }),
  });
  assert.equal(national.status, 303);
  const nationalId = (national.headers.get("location") ?? "").match(/\/dashboard\/projects\/([^?]+)/)?.[1];
  assert.ok(nationalId);
  assert.equal((await appRequest(`/dashboard/projects/${nationalId}`, { headers: authHeaders(branchCookie) })).status, 404);

  const allBranchesTitle = `Барлық филиал жобасы ${token}`;
  const allBranches = await appRequest("/api/projects", {
    method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
    body: projectBody({ title: allBranchesTitle, scope: "BRANCH", branchId: "__all__" }),
  });
  assert.equal(allBranches.status, 303);
  const allBranchesId = (allBranches.headers.get("location") ?? "").match(/\/dashboard\/projects\/([^?]+)/)?.[1];
  assert.ok(allBranchesId);
  assert.equal((await appRequest(`/dashboard/projects/${allBranchesId}`, { headers: authHeaders(branchCookie) })).status, 200);
  const branchProjectList = await (await appRequest("/dashboard/projects?scope=BRANCH&branchId=branch-almaty", { headers: authHeaders(branchCookie) })).text();
  assert.ok(branchProjectList.includes(allBranchesTitle));
  const forbiddenAllBranches = await appRequest("/api/projects", {
    method: "POST", headers: { origin: "http://localhost", cookie: branchCookie, "content-type": "application/x-www-form-urlencoded" },
    body: projectBody({ title: `Рұқсатсыз жалпы жоба ${token}`, scope: "BRANCH", branchId: "__all__" }),
  });
  assert.equal(forbiddenAllBranches.status, 403);

  const forbidden = await appRequest("/api/projects", {
    method: "POST", headers: { origin: "http://localhost", cookie: branchCookie, "content-type": "application/x-www-form-urlencoded" },
    body: projectBody({ title: `Бөтен филиал жобасы ${token}`, scope: "BRANCH", branchId: "branch-east" }),
  });
  assert.equal(forbidden.status, 403);

  const branchTitle = `Алматы филиалының жобасы ${token}`;
  const branchProject = await appRequest("/api/projects", {
    method: "POST", headers: { origin: "http://localhost", cookie: branchCookie, "content-type": "application/x-www-form-urlencoded" },
    body: projectBody({ title: branchTitle, scope: "BRANCH", branchId: "branch-almaty", leaderId: "person-member" }),
  });
  assert.equal(branchProject.status, 303);
  const projectId = (branchProject.headers.get("location") ?? "").match(/\/dashboard\/projects\/([^?]+)/)?.[1];
  assert.ok(projectId);
  assert.equal((await appRequest("/dashboard/projects", { headers: authHeaders(memberCookie) })).status, 200);
  assert.equal((await appRequest(`/dashboard/projects/${projectId}`, { headers: authHeaders(memberCookie) })).status, 200);

  const stageBatch = new URLSearchParams({ action: "batch-add" });
  for (const stage of [
    { title: "Бірінші кезең", startDate: "2027-01-10", endDate: "2027-03-01", description: "Жоспарлау" },
    { title: "Екінші кезең", startDate: "2027-03-02", endDate: "2027-06-01", description: "Орындау" },
  ]) for (const [key, value] of Object.entries(stage)) stageBatch.append(key, value);
  const addStage = await appRequest(`/api/projects/${projectId}/stages`, {
    method: "POST", headers: { origin: "http://localhost", cookie: memberCookie, "content-type": "application/x-www-form-urlencoded" },
    body: stageBatch,
  });
  assert.equal(addStage.status, 303);
  assert.match(addStage.headers.get("location") ?? "", /success=stages-added/);

  const addParticipant = () => appRequest(`/api/projects/${projectId}/participants`, {
    method: "POST", headers: { origin: "http://localhost", cookie: memberCookie, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ action: "add", personId: "person-branch-director", participantRole: "EXPERT" }),
  });
  assert.equal((await addParticipant()).status, 303);
  const duplicate = await addParticipant();
  assert.equal(duplicate.status, 303);
  assert.match(duplicate.headers.get("location") ?? "", /error=duplicate/);

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    assert.deepEqual((await client.query("SELECT project_scope, branch_id FROM projects WHERE id = $1", [allBranchesId])).rows[0], { project_scope: "ALL_BRANCHES", branch_id: null });
    assert.equal(Number((await client.query("SELECT COUNT(*) FROM project_stages WHERE project_id = $1", [projectId])).rows[0].count), 2);
    const stageId = (await client.query("SELECT id FROM project_stages WHERE project_id = $1", [projectId])).rows[0].id;
    assert.equal((await appRequest(`/api/projects/${projectId}/stages`, {
      method: "POST", headers: { origin: "http://localhost", cookie: memberCookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "status", stageId, status: "COMPLETED" }),
    })).status, 303);

    const participantId = (await client.query("SELECT id FROM project_participants WHERE project_id = $1 AND person_id = 'person-branch-director'", [projectId])).rows[0].id;
    const completeParticipant = await appRequest(`/api/projects/${projectId}/participants`, {
      method: "POST", headers: { origin: "http://localhost", cookie: memberCookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "update", participantId, participantRole: "EXPERT", status: "COMPLETED", notes: "Сараптамалық жұмыс аяқталды" }),
    });
    assert.equal(completeParticipant.status, 303);
    assert.match(completeParticipant.headers.get("location") ?? "", /success=participant-updated/);
    const expertActivity = await client.query("SELECT activity_type, status FROM person_activities WHERE project_participant_id = $1", [participantId]);
    assert.deepEqual(expertActivity.rows[0], { activity_type: "PROJECT_PARTICIPATION", status: "ACTIVE" });

    const saveResult = await appRequest(`/api/projects/${projectId}/result`, {
      method: "POST", headers: { origin: "http://localhost", cookie: memberCookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ summary: "Жобаның негізгі жұмысы орындалды.", outcomes: "Әдістемелік нәтиже", deliverables: "Нұсқаулық", beneficiaryCount: "75", completedAt: "2027-12-20" }),
    });
    assert.equal(saveResult.status, 303);

    const uploadBody = new FormData();
    uploadBody.append("category", "REPORT");
    uploadBody.append("document", new File(["%PDF-1.7\nproject-report"], `project-${token}.pdf`, { type: "application/pdf" }));
    const upload = await appRequest(`/api/projects/${projectId}/documents`, {
      method: "POST", headers: { origin: "http://localhost", cookie: memberCookie }, body: uploadBody,
    });
    assert.equal(upload.status, 303);
    const document = (await client.query("SELECT id, object_key FROM project_documents WHERE project_id = $1 AND status = 'active'", [projectId])).rows[0];
    const download = await appRequest(`/api/projects/${projectId}/documents/${document.id}`, { headers: authHeaders(memberCookie) });
    assert.equal(download.status, 200);
    assert.equal(download.headers.get("cache-control"), "private, no-store");
    assert.match(download.headers.get("content-disposition") ?? "", /attachment/);
    assert.equal((await appRequest(`/api/projects/${projectId}/documents/${document.id}`, {
      method: "POST", headers: { origin: "http://localhost", cookie: memberCookie },
    })).status, 303);
    assert.equal((await client.query("SELECT status FROM project_documents WHERE id = $1", [document.id])).rows[0].status, "archived");
    assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM private_objects WHERE object_key = $1", [document.object_key])).rows[0].count, 1, "archived project documents stay physically preserved");

    for (const status of ["PLANNED", "ACTIVE", "COMPLETED"]) {
      assert.equal((await appRequest(`/api/projects/${projectId}`, {
        method: "POST", headers: { origin: "http://localhost", cookie: branchCookie, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ action: "status", status, reason: `Жоба ${status}` }),
      })).status, 303);
    }
    const leaderActivity = await client.query("SELECT activity_type, status FROM person_activities WHERE project_id = $1 AND person_id = 'person-member'", [projectId]);
    assert.deepEqual(leaderActivity.rows[0], { activity_type: "PROJECT_PARTICIPATION", status: "ACTIVE" });
    const ownProfile = await appRequest("/dashboard/profile", { headers: authHeaders(memberCookie) });
    assert.match(await ownProfile.text(), new RegExp(branchTitle));
    const staffProfile = await appRequest("/dashboard/members/person-branch-director", { headers: authHeaders(presidentCookie) });
    assert.match(await staffProfile.text(), new RegExp(branchTitle));

    await assert.rejects(client.query("DELETE FROM project_participants WHERE id = $1", [participantId]), /cannot be physically deleted/i);
    await assert.rejects(client.query("DELETE FROM projects WHERE id = $1", [projectId]), /cannot be physically deleted/i);
    const actions = new Set((await client.query(`
      SELECT action_type FROM audit_logs WHERE target_entity_id = $1
        OR target_entity_id IN (SELECT id FROM project_stages WHERE project_id = $1)
        OR target_entity_id IN (SELECT id FROM project_participants WHERE project_id = $1)
        OR target_entity_id IN (SELECT id FROM project_documents WHERE project_id = $1)
    `, [projectId])).rows.map((row) => row.action_type));
    for (const action of ["project.created", "project.stage.created", "project.stage.status.completed", "project.participant.added", "project.participant.completed", "project.result.saved", "project.document.uploaded", "project.document.archived", "project.status.completed"]) {
      assert.ok(actions.has(action), `missing project audit ${action}`);
    }
    const managerPermissions = (await client.query(`
      SELECT p.slug FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
      WHERE r.slug = 'branch_project_manager' ORDER BY p.slug
    `)).rows.map((row) => row.slug);
    assert.deepEqual(managerPermissions, ["projects.documents.manage", "projects.manage_branch", "projects.participants.manage", "projects.read", "projects.results.manage", "projects.stages.manage"]);
  } finally {
    await client.end();
  }

  const departmentTitle = `Департамент жобасы ${token}`;
  const departmentProject = await appRequest("/api/projects", {
    method: "POST", headers: { origin: "http://localhost", cookie: departmentCookie, "content-type": "application/x-www-form-urlencoded" },
    body: projectBody({ title: departmentTitle, scope: "NATIONAL", departmentId: "dept-content", leaderId: "person-dept-head" }),
  });
  assert.equal(departmentProject.status, 303);
  const departmentId = (departmentProject.headers.get("location") ?? "").match(/\/dashboard\/projects\/([^?]+)/)?.[1];
  assert.ok(departmentId);
  assert.equal((await appRequest(`/dashboard/projects/${departmentId}`, { headers: authHeaders(departmentCookie) })).status, 200);
  assert.equal((await appRequest(`/dashboard/projects/${departmentId}`, { headers: authHeaders(branchCookie) })).status, 404);
});

async function appRequest(path, init = {}) {
  const baseUrl = await testAppUrl();
  const headers = new Headers(init.headers);
  if (headers.has("origin")) headers.set("origin", baseUrl.origin);
  return fetch(new URL(path, baseUrl), { ...init, headers, redirect: "manual" });
}

function visibleMarkup(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

async function login(email, password = "PhaseOneDemo2026!") {
  const response = await appRequest("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: "http://localhost", "cf-connecting-ip": `login-${randomUUID()}` },
    body: new URLSearchParams({ email, password }),
  });
  assert.equal(response.status, 303, `login failed for ${email}`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.match(cookie ?? "", /^phase1_session=/);
  return cookie;
}

const authHeaders = (cookie) => ({ cookie });

async function registerAccount(email, password, ip = `register-${randomUUID()}`) {
  const response = await appRequest("/api/auth/register", {
    method: "POST",
    headers: { origin: "http://localhost", "cf-connecting-ip": ip, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email, password, passwordConfirmation: password }),
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  return { response, cookie };
}

async function markEmailVerified(email) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try { await client.query("UPDATE users SET email_verified_at = NOW() WHERE email = $1", [email]); }
  finally { await client.end(); }
}

async function postApplication(regionCode, options = {}) {
  const email = options.email ?? `boundary-${regionCode}-${randomUUID()}@example.test`;
  const password = options.password ?? "BoundaryFlow2026!";
  const fields = {
    surname: options.surname ?? options.fullName?.split(" ")[0] ?? "Шекара",
    givenName: options.givenName ?? options.fullName?.split(" ")[1] ?? "Сынағы",
    patronymic: options.patronymic ?? "",
    birthDate: options.birthDate ?? "1991-05-14",
    regionCode,
    cityDistrict: "Сынақ қаласы",
    phone: "+7 700 000 00 00",
    workplace: "Сынақ дерегі",
    position: "Математика мұғалімі",
    educationLevelCode: "higher",
    educationInstitution: "Сынақ оқу орны",
    educationProgram: "Математика",
    mathSpecialization: "Алгебра",
    achievements: "",
    joiningPurpose: "Математика қауымдастығымен кәсіби байланыс орнату",
    source: "web",
    termsAccepted: true,
    privacyAccepted: true,
  };
  const ip = options.ip ?? `application-${randomUUID()}`;
  const registration = await registerAccount(email, password, ip);
  if (!registration.response.ok) return { response: registration.response, email, password, fields };
  const cookie = registration.cookie;
  assert.match(cookie ?? "", /^phase1_session=/);
  await markEmailVerified(email);
  const draftResponse = await appRequest("/api/application-drafts", {
    method: "POST",
    headers: { origin: "http://localhost", "cf-connecting-ip": ip, cookie, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(fields),
  });
  if (!draftResponse.ok) return { response: draftResponse, email, password, fields };
  if (options.withDocument !== false) {
    const documents = new FormData();
    documents.append("documents", new File(["%PDF-1.7\nphase-one-boundary-test"], "boundary.pdf", { type: "application/pdf" }));
    const uploadResponse = await appRequest("/api/application-drafts/documents", {
      method: "POST",
      headers: { origin: "http://localhost", cookie, accept: "application/json" },
      body: documents,
    });
    assert.equal(uploadResponse.status, 200, await uploadResponse.text());
  }
  const response = await appRequest("/api/applications", {
    method: "POST",
    headers: { origin: "http://localhost", "cf-connecting-ip": ip, cookie, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(fields),
  });
  return { response, email, password, cookie, fields };
}

async function submitApplication(regionCode, options = {}) {
  const { response, email, password } = await postApplication(regionCode, options);
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json();
  assert.match(result.url ?? "", /\/membership\/success\?id=/);
  return { id: result.applicationId, email, password };
}

test("production worker boots and the database-backed public site renders the corrected Phase 1 identity", async () => {
  const workerResponse = await builtWorkerRequest("/login");
  assert.equal(workerResponse.status, 200, await workerResponse.text());
  const response = await appRequest("/");
  const html = await response.text();
  assert.equal(response.status, 200, html);
  assert.match(html, /Республикалық математиктер бірлестігі/i);
  assert.match(html, /Математика — ортақ тіл\..*Бірлестік — ортақ күш\./s);
  assert.doesNotMatch(html, /Қазақстан математиктерінің республикалық қауымдастығы|ҚМРҚ/iu);
  assert.doesNotMatch(html, /olympiad registration|scoring protocol|diploma/i);

  const membershipEmail = `membership-page-${randomUUID()}@example.test`;
  const membershipRegistration = await registerAccount(membershipEmail, "MembershipPage2026!");
  assert.equal(membershipRegistration.response.status, 201);
  await markEmailVerified(membershipEmail);
  const membershipResponse = await appRequest("/membership", { headers: { cookie: membershipRegistration.cookie } });
  assert.equal(membershipResponse.status, 200);
  const membershipHtml = await membershipResponse.text();
  const regionSelect = membershipHtml.match(/<select name="regionCode"[\s\S]*?<\/select>/)?.[0] ?? "";
  const renderedRegions = [...regionSelect.matchAll(/<option value="[^"]+"[^>]*>([^<]+)<\/option>/g)].map((match) => match[1]);
  assert.deepEqual(new Set(renderedRegions), new Set(membershipRegions));
  assert.equal(renderedRegions.length, membershipRegions.length);
});

test("registration, email correction, verification, recovery, join routing, and zero-document application preserve one identity", async () => {
  const firstEmail = `mistyped-${randomUUID()}@example.test`;
  const correctedEmail = `corrected-${randomUUID()}@example.test`;
  const oldPassword = "AccountFlowOld2026!";
  const newPassword = "AccountFlowNew2026!";
  const ip = `account-flow-${randomUUID()}`;
  const registrationPage = await appRequest("/register");
  const registrationHtml = await registrationPage.text();
  assert.equal(registrationPage.status, 200);
  assert.match(registrationHtml, /Электрондық пошта/);
  assert.match(registrationHtml, /Құпиясөзді қайталау/);
  assert.match(registrationHtml, /minlength="7"/i);
  const anonymousJoin = await appRequest("/membership");
  assert.ok([303, 307, 308].includes(anonymousJoin.status));
  assert.match(anonymousJoin.headers.get("location") ?? "", /\/register/);

  const registered = await registerAccount(firstEmail, oldPassword, ip);
  assert.equal(registered.response.status, 201, await registered.response.clone().text());
  assert.match(registered.cookie ?? "", /^phase1_session=/);
  const registrationResult = await registered.response.json();
  assert.equal(registrationResult.delivery, "unconfigured");

  const unverifiedJoin = await appRequest("/membership", { headers: { cookie: registered.cookie } });
  assert.ok([303, 307, 308].includes(unverifiedJoin.status));
  assert.match(unverifiedJoin.headers.get("location") ?? "", /\/verify-email/);
  const blockedDraft = await appRequest("/api/application-drafts", {
    method: "POST",
    headers: { origin: "http://localhost", cookie: registered.cookie, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(blockedDraft.status, 403);

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  let userId;
  let profileId;
  try {
    const identity = await client.query("SELECT u.id AS user_id, p.id AS profile_id FROM users u JOIN person_profiles p ON p.user_id = u.id WHERE u.email = $1", [firstEmail]);
    assert.equal(identity.rowCount, 1);
    ({ user_id: userId, profile_id: profileId } = identity.rows[0]);
    const oldRawToken = `old-email-token-${randomUUID()}`;
    const oldHash = createHash("sha256").update(oldRawToken).digest("hex");
    await client.query("INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour', NOW())", [randomUUID(), userId, oldHash]);

    const correction = await appRequest("/api/auth/verification/email", {
      method: "POST",
      headers: { origin: "http://localhost", cookie: registered.cookie, "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": ip },
      body: new URLSearchParams({ email: correctedEmail }),
    });
    assert.equal(correction.status, 303);
    assert.match(correction.headers.get("location") ?? "", /state=email-updated-unconfigured/);

    const corrected = await client.query(`
      SELECT u.id AS user_id, u.email, p.id AS profile_id, p.email AS profile_email,
        (SELECT COUNT(*)::int FROM email_verification_tokens WHERE user_id = u.id AND used_at IS NULL AND expires_at > NOW()) AS fresh_tokens
      FROM users u JOIN person_profiles p ON p.user_id = u.id WHERE u.id = $1
    `, [userId]);
    assert.deepEqual(corrected.rows[0], { user_id: userId, email: correctedEmail, profile_id: profileId, profile_email: correctedEmail, fresh_tokens: 1 });

    const oldVerification = await appRequest(`/api/auth/verify-email?token=${encodeURIComponent(oldRawToken)}`, { headers: { cookie: registered.cookie } });
    assert.equal(oldVerification.status, 303);
    assert.match(oldVerification.headers.get("location") ?? "", /state=invalid/);

    const verificationRaw = `new-email-token-${randomUUID()}`;
    const verificationHash = createHash("sha256").update(verificationRaw).digest("hex");
    await client.query("UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [userId]);
    await client.query("INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour', NOW())", [randomUUID(), userId, verificationHash]);
    const verification = await appRequest(`/api/auth/verify-email?token=${encodeURIComponent(verificationRaw)}`, { headers: { cookie: registered.cookie } });
    assert.equal(verification.status, 303);
    assert.match(verification.headers.get("location") ?? "", /state=verified/);
    const reusedVerification = await appRequest(`/api/auth/verify-email?token=${encodeURIComponent(verificationRaw)}`, { headers: { cookie: registered.cookie } });
    assert.equal(reusedVerification.status, 303);
    assert.match(reusedVerification.headers.get("location") ?? "", /state=invalid/);

    const verifiedJoin = await appRequest("/membership", { headers: { cookie: registered.cookie } });
    const verifiedHtml = await verifiedJoin.text();
    assert.equal(verifiedJoin.status, 200);
    assert.equal((verifiedHtml.match(/<fieldset/g) ?? []).length, 3);
    assert.match(verifiedHtml, /Бірлестікке қосылу мақсаты/);
    assert.doesNotMatch(verifiedHtml, /Кәсіби тәжірибесі|Қысқаша кәсіби өмірбаяны/);

    const fields = {
      surname: "Тексеру", givenName: "Пайдаланушы", patronymic: "", birthDate: "1994-06-15",
      regionCode: "astana", cityDistrict: "Астана", phone: "+7 701 234 56 78", workplace: "", position: "",
      educationLevelCode: "higher", educationInstitution: "", educationProgram: "Математика",
      mathSpecialization: "", achievements: "", joiningPurpose: "Математиктермен кәсіби тәжірибе алмасу үшін қосыламын",
      source: "web", termsAccepted: true, privacyAccepted: true,
    };
    const draft = await appRequest("/api/application-drafts", {
      method: "POST", headers: { origin: "http://localhost", cookie: registered.cookie, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(fields),
    });
    assert.equal(draft.status, 200, await draft.clone().text());
    const restoredPage = await appRequest("/membership", { headers: { cookie: registered.cookie } });
    assert.match(await restoredPage.text(), /Математиктермен кәсіби тәжірибе алмасу/);

    const invalidPurpose = await appRequest("/api/applications", {
      method: "POST", headers: { origin: "http://localhost", cookie: registered.cookie, "content-type": "application/json", accept: "application/json", "cf-connecting-ip": ip }, body: JSON.stringify({ ...fields, joiningPurpose: "" }),
    });
    assert.equal(invalidPurpose.status, 422);
    const invalidResult = await invalidPurpose.json();
    assert.equal(invalidResult.errors.joiningPurpose, "Бірлестікке қосылу мақсатын қысқаша жазыңыз.");

    const submitted = await appRequest("/api/applications", {
      method: "POST", headers: { origin: "http://localhost", cookie: registered.cookie, "content-type": "application/json", accept: "application/json", "cf-connecting-ip": ip }, body: JSON.stringify(fields),
    });
    assert.equal(submitted.status, 200, await submitted.clone().text());
    const submittedResult = await submitted.json();
    const duplicateClick = await appRequest("/api/applications", {
      method: "POST", headers: { origin: "http://localhost", cookie: registered.cookie, "content-type": "application/json", accept: "application/json", "cf-connecting-ip": ip }, body: JSON.stringify(fields),
    });
    assert.equal(duplicateClick.status, 200);
    assert.equal((await duplicateClick.json()).applicationId, submittedResult.applicationId);
    const application = await client.query("SELECT a.id, a.branch_id, a.joining_purpose, p.membership_status, (SELECT COUNT(*)::int FROM uploaded_documents WHERE application_id = a.id) AS document_count FROM membership_applications a JOIN person_profiles p ON p.id = a.person_id WHERE a.person_id = $1", [profileId]);
    assert.deepEqual(application.rows[0], { id: submittedResult.applicationId, branch_id: "branch-astana", joining_purpose: fields.joiningPurpose, membership_status: "applicant", document_count: 0 });
    const submittedJoin = await appRequest("/membership", { headers: { cookie: registered.cookie } });
    assert.match(await submittedJoin.text(), /мүшелік өтініші бұрын жіберілген/i);

    const profileDocumentForm = new FormData();
    profileDocumentForm.append("document", new File(["%PDF-1.7\nprofile-document"], "profile-extra.pdf", { type: "application/pdf" }));
    const profileUpload = await appRequest("/api/profile/documents", { method: "POST", headers: { origin: "http://localhost", cookie: registered.cookie, accept: "application/json" }, body: profileDocumentForm });
    assert.equal(profileUpload.status, 200, await profileUpload.clone().text());
    const profileDocument = (await profileUpload.json()).documents.find((document) => document.originalName === "profile-extra.pdf");
    assert.ok(profileDocument?.id);
    assert.equal((await appRequest(`/api/documents/${profileDocument.id}`, { headers: { cookie: registered.cookie } })).status, 200);
    const unrelatedMemberCookie = await login("member@example.test");
    assert.equal((await appRequest(`/api/documents/${profileDocument.id}`, { headers: { cookie: unrelatedMemberCookie } })).status, 403);
    const profileDocumentRow = await client.query("SELECT owner_person_id, application_id, draft_id, visibility FROM uploaded_documents WHERE id = $1", [profileDocument.id]);
    assert.deepEqual(profileDocumentRow.rows[0], { owner_person_id: profileId, application_id: null, draft_id: null, visibility: "owner" });

    const neutralExisting = await appRequest("/api/auth/forgot-password", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": `${ip}-reset-a` }, body: new URLSearchParams({ email: correctedEmail }) });
    const neutralMissing = await appRequest("/api/auth/forgot-password", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": `${ip}-reset-b` }, body: new URLSearchParams({ email: `missing-${randomUUID()}@example.test` }) });
    assert.equal(neutralExisting.headers.get("location"), neutralMissing.headers.get("location"));

    const resetRaw = `password-reset-token-${randomUUID()}`;
    const resetHash = createHash("sha256").update(resetRaw).digest("hex");
    await client.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [userId]);
    await client.query("INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour', NOW())", [randomUUID(), userId, resetHash]);
    const reset = await appRequest("/api/auth/reset-password", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ token: resetRaw, password: newPassword, passwordConfirmation: newPassword }) });
    assert.equal(reset.status, 200, await reset.clone().text());
    const resetReuse = await appRequest("/api/auth/reset-password", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ token: resetRaw, password: newPassword, passwordConfirmation: newPassword }) });
    assert.equal(resetReuse.status, 422);
    const oldLogin = await appRequest("/api/auth/login", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": `${ip}-old-login` }, body: new URLSearchParams({ email: correctedEmail, password: oldPassword }) });
    assert.equal(oldLogin.headers.get("set-cookie"), null);
    assert.match(oldLogin.headers.get("location") ?? "", /error=credentials/);
    assert.match(await login(correctedEmail, newPassword), /^phase1_session=/);
    const afterReset = await client.query("SELECT u.id AS user_id, p.id AS profile_id FROM users u JOIN person_profiles p ON p.user_id = u.id WHERE u.email = $1", [correctedEmail]);
    assert.deepEqual(afterReset.rows[0], { user_id: userId, profile_id: profileId });
  } finally {
    await client.end();
  }
});

test("public account passwords require exactly seven or more characters", async () => {
  const shortEmail = `short-password-${randomUUID()}@example.test`;
  const short = await registerAccount(shortEmail, "123456", `password-six-${randomUUID()}`);
  assert.equal(short.response.status, 422);
  const shortResult = await short.response.json();
  assert.equal(shortResult.errors.password, "Құпиясөз кемінде 7 таңбадан тұруы керек.");

  const validEmail = `seven-password-${randomUUID()}@example.test`;
  const valid = await registerAccount(validEmail, "1234567", `password-seven-${randomUUID()}`);
  assert.equal(valid.response.status, 201, await valid.response.clone().text());
});

test("an empty registered profile can be promoted to applicant and erased without a submitted application", async () => {
  const email = `empty-applicant-${randomUUID()}@example.test`;
  const registered = await registerAccount(email, "1234567", `empty-applicant-${randomUUID()}`);
  assert.equal(registered.response.status, 201, await registered.response.clone().text());
  const presidentCookie = await login("president@example.test");
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const identity = await client.query("SELECT p.id FROM person_profiles p WHERE p.email = $1", [email]);
    assert.equal(identity.rowCount, 1);
    const personId = identity.rows[0].id;
    const promote = await appRequest(`/api/members/${personId}`, {
      method: "POST",
      headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ membershipStatus: "applicant", branchId: "branch-abai", reason: "Негізгі сынақ" }),
    });
    assert.equal(promote.status, 303);
    assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM membership_applications WHERE person_id = $1", [personId])).rows[0].count, 0);

    const erased = await appRequest(`/api/members/${personId}/erase`, {
      method: "POST",
      headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ confirmation: "ӨШІРУ", reason: "Толтырылмаған аккаунтты өшіру" }),
    });
    assert.equal(erased.status, 303);
    assert.match(erased.headers.get("location") ?? "", /success=erased/);
    const result = await client.query("SELECT full_name, membership_status, archived_at FROM person_profiles WHERE id = $1", [personId]);
    assert.equal(result.rows[0].full_name, "Өшірілген аккаунт");
    assert.equal(result.rows[0].membership_status, "erased");
    assert.ok(result.rows[0].archived_at);
  } finally {
    await client.end();
  }
});

test("legacy full names remain unparsed and missing surname or exact birth date does not block unrelated profile edits", async () => {
  const email = `legacy-${randomUUID()}@example.test`;
  const password = "LegacyProfile2026!";
  const registered = await registerAccount(email, password, `legacy-${randomUUID()}`);
  assert.equal(registered.response.status, 201, await registered.response.clone().text());
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const identity = await client.query("SELECT u.id AS user_id, p.id AS profile_id FROM users u JOIN person_profiles p ON p.user_id = u.id WHERE u.email = $1", [email]);
    const { user_id: userId, profile_id: profileId } = identity.rows[0];
    const expiredRaw = `expired-verification-${randomUUID()}`;
    await client.query("INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '2 hours')", [randomUUID(), userId, createHash("sha256").update(expiredRaw).digest("hex")]);
    const expired = await appRequest(`/api/auth/verify-email?token=${encodeURIComponent(expiredRaw)}`, { headers: { cookie: registered.cookie } });
    assert.match(expired.headers.get("location") ?? "", /state=invalid/);

    const legacyFullName = "Бөлінбейтін Тарихи Толық Аты";
    await client.query("UPDATE users SET email_verified_at = NOW() WHERE id = $1", [userId]);
    await client.query("UPDATE person_profiles SET full_name = $1, surname = NULL, given_name = NULL, patronymic = NULL, birth_year = 1979, birth_date = NULL, phone = '+77011234567', workplace = NULL, position = NULL WHERE id = $2", [legacyFullName, profileId]);
    const profilePage = await appRequest("/dashboard/profile", { headers: { cookie: registered.cookie } });
    const html = await profilePage.text();
    assert.equal(profilePage.status, 200);
    assert.match(html, /name="surname"[^>]*value=""/);
    assert.match(html, new RegExp(`name="givenName"[^>]*value="${legacyFullName}"`));
    assert.doesNotMatch(html, /name="surname"[^>]*value="Бөлінбейтін"/);
    assert.match(html, />1979</);

    const update = await appRequest("/api/profile", {
      method: "POST",
      headers: { origin: "http://localhost", cookie: registered.cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        surname: "", givenName: legacyFullName, patronymic: "", phone: "+7 701 123 45 67",
        workplace: "Тек осы өріс жаңартылды", position: "", educationLevelCode: "", educationInstitution: "",
        educationProgram: "", mathSpecialization: "", achievements: "",
      }),
    });
    assert.equal(update.status, 303);
    const preserved = await client.query("SELECT full_name, surname, given_name, patronymic, birth_year, birth_date, workplace FROM person_profiles WHERE id = $1", [profileId]);
    assert.deepEqual(preserved.rows[0], { full_name: legacyFullName, surname: null, given_name: legacyFullName, patronymic: null, birth_year: 1979, birth_date: null, workplace: "Тек осы өріс жаңартылды" });
  } finally {
    await client.end();
  }
});

test("all password fields use the accessible reusable show-hide control", async () => {
  const [component, registration, loginPage, resetForm] = await Promise.all([
    readFile(new URL("../app/components/PasswordInput.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/register/RegistrationForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/reset-password/ResetPasswordForm.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(component, /type=\{visible \? "text" : "password"\}/);
  assert.match(component, /type="button"/);
  assert.match(component, /aria-label=\{visible \? "Құпиясөзді жасыру" : "Құпиясөзді көрсету"\}/);
  assert.match(component, /aria-pressed=\{visible\}/);
  assert.equal((registration.match(/<PasswordInput/g) ?? []).length, 2);
  assert.equal((loginPage.match(/<PasswordInput/g) ?? []).length, 1);
  assert.equal((resetForm.match(/<PasswordInput/g) ?? []).length, 2);
  assert.match(registration, /autoComplete="new-password"/);
  assert.match(loginPage, /autoComplete="current-password"/);
});

test("PostgreSQL migration preserves the Phase 1 domain and enforces immutable audit history", async () => {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const names = new Set(tables.rows.map((row) => row.table_name));
    for (const name of [
      "branches", "users", "person_profiles", "roles", "permissions", "role_permissions",
      "user_roles", "branch_staff", "membership_applications", "membership_status_history",
      "uploaded_documents", "internal_notes", "audit_logs", "application_field_definitions",
      "application_field_values", "rate_limits", "private_objects", "departments",
      "person_department_assignments",
      "public_content",
      "professional_categories", "person_professional_category_assignments", "membership_application_drafts",
      "email_verification_tokens", "password_reset_tokens",
    ]) assert.ok(names.has(name), `missing PostgreSQL table ${name}`);
    assert.equal(names.has("possible_duplicate_profiles"), false, "deferred duplicate-person detection must not remain in the Phase 1 schema");
    const unsupportedFullAccessRole = await client.query("SELECT id FROM roles WHERE slug = 'super_admin'");
    assert.equal(unsupportedFullAccessRole.rowCount, 0, "only President and VP2 may hold full global administration");

    const auditId = `audit-test-${randomUUID()}`;
    await client.query("INSERT INTO audit_logs (id, action_type, target_entity, target_entity_id, created_at) VALUES ($1, $2, $3, $4, NOW())", [auditId, "test.action", "test", "target-1"]);
    await assert.rejects(client.query("UPDATE audit_logs SET action_type = 'changed' WHERE id = $1", [auditId]), /append-only/i);
    await assert.rejects(client.query("DELETE FROM audit_logs WHERE id = $1", [auditId]), /append-only/i);
    await assert.rejects(client.query("TRUNCATE audit_logs"), /append-only/i);

    const historyId = `history-test-${randomUUID()}`;
    await client.query("INSERT INTO membership_status_history (id, person_id, previous_status, new_status, reason, visibility, created_at) VALUES ($1, 'person-member', 'member', 'member', 'append-only test', 'internal', NOW())", [historyId]);
    await assert.rejects(client.query("UPDATE membership_status_history SET reason = 'changed' WHERE id = $1", [historyId]), /append-only/i);
    await assert.rejects(client.query("DELETE FROM membership_status_history WHERE id = $1", [historyId]), /append-only/i);
    await assert.rejects(client.query("TRUNCATE membership_status_history"), /append-only/i);
  } finally {
    await client.end();
  }
});

test("membership drafts preserve field data and documents while rate limits and duplicate submission stay safe", async () => {
  const email = `draft-${randomUUID()}@example.test`;
  const password = "DraftPersistence2026!";
  const ip = `draft-owner-${randomUUID()}`;
  const fields = {
    surname: "Draft",
    givenName: "Өтініш",
    patronymic: "Сынағы",
    birthDate: "1990-03-12",
    regionCode: "",
    cityDistrict: "Сақталған қала",
    phone: "+7 700 123 45 67",
    workplace: "Сақталған жұмыс орны",
    position: "Математика мұғалімі",
    educationLevelCode: "higher",
    educationInstitution: "Сақталған оқу орны",
    educationProgram: "Математика",
    mathSpecialization: "Алгебра және геометрия",
    achievements: "Draft арқылы сақталған жетістік",
    joiningPurpose: "Бірлестік жұмысына кәсіби үлес қосу үшін қосыламын",
    source: "web",
    termsAccepted: true,
    privacyAccepted: true,
  };
  const registration = await registerAccount(email, password, ip);
  assert.equal(registration.response.status, 201, await registration.response.clone().text());
  const cookie = registration.cookie;
  assert.match(cookie ?? "", /^phase1_session=/);
  await markEmailVerified(email);
  const create = await appRequest("/api/application-drafts", {
    method: "POST",
    headers: { origin: "http://localhost", "cf-connecting-ip": ip, cookie, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(fields),
  });
  assert.equal(create.status, 200, await create.clone().text());

  const uploadBody = new FormData();
  uploadBody.append("documents", new File(["%PDF-1.7\ndraft-persistence"], "draft-proof.pdf", { type: "application/pdf" }));
  const upload = await appRequest("/api/application-drafts/documents", {
    method: "POST",
    headers: { origin: "http://localhost", cookie, accept: "application/json" },
    body: uploadBody,
  });
  assert.equal(upload.status, 200, await upload.clone().text());
  const uploadedDocument = (await upload.json()).documents[0];

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const invalid = await appRequest("/api/applications", {
      method: "POST",
      headers: { origin: "http://localhost", "cf-connecting-ip": ip, cookie, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(fields),
    });
    assert.equal(invalid.status, 422);
    const result = await invalid.json();
    assert.equal(result.errors.regionCode, "Өңірді таңдаңыз.");
    assert.equal(result.errors.documents, undefined);
  }

  const restored = await appRequest("/api/application-drafts", { headers: { cookie, accept: "application/json" } });
  assert.equal(restored.status, 200);
  const restoredDraft = (await restored.json()).draft;
  assert.equal(restoredDraft.documents.length, 1);
  const restoredPage = await appRequest("/membership", { headers: { cookie } });
  const restoredHtml = await restoredPage.text();
  assert.match(restoredHtml, /Сақталған жұмыс орны/);
  assert.match(restoredHtml, /Draft арқылы сақталған жетістік/);

  const ownerDownload = await appRequest(`/api/documents/${uploadedDocument.id}`, { headers: { cookie } });
  assert.equal(ownerDownload.status, 200);
  const unrelatedCookie = await login("member@example.test");
  assert.equal((await appRequest(`/api/documents/${uploadedDocument.id}`, { headers: { cookie: unrelatedCookie } })).status, 403);

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const persisted = await client.query(`
      SELECT d.workplace, d.achievements, ud.draft_id, ud.application_id
      FROM membership_application_drafts d
      JOIN uploaded_documents ud ON ud.draft_id = d.id
      WHERE d.user_id = (SELECT id FROM users WHERE email = $1)
    `, [email]);
    assert.deepEqual(persisted.rows[0], {
      workplace: fields.workplace,
      achievements: fields.achievements,
      draft_id: restoredDraft.id,
      application_id: null,
    });
    const falseLimit = await client.query("SELECT count FROM rate_limits WHERE key LIKE $1", [`application:valid-submit:%${ip}%`]);
    assert.equal(falseLimit.rowCount, 0, "validation failures must not consume the valid-submit limit");
  } finally {
    await client.end();
  }

  const validFields = { ...fields, regionCode: "almaty" };
  const submitRequest = () => appRequest("/api/applications", {
    method: "POST",
    headers: { origin: "http://localhost", "cf-connecting-ip": ip, cookie, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(validFields),
  });
  const [firstSubmit, secondSubmit] = await Promise.all([submitRequest(), submitRequest()]);
  assert.equal(firstSubmit.status, 200, await firstSubmit.clone().text());
  assert.equal(secondSubmit.status, 200, await secondSubmit.clone().text());
  const firstResult = await firstSubmit.json();
  const secondResult = await secondSubmit.json();
  assert.equal(firstResult.applicationId, secondResult.applicationId);

  const verification = new pg.Client({ connectionString: DATABASE_URL });
  await verification.connect();
  try {
    const submitted = await verification.query(`
      SELECT a.id, a.branch_id, p.membership_status,
        (SELECT COUNT(*)::int FROM membership_applications WHERE person_id = p.id) AS application_count,
        (SELECT COUNT(*)::int FROM uploaded_documents WHERE application_id = a.id AND draft_id IS NULL) AS document_count
      FROM users u JOIN person_profiles p ON p.user_id = u.id
      JOIN membership_applications a ON a.person_id = p.id
      WHERE u.email = $1
    `, [email]);
    assert.deepEqual(submitted.rows[0], {
      id: firstResult.applicationId,
      branch_id: "branch-almaty",
      membership_status: "applicant",
      application_count: 1,
      document_count: 1,
    });
  } finally {
    await verification.end();
  }

  const abuseIp = `registration-abuse-${randomUUID()}`;
  let lastAbuseResponse;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    lastAbuseResponse = await appRequest("/api/auth/register", {
      method: "POST",
      headers: { origin: "http://localhost", "cf-connecting-ip": abuseIp, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ email: `abuse-${attempt}-${randomUUID()}@example.test`, password: "AbusiveRegistration2026!", passwordConfirmation: "AbusiveRegistration2026!" }),
    });
  }
  assert.equal(lastAbuseResponse.status, 429);
});

test("production bootstrap is explicit, one-time, duplicate-safe, and does not log passwords", async () => {
  const suffix = randomUUID();
  const email = `bootstrap-${suffix}@bootstrap.invalid`;
  const password = `Bootstrap-${suffix}-Secure!`;
  const environment = {
    ...process.env,
    DATABASE_URL,
    DIRECT_URL: DATABASE_URL,
    ENVIRONMENT: "production",
    BOOTSTRAP_ADMIN_ROLE: "president",
    BOOTSTRAP_ADMIN_EMAIL: email,
    BOOTSTRAP_ADMIN_PASSWORD: password,
    BOOTSTRAP_ADMIN_FULL_NAME: "Өндірістік bootstrap сынағы",
    BOOTSTRAP_ADMIN_REGION_CODE: "central",
    BOOTSTRAP_ADMIN_CITY_DISTRICT: "Орталық әкімшілік",
    BOOTSTRAP_ADMIN_PHONE: "+7 700 000 00 01",
  };
  const bootstrapCommand = [fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url)), fileURLToPath(new URL("../scripts/bootstrap-production-admin.ts", import.meta.url))];
  const first = spawnSync(process.execPath, bootstrapCommand, { cwd: fileURLToPath(new URL("..", import.meta.url)), env: environment, encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  assert.doesNotMatch(`${first.stdout}\n${first.stderr}`, new RegExp(password.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const second = spawnSync(process.execPath, bootstrapCommand, { cwd: fileURLToPath(new URL("..", import.meta.url)), env: environment, encoding: "utf8" });
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /BOOTSTRAP_EMAIL_ALREADY_EXISTS/);
  assert.doesNotMatch(`${second.stdout}\n${second.stderr}`, new RegExp(password.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const identity = await client.query(`
      SELECT u.id AS user_id, p.user_id AS profile_user_id, p.membership_status, r.slug, ur.scope_type, ur.scope_id,
        (SELECT COUNT(*)::int FROM users WHERE email = $1) AS user_count,
        (SELECT COUNT(*)::int FROM person_profiles WHERE email = $1) AS profile_count
      FROM users u
      JOIN person_profiles p ON p.user_id = u.id
      JOIN user_roles ur ON ur.user_id = u.id AND ur.revoked_at IS NULL
      JOIN roles r ON r.id = ur.role_id
      WHERE u.email = $1
    `, [email]);
    assert.equal(identity.rowCount, 1);
    assert.equal(identity.rows[0].user_id, identity.rows[0].profile_user_id);
    assert.deepEqual({ ...identity.rows[0], user_id: undefined, profile_user_id: undefined }, {
      user_id: undefined,
      profile_user_id: undefined,
      membership_status: "registered_user",
      slug: "president",
      scope_type: "global",
      scope_id: null,
      user_count: 1,
      profile_count: 1,
    });
    const audit = await client.query("SELECT new_value FROM audit_logs WHERE action_type = 'production_bootstrap.admin_created' AND target_entity_id = $1", [identity.rows[0].user_id]);
    assert.equal(audit.rowCount, 1);
    assert.doesNotMatch(audit.rows[0].new_value, new RegExp(password.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    await client.end();
  }
});

test("structured public content is capability-gated, validated, published immediately, and audited", async () => {
  const [presidentCookie, vp2Cookie, vp1Cookie, departmentCookie, branchCookie, memberCookie] = await Promise.all([
    login("president@example.test"),
    login("vp2@example.test"),
    login("vp1@example.test"),
    login("department@example.test"),
    login("branch@example.test"),
    login("member@example.test"),
  ]);
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const rows = await client.query("SELECT key, value FROM public_content ORDER BY key");
    const original = rows.rows.find((row) => row.key === "home.about.heading")?.value;
    assert.ok(original);
    const changedRows = rows.rows.map((row) => [
      row.key,
      row.key.endsWith("Destination") || row.key.endsWith("destination") ? row.value : `${row.value} Сынақ.`,
    ]);
    const changed = changedRows.find(([key]) => key === "home.about.heading")?.[1];
    assert.ok(changed);
    assert.ok(changedRows.filter(([key, value]) => value !== rows.rows.find((row) => row.key === key)?.value).length > 20);
    const form = () => new URLSearchParams(changedRows);
    const mutation = (cookie, body) => appRequest("/api/public-content", {
      method: "POST",
      headers: { cookie, origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body,
    });

    assert.equal((await appRequest("/dashboard/content", { headers: { cookie: presidentCookie } })).status, 200);
    assert.equal((await appRequest("/dashboard/content", { headers: { cookie: vp2Cookie } })).status, 200);
    for (const cookie of [vp1Cookie, departmentCookie, branchCookie, memberCookie]) {
      assert.equal((await appRequest("/dashboard/content", { headers: { cookie } })).status, 404);
      assert.equal((await mutation(cookie, form())).status, 403);
    }
    assert.equal((await mutation("", form())).status, 401);

    const presidentUpdate = await mutation(presidentCookie, form());
    assert.equal(presidentUpdate.status, 303);
    assert.match(presidentUpdate.headers.get("location") ?? "", /\/dashboard\/content\?success=published/);
    const publishedHome = await appRequest("/");
    assert.equal(publishedHome.status, 200);
    assert.match(await publishedHome.text(), new RegExp(changed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const invalidRows = changedRows.map(([key, value]) => [key, key === "home.hero.primaryDestination" ? "javascript:alert(1)" : value]);
    const invalid = await mutation(presidentCookie, new URLSearchParams(invalidRows));
    assert.equal(invalid.status, 303);
    assert.match(invalid.headers.get("location") ?? "", /error=validation/);

    const restoreRows = rows.rows.map((row) => [row.key, row.value]);
    const vp2Restore = await mutation(vp2Cookie, new URLSearchParams(restoreRows));
    assert.equal(vp2Restore.status, 303);
    const restoredHome = await appRequest("/");
    assert.match(await restoredHome.text(), new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const audit = await client.query(`
      SELECT actor_user_id, previous_value, new_value
      FROM audit_logs
      WHERE action_type = 'public_content.updated' AND target_entity_id = 'home.about.heading'
      ORDER BY created_at DESC LIMIT 2
    `);
    assert.equal(audit.rowCount, 2);
    assert.deepEqual(new Set(audit.rows.map((row) => row.actor_user_id)), new Set(["user-president", "user-vp2"]));
    assert.ok(audit.rows.some((row) => JSON.parse(row.previous_value).value === original && JSON.parse(row.new_value).value === changed));
    assert.ok(audit.rows.some((row) => JSON.parse(row.previous_value).value === changed && JSON.parse(row.new_value).value === original));
  } finally {
    await client.end();
  }
});

test("Phase 2.1 dynamic CMS keeps drafts private, separates publishing, serves public media safely, and audits the full lifecycle", async () => {
  const [presidentCookie, vp2Cookie, vp1Cookie, branchCookie, memberCookie] = await Promise.all([
    login("president@example.test"),
    login("vp2@example.test"),
    login("vp1@example.test"),
    login("branch@example.test"),
    login("member@example.test"),
  ]);
  const suffix = randomUUID();
  const slug = `cms-news-${suffix}`;
  const title = `CMS жаңалығы ${suffix}`;
  const form = () => {
    const data = new FormData();
    data.set("title", title);
    data.set("slug", slug);
    data.set("summary", "Жоба күйіндегі жаңалық ашық сайтқа шықпауы керек.");
    data.set("body", "## Қауіпсіз мәтін\n\n- Бірінші тармақ\n- Екінші тармақ\n\n**Аудитпен** сақталады.");
    data.set("authorText", "Редакция");
    data.set("image", new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "cms-test.png", { type: "image/png" }));
    return data;
  };
  const create = (cookie, body = form()) => appRequest("/api/content/news", {
    method: "POST", headers: { origin: "http://localhost", cookie }, body,
  });

  assert.equal((await appRequest("/dashboard/content/news", { headers: authHeaders(presidentCookie) })).status, 200);
  assert.equal((await appRequest("/dashboard/content/news", { headers: authHeaders(vp2Cookie) })).status, 200);
  for (const cookie of [vp1Cookie, branchCookie, memberCookie]) {
    assert.equal((await appRequest("/dashboard/content/news", { headers: authHeaders(cookie) })).status, 404);
    assert.equal((await create(cookie)).status, 403);
  }
  assert.equal((await create("")).status, 401);

  const created = await create(presidentCookie);
  assert.equal(created.status, 303);
  const location = created.headers.get("location") ?? "";
  const id = location.match(/\/dashboard\/content\/news\/([^?]+)/)?.[1];
  assert.ok(id);
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const draft = await client.query("SELECT status, published_at, cover_media_id FROM news WHERE id = $1", [id]);
    assert.deepEqual({ status: draft.rows[0].status, published_at: draft.rows[0].published_at }, { status: "DRAFT", published_at: null });
    assert.ok(draft.rows[0].cover_media_id);
    const mediaId = draft.rows[0].cover_media_id;
    assert.equal((await appRequest(`/api/public-media/${mediaId}`)).status, 404);
    assert.equal((await appRequest(`/api/public-media/${mediaId}`, { headers: authHeaders(presidentCookie) })).status, 200);
    assert.doesNotMatch(await (await appRequest("/news")).text(), new RegExp(title));
    assert.equal((await appRequest(`/news/${slug}`)).status, 404);

    const publish = await appRequest(`/api/content/news/${id}`, {
      method: "POST", headers: { origin: "http://localhost", cookie: vp2Cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "publish" }),
    });
    assert.equal(publish.status, 303);
    const publicList = await appRequest("/news");
    assert.equal(publicList.status, 200);
    assert.match(await publicList.text(), new RegExp(title));
    const publicDetail = await appRequest(`/news/${slug}`);
    assert.equal(publicDetail.status, 200);
    const publicHtml = visibleMarkup(await publicDetail.text());
    assert.match(publicHtml, /Қауіпсіз мәтін/);
    assert.doesNotMatch(publicHtml, /<script/i);
    assert.equal((await appRequest(`/api/public-media/${mediaId}`)).status, 200);

    const invalid = new FormData();
    invalid.set("action", "save");
    invalid.set("title", title);
    invalid.set("slug", slug);
    invalid.set("summary", "Өзгермеуі керек");
    invalid.set("body", "<script>alert(1)</script>");
    invalid.set("authorText", "Редакция");
    const invalidUpdate = await appRequest(`/api/content/news/${id}`, { method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie }, body: invalid });
    assert.equal(invalidUpdate.status, 303);
    assert.match(invalidUpdate.headers.get("location") ?? "", /error=validation/);
    assert.equal((await client.query("SELECT status, lead FROM news WHERE id = $1", [id])).rows[0].status, "PUBLISHED");

    const archive = await appRequest(`/api/content/news/${id}`, {
      method: "POST", headers: { origin: "http://localhost", cookie: vp2Cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "archive" }),
    });
    assert.equal(archive.status, 303);
    assert.equal((await appRequest(`/news/${slug}`)).status, 404);
    const restore = await appRequest(`/api/content/news/${id}`, {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "restore" }),
    });
    assert.equal(restore.status, 303);
    const restored = await client.query("SELECT status, published_at, archived_at FROM news WHERE id = $1", [id]);
    assert.equal(restored.rows[0].status, "PUBLISHED");
    assert.ok(restored.rows[0].published_at);
    assert.equal(restored.rows[0].archived_at, null);

    const permissions = await client.query(`
      SELECT r.slug AS role, p.slug AS permission
      FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
      WHERE p.slug IN ('dynamic_content.manage', 'dynamic_content.publish', 'public_media.manage')
      ORDER BY r.slug, p.slug
    `);
    assert.deepEqual(new Set(permissions.rows.map((row) => row.role)), new Set(["president", "vice_president_2"]));
    const audits = await client.query("SELECT action_type, previous_value, new_value FROM audit_logs WHERE target_entity = 'news' AND target_entity_id = $1 ORDER BY created_at", [id]);
    assert.deepEqual(audits.rows.map((row) => row.action_type), [
      "dynamic_content.created", "dynamic_content.published", "dynamic_content.archived", "dynamic_content.published",
    ]);
    assert.ok(audits.rows.every((row) => row.new_value));
    assert.ok(audits.rows.slice(1).every((row) => row.previous_value));
  } finally {
    await client.end();
  }
});

test("60-day retention removes only disposable public CMS data and preserves protected history", async () => {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  const suffix = randomUUID();
  const now = new Date();
  const expired = new Date(now.getTime() - 61 * 86_400_000);
  const recent = new Date(now.getTime() - 59 * 86_400_000);
  const expiredNewsId = `retention-news-expired-${suffix}`;
  const recentNewsId = `retention-news-recent-${suffix}`;
  const draftPublicationId = `retention-publication-draft-${suffix}`;
  const officialPublicationId = `retention-publication-official-${suffix}`;
  const draftProjectId = `retention-project-draft-${suffix}`;
  const attachedMediaId = `retention-media-attached-${suffix}`;
  const archivedMediaId = `retention-media-archived-${suffix}`;
  const activeOrphanMediaId = `retention-media-active-${suffix}`;
  const attachedObjectKey = `public-media/${attachedMediaId}/retention.png`;
  const archivedObjectKey = `public-media/${archivedMediaId}/retention.png`;
  const activeObjectKey = `public-media/${activeOrphanMediaId}/retention.png`;

  try {
    const before = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM person_profiles) AS profiles,
        (SELECT COUNT(*)::int FROM membership_applications) AS applications,
        (SELECT COUNT(*)::int FROM membership_status_history) AS status_history,
        (SELECT COUNT(*)::int FROM audit_logs) AS audit_logs
    `);
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO public_media
        (id, object_key, original_name, mime_type, size_bytes, checksum_sha256, status, uploaded_by, created_at, archived_at)
      VALUES
        ($1, $2, 'retention.png', 'image/png', 8, $3, 'active', 'user-president', $4, NULL),
        ($5, $6, 'retention.png', 'image/png', 8, $3, 'archived', 'user-president', $4, $4),
        ($7, $8, 'retention.png', 'image/png', 8, $3, 'active', 'user-president', NOW() - INTERVAL '2 days', NULL)
    `, [attachedMediaId, attachedObjectKey, "0".repeat(64), expired, archivedMediaId, archivedObjectKey, activeOrphanMediaId, activeObjectKey]);
    await client.query(`
      INSERT INTO public_objects (object_key, body, created_at, updated_at)
      VALUES ($1, decode('89504e470d0a1a0a', 'hex'), NOW(), NOW()),
             ($2, decode('89504e470d0a1a0a', 'hex'), NOW(), NOW()),
             ($3, decode('89504e470d0a1a0a', 'hex'), NOW(), NOW())
    `, [attachedObjectKey, archivedObjectKey, activeObjectKey]);
    await client.query(`
      INSERT INTO news
        (id, title, slug, lead, body, cover_media_id, status, published_at, archived_at, created_by, updated_by, created_at, updated_at)
      VALUES
        ($1, 'Мерзімі өткен жаңалық', $2, 'Сынақ', 'Сынақ', $3, 'ARCHIVED', $4, $4, 'user-president', 'user-president', $4, $4),
        ($5, 'Жуырда архивтелген жаңалық', $6, 'Сынақ', 'Сынақ', NULL, 'ARCHIVED', $7, $7, 'user-president', 'user-president', $7, $7)
    `, [expiredNewsId, `retention-expired-${suffix}`, attachedMediaId, expired, recentNewsId, `retention-recent-${suffix}`, recent]);
    await client.query(`
      INSERT INTO publications
        (id, title, slug, summary, body, status, published_at, archived_at, created_by, updated_by, created_at, updated_at)
      VALUES
        ($1, 'Жарияланбаған жоба', $2, 'Сынақ', 'Сынақ', 'ARCHIVED', NULL, $3, 'user-president', 'user-president', $3, $3),
        ($4, 'Ресми жарияланым', $5, 'Сынақ', 'Сынақ', 'ARCHIVED', $3, $3, 'user-president', 'user-president', $3, $3)
    `, [draftPublicationId, `retention-draft-publication-${suffix}`, expired, officialPublicationId, `retention-official-publication-${suffix}`]);
    await client.query(`
      INSERT INTO public_projects
        (id, title, slug, summary, body, status, published_at, archived_at, created_by, updated_by, created_at, updated_at)
      VALUES ($1, 'Жарияланбаған жоба', $2, 'Сынақ', 'Сынақ', 'ARCHIVED', NULL, $3, 'user-president', 'user-president', $3, $3)
    `, [draftProjectId, `retention-draft-project-${suffix}`, expired]);
    await client.query("COMMIT");

    const runner = spawnSync(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./retention-runner.ts", import.meta.url))], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL, RETENTION_TEST_NOW: now.toISOString() },
    });
    assert.equal(runner.status, 0, runner.stderr || runner.stdout);

    const content = await client.query(`
      SELECT
        EXISTS(SELECT 1 FROM news WHERE id = $1) AS expired_news,
        EXISTS(SELECT 1 FROM news WHERE id = $2) AS recent_news,
        EXISTS(SELECT 1 FROM publications WHERE id = $3) AS draft_publication,
        EXISTS(SELECT 1 FROM publications WHERE id = $4) AS official_publication,
        EXISTS(SELECT 1 FROM public_projects WHERE id = $5) AS draft_project
    `, [expiredNewsId, recentNewsId, draftPublicationId, officialPublicationId, draftProjectId]);
    assert.deepEqual(content.rows[0], {
      expired_news: false,
      recent_news: true,
      draft_publication: false,
      official_publication: true,
      draft_project: false,
    });

    const media = await client.query(`
      SELECT id, status, archived_at FROM public_media
      WHERE id IN ($1, $2, $3) ORDER BY id
    `, [attachedMediaId, archivedMediaId, activeOrphanMediaId]);
    assert.deepEqual(media.rows.map((row) => row.id), [activeOrphanMediaId]);
    assert.equal(media.rows[0].status, "archived");
    assert.ok(media.rows[0].archived_at);
    const objects = await client.query("SELECT object_key FROM public_objects WHERE object_key IN ($1, $2, $3) ORDER BY object_key", [attachedObjectKey, archivedObjectKey, activeObjectKey]);
    assert.deepEqual(objects.rows.map((row) => row.object_key), [activeObjectKey]);

    const after = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM person_profiles) AS profiles,
        (SELECT COUNT(*)::int FROM membership_applications) AS applications,
        (SELECT COUNT(*)::int FROM membership_status_history) AS status_history,
        (SELECT COUNT(*)::int FROM audit_logs) AS audit_logs
    `);
    assert.equal(after.rows[0].profiles, before.rows[0].profiles);
    assert.equal(after.rows[0].applications, before.rows[0].applications);
    assert.equal(after.rows[0].status_history, before.rows[0].status_history);
    assert.ok(after.rows[0].audit_logs > before.rows[0].audit_logs);
    const audits = await client.query(`
      SELECT action_type, target_entity, target_entity_id FROM audit_logs
      WHERE target_entity_id IN ($1, $2, $3, $4, $5) ORDER BY target_entity_id
    `, [expiredNewsId, draftPublicationId, draftProjectId, attachedMediaId, archivedMediaId]);
    assert.equal(audits.rowCount, 5);
    assert.ok(audits.rows.every((row) => row.action_type.endsWith("retention_deleted")));
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.query("DELETE FROM news WHERE id = $1", [recentNewsId]);
    await client.query("DELETE FROM publications WHERE id = $1", [officialPublicationId]);
    await client.query("DELETE FROM public_media WHERE id = $1", [activeOrphanMediaId]);
    await client.query("DELETE FROM public_objects WHERE object_key = $1", [activeObjectKey]);
    await client.end();
  }
});

test("professional categories remain separate, multi-valued, scoped, configurable, and immutably audited", async () => {
  const [presidentCookie, vp2Cookie, vp1Cookie, departmentCookie, branchCookie, memberCookie] = await Promise.all([
    login("president@example.test"),
    login("vp2@example.test"),
    login("vp1@example.test"),
    login("department@example.test"),
    login("branch@example.test"),
    login("member@example.test"),
  ]);
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  const suffix = randomUUID();
  const initialName = `Кәсіби санат сынағы ${suffix}`;
  const renamedName = `Кәсіби санат жаңартылды ${suffix}`;
  const teacherCategoryId = "professional-category-mathematics-teacher";
  const currentMemberName = (await client.query("SELECT full_name FROM person_profiles WHERE id = 'person-member'")).rows[0].full_name;
  const currentMemberNamePattern = new RegExp(currentMemberName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const originalCategoryIds = new Map();
  const activeCategoryIds = async (personId) => (await client.query(`
    SELECT category_id FROM person_professional_category_assignments
    WHERE person_id = $1 AND removed_at IS NULL ORDER BY category_id
  `, [personId])).rows.map((row) => row.category_id);
  const saveAssignments = (cookie, personId, categoryIds, reason) => appRequest(`/api/members/${personId}/professional-categories`, {
    method: "POST",
    headers: { cookie, origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams([...categoryIds.map((categoryId) => ["categoryIds", categoryId]), ["reason", reason]]),
  });
  try {
    assert.equal((await appRequest("/dashboard/categories", { headers: { cookie: presidentCookie } })).status, 200);
    assert.equal((await appRequest("/dashboard/categories", { headers: { cookie: vp2Cookie } })).status, 200);
    for (const cookie of [vp1Cookie, departmentCookie, branchCookie, memberCookie]) {
      assert.equal((await appRequest("/dashboard/categories", { headers: { cookie } })).status, 404);
      assert.equal((await appRequest("/api/professional-categories", {
        method: "POST",
        headers: { cookie, origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ name: initialName, description: "", sortOrder: "500" }),
      })).status, 403);
    }

    const create = await appRequest("/api/professional-categories", {
      method: "POST",
      headers: { cookie: presidentCookie, origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name: initialName, description: "Уақытша автоматтандырылған сынақ санаты", sortOrder: "500", reason: "Каталог сынағы" }),
    });
    assert.equal(create.status, 303);
    const categoryResult = await client.query("SELECT id FROM professional_categories WHERE name = $1", [initialName]);
    assert.equal(categoryResult.rowCount, 1);
    const categoryId = categoryResult.rows[0].id;

    for (const personId of ["person-member", "person-president"]) originalCategoryIds.set(personId, await activeCategoryIds(personId));
    const memberNext = [...new Set([...originalCategoryIds.get("person-member"), teacherCategoryId, categoryId])];
    assert.equal((await saveAssignments(presidentCookie, "person-member", memberNext, "Бірнеше санат сынағы")).status, 303);
    const presidentNext = [...new Set([...originalCategoryIds.get("person-president"), categoryId])];
    assert.equal((await saveAssignments(presidentCookie, "person-president", presidentNext, "Аумақтық сүзгі сынағы")).status, 303);
    const memberCategories = await activeCategoryIds("person-member");
    assert.ok(memberCategories.includes(teacherCategoryId));
    assert.ok(memberCategories.includes(categoryId));

    const assignmentBeforeRename = await client.query(`
      SELECT id, category_id FROM person_professional_category_assignments
      WHERE person_id = 'person-member' AND category_id = $1 AND removed_at IS NULL
    `, [categoryId]);
    assert.equal(assignmentBeforeRename.rowCount, 1);
    const update = await appRequest(`/api/professional-categories/${categoryId}`, {
      method: "POST",
      headers: { cookie: vp2Cookie, origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        name: renamedName,
        description: "Жаңартылған сипаттама",
        sortOrder: "510",
        status: "inactive",
        reason: "Атау, сипаттама, рет және мәртебе аудитін тексеру",
      }),
    });
    assert.equal(update.status, 303);
    const assignmentAfterRename = await client.query(`
      SELECT a.id, a.category_id, a.removed_at, c.name, c.status
      FROM person_professional_category_assignments a
      JOIN professional_categories c ON c.id = a.category_id
      WHERE a.id = $1
    `, [assignmentBeforeRename.rows[0].id]);
    assert.deepEqual(assignmentAfterRename.rows[0], {
      id: assignmentBeforeRename.rows[0].id,
      category_id: categoryId,
      removed_at: null,
      name: renamedName,
      status: "inactive",
    });

    const ownProfile = await appRequest("/dashboard/profile", { headers: { cookie: memberCookie } });
    assert.match(await ownProfile.text(), new RegExp(renamedName));
    const vp1Filtered = await appRequest(`/dashboard/professional?categoryId=${encodeURIComponent(categoryId)}`, { headers: { cookie: vp1Cookie } });
    const vp1Html = await vp1Filtered.text();
    assert.match(vp1Html, currentMemberNamePattern);
    assert.match(vp1Html, /Президент рөлі \(сынақ\)/);
    const branchFiltered = await appRequest(`/dashboard/members?categoryId=${encodeURIComponent(categoryId)}`, { headers: { cookie: branchCookie } });
    const branchHtml = await branchFiltered.text();
    assert.match(branchHtml, currentMemberNamePattern);
    assert.doesNotMatch(branchHtml, /Президент рөлі \(сынақ\)/);
    const branchEscape = await appRequest(`/dashboard/members?categoryId=${encodeURIComponent(categoryId)}&branchId=branch-astana`, { headers: { cookie: branchCookie } });
    assert.doesNotMatch(await branchEscape.text(), /Президент рөлі \(сынақ\)/);
    const departmentFiltered = await appRequest(`/dashboard/professional?categoryId=${encodeURIComponent(categoryId)}`, { headers: { cookie: departmentCookie } });
    const departmentHtml = await departmentFiltered.text();
    assert.match(departmentHtml, currentMemberNamePattern);
    assert.doesNotMatch(departmentHtml, /Президент рөлі \(сынақ\)/);

    assert.equal((await saveAssignments(branchCookie, "person-member", memberNext, "Рұқсатсыз өзгеріс")).status, 403);
    assert.equal((await saveAssignments(vp2Cookie, "person-member", originalCategoryIds.get("person-member"), "Сынақ тағайындауларын қайтару")).status, 303);
    assert.equal((await saveAssignments(vp2Cookie, "person-president", originalCategoryIds.get("person-president"), "Сынақ тағайындауларын қайтару")).status, 303);
    const historical = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM person_professional_category_assignments
      WHERE category_id = $1 AND removed_at IS NOT NULL
    `, [categoryId]);
    assert.ok(historical.rows[0].count >= 2);
    const preservedCategory = await client.query("SELECT status FROM professional_categories WHERE id = $1", [categoryId]);
    assert.equal(preservedCategory.rows[0].status, "inactive");

    const audits = await client.query(`
      SELECT action_type, actor_user_id, previous_value, new_value, created_at
      FROM audit_logs
      WHERE target_entity_id IN ($1, 'person-member', 'person-president')
        AND action_type LIKE 'professional_category.%'
      ORDER BY created_at
    `, [categoryId]);
    const actions = new Set(audits.rows.map((row) => row.action_type));
    for (const action of [
      "professional_category.created",
      "professional_category.renamed",
      "professional_category.description_changed",
      "professional_category.sort_order_changed",
      "professional_category.status_changed",
      "professional_category.assigned",
      "professional_category.removed",
    ]) assert.ok(actions.has(action), `missing professional-category audit ${action}`);
    assert.ok(audits.rows.every((row) => row.actor_user_id && row.created_at && row.new_value));
    assert.ok(audits.rows.some((row) => row.previous_value));
  } finally {
    await client.end();
  }
});

test("authoritative VP mapping, branch scoping, private documents, audit access, and self-service boundaries hold", async () => {
  const [presidentCookie, vp2Cookie, vp1Cookie, branchCookie, departmentCookie, memberCookie] = await Promise.all([
    login("president@example.test"),
    login("vp2@example.test"),
    login("vp1@example.test"),
    login("branch@example.test"),
    login("department@example.test"),
    login("member@example.test"),
  ]);
  const almaty = await submitApplication("almaty");
  const east = await submitApplication("east");
  assert.ok(almaty.id && east.id);

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
  const documents = await client.query("SELECT application_id, id FROM uploaded_documents WHERE application_id = ANY($1::text[])", [[almaty.id, east.id]]);
  const almatyDocument = documents.rows.find((row) => row.application_id === almaty.id)?.id;
  const eastDocument = documents.rows.find((row) => row.application_id === east.id)?.id;
  assert.ok(almatyDocument && eastDocument);

  const [branchDashboardResponse, branchBranchesResponse, branchMembersResponse, branchApplicationsResponse] = await Promise.all([
    appRequest("/dashboard", { headers: authHeaders(branchCookie) }),
    appRequest("/dashboard/branches", { headers: authHeaders(branchCookie) }),
    appRequest("/dashboard/members", { headers: authHeaders(branchCookie) }),
    appRequest("/dashboard/applications", { headers: authHeaders(branchCookie) }),
  ]);
  for (const response of [branchDashboardResponse, branchBranchesResponse, branchMembersResponse, branchApplicationsResponse]) assert.equal(response.status, 200);
  const [branchDashboardHtml, branchBranchesHtml, branchMembersHtml, branchApplicationsHtml] = await Promise.all([
    branchDashboardResponse.text(), branchBranchesResponse.text(), branchMembersResponse.text(), branchApplicationsResponse.text(),
  ]);
  for (const html of [branchDashboardHtml, branchBranchesHtml, branchMembersHtml, branchApplicationsHtml]) {
    assert.doesNotMatch(html, /Астана қалалық филиалы|Түркістан облыстық филиалы|Шығыс Қазақстан облыстық филиалы|Қарағанды облыстық филиалы/);
  }
  assert.match(branchBranchesHtml, /Алматы қалалық филиалы/);
  assert.match(branchMembersHtml, /Алматы қалалық филиалы/);
  assert.match(branchApplicationsHtml, /Алматы қалалық филиалы/);
  const profileCounts = await client.query("SELECT COUNT(*)::int AS organization_count, COUNT(*) FILTER (WHERE branch_id = 'branch-almaty')::int AS branch_count FROM person_profiles WHERE archived_at IS NULL");
  assert.notEqual(profileCounts.rows[0].organization_count, profileCounts.rows[0].branch_count);
  assert.match(branchDashboardHtml, new RegExp(`Тіркелген профиль</span><strong>${profileCounts.rows[0].branch_count}</strong>`));
  assert.doesNotMatch(branchDashboardHtml, new RegExp(`Тіркелген профиль</span><strong>${profileCounts.rows[0].organization_count}</strong>`));

  assert.equal((await appRequest(`/dashboard/applications/${almaty.id}`, { headers: authHeaders(branchCookie) })).status, 200);
  assert.equal((await appRequest(`/dashboard/applications/${east.id}`, { headers: authHeaders(branchCookie) })).status, 404);
  assert.equal((await appRequest(`/api/documents/${almatyDocument}`, { headers: authHeaders(branchCookie) })).status, 200);
  assert.equal((await appRequest(`/api/documents/${eastDocument}`, { headers: authHeaders(branchCookie) })).status, 403);
  assert.equal((await appRequest(`/api/documents/${eastDocument}`, { headers: authHeaders(presidentCookie) })).status, 200);
  assert.equal((await appRequest(`/api/documents/${almatyDocument}`, { headers: authHeaders(memberCookie) })).status, 403);

  for (const path of [
    "/dashboard",
    "/dashboard/members",
    "/dashboard/branches",
    "/dashboard/applications",
    `/dashboard/applications/${east.id}`,
    "/dashboard/audit",
    "/dashboard/access",
  ]) {
    assert.equal((await appRequest(path, { headers: authHeaders(vp2Cookie) })).status, 200, `VP2 must have global access to ${path}`);
  }
  assert.equal((await appRequest(`/api/documents/${eastDocument}`, { headers: authHeaders(vp2Cookie) })).status, 200);

  const professionalResponse = await appRequest("/dashboard/professional", { headers: authHeaders(vp1Cookie) });
  assert.equal(professionalResponse.status, 200);
  const professionalHtml = await professionalResponse.text();
  assert.match(professionalHtml, /Алматы/);
  assert.match(professionalHtml, /Астана/);
  assert.match(professionalHtml, /Президент рөлі \(сынақ\)/);
  assert.match(professionalHtml, /II вице-президент рөлі \(сынақ\)/);
  assert.doesNotMatch(professionalHtml, /member@example\.test|0000000099/);
  for (const path of [
    "/dashboard/members",
    "/dashboard/branches",
    "/dashboard/applications",
    `/dashboard/applications/${almaty.id}`,
    "/dashboard/audit",
    "/dashboard/access",
  ]) {
    assert.equal((await appRequest(path, { headers: authHeaders(vp1Cookie) })).status, 404, `VP1 must not have unrestricted access to ${path}`);
  }
  assert.equal((await appRequest(`/api/documents/${almatyDocument}`, { headers: authHeaders(vp1Cookie) })).status, 403);

  const decisionBody = new URLSearchParams({ decision: "reserve", reason: "Қолжетімділік шекарасын тексеру" });
  assert.equal((await appRequest(`/api/applications/${almaty.id}/decision`, { method: "POST", headers: { ...authHeaders(branchCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" }, body: decisionBody })).status, 303);
  assert.equal((await appRequest(`/api/applications/${east.id}/decision`, { method: "POST", headers: { ...authHeaders(branchCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ decision: "reserve", reason: "Басқа өңірге рұқсат берілмеуі керек" }) })).status, 403);

  assert.equal((await appRequest("/dashboard/audit", { headers: authHeaders(branchCookie) })).status, 404);
  assert.equal((await appRequest("/dashboard/audit", { headers: authHeaders(presidentCookie) })).status, 200);
  assert.equal((await appRequest("/dashboard/access", { headers: authHeaders(branchCookie) })).status, 404);
  assert.equal((await appRequest("/dashboard/access", { headers: authHeaders(presidentCookie) })).status, 200);
  assert.equal((await appRequest("/dashboard/professional", { headers: authHeaders(branchCookie) })).status, 404);
  const departmentProfessionalResponse = await appRequest("/dashboard/professional", { headers: authHeaders(departmentCookie) });
  assert.equal(departmentProfessionalResponse.status, 200);
  const departmentProfessionalHtml = await departmentProfessionalResponse.text();
  const currentMemberName = (await client.query("SELECT full_name FROM person_profiles WHERE id = 'person-member'")).rows[0].full_name;
  const currentMemberNamePattern = new RegExp(currentMemberName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(departmentProfessionalHtml, /Департамент басшысы рөлі \(сынақ\)/);
  assert.match(departmentProfessionalHtml, currentMemberNamePattern);
  assert.doesNotMatch(departmentProfessionalHtml, /Президент рөлі \(сынақ\)|I вице-президент рөлі \(сынақ\)|II вице-президент рөлі \(сынақ\)|Филиал директоры рөлі \(сынақ\)/);
  assert.doesNotMatch(visibleMarkup(departmentProfessionalHtml), /@example\.test|00000000/);
  assert.equal((await appRequest("/api/access/departments", { method: "POST", headers: { ...authHeaders(memberCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ action: "grant", personId: "person-president", departmentId: "dept-content" }) })).status, 403);
  assert.equal((await appRequest("/dashboard/applications", { headers: authHeaders(memberCookie) })).status, 404);

  const updatedMemberName = `Мүше Түзеткен аты-${randomUUID().slice(0, 8)}`;
  const multilineBiography = "Сынақ профилінің бірінші жолы.\nСынақ профилінің екінші жолы.";
  await client.query("UPDATE person_profiles SET biography = $1 WHERE id = 'person-member'", [multilineBiography]);
  const profileBody = new URLSearchParams({
    surname: "Мүше", givenName: "Түзеткен", patronymic: updatedMemberName.split(" ")[2], phone: "0000000099", email: "өзгермеуі-керек@example.test", workplace: "Сынақ дерегі", position: "Мүше",
    educationLevelCode: "higher", educationInstitution: "Сынақ оқу орны", educationProgram: "Математика",
    mathSpecialization: "Комбинаторика", achievements: "Сынақ дерегі",
    biography: multilineBiography.replace(/\n/g, "\r\n"), membershipStatus: "rejected", branchId: "branch-east",
  });
  assert.equal((await appRequest("/api/profile", { method: "POST", headers: { ...authHeaders(memberCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" }, body: profileBody })).status, 303);
  const member = await client.query(`
    SELECT p.full_name, p.email AS profile_email, u.email AS user_email, p.membership_status, p.branch_id
    FROM person_profiles p JOIN users u ON u.id = p.user_id WHERE p.id = 'person-member'
  `);
  assert.deepEqual(member.rows[0], {
    full_name: updatedMemberName,
    profile_email: "member@example.test",
    user_email: "member@example.test",
    membership_status: "member",
    branch_id: "branch-almaty",
  });
  const profileAudit = await client.query(`
    SELECT previous_value, new_value FROM audit_logs
    WHERE action_type = 'profile.self_updated' AND target_entity_id = 'person-member'
    ORDER BY created_at DESC LIMIT 1
  `);
  assert.equal(profileAudit.rowCount, 1);
  const profileAuditChanges = JSON.parse(profileAudit.rows[0].new_value);
  assert.equal(profileAuditChanges.fullName, updatedMemberName);
  assert.equal("email" in profileAuditChanges, false);
  assert.equal("biography" in profileAuditChanges, false);
  const updatedOwnProfile = visibleMarkup(await (await appRequest("/dashboard/profile", { headers: authHeaders(memberCookie) })).text());
  assert.match(updatedOwnProfile, new RegExp(updatedMemberName));
  assert.match(updatedOwnProfile, /member@example\.test/);
  assert.doesNotMatch(updatedOwnProfile, /өзгермеуі-керек@example\.test/);

  const vicePresidents = await client.query(`
    SELECT u.email, p.membership_status, r.slug, r.access_level, ur.scope_type, ur.scope_id
    FROM users u
    JOIN person_profiles p ON p.user_id = u.id
    JOIN user_roles ur ON ur.user_id = u.id AND ur.revoked_at IS NULL
    JOIN roles r ON r.id = ur.role_id
    WHERE u.email IN ('vp1@example.test', 'vp2@example.test')
    ORDER BY u.email
  `);
  assert.deepEqual(vicePresidents.rows, [
    { email: "vp1@example.test", membership_status: "member", slug: "vice_president_1", access_level: "B", scope_type: "department", scope_id: "dept-content" },
    { email: "vp2@example.test", membership_status: "member", slug: "vice_president_2", access_level: "A", scope_type: "global", scope_id: null },
  ]);

  const rolePermissions = await client.query(`
    SELECT r.slug, array_agg(p.slug ORDER BY p.slug) AS permissions
    FROM roles r
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE r.slug IN ('president', 'vice_president_1', 'vice_president_2')
    GROUP BY r.slug
    ORDER BY r.slug
  `);
  const permissionsByRole = Object.fromEntries(rolePermissions.rows.map((row) => [row.slug, row.permissions]));
  assert.deepEqual(permissionsByRole.vice_president_1, ["department.professional.read"]);
  assert.deepEqual(permissionsByRole.vice_president_2, permissionsByRole.president);

  const staleDepartmentAssignment = await client.query("SELECT id FROM person_department_assignments WHERE person_id = 'person-president' AND department_id = 'dept-content' AND ended_at IS NULL LIMIT 1");
  if (staleDepartmentAssignment.rows[0]) {
    assert.equal((await appRequest("/api/access/departments", { method: "POST", headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ action: "revoke", assignmentId: staleDepartmentAssignment.rows[0].id }) })).status, 303);
  }
  assert.equal((await appRequest("/api/access/departments", { method: "POST", headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ action: "grant", personId: "person-president", departmentId: "dept-content" }) })).status, 303);
  const activeDepartmentAssignment = await client.query("SELECT id FROM person_department_assignments WHERE person_id = 'person-president' AND department_id = 'dept-content' AND ended_at IS NULL");
  assert.equal(activeDepartmentAssignment.rowCount, 1);
  const departmentWithPresident = await appRequest("/dashboard/professional", { headers: authHeaders(departmentCookie) });
  assert.match(await departmentWithPresident.text(), /Президент рөлі \(сынақ\)/);
  assert.equal((await appRequest("/api/access/departments", { method: "POST", headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ action: "revoke", assignmentId: activeDepartmentAssignment.rows[0].id }) })).status, 303);
  const endedDepartmentAssignment = await client.query("SELECT ended_at, ended_by FROM person_department_assignments WHERE id = $1", [activeDepartmentAssignment.rows[0].id]);
  assert.ok(endedDepartmentAssignment.rows[0].ended_at);
  assert.equal(endedDepartmentAssignment.rows[0].ended_by, "user-president");
  const departmentWithoutPresident = await appRequest("/dashboard/professional", { headers: authHeaders(departmentCookie) });
  assert.doesNotMatch(await departmentWithoutPresident.text(), /Президент рөлі \(сынақ\)/);
  } finally {
    await client.end();
  }
});

test("only President and VP2 can govern roles with complete immutable before-and-after access audits", async () => {
  const [presidentCookie, vp2Cookie, vp1Cookie, departmentCookie, branchCookie, memberCookie] = await Promise.all([
    login("president@example.test"),
    login("vp2@example.test"),
    login("vp1@example.test"),
    login("department@example.test"),
    login("branch@example.test"),
    login("member@example.test"),
  ]);
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const activeTestAssignments = await client.query(`
      SELECT ur.id
      FROM user_roles ur
      WHERE ur.user_id = 'user-member' AND ur.role_id = 'role-branch-staff' AND ur.revoked_at IS NULL
    `);
    for (const row of activeTestAssignments.rows) {
      const cleanup = await appRequest("/api/access/roles", {
        method: "POST",
        headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ action: "revoke", assignmentId: row.id, reason: "Сынақ алдындағы қауіпсіз тазарту" }),
      });
      assert.equal(cleanup.status, 303);
    }

    for (const cookie of [vp1Cookie, departmentCookie, branchCookie, memberCookie]) {
      const forbidden = await appRequest("/api/access/roles", {
        method: "POST",
        headers: { ...authHeaders(cookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ action: "grant", userId: "user-member", roleId: "role-president", scopeId: "", reason: "Рұқсат етілмеуі керек" }),
      });
      assert.equal(forbidden.status, 403);
    }

    const selfRevoke = await appRequest("/api/access/roles", {
      method: "POST",
      headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "revoke", assignmentId: "assignment-user-president", reason: "Кездейсоқ жоғалтуды тексеру" }),
    });
    assert.equal(selfRevoke.status, 303);
    assert.match(selfRevoke.headers.get("location") ?? "", /error=self/);

    const grantReason = `President governance test ${randomUUID()}`;
    const grant = await appRequest("/api/access/roles", {
      method: "POST",
      headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "grant", userId: "user-member", roleId: "role-branch-staff", scopeId: "branch-almaty", reason: grantReason }),
    });
    assert.equal(grant.status, 303);

    const assignment = await client.query(`
      SELECT id FROM user_roles
      WHERE user_id = 'user-member' AND role_id = 'role-branch-staff' AND scope_id = 'branch-almaty' AND revoked_at IS NULL
      ORDER BY granted_at DESC LIMIT 1
    `);
    assert.equal(assignment.rowCount, 1);

    const grantAudit = await client.query(`
      SELECT actor_user_id, target_entity, target_entity_id, previous_value, new_value, reason, created_at
      FROM audit_logs WHERE action_type = 'role.granted' AND target_entity_id = 'user-member' AND reason = $1
      ORDER BY created_at DESC LIMIT 1
    `, [grantReason]);
    assert.equal(grantAudit.rowCount, 1);
    assert.equal(grantAudit.rows[0].actor_user_id, "user-president");
    assert.equal(grantAudit.rows[0].target_entity, "user_access");
    assert.ok(grantAudit.rows[0].created_at);
    const grantPrevious = JSON.parse(grantAudit.rows[0].previous_value);
    const grantNext = JSON.parse(grantAudit.rows[0].new_value);
    assert.equal(grantPrevious.roles.some((role) => role.role === "branch_staff"), false);
    assert.equal(grantNext.roles.some((role) => role.role === "branch_staff" && role.scopeId === "branch-almaty"), true);
    assert.ok(grantNext.capabilities.includes("applications.branch.read"));

    const memberCannotRevoke = await appRequest("/api/access/roles", {
      method: "POST",
      headers: { ...authHeaders(memberCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "revoke", assignmentId: assignment.rows[0].id, reason: "Өзін көтеруге жол берілмейді" }),
    });
    assert.equal(memberCannotRevoke.status, 403);

    const revokeReason = `VP2 governance test ${randomUUID()}`;
    const revoke = await appRequest("/api/access/roles", {
      method: "POST",
      headers: { ...authHeaders(vp2Cookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "revoke", assignmentId: assignment.rows[0].id, reason: revokeReason }),
    });
    assert.equal(revoke.status, 303);

    const revokeAudit = await client.query(`
      SELECT actor_user_id, target_entity, target_entity_id, previous_value, new_value, reason, created_at
      FROM audit_logs WHERE action_type = 'role.revoked' AND target_entity_id = 'user-member' AND reason = $1
      ORDER BY created_at DESC LIMIT 1
    `, [revokeReason]);
    assert.equal(revokeAudit.rowCount, 1);
    assert.equal(revokeAudit.rows[0].actor_user_id, "user-vp2");
    const revokePrevious = JSON.parse(revokeAudit.rows[0].previous_value);
    const revokeNext = JSON.parse(revokeAudit.rows[0].new_value);
    assert.equal(revokePrevious.roles.some((role) => role.role === "branch_staff"), true);
    assert.equal(revokeNext.roles.some((role) => role.role === "branch_staff"), false);
    assert.equal(revokeNext.capabilities.includes("applications.branch.read"), false);

    const protectedAdministratorCount = await client.query(`
      SELECT COUNT(DISTINCT ur.user_id)::int AS count
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id JOIN users u ON u.id = ur.user_id
      WHERE ur.revoked_at IS NULL AND r.slug IN ('president', 'vice_president_2') AND u.status = 'active' AND u.archived_at IS NULL
    `);
    assert.ok(protectedAdministratorCount.rows[0].count >= 1);
  } finally {
    await client.end();
  }
});

test("President and VP2 manage an audited organizational hierarchy while department heads remain unit-scoped", async () => {
  const [presidentCookie, vp2Cookie, vp1Cookie, departmentCookie, branchCookie, memberCookie] = await Promise.all([
    login("president@example.test"),
    login("vp2@example.test"),
    login("vp1@example.test"),
    login("department@example.test"),
    login("branch@example.test"),
    login("member@example.test"),
  ]);
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  const suffix = randomUUID();
  const rootName = `Құрылым сынағы ${suffix}`;
  const childName = `Ішкі бөлім сынағы ${suffix}`;
  const updatedChildName = `Өңделген ішкі бөлім ${suffix}`;
  const createRootReason = `Президент құрылым сынағы ${suffix}`;
  const createChildReason = `VP2 құрылым сынағы ${suffix}`;
  try {
    for (const cookie of [vp1Cookie, departmentCookie, branchCookie, memberCookie]) {
      const forbidden = await appRequest("/api/access/structure", {
        method: "POST",
        headers: { ...authHeaders(cookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          action: "create", nameKk: rootName, unitType: "Сынақ бөлімі", parentId: "",
          description: "Рұқсат шекарасын тексеру", reason: "Рұқсат етілмеуі керек",
        }),
      });
      assert.equal(forbidden.status, 403);
    }

    const createRoot = await appRequest("/api/access/structure", {
      method: "POST",
      headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: "create", nameKk: rootName, unitType: "Департамент", parentId: "",
        description: "Автоматтандырылған құрылым сынағы", reason: createRootReason,
      }),
    });
    assert.equal(createRoot.status, 303);
    assert.match(createRoot.headers.get("location") ?? "", /success=structure/);
    const root = await client.query("SELECT id, unit_type, parent_id FROM departments WHERE name_kk = $1 AND archived_at IS NULL", [rootName]);
    assert.equal(root.rowCount, 1);
    assert.deepEqual({ unit_type: root.rows[0].unit_type, parent_id: root.rows[0].parent_id }, { unit_type: "Департамент", parent_id: null });
    const rootId = root.rows[0].id;

    const duplicate = await appRequest("/api/access/structure", {
      method: "POST",
      headers: { ...authHeaders(vp2Cookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: "create", nameKk: rootName.toLocaleUpperCase("kk"), unitType: "Бөлім", parentId: "",
        description: "Қайталанатын атау", reason: "Қайталануды тексеру",
      }),
    });
    assert.equal(duplicate.status, 303);
    assert.match(duplicate.headers.get("location") ?? "", /error=structure-duplicate/);

    const createChild = await appRequest("/api/access/structure", {
      method: "POST",
      headers: { ...authHeaders(vp2Cookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: "create", nameKk: childName, unitType: "Бөлім", parentId: rootId,
        description: "Иерархия мен scope сынағы", reason: createChildReason,
      }),
    });
    assert.equal(createChild.status, 303);
    const child = await client.query("SELECT id, parent_id FROM departments WHERE name_kk = $1 AND archived_at IS NULL", [childName]);
    assert.equal(child.rowCount, 1);
    assert.equal(child.rows[0].parent_id, rootId);
    const childId = child.rows[0].id;

    const cycle = await appRequest("/api/access/structure", {
      method: "POST",
      headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: "update", departmentId: rootId, nameKk: rootName, unitType: "Департамент", parentId: childId,
        description: "Автоматтандырылған құрылым сынағы", reason: "Цикл қорғанысын тексеру",
      }),
    });
    assert.equal(cycle.status, 303);
    assert.match(cycle.headers.get("location") ?? "", /error=structure-cycle/);

    for (const scopeId of ["", "branch-almaty"]) {
      const invalidScope = await appRequest("/api/access/roles", {
        method: "POST",
        headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          action: "grant", userId: "user-member", roleId: "role-department-head", scopeId,
          reason: "Департамент scope қорғанысын тексеру",
        }),
      });
      assert.equal(invalidScope.status, 303);
      assert.match(invalidScope.headers.get("location") ?? "", /error=scope/);
    }

    const grantHead = await appRequest("/api/access/roles", {
      method: "POST",
      headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: "grant", userId: "user-member", roleId: "role-department-head", scopeId: childId,
        reason: "Нақты бөлім басшысын тағайындау сынағы",
      }),
    });
    assert.equal(grantHead.status, 303);
    const headAssignment = await client.query(`
      SELECT ur.id, ur.scope_type, ur.scope_id
      FROM user_roles ur
      WHERE ur.user_id = 'user-member' AND ur.role_id = 'role-department-head'
        AND ur.scope_id = $1 AND ur.revoked_at IS NULL
    `, [childId]);
    assert.equal(headAssignment.rowCount, 1);
    assert.deepEqual(
      { scope_type: headAssignment.rows[0].scope_type, scope_id: headAssignment.rows[0].scope_id },
      { scope_type: "department", scope_id: childId },
    );

    const assignProfessional = await appRequest("/api/access/departments", {
      method: "POST",
      headers: { ...authHeaders(vp2Cookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: "grant", personId: "person-president", departmentId: childId,
        reason: "Scoped кәсіби тізімді тексеру",
      }),
    });
    assert.equal(assignProfessional.status, 303);
    const personAssignment = await client.query(`
      SELECT id FROM person_department_assignments
      WHERE person_id = 'person-president' AND department_id = $1 AND ended_at IS NULL
    `, [childId]);
    assert.equal(personAssignment.rowCount, 1);

    const scopedProfessional = await appRequest("/dashboard/professional", { headers: authHeaders(memberCookie) });
    assert.equal(scopedProfessional.status, 200);
    assert.match(await scopedProfessional.text(), /Президент рөлі \(сынақ\)/);

    const inUseArchive = await appRequest("/api/access/structure", {
      method: "POST",
      headers: { ...authHeaders(vp2Cookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "archive", departmentId: childId, reason: "Белсенді байланыс қорғанысын тексеру" }),
    });
    assert.equal(inUseArchive.status, 303);
    assert.match(inUseArchive.headers.get("location") ?? "", /error=structure-in-use/);

    assert.equal((await appRequest("/api/access/roles", {
      method: "POST",
      headers: { ...authHeaders(vp2Cookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "revoke", assignmentId: headAssignment.rows[0].id, reason: "Құрылым сынағын аяқтау" }),
    })).status, 303);
    assert.equal((await appRequest("/api/access/departments", {
      method: "POST",
      headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "revoke", assignmentId: personAssignment.rows[0].id, reason: "Құрылым сынағын аяқтау" }),
    })).status, 303);

    const updateChildReason = `Құрылым атауын өңдеу ${suffix}`;
    assert.equal((await appRequest("/api/access/structure", {
      method: "POST",
      headers: { ...authHeaders(vp2Cookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: "update", departmentId: childId, nameKk: updatedChildName, unitType: "Секция", parentId: rootId,
        description: "Өңделген иерархиялық бөлім", reason: updateChildReason,
      }),
    })).status, 303);

    assert.equal((await appRequest("/api/access/structure", {
      method: "POST",
      headers: { ...authHeaders(vp2Cookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "archive", departmentId: childId, reason: "Ішкі бөлім сынағын аяқтау" }),
    })).status, 303);
    assert.equal((await appRequest("/api/access/structure", {
      method: "POST",
      headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "archive", departmentId: rootId, reason: "Негізгі бөлім сынағын аяқтау" }),
    })).status, 303);

    const archived = await client.query("SELECT id, archived_at FROM departments WHERE id IN ($1, $2) ORDER BY id", [rootId, childId]);
    assert.equal(archived.rowCount, 2);
    assert.ok(archived.rows.every((row) => row.archived_at));
    await assert.rejects(client.query("DELETE FROM departments WHERE id = $1", [childId]), /must be archived, not deleted/i);

    const audit = await client.query(`
      SELECT action_type, actor_user_id, previous_value, new_value, reason
      FROM audit_logs
      WHERE target_entity = 'organizational_unit' AND target_entity_id IN ($1, $2)
      ORDER BY created_at
    `, [rootId, childId]);
    assert.deepEqual(audit.rows.map((row) => row.action_type), [
      "organizational_unit.created",
      "organizational_unit.created",
      "organizational_unit.updated",
      "organizational_unit.archived",
      "organizational_unit.archived",
    ]);
    assert.equal(audit.rows[0].actor_user_id, "user-president");
    assert.equal(audit.rows[1].actor_user_id, "user-vp2");
    assert.equal(audit.rows[2].reason, updateChildReason);
    assert.ok(audit.rows[2].previous_value);
    assert.ok(audit.rows[2].new_value);
  } finally {
    await client.end();
  }
});

test("a new applicant keeps one account and complete Applicant to Reserve to Member history", async () => {
  const password = "ApplicantJourney2026!";
  const submitted = await submitApplication("almaty", { fullName: "Жаңа өтініш беруші", password });
  assert.ok(submitted.id);

  const applicantCookie = await login(submitted.email, password);
  const applicantDashboard = await appRequest("/dashboard", { headers: { cookie: applicantCookie } });
  assert.equal(applicantDashboard.status, 200);
  assert.match(await applicantDashboard.text(), /Үміткер/);

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const identity = await client.query(`
      SELECT u.id AS user_id, p.id AS person_id, p.user_id AS profile_user_id, p.membership_status, a.id AS application_id
      FROM users u
      JOIN person_profiles p ON p.user_id = u.id
      JOIN membership_applications a ON a.person_id = p.id
      WHERE u.email = $1
    `, [submitted.email]);
    assert.equal(identity.rowCount, 1);
    assert.equal(identity.rows[0].user_id, identity.rows[0].profile_user_id);
    assert.equal(identity.rows[0].application_id, submitted.id);
    assert.equal(identity.rows[0].membership_status, "applicant");
    const { user_id: userId, person_id: personId } = identity.rows[0];

    const duplicate = await postApplication("almaty", { email: submitted.email, password, fullName: "Қайталанған профиль" });
    assert.equal(duplicate.response.status, 409);
    assert.match(await duplicate.response.text(), /Бұл электрондық пошта тіркелген/);
    const identityCounts = await client.query("SELECT (SELECT COUNT(*) FROM users WHERE email = $1)::int AS users, (SELECT COUNT(*) FROM person_profiles WHERE email = $1)::int AS profiles", [submitted.email]);
    assert.deepEqual(identityCounts.rows[0], { users: 1, profiles: 1 });

    const branchCookie = await login("branch@example.test");
    const reserveReason = "Кәсіби портфолионы толықтыру қажет";
    const approveReason = "Қажетті кәсіби мәлімет толықтырылды";
    assert.equal((await appRequest(`/api/applications/${submitted.id}/decision`, {
      method: "POST",
      headers: { cookie: branchCookie, origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ decision: "reserve", reason: reserveReason }),
    })).status, 303);

    const reserveCookie = await login(submitted.email, password);
    const reserveProfile = await appRequest("/dashboard/profile", { headers: { cookie: reserveCookie } });
    assert.equal(reserveProfile.status, 200);
    const reserveProfileHtml = await reserveProfile.text();
    assert.match(reserveProfileHtml, /Резерв/);
    assert.doesNotMatch(reserveProfileHtml, new RegExp(reserveReason));

    assert.equal((await appRequest(`/api/applications/${submitted.id}/decision`, {
      method: "POST",
      headers: { cookie: branchCookie, origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ decision: "approved", reason: approveReason }),
    })).status, 303);

    const memberCookie = await login(submitted.email, password);
    const memberProfile = await appRequest("/dashboard/profile", { headers: { cookie: memberCookie } });
    assert.equal(memberProfile.status, 200);
    const memberProfileHtml = await memberProfile.text();
    assert.match(memberProfileHtml, /Мүше/);
    assert.doesNotMatch(memberProfileHtml, new RegExp(`${reserveReason}|${approveReason}`));
    assert.equal((await appRequest("/dashboard/applications", { headers: { cookie: memberCookie } })).status, 404);

    const finalIdentity = await client.query(`
      SELECT p.membership_status, a.status AS application_status,
        (SELECT COUNT(*)::int FROM users WHERE id = $1) AS user_count,
        (SELECT COUNT(*)::int FROM person_profiles WHERE id = $2 AND user_id = $1) AS profile_count,
        (SELECT COUNT(*)::int FROM membership_applications WHERE id = $3 AND person_id = $2) AS application_count,
        (SELECT COUNT(*)::int FROM user_roles WHERE user_id = $1 AND role_id = 'role-member' AND revoked_at IS NULL) AS member_role_count
      FROM person_profiles p
      JOIN membership_applications a ON a.person_id = p.id
      WHERE p.id = $2 AND a.id = $3
    `, [userId, personId, submitted.id]);
    assert.deepEqual(finalIdentity.rows[0], { membership_status: "member", application_status: "approved", user_count: 1, profile_count: 1, application_count: 1, member_role_count: 1 });

    const history = await client.query(`
      SELECT previous_status, new_status, reason, changed_by, created_at
      FROM membership_status_history
      WHERE application_id = $1
      ORDER BY created_at ASC
    `, [submitted.id]);
    assert.deepEqual(history.rows.map(({ previous_status, new_status }) => [previous_status, new_status]), [
      ["registered_user", "applicant"],
      ["applicant", "reserve"],
      ["reserve", "member"],
    ]);
    assert.deepEqual(history.rows.map((row) => row.changed_by), [userId, "user-branch-director", "user-branch-director"]);
    assert.deepEqual(history.rows.map((row) => row.reason), ["Өтініш қабылданды", reserveReason, approveReason]);
    assert.ok(history.rows.every((row) => row.created_at instanceof Date));

    const audit = await client.query("SELECT action_type, previous_value, new_value FROM audit_logs WHERE actor_user_id IN ($1, 'user-branch-director') AND target_entity_id IN ($1, $2) ORDER BY created_at", [userId, submitted.id]);
    const auditActions = audit.rows.map((row) => row.action_type);
    for (const action of ["account.registered", "application.submitted", "application.reserve", "application.approved"]) assert.ok(auditActions.includes(action), `missing audit action ${action}`);

    const branchHistory = await appRequest(`/dashboard/applications/${submitted.id}`, { headers: { cookie: branchCookie } });
    assert.equal(branchHistory.status, 200);
    const branchHistoryHtml = await branchHistory.text();
    assert.match(branchHistoryHtml, /Тіркелген пайдаланушы → (?:<!-- -->)?Үміткер/);
    assert.match(branchHistoryHtml, /Үміткер → (?:<!-- -->)?Резерв/);
    assert.match(branchHistoryHtml, /Резерв → (?:<!-- -->)?Мүше/);
    assert.match(branchHistoryHtml, new RegExp(reserveReason));
    assert.match(branchHistoryHtml, new RegExp(approveReason));
    assert.match(branchHistoryHtml, /\d{1,2} (қаңтар|ақпан|наурыз|сәуір|мамыр|маусым|шілде|тамыз|қыркүйек|қазан|қараша|желтоқсан) 20\d{2} ж\., \d{2}:\d{2}/);
    assert.doesNotMatch(branchHistoryHtml, /янв\.|февр\.|мар\.|апр\.|мая|июн\.|июл\.|авг\.|сент\.|окт\.|нояб\.|дек\.|\d{4} г\./i);
  } finally {
    await client.end();
  }
});

test("President can reopen a rejected application without erasing the original decision", async () => {
  const submitted = await submitApplication("almaty", { fullName: "Қайта қарау сынағы", password: "ReopenJourney2026!" });
  const [branchCookie, presidentCookie] = await Promise.all([
    login("branch@example.test"),
    login("president@example.test"),
  ]);
  const rejectionReason = "Өтініш қате шешіммен қабылданбады";
  const reopenReason = "Қате басылған шешімді қайта қарау қажет";
  const lookupClient = new pg.Client({ connectionString: DATABASE_URL });
  await lookupClient.connect();
  const personId = (await lookupClient.query("SELECT person_id FROM membership_applications WHERE id = $1", [submitted.id])).rows[0].person_id;
  await lookupClient.end();

  assert.equal((await appRequest(`/api/applications/${submitted.id}/decision`, {
    method: "POST",
    headers: { ...authHeaders(branchCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ decision: "rejected", reason: rejectionReason }),
  })).status, 303);

  const branchPage = await appRequest(`/dashboard/applications/${submitted.id}`, { headers: authHeaders(branchCookie) });
  assert.equal(branchPage.status, 200);
  const branchHtml = visibleMarkup(await branchPage.text());
  assert.doesNotMatch(branchHtml, /Қайта қарауға қайтару|Толық профильді ашу/);
  assert.equal((await appRequest(`/dashboard/members/${personId}`, { headers: authHeaders(presidentCookie) })).status, 404);
  const rejectedMemberList = visibleMarkup(await (await appRequest("/dashboard/members", { headers: authHeaders(presidentCookie) })).text());
  assert.doesNotMatch(rejectedMemberList, new RegExp(submitted.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal((await appRequest(`/api/applications/${submitted.id}/reopen`, {
    method: "POST",
    headers: { ...authHeaders(branchCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ reason: reopenReason }),
  })).status, 403);

  const presidentPage = await appRequest(`/dashboard/applications/${submitted.id}`, { headers: authHeaders(presidentCookie) });
  assert.equal(presidentPage.status, 200);
  assert.match(visibleMarkup(await presidentPage.text()), /Қайта қарауға қайтару/);
  const reopened = await appRequest(`/api/applications/${submitted.id}/reopen`, {
    method: "POST",
    headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ reason: reopenReason }),
  });
  assert.equal(reopened.status, 303);
  assert.match(reopened.headers.get("location") ?? "", /success=reopened/);

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const current = await client.query(`
      SELECT a.status AS application_status, a.reviewed_at, a.reviewed_by, a.decision_reason,
        p.membership_status
      FROM membership_applications a
      JOIN person_profiles p ON p.id = a.person_id
      WHERE a.id = $1
    `, [submitted.id]);
    assert.deepEqual(current.rows[0], {
      application_status: "awaiting_review",
      reviewed_at: null,
      reviewed_by: null,
      decision_reason: null,
      membership_status: "applicant",
    });

    const history = await client.query(`
      SELECT previous_status, new_status, reason
      FROM membership_status_history
      WHERE application_id = $1
      ORDER BY created_at
    `, [submitted.id]);
    assert.deepEqual(history.rows.slice(-2).map((row) => [row.previous_status, row.new_status, row.reason]), [
      ["applicant", "rejected", rejectionReason],
      ["rejected", "applicant", reopenReason],
    ]);

    const audit = await client.query(`
      SELECT previous_value, new_value, reason
      FROM audit_logs
      WHERE action_type = 'application.reopened' AND target_entity_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [submitted.id]);
    assert.equal(audit.rowCount, 1);
    assert.equal(JSON.parse(audit.rows[0].previous_value).decisionReason, rejectionReason);
    assert.deepEqual(JSON.parse(audit.rows[0].new_value), { applicationStatus: "awaiting_review", membershipStatus: "applicant" });
    assert.equal(audit.rows[0].reason, reopenReason);
  } finally {
    await client.end();
  }

  const reviewPage = await appRequest(`/dashboard/applications/${submitted.id}`, { headers: authHeaders(presidentCookie) });
  const reviewHtml = visibleMarkup(await reviewPage.text());
  assert.match(reviewHtml, /Өтінішті бағалау/);
  assert.match(reviewHtml, new RegExp(rejectionReason));
  assert.match(reviewHtml, new RegExp(reopenReason));
  assert.doesNotMatch(reviewHtml, /Қайта қарауға қайтару/);
  assert.equal((await appRequest(`/dashboard/members/${personId}`, { headers: authHeaders(presidentCookie) })).status, 200);
  const restoredMemberList = visibleMarkup(await (await appRequest("/dashboard/members", { headers: authHeaders(presidentCookie) })).text());
  assert.match(restoredMemberList, new RegExp(submitted.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("President can permanently erase another account regardless of membership status", async () => {
  const submitted = await postApplication("almaty", { withDocument: true, ip: `erase-${randomUUID()}` });
  assert.equal(submitted.response.status, 200, await submitted.response.clone().text());
  const applicationId = (await submitted.response.json()).applicationId;
  const [presidentCookie, branchCookie] = await Promise.all([
    login("president@example.test"),
    login("branch@example.test"),
  ]);
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const before = await client.query(`
      SELECT p.id AS person_id, p.user_id, d.object_key
      FROM person_profiles p
      JOIN uploaded_documents d ON d.owner_person_id = p.id
      WHERE p.email = $1
      LIMIT 1
    `, [submitted.email]);
    assert.equal(before.rowCount, 1);
    const { person_id: personId, user_id: userId, object_key: objectKey } = before.rows[0];

    const approve = await appRequest(`/api/applications/${applicationId}/decision`, {
      method: "POST",
      headers: { ...authHeaders(branchCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ decision: "approved", reason: "Өшіру алдындағы толық мүше мәртебесі" }),
    });
    assert.equal(approve.status, 303);

    const listPage = await appRequest("/dashboard/members?membershipStatus=member", { headers: authHeaders(presidentCookie) });
    const listHtml = visibleMarkup(await listPage.text());
    assert.match(listHtml, new RegExp(submitted.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(listHtml, /Біржола өшіру/);

    const forbidden = await appRequest(`/api/members/${personId}/erase`, {
      method: "POST",
      headers: { ...authHeaders(branchCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ confirmation: "ӨШІРУ", reason: "Қажет емес сынақ аккаунты" }),
    });
    assert.equal(forbidden.status, 403);

    const unconfirmed = await appRequest(`/api/members/${personId}/erase`, {
      method: "POST",
      headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ confirmation: "өшіру", reason: "Қажет емес сынақ аккаунты" }),
    });
    assert.equal(unconfirmed.status, 303);
    assert.match(unconfirmed.headers.get("location") ?? "", /error=confirmation/);

    const erased = await appRequest(`/api/members/${personId}/erase`, {
      method: "POST",
      headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ confirmation: "ӨШІРУ", reason: "Қажет емес сынақ аккаунты" }),
    });
    assert.equal(erased.status, 303);
    assert.match(erased.headers.get("location") ?? "", /success=erased/);

    const profile = await client.query("SELECT full_name, email, phone, membership_status, branch_id, archived_at FROM person_profiles WHERE id = $1", [personId]);
    assert.equal(profile.rows[0].full_name, "Өшірілген аккаунт");
    assert.notEqual(profile.rows[0].email, submitted.email);
    assert.equal(profile.rows[0].phone, "");
    assert.equal(profile.rows[0].membership_status, "erased");
    assert.equal(profile.rows[0].branch_id, null);
    assert.ok(profile.rows[0].archived_at);
    const account = await client.query("SELECT email, password_hash, status, archived_at FROM users WHERE id = $1", [userId]);
    assert.notEqual(account.rows[0].email, submitted.email);
    assert.equal(account.rows[0].password_hash, null);
    assert.equal(account.rows[0].status, "erased");
    assert.ok(account.rows[0].archived_at);
    const application = await client.query("SELECT status, joining_purpose, decision_reason, archived_at FROM membership_applications WHERE id = $1", [applicationId]);
    assert.deepEqual(application.rows[0], { status: "erased", joining_purpose: null, decision_reason: null, archived_at: application.rows[0].archived_at });
    assert.ok(application.rows[0].archived_at);
    assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM membership_application_drafts WHERE person_id = $1", [personId])).rows[0].count, 0);
    assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM uploaded_documents WHERE owner_person_id = $1", [personId])).rows[0].count, 0);
    assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM private_objects WHERE object_key = $1", [objectKey])).rows[0].count, 0);
    assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM audit_logs WHERE action_type = 'person.erased' AND target_entity_id = $1", [personId])).rows[0].count, 1);
    assert.equal((await appRequest(`/dashboard/members/${personId}`, { headers: authHeaders(presidentCookie) })).status, 404);
    assert.equal((await appRequest(`/dashboard/applications/${applicationId}`, { headers: authHeaders(presidentCookie) })).status, 404);

    const selfErase = await appRequest("/api/members/person-president/erase", {
      method: "POST",
      headers: { ...authHeaders(presidentCookie), origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ confirmation: "ӨШІРУ", reason: "Өзін-өзі өшіруден қорғау сынағы" }),
    });
    assert.equal(selfErase.status, 303);
    assert.match(selfErase.headers.get("location") ?? "", /error=self/);

    const loginAfterErase = await appRequest("/api/auth/login", {
      method: "POST",
      headers: { origin: "http://localhost", "cf-connecting-ip": `erased-login-${randomUUID()}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: submitted.email, password: submitted.password }),
    });
    assert.equal(loginAfterErase.status, 303);
    assert.match(loginAfterErase.headers.get("location") ?? "", /error=credentials/);
  } finally {
    await client.end();
  }
});

test("D1, R2, and Drizzle integrations are absent and storage remains provider-abstracted", async () => {
  const [packageJson, hosting, vite, database, storageContract, applicationRoute, uploadRoute, downloadRoute, profileRoute] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/storage/private-object-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/applications/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/application-drafts/documents/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/documents/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8"),
  ]);
  const legacyPattern = /drizzle|D1Database|R2Bucket|PRIVATE_DOCUMENTS|d1_databases|r2_buckets/i;
  for (const source of [packageJson, hosting, vite, database, applicationRoute, uploadRoute, downloadRoute]) assert.doesNotMatch(source, legacyPattern);
  assert.match(database, /PrismaPg/);
  assert.match(storageContract, /interface PrivateObjectStorage/);
  assert.match(uploadRoute, /getPrivateObjectStorage/);
  assert.match(downloadRoute, /getPrivateObjectStorage/);
  assert.doesNotMatch(profileRoute, /membershipStatus|branchId|membershipStartedAt/);
  assert.match(profileRoute, /profile\.self_updated/);
  assert.match(profileRoute, /auditLog\.create/);
});

test("dashboard drill-downs use reliable browser-native navigation", async () => {
  const paths = [
    "../app/dashboard/page.tsx",
    "../app/dashboard/applications/page.tsx",
    "../app/dashboard/applications/[id]/page.tsx",
    "../app/dashboard/branches/page.tsx",
    "../app/dashboard/members/page.tsx",
    "../app/dashboard/members/[id]/page.tsx",
    "../app/dashboard/document-requests/page.tsx",
  ];
  const sources = await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  for (const source of sources) assert.doesNotMatch(source, /from ["']next\/link["']/);
  assert.match(sources[1], /const href = application\.applicationId/);
});

test("overview drill-downs, member profiles, safe archival, and controlled document removal work end to end", async () => {
  const [presidentCookie, branchCookie, memberCookie, applicantCookie] = await Promise.all([
    login("president@example.test"),
    login("branch@example.test"),
    login("member@example.test"),
    login("applicant@example.test"),
  ]);

  const overview = await appRequest("/dashboard", { headers: authHeaders(presidentCookie) });
  const overviewHtml = visibleMarkup(await overview.text());
  assert.equal(overview.status, 200);
  assert.match(overviewHtml, /\/dashboard\/applications\?status=registered_user/);
  assert.match(overviewHtml, /\/dashboard\/applications\?status=applicant/);
  assert.match(overviewHtml, /\/dashboard\/branches\//);

  assert.equal((await appRequest("/dashboard/members/person-member", { headers: authHeaders(presidentCookie) })).status, 200);
  assert.equal((await appRequest("/dashboard/members/person-member", { headers: authHeaders(branchCookie) })).status, 200);
  assert.equal((await appRequest("/dashboard/members/person-reserve", { headers: authHeaders(branchCookie) })).status, 404);
  assert.equal((await appRequest("/dashboard/members/person-member", { headers: authHeaders(memberCookie) })).status, 404);

  const standaloneName = `standalone-${randomUUID()}.pdf`;
  const standaloneBody = new FormData();
  standaloneBody.append("document", new File(["%PDF-1.7\nstandalone-removal"], standaloneName, { type: "application/pdf" }));
  const standaloneUpload = await appRequest("/api/profile/documents", {
    method: "POST", headers: { origin: "http://localhost", cookie: memberCookie, accept: "application/json" }, body: standaloneBody,
  });
  assert.equal(standaloneUpload.status, 200, await standaloneUpload.clone().text());
  const standaloneDocument = (await standaloneUpload.json()).documents.find((document) => document.originalName === standaloneName);
  assert.ok(standaloneDocument?.id);
  const standaloneDelete = await appRequest(`/api/profile/documents/${standaloneDocument.id}`, {
    method: "DELETE", headers: { origin: "http://localhost", cookie: memberCookie, accept: "application/json" },
  });
  assert.equal(standaloneDelete.status, 200, await standaloneDelete.text());

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const documentId = randomUUID();
    const objectKey = `tests/removal-request/${documentId}`;
    await client.query("INSERT INTO private_objects (object_key, body, updated_at) VALUES ($1, $2, NOW())", [objectKey, Buffer.from("%PDF-1.7\ncontrolled-removal")]);
    await client.query(`
      INSERT INTO uploaded_documents (
        id, owner_person_id, application_id, uploaded_by, object_key, original_name,
        mime_type, size_bytes, checksum_sha256, visibility, status, updated_at
      ) VALUES ($1, 'person-applicant', 'application-awaiting', 'user-applicant', $2, $3, 'application/pdf', 28, $4, 'reviewers', 'active', NOW())
    `, [documentId, objectKey, `submitted-${documentId}.pdf`, createHash("sha256").update("controlled-removal").digest("hex")]);

    const requestRemoval = () => appRequest(`/api/documents/${documentId}/removal-request`, {
      method: "POST",
      headers: { origin: "http://localhost", cookie: applicantCookie, accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ reason: "Қате құжат тіркелді" }),
    });
    assert.equal((await requestRemoval()).status, 200);
    assert.equal((await client.query("SELECT status FROM uploaded_documents WHERE id = $1", [documentId])).rows[0].status, "removal_requested");
    assert.equal((await appRequest(`/api/documents/${documentId}/removal-decision`, {
      method: "POST", headers: { origin: "http://localhost", cookie: branchCookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ decision: "approve", reason: "Рұқсат берілмеуі керек" }),
    })).status, 403);
    assert.equal((await appRequest(`/api/documents/${documentId}/removal-decision`, {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ decision: "reject", reason: "Құжат дұрыс тіркелген" }),
    })).status, 303);
    assert.equal((await client.query("SELECT status FROM uploaded_documents WHERE id = $1", [documentId])).rows[0].status, "active");
    assert.equal((await requestRemoval()).status, 200);
    assert.equal((await appRequest(`/api/documents/${documentId}/removal-decision`, {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ decision: "approve", reason: "Қате құжатты қауіпсіз архивтеу" }),
    })).status, 303);
    const archivedDocument = await client.query("SELECT status, archived_at FROM uploaded_documents WHERE id = $1", [documentId]);
    assert.equal(archivedDocument.rows[0].status, "archived");
    assert.ok(archivedDocument.rows[0].archived_at);
    assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM private_objects WHERE object_key = $1", [objectKey])).rows[0].count, 0);

    const archiveCandidate = await postApplication("almaty", { withDocument: false, ip: `archive-${randomUUID()}` });
    assert.equal(archiveCandidate.response.status, 200, await archiveCandidate.response.clone().text());
    const applicationId = (await archiveCandidate.response.json()).applicationId;
    const profile = await client.query("SELECT id, user_id FROM person_profiles WHERE email = $1", [archiveCandidate.email]);
    const profileId = profile.rows[0].id;
    const archiveResponse = await appRequest(`/api/members/${profileId}/archive`, {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ reason: "Сынақ аккаунтын тізімнен шығару" }),
    });
    assert.equal(archiveResponse.status, 303);
    assert.match(archiveResponse.headers.get("location") ?? "", /\/dashboard\/members\?success=archived/);
    const archivedProfile = await client.query("SELECT archived_at FROM person_profiles WHERE id = $1", [profileId]);
    const archivedUser = await client.query("SELECT status, archived_at FROM users WHERE id = $1", [profile.rows[0].user_id]);
    const archivedApplication = await client.query("SELECT archived_at FROM membership_applications WHERE id = $1", [applicationId]);
    assert.ok(archivedProfile.rows[0].archived_at);
    assert.equal(archivedUser.rows[0].status, "archived");
    assert.ok(archivedUser.rows[0].archived_at);
    assert.ok(archivedApplication.rows[0].archived_at);
    assert.equal((await appRequest(`/dashboard/members/${profileId}`, { headers: authHeaders(presidentCookie) })).status, 404);
    assert.equal((await appRequest(`/dashboard/applications/${applicationId}`, { headers: authHeaders(presidentCookie) })).status, 404);

    const protectedArchive = await appRequest("/api/members/person-vp2/archive", {
      method: "POST", headers: { origin: "http://localhost", cookie: presidentCookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ reason: "Қорғалған аккаунт сынағы" }),
    });
    assert.equal(protectedArchive.status, 303);
    assert.match(protectedArchive.headers.get("location") ?? "", /error=protected/);
  } finally {
    await client.end();
  }
});
