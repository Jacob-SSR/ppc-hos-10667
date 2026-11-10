import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { buildPtCandidateQuery, buildPtRecordsQuery } from "../lib/pt-dashboard-query.ts";
import { buildPtCatalogQuery, buildPtOutreachQuery, collectPtItemCodes, PT_OUTREACH_SCHEMA_TABLES } from "../lib/pt-outreach.ts";
import { createPtDashboardCache } from "../lib/pt-dashboard-cache.ts";
import { filterPtLocation } from "../lib/pt-dashboard-filters.ts";

const day = "2026-11-06", staff = "dd.position_id IN ('9')";
const source = { table: "physic_main_opd", staffColumn: "doctor" };
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.function("DATE_FORMAT", { varargs: true }, date => String(date).slice(0, 10));
  db.function("regexp", (pattern, text) => Number(new RegExp(pattern
    .replaceAll("[[:space:]_.-]", "[\\s_.-]").replaceAll("[[:space:]]", "\\s")).test(text ?? "")));
  db.exec(`
    CREATE TABLE ovst (vn, hn, vstdate, vsttime, pttype, ovstist);
    CREATE TABLE vn_stat (vn, pcode);
    CREATE TABLE patient (hn, cid, pname, fname, lname);
    CREATE TABLE pttype (pttype, pcode, name);
    CREATE TABLE doctor (code, name, position_id);
    CREATE TABLE opitemrece (vn, doctor, rxtime, income, sum_price, icode);
    CREATE TABLE doctor_operation (vn, icd9);
    CREATE TABLE icd9_sss (code, name);
    CREATE TABLE opdscreen (vn, cc);
    CREATE TABLE physic_main_opd (vn, vstdate, service_text, doctor);
    CREATE TABLE ovstist (ovstist, name);
    CREATE TABLE drugitems (icode, name, income);
    CREATE TABLE nondrugitems (icode, name, income);
    INSERT INTO ovstist VALUES ('01','ทั่วไป'), ('02','งานเชิงรุก OPD');
    INSERT INTO doctor VALUES ('PT1','PT','9'), ('MD1','MD','1');
    INSERT INTO patient VALUES ('H1','','','Test','One');
    INSERT INTO pttype VALUES ('01','UC','UC');
    INSERT INTO nondrugitems VALUES
      ('PMS','Peripheral Magnetic Stimulation (PMS)','99'),
      ('ROM','ROM exercise','99'), ('HOT','Hot Pack(ประคบร้อน)','99'),
      ('COMM','PT in community','99'), ('COMM-ON','PT on community','99'),
      ('XRAY','Knee joint AP Lateral','08');
    INSERT INTO drugitems VALUES ('DRUG','Paracetamol','03');
    INSERT INTO ovst VALUES
      ('PT-AM','H1','2026-11-06','08:00','01','01'),
      ('MD','H1','2026-11-06','09:00','01','01'),
      ('PT-PM','H1','2026-11-06','13:00','01','01'),
      ('REGISTERED','H2','2026-11-06','14:00','01','01'),
      ('NO-STAFF','H3','2026-11-06','15:00','01','01'),
      ('OLD','H1','2026-11-05','08:00','01','02');
    -- The early PT VN has no vn_stat, no registry, and its billing doctor is MD.
    INSERT INTO vn_stat VALUES ('MD','UC'), ('PT-PM','UC');
    INSERT INTO opitemrece VALUES
      ('PT-AM','MD1','08:30','14',100,'PMS'), ('PT-AM',NULL,'08:40','14',50,'HOT'),
      ('MD','MD1','09:30','03',900,'DRUG'), ('PT-PM','PT1','13:30','14',200,'ROM'),
      ('OLD','PT1','08:30','14',500,'COMM');
    INSERT INTO physic_main_opd VALUES
      ('REGISTERED','2026-11-06','exercise','PT1'), ('NO-STAFF','2026-11-06','exercise',NULL);
  `);
  return db;
}
function metadata(db) {
  return PT_OUTREACH_SCHEMA_TABLES.flatMap(table => db.prepare(`PRAGMA table_info(${table})`).all()
    .map(col => ({ TABLE_NAME: table, COLUMN_NAME: col.name, DATA_TYPE: "varchar" })));
}
function itemConfig(db) {
  const schema = metadata(db), q = buildPtCatalogQuery(schema);
  return { schema, ...collectPtItemCodes(db.prepare(q.sql).all(...q.params)) };
}
function query(db, src = source) {
  const config = itemConfig(db);
  const outreach = buildPtOutreachQuery(config.schema, day, day, config.communityIcodes);
  const outreachVns = new Set(db.prepare(outreach.sql).all(...outreach.params).map(r => r.vn));
  const candidates = buildPtCandidateQuery(src, staff, day, day, config.ptIcodes);
  const vns = [...new Set([...db.prepare(candidates.sql).all(...candidates.params).map(r => r.vn), ...outreachVns])];
  const records = buildPtRecordsQuery(src, "icd9_sss", staff, vns, config.ptIcodes);
  return db.prepare(records.sql).all(...records.params).map(r => ({ ...r,
    is_outreach: Number(outreachVns.has(r.vn)), service_location: outreachVns.has(r.vn) ? "outreach" : "hospital" }));
}

