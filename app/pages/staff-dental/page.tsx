"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Smile, Upload } from "lucide-react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { fmtDate, getBangkokToday, toThaiDate, toThaiDateLabel } from "@/lib/thaiDate";
import { parseStaffSheet, staffDentalExport, STAFF_DENTAL_STATUS, STAFF_DENTAL_TITLE, type StaffMember, type StaffDentalReport, type StaffDentalRow } from "@/lib/staff-dental";

const button = "min-h-10 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40";
type View = "not_done" | "done" | "unresolved" | "all";
function Table({ rows }: { rows: StaffDentalRow[] }) {
  return <div className="overflow-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-left text-sm">
    <thead className="bg-slate-700 text-white"><tr>{["ชื่อ–นามสกุล", "กลุ่มงาน", "แผนก", "HN", "visit", "วันที่ล่าสุด", "สถานะ"].map(label => <th key={label} className="whitespace-nowrap px-4 py-3" scope="col">{label}</th>)}</tr></thead>
    <tbody>{rows.map(r => <tr key={r.id} className="border-b border-gray-100 even:bg-gray-50"><td className="whitespace-nowrap px-4 py-3 font-medium">{r.name}</td><td className="min-w-48 px-4 py-3">{r.group}</td><td className="min-w-48 px-4 py-3">{r.department}</td><td className="px-4 py-3 font-mono">{r.matchedHn ?? "—"}</td><td className="px-4 py-3 text-right tabular-nums">{r.visits ?? "—"}</td><td className="whitespace-nowrap px-4 py-3">{r.lastVisit ? toThaiDate(r.lastVisit) : "—"}</td><td className={`min-w-52 px-4 py-3 ${r.status === "done" ? "text-green-800" : r.status === "not_done" ? "text-amber-800" : "text-red-700"}`}>{STAFF_DENTAL_STATUS[r.status]}</td></tr>)}</tbody>
  </table>{!rows.length && <p className="p-8 text-center text-sm text-gray-500">ไม่พบรายชื่อในตัวกรองนี้</p>}</div>;
}
export default function StaffDentalPage() {
  const [start, setStart] = useState(() => new Date(getBangkokToday().getFullYear(), 0, 1));
  const [end, setEnd] = useState(getBangkokToday);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [sheets, setSheets] = useState<{ name: string; rows: unknown[][] }[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [filename, setFilename] = useState("");
  const [result, setResult] = useState<StaffDentalReport | null>(null);
  const [view, setView] = useState<View>("not_done");
  const [group, setGroup] = useState("");
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [rosterVersion, setRosterVersion] = useState(0);
  const [appliedVersion, setAppliedVersion] = useState(-1);
  const request = useRef<AbortController | null>(null);
  const fileRequest = useRef(0);
  useEffect(() => () => { request.current?.abort(); fileRequest.current++; }, []);

  function selectSheet(name: string, source = sheets) {
    request.current?.abort(); setLoading(false); setResult(null); setError(""); setStaff([]);
    setSheetName(name); setRosterVersion(n => n + 1);
    try { setStaff(parseStaffSheet(source.find(s => s.name === name)?.rows ?? [])); }
    catch (e) { setError(e instanceof Error ? e.message : "อ่านรายชื่อไม่สำเร็จ"); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    const version = ++fileRequest.current;
    request.current?.abort(); setLoading(false); setResult(null); setStaff([]); setSheets([]); setFilename(""); setError("");
    if (file.size > 5 * 1024 * 1024) { setError("เลือกไฟล์ขนาดไม่เกิน 5 MB"); return; }
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const source = workbook.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: "", raw: false }) }));
      if (version !== fileRequest.current) return;
      setSheets(source); setFilename(file.name);
      selectSheet(source[0]?.name ?? "", source);
    } catch { if (version === fileRequest.current) setError("เปิดไฟล์ไม่สำเร็จ กรุณาเลือกไฟล์ Excel รายชื่อเจ้าหน้าที่"); }
    finally { if (version === fileRequest.current) setImporting(false); }
  }
  async function loadReport() {
    if (!staff.length) { setError("กรุณานำเข้าไฟล์รายชื่อและเลือกชีตก่อน"); return; }
    if (start > end) { setError("วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด"); return; }
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/staff-dental", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start: fmtDate(start), end: fmtDate(end), staff }), signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "ดึงรายงานไม่สำเร็จ");
      if (!controller.signal.aborted) { setResult(data); setAppliedVersion(rosterVersion); setGroup(""); setDepartment(""); setView("not_done"); }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "ดึงรายงานไม่สำเร็จ"); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  const dirty = !!result && (result.start !== fmtDate(start) || result.end !== fmtDate(end) || rosterVersion !== appliedVersion);
  const groups = useMemo(() => [...new Set(result?.rows.map(r => r.group) ?? [])], [result]);
  const departments = useMemo(() => [...new Set(result?.rows.filter(r => !group || r.group === group).map(r => r.department) ?? [])], [result, group]);
  const scoped = useMemo(() => result?.rows.filter(r => (!group || r.group === group) && (!department || r.department === department)) ?? [], [result,group,department]);
  const counts = { all: scoped.length, not_done: scoped.filter(r => r.status === "not_done").length, done: scoped.filter(r => r.status === "done").length, unresolved: scoped.filter(r => !["done","not_done"].includes(r.status)).length };
  const visible = scoped.filter(r => (view === "all" || (view === "unresolved" ? !["done","not_done"].includes(r.status) : r.status === view)) && (!search.trim() || `${r.name} ${r.matchedHn ?? ""}`.includes(search.trim()))).sort((a,b) => a.group.localeCompare(b.group,"th") || a.department.localeCompare(b.department,"th") || a.name.localeCompare(b.name,"th"));
  async function exportExcel() {
    if (!result) return;
    setExporting(true); setError("");
    try {
      const XLSX = await import("xlsx");
      const data = staffDentalExport(result), book = XLSX.utils.book_new();
      const columns = ["วันที่เริ่ม","วันที่สิ้นสุด","กลุ่มงาน","แผนก","ชื่อ_นามสกุล","HN","จำนวน_visit","วันที่ครั้งแรก","วันที่ล่าสุด","สถานะ"];
      for (const [name, rows, header] of [["ยังไม่พบ visit",data.unfinished,columns],["สรุปกลุ่มงานแผนก",data.groups,undefined],["เจ้าหน้าที่ทั้งหมด",data.all,columns],["ต้องตรวจสอบ",data.unresolved,columns]] as const) {
        const sheet = XLSX.utils.json_to_sheet(rows, header ? { header: [...header] } : {});
        sheet["!cols"] = (header ?? Object.keys(rows[0] ?? {})).map(key => ({ wch: ["กลุ่มงาน","แผนก","ชื่อ_นามสกุล","สถานะ"].includes(key) ? 40 : 18 }));
        if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] };
        XLSX.utils.book_append_sheet(book,sheet,name);
      }
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
        ["รายงาน",STAFF_DENTAL_TITLE],["วันที่เริ่ม",result.start],["วันที่สิ้นสุด",result.end],["ข้อมูล ณ",result.updatedAt],
        ["เกณฑ์","นับ VN ไม่ซ้ำที่มีรายการค่าบริการจากบุคลากรทันตกรรม position_id 2 หรือ 6 ตามรายงานทันตกรรมเดิม"],
        ["ยังไม่พบ visit","จับคู่ตัวบุคคลได้ แต่ไม่พบ visit ทันตกรรมในช่วงที่เลือก"],
        ["ต้องตรวจสอบ","ชื่อไม่พบ ชื่อซ้ำหลาย HN หรือหลายรายชื่อจับคู่กับ HN เดียวกัน ไม่ถือว่าเป็นผู้ยังไม่ได้รับบริการ"],
        ["ขอบเขตส่งออก","รายชื่อทั้งหมดที่นำเข้าและช่วงวันที่ของผลรายงาน ไม่จำกัดตามตัวกรองบนหน้าจอ"],
      ]),"ขอบเขตรายงาน");
      const url = URL.createObjectURL(new Blob([XLSX.write(book,{bookType:"xlsx",type:"array"})],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
      const link = document.createElement("a");
      link.href = url; link.download = `ติดตามทำฟันเจ้าหน้าที่_${result.start}_${result.end}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url),1000);
    } catch { setError("ส่งออก Excel ไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setExporting(false); }
  }
  return <div className="space-y-5 text-gray-800">
    <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h1 className="flex items-center gap-2 text-lg font-bold"><Smile size={22} className="text-green-700" />{STAFF_DENTAL_TITLE}</h1><p className="mt-2 text-sm text-gray-500">ค้นหาผู้ที่ยังไม่พบ visit ทันตกรรมในช่วงวันที่ แยกกลุ่มงาน/แผนก</p></header>
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="เงื่อนไขรายงาน">
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1 text-sm"><span className="block">วันที่เริ่ม</span><DatePicker selected={start} onChange={(d: Date | null) => d && setStart(d)} locale={th} dateFormat="dd/MM/yyyy" showMonthDropdown showYearDropdown dropdownMode="select" customInput={<ThaiDateInput />} /></label>
        <label className="space-y-1 text-sm"><span className="block">วันที่สิ้นสุด</span><DatePicker selected={end} onChange={(d: Date | null) => d && setEnd(d)} locale={th} dateFormat="dd/MM/yyyy" showMonthDropdown showYearDropdown dropdownMode="select" customInput={<ThaiDateInput />} /></label>
        <button className={button} onClick={() => { const today = getBangkokToday(); setStart(new Date(today.getFullYear(),0,1)); setEnd(today); }}>1 ม.ค. – วันนี้</button>
      </div>
      <div className="flex flex-wrap items-end gap-4 border-t border-gray-100 pt-4">
        <label className="space-y-2 text-sm"><span className="flex items-center gap-2 font-medium"><Upload size={16} />ไฟล์รายชื่อเจ้าหน้าที่</span><input type="file" accept=".xlsx,.xls" disabled={loading || importing} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; void importFile(file); }} className="max-w-full text-sm file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-gray-50 file:px-4 file:py-2" /></label>
        {!!sheets.length && <label className="space-y-1 text-sm"><span className="block">ชีตรายชื่อ</span><select value={sheetName} disabled={loading || importing} onChange={e => selectSheet(e.target.value)} className={`${button} max-w-72 bg-white`}>{sheets.map(s => <option key={s.name}>{s.name}</option>)}</select></label>}
        <button className={`${button} border-green-700 bg-green-700 text-white`} disabled={!staff.length || loading || importing} onClick={loadReport}>{loading ? "กำลังตรวจสอบกับ HOSxP…" : "ตรวจสอบผู้ที่ยังไม่ได้ทำฟัน"}</button>
      </div>
      <p className="text-xs leading-relaxed text-gray-500">ใช้คอลัมน์ ชื่อ, สกุล/นามสกุล และ กลุ่มงาน/แผนก ตามไฟล์รายชื่อเดิม รองรับ HN/CID หากมี · รายชื่อใช้เฉพาะการประมวลผลครั้งนี้ ไม่บันทึกไฟล์ลงระบบ</p>
      <p className="text-sm" role="status">{importing ? "กำลังอ่านไฟล์…" : staff.length ? `${filename} · ${staff.length} คน · ${new Set(staff.map(s=>s.group)).size} กลุ่มงาน` : "กรุณาเลือกไฟล์รายชื่อเจ้าหน้าที่"}</p>
    </section>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {result && <section className="space-y-4" aria-label="ผลรายงาน">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">ผลตรวจสอบ {toThaiDateLabel(result.start,result.end)}</h2><p className="mt-1 text-xs text-gray-500">ใช้ทะเบียนรายชื่อที่นำเข้า · จำนวน visit ตาม VN ไม่ซ้ำ</p></div><button className={button} onClick={exportExcel} disabled={loading || dirty || exporting}><Download size={16} className="mr-2 inline" />{exporting ? "กำลังส่งออก…" : "Excel ทั้งรายงาน"}</button></div>
      {dirty && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">เปลี่ยนเงื่อนไขแล้ว กรุณากดตรวจสอบอีกครั้ง ผลด้านล่างยังเป็นช่วงวันที่เดิม</p>}
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">กลุ่มงาน<select value={group} onChange={e => { setGroup(e.target.value); setDepartment(""); }} className={`${button} ml-2 max-w-80 bg-white`}><option value="">ทั้งหมด</option>{groups.map(g => <option key={g}>{g}</option>)}</select></label>
        <label className="text-sm">แผนก<select value={department} onChange={e => setDepartment(e.target.value)} className={`${button} ml-2 max-w-80 bg-white`}><option value="">ทั้งหมด</option>{departments.map(d => <option key={d}>{d}</option>)}</select></label>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{([["not_done","ยังไม่พบ visit"],["done","รับบริการแล้ว"],["unresolved","ต้องตรวจสอบชื่อ"],["all","เจ้าหน้าที่ทั้งหมด"]] as const).map(([key,label]) => <button key={key} aria-pressed={view===key} onClick={()=>setView(key)} className={`rounded-xl border p-4 text-left ${view===key ? "border-green-700 bg-green-50 ring-1 ring-green-700" : "border-gray-200 bg-white"}`}><span className="text-sm">{label}</span><span className="mt-2 block text-2xl font-semibold tabular-nums">{counts[key]} <span className="text-sm font-normal">คน</span></span></button>)}</div>
      {!!counts.unresolved && <p className="text-sm text-red-700">ต้องตรวจสอบตัวบุคคล {counts.unresolved} คน แยกจากผู้ยังไม่พบ visit หากชื่อเปลี่ยนหรือชื่อซ้ำ ให้เติม HN/CID ที่ยืนยันแล้วในไฟล์และนำเข้าใหม่</p>}
      <div className="overflow-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-left text-sm"><caption className="p-4 text-left font-semibold">สรุปกลุ่มงาน/แผนก · กดกลุ่มเพื่อดูรายชื่อ</caption><thead className="bg-gray-100"><tr>{["กลุ่มงาน","แผนก","ทั้งหมด (คน)","รับบริการแล้ว","ยังไม่พบ visit","ต้องตรวจสอบ","visit รวม"].map(h=><th scope="col" className="whitespace-nowrap px-4 py-3" key={h}>{h}</th>)}</tr></thead><tbody>{result.groups.filter(g=>(!group||g.group===group)&&(!department||g.department===department)).map(g=><tr key={JSON.stringify([g.group,g.department])} className="border-t border-gray-100"><td className="px-4 py-3"><button className="text-left text-green-800 underline underline-offset-2" onClick={()=>{setGroup(g.group);setDepartment(g.department);setView("not_done");}}>{g.group}</button></td><td className="px-4 py-3">{g.department}</td>{[g.staff,g.done,g.notDone,g.unresolved,g.visits].map((v,i)=><td key={i} className="px-4 py-3 text-right tabular-nums">{v}</td>)}</tr>)}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{view === "not_done" ? "รายชื่อที่ยังไม่พบ visit ทันตกรรม" : view === "done" ? "รายชื่อที่รับบริการแล้ว" : view === "unresolved" ? "รายชื่อที่ต้องตรวจสอบตัวบุคคล" : "รายชื่อทั้งหมด"} ({visible.length} คน)</h3><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาชื่อหรือ HN" aria-label="ค้นหาชื่อหรือ HN" className={`${button} min-w-64`} /></div>
      <Table rows={visible} />
      <p className="text-xs leading-relaxed text-gray-500">“ยังไม่พบ visit” หมายถึงจับคู่กับทะเบียนผู้ป่วยได้ แต่ไม่พบ visit ที่มีรายการค่าบริการจากบุคลากรทันตกรรมตามเกณฑ์รายงานทันตกรรมเดิมในช่วงที่เลือก ไม่ครอบคลุมการรับบริการนอกโรงพยาบาล · ถ้าไฟล์มีเพียงกลุ่มงาน จะใช้ชื่อกลุ่มงานเป็นแผนกด้วย</p>
    </section>}
  </div>;
}
