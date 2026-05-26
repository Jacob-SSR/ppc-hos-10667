// app/api/stm-dashboard/route.ts
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StmRow {
  rep: string;
  seq: number;
  tranId: string;
  hn: string;
  an: string;
  pid: string;
  ชื่อสกุล: string;
  วันเข้ารักษา: string;
  วันจำหน่าย: string;
  maininscl: string;
  projcode: string;
  เรียกเก็บ: number;
  พึงรับ: number;   // col V (OP)
  hc: number;       // col Y
  hcDrug: number;   // col Z
  ae: number;       // col AA
  aeDrug: number;   // col AB
  inst: number;     // col AC
  dmisCalc: number; // col AD
  dmisReal: number; // col AE
  dmisDrug: number; // col AF
  palliative: number; // col AG
  dmishd: number;   // col AH
  pp: number;       // col AI
  fs: number;       // col AJ
  opbkk: number;    // col AK
  ยอดชดเชย: number; // col AL
  แหล่งข้อมูล: string; // col AO
  seqNo: string;    // col AP
}

export interface StmSubFundSummary {
  กองทุน: string;
  label: string;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
}

export interface StmRepSummary {
  rep: string;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
}

export interface StmDashboardData {
  updatedAt: string;
  totalRows: number;
  totalClaim: number;
  totalComp: number;
  totalNoComp: number;
  rows: StmRow[];
  byRep: StmRepSummary[];
  bySubFund: StmSubFundSummary[];
  bySource: Record<string, number>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const y = v.getFullYear() > 2400 ? v.getFullYear() - 543 : v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).trim();
}

// ─── Sub-fund labels ────────────────────────────────────────────────────────────
// คอลัมน์ที่แสดง (ไม่รวม M-X = index 12-23 และ AM,AN = index 38-39)
const SUB_FUNDS: { key: keyof StmRow; label: string }[] = [
  { key: "พึงรับ",     label: "OP พึงรับ" },
  { key: "hc",        label: "HC" },
  { key: "hcDrug",    label: "HC Drug" },
  { key: "ae",        label: "AE" },
  { key: "aeDrug",    label: "AE Drug" },
  { key: "inst",      label: "INST" },
  { key: "dmisCalc",  label: "DMIS (คำนวณ)" },
  { key: "dmisReal",  label: "DMIS (จ่ายจริง)" },
  { key: "dmisDrug",  label: "DMIS Drug" },
  { key: "palliative",label: "Palliative Care" },
  { key: "dmishd",    label: "DMISHD" },
  { key: "pp",        label: "PP" },
  { key: "fs",        label: "FS" },
  { key: "opbkk",    label: "OPBKK" },
];

// ─── Parse XLSX ────────────────────────────────────────────────────────────────

function parseXlsx(filePath: string): StmRow[] {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
  }) as unknown[][];

  // header อยู่แถว 0-2, data เริ่มแถว 3
  const rows: StmRow[] = [];
  for (let i = 3; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    // skip แถวว่าง
    if (!r[0] && !r[1] && !r[3]) continue;

    rows.push({
      rep:           toStr(r[0]),
      seq:           toNum(r[1]),
      tranId:        toStr(r[2]),
      hn:            toStr(r[3]),
      an:            toStr(r[4]),
      pid:           toStr(r[5]),
      ชื่อสกุล:     toStr(r[6]),
      วันเข้ารักษา: toStr(r[7]),
      วันจำหน่าย:   toStr(r[8]),
      maininscl:     toStr(r[9]),
      projcode:      toStr(r[10]),
      เรียกเก็บ:    toNum(r[11]),
      // skip col 12-23 (M-X กองทุน IP, AdjRW, ล่าช้า, CCUF, AdjRW2, อัตราจ่าย, เงินเดือน, หลังหัก, W, X)
      พึงรับ:       toNum(r[21]), // V = OP พึงรับ
      hc:            toNum(r[24]), // Y
      hcDrug:        toNum(r[25]), // Z
      ae:            toNum(r[26]), // AA
      aeDrug:        toNum(r[27]), // AB
      inst:          toNum(r[28]), // AC
      dmisCalc:      toNum(r[29]), // AD
      dmisReal:      toNum(r[30]), // AE
      dmisDrug:      toNum(r[31]), // AF
      palliative:    toNum(r[32]), // AG
      dmishd:        toNum(r[33]), // AH
      pp:            toNum(r[34]), // AI
      fs:            toNum(r[35]), // AJ
      opbkk:         toNum(r[36]), // AK
      ยอดชดเชย:     toNum(r[37]), // AL
      // skip col 38-39 (AM,AN = VA, COVID)
      แหล่งข้อมูล: toStr(r[40]), // AO
      seqNo:         toStr(r[41]), // AP
    });
  }
  return rows;
}

// ─── Build dashboard ────────────────────────────────────────────────────────────

function buildDashboard(rows: StmRow[]): StmDashboardData {
  const totalClaim  = rows.reduce((s, r) => s + r.เรียกเก็บ, 0);
  const totalComp   = rows.reduce((s, r) => s + r.ยอดชดเชย, 0);
  const totalNoComp = Math.max(0, totalClaim - totalComp);

  // แยกตาม REP
  const repMap = new Map<string, StmRow[]>();
  for (const r of rows) {
    if (!repMap.has(r.rep)) repMap.set(r.rep, []);
    repMap.get(r.rep)!.push(r);
  }
  const byRep: StmRepSummary[] = Array.from(repMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rep, rr]) => ({
      rep,
      จำนวน:     rr.length,
      เรียกเก็บ: rr.reduce((s, r) => s + r.เรียกเก็บ, 0),
      ชดเชย:    rr.reduce((s, r) => s + r.ยอดชดเชย, 0),
      ไม่ชดเชย: Math.max(0, rr.reduce((s, r) => s + r.เรียกเก็บ, 0) - rr.reduce((s, r) => s + r.ยอดชดเชย, 0)),
    }));

  // แยกตามกองทุนย่อย
  const bySubFund: StmSubFundSummary[] = SUB_FUNDS.map(({ key, label }) => {
    const total = rows.reduce((s, r) => s + toNum(r[key as keyof StmRow]), 0);
    return {
      กองทุน:   key as string,
      label,
      จำนวน:    rows.filter(r => toNum(r[key as keyof StmRow]) > 0).length,
      เรียกเก็บ: rows.reduce((s, r) => s + r.เรียกเก็บ, 0),
      ชดเชย:   total,
      ไม่ชดเชย: 0,
    };
  }).filter(s => s.ชดเชย > 0);

  // แหล่งข้อมูล
  const bySource: Record<string, number> = {};
  for (const r of rows) {
    const src = r.แหล่งข้อมูล || "ไม่ระบุ";
    bySource[src] = (bySource[src] || 0) + 1;
  }

  return {
    updatedAt: new Date().toISOString(),
    totalRows: rows.length,
    totalClaim,
    totalComp,
    totalNoComp,
    rows,
    byRep,
    bySubFund,
    bySource,
  };
}

// ─── GET handler ────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "stm.xlsx");
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "ไม่พบไฟล์ data/stm.xlsx — กรุณาอัปโหลดข้อมูลก่อน" },
        { status: 404 }
      );
    }
    const rows = parseXlsx(filePath);
    const data = buildDashboard(rows);
    return NextResponse.json(data);
  } catch (err) {
    console.error("StmDashboard error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}