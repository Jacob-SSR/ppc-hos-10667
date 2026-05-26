"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import {
  RefreshCw, TrendingUp, BadgeCheck, AlertTriangle, Info,
  Building2, UploadCloud, CheckCircle2, XCircle, ChevronDown,
  ChevronLeft, ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 50;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StmRow {
  rep: string; seq: number; tranId: string; hn: string; an: string;
  pid: string; ชื่อสกุล: string; วันเข้ารักษา: string; วันจำหน่าย: string;
  maininscl: string; projcode: string; เรียกเก็บ: number; พึงรับ: number;
  hc: number; hcDrug: number; ae: number; aeDrug: number; inst: number;
  dmisCalc: number; dmisReal: number; dmisDrug: number; palliative: number;
  dmishd: number; pp: number; fs: number; opbkk: number; ยอดชดเชย: number;
  แหล่งข้อมูล: string; seqNo: string;
}

interface StmRepSummary {
  rep: string; จำนวน: number; เรียกเก็บ: number; ชดเชย: number; ไม่ชดเชย: number;
}

interface StmSubFundSummary {
  กองทุน: string; label: string; จำนวน: number; เรียกเก็บ: number; ชดเชย: number;
}

interface StmDashboardData {
  updatedAt: string; totalRows: number; totalClaim: number;
  totalComp: number; totalNoComp: number;
  rows: StmRow[]; byRep: StmRepSummary[];
  bySubFund: StmSubFundSummary[]; bySource: Record<string, number>;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const fmt  = (n: number) => n.toLocaleString("th-TH");
const fmtB = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SUB_FUND_COLS: { key: keyof StmRow; label: string; color: string }[] = [
  { key: "พึงรับ",    label: "OP พึงรับ",        color: "#60a5fa" },
  { key: "hc",       label: "HC",               color: "#34d399" },
  { key: "hcDrug",   label: "HC Drug",           color: "#6ee7b7" },
  { key: "ae",       label: "AE",               color: "#f59e0b" },
  { key: "aeDrug",   label: "AE Drug",           color: "#fcd34d" },
  { key: "inst",     label: "INST",             color: "#a78bfa" },
  { key: "dmisCalc", label: "DMIS (คำนวณ)",     color: "#818cf8" },
  { key: "dmisReal", label: "DMIS (จ่ายจริง)",  color: "#6366f1" },
  { key: "dmisDrug", label: "DMIS Drug",         color: "#c4b5fd" },
  { key: "palliative",label:"Palliative Care",   color: "#f472b6" },
  { key: "dmishd",   label: "DMISHD",           color: "#fb7185" },
  { key: "pp",       label: "PP",               color: "#4ade80" },
  { key: "fs",       label: "FS",               color: "#2dd4bf" },
  { key: "opbkk",   label: "OPBKK",            color: "#38bdf8" },
];

// ─── KpiCard ───────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, accent, bg }: {
  icon: React.ElementType; label: string; value: string; sub?: string; accent: string; bg: string;
}) {
  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ backgroundColor: bg }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: accent + "22" }}>
        <Icon size={20} style={{ color: accent }} strokeWidth={1.8} />
      </div>
      <div>
        <p className="text-xs font-bold tracking-wide" style={{ color: accent }}>{label}</p>
        <p className="text-xl font-extrabold tabular-nums" style={{ color: accent }}>{value}</p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: accent + "99" }}>{sub}</p>}
      </div>
    </motion.div>
  );
}

// ─── Bar Chart ─────────────────────────────────────────────────────────────────

