// Inspect only visit records and their linked labels, never patient-wide history.
export const PT_OUTREACH_VISIT_TABLES = [
  "ovst", "opdscreen", "ovst_doctor_diag", "ovstdiag", "ovst_seq",
  "ovst_nurse", "opd_ill_history", "opd_note", "opd_nurse_note",
  "physic_main_opd", "physic_main", "physic_service", "clinic_visit",
] as const;

const LABEL_LINKS = [
  { table: "ovstist", key: "ovstist", parent: "ovst", column: "ovstist" },
  { table: "ovstost", key: "ovstost", parent: "ovst", column: "ovstost" },
  { table: "spclty", key: "spclty", parent: "ovst", column: "spclty" },
  { table: "kskdepartment", key: "depcode", parent: "ovst", column: "main_dep" },
  { table: "kskdepartment", key: "depcode", parent: "ovst", column: "cur_dep" },
  { table: "clinic", key: "clinic", parent: "clinic_visit", column: "clinic" },
] as const;

export const PT_OUTREACH_SCHEMA_TABLES = [...new Set([
  ...PT_OUTREACH_VISIT_TABLES, ...LABEL_LINKS.map((l) => l.table),
])];

// POSIX whitespace works on MySQL/MariaDB without requiring REGEXP_REPLACE.
export const PT_COMMUNITY_PATTERN = "(^|[^a-z])pt[[:space:]_.-]+(in|on)[[:space:]_.-]+community([^a-z]|$)";

export interface PtTextColumn {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
}
export interface PtOutreachQuery {
  sql: string;
  params: string[];
}

/** All available text columns in supported visit tables; validate identifiers too. */
export function buildPtOutreachQuery(schema: PtTextColumn[], start: string, end: string): PtOutreachQuery {
  const tables = new Map<string, Map<string, string>>();
  for (const row of schema) {
    const table = row.TABLE_NAME.toLowerCase(), col = row.COLUMN_NAME.toLowerCase();
    if (!PT_OUTREACH_SCHEMA_TABLES.some((t) => t === table) || !/^[a-z][a-z0-9_]*$/.test(col)) continue;
    if (!tables.has(table)) tables.set(table, new Map());
    tables.get(table)!.set(col, row.DATA_TYPE.toLowerCase());
  }
  const params: string[] = [];
  let fieldParams: string[] = [];
  const textMatch = (table: string, alias: string): string => {
    const fields = [...(tables.get(table) ?? [])]
      .filter(([col, type]) => !["vn", "hn", "an", "cid"].includes(col)
        && ["char", "varchar", "tinytext", "text", "mediumtext", "longtext"].includes(type))
      .map(([col]) => {
        fieldParams.push(PT_COMMUNITY_PATTERN);
        const text = `LOWER(COALESCE(${alias}.\`${col}\`, ''))`;
        // Most fields cannot match; skip the regex engine until the literal
        // word "community" is present. Preserve the exact matching rule.
        return `(${text} LIKE '%community%' AND ${text} REGEXP ?)`;
      });
    return fields.length ? `(${fields.join(" OR ")})` : "";
  };
  const parts: string[] = [];
  const addSource = (joins: string, match: string) => {
    if (!match) return;
    // Date-bounded set queries, never a correlated lookup per hospital visit.
    parts.push(`SELECT o.vn, DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS date
      FROM ovst o ${joins} WHERE o.vstdate BETWEEN ? AND ? AND ${match}`);
    params.push(start, end, ...fieldParams);
    fieldParams = [];
  };
  for (const table of PT_OUTREACH_VISIT_TABLES) {
    if (!tables.get(table)?.has("vn")) continue;
    const match = textMatch(table, table === "ovst" ? "o" : "s");
    addSource(table === "ovst" ? "" : `JOIN \`${table}\` s ON s.vn = o.vn`, match);
  }
  for (const link of LABEL_LINKS) {
    if (!tables.get(link.table)?.has(link.key) || !tables.get(link.parent)?.has(link.column)) continue;
    if (link.parent !== "ovst" && !tables.get(link.parent)?.has("vn")) continue;
    const match = textMatch(link.table, "label");
    addSource(link.parent === "ovst"
      ? `JOIN \`${link.table}\` label ON label.\`${link.key}\` = o.\`${link.column}\``
      : `JOIN \`${link.parent}\` s ON s.vn = o.vn JOIN \`${link.table}\` label ON label.\`${link.key}\` = s.\`${link.column}\``, match);
  }
  return { sql: parts.length ? parts.join(" UNION ") : "SELECT vn, vstdate AS date FROM ovst WHERE FALSE", params };
}
