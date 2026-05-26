// app/api/it-worklog-sheets/route.ts
// ดึงข้อมูลจาก Google Sheets แทน CSV เพื่อให้ it-worklog page เห็นข้อมูลที่กรอกผ่าน form ได้เลย

import { NextResponse } from "next/server";
import { google } from "googleapis";
import type { WorkRow } from "@/app/api/it-worklog-csv/route";

// Re-export WorkRow type
export type { WorkRow };

const SHEET_NAME = process.env.IT_WORKLOG_SHEET_NAME ?? "บันทึกประจำวัน";
const SPREADSHEET_ID =
  process.env.IT_WORKLOG_SPREADSHEET_ID ?? process.env.GOOGLE_SHEET_ID!;

async function getSheetClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

function normalizeDate(raw: string): string {
  if (!raw) return "";
  // รองรับ YYYY-MM-DD หรือ DD/MM/YYYY หรือ DD/MM/YYYY+543
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = parseInt(iso[1]);
    const ce = y > 2400 ? y - 543 : y;
    return `${ce}-${iso[2]}-${iso[3]}`;
  }
  // รูปแบบ DD/MM/YYYY (พ.ศ.)
  const thai = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (thai) {
    const d = thai[1].padStart(2, "0");
    const m = thai[2].padStart(2, "0");
    const y = parseInt(thai[3]);
    const ce = y > 2400 ? y - 543 : y;
    return `${ce}-${m}-${d}`;
  }
  return "";
}

function parseSheetRows(rows: string[][]): WorkRow[] {
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h).trim());

  // map header → index
  const idx = (name: string) => header.findIndex((h) => h.includes(name));

  const iTimestamp = 0; // col A ประทับเวลา
  const iStaff = idx("ชื่อเจ้าหน้าที่ไอที");
  const iMain = idx("เลือกงานหลัก");
  const iIntranet = idx("เลือกงานIntranet");
  const iOther = idx("เลือกงาน อื่นๆ");
  const iHosOff = idx("เลือกงาน Hos Office");
  const iHosXP = idx("เลือกงาน HosXP");
  const iReport = idx("เลือกงาน ข้อมูลรายงาน");
  const iComputer = idx("เลือกงาน คอมพิวเตอร์");
  const iNetwork = idx("เลือกงาน Network");
  const iUrgency = idx("ความเร่งด่วน");
  const iDev = idx("การพัฒนา");
  const iDate = idx("วันที่ปฏิบัติงาน");
  const iStartTime = idx("เวลาเริ่ม");
  const iEndTime = idx("เวลาแล้วเสร็จ");
  const iDuration = idx("รวมระยะเวลา");
  const iTimeliness = idx("ความทันเวลา");
  const iDept = idx("ฝ่าย");
  const iDoc = header.findIndex((h) => h === "คำถาม"); // ระบบเอกสาร

  const get = (row: string[], i: number) =>
    i >= 0 ? (row[i] ?? "").trim() : "";

  /** เลือก sub-task ที่ตรงกับ mainTask */
  function resolveSubTask(mainTask: string, row: string[]): string {
    const t = mainTask.trim();
    if (t === "ระบบ HosXP") return get(row, iHosXP);
    if (t === "ระบบอินทราเน็ต") return get(row, iIntranet);
    if (t === "คอมพิวเตอร์และอุปกรณ์ต่อพ่วง") return get(row, iComputer);
    if (t === "ระบบ Network") return get(row, iNetwork);
    if (t === "ระบบข้อมูล และรายงาน") return get(row, iReport);
    if (t === "ระบบอื่นๆ") return get(row, iOther);
    if (t === "ระบบเอกสาร") return get(row, iDoc);
    if (t === "ระบบ  GTWOffice" || t === "ระบบ Hos Office")
      return get(row, iHosOff);
    return "";
  }

  const result: WorkRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as string[];
    // skip แถวว่างหรือ separator
    if (!row || !row[iDate] || !row[iStaff]) continue;

    const rawDate = get(row, iDate);
    const date = normalizeDate(rawDate);
    if (!date) continue;

    const mainTask = get(row, iMain);
    const subTask = resolveSubTask(mainTask, row);
    const durationRaw = get(row, iDuration);
    const duration = Number(durationRaw) || 0;

    result.push({
      date,
      staff: get(row, iStaff),
      mainTask,
      subTask,
      subHosXP: get(row, iHosXP),
      subIntranet: get(row, iIntranet),
      subComputer: get(row, iComputer),
      subNetwork: get(row, iNetwork),
      subReport: get(row, iReport),
      subOther: get(row, iOther),
      subDoc: get(row, iDoc),
      urgency: get(row, iUrgency),
      devType: get(row, iDev),
      duration,
      department: get(row, iDept),
      timeliness: get(row, iTimeliness),
    });
  }

  return result;
}

export async function GET() {
  try {
    if (!SPREADSHEET_ID) {
      return NextResponse.json(
        { error: "ไม่ได้ตั้งค่า GOOGLE_SHEET_ID" },
        { status: 500 },
      );
    }

    const sheets = await getSheetClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:AN`,
    });

    const raw = (res.data.values ?? []) as string[][];
    const rows = parseSheetRows(raw);

    return NextResponse.json(rows);
  } catch (err: unknown) {
    console.error("it-worklog-sheets:", err);
    return NextResponse.json(
      {
        error:
          "ดึงข้อมูลจาก Google Sheets ไม่สำเร็จ: " + (err as Error).message,
      },
      { status: 500 },
    );
  }
}
