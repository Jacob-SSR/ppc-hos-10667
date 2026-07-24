// app/api/medical-coding/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cachedQuery } from "@/lib/cache";

// cache 5 นาที — รายงาน Medical Coding (งานประกัน) ดึงผู้ป่วยในตามช่วงวันที่จำหน่าย
// (hard TTL ใน lib/cache.ts = ttl * 4 → stale แจกต่อได้ ~20 นาทีถ้า DB มีปัญหา)
const TTL_SECONDS = 300;

async function buildMedicalCodingReport(start: string, end: string) {
  const [rows] = await db.query(
    `
    SELECT
      ii.hn                                        AS "HN",
      ii.an                                        AS "AN",
      ii.regdate                                   AS "วันที่รับไว้",
      aa.admdate                                   AS "วันที่ Admit",
      ii.dchdate                                   AS "วันที่จำหน่าย",
      ii.dchtype                                   AS "ประเภทการจำหน่าย",
      d.name                                       AS "ชื่อประเภทการจำหน่าย",
      GROUP_CONCAT(DISTINCT i.icd9cm)              AS "ICD9CM",
      ii.adjrw                                     AS "AdjRW"
    FROM ipt ii
    LEFT OUTER JOIN opitemrece o    ON o.an = ii.an
    LEFT OUTER JOIN an_stat aa      ON aa.an = ii.an
    LEFT OUTER JOIN ipt_oper_code i ON i.icode = o.icode
    LEFT OUTER JOIN dchtype d       ON d.dchtype = ii.dchtype
    WHERE ii.dchdate BETWEEN ? AND ?
    GROUP BY ii.an
    ORDER BY ii.dchdate DESC, ii.an
    `,
    [start, end],
  );
  return rows;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "Missing start or end parameter" },
        { status: 400 },
      );
    }

    const rows = await cachedQuery(
      ["medical-coding", start, end],
      () => buildMedicalCodingReport(start, end),
      TTL_SECONDS,
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("MedicalCoding API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
