// ─── OPD ──────────────────────────────────────────────────────────────────────

export interface OpdSummary {
  totalVisit: number;
  totalPatient: number;
  totalMale: number;
  totalFemale: number;
  opdOnTime: number;
  opdOnTimeMale: number;
  opdOnTimeFemale: number;
  opdOffTime: number;
  opdOffTimeMale: number;
  opdOffTimeFemale: number;
  admitToday: number;
  admitMale: number;
  admitFemale: number;
  opdUc: number;
  opdUcMale: number;
  opdUcFemale: number;
  opdGov: number;
  opdGovMale: number;
  opdGovFemale: number;
  opdSso: number;
  opdSsoMale: number;
  opdSsoFemale: number;
  opdCash: number;
  opdCashMale: number;
  opdCashFemale: number;
  opdForeign: number;
  opdForeignMale: number;
  opdForeignFemale: number;
  referIn: number;
  referInMale: number;
  referInFemale: number;
  referOut: number;
  referOutMale: number;
  referOutFemale: number;
  erEmergency: number;
  erEmergencyMale: number;
  erEmergencyFemale: number;
  erTransport: number;
  erTransportMale: number;
  erTransportFemale: number;
  erOtherAccident: number;
  erOtherAccidentMale: number;
  erOtherAccidentFemale: number;
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