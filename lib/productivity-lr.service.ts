// lib/productivity-lr.service.ts
// SQL service สำหรับ Dashboard "ผลิตภาพการพยาบาลห้องคลอด (LR)" (Productivity LR)
// อ้างอิงเกณฑ์กองการพยาบาล (หนังสือเหลืองสุพรรณหงส์) มาตรฐาน 90–110%
//
// ขอบเขต: เฉพาะห้องคลอด (คลอด + รอคลอด + หลังคลอด) — ไม่รวม ANC
// ภาระงานเป็นแบบ "ต่อราย" (ไม่ใช่ census) เหมือน ER/OPD
//   ตัวตั้ง  = Σ(จำนวนงานแต่ละประเภท × ชม./ราย)
//   ตัวหาร  = (พยาบาลเช้า + บ่าย + ดึก + หัวหน้า) × 7
//   Productivity = ตัวตั้ง ÷ ตัวหาร × 100
//
// แหล่งข้อมูล (ตรงกับ anc.service.ts เดิม):
//   ipt_pregnancy.labor_date = วันคลอด → นับ "ผู้คลอด" auto
//   ipt_labour / ipt_labour_infant      → นับทารก
//   ส่วน "รอคลอด" และ "หลังคลอด" ไม่ได้แยกชัดใน HOSxP → กรอกเองที่หน้าเพจ

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

// ประเภทงานห้องคลอด + ชม./ราย (placeholder — ยืนยัน/แก้จากเกณฑ์ห้องคลอดได้)
export interface LrWork {
  key: string;
  label: string;
  short: string;
  color: string;
  bg: string;
  hours: number;
  auto: boolean; // true = ดึงจาก HOSxP (ผู้คลอด) / false = กรอกเอง
}
export const LR_WORK: LrWork[] = [
  {
    key: "delivery",
    label: "ผู้คลอด (คลอด ณ รพ.)",
    short: "รอคลอด → คลอด → หลังคลอด 2 ชม.",
    color: "#dc2626",
    bg: "#fee2e2",
    hours: 6,
    auto: true,
  },
  {
    key: "observe",
    label: "รอคลอด/สังเกต (ไม่ได้คลอด)",
    short: "false labour, ส่งต่อก่อนคลอด",
    color: "#ca8a04",
    bg: "#fef9c3",
    hours: 3,
    auto: false,
  },
  {
    key: "postpartum",
    label: "ดูแลหลังคลอด (ต่อเนื่อง)",
    short: "มารดาหลังคลอดที่ดูแลต่อ",
    color: "#0891b2",
    bg: "#cffafe",
    hours: 2,
    auto: false,
  },
];
const DELIVERY_HOURS = LR_WORK.find((w) => w.key === "delivery")!.hours;

const HISTORY_DAYS = Number(process.env.LR_HISTORY_DAYS ?? 30);
const HOURS_PER_SHIFT = Number(process.env.LR_HOURS_PER_SHIFT ?? 7);
const STANDARD_LOW = 90;
const STANDARD_HIGH = 110;

// จำนวนพยาบาลห้องคลอด default ต่อเวร (24 ชม. = 3 เวร) — ตั้งใน .env ได้
const DEF_MORNING = Number(process.env.LR_NURSE_MORNING ?? 2);
const DEF_AFTERNOON = Number(process.env.LR_NURSE_AFTERNOON ?? 2);
const DEF_NIGHT = Number(process.env.LR_NURSE_NIGHT ?? 2);
const DEF_HEAD = Number(process.env.LR_HEAD_DEFAULT ?? 1);

export type Status = "low" | "ok" | "high";

export interface LrDay {
  date: string;
  weekday: string;
  isWeekend: boolean;
  deliveries: number; // ผู้คลอด (จาก ipt_pregnancy)
  babies: number; // ทารก (จาก ipt_labour_infant)
  nurseMorning: number;
  nurseAfternoon: number;
  nurseNight: number;
  headStaff: number;
  nurseCount: number;
  actualHours: number;
  neededHours: number; // = ผู้คลอด × ชม./ราย (ส่วน auto เท่านั้น)
  productivity: number;
  status: Status;
}

