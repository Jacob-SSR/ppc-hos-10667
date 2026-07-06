// lib/servicetime.queries.ts
// ดึงข้อมูลระยะเวลาให้บริการ OPD ราย visit จาก HOSxP แล้วสรุปเป็น KPI
// ต้นทาง SQL: service_time / lab_head / xray_report / oapp / kskdepartment (คงสูตรเวลาเดิมของ HOSxP ไว้)

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import type {
  ServiceScope,
  VisitType,
  ServiceShift,
  ServiceTimeData,
  StatBlock,
  StageStat,
  TrendPoint,
  DistributionBucket,
  DepartmentRow,
  HourlyRow,
  AncillaryStat,
} from "@/lib/servicetime.types";

// ─── เป้าหมาย (นาที) — ปรับได้ตามเอกสารตัวชี้วัด R9 ────────────────────────────
export const ST_TARGETS = {
  waitScreening: 10,
  screening: null as number | null, // เวลาคัดกรอง — ไม่มีเกณฑ์ตายตัว
  waitDoctor: 30,
  consult: null as number | null, // เวลาตรวจ — ไม่มีเกณฑ์ตายตัว
  waitPharmacy: 15,
  total: 90, // ระยะเวลารวมผู้ป่วยนอก
  lab: 60,
  xray: 60,
} as const;

// เกณฑ์กรองค่าผิดปกติ: ตัดค่าติดลบ (เวลาสลับ) และเกิน MAX_MINUTES (timestamp เพี้ยน/ค้างคิว)
const MAX_MINUTES = 720; // 12 ชม.

// ─── เวร (ตามเวลาเข้าจุดคัดกรอง, นาทีของวัน) ─────────────────────────────────────
// เช้า 08:30–16:30 · บ่าย 16:30–00:30 · ดึก 00:30–08:30 (ดึกคาบเที่ยงคืน จึง +1440)
const SHIFT_WINDOWS: Record<Exclude<ServiceShift, "all">, [number, number]> = {
  morning: [510, 990],
  evening: [990, 1470],
  night: [1470, 1950],
};
function inShift(min: number | null, shift: ServiceShift): boolean {
  if (shift === "all") return true;
  if (min == null) return false;
  const mm = min < 510 ? min + 1440 : min; // ก่อน 08:30 = ช่วงดึกของ "วันถัดไป"
  const [a, b] = SHIFT_WINDOWS[shift];
  return mm >= a && mm < b;
}

// ชื่อคลินิก (แผนกจุดตรวจ) หลัง normalize — ใช้ทั้งกรองและ dropdown
const depOf = (dep: string | null | undefined): string =>
  dep?.trim() || "ไม่ระบุ";

// ─── นิยามขั้นตอน OPD (แหล่งเดียว) — ใช้ทั้งภาพรวมและแยกรายคลินิก ────────────────
// isWait = ขั้นตอน "รอ" (ใช้หา bottleneck) · pick = ดึงค่านาทีของ visit นั้น
export const STAGE_DEFS: {
  key: string;
  label: string; // ป้ายเต็ม (แผงภาพรวม)
  short: string; // ป้ายสั้น (หัวตารางรายคลินิก)
  target: number | null;
  isWait: boolean;
  pick: (r: VisitRow) => number | null;
}[] = [
  {
    key: "wait_screening",
    label: "รอคัดกรอง",
    short: "รอคัดกรอง",
    target: ST_TARGETS.waitScreening,
    isWait: true,
    pick: (r) => r.wait_screening_min,
  },
  {
    key: "screening",
    label: "คัดกรอง",
    short: "คัดกรอง",
    target: ST_TARGETS.screening,
    isWait: false,
    pick: (r) => r.screening_min,
  },
  {
    key: "wait_doctor",
    label: "รอตรวจ (หลังคัดกรอง → เรียกตรวจ)",
    short: "รอตรวจ",
    target: ST_TARGETS.waitDoctor,
    isWait: true,
    pick: (r) => r.wait_doctor_min,
  },
  {
    key: "consult",
    label: "ตรวจรักษา",
    short: "ตรวจ",
    target: ST_TARGETS.consult,
    isWait: false,
    pick: (r) => r.consult_min,
  },
  {
    key: "wait_pharmacy",
    label: "รอรับยา",
    short: "รอรับยา",
    target: ST_TARGETS.waitPharmacy,
    isWait: true,
    pick: (r) => r.wait_pharmacy_min,
  },
];

