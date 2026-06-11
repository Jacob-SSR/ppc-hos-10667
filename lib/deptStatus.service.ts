// lib/deptStatus.service.ts
// ดึง + สรุปสถานะผู้ป่วยตามแผนก (OPD) ของวันที่กำหนด
import { db } from "@/lib/db";
import type {
  DeptStatusCard,
  DeptPatientRow,
  DeptStatusCount,
  DeptStatusData,
} from "@/lib/deptStatus.types";

/**
 * รายการ keyword ของ "ชื่อสถานะ" (ovstost.name) หรือ "ชื่อแผนกปัจจุบัน"
 * ที่ถือว่าผู้ป่วย "เสร็จ / ออกจาก OPD แล้ว"
 * (เช่น แผนกปลายทาง "กลับบ้าน" = ออกจากระบบ ไม่ใช่แผนกตรวจจริง)
 *
 * 👉 ปรับลิสต์นี้ให้ตรงกับชื่อสถานะจริงของโรงพยาบาลได้เลย
 *    (เปิดหน้า dashboard แล้วดูแถว "สถานะผู้ป่วยขณะนี้" หรือเรียก API ?debug=1
 *     เพื่อดูชื่อสถานะทั้งหมดที่มีจริง)
 *
 * หมายเหตุ: ใช้การ "มีคำนี้อยู่ในชื่อ" (includes) — ระวังอย่าใส่คำกว้างเกินไป
 *   - "เสร็จ"  จะไม่ match "ตรวจแล้ว" (ดี เพราะตรวจแล้วยังไม่เสร็จ ต้องไปรับยา)
 *   - ไม่ใส่ "แล้ว" เด็ดขาด เพราะจะไป match "ตรวจแล้ว", "รอตรวจแล้ว" ที่ยังไม่เสร็จ
 */
const FINISHED_STATUS_KEYWORDS = [
  "รับยาแล้ว",
  "กลับบ้าน",
  "จำหน่าย",
  "เสร็จสิ้น",
  "Admit", // admit เข้า ward = ออกจาก flow OPD แล้ว
  "ส่งต่อ",
  "refer",
  "เสียชีวิต",
  "ถึงแก่กรรม",
  "dead",
];

function isFinishedStatus(name: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return FINISHED_STATUS_KEYWORDS.some((k) => n.includes(k.toLowerCase()));
}

function clean(v: unknown): string {
  return (v == null ? "" : String(v)).trim();
}

interface Row {
  vn: string;
  hn: string;
  cur_dep: string;
  cur_dep_name: string;
  last_dep: string;
  last_dep_name: string;
  status_name: string;
  vsttime: string;
  patient_name: string;
}

