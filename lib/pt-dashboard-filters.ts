export type PtServiceLocation = "hospital" | "outreach";
export type PtLocationFilter = "all" | PtServiceLocation;

export const PT_LOCATION_LABELS: Record<PtLocationFilter, string> = {
  all: "ทั้งหมด",
  hospital: "ในโรงพยาบาล",
  outreach: "นอกพื้นที่ (เชิงรุก OPD)",
};

export function filterPtLocation<T extends { service_location: PtServiceLocation }>(
  rows: T[], location: PtLocationFilter,
): T[] {
  return location === "all" ? rows : rows.filter((r) => r.service_location === location);
}
