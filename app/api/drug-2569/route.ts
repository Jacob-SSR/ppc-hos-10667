// app/api/drug-2569/route.ts
// อ่านทะเบียน "ผู้ป่วยยาเสพติด 2569" (งานจิตเวช) จาก Google Sheet แบบเรียลไทม์
// แล้วสรุปเป็น Care Pipeline + ตัวชี้วัด 4 มิติ + ครั้งบำบัด (Matrix) + การติดตาม
//
// ออกแบบให้ match header จริงของชีตนี้ (ต่างจาก /api/drug-sheets เดิม):
//   สถานะการติดตาม | สถานะการรักษาปัจจุบัน | HW/IMC/MP | วิธีการมาบำบัด | ตำบล |
//   คำนำหน้า | อายุ | คะแนน V2 | สี | ใหม่ | เก่าจบ | เก่าDrop out | การนำส่ง |
//   เริ่มลงบสต. | 1wk..16wk | ว.ด.ป.2w. .. ว.ด.ป.1 ปี
//
// ── ENV ────────────────────────────────────────────────────────────────────────
//   GOOGLE_SERVICE_ACCOUNT_EMAIL   (มีอยู่แล้ว)
//   GOOGLE_PRIVATE_KEY             (มีอยู่แล้ว)
//   DRUG_2569_SPREADSHEET_ID       (ตั้งใหม่ใน .env — Google Sheet ID ของทะเบียนนี้)
//        ถ้าไม่ตั้ง จะ fallback ไปใช้ DRUG_SPREADSHEET_ID เดิม
//   ต้องแชร์ชีตให้ service account (GOOGLE_SERVICE_ACCOUNT_EMAIL) อ่านได้ (Viewer)

import { NextResponse } from "next/server";
import {
  getSheetClient,
  getAllSheetTitles,
  getValues,
  toStr,
  toNum,
  parseDate,
  sheetsError,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHEET_ID =
  process.env.DRUG_2569_SPREADSHEET_ID ;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Drug2569Row {
  no: number;
  treatStatus: string; // บำบัด | ติดตาม | จำหน่าย
  detailStatus: string; // Metrix | treat ครบ | Dropout | IMC | Homeword
  program: string; // HW/IMC/MP ...
  method: string; // วิธีการมาบำบัด
  referral: string; // การนำส่ง (normalize)
  tambon: string; // ตำบล (จัดกลุ่มในเขต/นอกเขต)
  tambonRaw: string;
  hn: string;
  prefix: string;
  firstName: string;
  lastName: string;
  gender: "ชาย" | "หญิง";
  age: number;
  v2: number;
  color: ColorKey; // green | yellow | orange | red | none
  isNew: boolean;
  oldDone: boolean;
  oldDrop: boolean;
  sessions: number; // นับจาก 1wk..16wk ที่มีวันที่
  followups: number; // นับจาก ว.ด.ป.* (7 ช่วง) ที่มีวันที่
  regMonth: string; // "YYYY-MM" (ค.ศ.) จาก เริ่มลงบสต.
}

export type ColorKey = "green" | "yellow" | "orange" | "red" | "none";

export interface PipelineStage {
  key: string;
  label: string;
  value: number;
  sub: string;
  /** สัดส่วนความยาวแถบ 0-100 */
  pct: number;
  accent?: boolean;
  suffix?: string;
}

export interface KpiIndicator {
  label: string;
  formula: string;
  value: number | null; // null = ยังคำนวณไม่ได้ (ต้องเพิ่มข้อมูล)
  suffix?: string;
  pending?: string; // ข้อความป้าย "ต้องเพิ่มข้อมูล..."
}

export interface KpiDimension {
  n: number;
  title: string;
  en: string;
  indicators: KpiIndicator[];
}

export interface Drug2569Summary {
  total: number;
  newPatients: number;
  oldDone: number;
  oldDrop: number;
  inTreatment: number; // status = บำบัด
  followUp: number; // status = ติดตาม
  discharged: number; // status = จำหน่าย
  treatComplete: number; // detail = treat ครบ
  dropout: number; // detail = Dropout
  retentionRate: number; // ครบ / (ครบ + หลุด)
  screeningRate: number; // มี V2 / ทั้งหมด
  followupCoverage: number; // ติดตามที่มีนัด / ติดตามทั้งหมด
  male: number;
  female: number;
  avgAge: number;
  avgV2: number;
  minV2: number;
  maxV2: number;
  pipeline: PipelineStage[];
  dimensions: KpiDimension[];
  byStatus: Record<string, number>;
  byColor: Record<ColorKey, number>;
  byAgeGroup: Record<string, number>;
  byReferral: Record<string, number>;
  byMethod: Record<string, number>;
  byTambon: Record<string, number>;
  sessionsHist: { sessions: number; count: number }[]; // index 0..16
  followupFunnel: { label: string; count: number }[];
}

export interface Drug2569DashboardData {
  updatedAt: string;
  source: "google-sheet";
  sheetName: string;
  summary: Drug2569Summary;
  rows: Drug2569Row[];
  debug?: { headers: string[]; sampleRow: string[] };
}

// ─── Domain constants ─────────────────────────────────────────────────────────
const CATCHMENT = new Set(["โคกขมิ้น", "สะเดา", "ป่าชัน", "จันดุม", "สำโรง"]);
const FU_LABELS = [
  "2 สัปดาห์",
  "1 เดือน",
  "2 เดือน",
  "3 เดือน",
  "6 เดือน",
  "9 เดือน",
  "1 ปี",
];

function normalizeColor(raw: string): ColorKey {
  const r = raw.trim().toLowerCase();
  if (!r) return "none";
  if (raw.includes("เขี") || raw.includes("เขึ") || r === "green")
    return "green";
  if (raw.includes("เหลือง") || r === "yellow") return "yellow";
  if (raw.includes("ส้ม") || r === "orange") return "orange";
  if (raw.includes("แดง") || r === "red") return "red";
  return "none";
}

function normalizeReferral(raw: string): string {
  const r = raw.trim();
  if (!r) return "ไม่ระบุ";
  if (r.includes("คุม") && r.includes("ประพฤติ")) return "คุมประพฤติ";
  if (r === "C ตำรวจ" || r.includes("ค่าย")) return "ตำรวจ(ค่าย)";
  if (r.includes("แพทย")) return "แพทย์";
  return r.replace(/์{2,}/g, "์");
}

function genderFromPrefix(p: string): "ชาย" | "หญิง" {
  const fem = ["นางสาว", "น.ส.", "นาง", "เด็กหญิง", "ด.ญ."];
  return fem.some((f) => p.startsWith(f)) ? "หญิง" : "ชาย";
}

function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 1000) / 10 : 0;
}

