// lib/diagtext-dashboard.ts
// Dashboard diagtext — ข้อความวินิจฉัยที่แพทย์พิมพ์เอง (ovst_doctor_diag.diag_text)
// ใช้แหล่งเดียวกับรายงาน incomplete-visit: ตารางนี้คือสิ่งที่หมอลงในหน้าจอแพทย์
//
// ไฟล์นี้ pure TypeScript (ไม่มี db) → เทสต์ด้วย node --test ได้
// route เป็นคนยิง SQL แล้วส่งแถวดิบมาให้ฟังก์ชัน summarize* รวมยอด

export const DIAGTEXT_TITLE = "Dashboard ข้อความวินิจฉัย (diagtext)";
export const DIAGTEXT_TOP = 50; // เก็บอันดับต่อช่วงไว้เท่านี้ หน้าเว็บแสดง 10 แล้วกดดูเพิ่ม
export const DAY_LIMIT = 20000;

// ── ผู้ลง diagtext ───────────────────────────────────────────────────────────
// HOSxP แต่ละเวอร์ชันตั้งชื่อคอลัมน์ผู้ลงใน ovst_doctor_diag ไม่เหมือนกัน
// route อ่าน information_schema แล้วเลือกคอลัมน์แรกที่มีจากรายการนี้
// (ชื่อคอลัมน์จึงมาจาก whitelist นี้เท่านั้น ไม่เคยมาจากผู้ใช้)
// ไม่มีสักคอลัมน์ → ถอยไปใช้แพทย์ของโรคหลัก (ovstdiag.diagtype = '1')
export const PERSON_COLUMNS = [
  { column: "doctor_code", lookup: "doctor" },
  { column: "doctor", lookup: "doctor" },
  { column: "staff", lookup: "opduser" },
  { column: "entry_staff", lookup: "opduser" },
] as const;

export type PersonSource =
  | { kind: "column"; column: (typeof PERSON_COLUMNS)[number]["column"]; lookup: "doctor" | "opduser" }
  | { kind: "ovstdiag" };

export function pickPersonSource(columns: string[]): PersonSource {
  const have = new Set(columns.map((c) => c.toLowerCase()));
  const found = PERSON_COLUMNS.find((c) => have.has(c.column));
  return found ? { kind: "column", column: found.column, lookup: found.lookup } : { kind: "ovstdiag" };
}

export function personSourceLabel(s: PersonSource) {
  return s.kind === "column" ? `ovst_doctor_diag.${s.column}` : "แพทย์โรคหลัก (ovstdiag.doctor)";
}

/** JOIN + นิพจน์ code/name ของผู้ลง — values ต้องวางก่อน values ของ WHERE */
function personSql(s: PersonSource, from: string, to: string) {
  if (s.kind === "column") {
    const col = `d.${s.column}`;
    return s.lookup === "doctor"
      ? { join: `LEFT JOIN doctor pd ON pd.code = ${col}`, code: col, name: "pd.name", values: [] as string[] }
      : { join: `LEFT JOIN opduser pd ON pd.loginname = ${col}`, code: col, name: "pd.name", values: [] as string[] };
  }
  return {
    join: `LEFT JOIN (SELECT x.vn, MIN(x.doctor) AS doctor FROM ovstdiag x
        WHERE x.diagtype = '1' AND x.vn IN (SELECT vn FROM ovst WHERE vstdate BETWEEN ? AND ?) GROUP BY x.vn) px ON px.vn = d.vn
      LEFT JOIN doctor pd ON pd.code = px.doctor`,
    code: "px.doctor",
    name: "pd.name",
    values: [from, to],
  };
}

const HAS_TEXT = "d.diag_text IS NOT NULL AND TRIM(d.diag_text) <> ''";

// ── ช่วงเวลา: ปีงบประมาณ / ไตรมาส / เดือน ─────────────────────────────────────
// fiscalYear เป็น ค.ศ. ของปีที่สิ้นสุด (ปีงบ 2570 = 2027 → 2026-10-01..2027-09-30)
// ขอบเขตเดียวกับ reportDateRange("fiscal") ใน lib/report-period.ts — เขียนซ้ำไว้ตรงนี้
// เพราะเทสต์รันไฟล์ .ts ตรงด้วย node ซึ่ง import ข้ามไฟล์แบบไม่มีนามสกุลไม่ได้

export function fiscalRange(fy: number) {
  return { date_from: `${fy - 1}-10-01`, date_to: `${fy}-09-30` };
}

export function parseFiscalYear(value: string | null) {
  if (!value || !/^\d{4}$/.test(value)) throw new Error("กรุณาเลือกปีงบประมาณ");
  const y = Number(value);
  if (y < 2000 || y > 2100) throw new Error("ปีงบประมาณไม่ถูกต้อง");
  return y;
}

