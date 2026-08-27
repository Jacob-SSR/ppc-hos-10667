// app/pages/d506-dashboard/page.tsx
// D506 Dashboard — อ่านทะเบียนคุมผู้ป่วยโรค 506 จาก Google Sheet (ผ่าน /api/d506-sheets)
// พอร์ตจากต้นฉบับ D506_Dashboard.html มาเป็น React + recharts ธีมมิ้นต์ให้เข้ากับทั้งเว็บ
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import {
  Users, Hospital, Stethoscope, Microscope, Send, Clock,
  RefreshCw, X, Printer, Search, FileDown, BarChart3,
  MapPin, CalendarDays, FlaskConical, Check, HelpCircle, XCircle,
} from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";
import { usePagination } from "@/hooks/usePagination";
import type { D506Row } from "@/lib/d506Sheets.service";
import Form506 from "./Form506";

interface Payload {
  updatedAt: string;
  sheetName: string;
  rowCount: number;
  rows: D506Row[];
}

// ── ธีมมิ้นต์ (ให้ตรงกับทั้งเว็บ) ─────────────────────────────────────────────
const MINT = "#1a5233";
const MINT_ACCENT = "#3aa36a";
const MINT_BORDER = "#cfe7d8";
// จานสีกราฟจำแนกโรค (เขียวมิ้นต์นำ + สีรองที่ยังอ่านง่าย)
const PALETTE = [
  "#1a5233", "#3aa36a", "#2c7a7b", "#b7791f", "#805ad5",
  "#c05621", "#2b6cb0", "#276749", "#c53030", "#55b882",
];

// ─── helpers ──────────────────────────────────────────────────────────────────
function parseThaiDate(str: string): Date | null {
  if (!str || !str.trim()) return null;
  const [d, m, y] = str.trim().split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y > 2500 ? y - 543 : y, m - 1, d);
}
/** "YYYY-MM-DD" จาก <input type="date"> → Date เวลาท้องถิ่น (00:00 น.)
 *  ห้ามใช้ new Date("YYYY-MM-DD") ตรง ๆ เพราะ JS ตีเป็น UTC เที่ยงคืน
 *  พอเทียบกับวันที่ในชีต (ที่ parse เป็นเวลาท้องถิ่น) เขต +07:00 จะเลื่อนไป 1 วัน
 *  ทำให้แถวของ "วันเริ่มช่วง" หลุดตัวกรองทั้งหมด */
