"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { CalendarDays, Download, Search } from "lucide-react";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

type ClinicType = "DM" | "HT" | "CKD";
type AppointmentRow = { nextdate: string; count_val: number };
type AppointmentResponse = { clinicName: string; data: AppointmentRow[] };

const CLINICS: { type: ClinicType; label: string; code: string }[] = [
  { type: "DM", label: "เบาหวาน", code: "001" },
  { type: "HT", label: "ความดันโลหิตสูง", code: "002" },
  { type: "CKD", label: "โรคไต", code: "023" },
];

const numberFormatter = new Intl.NumberFormat("th-TH");
const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function displayDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

export default function AppointmentDashboardPage() {
  const [type, setType] = useState<ClinicType>("DM");
  const [start, setStart] = useState("2026-09-24");
  const [end, setEnd] = useState("2028-12-10");
  const [appliedRange, setAppliedRange] = useState({ start: "2026-09-24", end: "2028-12-10" });
  const [result, setResult] = useState<AppointmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (clinic: ClinicType, range: { start: string; end: string }, signal: AbortSignal) => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const params = new URLSearchParams({ type: clinic, start: range.start, end: range.end });
      const response = await fetch(`/api/appointment-dashboard?${params}`, { credentials: "include", signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "ไม่สามารถดึงข้อมูลได้");
      setResult(payload as AppointmentResponse);
    } catch (cause) {
      if (signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "ไม่สามารถดึงข้อมูลได้");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(type, appliedRange, controller.signal);
    return () => controller.abort();
  }, [type, appliedRange, load]);

  function applyFilter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!start || !end || start > end) {
      setError("กรุณาระบุช่วงวันที่ให้ถูกต้อง");
      return;
    }
    setAppliedRange({ start, end });
  }

  async function exportToExcel() {
    if (!result?.data.length) return;
    const XLSX = await import("xlsx");
    const rows = result.data.map((row) => ({
      "วันที่นัดหมาย": row.nextdate,
      "ชื่อคลินิก": result.clinicName,
      "จำนวนผู้ป่วย": row.count_val,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 18 }, { wch: 38 }, { wch: 18 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, type);
    XLSX.writeFile(workbook, `appointments_${type}_${appliedRange.start}_${appliedRange.end}.xlsx`);
  }

  const rows = result?.data ?? [];
  const total = rows.reduce((sum, row) => sum + row.count_val, 0);
  const peak = rows.reduce<AppointmentRow | null>((highest, row) =>
    !highest || row.count_val > highest.count_val ? row : highest, null);

  return (
    <div className="mx-auto max-w-7xl space-y-6 text-gray-800">
      <header className="border-b border-emerald-100 pb-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CalendarDays size={18} /> ข้อมูลการนัดหมาย
        </div>
        <h1 className="mt-2 text-2xl font-bold text-emerald-950 md:text-3xl">แดชบอร์ดวิเคราะห์การนัดหมายผู้ป่วย</h1>
        <p className="mt-1 text-sm text-gray-500">จำนวน VN ที่นัดหมาย แยกตามวันที่และคลินิก</p>
      </header>

      <form onSubmit={applyFilter} className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          ตั้งแต่วันที่
          <input aria-label="ตั้งแต่วันที่" type="date" value={start} max={end || undefined} onChange={(event) => setStart(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          ถึงวันที่
          <input aria-label="ถึงวันที่" type="date" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
          <Search size={16} /> กรองข้อมูล
        </button>
      </form>

      <div role="tablist" aria-label="เลือกคลินิก" className="flex flex-wrap gap-2">
        {CLINICS.map((clinic) => (
          <button key={clinic.type} role="tab" aria-selected={type === clinic.type} onClick={() => setType(clinic.type)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${type === clinic.type ? "border-emerald-700 bg-emerald-700 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-emerald-50"}`}>
            {clinic.label} <span className="opacity-75">{clinic.type} {clinic.code}</span>
          </button>
        ))}
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <section aria-label="สรุปการนัดหมาย" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm text-emerald-800">ยอดนัดหมายรวม</p>
          <p className="mt-1 text-3xl font-bold text-emerald-950">{loading ? "…" : numberFormatter.format(total)} <span className="text-base font-medium">VN</span></p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">วันที่มีนัดหมาย</p>
          <p className="mt-1 text-3xl font-bold text-gray-800">{loading ? "…" : numberFormatter.format(rows.length)} <span className="text-base font-medium">วัน</span></p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">วันที่นัดหมายสูงสุด</p>
          <p className="mt-1 text-lg font-bold text-gray-800">{loading ? "…" : peak ? displayDate(peak.nextdate) : "—"}</p>
          {peak && !loading && <p className="text-sm text-gray-500">{numberFormatter.format(peak.count_val)} VN</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="text-lg font-semibold text-gray-800">กราฟการนัดหมายรายวัน {result?.clinicName}</h2>
        <p className="mb-4 text-xs text-gray-500">เลื่อนในกราฟเพื่อดูวันที่เพิ่มเติม</p>
        {loading ? <p className="py-20 text-center text-gray-500">กำลังโหลดข้อมูล...</p> : rows.length ? (
          <div className="overflow-x-auto">
            <div style={{ width: Math.max(700, rows.length * 32), height: 320 }}>
              <Bar data={{ labels: rows.map((row) => displayDate(row.nextdate)), datasets: [{ data: rows.map((row) => row.count_val), backgroundColor: "#2d8a56", borderRadius: 4 }] }} options={{ maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false }, ticks: { maxRotation: 65, minRotation: 65 } } } }} />
            </div>
          </div>
        ) : <p className="py-20 text-center text-gray-500">{error ? "ไม่สามารถแสดงกราฟได้" : "ไม่พบข้อมูลในช่วงวันที่กำหนด"}</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 md:px-6">
          <div>
            <h2 className="font-semibold text-gray-800">ตารางข้อมูลรายละเอียด</h2>
            <p className="text-sm text-gray-500">{loading ? "กำลังโหลด..." : `แสดง ${numberFormatter.format(rows.length)} รายการ`}</p>
          </div>
          <button type="button" onClick={() => void exportToExcel()} disabled={loading || rows.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
            <Download size={16} /> ส่งออก Excel (.xlsx)
          </button>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="sticky top-0 bg-emerald-700 text-white"><tr><th scope="col" className="px-5 py-3">วันที่นัดหมาย</th><th scope="col" className="px-5 py-3">ชื่อคลินิก</th><th scope="col" className="px-5 py-3 text-right">จำนวนผู้ป่วย (VN)</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => <tr key={row.nextdate} className="hover:bg-emerald-50"><td className="px-5 py-3">{displayDate(row.nextdate)}</td><td className="px-5 py-3">{result?.clinicName}</td><td className="px-5 py-3 text-right font-semibold text-emerald-800">{numberFormatter.format(row.count_val)}</td></tr>)}
              {!loading && rows.length === 0 && <tr><td colSpan={3} className="px-5 py-10 text-center text-gray-500">{error ? "ไม่สามารถแสดงข้อมูลได้" : "ไม่พบข้อมูลในช่วงวันที่กำหนด"}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
