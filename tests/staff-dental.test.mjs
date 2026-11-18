import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { parseStaffSheet, parseStaffDentalRequest, staffPatientQuery, staffDentalVisitQuery, matchStaffPatients, resolveStaffPatients, summarizeStaffDental, staffDentalExport } from "../lib/staff-dental.ts";
import { canAccessPath } from "../lib/permissions.ts";

const member = (id, first, more = {}) => ({ id, first, last: "ใจดี", prefix: "นาย", group: "กลุ่ม ก", department: "แผนก ก", hn: "", cid: "", ...more });
const input = { start: "2026-01-01", end: "2026-11-18", staff: [member(1,"สมชาย")] };

test("imports the supplied Thai two-row header and preserves work group and department", () => {
  const staff = parseStaffSheet([
    ["ลำดับ","กลุ่มงาน (ปฏิบัติงานจริง)","คำนำ","ชื่อ","สกุล","ประเภท","ตำแหน่ง","ระดับ","สถานะ"],
    ["ที่",null,"หน้า"], [1," งาน ก ","นาย"," สมชาย  ","ใจดี",null,null,null,"ดำเนินการแล้ว"],
    [null,null,null,null,null],
  ]);
  assert.equal(staff.length,1);
  assert.equal(staff[0].group,"งาน ก"); assert.equal(staff[0].department,"งาน ก");
  assert.equal(staff[0].first,"สมชาย");
  assert.equal(staff[0].status,undefined); // Ignore the unrelated original status column.
  const separate = parseStaffSheet([["ชื่อ","นามสกุล","กลุ่มงาน","แผนก","HN"],["ก","ข","ค","ง","000001"]]);
  assert.equal(separate[0].department,"ง"); assert.equal(separate[0].hn,"000001");
  assert.throws(()=>parseStaffSheet([["ชื่อ","สกุล","แผนก"],["ก","ข","ค"],["ก ","ข","ง"]]),/ซ้ำ/);
});

test("validates the API input, real calendar dates, size and duplicate identities", () => {
  assert.deepEqual(parseStaffDentalRequest(input),input);
  for (const patch of [{start:"2026-02-30"},{start:"2026-11-19"},{end:"2028-01-01"},{staff:[]},{staff:[member(1,"ก"),member(1,"ข")]},{staff:[member(1,"ก"),member(2,"ก")]},{staff:[member(1,"ก",{cid:"123"})]}]) assert.throws(()=>parseStaffDentalRequest({...input,...patch}));
  const malicious = member(1,"ก' OR 1=1 --");
  const q=staffPatientQuery([malicious]);
  assert.ok(!q.sql.includes(malicious.first)); assert.ok(q.params.includes(malicious.first.replaceAll(" ","")));
  assert.equal((q.sql.match(/\?/g)||[]).length,q.params.length);
});