export function parseDay(value: string | null) {
  const v = value ?? "";
  const parsed = new Date(v + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== v)
    throw new Error("กรุณาระบุวันที่ให้ถูกต้อง");
  return v;
}

export function fiscalMonths(fy: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((i + 9) % 12) + 1; // ต.ค. → ก.ย.
    const y = m >= 10 ? fy - 1 : fy;
    return `${y}-${String(m).padStart(2, "0")}`;
  });
}

/** ไตรมาสของปีงบ: 1 = ต.ค.–ธ.ค., 2 = ม.ค.–มี.ค., 3 = เม.ย.–มิ.ย., 4 = ก.ค.–ก.ย. */
export function fiscalQuarter(ym: string) {
  const m = Number(ym.slice(5, 7));
  return m >= 10 ? 1 : Math.ceil(m / 3) + 1;
}

export const QUARTER_LABELS = ["ต.ค.–ธ.ค.", "ม.ค.–มี.ค.", "เม.ย.–มิ.ย.", "ก.ค.–ก.ย."];

// ── ทำความสะอาดข้อความ ───────────────────────────────────────────────────────
// ช่องเดียวอาจพิมพ์หลายบรรทัด เช่น "1. HT\n2. DM" → นับ "HT" กับ "DM" แยกกัน
// ตัดเลขข้อ/ขีดนำหน้า ช่องว่างซ้ำ และเครื่องหมายท้าย แล้วเทียบแบบไม่สนตัวพิมพ์
// บรรทัดที่ไม่มีตัวอักษรเลย ("-", ".", "NULL") ไม่นับ

export function splitDiagText(text: unknown): { key: string; label: string }[] {
  const out = new Map<string, string>();
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const label = raw
      .replace(/^\s*(?:\(?\d{1,2}[.)](?!\d)|[-•*·])\s*/, "")
      .replace(/\s+/g, " ")
      .replace(/[\s.,;:]+$/, "")
      .trim();
    const key = label.toLowerCase();
    if (!/\p{L}/u.test(label) || key === "null") continue;
    if (!out.has(key)) out.set(key, label);
  }
  return [...out].map(([key, label]) => ({ key, label }));
}

// ── SQL ──────────────────────────────────────────────────────────────────────
// รวมยอดใน MySQL ก่อน (เดือน × ข้อความ) เพื่อไม่ต้องลากทุกแถวของทั้งปีงบมาที่ Node

export function yearQueries(fy: number, person: PersonSource) {
  const { date_from: from, date_to: to } = fiscalRange(fy);
  const p = personSql(person, from, to);
  return {
    from,
    to,
    texts: {
      sql: `SELECT DATE_FORMAT(o.vstdate, '%Y-%m') AS ym, TRIM(d.diag_text) AS diag_text, COUNT(DISTINCT d.vn) AS visits
        FROM ovst_doctor_diag d
        JOIN ovst o ON o.vn = d.vn
        WHERE o.vstdate BETWEEN ? AND ? AND ${HAS_TEXT}
        GROUP BY DATE_FORMAT(o.vstdate, '%Y-%m'), TRIM(d.diag_text)`,
      values: [from, to],
    },
    persons: {
      sql: `SELECT DATE_FORMAT(o.vstdate, '%Y-%m') AS ym, ${p.code} AS code, MAX(${p.name}) AS name,
          COUNT(*) AS entries, COUNT(DISTINCT d.vn) AS visits
        FROM ovst_doctor_diag d
        JOIN ovst o ON o.vn = d.vn
        ${p.join}
        WHERE o.vstdate BETWEEN ? AND ? AND ${HAS_TEXT}
        GROUP BY DATE_FORMAT(o.vstdate, '%Y-%m'), ${p.code}`,
      values: [...p.values, from, to],
    },
    opdByDay: {
      sql: `SELECT DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS date, COUNT(*) AS c
        FROM ovst o WHERE o.vstdate BETWEEN ? AND ? GROUP BY o.vstdate`,
      values: [from, to],
    },
    diagByDay: {
      sql: `SELECT DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS date, COUNT(DISTINCT d.vn) AS c
        FROM ovst_doctor_diag d
        JOIN ovst o ON o.vn = d.vn
        WHERE o.vstdate BETWEEN ? AND ? AND ${HAS_TEXT}
        GROUP BY o.vstdate`,
      values: [from, to],
    },
  };
}

