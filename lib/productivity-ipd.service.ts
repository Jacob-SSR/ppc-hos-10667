// lib/productivity-ipd.service.ts
// SQL service สำหรับ Dashboard "ผลิตภาพการพยาบาล IPD" (Productivity IPD)
// อ้างอิงเกณฑ์กองการพยาบาล (หนังสือเหลืองสุพรรณหงส์) มาตรฐาน 90–110%
//
// ดึง "จำนวนผู้ป่วยครองเตียง (census)" รายวันของผู้ป่วยในทั้งโรงพยาบาลจาก HOSxP
// คิดรวมทั้ง IPD เป็นค่าเดียว (ไม่แยกราย ward)
//
// รองรับ 2 วิธีคำนวณ (สลับที่หน้าเพจ):
//   1) ตามประเภทหอผู้ป่วย : ชม.ที่ต้องการ = census × ชม.การพยาบาล/ราย
//   2) จำแนกประเภทผู้ป่วย  : ชม.ที่ต้องการ = Σ(จำนวนผู้ป่วยแต่ละระดับ × ชม./ราย)
//      → ดึง auto จาก HOSxP (ipd_nurse_note.ipd_nurse_patient_type_id)
//
//   ชม.จริง      = (พยาบาลเช้า + บ่าย + ดึก + หัวหน้า) × 7
//   Productivity = ชม.ที่ต้องการ ÷ ชม.จริง × 100
//
// ⚠️ NOTE จุดที่อิงโครงสร้าง HOSxP จริง (แก้ได้ที่นี่ที่เดียว):
//   - census ดึงจาก `ipt` (regdate/dchdate)
//   - ระดับผู้ป่วยดึงจาก `ipd_nurse_note` + master `ipd_nurse_patient_type`

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

// ชั่วโมงการพยาบาล/ราย ตามประเภทหอผู้ป่วย (สำหรับ dropdown โหมดที่ 1)
export interface WardType {
  label: string;
  hours: number;
}
export const WARD_TYPES: WardType[] = [
  { label: "อายุรกรรม", hours: 6 },
  { label: "กุมารเวชกรรม", hours: 6 },
  { label: "สูติกรรม", hours: 4 },
  { label: "นรีเวชกรรม", hours: 4 },
  { label: "ศัลยกรรม / ศัลยกรรมกระดูก", hours: 4.8 },
  { label: "ศัลยกรรมอุบัติเหตุ / ประสาท", hours: 6 },
  { label: "จิตเวช", hours: 6 },
  { label: "หอผู้ป่วยพิเศษ", hours: 6 },
  { label: "หอผู้ป่วยหนัก ICU", hours: 12 },
  { label: "ทุติยภูมิ ระดับต้น (Early Secondary)", hours: 3 },
  { label: "ทุติยภูมิ ระดับสูง (Late Secondary)", hours: 4.5 },
];

// ระดับความหนักผู้ป่วย IPD — ตรงกับ master `ipd_nurse_patient_type` (4 ระดับ)
// id = ipd_nurse_patient_type_id ; เรียงจากหนักมาก → พักฟื้น
// ชม./ราย แมปตามสเกลกองการพยาบาล (ปรับได้ที่ hours)
export interface IpdAcuity {
  id: number; // = ipd_nurse_patient_type_id
  key: string; // = String(id) ใช้เป็นคีย์ counts
  label: string;
  short: string;
  color: string;
  bg: string;
  hours: number;
}
export const IPD_ACUITY: IpdAcuity[] = [
  {
    id: 4,
    key: "4",
    label: "อาการหนักมาก",
    short: "Critical+",
    color: "#dc2626",
    bg: "#fee2e2",
    hours: 7.5,
  },
  {
    id: 3,
    key: "3",
    label: "อาการหนัก",
    short: "Critical",
    color: "#ea580c",
    bg: "#ffedd5",
    hours: 5.5,
  },
  {
    id: 2,
    key: "2",
    label: "อาการหนักปานกลาง",
    short: "Moderate",
    color: "#ca8a04",
    bg: "#fef9c3",
    hours: 3.5,
  },
  {
    id: 1,
    key: "1",
    label: "พักฟื้น",
    short: "Convalescent",
    color: "#0891b2",
    bg: "#cffafe",
    hours: 1.5,
  },
];
const ACUITY_IDS = IPD_ACUITY.map((a) => a.id);

const HOURS_PER_SHIFT = Number(process.env.IPD_HOURS_PER_SHIFT ?? 7);
const HOURS_PER_PATIENT = Number(process.env.IPD_HOURS_PER_PATIENT ?? 6); // โหมดประเภทหอ (ค่าเริ่มต้น)
const STANDARD_LOW = 90;
const STANDARD_HIGH = 110;

// จำนวนพยาบาล default ต่อเวร (รวมทั้ง IPD) — ตั้งใน .env ได้
const DEF_MORNING = Number(process.env.IPD_NURSE_MORNING ?? 8);
const DEF_AFTERNOON = Number(process.env.IPD_NURSE_AFTERNOON ?? 7);
const DEF_NIGHT = Number(process.env.IPD_NURSE_NIGHT ?? 5);
const DEF_HEAD = Number(process.env.IPD_HEAD_DEFAULT ?? 1);

export type Status = "low" | "ok" | "high";

