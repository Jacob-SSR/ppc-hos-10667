"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Download, LoaderCircle, MessageSquareText, Printer, RefreshCw, Trophy } from "lucide-react";
import { QUARTER_LABELS, diagtextCsv, type Bucket, type DaySummary, type PersonRank, type TopText, type YearSummary } from "@/lib/diagtext-dashboard";
import { currentReportYear } from "@/lib/report-period";
import styles from "./diagtext.module.css";

type YearResult = YearSummary & { fiscal_year: number; person_source: string };
type DayResult = DaySummary & { person_source: string; truncated: boolean };
type Scope = "year" | "quarter" | "month" | "day";

const nf = (n: number) => n.toLocaleString("th-TH");
const pct = (part: number, whole: number) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : "—");
const monthLabel = (ym: string, style: "short" | "long" = "short") =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("th-TH", { month: style, year: style === "long" ? "numeric" : "2-digit" });
const dateLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
const shiftDay = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const clampDay = (date: string, from: string, to: string) => (date < from ? from : date > to ? to : date);
const fyRange = (fy: number) => ({ from: `${fy - 1}-10-01`, to: `${fy}-09-30` });
const chartTooltip = { background: "var(--report-surface)", border: "1px solid var(--report-line)", borderRadius: 12, color: "var(--report-ink)", fontSize: 13 };

function useJson<T>(url: string | null) {
  const [state, setState] = useState<{ url: string | null; data: T | null; error: string }>({ url: null, data: null, error: "" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
        setState({ url, data, error: "" });
      } catch (e) {
        if (!controller.signal.aborted) setState({ url, data: null, error: e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ" });
      }
    })();
    return () => controller.abort();
  }, [url, revision]);
  const current = state.url === url;
  return { data: current ? state.data : null, error: current ? state.error : "", loading: !!url && !current, reload: () => { setState(s => ({ ...s, url: null })); setRevision(r => r + 1); } };
}

