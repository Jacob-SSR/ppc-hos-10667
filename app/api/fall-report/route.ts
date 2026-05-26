import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    const [rows] = await db.query(
      `
      SELECT
        v.vn,
        v.hn,
        v.cid,
        v.vstdate                                        AS "วันที่รับบริการ",
        CONCAT(p.pname, p.fname, ' ', p.lname)          AS "ชื่อ-นามสกุล",
        v.age_y                                          AS "อายุ",
        IF(p.sex = '1', 'ชาย', 'หญิง')                 AS "เพศ",
        o.icd10                                          AS "รหัส ICD10",
        i.name                                           AS "การวินิจฉัย",
        oo.name                                          AS "สถานะผู้ป่วย",
        p.addrpart                                       AS "บ้านเลขที่",
        p.moopart                                        AS "หมู่",
        t.full_name                                      AS "ตำบล"
      FROM ovstdiag o
      LEFT JOIN vn_stat v    ON v.vn = o.vn
      LEFT JOIN ovst ov      ON ov.vn = v.vn
      LEFT JOIN ovstost oo   ON ov.ovstost = oo.ovstost
      LEFT JOIN patient p    ON p.hn = v.hn
      LEFT JOIN thaiaddress t
        ON t.chwpart = p.chwpart
       AND t.amppart = p.amppart
       AND t.tmbpart = p.tmbpart
      LEFT JOIN icd101 i     ON i.code = o.icd10
      WHERE o.icd10 BETWEEN 'W00' AND 'W09'
        AND o.vstdate BETWEEN ? AND ?
      ORDER BY o.vstdate DESC, v.hn
      `,
      [start, end],
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("FallReport API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
