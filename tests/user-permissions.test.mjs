import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
// Compile the actual server modules, replacing only external services with fixtures.
function load(path, deps = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)((id) => Object.hasOwn(deps, id) ? deps[id] : require(id), module, module.exports);
  return module.exports;
}
const permissions = load("lib/permissions.ts");
const { canAccessPath, canAccessITTools, parseUserPermissionUpdate, FEATURE_PATHS } = permissions;

test("select all covers every internal sidebar entry", () => {
  const { ALL_SIDEBAR_ITEMS } = load("app/components/sidebar/sidebarMenu.tsx");
  for (const item of ALL_SIDEBAR_ITEMS.filter((i) => i.href.startsWith("/"))) {
    assert.equal(canAccessPath("USER", item.href, Object.keys(FEATURE_PATHS)), true, item.href);
  }
});

test("custom grants replace even ADMIN defaults, match both page/API, and do not leak into sibling paths", () => {
  assert.equal(canAccessPath("ADMIN", "/api/population-report", ["REPORT"]), false);
  for (const path of ["/pages/icd10-report", "/api/icd10-report", "/api/icd10-report/diseases"]) assert.equal(canAccessPath("USER", path, ["REPORT"]), true);
  assert.equal(canAccessPath("USER", "/api/icd10-report-private", ["REPORT"]), false);
  assert.equal(canAccessPath("ADMIN", "/api/report", []), false);
  assert.equal(canAccessPath("ADMIN", "/pages/access-denied", []), true);
  assert.equal(canAccessPath("ADMIN", "/pages/settings", []), true);
  for (const path of Object.values(FEATURE_PATHS).flat()) assert.equal(canAccessPath("USER", path, Object.keys(FEATURE_PATHS)), true);
});

test("all report grants cannot escalate into managing users; only IT can manage", () => {
  for (const role of ["USER", "ADMIN", "DOCTOR", "DIRECTOR"]) {
    for (const path of ["/pages/user-permissions", "/api/user-permissions"]) assert.equal(canAccessPath(role, path, Object.keys(FEATURE_PATHS)), false);
  }
  assert.equal(canAccessPath(" it ", "/api/user-permissions", []), true);
  assert.equal(canAccessITTools("USER", ["IT_TOOLS"]), true);
  assert.equal(canAccessITTools("ADMIN", []), false);
});

test("permission payload validation rejects unknown grants, malformed revisions, missing fields and IT restrictions", () => {
  const valid = { username: "target", role: " user ", features: ["REPORT", "REPORT"], revision: 0 };
  assert.deepEqual(parseUserPermissionUpdate(valid), { username: "target", role: "USER", features: ["REPORT"], revision: 0 });
  for (const change of [{ role: "" }, { role: "invalid" }, { username: "" }, { features: ["__proto__"] }, { features: undefined }, { features: "*" }, { revision: -1 }, { revision: 0.5 }, { revision: "0" }, { role: "IT", features: [] }]) {
    assert.throws(() => parseUserPermissionUpdate({ ...valid, ...change }));
  }
});

function sessionFixture() {
  const state = { role: "ADMIN", grant: null, deleted: false, unavailable: false, missingTable: false };
  const db = { query: async (sql) => {
    if (state.unavailable) throw new Error("db offline");
    if (sql.includes("ppchos.users")) return [state.deleted ? [] : [{ user: "target", name: "Test", role: state.role }]];
    if (state.missingTable) throw Object.assign(new Error("missing"), { code: "ER_NO_SUCH_TABLE" });
    return [state.grant ? [state.grant] : []];
  } };
  const access = load("lib/user-access.ts", {
    "@/lib/db": { db2: db }, "@/lib/permissions": permissions,
    jose: { jwtVerify: async (token) => { if (token !== "old-admin-token") throw new Error("invalid"); return { payload: { username: "target", role: "ADMIN" } }; } },
  });
  return { state, access };
}

test("old tokens follow live role/grant changes; deleted accounts and corrupt grants fail closed", async () => {
  const { state, access } = sessionFixture();
  assert.equal((await access.sessionAccess("old-admin-token")).role, "ADMIN");
  state.grant = { role_override: "USER", features_json: "[]", revision: 1 };
  let user = await access.sessionAccess("old-admin-token");
  assert.equal(user.role, "USER");
  assert.equal(canAccessPath(user.role, "/api/report", user.features), false);
  state.grant = { role_override: "ADMIN", features_json: "broken json", revision: 2 };
  user = await access.sessionAccess("old-admin-token");
  assert.equal(canAccessPath(user.role, "/api/report", user.features), false);
  state.deleted = true;
  assert.equal(await access.sessionAccess("old-admin-token"), null);
  state.deleted = false; state.unavailable = true;
  await assert.rejects(access.sessionAccess("old-admin-token"));
  assert.equal(await access.sessionAccess("bad-token"), null);
});

test("installations without the optional grants table keep existing role access", async () => {
  const { state, access } = sessionFixture();
  state.missingTable = true;
  const user = await access.sessionAccess("old-admin-token");
  assert.equal(user.role, "ADMIN");
  assert.equal(user.features, null);
});