function parseInputDate(str: string, endOfDay = false): Date | null {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return null;
  return endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
}
const uniqSorted = (vals: string[]) =>
  [...new Set(vals.map((v) => (v || "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "th", { numeric: true }),
  );

// ─── badges ───────────────────────────────────────────────────────────────────
function Badge({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cls}`}>{children}</span>;
}
function ptypeBadge(v: string) {
  const t = (v || "").trim().toUpperCase();
  if (t === "IPD") return <Badge cls="bg-rose-100 text-rose-700">IPD</Badge>;
  if (t === "OPD") return <Badge cls="bg-sky-100 text-sky-700">OPD</Badge>;
  return t ? <Badge cls="bg-gray-100 text-gray-600">{t}</Badge> : <span className="text-gray-300">—</span>;
}
function labBadge(v: string) {
  const t = (v || "").trim();
  if (t.includes("ไม่ยืนยัน")) return <Badge cls="bg-emerald-50 text-emerald-700"><XCircle size={11} /> ไม่ยืนยัน</Badge>;
  if (t.includes("ยืนยัน")) return <Badge cls="bg-emerald-100 text-emerald-700"><Check size={11} /> ยืนยัน</Badge>;
  if (t.includes("สงสัย")) return <Badge cls="bg-amber-100 text-amber-800"><HelpCircle size={11} /> สงสัย</Badge>;
  return t ? <Badge cls="bg-gray-100 text-gray-600">{t}</Badge> : <span className="text-gray-300">—</span>;
}
function statusBadge(v: string) {
  const t = (v || "").trim();
  if (t.includes("รักษาอยู่")) return <Badge cls="bg-violet-100 text-violet-700">รักษาอยู่</Badge>;
  if (t.includes("เสียชีวิต")) return <Badge cls="bg-rose-100 text-rose-700">เสียชีวิต</Badge>;
  if (t.includes("จำหน่าย")) return <Badge cls="bg-gray-200 text-gray-600">จำหน่าย</Badge>;
  return t ? <Badge cls="bg-gray-100 text-gray-600">{t}</Badge> : <span className="text-gray-300">—</span>;
}
function d506Badge(v: string) {
  return (v || "").trim()
    ? <Badge cls="bg-emerald-100 text-emerald-700"><Check size={11} /> ส่งแล้ว</Badge>
    : <Badge cls="bg-amber-100 text-amber-800"><Clock size={11} /> รอส่ง</Badge>;
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function Kpi({ icon: Icon, label, value, sub, bg, accent, onClick }: {
  icon: React.ElementType; label: string; value: number | string; sub?: string;
  bg: string; accent: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="text-left rounded-2xl p-4 flex flex-col gap-2 transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-default"
      style={{ backgroundColor: bg }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: accent + "22" }}>
        <Icon size={18} style={{ color: accent }} strokeWidth={1.8} />
      </div>
      <span className="text-[11px] font-bold tracking-wide" style={{ color: accent }}>{label}</span>
      <span className="text-2xl font-extrabold tabular-nums" style={{ color: accent }}>{value}</span>
      <span className="text-[11px]" style={{ color: accent + "99" }}>{sub ?? "ราย"}</span>
    </button>
  );
}

export default function D506DashboardPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fDisease, setFDisease] = useState("");
  const [fTambon, setFTambon] = useState("");
  const [fType, setFType] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fLab, setFLab] = useState("");
  const [fLabType, setFLabType] = useState("");
  const [fD506, setFD506] = useState("");
  const [fSearch, setFSearch] = useState("");

  // sort + tab + print
  const [sortKey, setSortKey] = useState<"seq" | "date" | "sex" | "age" | "disease" | null>("seq");
  const [sortDir, setSortDir] = useState(1);
  const [tab, setTab] = useState<"patient" | "lab">("patient");
  const [printRow, setPrintRow] = useState<D506Row | null>(null);

  async function loadData(force = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/d506-sheets${force ? "?refresh=1" : ""}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadData(); }, []);

  const rows = useMemo(() => data?.rows ?? [], [data]);

  const diseaseOpts = useMemo(() => uniqSorted(rows.map((r) => r.disease)), [rows]);
  const tambonOpts = useMemo(() => uniqSorted(rows.map((r) => r.tambon)), [rows]);
  const statusOpts = useMemo(() => uniqSorted(rows.map((r) => r.status)), [rows]);
  const labTypeOpts = useMemo(() => uniqSorted(rows.map((r) => r.labType)), [rows]);

  // ── filter ──
  const filtered = useMemo(() => {
    const start = parseInputDate(fStart);
    const end = parseInputDate(fEnd, true);
    const q = fSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (start || end) {
        const d = parseThaiDate(r.reportDate);
        if (d) {
          if (start && d < start) return false;
          if (end && d > end) return false;
        }
      }
      if (fDisease && r.disease !== fDisease) return false;
      if (fTambon && r.tambon.trim() !== fTambon) return false;
      if (fType && r.ptype.trim().toUpperCase() !== fType) return false;
      if (fStatus && r.status.trim() !== fStatus) return false;
      if (fLab && !r.lab.includes(fLab)) return false;
      if (fLabType && r.labType.trim() !== fLabType) return false;
      if (fD506 === "sent" && !r.d506Date.trim()) return false;
      if (fD506 === "pending" && r.d506Date.trim()) return false;
      if (q) {
        const target = [r.fname, r.lname, r.hn, r.pid].join(" ").toLowerCase();
        if (!target.includes(q)) return false;
      }
      return true;
    });
  }, [rows, fStart, fEnd, fDisease, fTambon, fType, fStatus, fLab, fLabType, fD506, fSearch]);

  // ── sort ──
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      if (sortKey === "seq") return (+a.seq - +b.seq) * sortDir;
      if (sortKey === "age") return ((+a.age || 0) - (+b.age || 0)) * sortDir;
      if (sortKey === "date") {
        const av = parseThaiDate(a.reportDate)?.getTime() ?? 0;
        const bv = parseThaiDate(b.reportDate)?.getTime() ?? 0;
        return (av - bv) * sortDir;
      }
      const av = sortKey === "disease" ? a.disease : a.sex;
      const bv = sortKey === "disease" ? b.disease : b.sex;
      return av.localeCompare(bv, "th") * sortDir;
    });
  }, [filtered, sortKey, sortDir]);

  const { page, setPage, totalPages, paged } = usePagination(sorted, 20);

  // ── KPIs ──
  const kpi = useMemo(() => {
    const total = filtered.length;
    const ipd = filtered.filter((r) => r.ptype.trim().toUpperCase() === "IPD").length;
    const opd = filtered.filter((r) => r.ptype.trim().toUpperCase() === "OPD").length;
    const lab = filtered.filter((r) => r.lab.includes("ยืนยัน")).length;
    const d506 = filtered.filter((r) => r.d506Date.trim()).length;
    return { total, ipd, opd, lab, d506, pending: total - d506 };
  }, [filtered]);

  // ── chart data ──
  const diseaseChart = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach((r) => { const d = r.disease.trim(); if (d) m[d] = (m[d] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [filtered]);

  const tambonChart = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach((r) => { const t = r.tambon.trim(); if (t) m[t] = (m[t] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 12)
      .map(([name, count]) => ({ name, count }));
  }, [filtered]);

  const timelineChart = useMemo(() => {
    const weeks: Record<string, number> = {};
    filtered.forEach((r) => {
      const d = parseThaiDate(r.reportDate);
      if (!d) return;
      const day = d.getDay();
      const mon = new Date(d);
      mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      const key = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
      weeks[key] = (weeks[key] || 0) + 1;
    });
    return Object.entries(weeks).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, count]) => {
        const [, m, d] = k.split("-");
        return { name: `${Number(d)}/${Number(m)}`, count };
      });
  }, [filtered]);

  const labRows = useMemo(
    () => filtered.filter((r) =>
      r.lab.trim() || r.labType.trim() || r.labSendDate.trim() ||
      r.labResultDate.trim() || r.organism.trim()),
    [filtered],
  );

  // ── active filter chips ──
  const chips = ([
    ["โรค", fDisease, () => setFDisease("")],
    ["ตำบล", fTambon, () => setFTambon("")],
    ["ประเภท", fType, () => setFType("")],
    ["สถานะ", fStatus, () => setFStatus("")],
    ["ผล Lab", fLab, () => setFLab("")],
    ["ชนิดแลป", fLabType, () => setFLabType("")],
    ["D506", fD506 === "sent" ? "ส่งแล้ว" : fD506 === "pending" ? "รอส่ง" : "", () => setFD506("")],
    ["ตั้งแต่", fStart, () => setFStart("")],
    ["ถึง", fEnd, () => setFEnd("")],
    ["ค้นหา", fSearch, () => setFSearch("")],
  ] as [string, string, () => void][]).filter(([, v]) => v);

  function clearAll() {
    setFStart(""); setFEnd(""); setFDisease(""); setFTambon(""); setFType("");
    setFStatus(""); setFLab(""); setFLabType(""); setFD506(""); setFSearch("");
  }
  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortDir((d) => -d);
    else { setSortKey(k); setSortDir(1); }
  }

  function exportPatients() {
    const out = sorted.map((r, i) => ({
      "ลำดับที่": i + 1, "วันที่รับรายงาน": r.reportDate, HN: r.hn,
      "เลขบัตรประชาชน": r.pid, "คำนำหน้า": r.prefix, "ชื่อ": r.fname, "สกุล": r.lname,
      "เพศ": r.sex, "วัน/เดือน/ปีเกิด": r.dob, "อายุ(ปี)": r.age, "บ้านเลขที่/หมู่": r.addr,
      "ตำบล": r.tambon, "อำเภอ": r.amphoe, "จังหวัด": r.province, "วันที่เริ่มป่วย": r.onsetDate,
      "โรคที่วินิจฉัย": r.disease, "รหัสโรค 506": r.code506, "รหัส ICD-10": r.icd10,
      "ประเภทผู้ป่วย": r.ptype, "ชนิดแลป": r.labType, "ผล Lab": r.lab,
      "วันที่ส่งตัวอย่าง": r.labSendDate, "วันที่ได้ผล Lab": r.labResultDate,
      "ชนิดเชื้อ/ผลเพาะเลี้ยง": r.organism, "สถานะผู้ป่วย": r.status,
      "วันที่จำหน่าย": r.dischargeDate, "ผลการรักษา": r.outcome,
      "วันที่ส่ง D506 API": r.d506Date, "หมายเหตุ": r.remark, "เสียชีวิต": r.death,
    }));
    exportToExcel(out, { filePrefix: "d506_รายชื่อผู้ป่วย", sheetName: "รายชื่อผู้ป่วย 506", dateKeys: [] });
  }

  const selCls =
    "px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-[#3aa36a] focus:ring-2 focus:ring-[#a8d5ba]";

  return (
    <div className="p-4 md:p-6 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: MINT_ACCENT + "22" }}>
            <BarChart3 size={22} style={{ color: MINT }} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: MINT }}>D506 Dashboard — ระบาดวิทยา</h1>
            <p className="text-xs text-gray-400">โรงพยาบาลพลับพลาชัย · ระบบติดตามโรคที่ต้องรายงาน (506)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {loading ? "กำลังโหลด..." : error ? "โหลดไม่ได้" : `${data?.rowCount ?? 0} ราย`}
          </span>
          <button onClick={() => loadData(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-semibold hover:brightness-110"
            style={{ backgroundColor: MINT }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> รีโหลด
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl p-16 text-center text-gray-500 shadow-sm">
          <RefreshCw className="animate-spin mx-auto mb-3" style={{ color: MINT_ACCENT }} /> กำลังโหลดข้อมูลจาก Google Sheets…
        </div>
      )}

      {error && !loading && (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <XCircle size={40} className="mx-auto mb-2 text-rose-500" />
          <div className="text-rose-600 font-bold mb-1">โหลดข้อมูลไม่ได้</div>
          <div className="text-gray-500 text-sm">{error}</div>
          <div className="text-gray-400 text-xs mt-2">
            ตรวจสอบว่า service account มีสิทธิ์อ่าน Google Sheet และตั้ง D506_SPREADSHEET_ID ใน .env แล้ว
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* active chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {chips.map(([label, val, clear]) => (
                <button key={label} onClick={clear}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border"
                  style={{ backgroundColor: "#f0faf4", color: MINT, borderColor: MINT_BORDER }}>
                  {label}: {val} <X size={11} />
                </button>
              ))}
            </div>
          )}

          {/* Filter bar */}
          <div className="bg-white rounded-2xl shadow-sm p-3 mb-4 flex flex-wrap gap-2 items-end">
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-gray-400">วันที่เริ่ม
              <input type="date" value={fStart} onChange={(e) => setFStart(e.target.value)} className={selCls} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-gray-400">วันที่สิ้นสุด
              <input type="date" value={fEnd} onChange={(e) => setFEnd(e.target.value)} className={selCls} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-gray-400">โรค
              <select value={fDisease} onChange={(e) => setFDisease(e.target.value)} className={selCls}>
                <option value="">ทั้งหมด</option>
                {diseaseOpts.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-gray-400">ตำบล
              <select value={fTambon} onChange={(e) => setFTambon(e.target.value)} className={selCls}>
                <option value="">ทั้งหมด</option>
                {tambonOpts.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-gray-400">ประเภท
              <select value={fType} onChange={(e) => setFType(e.target.value)} className={selCls}>
                <option value="">ทั้งหมด</option><option value="IPD">IPD</option><option value="OPD">OPD</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-gray-400">สถานะ
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selCls}>
                <option value="">ทั้งหมด</option>
                {statusOpts.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-gray-400">ผล Lab
              <select value={fLab} onChange={(e) => setFLab(e.target.value)} className={selCls}>
                <option value="">ทั้งหมด</option><option value="ยืนยัน">ยืนยัน</option>
                <option value="สงสัย">สงสัย</option><option value="ไม่ยืนยัน">ไม่ยืนยัน</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-gray-400">ชนิดแลป
              <select value={fLabType} onChange={(e) => setFLabType(e.target.value)} className={selCls}>
                <option value="">ทั้งหมด</option>
                {labTypeOpts.length === 0
                  ? <option disabled>— ยังไม่มีข้อมูล —</option>
                  : labTypeOpts.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-gray-400">D506
              <select value={fD506} onChange={(e) => setFD506(e.target.value)} className={selCls}>
                <option value="">ทั้งหมด</option><option value="sent">ส่งแล้ว</option><option value="pending">รอส่ง</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-gray-400 flex-1 min-w-[180px]">ค้นหา
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={fSearch} onChange={(e) => setFSearch(e.target.value)}
                  placeholder="ชื่อ / HN / เลขบัตร..." className={`${selCls} pl-8 w-full`} />
              </div>
            </label>
            <button onClick={clearAll}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200">
              <X size={14} /> ล้างตัวกรอง
            </button>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <Kpi icon={Users} label="ผู้ป่วยทั้งหมด" value={kpi.total} bg="#f0faf4" accent={MINT} />
            <Kpi icon={Hospital} label="IPD" value={kpi.ipd} bg="#fdeee6" accent="#c05621"
              sub={kpi.total ? `${Math.round(kpi.ipd / kpi.total * 100)}%` : "—"}
              onClick={() => setFType("IPD")} />
            <Kpi icon={Stethoscope} label="OPD" value={kpi.opd} bg="#e6f6f4" accent="#2c7a7b"
              sub={kpi.total ? `${Math.round(kpi.opd / kpi.total * 100)}%` : "—"}
              onClick={() => setFType("OPD")} />
            <Kpi icon={Microscope} label="Lab ยืนยัน" value={kpi.lab} bg="#f0ebfa" accent="#6b46c1" />
            <Kpi icon={Send} label="ส่ง D506 แล้ว" value={kpi.d506} bg="#e7f5ec" accent="#276749"
              sub={kpi.total ? `${Math.round(kpi.d506 / kpi.total * 100)}% ส่งแล้ว` : "—"}
              onClick={() => setFD506("sent")} />
            <Kpi icon={Clock} label="รอส่ง D506" value={kpi.pending} bg="#fdeaea" accent="#c53030"
              onClick={() => setFD506("pending")} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-gray-600 mb-3"><BarChart3 size={15} style={{ color: MINT_ACCENT }} /> จำนวนผู้ป่วยตามโรค</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={diseaseChart} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v} ราย`, ""]} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} cursor="pointer"
                    onClick={(d: { name?: string }) => d?.name && setFDisease(d.name)}>
                    {diseaseChart.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[11px] text-gray-400 mt-1">กดแท่งเพื่อกรองตามโรค</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-gray-600 mb-3"><MapPin size={15} style={{ color: MINT_ACCENT }} /> จำนวนผู้ป่วยตามตำบล</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tambonChart} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v} ราย`, ""]} />
                  <Bar dataKey="count" fill={MINT_ACCENT} radius={[0, 6, 6, 0]} cursor="pointer"
                    onClick={(d: { name?: string }) => d?.name && setFTambon(d.name)} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[11px] text-gray-400 mt-1">กดแท่งเพื่อกรองตามตำบล</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-gray-600 mb-3"><CalendarDays size={15} style={{ color: MINT_ACCENT }} /> Timeline รายสัปดาห์</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timelineChart} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v} ราย`, ""]} />
                  <Line type="monotone" dataKey="count" stroke={MINT} strokeWidth={2}
                    dot={{ r: 3, fill: MINT }} />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-[11px] text-gray-400 mt-1">จำนวนรายป่วยใหม่ต่อสัปดาห์</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            <button onClick={() => setTab("patient")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-sm font-semibold"
              style={tab === "patient"
                ? { backgroundColor: "#fff", color: MINT, boxShadow: `inset 0 -2px 0 ${MINT_ACCENT}` }
                : { backgroundColor: "#e2e8f0", color: "#64748b" }}>
              <Users size={15} /> รายการผู้ป่วย
              <span className="text-white rounded-full px-1.5 text-[11px]" style={{ backgroundColor: MINT_ACCENT }}>{filtered.length}</span>
            </button>
            <button onClick={() => setTab("lab")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-sm font-semibold"
              style={tab === "lab"
                ? { backgroundColor: "#fff", color: MINT, boxShadow: `inset 0 -2px 0 ${MINT_ACCENT}` }
                : { backgroundColor: "#e2e8f0", color: "#64748b" }}>
              <FlaskConical size={15} /> ตารางส่ง Lab
              <span className="bg-gray-400 text-white rounded-full px-1.5 text-[11px]">{labRows.length}</span>
            </button>
          </div>

          {/* Patient table */}
          {tab === "patient" && (
            <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="text-sm text-gray-500">
                  แสดง <b className="text-gray-700">{sorted.length ? (page - 1) * 20 + 1 : 0}</b>–
                  <b className="text-gray-700">{Math.min(page * 20, sorted.length)}</b> จาก{" "}
                  <b className="text-gray-700">{sorted.length}</b> ราย
                </div>
                <button onClick={exportPatients}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:brightness-95"
                  style={{ backgroundColor: "#f0faf4", color: MINT, borderColor: MINT_BORDER }}>
                  <FileDown size={13} /> Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-[11px] font-bold uppercase text-gray-400">
                      {([["seq", "#"], ["date", "วันที่รับรายงาน"], ["", "HN"], ["", "ชื่อ-สกุล"],
                        ["sex", "เพศ"], ["age", "อายุ"], ["", "ตำบล"], ["disease", "โรค"],
                        ["", "ประเภท"], ["", "ผล Lab"], ["", "สถานะ"], ["", "D506"], ["", "พิมพ์"]] as [string, string][])
                        .map(([k, label]) => (
                          <th key={label}
                            onClick={k ? () => toggleSort(k as typeof sortKey) : undefined}
                            className={`px-3 py-2.5 whitespace-nowrap ${k ? "cursor-pointer hover:text-[#3aa36a]" : ""}`}>
                            {label}{k && sortKey === k ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.length === 0 ? (
                      <tr><td colSpan={13} className="text-center py-10 text-gray-400">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>
                    ) : paged.map((r, i) => (
                      <tr key={`${r.seq}-${i}`} className="border-b border-gray-50 hover:bg-[#f0faf4]">
                        <td className="px-3 py-2 text-gray-400">{(page - 1) * 20 + i + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.reportDate || "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.hn || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.prefix}{r.fname} {r.lname}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.sex === "ช" ? "ชาย" : r.sex === "ญ" ? "หญิง" : r.sex || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.age || "—"} ปี</td>
                        <td className="px-3 py-2">
                          <button className="underline underline-offset-2" style={{ color: MINT_ACCENT }} onClick={() => setFTambon(r.tambon.trim())}>{r.tambon || "—"}</button>
                        </td>
                        <td className="px-3 py-2">
                          <button className="underline underline-offset-2 text-left" style={{ color: MINT_ACCENT }} onClick={() => setFDisease(r.disease)}>{r.disease || "—"}</button>
                        </td>
                        <td className="px-3 py-2">{ptypeBadge(r.ptype)}</td>
                        <td className="px-3 py-2">{labBadge(r.lab)}</td>
                        <td className="px-3 py-2">{statusBadge(r.status)}</td>
                        <td className="px-3 py-2">{d506Badge(r.d506Date)}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => setPrintRow(r)}
                            className="flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-semibold hover:brightness-95"
                            style={{ backgroundColor: "#f0faf4", color: MINT, borderColor: MINT_BORDER }}>
                            <Printer size={12} /> พิมพ์
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1.5 py-3">
                  <button disabled={page === 1} onClick={() => setPage(page - 1)}
                    className="w-8 h-8 rounded-lg border border-gray-200 disabled:opacity-40">‹</button>
                  <span className="text-xs text-gray-500 mx-2">หน้า {page}/{totalPages}</span>
                  <button disabled={page === totalPages} onClick={() => setPage(page + 1)}
                    className="w-8 h-8 rounded-lg border border-gray-200 disabled:opacity-40">›</button>
                </div>
              )}
            </div>
          )}

          {/* Lab table */}
          {tab === "lab" && (
            <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">
                ส่ง Lab <b className="text-gray-700">{labRows.length}</b> ราย
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-[11px] font-bold uppercase text-gray-400">
                      {["#", "วันที่", "HN", "ชื่อ-สกุล", "โรค", "ผล Lab", "ชนิดแลป", "วันที่ส่งตัวอย่าง", "วันที่ได้ผล", "ชนิดเชื้อ / ผลเพาะ"]
                        .map((h) => <th key={h} className="px-3 py-2.5 whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {labRows.length === 0 ? (
                      <tr><td colSpan={10} className="text-center py-10 text-gray-400">ไม่มีข้อมูล Lab</td></tr>
                    ) : labRows.map((r, i) => (
                      <tr key={`${r.seq}-${i}`} className="border-b border-gray-50 hover:bg-[#f0faf4]">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.reportDate || "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.hn || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.prefix}{r.fname} {r.lname}</td>
                        <td className="px-3 py-2">{r.disease || "—"}</td>
                        <td className="px-3 py-2">{labBadge(r.lab)}</td>
                        <td className="px-3 py-2">{r.labType || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.labSendDate || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.labResultDate || "—"}</td>
                        <td className="px-3 py-2">{r.organism || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Print modal */}
      {printRow && (
        <div className="print-modal fixed inset-0 z-[1000] bg-black/55 overflow-y-auto p-4 flex items-start justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setPrintRow(null); }}>
          <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl">
            <div className="no-print flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50 rounded-t-xl">
              <span className="flex items-center gap-2 font-bold text-gray-700"><Printer size={16} /> แบบรายงานโรค 506</span>
              <div className="flex gap-2">
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-sm font-bold hover:brightness-110"
                  style={{ backgroundColor: MINT }}><Printer size={14} /> พิมพ์</button>
                <button onClick={() => setPrintRow(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"><X size={14} /> ปิด</button>
              </div>
            </div>
            <div id="form506" className="p-5">
              <Form506 row={printRow} />
            </div>
          </div>
        </div>
      )}

      {/* print CSS: ซ่อนทุกอย่างยกเว้น modal ตอนสั่งพิมพ์ */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-modal, .print-modal * { visibility: visible !important; }
          .print-modal { position: static !important; background: none !important; padding: 0 !important; display: block !important; }
          .print-modal > div { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
          .no-print { display: none !important; }
          @page { margin: 15mm; }
        }
      `}</style>
    </div>
  );
}
