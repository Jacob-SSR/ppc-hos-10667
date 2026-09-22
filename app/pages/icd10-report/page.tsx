"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Download, FileSearch, ListFilter, LoaderCircle, Printer, RotateCcw, Search, SlidersHorizontal, X, AlertCircle } from "lucide-react";
import { icdCsv, parseIcdFilters, type IcdFilters, type summarizeIcd } from "@/lib/icd10-report";
import { currentReportYear, reportDateRange, type ReportPeriod } from "@/lib/report-period";
import type { IcdDisease } from "@/lib/icd-disease-search";
import DiseaseSearch from "./DiseaseSearch";
import IcdCodeName from "./IcdCodeName";
import styles from "./report.module.css";

type Result = ReturnType<typeof summarizeIcd> & { meta: IcdFilters };
const groups = [
  ["A00-B99", "โรคติดเชื้อและปรสิต"], ["C00-D48", "เนื้องอก / มะเร็ง"], ["D50-D89", "โรคเลือด"],
  ["E00-E90", "ต่อมไร้ท่อ โภชนาการ และเมตาบอลิก"], ["F00-F99", "จิตเวชและพฤติกรรม"], ["G00-G99", "ระบบประสาท"],
  ["H00-H59", "ตาและอวัยวะเคียงตา"], ["H60-H95", "หูและปุ่มกกหู"], ["I00-I99", "ระบบไหลเวียนโลหิต"],
  ["J00-J99", "ระบบหายใจ"], ["K00-K93", "ระบบย่อยอาหาร"], ["L00-L99", "ผิวหนัง"],
  ["M00-M99", "กล้ามเนื้อ กระดูก และเนื้อเยื่อเกี่ยวพัน"], ["N00-N99", "ระบบสืบพันธุ์และทางเดินปัสสาวะ"],
  ["O00-O99", "การตั้งครรภ์ คลอด และหลังคลอด"], ["P00-P96", "ภาวะระยะปริกำเนิด"], ["Q00-Q99", "ความพิการแต่กำเนิด"],
  ["R00-R99", "อาการและสิ่งผิดปกติ"], ["S00-T98", "การบาดเจ็บและเป็นพิษ"], ["V01-Y98", "สาเหตุภายนอก"],
  ["Z00-Z99", "ปัจจัยที่มีผลต่อสุขภาพ"], ["U00-U99", "รหัสเพื่อวัตถุประสงค์พิเศษ"],
];
const initial = { icd_from: "A00", icd_to: "A99", age_from: "1", age_to: "100", ...reportDateRange("year", currentReportYear("year").year, 1), mode: "all", diag_text: "" };
const nf = (n: number) => n.toLocaleString("th-TH");
const dateLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
const PAGE_SIZE = 50;

