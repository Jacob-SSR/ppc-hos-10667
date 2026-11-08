/** Identifiers come only from the supported HOSxP schema, never request input. */
export interface PhysicOpdSource {
  table: "physic_main_opd" | "physic_main";
  staffColumn: "doctor" | "doctor_code" | "staff" | null;
}

export function buildPtCandidateQuery(
  source: PhysicOpdSource | null, staffPredicate: string, start: string, end: string,
): { sql: string; params: string[] } {
  const billed = `SELECT o.vn FROM ovst o
    JOIN opitemrece oo ON oo.vn = o.vn JOIN doctor dd ON dd.code = oo.doctor
    WHERE o.vstdate BETWEEN ? AND ? AND ${staffPredicate}`;
  return {
    sql: source ? `${billed} UNION SELECT o.vn FROM ovst o
      JOIN ${source.table} pm ON pm.vn = o.vn WHERE o.vstdate BETWEEN ? AND ?`
      : `SELECT DISTINCT vn FROM (${billed}) billed`,
    params: source ? [start, end, start, end] : [start, end],
  };
}

/** Load bounded batches of eligible VNs; aggregate all charge categories once. */
export function buildPtRecordsQuery(
  source: PhysicOpdSource | null,
  icd9Table: "icd9cm" | "icd9_sss",
  staffPredicate: string,
  vns: string[],
): { sql: string; params: string[] } {
  const placeholders = vns.map(() => "?").join(",") || "NULL";
  const registeredStaff = source?.staffColumn
    ? `(SELECT pm.${source.staffColumn} FROM ${source.table} pm
         JOIN doctor dd ON dd.code = pm.${source.staffColumn}
        WHERE pm.vn = o.vn AND ${staffPredicate}
        ORDER BY pm.${source.staffColumn} LIMIT 1)`
    : "NULL";
  return { sql: `
    SELECT x.*, d2.name AS staff_name
    FROM (
      SELECT o.vn, o.hn, DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS date, o.vsttime,
        COALESCE(NULLIF(charges.svc_time, ''), o.vsttime) AS svc_time,
        COALESCE((SELECT oo.doctor FROM opitemrece oo
          JOIN doctor dd ON dd.code = oo.doctor
          WHERE oo.vn = o.vn AND ${staffPredicate}
          GROUP BY oo.doctor ORDER BY SUM(oo.sum_price) DESC, oo.doctor LIMIT 1),
          ${registeredStaff}) AS staff_id,
        pt.cid,
        CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS patient_name,
        COALESCE(v.pcode, ptt.pcode, '') AS pcode,
        o.pttype, ptt.name AS pttype_name,
        COALESCE(charges.charge_physio, 0) AS charge_physio,
        COALESCE(charges.charge_drug, 0) AS charge_drug,
        COALESCE(charges.charge_other, 0) AS charge_other,
        COALESCE(charges.charge_total, 0) AS charge_total,
        (SELECT op.icd9 FROM doctor_operation op
          WHERE op.vn = o.vn ORDER BY op.icd9 LIMIT 1) AS procedure_code,
        (SELECT COALESCE(ic9.name, op.icd9) FROM doctor_operation op
          LEFT JOIN ${icd9Table} ic9 ON ic9.code = op.icd9
          WHERE op.vn = o.vn ORDER BY op.icd9 LIMIT 1) AS procedure_name
      FROM ovst o
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
      LEFT JOIN (
        SELECT oo.vn,
          SUM(CASE WHEN oo.income = '14' THEN oo.sum_price ELSE 0 END) AS charge_physio,
          SUM(CASE WHEN oo.income IN ('03','04','17') THEN oo.sum_price ELSE 0 END) AS charge_drug,
          SUM(CASE WHEN oo.income NOT IN ('03','04','17','14') THEN oo.sum_price ELSE 0 END) AS charge_other,
          SUM(oo.sum_price) AS charge_total,
          MAX(CASE WHEN ${staffPredicate} THEN oo.rxtime ELSE NULL END) AS svc_time
        FROM opitemrece oo LEFT JOIN doctor dd ON dd.code = oo.doctor
        WHERE oo.vn IN (${placeholders}) GROUP BY oo.vn
      ) charges ON charges.vn = o.vn
      WHERE o.vn IN (${placeholders})
    ) x
    LEFT JOIN doctor d2 ON d2.code = x.staff_id
    ORDER BY x.date, x.vsttime, x.vn`, params: [...vns, ...vns] };
}
