// lib/productivity.service.ts
// SQL service สำหรับ Dashboard "ผลิตภาพการพยาบาล OPD" (Productivity)
//
// ⭐ ยอด OPD นับ "เหมือนการ์ดผู้รับบริการทั้งหมด" ของ dashboard เป๊ะ
//    = COUNT(DISTINCT vn) จาก vn_stat ตรงๆ (เหมือน totalVisit ใน lib/dashboard.ts)
//    ไม่ join / ไม่กรองอะไร โดย default → ได้เลขตรงกับที่เห็นบนการ์ด
//
// สูตร (เกณฑ์มาตรฐาน 90–110%):
//   ชม.ที่ต้องการ = OPD(ครั้ง) × HOURS_PER_PATIENT
//   ชม.จริง       = (พยาบาลเวรเช้า + หัวหน้า) × HOURS_PER_SHIFT
//   Productivity  = ชม.ที่ต้องการ ÷ ชม.จริง × 100

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

// ── ค่าคงที่สูตร ───────────────────────────────────────────────────────────────
const HOURS_PER_PATIENT = Number(process.env.OPD_HOURS_PER_PATIENT ?? 0.24);
const HOURS_PER_SHIFT = Number(process.env.OPD_HOURS_PER_SHIFT ?? 7);
const STANDARD_LOW = 90;
const STANDARD_HIGH = 110;

const DEFAULT_NURSE_STAFF = Number(process.env.OPD_NURSE_DEFAULT ?? 8);
const DEFAULT_HEAD_STAFF = Number(process.env.OPD_HEAD_DEFAULT ?? 1);

