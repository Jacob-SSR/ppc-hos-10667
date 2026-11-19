/** Report population: active records in doctor, including records that need identity review. */
export const STAFF_DENTAL_TITLE = "ติดตามเจ้าหน้าที่ที่ยังไม่ได้รับบริการทันตกรรม";
export type StaffMember = { id: number; group: string; prefix: string; first: string; last: string; hn: string; cid: string; doctorCode?: string };
export type StaffDentalStatus = "done" | "not_done" | "not_found" | "ambiguous" | "duplicate_patient";
export const STAFF_DENTAL_STATUS: Record<StaffDentalStatus, string> = {
  done: "รับบริการแล้ว", not_done: "ยังไม่พบ visit ในช่วงที่เลือก", not_found: "ไม่พบชื่อ/รหัสในทะเบียนผู้ป่วย",
  ambiguous: "พบหลาย HN ต้องยืนยันตัวบุคคล", duplicate_patient: "CID/HN ซ้ำหลายรหัสเจ้าหน้าที่",
};
export type StaffDentalRow = StaffMember & { name: string; matchedHn: string | null; status: StaffDentalStatus; visits: number | null; firstVisit: string | null; lastVisit: string | null };
export type StaffDentalSummary = { group: string; staff: number; done: number; notDone: number; unresolved: number; visits: number };
export type StaffDentalReport = { start: string; end: string; rows: StaffDentalRow[]; groups: StaffDentalSummary[]; updatedAt: string };
export const cleanText = (v: unknown): string => String(v ?? "").replace(/\s+/gu, " ").trim();
export const nameKey = (v: unknown): string => String(v ?? "").replace(/\s+/gu, "").normalize("NFC");
export const ACTIVE_DOCTOR_SQL = `SELECT d.code, d.name, d.pname, d.fname, d.lname, d.cid,
  dp.name AS position_name FROM doctor d
  LEFT JOIN doctor_position dp ON dp.id = d.position_id
  WHERE d.active = 'Y' ORDER BY d.code`;
