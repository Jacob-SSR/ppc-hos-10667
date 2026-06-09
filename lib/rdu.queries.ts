// lib/rdu.queries.ts
// SQL query functions สำหรับ RDU Dashboard — แยกออกมาจาก route.ts

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import {
  ATB_ICODES_SQL,
  URI_ICD10,
  DIA_ICD10,
  WOUND_ICD10_PREFIXES,
  PERI_ICD10,
  DISEASE_META,
  THAI_MONTHS_SHORT,
} from "@/lib/rdu.constants";
import type {
  RduDiseaseRow,
  RduTrendRow,
  RduDoctorRow,
  RduAtbRow,
} from "@/lib/rdu.types";

// ─── SQL condition builders ───────────────────────────────────────────────────

function inList(arr: readonly string[], col: string) {
  return `${col} IN (${arr.map((s) => `'${s}'`).join(",")})`;
}

function likeOr(prefixes: readonly string[], col: string) {
  return `(${prefixes.map((p) => `${col} LIKE '${p}%'`).join(" OR ")})`;
}

/** URI: exact ICD10 list */
const URI_COND = `(${inList(URI_ICD10, "od.icd10")})`;

/** Diarrhea: exact ICD10 list */
const DIA_COND = `(${inList(DIA_ICD10, "od.icd10")})`;

/** แผลสด: LIKE prefix */
const WOUND_COND = likeOr(WOUND_ICD10_PREFIXES, "od.icd10");

/** แผลฝีเย็บ: exact ICD10 list */
const PERI_COND = `(${inList(PERI_ICD10, "od.icd10")})`;

/** ATB subquery — VN ที่ได้รับยาปฏิชีวนะ */
function atbSubquery(start: string, end: string) {
  return `
    SELECT DISTINCT op.vn
    FROM opitemrece op
    WHERE op.icode IN (${ATB_ICODES_SQL})
      AND op.vstdate BETWEEN '${start}' AND '${end}'
  `;
}