function StmBarChart({ data }: { data: StmDashboardData }) {
  const chartData = data.byRep.map(r => ({
    name: `REP ${r.rep}`,
    เรียกเก็บ: r.เรียกเก็บ,
    ชดเชย: r.ชดเชย,
    ไม่ชดเชย: r.ไม่ชดเชย,
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <h4 className="text-sm font-bold text-gray-600 mb-4">เรียกเก็บ vs ชดเชย — แยกตาม REP (งวด)</h4>
      <div className="flex gap-4 mb-4 flex-wrap">
        {[
          { color: "#85B7EB", label: "เรียกเก็บ" },
          { color: "#97C459", label: "ชดเชย" },
          { color: "#F09595", label: "ไม่ชดเชย" },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="32%" barGap={4}>
          <CartesianGrid vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <Tooltip
            formatter={(v: number, name: string) => [fmtB(v) + " ฿", name]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <Bar dataKey="เรียกเก็บ" fill="#85B7EB" radius={[3, 3, 0, 0]} />
          <Bar dataKey="ชดเชย"    fill="#97C459" radius={[3, 3, 0, 0]} />
          <Bar dataKey="ไม่ชดเชย" fill="#F09595" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Cross Tab (เหมือน BillingCrossTab) ────────────────────────────────────────

const COL_PAGE_SIZE = 5; // คอลัมน์กองทุนย่อยต่อหน้า
const REP_PAGE_SIZE = 5; // REP ต่อหน้า (Cross-tab rows)

function StmCrossTab({ data }: { data: StmDashboardData }) {
  const [colPage, setColPage] = useState(1);
  const [repPage, setRepPage] = useState(1);

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const r of data.rows) {
      if (!m[r.rep]) m[r.rep] = {};
      for (const col of SUB_FUND_COLS) {
        const v = Number(r[col.key] ?? 0);
        m[r.rep][col.key as string] = (m[r.rep][col.key as string] || 0) + v;
      }
    }
    return m;
  }, [data]);

  const colTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const col of SUB_FUND_COLS) {
      t[col.key as string] = data.rows.reduce((s, r) => s + Number(r[col.key] ?? 0), 0);
    }
    return t;
  }, [data]);

  // Pagination คอลัมน์
  const totalColPages = Math.ceil(SUB_FUND_COLS.length / COL_PAGE_SIZE);
  const visibleCols = SUB_FUND_COLS.slice((colPage - 1) * COL_PAGE_SIZE, colPage * COL_PAGE_SIZE);

  // Pagination แถว REP
  const totalRepPages = Math.ceil(data.byRep.length / REP_PAGE_SIZE);
  const visibleReps = data.byRep.slice((repPage - 1) * REP_PAGE_SIZE, repPage * REP_PAGE_SIZE);

  const thBase = "px-2 py-2 text-white font-semibold text-[11px] text-center border border-[#a8d5ba]";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h4 className="text-sm font-bold text-gray-600">
          สรุปยอดชดเชย OPD-UCS แยกตามกองทุนย่อย
        </h4>
        {/* Col pagination */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">กองทุน:</span>
          <button
            onClick={() => setColPage(p => Math.max(p - 1, 1))}
            disabled={colPage === 1}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#7ec8a0] hover:text-[#1a5233] disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={12} /> ก่อนหน้า
          </button>
          <span className="px-2.5 py-1 rounded-lg border-2 text-xs font-bold tabular-nums"
            style={{ borderColor: "#7ec8a0", backgroundColor: "#f0faf4", color: "#1a5233" }}>
            {colPage} / {totalColPages}
          </span>
          <button
            onClick={() => setColPage(p => Math.min(p + 1, totalColPages))}
            disabled={colPage === totalColPages}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#7ec8a0] hover:text-[#1a5233] disabled:opacity-30 transition-colors"
          >
            ถัดไป <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr>
              <th className={`${thBase} bg-[#1a5233]`} rowSpan={2} style={{ minWidth: 120 }}>REP (งวด)</th>
              <th className={`${thBase} bg-[#1a5233]`} rowSpan={2} style={{ minWidth: 60 }}>จำนวน</th>
              <th className={`${thBase} bg-[#1a5233]`} rowSpan={2} style={{ minWidth: 90 }}>เรียกเก็บ (฿)</th>
              {visibleCols.map(col => (
                <th key={col.key as string} className={`${thBase} bg-[#1a5233]`} style={{ minWidth: 80 }}>
                  {col.label}
                </th>
              ))}
              <th className={`${thBase} bg-[#1a5233]`} rowSpan={2} style={{ minWidth: 90 }}>
                ยอดชดเชย<br />ทั้งสิ้น (฿)
              </th>
            </tr>
            <tr>
              {visibleCols.map(col => (
                <th key={col.key as string} className={`${thBase} bg-[#7ec8a0] text-[10px] text-[#1a5233]`}>
                  ชดเชย (฿)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleReps.map((rep, i) => {
              const repData = matrix[rep.rep] ?? {};
              const base = i % 2 === 0 ? "bg-white" : "bg-gray-50/40";
              return (
                <tr key={rep.rep} className={`border-b border-gray-200 hover:bg-[#f0faf4] transition-colors ${base}`}>
                  <td className="px-2 py-2 text-center text-xs font-mono font-bold text-[#1a5233] bg-[#f0faf4] border-r border-gray-200">
                    {rep.rep}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-xs text-gray-700 border-r border-gray-200">
                    {fmt(rep.จำนวน)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-xs font-bold text-gray-800 border-r-2 border-gray-300">
                    {fmtB(rep.เรียกเก็บ)}
                  </td>
                  {visibleCols.map(col => {
                    const v = repData[col.key as string] ?? 0;
                    return (
                      <td key={col.key as string}
                        className={`px-2 py-2 text-right tabular-nums text-xs border-r border-gray-200 ${
                          v === 0 ? "text-gray-300" : "text-[#236b43] font-medium"
                        }`}>
                        {v === 0 ? "—" : fmtB(v)}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-right tabular-nums text-xs font-extrabold text-[#1a5233]">
                    {fmtB(rep.ชดเชย)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#d6f0e0] border-t-2 border-[#55b882]">
              <td className="px-2 py-2 text-xs font-bold text-[#1a5233] text-center">รวม</td>
              <td className="px-2 py-2 text-right tabular-nums text-xs font-bold text-[#1a5233]">
                {fmt(data.totalRows)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-xs font-bold text-[#1a5233] border-r-2 border-gray-300">
                {fmtB(data.totalClaim)}
              </td>
              {visibleCols.map(col => (
                <td key={col.key as string}
                  className="px-2 py-2 text-right tabular-nums text-xs font-bold text-[#1a5233] border-r border-gray-200">
                  {colTotals[col.key as string] === 0 ? "—" : fmtB(colTotals[col.key as string])}
                </td>
              ))}
              <td className="px-2 py-2 text-right tabular-nums text-xs font-extrabold text-[#1a5233]">
                {fmtB(data.totalComp)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Row (REP) pagination */}
      {totalRepPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            REP <span className="font-bold text-gray-800">{(repPage - 1) * REP_PAGE_SIZE + 1}–{Math.min(repPage * REP_PAGE_SIZE, data.byRep.length)}</span> จาก {data.byRep.length} งวด
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRepPage(p => Math.max(p - 1, 1))}
              disabled={repPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#7ec8a0] hover:text-[#1a5233] disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={13} /> ก่อนหน้า
            </button>
            <span className="px-3 py-1.5 rounded-lg border-2 text-xs font-bold tabular-nums"
              style={{ borderColor: "#7ec8a0", backgroundColor: "#f0faf4", color: "#1a5233" }}>
              {repPage} / {totalRepPages}
            </span>
            <button
              onClick={() => setRepPage(p => Math.min(p + 1, totalRepPages))}
              disabled={repPage === totalRepPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#7ec8a0] hover:text-[#1a5233] disabled:opacity-30 transition-colors"
            >
              ถัดไป <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pagination component ───────────────────────────────────────────────────────

function Pagination({ page, totalPages, onChange }: {
  page: number; totalPages: number; onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
      <p className="text-xs text-gray-500">
        หน้า <span className="font-bold text-gray-800">{page}</span> / {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(page - 1, 1))}
          disabled={page === 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#7ec8a0] hover:text-[#1a5233] disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={13} /> ก่อนหน้า
        </button>
        <span className="px-3 py-1.5 rounded-lg border-2 text-xs font-bold tabular-nums"
          style={{ borderColor: "#7ec8a0", backgroundColor: "#f0faf4", color: "#1a5233" }}>
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onChange(Math.min(page + 1, totalPages))}
          disabled={page === totalPages}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#7ec8a0] hover:text-[#1a5233] disabled:opacity-30 transition-colors"
        >
          ถัดไป <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── REP Card (คล้าย UnitCard ใน billing) ──────────────────────────────────────

function RepCard({ rep, rows }: { rep: StmRepSummary; rows: StmRow[] }) {
  const [open, setOpen]   = useState(false);
  const [page, setPage]   = useState(1);
  const [search, setSearch] = useState("");

  const rate = rep.เรียกเก็บ > 0
    ? Math.round((rep.ชดเชย / rep.เรียกเก็บ) * 1000) / 10
    : 0;
  const rateColor = rate >= 90 ? "#3B6D11" : rate >= 60 ? "#854F0B" : "#A32D2D";

  const repRows = useMemo(
    () => rows.filter(r => r.rep === rep.rep),
    [rows, rep.rep]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return repRows;
    return repRows.filter(r =>
      r.hn.includes(q) ||
      r.ชื่อสกุล.toLowerCase().includes(q) ||
      r.maininscl.toLowerCase().includes(q) ||
      r.seqNo.includes(q)
    );
  }, [repRows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // reset หน้าเมื่อ search เปลี่ยน
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  return (
    <motion.div
      className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(p => !p)}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50">
          <Building2 size={18} className="text-blue-700" strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">REP {rep.rep}</p>
          <p className="text-[11px] text-gray-400">{fmt(rep.จำนวน)} รายการ</p>
        </div>
        <div className="flex items-center gap-6 shrink-0 text-right">
          <div>
            <p className="text-[10px] text-gray-400 font-medium">เรียกเก็บ</p>
            <p className="text-sm font-bold text-gray-800 tabular-nums">{fmtB(rep.เรียกเก็บ)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium">ชดเชย</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: rateColor }}>{fmtB(rep.ชดเชย)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium">ไม่ชดเชย</p>
            <p className="text-sm font-bold tabular-nums text-red-600">{fmtB(rep.ไม่ชดเชย)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium">อัตรา</p>
            <p className="text-sm font-extrabold tabular-nums" style={{ color: rateColor }}>{rate}%</p>
          </div>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} className="text-gray-400" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className="px-5 py-4">

              {/* Progress bar */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: rateColor }}
                    initial={{ width: 0 }} animate={{ width: `${Math.min(rate, 100)}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }} />
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color: rateColor }}>
                  {rate}% ชดเชย
                </span>
              </div>

              {/* Toolbar: search + count */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center px-3 py-0.5 rounded-full text-xs font-bold border"
                    style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba", color: "#1a5233" }}>
                    {filtered.length.toLocaleString()} รายการ
                    {search && <span className="ml-1 font-normal text-gray-400">จาก {repRows.length.toLocaleString()}</span>}
                  </span>
                  <span className="text-xs text-gray-400">
                    หน้า {page}/{totalPages} · แสดง {PAGE_SIZE} ต่อหน้า
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="ค้นหา HN / ชื่อ / MAININSCL..."
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  className="border-2 border-gray-200 rounded-full px-4 py-1.5 text-xs w-56 focus:outline-none focus:border-[#7ec8a0] transition-colors"
                  onClick={e => e.stopPropagation()}
                />
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="min-w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-green-700 sticky top-0">
                      {["#","HN","ชื่อ-สกุล","วันเข้ารักษา","วันจำหน่าย","MAININSCL","เรียกเก็บ","OP พึงรับ","HC","AE","PP","ยอดชดเชย","แหล่งข้อมูล"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-white font-semibold whitespace-nowrap border-r border-green-600">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="px-4 py-8 text-center text-gray-400 text-xs">
                          ไม่พบข้อมูลที่ตรงกับการค้นหา
                        </td>
                      </tr>
                    ) : paginated.map((r, i) => {
                      const globalIdx = (page - 1) * PAGE_SIZE + i + 1;
                      const base = i % 2 === 0 ? "#ffffff" : "#f9fafb";
                      return (
                        <tr key={r.tranId || i} className="border-b border-gray-100 transition-colors"
                          style={{ backgroundColor: base }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f0faf4")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = base)}>
                          <td className="px-3 py-2 text-gray-400 tabular-nums">{globalIdx}</td>
                          <td className="px-3 py-2 font-mono text-gray-600">{r.hn}</td>
                          <td className="px-3 py-2 text-gray-800 max-w-[200px] truncate">{r.ชื่อสกุล}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {r.วันเข้ารักษา ? r.วันเข้ารักษา.slice(0, 10) : "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {r.วันจำหน่าย ? r.วันจำหน่าย.slice(0, 10) : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              {r.maininscl}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-700">{fmtB(r.เรียกเก็บ)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-green-700 font-medium">{r.พึงรับ > 0 ? fmtB(r.พึงรับ) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-blue-700">{r.hc > 0 ? fmtB(r.hc) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-amber-700">{r.ae > 0 ? fmtB(r.ae) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-purple-700">{r.pp > 0 ? fmtB(r.pp) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-bold text-[#1a5233]">{fmtB(r.ยอดชดเชย)}</td>
                          <td className="px-3 py-2 text-gray-500">{r.แหล่งข้อมูล}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── REP Card List with Pagination ────────────────────────────────────────────

const REP_CARD_PAGE_SIZE = 5;

function RepCardList({ reps, rows }: { reps: StmRepSummary[]; rows: StmRow[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(reps.length / REP_CARD_PAGE_SIZE);
  const visible = reps.slice((page - 1) * REP_CARD_PAGE_SIZE, page * REP_CARD_PAGE_SIZE);

  return (
    <div className="space-y-3">
      {/* Header + pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
          รายละเอียดแยกตาม REP (งวดส่งข้อมูล)
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {(page - 1) * REP_CARD_PAGE_SIZE + 1}–{Math.min(page * REP_CARD_PAGE_SIZE, reps.length)} จาก {reps.length} งวด
            </span>
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#7ec8a0] hover:text-[#1a5233] disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={13} /> ก่อนหน้า
            </button>
            <span className="px-3 py-1.5 rounded-lg border-2 text-xs font-bold tabular-nums"
              style={{ borderColor: "#7ec8a0", backgroundColor: "#f0faf4", color: "#1a5233" }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#7ec8a0] hover:text-[#1a5233] disabled:opacity-30 transition-colors"
            >
              ถัดไป <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Cards */}
      {visible.map(rep => (
        <RepCard key={rep.rep} rep={rep} rows={rows} />
      ))}

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#7ec8a0] hover:text-[#1a5233] disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={13} /> ก่อนหน้า
          </button>
          <span className="px-3 py-1.5 rounded-lg border-2 text-xs font-bold tabular-nums"
            style={{ borderColor: "#7ec8a0", backgroundColor: "#f0faf4", color: "#1a5233" }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#7ec8a0] hover:text-[#1a5233] disabled:opacity-30 transition-colors"
          >
            ถัดไป <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Upload Dropzone ────────────────────────────────────────────────────────────

function UploadDropzone({ onSuccess }: { onSuccess: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const upload = useCallback(async (file: File) => {
    setUploading(true); setResult(null);
    const form = new FormData(); form.append("file", file);
    try {
      const res = await fetch("/api/stm-upload", { method: "POST", body: form, credentials: "include" });
      const json = await res.json();
      setResult({ ok: json.success, msg: json.message ?? json.error });
      if (json.success) setTimeout(onSuccess, 600);
    } catch {
      setResult({ ok: false, msg: "เชื่อมต่อ server ไม่ได้" });
    } finally {
      setUploading(false); }
  }, [onSuccess]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-[#717171]">อัปโหลดข้อมูล STM (OPD-UCS)</h4>
        <span className="text-[11px] text-gray-400">stm.xlsx</span>
      </div>
      <motion.div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        onClick={() => !uploading && inputRef.current?.click()}
        animate={{ borderColor: dragging ? "#3aa36a" : "#d1d5db", backgroundColor: dragging ? "#f0faf4" : "#fafafa", scale: dragging ? 1.01 : 1 }}
        className="border-2 border-dashed rounded-xl cursor-pointer flex flex-col items-center gap-2 py-6 select-none"
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <RefreshCw size={28} className="text-green-600" />
              </motion.div>
              <p className="text-sm font-semibold text-green-700">กำลังอัปโหลด...</p>
            </motion.div>
          ) : result?.ok ? (
            <motion.div key="ok" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
              <CheckCircle2 size={28} className="text-green-600" />
              <p className="text-sm font-bold text-green-700">{result.msg}</p>
              <p className="text-xs text-gray-400 underline cursor-pointer" onClick={e => { e.stopPropagation(); setResult(null); }}>อัปโหลดไฟล์ใหม่</p>
            </motion.div>
          ) : result ? (
            <motion.div key="err" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
              <XCircle size={28} className="text-red-500" />
              <p className="text-sm font-semibold text-red-600">{result.msg}</p>
              <p className="text-xs text-gray-500 underline cursor-pointer" onClick={e => { e.stopPropagation(); setResult(null); }}>ลองใหม่</p>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1 pointer-events-none">
              <UploadCloud size={28} style={{ color: dragging ? "#3aa36a" : "#9ca3af" }} />
              <p className="text-sm font-semibold text-gray-600">{dragging ? "ปล่อยเพื่ออัปโหลด" : "ลากวางไฟล์ หรือคลิกเพื่อเลือก"}</p>
              <p className="text-xs text-gray-400">ไฟล์ STM_XXXXX_OPUCS.xlsx</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function StmDashboardPage() {
  const [data, setData]     = useState<StmDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [noFile, setNoFile] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null); setNoFile(false);
    try {
      const res = await fetch("/api/stm-dashboard", { credentials: "include" });
      if (res.status === 404) { setNoFile(true); setLoading(false); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const compRate = data && data.totalClaim > 0
    ? Math.round((data.totalComp / data.totalClaim) * 1000) / 10
    : 0;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800">
            Dashboard ค่าบริการทางการแพทย์ OPD-UCS (STM)
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            สรุปยอดเรียกเก็บและชดเชยแยกตามกองทุนย่อย — ไม่แสดงข้อมูล IP/VA/COVID
            {data && <span className="ml-2">· อัปเดต {new Date(data.updatedAt).toLocaleString("th-TH")}</span>}
          </p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          <motion.span animate={loading ? { rotate: 360 } : { rotate: 0 }}
            transition={loading ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}>
            <RefreshCw size={14} />
          </motion.span>
          รีเฟรช
        </button>
      </div>

      {/* No file */}
      {noFile && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
          <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูล</p>
            <p className="text-xs text-amber-700 mt-1">กรุณาอัปโหลดไฟล์ STM_XXXXX_OPUCS.xlsx ด้านล่าง</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">⚠️ {error}</div>
      )}

      {/* KPI Cards */}
      {(loading || data) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[130px] rounded-2xl bg-gray-100 animate-pulse" />
              ))
            : data && (
                <>
                  <KpiCard icon={TrendingUp} label="รายการทั้งหมด"
                    value={fmt(data.totalRows)} sub="รายการขอเบิก OPD-UCS"
                    accent="#0369A1" bg="#E0F2FE" />
                  <KpiCard icon={TrendingUp} label="เรียกเก็บรวม"
                    value={fmtB(data.totalClaim)} sub="บาท"
                    accent="#854D0E" bg="#FEF9C3" />
                  <KpiCard icon={BadgeCheck} label="ชดเชยแล้ว"
                    value={fmtB(data.totalComp)}
                    sub={`${compRate}% ของที่เรียกเก็บ`}
                    accent="#3B6D11" bg="#EAF3DE" />
                  <KpiCard icon={AlertTriangle} label="ไม่ชดเชย"
                    value={fmtB(data.totalNoComp)} sub="บาท"
                    accent="#991B1B" bg="#FEE2E2" />
                </>
              )}
        </div>
      )}

      {/* Bar Chart */}
      {data && data.byRep.length > 0 && <StmBarChart data={data} />}

      {/* Cross Tab */}
      {data && <StmCrossTab data={data} />}

      {/* REP Cards */}
      {data && data.byRep.length > 0 && (
        <RepCardList reps={data.byRep} rows={data.rows} />
      )}

      {/* Upload */}
      <UploadDropzone onSuccess={fetchData} />
    </div>
  );
}