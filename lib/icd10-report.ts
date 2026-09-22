export const ICD10_TITLE = "Dashboard สถิติผู้ป่วยตามกลุ่มโรค (ICD-10)";
export const ICD10_LIMIT = 100000;
export type IcdFilters = { icd_from: string; icd_to: string; age_from: number; age_to: number; date_from: string; date_to: string; mode: "all" | "pdx"; diag_text: string };
export type IcdVisit = { vn: string; hn: string; vstdate: string; age_y: number; ptname: string; pdx: string; dname: string; dxlist: string; diag_text: string };

export function parseIcdFilters(p: URLSearchParams): IcdFilters {
  const code = (key: string) => {
    const value = (p.get(key) ?? "").trim().toUpperCase().replace(/\./g, "");
    if (!/^[A-Z][0-9]{2}[A-Z0-9]{0,4}$/.test(value)) throw new Error("กรุณาระบุรหัส ICD-10 ให้ถูกต้อง เช่น A00 หรือ A00.0");
    return value;
  };
  const age = (key: string) => {
    const value = p.get(key) ?? "";
    if (!/^\d{1,3}$/.test(value) || +value > 150) throw new Error("อายุต้องเป็นจำนวนเต็มระหว่าง 0–150 ปี");
    return +value;
  };
  const date = (key: string) => {
    const value = p.get(key) ?? "";
    const parsed = new Date(value + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("กรุณาระบุวันที่ให้ถูกต้อง");
    return value;
  };
  const mode = p.get("mode");
  if (mode !== "all" && mode !== "pdx") throw new Error("ขอบเขตการค้นหารหัสโรคไม่ถูกต้อง");
  const diag_text = (p.get("diag_text") ?? "").trim();
  if (diag_text.length > 200) throw new Error("ข้อความวินิจฉัยต้องไม่เกิน 200 ตัวอักษร");
  const f = { icd_from: code("icd_from"), icd_to: code("icd_to"), age_from: age("age_from"), age_to: age("age_to"), date_from: date("date_from"), date_to: date("date_to"), mode, diag_text };
  if (f.icd_from > f.icd_to) [f.icd_from, f.icd_to] = [f.icd_to, f.icd_from];
  if (f.age_from > f.age_to || f.date_from > f.date_to) throw new Error("ค่าเริ่มต้นต้องไม่มากกว่าค่าสิ้นสุด");
  return f as IcdFilters;
}

export function icdQuery(f: IcdFilters) {
  const columns = f.mode === "pdx" ? ["pdx"] : ["pdx", "dx0", "dx1", "dx2", "dx3", "dx4", "dx5"];
  const predicate = columns.map(c => `UPPER(REPLACE(v.${c}, '.', '')) BETWEEN ? AND ?`).join(" OR ");
  // Treat wildcard characters as literal text; bind the pattern as a SQL parameter.
  const diagPattern = f.diag_text ? `%${f.diag_text.replace(/[!%_]/g, "!$&")}%` : null;
  return {
    sql: `SELECT v.vn, v.hn, DATE_FORMAT(v.vstdate, '%Y-%m-%d') AS vstdate, v.age_y,
      CONCAT_WS(' ', p.pname, p.fname, p.lname) AS ptname, v.pdx,
      COALESCE(NULLIF(i.tname, ''), i.name, '') AS dname,
      CONCAT_WS(', ', NULLIF(v.pdx,''), NULLIF(v.dx0,''), NULLIF(v.dx1,''), NULLIF(v.dx2,''), NULLIF(v.dx3,''), NULLIF(v.dx4,''), NULLIF(v.dx5,'')) AS dxlist,
      COALESCE(o.diag_text, '') AS diag_text
      FROM vn_stat v
      LEFT JOIN patient p ON p.hn = v.hn
      LEFT JOIN ovst o ON o.vn = v.vn
      LEFT JOIN icd101 i ON i.code = v.pdx
      WHERE v.vstdate BETWEEN ? AND ? AND v.age_y BETWEEN ? AND ? AND (${predicate})${diagPattern ? " AND LOWER(COALESCE(o.diag_text, '')) LIKE LOWER(?) ESCAPE '!'" : ""}
      ORDER BY v.vstdate DESC, v.vn DESC LIMIT ${ICD10_LIMIT + 1}`,
    values: [f.date_from, f.date_to, f.age_from, f.age_to, ...columns.flatMap(() => [f.icd_from, f.icd_to.padEnd(7, "Z")]), ...(diagPattern ? [diagPattern] : [])],
  };
}

export function summarizeIcd(input: IcdVisit[]) {
  const visits = [...new Map(input.map(r => [String(r.vn), r])).values()];
  visits.sort((a, b) => b.vstdate.localeCompare(a.vstdate) || String(b.vn).localeCompare(String(a.vn)));
  const patients = new Map<string, IcdVisit>();
  const months = new Map<string, number>();
  const top = new Map<string, { code: string; dname: string; c: number }>();
  for (const r of visits) {
    if (r.hn && !patients.has(String(r.hn))) patients.set(String(r.hn), r);
    const ym = r.vstdate.slice(0, 7);
    months.set(ym, (months.get(ym) ?? 0) + 1);
    if (r.pdx) {
      const entry = top.get(r.pdx) ?? { code: r.pdx, dname: r.dname, c: 0 };
      entry.c++; top.set(r.pdx, entry);
    }
  }
  const rows = [...patients.values()];
  const groups = ["0–4", "5–14", "15–24", "25–44", "45–59", "60 ขึ้นไป"];
  const by_age = groups.map(grp => ({ grp, c: 0 }));
  let totalAge = 0, knownAge = 0;
  for (const r of rows) {
    if (r.age_y == null || !Number.isFinite(Number(r.age_y))) continue;
    const age = Number(r.age_y);
    totalAge += age; knownAge++;
    by_age[age < 5 ? 0 : age < 15 ? 1 : age < 25 ? 2 : age < 45 ? 3 : age < 60 ? 4 : 5].c++;
  }
  return { rows, summary: { visits: visits.length, patients: rows.length, avg_age: knownAge ? Number((totalAge / knownAge).toFixed(1)) : null },
    by_month: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([ym, c]) => ({ ym, c })), by_age,
    top_dx: [...top.values()].sort((a, b) => b.c - a.c || a.code.localeCompare(b.code)).slice(0, 10) };
}

export function icdCsv(rows: IcdVisit[]) {
  const quote = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return "\uFEFF" + [["VN", "HN", "วันที่", "อายุ", "ชื่อ-สกุล", "PDx", "ชื่อโรคหลัก", "รหัสโรคทั้งหมด", "ข้อความวินิจฉัย (diag_text)"],
    ...rows.map(r => [r.vn, r.hn, r.vstdate, r.age_y, r.ptname, r.pdx, r.dname, r.dxlist, r.diag_text])].map(r => r.map(quote).join(",")).join("\r\n");
}