export type ActiveDoctor = { code: string; name: string | null; pname: string | null; fname: string | null; lname: string | null; cid: string | null; position_name: string | null };
const dbText = (v: unknown) => /^(null|\[\])$/i.test(cleanText(v)) ? "" : cleanText(v);
export function activeDoctorStaff(doctors: ActiveDoctor[]): StaffMember[] {
  return doctors.map((d,i) => {
    const cid = dbText(d.cid);
    return { id:i+1, doctorCode:String(d.code), group:dbText(d.position_name) || "ไม่ระบุตำแหน่ง", prefix:dbText(d.pname), first:dbText(d.fname), last:dbText(d.lname), hn:"", cid:/^\d{13}$/.test(cid) && !/^(\d)\1{12}$/.test(cid) ? cid : "" };
  });
}
export function parseStaffDentalFilters(value: unknown): { start: string; end: string } {
  if (!value || typeof value !== "object") throw Error("ข้อมูลรายงานไม่ถูกต้อง");
  const v = value as Record<string,unknown>;
  const isDate = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0,4)) >= 1900 && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0,10) === d;
  if (!isDate(v.start) || !isDate(v.end) || v.start > v.end) throw Error("กรุณาระบุวันที่เริ่มและสิ้นสุดให้ถูกต้อง");
  if ((Date.parse(v.end)-Date.parse(v.start))/86400000 > 366) throw Error("เลือกช่วงรายงานได้ไม่เกิน 367 วัน");
  return {start:v.start,end:v.end};
}
// Explicit UTF-8 collation avoids comparing the TIS-620 patient columns against a different collation.
const sqlNameKey = (column: string) => `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(${column} USING utf8mb4), ' ', ''), CHAR(9), ''), CHAR(10), ''), CHAR(13), ''), CONVERT(0xC2A0 USING utf8mb4), '') COLLATE utf8mb4_bin`;
export function staffPatientQuery(staff: StaffMember[]) {
  const params: string[] = [], conditions: string[] = [];
  function add(column: string, values: string[]) {
    const unique = [...new Set(values)];
    if (!unique.length) return;
    conditions.push(`${column} IN (${unique.map(() => "?").join(",")})`); params.push(...unique);
  }
  add("p.hn",staff.filter(s=>s.hn).map(s=>s.hn));
  add("p.cid",staff.filter(s=>!s.hn && s.cid).map(s=>s.cid));
  add(sqlNameKey("p.fname"),staff.filter(s=>!s.hn && !s.cid && s.first && s.last).map(s=>nameKey(s.first)));
  // Scan/filter patient once; never join every staff name to the entire patient table.
  return { sql: `SELECT p.hn, p.cid, p.fname, p.lname FROM patient p WHERE ${conditions.join(" OR ") || "1=0"}`, params };
}
export type StaffPatientCandidate = { hn: string; cid: string | null; fname: string | null; lname: string | null };
export function matchStaffPatients(staff: StaffMember[], patients: StaffPatientCandidate[]): { staff_id: number; hn: string }[] {
  const byHn = new Map<string, StaffPatientCandidate[]>(), byCid = new Map<string, StaffPatientCandidate[]>(), byName = new Map<string, StaffPatientCandidate[]>();
  function add(map: Map<string, StaffPatientCandidate[]>, key: string, p: StaffPatientCandidate) { map.set(key,[...(map.get(key) ?? []),p]); }
  for(const p of patients) {
    add(byHn,String(p.hn),p); if(p.cid) add(byCid,String(p.cid),p);
    add(byName,JSON.stringify([nameKey(p.fname),nameKey(p.lname)]),p);
  }
  return staff.flatMap(s => {
    const matches = s.hn ? (byHn.get(s.hn) ?? []).filter(p=>!s.cid || String(p.cid)===s.cid) : s.cid ? byCid.get(s.cid) ?? [] : s.first && s.last ? byName.get(JSON.stringify([nameKey(s.first),nameKey(s.last)])) ?? [] : [];
    return matches.map(p=>({staff_id:s.id,hn:String(p.hn)}));
  });
}
export function staffDentalVisitQuery(hns: string[], start: string, end: string) {
  if (!hns.length) throw Error("ต้องมี HN ก่อนดึง visit");
  return { sql: `SELECT v.hn, COUNT(DISTINCT v.vn) AS visits, MIN(v.vstdate) AS first_visit, MAX(v.vstdate) AS last_visit
    FROM vn_stat v WHERE v.hn IN (${hns.map(() => "?").join(",")})
      AND v.vstdate >= ? AND v.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
      AND EXISTS (SELECT 1 FROM opitemrece oo JOIN doctor dd ON dd.code = oo.doctor
        WHERE oo.vn = v.vn AND dd.position_id IN ('2','6'))
    GROUP BY v.hn`, params: [...hns, start, end] };
}
export function resolveStaffPatients(staff: StaffMember[], matches: { staff_id: number; hn: string }[]) {
  const cidUses = new Map<string,number>();
  for(const s of staff) if(s.cid) cidUses.set(s.cid,(cidUses.get(s.cid) ?? 0)+1);
  const candidates = new Map<number, Set<string>>();
  for (const m of matches) {
    const set = candidates.get(Number(m.staff_id)) ?? new Set<string>();
    set.add(String(m.hn)); candidates.set(Number(m.staff_id), set);
  }
  const single = staff.map(s => ({ s, hns: [...(candidates.get(s.id) ?? [])] }));
  const uses = new Map<string, number>();
  for (const { hns } of single) if (hns.length === 1) uses.set(hns[0], (uses.get(hns[0]) ?? 0) + 1);
  return single.map(({ s, hns }): StaffDentalRow => {
    const status: StaffDentalStatus = s.cid && (cidUses.get(s.cid) ?? 0)>1 ? "duplicate_patient" : !hns.length ? "not_found" : hns.length > 1 ? "ambiguous" : (uses.get(hns[0]) ?? 0) > 1 ? "duplicate_patient" : "not_done";
    return { ...s, name: `${s.prefix}${s.first} ${s.last}`, matchedHn: status === "not_done" ? hns[0] : null, status, visits: status === "not_done" ? 0 : null, firstVisit: null, lastVisit: null };
  });
}
export function summarizeStaffDental(rows: StaffDentalRow[]): StaffDentalSummary[] {
  const groups = new Map<string, StaffDentalSummary>();
  for (const row of rows) {
    const key = row.group;
    const g = groups.get(key) ?? { group: row.group, staff: 0, done: 0, notDone: 0, unresolved: 0, visits: 0 };
    g.staff++; if (row.status === "done") g.done++; else if (row.status === "not_done") g.notDone++; else g.unresolved++;
    g.visits += row.visits ?? 0; groups.set(key, g);
  }
  return [...groups.values()].sort((a,b) => b.notDone - a.notDone || a.group.localeCompare(b.group, "th"));
}
export function staffDentalExport(report: StaffDentalReport) {
  const exportRows = (rows: StaffDentalRow[]) => rows.map(r => ({ วันที่เริ่ม: report.start, วันที่สิ้นสุด: report.end, รหัสเจ้าหน้าที่:r.doctorCode ?? "", ตำแหน่ง: r.group, ชื่อ_นามสกุล: r.name, HN: r.matchedHn ?? "", ทำแล้ว: r.status === "done" ? "✓" : "", ยังไม่ทำ: r.status === "not_done" ? "✓" : "", จำนวน_visit: r.visits, วันที่ครั้งแรก: r.firstVisit ?? "", วันที่ล่าสุด: r.lastVisit ?? "", สถานะ: STAFF_DENTAL_STATUS[r.status] }));
  return {
    unfinished: exportRows(report.rows.filter(r => r.status === "not_done")),
    unresolved: exportRows(report.rows.filter(r => !["done", "not_done"].includes(r.status))),
    all: exportRows(report.rows),
    groups: report.groups.map(g => ({ ตำแหน่ง: g.group, รายการ_active: g.staff, รับบริการแล้ว: g.done, ยังไม่พบ_visit: g.notDone, ต้องตรวจสอบ: g.unresolved, visit_รวมที่จับคู่ได้: g.visits })),
  };
}
