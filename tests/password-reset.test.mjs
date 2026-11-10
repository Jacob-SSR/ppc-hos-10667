import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const bcrypt = require("bcrypt");
function load(path, deps = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)((id) => Object.hasOwn(deps, id) ? deps[id] : require(id), loaded, loaded.exports);
  return loaded.exports;
}
const permissions = load("lib/permissions.ts");
const passwords = load("lib/password-reset.ts");
const input = { username: "target", newPassword: "new-secret-123" };

function fixture(role = "IT", realHash = false) {
  const state = { role, lockedRole: "IT", missing: false, failAudit: false, limited: false, writes: 0, releases: 0, password: "old-hash", audits: [], hashCalls: 0 };
  let draft;
  const conn = {
    beginTransaction: async () => { draft = { password: state.password, audits: [...state.audits] }; },
    query: async (sql, args) => {
      if (sql.startsWith("INSERT IGNORE")) return [{}];
      if (sql.includes("SELECT role_override")) return [[{ role_override: state.lockedRole }]];
      if (sql.includes("SELECT") && sql.includes("ppchos.users")) {
        return [args[0] === "operator" ? [{ user: "operator", role: "IT" }] : state.missing ? [] : [{ user: "target", role: "USER" }]];
      }
      if (sql.startsWith("UPDATE")) { draft.password = args[0]; return [{}]; }
      if (sql.startsWith("INSERT INTO ppchos.password_reset_audit")) {
        if (state.failAudit) throw new Error("audit unavailable");
        draft.audits.push(args); return [{}];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    commit: async () => { state.password = draft.password; state.audits = draft.audits; state.writes++; },
    rollback: async () => { draft = null; },
    release: () => { state.releases++; },
  };
  const route = load("app/api/user-permissions/reset-password/route.ts", {
    "@/lib/db": { db2: { query: async () => [[]], getConnection: async () => conn } },
    "@/lib/permissions": permissions,
    "@/lib/password-reset": passwords,
    "@/lib/user-access": { ensureAccessTable: async () => {}, sessionAccess: async () => state.role ? { username: "operator", role: state.role } : null },
    "@/lib/rateLimit": { rateLimit: async () => ({ ok: !state.limited, retryAfterSec: 30 }) },
    bcrypt: { hash: async (value, cost) => { state.hashCalls++; assert.equal(cost, 12); return realHash ? bcrypt.hash(value, cost) : "hashed-value"; } },
  });
  const post = (body = input, origin = "http://hospital.test") => route.POST(new NextRequest("http://hospital.test/api/user-permissions/reset-password", {
    method: "POST", headers: { origin, host: "hospital.test", "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  return { state, post, route };
}

test("reset path is restricted to IT even with every report grant", () => {
  for (const role of ["USER", "ADMIN", "DOCTOR", "GUEST"]) assert.equal(permissions.canAccessPath(role, "/api/user-permissions/reset-password", Object.keys(permissions.FEATURE_PATHS)), false);
  assert.equal(permissions.canAccessPath(" it ", "/api/user-permissions/reset-password", []), true);
});

test("rejects missing, malformed, too short and bcrypt-truncated passwords", () => {
  for (const body of [null, [], {}, { ...input, username: "" }, { ...input, newPassword: 123456 }, { ...input, newPassword: "short" }, { ...input, newPassword: " secret " }, { ...input, newPassword: "a".repeat(73) }, { ...input, newPassword: "ก".repeat(25) }, { ...input, newPassword: "abc\0def" }]) assert.throws(() => passwords.parsePasswordReset(body));
  assert.deepEqual(passwords.parsePasswordReset(input), input);
  assert.equal(passwords.parsePasswordReset({ ...input, newPassword: "a".repeat(72) }).newPassword.length, 72);
});

test("anonymous, non-IT and cross-origin requests cannot hash or write", async () => {
  for (const role of [null, "USER", "ADMIN"]) {
    const f = fixture(role);
    assert.equal((await f.post()).status, role ? 403 : 401);
    assert.equal(f.state.hashCalls, 0); assert.equal(f.state.writes, 0);
  }
  const f = fixture();
  assert.equal((await f.post(input, "http://untrusted.test")).status, 403);
  assert.equal(f.state.hashCalls, 0);
});

test("invalid payloads and rate-limited requests do not mutate passwords", async () => {
  const f = fixture();
  assert.equal((await f.post({ ...input, newPassword: "x" })).status, 400);
  f.state.limited = true;
  const response = await f.post();
  assert.equal(response.status, 429); assert.equal(response.headers.get("retry-after"), "30");
  assert.equal(f.state.hashCalls, 0); assert.equal(f.state.password, "old-hash");
});

test("IT resets to a working bcrypt password and records only actor and target", async () => {
  const f = fixture("IT", true);
  const response = await f.post();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { success: true, username: "target" });
  assert.equal(await bcrypt.compare(input.newPassword, f.state.password), true);
  assert.equal(await bcrypt.compare("old-password", f.state.password), false);
  assert.deepEqual(f.state.audits, [["operator", "target"]]);
  assert.equal(f.state.releases, 1);
});

test("missing user, self reset and concurrent IT demotion roll back", async () => {
  const f = fixture();
  f.state.missing = true;
  assert.equal((await f.post()).status, 404);
  f.state.missing = false;
  assert.equal((await f.post({ ...input, username: "operator" })).status, 400);
  f.state.lockedRole = "USER";
  assert.equal((await f.post()).status, 403);
  assert.equal(f.state.password, "old-hash"); assert.equal(f.state.writes, 0);
  assert.equal(f.state.releases, 3);
});

test("audit failure rolls back password update, releases connection and reveals no secret", async () => {
  const f = fixture(); f.state.failAudit = true;
  const response = await f.post();
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes(input.newPassword), false);
  assert.equal(f.state.password, "old-hash"); assert.deepEqual(f.state.audits, []);
  assert.equal(f.state.writes, 0); assert.equal(f.state.releases, 1);
});
