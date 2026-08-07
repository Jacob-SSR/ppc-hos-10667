// lib/hospital-profile.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// ข้อมูลทั่วไปของโรงพยาบาล + สถิติการให้บริการ OPD/IPD ย้อนหลังรายปีงบประมาณ
// (3 ปีงบประมาณล่าสุดที่ครบปี + ปีงบปัจจุบันแบบสะสมถึงวันนี้)
//
// แหล่งข้อมูล HOSxP:
//   OPD → ovst (นับครั้ง/คน แยกตามแผนก main_dep + kskdepartment)
//   IPD → an_stat (รับไว้ตาม regdate) + ipt (จำหน่าย/วันนอนตาม dchdate)
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { cachedQuery } from "@/lib/cache";

// ── ข้อมูลทั่วไป (แก้ตรงนี้ได้เลยถ้าข้อมูลโรงพยาบาลเปลี่ยน) ──────────────────
const REGISTERED_BEDS = 30; // จำนวนเตียงตามกรอบ (ใช้คำนวณอัตราครองเตียง)

export const HOSPITAL_INFO = {
  name: "โรงพยาบาลพลับพลาชัย",
  hospcode: "10667",
  type: "โรงพยาบาลชุมชน (รพช.) ระดับ F2",
  registeredBeds: REGISTERED_BEDS,
  affiliation: "สำนักงานปลัดกระทรวงสาธารณสุข เขตสุขภาพที่ 9",
  location: "อำเภอพลับพลาชัย จังหวัดบุรีรัมย์",
  catchmentTambons: [
    "ต.จันดุม",
    "ต.โคกขมิ้น",
    "ต.ป่าชัน",
    "ต.สะเดา",
    "ต.สำโรง",
  ],
  networkUnits: [
    "รพ.สต.จันดุม",
    "รพ.สต.โคกเจริญ",
    "รพ.สต.ตาพระ",
    "รพ.สต.โคกขมิ้น",
    "รพ.สต.ป่าชัน",
    "PCU สะเดา",
    "รพ.สต.สำโรง",
  ],
  // โครงสร้างเตียงจริงตามหน่วย (ตรงกับ WARD_CONFIG ใน lib/ipd.service.ts)
  bedUnits: [
    { label: "Ward สามัญ", beds: 26 },
    { label: "ห้องพิเศษ", beds: 11 },
    { label: "เตียงเสริม", beds: 16 },
    { label: "พลับพลารักษ์", beds: 10 },
    { label: "ห้องแยกโรค", beds: 2 },
    { label: "ห้อง Negative", beds: 2 },
    { label: "เตียง IMC", beds: 2 },
    { label: "ห้อง Post", beds: 1 },
    { label: "Home Ward ยาเสพติด", beds: 5 },
    { label: "Home Ward Palliative", beds: 5 },
  ],
} as const;

// ── ปีงบประมาณไทย (1 ต.ค. – 30 ก.ย.) ────────────────────────────────────────
export interface FiscalYearInfo {
  be: number; // ปีงบประมาณ พ.ศ. เช่น 2566
  start: string; // YYYY-MM-DD (1 ต.ค. ของปีก่อนหน้า)
  end: string; // YYYY-MM-DD exclusive (1 ต.ค. ปีถัดไป หรือพรุ่งนี้ถ้ายังไม่จบปี)
  partial: boolean; // ปีงบปัจจุบันที่ยังไม่ครบปี
  days: number; // จำนวนวันที่ใช้หารค่าเฉลี่ยต่อวัน
}

function todayBangkok(): Date {
  const s = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Bangkok",
  });
  return new Date(`${s}T00:00:00Z`);
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 3 ปีงบที่ครบปีล่าสุด + ปีงบปัจจุบัน (partial) — เรียงเก่า → ใหม่ */
export function getFiscalYears(): FiscalYearInfo[] {
  const today = todayBangkok();
  const ceYear = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const currentBe = (month >= 10 ? ceYear + 1 : ceYear) + 543;

  const years: FiscalYearInfo[] = [];
  for (let be = currentBe - 3; be <= currentBe; be++) {
    const start = new Date(Date.UTC(be - 544, 9, 1)); // 1 ต.ค.
    const fullEnd = new Date(Date.UTC(be - 543, 9, 1));
    const partial = be === currentBe;
    // ปีปัจจุบันนับถึง "พรุ่งนี้" (exclusive) = รวมข้อมูลวันนี้ด้วย
    const end = partial
      ? new Date(today.getTime() + 24 * 60 * 60 * 1000)
      : fullEnd;
    years.push({
      be,
      start: fmt(start),
      end: fmt(end),
      partial,
      days: Math.round((end.getTime() - start.getTime()) / 86400000),
    });
  }
  return years;
}

