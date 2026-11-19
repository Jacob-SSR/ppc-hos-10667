"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Smile } from "lucide-react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { fmtDate, getBangkokToday, toThaiDate, toThaiDateLabel } from "@/lib/thaiDate";
import { staffDentalExport, STAFF_DENTAL_STATUS, STAFF_DENTAL_TITLE, type StaffDentalReport, type StaffDentalRow, type StaffDentalDepartment } from "@/lib/staff-dental";

const button = "min-h-10 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40";
type View = "not_done" | "done" | "unresolved" | "all";
function Table({ rows }: { rows: StaffDentalRow[] }) {
  return <div className="overflow-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-left text-sm">
    <thead className="bg-slate-700 text-white"><tr>{["ชื่อ–นามสกุล", "ลำดับ", "ทำแล้ว", "ยังไม่ทำ", "ตำแหน่ง", "กลุ่มงาน/ฝ่าย", "หน่วยงาน", "แผนกที่พบ visit", "HN", "visit", "วันที่ล่าสุด", "สถานะ"].map(label => <th key={label} className="whitespace-nowrap px-4 py-3" scope="col">{label}</th>)}</tr></thead>
    <tbody>{rows.map(r => <tr key={r.id} className="border-b border-gray-100 even:bg-gray-50"><td className="whitespace-nowrap px-4 py-3 font-medium">{r.name}</td><td className="px-4 py-3 font-mono">{r.rosterNo ?? r.id}</td><td className="px-4 py-3 text-center"><input type="checkbox" checked={r.status === "done"} disabled aria-label={`ทำแล้ว: ${r.name}`} className="h-4 w-4 accent-green-700 disabled:opacity-100" /></td><td className="px-4 py-3 text-center"><input type="checkbox" checked={r.status === "not_done"} disabled aria-label={`ยังไม่ทำ: ${r.name}`} className="h-4 w-4 accent-amber-700 disabled:opacity-100" /></td><td className="min-w-48 px-4 py-3">{r.group}</td><td className="min-w-48 px-4 py-3">{r.staffDepartment}</td><td className="min-w-48 px-4 py-3">{r.unit}</td><td className="min-w-48 px-4 py-3">{r.serviceDepartments || "—"}</td><td className="px-4 py-3 font-mono">{r.matchedHn ?? "—"}</td><td className="px-4 py-3 text-right tabular-nums">{r.visits ?? "—"}</td><td className="whitespace-nowrap px-4 py-3">{r.lastVisit ? toThaiDate(r.lastVisit) : "—"}</td><td className={`min-w-52 px-4 py-3 ${r.status === "done" ? "text-green-800" : r.status === "not_done" ? "text-amber-800" : "text-red-700"}`}>{STAFF_DENTAL_STATUS[r.status]}</td></tr>)}</tbody>
  </table>{!rows.length && <p className="p-8 text-center text-sm text-gray-500">ไม่พบรายชื่อในตัวกรองนี้</p>}</div>;
}
export default function StaffDentalPage() {
  const [start, setStart] = useState(() => new Date(getBangkokToday().getFullYear(), 0, 1));
  const [end, setEnd] = useState(getBangkokToday);
  const [result, setResult] = useState<StaffDentalReport | null>(null);
  const [view, setView] = useState<View>("not_done");
  const [group, setGroup] = useState("");
  const [staffDepartment,setStaffDepartment] = useState("");
  const [unit,setUnit] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [departments,setDepartments] = useState<StaffDentalDepartment[]>([]);
  const [departmentCode,setDepartmentCode] = useState("");
  const [catalogLoading,setCatalogLoading] = useState(true);
  const [catalogError,setCatalogError] = useState("");
  const [catalogRetry,setCatalogRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(()=>{
    const controller=new AbortController();
    async function load(){
      setCatalogLoading(true);setCatalogError("");
      try {
        const response=await fetch("/api/staff-dental",{signal:controller.signal,cache:"no-store"});
        const data=await response.json();
        if(!response.ok)throw Error(data.error || "โหลดแผนกรับบริการไม่สำเร็จ");
        if(!controller.signal.aborted)setDepartments(data.departments);
      }catch(e){if(!controller.signal.aborted)setCatalogError(e instanceof Error?e.message:"โหลดแผนกรับบริการไม่สำเร็จ");}
      finally{if(!controller.signal.aborted)setCatalogLoading(false);}
    }
    void load();return()=>controller.abort();
  },[catalogRetry]);

  async function loadReport() {
    if (start > end) { setError("วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด"); return; }
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/staff-dental", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start: fmtDate(start), end: fmtDate(end),departmentCode }), signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "ดึงรายงานไม่สำเร็จ");
      if (!controller.signal.aborted) { setResult(data); setGroup(""); setStaffDepartment(""); setUnit(""); setView("not_done"); }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "ดึงรายงานไม่สำเร็จ"); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  const dirty = !!result && (result.start !== fmtDate(start) || result.end !== fmtDate(end) || (result.departmentCode || "") !== departmentCode);
  const groups = useMemo(() => [...new Set(result?.rows.map(r => r.group) ?? [])], [result]);
  const staffDepartments = useMemo(()=>[...new Set(result?.rows.map(r=>r.staffDepartment || "ไม่ระบุกลุ่มงาน") ?? [])],[result]);
  const units = useMemo(()=>[...new Set(result?.rows.filter(r=>!staffDepartment || r.staffDepartment===staffDepartment).map(r=>r.unit || "ไม่ระบุหน่วยงาน") ?? [])],[result,staffDepartment]);
  const scoped = useMemo(() => result?.rows.filter(r => (!group || r.group === group) && (!staffDepartment || r.staffDepartment===staffDepartment) && (!unit || r.unit===unit)) ?? [], [result,group,staffDepartment,unit]);
  const counts = { all: scoped.length, not_done: scoped.filter(r => r.status === "not_done").length, done: scoped.filter(r => r.status === "done").length, unresolved: scoped.filter(r => !["done","not_done"].includes(r.status)).length };
  const visible = scoped.filter(r => (view === "all" || (view === "unresolved" ? !["done","not_done"].includes(r.status) : r.status === view)) && (!search.trim() || `${r.name} ${r.matchedHn ?? ""}`.includes(search.trim()))).sort((a,b) => a.group.localeCompare(b.group,"th") || a.name.localeCompare(b.name,"th"));
  async function exportExcel() {
    if (!result) return;
    setExporting(true); setError("");
    try {
      const XLSX = await import("xlsx");
      const data = staffDentalExport(result), book = XLSX.utils.book_new();
      const columns = ["วันที่เริ่ม","วันที่สิ้นสุด","แผนกรับบริการที่เลือก","ลำดับ","กลุ่มงาน_ฝ่าย","หน่วยงาน","ตำแหน่ง","ชื่อ_นามสกุล","HN","ทำแล้ว","ยังไม่ทำ","จำนวน_visit","แผนกที่พบ_visit","วันที่ครั้งแรก","วันที่ล่าสุด","สถานะ"];
      for (const [name, rows, header] of [["ยังไม่พบ visit",data.unfinished,columns],["สรุปกลุ่มงานหน่วยงาน",data.groups,undefined],["บุคลากรทั้งหมด",data.all,columns],["ต้องตรวจสอบ",data.unresolved,columns]] as const) {
        const sheet = XLSX.utils.json_to_sheet(rows, header ? { header: [...header] } : {});
        sheet["!cols"] = (header ?? Object.keys(rows[0] ?? {})).map(key => ({ wch: ["กลุ่มงาน_ฝ่าย","หน่วยงาน","ตำแหน่ง","แผนกรับบริการที่เลือก","แผนกที่พบ_visit","ชื่อ_นามสกุล","สถานะ"].includes(key) ? 40 : 18 }));
        if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] };
        XLSX.utils.book_append_sheet(book,sheet,name);
      }
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
        ["รายงาน",STAFF_DENTAL_TITLE],["รายชื่อหลัก","ทะเบียนบุคลากร HR: INFOMATION_PERSON; ตำแหน่ง/หน่วยงาน/กลุ่มงานตามทะเบียน"],["วันที่เริ่ม",result.start],["วันที่สิ้นสุด",result.end],["ข้อมูล ณ",result.updatedAt],
        ["แผนกรับบริการที่เลือก",result.departmentName || "ทุกแผนก"],["รหัสแผนก",result.departmentCode || "ทั้งหมด"],
        ["การกรองแผนก","kskdepartment.depcode = ovst.cur_dep เหมือน incomplete-visit; เมื่อเลือกแผนก สถานะ/visit หมายถึงบริการเฉพาะแผนกนั้น รายชื่อหลักมาจากทะเบียนบุคลากร HR ทั้งหมด; แผนกรับบริการแยกจากกลุ่มงานสังกัด"],
        ["เกณฑ์","นับ VN ไม่ซ้ำที่มีรายการค่าบริการจากบุคลากรทันตกรรม position_id 2 หรือ 6 ตามรายงานทันตกรรมเดิม"],
        ["ยังไม่พบ visit","จับคู่ตัวบุคคลได้ แต่ไม่พบ visit ทันตกรรมในช่วงที่เลือก"],
        ["เครื่องหมาย ✓","ระบบติ๊กทำแล้วเมื่อพบ visit และติ๊กยังไม่ทำเมื่อยืนยันตัวบุคคลได้แต่ไม่พบ visit ในช่วงที่เลือก; ต้องตรวจสอบไม่ติ๊กทั้งสองช่อง"],
        ["ต้องตรวจสอบ","ไม่พบทะเบียนผู้ป่วย ชื่อซ้ำหลาย HN หรือ CID/HN ซ้ำหลายรายชื่อ ไม่ถือว่าเป็นผู้ยังไม่ได้รับบริการ"],
        ["ขอบเขตส่งออก","บุคลากรทั้งหมดตามวันที่และแผนกรับบริการของผลรายงาน ไม่จำกัดกลุ่มงาน หน่วยงาน ตำแหน่ง หรือสถานะที่กรองบนหน้าจอ"],
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
    <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h1 className="flex items-center gap-2 text-lg font-bold"><Smile size={22} className="text-green-700" />{STAFF_DENTAL_TITLE}</h1><p className="mt-2 text-sm text-gray-500">ค้นหาผู้ที่ยังไม่พบ visit ทันตกรรมในช่วงวันที่ แยกกลุ่มงาน หน่วยงาน และตำแหน่งจากทะเบียนบุคลากร</p></header>
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="เงื่อนไขรายงาน">
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1 text-sm"><span className="block">วันที่เริ่ม</span><DatePicker selected={start} onChange={(d: Date | null) => d && setStart(d)} locale={th} dateFormat="dd/MM/yyyy" showMonthDropdown showYearDropdown dropdownMode="select" customInput={<ThaiDateInput />} /></label>
        <label className="space-y-1 text-sm"><span className="block">วันที่สิ้นสุด</span><DatePicker selected={end} onChange={(d: Date | null) => d && setEnd(d)} locale={th} dateFormat="dd/MM/yyyy" showMonthDropdown showYearDropdown dropdownMode="select" customInput={<ThaiDateInput />} /></label>
        <button className={button} onClick={() => { const today = getBangkokToday(); setStart(new Date(today.getFullYear(),0,1)); setEnd(today); }}>1 ม.ค. – วันนี้</button>
        <label className="space-y-1 text-sm"><span className="block">แผนกรับบริการ</span><select value={departmentCode} onChange={e=>setDepartmentCode(e.target.value)} aria-label="แผนกรับบริการ" disabled={catalogLoading} className={`${button} max-w-80 bg-white`}><option value="">ทุกแผนก</option>{departments.map(d=><option key={d.code} value={d.code}>{d.name} [{d.code}]</option>)}</select></label>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-4">
        <button className={`${button} border-green-700 bg-green-700 text-white`} disabled={loading || catalogLoading || !!catalogError} onClick={loadReport}>{loading ? "กำลังตรวจสอบกับ HOSxP…" : "ตรวจสอบผู้ที่ยังไม่ได้ทำฟัน"}</button>
        <p className="text-sm text-gray-500">ใช้ทะเบียนบุคลากร HR ที่นำเข้าไว้ ไม่ต้องเลือกไฟล์รายชื่อซ้ำ</p>
      </div>
      <p className="text-xs leading-relaxed text-gray-500">จับคู่ผู้ป่วยด้วย CID ก่อน ใช้ชื่อเฉพาะรายการที่ไม่มี CID · รหัสบุคคลซ้ำแยกไว้ตรวจสอบ</p>
      {catalogLoading && <p role="status" className="text-sm text-gray-500">กำลังโหลดแผนกรับบริการ…</p>}
      {catalogError && <p role="alert" className="text-sm text-red-700">{catalogError} <button className={button} onClick={()=>setCatalogRetry(n=>n+1)}>โหลดแผนกใหม่</button></p>}
    </section>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {result && <section className="space-y-4" aria-label="ผลรายงาน">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">ผลตรวจสอบ {toThaiDateLabel(result.start,result.end)}</h2><p className="mt-1 text-xs text-gray-500">รายชื่อจากทะเบียนบุคลากร HR · จำนวน visit ตาม VN ไม่ซ้ำ</p></div><button className={button} onClick={exportExcel} disabled={loading || dirty || exporting}><Download size={16} className="mr-2 inline" />{exporting ? "กำลังส่งออก…" : "Excel ทั้งรายงาน"}</button></div>
      <p className="text-sm font-medium">แผนกรับบริการของผลรายงาน: {result.departmentName || "ทุกแผนก"}</p>
      <p className="text-xs text-gray-500">เมื่อเลือกแผนก เครื่องหมายและจำนวน visit อ้างอิงเฉพาะแผนกนั้นในช่วงวันที่ที่เลือก รายชื่อหลักเป็นบุคลากรในทะเบียน HR; กลุ่มงานและหน่วยงานคือสังกัดของบุคลากร</p>
      {dirty && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">เปลี่ยนวันที่หรือแผนกแล้ว กรุณากดตรวจสอบอีกครั้ง ผลด้านล่างยังเป็นเงื่อนไขเดิม</p>}
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">กลุ่มงาน/ฝ่าย<select aria-label="กลุ่มงานบุคลากร" value={staffDepartment} onChange={e=>{setStaffDepartment(e.target.value);setUnit("");}} className={`${button} ml-2 max-w-80 bg-white`}><option value="">ทั้งหมด</option>{staffDepartments.map(d=><option key={d}>{d}</option>)}</select></label>
        <label className="text-sm">หน่วยงาน<select aria-label="หน่วยงานบุคลากร" value={unit} onChange={e=>setUnit(e.target.value)} className={`${button} ml-2 max-w-80 bg-white`}><option value="">ทั้งหมด</option>{units.map(u=><option key={u}>{u}</option>)}</select></label>
        <label className="text-sm">ตำแหน่ง<select aria-label="ตำแหน่งเจ้าหน้าที่" value={group} onChange={e => { setGroup(e.target.value); }} className={`${button} ml-2 max-w-80 bg-white`}><option value="">ทั้งหมด</option>{groups.map(g => <option key={g}>{g}</option>)}</select></label>
        <label className="text-sm">สถานะ<select value={view} onChange={e => setView(e.target.value as View)} aria-label="สถานะการทำฟัน" className={`${button} ml-2 bg-white`}><option value="not_done">ยังไม่ทำ (ไม่พบ visit)</option><option value="done">ทำแล้ว (มี visit)</option><option value="unresolved">ต้องตรวจสอบตัวบุคคล</option><option value="all">ทั้งหมด — ทำแล้วและยังไม่ทำ</option></select></label>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{([["not_done","ยังไม่ทำ (ไม่พบ visit)"],["done","ทำแล้ว (มี visit)"],["unresolved","ต้องตรวจสอบชื่อ"],["all","บุคลากรทั้งหมด"]] as const).map(([key,label]) => <button key={key} aria-pressed={view===key} onClick={()=>setView(key)} className={`rounded-xl border p-4 text-left ${view===key ? "border-green-700 bg-green-50 ring-1 ring-green-700" : "border-gray-200 bg-white"}`}><span className="text-sm">{label}</span><span className="mt-2 block text-2xl font-semibold tabular-nums">{counts[key]} <span className="text-sm font-normal">คน</span></span></button>)}</div>
      {!!counts.unresolved && <p className="text-sm text-red-700">ต้องตรวจสอบตัวบุคคล {counts.unresolved} คน แยกจากผู้ยังไม่พบ visit กรุณาตรวจ CID ชื่อ และข้อมูลซ้ำในทะเบียนบุคลากร/patient แล้วกดตรวจสอบใหม่</p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{view === "not_done" ? "ยังไม่ทำ — ไม่พบ visit ทันตกรรม" : view === "done" ? "ทำแล้ว — มี visit ทันตกรรม" : view === "unresolved" ? "รายชื่อที่ต้องตรวจสอบตัวบุคคล" : "รายชื่อทั้งหมด"} ({visible.length} คน)</h3><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาชื่อหรือ HN" aria-label="ค้นหาชื่อหรือ HN" className={`${button} min-w-64`} /></div>
      <Table rows={visible} />
      <p className="text-xs text-gray-500">เครื่องหมายติ๊กแสดงอัตโนมัติจาก visit ในช่วงที่เลือก แก้ไขเองไม่ได้ · คนที่ต้องตรวจสอบจะไม่ติ๊กทั้งสองช่อง</p>
      <div className="overflow-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-left text-sm"><caption className="p-4 text-left font-semibold">สรุปกลุ่มงาน/หน่วยงาน/ตำแหน่ง · กดเพื่อดูรายชื่อ</caption><thead className="bg-gray-100"><tr>{["กลุ่มงาน/ฝ่าย","หน่วยงาน","ตำแหน่ง","ทั้งหมด (คน)","รับบริการแล้ว","ยังไม่พบ visit","ต้องตรวจสอบ","visit รวม"].map(h=><th scope="col" className="whitespace-nowrap px-4 py-3" key={h}>{h}</th>)}</tr></thead><tbody>{result.groups.filter(g=>(!group||g.group===group)&&(!staffDepartment||g.staffDepartment===staffDepartment)&&(!unit||g.unit===unit)).map(g=><tr key={JSON.stringify([g.staffDepartment,g.unit,g.group])} className="border-t border-gray-100"><td className="px-4 py-3">{g.staffDepartment}</td><td className="px-4 py-3">{g.unit}</td><td className="px-4 py-3"><button className="text-left text-green-800 underline underline-offset-2" onClick={()=>{setGroup(g.group);setStaffDepartment(g.staffDepartment);setUnit(g.unit);setView("not_done");}}>{g.group}</button></td>{[g.staff,g.done,g.notDone,g.unresolved,g.visits].map((v,i)=><td key={i} className="px-4 py-3 text-right tabular-nums">{v}</td>)}</tr>)}</tbody></table></div>
      <p className="text-xs leading-relaxed text-gray-500">“ยังไม่พบ visit” หมายถึงจับคู่กับทะเบียนผู้ป่วยได้ แต่ไม่พบ visit ที่มีรายการค่าบริการจากบุคลากรทันตกรรมตามเกณฑ์รายงานทันตกรรมเดิมในช่วงที่เลือก ไม่ครอบคลุมการรับบริการนอกโรงพยาบาล · ตำแหน่ง หน่วยงาน และกลุ่มงานตามทะเบียนบุคลากร HR</p>
    </section>}
  </div>;
}
