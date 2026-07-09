// app/api/ipd/ward-census/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cachedQuery } from "@/lib/cache";
import { RowDataPacket } from "mysql2";

interface CensusRow extends RowDataPacket {
  ward_code: string;
  pttype_name: string;
  regdate: string;
  total: number;
}

// census เป็นข้อมูล real-time (ผู้ป่วยกำลัง admit) → cache สั้น
const TTL_SECONDS = 180;

async function queryWardCensus(wardCode: string | null) {
  // Home Ward รวมหลาย ward
  const homeWards = ["14", "15", "16"];
  const isHome = wardCode === "__home__";

  let whereWardClause = "";
  if (isHome) {
    whereWardClause = `AND ip.ward IN (${homeWards.map((w) => db.escape(w)).join(",")})`;
  } else if (wardCode) {
    whereWardClause = `AND ip.ward = ${db.escape(wardCode)}`;
  }

  // ── summary: แยกตามสิทธิ์ (ใช้ ipt JOIN an_stat เหมือน bed-occupancy) ──
  const [summary] = await db.query<RowDataPacket[]>(
    `
    SELECT
      ip.ward                          AS ward_code,
      COALESCE(pt.name, 'ไม่ระบุ')   AS pttype_name,
      COUNT(DISTINCT ip.an)            AS total
    FROM ipt ip
    INNER JOIN an_stat a  ON a.an  = ip.an
    LEFT  JOIN pttype  pt ON pt.pttype = a.pttype
    WHERE (ip.dchdate IS NULL OR ip.dchdate = '0000-00-00' OR ip.dchdate = '')
      AND (a.dchdate  IS NULL OR a.dchdate  = '0000-00-00' OR a.dchdate  = '')
      ${whereWardClause}
    GROUP BY ip.ward, pt.name
    ORDER BY total DESC
    `,
  );

  // ── rows: แยกตามสิทธิ์ + วันรับ (สำหรับ timeline ถ้าต้องการ) ──
  const [rows] = await db.query<CensusRow[]>(
    `
    SELECT
      ip.ward                          AS ward_code,
      COALESCE(pt.name, 'ไม่ระบุ')   AS pttype_name,
      a.regdate,
      COUNT(DISTINCT ip.an)            AS total
    FROM ipt ip
    INNER JOIN an_stat a  ON a.an  = ip.an
    LEFT  JOIN pttype  pt ON pt.pttype = a.pttype
    WHERE (ip.dchdate IS NULL OR ip.dchdate = '0000-00-00' OR ip.dchdate = '')
      AND (a.dchdate  IS NULL OR a.dchdate  = '0000-00-00' OR a.dchdate  = '')
      ${whereWardClause}
    GROUP BY ip.ward, pt.name, a.regdate
    ORDER BY a.regdate DESC
    `,
  );

  return { rows, summary };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wardCode = searchParams.get("ward");

    const data = await cachedQuery(
      ["ipd-ward-census", wardCode ?? "all"],
      () => queryWardCensus(wardCode),
      TTL_SECONDS,
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("Ward census error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
