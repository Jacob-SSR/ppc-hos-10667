import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  parsePtTreatmentFilters, ptTreatmentQueries, ptTreatmentExport, PT_DEFAULT_ICODES,
} from "../lib/pt-treatment-summary.ts";
import { canAccessPath } from "../lib/permissions.ts";

const filters = { start: "2026-10-21", end: "2026-10-21", icodes: ["0001", "0002"], byRight: false };
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE ovst (vn PRIMARY KEY, hn, vstdate, pttype);
    CREATE TABLE opitemrece (vn, icode, qty, sum_price);
    CREATE TABLE nondrugitems (icode PRIMARY KEY, name);
    CREATE TABLE pttype (pttype PRIMARY KEY, name);
    INSERT INTO nondrugitems VALUES ('0001','หัตถการชื่อเดียวกัน'),('0002','หัตถการชื่อเดียวกัน');
    INSERT INTO pttype VALUES ('UC','บัตรทอง'),('CASH','จ่ายเอง');
    INSERT INTO ovst VALUES ('v1','H1','2026-10-21','UC'),('v2','H1','2026-10-21','CASH'),
      ('v3','H2','2026-10-21','99'),('old','H1','2026-10-20','UC');
    INSERT INTO opitemrece VALUES ('v1','0001',1,100),('v1','0001',2,200),
      ('v1','0002',1,50),('v1','OTHER',1,900),('v2','0001',1,80),
      ('v3','0002',3,150),('old','0001',1,1000);`);
  return db;
}
function report(db, input = filters) {
  const q = ptTreatmentQueries(input);
  return { ...input, rows: db.prepare(q.rows.sql).all(...q.rows.params),
    totals: db.prepare(q.totals.sql).get(...q.totals.params), updatedAt: "2026-10-21" };
}

test("validates real calendar dates, selection, group and preserves leading zeros", () => {
  assert.deepEqual(parsePtTreatmentFilters(new URLSearchParams({ start: filters.start, end: filters.end, icodes: "0002,0001,0001" })), filters);
  assert.equal(parsePtTreatmentFilters(new URLSearchParams({ ...filters, icodes: "0001", group: "right" })).byRight, true);
  for (const override of [{ start: "2026-02-30" }, { end: "2026-10-20" }, { start: "2026-1-1" }, { icodes: "" }, { icodes: "0001,' OR 1=1" }, { icodes: "0001," }, { group: "unknown" }, { icodes: Array.from({ length: 201 }, (_,i) => String(i)).join(",") }]) {
    assert.throws(() => parsePtTreatmentFilters(new URLSearchParams({ start: filters.start, end: filters.end, icodes: "0001", ...override })));
  }
  assert.equal(PT_DEFAULT_ICODES.length, 18);
  assert.equal(new Set(PT_DEFAULT_ICODES).size, 18);
});

test("line amounts and quantities aggregate without duplicating VN income or losing repeat procedures", () => {
  const db = fixture();
  try {
    const result = report(db);
    assert.equal(result.rows.length, 2); // Same names with different codes stay separate.
    const a = result.rows.find(r => r.icode === "0001");
    assert.deepEqual([a.patients,a.visits,a.lines,a.quantity,a.charge], [1,2,3,4,380]);
    assert.deepEqual({ ...result.totals }, { patients: 2, visits: 3, lines: 5, quantity: 8, charge: 580 });
    assert.equal(result.rows.reduce((n,r)=>n+r.charge,0), result.totals.charge);
    assert.equal(result.rows.reduce((n,r)=>n+r.visits,0), 4);
    assert.equal(result.totals.visits, 3); // Do not add distinct counts across procedures.
  } finally { db.close(); }
});

test("rights are grouped explicitly while report totals remain distinct across rights", () => {
  const db = fixture();
  try {
    const result = report(db, { ...filters, byRight: true });
    assert.equal(result.rows.length, 4);
    assert.equal(result.rows.find(r=>r.icode==='0001' && r.pttype==='UC').charge, 300);
    assert.equal(result.rows.find(r=>r.pttype==='99').pttype_name, "ไม่ระบุสิทธิ");
    assert.deepEqual({ ...result.totals }, { patients: 2, visits: 3, lines: 5, quantity: 8, charge: 580 });
  } finally { db.close(); }
});

test("single procedure, empty result and date boundaries keep totals correct", () => {
  const db = fixture();
  try {
    assert.equal(report(db, { ...filters, icodes: ["0001"] }).totals.charge, 380);
    const empty = report(db, { ...filters, icodes: ["missing"] });
    assert.deepEqual(empty.rows, []);
    assert.deepEqual({ ...empty.totals }, { patients: 0, visits: 0, lines: 0, quantity: 0, charge: 0 });
    assert.equal(report(db, { ...filters, start: "2026-10-20" }).totals.charge, 1580);
  } finally { db.close(); }
});

test("Excel uses the applied report, numeric money and the distinct grand total", () => {
  const db = fixture();
  try {
    const result = report(db, { ...filters, byRight: true });
    const rows = ptTreatmentExport(result), total = rows.at(-1);
    assert.equal(rows.length, 5);
    assert.equal(rows[0].วันที่เริ่ม, filters.start);
    assert.ok(rows.some(r=>r.รหัสหัตถการ === "0001"));
    assert.equal(typeof rows[0].ค่าหัตถการ_บาท, "number");
    assert.equal(total.ครั้งรับบริการ_VN, 3);
    assert.equal(total.ค่าหัตถการ_บาท, 580);
  } finally { db.close(); }
});

test("the page and catalog/report API share PT access without granting ordinary users", () => {
  for (const path of ["/pages/pt-treatment-summary", "/api/pt-treatment-summary", "/api/pt-treatment-summary?mode=catalog"]) {
    assert.equal(canAccessPath("PT", path), true);
    assert.equal(canAccessPath("ADMIN", path), true);
    assert.equal(canAccessPath("USER", path), false);
    assert.equal(canAccessPath("USER", path, ["PT"]), true);
  }
});
