// lib/deptStatus.types.ts
// TypeScript interfaces สำหรับ Dashboard สถานะผู้ป่วยตามแผนก (Dept Status)
// แยกออกจาก service เพื่อให้ฝั่ง client (page.tsx) import type ได้โดยไม่ดึง db เข้า bundle

/** การ์ด 1 ใบ = 1 แผนก (จัดกลุ่มด้วย cur_dep) */
export interface DeptStatusCard {
  dep_code: string;
  dep_name: string;
  /** เข้าแผนกนี้ทั้งหมดวันนี้ (cur_dep = X หรือ last_dep = X) — ตัวหาร */
  entered: number;
  /** ยังไม่เสร็จ = ยังอยู่แผนกนี้ (cur_dep = X) และยังไม่ถูกจำหน่าย — ตัวตั้ง */
  active: number;
  /** เสร็จ/ผ่านแผนกนี้ไปแล้ว = entered - active */
  done: number;
  /** % = active / entered * 100 */
  percent: number;
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
  /** label สถานะ (จาก ovstost.name หรือ "เสร็จ/จำหน่าย") */
  status: string;
  /** ถูกจำหน่ายออกจาก OPD แล้วหรือยัง */
  isDischarged: boolean;
  vsttime: string;
}

/** payload รวมที่ API ส่งกลับ */
export interface DeptStatusData {
  updatedAt: string;
  date: string; // YYYY-MM-DD (ค.ศ.)
  totalVisits: number; // ผู้รับบริการ OPD ทั้งหมดของวันนั้น
  totalActive: number; // ยังไม่เสร็จทั้งโรงพยาบาล
  totalDone: number; // เสร็จ/จำหน่ายแล้ว
  cards: DeptStatusCard[];
  patients: DeptPatientRow[];
}