// ── Types ────────────────────────────────────────────────────────────────────
interface OpdDeptRow extends RowDataPacket {
  fy: number;
  depcode: string | null;
  department: string;
  visits: number;
  patients: number;
}

interface OpdYearRow extends RowDataPacket {
  fy: number;
  visits: number;
  patients: number;
}

interface IpdAdmitRow extends RowDataPacket {
  fy: number;
  ward: string;
  ward_name: string;
  admissions: number;
}

interface IpdDchRow extends RowDataPacket {
  fy: number;
  ward: string;
  discharges: number;
  patient_days: number;
  avg_los: number;
}

export interface OpdDepartmentStat {
  depcode: string;
  department: string;
  byYear: Record<number, { visits: number; patients: number }>;
}

export interface IpdWardStatByYear {
  ward: string;
  ward_name: string;
  byYear: Record<
    number,
    {
      admissions: number;
      discharges: number;
      patient_days: number;
      avg_los: number;
    }
  >;
}

export interface YearSummary {
  be: number;
  partial: boolean;
  opd_visits: number;
  opd_patients: number;
  opd_avg_per_day: number;
  ipd_admissions: number;
  ipd_discharges: number;
  ipd_patient_days: number;
  ipd_avg_los: number;
  bed_occupancy_pct: number;
}

export interface HospitalProfileData {
  updatedAt: string;
  info: typeof HOSPITAL_INFO;
  population: number | null;
  years: FiscalYearInfo[];
  summary: YearSummary[];
  opdByDepartment: OpdDepartmentStat[];
  ipdByWard: IpdWardStatByYear[];
}

// ปีงบ = ปี ค.ศ. ของวันที่บวก 3 เดือน (ต.ค.–ธ.ค. เลื่อนไปปีถัดไป) + 543
const FY_EXPR = (col: string) =>
  `YEAR(DATE_ADD(${col}, INTERVAL 3 MONTH)) + 543`;

