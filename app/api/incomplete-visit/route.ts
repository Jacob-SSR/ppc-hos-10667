import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

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
    const [rows] = await db.query<IncompleteVisitRow[]>(
      `
      SELECT
        k.department,
        v.income,
        CONCAT(p.pname, p.fname, ' ', p.lname) AS pt_name,
        od.diag_text,
        ov.vsttime,
        oo.cc,
        v.hn,
        v.vn,
        v.pdx,
        v.vstdate,
        o.icd10,
        o.doctor,
        d.name
      FROM vn_stat v
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

    return NextResponse.json(rows);
  } catch (error) {
    console.error("IncompleteVisit API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}