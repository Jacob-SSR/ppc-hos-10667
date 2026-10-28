import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { dayQueries, fiscalMonths, fiscalQuarter, parseDay, parseFiscalYear, pickPersonSource, splitDiagText, summarizeDay, summarizeYear, yearQueries, diagtextCsv } from "../lib/diagtext-dashboard.ts";
import { canAccessPath } from "../lib/permissions.ts";

test("fiscal year months and quarters start in October", () => {
  const months = fiscalMonths(2027);
  assert.equal(months.length, 12);
  assert.equal(months[0], "2026-10");
  assert.equal(months[11], "2027-09");
  assert.deepEqual(["2026-10", "2026-12", "2027-01", "2027-03", "2027-04", "2027-07", "2027-09"].map(fiscalQuarter), [1, 1, 2, 2, 3, 4, 4]);
});

test("validates fiscal year and day", () => {
  assert.equal(parseFiscalYear("2027"), 2027);
  for (const v of [null, "", "27", "2027'", "1999"]) assert.throws(() => parseFiscalYear(v));
  assert.equal(parseDay("2026-10-28"), "2026-10-28");
  for (const v of [null, "2026-02-30", "2026-1-1", "x"]) assert.throws(() => parseDay(v));
});

test("splits lines, strips numbering and merges case/whitespace variants", () => {
  assert.deepEqual(splitDiagText("1. HT\n2) DM type 2\n- DLP."), [
    { key: "ht", label: "HT" }, { key: "dm type 2", label: "DM type 2" }, { key: "dlp", label: "DLP" },
  ]);
  assert.deepEqual(splitDiagText("  URI  \nuri\n-\nNULL\n"), [{ key: "uri", label: "URI" }]);
  assert.equal(splitDiagText("1.5 cm laceration")[0].label, "1.5 cm laceration");
  assert.equal(splitDiagText("ไข้หวัด")[0].key, "ไข้หวัด");
  assert.deepEqual(splitDiagText(null), []);
});

test("person source uses whitelisted column or falls back to ovstdiag", () => {
  assert.deepEqual(pickPersonSource(["vn", "DOCTOR_CODE", "diag_text"]), { kind: "column", column: "doctor_code", lookup: "doctor" });
  assert.deepEqual(pickPersonSource(["vn", "staff"]), { kind: "column", column: "staff", lookup: "opduser" });
  assert.deepEqual(pickPersonSource(["vn", "diag_text"]), { kind: "ovstdiag" });
});

test("year summary ranks texts per month, quarter and fiscal year", () => {
  const texts = [
    { ym: "2026-10", diag_text: "URI", visits: 5 },
    { ym: "2026-10", diag_text: "uri ", visits: 1 },
    { ym: "2026-10", diag_text: "1. HT\n2. DM", visits: 3 },
    { ym: "2026-11", diag_text: "HT", visits: 4 },
    { ym: "2027-01", diag_text: "Dyspepsia", visits: 2 },
    { ym: "2025-09", diag_text: "out of year", visits: 99 },
  ];
  const persons = [
    { ym: "2026-10", code: "D1", name: "หมอ ก", entries: 7, visits: 6 },
    { ym: "2026-11", code: "D2", name: "หมอ ข", entries: 4, visits: 4 },
    { ym: "2026-11", code: "D1", name: "หมอ ก", entries: 1, visits: 1 },
    { ym: "2027-01", code: null, name: null, entries: 2, visits: 2 },
  ];
  const opd = [{ date: "2026-10-01", c: 10 }, { date: "2026-11-02", c: 6 }, { date: "2027-01-05", c: 3 }];
  const diag = [{ date: "2026-10-01", c: 9 }, { date: "2026-11-02", c: 4 }, { date: "2027-01-05", c: 2 }];
  const r = summarizeYear(2027, texts, persons, opd, diag);
  const oct = r.months[0];
  assert.equal(oct.key, "2026-10");
  assert.deepEqual(oct.top.slice(0, 3), [{ text: "URI", visits: 6 }, { text: "DM", visits: 3 }, { text: "HT", visits: 3 }]);
  assert.equal(oct.opd_visits, 10);
  assert.equal(oct.diag_visits, 9);
  assert.equal(r.quarters[0].top[0].text, "HT");
  assert.equal(r.quarters[0].top[0].visits, 7);
  assert.deepEqual(r.quarters[0].persons.map(p => [p.code, p.entries]), [["D1", 8], ["D2", 4]]);
  assert.equal(r.quarters[1].top[0].text, "Dyspepsia");
  assert.equal(r.quarters[1].persons[0].name, "ไม่ระบุผู้ลง");
  assert.equal(r.year.opd_visits, 19);
  assert.equal(r.year.entries, 14);
  assert.equal(r.year.distinct_texts, 4);
  assert.ok(!r.year.top.some(t => t.text === "out of year"));
  assert.equal(r.quarters[0].to, "2026-12-31");
  assert.equal(r.months[4].to, "2027-02-28");
});

