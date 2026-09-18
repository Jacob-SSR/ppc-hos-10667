import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { parseAgeRange, POPULATION_REPORT_SQL } from "../lib/population-report.ts";
import { canAccessPath } from "../lib/permissions.ts";

test("age validation accepts defaults, inclusive equal bounds and extremes", () => {
  assert.deepEqual(parseAgeRange(new URLSearchParams()), [1, 100]);
  for (const [min, max] of [[0, 120], [60, 60], [0, 0], [120, 120]]) {
    assert.deepEqual(parseAgeRange(new URLSearchParams({ minAge: String(min), maxAge: String(max) })), [min, max]);
  }
});

test("age validation rejects malformed, fractional, crossed and out-of-range input", () => {
  for (const query of ["minAge=", "minAge=-1", "maxAge=121", "minAge=2.5", "minAge=abc", "minAge=80&maxAge=20", "maxAge=Infinity", "minAge=1 OR 1=1"]) {
    assert.throws(() => parseAgeRange(new URLSearchParams(query)));
  }
});

test("report query excludes dead/discharged/outside population and includes both age endpoints", () => {
  // Synthetic fixtures only. SQLite runs the portable SELECT/filter portion;
  // deployment still needs validation against the hospital's MySQL schema.
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE person (person_id, patient_hn, cid, pname, fname, lname, age_y, age_m, house_regist_type_id, house_id, village_id, death, person_discharge_id);
      CREATE TABLE house (house_id, address, road);
      CREATE TABLE village (village_id, village_moo, village_name, address_id);
      CREATE TABLE thaiaddress (addressid, full_name);
      INSERT INTO village VALUES (1, '2', 'fixture', 1), (14, '10', 'fixture', 1);`);
    const insert = db.prepare("INSERT INTO person VALUES (?, ?, '', '', 'Test', 'Person', ?, 0, ?, NULL, ?, ?, ?)");
    const cases = [
      [1, 20, '1', 1, 'N', '9'], [2, 60, '3', 14, null, '9'],
      [3, 19, '1', 1, 'N', '9'], [4, 61, '1', 1, 'N', '9'],
      [5, 30, '1', 1, 'Y', '9'], [6, 30, '1', 1, 'N', '1'],
      [7, 30, '1', 1, 'N', null], [8, 30, '2', 1, 'N', '9'],
      [9, 30, '1', 13, 'N', '9'], [10, 30, '1', 99, 'N', '9'],
    ];
    for (const [id, age, type, village, death, discharge] of cases) insert.run(id, String(id), age, type, village, death, discharge);
    assert.deepEqual(db.prepare(POPULATION_REPORT_SQL).all(20, 60).map(r => r.HN), ['1', '2']);
    assert.deepEqual(db.prepare(POPULATION_REPORT_SQL).all(60, 60).map(r => r.HN), ['2']);
    assert.equal(db.prepare(POPULATION_REPORT_SQL).all(100, 120).length, 0);
  } finally { db.close(); }
});

test("both report routes are restricted to authorized roles", () => {
  for (const path of ["/pages/population-report", "/api/population-report"]) {
    assert.equal(canAccessPath("PUBLIC_HEALTH", path), true);
    assert.equal(canAccessPath("ADMIN", path), true);
    assert.equal(canAccessPath("USER", path), false);
    assert.equal(canAccessPath("FINANCE", path), false);
  }
});
