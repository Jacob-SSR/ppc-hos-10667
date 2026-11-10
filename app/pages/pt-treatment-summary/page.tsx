"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Download, Printer, Receipt, Search } from "lucide-react";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { fmtDate, getBangkokToday, toThaiDateLabel } from "@/lib/thaiDate";
import {
  PT_DEFAULT_ICODES, PT_MAX_SELECTION, PT_TREATMENT_TITLE, ptTreatmentExport,
  type PtTreatmentItem, type PtTreatmentReport,
} from "@/lib/pt-treatment-summary";

const button = "min-h-10 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed";
const count = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 3 });
const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PtTreatmentSummaryPage() {
  const [catalog, setCatalog] = useState<PtTreatmentItem[]>([]);
  const [hospital, setHospital] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [retry, setRetry] = useState(0);
  const [start, setStart] = useState<Date>(() => getBangkokToday());
  const [end, setEnd] = useState<Date>(() => getBangkokToday());
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [byRight, setByRight] = useState(false);
  const [result, setResult] = useState<PtTreatmentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setCatalogLoading(true); setCatalogError("");
      try {
        const response = await fetch("/api/pt-treatment-summary?mode=catalog", { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "โหลดทะเบียนไม่สำเร็จ");
        if (controller.signal.aborted) return;
        setCatalog(data.items); setHospital(data.hospital);
        setSelected(data.items.filter((i: PtTreatmentItem) => PT_DEFAULT_ICODES.includes(i.icode)).map((i: PtTreatmentItem) => i.icode));
      } catch (e) {
        if (!controller.signal.aborted) setCatalogError(e instanceof Error ? e.message : "โหลดทะเบียนไม่สำเร็จ");
      } finally { if (!controller.signal.aborted) setCatalogLoading(false); }
    }
    load();
    return () => controller.abort();
  }, [retry]);
  useEffect(() => () => request.current?.abort(), []);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter(item => (!selectedOnly || selectedSet.has(item.icode)) && (!q || item.icode.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)));
  }, [catalog, search, selectedOnly, selectedSet]);
  const visible = matching.slice(0, 100);
  const availableDefaults = useMemo(() => catalog.filter(item => PT_DEFAULT_ICODES.includes(item.icode)).map(item => item.icode), [catalog]);
  const dirty = result && (result.start !== fmtDate(start) || result.end !== fmtDate(end) || result.byRight !== byRight || [...result.icodes].sort().join(",") !== [...selected].sort().join(","));

  function toggle(code: string) {
    setSelected(current => current.includes(code) ? current.filter(c => c !== code) : current.length < PT_MAX_SELECTION ? [...current, code] : current);
  }
  function selectVisible() {
    const next = [...new Set([...selected, ...visible.map(item => item.icode)])];
    if (next.length > PT_MAX_SELECTION) { setError(`เลือกได้ไม่เกิน ${PT_MAX_SELECTION} รายการ กรุณาลดรายการที่เลือกก่อน`); return; }
    setSelected(next); setError("");
  }
  async function loadReport() {
    if (!selected.length) { setError("กรุณาเลือกหัตถการอย่างน้อย 1 รายการ"); return; }
    if (start > end) { setError("วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด"); return; }
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError("");
    const params = new URLSearchParams({ start: fmtDate(start), end: fmtDate(end), icodes: selected.join(","), group: byRight ? "right" : "procedure" });
    try {
      const response = await fetch(`/api/pt-treatment-summary?${params}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "โหลดรายงานไม่สำเร็จ");
      if (!controller.signal.aborted) setResult(data);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "โหลดรายงานไม่สำเร็จ"); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  async function exportExcel() {
    if (!result?.rows.length) return;
    const { exportToExcel } = await import("@/lib/exportExcel");
    exportToExcel(ptTreatmentExport(result), {
      filePrefix: `สรุปค่ารักษากายภาพ_${result.start}_${result.end}`, sheetName: "ค่ารักษากายภาพ", dateKeys: ["วันที่เริ่ม", "วันที่สิ้นสุด"],
    });
  }

  return (
    <div className="pt-treatment-page space-y-5 text-gray-800">
      <style>{`@media print{.pt-report-controls{display:none!important}body:has(.pt-treatment-page) .h-screen{height:auto!important}body:has(.pt-treatment-page) main,body:has(.pt-treatment-page) .overflow-hidden{overflow:visible!important}body:has(.pt-treatment-page) aside,body:has(.pt-treatment-page) .h-screen>.h-14{display:none!important}@page{size:A4 landscape;margin:1cm}}`}</style>
      <header className="rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2"><Receipt size={22} className="text-green-700" /><h1 className="text-lg font-bold">{PT_TREATMENT_TITLE}</h1></div>
        <p className="mt-1 text-sm text-gray-500">{hospital || "รายงานงานกายภาพบำบัด"} · สรุปค่าบริการเฉพาะหัตถการที่เลือก</p>
      </header>
      <section className="pt-report-controls space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="เงื่อนไขรายงาน">
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1 text-sm"><span className="block">วันที่เริ่ม</span><DatePicker selected={start} onChange={(d: Date | null) => d && setStart(d)} locale={th} dateFormat="dd/MM/yyyy" showMonthDropdown showYearDropdown dropdownMode="select" customInput={<ThaiDateInput />} /></label>
          <label className="space-y-1 text-sm"><span className="block">วันที่สิ้นสุด</span><DatePicker selected={end} onChange={(d: Date | null) => d && setEnd(d)} locale={th} dateFormat="dd/MM/yyyy" showMonthDropdown showYearDropdown dropdownMode="select" customInput={<ThaiDateInput />} /></label>
          <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={byRight} onChange={e => setByRight(e.target.checked)} className="h-4 w-4 accent-green-700" />แยกตามสิทธิการรักษา</label>
        </div>
        <div className="border-t border-gray-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">เลือกหัตถการ <span className="text-sm font-normal text-gray-500">{selected.length} / {PT_MAX_SELECTION} รายการ</span></h2>
            <div className="flex flex-wrap gap-2"><button className={button} disabled={catalogLoading} onClick={() => { setSelected(availableDefaults); setError(""); }}>ชุดรายงานเดิม ({availableDefaults.length})</button><button className={button} disabled={!selected.length} onClick={() => setSelected([])}>ล้างการเลือก</button></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1"><Search size={17} className="absolute left-3 top-3 text-gray-400" aria-hidden="true" /><input type="search" value={search} onChange={e => setSearch(e.target.value)} aria-label="ค้นหาหัตถการ" placeholder="ค้นหาชื่อหัตถการหรือรหัสรายการ…" className="min-h-10 w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm" /></div>
            <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={selectedOnly} onChange={e => setSelectedOnly(e.target.checked)} className="h-4 w-4 accent-green-700" />เฉพาะที่เลือก</label>
            <button className={button} disabled={!visible.length || catalogLoading} onClick={selectVisible}>เลือก {visible.length} รายการที่แสดง</button>
          </div>
          {catalogLoading ? <p role="status" className="py-8 text-center text-sm text-gray-500">กำลังโหลดทะเบียนหัตถการ…</p> : catalogError ? <div role="alert" className="mt-3 text-sm text-red-700">{catalogError} <button className={button} onClick={() => setRetry(n => n + 1)}>ลองใหม่</button></div> : <>
            <div className="mt-3 grid max-h-64 gap-px overflow-auto rounded-lg border border-gray-200 bg-gray-100 md:grid-cols-2" aria-label="รายการหัตถการ">
              {visible.map(item => <label key={item.icode} className="flex cursor-pointer items-start gap-3 bg-white p-3 text-sm hover:bg-green-50"><input type="checkbox" checked={selectedSet.has(item.icode)} disabled={!selectedSet.has(item.icode) && selected.length >= PT_MAX_SELECTION} onChange={() => toggle(item.icode)} className="mt-0.5 h-4 w-4 shrink-0 accent-green-700" /><span><span className="mr-2 font-mono text-xs text-gray-500">{item.icode}</span>{item.name}</span></label>)}
              {!visible.length && <p className="bg-white p-5 text-sm text-gray-500 md:col-span-2">ไม่พบรายการตามคำค้นหา</p>}
            </div>
            <p className="mt-2 text-xs text-gray-500">แสดง {visible.length} จาก {matching.length.toLocaleString()} รายการ{matching.length > 100 && " · พิมพ์ชื่อหรือรหัสให้เจาะจงขึ้นเพื่อค้นหารายการอื่น"} · ค้นหาได้จากทะเบียนค่าบริการทั้งหมด</p>
            {availableDefaults.length < PT_DEFAULT_ICODES.length && <p className="mt-1 text-xs text-amber-700">พบรหัสชุดรายงานเดิม {availableDefaults.length} จาก {PT_DEFAULT_ICODES.length} รหัสในทะเบียนนี้ สามารถค้นหาและเลือกหัตถการเพิ่มได้</p>}
          </>}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4"><button className={`${button} border-green-700 bg-green-700 text-white hover:bg-green-800`} disabled={catalogLoading || loading || !selected.length} onClick={loadReport}>{loading ? "กำลังประมวลผล…" : "แสดงรายงาน"}</button><span className="text-xs text-gray-500">ค่าบริการจากรายการที่เลือก · ไม่รวมค่ารักษาอื่นใน visit</span></div>
      </section>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {loading && <p role="status" className="text-sm text-green-800">กำลังสรุปข้อมูลตามเงื่อนไขที่ยืนยัน…</p>}
      {!result && !loading && <p className="py-8 text-center text-sm text-gray-500">เลือกช่วงวันที่และหัตถการ แล้วกด “แสดงรายงาน”</p>}
      {result && <section className="space-y-4" aria-label="ผลรายงาน">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">ผลรายงาน {toThaiDateLabel(result.start, result.end)}</h2><p className="mt-1 text-xs text-gray-500">เลือก {result.icodes.length} หัตถการ · {result.byRight ? "แยกตามหัตถการและสิทธิ" : "แยกตามหัตถการ"}</p></div><div className="pt-report-controls flex gap-2"><button className={button} disabled={loading || !result.rows.length} onClick={exportExcel}><Download size={15} className="mr-1 inline" />Excel</button><button className={button} disabled={loading || !result.rows.length} onClick={() => window.print()}><Printer size={15} className="mr-1 inline" />พิมพ์ / PDF</button></div></div>
        {dirty && <p className="pt-report-controls text-sm text-amber-700">มีการเปลี่ยนเงื่อนไข กด “แสดงรายงาน” เพื่ออัปเดตผลด้านล่าง</p>}
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[["ผู้ป่วยไม่ซ้ำ (ราย)", count(result.totals.patients)], ["ครั้งรับบริการ (VN)", count(result.totals.visits)], ["จำนวนหน่วย", count(result.totals.quantity)], ["ค่าหัตถการรวม (บาท)", money(result.totals.charge)]].map(([label,value]) => <div key={label} className="rounded-xl border border-green-100 bg-green-50 p-4"><dt className="text-sm text-green-800">{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums text-green-950">{value}</dd></div>)}
        </dl>
        {!result.rows.length ? <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">ไม่พบการให้บริการหัตถการที่เลือกในช่วงวันที่นี้</p> : <div className="overflow-auto rounded-xl border border-gray-200 bg-white print:overflow-visible">
          <table className="w-full text-left text-sm"><caption className="sr-only">{PT_TREATMENT_TITLE} {toThaiDateLabel(result.start,result.end)}</caption><thead className="bg-[#7ec8a0] text-white"><tr>{["รหัส","หัตถการ",...(result.byRight ? ["สิทธิการรักษา"] : []),"ผู้ป่วย (ราย)","ครั้ง (VN)","รายการ","จำนวนหน่วย","ค่าหัตถการ (บาท)"].map((label,i) => <th key={label} scope="col" className={`whitespace-nowrap px-4 py-3 font-semibold ${i >= (result.byRight ? 3 : 2) ? "text-right" : ""}`}>{label}</th>)}</tr></thead><tbody>
            {result.rows.map(row => <tr key={`${row.icode}:${row.pttype}`} className="border-b border-gray-100 odd:bg-white even:bg-gray-50"><td className="px-4 py-3 font-mono text-xs">{row.icode}</td><td className="px-4 py-3">{row.name}</td>{result.byRight && <td className="px-4 py-3">{row.pttype} · {row.pttype_name}</td>}{[row.patients,row.visits,row.lines,row.quantity].map((value,i)=><td key={i} className="px-4 py-3 text-right tabular-nums">{count(value)}</td>)}<td className="px-4 py-3 text-right tabular-nums">{money(row.charge)}</td></tr>)}
          </tbody><tfoot className="bg-green-50 font-semibold"><tr><th scope="row" colSpan={result.byRight ? 3 : 2} className="px-4 py-3">รวมทั้งรายงาน (คนและ VN ไม่ซ้ำ)</th>{[result.totals.patients,result.totals.visits,result.totals.lines,result.totals.quantity].map((value,i)=><td key={i} className="px-4 py-3 text-right tabular-nums">{count(value)}</td>)}<td className="px-4 py-3 text-right tabular-nums">{money(result.totals.charge)}</td></tr></tfoot></table>
        </div>}
        <p className="text-xs leading-relaxed text-gray-500">คนไข้หนึ่งรายหรือหนึ่ง visit อาจมีหลายหัตถการ จึงรวมจำนวนคนและ VN จากแต่ละแถวโดยตรงไม่ได้ ยอดรวมด้านบนและท้ายตารางนับไม่ซ้ำตลอดรายงาน · จำนวนหน่วยอ้างอิงปริมาณในรายการค่าบริการ</p>
      </section>}
    </div>
  );
}
