// app/api/ipd/ward-census/route.ts
// ดึงผู้ป่วยที่ยัง admit อยู่ใน ward (dchdate IS NULL) สำหรับ WardDetailModal
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

interface CensusRow extends RowDataPacket {
  ward_code: string;
  pttype_name: string;
  regdate: string;
  total: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wardCode = searchParams.get("ward");

    // ถ้าส่ง ward มา กรองเฉพาะ ward นั้น
    const whereWard = wardCode ? `AND a.ward = ${db.escape(wardCode)}` : "";

    // กรณี Home Ward (__home__) รวมหลาย ward
    const homeWards = ["14", "15", "16"];
    const isHome = wardCode === "__home__";
    const whereWardClause = isHome
      ? `AND a.ward IN (${homeWards.map((w) => db.escape(w)).join(",")})`
      : wardCode
        ? `AND a.ward = ${db.escape(wardCode)}`
        : "";

    // สรุปตามสิทธิ์ + วันรับ
    const [rows] = await db.query<CensusRow[]>(
      `
      SELECT
        a.ward                          AS ward_code,
        COALESCE(pt.name, 'ไม่ระบุ')   AS pttype_name,
        a.regdate,
        COUNT(*)                        AS total
      FROM an_stat a
      LEFT JOIN pttype pt ON pt.pttype = a.pttype
      WHERE a.dchdate IS NULL
        ${whereWardClause}
      GROUP BY a.ward, pt.name, a.regdate
      ORDER BY a.regdate DESC
      `,
    );

    // สรุปรวม admit ปัจจุบัน (ไม่ group by วัน)
    const [summary] = await db.query<RowDataPacket[]>(
      `
      SELECT
        a.ward                          AS ward_code,
        COALESCE(pt.name, 'ไม่ระบุ')   AS pttype_name,
        COUNT(*)                        AS total
      FROM an_stat a
      LEFT JOIN pttype pt ON pt.pttype = a.pttype
      WHERE a.dchdate IS NULL
        ${whereWardClause}
      GROUP BY a.ward, pt.name
      ORDER BY total DESC
      `,
    );

    return NextResponse.json({ rows, summary });
  } catch (error) {
    console.error("Ward census error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
