import {
  User,
  UserCheck,
  BedDouble,
  Shield,
  UserCog,
  Globe,
  PhoneIncoming,
  PhoneOutgoing,
  Siren,
  AlertTriangle,
} from "lucide-react";
import type { OpdCardKey, DatePreset } from "../types/dashboard.types";

// ─── OPD Cards ────────────────────────────────────────────────────────────────
export interface OpdCardConfig {
  label: string;
  bg: string;
  visitKey: OpdCardKey;
  patKey: OpdCardKey | null;
  Icon: React.ElementType;
  cardType: string;
}

export const OPD_CARDS: OpdCardConfig[] = [
  {
    label: "ผู้รับบริการทั้งหมด",
    bg: "#80E9FF",
    visitKey: "totalVisit",
    patKey: "totalPatient",
    Icon: User,
    cardType: "all",
  },
  {
    label: "OPD ในเวลา",
    bg: "#FF8080",
    visitKey: "opdOnTime",
    patKey: null,
    Icon: UserCheck,
    cardType: "opdOnTime",
  },
  {
    label: "OPD นอกเวลา",
    bg: "#7DE8B0",
    visitKey: "opdOffTime",
    patKey: null,
    Icon: UserCheck,
    cardType: "opdOffTime",
  },
  {
    label: "Admit",
    bg: "#9B9CF4",
    visitKey: "admitToday",
    patKey: null,
    Icon: BedDouble,
    cardType: "admitToday",
  },
  {
    label: "สิทธิ์บัตรทอง UC",
    bg: "#FF8080",
    visitKey: "opdUc",
    patKey: null,
    Icon: UserCheck,
    cardType: "opdUc",
  },
  {
    label: "สิทธิ์ราชการ",
    bg: "#FF8080",
    visitKey: "opdGov",
    patKey: null,
    Icon: Shield,
    cardType: "opdGov",
  },
  {
    label: "ประกันสังคม",
    bg: "#FF8080",
    visitKey: "opdSso",
    patKey: null,
    Icon: UserCog,
    cardType: "opdSso",
  },
  {
    label: "ชำระเงิน / พรบ.",
    bg: "#FF8080",
    visitKey: "opdCash",
    patKey: null,
    Icon: UserCheck,
    cardType: "opdCash",
  },
  {
    label: "แรงงานต่างด้าว",
    bg: "#FF8080",
    visitKey: "opdForeign",
    patKey: null,
    Icon: Globe,
    cardType: "opdForeign",
  },
  {
    label: "Refer In",
    bg: "#FF8080",
    visitKey: "referIn",
    patKey: null,
    Icon: PhoneIncoming,
    cardType: "referIn",
  },
  {
    label: "Refer Out",
    bg: "#FF8080",
    visitKey: "referOut",
    patKey: null,
    Icon: PhoneOutgoing,
    cardType: "referOut",
  },
  {
    label: "ผู้ป่วยฉุกเฉิน (ER)",
    bg: "#FF6B6B",
    visitKey: "erEmergency",
    patKey: null,
    Icon: Siren,
    cardType: "erEmergency",
  },
  {
    label: "อุบัติเหตุ",
    bg: "#FF8C42",
    visitKey: "erAccident",
    patKey: null,
    Icon: AlertTriangle,
    cardType: "erAccident",
  },
];

export const DATE_PRESETS: DatePreset[] = ["วันนี้", "สัปดาห์นี้", "เดือนนี้"];

// ─── Bed Occupancy Colors ─────────────────────────────────────────────────────
export function getBedOccupancyColor(rate: number): string {
  if (rate >= 90) return "#f87171";
  if (rate >= 70) return "#fbbf24";
  return "#add8e6";
}