// ─── Column resolver ──────────────────────────────────────────────────────────
// คืน object ที่มี index ของแต่ละ field + รายการ index ของ session/followup
function resolveColumns(header: string[]) {
  const norm = header.map((h) => toStr(h).replace(/\s+/g, ""));
  const find = (...kw: string[]): number => {
    for (const k of kw) {
      const kn = k.replace(/\s+/g, "");
      const i = norm.findIndex((h) => h.includes(kn));
      if (i >= 0) return i;
    }
    return -1;
  };

  // session columns: header เป็น "1wk".."16wk"
  const session: number[] = [];
  norm.forEach((h, i) => {
    if (/^\d{1,2}wk$/i.test(h)) session.push(i);
  });
  // followup columns: header ขึ้นต้น "ว.ด.ป." แต่ไม่ใช่ "จบบำบัด"
  const followup: number[] = [];
  norm.forEach((h, i) => {
    if (h.startsWith("ว.ด.ป.") && !h.includes("จบบำบัด")) followup.push(i);
  });

  return {
    no: find("แฟ้ม", "ลำดับ", "no"),
    treatStatus: find("สถานะการติดตาม", "สถานะ"),
    detailStatus: find("สถานะการรักษาปัจจุบัน", "ปัจจุบัน", "รายละเอียด"),
    program: find("HW/IMC/MP", "HW", "IMC"),
    method: find("วิธีการมาบำบัด", "วิธีมา", "มาบำบัด"),
    tambon: find("ตำบล", "tambon"),
    hn: find("HN"),
    prefix: find("คำนำหน้า", "prefix"),
    first: find("ชื่อ", "firstname"),
    last: find("สกุล", "นามสกุล", "lastname"),
    age: find("อายุ", "age"),
    v2: find("คะแนนV2", "คะแนน", "v2"),
    color: find("สี", "color"),
    isNew: find("ใหม่"),
    oldDone: find("เก่าจบ"),
    oldDrop: find("เก่าDropout", "เก่าDrop", "Dropout"),
    referral: find("การนำส่ง", "นำส่ง", "ส่งต่อ"),
    reg: find("เริ่มลงบสต", "เริ่มลงบ", "ลงบสต"),
    session,
    followup: followup.slice(0, 7),
  };
}