// ─── Query 1: สรุปรายโรค ──────────────────────────────────────────────────────
export async function queryDiseaseSummary(
  start: string,
  end: string,
  depcode?: string,
): Promise<RduDiseaseRow[]> {
  const deptFilter = depcode ? `AND o.main_dep = '${depcode}'` : "";

  const diseaseConds: Record<string, string> = {
    uri: URI_COND,
    dia: DIA_COND,
    wound: WOUND_COND,
    peri: PERI_COND,
  };

  const results: RduDiseaseRow[] = [];

  for (const meta of DISEASE_META) {
    const cond = diseaseConds[meta.key];

    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        COUNT(DISTINCT v.vn) AS total_visits,
        COUNT(DISTINCT CASE WHEN atb.vn IS NOT NULL THEN v.vn END) AS rx_visits
      FROM vn_stat v
      INNER JOIN ovst o ON o.vn = v.vn
      INNER JOIN ovstdiag od
        ON od.vn = v.vn
        AND od.diagtype = '1'
      LEFT JOIN (${atbSubquery(start, end)}) atb ON atb.vn = v.vn
      WHERE v.vstdate BETWEEN ? AND ?
        AND o.an IS NULL
        AND ${cond}
        ${deptFilter}
    `,
      [start, end],
    );

    const row = rows[0];
    const visits = Number(row?.total_visits ?? 0);
    const rxN = Number(row?.rx_visits ?? 0);
    const current = visits > 0 ? Math.round((rxN / visits) * 1000) / 10 : 0;

    results.push({ ...meta, visits, rxN, current });
  }

  return results;
}

// ─── Query 2: Trend รายเดือน ──────────────────────────────────────────────────
export async function queryTrend(
  start: string,
  end: string,
): Promise<RduTrendRow[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `
    SELECT
      DATE_FORMAT(v.vstdate, '%Y-%m') AS month,
      COUNT(DISTINCT CASE WHEN ${URI_COND}   THEN v.vn END) AS uri_total,
      COUNT(DISTINCT CASE WHEN ${URI_COND}   AND atb.vn IS NOT NULL THEN v.vn END) AS uri_rx,
      COUNT(DISTINCT CASE WHEN ${DIA_COND}   THEN v.vn END) AS dia_total,
      COUNT(DISTINCT CASE WHEN ${DIA_COND}   AND atb.vn IS NOT NULL THEN v.vn END) AS dia_rx,
      COUNT(DISTINCT CASE WHEN ${WOUND_COND} THEN v.vn END) AS wound_total,
      COUNT(DISTINCT CASE WHEN ${WOUND_COND} AND atb.vn IS NOT NULL THEN v.vn END) AS wound_rx,
      COUNT(DISTINCT CASE WHEN ${PERI_COND}  THEN v.vn END) AS peri_total,
      COUNT(DISTINCT CASE WHEN ${PERI_COND}  AND atb.vn IS NOT NULL THEN v.vn END) AS peri_rx
    FROM vn_stat v
    INNER JOIN ovst o ON o.vn = v.vn
    INNER JOIN ovstdiag od
      ON od.vn = v.vn
      AND od.diagtype = '1'
    LEFT JOIN (${atbSubquery(start, end)}) atb ON atb.vn = v.vn
    WHERE v.vstdate BETWEEN ? AND ?
      AND o.an IS NULL
    GROUP BY DATE_FORMAT(v.vstdate, '%Y-%m')
    ORDER BY month ASC
  `,
    [start, end],
  );

  return rows.map((r) => {
    const [y, m] = String(r.month).split("-").map(Number);
    return {
      month: r.month,
      label: `${THAI_MONTHS_SHORT[m]} ${String(y + 543).slice(2)}`,
      uri_total: Number(r.uri_total),
      uri_rx: Number(r.uri_rx),
      dia_total: Number(r.dia_total),
      dia_rx: Number(r.dia_rx),
      wound_total: Number(r.wound_total),
      wound_rx: Number(r.wound_rx),
      peri_total: Number(r.peri_total),
      peri_rx: Number(r.peri_rx),
    } satisfies RduTrendRow;
  });
}

// ─── Query 3: Doctor-level ─────────────────────────────────────────────────────
// "dept" ตอนนี้เก็บ "ตำแหน่ง" (doctor_position.name) แทนแผนก
// เรียงตามความสำคัญของตำแหน่ง: แพทย์ → พยาบาลวิชาชีพ → พยาบาลเทคนิค → ทันตแพทย์ → เภสัชกร → เทคนิคการแพทย์ → อื่นๆ → ไม่ระบุ (ท้ายสุด)
export async function queryDoctors(
  start: string,
  end: string,
): Promise<RduDoctorRow[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `
    SELECT
      o.doctor                                      AS doctor_code,
      MAX(COALESCE(d.name, o.doctor))             AS doctor_name,
      MAX(COALESCE(NULLIF(dp.name, ''), 'ไม่ระบุ')) AS dept,
      MAX(CASE COALESCE(NULLIF(dp.name, ''), 'ไม่ระบุ')
            WHEN 'แพทย์'          THEN 1
            WHEN 'พยาบาลวิชาชีพ'  THEN 2
            WHEN 'พยาบาลเทคนิค'   THEN 3
            WHEN 'ทันตแพทย์'      THEN 4
            WHEN 'เภสัชกร'        THEN 5
            WHEN 'เทคนิคการแพทย์' THEN 6
            WHEN 'ไม่ระบุ'        THEN 999
            ELSE 99 END)                            AS pos_rank,
      COUNT(DISTINCT v.vn)                          AS visits,
      COUNT(DISTINCT CASE WHEN ${URI_COND}   THEN v.vn END) AS uri_total,
      COUNT(DISTINCT CASE WHEN ${URI_COND}   AND atb.vn IS NOT NULL THEN v.vn END) AS uri_rx,
      COUNT(DISTINCT CASE WHEN ${DIA_COND}   THEN v.vn END) AS dia_total,
      COUNT(DISTINCT CASE WHEN ${DIA_COND}   AND atb.vn IS NOT NULL THEN v.vn END) AS dia_rx,
      COUNT(DISTINCT CASE WHEN ${WOUND_COND} THEN v.vn END) AS wound_total,
      COUNT(DISTINCT CASE WHEN ${WOUND_COND} AND atb.vn IS NOT NULL THEN v.vn END) AS wound_rx,
      COUNT(DISTINCT CASE WHEN ${PERI_COND}  THEN v.vn END) AS peri_total,
      COUNT(DISTINCT CASE WHEN ${PERI_COND}  AND atb.vn IS NOT NULL THEN v.vn END) AS peri_rx
    FROM vn_stat v
    INNER JOIN ovst o ON o.vn = v.vn
    INNER JOIN ovstdiag od
      ON od.vn = v.vn
      AND od.diagtype = '1'
    LEFT JOIN doctor d ON d.code = o.doctor
    LEFT JOIN doctor_position dp ON dp.id = d.position_id
    LEFT JOIN (${atbSubquery(start, end)}) atb ON atb.vn = v.vn
    WHERE v.vstdate BETWEEN ? AND ?
      AND o.an IS NULL
      AND o.doctor IS NOT NULL
      AND o.doctor != ''
      AND (${URI_COND} OR ${DIA_COND} OR ${WOUND_COND} OR ${PERI_COND})
    GROUP BY o.doctor
    HAVING visits > 0
    ORDER BY pos_rank ASC, visits DESC
  `,
    [start, end],
  );

  const pct = (total: number, rx: number) =>
    total > 0 ? Math.round((rx / total) * 1000) / 10 : 0;

  return rows.map(
    (r) =>
      ({
        doctor_code: String(r.doctor_code ?? ""),
        doctor_name: String(r.doctor_name ?? r.doctor_code ?? "").trim(),
        dept: String(r.dept ?? "").trim(),
        visits: Number(r.visits),
        uri_total: Number(r.uri_total),
        uri_rx: Number(r.uri_rx),
        uri_pct: pct(Number(r.uri_total), Number(r.uri_rx)),
        dia_total: Number(r.dia_total),
        dia_rx: Number(r.dia_rx),
        dia_pct: pct(Number(r.dia_total), Number(r.dia_rx)),
        wound_total: Number(r.wound_total),
        wound_rx: Number(r.wound_rx),
        wound_pct: pct(Number(r.wound_total), Number(r.wound_rx)),
        peri_total: Number(r.peri_total),
        peri_rx: Number(r.peri_rx),
        peri_pct: pct(Number(r.peri_total), Number(r.peri_rx)),
      }) satisfies RduDoctorRow,
  );
}

// ─── Query 4: Top ATB ทั้งโรงพยาบาล ──────────────────────────────────────────
export async function queryTopAtb(
  start: string,
  end: string,
): Promise<RduAtbRow[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `
    SELECT
      COALESCE(di.name, op.icode) AS drug_name,
      COUNT(DISTINCT op.vn)       AS rx_count
    FROM opitemrece op
    INNER JOIN drugitems di ON di.icode = op.icode AND di.antibiotic = 'Y'
    INNER JOIN ovst o ON o.vn = op.vn
    INNER JOIN ovstdiag od
      ON od.vn = op.vn
      AND od.diagtype = '1'
    WHERE op.icode IN (${ATB_ICODES_SQL})
      AND op.vstdate BETWEEN ? AND ?
      AND o.an IS NULL
      AND (${URI_COND} OR ${DIA_COND} OR ${WOUND_COND} OR ${PERI_COND})
    GROUP BY di.name, op.icode
    ORDER BY rx_count DESC
  `,
    [start, end],
  );

  return rows.map((r) => ({
    drug_name: String(r.drug_name ?? "").trim(),
    rx_count: Number(r.rx_count),
    disease_key: "all",
  }));
}

// ─── Query 5: ATB แยกตามโรค (Top 5 ต่อโรค) ───────────────────────────────────
export async function queryAtbByDisease(
  start: string,
  end: string,
): Promise<Record<string, RduAtbRow[]>> {
  const conds: Record<string, string> = {
    uri: URI_COND,
    dia: DIA_COND,
    wound: WOUND_COND,
    peri: PERI_COND,
  };

  const result: Record<string, RduAtbRow[]> = {};

  for (const [key, cond] of Object.entries(conds)) {
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        COALESCE(di.name, op.icode) AS drug_name,
        COUNT(DISTINCT op.vn)       AS rx_count
      FROM opitemrece op
      INNER JOIN drugitems di ON di.icode = op.icode AND di.antibiotic = 'Y'
      INNER JOIN ovst o ON o.vn = op.vn
      INNER JOIN ovstdiag od
        ON od.vn = op.vn
        AND od.diagtype = '1'
      WHERE op.icode IN (${ATB_ICODES_SQL})
        AND op.vstdate BETWEEN ? AND ?
        AND o.an IS NULL
        AND ${cond}
      GROUP BY di.name, op.icode
      ORDER BY rx_count DESC
    `,
      [start, end],
    );

    result[key] = rows.map((r) => ({
      drug_name: String(r.drug_name ?? "").trim(),
      rx_count: Number(r.rx_count),
      disease_key: key,
    }));
  }

  return result;
}