export interface ProductivityLrResult {
  updatedAt: string;
  today: LrDay;
  history: LrDay[]; // เรียงเก่า→ใหม่ (ยังไม่กรองวันว่าง — หน้าเพจกรองเอง)
  totalDeliveries: number;
  workingDays: number;
  config: {
    work: LrWork[];
    hoursPerShift: number;
    historyDays: number;
    standardLow: number;
    standardHigh: number;
    defaultMorning: number;
    defaultAfternoon: number;
    defaultNight: number;
    defaultHead: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const WEEKDAY_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
function ymd(d: unknown): string {
  if (d instanceof Date) return fmt(d);
  return String(d).slice(0, 10);
}
function isWeekend(date: string): boolean {
  const dow = new Date(date + "T00:00:00").getDay();
  return dow === 0 || dow === 6;
}
function weekdayTh(date: string): string {
  return WEEKDAY_TH[new Date(date + "T00:00:00").getDay()];
}
const round2 = (n: number) => Math.round(n * 100) / 100;

interface DayAgg {
  deliveries: number;
  babies: number;
}

// ─── ดึงจำนวนผู้คลอด + ทารก ต่อวัน (จาก ipt_pregnancy) ────────────────────────────
async function getDeliveryCounts(
  start: string,
  end: string,
): Promise<Record<string, DayAgg>> {
  const [rows] = await db.query<RowDataPacket[]>(
    `
    SELECT ip.labor_date              AS d,
           COUNT(DISTINCT ip.an)      AS deliveries,
           COUNT(inf.ipt_labour_id)   AS babies
    FROM ipt_pregnancy ip
    LEFT JOIN ipt_labour il        ON il.an = ip.an
    LEFT JOIN ipt_labour_infant inf ON inf.ipt_labour_id = il.ipt_labour_id
    WHERE ip.labor_date BETWEEN ? AND ?
    GROUP BY ip.labor_date
    `,
    [start, end],
  );

  const map: Record<string, DayAgg> = {};
  for (const r of rows) {
    map[ymd(r.d)] = {
      deliveries: Number(r.deliveries) || 0,
      babies: Number(r.babies) || 0,
    };
  }
  return map;
}

// ─── คำนวณ 1 วัน (ผลิตภาพจากผู้คลอด — ส่วน auto) ─────────────────────────────────
function buildDay(
  date: string,
  agg: DayAgg | undefined,
  m: number,
  a: number,
  n: number,
  head: number,
): LrDay {
  const deliveries = agg?.deliveries ?? 0;
  const babies = agg?.babies ?? 0;

  const nurseCount = m + a + n + head;
  const actual = nurseCount * HOURS_PER_SHIFT;
  const needed = deliveries * DELIVERY_HOURS;
  const productivity = actual > 0 ? round2((needed / actual) * 100) : 0;
  const status: Status =
    productivity < STANDARD_LOW
      ? "low"
      : productivity <= STANDARD_HIGH
        ? "ok"
        : "high";

  return {
    date,
    weekday: weekdayTh(date),
    isWeekend: isWeekend(date),
    deliveries,
    babies,
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
export async function getProductivityLr(): Promise<ProductivityLrResult> {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(today);
  start.setDate(today.getDate() - (HISTORY_DAYS - 1));

  const counts = await getDeliveryCounts(fmt(start), fmt(today));

  const history: LrDay[] = [];
  let totalDeliveries = 0;
  let workingDays = 0;
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = fmt(d);
    const day = buildDay(
      ds,
      counts[ds],
      DEF_MORNING,
      DEF_AFTERNOON,
      DEF_NIGHT,
      DEF_HEAD,
    );
    history.push(day);
    totalDeliveries += day.deliveries;
    if (day.deliveries > 0) workingDays += 1;
  }

  return {
    updatedAt: new Date().toISOString(),
    today: history[history.length - 1],
    history,
    totalDeliveries,
    workingDays,
    config: {
      work: LR_WORK,
      hoursPerShift: HOURS_PER_SHIFT,
      historyDays: HISTORY_DAYS,
      standardLow: STANDARD_LOW,
      standardHigh: STANDARD_HIGH,
      defaultMorning: DEF_MORNING,
      defaultAfternoon: DEF_AFTERNOON,
      defaultNight: DEF_NIGHT,
      defaultHead: DEF_HEAD,
    },
  };
}
