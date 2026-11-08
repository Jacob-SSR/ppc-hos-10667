import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { buildPtRecordsQuery } from "../lib/pt-dashboard-query.ts";
import { buildPtOutreachMatch, PT_OUTREACH_SCHEMA_TABLES } from "../lib/pt-outreach.ts";
import { filterPtLocation } from "../lib/pt-dashboard-filters.ts";

function fixture() {
  const db = new DatabaseSync(":memory:");
  // Exercise production MySQL REGEXP predicates with SQLite's injectable operator.
  db.function("regexp", (pattern, text) => Number(new RegExp(pattern.replaceAll("[[:space:]_.-]", "[\\s_.-]")).test(text ?? "")));
  db.exec(`
    CREATE TABLE ovst (vn, hn, vstdate, vsttime, pttype);
    CREATE TABLE vn_stat (vn, pcode);
    CREATE TABLE patient (hn, cid, pname, fname, lname);
    CREATE TABLE pttype (pttype, pcode, name);
    CREATE TABLE doctor (code, name, position_id);
    CREATE TABLE opitemrece (vn, doctor, rxtime, income, sum_price);
    CREATE TABLE doctor_operation (vn, icd9);
    CREATE TABLE icd9_sss (code, name);
    CREATE TABLE opdscreen (vn, cc);
    CREATE TABLE physic_main_opd (vn, vstdate, service_text, doctor);
    INSERT INTO doctor VALUES ('PT1', 'PT', '9'), ('MD1', 'MD', '1');
    INSERT INTO patient VALUES ('H1', '', '', 'Test', 'One');
    INSERT INTO pttype VALUES ('01', 'UC', 'UC');
    INSERT INTO ovst VALUES
      ('PT-AM', 'H1', '2026-11-06', '08:00', '01'),
      ('MD', 'H1', '2026-11-06', '09:00', '01'),
      ('PT-PM', 'H1', '2026-11-06', '13:00', '01'),
      ('REGISTERED', 'H2', '2026-11-06', '14:00', '01'),
      ('NO-STAFF', 'H3', '2026-11-06', '15:00', '01'),
      ('OLD', 'H1', '2026-11-05', '08:00', '01');
    -- First PT visit intentionally has no vn_stat; the later doctor visit does.
    INSERT INTO vn_stat VALUES ('MD', 'UC'), ('PT-PM', 'UC');
    INSERT INTO opitemrece VALUES
      ('PT-AM', 'PT1', '08:30', '14', 100),
      ('PT-AM', 'PT1', '08:40', '14', 50),
      ('MD', 'MD1', '09:30', '03', 900),
      ('PT-PM', 'PT1', '13:30', '14', 200),
      ('OLD', 'PT1', '08:30', '14', 500);
    INSERT INTO physic_main_opd VALUES
      ('PT-AM', '2026-11-06', 'exercise', 'PT1'),
      ('PT-AM', '2026-11-06', 'massage', 'PT1'),
      ('REGISTERED', '2026-11-06', 'exercise', 'PT1'),
      ('NO-STAFF', '2026-11-06', 'exercise', NULL);
    INSERT INTO opdscreen VALUES
      ('PT-AM', 'ปวดหลัง'), ('PT-PM', 'เชิงรุก OPD PT in community กายภาพ'),
      ('PT-PM', 'เชิงรุก opd'), ('MD', 'เชิงรุก opd');
  `);
  return db;
}

const source = { table: "physic_main_opd", staffColumn: "doctor" };
function metadata(db) {
  return PT_OUTREACH_SCHEMA_TABLES.flatMap(table => db.prepare(`PRAGMA table_info(${table})`).all()
    .map(col => ({ TABLE_NAME: table, COLUMN_NAME: col.name, DATA_TYPE: "varchar" })));
}
function query(db, src = source) {
  const outreach = buildPtOutreachMatch(metadata(db));
  return db.prepare(buildPtRecordsQuery(src, "icd9_sss", "dd.position_id IN ('9')", outreach))
    .all(...outreach.params, "2026-11-06", "2026-11-06");
}

