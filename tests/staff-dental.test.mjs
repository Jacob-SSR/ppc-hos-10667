import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseHrRosterFile, readStaffDentalRoster, StaffDentalRosterError } from "../lib/staff-dental-roster.ts";
import { STAFF_DENTAL_DEPARTMENTS_SQL, hrRosterStaff, parseStaffDentalFilters, staffPatientQuery, staffDentalVisitQuery, matchStaffPatients, resolveStaffPatients, summarizeStaffDental, staffDentalExport } from "../lib/staff-dental.ts";
import { canAccessPath } from "../lib/permissions.ts";

const member = (id, first, more = {}) => ({ id, first, last: "ใจดี", prefix: "นาย", group: "พยาบาลวิชาชีพ", unit:"งานผู้ป่วยนอก",staffDepartment:"กลุ่มงานการพยาบาล",hn: "", cid: "", ...more });
const input = { start: "2026-01-01", end: "2026-11-18", staff: [member(1,"สมชาย")] };

const personnel={staff_ordinal:1,prefix:'นาย',first_name:'ก',last_name:'ข',cid:'1234567890123',position_name:'พนักงานทำความสะอาด',unit_name:'งานทำความสะอาด',department_name:'กลุ่มงานบริหารทั่วไป'};
test("private HR file retains people without provider codes and ignores unrelated fields", () => {
    const input={version:1,people:[{...personnel,salary:9999,bank_account:'not-for-report'},{...personnel,staff_ordinal:2,cid:'1234567890124',position_name:'พยาบาลวิชาชีพ',unit_name:'งานผู้ป่วยนอก',department_name:'กลุ่มงานการพยาบาล'},{...personnel,staff_ordinal:3,cid:'1234567890125',active:0}]};
    const parsed=parseHrRosterFile(input);
    assert.ok(parsed.every(r=>!Object.hasOwn(r,'salary') && !Object.hasOwn(r,'bank_account')));
    const staff=hrRosterStaff(parsed);
    assert.equal(staff.length,2);assert.equal(staff[0].rosterNo,1);
    assert.equal(staff[0].group,'พนักงานทำความสะอาด');assert.equal(staff[0].unit,'งานทำความสะอาด');
    assert.equal(staff[1].group,'พยาบาลวิชาชีพ');assert.equal(staff[1].staffDepartment,'กลุ่มงานการพยาบาล');
    const missing=hrRosterStaff([{staff_ordinal:4,position_name:null,cid:'0000000000000'}]);
    assert.equal(missing[0].group,'ไม่ระบุตำแหน่ง');assert.equal(missing[0].cid,'');
    assert.ok(staff.every(s=>!Object.hasOwn(s,'department')));
});

test("read-only roster loader reads a BOM file and reports missing/invalid files without fallback",async()=>{
  const filePath=path.join(tmpdir(),`staff-dental-roster-${randomUUID()}.json`);
  try{
    await writeFile(filePath,'\uFEFF'+JSON.stringify({version:1,people:[personnel]}),'utf8');
    assert.deepEqual(await readStaffDentalRoster(filePath),[personnel]);
    await writeFile(filePath,'invalid json','utf8');
    await assert.rejects(()=>readStaffDentalRoster(filePath),StaffDentalRosterError);
  }finally{await unlink(filePath);}
  await assert.rejects(()=>readStaffDentalRoster(filePath),/ไม่พบไฟล์ทะเบียนบุคลากร/);
  for(const invalid of [{version:2,people:[personnel]},{version:1,people:[]},{version:1,people:[personnel,personnel]},{version:1,people:[{...personnel,cid:'0000000000000'}]},{version:1,people:[{...personnel,unit_name:''}]}])assert.throws(()=>parseHrRosterFile(invalid),StaffDentalRosterError);
});

