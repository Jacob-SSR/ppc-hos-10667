// app/api/high-risk-procedures/route.ts
// รายงานจำนวนหัตถการเสี่ยงสูง
// รับ ?start=YYYY-MM-DD&end=YYYY-MM-DD (default = ปีงบประมาณปัจจุบัน 1 ต.ค.–30 ก.ย.)
// เพิ่ม &debug=1 เพื่อดู sample row สำหรับตรวจสอบ mapping
import { NextResponse } from "next/server";
import { getHighRiskProcedures } from "@/lib/highRiskProcedures.service";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

const ER_OPER_CODES = "12,13,14,15,22,125,134";
const ICD9_MATCH = (col: string) =>
  `REPLACE(${col},'.','') IN ('9604','3404','3491','5491','0331','331')`;

const OPD_DOC_WHERE = `( dop.er_oper_code IN (${ER_OPER_CODES}) OR ${ICD9_MATCH("dop.icd9")} )`;

/** วินิจฉัยว่าหัตถการอยู่ตารางไหน + ช่วงวันที่จริง + จำนวนหลัง join/กรองวัน */
async function runDiagnostics(start: string, end: string) {
  const out: Record<string, unknown> = { requestedRange: { start, end } };
  const probe = async (label: string, sql: string, params: unknown[] = []) => {
    try {
      const [rows] = await db.query<RowDataPacket[]>(sql, params);
      out[label] = rows;
    } catch (e) {
      out[label] = { error: (e as Error).message };
    }
  };

  // 1) นับดิบต่อรหัส (ไม่กรองวัน ไม่ join) — ยืนยันว่ามีข้อมูล
  await probe(
    "raw_doctor_operation_by_icd9",
    `SELECT REPLACE(icd9,'.','') code, COUNT(*) n FROM doctor_operation WHERE ${ICD9_MATCH("icd9")} GROUP BY code`,
  );
  await probe(
    "raw_doctor_operation_by_er_oper_code",
    `SELECT er_oper_code, COUNT(*) n FROM doctor_operation WHERE er_oper_code IN (${ER_OPER_CODES}) GROUP BY er_oper_code`,
  );
  await probe(
    "raw_er_regist_oper_by_er_oper_code",
    `SELECT er_oper_code, COUNT(*) n FROM er_regist_oper WHERE er_oper_code IN (${ER_OPER_CODES}) GROUP BY er_oper_code`,
  );
  await probe(
    "raw_iptoprt_by_icd9",
    `SELECT REPLACE(icd9,'.','') code, COUNT(*) n FROM iptoprt WHERE ${ICD9_MATCH("icd9")} GROUP BY code`,
  );

  // 2) ช่วงวันที่จริงของข้อมูล (หลัง join วันที่ที่ใช้แสดงผล) — บอกว่าควรเลือกช่วงไหน
  await probe(
    "datespan_opd_doctor_operation",
    `SELECT MIN(o.vstdate) min_date, MAX(o.vstdate) max_date, COUNT(*) n
     FROM doctor_operation dop JOIN ovst o ON o.vn = dop.vn WHERE ${OPD_DOC_WHERE}`,
  );
  await probe(
    "datespan_er_regist_oper",
    `SELECT MIN(o.vstdate) min_date, MAX(o.vstdate) max_date, COUNT(*) n
     FROM er_regist_oper ero JOIN ovst o ON o.vn = ero.vn WHERE ero.er_oper_code IN (${ER_OPER_CODES})`,
  );
  await probe(
    "datespan_iptoprt",
    `SELECT MIN(ipt.dchdate) min_date, MAX(ipt.dchdate) max_date, COUNT(*) n
     FROM iptoprt io JOIN ipt ON ipt.an = io.an WHERE ${ICD9_MATCH("io.icd9")}`,
  );

  // 3) จำนวนหลัง join เต็มรูปแบบ + กรองช่วงวันที่ที่ร้องขอ — เลียนแบบ query จริง
  await probe(
    "inrange_opd_doctor_operation",
    `SELECT COUNT(*) n FROM doctor_operation dop
       JOIN ovst o ON o.vn = dop.vn JOIN patient pt ON pt.hn = o.hn
     WHERE ${OPD_DOC_WHERE} AND o.vstdate BETWEEN ? AND ?`,
    [start, end],
  );
  await probe(
    "inrange_er_regist_oper",
    `SELECT COUNT(*) n FROM er_regist_oper ero
       JOIN ovst o ON o.vn = ero.vn JOIN patient pt ON pt.hn = o.hn
     WHERE ero.er_oper_code IN (${ER_OPER_CODES}) AND o.vstdate BETWEEN ? AND ?`,
    [start, end],
  );
  await probe(
    "inrange_iptoprt",
    `SELECT COUNT(*) n FROM iptoprt io
       JOIN ipt ON ipt.an = io.an JOIN patient pt ON pt.hn = ipt.hn
     WHERE ${ICD9_MATCH("io.icd9")} AND ipt.dchdate BETWEEN ? AND ?`,
    [start, end],
  );

  return out;
}

/** ปีงบประมาณปัจจุบัน (1 ต.ค. – 30 ก.ย.) ใน timezone Asia/Bangkok */
function defaultFiscalRange(): { start: string; end: string } {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11 ; ต.ค. = 9
  const fyStartYear = m >= 9 ? y : y - 1;
  return { start: `${fyStartYear}-10-01`, end: `${fyStartYear + 1}-09-30` };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const def = defaultFiscalRange();
    const start = searchParams.get("start") || def.start;
    const end = searchParams.get("end") || def.end;
    const debug = searchParams.get("debug") === "1";
    const diag = searchParams.get("diag") === "1";

    // โหมดวินิจฉัย: ดูว่ารหัส 5 ตัวอยู่ตารางไหน/รูปแบบอะไร (ทั้งฐานข้อมูล ไม่ติดช่วงวัน)
    if (diag) {
      return NextResponse.json({
        diagnostics: await runDiagnostics(start, end),
      });
    }

    const data = await getHighRiskProcedures(start, end);

    if (debug) {
      return NextResponse.json({
        start,
        end,
        opdCount: data.opd.length,
        ipdCount: data.ipd.length,
        opdSample: data.opd.slice(0, 5),
        ipdSample: data.ipd.slice(0, 5),
        summary: data.summary,
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("HighRiskProcedures API error:", error);
    return NextResponse.json(
      {
        error:
          "ดึงข้อมูลหัตถการเสี่ยงสูงไม่สำเร็จ: " + (error as Error).message,
      },
      { status: 500 },
    );
  }
}
