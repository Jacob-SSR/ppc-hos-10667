import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

export interface WorkRow {
  date: string;
  staff: string;
  mainTask: string;
  subTask: string; // ← NEW: หมวดย่อยที่ตรงกับ mainTask
  subHosXP: string;
  subIntranet: string;
  subComputer: string;
  subNetwork: string;
  subReport: string;
  subOther: string;
  subDoc: string; // ← NEW: ระบบเอกสาร (คำถาม column)
  urgency: string;
  devType: string;
  duration: number;
  department: string;
  timeliness: string;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (const c of line) {
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      result.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  result.push(cur);
  return result;
}

function normalizeDate(raw: string): string {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const y = parseInt(m[1]);
  const ce = y > 2400 ? y - 543 : y;
  return `${ce}-${m[2]}-${m[3]}`;
}

/** เลือก sub-task ที่ตรงกับ mainTask */
function resolveSubTask(
  mainTask: string,
  subHosXP: string,
  subIntranet: string,
  subComputer: string,
  subNetwork: string,
  subReport: string,
  subOther: string,
  subDoc: string,
): string {
  const t = mainTask.trim();
  if (t === "ระบบ HosXP") return subHosXP;
  if (t === "ระบบอินทราเน็ต") return subIntranet;
  if (t === "คอมพิวเตอร์และอุปกรณ์ต่อพ่วง") return subComputer;
  if (t === "ระบบ Network") return subNetwork;
  if (t === "ระบบข้อมูล และรายงาน") return subReport;
  if (t === "ระบบอื่นๆ") return subOther;
  if (t === "ระบบเอกสาร") return subDoc;
  // HosOffice, GTWOffice, KPHIS, ให้คำปรึกษา, ความเสี่ยง ไม่มี sub-column
  return "";
}

function parseCSV(text: string): WorkRow[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const raw = lines[0].replace(/^\uFEFF/, ""); // strip BOM
  const headers = raw.split(",").map((h) => h.replace(/^"|"$/g, "").trim());

  const idx = (name: string) => headers.findIndex((h) => h.includes(name));
  const iDate = idx("วันที่ปฏิบัติงาน");
  const iStaff = idx("ชื่อเจ้าหน้าที่ไอที");
  const iMain = idx("เลือกงานหลัก");
  const iHosXP = idx("เลือกงาน HosXP");
  const iIntranet = idx("เลือกงานIntranet");
  const iComputer = idx("เลือกงาน คอมพิวเตอร์");
  const iNetwork = idx("เลือกงาน Network");
  const iReport = idx("เลือกงาน ข้อมูลรายงาน");
  const iOther = idx("เลือกงาน อื่นๆ");
  // "คำถาม" = sub-column ของ ระบบเอกสาร
  const iDoc = headers.findIndex((h) => h === "คำถาม");
  const iUrgency = idx("ความเร่งด่วน");
  const iDev = idx("การพัฒนา");
  const iDuration = idx("รวมระยะเวลา");
  const iDept = idx("ฝ่าย");
  const iTimely = idx("ความทันเวลา");

  const get = (row: string[], i: number) =>
    i >= 0 ? (row[i] ?? "").replace(/^"|"$/g, "").trim() : "";

  const rows: WorkRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const date = normalizeDate(get(cols, iDate));
    if (!date) continue;

    const subHosXP = get(cols, iHosXP);
    const subIntranet = get(cols, iIntranet);
    const subComputer = get(cols, iComputer);
    const subNetwork = get(cols, iNetwork);
    const subReport = get(cols, iReport);
    const subOther = get(cols, iOther);
    const subDoc = get(cols, iDoc);
    const mainTask = get(cols, iMain);

    rows.push({
      date,
      staff: get(cols, iStaff),
      mainTask,
      subTask: resolveSubTask(
        mainTask,
        subHosXP,
        subIntranet,
        subComputer,
        subNetwork,
        subReport,
        subOther,
        subDoc,
      ),
      subHosXP,
      subIntranet,
      subComputer,
      subNetwork,
      subReport,
      subOther,
      subDoc,
      urgency: get(cols, iUrgency),
      devType: get(cols, iDev),
      duration: Number(get(cols, iDuration)) || 0,
      department: get(cols, iDept),
      timeliness: get(cols, iTimely),
    });
  }
  return rows;
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "it-worklog.csv");
    const text = readFileSync(filePath, "utf-8");
    const rows = parseCSV(text);
    return NextResponse.json(rows);
  } catch (err: unknown) {
    console.error("it-worklog-csv:", (err as Error).message);
    return NextResponse.json(
      { error: "ไม่พบไฟล์ data/it-worklog.csv" },
      { status: 404 },
    );
  }
}