test("early PT visit survives a later doctor visit despite missing vn_stat and changed/unassigned billing doctors", () => {
  const db = fixture();
  try {
    const rows = query(db);
    assert.deepEqual(rows.map(r => r.vn), ["PT-AM", "PT-PM", "REGISTERED", "NO-STAFF"]);
    assert.equal(rows[0].pcode, "UC");
    assert.equal(rows[0].staff_id, null); // Never attribute PT work to the general doctor.
    assert.equal(rows[0].charge_total, 150);
    assert.equal(rows[0].svc_time, "08:40");
    assert.equal(rows.reduce((n,r) => n+r.charge_total,0), 350);
    assert.equal(rows.filter(r => r.hn === "H1").length, 2);
    assert.equal(new Set(rows.filter(r => r.hn === "H1").map(r => r.hn)).size, 1);
  } finally { db.close(); }
});

test("PMS, ROM and Hot Pack identify PT items even with another income code and no registry/staff", () => {
  const db = fixture();
  try {
    db.exec("UPDATE opitemrece SET income = '99', doctor = 'MD1' WHERE vn = 'PT-AM'");
    for (const code of ["PMS", "ROM", "HOT"]) {
      db.prepare("UPDATE opitemrece SET icode = ? WHERE vn = 'PT-AM'").run(code);
      const row = query(db,null).find(r => r.vn === "PT-AM");
      assert.ok(row,code); assert.equal(row.staff_id,null); assert.equal(row.svc_time,"08:40");
    }
    db.exec("UPDATE opitemrece SET icode = 'XRAY' WHERE vn = 'PT-AM'");
    assert.ok(!query(db,null).some(r => r.vn === "PT-AM"));
  } finally { db.close(); }
});

test("PT income 14 remains evidence when catalogue and staff are missing", () => {
  const db = fixture();
  try {
    db.exec("DROP TABLE drugitems; DROP TABLE nondrugitems; DROP TABLE physic_main_opd");
    assert.deepEqual(query(db,null).map(r => r.vn), ["PT-AM","PT-PM"]);
  } finally { db.close(); }
});

test("outreach requires both a billed PT in/on community item and งานเชิงรุก arrival in the same VN", () => {
  const db = fixture();
  try {
    db.exec("UPDATE ovst SET ovstist = '02' WHERE vn = 'PT-AM'");
    assert.equal(filterPtLocation(query(db),"outreach").length,0); // Arrival alone is insufficient.
    for (const code of ["COMM","COMM-ON"]) {
      db.prepare("UPDATE opitemrece SET icode = ? WHERE vn = 'PT-AM'").run(code);
      assert.deepEqual(filterPtLocation(query(db),"outreach").map(r=>r.vn),["PT-AM"]);
    }
    db.exec("UPDATE ovst SET ovstist = '01' WHERE vn = 'PT-AM'");
    assert.equal(filterPtLocation(query(db),"outreach").length,0); // Item alone stays ordinary PT.
    db.exec("UPDATE ovst SET ovstist = '02' WHERE vn = 'MD'");
    assert.equal(filterPtLocation(query(db),"outreach").length,0); // Same HN never bridges VNs.
    db.exec("INSERT INTO opdscreen VALUES ('PT-PM','งานเชิงรุก PT in community')");
    assert.equal(filterPtLocation(query(db),"outreach").length,0); // CC no longer controls classification.
  } finally { db.close(); }
});