test("all report database statements remain SELECT-only",()=>{
  const statements=[STAFF_DENTAL_DEPARTMENTS_SQL,staffPatientQuery([member(1,'ก')]).sql,staffDentalVisitQuery(['1'],input.start,input.end,'019').sql];
  for(const sql of statements){assert.match(sql,/^SELECT\b/i);assert.ok(!sql.includes(';'));assert.doesNotMatch(sql,/\b(CREATE\s+TABLE|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE|REPLACE\s+INTO|TRUNCATE\s+TABLE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b/i);}
});

test("same position in different HR units has separate reconciled summaries",()=>{
  const personnel=[member(1,'ก'),member(2,'ข',{unit:'งานผู้ป่วยใน'})];
  const rows=resolveStaffPatients(personnel,[{staff_id:1,hn:'1'},{staff_id:2,hn:'2'}]);
  const groups=summarizeStaffDental(rows);
  assert.equal(groups.length,2);assert.equal(groups.reduce((n,g)=>n+g.staff,0),2);
  const out=staffDentalExport({...input,rows,groups,updatedAt:'now'});
  assert.equal(out.all[1].หน่วยงาน,'งานผู้ป่วยใน');assert.equal(out.all[1].กลุ่มงาน_ฝ่าย,'กลุ่มงานการพยาบาล');
  assert.ok(out.all.every(r=>!Object.hasOwn(r,'cid')));
});

test("API accepts dates only; supplied staff cannot override the database population", () => {
  assert.deepEqual(parseStaffDentalFilters(input),{start:input.start,end:input.end});
  assert.deepEqual(parseStaffDentalFilters({...input,departmentCode:'019'}),{start:input.start,end:input.end,departmentCode:'019'});
  for(const departmentCode of ["019' OR 1=1",123,{},'a'.repeat(21)]) assert.throws(()=>parseStaffDentalFilters({...input,departmentCode}));
  for (const patch of [{start:"2026-02-30"},{start:"2026-11-19"},{end:"2028-01-01"}]) assert.throws(()=>parseStaffDentalFilters({...input,...patch}));
  const malicious = member(1,"ก' OR 1=1 --");
  const q=staffPatientQuery([malicious]);
  assert.ok(!q.sql.includes(malicious.first)); assert.ok(q.params.includes(malicious.first.replaceAll(" ","")));
  assert.equal((q.sql.match(/\?/g)||[]).length,q.params.length);
});

test("duplicate roster CIDs and incomplete names remain unresolved, even without patient matches", () => {
  const staff=[member(1,'ก',{cid:'1234567890123'}),member(2,'ข',{cid:'1234567890123'}),member(3,'',{last:''})];
  const matches=matchStaffPatients(staff,[{hn:'0001',cid:null,fname:'',lname:''}]);
  assert.deepEqual(matches,[]);
  const resolved=resolveStaffPatients(staff,matches);
  assert.deepEqual(resolved.map(r=>r.status),['duplicate_patient','duplicate_patient','not_found']);
  assert.ok(resolved.every(r=>r.visits===null));
});

function fixture() {
  const db=new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE patient(hn TEXT PRIMARY KEY, cid TEXT, fname TEXT, lname TEXT);
    CREATE TABLE vn_stat(vn TEXT PRIMARY KEY, hn TEXT, vstdate TEXT);
    CREATE TABLE opitemrece(vn TEXT, doctor TEXT);
    CREATE TABLE doctor(code TEXT PRIMARY KEY, position_id TEXT);
    CREATE TABLE ovst(vn TEXT PRIMARY KEY, cur_dep TEXT, main_dep TEXT);
    CREATE TABLE kskdepartment(depcode TEXT PRIMARY KEY, department TEXT);
    INSERT INTO kskdepartment VALUES ('019','ทันตกรรม'),('001','กลับบ้าน'),('099','ชื่อเดียวกัน'),('100','ชื่อเดียวกัน');
    INSERT INTO ovst VALUES ('v1','019','001'),('v2','001','019'),('medical','019','019'),('old','019','019'),('future','019','019'),('nondental','019','019');
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
    assert.deepEqual(rows.map(r=>({...r})),[{hn:"0001",visits:2,first_visit:"2026-01-01",last_visit:"2026-11-18",service_departments:'ทันตกรรม,กลับบ้าน'}]);
    assert.throws(()=>staffDentalVisitQuery([],input.start,input.end));
    assert.ok(!q.sql.includes("main_dep"));
  } finally {db.close();}
});