export default function DiagtextDashboardPage() {
  const latestFy = currentReportYear("fiscal").year;
  const [fy, setFy] = useState(latestFy);
  const [scope, setScope] = useState<Scope>("year");
  const [quarter, setQuarter] = useState(1);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [day, setDay] = useState(() => today());
  const range = fyRange(fy);

  const year = useJson<YearResult>(`/api/diagtext-dashboard?fy=${fy}`);
  const dayData = useJson<DayResult>(scope === "day" ? `/api/diagtext-dashboard/day?date=${day}` : null);

  function chooseFy(next: number) {
    const r = fyRange(next);
    setFy(next);
    setDay(d => clampDay(d, r.from, r.to));
    setMonth(m => clampDay(`${m}-01`, r.from, r.to).slice(0, 7));
  }
  function openMonth(ym: string) { setMonth(ym); setScope("month"); }
  function openDay(date: string) { setDay(date); setScope("day"); }

  const bucket: Bucket | null = useMemo(() => {
    const y = year.data;
    if (!y) return null;
    if (scope === "quarter") return y.quarters[quarter - 1];
    if (scope === "month") return y.months.find(m => m.key === month) ?? null;
    return y.year;
  }, [year.data, scope, quarter, month]);

  const view = scope === "day"
    ? dayData.data && { title: dateLabel(day), opd: dayData.data.opd_visits, diag: dayData.data.diag_visits, entries: dayData.data.entries, distinct: dayData.data.distinct_texts, top: dayData.data.top, persons: dayData.data.persons, source: dayData.data.person_source }
    : bucket && year.data && { title: scopeTitle(scope, fy, quarter, month), opd: bucket.opd_visits, diag: bucket.diag_visits, entries: bucket.entries, distinct: bucket.distinct_texts, top: bucket.top, persons: bucket.persons, source: year.data.person_source };
  const loading = scope === "day" ? dayData.loading : year.loading;
  const error = scope === "day" ? dayData.error : year.error;

  const trend = useMemo(() => {
    const y = year.data;
    if (!y || scope === "day") return [];
    if (scope === "month") {
      return y.by_day.filter(d => d.date.startsWith(month)).map(d => ({ key: d.date, label: String(Number(d.date.slice(8))), diag: d.diag, missing: Math.max(0, d.opd - d.diag) }));
    }
    const months = scope === "quarter" ? y.months.slice((quarter - 1) * 3, quarter * 3) : y.months;
    return months.map(m => ({ key: m.key, label: monthLabel(m.key), diag: m.diag_visits, missing: Math.max(0, m.opd_visits - m.diag_visits) }));
  }, [year.data, scope, quarter, month]);

  function download() {
    if (!view) return;
    const url = URL.createObjectURL(new Blob([diagtextCsv(`diagtext ${view.title}`, view.top, view.persons)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagtext_${scope === "day" ? day : scope === "month" ? month : scope === "quarter" ? `fy${fy + 543}_q${quarter}` : `fy${fy + 543}`}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className={styles.report}>
    <div className={styles.pageHeading}>
      <div>
        <div className={styles.eyebrow}>รายงานเวชระเบียน <span>/</span> diagtext</div>
        <h1>ข้อความวินิจฉัยที่ลงมากที่สุด</h1>
        <p>อันดับ diagtext รายปีงบ รายไตรมาส รายเดือน และรายวัน พร้อมอันดับผู้ลง</p>
      </div>
      <span className={styles.pageTag}><MessageSquareText size={15} aria-hidden="true" /> ovst_doctor_diag</span>
    </div>

    <section className={styles.filters} aria-label="เลือกช่วงเวลา">
      <label className={styles.field}>ปีงบประมาณ (พ.ศ.)
        <select value={fy} onChange={e => chooseFy(Number(e.target.value))}>
          {Array.from({ length: 6 }, (_, i) => latestFy - i).map(y => <option key={y} value={y}>{y + 543}{y === latestFy ? " · ปีปัจจุบัน" : ""}</option>)}
        </select>
      </label>
      <div className={styles.scopeGroup}>
        <span className={styles.fieldLabel}>ช่วงที่ดู</span>
        <div className={styles.periodTabs} role="group" aria-label="ช่วงที่ดู">
          {([["year", "ทั้งปีงบ"], ["quarter", "รายไตรมาส"], ["month", "รายเดือน"], ["day", "รายวัน"]] as const).map(([value, label]) =>
            <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)}>{label}</button>)}
        </div>
      </div>
      {scope === "quarter" && <div className={styles.scopeGroup}>
        <span className={styles.fieldLabel}>ไตรมาส</span>
        <div className={styles.periodTabs} role="group" aria-label="ไตรมาส">
          {QUARTER_LABELS.map((label, i) => <button key={label} type="button" aria-pressed={quarter === i + 1} onClick={() => setQuarter(i + 1)}>Q{i + 1} <small>{label}</small></button>)}
        </div>
      </div>}
      {scope === "month" && <label className={styles.field}>เดือน
        <select value={month} onChange={e => setMonth(e.target.value)}>
          {(year.data?.months.map(m => m.key) ?? []).map(ym => <option key={ym} value={ym}>{monthLabel(ym, "long")}</option>)}
        </select>
      </label>}
      {scope === "day" && <div className={styles.scopeGroup}>
        <span className={styles.fieldLabel}>วันที่</span>
        <div className={styles.dayPicker}>
          <button type="button" className={styles.iconButton} aria-label="วันก่อนหน้า" disabled={day <= range.from} onClick={() => setDay(d => shiftDay(d, -1))}><ChevronLeft size={17} /></button>
          <input type="date" aria-label="วันที่" value={day} min={range.from} max={range.to} onChange={e => e.target.value && setDay(clampDay(e.target.value, range.from, range.to))} />
          <button type="button" className={styles.iconButton} aria-label="วันถัดไป" disabled={day >= range.to} onClick={() => setDay(d => shiftDay(d, 1))}><ChevronRight size={17} /></button>
          <button type="button" className={styles.textButton} onClick={() => setDay(clampDay(today(), range.from, range.to))}>วันนี้</button>
        </div>
      </div>}
    </section>

    {error && <div role="alert" className={styles.error}><AlertCircle size={19} aria-hidden="true" /><div><strong>โหลดข้อมูลไม่สำเร็จ</strong><p>{error}</p></div>
      <button type="button" className={styles.secondaryButton} onClick={scope === "day" ? dayData.reload : year.reload}><RefreshCw size={15} aria-hidden="true" /> ลองใหม่</button></div>}
    {loading && <div className={styles.loading} role="status"><LoaderCircle size={23} className={styles.spin} aria-hidden="true" /><div><strong>กำลังรวบรวม diagtext</strong><p>{scope === "day" ? "กำลังดึง visit ของวันที่เลือก" : `กำลังนับข้อความวินิจฉัยทั้งปีงบ ${fy + 543} อาจใช้เวลาสักครู่ในครั้งแรก`}</p></div></div>}

    {view && !loading && <div className={styles.results}>
      <section aria-label="สรุปผล">
        <div className={styles.resultHeading}>
          <div><span className={styles.eyebrow}>{scope === "day" ? "visit OPD รายวัน" : `ปีงบประมาณ ${fy + 543}`}</span><h2>{view.title}</h2></div>
          <div className={styles.exportActions}>
            <button className={styles.secondaryButton} disabled={!view.top.length} onClick={download}><Download size={16} aria-hidden="true" /> ส่งออก CSV</button>
            <button className={styles.iconButton} onClick={() => window.print()} aria-label="พิมพ์รายงาน"><Printer size={17} aria-hidden="true" /></button>
          </div>
        </div>
        <dl className={styles.metrics}>
          <div><dt>ครั้งรับบริการ OPD</dt><dd>{nf(view.opd)} <small>ครั้ง</small></dd><p>ทุก visit ใน ovst</p></div>
          <div><dt>ลง diagtext แล้ว</dt><dd>{nf(view.diag)} <small>ครั้ง · {pct(view.diag, view.opd)}</small></dd><p>ยังไม่ลง {nf(Math.max(0, view.opd - view.diag))} ครั้ง</p></div>
          <div><dt>ข้อความไม่ซ้ำ</dt><dd>{nf(view.distinct)} <small>ข้อความ</small></dd><p>{nf(view.entries)} รายการที่ลง</p></div>
          <div><dt>ผู้ลง diagtext</dt><dd>{nf(view.persons.length)} <small>คน</small></dd><p>{view.source}</p></div>
        </dl>
        {scope === "day" && dayData.data?.truncated && <p className={styles.help}>วันนี้มีรายการเกิน 20,000 แถว แสดงเฉพาะส่วนแรก</p>}
      </section>

      {view.diag > 0 ? <div className={styles.columns}>
        <TopTextPanel top={view.top} total={view.diag} />
        <PersonPanel persons={view.persons} total={view.entries} />
      </div> : <div className={styles.noResults} role="status"><MessageSquareText size={26} aria-hidden="true" /><h2>ยังไม่มี diagtext ในช่วงนี้</h2><p>{view.opd ? `มี visit ${nf(view.opd)} ครั้ง แต่ยังไม่มีข้อความวินิจฉัยที่แพทย์ลง` : "ไม่พบ visit ในช่วงที่เลือก"}</p></div>}

      {trend.length > 0 && <section className={styles.chartPanel}>
        <div className={styles.panelHeading}><h2>{scope === "month" ? "รายวันในเดือนนี้" : "รายเดือน"}</h2><span>{scope === "month" ? "กดแท่งเพื่อดู visit ของวันนั้น" : "กดแท่งเพื่อดูรายเดือน"}</span></div>
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 16, right: 8, bottom: 0, left: -12 }} onClick={(e) => {
              const key = trend[Number(e?.activeTooltipIndex)]?.key;
              if (key) { if (scope === "month") openDay(key); else openMonth(key); }
            }}>
              <CartesianGrid stroke="var(--report-line)" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--report-muted)" }} dy={8} interval="preserveStartEnd" minTickGap={6} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--report-muted)" }} tickFormatter={nf} />
              <Tooltip cursor={{ fill: "var(--report-soft)" }} contentStyle={chartTooltip} formatter={(v) => nf(Number(v))}
                labelFormatter={(_, payload) => { const key = payload?.[0]?.payload?.key as string | undefined; return key ? (key.length > 7 ? dateLabel(key) : monthLabel(key, "long")) : ""; }} />
              <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "var(--report-muted)", paddingTop: 8 }} />
              <Bar name="ลง diagtext แล้ว" dataKey="diag" stackId="v" fill="var(--report-accent)" stroke="var(--report-surface)" strokeWidth={1} maxBarSize={38} isAnimationActive={false} cursor="pointer" />
              <Bar name="ยังไม่ลง" dataKey="missing" stackId="v" fill="var(--report-secondary)" stroke="var(--report-surface)" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={38} isAnimationActive={false} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>}

      {scope !== "day" && year.data && <LeaderTable year={year.data} onYear={() => setScope("year")} onQuarter={q => { setQuarter(q); setScope("quarter"); }} onMonth={openMonth} />}

      {scope === "day" && dayData.data && dayData.data.visits.length > 0 && <VisitTable key={day} visits={dayData.data.visits} />}
    </div>}
  </div>;
}

