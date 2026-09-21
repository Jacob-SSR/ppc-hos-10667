export type ReportPeriod = "custom" | "month" | "year" | "fiscal";

export function reportDateRange(period: Exclude<ReportPeriod, "custom">, year: number, month: number) {
  if (period === "fiscal") return { date_from: `${year - 1}-10-01`, date_to: `${year}-09-30` };
  if (period === "year") return { date_from: `${year}-01-01`, date_to: `${year}-12-31` };
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { date_from: `${prefix}-01`, date_to: `${prefix}-${lastDay}` };
}

export function currentReportYear(period: ReportPeriod, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric", month: "numeric" }).formatToParts(now);
  const year = Number(parts.find(p => p.type === "year")?.value);
  const month = Number(parts.find(p => p.type === "month")?.value);
  return { year: year + (period === "fiscal" && month >= 10 ? 1 : 0), month };
}