test("keeps separate PT VNs for one patient, including missing vn_stat, excludes doctor-only VN", () => {
  const db = fixture();
  try {
    const rows = query(db);
    assert.deepEqual(rows.map(r => r.vn), ["PT-AM", "PT-PM", "REGISTERED", "NO-STAFF"]);
    assert.equal(rows[0].pcode, "UC");
    assert.equal(rows[0].charge_total, 150);
    assert.equal(rows[1].charge_total, 200);
    assert.equal(rows.reduce((n, r) => n + r.charge_total, 0), 350);
    assert.equal(rows.filter(r => r.hn === "H1").length, 2);
  } finally { db.close(); }
});

test("registration-only visits survive absent billing/staff/patient and repeated entries do not multiply visits", () => {
  const db = fixture();
  try {
    const rows = query(db);
    assert.equal(rows.filter(r => r.vn === "PT-AM").length, 1);
    const registered = rows.find(r => r.vn === "REGISTERED");
    assert.equal(registered.staff_id, "PT1");
    assert.equal(registered.charge_total, 0);
    assert.equal(rows.find(r => r.vn === "NO-STAFF").staff_id, null);
    assert.equal(query(db, { ...source, staffColumn: null }).length, 4);
  } finally { db.close(); }
});

test("sites without the optional registry still return billed PT visits", () => {
  const db = fixture();
  try {
    db.exec("DROP TABLE physic_main_opd");
    assert.deepEqual(query(db, null).map(r => r.vn), ["PT-AM", "PT-PM"]);
  } finally { db.close(); }
});

test("CC is checked by VN, case-insensitively, without multiplying rows or leaking to another visit", () => {
  const db = fixture();
  try {
    const rows = query(db).map(r => ({ ...r, service_location: r.is_outreach ? "outreach" : "hospital" }));
    assert.deepEqual(filterPtLocation(rows, "outreach").map(r => r.vn), ["PT-PM"]);
    assert.equal(filterPtLocation(rows, "hospital").length, 3);
    assert.equal(filterPtLocation(rows, "all").length, 4);
    db.exec("UPDATE opdscreen SET cc = NULL");
    assert.ok(query(db).every(r => r.is_outreach === 0));
    assert.deepEqual(filterPtLocation([], "outreach"), []);
  } finally { db.close(); }
});

test("outreach accepts both PT in/on community in CC with surrounding text and mixed case", () => {
  const db = fixture();
  try {
    for (const cc of ["PT in Community", "ติดตาม pt on community กายภาพ", "Pt On CoMmUnItY", "pt in community / เชิงรุก opd", "PT  in\ncommunity", "pt\ton\tcommunity", "pt-in-community"]) {
      db.prepare("UPDATE opdscreen SET cc = ? WHERE vn = 'PT-PM'").run(cc);
      const rows = query(db);
      assert.deepEqual(rows.filter(r => r.is_outreach).map(r => r.vn), ["PT-PM"], cc);
    }
    for (const cc of ["เชิงรุก opd", "เชิงรุก OPD กายภาพ", "community", "in", "on", "pt in hospital", "ปวดหลัง", ""]) {
      db.prepare("UPDATE opdscreen SET cc = ? WHERE vn = 'PT-PM'").run(cc);
      assert.ok(query(db).every(r => r.is_outreach === 0), cc);
    }
  } finally { db.close(); }
});