// ─── Input validation ─────────────────────────────────────────────────────────
function assertDate(s: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Invalid date format: ${JSON.stringify(s)}`);
  }
  return s;
}

// scope/visitType → SQL fragment (มาจาก enum เท่านั้น ไม่ใช่ค่า request ตรง ๆ = ปลอดภัย)
function scopeCond(scope: ServiceScope): string {
  if (scope === "opd") return "AND v.is_er_visit = 0";
  if (scope === "er") return "AND v.is_er_visit = 1";
  return "";
}
function visitCond(vt: VisitType): string {
  if (vt === "appt") return "AND v.is_appointment_visit = 1";
  if (vt === "walkin") return "AND v.is_appointment_visit = 0";
  return "";
}

// ─── SQL ราย visit (คงสูตรเวลาของ HOSxP เดิม แล้วแปลงเป็นนาทีที่ชั้นนอก) ────────
function buildRowSql(scope: ServiceScope, vt: VisitType): string {
  return `
SELECT
  v.vn,
  DATE_FORMAT(v.vstdate,'%Y-%m-%d') AS vstdate,
  v.is_appointment_visit,
  v.is_er_visit,
  v.doctor_department,
  HOUR(v.dt_arrive_screening)                                       AS arrival_hour,
  (HOUR(v.dt_arrive_screening)*60 + MINUTE(v.dt_arrive_screening))  AS arrival_minute,
  TIMESTAMPDIFF(MINUTE, v.dt_arrive_screening, v.dt_start_screening) AS wait_screening_min,
  TIMESTAMPDIFF(MINUTE, v.dt_start_screening, v.dt_end_screening)    AS screening_min,
  TIMESTAMPDIFF(MINUTE, v.dt_end_screening,   v.dt_call_doctor)      AS wait_doctor_min,
  TIMESTAMPDIFF(MINUTE, v.dt_call_doctor,     v.dt_end_doctor)       AS consult_min,
  TIMESTAMPDIFF(MINUTE, v.dt_arrive_pharmacy, v.dt_receive_drug)     AS wait_pharmacy_min,
  v.total_opd_minutes                                               AS total_opd_min,
  v.lab_item_count,
  v.lab_wait_receive_minutes,
  v.lab_process_minutes,
  v.lab_total_minutes,
  v.xray_item_count,
  v.xray_wait_minutes,
  v.xray_process_minutes,
  v.xray_total_minutes
FROM (
  SELECT
    st.vn,
    st.vstdate,
    CASE WHEN ap.hn IS NOT NULL THEN 1 ELSE 0 END AS is_appointment_visit,
    CASE WHEN d5.spclty = '13' THEN 1 ELSE 0 END  AS is_er_visit,
    d5.department AS doctor_department,

    CASE WHEN st.service3 IS NULL THEN NULL
         WHEN st.service3='24:00:00' THEN STR_TO_DATE(CONCAT(st.vstdate,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
         ELSE STR_TO_DATE(CONCAT(st.vstdate,' ',st.service3),'%Y-%m-%d %H:%i:%s') END AS dt_arrive_screening,
    CASE WHEN st.service4 IS NULL THEN NULL
         WHEN st.service4='24:00:00' THEN STR_TO_DATE(CONCAT(st.vstdate,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
         ELSE STR_TO_DATE(CONCAT(st.vstdate,' ',st.service4),'%Y-%m-%d %H:%i:%s') END AS dt_start_screening,
    CASE WHEN st.service11 IS NULL THEN NULL
         WHEN st.service11='24:00:00' THEN STR_TO_DATE(CONCAT(st.vstdate,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
         ELSE STR_TO_DATE(CONCAT(st.vstdate,' ',st.service11),'%Y-%m-%d %H:%i:%s') END AS dt_end_screening,
    CASE WHEN st.service5 IS NULL THEN NULL
         WHEN st.service5='24:00:00' THEN STR_TO_DATE(CONCAT(st.vstdate,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
         ELSE STR_TO_DATE(CONCAT(st.vstdate,' ',st.service5),'%Y-%m-%d %H:%i:%s') END AS dt_call_doctor,
    CASE WHEN st.service12 IS NULL THEN NULL
         WHEN st.service12='24:00:00' THEN STR_TO_DATE(CONCAT(st.vstdate,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
         ELSE STR_TO_DATE(CONCAT(st.vstdate,' ',st.service12),'%Y-%m-%d %H:%i:%s') END AS dt_end_doctor,
    CASE WHEN st.service6 IS NULL THEN NULL
         WHEN st.service6='24:00:00' THEN STR_TO_DATE(CONCAT(st.vstdate,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
         ELSE STR_TO_DATE(CONCAT(st.vstdate,' ',st.service6),'%Y-%m-%d %H:%i:%s') END AS dt_arrive_pharmacy,
    CASE WHEN st.service16 IS NULL THEN NULL
         WHEN st.service16='24:00:00' THEN STR_TO_DATE(CONCAT(st.vstdate,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
         ELSE STR_TO_DATE(CONCAT(st.vstdate,' ',st.service16),'%Y-%m-%d %H:%i:%s') END AS dt_receive_drug,

    CASE
      WHEN st.service3 IS NULL THEN NULL
      WHEN COALESCE(st.service16,st.service6) IS NULL THEN NULL
      ELSE TIMESTAMPDIFF(MINUTE,
        CASE WHEN st.service3='24:00:00' THEN STR_TO_DATE(CONCAT(st.vstdate,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
             ELSE STR_TO_DATE(CONCAT(st.vstdate,' ',st.service3),'%Y-%m-%d %H:%i:%s') END,
        CASE WHEN COALESCE(st.service16,st.service6)='24:00:00' THEN STR_TO_DATE(CONCAT(st.vstdate,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
             ELSE STR_TO_DATE(CONCAT(st.vstdate,' ',COALESCE(st.service16,st.service6)),'%Y-%m-%d %H:%i:%s') END)
    END AS total_opd_minutes,

    lh.lab_item_count,
    TIMESTAMPDIFF(MINUTE, lh.lab_order_time,   lh.lab_receive_time) AS lab_wait_receive_minutes,
    TIMESTAMPDIFF(MINUTE, lh.lab_receive_time, lh.lab_report_time)  AS lab_process_minutes,
    TIMESTAMPDIFF(MINUTE, lh.lab_order_time,   lh.lab_report_time)  AS lab_total_minutes,

    xr.xray_item_count,
    TIMESTAMPDIFF(MINUTE, xr.xray_order_time, xr.xray_exam_time)   AS xray_wait_minutes,
    TIMESTAMPDIFF(MINUTE, xr.xray_exam_time,  xr.xray_report_time) AS xray_process_minutes,
    TIMESTAMPDIFF(MINUTE, xr.xray_order_time, xr.xray_report_time) AS xray_total_minutes

  FROM service_time st
  LEFT JOIN kskdepartment d5 ON d5.depcode = st.service5_dep

  LEFT JOIN (
    SELECT DISTINCT hn, nextdate FROM oapp WHERE hn IS NOT NULL AND nextdate IS NOT NULL
  ) ap ON ap.hn = st.hn AND ap.nextdate = st.vstdate

  LEFT JOIN (
    SELECT vn,
      MIN(CASE WHEN order_time='24:00:00' THEN STR_TO_DATE(CONCAT(order_date,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
               ELSE STR_TO_DATE(CONCAT(order_date,' ',order_time),'%Y-%m-%d %H:%i:%s') END)   AS lab_order_time,
      MIN(CASE WHEN receive_time='24:00:00' THEN STR_TO_DATE(CONCAT(receive_date,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
               ELSE STR_TO_DATE(CONCAT(receive_date,' ',receive_time),'%Y-%m-%d %H:%i:%s') END) AS lab_receive_time,
      MAX(CASE WHEN report_time='24:00:00' THEN STR_TO_DATE(CONCAT(report_date,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
               ELSE STR_TO_DATE(CONCAT(report_date,' ',report_time),'%Y-%m-%d %H:%i:%s') END)  AS lab_report_time,
      COUNT(*) AS lab_item_count
    FROM lab_head WHERE vn IS NOT NULL GROUP BY vn
  ) lh ON lh.vn = st.vn

  LEFT JOIN (
    SELECT vn,
      MIN(COALESCE(order_datetime,
        CASE WHEN request_time='24:00:00' THEN STR_TO_DATE(CONCAT(request_date,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
             ELSE STR_TO_DATE(CONCAT(request_date,' ',request_time),'%Y-%m-%d %H:%i:%s') END)) AS xray_order_time,
      MIN(CASE WHEN examined_time='24:00:00' THEN STR_TO_DATE(CONCAT(examined_date,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
               ELSE STR_TO_DATE(CONCAT(examined_date,' ',examined_time),'%Y-%m-%d %H:%i:%s') END) AS xray_exam_time,
      MAX(CASE WHEN confirm_read_time='24:00:00' THEN STR_TO_DATE(CONCAT(confirm_read_date,' 00:00:00'),'%Y-%m-%d %H:%i:%s')+INTERVAL 1 DAY
               ELSE STR_TO_DATE(CONCAT(confirm_read_date,' ',confirm_read_time),'%Y-%m-%d %H:%i:%s') END) AS xray_report_time,
      COUNT(*) AS xray_item_count
    FROM xray_report WHERE vn IS NOT NULL GROUP BY vn
  ) xr ON xr.vn = st.vn

  WHERE st.vstdate BETWEEN ? AND ?
) v
WHERE 1=1
  ${scopeCond(scope)}
  ${visitCond(vt)}
`;
}

// ─── row shape จาก DB ─────────────────────────────────────────────────────────
interface VisitRow extends RowDataPacket {
  vn: string;
  vstdate: string;
  is_appointment_visit: number;
  is_er_visit: number;
  doctor_department: string | null;
  arrival_hour: number | null;
  arrival_minute: number | null;
  wait_screening_min: number | null;
  screening_min: number | null;
  wait_doctor_min: number | null;
  consult_min: number | null;
  wait_pharmacy_min: number | null;
  total_opd_min: number | null;
  lab_item_count: number | null;
  lab_wait_receive_minutes: number | null;
  lab_process_minutes: number | null;
  lab_total_minutes: number | null;
  xray_item_count: number | null;
  xray_wait_minutes: number | null;
  xray_process_minutes: number | null;
  xray_total_minutes: number | null;
}

// ─── ตัวช่วยสถิติ ─────────────────────────────────────────────────────────────
const isValid = (v: number | null | undefined): v is number =>
  v != null && Number.isFinite(v) && v >= 0 && v <= MAX_MINUTES;

const round1 = (n: number) => Math.round(n * 10) / 10;

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return round1(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

function statOf(rawValues: (number | null)[]): StatBlock {
  const vals = rawValues.filter(isValid).sort((a, b) => a - b);
  if (vals.length === 0)
    return {
      count: 0,
      avg: null,
      median: null,
      p90: null,
      min: null,
      max: null,
    };
  const sum = vals.reduce((a, b) => a + b, 0);
  return {
    count: vals.length,
    avg: round1(sum / vals.length),
    median: percentile(vals, 0.5),
    p90: percentile(vals, 0.9),
    min: vals[0],
    max: vals[vals.length - 1],
  };
}

function withinPct(
  rawValues: (number | null)[],
  target: number | null,
): number | null {
  if (target == null) return null;
  const vals = rawValues.filter(isValid);
  if (vals.length === 0) return null;
  return round1((vals.filter((v) => v <= target).length / vals.length) * 100);
}

function stageStat(
  key: string,
  label: string,
  target: number | null,
  values: (number | null)[],
): StageStat {
  return {
    key,
    label,
    target,
    stat: statOf(values),
    withinTargetPct: withinPct(values, target),
  };
}

function ancillary(
  waitVals: (number | null)[],
  procVals: (number | null)[],
  totalVals: (number | null)[],
  itemVisits: number,
  target: number | null,
): AncillaryStat {
  return {
    itemVisits,
    wait: statOf(waitVals),
    process: statOf(procVals),
    total: statOf(totalVals),
    target,
    withinTargetPct: withinPct(totalVals, target),
  };
}

// ─── main ─────────────────────────────────────────────────────────────────────
export async function getServiceTime(
  start: string,
  end: string,
  scope: ServiceScope,
  visitType: VisitType,
  shift: ServiceShift = "all",
  clinic: string = "all",
  targetTotalInput?: number | null,
): Promise<ServiceTimeData> {
  assertDate(start);
  assertDate(end);

  // เป้าหมายเวลารวม: รับจาก request ได้ (10–720 น.) ไม่งั้นใช้ค่า default R9
  const totalTarget =
    targetTotalInput != null &&
    Number.isFinite(targetTotalInput) &&
    targetTotalInput >= 10 &&
    targetTotalInput <= MAX_MINUTES
      ? Math.round(targetTotalInput)
      : ST_TARGETS.total;

  const sql = buildRowSql(scope, visitType);
  const [allRows] = await db.query<VisitRow[]>(sql, [start, end]);

  // รายชื่อคลินิกทั้งหมดในช่วงวันที่ (ก่อนกรองเวร/คลินิก → dropdown คงที่)
  const clinics = [
    ...new Set(allRows.map((r) => depOf(r.doctor_department))),
  ].sort((a, b) => a.localeCompare(b, "th"));

  // ชั้นกรอง: เวร → ใช้กับทุกส่วน (รวมตารางรายคลินิก) · คลินิก → ใช้กับทุกส่วน "ยกเว้น" ตารางรายคลินิก
  const shiftRows =
    shift === "all"
      ? allRows
      : allRows.filter((r) => inShift(r.arrival_minute, shift));
  const rows =
    clinic === "all"
      ? shiftRows
      : shiftRows.filter((r) => depOf(r.doctor_department) === clinic);

  // ── summary flags ──
  const appointmentVisits = rows.filter(
    (r) => r.is_appointment_visit === 1,
  ).length;
  const walkinVisits = rows.length - appointmentVisits;
  const erVisits = rows.filter((r) => r.is_er_visit === 1).length;
  const completeFlowVisits = rows.filter((r) =>
    isValid(r.total_opd_min),
  ).length;

  // ── stages (ภาพรวม) — ขับด้วย STAGE_DEFS แหล่งเดียว ──
  const stages: StageStat[] = STAGE_DEFS.map((d) =>
    stageStat(d.key, d.label, d.target, rows.map(d.pick)),
  );

  const totalStage = stageStat(
    "total",
    "ระยะเวลารวม (คัดกรอง → รับยา)",
    totalTarget,
    rows.map((r) => r.total_opd_min),
  );

  // ── trend รายวัน ──
  const byDay = new Map<string, number[]>();
  for (const r of rows) {
    const d = String(r.vstdate).slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, []);
    if (isValid(r.total_opd_min)) byDay.get(d)!.push(r.total_opd_min!);
  }
  // นับ visit ต่อวัน (ทุก visit ไม่ใช่แค่ที่ครบ flow)
  const visitByDay = new Map<string, number>();
  for (const r of rows) {
    const d = String(r.vstdate).slice(0, 10);
    visitByDay.set(d, (visitByDay.get(d) ?? 0) + 1);
  }
  const trend: TrendPoint[] = [...visitByDay.keys()].sort().map((d) => {
    const totals = byDay.get(d) ?? [];
    const avg = totals.length
      ? round1(totals.reduce((a, b) => a + b, 0) / totals.length)
      : null;
    const [, m, day] = d.split("-");
    return {
      date: d,
      label: `${day}/${m}`,
      visits: visitByDay.get(d) ?? 0,
      avgTotal: avg,
    };
  });

  // ── distribution (total_opd) ──
  const buckets: { label: string; test: (v: number) => boolean }[] = [
    { label: "≤30", test: (v) => v <= 30 },
    { label: "31-60", test: (v) => v > 30 && v <= 60 },
    { label: "61-90", test: (v) => v > 60 && v <= 90 },
    { label: "91-120", test: (v) => v > 90 && v <= 120 },
    { label: "121-180", test: (v) => v > 120 && v <= 180 },
    { label: ">180", test: (v) => v > 180 },
  ];
  const totalVals = rows
    .map((r) => r.total_opd_min)
    .filter(isValid) as number[];
  const distribution: DistributionBucket[] = buckets.map((b) => ({
    label: b.label,
    count: totalVals.filter(b.test).length,
  }));

  // ── by department (แผนกจุดตรวจ) — จาก shiftRows (ทุกคลินิก) พร้อมแยกรายขั้นตอน ──
  const deptRows = new Map<string, VisitRow[]>();
  for (const r of shiftRows) {
    const dep = depOf(r.doctor_department);
    if (!deptRows.has(dep)) deptRows.set(dep, []);
    deptRows.get(dep)!.push(r);
  }
  const byDepartment: DepartmentRow[] = [...deptRows.entries()]
    .map(([department, drs]) => {
      const totalsRaw = drs.map((r) => r.total_opd_min);
      const totalStat = statOf(totalsRaw);

      // เวลาแต่ละขั้นตอนของคลินิกนี้
      const stageCells = STAGE_DEFS.map((d) => {
        const s = statOf(drs.map(d.pick));
        return { key: d.key, avg: s.avg, median: s.median };
      });

      // จุดคอขวด = ขั้นตอน "รอ" ที่เฉลี่ยนานสุด
      let bottleneckKey: string | null = null;
      let worst = -1;
      for (const d of STAGE_DEFS) {
        if (!d.isWait) continue;
        const cell = stageCells.find((c) => c.key === d.key);
        if (cell?.avg != null && cell.avg > worst) {
          worst = cell.avg;
          bottleneckKey = d.key;
        }
      }

      return {
        department,
        visits: drs.length,
        completeFlowVisits: totalStat.count,
        avgTotal: totalStat.avg,
        medianTotal: totalStat.median,
        withinTargetPct: withinPct(totalsRaw, totalTarget),
        bottleneckKey,
        stages: stageCells,
      };
    })
    // เรียงจากเวลารวมมัธยฐานมาก→น้อย (คลินิกที่รอนานสุดอยู่บน)
    .sort((a, b) => (b.medianTotal ?? 0) - (a.medianTotal ?? 0))
    .slice(0, 25);

  // ── hourly (ชั่วโมงที่มาถึงจุดคัดกรอง) ──
  const hourMap = new Map<number, number>();
  for (const r of rows) {
    if (r.arrival_hour == null) continue;
    const h = Number(r.arrival_hour);
    if (h < 0 || h > 23) continue;
    hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
  }
  const hourly: HourlyRow[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    visits: hourMap.get(h) ?? 0,
  }));

  // ── lab / xray ──
  const lab = ancillary(
    rows.map((r) => r.lab_wait_receive_minutes),
    rows.map((r) => r.lab_process_minutes),
    rows.map((r) => r.lab_total_minutes),
    rows.filter((r) => (r.lab_item_count ?? 0) > 0).length,
    ST_TARGETS.lab,
  );
  const xray = ancillary(
    rows.map((r) => r.xray_wait_minutes),
    rows.map((r) => r.xray_process_minutes),
    rows.map((r) => r.xray_total_minutes),
    rows.filter((r) => (r.xray_item_count ?? 0) > 0).length,
    ST_TARGETS.xray,
  );

  return {
    updatedAt: new Date().toISOString(),
    start,
    end,
    scope,
    visitType,
    shift,
    clinic,
    clinics,
    targetTotal: totalTarget,
    summary: {
      totalVisits: rows.length,
      completeFlowVisits,
      appointmentVisits,
      walkinVisits,
      erVisits,
      total: totalStage,
    },
    stages,
    trend,
    distribution,
    byDepartment,
    hourly,
    lab,
    xray,
  };
}