export function dayQueries(date: string, person: PersonSource) {
  const p = personSql(person, date, date);
  return {
    rows: {
      sql: `SELECT d.vn, o.hn, TIME_FORMAT(o.vsttime, '%H:%i') AS vsttime,
          COALESCE(k.department, '') AS department, TRIM(d.diag_text) AS diag_text,
          ${p.code} AS person_code, ${p.name} AS person_name
        FROM ovst_doctor_diag d
        JOIN ovst o ON o.vn = d.vn
        LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
        ${p.join}
        WHERE o.vstdate = ? AND ${HAS_TEXT}
        ORDER BY o.vsttime, d.vn
        LIMIT ${DAY_LIMIT + 1}`,
      values: [...p.values, date],
    },
    opd: { sql: `SELECT COUNT(*) AS c FROM ovst o WHERE o.vstdate = ?`, values: [date] },
  };
}

// ── รวมยอด ───────────────────────────────────────────────────────────────────

export type TextRow = { ym: string; diag_text: string | null; visits: number | string };
export type PersonRow = { ym: string; code: string | null; name: string | null; entries: number | string; visits: number | string };
export type CountRow = { date: string; c: number | string };
export type DayRow = { vn: string; hn: string; vsttime: string | null; department: string | null; diag_text: string | null; person_code: string | null; person_name: string | null };

export type TopText = { text: string; visits: number };
export type PersonRank = { code: string; name: string; entries: number; visits: number };
export type Bucket = {
  key: string; // "FY" | "Q1".."Q4" | "YYYY-MM"
  from: string;
  to: string;
  opd_visits: number;
  diag_visits: number;
  entries: number;
  distinct_texts: number;
  top: TopText[];
  persons: PersonRank[];
};

const UNKNOWN_PERSON = "ไม่ระบุผู้ลง";

/** มากไปน้อยตามรายการที่ลง → ครั้งรับบริการ; เสมอกันให้ "ไม่ระบุผู้ลง" อยู่ท้าย */
const byRank = (a: PersonRank, b: PersonRank) =>
  b.entries - a.entries || b.visits - a.visits || Number(!a.code) - Number(!b.code) || a.name.localeCompare(b.name);

/** ตัวนับข้อความ: นับครั้งต่อ key และจำรูปเขียนที่เจอบ่อยสุดไว้แสดง */
class TextCounter {
  private counts = new Map<string, { visits: number; labels: Map<string, number> }>();
  add(key: string, label: string, n: number) {
    const e = this.counts.get(key) ?? { visits: 0, labels: new Map() };
    e.visits += n;
    e.labels.set(label, (e.labels.get(label) ?? 0) + n);
    this.counts.set(key, e);
  }
  get size() {
    return this.counts.size;
  }
  top(limit: number): TopText[] {
    return [...this.counts.values()]
      .map((e) => ({
        // เสมอกัน → เลือกรูปที่มีตัวพิมพ์ใหญ่ก่อน (HT มากกว่า ht) ให้ผลคงที่ทุกครั้ง
        text: [...e.labels].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0][0],
        visits: e.visits,
      }))
      .sort((a, b) => b.visits - a.visits || a.text.localeCompare(b.text))
      .slice(0, limit);
  }
}

class PersonCounter {
  private map = new Map<string, PersonRank>();
  add(code: string | null, name: string | null, entries: number, visits: number) {
    const c = String(code ?? "").trim();
    const e = this.map.get(c) ?? { code: c, name: String(name ?? "").trim() || (c ? c : UNKNOWN_PERSON), entries: 0, visits: 0 };
    e.entries += entries;
    e.visits += visits;
    this.map.set(c, e);
  }
  list(): PersonRank[] {
    return [...this.map.values()].sort(byRank);
  }
}

const lastDay = (ym: string) => `${ym}-${new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate()}`;

