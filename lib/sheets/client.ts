// lib/sheets/client.ts
// Google Sheets client + metadata helpers — ใช้ร่วมกันทุก *-sheets route
import { google, sheets_v4 } from "googleapis";

type Sheets = sheets_v4.Sheets;

/**
 * สร้าง Google Sheets client
 * @param readonly true = scope readonly (default), false = read/write (สำหรับ append เช่น it-worklog)
 */
export async function getSheetClient(readonly = true): Promise<Sheets> {
  const scope = readonly
    ? "https://www.googleapis.com/auth/spreadsheets.readonly"
    : "https://www.googleapis.com/auth/spreadsheets";

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: [scope],
  });

  return google.sheets({ version: "v4", auth });
}

/** ชื่อ sheet แรกของ spreadsheet (fallback "Sheet1") */
export async function getFirstSheetTitle(
  sheets: Sheets,
  spreadsheetId: string,
): Promise<string> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return meta.data.sheets?.[0]?.properties?.title ?? "Sheet1";
}

/** ชื่อ sheet ทั้งหมด (กรองค่าว่างออก) */
export async function getAllSheetTitles(
  sheets: Sheets,
  spreadsheetId: string,
): Promise<string[]> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? "")
    .filter(Boolean);
}

/** ดึงค่าทั้ง range เป็น string[][] (คืน [] ถ้าไม่มีข้อมูล) */
export async function getValues(
  sheets: Sheets,
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values ?? []) as string[][];
}
