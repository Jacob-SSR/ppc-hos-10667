import type { PtOutreachMatch } from "./pt-outreach";

/** Identifiers come only from the supported HOSxP schema, never request input. */
export interface PhysicOpdSource {
  table: "physic_main_opd" | "physic_main";
  staffColumn: "doctor" | "doctor_code" | "staff" | null;
}

export function buildPtRecordsQuery(
  source: PhysicOpdSource | null,
  icd9Table: "icd9cm" | "icd9_sss",
  staffPredicate: string,
  outreach: PtOutreachMatch,
): string {
  const registered = source
    ? `EXISTS (SELECT 1 FROM ${source.table} pm WHERE pm.vn = o.vn)`
    : "FALSE";
  const registeredStaff = source?.staffColumn
    ? `(SELECT pm.${source.staffColumn} FROM ${source.table} pm
         JOIN doctor dd ON dd.code = pm.${source.staffColumn}
        WHERE pm.vn = o.vn AND ${staffPredicate}
        ORDER BY pm.${source.staffColumn} LIMIT 1)`
    : "NULL";
  return `
    SELECT x.*, d2.name AS staff_name
    FROM (
      SELECT o.vn, o.hn, o.vstdate AS date, o.vsttime,
        COALESCE(NULLIF((SELECT MAX(oo.rxtime) FROM opitemrece oo
          JOIN doctor dd ON dd.code = oo.doctor
          WHERE oo.vn = o.vn AND ${staffPredicate}), ''), o.vsttime) AS svc_time,
        COALESCE((SELECT oo.doctor FROM opitemrece oo
          JOIN doctor dd ON dd.code = oo.doctor
          WHERE oo.vn = o.vn AND ${staffPredicate}
          GROUP BY oo.doctor ORDER BY SUM(oo.sum_price) DESC, oo.doctor LIMIT 1),
          ${registeredStaff}) AS staff_id,
        pt.cid,
        CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS patient_name,
        COALESCE(v.pcode, ptt.pcode, '') AS pcode,
        o.pttype, ptt.name AS pttype_name,
        COALESCE((SELECT SUM(oo.sum_price) FROM opitemrece oo
          WHERE oo.vn = o.vn AND oo.income IN ('14')), 0) AS charge_physio,
        COALESCE((SELECT SUM(oo.sum_price) FROM opitemrece oo
          WHERE oo.vn = o.vn AND oo.income IN ('03','04','17')), 0) AS charge_drug,
        COALESCE((SELECT SUM(oo.sum_price) FROM opitemrece oo
          WHERE oo.vn = o.vn AND oo.income NOT IN ('03','04','17','14')), 0) AS charge_other,
        COALESCE((SELECT SUM(oo.sum_price) FROM opitemrece oo
          WHERE oo.vn = o.vn), 0) AS charge_total,
        (SELECT op.icd9 FROM doctor_operation op
          WHERE op.vn = o.vn ORDER BY op.icd9 LIMIT 1) AS procedure_code,
        (SELECT COALESCE(ic9.name, op.icd9) FROM doctor_operation op
          LEFT JOIN ${icd9Table} ic9 ON ic9.code = op.icd9
          WHERE op.vn = o.vn ORDER BY op.icd9 LIMIT 1) AS procedure_name,
        EXISTS (SELECT 1 FROM opitemrece oo JOIN doctor dd ON dd.code = oo.doctor
          WHERE oo.vn = o.vn AND ${staffPredicate}) AS has_pt_billing,
        ${registered} AS has_pt_registration,
        ${outreach.sql} AS is_outreach
      FROM ovst o
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
      WHERE o.vstdate BETWEEN ? AND ?
    ) x
    LEFT JOIN doctor d2 ON d2.code = x.staff_id
    WHERE x.has_pt_billing OR x.has_pt_registration OR x.is_outreach
    ORDER BY x.date, x.vsttime, x.vn`;
}