async function queryProfile(): Promise<HospitalProfileData> {
  const years = getFiscalYears();
  const rangeStart = years[0].start;
  const rangeEnd = years[years.length - 1].end;

  // ── OPD: ครั้ง/คน แยกแผนก ต่อปีงบ ──
  const [opdDeptRows] = await db.query<OpdDeptRow[]>(
    `SELECT ${FY_EXPR("o.vstdate")} AS fy,
        o.main_dep AS depcode,
        COALESCE(NULLIF(k.department, ''), 'ไม่ระบุแผนก') AS department,
        COUNT(*) AS visits,
        COUNT(DISTINCT o.hn) AS patients
     FROM ovst o
     LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
     WHERE o.vstdate >= ? AND o.vstdate < ?
     GROUP BY fy, o.main_dep, k.department`,
    [rangeStart, rangeEnd],
  );

  // ── OPD: รวมทั้งโรงพยาบาลต่อปีงบ (นับคนแบบ distinct ข้ามแผนก) ──
  const [opdYearRows] = await db.query<OpdYearRow[]>(
    `SELECT ${FY_EXPR("o.vstdate")} AS fy,
        COUNT(*) AS visits,
        COUNT(DISTINCT o.hn) AS patients
     FROM ovst o
     WHERE o.vstdate >= ? AND o.vstdate < ?
     GROUP BY fy`,
    [rangeStart, rangeEnd],
  );

  // ── IPD: รับไว้ (admission) ตาม regdate แยก ward ──
  const [ipdAdmitRows] = await db.query<IpdAdmitRow[]>(
    `SELECT ${FY_EXPR("a.regdate")} AS fy,
        a.ward,
        COALESCE(NULLIF(w.name, ''), CONCAT('Ward ', a.ward)) AS ward_name,
        COUNT(*) AS admissions
     FROM an_stat a
     LEFT JOIN ward w ON w.ward = a.ward
     WHERE a.regdate >= ? AND a.regdate < ?
     GROUP BY fy, a.ward, w.name`,
    [rangeStart, rangeEnd],
  );

  // ── IPD: จำหน่าย / วันนอน ตาม dchdate แยก ward ──
  const [ipdDchRows] = await db.query<IpdDchRow[]>(
    `SELECT ${FY_EXPR("i.dchdate")} AS fy,
        i.ward,
        COUNT(*) AS discharges,
        SUM(GREATEST(DATEDIFF(i.dchdate, i.regdate), 1)) AS patient_days,
        ROUND(AVG(GREATEST(DATEDIFF(i.dchdate, i.regdate), 1)), 1) AS avg_los
     FROM ipt i
     WHERE i.dchdate >= ? AND i.dchdate < ?
     GROUP BY fy, i.ward`,
    [rangeStart, rangeEnd],
  );

  // ── ประชากรบัญชี 1 (ถ้าฐานไม่มีตาราง person ก็ข้าม) ──
  let population: number | null = null;
  try {
    const [popRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM person p
       WHERE COALESCE(p.death, 'N') <> 'Y'`,
    );
    population = Number(popRows[0]?.cnt ?? 0) || null;
  } catch {
    population = null;
  }

  const beSet = new Set(years.map((y) => y.be));

  // ── รวม OPD รายแผนก ──
  const deptMap = new Map<string, OpdDepartmentStat>();
  for (const r of opdDeptRows) {
    if (!beSet.has(Number(r.fy))) continue;
    const code = r.depcode ?? "__none__";
    let d = deptMap.get(code);
    if (!d) {
      d = { depcode: code, department: r.department, byYear: {} };
      deptMap.set(code, d);
    }
    d.byYear[Number(r.fy)] = {
      visits: Number(r.visits),
      patients: Number(r.patients),
    };
  }
  const latestFullBe = years.filter((y) => !y.partial).at(-1)?.be ?? years[0].be;
  const opdByDepartment = [...deptMap.values()].sort(
    (a, b) =>
      (b.byYear[latestFullBe]?.visits ?? 0) -
      (a.byYear[latestFullBe]?.visits ?? 0),
  );

  // ── รวม IPD ราย ward ──
  const wardMap = new Map<string, IpdWardStatByYear>();
  const ensureWard = (ward: string, name?: string) => {
    let w = wardMap.get(ward);
    if (!w) {
      w = { ward, ward_name: name || `Ward ${ward}`, byYear: {} };
      wardMap.set(ward, w);
    } else if (name && w.ward_name.startsWith("Ward ")) {
      w.ward_name = name;
    }
    return w;
  };
  const ensureYearCell = (w: IpdWardStatByYear, fy: number) => {
    if (!w.byYear[fy]) {
      w.byYear[fy] = {
        admissions: 0,
        discharges: 0,
        patient_days: 0,
        avg_los: 0,
      };
    }
    return w.byYear[fy];
  };
  for (const r of ipdAdmitRows) {
    if (!beSet.has(Number(r.fy))) continue;
    const cell = ensureYearCell(
      ensureWard(String(r.ward), r.ward_name),
      Number(r.fy),
    );
    cell.admissions = Number(r.admissions);
  }
  for (const r of ipdDchRows) {
    if (!beSet.has(Number(r.fy))) continue;
    const cell = ensureYearCell(ensureWard(String(r.ward)), Number(r.fy));
    cell.discharges = Number(r.discharges);
    cell.patient_days = Number(r.patient_days);
    cell.avg_los = Number(r.avg_los);
  }
  const ipdByWard = [...wardMap.values()].sort(
    (a, b) =>
      (b.byYear[latestFullBe]?.admissions ?? 0) -
      (a.byYear[latestFullBe]?.admissions ?? 0),
  );

  // ── สรุปภาพรวมรายปี ──
  const summary: YearSummary[] = years.map((y) => {
    const opd = opdYearRows.find((r) => Number(r.fy) === y.be);
    let admissions = 0;
    let discharges = 0;
    let patientDays = 0;
    for (const w of ipdByWard) {
      const c = w.byYear[y.be];
      if (!c) continue;
      admissions += c.admissions;
      discharges += c.discharges;
      patientDays += c.patient_days;
    }
    const opdVisits = Number(opd?.visits ?? 0);
    return {
      be: y.be,
      partial: y.partial,
      opd_visits: opdVisits,
      opd_patients: Number(opd?.patients ?? 0),
      opd_avg_per_day: y.days > 0 ? Math.round(opdVisits / y.days) : 0,
      ipd_admissions: admissions,
      ipd_discharges: discharges,
      ipd_patient_days: patientDays,
      ipd_avg_los:
        discharges > 0 ? Math.round((patientDays / discharges) * 10) / 10 : 0,
      bed_occupancy_pct:
        y.days > 0
          ? Math.round((patientDays / (REGISTERED_BEDS * y.days)) * 1000) / 10
          : 0,
    };
  });

  return {
    updatedAt: new Date().toISOString(),
    info: HOSPITAL_INFO,
    population,
    years,
    summary,
    opdByDepartment,
    ipdByWard,
  };
}

/** ข้อมูลเป็นสถิติย้อนหลัง เปลี่ยนช้า → cache 6 ชั่วโมง */
export async function getHospitalProfile(): Promise<HospitalProfileData> {
  return cachedQuery(["hospital-profile", "v1"], queryProfile, 6 * 60 * 60);
}