export async function getDeptStatus(date: string): Promise<DeptStatusData> {
  // NOTE: เอา "AND o.an IS NULL" ออก เพื่อให้ตรงกับ query ต้นฉบับ
  //       คนที่ถูก admit จะยังอยู่ใน ovst และขึ้นสถานะ "Admit แผนก..." (= เสร็จจาก OPD)
  const sql = `
    SELECT
      o.vn,
      o.hn,
      o.cur_dep                              AS cur_dep,
      kc.department                          AS cur_dep_name,
      o.last_dep                             AS last_dep,
      kl.department                          AS last_dep_name,
      os.name                                AS status_name,
      o.vsttime                              AS vsttime,
      CONCAT_WS(' ', p.pname, p.fname, p.lname) AS patient_name
    FROM ovst o
    LEFT JOIN kskdepartment kc ON kc.depcode = o.cur_dep
    LEFT JOIN kskdepartment kl ON kl.depcode = o.last_dep
    LEFT JOIN ovstost      os ON os.ovstost  = o.ovstost
    LEFT JOIN patient       p ON p.hn        = o.hn
    WHERE o.vstdate = ?
    ORDER BY o.vsttime
  `;

  const [rows] = (await db.query(sql, [date])) as unknown as [Row[], unknown];

  // ---- เตรียมตัวสะสมต่อแผนก ----
  interface Agg {
    code: string;
    name: string;
    entered: Set<string>; // vn ที่ cur=X หรือ last=X
    active: Set<string>; // vn ที่ cur=X และยังไม่เสร็จ
  }
  const deptMap = new Map<string, Agg>();
  const ensure = (code: string, name: string): Agg => {
    let a = deptMap.get(code);
    if (!a) {
      a = { code, name: name || code, entered: new Set(), active: new Set() };
      deptMap.set(code, a);
    } else if (!a.name || a.name === a.code) {
      if (name) a.name = name; // เติมชื่อถ้าเพิ่งมี
    }
    return a;
  };

  const statusMap = new Map<string, { count: number; finished: boolean }>();
  const patients: DeptPatientRow[] = [];
  const allVn = new Set<string>();
  let totalActive = 0;
  let totalDone = 0;

  for (const r of rows) {
    const vn = clean(r.vn);
    const hn = clean(r.hn);
    const curCode = clean(r.cur_dep);
    const curName = clean(r.cur_dep_name);
    const lastCode = clean(r.last_dep);
    const lastName = clean(r.last_dep_name);
    const status = clean(r.status_name) || "ไม่ระบุ";
    // ถ้า "แผนกปัจจุบัน" คือจุดออกจากระบบ (เช่น "กลับบ้าน", "จำหน่าย") = ออกไปแล้ว
    const exitDept = isFinishedStatus(curName);
    const finished = isFinishedStatus(status) || exitDept;

    allVn.add(vn);
    if (finished) totalDone++;
    else totalActive++;

    // สรุปตามสถานะ
    const s = statusMap.get(status) ?? { count: 0, finished };
    s.count++;
    statusMap.set(status, s);

    // entered ของแผนกปัจจุบัน: ข้ามถ้าเป็นแผนกจุดออก (ไม่ต้องมีการ์ด "กลับบ้าน")
    if (curCode && !exitDept) {
      ensure(curCode, curName).entered.add(vn);
      // active: ยังอยู่แผนกนี้ (cur) และยังไม่เสร็จ
      if (!finished) ensure(curCode, curName).active.add(vn);
    }
    // แผนกก่อนหน้า (last) ยังนับเป็น "ผ่าน/เสร็จ" ที่แผนกจริงนั้น
    if (lastCode && lastCode !== curCode)
      ensure(lastCode, lastName).entered.add(vn);

    patients.push({
      vn,
      hn,
      patient_name: clean(r.patient_name) || hn,
      cur_dep_code: curCode,
      cur_dep_name: curName || curCode,
      last_dep_code: lastCode,
      last_dep_name: lastName || lastCode,
      status,
      isFinished: finished,
      vsttime: clean(r.vsttime),
    });
  }

  // ---- สร้างการ์ด ----
  const cards: DeptStatusCard[] = [];
  for (const a of deptMap.values()) {
    const entered = a.entered.size;
    const active = a.active.size;
    const done = Math.max(0, entered - active);
    const percent =
      entered > 0 ? Math.round((active / entered) * 1000) / 10 : 0;
    cards.push({
      dep_code: a.code,
      dep_name: a.name,
      entered,
      active,
      done,
      percent,
    });
  }
  // เรียง % คงค้างมาก -> น้อย, แล้วค่อยตามจำนวนที่ยังค้าง
  cards.sort((a, b) => b.percent - a.percent || b.active - a.active);

  // ---- byStatus เรียงจำนวนมาก -> น้อย ----
  const byStatus: DeptStatusCount[] = Array.from(statusMap.entries())
    .map(([name, v]) => ({ name, count: v.count, finished: v.finished }))
    .sort((a, b) => b.count - a.count);

  return {
    updatedAt: new Date().toISOString(),
    date,
    totalVisits: allVn.size,
    totalActive,
    totalDone,
    cards,
    patients,
    byStatus,
  };
}