// ── ตัวกรอง (ปิดทั้งหมดโดย default = นับเหมือนการ์ด) ───────────────────────────
// เปิดทีหลังเมื่อยืนยันรหัสจริงแล้ว ผ่าน .env:
//   OPD_EXCLUDE_ADMIT=1            → ตัด admit (an IS NULL) = นับเฉพาะ OPD แท้ๆ
//   OPD_EXCLUDED_DEPCODES=019,023,033,...  → ตัดแผนก (ทันตกรรม/แผนไทย/กายภาพ/ปฐมภูมิ)
//   OPD_PCU_SADAO_AID=311504      → ตัด PCU สะเดา ตามพื้นที่ aid
const EXCLUDE_ADMIT = (process.env.OPD_EXCLUDE_ADMIT ?? "0") === "1";
const EXCLUDED_DEPCODES = (process.env.OPD_EXCLUDED_DEPCODES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const PCU_SADAO_AID = process.env.OPD_PCU_SADAO_AID ?? ""; // ว่าง = ไม่ตัด

// ─── Types ────────────────────────────────────────────────────────────────────
export type ProductivityStatus = "low" | "ok" | "high";

export interface ProductivityDay {
  date: string;
  isWeekend: boolean;
  opdTotal: number; // ครั้ง (COUNT DISTINCT vn) — ใช้ในสูตร
  opdPatients: number; // คน (COUNT DISTINCT hn)
  nurseStaff: number;
  headStaff: number;
  nurseCount: number;
  nurseFromRoster: boolean;
  neededHours: number;
  actualHours: number;
  productivity: number;
  status: ProductivityStatus;
}

export interface ProductivityResult {
  updatedAt: string;
  today: ProductivityDay;
  history: ProductivityDay[];
  config: {
    hoursPerPatient: number;
    hoursPerShift: number;
    standardLow: number;
    standardHigh: number;
    defaultNurse: number;
    defaultHead: number;
    excludeAdmit: boolean;
    excludedDepcodes: string[];
    pcuSadaoAid: string;
  };
}

// ─── 1) ยอด OPD รายวัน ──────────────────────────────────────────────────────────
// default: นับเหมือนการ์ด (vn_stat ตรงๆ). join ovst เฉพาะเมื่อเปิดตัวกรอง admit/แผนก
interface OpdCount {
  visits: number;
  patients: number;
}

async function getOpdCounts(
  start: string,
  end: string,
  opts: { admit?: boolean; dept?: boolean; pcu?: boolean } = {},
): Promise<Record<string, OpdCount>> {
  const useAdmit = opts.admit ?? EXCLUDE_ADMIT;
  const useDept = (opts.dept ?? true) && EXCLUDED_DEPCODES.length > 0;
  const usePcu = (opts.pcu ?? true) && !!PCU_SADAO_AID;

  const needOvst = useAdmit || useDept;
  const joinOvst = needOvst ? "INNER JOIN ovst o ON o.vn = v.vn" : "";
  const admitClause = useAdmit ? "AND o.an IS NULL" : "";
  const deptClause = useDept
    ? `AND (o.main_dep IS NULL OR o.main_dep NOT IN (${EXCLUDED_DEPCODES.map(() => "?").join(",")}))`
    : "";
  const pcuClause = usePcu ? "AND (v.aid IS NULL OR v.aid <> ?)" : "";

  const params: (string | number)[] = [start, end];
  if (useDept) params.push(...EXCLUDED_DEPCODES);
  if (usePcu) params.push(PCU_SADAO_AID);

  const [rows] = await db.query<RowDataPacket[]>(
    `
    SELECT v.vstdate AS d,
           COUNT(DISTINCT v.vn) AS visits,
           COUNT(DISTINCT v.hn) AS patients
    FROM vn_stat v
    ${joinOvst}
    WHERE v.vstdate BETWEEN ? AND ?
      ${admitClause}
      ${deptClause}
      ${pcuClause}
    GROUP BY v.vstdate
    `,
    params,
  );

  const map: Record<string, OpdCount> = {};
  rows.forEach((r) => {
    const d = dateKey(r.d);
    map[d] = {
      visits: Number(r.visits) || 0,
      patients: Number(r.patients) || 0,
    };
  });
  return map;
}

// mysql2 คืน DATE เป็น Date object (db.ts ไม่ได้ตั้ง dateStrings)
// ต้องสร้าง key จาก local Y-M-D ให้ตรงกับ fmt() — ห้ามใช้ String(date).slice()
// (จะได้ "Sun Jun 15") และห้ามใช้ toISOString() (จะเลื่อนเป็น UTC วันก่อนหน้า)
function dateKey(d: unknown): string {
  if (d instanceof Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }
  return String(d).slice(0, 10);
}

// ─── 2) พยาบาล/หัวหน้า เวรเช้า ──────────────────────────────────────────────────
async function queryNurseRoster(
  date: string,
): Promise<{ nurse: number; head: number } | null> {
  // TODO: map ตารางเวร HOSxP จริงที่นี่ แล้ว return { nurse, head }
  void date;
  return null;
}

function isWeekend(date: string): boolean {
  const dow = new Date(date + "T00:00:00").getDay();
  return dow === 0 || dow === 6;
}

async function getStaffing(
  date: string,
): Promise<{ nurse: number; head: number; fromRoster: boolean }> {
  try {
    const roster = await queryNurseRoster(date);
    if (roster) return { ...roster, fromRoster: true };
  } catch {
    /* fallback default */
  }
  return {
    nurse: DEFAULT_NURSE_STAFF,
    head: isWeekend(date) ? 0 : DEFAULT_HEAD_STAFF, // เสาร์/อาทิตย์ หัวหน้าไม่อยู่
    fromRoster: false,
  };
}

// ─── 3) คำนวณ 1 วัน ────────────────────────────────────────────────────────────
function buildDay(
  date: string,
  opd: OpdCount,
  nurseStaff: number,
  headStaff: number,
  nurseFromRoster: boolean,
): ProductivityDay {
  const nurseCount = nurseStaff + headStaff;
  const neededHours = opd.visits * HOURS_PER_PATIENT;
  const actualHours = nurseCount * HOURS_PER_SHIFT;
  const productivity =
    actualHours > 0 ? Math.round((neededHours / actualHours) * 10000) / 100 : 0;
  const status: ProductivityStatus =
    productivity < STANDARD_LOW
      ? "low"
      : productivity <= STANDARD_HIGH
        ? "ok"
        : "high";

  return {
    date,
    isWeekend: isWeekend(date),
    opdTotal: opd.visits,
    opdPatients: opd.patients,
    nurseStaff,
    headStaff,
    nurseCount,
    nurseFromRoster,
    neededHours: Math.round(neededHours * 100) / 100,
    actualHours,
    productivity,
    status,
  };
}

// ─── 4) Main ───────────────────────────────────────────────────────────────────
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export async function getProductivity(): Promise<ProductivityResult> {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(today);
  start.setDate(today.getDate() - 6);

  const opdMap = await getOpdCounts(fmt(start), fmt(today));
  const empty: OpdCount = { visits: 0, patients: 0 };

  const history: ProductivityDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = fmt(d);
    const { nurse, head, fromRoster } = await getStaffing(ds);
    history.push(buildDay(ds, opdMap[ds] ?? empty, nurse, head, fromRoster));
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
      defaultNurse: DEFAULT_NURSE_STAFF,
      defaultHead: DEFAULT_HEAD_STAFF,
      excludeAdmit: EXCLUDE_ADMIT,
      excludedDepcodes: EXCLUDED_DEPCODES,
      pcuSadaoAid: PCU_SADAO_AID,
    },
  };
}

// ─── DEBUG: /api/productivity-opd?debug=1 ───────────────────────────────────────
export async function getProductivityDebug() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  const s = fmt(start);
  const e = fmt(today);

  // เทียบเลขแต่ละชั้น
  const cardLike = await getOpdCounts(s, e, {
    admit: false,
    dept: false,
    pcu: false,
  });
  const withAdmit = await getOpdCounts(s, e, {
    admit: true,
    dept: false,
    pcu: false,
  });
  const withAll = await getOpdCounts(s, e, {}); // ตามค่า env ปัจจุบัน

  const pick = (m: Record<string, OpdCount>) => ({
    today: m[e]?.visits ?? 0,
    byDay: Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.visits])),
  });

  return {
    bangkokToday: e,
    range: { start: s, end: e },
    activeFilters: {
      excludeAdmit: EXCLUDE_ADMIT,
      excludedDepcodes: EXCLUDED_DEPCODES,
      pcuSadaoAid: PCU_SADAO_AID,
    },
    counts: {
      card_like_no_filter: pick(cardLike), // ควรตรงกับการ์ด
      exclude_admit_only: pick(withAdmit),
      current_env_filters: pick(withAll), // = ที่โชว์จริง
    },
  };
}
