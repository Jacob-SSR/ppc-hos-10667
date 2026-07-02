// app/api/minithan-sheets/route.ts
// ดึงข้อมูลผู้ป่วยมินิธัญญารักษ์ (โปรแกรม IMC) จาก Google Sheets แบบ real-time
// Spreadsheet: "ผู้ป่วยยาเสพติด 2569" — กรองเฉพาะแถวที่คอลัมน์ HW/IMC/MP มีคำว่า "IMC"
// (รวมเคส IMC/MP, IMC/MP/IMC, IMC ล้วน ฯลฯ)

import { NextResponse } from "next/server";
import {
  getSheetClient,
  getFirstSheetTitle,
  getValues,
  toStr,
  toNumOrNull,
  countBy,
  parseDate,
  sheetsError,
} from "@/lib/sheets";

const SPREADSHEET_ID =
  process.env.MINITHAN_SPREADSHEET_ID ||
  "1NokZz-8JYoK99X6996VG-DWPl940VsSkQqPjDjq3X-s";

const TOTAL_WEEKS = 16;
const FOLLOWUP_KEYS = ["w2", "m1", "m2", "m3", "m6", "m9", "y1"] as const;
type FollowUpKey = (typeof FOLLOWUP_KEYS)[number];
const FOLLOWUP_LABELS: Record<FollowUpKey, string> = {
  w2: "2 สัปดาห์",
  m1: "1 เดือน",
  m2: "2 เดือน",
  m3: "3 เดือน",
  m6: "6 เดือน",
  m9: "9 เดือน",
  y1: "1 ปี",
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MiniThanRow {
  no: number;
  treatStatus: string; // สถานะ: บำบัด/ติดตาม/จำหน่าย
  detailStatus: string; // สถานะการรักษาปัจจุบัน: Metrix/Dropout/treat ครบ ฯลฯ
  program: string; // HW/IMC/MP ดิบ
  referralMethod: string; // วิธีการมาบำบัด
  referralSource: string; // การนำส่ง
  tambon: string;
  hn: string;
  prefix: string;
  firstName: string;
  lastName: string;
  age: number | null;
  v2Score: number | null;
  colorSeverity: string;
  patientType: string; // ประเภท: "ใหม่" / "เก่าจบ" / "เก่า Drop out" / "อื่นๆ"
  startDate: string; // เริ่มมาจริง
  bsotStartDate: string; // เริ่มลงบสต.
  treatEndDate: string; // ว.ด.ป.จบบำบัด
  weeks: (string | null)[]; // 16 ช่อง — วันที่มา หรือ null
  weeksAttended: number;
  lastWeekIndex: number; // สัปดาห์ล่าสุดที่มีข้อมูล (progress)
  followUp: Record<FollowUpKey, string | null>;
  followUpAttended: number;
  isDropout: boolean;
  isTreatComplete: boolean;
  excludeFromDenominator: boolean; // ถูกจับ/เสียชีวิต/Methadone — ไม่นับใน denominator retention
  note: string;
}

export interface WeeklyRetentionPoint {
  week: number;
  label: string;
  count: number;
  pct: number;
}

export interface FollowUpMilestone {
  key: FollowUpKey;
  label: string;
  attended: number;
  eligible: number;
  pct: number;
}

export interface MiniThanSummary {
  total: number;
  inTreatment: number;
  followUp: number;
  discharged: number;
  treatComplete: number;
  dropout: number;
  newPatients: number; // รายใหม่
  oldDone: number; // รายเก่าที่จบบำบัดแล้ว
  oldDropout: number; // รายเก่าที่ Drop out
  avgAge: number;
  avgV2: number;
  male: number;
  female: number;
  retentionRate: number;
  byColor: Record<string, number>;
  byTambon: Record<string, number>;
  byReferral: Record<string, number>;
  byDetailStatus: Record<string, number>;
  byPatientType: Record<string, number>;
  weeklyRetention: WeeklyRetentionPoint[];
  followUpMilestones: FollowUpMilestone[];
  byMonth: { month: string; count: number }[];
}

export interface MiniThanDashboardData {
  updatedAt: string;
  sheetName: string;
  summary: MiniThanSummary;
  rows: MiniThanRow[];
  debug?: { headers: string[]; sampleRow: string[] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const THAI_M = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];
function monthLabelBE(key: string): string {
  const [y, m] = key.split("-");
  const idx = parseInt(m, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx > 11) return key;
  return `${THAI_M[idx]} ${String(parseInt(y) + 543).slice(2)}`;
}

const isFilled = (v: unknown) => v != null && String(v).trim() !== "";

// normalize สี — รวม typo variant (เขึยว → เขียว) ตาม logic ใน drug-sheets
function normalizeColor(raw: string): string {
  if (!raw) return "ไม่ระบุ";
  const r = raw.trim();
  if (r.includes("เขี") || r.includes("เขึ") || r.toLowerCase() === "green")
    return "เขียว";
  if (r.includes("ส้ม") || r.toLowerCase() === "orange") return "ส้ม";
  if (r.includes("เหลือง") || r.toLowerCase() === "yellow") return "เหลือง";
  if (r.includes("แดง") || r.toLowerCase() === "red") return "แดง";
  return r || "ไม่ระบุ";
}

// ─── Parse rows ───────────────────────────────────────────────────────────────
function parseRows(rawRows: string[][]): {
  rows: MiniThanRow[];
  headers: string[];
} {
  if (rawRows.length < 2) return { rows: [], headers: [] };

  const header = rawRows[0].map((h) => toStr(h));
  const col = (kws: string[], fallback: number) => {
    for (const kw of kws) {
      const i = header.findIndex((h) =>
        h.toLowerCase().includes(kw.toLowerCase()),
      );
      if (i >= 0) return i;
    }
    return fallback;
  };

  const cTreatStatus = col(["สถานะ"], 2); // คอลัมน์ "สถานะ" ตัวแรก (index 2)
  const cDetailStatus = col(["สถานะการรักษาปัจจุบัน"], 3);
  const cProgram = col(["hw/imc/mp", "hw/imc", "mp"], 4);
  const cReferralMethod = col(["วิธีการมาบำบัด"], 5);
  const cTambon = col(["ตำบล"], 6);
  const cHN = col(["hn"], 7);
  const cPrefix = col(["คำนำหน้า"], 12);
  const cFirst = col(["ชื่อ"], 13);
  const cLast = col(["สกุล"], 14);
  const cAge = col(["อายุ"], 16);
  const cV2 = col(["คะแนน v2", "v2"], 17);
  const cColor = col(["สี"], 18);
  const cIsNew = col(["ใหม่"], 19);
  const cOldDropout = col(["เก่าDrop out", "เก่าdrop"], 20);
  const cOldDone = col(["เก่าจบ"], 21);
  const cReferralSource = col(["การนำส่ง"], 22);
  const cNote1 = col(["หมายเหตุ"], 33); // หมายเหตุ ตัวแรก (มีคำว่า ถูกจับ/เสียชีวิต)
  const cStartDate = col(["เริ่มมาจริง"], 35);
  const cBsotStart = col(["เริ่มลงบสต"], 36);

  // ช่วง 1wk–16wk: หา index ของ "1wk" แล้วนับต่อ 16 คอลัมน์
  const wk1Idx = col(["1wk"], 38);

  // ว.ด.ป.จบบำบัด อยู่ถัดจาก 16wk
  const cTreatEnd = col(["ว.ด.ป.จบบำบัด", "จบบำบัด"], wk1Idx + TOTAL_WEEKS);
  const cNote = col(["หมายเหตุ2", "หมายเหตุ"], cTreatEnd + 1);

  // follow-up 7 คอลัมน์: ว.ด.ป.2w., 1ด., 2ด., 3ด., 6ด., 9ด., 1 ปี — อยู่ต่อจากหมายเหตุ2
  // ใช้ keyword "ว.ด.ป.2w" เพื่อไม่ให้ชนกับ "2wk" ในช่วง weekly
  const fuStartIdx = col(["ว.ด.ป.2w"], cNote + 1);

  const rows: MiniThanRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.every((c) => !c || !String(c).trim())) continue;

    const program = toStr(r[cProgram]);
    // มินิธัญญารักษ์ = แถวที่ผ่านโปรแกรม IMC (มี "IMC" อยู่ในคอลัมน์ HW/IMC/MP)
    // รวมทุกเคสที่มี IMC เช่น IMC/MP, IMC/MP/IMC, IMC ล้วน ฯลฯ
    if (!program.toUpperCase().includes("IMC")) continue;

    const firstName = toStr(r[cFirst]);
    const hn = toStr(r[cHN]);
    if (!firstName && !hn) continue;

    const weeks: (string | null)[] = [];
    for (let w = 0; w < TOTAL_WEEKS; w++) {
      const cell = r[wk1Idx + w];
      weeks.push(
        isFilled(cell)
          ? parseDate(cell, { validate: true }) || toStr(cell)
          : null,
      );
    }
    const weeksAttended = weeks.filter((w) => w != null).length;
    let lastWeekIndex = 0;
    weeks.forEach((w, idx) => {
      if (w != null) lastWeekIndex = idx + 1;
    });

    const followUp: Record<FollowUpKey, string | null> = {
      w2: null,
      m1: null,
      m2: null,
      m3: null,
      m6: null,
      m9: null,
      y1: null,
    };
    FOLLOWUP_KEYS.forEach((key, idx) => {
      const cell = r[fuStartIdx + idx];
      followUp[key] = isFilled(cell)
        ? parseDate(cell, { validate: true }) || toStr(cell)
        : null;
    });
    const followUpAttended = FOLLOWUP_KEYS.filter(
      (k) => followUp[k] != null,
    ).length;

    const detailStatus = toStr(r[cDetailStatus]);
    const note1 = toStr(r[cNote1]);
    const note2 = toStr(r[cNote]);
    const note = [note1, note2].filter(Boolean).join(" · ");
    const noteBlob = `${detailStatus} ${note}`.toLowerCase();

    // ประเภทผู้ป่วย: รายใหม่ (ติ๊ก "ใหม่") หรือรายเก่า (จบ/Drop out) หรืออื่นๆ
    const patientType = isFilled(r[cIsNew])
      ? "ใหม่"
      : isFilled(r[cOldDone])
        ? "เก่าจบ"
        : isFilled(r[cOldDropout])
          ? "เก่า Drop out"
          : "อื่นๆ";

    rows.push({
      no: i,
      treatStatus: toStr(r[cTreatStatus]),
      detailStatus,
      program,
      referralMethod: toStr(r[cReferralMethod]) || "ไม่ระบุ",
      referralSource: toStr(r[cReferralSource]) || "ไม่ระบุ",
      tambon: toStr(r[cTambon]) || "ไม่ระบุ",
      hn,
      prefix: toStr(r[cPrefix]),
      firstName,
      lastName: toStr(r[cLast]),
      age: toNumOrNull(r[cAge]),
      v2Score: toNumOrNull(r[cV2]),
      colorSeverity: normalizeColor(toStr(r[cColor])),
      patientType,
      startDate: parseDate(r[cStartDate], { validate: true }),
      bsotStartDate: parseDate(r[cBsotStart], { validate: true }),
      treatEndDate: parseDate(r[cTreatEnd], { validate: true }),
      weeks,
      weeksAttended,
      lastWeekIndex,
      followUp,
      followUpAttended,
      isDropout: detailStatus === "Dropout",
      isTreatComplete: detailStatus === "treat ครบ",
      excludeFromDenominator: /ถูกจับ|เสียชีวิต|methadone/.test(noteBlob),
      note,
    });
  }

  return { rows, headers: header };
}