const hasMark = (v: unknown) => {
  const s = toStr(v);
  return s !== "" && s !== "-" && s !== "0";
};

// ─── Parse rows ───────────────────────────────────────────────────────────────
function parseRows(raw: string[][]): Drug2569Row[] {
  if (raw.length < 2) return [];
  const c = resolveColumns(raw[0]);
  const rows: Drug2569Row[] = [];

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every((x) => !toStr(x))) continue;

    const firstName = c.first >= 0 ? toStr(r[c.first]) : "";
    const hn = c.hn >= 0 ? toStr(r[c.hn]) : "";
    // ต้องมีชื่อหรือ HN ถึงนับเป็นแถวข้อมูล (กัน footer/หมายเหตุ)
    if (!firstName && !hn) continue;

    const prefix = c.prefix >= 0 ? toStr(r[c.prefix]) : "";
    const tambonRaw = c.tambon >= 0 ? toStr(r[c.tambon]) : "";
    const sessions = c.session.reduce(
      (n, ci) => n + (parseDate(r[ci]) ? 1 : 0),
      0,
    );
    const followups = c.followup.reduce(
      (n, ci) => n + (parseDate(r[ci]) ? 1 : 0),
      0,
    );
    const reg = c.reg >= 0 ? parseDate(r[c.reg], { validate: true }) : "";

    rows.push({
      no: c.no >= 0 ? toNum(r[c.no]) || i : i,
      treatStatus: c.treatStatus >= 0 ? toStr(r[c.treatStatus]) : "",
      detailStatus: c.detailStatus >= 0 ? toStr(r[c.detailStatus]) : "",
      program: c.program >= 0 ? toStr(r[c.program]) : "",
      method: (c.method >= 0 ? toStr(r[c.method]) : "") || "ไม่ระบุ",
      referral: normalizeReferral(c.referral >= 0 ? toStr(r[c.referral]) : ""),
      tambon: CATCHMENT.has(tambonRaw) ? tambonRaw : "นอกเขต/อื่นๆ",
      tambonRaw,
      hn,
      prefix,
      firstName,
      lastName: c.last >= 0 ? toStr(r[c.last]) : "",
      gender: genderFromPrefix(prefix),
      age: c.age >= 0 ? toNum(r[c.age]) : 0,
      v2: c.v2 >= 0 ? toNum(r[c.v2]) : 0,
      color: c.color >= 0 ? normalizeColor(toStr(r[c.color])) : "none",
      isNew: c.isNew >= 0 ? hasMark(r[c.isNew]) : false,
      oldDone: c.oldDone >= 0 ? hasMark(r[c.oldDone]) : false,
      oldDrop: c.oldDrop >= 0 ? hasMark(r[c.oldDrop]) : false,
      sessions,
      followups,
      regMonth: reg ? reg.slice(0, 7) : "",
    });
  }
  return rows;
}

// ─── Build summary ────────────────────────────────────────────────────────────
const FY_MONTHS = [
  "10",
  "11",
  "12",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
];
const FY_LABELS = [
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
];