export function summarizeYear(fy: number, texts: TextRow[], persons: PersonRow[], opdByDay: CountRow[], diagByDay: CountRow[]) {
  const months = fiscalMonths(fy);
  const { date_from, date_to } = fiscalRange(fy);
  const keysOf = (ym: string) => ["FY", `Q${fiscalQuarter(ym)}`, ym];
  const ranges = new Map<string, { from: string; to: string }>([["FY", { from: date_from, to: date_to }]]);
  for (let q = 1; q <= 4; q++) ranges.set(`Q${q}`, { from: `${months[(q - 1) * 3]}-01`, to: lastDay(months[q * 3 - 1]) });
  for (const ym of months) ranges.set(ym, { from: `${ym}-01`, to: lastDay(ym) });

  const acc = new Map([...ranges.keys()].map((k) => [k, { opd: 0, diag: 0, entries: 0, texts: new TextCounter(), persons: new PersonCounter() }]));
  const inYear = (ym: string) => acc.has(ym);

  for (const r of texts) {
    if (!inYear(r.ym)) continue;
    const n = Number(r.visits) || 0;
    for (const t of splitDiagText(r.diag_text)) for (const k of keysOf(r.ym)) acc.get(k)!.texts.add(t.key, t.label, n);
  }
  for (const r of persons) {
    if (!inYear(r.ym)) continue;
    for (const k of keysOf(r.ym)) {
      const a = acc.get(k)!;
      a.entries += Number(r.entries) || 0;
      a.persons.add(r.code, r.name, Number(r.entries) || 0, Number(r.visits) || 0);
    }
  }
  const days = new Map<string, { opd: number; diag: number }>();
  const day = (d: string) => days.get(d) ?? days.set(d, { opd: 0, diag: 0 }).get(d)!;
  for (const r of opdByDay) day(r.date).opd += Number(r.c) || 0;
  for (const r of diagByDay) day(r.date).diag += Number(r.c) || 0;
  const by_day = [...days].filter(([d]) => inYear(d.slice(0, 7))).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));
  for (const d of by_day) for (const k of keysOf(d.date.slice(0, 7))) {
    acc.get(k)!.opd += d.opd;
    acc.get(k)!.diag += d.diag;
  }

  const bucket = (key: string): Bucket => {
    const a = acc.get(key)!;
    return { key, ...ranges.get(key)!, opd_visits: a.opd, diag_visits: a.diag, entries: a.entries, distinct_texts: a.texts.size, top: a.texts.top(DIAGTEXT_TOP), persons: a.persons.list() };
  };
  return {
    year: bucket("FY"),
    quarters: [1, 2, 3, 4].map((q) => bucket(`Q${q}`)),
    months: months.map(bucket),
    by_day,
  };
}

export type DayVisit = { vn: string; hn: string; vsttime: string; department: string; texts: string[]; persons: string[] };

export function summarizeDay(date: string, rows: DayRow[], opdVisits: number) {
  const texts = new Map<string, { label: string; vns: Set<string> }>();
  const persons = new Map<string, { code: string; name: string; entries: number; vns: Set<string> }>();
  const visits = new Map<string, DayVisit>();
  for (const r of rows) {
    const vn = String(r.vn);
    const parts = splitDiagText(r.diag_text);
    if (!parts.length) continue;
    const v = visits.get(vn) ?? { vn, hn: String(r.hn ?? ""), vsttime: r.vsttime ?? "", department: r.department ?? "", texts: [], persons: [] };
    for (const t of parts) {
      const e = texts.get(t.key) ?? { label: t.label, vns: new Set() };
      e.vns.add(vn);
      texts.set(t.key, e);
      if (!v.texts.some((x) => x.toLowerCase() === t.key)) v.texts.push(t.label);
    }
    const code = String(r.person_code ?? "").trim();
    const name = String(r.person_name ?? "").trim() || code || UNKNOWN_PERSON;
    const p = persons.get(code) ?? { code, name, entries: 0, vns: new Set() };
    p.entries++;
    p.vns.add(vn);
    persons.set(code, p);
    if (!v.persons.includes(name)) v.persons.push(name);
    visits.set(vn, v);
  }
  const top = [...texts.values()]
    .map((e) => ({ text: e.label, visits: e.vns.size }))
    .sort((a, b) => b.visits - a.visits || a.text.localeCompare(b.text));
  const list = [...persons.values()]
    .map(({ vns, ...p }) => ({ ...p, visits: vns.size }))
    .sort(byRank);
  return {
    date,
    opd_visits: opdVisits,
    diag_visits: visits.size,
    entries: list.reduce((s, p) => s + p.entries, 0),
    distinct_texts: top.length,
    top: top.slice(0, DIAGTEXT_TOP),
    persons: list,
    visits: [...visits.values()],
  };
}

export type YearSummary = ReturnType<typeof summarizeYear>;
export type DaySummary = ReturnType<typeof summarizeDay>;

// ── CSV ──────────────────────────────────────────────────────────────────────

const quote = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};

export function diagtextCsv(title: string, top: TopText[], persons: PersonRank[]) {
  const lines = [
    [title],
    [],
    ["อันดับ", "ข้อความวินิจฉัย (diagtext)", "ครั้งรับบริการ"],
    ...top.map((t, i) => [i + 1, t.text, t.visits]),
    [],
    ["อันดับ", "ผู้ลง diagtext", "รหัส", "จำนวนรายการที่ลง", "ครั้งรับบริการ"],
    ...persons.map((p, i) => [i + 1, p.name, p.code, p.entries, p.visits]),
  ];
  return "﻿" + lines.map((r) => r.map(quote).join(",")).join("\r\n");
}