// ─── Build summary ────────────────────────────────────────────────────────────
function buildSummary(rows: MiniThanRow[]): MiniThanSummary {
  const total = rows.length;
  const inTreatment = rows.filter((r) => r.treatStatus === "บำบัด").length;
  const followUpCnt = rows.filter((r) => r.treatStatus === "ติดตาม").length;
  const discharged = rows.filter((r) => r.treatStatus === "จำหน่าย").length;
  const treatComplete = rows.filter((r) => r.isTreatComplete).length;
  const dropout = rows.filter((r) => r.isDropout).length;
  const newPatients = rows.filter((r) => r.patientType === "ใหม่").length;
  const oldDone = rows.filter((r) => r.patientType === "เก่าจบ").length;
  const oldDropout = rows.filter(
    (r) => r.patientType === "เก่า Drop out",
  ).length;

  const malePrefixes = ["นาย", "เด็กชาย", "ด.ช."];
  const femalePrefixes = ["นาง", "นางสาว", "น.ส.", "เด็กหญิง", "ด.ญ."];
  const male = rows.filter((r) => malePrefixes.includes(r.prefix)).length;
  const female = rows.filter((r) => femalePrefixes.includes(r.prefix)).length;

  const ages = rows.map((r) => r.age).filter((a): a is number => !!a && a > 0);
  const avgAge = ages.length
    ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length)
    : 0;

  const v2s = rows
    .map((r) => r.v2Score)
    .filter((v): v is number => !!v && v > 0);
  const avgV2 = v2s.length
    ? Math.round((v2s.reduce((s, v) => s + v, 0) / v2s.length) * 10) / 10
    : 0;

  // ── Retention Rate ตามสูตร KPI ──
  // A: จำหน่าย/treat ครบ ที่ได้รับการติดตามต่อเนื่องอย่างน้อย 1 ครั้ง
  // B: ผู้ที่พ้นระยะบำบัด (treat ครบ/Dropout/จำหน่าย) ยกเว้นถูกจับ/เสียชีวิต/Methadone
  const denomRows = rows.filter(
    (r) =>
      !r.excludeFromDenominator &&
      (r.isTreatComplete || r.isDropout || r.treatStatus === "จำหน่าย"),
  );
  const numerRows = denomRows.filter(
    (r) =>
      (r.isTreatComplete || r.treatStatus === "จำหน่าย") &&
      r.followUpAttended > 0,
  );
  const retentionRate = denomRows.length
    ? Math.round((numerRows.length / denomRows.length) * 1000) / 10
    : 0;

  // ── Weekly attendance curve (dropout curve) ──
  const startedRows = rows.filter((r) => r.startDate);
  const cohort = startedRows.length || total;
  const weeklyRetention: WeeklyRetentionPoint[] = Array.from(
    { length: TOTAL_WEEKS },
    (_, i) => {
      const week = i + 1;
      const count = rows.filter((r) => r.weeks[i] != null).length;
      return {
        week,
        label: `wk${week}`,
        count,
        pct: cohort ? Math.round((count / cohort) * 1000) / 10 : 0,
      };
    },
  );

  // ── Follow-up milestones ──
  // eligible: ผู้ที่บำบัดจบแล้ว (มีวันที่ ว.ด.ป.จบบำบัด) → เข้าสู่ช่วงติดตาม
  const eligibleRows = rows.filter((r) => r.treatEndDate);
  const followUpMilestones: FollowUpMilestone[] = FOLLOWUP_KEYS.map((key) => {
    const attended = eligibleRows.filter((r) => r.followUp[key] != null).length;
    const eligible = eligibleRows.length;
    return {
      key,
      label: FOLLOWUP_LABELS[key],
      attended,
      eligible,
      pct: eligible ? Math.round((attended / eligible) * 1000) / 10 : 0,
    };
  });

  // ── Monthly trend (ตามวันที่เริ่มบำบัดจริง) ──
  const monthMap: Record<string, number> = {};
  rows.forEach((r) => {
    if (/^\d{4}-\d{2}/.test(r.startDate)) {
      const key = r.startDate.slice(0, 7);
      monthMap[key] = (monthMap[key] || 0) + 1;
    }
  });
  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({ month: monthLabelBE(key), count }));

  return {
    total,
    inTreatment,
    followUp: followUpCnt,
    discharged,
    treatComplete,
    dropout,
    newPatients,
    oldDone,
    oldDropout,
    avgAge,
    avgV2,
    male,
    female,
    retentionRate,
    byColor: countBy(rows, "colorSeverity"),
    byTambon: countBy(rows, "tambon"),
    byReferral: countBy(rows, "referralSource"),
    byDetailStatus: countBy(rows, "detailStatus"),
    byPatientType: countBy(rows, "patientType"),
    weeklyRetention,
    followUpMilestones,
    byMonth,
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  try {
    const sheets = await getSheetClient();
    const firstSheet = await getFirstSheetTitle(sheets, SPREADSHEET_ID);
    const raw = await getValues(sheets, SPREADSHEET_ID, `${firstSheet}!A:BK`);

    const { rows, headers } = parseRows(raw);
    const summary = buildSummary(rows);

    const result: MiniThanDashboardData = {
      updatedAt: new Date().toISOString(),
      sheetName: firstSheet,
      summary,
      rows,
    };

    if (debug) {
      result.debug = { headers, sampleRow: raw[1] ?? [] };
    }

    return NextResponse.json(result);
  } catch (err) {
    return sheetsError(err, "MiniThanSheets");
  }
}
