// lib/productivity-er.service.ts
// SQL service สำหรับ Dashboard "ผลิตภาพการพยาบาล ER" (Productivity ER)
// อ้างอิงเกณฑ์กองการพยาบาล (หนังสือเหลืองสุพรรณหงส์) มาตรฐาน 90–110%
//
// ดึงจำนวนผู้ป่วย ER แยกตามระดับ Triage จาก HOSxP (er_regist.er_emergency_level_id)
// ใช้ 4 ช่อง: ช่องแดง "Emergency" รวม Resuscitation + Emergency (id 1+2) เข้าด้วยกัน
// ส่วน OPD case (สีขาว) / ไม่ระบุระดับ จะไม่ถูกนับเข้าการคำนวณ
//
// สูตร:
//   ชม.ที่ต้องการ = Σ(จำนวนผู้ป่วยแต่ละระดับ × ชม./visit ของระดับนั้น)
//   ชม.จริง       = (พยาบาลเช้า + บ่าย + ดึก + หัวหน้า) × 7
//   Productivity  = ชม.ที่ต้องการ ÷ ชม.จริง × 100

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

export interface ErTriage {
  key: string; // คีย์คงที่สำหรับ UI/นับยอด
  ids: number[]; // er_emergency_level_id ที่ map เข้าช่องนี้ (แดงรวม 1+2)
  label: string;
  short: string;
  color: string;
  bg: string;
  hours: number;
}

// 4 ช่อง — แดงรวม Resuscitation(1)+Emergency(2); ส้ม=3, เหลือง=4, เขียว=5
// (OPD case/สีขาว หรือระดับที่ไม่อยู่ใน 1..5 = ไม่นับ)
export const ER_TRIAGE: ErTriage[] = [
  {
    key: "red",
    ids: [1, 2],
    label: "Emergency (สีแดง)",
    short: "รอไม่ได้ CPR/หยุดหายใจ",
    color: "#dc2626",
    bg: "#fee2e2",
    hours: 3.2,
  },
  {
    key: "orange",
    ids: [3],
    label: "Urgent (สีส้ม)",
    short: "รอ <10 นาที V/S ผิดปกติ",
    color: "#ea580c",
    bg: "#ffedd5",
    hours: 2.5,
  },
  {
    key: "yellow",
    ids: [4],
    label: "Non Urgent (สีเหลือง)",
    short: "หัตถการ > 1 อย่าง",
    color: "#ca8a04",
    bg: "#fef9c3",
    hours: 1.0,
  },
  {
    key: "green",
    ids: [5],
    label: "non Ac-non Ur (สีเขียว)",
    short: "หัตถการ 1 อย่าง",
    color: "#16a34a",
    bg: "#dcfce7",
    hours: 0.5,
  },
];

const HOURS_PER_SHIFT = Number(process.env.ER_HOURS_PER_SHIFT ?? 7);
const STANDARD_LOW = 90;
const STANDARD_HIGH = 110;

// จำนวนพยาบาล default ต่อเวร (ER เปิด 24 ชม. = 3 เวร) — ตั้งใน .env ได้
const DEF_MORNING = Number(process.env.ER_NURSE_MORNING ?? 3);
const DEF_AFTERNOON = Number(process.env.ER_NURSE_AFTERNOON ?? 3);
const DEF_NIGHT = Number(process.env.ER_NURSE_NIGHT ?? 2);
const DEF_HEAD = Number(process.env.ER_HEAD_DEFAULT ?? 1);

export type Status = "low" | "ok" | "high";

export interface ErDay {
  date: string;
  isWeekend: boolean;
  counts: Record<string, number>; // tier key ("red"/"orange"/...) -> จำนวนผู้ป่วย
  erTotal: number; // ผู้ป่วย ER ทั้งหมด (รวมระดับ 5 / ไม่ระบุ)
  classified: number; // ผู้ป่วยในระดับ 1..4
  unclassified: number; // ระดับ 5 / ไม่ระบุ (ไม่นำมาคำนวณ)
  nurseMorning: number;
  nurseAfternoon: number;
  nurseNight: number;
  headStaff: number;
  nurseCount: number;
  neededHours: number;
  actualHours: number;
  productivity: number;
  status: Status;
}

