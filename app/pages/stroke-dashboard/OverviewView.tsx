"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
    RefreshCw, Info, Wifi, WifiOff, Clock, Brain,
    Users, Activity, Heart, TrendingUp, AlertCircle,
    CheckCircle, MapPin, ChevronUp, ChevronDown, Search, X, Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useAutoRefresh, timeAgo, CountdownRing } from "@/app/components/dashboard/live";
import AiSummaryCard from "@/app/components/ai/AiSummaryCard";
import type { StrokeSheetsDashboardData, StrokeSheetRow } from "@/app/api/stroke-sheets/route";

// ─── Constants ────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 30_000;

// palette หลากสีชุดเดียวกับ dashboard อื่นของระบบ (sepsis / accident / imc)
// — ของเดิมเป็นเขียว 6 เฉดล้วน ทำให้ pie/bar แยกหมวดไม่ออก
const C_CAT = ["#378ADD", "#EF9F27", "#1D9E75", "#E24B4A", "#7F77DD", "#D4537E", "#0AA7A0", "#888780"];
const C_AGE = ["#C7DDF5", "#A5C9EF", "#85B7EB", "#5E9CDD", "#378ADD", "#185FA5"]; // ไล่เฉดตามช่วงอายุ
const C_FAST = "#E24B4A";     // FAST TRACT — แดงฉุกเฉิน
const C_NONFAST = "#85B7EB";  // Non-FAST — ฟ้าอ่อน
const C_RED = "#A32D2D";      // เสียชีวิต
const C_GREEN = "#3B6D11";    // ดีขึ้น
const C_PURPLE = "#7C3AED";   // EKG AF
const TT_STYLE = {
    fontSize: 11, borderRadius: 8,
    border: "0.5px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(0,0,0,.08)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function thaiDate(d: string): string {
    if (!d) return "-";
    const [y, m, day] = d.split("-").map(Number);
    if (!y || !m || !day) return d;
    return `${day} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

function ymLabel(ym: string): string {
    const [y, m] = ym.split("-").map(Number);
    if (!y || !m) return ym;
    return `${THAI_MONTHS[m - 1]} ${String(y + 543).slice(2)}`;
}

function isAF(ekg: string): boolean {
    return /\bAF\b/.test(ekg) && !/non-AF/i.test(ekg);
}

// ─── KPI Card (เฉพาะ stroke — border-left style, ต่างจาก KpiCard กลาง) ──────────
function KpiCard({ label, value, sub, icon: Icon, accent, delay = 0 }: {
    label: string; value: string | number; sub?: string;
    icon: React.ElementType; accent: string; delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.3, ease: "easeOut" }}
            className="bg-white border border-gray-200 rounded-xl p-4"
            style={{ borderLeft: `3px solid ${accent}` }}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: accent + "18" }}>
                    <Icon size={13} style={{ color: accent }} />
                </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 leading-none">{value}</div>
            {sub && <div className="text-[11px] text-gray-400 mt-1">{sub}</div>}
        </motion.div>
    );
}

// ─── Chart Card (เฉพาะ stroke — header เขียว uppercase, ต่างจาก SectionCard กลาง) ──
function ChartCard({ title, children, className = "" }: {
    title: string; children: React.ReactNode; className?: string;
}) {
    return (
        <div className={`bg-white border border-gray-200 rounded-xl p-4 ${className}`}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-3 pb-2 border-b border-gray-100">
                {title}
            </div>
            {children}
        </div>
    );
}

// ─── Sort Icon ────────────────────────────────────────────────────────────────
function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
    if (!active) return null;
    return asc ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StrokeOverviewView() {
    const { data, loading, error, connected, secondsLeft, refetch } =
        useAutoRefresh<StrokeSheetsDashboardData>("/api/stroke-sheets", REFRESH_INTERVAL_MS);

    // Filters
    const [search, setSearch] = useState("");
    const [fYear, setFYear] = useState("");
    const [fType, setFType] = useState("");
    const [fDistrict, setFDistrict] = useState("");
    const [fOutcome, setFOutcome] = useState("");
    const [fEMS, setFEMS] = useState("");
    const [fIMC, setFIMC] = useState("");
    const [fDept, setFDept] = useState("");

    // Table
    const [sortKey, setSortKey] = useState<keyof StrokeSheetRow>("date");
    const [sortAsc, setSortAsc] = useState(false);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    const rows = data?.rows ?? [];

    // Filter options
    const years = useMemo(() =>
        [...new Set(rows.map(r => r.date.slice(0, 4)).filter(Boolean))].sort().reverse(), [rows]);
    const districts = useMemo(() =>
        [...new Set(rows.map(r => r.district).filter(Boolean))].sort(), [rows]);
    const departments = useMemo(() =>
        [...new Set(rows.map(r => r.department).filter(Boolean))].sort(), [rows]);

    // Filtered + sorted rows
    const filtered = useMemo(() => {
        let out = rows.filter(r => {
            if (fYear && !r.date.startsWith(fYear)) return false;
            if (fType && r.type !== fType) return false;
            if (fDistrict && r.district !== fDistrict) return false;
            if (fOutcome && r.outcome !== fOutcome) return false;
            if (fEMS && r.ems !== fEMS) return false;
            if (fIMC === "yes" && !r.isIMC) return false;
            if (fIMC === "no" && r.isIMC) return false;
            if (fDept && r.department !== fDept) return false;
            if (search) {
                const q = search.toLowerCase();
                const blob = [r.name, r.hn, r.district, r.diagnosis, r.definiteDx, r.note].join(" ").toLowerCase();
                if (!blob.includes(q)) return false;
            }
            return true;
        });
        out = [...out].sort((a, b) => {
            const av = a[sortKey] ?? "";
            const bv = b[sortKey] ?? "";
            return sortAsc
                ? String(av).localeCompare(String(bv), "th")
                : String(bv).localeCompare(String(av), "th");
        });
        return out;
    }, [rows, fYear, fType, fDistrict, fOutcome, fEMS, fIMC, fDept, search, sortKey, sortAsc]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // KPIs
    const total = filtered.length;
    const fast = filtered.filter(r => r.type === "FAST TRACT").length;
    const rtpa = filtered.filter(r => /yes/i.test(r.rtPA)).length;
    const dead = filtered.filter(r => /dead/i.test(r.outcome)).length;
    const improved = filtered.filter(r => /improve/i.test(r.outcome)).length;
    const ems = filtered.filter(r => /yes/i.test(r.ems)).length;
    const imc = filtered.filter(r => r.isIMC).length;
    const af = filtered.filter(r => isAF(r.ekg)).length;
    const avgNIHSS = useMemo(() => {
        const nums = filtered.map(r => r.nihss).filter((n): n is number => n != null);
        return nums.length ? Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10 : 0;
    }, [filtered]);

    // Chart data
    const monthData = useMemo(() => {
        const map: Record<string, { fast: number; nonFast: number }> = {};
        filtered.forEach(r => {
            if (!r.date) return;
            const ym = r.date.slice(0, 7);
            if (!map[ym]) map[ym] = { fast: 0, nonFast: 0 };
            if (r.type === "FAST TRACT") map[ym].fast++;
            else map[ym].nonFast++;
        });
        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([ym, v]) => ({ label: ymLabel(ym), ...v, total: v.fast + v.nonFast }));
    }, [filtered]);

    const districtData = useMemo(() => {
        const map: Record<string, number> = {};
        filtered.forEach(r => { if (r.district) map[r.district] = (map[r.district] || 0) + 1; });
        return Object.entries(map).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }));
    }, [filtered]);

    // ─── สรุป KPI รายแผนก ──────────────────────────────────────────────
    const deptStats = useMemo(() => {
        const map: Record<string, StrokeSheetRow[]> = {};
        filtered.forEach(r => {
            const d = r.department || "ไม่ระบุ";
            (map[d] ??= []).push(r);
        });
        return Object.entries(map)
            .map(([name, list]) => {
                const t = list.length;
                const nums = list.map(r => r.nihss).filter((n): n is number => n != null);
                return {
                    name,
                    total: t,
                    fast: list.filter(r => r.type === "FAST TRACT").length,
                    rtpa: list.filter(r => /yes/i.test(r.rtPA)).length,
                    ems: list.filter(r => /yes/i.test(r.ems)).length,
                    imc: list.filter(r => r.isIMC).length,
                    improved: list.filter(r => /improve/i.test(r.outcome)).length,
                    dead: list.filter(r => /dead/i.test(r.outcome)).length,
                    af: list.filter(r => isAF(r.ekg)).length,
                    avgNIHSS: nums.length
                        ? Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10
                        : 0,
                };
            })
            .sort((a, b) => b.total - a.total);
    }, [filtered]);

    const ageData = useMemo(() => {
        const b: Record<string, number> = { "<40": 0, "40-49": 0, "50-59": 0, "60-69": 0, "70-79": 0, "80+": 0 };
        filtered.forEach(r => {
            const a = r.age;
            if (a == null) return;
            if (a < 40) b["<40"]++;
            else if (a < 50) b["40-49"]++;
            else if (a < 60) b["50-59"]++;
            else if (a < 70) b["60-69"]++;
            else if (a < 80) b["70-79"]++;
            else b["80+"]++;
        });
        return Object.entries(b).map(([name, value]) => ({ name, value }));
    }, [filtered]);

    const typeData = [
        { name: "Non-FAST TRACT", value: total - fast },
        { name: "FAST TRACT", value: fast },
    ];
    const outcomeData = [
        { name: "ดีขึ้น (Improve)", value: improved },
        { name: "เสียชีวิต (Dead)", value: dead },
        { name: "ไม่ระบุ", value: Math.max(0, total - improved - dead) },
    ].filter(d => d.value > 0);
    const ekgData = [
        { name: "non-AF", value: filtered.filter(r => /non-AF/i.test(r.ekg)).length },
        { name: "AF", value: af },
        { name: "อื่นๆ", value: filtered.filter(r => r.ekg && !/non-AF/i.test(r.ekg) && !/\bAF\b/.test(r.ekg)).length },
    ].filter(d => d.value > 0);

    // ─── สรุปสำหรับ AI — สถิติรวม (ไม่ส่งรายชื่อ/HN ผู้ป่วย) ───────────────────────
    const aiSummary = useMemo(() => {
        if (!data) return null;
        const activeFilters: string[] = [];
        if (search) activeFilters.push(`ค้นหา="${search}"`);
        if (fYear) activeFilters.push(`ปี=${Number(fYear) + 543}`);
        if (fType) activeFilters.push(`ประเภท=${fType}`);
        if (fDept) activeFilters.push(`แผนก=${fDept}`);
        if (fDistrict) activeFilters.push(`เขต=${fDistrict}`);
        if (fOutcome) activeFilters.push(`outcome=${fOutcome}`);
        if (fEMS) activeFilters.push(`EMS=${fEMS}`);
        if (fIMC) activeFilters.push(`IMC=${fIMC}`);
        const p = (n: number) => total ? Math.round((n / total) * 1000) / 10 : 0;
        return {
            ตัวกรองที่ใช้: activeFilters.length ? activeFilters.join(", ") : "ทั้งหมด (ไม่กรอง)",
            ผู้ป่วยทั้งหมด: total,
            FastTract: { จำนวน: fast, ร้อยละ: p(fast) },
            ได้rtPA: { จำนวน: rtpa, ร้อยละ: p(rtpa) },
            มาด้วยEMS1669: { จำนวน: ems, ร้อยละ: p(ems) },
            IMC: imc,
            ผล: {
                ดีขึ้น_Improve: { จำนวน: improved, ร้อยละ: p(improved) },
                เสียชีวิต_Dead: { จำนวน: dead, ร้อยละ: p(dead) },
            },
            EKG_AF: af,
            NIHSS_เฉลี่ย: avgNIHSS,
            แยกตามแผนก: deptStats.map(d => ({
                แผนก: d.name, ทั้งหมด: d.total, FAST: d.fast, rtPA: d.rtpa,
                EMS: d.ems, IMC: d.imc, Improve: d.improved, เสียชีวิต: d.dead,
                AF: d.af, NIHSS_เฉลี่ย: d.avgNIHSS,
            })),
            แยกตามเขต: Object.fromEntries(districtData.map(d => [d.name, d.value])),
            ช่วงอายุ: Object.fromEntries(ageData.map(d => [d.name, d.value])),
            แนวโน้มรายเดือน: monthData.map(m => ({ เดือน: m.label, FAST: m.fast, NonFAST: m.nonFast, รวม: m.total })),
        };
    }, [data, search, fYear, fType, fDept, fDistrict, fOutcome, fEMS, fIMC,
        total, fast, rtpa, ems, imc, improved, dead, af, avgNIHSS, deptStats, districtData, ageData, monthData]);

    const handleSort = (key: keyof StrokeSheetRow) => {
        if (sortKey === key) setSortAsc(p => !p);
        else { setSortKey(key); setSortAsc(true); }
        setPage(1);
    };

    const clearFilters = () => {
        setSearch(""); setFYear(""); setFType(""); setFDistrict("");
        setFOutcome(""); setFEMS(""); setFIMC(""); setFDept(""); setPage(1);
    };
    const hasFilter = search || fYear || fType || fDistrict || fOutcome || fEMS || fIMC || fDept;

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filtered.map(r => ({
            ลำดับ: r.no, ชื่อ: r.name, HN: r.hn, อายุ: r.age,
            วันที่: r.date, ประเภท: r.type, Onset: r.onset,
            NIHSS: r.nihss, EKG: r.ekg, เขต: r.district, แผนก: r.department,
            "Definite Dx": r.definiteDx, rtPA: r.rtPA,
            Outcome: r.outcome, IMC: r.isIMC ? "Yes" : "", หมายเหตุ: r.note,
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stroke");

        // sheet สรุปรายแผนก
        const wsDept = XLSX.utils.json_to_sheet(deptStats.map(d => ({
            แผนก: d.name, ทั้งหมด: d.total, FAST: d.fast, rtPA: d.rtpa,
            "EMS 1669": d.ems, IMC: d.imc, Improve: d.improved,
            เสียชีวิต: d.dead, AF: d.af, "NIHSS เฉลี่ย": d.avgNIHSS,
        })));
        XLSX.utils.book_append_sheet(wb, wsDept, "สรุปรายแผนก");

        XLSX.writeFile(wb, `stroke_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const renderTH = (label: string, k: keyof StrokeSheetRow) => (
        <th key={k} onClick={() => handleSort(k)}
            className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600 cursor-pointer whitespace-nowrap select-none hover:bg-gray-100 transition-colors">
            <span className="flex items-center gap-1">
                {label}
                <SortIcon active={sortKey === k} asc={sortAsc} />
            </span>
        </th>
    );

    return (
        <div className="space-y-4 text-gray-800">

            {/* ── Header (การ์ดขาว แบบเดียวกับ dashboard อื่นของระบบ) ── */}
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: "#1ca887" }}>
                        <Brain size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-gray-800 font-bold text-sm">Dashboard ผู้ป่วย Stroke — ห้องฉุกเฉิน</div>
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                                style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba", color: "#1a5233" }}>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1ca887] animate-pulse inline-block" />
                                LIVE
                            </span>
                        </div>
                        <div className="text-gray-400 text-[11px] flex items-center gap-2 mt-0.5 flex-wrap">
                            <span>Google Sheets Real-time</span>
                            {data && (
                                <>
                                    <span>·</span>
                                    <Clock size={10} />
                                    <span>อัปเดต {timeAgo(data.updatedAt)}</span>
                                    <span>·</span>
                                    <span>Sheet: {data.sheetName}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                        <CountdownRing secondsLeft={secondsLeft} total={REFRESH_INTERVAL_MS / 1000} />
                        <span className="tabular-nums">{secondsLeft}s</span>
                    </div>
                    <button onClick={refetch} disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 hover:opacity-90"
                        style={{ background: "#1ca887" }}>
                        <motion.span animate={loading ? { rotate: 360 } : { rotate: 0 }}
                            transition={loading ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}>
                            <RefreshCw size={12} />
                        </motion.span>
                        {loading ? "กำลังโหลด..." : "รีเฟรช"}
                    </button>
                    <button onClick={exportExcel}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <Download size={12} /> ส่งออก Excel
                    </button>
                    {error
                        ? <span className="flex items-center gap-1 text-xs text-red-500"><WifiOff size={12} />ไม่เชื่อมต่อ</span>
                        : data
                            ? <span className="flex items-center gap-1 text-xs" style={{ color: "#1ca887" }}><Wifi size={12} />เชื่อมต่อแล้ว</span>
                            : null}
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <Info size={15} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-700">ดึงข้อมูลไม่ได้</p>
                        <p className="text-xs text-red-600 mt-0.5">{error}</p>
                        <p className="text-xs text-gray-400 mt-1">ตรวจสอบ STROKE_SPREADSHEET_ID ใน .env และ Spreadsheet permissions</p>
                    </div>
                </div>
            )}

            {/* ── Filters ── */}
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-36">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="ค้นหาชื่อ, HN, วินิจฉัย..."
                        className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#1ca887]" />
                </div>
                {[
                    { label: "ปี", val: fYear, set: setFYear, opts: years.map(y => ({ v: y, l: `${Number(y) + 543}` })) },
                    { label: "ประเภท", val: fType, set: setFType, opts: ["FAST TRACT", "Non-FAST TRACT"].map(v => ({ v, l: v })) },
                    { label: "แผนก", val: fDept, set: setFDept, opts: departments.map(v => ({ v, l: v })) },
                    { label: "เขต", val: fDistrict, set: setFDistrict, opts: districts.map(v => ({ v, l: v })) },
                    { label: "Outcome", val: fOutcome, set: setFOutcome, opts: ["Improve", "Dead"].map(v => ({ v, l: v })) },
                    { label: "EMS 1669", val: fEMS, set: setFEMS, opts: [{ v: "Yes", l: "ใช่" }, { v: "No", l: "ไม่ใช่" }] },
                    { label: "IMC", val: fIMC, set: setFIMC, opts: [{ v: "yes", l: "เฉพาะ IMC" }, { v: "no", l: "ไม่ใช่ IMC" }] },
                ].map(f => (
                    <select key={f.label} value={f.val}
                        onChange={e => { f.set(e.target.value); setPage(1); }}
                        className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#1ca887]">
                        <option value="">{f.label}: ทั้งหมด</option>
                        {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                ))}
                {hasFilter && (
                    <button onClick={clearFilters}
                        className="flex items-center gap-1 text-xs text-red-500 border border-red-200 rounded-lg px-2 py-1.5 hover:bg-red-50">
                        <X size={11} /> ล้าง
                    </button>
                )}
                <span className="text-xs text-gray-400 ml-auto">{total} ราย</span>
            </div>

            {/* ── Loading shimmer ── */}
            {loading && !data && (
                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="h-[90px] rounded-xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            )}

            {/* ── KPI Cards ── */}
            {data && (
                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
                    <KpiCard label="ทั้งหมด" value={total} sub="ราย" icon={Users} accent="#185FA5" delay={0} />
                    <KpiCard label="Fast Tract" value={fast} sub={`${total ? Math.round(fast / total * 100) : 0}%`} icon={Clock} accent="#E24B4A" delay={0.04} />
                    <KpiCard label="ได้ rtPA" value={rtpa} sub="ราย" icon={Activity} accent="#0AA7A0" delay={0.08} />
                    <KpiCard label="EMS 1669" value={ems} sub={`${total ? Math.round(ems / total * 100) : 0}%`} icon={AlertCircle} accent="#EF9F27" delay={0.12} />
                    <KpiCard label="IMC" value={imc} sub="ราย" icon={MapPin} accent="#d97706" delay={0.16} />
                    <KpiCard label="Improve" value={improved} sub={`${total ? Math.round(improved / total * 100) : 0}%`} icon={CheckCircle} accent="#3B6D11" delay={0.20} />
                    <KpiCard label="เสียชีวิต" value={dead} sub={`${total ? Math.round(dead / total * 100) : 0}%`} icon={Heart} accent="#A32D2D" delay={0.24} />
                    <KpiCard label="EKG AF" value={af} sub="ราย" icon={Activity} accent="#7C3AED" delay={0.28} />
                    <KpiCard label="NIHSS เฉลี่ย" value={avgNIHSS} sub="คะแนน" icon={TrendingUp} accent="#64748B" delay={0.32} />
                </div>
            )}

            {/* ── Monthly bar chart ── */}
            {data && monthData.length > 0 && (
                <ChartCard title="จำนวนผู้ป่วยตามเดือน">
                    <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} />
                                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="nonFast" name="Non-FAST" stackId="a" fill={C_NONFAST} radius={[0, 0, 0, 0]} />
                                <Bar dataKey="fast" name="FAST TRACT" stackId="a" fill={C_FAST} radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            )}

            {/* ── Charts row 2 ── */}
            {data && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ChartCard title="ประเภท Stroke">
                        <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={typeData} dataKey="value" cx="50%" cy="50%" outerRadius={65}
                                        label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
                                        {typeData.map((d, i) => <Cell key={i} fill={d.name === "FAST TRACT" ? C_FAST : C_NONFAST} />)}
                                    </Pie>
                                    <Tooltip contentStyle={TT_STYLE} />
                                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>

                    <ChartCard title="Outcome">
                        <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={outcomeData} dataKey="value" cx="50%" cy="50%" outerRadius={65}
                                        label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
                                        <Cell fill={C_GREEN} />
                                        <Cell fill={C_RED} />
                                        <Cell fill="#d1d5db" />
                                    </Pie>
                                    <Tooltip contentStyle={TT_STYLE} />
                                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>

                    <ChartCard title="EKG (AF / non-AF)">
                        <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={ekgData} dataKey="value" cx="50%" cy="50%" outerRadius={65}
                                        label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
                                        {ekgData.map((d, i) => <Cell key={i} fill={d.name === "AF" ? C_PURPLE : d.name === "non-AF" ? "#378ADD" : "#888780"} />)}
                                    </Pie>
                                    <Tooltip contentStyle={TT_STYLE} />
                                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>

                    <ChartCard title="ช่วงอายุผู้ป่วย">
                        <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ageData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                                    <XAxis type="number" tick={{ fontSize: 10, fill: "#6b7280" }} />
                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#6b7280" }} width={42} />
                                    <Tooltip contentStyle={TT_STYLE} />
                                    <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                                        {ageData.map((_, i) => <Cell key={i} fill={C_AGE[Math.min(i, C_AGE.length - 1)]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>
                </div>
            )}

            {/* ── District chart ── */}
            {data && districtData.length > 0 && (
                <ChartCard title="เขตที่อยู่อาศัย">
                    <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={districtData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} />
                                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Bar dataKey="value" name="จำนวน" radius={[3, 3, 0, 0]}>
                                    {districtData.map((_, i) => <Cell key={i} fill={C_CAT[i % C_CAT.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            )}

            {/* ── สรุปแยกตามแผนก ── */}
            {data && deptStats.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* กราฟจำนวนตามแผนก */}
                    <ChartCard title="จำนวนผู้ป่วยตามแผนก" className="lg:col-span-1">
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={deptStats} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} />
                                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                                    <Tooltip contentStyle={TT_STYLE} />
                                    <Bar dataKey="total" name="จำนวน" radius={[3, 3, 0, 0]}>
                                        {deptStats.map((_, i) => (
                                            <Cell key={i} fill={C_CAT[i % C_CAT.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>

                    {/* ตารางคำนวณรายแผนก */}
                    <ChartCard title="สรุปตัวชี้วัดรายแผนก" className="lg:col-span-2">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {["แผนก", "ทั้งหมด", "FAST", "rtPA", "EMS 1669", "IMC", "Improve", "เสียชีวิต", "AF", "NIHSS เฉลี่ย"]
                                            .map(h => (
                                                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                                                    {h}
                                                </th>
                                            ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {deptStats.map((d, i) => (
                                        <tr key={d.name} className={`border-b border-gray-100 hover:bg-[#F2F7FC] ${i % 2 === 1 ? "bg-gray-50/30" : ""}`}>
                                            <td className="px-3 py-2 font-bold text-gray-800">{d.name}</td>
                                            <td className="px-3 py-2 font-bold text-gray-900">{d.total}</td>
                                            <td className="px-3 py-2 text-gray-700">
                                                {d.fast} <span className="text-gray-400">({d.total ? Math.round(d.fast / d.total * 100) : 0}%)</span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-700">{d.rtpa}</td>
                                            <td className="px-3 py-2 text-gray-700">{d.ems}</td>
                                            <td className="px-3 py-2 text-amber-700 font-medium">{d.imc}</td>
                                            <td className="px-3 py-2 text-green-700">{d.improved}</td>
                                            <td className="px-3 py-2 text-red-600">{d.dead}</td>
                                            <td className="px-3 py-2 text-purple-700">{d.af}</td>
                                            <td className="px-3 py-2 font-bold text-gray-800">{d.avgNIHSS}</td>
                                        </tr>
                                    ))}
                                    {/* แถวรวม */}
                                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                                        <td className="px-3 py-2 text-gray-800">รวม</td>
                                        <td className="px-3 py-2 text-gray-900">{deptStats.reduce((s, d) => s + d.total, 0)}</td>
                                        <td className="px-3 py-2 text-gray-700">{deptStats.reduce((s, d) => s + d.fast, 0)}</td>
                                        <td className="px-3 py-2 text-gray-700">{deptStats.reduce((s, d) => s + d.rtpa, 0)}</td>
                                        <td className="px-3 py-2 text-gray-700">{deptStats.reduce((s, d) => s + d.ems, 0)}</td>
                                        <td className="px-3 py-2 text-amber-700">{deptStats.reduce((s, d) => s + d.imc, 0)}</td>
                                        <td className="px-3 py-2 text-green-700">{deptStats.reduce((s, d) => s + d.improved, 0)}</td>
                                        <td className="px-3 py-2 text-red-600">{deptStats.reduce((s, d) => s + d.dead, 0)}</td>
                                        <td className="px-3 py-2 text-purple-700">{deptStats.reduce((s, d) => s + d.af, 0)}</td>
                                        <td className="px-3 py-2 text-gray-400">—</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </ChartCard>
                </div>
            )}

            {/* ── Patient Table ── */}
            {data && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">รายชื่อผู้ป่วย</div>
                        <span className="bg-[#1ca887] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                            {filtered.length} ราย
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-600">#</th>
                                    {renderTH("ชื่อ-นามสกุล", "name")}
                                    {renderTH("HN", "hn")}
                                    {renderTH("อายุ", "age")}
                                    {renderTH("วันที่", "date")}
                                    {renderTH("ประเภท", "type")}
                                    {renderTH("แผนก", "department")}
                                    {renderTH("Onset", "onset")}
                                    {renderTH("NIHSS", "nihss")}
                                    {renderTH("EKG", "ekg")}
                                    {renderTH("เขต", "district")}
                                    {renderTH("rtPA", "rtPA")}
                                    {renderTH("Outcome", "outcome")}
                                    <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-600">หมายเหตุ / IMC</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((r, i) => (
                                    <tr key={r.id} className={`border-b border-gray-100 hover:bg-[#F2F7FC] transition-colors ${i % 2 === 1 ? "bg-gray-50/30" : ""}`}>
                                        <td className="px-3 py-2 text-gray-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                                        <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap max-w-[160px] truncate">{r.name || "-"}</td>
                                        <td className="px-3 py-2 text-gray-500 font-mono text-[10px]">{r.hn || "-"}</td>
                                        <td className="px-3 py-2 text-gray-700">{r.age ?? "-"}</td>
                                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{thaiDate(r.date)}</td>
                                        <td className="px-3 py-2">
                                            {r.type === "FAST TRACT"
                                                ? <span className="bg-[#FCE4E3] text-[#A32D2D] font-bold text-[10px] px-2 py-0.5 rounded-full">FAST</span>
                                                : <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full">Non-FAST</span>}
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.department
                                                ? <span className="bg-[#E6F1FB] text-[#185FA5] font-semibold text-[10px] px-2 py-0.5 rounded-full">{r.department}</span>
                                                : <span className="text-gray-400">-</span>}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{r.onset || "-"}</td>
                                        <td className="px-3 py-2 text-center font-bold text-gray-800">{r.nihss ?? "-"}</td>
                                        <td className="px-3 py-2">
                                            {isAF(r.ekg)
                                                ? <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">AF</span>
                                                : <span className="text-gray-500">{r.ekg || "-"}</span>}
                                        </td>
                                        <td className="px-3 py-2 text-gray-700">{r.district || "-"}</td>
                                        <td className="px-3 py-2">
                                            {/yes/i.test(r.rtPA)
                                                ? <span className="bg-[#D9F2EF] text-[#0F766E] font-bold text-[10px] px-2 py-0.5 rounded-full">Yes</span>
                                                : <span className="text-gray-400 text-[10px]">No</span>}
                                        </td>
                                        <td className="px-3 py-2">
                                            {/improve/i.test(r.outcome)
                                                ? <span className="bg-green-100 text-green-800 font-bold text-[10px] px-2 py-0.5 rounded-full">Improve</span>
                                                : /dead/i.test(r.outcome)
                                                    ? <span className="bg-red-100 text-red-800 font-bold text-[10px] px-2 py-0.5 rounded-full">Dead</span>
                                                    : <span className="text-gray-400">{r.outcome || "-"}</span>}
                                        </td>
                                        <td className="px-3 py-2 max-w-[180px]">
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {r.isIMC && <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-1.5 py-0.5 rounded">IMC</span>}
                                                {/yes/i.test(r.ems) && <span className="bg-red-100 text-red-700 font-bold text-[10px] px-1.5 py-0.5 rounded">1669</span>}
                                                {r.note && !r.isIMC && (
                                                    <span className="text-gray-400 truncate text-[10px]">
                                                        {r.note.slice(0, 35)}{r.note.length > 35 ? "…" : ""}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {paged.length === 0 && (
                                    <tr><td colSpan={14} className="text-center py-12 text-gray-400">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-xs text-gray-500">หน้า {page} / {totalPages} · {filtered.length} รายการ</span>
                            <div className="flex gap-1.5">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:border-[#1ca887] transition-colors">
                                    ← ก่อนหน้า
                                </button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:border-[#1ca887] transition-colors">
                                    ถัดไป →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Empty state ── */}
            {!loading && !error && data && rows.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 flex flex-col items-center gap-3 text-center">
                    <Info size={28} className="text-amber-500" />
                    <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูลใน Spreadsheet</p>
                    <p className="text-xs text-amber-700">เพิ่มข้อมูลผู้ป่วย Stroke ลงใน Google Sheets แล้ว Dashboard จะอัปเดตทุก 30 วินาที</p>
                    <p className="text-[11px] text-gray-400 font-mono">Sheet: {data.sheetName}</p>
                </div>
            )}

            {/* ── AI สรุป + แชท (ปุ่มลอยมุมขวาล่าง + modal กลางจอ) ── */}
            <AiSummaryCard
                summary={aiSummary}
                context="Dashboard ผู้ป่วยโรคหลอดเลือดสมอง (Stroke) ห้องฉุกเฉิน รพ.พลับพลาชัย — ติดตาม Stroke Fast Track, การให้ยาละลายลิ่มเลือด rtPA, การมาด้วย EMS 1669, ผลการรักษา (Improve/Dead), NIHSS, ภาวะ AF จาก EKG และตัวชี้วัดแยกรายแผนก ข้อมูลสรุปตามตัวกรองที่ผู้ใช้เลือก"
                disabled={!aiSummary}
            />
        </div>
    );
}