test("day summary counts each visit once per text and ranks persons", () => {
  const rows = [
    { vn: "1", hn: "H1", vsttime: "08:00", department: "OPD", diag_text: "URI", person_code: "D1", person_name: "หมอ ก" },
    { vn: "1", hn: "H1", vsttime: "08:00", department: "OPD", diag_text: "uri\nFever", person_code: "D1", person_name: "หมอ ก" },
    { vn: "2", hn: "H2", vsttime: "09:00", department: "ER", diag_text: "URI", person_code: "D2", person_name: "" },
    { vn: "3", hn: "H3", vsttime: "09:30", department: "OPD", diag_text: "-", person_code: "D2", person_name: "" },
  ];
  const r = summarizeDay("2026-10-28", rows, 5);
  assert.deepEqual(r.top, [{ text: "URI", visits: 2 }, { text: "Fever", visits: 1 }]);
  assert.equal(r.diag_visits, 2);
  assert.deepEqual(r.persons.map(p => [p.name, p.entries, p.visits]), [["หมอ ก", 2, 1], ["D2", 1, 1]]);
  assert.deepEqual(r.visits[0].texts, ["URI", "Fever"]);
});

// VN 3 มี ovstdiag แค่โรครอง (diagtype 2) → โหมดถอยไปใช้แพทย์โรคหลักต้องได้ "ไม่ระบุผู้ลง"
function hosxp() {
  const db = new DatabaseSync(":memory:");
  db.function("DATE_FORMAT", (d, f) => f === "%Y-%m" ? String(d).slice(0, 7) : String(d).slice(0, 10));
  db.function("TIME_FORMAT", { varargs: true }, (t) => t == null ? null : String(t).slice(0, 5));
  db.exec(`CREATE TABLE ovst (vn, hn, vstdate, vsttime, main_dep);
    CREATE TABLE ovst_doctor_diag (ovst_doctor_diag_id, vn, diag_text, doctor_code);
    CREATE TABLE ovstdiag (vn, diagtype, doctor);
    CREATE TABLE doctor (code, name);
    CREATE TABLE kskdepartment (depcode, department);
    INSERT INTO ovst VALUES ('1','H1','2026-10-01','08:00:00','010'), ('2','H2','2026-10-01','09:00:00','010'),
      ('3','H3','2026-10-02','10:00:00','011'), ('4','H4','2026-09-30','10:00:00','010');
    INSERT INTO ovst_doctor_diag VALUES (1,'1','URI','D1'), (2,'1','  ','D1'), (3,'2','uri','D2'), (4,'3','HT',NULL), (5,'4','old','D1');
    INSERT INTO ovstdiag VALUES ('1','1','D9'), ('2','1','D9'), ('3','2','D8');
    INSERT INTO doctor VALUES ('D1','หมอ ก'), ('D2','หมอ ข'), ('D9','หมอ ฌ');
    INSERT INTO kskdepartment VALUES ('010','ห้องตรวจ 1');`);
  return db;
}
const run = (db, q) => db.prepare(q.sql).all(...q.values);

test("year queries run end to end and exclude blank text and other years", () => {
  const db = hosxp();
  for (const person of [pickPersonSource(["doctor_code"]), pickPersonSource([])]) {
    const q = yearQueries(2027, person);
    const r = summarizeYear(2027, run(db, q.texts), run(db, q.persons), run(db, q.opdByDay), run(db, q.diagByDay));
    assert.deepEqual(r.year.top, [{ text: "URI", visits: 2 }, { text: "HT", visits: 1 }]);
    assert.equal(r.year.opd_visits, 3);
    assert.equal(r.year.diag_visits, 3);
    assert.equal(r.year.entries, 3);
    if (person.kind === "column") assert.deepEqual(r.year.persons.map(p => p.name), ["หมอ ก", "หมอ ข", "ไม่ระบุผู้ลง"]);
    else assert.deepEqual(r.year.persons.map(p => [p.name, p.entries]), [["หมอ ฌ", 2], ["ไม่ระบุผู้ลง", 1]]);
  }
});

test("day query returns visits of the chosen date only", () => {
  const db = hosxp();
  const q = dayQueries("2026-10-01", pickPersonSource(["doctor_code"]));
  const r = summarizeDay("2026-10-01", run(db, q.rows), run(db, q.opd)[0].c);
  assert.equal(r.opd_visits, 2);
  assert.deepEqual(r.top, [{ text: "URI", visits: 2 }]);
  assert.deepEqual(r.visits.map(v => [v.vn, v.vsttime, v.department]), [["1", "08:00", "ห้องตรวจ 1"], ["2", "09:00", "ห้องตรวจ 1"]]);
});

test("csv neutralizes formulas and REPORT roles can open the page", () => {
  const csv = diagtextCsv("t", [{ text: "=cmd", visits: 1 }], [{ code: "D1", name: "หมอ", entries: 2, visits: 1 }]);
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes(`"'=cmd"`));
  assert.ok(canAccessPath("FINANCE", "/pages/diagtext-dashboard"));
  assert.ok(canAccessPath("FINANCE", "/api/diagtext-dashboard/day"));
  assert.ok(!canAccessPath("USER", "/api/diagtext-dashboard"));
});
