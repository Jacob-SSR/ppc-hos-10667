import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { parseIcdFilters, icdQuery, summarizeIcd, icdCsv } from "../lib/icd10-report.ts";
import { canAccessPath } from "../lib/permissions.ts";

const defaults = { icd_from: "a00", icd_to: "a99", age_from: "1", age_to: "100", date_from: "2025-10-01", date_to: "2026-09-02", mode: "all" };
const parse = (changes = {}) => parseIcdFilters(new URLSearchParams({ ...defaults, ...changes }));
test("validates and normalizes codes, age and calendar dates", () => {
  assert.equal(parse().diag_text, "");
  assert.equal(parse({ diag_text: "  ไข้  " }).diag_text, "ไข้");
  assert.equal(parse({ diag_text: "   " }).diag_text, "");
  assert.throws(() => parse({ diag_text: "a".repeat(201) }));
  assert.equal(parse().icd_from, "A00");
  assert.equal(parse({ icd_from: "A00.0" }).icd_from, "A000");
  for (const changes of [{ mode: "bad" }, { age_from: "" }, { age_from: "1.5" }, { age_to: "151" }, { age_from: "101" }, { icd_from: "A00' OR 1=1" }, { icd_to: "A0" }, { date_from: "2026-02-30" }, { date_to: "2024-01-01" }]) assert.throws(() => parse(changes));
});

test("query includes secondary DX5 and upper chapter descendants without leaking unrelated diagnoses", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.function("DATE_FORMAT", { varargs: true }, date => date);
    db.function("CONCAT_WS", { varargs: true }, (sep, ...parts) => parts.filter(p => p != null).join(sep));
    db.exec(`CREATE TABLE vn_stat (vn, hn, vstdate, age_y, pdx, dx0, dx1, dx2, dx3, dx4, dx5);
      CREATE TABLE patient (hn, pname, fname, lname);
      CREATE TABLE ovst (vn, diag_text);
      CREATE TABLE icd101 (code, tname, name);
      INSERT INTO vn_stat VALUES
      ('01','H1','2025-10-01',1,'a990',NULL,NULL,NULL,NULL,NULL,NULL),
      ('02','H1','2026-09-02',100,'J00',NULL,NULL,NULL,NULL,NULL,'A00.1'),
      ('03','H2','2026-09-02',100,'B00',NULL,NULL,NULL,NULL,NULL,NULL),
      ('04','H3','2026-09-03',10,'A00',NULL,NULL,NULL,NULL,NULL,NULL),
      ('05','H4','2026-09-02',0,'A00',NULL,NULL,NULL,NULL,NULL,NULL);
      INSERT INTO ovst VALUES ('01','older'), ('02','latest text');`);
    const all = icdQuery(parse());
    const rows = db.prepare(all.sql).all(...all.values);
    assert.deepEqual(rows.map(r => r.vn), ["02", "01"]);
    const result = summarizeIcd(rows);
    assert.equal(result.summary.visits, 2);
    assert.equal(result.summary.patients, 1);
    assert.equal(result.rows[0].diag_text, "latest text");
    assert.equal(result.rows[0].age_y, 100);
    const pdx = icdQuery(parse({ mode: "pdx" }));
    assert.deepEqual(db.prepare(pdx.sql).all(...pdx.values).map(r => r.vn), ["01"]);
    const find = (diag_text, changes = {}) => {
      const query = icdQuery(parse({ diag_text, ...changes }));
      return db.prepare(query.sql).all(...query.values);
    };
    assert.deepEqual(find("LATEST").map(r => r.vn), ["02"]);
    assert.deepEqual(find("older").map(r => r.vn), ["01"]);
    assert.equal(summarizeIcd(find("older")).rows[0].vn, "01");
    assert.equal(find("latest", { mode: "pdx" }).length, 0);
    assert.equal(find("missing").length, 0);
    assert.equal(find("' OR 1=1 --").length, 0);
    db.prepare("UPDATE ovst SET diag_text = ? WHERE vn = '01'").run("ไข้สูง 100% A_B ! C\\D");
    for (const text of ["ไข้", "100%", "A_B", "!", "C\\D"]) {
      assert.deepEqual(find(text).map(r => r.vn), ["01"]);
    }
    assert.equal(find("100_").length, 0);
    db.exec("UPDATE ovst SET diag_text = NULL WHERE vn = '01'");
    assert.equal(find("ไข้").length, 0);
    assert.equal(find(" ").length, 2);
  } finally { db.close(); }
});

test("summary picks deterministic latest visits, deduplicates VN and counts patient ages", () => {
  const base = { hn: "01", age_y: 10, ptname: "Test", pdx: "A00", dname: "Disease", dxlist: "A00", diag_text: "", vstdate: "2026-01-01" };
  const rows = [{ ...base, vn: "1" }, { ...base, vn: "2", age_y: 60 }, { ...base, vn: "3", hn: "02", age_y: 20 }];
  const data = summarizeIcd([...rows, rows[0]]);
  assert.equal(data.summary.visits, 3);
  assert.equal(data.summary.patients, 2);
  assert.equal(data.summary.avg_age, 40);
  assert.equal(data.by_month[0].c, 3);
  assert.equal(data.top_dx[0].c, 3);
  assert.equal(data.by_age.reduce((sum, a) => sum + a.c, 0), 2);
  assert.equal(data.rows.find(r => r.hn === "01").vn, "2");
  assert.equal(summarizeIcd([]).summary.avg_age, null);
  const csv = icdCsv([{ ...rows[0], diag_text: '=HYPERLINK("x")\nไทย' }]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")\nไทย"'));
  assert.ok(csv.includes("diag_text"));
});

test("page and API share existing report permissions", () => {
  for (const role of ["ADMIN", "DOCTOR", "FINANCE", "PUBLIC_HEALTH"]) {
    assert.ok(canAccessPath(role, "/pages/icd10-report"));
    assert.ok(canAccessPath(role, "/api/icd10-report"));
  }
  assert.equal(canAccessPath("USER", "/api/icd10-report"), false);
});


test("reversed ICD endpoints produce the same query and metadata as ascending endpoints", () => {
  for (const mode of ["all", "pdx"]) {
    for (const [a, b] of [["M54", "A05.2"], ["A99", "A00"], ["M54", "M54"]]) {
      const forward = parse({icd_from:a, icd_to:b, mode});
      const backward = parse({icd_from:b, icd_to:a, mode});
      assert.deepEqual(forward, backward);
      assert.deepEqual(icdQuery(forward), icdQuery(backward));
    }
  }
  const filters = parse({icd_from:"m54",icd_to:"a05.2"});
  assert.equal(filters.icd_from,"A052");
  assert.equal(filters.icd_to,"M54");
});
