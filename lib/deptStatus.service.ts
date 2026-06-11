// lib/deptStatus.service.ts
// SQL service สำหรับ Dashboard สถานะผู้ป่วยตามแผนก (Dept Status — OPD real-time)
//
// แนวคิด: ต่อยอดจาก query "สถานะผู้ป่วยประจำวัน"
//   SELECT o.hn,o.vstdate,o.vsttime,k.department,k1.department FROM ovst o
//   LEFT JOIN kskdepartment k  ON o.cur_dep  = k.depcode
//   LEFT JOIN kskdepartment k1 ON o.last_dep = k1.depcode
//   WHERE o.vstdate = ?
//
// นิยามต่อ "แผนก X" (จัดกลุ่มด้วย cur_dep):
//   - entered (เข้าแผนกนี้ทั้งหมด) = visit ที่ cur_dep = X  หรือ  last_dep = X
//   - active  (ยังไม่เสร็จ/ยังอยู่) = visit ที่ cur_dep = X และยังไม่ถูกจำหน่าย (ovstost ไม่ใช่ 98/99)
//   - percent = active / entered * 100
//   → % สูง = แผนกนั้นยังมีคนค้างเยอะเมื่อเทียบกับที่ผ่านเข้ามา (คอขวด)
//
// เป็น OPD เท่านั้น (o.an IS NULL) — ไม่เกี่ยวกับ IPD

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import type {
  DeptStatusCard,
  DeptPatientRow,
  DeptStatusData,
} from "@/lib/deptStatus.types";

// ovstost ที่ถือว่า "จำหน่าย/เสร็จสิ้น" แล้ว (ปรับตาม master ของ รพ. ได้)
const DISCHARGED_STATUS = ["99", "98"];

// code/label สำหรับ visit ที่ไม่มี cur_dep
const NONE_CODE = "__none__";
const NONE_LABEL = "ไม่ระบุแผนก";

interface VisitDeptRow extends RowDataPacket {
  vn: string;
  hn: string;
  patient_name: string;
  cur_dep: string | null;
  cur_dep_name: string | null;
  last_dep: string | null;
  last_dep_name: string | null;
  ovstost: string | null;
  ovstost_name: string | null;
  vsttime: string | null;
}

const clean = (v: unknown) => (v == null ? "" : String(v).trim());

export async function getDeptStatus(date: string): Promise<DeptStatusData> {
  const [rows] = await db.query<VisitDeptRow[]>(
    `
    SELECT
      o.vn,
      o.hn,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS patient_name,
      o.cur_dep,
      kc.department  AS cur_dep_name,
      o.last_dep,
      kl.department  AS last_dep_name,
      o.ovstost,
      os.name        AS ovstost_name,
      o.vsttime
    FROM ovst o
    LEFT JOIN kskdepartment kc ON kc.depcode = o.cur_dep
    LEFT JOIN kskdepartment kl ON kl.depcode = o.last_dep
    LEFT JOIN patient pt       ON pt.hn = o.hn
    LEFT JOIN ovstost os       ON os.ovstost = o.ovstost
    WHERE o.vstdate = ?
      AND o.an IS NULL
    ORDER BY o.vsttime
    `,
    [date],
  );

  // ── aggregate ต่อแผนก ──
  const deptMap = new Map<
    string,
    { name: string; entered: Set<string>; active: Set<string> }
  >();

  const ensure = (code: string, name: string) => {
    if (!deptMap.has(code)) {
      deptMap.set(code, {
        name: name || code,
        entered: new Set<string>(),
        active: new Set<string>(),
      });
    }
    const d = deptMap.get(code)!;
    // อัปเดตชื่อถ้าเดิมว่าง (เผื่อเจอชื่อทีหลัง)
    if ((!d.name || d.name === code) && name) d.name = name;
    return d;
  };

  let totalActive = 0;
  const patients: DeptPatientRow[] = [];

  for (const r of rows) {
    const isDischarged =
      r.ovstost != null && DISCHARGED_STATUS.includes(clean(r.ovstost));

    const curCode = clean(r.cur_dep) || NONE_CODE;
    const curName =
      clean(r.cur_dep_name) || (curCode === NONE_CODE ? NONE_LABEL : curCode);
    const lastCode = clean(r.last_dep);
    const lastName = clean(r.last_dep_name) || lastCode;

    // แผนกปัจจุบัน: เข้าแล้ว + (ถ้ายังไม่จำหน่าย) นับเป็น active
    const curDept = ensure(curCode, curName);
    curDept.entered.add(r.vn);
    if (!isDischarged) curDept.active.add(r.vn);

    // แผนกก่อนหน้า: เข้าแล้ว (แต่ไม่นับ active เพราะออกจากแผนกนั้นไปแล้ว)
    if (lastCode && lastCode !== curCode) {
      ensure(lastCode, lastName).entered.add(r.vn);
    }

    if (!isDischarged) totalActive++;

    patients.push({
      vn: r.vn,
      hn: r.hn,
      patient_name: clean(r.patient_name),
      cur_dep_code: curCode,
      cur_dep_name: curName,
      last_dep_code: lastCode,
      last_dep_name: lastName || "—",
      status: isDischarged
        ? "เสร็จ/จำหน่าย"
        : clean(r.ovstost_name) || "กำลังรับบริการ",
      isDischarged,
      vsttime: clean(r.vsttime).slice(0, 5),
    });
  }

  const cards: DeptStatusCard[] = [...deptMap.entries()]
    .map(([code, d]) => {
      const entered = d.entered.size;
      const active = d.active.size;
      return {
        dep_code: code,
        dep_name: d.name,
        entered,
        active,
        done: entered - active,
        percent: entered > 0 ? Math.round((active / entered) * 100) : 0,
      };
    })
    // เรียง: % คงค้างมากไปน้อย (100% อยู่บนสุด), เท่ากันใช้จำนวนคนค้างมากก่อน
    .sort((a, b) => b.percent - a.percent || b.active - a.active);

  return {
    updatedAt: new Date().toISOString(),
    date,
    totalVisits: rows.length,
    totalActive,
    totalDone: rows.length - totalActive,
    cards,
    patients,
  };
}
