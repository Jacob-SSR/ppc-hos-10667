export type IcdDisease = { code: string; name: string; thai_name: string };
export const ICD_SEARCH_LIMIT = 30;

export function diseaseSearchQuery(input: string) {
  const term = input.trim();
  if (term.length < 2 || term.length > 100) throw new Error("กรุณาพิมพ์ชื่อโรคหรือรหัส 2–100 ตัวอักษร");
  const escape = (value: string) => value.replace(/[!%_]/g, "!$&");
  const text = `%${escape(term)}%`;
  const code = term.toUpperCase().replace(/\./g, "");
  return {
    sql: `SELECT code, COALESCE(name, '') AS name, COALESCE(tname, '') AS thai_name
      FROM icd101
      WHERE LOWER(COALESCE(tname, '')) LIKE LOWER(?) ESCAPE '!'
        OR LOWER(COALESCE(name, '')) LIKE LOWER(?) ESCAPE '!'
        OR UPPER(REPLACE(code, '.', '')) LIKE ? ESCAPE '!'
      ORDER BY CASE WHEN UPPER(REPLACE(code, '.', '')) = ? THEN 0 ELSE 1 END, code
      LIMIT ${ICD_SEARCH_LIMIT + 1}`,
    values: [text, text, `${escape(code)}%`, code],
  };
}