export default function Icd10ReportPage() {
  const [filters, setFilters] = useState(initial);
  const [searchVersion, setSearchVersion] = useState(0);
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const diseaseQuery = fromQuery.trim() || toQuery.trim();
  const [fromDisease, setFromDisease] = useState<IcdDisease | null>(null);
  const [toDisease, setToDisease] = useState<IcdDisease | null>(null);
  const [explicitEnd, setExplicitEnd] = useState(false);
  function clearDiseaseSelections() {
    setFromQuery(""); setToQuery(""); setFromDisease(null); setToDisease(null); setExplicitEnd(false); setSearchVersion(v => v + 1);
  }
  const [period, setPeriod] = useState<ReportPeriod>("year");
  const [periodYear, setPeriodYear] = useState(() => currentReportYear("year").year);
  const [periodMonth, setPeriodMonth] = useState(() => currentReportYear("month").month);
  const latestYear = currentReportYear(period).year;
  const [request, setRequest] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/icd10-report?${request}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
        if (!controller.signal.aborted) setResult(data);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [request, revision]);
  const update = (key: keyof typeof initial, value: string) => setFilters(f => ({ ...f, [key]: value }));
  const pages = Math.max(1, Math.ceil((result?.rows.length ?? 0) / PAGE_SIZE));
  const selectedGroup = groups.find(([range]) => range === `${filters.icd_from}-${filters.icd_to}`);
  const dirty = !!request && new URLSearchParams(filters).toString() !== request;

  function choosePeriod(next: ReportPeriod, year = currentReportYear(next).year, month = periodMonth) {
    setPeriod(next); setPeriodYear(year); setPeriodMonth(month);
    if (next !== "custom") setFilters(f => ({ ...f, ...reportDateRange(next, year, month) }));
  }
  function reset() {
    setRequest(null); setResult(null); setError(""); setLoading(false); setPage(1); setFilters(initial); clearDiseaseSelections(); setPeriod("year"); setPeriodYear(currentReportYear("year").year); setPeriodMonth(currentReportYear("month").month);
  }
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([icdCsv(result.rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `icd10_${result.meta.date_from}_${result.meta.date_to}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const chartTooltip = { background: "var(--report-surface)", border: "1px solid var(--report-line)", borderRadius: 12, color: "var(--report-ink)", fontSize: 13 };

  return <div className={styles.report}>
    <div className={styles.pageHeading}>
      <div>
        <div className={styles.eyebrow}>รายงานผู้รับบริการ <span>/</span> ICD-10</div>
        <h1>สถิติผู้ป่วยตามกลุ่มโรค</h1>
        <p>ค้นหาการวินิจฉัย ดูภาพรวม และส่งต่อข้อมูลในรายงานเดียว</p>
      </div>
      <span className={styles.pageTag}><ListFilter size={15} aria-hidden="true" /> รายงานตามเงื่อนไข</span>
    </div>

    <form className={styles.filters} onSubmit={e => {
      e.preventDefault();
      if (diseaseQuery.trim()) return;
      try {
        const params = new URLSearchParams(filters); parseIcdFilters(params);
        setResult(null); setError(""); setLoading(true); setPage(1); setRequest(params.toString()); setRevision(r => r + 1);
      } catch (e) { setError(e instanceof Error ? e.message : "เงื่อนไขไม่ถูกต้อง"); }
    }}>
      <div className={styles.filterHeading}>
        <h2><SlidersHorizontal size={17} aria-hidden="true" /> กำหนดเงื่อนไข</h2>
        <button type="button" className={styles.textButton} onClick={reset}><RotateCcw size={14} aria-hidden="true" /> คืนค่าเริ่มต้น</button>
      </div>
      <div className={styles.filterBody}>
        <div className={styles.filterSection}>
          <div className={styles.diseaseRange}>
            <DiseaseSearch key={"from-" + searchVersion} label="จากโรค" selected={fromDisease} onQueryChange={setFromQuery} onSelect={disease => {
              const code = disease.code.trim().toUpperCase().replace(/\./g, "");
              setFromDisease(disease);
              setFilters(f => ({ ...f, icd_from: code, icd_to: explicitEnd ? f.icd_to : code }));
            }} />
            <DiseaseSearch key={"to-" + searchVersion} label="ถึงโรค (ไม่บังคับ)" selected={toDisease} onQueryChange={setToQuery} onSelect={disease => {
              const code = disease.code.trim().toUpperCase().replace(/\./g, "");
              setToDisease(disease); setExplicitEnd(true);
              setFilters(f => ({ ...f, icd_from: fromDisease ? f.icd_from : code, icd_to: code }));
              if (!fromDisease) setFromDisease(disease);
            }} onClear={() => {
              setToDisease(null); setExplicitEnd(false);
              setFilters(f => ({ ...f, icd_to: f.icd_from }));
            }} />
          </div>
          <p className={styles.help}>เลือกเฉพาะ “จากโรค” เพื่อค้นหาโรคนั้น หรือเลือก “ถึงโรค” เพิ่มเพื่อค้นหาทุกโรคในช่วงรหัส เลือกสลับลำดับได้</p>
          <label className={styles.field}>หรือเลือกกลุ่มโรค
            <select value={selectedGroup?.[0] ?? ""} onChange={e => {
              if (!e.target.value) return;
              clearDiseaseSelections(); const [from, to] = e.target.value.split("-"); setFilters(f => ({ ...f, icd_from: from, icd_to: to }));
            }}><option value="">กำหนดช่วงรหัสเอง</option>{groups.map(([range, name]) => <option key={range} value={range}>{name} ({range})</option>)}</select>
          </label>
          <div className={styles.pair}>
            <label className={styles.field}>จากโรค / รหัสเริ่มต้น<input type="text" required value={filters.icd_from} onChange={e => { clearDiseaseSelections(); update("icd_from", e.target.value); }} placeholder="A00" autoCapitalize="characters" /><IcdCodeName code={filters.icd_from} /></label>
            <ArrowRight size={16} className={styles.rangeArrow} aria-hidden="true" />
            <label className={styles.field}>ถึงโรค / รหัสสิ้นสุด<input type="text" required value={filters.icd_to} onChange={e => { clearDiseaseSelections(); setExplicitEnd(true); update("icd_to", e.target.value); }} placeholder="A99" autoCapitalize="characters" /><IcdCodeName code={filters.icd_to} /></label>
          </div>
          <label className={styles.field} htmlFor="diag-text">ข้อความวินิจฉัย <span className={styles.optional}>ไม่บังคับ</span></label>
          <div className={styles.searchField}>
            <Search size={17} aria-hidden="true" />
            <input id="diag-text" type="search" maxLength={200} value={filters.diag_text} onChange={e => update("diag_text", e.target.value)} placeholder="พิมพ์คำที่อยู่ในข้อความวินิจฉัย…" aria-describedby="diag-text-help" />
            {filters.diag_text && <button type="button" aria-label="ล้างข้อความวินิจฉัย" onClick={() => update("diag_text", "")}><X size={16} /></button>}
          </div>
          <p id="diag-text-help" className={styles.help}>ค้นหาบางส่วนของข้อความ ร่วมกับช่วงรหัสโรคที่เลือก</p>
          <fieldset className={styles.scope}><legend>ขอบเขตรหัสโรค</legend><div className={styles.segmented}>{[["pdx", "โรคหลัก", "PDx"], ["all", "โรคหลัก + โรครอง", "PDx, DX0–DX5"]].map(([value, label, detail]) => <label key={value} className={filters.mode === value ? styles.selected : ""}><input type="radio" name="mode" value={value} checked={filters.mode === value} onChange={() => update("mode", value)} /><span>{label} <small>{detail}</small></span></label>)}</div></fieldset>
        </div>
        <div className={styles.filterSection}>
          <div className={styles.sectionLabel}><span><CalendarDays size={15} aria-hidden="true" /> ช่วงเวลารายงาน</span><span className={styles.optional}>เลือกย้อนหลังได้ 5 ปี</span></div>
          <div className={styles.periodTabs} role="group" aria-label="รูปแบบช่วงเวลา">{([["fiscal", "ปีงบประมาณ"], ["month", "รายเดือน"], ["year", "รายปี"], ["custom", "กำหนดเอง"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={period === value} onClick={() => choosePeriod(value)}>{label}</button>)}</div>
          {period !== "custom" && <div className={styles.periodSelectors}>
            <label className={styles.field}>{period === "fiscal" ? "ปีงบประมาณ (พ.ศ.)" : "ปี (พ.ศ.)"}<select aria-label={period === "fiscal" ? "ปีงบประมาณ (พ.ศ.)" : "ปี (พ.ศ.)"} value={periodYear} onChange={e => choosePeriod(period, Number(e.target.value))}>{Array.from({ length: 6 }, (_, index) => latestYear - index).map(year => <option key={year} value={year}>{year + 543}{year === latestYear ? " · ปีปัจจุบัน" : ""}</option>)}</select></label>
            {period === "month" && <label className={styles.field}>เดือน<select aria-label="เดือน" value={periodMonth} onChange={e => choosePeriod(period, periodYear, Number(e.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>{new Date(2026, index, 1).toLocaleDateString("th-TH", { month: "long" })}</option>)}</select></label>}
          </div>}
          {period !== "custom" && <p className={styles.help}>{period === "fiscal" ? "ปีงบประมาณ: 1 ต.ค. ปีก่อน ถึง 30 ก.ย. ปีที่เลือก" : period === "year" ? "ปีปฏิทิน: 1 ม.ค. ถึง 31 ธ.ค. ของปีที่เลือก" : "ตั้งแต่วันแรกถึงวันสุดท้ายของเดือนที่เลือก"}</p>}
          <div className={styles.pair}>
            <label className={styles.field}>ตั้งแต่วันที่<input type="date" required value={filters.date_from} onChange={e => { setPeriod("custom"); update("date_from", e.target.value); }} /></label>
            <ArrowRight size={16} className={styles.rangeArrow} aria-hidden="true" />
            <label className={styles.field}>ถึงวันที่<input type="date" required value={filters.date_to} onChange={e => { setPeriod("custom"); update("date_to", e.target.value); }} /></label>
          </div>
          <div className={styles.pair}>
            <label className={styles.field}>อายุเริ่มต้น (ปี)<input type="number" required min={0} max={150} value={filters.age_from} onChange={e => update("age_from", e.target.value)} /></label>
            <ArrowRight size={16} className={styles.rangeArrow} aria-hidden="true" />
            <label className={styles.field}>อายุสิ้นสุด (ปี)<input type="number" required min={0} max={150} value={filters.age_to} onChange={e => update("age_to", e.target.value)} /></label>
          </div>

        </div>
      </div>
      <div className={styles.filterFooter}>
        <p>{diseaseQuery.trim() ? "เลือกชื่อโรคจากรายการ หรือล้างคำค้นชื่อโรคก่อนค้นหารายงาน" : dirty ? "มีการเปลี่ยนเงื่อนไข กดค้นหาเพื่ออัปเดตผลลัพธ์" : "เลือกเงื่อนไข แล้วค้นหาเพื่อดูสถิติและรายชื่อผู้ป่วย"}</p>
        <button type="submit" disabled={loading || !!diseaseQuery.trim()} className={styles.primaryButton}>{loading ? <LoaderCircle size={17} className={styles.spin} aria-hidden="true" /> : <Search size={17} aria-hidden="true" />}{loading ? "กำลังค้นหา…" : "ค้นหารายงาน"}{!loading && <ArrowRight size={16} aria-hidden="true" />}</button>
      </div>
    </form>

    {error && <div role="alert" className={styles.error}><AlertCircle size={19} aria-hidden="true" /><div><strong>ค้นหารายงานไม่สำเร็จ</strong><p>{error}</p></div></div>}
    {loading && <div className={styles.loading} role="status"><LoaderCircle size={23} className={styles.spin} aria-hidden="true" /><div><strong>กำลังเตรียมรายงาน</strong><p>กำลังรวบรวมสถิติและรายละเอียดผู้ป่วยตามเงื่อนไข</p></div><div className={styles.loadingBars} aria-hidden="true"><i /><i /><i /></div></div>}
    {!result && !loading && !error && <section className={styles.empty}>
      <div className={styles.emptySymbol}><FileSearch size={30} strokeWidth={1.4} aria-hidden="true" /></div>
      <div><span className={styles.eyebrow}>เริ่มต้นรายงาน</span><h2>ข้อมูลที่ต้องการ เริ่มจากเงื่อนไขที่ใช่</h2><p>เลือกกลุ่มโรคและช่วงวันที่ด้านบน<br />เพิ่มคำวินิจฉัยเพื่อค้นหาให้เฉพาะเจาะจงขึ้น แล้วกดค้นหารายงาน</p></div>
      <div className={styles.emptyGuide}><span>01 <b>เลือกกลุ่มโรค</b></span><span>02 <b>กำหนดช่วงเวลา</b></span><span>03 <b>ค้นหาและส่งออก</b></span></div>
    </section>}

    {result && <div className={styles.results} aria-busy={loading}>
      <section aria-label="สรุปผล" className={styles.summary}>
        <div className={styles.resultHeading}><div><span className={styles.eyebrow}>ผลการค้นหา</span><h2>{dateLabel(result.meta.date_from)} <span>—</span> {dateLabel(result.meta.date_to)}</h2></div><div className={styles.exportActions}><button className={styles.secondaryButton} disabled={!result.rows.length} onClick={download}><Download size={16} aria-hidden="true" /> ส่งออก CSV</button><button className={styles.iconButton} onClick={() => window.print()} aria-label="พิมพ์รายงาน"><Printer size={17} aria-hidden="true" /></button></div></div>
        <div className={styles.resultDiseaseNames}><span>จากโรค <IcdCodeName code={result.meta.icd_from} /></span><span>ถึงโรค <IcdCodeName code={result.meta.icd_to} /></span></div>
        <div className={styles.chips}><span>ICD-10 <b>{result.meta.icd_from}–{result.meta.icd_to}</b></span><span>อายุ <b>{result.meta.age_from}–{result.meta.age_to} ปี</b></span><span>{result.meta.mode === "all" ? "โรคหลัก + โรครอง" : "โรคหลัก (PDx)"}</span>{result.meta.diag_text && <span>คำวินิจฉัย <b>“{result.meta.diag_text}”</b></span>}</div>
        {dirty && <p className={styles.help}>ผลลัพธ์นี้เป็นเงื่อนไขที่ค้นหาล่าสุด กดค้นหารายงานเพื่อใช้เงื่อนไขใหม่</p>}
        <dl className={styles.metrics}>
          <div><dt>ครั้งรับบริการ</dt><dd>{nf(result.summary.visits)} <small>ครั้ง</small></dd><p>นับทุกครั้งที่เข้าเงื่อนไข</p></div>
          <div><dt>ผู้ป่วยไม่ซ้ำ</dt><dd>{nf(result.summary.patients)} <small>คน</small></dd><p>นับหนึ่งคนต่อ HN</p></div>
          <div><dt>อายุเฉลี่ยผู้ป่วย</dt><dd>{result.summary.avg_age ?? "—"} <small>ปี</small></dd><p>อายุ ณ ครั้งล่าสุดที่เข้าเงื่อนไข</p></div>
        </dl>
      </section>
      {result.summary.visits > 0 ? <>
        <div className={styles.charts}>
          <section className={styles.chartPanel}><div className={styles.panelHeading}><h2>แนวโน้มการรับบริการ</h2><span>จำนวนครั้ง / เดือน</span></div><div className={styles.chart}><ResponsiveContainer width="100%" height="100%"><BarChart data={result.by_month} margin={{ top: 16, right: 8, bottom: 0, left: -20 }}><CartesianGrid stroke="var(--report-line)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="ym" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--report-muted)" }} dy={8} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--report-muted)" }} /><Tooltip cursor={{ fill: "var(--report-soft)" }} contentStyle={chartTooltip} /><Bar name="ครั้ง" dataKey="c" fill="var(--report-accent)" radius={[5, 5, 0, 0]} maxBarSize={38} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></section>
          <section className={styles.chartPanel}><div className={styles.panelHeading}><h2>ผู้ป่วยตามช่วงอายุ</h2><span>ผู้ป่วยไม่ซ้ำ / คน</span></div><div className={styles.chart}><ResponsiveContainer width="100%" height="100%"><BarChart data={result.by_age} margin={{ top: 16, right: 8, bottom: 0, left: -20 }}><CartesianGrid stroke="var(--report-line)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="grp" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--report-muted)" }} dy={8} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--report-muted)" }} /><Tooltip cursor={{ fill: "var(--report-soft)" }} contentStyle={chartTooltip} /><Bar name="คน" dataKey="c" fill="var(--report-secondary)" radius={[5, 5, 0, 0]} maxBarSize={38} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></section>
        </div>
        <section className={styles.topDiagnoses}><div className={styles.panelHeading}><h2>10 อันดับโรคหลัก</h2><span>นับครั้งรับบริการที่เข้าเงื่อนไข</span></div><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="ตารางอันดับโรคหลัก"><table><thead><tr><th scope="col">อันดับ</th><th scope="col">รหัสโรคหลัก</th><th scope="col">ชื่อโรค</th><th scope="col" className={styles.numeric}>ครั้ง</th></tr></thead><tbody>{result.top_dx.map((d, i) => <tr key={d.code}><td className={styles.rank}>{String(i + 1).padStart(2, "0")}</td><td><span className={styles.code}>{d.code}</span></td><td>{d.dname || "—"}</td><td className={styles.numeric}>{nf(d.c)}</td></tr>)}</tbody></table></div></section>
      </> : <div className={styles.noResults} role="status"><Search size={26} aria-hidden="true" /><h2>ไม่พบข้อมูลตามเงื่อนไขนี้</h2><p>ลองขยายช่วงวันที่ รหัสโรค หรืออายุ<br />หรือล้างคำวินิจฉัยแล้วค้นหาอีกครั้ง</p></div>}
      {result.rows.length > 0 && <section className={styles.details}>
        <div className={styles.panelHeading}><h2>รายละเอียดผู้ป่วย <span className={styles.count}>{nf(result.rows.length)} คน</span></h2><span>หนึ่งแถวต่อ HN</span></div>
        <p className={styles.tableNote}>แสดงครั้งล่าสุดที่เข้าเงื่อนไข หากวันเดียวกันใช้ VN สูงสุด · CSV ส่งออกครบทุกแถว</p>
        <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="ตารางรายละเอียดผู้ป่วย เลื่อนแนวนอนเพื่อดูทุกคอลัมน์"><table className={styles.patientTable}><thead><tr>{["วันที่ / VN", "ผู้ป่วย / HN", "อายุ", "PDx", "ชื่อโรคหลัก", "รหัสโรคทั้งหมด", "ข้อความวินิจฉัย"].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{result.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(r => <tr key={r.hn}><td><span className={styles.cellPrimary}>{dateLabel(r.vstdate)}</span><small>VN {r.vn}</small></td><td><span className={styles.cellPrimary}>{r.ptname || "—"}</span><small>HN {r.hn}</small></td><td className={styles.numeric}>{r.age_y ?? "—"}</td><td><span className={styles.code}>{r.pdx || "—"}</span></td><td>{r.dname || "—"}</td><td>{r.dxlist || "—"}</td><td className={styles.diagnosis}>{r.diag_text || "—"}</td></tr>)}</tbody></table></div>
        <div className={styles.pagination}><span>แสดง {nf((page - 1) * PAGE_SIZE + 1)}–{nf(Math.min(page * PAGE_SIZE, result.rows.length))} จาก {nf(result.rows.length)} คน</span><div><button className={styles.iconButton} disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="หน้าก่อนหน้า"><ChevronLeft size={17} /></button><span aria-live="polite">หน้า <b>{page}</b> / {pages}</span><button className={styles.iconButton} disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label="หน้าถัดไป"><ChevronRight size={17} /></button></div></div>
      </section>}
    </div>}
  </div>;
}