export interface ProductivityErResult {
  updatedAt: string;
  today: ErDay;
  history: ErDay[];
  config: {
    triage: ErTriage[];
    hoursPerShift: number;
    standardLow: number;
    standardHigh: number;
    defaultMorning: number;
    defaultAfternoon: number;
    defaultNight: number;
    defaultHead: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// mysql2 คืน DATE เป็น Date object → สร้าง key จาก local Y-M-D (ห้าม toISOString)
function dateKey(d: unknown): string {
  if (d instanceof Date) return fmt(d);
  return String(d).slice(0, 10);
}

function isWeekend(date: string): boolean {
  const dow = new Date(date + "T00:00:00").getDay();
  return dow === 0 || dow === 6;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface DayAgg {
  byLevel: Record<number, number>;
  total: number;
}

// ─── ดึงจำนวน ER แยกระดับ ต่อวัน ───────────────────────────────────────────────
async function getErCounts(
  start: string,
  end: string,
): Promise<Record<string, DayAgg>> {
  const [rows] = await db.query<RowDataPacket[]>(
    `
    SELECT er.vstdate                AS d,
           er.er_emergency_level_id  AS lvl,
           COUNT(*)                  AS cnt
    FROM er_regist er
    WHERE er.vstdate BETWEEN ? AND ?
    GROUP BY er.vstdate, er.er_emergency_level_id
    `,
    [start, end],
  );

  const map: Record<string, DayAgg> = {};
  for (const r of rows) {
    const d = dateKey(r.d);
    if (!map[d]) map[d] = { byLevel: {}, total: 0 };
    const lvl = Number(r.lvl);
    const cnt = Number(r.cnt) || 0;
    map[d].total += cnt;
    // เก็บทุกระดับตาม raw id (ไปจัดกลุ่มเป็นช่อง/รวม 1+2 ใน buildDay)
    map[d].byLevel[lvl] = (map[d].byLevel[lvl] || 0) + cnt;
  }
  return map;
}

// ─── คำนวณ 1 วัน ───────────────────────────────────────────────────────────────
function buildDay(
  date: string,
  agg: DayAgg | undefined,
  m: number,
  a: number,
  n: number,
  head: number,
): ErDay {
  const byLevel = agg?.byLevel ?? {};
  const erTotal = agg?.total ?? 0;

  let needed = 0;
  let classified = 0;
  const counts: Record<string, number> = {};
  for (const t of ER_TRIAGE) {
    const c = t.ids.reduce((s, id) => s + (byLevel[id] ?? 0), 0);
    counts[t.key] = c;
    needed += c * t.hours;
    classified += c;
  }

  const nurseCount = m + a + n + head;
  const actual = nurseCount * HOURS_PER_SHIFT;
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
    counts,
    erTotal,
    classified,
    unclassified: Math.max(0, erTotal - classified),
    nurseMorning: m,
    nurseAfternoon: a,
    nurseNight: n,
    headStaff: head,
    nurseCount,
    neededHours: round2(needed),
    actualHours: actual,
    productivity,
    status,
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export async function getProductivityEr(): Promise<ProductivityErResult> {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(today);
  start.setDate(today.getDate() - 6);

  const counts = await getErCounts(fmt(start), fmt(today));

  const history: ErDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = fmt(d);
    const head = isWeekend(ds) ? 0 : DEF_HEAD; // วันหยุดหัวหน้าไม่อยู่
    history.push(
      buildDay(ds, counts[ds], DEF_MORNING, DEF_AFTERNOON, DEF_NIGHT, head),
    );
  }

  return {
    updatedAt: new Date().toISOString(),
    today: history[history.length - 1],
    history,
    config: {
      triage: ER_TRIAGE,
      hoursPerShift: HOURS_PER_SHIFT,
      standardLow: STANDARD_LOW,
      standardHigh: STANDARD_HIGH,
      defaultMorning: DEF_MORNING,
      defaultAfternoon: DEF_AFTERNOON,
      defaultNight: DEF_NIGHT,
      defaultHead: DEF_HEAD,
    },
  };
}