function buildSummary(rows: Drug2569Row[]): Drug2569Summary {
  const total = rows.length;
  const newPatients = rows.filter((r) => r.isNew).length;
  const inTreatment = rows.filter((r) => r.treatStatus === "บำบัด").length;
  const followUp = rows.filter((r) => r.treatStatus === "ติดตาม").length;
  const discharged = rows.filter((r) => r.treatStatus === "จำหน่าย").length;
  const treatComplete = rows.filter(
    (r) => r.detailStatus === "treat ครบ",
  ).length;
  const dropout = rows.filter((r) => r.detailStatus === "Dropout").length;

  const male = rows.filter((r) => r.gender === "ชาย").length;
  const female = total - male;

  const ages = rows.map((r) => r.age).filter((a) => a > 0);
  const avgAge = ages.length
    ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length)
    : 0;
  const v2s = rows.map((r) => r.v2).filter((v) => v > 0);
  const avgV2 = v2s.length
    ? Math.round((v2s.reduce((s, v) => s + v, 0) / v2s.length) * 10) / 10
    : 0;
  const minV2 = v2s.length ? Math.min(...v2s) : 0;
  const maxV2 = v2s.length ? Math.max(...v2s) : 0;

  const screened = v2s.length;
  const screeningRate = pct(screened, total);
  const retentionRate = pct(treatComplete, treatComplete + dropout);
  const followers = rows.filter((r) => r.treatStatus === "ติดตาม");
  const fuDone = followers.filter((r) => r.followups > 0).length;
  const followupCoverage = pct(fuDone, followers.length);

  // ── Pipeline ──
  const pipeline: PipelineStage[] = [
    {
      key: "intake",
      label: "รับเข้า / ลงทะเบียน",
      value: total,
      sub: "ทั้งหมดในมุมมอง",
      pct: 100,
    },
    {
      key: "inTx",
      label: "กำลังบำบัด",
      value: inTreatment,
      sub: "อยู่ในโปรแกรม",
      pct: pct(inTreatment, total),
    },
    {
      key: "done",
      label: "บำบัดครบเกณฑ์",
      value: treatComplete,
      sub: "treat ครบ",
      pct: pct(treatComplete, total),
    },
    {
      key: "follow",
      label: "อยู่ระหว่างติดตาม",
      value: followUp,
      sub: "หลังจำหน่าย",
      pct: pct(followUp, total),
    },
    {
      key: "retention",
      label: "อัตราคงอยู่ (Retention)",
      value: retentionRate,
      sub: "ครบ ÷ (ครบ+หลุด)",
      pct: retentionRate,
      accent: true,
      suffix: "%",
    },
  ];

  // ── KPI 4 มิติ (อ้างอิงชีต kpi) ──
  const dimensions: KpiDimension[] = [
    {
      n: 1,
      title: "การเข้าถึงบริการและการคัดกรอง",
      en: "Access & Screening",
      indicators: [
        {
          label: "คัดกรอง/ประเมินความรุนแรงด้วยเครื่องมือมาตรฐาน",
          formula: "ผู้มีคะแนน V2 ÷ ผู้ป่วยทั้งหมด",
          value: screeningRate,
          suffix: "%",
        },
        {
          label: "อัตราการเข้าถึงบริการในพื้นที่",
          formula: "ต้องมีตัวหาร = ประมาณการผู้ป่วยในเขต",
          value: null,
          pending: "ต้องเพิ่มข้อมูลประชากร",
        },
      ],
    },
    {
      n: 2,
      title: "คุณภาพการบำบัดรักษา",
      en: "Quality of Care",
      indicators: [
        {
          label: "อัตราการคงอยู่ในการบำบัด (Retention)",
          formula: "บำบัดครบ ÷ (ครบ + หลุด)",
          value: retentionRate,
          suffix: "%",
        },
        {
          label: "ผ่านเกณฑ์ประเมินก่อนจำหน่าย",
          formula: "รายบำบัดครบเกณฑ์",
          value: treatComplete,
          suffix: " ราย",
        },
        {
          label: "อุบัติการณ์ความเสี่ยงทางคลินิก",
          formula: "เป้าหมาย 0 — บันทึกเหตุการณ์หอผู้ป่วย",
          value: null,
          pending: "ต้องบันทึกเหตุการณ์",
        },
      ],
    },
    {
      n: 3,
      title: "ผลสัมฤทธิ์และการติดตามต่อเนื่อง",
      en: "Outcomes & Follow-up",
      indicators: [
        {
          label: "ความครอบคลุมการติดตามในชุมชน",
          formula: "รายติดตามที่มีนัด ÷ รายติดตามทั้งหมด",
          value: followupCoverage,
          suffix: "%",
        },
        {
          label: "อัตราการหยุดเสพต่อเนื่อง (Remission)",
          formula: "ต้องมีผลตรวจปัสสาวะ/ประเมินซ้ำ",
          value: null,
          pending: "ต้องเพิ่มผลตรวจ",
        },
        {
          label: "อัตราการกลับไปเสพซ้ำ (Relapse)",
          formula: "ติดตามผลภายใน 1 ปี",
          value: null,
          pending: "ต้องเพิ่มผลตรวจ",
        },
      ],
    },
    {
      n: 4,
      title: "การบริหารจัดการและบูรณาการ",
      en: "Management & Integration",
      indicators: [
        {
          label: "การปฏิบัติตามแนวทาง CPG",
          formula: "สุ่มตรวจเวชระเบียน",
          value: null,
          pending: "ต้องสุ่มตรวจ",
        },
        {
          label: "ความพึงพอใจของผู้รับบริการ",
          formula: "ระดับ 4–5 ÷ ผู้ตอบทั้งหมด",
          value: null,
          pending: "ต้องเก็บแบบประเมิน",
        },
      ],
    },
  ];

  // ── Breakdowns ──
  const byStatus: Record<string, number> = {};
  for (const s of ["บำบัด", "ติดตาม", "จำหน่าย"]) {
    byStatus[s] = rows.filter((r) => r.treatStatus === s).length;
  }

  const byColor: Record<ColorKey, number> = {
    green: 0,
    yellow: 0,
    orange: 0,
    red: 0,
    none: 0,
  };
  rows.forEach((r) => (byColor[r.color] += 1));

  const byAgeGroup: Record<string, number> = {
    "<18": 0,
    "18–24": 0,
    "25–34": 0,
    "35–44": 0,
    "45–59": 0,
    "60+": 0,
  };
  rows.forEach((r) => {
    const a = r.age;
    if (!a) return;
    if (a < 18) byAgeGroup["<18"]++;
    else if (a < 25) byAgeGroup["18–24"]++;
    else if (a < 35) byAgeGroup["25–34"]++;
    else if (a < 45) byAgeGroup["35–44"]++;
    else if (a < 60) byAgeGroup["45–59"]++;
    else byAgeGroup["60+"]++;
  });

  const tally = (key: keyof Drug2569Row): Record<string, number> => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      const v = String(r[key] ?? "ไม่ระบุ").trim() || "ไม่ระบุ";
      m[v] = (m[v] || 0) + 1;
    });
    return m;
  };
  const byReferral = tally("referral");
  const byMethod = tally("method");
  const byTambon = tally("tambon");

  // sessions histogram 0..16
  const sessionsHist = Array.from({ length: 17 }, (_, i) => ({
    sessions: i,
    count: rows.filter((r) => r.sessions === i).length,
  }));

  // follow-up funnel — เฉพาะรายที่อยู่สถานะติดตาม
  const followupFunnel = FU_LABELS.map((label, idx) => ({
    label,
    count: followers.filter((r) => r.followups >= idx + 1).length,
  }));

  return {
    total,
    newPatients,
    oldDone: rows.filter((r) => r.oldDone).length,
    oldDrop: rows.filter((r) => r.oldDrop).length,
    inTreatment,
    followUp,
    discharged,
    treatComplete,
    dropout,
    retentionRate,
    screeningRate,
    followupCoverage,
    male,
    female,
    avgAge,
    avgV2,
    minV2,
    maxV2,
    pipeline,
    dimensions,
    byStatus,
    byColor,
    byAgeGroup,
    byReferral,
    byMethod,
    byTambon,
    sessionsHist,
    followupFunnel,
  };
}

