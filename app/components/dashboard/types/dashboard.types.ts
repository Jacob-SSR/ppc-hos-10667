// ─── OPD ──────────────────────────────────────────────────────────────────────

export interface OpdSummary {
  totalVisit: number;
  totalPatient: number;
  opdOnTime: number;
  opdOffTime: number;
  admitToday: number;
  opdUc: number;
  opdGov: number;
  opdSso: number;
  opdCash: number;
  opdForeign: number;
  referIn: number;
  referOut: number;
  erEmergency: number;
  erAccident: number;
}

export type OpdCardKey = keyof OpdSummary;

export type DatePreset = "วันนี้" | "สัปดาห์นี้" | "เดือนนี้" | "กำหนดเอง";

// ─── IPD ──────────────────────────────────────────────────────────────────────

export interface WardDisplayItem {
  ward_code: string;
  label: string;
  totalBeds: number;
  admit: number;
  vacantLabel: string;
}

export interface IpdApiSummary {
  byWard: Array<{ ward_code: string; admit_total: number }>;
}

// ─── Patient ──────────────────────────────────────────────────────────────────

export interface PatientRow {
  vn: string;
  hn: string;
  cid: string;
  pname: string;
  fname: string;
  lname: string;
  age_y: number;
  sex: string;
  vstdate: string;
  vsttime: string;
  pdx: string;
  dx_name: string;
  department: string;
  pttype: string;
  pttype_name: string;
  doctor_name: string;
  income: number;
}

export interface HistoryRow {
  vn: string;
  vstdate: string;
  vsttime: string;
  pdx: string;
  dx_name: string;
  department: string;
  pttype_name: string;
  doctor_name: string;
}

export type GenderFilter = "all" | "male" | "female";

// ─── Bed Occupancy ────────────────────────────────────────────────────────────

export interface OccupancyRow {
  ward_code: string;
  label: string;
  total_beds: number;
  current_admit: number;
  occupancy_rate: number;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export interface ModalState {
  open: boolean;
  cardLabel: string;
  cardType: string;
}