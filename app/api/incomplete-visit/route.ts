// app/api/incomplete-visit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cachedQuery } from "@/lib/cache";
import { RowDataPacket } from "mysql2";

// cache สั้น 2 นาที — รายงานนี้เป็น worklist ตามแก้ข้อมูล ผู้ใช้แก้ใน HosXP แล้วรีเฟรชเช็ค
// TTL ยาวไปจะเห็นรายการที่แก้แล้วค้างอยู่ (hard TTL = ttl * 4 → stale ~8 นาทีถ้า DB มีปัญหา)
const TTL_SECONDS = 120;

interface IncompleteVisitRow extends RowDataPacket {
  department: string | null;
  income: number;
  pt_name: string;
  diag_text: string | null;
  vsttime: string | null;
  cc: string | null;
  hn: string;
  vn: string;
  pdx: string | null;
  vstdate: string;
  icd10: string | null;
  doctor: string | null;
  name: string | null;
}

async function buildIncompleteVisits(start: string, end: string) {
  const [rows] = await db.query<IncompleteVisitRow[]>(
    `
    select k.department, v.income, concat(p.pname,p.fname,"",p.lname)as pt_name, v.hn, v.vn, v.vstdate, ov.vsttime, oo.cc, od.diag_text,
    v.pdx,o.icd10,o.doctor,d.name  from vn_stat v
    LEFT OUTER JOIN ovstdiag o          ON v.vn = o.vn AND o.diagtype = '1'
    LEFT OUTER JOIN doctor d            ON d.code = o.doctor
    LEFT OUTER JOIN patient p           ON p.hn = v.hn
    LEFT OUTER JOIN ovst ov             ON ov.vn = v.vn
    LEFT OUTER JOIN opdscreen oo        ON oo.vn = v.vn
    LEFT OUTER JOIN kskdepartment k     ON k.depcode = ov.cur_dep
    LEFT OUTER JOIN ovst_doctor_diag od ON od.vn = v.vn
    WHERE (ov.main_dep <> '' OR ov.main_dep IS NULL)
      AND (
        od.diag_text IS NULL
        OR v.pdx = '' OR v.pdx IS NULL
        OR oo.cc IS NULL
      )
      AND v.vstdate BETWEEN ? AND ?
    ORDER BY v.vstdate DESC, ov.vsttime DESC
    `,
    [start, end],
  );
  return rows;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "Missing start or end parameter" },
      { status: 400 },
    );
  }

  try {
    const rows = await cachedQuery(
      ["incomplete-visit", start, end],
      () => buildIncompleteVisits(start, end),
      TTL_SECONDS,
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("IncompleteVisit API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