function scopeTitle(scope: Scope, fy: number, quarter: number, month: string) {
  if (scope === "quarter") return `ไตรมาส ${quarter} (${QUARTER_LABELS[quarter - 1]})`;
  if (scope === "month") return monthLabel(month, "long");
  return `ทั้งปีงบ (1 ต.ค. ${fy + 542} – 30 ก.ย. ${fy + 543})`;
}

function TopTextPanel({ top, total }: { top: TopText[]; total: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? top : top.slice(0, 10);
  const max = top[0]?.visits || 1;
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><h2><Trophy size={16} aria-hidden="true" /> diagtext ที่ลงมากที่สุด</h2><span>นับครั้งรับบริการ (VN)</span></div>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="ตารางอันดับ diagtext">
      <table><thead><tr><th scope="col">อันดับ</th><th scope="col">ข้อความวินิจฉัย</th><th scope="col" className={styles.numeric}>ครั้ง</th><th scope="col" className={styles.numeric}>สัดส่วน</th></tr></thead>
        <tbody>{shown.map((t, i) => <tr key={t.text}>
          <td className={styles.rank}>{String(i + 1).padStart(2, "0")}</td>
          <td><span className={styles.textCell}>{t.text}</span><span className={styles.meter} aria-hidden="true"><i style={{ width: `${(t.visits / max) * 100}%` }} /></span></td>
          <td className={styles.numeric}>{nf(t.visits)}</td>
          <td className={styles.numeric}>{pct(t.visits, total)}</td>
        </tr>)}</tbody></table>
    </div>
    {top.length > 10 && <button type="button" className={styles.moreButton} onClick={() => setAll(a => !a)}>{all ? "แสดง 10 อันดับ" : `แสดง ${top.length} อันดับ`}</button>}
  </section>;
}

function PersonPanel({ persons, total }: { persons: PersonRank[]; total: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? persons : persons.slice(0, 10);
  const max = persons[0]?.entries || 1;
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><h2><Trophy size={16} aria-hidden="true" /> อันดับผู้ลง diagtext</h2><span>เรียงตามจำนวนรายการที่ลง</span></div>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="ตารางอันดับผู้ลง diagtext">
      <table><thead><tr><th scope="col">อันดับ</th><th scope="col">ผู้ลง</th><th scope="col" className={styles.numeric}>รายการ</th><th scope="col" className={styles.numeric}>ครั้ง (VN)</th><th scope="col" className={styles.numeric}>สัดส่วน</th></tr></thead>
        <tbody>{shown.map((p, i) => <tr key={p.code || "-"}>
          <td className={styles.rank}>{String(i + 1).padStart(2, "0")}</td>
          <td><span className={styles.textCell}>{p.name}</span>{p.code && p.code !== p.name && <small className={styles.sub}>รหัส {p.code}</small>}<span className={styles.meter} aria-hidden="true"><i style={{ width: `${(p.entries / max) * 100}%` }} /></span></td>
          <td className={styles.numeric}>{nf(p.entries)}</td>
          <td className={styles.numeric}>{nf(p.visits)}</td>
          <td className={styles.numeric}>{pct(p.entries, total)}</td>
        </tr>)}</tbody></table>
    </div>
    {persons.length > 10 && <button type="button" className={styles.moreButton} onClick={() => setAll(a => !a)}>{all ? "แสดง 10 อันดับ" : `แสดงทั้งหมด ${persons.length} คน`}</button>}
  </section>;
}

function LeaderTable({ year, onYear, onQuarter, onMonth }: { year: YearResult; onYear: () => void; onQuarter: (q: number) => void; onMonth: (ym: string) => void }) {
  const rows: { key: string; label: string; b: Bucket; open: () => void; strong?: boolean }[] = [
    { key: "FY", label: `ทั้งปีงบ ${year.fiscal_year + 543}`, b: year.year, open: onYear, strong: true },
    ...year.quarters.flatMap((q, qi) => [
      { key: q.key, label: `ไตรมาส ${qi + 1} (${QUARTER_LABELS[qi]})`, b: q, open: () => onQuarter(qi + 1), strong: true },
      ...year.months.slice(qi * 3, qi * 3 + 3).map(m => ({ key: m.key, label: monthLabel(m.key, "long"), b: m, open: () => onMonth(m.key) })),
    ]),
  ];
  const cell = (t?: TopText) => t ? <><span className={styles.textCell}>{t.text}</span><small className={styles.sub}>{nf(t.visits)} ครั้ง</small></> : <span className={styles.sub}>—</span>;
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><h2>diagtext อันดับ 1–3 ของแต่ละเดือนและไตรมาส</h2><span>กดแถวเพื่อดูรายละเอียด</span></div>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="ตาราง diagtext อันดับต้นของแต่ละช่วง">
      <table className={styles.leaderTable}><thead><tr><th scope="col">ช่วง</th><th scope="col">อันดับ 1</th><th scope="col">อันดับ 2</th><th scope="col">อันดับ 3</th><th scope="col" className={styles.numeric}>ลง / OPD</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.key} className={r.strong ? styles.groupRow : styles.clickRow} onClick={r.open} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") r.open(); }}>
          <th scope="row">{r.label}</th>
          <td>{cell(r.b.top[0])}</td><td>{cell(r.b.top[1])}</td><td>{cell(r.b.top[2])}</td>
          <td className={styles.numeric}>{nf(r.b.diag_visits)} / {nf(r.b.opd_visits)}<small className={styles.sub}>{pct(r.b.diag_visits, r.b.opd_visits)}</small></td>
        </tr>)}</tbody></table>
    </div>
  </section>;
}

