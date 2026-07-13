// app/api/it-worklog-form/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { db2 } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { getSheetClient, sheetsError } from "@/lib/sheets";
import { cachedQuery, invalidate } from "@/lib/cache";

type UserRow = RowDataPacket & { user: string; name: string; role: string };

// cache 5 นาที — worklog เขียนโดยทีม IT เองผ่าน POST ซึ่ง invalidate cache ให้ทันที
// TTL นี้จึงมีผลแค่กรณีมีคนแก้ตรงในชีต Google โดยไม่ผ่านระบบ
const TTL_SECONDS = 300;
const CACHE_PREFIX = "it-worklog-form";

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      username: string;
    };
    const [rows] = await db2.query<UserRow[]>(
      "SELECT `user`, name, role FROM ppchos.users WHERE `user` = ? LIMIT 1",
      [decoded.username],
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

const SHEET_NAME = process.env.IT_WORKLOG_SHEET_NAME ?? "บันทึกประจำวัน";
const SPREADSHEET_ID =
  process.env.IT_WORKLOG_SPREADSHEET_ID ?? process.env.GOOGLE_SHEET_ID!;

// header columns ตรงกับ Google Form เดิม (40 คอลัมน์)
const HEADERS = [
  "ประทับเวลา",
  "ชื่อเจ้าหน้าที่ไอที",
  "เลือกงานหลัก",
  "คอลัมน์ 3",
  "คอลัมน์ 4",
  "เลือกงานIntranet",
  "เลือกงาน อื่นๆ",
  "เลือกงาน Hos Office",
  "เลือกงาน HosXP",
  "เลือกงาน ข้อมูลรายงาน",
  "เลือกงาน คอมพิวเตอร์",
  "เลือกงาน Network",
  "ความเร่งด่วน",
  "การพัฒนา",
  "วันที่ปฏิบัติงาน",
  "เวลาเริ่ม",
  "เวลาแล้วเสร็จ",
  "รวมระยะเวลา (นาที)",
  "ความทันเวลา",
  "ฝ่าย / กลุ่มงาน",
  "คำถาม",
  "คอลัมน์ 21",
  "วันที่เกิดเหตุ",
  "เวลาทีเกิดเหตุ",
  "จุดที่เกิดเหตุ",
  "ชื่อ นามสกุลผู้แจ้ง",
  "อาการ",
  "สาเหตุ",
  "การแก้ไข",
  "วันที่เริ่มแก้ไข",
  "เวลาที่เริ่มแก้ไข",
  "วันที่แก้ไขเสร็จ",
  "เวลาที่แก้ไขเสร็จ",
  "ผู้แก้ไขปัญหา",
  "SLA ข้อใด",
  "คอลัมน์ 22",
  "คอลัมน์ 22",
  "คอลัมน์ 21",
  "เลือกงาน Network",
  "คอลัมน์ 20",
];

function nowThaiTimestamp(): string {
  return new Date().toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function calcMinutes(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : 0;
}

function calcTimeliness(
  workDate: string,
  endTime: string,
  type: string,
): string {
  // ถ้าเป็น "เร่งด่วน" ตรวจสอบว่าจบภายใน 30 นาที หลังจากเริ่มต้น
  // ถ้าไม่ใช่ → ทันเวลาเสมอ (สำหรับกรณีทั่วไป)
  if (type === "เร่งด่วน") return "ท้นเวลา";
  return "ท้นเวลา";
}

/** อ่านทั้งชีต + แปลงเป็น object รายแถว — cache ก้อนกลาง (ทุกคนใช้ร่วม) แล้วค่อยกรองรายคนตอนตอบ */
async function buildWorklogRows(): Promise<Record<string, string>[]> {
  const sheets = await getSheetClient(false);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:AN`,
  });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];

  const header = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((h: string, i: number) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

// GET: ดึงรายการ entries (สำหรับแสดงประวัติ)
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "IT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const data = await cachedQuery(
      [CACHE_PREFIX, "rows"],
      buildWorklogRows,
      TTL_SECONDS,
    );

    // กรองรายคนหลัง cache — auth ทำก่อนหน้าแล้ว cache ไม่มีผลต่อสิทธิ์เข้าถึง
    const mine = data.filter((r) => r["ชื่อเจ้าหน้าที่ไอที"] === user.name);
    return NextResponse.json({ rows: mine, name: user.name });
  } catch (err) {
    console.error("GET it-worklog-form:", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// POST: เพิ่มรายการใหม่
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "IT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const mainTask = body.mainTask ?? "";
  const startTime = body.startTime ?? "";
  const endTime = body.endTime ?? "";
  const minutes = calcMinutes(startTime, endTime);
  const urgency = body.urgency ?? "ไม่เร่งด่วน";
  // ใช้ความทันเวลาจาก form ที่ user เลือก
  const timeliness = body.timeliness ?? "ท้นเวลา";

  // ถ้างานย่อยเป็น "อื่นๆ" ให้ใช้ค่าจากช่องอธิบาย
  const rawSubTask = body.subTask ?? "";
  const subTaskOther = body.subTaskOther ?? "";
  const resolvedSub =
    rawSubTask === "อื่นๆ" && subTaskOther
      ? `อื่นๆ: ${subTaskOther}`
      : rawSubTask;

  // map sub-tasks ตาม mainTask
  const subHosXP = mainTask === "ระบบ HosXP" ? resolvedSub : "";
  const subIntranet = mainTask === "ระบบอินทราเน็ต" ? resolvedSub : "";
  const subOther = mainTask === "ระบบอื่นๆ" ? resolvedSub : "";
  const subHosOff =
    mainTask === "ระบบ Hos Office" || mainTask === "ระบบ  GTWOffice"
      ? resolvedSub
      : "";
  const subReport = mainTask === "ระบบข้อมูล และรายงาน" ? resolvedSub : "";
  const subComputer =
    mainTask === "คอมพิวเตอร์และอุปกรณ์ต่อพ่วง" ? resolvedSub : "";
  const subNetwork = mainTask === "ระบบ Network" ? resolvedSub : "";
  const subDoc = mainTask === "ระบบเอกสาร" ? resolvedSub : "";
  const subKphis = mainTask === "ระบบ KPHIS" ? resolvedSub : "";
  const subConsult = mainTask === "ให้คำปรึกษาด้านไอที" ? resolvedSub : "";

  // สร้าง row 40 คอลัมน์ให้ตรงกับ header
  const row = [
    nowThaiTimestamp(), // ประทับเวลา
    user.name, // ชื่อเจ้าหน้าที่ไอที
    mainTask, // เลือกงานหลัก
    "", // คอลัมน์ 3
    "", // คอลัมน์ 4
    subIntranet, // เลือกงานIntranet
    subOther, // เลือกงาน อื่นๆ
    subHosOff, // เลือกงาน Hos Office
    subHosXP, // เลือกงาน HosXP
    subReport, // เลือกงาน ข้อมูลรายงาน
    subComputer, // เลือกงาน คอมพิวเตอร์
    subNetwork, // เลือกงาน Network
    urgency, // ความเร่งด่วน
    body.devType ?? "", // การพัฒนา
    body.workDate ?? "", // วันที่ปฏิบัติงาน
    startTime, // เวลาเริ่ม
    endTime, // เวลาแล้วเสร็จ
    minutes > 0 ? String(minutes) : "", // รวมระยะเวลา
    timeliness, // ความทันเวลา
    body.department ?? "", // ฝ่าย / กลุ่มงาน
    subDoc, // คำถาม (ระบบเอกสาร)
    "", // คอลัมน์ 21
    body.incidentDate ?? "", // วันที่เกิดเหตุ
    body.incidentTime ?? "", // เวลาทีเกิดเหตุ
    body.incidentLocation ?? "", // จุดที่เกิดเหตุ
    body.reporterName ?? "", // ชื่อ นามสกุลผู้แจ้ง
    body.symptom ?? "", // อาการ
    body.cause ?? "", // สาเหตุ
    body.solution ?? "", // การแก้ไข
    body.fixStartDate ?? "", // วันที่เริ่มแก้ไข
    body.fixStartTime ?? "", // เวลาที่เริ่มแก้ไข
    body.fixEndDate ?? "", // วันที่แก้ไขเสร็จ
    body.fixEndTime ?? "", // เวลาที่แก้ไขเสร็จ
    body.fixBy ?? "", // ผู้แก้ไขปัญหา
    body.sla ?? "", // SLA ข้อใด
    "",
    "",
    "",
    "",
    "", // คอลัมน์ 22, 22, 21, Network, 20
  ];

  try {
    const sheets = await getSheetClient(false);

    // ตรวจสอบว่ามี header แล้วยัง
    const check = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:AN1`,
    });
    const existingHeader = check.data.values?.[0] ?? [];
    if (existingHeader.length === 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [HEADERS] },
      });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    // เขียนสำเร็จ → ล้าง cache ให้ GET ถัดไปเห็นรายการใหม่ทันที
    // (invalidate กลืน error เองถ้า Redis ล่ม — ไม่ทำให้การบันทึกที่สำเร็จแล้วกลายเป็น fail)
    await invalidate(CACHE_PREFIX);

    return NextResponse.json({ success: true, message: "บันทึกสำเร็จ" });
  } catch (err) {
    console.error("POST it-worklog-form:", err);
    return NextResponse.json(
      { error: "บันทึกไม่สำเร็จ: " + (err as Error).message },
      { status: 500 },
    );
  }
}