export interface IpdDay {
  date: string;
  isWeekend: boolean;
  census: number; // ผู้ป่วยครองเตียงวันนั้น (จาก ipt)
  acuityCounts: Record<string, number>; // type id -> จำนวน (จาก ipd_nurse_note)
  acuityClassified: number; // รวมที่จำแนกระดับแล้ววันนั้น
  nurseMorning: number;
  nurseAfternoon: number;
  nurseNight: number;
  headStaff: number;
  nurseCount: number;
  actualHours: number;
  // ผลิตภาพแบบ "ตามประเภทหอ" (census × ชม./ราย) ใช้ในตาราง 7 วัน
  neededHours: number;
  productivity: number;
  status: Status;
}

export interface ProductivityIpdResult {
  updatedAt: string;
  today: IpdDay;
  history: IpdDay[];
  config: {
    hoursPerPatient: number;
    hoursPerShift: number;
    standardLow: number;
    standardHigh: number;
    defaultMorning: number;
    defaultAfternoon: number;
    defaultNight: number;
    defaultHead: number;
    wardTypes: WardType[];
    acuity: IpdAcuity[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function isWeekend(date: string): boolean {
  const dow = new Date(date + "T00:00:00").getDay();
  return dow === 0 || dow === 6;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── census ผู้ป่วยครองเตียง ณ วันที่กำหนด ────────────────────────────────────────
// census(D) = ผู้ป่วยที่ admit ก่อน/ภายในวัน D และยังไม่จำหน่ายก่อนวัน D
async function getCensus(dateStr: string): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>(
    `
    SELECT COUNT(*) AS cnt
    FROM ipt
    WHERE regdate <= ?
      AND (dchdate IS NULL OR dchdate = '0000-00-00' OR dchdate >= ?)
    `,
    [dateStr, dateStr],
  );
  return Number(rows?.[0]?.cnt) || 0;
}

// ─── นับผู้ป่วยแต่ละระดับความหนัก ณ วันที่กำหนด (จาก ipd_nurse_note) ──────────────
// เอา note ล่าสุด (nurse_note_id สูงสุด) ของแต่ละ AN ที่จำแนกระดับไว้ในวันนั้น
// → นับ 1 AN ต่อ 1 ระดับ (กันนับซ้ำหลายเวร)
async function getAcuityCounts(
  dateStr: string,
): Promise<{ counts: Record<string, number>; classified: number }> {
  const [rows] = await db.query<RowDataPacket[]>(
    `
    SELECT n.ipd_nurse_patient_type_id AS t, COUNT(*) AS cnt
    FROM ipd_nurse_note n
    JOIN (
      SELECT an, MAX(nurse_note_id) AS mx
      FROM ipd_nurse_note
      WHERE note_date = ?
        AND ipd_nurse_patient_type_id IS NOT NULL
        AND ipd_nurse_patient_type_id <> 0
      GROUP BY an
    ) last ON last.mx = n.nurse_note_id
    GROUP BY n.ipd_nurse_patient_type_id
    `,
    [dateStr],
  );

  const counts: Record<string, number> = {};
  let classified = 0;
  for (const id of ACUITY_IDS) counts[String(id)] = 0;
  for (const r of rows) {
    const id = Number(r.t);
    const cnt = Number(r.cnt) || 0;
    if (ACUITY_IDS.includes(id)) {
      counts[String(id)] = cnt;
      classified += cnt;
    }
  }
  return { counts, classified };
}

// ─── คำนวณ 1 วัน (ผลิตภาพแบบตามประเภทหอ + แนบยอดจำแนกระดับ) ───────────────────────
function buildDay(
  date: string,
  census: number,
  acuity: { counts: Record<string, number>; classified: number },
  m: number,
  a: number,
  n: number,
  head: number,
): IpdDay {
  const nurseCount = m + a + n + head;
  const actual = nurseCount * HOURS_PER_SHIFT;
  const needed = census * HOURS_PER_PATIENT;
  const productivity = actual > 0 ? round2((needed / actual) * 100) : 0;
  const status: Status =
    productivity < STANDARD_LOW
      ? "low"
      : productivity <= STANDARD_HIGH
        ? "ok"
        : "high";

  return {
    date,
    isWeekend: isWeekend(date),
    census,
    acuityCounts: acuity.counts,
    acuityClassified: acuity.classified,
    nurseMorning: m,
    nurseAfternoon: a,
    nurseNight: n,
    headStaff: head,
    nurseCount,
    actualHours: actual,
    neededHours: round2(needed),
    productivity,
    status,
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export async function getProductivityIpd(): Promise<ProductivityIpdResult> {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const history: IpdDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = fmt(d);
    const [census, acuity] = await Promise.all([
      getCensus(ds),
      getAcuityCounts(ds),
    ]);
    const head = isWeekend(ds) ? 0 : DEF_HEAD; // วันหยุดหัวหน้าไม่อยู่
    history.push(
      buildDay(ds, census, acuity, DEF_MORNING, DEF_AFTERNOON, DEF_NIGHT, head),
    );
  }

  return {
    updatedAt: new Date().toISOString(),
    today: history[history.length - 1],
    history,
    config: {
      hoursPerPatient: HOURS_PER_PATIENT,
      hoursPerShift: HOURS_PER_SHIFT,
      standardLow: STANDARD_LOW,
      standardHigh: STANDARD_HIGH,
      defaultMorning: DEF_MORNING,
      defaultAfternoon: DEF_AFTERNOON,
      defaultNight: DEF_NIGHT,
      defaultHead: DEF_HEAD,
      wardTypes: WARD_TYPES,
      acuity: IPD_ACUITY,
    },
  };
}
