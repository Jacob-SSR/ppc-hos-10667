// lib/sheets/modified.ts
// "ชีตถูกแก้ไขล่าสุดเมื่อไหร่" ของทุก Google Sheet ที่ระบบดึงข้อมูลมาแสดง
// — ต่างจาก updatedAt ของแต่ละ route ซึ่งเป็นเวลาที่ server ดึงข้อมูลเข้า cache
import { cachedQuery } from "../cache";
import { getSpreadsheetModifiedTime } from "./client";

/** key → ชื่อที่แสดง + env ที่เก็บ spreadsheet ID (เพิ่มชีตใหม่ที่นี่ที่เดียว) */
export const SHEET_SOURCES = {
  stroke: { label: "Stroke", env: "STROKE_SPREADSHEET_ID" },
  accident: { label: "อุบัติเหตุ", env: "ACCIDENT_SPREADSHEET_ID" },
  acs: { label: "ACS", env: "ACS_SPREADSHEET_ID" },
  anc: { label: "ANC", env: "ANC_SPREADSHEET_ID" },
  billing: { label: "Billing", env: "BILLING_SPREADSHEET_ID" },
  d506: { label: "D506", env: "D506_SPREADSHEET_ID" },
  dmtb: { label: "DM/TB", env: "DMTB_SPREADSHEET_ID" },
  drug: { label: "ยาเสพติด", env: "DRUG_SPREADSHEET_ID" },
  homeward: { label: "Home Ward", env: "HOMEWARD_SPREADSHEET_ID" },
  imc: { label: "IMC", env: "IMC_SPREADSHEET_ID" },
  ipHomeward: { label: "IP & Home Ward", env: "IP_HOMEWARD_SPREADSHEET_ID" },
  itWorklog: { label: "IT Worklog", env: "IT_WORKLOG_SPREADSHEET_ID" },
  ktb: { label: "KTB", env: "KTB_SPREADSHEET_ID" },
  minithan: { label: "มินิธัญญารักษ์", env: "MINITHAN_SPREADSHEET_ID" },
  sepsis: { label: "Sepsis", env: "Sepsis_SPREADSHEET_ID" },
  stm: { label: "STM", env: "STM_SHEET_ID" },
  tb: { label: "TB", env: "TB_SPREADSHEET_ID" },
  pikad: { label: "พิกัดหลังคาเรือน (แผนที่)", env: "PIKAD_SPREADSHEET_ID" },
} as const satisfies Record<string, { label: string; env: string }>;

export type SheetSourceKey = keyof typeof SHEET_SOURCES;

export interface SheetModifiedInfo {
  key: SheetSourceKey;
  label: string;
  /** ISO string — null = ยังไม่ได้ตั้งค่า env หรือถาม Drive ไม่สำเร็จ */
  modifiedAt: string | null;
  error?: string;
}

const TTL_SECONDS = 120;

export function isSheetSourceKey(k: string): k is SheetSourceKey {
  return Object.prototype.hasOwnProperty.call(SHEET_SOURCES, k);
}

async function fetchOne(key: SheetSourceKey): Promise<SheetModifiedInfo> {
  const { label, env } = SHEET_SOURCES[key];
  const id = process.env[env];
  if (!id) return { key, label, modifiedAt: null, error: `ไม่ได้ตั้งค่า ${env}` };
  try {
    return { key, label, modifiedAt: await getSpreadsheetModifiedTime(id) };
  } catch (err) {
    console.error(`SheetModified(${key}) error:`, err);
    return { key, label, modifiedAt: null, error: (err as Error).message };
  }
}

/** แต่ละชีต cache แยกกัน — หน้าไหนขอชีตไหนก็ถาม Drive เฉพาะชีตนั้น */
export function getSheetsModified(
  keys: SheetSourceKey[],
): Promise<SheetModifiedInfo[]> {
  return Promise.all(
    keys.map((k) => cachedQuery(["sheet-modified", k], () => fetchOne(k), TTL_SECONDS)),
  );
}