test("department catalogue uses all kskdepartment codes and visit filter follows cur_dep like incomplete-visit",()=>{
  const db=fixture();
  try {
    const catalog=db.prepare(STAFF_DENTAL_DEPARTMENTS_SQL).all();
    assert.equal(catalog.length,4);assert.equal(catalog.filter(d=>d.name==='ชื่อเดียวกัน').length,2);
    const dental=staffDentalVisitQuery(['0001'],input.start,input.end,'019');
    const first=db.prepare(sqlite(dental.sql)).get(...dental.params);
    assert.equal(first.visits,1);assert.equal(first.first_visit,'2026-01-01');assert.equal(first.service_departments,'ทันตกรรม');
    const home=staffDentalVisitQuery(['0001'],input.start,input.end,'001');
    assert.equal(db.prepare(sqlite(home.sql)).get(...home.params).first_visit,'2026-11-18');
    db.exec("INSERT INTO vn_stat VALUES ('missing-ovst','0001','2026-06-01'); INSERT INTO opitemrece VALUES ('missing-ovst','d');");
    const all=staffDentalVisitQuery(['0001'],input.start,input.end);
    assert.equal(db.prepare(sqlite(all.sql)).get(...all.params).visits,3); // No inner join loss for all departments.
    assert.equal(db.prepare(sqlite(dental.sql)).get(...dental.params).visits,1);
    const empty=staffDentalVisitQuery(['0001'],input.start,input.end,'099');
    assert.deepEqual(db.prepare(sqlite(empty.sql)).all(...empty.params),[]);
  }finally{db.close();}
});

test("position totals combine staff regardless of legacy department and preserve checkmarks", () => {
  const rows=resolveStaffPatients([member(1,"ก"),member(2,"ข"),member(3,"ค",{department:"แผนก ข"})],[{staff_id:1,hn:"0001"},{staff_id:2,hn:"0002"}]);
  Object.assign(rows[0],{status:"done",visits:2,firstVisit:"2026-01-01",lastVisit:"2026-11-18"});
  const groups=summarizeStaffDental(rows);
  assert.equal(groups.length,1);
  assert.equal(groups[0].staff,3);
  for(const g of groups) assert.equal(g.staff,g.done+g.notDone+g.unresolved);
  assert.equal(groups.reduce((n,g)=>n+g.visits,0),2);
  const exported=staffDentalExport({...input,rows,groups,updatedAt:"now"});
  assert.equal(exported.unfinished.length,1); assert.equal(exported.unresolved.length,1); assert.equal(exported.all.length,3);
  assert.equal(exported.unfinished[0].จำนวน_visit,0); assert.equal(exported.unresolved[0].จำนวน_visit,null);
  assert.deepEqual([exported.all[0].ทำแล้ว,exported.all[0].ยังไม่ทำ],["✓",""]);
  assert.deepEqual([exported.unfinished[0].ทำแล้ว,exported.unfinished[0].ยังไม่ทำ],["","✓"]);
  assert.deepEqual([exported.unresolved[0].ทำแล้ว,exported.unresolved[0].ยังไม่ทำ],["",""]);
  assert.equal(exported.all[0].HN,"0001");
  assert.equal(exported.all[0].วันที่เริ่ม,input.start);
  assert.ok(exported.all.every(r=>!Object.hasOwn(r,'แผนก')));
  assert.ok(exported.groups.every(r=>!Object.hasOwn(r,'แผนก')));
  const scoped=staffDentalExport({...input,departmentCode:'019',departmentName:'ทันตกรรม',rows:[{...rows[0],serviceDepartments:'ทันตกรรม'}],groups,updatedAt:'now'});
  assert.equal(scoped.all[0].แผนกรับบริการที่เลือก,'ทันตกรรม');
  assert.equal(scoped.all[0].แผนกที่พบ_visit,'ทันตกรรม');
});

test("report page and API require dental permission, including custom feature grants", () => {
  for(const path of ["/pages/staff-dental","/api/staff-dental"]) {
    assert.equal(canAccessPath("DENTIST",path),true); assert.equal(canAccessPath("IT",path),true);
    assert.equal(canAccessPath("USER",path),false); assert.equal(canAccessPath("PT",path),false);
    assert.equal(canAccessPath("USER",path,["DENTAL"]),true);
    assert.equal(canAccessPath("ADMIN",path,[]),false);
  }
});
