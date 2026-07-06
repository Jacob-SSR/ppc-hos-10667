// lib/servicetime.types.ts

export type ServiceScope = "all" | "opd" | "er";
export type VisitType = "all" | "appt" | "walkin";
/** ช่วงเวลา (เวร) ตามเวลาเข้าจุดคัดกรอง */
export type ServiceShift = "all" | "morning" | "evening" | "night";

/** สถิติสรุปของ 1 กลุ่มค่า (นาที) */
export interface StatBlock {
  count: number; // จำนวน visit ที่มีค่าใช้คำนวณได้
  avg: number | null; // ค่าเฉลี่ย (นาที)
  median: number | null; // มัธยฐาน (นาที)
  p90: number | null; // เปอร์เซ็นไทล์ที่ 90 (นาที)
  min: number | null;
  max: number | null;
}

/** 1 ขั้นตอนใน flow OPD */
export interface StageStat {
  key: string;
  label: string;
  target: number | null; // เป้าหมาย (นาที) — ปรับได้ตามเกณฑ์ R9
  stat: StatBlock;
  withinTargetPct: number | null; // % visit ที่ ≤ target
}

export interface ServiceTimeSummary {
  totalVisits: number; // visit ทั้งหมดในเงื่อนไข
  completeFlowVisits: number; // visit ที่มีทั้งจุดเริ่ม (คัดกรอง) และจุดจบ (รับยา)
  appointmentVisits: number;
  walkinVisits: number;
  erVisits: number;
  total: StageStat; // ระยะเวลารวม OPD (คัดกรอง → รับยา)
  within120Pct: number | null; // % visit ที่เวลารวม ≤ 120 นาที (เกณฑ์ตายตัว แยกจากเป้าหมายที่ปรับได้)
  bottleneckKey: string | null; // ขั้นตอน "รอ" ที่เฉลี่ยนานสุด (ภาพรวม)
  bottleneckLabel: string | null; // ป้ายสั้นของขั้นตอนคอขวด
}

/** จำนวนผู้ป่วยที่ "เริ่ม" แต่ละขั้นตอนในชั่วโมงนั้น ๆ — คีย์ = StageStat.key, ค่า = จำนวนคน */
export interface HourlyStagePoint {
  hour: number; // 0-23
  [stageKey: string]: number;
}

export interface WaitBucketCell {
  label: string; // ป้ายช่วงเวลา เช่น "≤15 นาที"
  count: number;
}

/** การกระจายจำนวนคนตามช่วงเวลารอ ของ 1 ขั้นตอน */
export interface WaitBucketRow {
  key: string;
  label: string;
  total: number; // จำนวน visit ที่มีค่าคำนวณได้ (ผลรวมทุก bucket)
  buckets: WaitBucketCell[];
}

/** ภาพรวมรายชั่วโมง — จำนวนผู้ป่วยมาถึง + เวลารวมเฉลี่ย ของผู้ป่วยที่มาถึงชั่วโมงนั้น */
export interface HourlyOverviewPoint {
  hour: number; // 0-23
  visits: number;
  avgTotal: number | null;
}

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  label: string; // DD/MM
  visits: number;
  avgTotal: number | null;
}

export interface DistributionBucket {
  label: string;
  count: number;
}

/** ค่าเฉลี่ย/มัธยฐาน 1 ขั้นตอน ของ 1 คลินิก (ใช้ในตารางแยกรายขั้นตอน) */
export interface DeptStageCell {
  key: string;
  avg: number | null;
  median: number | null;
}

export interface DepartmentRow {
  department: string;
  visits: number;
  completeFlowVisits: number; // visit ที่ครบ flow ในคลินิกนี้
  avgTotal: number | null;
  medianTotal: number | null;
  withinTargetPct: number | null; // % visit ที่เวลารวม ≤ เป้าหมาย
  bottleneckKey: string | null; // ขั้นตอน "รอ" ที่ใช้เวลาเฉลี่ยนานสุดในคลินิกนี้
  stages: DeptStageCell[]; // เวลาเฉลี่ย/มัธยฐาน แยกรายขั้นตอน (คีย์ตรงกับ stages[])
}

export interface HourlyRow {
  hour: number; // 0-23
  visits: number;
}

export interface AncillaryStat {
  itemVisits: number; // จำนวน visit ที่มีรายการ (lab/xray)
  wait: StatBlock; // สั่ง → รับ/ตรวจ
  process: StatBlock; // รับ/ตรวจ → รายงานผล
  total: StatBlock; // สั่ง → รายงานผล
  target: number | null; // เป้าหมาย total (นาที)
  withinTargetPct: number | null;
}

/** คอลัมน์ขั้นตอน (หัวตารางรายคลินิก/รายบุคคล) */
export interface StageColumn {
  key: string;
  label: string;
  short: string;
  target: number | null;
}

/** 1 visit ราย บุคคล (ตามตัวกรอง) */
export interface PersonVisit {
  vn: string;
  hn: string;
  department: string;
  date: string; // YYYY-MM-DD — วันที่ของ visit นี้ (vstdate)
  arrivalMinute: number | null;
  total: number | null;
  values: Record<string, number | null>;
}

export interface ServiceTimeData {
  updatedAt: string;
  start: string;
  end: string;
  scope: ServiceScope;
  visitType: VisitType;
  shift: ServiceShift; // เวรที่เลือก
  clinic: string; // คลินิกที่เลือก ("all" = ทุกคลินิก)
  clinics: string[]; // รายชื่อคลินิกที่มีในช่วงวันที่ (สำหรับ dropdown)
  targetTotal: number; // เป้าหมายเวลารวม (นาที) ที่ใช้คำนวณรอบนี้
  summary: ServiceTimeSummary;
  stages: StageStat[]; // ขั้นตอนหลักในเส้นทาง (แผงภาพรวม + กราฟองค์ประกอบ)
  allStages: StageStat[]; // ทุกขั้นตอน รวม lab/xray (ใช้กราฟเวลาเฉลี่ยแนวนอน 1-N)
  stageColumns: StageColumn[]; // ทุกขั้นตอน (รวม lab/xray) สำหรับหัวตาราง
  trend: TrendPoint[];
  distribution: DistributionBucket[];
  byDepartment: DepartmentRow[]; // ทุกคลินิก (กรองตามเวร ไม่กรองตามคลินิก) — ใช้เป็นตัวนำทาง
  hourly: HourlyRow[];
  hourlyStages: HourlyStagePoint[]; // จำนวนคนที่เริ่มแต่ละขั้นตอน แยกตามชั่วโมง (ใช้กราฟเส้นหลายเส้น)
  waitBuckets: WaitBucketRow[]; // การกระจายช่วงเวลารอ แยกรายขั้นตอน (ใช้กราฟแท่งซ้อนแนวนอน)
  hourlyOverview: HourlyOverviewPoint[]; // ผู้ป่วยมาถึง + เวลารวมเฉลี่ย แยกรายชั่วโมง (ใช้กราฟรวม แท่ง+เส้น)
  lab: AncillaryStat;
  xray: AncillaryStat;
  visits: PersonVisit[]; // ข้อมูลรายบุคคล (ตามตัวกรอง, cap 5000)
  visitsTotal: number; // จำนวน visit ทั้งหมดตามตัวกรอง (ก่อน cap)
  visitsTruncated: boolean; // true = ถูกตัดเพราะเกิน cap
}