const PAGE_SIZE = 50;

function VisitTable({ visits }: { visits: DayResult["visits"] }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(visits.length / PAGE_SIZE));
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><h2><CalendarDays size={16} aria-hidden="true" /> visit ที่ลง diagtext <span className={styles.count}>{nf(visits.length)} ครั้ง</span></h2><span>เรียงตามเวลามา</span></div>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="ตาราง visit ของวันที่เลือก">
      <table className={styles.visitTable}><thead><tr><th scope="col">เวลา</th><th scope="col">VN / HN</th><th scope="col">แผนก</th><th scope="col">ข้อความวินิจฉัย</th><th scope="col">ผู้ลง</th></tr></thead>
        <tbody>{visits.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(v => <tr key={v.vn}>
          <td className={styles.numeric}>{v.vsttime || "—"}</td>
          <td><span className={styles.textCell}>{v.vn}</span><small className={styles.sub}>HN {v.hn}</small></td>
          <td>{v.department || "—"}</td>
          <td className={styles.diagnosis}>{v.texts.join("\n")}</td>
          <td>{v.persons.join(", ")}</td>
        </tr>)}</tbody></table>
    </div>
    {pages > 1 && <div className={styles.pagination}><span>แสดง {nf((page - 1) * PAGE_SIZE + 1)}–{nf(Math.min(page * PAGE_SIZE, visits.length))} จาก {nf(visits.length)}</span><div>
      <button className={styles.iconButton} disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="หน้าก่อนหน้า"><ChevronLeft size={17} /></button>
      <span aria-live="polite">หน้า <b>{page}</b> / {pages}</span>
      <button className={styles.iconButton} disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label="หน้าถัดไป"><ChevronRight size={17} /></button>
    </div></div>}
  </section>;
}