function fixture() {
  const db=new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE patient(hn TEXT PRIMARY KEY, cid TEXT, fname TEXT, lname TEXT);
    CREATE TABLE vn_stat(vn TEXT PRIMARY KEY, hn TEXT, vstdate TEXT);
    CREATE TABLE opitemrece(vn TEXT, doctor TEXT);
    CREATE TABLE doctor(code TEXT PRIMARY KEY, position_id TEXT);
    INSERT INTO patient VALUES ('0001','1111111111111','สมชาย  ','ใจดี'),('0002','2222222222222','สมศรี','ใจดี'),('0003','3333333333333','ซ้ำ','ใจดี'),('0004','4444444444444','ซ้ำ','ใจดี');
    INSERT INTO doctor VALUES ('d','2'),('t','6'),('other','1');
    INSERT INTO vn_stat VALUES ('v1','0001','2026-01-01'),('v2','0001','2026-11-18'),('medical','0001','2026-04-01'),('old','0001','2025-12-31'),('future','0001','2026-11-19'),('nondental','0002','2026-04-01');
    INSERT INTO opitemrece VALUES ('v1','d'),('v1','d'),('v1','t'),('v2','t'),('medical','other'),('old','d'),('future','d'),('nondental','other');`);
  return db;
}
// SQLite executes the generated SELECT after replacing MySQL charset and date functions only.
const sqlite = sql => sql.replace(/CONVERT\(0xC2A0 USING utf8mb4\)/g,"' '").replace(/CONVERT\(([\w.]+) USING utf8mb4\)/g,"$1").replace(/ COLLATE utf8mb4_bin/g,"").replace(/DATE_ADD\(\?, INTERVAL 1 DAY\)/g,"date(?, '+1 day')");
test("matches names, HN/CID overrides, and keeps missing/ambiguous identities outside unfinished counts", () => {
  const db=fixture();
  try {
    const staff=[member(1,"สมชาย"),member(2,"สมศรี"),member(3,"ไม่มี"),member(4,"ซ้ำ")];
    const q=staffPatientQuery(staff), rows=resolveStaffPatients(staff,matchStaffPatients(staff,db.prepare(sqlite(q.sql)).all(...q.params)));
    assert.deepEqual(rows.map(r=>[r.status,r.visits,r.matchedHn]),[["not_done",0,"0001"],["not_done",0,"0002"],["not_found",null,null],["ambiguous",null,null]]);
    const explicit=[member(1,"เปลี่ยนชื่อ",{hn:"0003",cid:"3333333333333"}),member(2,"เปลี่ยนชื่อ",{cid:"4444444444444"}),member(3,"ผิดคน",{hn:"0001",cid:"2222222222222"})];
    const e=staffPatientQuery(explicit), resolved=resolveStaffPatients(explicit,matchStaffPatients(explicit,db.prepare(sqlite(e.sql)).all(...e.params)));
    assert.deepEqual(resolved.map(r=>r.matchedHn),["0003","0004",null]);
    const duplicate=resolveStaffPatients([member(1,"ก"),member(2,"ข")],[{staff_id:1,hn:"0001"},{staff_id:2,hn:"0001"}]);
    assert.ok(duplicate.every(r=>r.status==="duplicate_patient" && r.visits===null));
  } finally {db.close();}
});

test("counts distinct dental VN, includes both date boundaries and ignores medical visits", () => {
  const db=fixture();
  try {
    const q=staffDentalVisitQuery(["0001","0002"],input.start,input.end);
    const rows=db.prepare(sqlite(q.sql)).all(...q.params);
    assert.deepEqual(rows.map(r=>({...r})),[{hn:"0001",visits:2,first_visit:"2026-01-01",last_visit:"2026-11-18"}]);
    assert.throws(()=>staffDentalVisitQuery([],input.start,input.end));
    assert.ok(!q.sql.includes("main_dep"));
  } finally {db.close();}
});

test("group totals reconcile and Excel separates unfinished, done and unresolved", () => {
  const rows=resolveStaffPatients([member(1,"ก"),member(2,"ข"),member(3,"ค",{department:"แผนก ข"})],[{staff_id:1,hn:"0001"},{staff_id:2,hn:"0002"}]);
  Object.assign(rows[0],{status:"done",visits:2,firstVisit:"2026-01-01",lastVisit:"2026-11-18"});
  const groups=summarizeStaffDental(rows);
  assert.equal(groups.length,2);
  for(const g of groups) assert.equal(g.staff,g.done+g.notDone+g.unresolved);
  assert.equal(groups.reduce((n,g)=>n+g.visits,0),2);
  const exported=staffDentalExport({...input,rows,groups,updatedAt:"now"});
  assert.equal(exported.unfinished.length,1); assert.equal(exported.unresolved.length,1); assert.equal(exported.all.length,3);
  assert.equal(exported.unfinished[0].จำนวน_visit,0); assert.equal(exported.unresolved[0].จำนวน_visit,null);
  assert.equal(exported.all[0].HN,"0001");
  assert.equal(exported.all[0].วันที่เริ่ม,input.start);
});

test("report page and API require dental permission, including custom feature grants", () => {
  for(const path of ["/pages/staff-dental","/api/staff-dental"]) {
    assert.equal(canAccessPath("DENTIST",path),true); assert.equal(canAccessPath("IT",path),true);
    assert.equal(canAccessPath("USER",path),false); assert.equal(canAccessPath("PT",path),false);
    assert.equal(canAccessPath("USER",path,["DENTAL"]),true);
    assert.equal(canAccessPath("ADMIN",path,[]),false);
  }
});
