// app/api/patient-no-person/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cachedQuery } from "@/lib/cache";

// cache สั้น 2 นาที — worklist ตามลงทะเบียน person ผู้ใช้แก้ใน HosXP แล้วรีเฟรชเช็ค
// TTL ยาวไปจะเห็นรายชื่อที่ลงทะเบียนแล้วค้างอยู่ (hard TTL = ttl * 4 → stale ~8 นาที)
const TTL_SECONDS = 120;

async function buildPatientNoPerson(start: string, end: string) {
  const [rows] = await db.query(
    `
    SELECT DISTINCT
      v.vstdate                                     AS "วันที่รับบริการ",      
      p1.hn                                         AS "HN",
      p1.cid                                        AS "CID (ผู้ป่วย)",
      CONCAT(p1.pname, p1.fname, ' ', p1.lname)    AS "ชื่อ-นามสกุล",
      p1.birthday                                   AS "วันเกิด",
      p1.firstday                                   AS "วันที่มาครั้งแรก",
      p1.bloodgrp                                   AS "กรุ๊ปเลือด",
      e.name                                        AS "การศึกษา",
      m.name                                        AS "สถานภาพสมรส",
      p1.addrpart                                   AS "บ้านเลขที่",
      p1.moopart                                    AS "หมู่",
      t.full_name                                   AS "ที่อยู่",
      p1.hometel                                    AS "เบอร์โทรศัพท์"

    FROM patient p1
    LEFT JOIN person p2       ON p1.cid = p2.cid
    LEFT JOIN vn_stat v       ON p1.hn  = v.hn
    LEFT JOIN education e     ON e.education   = p1.educate
    LEFT JOIN marrystatus m   ON m.code        = p1.marrystatus
    LEFT JOIN thaiaddress t   ON p1.chwpart = t.chwpart
                              AND p1.amppart = t.amppart
                              AND p1.tmbpart = t.tmbpart
    WHERE p2.cid IS NULL
      AND v.vstdate BETWEEN ? AND ?
      AND p1.chwpart = '31'
      AND p1.amppart = '15'
      AND p1.tmbpart = '04'
    GROUP BY p1.hn
    ORDER BY v.vstdate DESC
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
      ["patient-no-person", start, end],
      () => buildPatientNoPerson(start, end),
      TTL_SECONDS,
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("PatientNoPerson API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
