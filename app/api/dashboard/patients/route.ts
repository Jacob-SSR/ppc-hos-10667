import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

interface PatientRow extends RowDataPacket {
  vn: string;
  hn: string;
  cid: string;
  pname: string;
  fname: string;
  lname: string;
  age_y: number;
  sex: string;
  vstdate: string;
  vsttime: string;
  pdx: string;
  dx_name: string;
  department: string;
  pttype: string;
  pttype_name: string;
  doctor_name: string;
  income: number;
}

interface HistoryRow extends RowDataPacket {
  vn: string;
  vstdate: string;
  vsttime: string;
  pdx: string;
  dx_name: string;
  department: string;
  pttype_name: string;
  doctor_name: string;
}

// Filter map: card type → SQL WHERE condition addition
function buildFilter(
  cardType: string,
  start: string,
  end: string,
): { where: string; params: (string | number)[] } {
  const baseWhere = `v.vstdate BETWEEN ? AND ? AND o.an IS NULL`;
  const baseParams: (string | number)[] = [start, end];

  const filters: Record<
    string,
    { where: string; params: (string | number)[] }
  > = {
    all: { where: baseWhere, params: baseParams },
    opdOnTime: {
      where: `${baseWhere} AND o.vsttime BETWEEN '08:30:00' AND '16:30:59'`,
      params: baseParams,
    },
    opdOffTime: {
      where: `${baseWhere} AND (o.vsttime < '08:30:00' OR o.vsttime > '16:30:59')`,
      params: baseParams,
    },
    opdUc: {
      where: `${baseWhere} AND v.pcode IN ('UC','AA','AB','AC','AD','AE','AF','AG','AJ','AK')`,
      params: baseParams,
    },
    opdGov: {
      where: `${baseWhere} AND v.pcode = 'A2'`,
      params: baseParams,
    },
    opdSso: {
      where: `${baseWhere} AND v.pcode = 'A7'`,
      params: baseParams,
    },
    opdCash: {
      where: `${baseWhere} AND v.pcode IN ('A1','A9')`,
      params: baseParams,
    },
    opdForeign: {
      where: `${baseWhere} AND v.pcode = 'AL'`,
      params: baseParams,
    },
    referIn: {
      where: `${baseWhere} AND o.rfrics IS NOT NULL AND o.rfrics != ''`,
      params: baseParams,
    },
    referOut: {
      where: `${baseWhere} AND o.rfrocs IS NOT NULL AND o.rfrocs != ''`,
      params: baseParams,
    },
    erEmergency: {
      where: `v.vstdate BETWEEN ? AND ? AND er.er_pt_type = 1`,
      params: baseParams,
    },
    erAccident: {
      where: `v.vstdate BETWEEN ? AND ? AND er.er_pt_type = 2`,
      params: baseParams,
    },
    admitToday: {
      where: `a.regdate BETWEEN ? AND ?`,
      params: baseParams,
    },
  };

  return filters[cardType] ?? filters.all;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const cardType = searchParams.get("type") ?? "all";
  const hn = searchParams.get("hn"); // for history lookup

  if (!start || !end) {
    return NextResponse.json({ error: "Missing date range" }, { status: 400 });
  }

  try {
    // ── History for a specific patient ────────────────────────────────────────
    if (hn) {
      const [histRows] = await db.query<HistoryRow[]>(
        `SELECT
          v.vn,
          v.vstdate,
          o.vsttime,
          v.pdx,
          COALESCE(ic.name, v.pdx) AS dx_name,
          COALESCE(k.department, '') AS department,
          COALESCE(p2.name, '') AS pttype_name,
          COALESCE(CONCAT(d.licenseno, ' ', d.name), '') AS doctor_name
        FROM vn_stat v
        INNER JOIN ovst o ON o.vn = v.vn
        LEFT JOIN icd101 ic ON ic.code = v.pdx
        LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
        LEFT JOIN pttype p2 ON p2.pttype = v.pttype
        LEFT JOIN doctor d ON d.code = o.doctor
        WHERE v.hn = ?
          AND o.an IS NULL
        ORDER BY v.vstdate DESC, o.vsttime DESC
         `,
        [hn],
      );
      return NextResponse.json({ history: histRows });
    }

    // ── Patient list by card type ─────────────────────────────────────────────
    // Admit special case
    if (cardType === "admitToday") {
      const [rows] = await db.query<PatientRow[]>(
        `SELECT
          a.an AS vn,
          a.hn,
          COALESCE(pt.cid, '') AS cid,
          COALESCE(pt.pname, '') AS pname,
          COALESCE(pt.fname, '') AS fname,
          COALESCE(pt.lname, '') AS lname,
          COALESCE(a.age_y, 0) AS age_y,
          COALESCE(pt.sex, '1') AS sex,
          a.regdate AS vstdate,
          '' AS vsttime,
          COALESCE(a.pdx, '') AS pdx,
          COALESCE(ic.name, a.pdx, '') AS dx_name,
          COALESCE(wr.name, '') AS department,
          COALESCE(p2.pttype, '') AS pttype,
          COALESCE(p2.name, '') AS pttype_name,
          COALESCE(d.name, '') AS doctor_name,
          0 AS income
        FROM an_stat a
        INNER JOIN patient pt ON pt.hn = a.hn
        LEFT JOIN icd101 ic ON ic.code = a.pdx
        LEFT JOIN ward wr ON wr.ward = a.ward
        LEFT JOIN pttype p2 ON p2.pttype = a.pttype
        LEFT JOIN ipt ip ON ip.an = a.an
        LEFT JOIN doctor d ON d.code = ip.dch_doctor
        WHERE a.regdate BETWEEN ? AND ?
        ORDER BY a.regdate DESC`,
        [start, end],
      );
      return NextResponse.json({ patients: rows });
    }

    // ER special case — er_regist ไม่มี hn/vn/vstdate โดยตรง ต้อง join ovst
    if (cardType === "erEmergency" || cardType === "erAccident") {
      const erType = cardType === "erEmergency" ? 1 : 2;
      const [rows] = await db.query<PatientRow[]>(
        `SELECT
          o.vn,
          o.hn,
          COALESCE(pt.cid, '') AS cid,
          COALESCE(pt.pname, '') AS pname,
          COALESCE(pt.fname, '') AS fname,
          COALESCE(pt.lname, '') AS lname,
          COALESCE(vs.age_y, 0) AS age_y,
          COALESCE(pt.sex, '1') AS sex,
          o.vstdate,
          o.vsttime,
          COALESCE(vs.pdx, '') AS pdx,
          COALESCE(ic.name, vs.pdx, '') AS dx_name,
          'ER' AS department,
          COALESCE(p2.pttype, '') AS pttype,
          COALESCE(p2.name, '') AS pttype_name,
          COALESCE(d.name, '') AS doctor_name,
          COALESCE(vs.income, 0) AS income
        FROM er_regist er
        INNER JOIN ovst o ON o.vn = er.vn
        INNER JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat vs ON vs.vn = o.vn
        LEFT JOIN icd101 ic ON ic.code = vs.pdx
        LEFT JOIN pttype p2 ON p2.pttype = vs.pttype
        LEFT JOIN doctor d ON d.code = o.doctor
        WHERE o.vstdate BETWEEN ? AND ?
          AND er.er_pt_type = ?
        ORDER BY o.vstdate DESC, o.vsttime DESC`,
        [start, end, erType],
      );
      return NextResponse.json({ patients: rows });
    }

    // Standard OPD
    const { where, params } = buildFilter(cardType, start, end);
    const [rows] = await db.query<PatientRow[]>(
      `SELECT
        v.vn,
        v.hn,
        COALESCE(pt.cid, '') AS cid,
        COALESCE(pt.pname, '') AS pname,
        COALESCE(pt.fname, '') AS fname,
        COALESCE(pt.lname, '') AS lname,
        COALESCE(v.age_y, 0) AS age_y,
        COALESCE(pt.sex, '1') AS sex,
        v.vstdate,
        o.vsttime,
        COALESCE(v.pdx, '') AS pdx,
        COALESCE(ic.name, v.pdx, '') AS dx_name,
        COALESCE(k.department, '') AS department,
        COALESCE(v.pttype, '') AS pttype,
        COALESCE(p2.name, '') AS pttype_name,
        COALESCE(d.name, '') AS doctor_name,
        COALESCE(v.income, 0) AS income
      FROM vn_stat v
      INNER JOIN ovst o ON o.vn = v.vn
      INNER JOIN patient pt ON pt.hn = v.hn
      LEFT JOIN icd101 ic ON ic.code = v.pdx
      LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
      LEFT JOIN pttype p2 ON p2.pttype = v.pttype
      LEFT JOIN doctor d ON d.code = o.doctor
      WHERE ${where}
      ORDER BY v.vstdate DESC, o.vsttime DESC`,
      params,
    );

    return NextResponse.json({ patients: rows });
  } catch (error) {
    console.error("Patients API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
