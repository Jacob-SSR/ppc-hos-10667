import assert from "node:assert/strict";
import { test } from "node:test";
import { canAccessITTools, canAccessPath, FEATURE_PATHS, normalizeRole } from "../lib/permissions.ts";

test("ADMIN can access every registered report and its API, including normalized database roles", () => {
  for (const role of ["ADMIN", "admin", " admin ", "ADMIN\t"]) {
    for (const path of Object.values(FEATURE_PATHS).flat()) {
      assert.equal(canAccessPath(role, path), true, `${role}: ${path}`);
    }
  }
});

test("IT tools admit ADMIN and IT while keeping other roles out", () => {
  for (const role of ["ADMIN", "IT", "admin", " it "]) {
    assert.equal(canAccessITTools(role), true, role);
  }
  for (const role of [null, undefined, "", " ", "GUEST", "USER", "DOCTOR", "DIRECTOR", "FINANCE", "ADMINISTRATOR", "unknown"]) {
    assert.equal(canAccessITTools(role), false, String(role));
  }
});

test("blank and unknown roles retain ordinary user restrictions", () => {
  for (const role of [null, undefined, "", " ", "unknown"]) {
    assert.equal(canAccessPath(role, "/pages/dashboard"), true);
    assert.equal(canAccessPath(role, "/api/it-worklog-form"), false);
    assert.equal(canAccessPath(role, "/api/server-status"), false);
    assert.equal(canAccessPath(role, "/api/population-report"), false);
  }
  assert.equal(normalizeRole(" admin "), "ADMIN");
  assert.equal(normalizeRole(null), "USER");
});
