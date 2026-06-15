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

interface ErPatientRow extends PatientRow {
  er_pt_type: number;
  er_pt_type_name: string;
  er_emergency_level_id: number | null;
  er_emergency_level_name: string;
  er_dch_type_name: string;
  er_accident_type_id: string | null;
  er_accident_type_name: string;
  accident_transport_type_name: string;
}

interface AccidentPatientRow extends RowDataPacket {
  hn: string;
  ptname: string;
  sex: string;
  addrpart: string;
  moopart: string;
  full_name: string;
  vstdate: string;
  transporter: string;
  accident_transport_type_name: string;
  er_dch_type_name: string;
  er_accident_type_name: string;
}

function buildFilter(cardType: string, start: string, end: string) {
  const baseWhere = `v.vstdate BETWEEN ? AND ? AND o.an IS NULL`;
  const baseParams: (string | number)[] = [start, end];

  const filters: Record<
    string,
    { where: string; params: (string | number)[] }
  > = {
    // รวมที่ Admit ด้วย → ตรงกับการ์ด "ผู้รับบริการทั้งหมด" (239 คน)
    all: { where: `v.vstdate BETWEEN ? AND ?`, params: baseParams },
    opdOnTime: {
      where: `${baseWhere} AND o.vsttime BETWEEN '08:30:00' AND '16:29:59'`,
      params: baseParams,
    },
    opdOffTime: {
      where: `${baseWhere} AND o.vsttime BETWEEN '16:30:00' AND '20:30:59'`,
      params: baseParams,
    },
    opdUc: {
      where: `${baseWhere} AND v.pcode IN ('UC','AA','AB','AC','AD','AE','AF','AG','AJ','AK')`,
      params: baseParams,
    },
    opdGov: { where: `${baseWhere} AND v.pcode = 'A2'`, params: baseParams },
    opdSso: { where: `${baseWhere} AND v.pcode = 'A7'`, params: baseParams },
    opdCash: {
      where: `${baseWhere} AND v.pcode IN ('A1','A9')`,
      params: baseParams,
    },
    opdForeign: {
      where: `${baseWhere} AND v.pcode = 'AL'`,
      params: baseParams,
    },
    referIn: {
      where: `v.vstdate BETWEEN ? AND ? AND EXISTS (SELECT 1 FROM referin r WHERE r.vn = o.vn)`,
      params: [start, end],
    },
    referOut: {
      where: `v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND EXISTS (SELECT 1 FROM referout r WHERE r.vn = o.vn)`,
      params: [start, end],
    },
    admitToday: { where: `a.regdate BETWEEN ? AND ?`, params: baseParams },
    erEmergency: { where: `o.vstdate BETWEEN ? AND ?`, params: [start, end] },
  };

  return filters[cardType] ?? filters.all;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const cardType = searchParams.get("type") ?? "all";
  const hn = searchParams.get("hn");

  if (!start || !end) {
    return NextResponse.json({ error: "Missing date range" }, { status: 400 });
  }

  try {
    // ── History ──────────────────────────────────────────────────────────────
    if (hn) {
      const [histRows] = await db.query<HistoryRow[]>(
        `SELECT v.vn, v.vstdate, o.vsttime, v.pdx,
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
        WHERE v.hn = ? AND o.an IS NULL
        ORDER BY v.vstdate DESC, o.vsttime DESC`,
        [hn],
      );
      return NextResponse.json({ history: histRows });
    }

    // ── Admit ─────────────────────────────────────────────────────────────────
    if (cardType === "admitToday") {
      const [rows] = await db.query<PatientRow[]>(
        `SELECT a.an AS vn, a.hn, COALESCE(pt.cid,'') AS cid,
          COALESCE(pt.pname,'') AS pname, COALESCE(pt.fname,'') AS fname,
          COALESCE(pt.lname,'') AS lname, COALESCE(a.age_y,0) AS age_y,
          COALESCE(pt.sex,'1') AS sex, a.regdate AS vstdate, '' AS vsttime,
          COALESCE(a.pdx,'') AS pdx, COALESCE(ic.name,a.pdx,'') AS dx_name,
          COALESCE(wr.name,'') AS department, COALESCE(p2.pttype,'') AS pttype,
          COALESCE(p2.name,'') AS pttype_name, COALESCE(d.name,'') AS doctor_name, 0 AS income
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

    // ── ER (extended with accident/dch data) ──────────────────────────────────
    if (cardType === "erEmergency") {
      const [rows] = await db.query<ErPatientRow[]>(
        `SELECT o.vn, o.hn, COALESCE(pt.cid,'') AS cid,
          COALESCE(pt.pname,'') AS pname, COALESCE(pt.fname,'') AS fname,
          COALESCE(pt.lname,'') AS lname, COALESCE(vs.age_y,0) AS age_y,
          COALESCE(pt.sex,'1') AS sex, o.vstdate, o.vsttime,
          COALESCE(vs.pdx,'') AS pdx, COALESCE(ic.name,vs.pdx,'') AS dx_name,
          'ER' AS department,
          COALESCE(p2.pttype,'') AS pttype, COALESCE(p2.name,'') AS pttype_name,
          COALESCE(d.name,'') AS doctor_name, COALESCE(vs.income,0) AS income,
          er.er_pt_type,
          COALESCE(ept.name,'') AS er_pt_type_name,
          er.er_emergency_level_id,
          COALESCE(el.er_emergency_level_name,'') AS er_emergency_level_name,
          COALESCE(edt.name,'') AS er_dch_type_name,
          end_.er_accident_type_id,
          COALESCE(eat.er_accident_type_name,'') AS er_accident_type_name,
          COALESCE(att.accident_transport_type_name,'') AS accident_transport_type_name
        FROM er_regist er
        INNER JOIN ovst o ON o.vn = er.vn
        INNER JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat vs ON vs.vn = o.vn
        LEFT JOIN icd101 ic ON ic.code = vs.pdx
        LEFT JOIN pttype p2 ON p2.pttype = vs.pttype
        LEFT JOIN doctor d ON d.code = o.doctor
        LEFT JOIN er_emergency_level el ON el.er_emergency_level_id = er.er_emergency_level_id
        LEFT JOIN er_pt_type ept ON ept.er_pt_type = er.er_pt_type
        LEFT JOIN er_dch_type edt ON edt.er_dch_type = er.er_dch_type
        LEFT JOIN er_nursing_detail end_ ON end_.vn = er.vn
        LEFT JOIN er_accident_type eat ON eat.er_accident_type_id = end_.er_accident_type_id
        LEFT JOIN accident_transport_type att ON att.accident_transport_type_id = end_.accident_transport_type_id
        WHERE o.vstdate BETWEEN ? AND ?
        ORDER BY o.vstdate DESC, o.vsttime DESC`,
        [start, end],
      );

      // ── Build summaries ────────────────────────────────────────────────────
      const levelSummary: Record<string, number> = {};
      const ptTypeSummary: Record<string, number> = {};
      const dchByPtType: Record<string, Record<string, number>> = {};
      const vehicleSummary: Record<string, number> = {};
      const transportDchSummary: Record<string, number> = {};
      const accidentTypeSummary: Record<string, number> = {};
      const otherDchSummary: Record<string, number> = {};

      rows.forEach((r) => {
        // level
        const lv = r.er_emergency_level_name || "ไม่ระบุ level";
        levelSummary[lv] = (levelSummary[lv] || 0) + 1;

        // pt_type
        const pt = r.er_pt_type_name || "ไม่ระบุประเภท";
        ptTypeSummary[pt] = (ptTypeSummary[pt] || 0) + 1;

        // dch per pt_type
        if (!dchByPtType[pt]) dchByPtType[pt] = {};
        const dch = r.er_dch_type_name || "ไม่ระบุ";
        dchByPtType[pt][dch] = (dchByPtType[pt][dch] || 0) + 1;

        // accident breakdown
        const accId = r.er_accident_type_id
          ? String(r.er_accident_type_id)
          : null;
        if (accId === "1") {
          // transport accident
          const v = r.accident_transport_type_name || "ไม่ระบุ";
          vehicleSummary[v] = (vehicleSummary[v] || 0) + 1;
          transportDchSummary[dch] = (transportDchSummary[dch] || 0) + 1;
        } else if (accId) {
          // other accident
          const a = r.er_accident_type_name || "ไม่ระบุ";
          accidentTypeSummary[a] = (accidentTypeSummary[a] || 0) + 1;
          otherDchSummary[dch] = (otherDchSummary[dch] || 0) + 1;
        }
      });

      const transportCount = rows.filter(
        (r) => r.er_accident_type_id && String(r.er_accident_type_id) === "1",
      ).length;
      const otherAccidentCount = rows.filter(
        (r) => r.er_accident_type_id && String(r.er_accident_type_id) !== "1",
      ).length;

      return NextResponse.json({
        patients: rows,
        levelSummary,
        ptTypeSummary,
        dchByPtType,
        vehicleSummary,
        transportDchSummary,
        accidentTypeSummary,
        otherDchSummary,
        transportCount,
        otherAccidentCount,
      });
    }

    // ── อุบัติเหตุการขนส่ง ───────────────────────────────────────────────────
    if (cardType === "erTransport") {
      const [rows] = await db.query<AccidentPatientRow[]>(
        `SELECT
          p.hn,
          CONCAT(p.pname, p.fname, ' ', p.lname) AS ptname,
          COALESCE(p.sex, '1') AS sex,
          p.addrpart, p.moopart, t.full_name, v.vstdate,
          COALESCE(ed.transporter,'') AS transporter,
          COALESCE(att.accident_transport_type_name,'') AS accident_transport_type_name,
          COALESCE(edt.name,'') AS er_dch_type_name,
          COALESCE(eee.er_accident_type_name,'') AS er_accident_type_name
        FROM er_nursing_detail ed
        LEFT JOIN accident_transport_type att ON att.accident_transport_type_id = ed.accident_transport_type_id
        LEFT JOIN vn_stat v ON v.vn = ed.vn
        LEFT JOIN er_regist e ON e.vn = v.vn
        LEFT JOIN er_dch_type edt ON edt.er_dch_type = e.er_dch_type
        LEFT JOIN patient p ON p.hn = v.hn
        LEFT JOIN thaiaddress t ON t.addressid = v.aid
        LEFT JOIN er_accident_type eee ON eee.er_accident_type_id = ed.er_accident_type_id
        WHERE ed.er_accident_type_id = '1'
          AND v.vstdate BETWEEN ? AND ?
        ORDER BY v.vstdate DESC`,
        [start, end],
      );

      const vehicleSummary: Record<string, number> = {};
      const dchSummary: Record<string, number> = {};
      const transporterSummary: Record<string, number> = {};
      rows.forEach((r) => {
        const v = r.accident_transport_type_name || "ไม่ระบุ";
        vehicleSummary[v] = (vehicleSummary[v] || 0) + 1;
        const d = r.er_dch_type_name || "ไม่ระบุ";
        dchSummary[d] = (dchSummary[d] || 0) + 1;
        const tr = r.transporter || "ไม่ระบุ";
        transporterSummary[tr] = (transporterSummary[tr] || 0) + 1;
      });

      return NextResponse.json({
        patients: rows,
        vehicleSummary,
        dchSummary,
        transporterSummary,
      });
    }

    // ── อุบัติเหตุอื่นๆ ──────────────────────────────────────────────────────
    if (cardType === "erOtherAccident") {
      const [rows] = await db.query<AccidentPatientRow[]>(
        `SELECT
          p.hn,
          CONCAT(p.pname, p.fname, ' ', p.lname) AS ptname,
          COALESCE(p.sex, '1') AS sex,
          p.addrpart, p.moopart, t.full_name, v.vstdate,
          COALESCE(ed.transporter,'') AS transporter,
          COALESCE(att.accident_transport_type_name,'') AS accident_transport_type_name,
          COALESCE(edt.name,'') AS er_dch_type_name,
          COALESCE(eee.er_accident_type_name,'') AS er_accident_type_name
        FROM er_nursing_detail ed
        LEFT JOIN accident_transport_type att ON att.accident_transport_type_id = ed.accident_transport_type_id
        LEFT JOIN vn_stat v ON v.vn = ed.vn
        LEFT JOIN er_regist e ON e.vn = v.vn
        LEFT JOIN er_dch_type edt ON edt.er_dch_type = e.er_dch_type
        LEFT JOIN patient p ON p.hn = v.hn
        LEFT JOIN thaiaddress t ON t.addressid = v.aid
        LEFT JOIN er_accident_type eee ON eee.er_accident_type_id = ed.er_accident_type_id
        WHERE ed.er_accident_type_id IS NOT NULL
          AND ed.er_accident_type_id != '1'
          AND v.vstdate BETWEEN ? AND ?
        ORDER BY v.vstdate DESC`,
        [start, end],
      );

      const accidentTypeSummary: Record<string, number> = {};
      const dchSummary: Record<string, number> = {};
      rows.forEach((r) => {
        const a = r.er_accident_type_name || "ไม่ระบุ";
        accidentTypeSummary[a] = (accidentTypeSummary[a] || 0) + 1;
        const d = r.er_dch_type_name || "ไม่ระบุ";
        dchSummary[d] = (dchSummary[d] || 0) + 1;
      });

      return NextResponse.json({
        patients: rows,
        accidentTypeSummary,
        dchSummary,
      });
    }

    // ── OPD Standard ──────────────────────────────────────────────────────────
    const { where, params } = buildFilter(cardType, start, end);
    const [rows] = await db.query<PatientRow[]>(
      `SELECT v.vn, v.hn, COALESCE(pt.cid,'') AS cid,
        COALESCE(pt.pname,'') AS pname, COALESCE(pt.fname,'') AS fname,
        COALESCE(pt.lname,'') AS lname, COALESCE(v.age_y,0) AS age_y,
        COALESCE(pt.sex,'1') AS sex, v.vstdate, o.vsttime,
        COALESCE(v.pdx,'') AS pdx, COALESCE(ic.name,v.pdx,'') AS dx_name,
        COALESCE(k.department,'') AS department, COALESCE(v.pttype,'') AS pttype,
        COALESCE(p2.name,'') AS pttype_name, COALESCE(d.name,'') AS doctor_name,
        COALESCE(v.income,0) AS income
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