// suppress unused-warning for FY constants kept for client month mapping reference
void FY_MONTHS;
void FY_LABELS;

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    if (!SHEET_ID) {
      return NextResponse.json(
        {
          error:
            "ไม่ได้ตั้งค่า DRUG_2569_SPREADSHEET_ID (หรือ DRUG_SPREADSHEET_ID) ใน .env",
        },
        { status: 500 },
      );
    }

    const debug = new URL(req.url).searchParams.get("debug") === "1";
    const sheets = await getSheetClient();

    // เลือก sheet: หาที่ชื่อเกี่ยวกับยาเสพติด/ผู้ป่วย ไม่งั้นใช้แผ่นแรก
    const titles = await getAllSheetTitles(sheets, SHEET_ID);
    const target =
      titles.find((t) => {
        const x = t.toLowerCase();
        return (
          t.includes("ยาเสพ") ||
          t.includes("ผู้ป่วย") ||
          x.includes("drug") ||
          x.includes("data")
        );
      }) ??
      titles.find((t) => t.toLowerCase() !== "kpi") ??
      titles[0] ??
      "Sheet1";

    const raw = await getValues(sheets, SHEET_ID, `${target}!A:BK`);
    const rows = parseRows(raw);
    const summary = buildSummary(rows);

    const result: Drug2569DashboardData = {
      updatedAt: new Date().toISOString(),
      source: "google-sheet",
      sheetName: target,
      summary,
      rows,
    };
    if (debug && raw.length) {
      result.debug = { headers: raw[0], sampleRow: raw[1] ?? [] };
    }
    return NextResponse.json(result);
  } catch (err) {
    return sheetsError(err, "Drug2569");
  }
}
