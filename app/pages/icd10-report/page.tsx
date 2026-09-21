"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ICD10_TITLE, icdCsv, parseIcdFilters, type IcdFilters, type summarizeIcd } from "@/lib/icd10-report";

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
const control = "min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-green-700";
const button = "min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-green-700";
const nf = (n: number) => n.toLocaleString("th-TH");
const initial = { icd_from: "A00", icd_to: "A99", age_from: "1", age_to: "100", date_from: "2025-10-01", date_to: "2026-09-02", mode: "all" };

export default function Icd10ReportPage() {
  const [filters, setFilters] = useState(initial);
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
  const pages = Math.max(1, Math.ceil((result?.rows.length ?? 0) / 50));
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([icdCsv(result.rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `icd10_${result.meta.date_from}_${result.meta.date_to}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="space-y-6 text-gray-900">
    <header className="space-y-2"><h1 className="text-xl font-bold">{ICD10_TITLE}</h1><p className="text-sm text-gray-600">ค้นหาจากรหัสโรค อายุ และวันที่รับบริการ</p></header>
    <form className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-5 print:hidden" onSubmit={e => {
      e.preventDefault();
      try {
        const params = new URLSearchParams(filters); parseIcdFilters(params);
        setResult(null); setError(""); setLoading(true); setPage(1); setRequest(params.toString()); setRevision(r => r + 1);
      } catch (e) { setError(e instanceof Error ? e.message : "เงื่อนไขไม่ถูกต้อง"); }
    }}>
      <label className="block space-y-1 text-sm">กลุ่มโรคสำเร็จรูป
        <select className={control} value={groups.some(([range]) => range === `${filters.icd_from}-${filters.icd_to}`) ? `${filters.icd_from}-${filters.icd_to}` : ""} onChange={e => {
          if (!e.target.value) return;
          const [from, to] = e.target.value.split("-"); setFilters(f => ({ ...f, icd_from: from, icd_to: to }));
        }}><option value="">กำหนดช่วงรหัสเอง</option>{groups.map(([range, name]) => <option key={range} value={range}>{range} · {name}</option>)}</select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {([['icd_from', 'รหัสโรค ตั้งแต่', 'text'], ['icd_to', 'ถึงรหัสโรค', 'text'], ['age_from', 'อายุ ตั้งแต่ (ปี)', 'number'], ['age_to', 'ถึงอายุ (ปี)', 'number'], ['date_from', 'วันที่ ตั้งแต่', 'date'], ['date_to', 'ถึงวันที่', 'date']] as const).map(([key, label, type]) =>
          <label className="space-y-1 text-sm" key={key}>{label}<input className={control} type={type} required min={type === 'number' ? 0 : undefined} max={type === 'number' ? 150 : undefined} value={filters[key]} onChange={e => update(key, e.target.value)} /></label>)}
      </div>
      <fieldset className="flex flex-wrap gap-5 text-sm"><legend className="mb-2">ขอบเขตการตรวจรหัส</legend>{[["pdx", "โรคหลัก (PDx)"], ["all", "โรคหลักและโรครอง (PDx, DX0–DX5)"]].map(([value, text]) => <label className="flex min-h-11 items-center gap-2" key={value}><input type="radio" name="mode" value={value} checked={filters.mode === value} onChange={() => update("mode", value)} />{text}</label>)}</fieldset>
      <button type="submit" disabled={loading} className={`${button} bg-green-700 text-white`}>{loading ? "กำลังค้นหา…" : "ค้นหา"}</button>
    </form>
    {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">{error}</p>}
    {loading && <p role="status">กำลังโหลดสถิติและรายละเอียดผู้ป่วย…</p>}
    {!result && !loading && !error && <p className="py-8 text-center text-gray-600">เลือกเงื่อนไขแล้วกดค้นหาเพื่อแสดงรายงาน</p>}
    {result && <>
      <section className="space-y-3" aria-label="สรุปผล">
        <p className="text-sm text-gray-600">ผลการค้นหา {result.meta.date_from} ถึง {result.meta.date_to} · {result.meta.icd_from}–{result.meta.icd_to} · อายุ {result.meta.age_from}–{result.meta.age_to} ปี · {result.meta.mode === "all" ? "โรคหลักและโรครอง" : "โรคหลัก"}</p>
        <dl className="grid gap-4 border-y border-gray-200 py-5 sm:grid-cols-3">{[["ครั้งรับบริการ", nf(result.summary.visits)], ["ผู้ป่วยไม่ซ้ำ (คน)", nf(result.summary.patients)], ["อายุเฉลี่ยผู้ป่วย (ปี)", result.summary.avg_age ?? "—"]].map(([label, value]) => <div key={label}><dt className="text-sm text-gray-600">{label}</dt><dd className="mt-1 text-3xl font-bold text-green-800">{value}</dd></div>)}</dl>
      </section>
      {result.summary.visits > 0 ? <div className="grid gap-6 lg:grid-cols-2">
        <section><h2 className="mb-4 font-semibold">จำนวนครั้งรับบริการรายเดือน</h2><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={result.by_month}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="ym" /><YAxis allowDecimals={false} /><Tooltip /><Bar name="ครั้ง" dataKey="c" fill="#15803d" /></BarChart></ResponsiveContainer></div></section>
        <section><h2 className="mb-4 font-semibold">ผู้ป่วยไม่ซ้ำตามช่วงอายุ (ปี)</h2><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={result.by_age}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="grp" /><YAxis allowDecimals={false} /><Tooltip /><Bar name="คน" dataKey="c" fill="#0f766e" /></BarChart></ResponsiveContainer></div></section>
      </div> : <p role="status" className="py-6 text-gray-600">ไม่พบข้อมูลตามเงื่อนไข ลองปรับช่วงวันที่ รหัสโรค หรืออายุ</p>}
      <section className="space-y-3"><h2 className="font-semibold">Top 10 รหัสโรคหลัก · นับครั้งรับบริการที่เข้าเงื่อนไข</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr>{["อันดับ", "รหัส", "ชื่อโรค", "ครั้ง"].map(h => <th scope="col" className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{result.top_dx.map((d, i) => <tr className="border-b border-gray-200" key={d.code}><td className="p-3">{i + 1}</td><td className="p-3">{d.code}</td><td className="p-3">{d.dname || "—"}</td><td className="p-3">{nf(d.c)}</td></tr>)}</tbody></table></div></section>
      <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">รายละเอียดผู้ป่วย {nf(result.rows.length)} คน</h2><div className="flex gap-2 print:hidden"><button className={button} disabled={!result.rows.length} onClick={download}>ส่งออก CSV ทั้งหมด</button><button className={button} onClick={() => window.print()}>พิมพ์หน้านี้</button></div></div>
        <p className="text-sm text-gray-600">หนึ่งแถวต่อ HN ใช้ข้อมูลครั้งล่าสุดที่เข้าเงื่อนไข (วันเดียวกันเลือก VN สูงสุด) อายุเฉลี่ยและช่วงอายุใช้ครั้งนี้ด้วย</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr>{["VN", "HN", "วันที่", "อายุ", "ชื่อ-สกุล", "PDx", "ชื่อโรคหลัก", "รหัสโรคทั้งหมด", "ข้อความวินิจฉัย (diag_text)"].map(h => <th scope="col" className="whitespace-nowrap p-3" key={h}>{h}</th>)}</tr></thead><tbody>{result.rows.slice((page - 1) * 50, page * 50).map(r => <tr key={r.hn} className="border-b border-gray-200 hover:bg-gray-50">{[r.vn, r.hn, r.vstdate, r.age_y, r.ptname, r.pdx, r.dname, r.dxlist, r.diag_text].map((v, i) => <td key={i} className={`p-3 align-top ${i >= 6 ? "min-w-48 whitespace-pre-wrap break-words" : "whitespace-nowrap"}`}>{v ?? "—"}</td>)}</tr>)}</tbody></table></div>
        <div className="flex items-center justify-end gap-3 print:hidden"><button className={button} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>ก่อนหน้า</button><span className="text-sm">หน้า {page} / {pages}</span><button className={button} disabled={page >= pages} onClick={() => setPage(p => p + 1)}>ถัดไป</button></div>
      </section>
    </>}
  </div>;
}