test("finds every available text field in visit notes, screening, and both PT registries", () => {
  const db = fixture();
  try {
    db.exec(`UPDATE opdscreen SET cc = NULL;
      ALTER TABLE opdscreen ADD COLUMN hpi TEXT;
      ALTER TABLE opdscreen ADD COLUMN pmh TEXT;
      ALTER TABLE ovst ADD COLUMN remark TEXT;
      CREATE TABLE ovst_doctor_diag (vn, diag_text TEXT);
      CREATE TABLE physic_main (vn, note TEXT);
      CREATE TABLE opd_note (vn, note TEXT);
      INSERT INTO ovst_doctor_diag VALUES ('PT-PM', NULL), ('MD', NULL);
      INSERT INTO physic_main VALUES ('PT-PM', NULL);
      INSERT INTO opd_note VALUES ('PT-PM', NULL);`);
    for (const [table, col, vn] of [
      ["opdscreen", "hpi", "PT-PM"], ["opdscreen", "pmh", "PT-PM"],
      ["ovst", "remark", "PT-PM"], ["ovst_doctor_diag", "diag_text", "PT-PM"],
      ["physic_main_opd", "service_text", "PT-AM"], ["physic_main", "note", "PT-PM"],
      ["opd_note", "note", "PT-PM"],
    ]) {
      db.prepare(`UPDATE ${table} SET ${col} = ? WHERE vn = ?`).run("PT on community", vn);
      assert.deepEqual(query(db).filter(r => r.is_outreach).map(r => r.vn), [vn], `${table}.${col}`);
      db.prepare(`UPDATE ${table} SET ${col} = NULL WHERE vn = ?`).run(vn);
    }
    // A marker on another VN for the same patient never tags PT-AM/PT-PM.
    db.exec("UPDATE ovst_doctor_diag SET diag_text = 'PT in community' WHERE vn = 'MD'");
    const rows = query(db);
    assert.deepEqual(rows.filter(r => r.is_outreach).map(r => r.vn), ["MD"]);
    assert.equal(rows.find(r => r.vn === "MD").staff_id, null);
  } finally { db.close(); }
});

test("includes marked community visits without billing/registry, and respects visit date range", () => {
  const db = fixture();
  try {
    db.exec(`UPDATE opdscreen SET cc = NULL;
      INSERT INTO ovst VALUES ('COMMUNITY', 'H1', '2026-11-06', '16:00', '01');
      INSERT INTO opdscreen VALUES ('COMMUNITY', 'PT in community'), ('OLD', 'PT in community');`);
    const rows = query(db);
    assert.deepEqual(rows.filter(r => r.is_outreach).map(r => r.vn), ["COMMUNITY"]);
    assert.equal(rows.find(r => r.vn === "COMMUNITY").charge_total, 0);
    assert.equal(rows.find(r => r.vn === "COMMUNITY").staff_id, null);
  } finally { db.close(); }
});

test("detects linked visit-type and clinic names, without assuming optional master columns exist", () => {
  const db = fixture();
  try {
    db.exec(`UPDATE opdscreen SET cc = NULL;
      ALTER TABLE ovst ADD COLUMN ovstist;
      CREATE TABLE ovstist (ovstist, name TEXT);
      INSERT INTO ovstist VALUES ('C', 'PT in community');
      UPDATE ovst SET ovstist = 'C' WHERE vn = 'PT-PM';
      CREATE TABLE clinic_visit (vn, clinic);
      CREATE TABLE clinic (clinic, name TEXT);
      INSERT INTO clinic VALUES ('C', 'PT on community');
      INSERT INTO clinic_visit VALUES ('PT-AM', 'C'), ('PT-AM', 'C');`);
    assert.deepEqual(query(db).filter(r => r.is_outreach).map(r => r.vn), ["PT-AM", "PT-PM"]);
    db.exec("DROP TABLE clinic; DROP TABLE ovstist; DROP TABLE opdscreen");
    assert.ok(query(db).every(r => r.is_outreach === 0));
  } finally { db.close(); }
});

test("schema matching ignores unsupported tables, unsafe identifiers, and nontext columns", () => {
  assert.deepEqual(buildPtOutreachMatch([]), { sql: "FALSE", params: [] });
  assert.deepEqual(buildPtOutreachMatch([
    { TABLE_NAME: "patient", COLUMN_NAME: "name", DATA_TYPE: "text" },
    { TABLE_NAME: "opdscreen", COLUMN_NAME: "vn", DATA_TYPE: "varchar" },
    { TABLE_NAME: "opdscreen", COLUMN_NAME: "cc` injected", DATA_TYPE: "text" },
    { TABLE_NAME: "opdscreen", COLUMN_NAME: "weight", DATA_TYPE: "decimal" },
  ]), { sql: "FALSE", params: [] });
});
