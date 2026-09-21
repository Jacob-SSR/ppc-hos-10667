"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import AgeRangeSlider from "@/app/components/AgeRangeSlider";
import { DEFAULT_AGE_RANGE, POPULATION_REPORT_TITLE } from "@/lib/population-report";
import { EMPTY_POPULATION_FILTERS, POPULATION_COLUMNS, filterPopulation, normalizeMoo, populationExportRows, sortPopulation, summarizePopulation, type PopulationFilters, type PopulationRow, type PopulationVillage } from "@/lib/population-report-view";
import { exportToExcel } from "@/lib/exportExcel";

const PAGE_SIZE = 50;
const control = "min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-green-700";
const button = "min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-green-700";

export default function PopulationReportPage() {
  const [ages, setAges] = useState<readonly [number, number]>(DEFAULT_AGE_RANGE);
  const [request, setRequest] = useState({ ages: DEFAULT_AGE_RANGE as readonly [number, number], revision: 0 });
  const [sliderKey, setSliderKey] = useState(0);
  const [result, setResult] = useState<{ rows: PopulationRow[]; villages: PopulationVillage[]; loading: boolean; error: string }>({ rows: [], villages: [], loading: true, error: "" });
  const [filters, setFilters] = useState<PopulationFilters>(EMPTY_POPULATION_FILTERS);
  const [sort, setSort] = useState({ key: "หมู่", ascending: true });
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ minAge: String(request.ages[0]), maxAge: String(request.ages[1]) });
    (async () => {
      try {
        const response = await fetch(`/api/population-report?${params}`, { credentials: "include", signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 403 ? "คุณไม่มีสิทธิ์เข้าถึงรายงานนี้" : response.status === 401 ? "กรุณาเข้าสู่ระบบใหม่" : "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
        const data = await response.json();
        if (!Array.isArray(data.rows) || !Array.isArray(data.villages)) throw new Error("รูปแบบข้อมูลไม่ถูกต้อง กรุณาลองใหม่");
        if (!controller.signal.aborted) setResult({ rows: data.rows, villages: data.villages, loading: false, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ rows: [], villages: [], loading: false, error: error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ" });
      }
    })();
    return () => controller.abort();
  }, [request]);

  const load = (range: readonly [number, number]) => {
    setResult(previous => ({ ...previous, rows: [], loading: true, error: "" }));
    setPage(1);
    setRequest(previous => ({ ages: [...range], revision: previous.revision + 1 }));
  };
  const updateFilters = (next: Partial<PopulationFilters>) => { setFilters(previous => ({ ...previous, ...next })); setPage(1); };
  const filtered = useMemo(() => filterPopulation(result.rows, filters), [result.rows, filters]);
  const sorted = useMemo(() => sortPopulation(filtered, sort.key, sort.ascending), [filtered, sort]);
  const summary = useMemo(() => summarizePopulation(filtered), [filtered]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const moos = [...new Set(result.villages.map(v => normalizeMoo(v.moo)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th", { numeric: true }));
  const villageOptions = result.villages.filter(v => !filters.moo || normalizeMoo(v.moo) === filters.moo);
  const chartMax = Math.max(1, ...summary.villages.flatMap(v => [v.male, v.female, v.unknown]));
  const pendingAge = ages[0] !== request.ages[0] || ages[1] !== request.ages[1];

  return (
    <div className="space-y-6 text-gray-900">
      <header className="space-y-2">
        <h1 className="text-xl font-bold">{POPULATION_REPORT_TITLE}</h1>
        <p className="text-sm text-gray-600">โรงพยาบาลพลับพลาชัย จ.บุรีรัมย์ · Type 1,3 · ไม่รวมผู้เสียชีวิตและผู้จำหน่ายจากบัญชี 1</p>
      </header>
      <section className="space-y-5 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5" aria-label="ตัวกรองประชากร">
        <div className="grid gap-6 lg:grid-cols-2">
          <AgeRangeSlider key={sliderKey} value={ages} onChange={setAges} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">หมู่
              <select className={control} value={filters.moo} onChange={e => updateFilters({ moo: e.target.value, village: "" })}>
                <option value="">ทุกหมู่</option>{moos.map(moo => <option key={moo} value={moo}>หมู่ {moo}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">หมู่บ้าน
              <select className={control} value={filters.village} onChange={e => updateFilters({ village: e.target.value })}>
                <option value="">ทุกหมู่บ้าน</option>{villageOptions.map(v => <option key={v.id} value={String(v.id)}>หมู่ {normalizeMoo(v.moo) || "ไม่ระบุ"} · {v.name || "ไม่ระบุชื่อ"} (รหัส {v.id})</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">เพศ
              <select className={control} value={filters.sex} onChange={e => updateFilters({ sex: e.target.value })}>
                <option value="">ทั้งสอง / ทุกเพศ</option><option>ชาย</option><option>หญิง</option><option>ไม่ระบุ</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">ประเภททะเบียน
              <select className={control} value={filters.type} onChange={e => updateFilters({ type: e.target.value })}>
                <option value="">Type 1 และ 3</option><option value="1">Type 1</option><option value="3">Type 3</option>
              </select>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={`${button} bg-green-800 text-white hover:bg-green-900`} onClick={() => load(ages)}>ค้นหา / ใช้ช่วงอายุ</button>
          <button type="button" className={button} onClick={() => { setFilters(EMPTY_POPULATION_FILTERS); setAges(DEFAULT_AGE_RANGE); setSliderKey(n => n + 1); setSort({ key: "หมู่", ascending: true }); load(DEFAULT_AGE_RANGE); }}>ล้างตัวกรองทั้งหมด</button>
          <span className="text-sm text-gray-600">ตัวกรองอื่นปรับกราฟและตารางทันที</span>
        </div>
      </section>
      <p className="text-sm text-gray-600">ช่วงอายุที่ใช้: {request.ages[0]}–{request.ages[1]} ปี{pendingAge && " · มีการเปลี่ยนช่วงอายุ กดค้นหาเพื่อใช้ค่าใหม่"}</p>
      {result.loading ? <p role="status" className="py-10 text-center">กำลังโหลดประชากร…</p> : result.error ? (
        <div role="alert" className="space-y-3 py-6"><p className="text-red-700">{result.error}</p><button className={button} onClick={() => load(request.ages)}>ลองใหม่</button></div>
      ) : <>
        <dl className="flex flex-wrap gap-x-10 gap-y-4 border-y border-gray-200 py-4" aria-label="สรุปประชากรตามตัวกรอง">
          {[["ประชากรรวม", summary.total], ["ชาย", summary.male], ["หญิง", summary.female], ["ไม่ระบุเพศ", summary.unknown]].map(([label, count]) => <div key={label}><dt className="text-sm text-gray-600">{label}</dt><dd className="text-2xl font-semibold tabular-nums">{Number(count).toLocaleString()} <span className="text-sm font-normal">คน</span></dd></div>)}
        </dl>
        {sorted.length === 0 ? <p role="status" className="py-10 text-center text-gray-600">ไม่พบประชากรตามตัวกรองที่เลือก ลองปรับช่วงอายุหรือคลิกล้างตัวกรองทั้งหมด</p> : (
          <section className="space-y-4" aria-labelledby="population-chart-title">
            <h2 id="population-chart-title" className="text-lg font-semibold">ลำดับหมู่บ้านตามจำนวนประชากร · แยกชาย–หญิง</h2>
            <p className="text-sm text-gray-600">เรียงจำนวนรวมจากมากไปน้อย · กราฟและตารางใช้ตัวกรองชุดเดียวกัน · แถบทุกหมู่บ้านใช้สเกลเดียวกัน</p>
            <div className="space-y-5">
              {summary.villages.map((v, index) => <div key={v.id} className="grid gap-2 sm:grid-cols-[minmax(160px,1fr)_2fr]">
                <p className="text-sm"><span className="font-semibold">{index + 1}. {v.label}</span><br /><span className="text-gray-500">รวม {v.total.toLocaleString()} คน</span></p>
                <div className="space-y-1">
                  {([['ชาย', v.male, 'bg-blue-700'], ['หญิง', v.female, 'bg-rose-600'], ...(v.unknown ? [['ไม่ระบุ', v.unknown, 'bg-gray-500']] : [])] as [string, number, string][]).map(([label, count, color]) => <div key={label} className="flex items-center gap-2 text-xs"><span className="w-12 shrink-0">{label}</span><div className="h-4 flex-1 rounded bg-gray-100" aria-hidden="true"><div className={`h-4 rounded ${color}`} style={{ width: `${count / chartMax * 100}%` }} /></div><span className="w-16 text-right tabular-nums">{count.toLocaleString()} คน</span></div>)}
                </div>
              </div>)}
            </div>
          </section>
        )}
        <section className="space-y-4" aria-label="รายชื่อประชากร">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">รายชื่อประชากร {sorted.length.toLocaleString()} คน</h2><button className={button} disabled={!sorted.length} onClick={() => exportToExcel(populationExportRows(sorted), { filePrefix: `target-population-${request.ages[0]}-${request.ages[1]}`, sheetName: "ประชากรกลุ่มเป้าหมาย", dateKeys: [] })}>ส่งออก Excel ตามตัวกรอง</button></div>
          <div role="search" aria-label="ค้นหารายชื่อประชากร" className="relative max-w-2xl">
            <Search aria-hidden="true" size={19} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="search" aria-label="ค้นหาประชากร" className={`${control} pl-10 pr-12 [&::-webkit-search-cancel-button]:appearance-none`} value={filters.search} onChange={e => updateFilters({ search: e.target.value })} placeholder="ค้นหาชื่อ, HN, CID, บ้านเลขที่ หรือที่อยู่…" />
            {filters.search && <button type="button" aria-label="ล้างคำค้นหา" onClick={() => updateFilters({ search: "" })} className="absolute right-0 top-0 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-green-700"><X size={18} aria-hidden="true" /></button>}
          </div>
          <div className="max-h-[600px] overflow-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">รายชื่อประชากรตามตัวกรอง อายุ {request.ages[0]}–{request.ages[1]} ปี</caption>
              <thead className="sticky top-0 bg-gray-50"><tr><th scope="col" className="p-3">ลำดับ</th>{POPULATION_COLUMNS.map(key => <th key={key} scope="col" className="whitespace-nowrap p-2" aria-sort={sort.key === key ? sort.ascending ? "ascending" : "descending" : "none"}><button className="min-h-11 w-full text-left font-semibold" onClick={() => { setSort({ key, ascending: sort.key === key ? !sort.ascending : true }); setPage(1); }}>{key}{sort.key === key ? sort.ascending ? " ↑" : " ↓" : ""}</button></th>)}</tr>
              </thead>
              <tbody>{visible.map((row, index) => <tr key={`${currentPage}-${index}`} className="border-t border-gray-100 odd:bg-white even:bg-gray-50"><td className="p-3 tabular-nums">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>{POPULATION_COLUMNS.map(key => <td key={key} className="whitespace-nowrap p-3">{row[key] ?? ""}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <nav aria-label="หน้ารายชื่อประชากร" className="flex flex-wrap items-center justify-end gap-3"><button className={button} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</button><span className="text-sm">หน้า {currentPage} / {totalPages}</span><button className={button} disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>ถัดไป</button></nav>
        </section>
      </>}
    </div>
  );
}
