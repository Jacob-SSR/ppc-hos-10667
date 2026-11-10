import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { withHeavySlot } from "@/lib/limiter";
import { createPtDashboardCache } from "@/lib/pt-dashboard-cache";
import {
  PT_TREATMENT_CATALOG_SQL, ptTreatmentQueries,
  type PtTreatmentFilters, type PtTreatmentItem, type PtTreatmentReport,
  type PtTreatmentRow, type PtTreatmentTotals,
} from "@/lib/pt-treatment-summary";

const catalogCache = createPtDashboardCache<{ items: PtTreatmentItem[]; hospital: string }>(60 * 60 * 1000, 1);
const reportCache = createPtDashboardCache<PtTreatmentReport>(60_000, 8);
export function getPtTreatmentCatalog() {
  return catalogCache("catalog", async () => {
    const [items] = await db.query<(RowDataPacket & PtTreatmentItem)[]>(PT_TREATMENT_CATALOG_SQL);
    const [hospital] = await db.query<(RowDataPacket & { hospitalname: string })[]>("SELECT hospitalname FROM opdconfig LIMIT 1");
    return {
      items: items.map(item => ({ icode: String(item.icode), name: String(item.name) })),
      hospital: hospital[0]?.hospitalname || "โรงพยาบาลพลับพลาชัย",
    };
  });
}
const numericTotals = (row: PtTreatmentTotals): PtTreatmentTotals => ({
  patients: Number(row.patients) || 0, visits: Number(row.visits) || 0,
  lines: Number(row.lines) || 0, quantity: Number(row.quantity) || 0, charge: Number(row.charge) || 0,
});
export function getPtTreatmentReport(filters: PtTreatmentFilters) {
  const key = JSON.stringify(filters);
  return reportCache(key, () => withHeavySlot(async () => {
    const query = ptTreatmentQueries(filters);
    const [rows] = await db.query<(RowDataPacket & PtTreatmentRow)[]>(query.rows.sql, query.rows.params);
    const [totals] = await db.query<(RowDataPacket & PtTreatmentTotals)[]>(query.totals.sql, query.totals.params);
    return {
      ...filters,
      rows: rows.map(row => ({ ...numericTotals(row), icode: String(row.icode), name: String(row.name), pttype: String(row.pttype), pttype_name: String(row.pttype_name) })),
      totals: numericTotals(totals[0]), updatedAt: new Date().toISOString(),
    };
  }));
}
