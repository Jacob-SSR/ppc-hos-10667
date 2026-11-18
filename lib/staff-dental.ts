/** Shared report logic. One imported row represents one employee, not a provider. */
export const STAFF_DENTAL_TITLE = "ติดตามเจ้าหน้าที่ที่ยังไม่ได้รับบริการทันตกรรม";
export const STAFF_DENTAL_LIMIT = 500;
export type StaffMember = { id: number; group: string; department: string; prefix: string; first: string; last: string; hn: string; cid: string };
export type StaffDentalStatus = "done" | "not_done" | "not_found" | "ambiguous" | "duplicate_patient";
export const STAFF_DENTAL_STATUS: Record<StaffDentalStatus, string> = {
  done: "รับบริการแล้ว", not_done: "ยังไม่พบ visit ในช่วงที่เลือก", not_found: "ไม่พบชื่อ/รหัสในทะเบียนผู้ป่วย",
  ambiguous: "พบหลาย HN ต้องยืนยันตัวบุคคล", duplicate_patient: "หลายรายชื่อจับคู่กับ HN เดียวกัน",
};
export type StaffDentalRow = StaffMember & { name: string; matchedHn: string | null; status: StaffDentalStatus; visits: number | null; firstVisit: string | null; lastVisit: string | null };
export type StaffDentalSummary = { group: string; department: string; staff: number; done: number; notDone: number; unresolved: number; visits: number };
export type StaffDentalReport = { start: string; end: string; rows: StaffDentalRow[]; groups: StaffDentalSummary[]; updatedAt: string };
export const cleanText = (v: unknown): string => String(v ?? "").replace(/\s+/gu, " ").trim();
export const nameKey = (v: unknown): string => String(v ?? "").replace(/\s+/gu, "").normalize("NFC");
const headerKey = (v: unknown) => nameKey(v).toLowerCase();
const labels = {
  group: ["กลุ่มงาน(ปฏิบัติงานจริง)", "กลุ่มงาน", "กลุ่มงาน/แผนก"], department: ["แผนก", "หน่วยงาน", "งาน"],
  prefix: ["คำนำ", "คำนำหน้า"], first: ["ชื่อ", "ชื่อจริง", "fname"], last: ["สกุล", "นามสกุล", "lname"],
  hn: ["hn", "เลขhn"], cid: ["cid", "เลขบัตรประชาชน", "เลขประจำตัวประชาชน"],
};
export function parseStaffSheet(rows: unknown[][]): StaffMember[] {
  const headerAt = rows.slice(0, 20).findIndex(row => {
    const keys = row.map(headerKey);
    return labels.first.some(k => keys.includes(k)) && labels.last.some(k => keys.includes(k));
  });
  if (headerAt < 0) throw Error("ไม่พบหัวตาราง ชื่อ และ สกุล/นามสกุล ในชีตที่เลือก");
  const headers = rows[headerAt].map(headerKey);
  const index = Object.fromEntries(Object.entries(labels).map(([k, names]) => [k, headers.findIndex(h => names.includes(h))])) as Record<keyof typeof labels, number>;
  if (index.group < 0 && index.department < 0) throw Error("ต้องมีคอลัมน์กลุ่มงานหรือแผนก");
  const result: StaffMember[] = [], identities = new Set<string>();
  rows.slice(headerAt + 1).forEach((row, offset) => {
    const get = (key: keyof typeof labels) => index[key] < 0 ? "" : cleanText(row[index[key]]);
    const first = get("first"), last = get("last");
    // The supplied workbook has a second header row containing only ที่ / หน้า.
    if (!first && !last) return;
    if (!first || !last) throw Error(`แถว ${headerAt + offset + 2}: ชื่อหรือนามสกุลไม่ครบ`);
    const group = get("group") || get("department"), department = get("department") || group;
    if (!group) throw Error(`แถว ${headerAt + offset + 2}: ไม่ระบุกลุ่มงาน/แผนก`);
    const member: StaffMember = { id: result.length + 1, group, department, first, last, prefix: get("prefix"), hn: get("hn"), cid: get("cid") };
    const identity = member.hn ? `hn:${member.hn}` : member.cid ? `cid:${member.cid}` : `name:${nameKey(first)}:${nameKey(last)}`;
    if (identities.has(identity)) throw Error(`พบรายชื่อ/รหัสซ้ำ: ${first} ${last} กรุณาตรวจสอบก่อนนำเข้า`);
    identities.add(identity); result.push(member);
  });
  if (!result.length) throw Error("ไม่พบรายชื่อเจ้าหน้าที่ในชีตนี้");
  if (result.length > STAFF_DENTAL_LIMIT) throw Error(`นำเข้าได้ไม่เกิน ${STAFF_DENTAL_LIMIT} คนต่อรายงาน`);
  return result;
}
export function parseStaffDentalRequest(value: unknown): { start: string; end: string; staff: StaffMember[] } {
  if (!value || typeof value !== "object") throw Error("ข้อมูลรายงานไม่ถูกต้อง");
  const v = value as Record<string, unknown>;
  const isDate = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0,4)) >= 1900 && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0,10) === d;
  if (!isDate(v.start) || !isDate(v.end) || v.start > v.end) throw Error("กรุณาระบุวันที่เริ่มและสิ้นสุดให้ถูกต้อง");
  if ((Date.parse(v.end) - Date.parse(v.start)) / 86400000 > 366) throw Error("เลือกช่วงรายงานได้ไม่เกิน 367 วัน");
  if (!Array.isArray(v.staff) || !v.staff.length || v.staff.length > STAFF_DENTAL_LIMIT) throw Error("จำนวนรายชื่อไม่ถูกต้อง");
  const ids = new Set<number>(), identities = new Set<string>();
  const staff = v.staff.map((input: unknown): StaffMember => {
    if (!input || typeof input !== "object") throw Error("ข้อมูลรายชื่อไม่ถูกต้อง");
    const row = input as Record<string, unknown>;
    if (!Number.isSafeInteger(row.id) || Number(row.id) < 1 || ids.has(Number(row.id))) throw Error("ลำดับรายชื่อไม่ถูกต้องหรือซ้ำ");
    ids.add(Number(row.id));
    const fields = ["group", "department", "prefix", "first", "last", "hn", "cid"] as const;
    const s = { id: Number(row.id) } as StaffMember;
    for (const key of fields) {
      if (typeof row[key] !== "string" || row[key].length > 200) throw Error("ข้อความรายชื่อไม่ถูกต้องหรือยาวเกินไป");
      s[key] = cleanText(row[key]);
    }
    if (!s.first || !s.last || !s.group || !s.department) throw Error("ต้องระบุชื่อ นามสกุล และกลุ่มงาน/แผนก");
    if (s.hn && !/^[0-9A-Za-z-]{1,32}$/.test(s.hn)) throw Error("HN ไม่ถูกต้อง");
    if (s.cid && !/^\d{13}$/.test(s.cid)) throw Error("CID ต้องเป็นเลข 13 หลัก");
    const key = s.hn ? `hn:${s.hn}` : s.cid ? `cid:${s.cid}` : `name:${nameKey(s.first)}:${nameKey(s.last)}`;
    if (identities.has(key)) throw Error("รายชื่อหรือรหัสเจ้าหน้าที่ซ้ำ กรุณาตรวจสอบ");
    identities.add(key); return s;
  });
  return { start: v.start, end: v.end, staff };
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
  add(sqlNameKey("p.fname"),staff.filter(s=>!s.hn && !s.cid).map(s=>nameKey(s.first)));
  // Scan/filter patient once; never join every uploaded name to the entire patient table.
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
    const matches = s.hn ? (byHn.get(s.hn) ?? []).filter(p=>!s.cid || String(p.cid)===s.cid) : s.cid ? byCid.get(s.cid) ?? [] : byName.get(JSON.stringify([nameKey(s.first),nameKey(s.last)])) ?? [];
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
  const candidates = new Map<number, Set<string>>();
  for (const m of matches) {
    const set = candidates.get(Number(m.staff_id)) ?? new Set<string>();
    set.add(String(m.hn)); candidates.set(Number(m.staff_id), set);
  }
  const single = staff.map(s => ({ s, hns: [...(candidates.get(s.id) ?? [])] }));
  const uses = new Map<string, number>();
  for (const { hns } of single) if (hns.length === 1) uses.set(hns[0], (uses.get(hns[0]) ?? 0) + 1);
  return single.map(({ s, hns }): StaffDentalRow => {
    const status: StaffDentalStatus = !hns.length ? "not_found" : hns.length > 1 ? "ambiguous" : (uses.get(hns[0]) ?? 0) > 1 ? "duplicate_patient" : "not_done";
    return { ...s, name: `${s.prefix}${s.first} ${s.last}`, matchedHn: status === "not_done" ? hns[0] : null, status, visits: status === "not_done" ? 0 : null, firstVisit: null, lastVisit: null };
  });
}
export function summarizeStaffDental(rows: StaffDentalRow[]): StaffDentalSummary[] {
  const groups = new Map<string, StaffDentalSummary>();
  for (const row of rows) {
    const key = JSON.stringify([row.group, row.department]);
    const g = groups.get(key) ?? { group: row.group, department: row.department, staff: 0, done: 0, notDone: 0, unresolved: 0, visits: 0 };
    g.staff++; if (row.status === "done") g.done++; else if (row.status === "not_done") g.notDone++; else g.unresolved++;
    g.visits += row.visits ?? 0; groups.set(key, g);
  }
  return [...groups.values()].sort((a,b) => b.notDone - a.notDone || a.group.localeCompare(b.group, "th") || a.department.localeCompare(b.department, "th"));
}
export function staffDentalExport(report: StaffDentalReport) {
  const exportRows = (rows: StaffDentalRow[]) => rows.map(r => ({ วันที่เริ่ม: report.start, วันที่สิ้นสุด: report.end, กลุ่มงาน: r.group, แผนก: r.department, ชื่อ_นามสกุล: r.name, HN: r.matchedHn ?? "", จำนวน_visit: r.visits, วันที่ครั้งแรก: r.firstVisit ?? "", วันที่ล่าสุด: r.lastVisit ?? "", สถานะ: STAFF_DENTAL_STATUS[r.status] }));
  return {
    unfinished: exportRows(report.rows.filter(r => r.status === "not_done")),
    unresolved: exportRows(report.rows.filter(r => !["done", "not_done"].includes(r.status))),
    all: exportRows(report.rows),
    groups: report.groups.map(g => ({ กลุ่มงาน: g.group, แผนก: g.department, เจ้าหน้าที่_คน: g.staff, รับบริการแล้ว_คน: g.done, ยังไม่พบ_visit_คน: g.notDone, ต้องตรวจสอบ_คน: g.unresolved, visit_รวมที่จับคู่ได้: g.visits })),
  };
}