test("community item under the drug catalogue is detected with case/whitespace variants", () => {
  const db = fixture();
  try {
    db.exec("INSERT INTO drugitems VALUES ('C-DRUG','PT in community','99'); UPDATE ovst SET ovstist = '02' WHERE vn = 'PT-AM'; UPDATE opitemrece SET icode = 'C-DRUG' WHERE vn = 'PT-AM'");
    for (const name of ["Pt In Community","PT  on\ncommunity","PT-in-community"]) {
      db.prepare("UPDATE drugitems SET name = ? WHERE icode = 'C-DRUG'").run(name);
      assert.deepEqual(filterPtLocation(query(db),"outreach").map(r=>r.vn),["PT-AM"]);
    }
  } finally { db.close(); }
});

test("catalogue deduplicates shared codes, honours master income 14 and supports s_drugitems", () => {
  const db = fixture();
  try {
    db.exec("CREATE TABLE s_drugitems (icode,name,income); INSERT INTO s_drugitems VALUES ('COMM','PT in community','14'),('CODE14','Local modality','14')");
    const codes = itemConfig(db);
    assert.equal(codes.communityIcodes.filter(c=>c==='COMM').length,1);
    assert.ok(codes.ptIcodes.includes('CODE14'));
    db.exec("UPDATE opitemrece SET income = '99', doctor = NULL, icode = 'CODE14' WHERE vn = 'PT-AM'");
    assert.ok(query(db,null).some(r=>r.vn==='PT-AM'));
  } finally { db.close(); }
});

test("optional arrival/catalogue tables can be absent without inventing outreach", () => {
  const db = fixture();
  try {
    db.exec("DROP TABLE ovstist; DROP TABLE nondrugitems; DROP TABLE drugitems");
    assert.equal(query(db).filter(r=>r.is_outreach).length,0);
    assert.equal(query(db).length,4);
  } finally { db.close(); }
});

test("repeat billing and registry rows do not multiply visits or charge totals", () => {
  const db = fixture();
  try {
    db.exec("INSERT INTO physic_main_opd VALUES ('REGISTERED','2026-11-06','massage','PT1')");
    const rows=query(db);
    assert.equal(rows.filter(r=>r.vn==='REGISTERED').length,1);
    assert.equal(rows.find(r=>r.vn==='REGISTERED').charge_total,0);
    assert.equal(rows.find(r=>r.vn==='REGISTERED').staff_id,'PT1');
  } finally { db.close(); }
});

test("batched charges retain general-drug/unassigned charges and only PT item time determines shift", () => {
  const db = fixture();
  try {
    db.exec("INSERT INTO opitemrece VALUES ('PT-AM','MD1','17:00','03',40,'DRUG'),('PT-AM',NULL,'18:00','99',60,'XRAY')");
    const row=query(db).find(r=>r.vn==='PT-AM');
    assert.deepEqual([row.charge_physio,row.charge_drug,row.charge_other,row.charge_total],[150,40,60,250]);
    assert.equal(row.svc_time,'08:40');
    const empty=buildPtRecordsQuery(source,'icd9_sss',staff,[]);
    assert.deepEqual(db.prepare(empty.sql).all(...empty.params),[]);
  } finally { db.close(); }
});

test("outreach filters by date and uses item codes without narrative regex or correlated lookup", () => {
  const db=fixture();
  try {
    const config=itemConfig(db),q=buildPtOutreachQuery(config.schema,day,day,config.communityIcodes);
    assert.ok(!q.sql.includes('REGEXP')); assert.ok(!q.sql.includes('opdscreen'));
    assert.ok(db.prepare(`EXPLAIN QUERY PLAN ${q.sql}`).all(...q.params).every(r=>!r.detail.includes('CORRELATED')));
    assert.ok(!db.prepare(q.sql).all(...q.params).some(r=>r.vn==='OLD'));
  } finally { db.close(); }
});

test("identical slow requests share work; successful cache expires and failures retry", async () => {
  let time=0,calls=0,release;
  const get=createPtDashboardCache(30,2,()=>time);
  const build=()=>{calls++;return new Promise(resolve=>{release=resolve;});};
  const first=get('range',build),second=get('range',build);await Promise.resolve();assert.equal(calls,1);
  release(123);assert.deepEqual(await Promise.all([first,second]),[123,123]);
  assert.equal(await get('range',()=>{throw Error('cached');}),123);
  time=31;assert.equal(await get('range',async()=>456),456);
  await assert.rejects(get('error',async()=>{throw Error('DB error');}),/DB error/);
  assert.equal(await get('error',async()=>789),789);
  await get('third',async()=>3);assert.equal(await get('range',async()=>999),999);
});
