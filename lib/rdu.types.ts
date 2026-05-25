// lib/rdu.types.ts
// TypeScript interfaces สำหรับ RDU Dashboard — ใช้ร่วมกัน API ↔ Page

import type { DiseaseKey } from "./rdu.constants";

export interface RduDiseaseRow {
  key: DiseaseKey;
  name: string;
  full: string;
  icon: string;
  color: string;
  target: number;
  visits: number;    // visit ทั้งหมดที่มี dx นั้น
  rxN: number;       // visit ที่ได้รับ ATB
  current: number;   // % = rxN/visits*100
}

export interface RduTrendRow {
  month: string;     // YYYY-MM
  label: string;     // ม.ค. 68
  uri_total: number;   uri_rx: number;
  dia_total: number;   dia_rx: number;
  wound_total: number; wound_rx: number;
  peri_total: number;  peri_rx: number;
}

export interface RduDoctorRow {
  doctor_code: string;
  doctor_name: string;
  dept: string;
  visits: number;
  uri_total: number;   uri_rx: number;   uri_pct: number;
  dia_total: number;   dia_rx: number;   dia_pct: number;
  wound_total: number; wound_rx: number; wound_pct: number;
  peri_total: number;  peri_rx: number;  peri_pct: number;
}

export interface RduAtbRow {
  drug_name: string;
  rx_count: number;
  disease_key: string;
}

export interface RduDashboardData {
  updatedAt: string;
  start: string;
  end: string;
  diseases: RduDiseaseRow[];
  trend: RduTrendRow[];
  doctors: RduDoctorRow[];
  topAtb: RduAtbRow[];
  atbByDisease: Record<DiseaseKey, RduAtbRow[]>;
}