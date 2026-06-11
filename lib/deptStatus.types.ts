// lib/deptStatus.types.ts
// TypeScript interfaces สำหรับ Dashboard สถานะผู้ป่วยตามแผนก (Dept Status)
// แยกออกจาก service เพื่อให้ฝั่ง client (page.tsx) import type ได้โดยไม่ดึง db เข้า bundle

/** การ์ด 1 ใบ = 1 แผนก (จัดกลุ่มด้วย cur_dep) */
export interface DeptStatusCard {
  dep_code: string;
  dep_name: string;
  /** เข้าแผนกนี้ทั้งหมดวันนี้ (cur_dep = X หรือ last_dep = X) — ตัวหาร */
  entered: number;
  /** ยังไม่เสร็จ = ยังอยู่แผนกนี้ (cur_dep = X) และสถานะยังไม่ "เสร็จ" — ตัวตั้ง */
  active: number;
  /** เสร็จ/ผ่านแผนกนี้ไปแล้ว = entered - active */
  done: number;
  /** % = active / entered * 100 */
  percent: number;
  /** การ์ดรวม "กลับบ้าน / ออกจาก OPD" (ไม่ใช่แผนกจริง) */
  isExit?: boolean;
}

/** สถานะผู้ป่วยรายคน (ใช้ใน modal + ตาราง) */
export interface DeptPatientRow {
  vn: string;
  hn: string;
  patient_name: string;
  cur_dep_code: string;
  cur_dep_name: string;
  last_dep_code: string;
  last_dep_name: string;
  /** ชื่อสถานะจริง (ovstost.name) เช่น "รอรับยา", "ตรวจแล้ว", "Admit แผนก..." */
  status: string;
  /** สถานะนี้ถือว่า "เสร็จ/ออกจาก OPD แล้ว" หรือยัง */
  isFinished: boolean;
  vsttime: string;
}

/** จำนวนผู้ป่วยแยกตามชื่อสถานะ (ovstost.name) */
export interface DeptStatusCount {
  name: string;
  count: number;
  finished: boolean;
}

/** payload รวมที่ API ส่งกลับ */
export interface DeptStatusData {
  updatedAt: string;
  date: string; // YYYY-MM-DD (ค.ศ.)
  totalVisits: number; // ผู้รับบริการทั้งหมดของวันนั้น
  totalActive: number; // ยังไม่เสร็จทั้งโรงพยาบาล
  totalDone: number; // เสร็จ/ออกจาก OPD แล้ว
  cards: DeptStatusCard[];
  patients: DeptPatientRow[];
  byStatus: DeptStatusCount[]; // สรุปตามชื่อสถานะ (เรียงมากไปน้อย)
}
