import {
  User, UserCheck, BedDouble, Shield, UserCog, Globe,
  PhoneIncoming, PhoneOutgoing, Siren, AlertTriangle, Car,
} from "lucide-react";
import type { OpdCardKey, DatePreset } from "../types/dashboard.types";

export interface OpdCardConfig {
  label: string;
  bg: string;
  visitKey: OpdCardKey;
  patKey: OpdCardKey | null;
  maleKey: OpdCardKey | null;
  femaleKey: OpdCardKey | null;
  Icon: React.ElementType;
  cardType: string;
}

export const OPD_CARDS: OpdCardConfig[] = [
  {
    label: "ผู้รับบริการทั้งหมด",
    bg: "#80E9FF",
    visitKey: "totalVisit",
    patKey: "totalPatient",
    maleKey: "totalMale",
    femaleKey: "totalFemale",
    Icon: User,
    cardType: "all",
  },
  {
    label: "OPD ในเวลา",
    bg: "#FF8080",
    visitKey: "opdOnTime",
    patKey: null,
    maleKey: "opdOnTimeMale",
    femaleKey: "opdOnTimeFemale",
    Icon: UserCheck,
    cardType: "opdOnTime",
  },
  {
    label: "OPD นอกเวลา",
    bg: "#7DE8B0",
    visitKey: "opdOffTime",
    patKey: null,
    maleKey: "opdOffTimeMale",
    femaleKey: "opdOffTimeFemale",
    Icon: UserCheck,
    cardType: "opdOffTime",
  },
  {
    label: "Admit",
    bg: "#9B9CF4",
    visitKey: "admitToday",
    patKey: null,
    maleKey: "admitMale",
    femaleKey: "admitFemale",
    Icon: BedDouble,
    cardType: "admitToday",
  },
  {
    label: "สิทธิ์บัตรทอง UC",
    bg: "#FF8080",
    visitKey: "opdUc",
    patKey: null,
    maleKey: "opdUcMale",
    femaleKey: "opdUcFemale",
    Icon: UserCheck,
    cardType: "opdUc",
  },
  {
    label: "สิทธิ์ราชการ",
    bg: "#FF8080",
    visitKey: "opdGov",
    patKey: null,
    maleKey: "opdGovMale",
    femaleKey: "opdGovFemale",
    Icon: Shield,
    cardType: "opdGov",
  },
  {
    label: "ประกันสังคม",
    bg: "#FF8080",
    visitKey: "opdSso",
    patKey: null,
    maleKey: "opdSsoMale",
    femaleKey: "opdSsoFemale",
    Icon: UserCog,
    cardType: "opdSso",
  },
  {
    label: "ชำระเงิน / พรบ.",
    bg: "#FF8080",
    visitKey: "opdCash",
    patKey: null,
    maleKey: "opdCashMale",
    femaleKey: "opdCashFemale",
    Icon: UserCheck,
    cardType: "opdCash",
  },
  {
    label: "แรงงานต่างด้าว",
    bg: "#FF8080",
    visitKey: "opdForeign",
    patKey: null,
    maleKey: "opdForeignMale",
    femaleKey: "opdForeignFemale",
    Icon: Globe,
    cardType: "opdForeign",
  },
  {
    label: "Refer In",
    bg: "#FF8080",
    visitKey: "referIn",
    patKey: null,
    maleKey: "referInMale",
    femaleKey: "referInFemale",
    Icon: PhoneIncoming,
    cardType: "referIn",
  },
  {
    label: "Refer Out",
    bg: "#FF8080",
    visitKey: "referOut",
    patKey: null,
    maleKey: "referOutMale",
    femaleKey: "referOutFemale",
    Icon: PhoneOutgoing,
    cardType: "referOut",
  },
  {
    label: "ผู้ป่วยฉุกเฉิน (ER)",
    bg: "#FF6B6B",
    visitKey: "erEmergency",
    patKey: null,
    maleKey: "erEmergencyMale",
    femaleKey: "erEmergencyFemale",
    Icon: Siren,
    cardType: "erEmergency",
  },
  {
    label: "อุบัติเหตุขนส่ง",
    bg: "#FEF9C3",
    visitKey: "erTransport",
    patKey: null,
    maleKey: "erTransportMale",
    femaleKey: "erTransportFemale",
    Icon: Car,
    cardType: "erTransport",
  },
  {
    label: "อุบัติเหตุอื่นๆ",
    bg: "#FF8C42",
    visitKey: "erOtherAccident",
    patKey: null,
    maleKey: "erOtherAccidentMale",
    femaleKey: "erOtherAccidentFemale",
    Icon: AlertTriangle,
    cardType: "erOtherAccident",
  },
];

export const DATE_PRESETS: DatePreset[] = ["วันนี้", "สัปดาห์นี้", "เดือนนี้"];

export function getBedOccupancyColor(rate: number): string {
  if (rate >= 90) return "#f87171";
  if (rate >= 70) return "#fbbf24";
  return "#add8e6";
}