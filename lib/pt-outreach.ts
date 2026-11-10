// Use the actual billed item catalogue and the visit's arrival type.
export const PT_OUTREACH_SCHEMA_TABLES = [
  "ovst", "ovstist", "opitemrece", "drugitems", "nondrugitems", "s_drugitems",
];
export const PT_COMMUNITY_PATTERN = "(^|[^a-z])pt[[:space:]_.-]+(in|on)[[:space:]_.-]+community([^a-z]|$)";
export const PT_ITEM_PATTERN = [
  PT_COMMUNITY_PATTERN, "กายภาพ", "physiotherap", "physical[[:space:]]+therap",
  "peripheral[[:space:]_.-]+magnetic[[:space:]_.-]+stimulation",
  "(^|[^a-z])rom[[:space:]_.-]+exercise([^a-z]|$)",
  "(^|[^a-z])hot[[:space:]_.-]*pack([^a-z]|$)", "ประคบร้อน",
].join("|");

export interface PtTextColumn { TABLE_NAME: string; COLUMN_NAME: string; DATA_TYPE: string }
export interface PtOutreachQuery { sql: string; params: string[] }
export interface PtItemCodes { ptIcodes: string[]; communityIcodes: string[] }

function columns(schema: PtTextColumn[]) {
  const tables = new Map<string, Set<string>>();
  for (const row of schema) {
    const table = row.TABLE_NAME.toLowerCase(), col = row.COLUMN_NAME.toLowerCase();
    if (!PT_OUTREACH_SCHEMA_TABLES.includes(table) || !/^[a-z][a-z0-9_]*$/.test(col)) continue;
    if (!tables.has(table)) tables.set(table, new Set());
    tables.get(table)!.add(col);
  }
  return tables;
}

/** Resolve a small set of item codes once, rather than scanning visit narratives. */
export function buildPtCatalogQuery(schema: PtTextColumn[]): PtOutreachQuery {
  const tables = columns(schema), parts: string[] = [], params: string[] = [];
  for (const table of ["drugitems", "nondrugitems", "s_drugitems"]) {
    const cols = tables.get(table);
    if (!cols?.has("icode") || !cols.has("name")) continue;
    parts.push(`SELECT icode, CASE WHEN LOWER(COALESCE(name, '')) REGEXP ? THEN 1 ELSE 0 END AS is_community
      FROM \`${table}\` WHERE LOWER(COALESCE(name, '')) REGEXP ?${cols.has("income") ? " OR income = '14'" : ""}`);
    params.push(PT_COMMUNITY_PATTERN, PT_ITEM_PATTERN);
  }
  return { sql: parts.join(" UNION ") || "SELECT '' AS icode, 0 AS is_community WHERE FALSE", params };
}

export function collectPtItemCodes(rows: { icode: string; is_community: number | string }[]): PtItemCodes {
  const pt = new Set<string>(), community = new Set<string>();
  for (const row of rows) {
    const code = String(row.icode ?? "").trim();
    if (!code) continue;
    pt.add(code);
    if (Number(row.is_community)) community.add(code);
  }
  return { ptIcodes: [...pt], communityIcodes: [...community] };
}

/** Both the PT community item and arrival label must belong to the same VN. */
export function buildPtOutreachQuery(
  schema: PtTextColumn[], start: string, end: string, communityIcodes: string[],
): PtOutreachQuery {
  const tables = columns(schema);
  const available = tables.get("ovst")?.has("ovstist")
    && tables.get("ovstist")?.has("ovstist") && tables.get("ovstist")?.has("name")
    && tables.get("opitemrece")?.has("vn") && tables.get("opitemrece")?.has("icode");
  if (!available || !communityIcodes.length) {
    return { sql: "SELECT vn, vstdate AS date FROM ovst WHERE FALSE", params: [] };
  }
  return {
    sql: `SELECT DISTINCT o.vn, DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS date
      FROM ovst o JOIN opitemrece oo ON oo.vn = o.vn
      JOIN ovstist arrival ON arrival.ovstist = o.ovstist
      WHERE o.vstdate BETWEEN ? AND ? AND oo.icode IN (${communityIcodes.map(() => "?").join(",")})
        AND arrival.name LIKE ?`,
    params: [start, end, ...communityIcodes, "%งานเชิงรุก%"],
  };
}