function apiFixture(actorRole = "IT") {
  const users = { operator: { user: "operator", name: "IT User", role: "IT" }, target: { user: "target", name: "Test Person", role: "USER" } };
  const state = { grants: {}, writes: 0, releases: 0, failSave: false, sessionRole: actorRole, lockedActorRole: null };
  let draft;
  const conn = {
    beginTransaction: async () => { draft = structuredClone(state.grants); },
    query: async (sql, params) => {
      if (sql.startsWith("INSERT IGNORE")) {
        draft[params[0]] ??= { username: params[0], role_override: state.lockedActorRole, features_json: null, revision: 0 };
        return [{}];
      }
      if (sql.startsWith("SELECT") && sql.includes("ppchos.users")) return [users[params[0]] ? [users[params[0]]] : []];
      if (sql.startsWith("SELECT")) return [draft[params[0]] ? [draft[params[0]]] : []];
      if (state.failSave) throw new Error("write failure");
      const [username, role_override, features_json, revision, updated_by] = params;
      draft[username] = { username, role_override, features_json, revision, updated_by };
      return [{}];
    },
    commit: async () => { state.grants = draft; state.writes++; },
    rollback: async () => { draft = null; },
    release: () => { state.releases++; },
  };
  const access = {
    ensureAccessTable: async () => {}, decodeFeatures: JSON.parse,
    sessionAccess: async () => state.sessionRole ? { username: "operator", role: state.sessionRole } : null,
  };
  const route = load("app/api/user-permissions/route.ts", {
    "@/lib/db": { db2: { getConnection: async () => conn } },
    "@/lib/user-access": access, "@/lib/permissions": permissions,
  });
  const patch = (body, origin = "http://hospital.test") => route.PATCH(new NextRequest("http://hospital.test/api/user-permissions", {
    method: "PATCH", headers: { origin, host: "hospital.test", "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  return { state, patch, route };
}
const edit = { username: "target", role: "ADMIN", features: ["PRIMARY_CARE"], revision: 0 };

test("management API rejects anonymous, non-IT and cross-origin writes without mutation", async () => {
  for (const role of [null, "USER", "ADMIN"]) {
    const f = apiFixture(role);
    assert.equal((await f.patch(edit)).status, role ? 403 : 401);
    assert.equal((await f.route.GET(new NextRequest("http://hospital.test/api/user-permissions"))).status, role ? 403 : 401);
    assert.equal(f.state.writes, 0);
  }
  const f = apiFixture();
  assert.equal((await f.patch(edit, "http://untrusted.test")).status, 403);
  assert.equal(f.state.writes, 0);
});

test("user search is parameterized, paginated, returns live overrides and never returns passwords", async () => {
  const calls = [];
  const route = load("app/api/user-permissions/route.ts", {
    "@/lib/permissions": permissions,
    "@/lib/user-access": { sessionAccess: async () => ({ username: "operator", role: "IT" }), ensureAccessTable: async () => {}, decodeFeatures: JSON.parse },
    "@/lib/db": { db2: { query: async (sql, args) => {
      calls.push({ sql, args });
      if (sql.includes("COUNT")) return [[{ total: 80 }]];
      if (sql.includes("ppchos.users")) return [[{ user: "target", name: "Test", role: "ADMIN", passweb: "private-hash" }]];
      return [[{ username: "target", role_override: "USER", features_json: "[]", revision: 7 }]];
    } } },
  });
  const response = await route.GET(new NextRequest("http://hospital.test/api/user-permissions?search=a%25_b&page=2"));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.total, 80);
  assert.deepEqual(result.users, [{ username: "target", name: "Test", role: "USER", features: [], revision: 7 }]);
  assert.deepEqual(calls[1].args, ["%a!%!_b%", "%a!%!_b%", 50]);
  assert.equal(JSON.stringify(result).includes("private-hash"), false);
  assert.equal(calls[1].sql.includes("a%_b"), false);
});

test("saving persists role and custom features atomically and rejects stale editors", async () => {
  const f = apiFixture();
  let response = await f.patch(edit);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual((await response.json()).user.features, ["PRIMARY_CARE"]);
  assert.equal(f.state.grants.target.role_override, "ADMIN");
  assert.equal(f.state.grants.target.updated_by, "operator");
  assert.equal(f.state.grants.target.revision, 1);
  assert.equal((await f.patch(edit)).status, 409);
  assert.equal(f.state.writes, 1);
  response = await f.patch({ ...edit, revision: 1, features: null });
  assert.equal(response.status, 200);
  assert.equal(f.state.grants.target.features_json, null);
  assert.equal(f.state.releases, 3);
});

test("save rollback, missing users, self-demotion and concurrently removed IT privileges are enforced", async () => {
  const f = apiFixture();
  assert.equal((await f.patch({ ...edit, username: "missing" })).status, 404);
  assert.equal((await f.patch({ ...edit, username: "operator" })).status, 400);
  f.state.failSave = true;
  assert.equal((await f.patch(edit)).status, 503);
  assert.deepEqual(f.state.grants, {});
  f.state.failSave = false; f.state.lockedActorRole = "USER";
  assert.equal((await f.patch(edit)).status, 403);
  assert.equal(f.state.writes, 0);
});

test("proxy blocks revoked data access with an existing cookie and does not loop on denied pages", async () => {
  let current = { role: "USER", features: [] };
  const { proxy } = load("proxy.ts", { "@/lib/permissions": permissions, "@/lib/user-access": { sessionAccess: async () => current } });
  const request = (path) => new NextRequest(`http://hospital.test${path}`, { headers: { cookie: "token=old-admin-token" } });
  assert.equal((await proxy(request("/api/population-report"))).status, 403);
  const denied = await proxy(request("/pages/population-report"));
  assert.equal(new URL(denied.headers.get("location")).pathname, "/pages/access-denied");
  assert.equal((await proxy(request("/pages/access-denied"))).status, 200);
  current = { role: "USER", features: ["PRIMARY_CARE"] };
  assert.equal((await proxy(request("/api/population-report"))).status, 200);
  current = null;
  assert.equal((await proxy(request("/api/population-report"))).status, 401);
});
