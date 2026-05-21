"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import {
  RefreshCw, TrendingUp, BadgeCheck, AlertTriangle, Banknote,
  Info, Building2, MapPin, ChevronDown, UploadCloud, CheckCircle2,
  XCircle, Filter,
} from "lucide-react";
import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface KtbServiceSummary {
  รายการขอเบิก: string; รายการสั้น: string;
  จำนวน: number; เรียกเก็บ: number; ชดเชย: number; ไม่ชดเชย: number; สถานะ: string;
}
interface KtbUnitSummary {
  หน่วยบริการ: string; hcodeKey: string; isHospital: boolean;
  จำนวน: number; เรียกเก็บ: number; ชดเชย: number; ไม่ชดเชย: number;
  รายการ: KtbServiceSummary[];
}
interface KtbBatchSummary {
  งวดจ่าย: string; จำนวน: number; เรียกเก็บ: number; ชดเชย: number; ไม่ชดเชย: number;
  หน่วยบริการ: KtbUnitSummary[];
}
interface KtbDashboardData {
  updatedAt: string; totalRows: number; totalClaim: number;
  totalComp: number; totalNoComp: number; totalPending: number;
  batches: KtbBatchSummary[]; units: KtbUnitSummary[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("th-TH");
const fmtB = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SVC_MAP: Record<string, string> = {
  "การตรวจคัดกรองโรคไวรัสตับอักเสบ ซี": "ตรวจตับอักเสบ C",
  "บริการตรวจคัดกรองไวรัสตับอักเสบ บี": "ตรวจตับอักเสบ B",
  "ฉีดวัคซีนป้องกันโรคป้องกันโรคไข้หวัดใหญ่ตามฤดูกาล(7กลุ่มเสี่ยง)": "วัคซีนไข้หวัดใหญ่",
  "วัคซีนป้องกันโรคไข้หวัดใหญ่ตามฤดูกาล": "วัคซีนไข้หวัดใหญ่",
  "ค่าบริการเก็บตัวอย่าง": "เก็บตัวอย่าง HPV",
};

const SVC_COLS = [
  { key: "เก็บตัวอย่าง HPV", label: "เก็บตัวอย่าง HPV DNA Test" },
  { key: "ตรวจตับอักเสบ C", label: "ตรวจคัดกรองตับอักเสบ ซี" },
  { key: "ตรวจตับอักเสบ B", label: "ตรวจคัดกรองตับอักเสบ บี" },
  { key: "วัคซีนไข้หวัดใหญ่", label: "วัคซีนไข้หวัดใหญ่ (7 กลุ่มเสี่ยง)" },
];

const SVC_COLORS: Record<string, { claim: string; comp: string }> = {
  "ตรวจตับอักเสบ C": { claim: "#60a5fa", comp: "#34d399" },
  "ตรวจตับอักเสบ B": { claim: "#818cf8", comp: "#6ee7b7" },
  "วัคซีนไข้หวัดใหญ่": { claim: "#fbbf24", comp: "#4ade80" },
  "เก็บตัวอย่าง HPV": { claim: "#f472b6", comp: "#86efac" },
  "รวมทั้งหมด": { claim: "#85B7EB", comp: "#97C459" },
};

const ALL_SVCS = ["รวมทั้งหมด", "ตรวจตับอักเสบ C", "ตรวจตับอักเสบ B", "วัคซีนไข้หวัดใหญ่", "เก็บตัวอย่าง HPV"] as const;
type SvcFilter = typeof ALL_SVCS[number];

// ─── KpiCard ──────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, accent, bg }: {
  icon: React.ElementType; label: string; value: string; sub?: string; accent: string; bg: string;
}) {
  return (
    <motion.div className="rounded-2xl p-5 flex flex-col gap-3" style={{ backgroundColor: bg }}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: accent + "22" }}>
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

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function KtbBarChart({ units }: { units: KtbUnitSummary[] }) {
  const [selectedSvc, setSelectedSvc] = useState<SvcFilter>("รวมทั้งหมด");

  const chartData = useMemo(() => units.map((unit) => {
    const shortName = unit.หน่วยบริการ.replace("โรงพยาบาล", "รพ.").replace("รพ.สต.", "รพสต.");
    if (selectedSvc === "รวมทั้งหมด") {
      const breakdown = ALL_SVCS.filter(s => s !== "รวมทั้งหมด").map(svcKey => {
        const m = unit.รายการ.filter(i => (SVC_MAP[i.รายการขอเบิก] ?? i.รายการสั้น) === svcKey);
        return { name: svcKey, claim: m.reduce((s, i) => s + i.เรียกเก็บ, 0), comp: m.reduce((s, i) => s + i.ชดเชย, 0) };
      }).filter(s => s.claim > 0);
      const pending = Math.max(0, unit.ชดเชย - unit.ไม่ชดเชย);
      return { name: shortName, เรียกเก็บ: unit.เรียกเก็บ, ชดเชย: unit.ชดเชย, ไม่ชดเชย: pending, breakdown };
    }
    const m = unit.รายการ.filter(i => (SVC_MAP[i.รายการขอเบิก] ?? i.รายการสั้น) === selectedSvc);
    const claim = m.reduce((s, i) => s + i.เรียกเก็บ, 0);
    const comp = m.reduce((s, i) => s + i.ชดเชย, 0);
    const nocomp = m.reduce((s, i) => s + i.ไม่ชดเชย, 0);
    return { name: shortName, เรียกเก็บ: claim, ชดเชย: comp, ไม่ชดเชย: Math.max(0, comp - nocomp) };
  }), [units, selectedSvc]);

  const colors = SVC_COLORS[selectedSvc] ?? SVC_COLORS["รวมทั้งหมด"];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs min-w-[210px]">
        <p className="font-bold text-gray-800 text-sm mb-2 pb-1.5 border-b border-gray-100">{label}</p>
        {selectedSvc === "รวมทั้งหมด" && d?.breakdown?.length > 0 ? (
          <div className="space-y-2">
            {d.breakdown.map((s: any) => (
              <div key={s.name} className="flex justify-between items-center">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: SVC_COLORS[s.name]?.claim ?? "#94a3b8" }} />{s.name}
                </span>
                <span className="font-bold text-gray-800 tabular-nums">{fmtB(s.comp)} ฿</span>
              </div>
            ))}
            <div className="pt-1.5 border-t border-gray-100 flex justify-between font-bold">
              <span className="text-orange-600">ไม่ชดเชย</span>
              <span className="text-orange-600 tabular-nums">{fmtB(d.ไม่ชดเชย ?? 0)} ฿</span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {[{ k: "เรียกเก็บ", c: "text-blue-700" }, { k: "ชดเชย", c: "text-green-700" }, { k: "ไม่ชดเชย", c: "text-orange-600" }].map(({ k, c }) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-500">{k}</span>
                <span className={`font-bold tabular-nums ${c}`}>{fmtB(d?.[k] ?? 0)} ฿</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h4 className="text-sm font-bold text-gray-600">เรียกเก็บ vs ชดเชย — แยกตามหน่วยบริการ</h4>
        <div className="flex flex-wrap gap-1.5">
          {ALL_SVCS.map(svc => {
            const active = selectedSvc === svc;
            const ac = SVC_COLORS[svc]?.claim ?? "#1a5233";
            return (
              <button key={svc} onClick={() => setSelectedSvc(svc)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all border"
                style={{ backgroundColor: active ? ac : "white", color: active ? "white" : "#374151", borderColor: active ? ac : "#d1d5db" }}>
                {svc}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-4 mb-3 flex-wrap items-center">
        {[{ color: colors.claim, label: "เรียกเก็บ" }, { color: colors.comp, label: "ชดเชย" }, { color: "#fb923c", label: "ไม่ชดเชย" }].map(l => (
          <span key={l.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-sm" style={{ background: l.color }} />{l.label}
          </span>
        ))}
        <span className="text-xs text-gray-400 ml-auto italic">💡 Hover เพื่อดูรายละเอียด</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%" barGap={3}>
          <CartesianGrid vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="เรียกเก็บ" fill={colors.claim} radius={[3, 3, 0, 0]} />
          <Bar dataKey="ชดเชย" fill={colors.comp} radius={[3, 3, 0, 0]} />
          <Bar dataKey="ไม่ชดเชย" fill="#fb923c" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Cross-Tab ────────────────────────────────────────────────────────────────
function CrossTab({ units }: { units: KtbUnitSummary[] }) {
  const rows = useMemo(() => units.map((unit) => {
    const svcs: Record<string, { claimCount: number; claimBaht: number; compBaht: number }> = {};
    for (const col of SVC_COLS) svcs[col.key] = { claimCount: 0, claimBaht: 0, compBaht: 0 };
    for (const item of unit.รายการ) {
      const key = SVC_MAP[item.รายการขอเบิก] ?? item.รายการสั้น;
      if (!svcs[key]) continue;
      svcs[key].claimCount += item.จำนวน;
      svcs[key].claimBaht += item.เรียกเก็บ;
      if (item.สถานะ === "ชดเชย") svcs[key].compBaht += item.ชดเชย;
    }
    return { hcode: unit.hcodeKey, name: unit.หน่วยบริการ, isHospital: unit.isHospital, total: unit.เรียกเก็บ, svcs };
  }), [units]);

  const totals = useMemo(() => {
    const t: Record<string, { claimCount: number; claimBaht: number; compBaht: number }> = {};
    for (const col of SVC_COLS) t[col.key] = { claimCount: 0, claimBaht: 0, compBaht: 0 };
    let total = 0;
    for (const row of rows) {
      total += row.total;
      for (const col of SVC_COLS) {
        t[col.key].claimCount += row.svcs[col.key].claimCount;
        t[col.key].claimBaht += row.svcs[col.key].claimBaht;
        t[col.key].compBaht += row.svcs[col.key].compBaht;
      }
    }
    return { total, svcs: t };
  }, [rows]);

  const thBase = "px-2 py-2 text-white font-semibold text-[11px] text-center border border-[#a8d5ba]";

  const renderDataRow = (row: typeof rows[0], i: number) => (
    <tr key={row.hcode} className={`border-b border-gray-200 hover:bg-[#f0faf4] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
      <td className="px-2 py-1.5 text-center text-xs font-medium text-[#1a5233] bg-[#f0faf4] border-r border-gray-200">{row.hcode}</td>
      <td className={`px-2 py-1.5 text-left text-xs font-medium border-r border-gray-200 ${row.isHospital ? "text-blue-800 bg-blue-50" : "text-gray-700"}`}>{row.name}</td>
      <td className={`px-2 py-1.5 text-right tabular-nums text-xs font-bold border-r-2 border-gray-300 ${row.isHospital ? "text-blue-800 bg-blue-50" : "text-[#1a5233]"}`}>{fmtB(row.total)}</td>
      {SVC_COLS.map(col => {
        const s = row.svcs[col.key];
        const noComp = s.claimBaht > 0 && s.compBaht === 0;
        return (
          <React.Fragment key={col.key}>
            <td className={`px-2 py-1.5 text-right tabular-nums text-xs border-r border-gray-200 ${s.claimCount === 0 ? "text-gray-300" : "text-gray-700"}`}>
              {s.claimCount === 0 ? "—" : fmt(s.claimCount)}
            </td>
            <td className={`px-2 py-1.5 text-right tabular-nums text-xs border-r border-gray-200 ${s.claimBaht === 0 ? "text-gray-300" : noComp ? "bg-amber-50 text-amber-900 font-medium" : "text-gray-700"}`}>
              {s.claimBaht === 0 ? "—" : fmtB(s.claimBaht)}
            </td>
            <td className={`px-2 py-1.5 text-right tabular-nums text-xs border-r-2 border-gray-300 ${s.compBaht === 0 && s.claimBaht > 0 ? "text-red-500 bg-red-50 font-bold" : s.compBaht === 0 ? "text-gray-300" : "text-[#236b43] font-medium"}`}>
              {s.compBaht === 0 ? (noComp ? "0.00" : "—") : fmtB(s.compBaht)}
            </td>
          </React.Fragment>
        );
      })}
    </tr>
  );

  const hospRows = rows.filter(r => r.isHospital);
  const rphstRows = rows.filter(r => !r.isHospital);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-bold text-gray-600">สรุปแยกตามประเภทบริการ — KTB รพสต. บริการ 2568 ชดเชย 2569</h4>
      </div>
      <div className="flex gap-4 mb-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block" />เรียกเก็บแต่ชดเชย 0</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-50 border border-red-200 inline-block" />ชดเชย 0 บาท</span>
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th className={`${thBase} bg-[#1a5233]`} rowSpan={2} style={{ minWidth: 56 }}>รหัส</th>
              <th className={`${thBase} bg-[#1a5233]`} rowSpan={2} style={{ minWidth: 140, textAlign: "left" }}>ชื่อหน่วยบริการ</th>
              <th className={`${thBase} bg-[#1a5233]`} rowSpan={2} style={{ minWidth: 78 }}>รวม (฿)</th>
              {SVC_COLS.map(s => <th key={s.key} className={`${thBase} bg-[#1a5233]`} colSpan={3}>{s.label}</th>)}
            </tr>
            <tr>
              {SVC_COLS.map(s => (
                <React.Fragment key={s.key}>
                  <th className={`${thBase} bg-[#7ec8a0] text-[10px] text-[#1a5233]`}>รายการ</th>
                  <th className={`${thBase} bg-[#7ec8a0] text-[10px] text-[#1a5233]`}>เรียกเก็บ(฿)</th>
                  <th className={`${thBase} bg-[#7ec8a0] text-[10px] text-[#1a5233]`}>ชดเชย(฿)</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {hospRows.length > 0 && (
              <>
                <tr><td colSpan={3 + SVC_COLS.length * 3} className="px-3 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 border-b border-blue-100">🏥 โรงพยาบาล</td></tr>
                {hospRows.map((row, i) => renderDataRow(row, i))}
              </>
            )}
            {rphstRows.length > 0 && (
              <>
                <tr><td colSpan={3 + SVC_COLS.length * 3} className="px-3 py-1 text-[10px] font-bold text-green-700 bg-green-50 border-b border-green-100">🏨 โรงพยาบาลส่งเสริมสุขภาพตำบล (รพ.สต.)</td></tr>
                {rphstRows.map((row, i) => renderDataRow(row, i))}
              </>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-[#d6f0e0] border-t-2 border-[#55b882]">
              <td className="px-2 py-2 text-xs font-bold text-[#1a5233] text-center">รวม</td>
              <td className="px-2 py-2 text-xs font-bold text-[#1a5233]">รวมทั้งหมด</td>
              <td className="px-2 py-2 text-right tabular-nums text-xs font-extrabold text-[#1a5233] border-r-2 border-gray-300">{fmtB(totals.total)}</td>
              {SVC_COLS.map(col => {
                const t = totals.svcs[col.key];
                return (
                  <React.Fragment key={col.key}>
                    <td className="px-2 py-2 text-right tabular-nums text-xs font-bold text-[#1a5233]">{fmt(t.claimCount)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-xs font-bold text-[#1a5233]">{fmtB(t.claimBaht)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-xs font-bold text-[#1a5233] border-r-2 border-gray-300">{fmtB(t.compBaht)}</td>
                  </React.Fragment>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 mt-2">* ช่องสีเหลือง = เรียกเก็บแต่ชดเชย 0 (ติด ERR) · ช่องสีแดง = ชดเชย 0 บาท</p>
    </div>
  );
}

// ─── Unit Card ────────────────────────────────────────────────────────────────
function UnitCard({ unit }: { unit: KtbUnitSummary }) {
  const [open, setOpen] = useState(unit.isHospital);
  const pending = Math.max(0, unit.ชดเชย - unit.ไม่ชดเชย);
  const rate = unit.เรียกเก็บ > 0 ? Math.round((unit.ชดเชย / unit.เรียกเก็บ) * 1000) / 10 : 0;
  const rateColor = rate >= 90 ? "#15803d" : rate >= 60 ? "#b45309" : "#b91c1c";

  return (
    <motion.div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}>
      <button className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(p => !p)}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${unit.isHospital ? "bg-blue-50" : "bg-green-50"}`}>
          {unit.isHospital
            ? <Building2 size={18} className="text-blue-700" strokeWidth={1.8} />
            : <MapPin size={18} className="text-green-700" strokeWidth={1.8} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{unit.หน่วยบริการ}</p>
          <p className="text-[11px] text-gray-400">HCODE {unit.hcodeKey} · {fmt(unit.จำนวน)} รายการ</p>
        </div>
        <div className="flex items-center gap-5 shrink-0 text-right">
          <div><p className="text-[10px] text-gray-400">เรียกเก็บ</p><p className="text-sm font-bold text-gray-800 tabular-nums">{fmtB(unit.เรียกเก็บ)}</p></div>
          <div><p className="text-[10px] text-gray-400">ชดเชย</p><p className="text-sm font-bold text-green-700 tabular-nums">{fmtB(unit.ชดเชย)}</p></div>
          <div><p className="text-[10px] text-gray-400">ไม่ชดเชย</p><p className="text-sm font-extrabold text-orange-600 tabular-nums">{fmtB(pending)}</p></div>
          <div><p className="text-[10px] text-gray-400">อัตรา</p><p className="text-sm font-extrabold tabular-nums" style={{ color: rateColor }}>{rate}%</p></div>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} className="text-gray-400" />
          </motion.div>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-gray-100">
            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: rateColor }}
                    initial={{ width: 0 }} animate={{ width: `${Math.min(rate, 100)}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }} />
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color: rateColor }}>{rate}% ชดเชย</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-green-700">
                      {["รายการบริการ", "สถานะ", "จำนวน", "เรียกเก็บ (฿)", "ชดเชย (฿)", "ไม่ชดเชย (฿)"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-white font-semibold border-r border-green-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unit.รายการ.map((item, i) => {
                      const svPending = Math.max(0, item.ชดเชย - item.ไม่ชดเชย);
                      const base = i % 2 === 0 ? "#fff" : "#f9fafb";
                      return (
                        <tr key={i} className="border-b border-gray-100 transition-colors" style={{ backgroundColor: base }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f0faf4")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = base)}>
                          <td className="px-3 py-2 text-gray-700 max-w-[200px]">
                            <div className="font-medium">{item.รายการสั้น}</div>
                            {item.รายการขอเบิก !== item.รายการสั้น && <div className="text-[10px] text-gray-400 line-clamp-1">{item.รายการขอเบิก}</div>}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${item.สถานะ === "ชดเชย" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{item.สถานะ}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-700">{fmt(item.จำนวน)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmtB(item.เรียกเก็บ)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-green-700 font-bold">{fmtB(item.ชดเชย)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-orange-600 font-bold">{fmtB(svPending)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Upload Dropzone ──────────────────────────────────────────────────────────
function UploadDropzone({ onSuccess }: { onSuccess: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const upload = useCallback(async (file: File) => {
    setUploading(true); setResult(null);
    const form = new FormData(); form.append("file", file);
    try {
      const res = await fetch("/api/ktb-upload", { method: "POST", body: form, credentials: "include" });
      const json = await res.json();
      setResult({ ok: json.success, msg: json.message ?? json.error });
      if (json.success) setTimeout(onSuccess, 600);
    } catch { setResult({ ok: false, msg: "เชื่อมต่อ server ไม่ได้" }); }
    finally { setUploading(false); }
  }, [onSuccess]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-[#717171]">อัปโหลดข้อมูลรายการไม่ชดเชย</h4>
        <span className="text-[11px] text-gray-400">ktb.xlsx</span>
      </div>
      <motion.div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        onClick={() => !uploading && inputRef.current?.click()}
        animate={{ borderColor: dragging ? "#3aa36a" : "#d1d5db", backgroundColor: dragging ? "#f0faf4" : "#fafafa" }}
        className="border-2 border-dashed rounded-xl cursor-pointer flex flex-col items-center gap-2 py-6 select-none">
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={28} className="text-green-600" /></motion.div>
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
              <p className="text-xs text-gray-400">ไฟล์ Excel รายการไม่ชดเชย</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function KtbDashboardPage() {
  const [data, setData] = useState<KtbDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noFile, setNoFile] = useState(false);
  const [filterUnit, setFilterUnit] = useState("ทั้งหมด");
  const [filterBatch, setFilterBatch] = useState("ทั้งหมด");

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null); setNoFile(false);
    try {
      const res = await fetch("/api/ktb-dashboard", { credentials: "include" });
      if (res.status === 404) { setNoFile(true); setLoading(false); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const unitOptions = useMemo(() => ["ทั้งหมด", ...(data?.units.map(u => u.หน่วยบริการ) ?? [])], [data]);
  const batchOptions = useMemo(() => ["ทั้งหมด", ...(data?.batches.map(b => b.งวดจ่าย) ?? [])], [data]);

  const filteredUnits = useMemo(() => {
    if (!data) return [];
    let units = data.units;
    if (filterUnit !== "ทั้งหมด") units = units.filter(u => u.หน่วยบริการ === filterUnit);
    if (filterBatch !== "ทั้งหมด") {
      const batchData = data.batches.find(b => b.งวดจ่าย === filterBatch);
      if (batchData) {
        const batchHcodes = new Set(batchData.หน่วยบริการ.map(u => u.hcodeKey));
        units = units.filter(u => batchHcodes.has(u.hcodeKey)).map(u => {
          const bUnit = batchData.หน่วยบริการ.find(bu => bu.hcodeKey === u.hcodeKey);
          return bUnit ? { ...u, รายการ: bUnit.รายการ, จำนวน: bUnit.จำนวน, เรียกเก็บ: bUnit.เรียกเก็บ, ชดเชย: bUnit.ชดเชย, ไม่ชดเชย: bUnit.ไม่ชดเชย } : u;
        });
      }
    }
    return units;
  }, [data, filterUnit, filterBatch]);

  const filteredTotals = useMemo(() => ({
    count: filteredUnits.reduce((s, u) => s + u.จำนวน, 0),
    claim: filteredUnits.reduce((s, u) => s + u.เรียกเก็บ, 0),
    comp: filteredUnits.reduce((s, u) => s + u.ชดเชย, 0),
    pending: filteredUnits.reduce((s, u) => s + Math.max(0, u.ชดเชย - u.ไม่ชดเชย), 0),
  }), [filteredUnits]);

  const isFiltered = filterUnit !== "ทั้งหมด" || filterBatch !== "ทั้งหมด";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Dashboard รายการไม่ชดเชย</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            รายการที่ชดเชยแล้วแต่ยังไม่ได้รับการชดเชย
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

      {noFile && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
          <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูล</p>
            <p className="text-xs text-amber-700 mt-1">กรุณาอัปโหลดไฟล์ Excel รายการไม่ชดเชย ด้านล่าง</p>
          </div>
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">⚠️ {error}</div>}

      {/* Filter Bar */}
      {data && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-5 py-4">
          <div className="flex flex-wrap items-end gap-5">
            <div className="flex items-center gap-2 text-gray-500 self-center">
              <Filter size={15} /><span className="text-sm font-semibold">กรองข้อมูล</span>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">หน่วยบริการ</label>
              <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}
                className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7ec8a0] min-w-[200px]">
                {unitOptions.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">งวดจ่าย</label>
              <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)}
                className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7ec8a0] min-w-[200px] font-mono">
                {batchOptions.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            {isFiltered && (
              <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                onClick={() => { setFilterUnit("ทั้งหมด"); setFilterBatch("ทั้งหมด"); }}
                className="px-4 py-2 rounded-xl border-2 border-red-200 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 self-end">
                ล้าง Filter
              </motion.button>
            )}
          </div>
          {isFiltered && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
              <span>แสดง <b className="text-gray-800">{filteredUnits.length}</b> หน่วยบริการ</span>
              <span>เรียกเก็บ <b className="text-gray-800">{fmtB(filteredTotals.claim)}</b> ฿</span>
              <span>ชดเชย <b className="text-green-700">{fmtB(filteredTotals.comp)}</b> ฿</span>
              <span>ไม่ชดเชย<b className="text-orange-600">{fmtB(filteredTotals.pending)}</b> ฿</span>
            </motion.div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      {(loading || data) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[130px] rounded-2xl bg-gray-100 animate-pulse" />)
            : data && <>
              <KpiCard icon={TrendingUp} label="รายการทั้งหมด" value={fmt(isFiltered ? filteredTotals.count : data.totalRows)} sub={isFiltered ? "รายการที่กรองแล้ว" : "รายการในระบบ"} accent="#0369A1" bg="#E0F2FE" />
              <KpiCard icon={Banknote} label="เรียกเก็บรวม" value={fmtB(isFiltered ? filteredTotals.claim : data.totalClaim)} sub="บาท" accent="#854D0E" bg="#FEF9C3" />
              <KpiCard icon={BadgeCheck} label="ชดเชย" value={fmtB(isFiltered ? filteredTotals.comp : data.totalComp)} sub={`${data.batches.length} งวดจ่าย`} accent="#3B6D11" bg="#EAF3DE" />
              <KpiCard icon={AlertTriangle} label="ไม่ชดเชย" value={fmtB(isFiltered ? filteredTotals.pending : data.totalPending)} sub="ยังไม่ได้การชดเชย" accent="#C2410C" bg="#FFF7ED" />
            </>}
        </div>
      )}

      {/* Bar Chart */}
      {data && filteredUnits.length > 0 && <KtbBarChart units={filteredUnits} />}

      {/* Cross Tab */}
      {data && filteredUnits.length > 0 && <CrossTab units={filteredUnits} />}

      {/* Unit Cards */}
      {data && filteredUnits.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">รายละเอียดแยกตามหน่วยบริการ</p>
          {filteredUnits.filter(u => u.isHospital).map(u => <UnitCard key={u.hcodeKey} unit={u} />)}
          {filteredUnits.filter(u => !u.isHospital).map(u => <UnitCard key={u.hcodeKey} unit={u} />)}
        </div>
      )}

      {/* Upload */}
      <UploadDropzone onSuccess={fetchData} />
    </div>
  );
}