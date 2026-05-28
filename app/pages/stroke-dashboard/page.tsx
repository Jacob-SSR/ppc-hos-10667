"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
    Upload, Download, RefreshCw, Search, X,
    Brain, Activity, Heart, Users, TrendingUp,
    AlertCircle, CheckCircle, Clock, MapPin,
    ChevronUp, ChevronDown,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface StrokeRow {
    id: number;
    name: string;
    hn: string | number;
    age: number | null;
    comorbidity: string;
    date: string;      // "YYYY-MM-DD" CE
    dateRaw: string;
    maaRP: string;
    onset: string;
    type: string;      // "FAST TRACT" | "Non-FAST TRACT"
    diagnosis: string;
    nihss: number | null;
    dtx: string;
    ekg: string;
    ems: string;
    status: string;
    department: string;
    district: string;
    definiteDx: string;
    ctScan: string;
    rtPA: string;
    outcome: string;
    note: string;
    isIMC: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function parseDate(raw: unknown): string {
    if (!raw) return "";
    // Excel date object from SheetJS
    if (raw instanceof Date) {
        let y = raw.getFullYear();
        if (y > 2400) y -= 543;
        if (y < 1900 || y > 2200) return "";
        const m = String(raw.getMonth() + 1).padStart(2, "0");
        const d = String(raw.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }
    const s = String(raw).trim();
    // Thai year string: "2567-01-01"
    const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m1) {
        let y = parseInt(m1[1]);
        if (y > 2400) y -= 543;
        if (y < 1900 || y > 2200) return "";
        return `${y}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
    }
    return "";
}

function dateToYM(d: string): string {
    return d.slice(0, 7);
}

function ymLabel(ym: string): string {
    const [y, m] = ym.split("-").map(Number);
    return `${THAI_MONTHS[m - 1]} ${String(y + 543).slice(2)}`;
}

function thaiDate(d: string): string {
    if (!d) return "-";
    const [y, m, day] = d.split("-").map(Number);
    return `${day} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

function str(v: unknown): string {
    return v == null ? "" : String(v).trim();
}

function parseRow(r: Record<string, unknown>, i: number): StrokeRow {
    const note = str(r["หมายเหตุ"]);
    const definiteDx = str(r["Definite diagnosis"]);
    const isIMC = /imc/i.test(note) || /imc/i.test(definiteDx) || /refer.back/i.test(note);
    const nihssRaw = r["NIHSS"];
    const nihss = nihssRaw != null && !isNaN(parseFloat(String(nihssRaw)))
        ? parseFloat(String(nihssRaw))
        : null;

    return {
        id: i,
        name: str(r["ชื่อ-นามสกุล"]),
        hn: str(r["HN"]),
        age: r["อายุ(ปี)"] != null && !isNaN(Number(r["อายุ(ปี)"])) ? Number(r["อายุ(ปี)"]) : null,
        comorbidity: str(r["โรคประจำตัว"]),
        date: parseDate(r["วันที่รับบริการ"]),
        dateRaw: str(r["วันที่รับบริการ"]),
        maaRP: str(r["มารพ ด้วย"]),
        onset: str(r["Onset time"]),
        type: str(r["Type of Stoke"]),
        diagnosis: str(r["Diagnosis"]),
        nihss,
        dtx: str(r["DTX"]),
        ekg: str(r["EKG 12 leads"]),
        ems: str(r["บริการด้วย 1669"]),
        status: str(r["สถานะผู้ป่วย"]),
        department: str(r["แผนกที่วินิจฉัย"]),
        district: str(r["เขตที่อยู่อาศัย"]),
        definiteDx,
        ctScan: str(r["ผล CT brain scan"]),
        rtPA: str(r["ได้รับา rtPA"]) || str(r["ได้รับ rtPA"]),
        outcome: str(r["Outcome"]),
        note,
        isIMC,
    };
}

function parseXlsx(file: File): Promise<StrokeRow[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: "array", cellDates: true });
                const wsName = wb.SheetNames.find(n => n.includes("ชีต") || n.includes("Stroke") || n.includes("stroke")) ?? wb.SheetNames[0];
                const ws = wb.Sheets[wsName];
                const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
                resolve(rows.filter(r => r["ชื่อ-นามสกุล"] || r["HN"]).map(parseRow));
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

// ─── Chart colors ──────────────────────────────────────────────────────────────
const C_BLUE = ["#1e3a8a", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"];
const C_TEAL = ["#0f766e", "#0d9488", "#14b8a6", "#2dd4bf", "#99f6e4"];
const C_RED = "#ef4444";
const C_GREEN = "#22c55e";

// ─── Sub-components ────────────────────────────────────────────────────────────
interface KpiProps {
    label: string;
    value: string | number;
    sub?: string;
    icon: React.ElementType;
    accent: string;
    delay?: number;
}
function KpiCard({ label, value, sub, icon: Icon, accent, delay = 0 }: KpiProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.35, ease: "easeOut" }}
            className="bg-white border border-gray-200 rounded-xl p-4"
            style={{ borderLeft: `3px solid ${accent}` }}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: accent + "18" }}>
                    <Icon size={14} style={{ color: accent }} />
                </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 leading-none">{value}</div>
            {sub && <div className="text-xs text-gray-400 mt-1.5">{sub}</div>}
        </motion.div>
    );
}

interface ChartCardProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}
function ChartCard({ title, children, className = "" }: ChartCardProps) {
    return (
        <div className={`bg-white border border-gray-200 rounded-xl p-4 ${className}`}>
            <div className="text-xs font-bold uppercase tracking-wider text-[#1e3a8a] mb-3 pb-2 border-b border-blue-50">
                {title}
            </div>
            {children}
        </div>
    );
}

const TT_STYLE = {
    fontSize: 11,
    borderRadius: 8,
    border: "0.5px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(0,0,0,.08)",
};

// ─── Initial demo data (first 30 rows from file) ───────────────────────────────
const DEMO: StrokeRow[] = [
    { id: 0, name: "นายประเสริฐ นวลประโคน", hn: "470020747", age: 71, comorbidity: "DM, ischemic stroke ปี 62", date: "2024-01-01", dateRaw: "", maaRP: "", onset: "> 3hr", type: "Non-FAST TRACT", diagnosis: "Stroke", nihss: 10, dtx: "146", ekg: "non-AF", ems: "Yes", status: "Refer", department: "ER", district: "สำโรง", definiteDx: "", ctScan: "", rtPA: "No", outcome: "", note: "", isIMC: false },
    { id: 1, name: "นางเอียด จารัมย์", hn: "460001405", age: 67, comorbidity: "DM2, HT", date: "2024-01-02", dateRaw: "", maaRP: "", onset: "> 3hr", type: "Non-FAST TRACT", diagnosis: "AOC c R/O stroke", nihss: 3, dtx: "122", ekg: "non-AF", ems: "No", status: "Refer", department: "ER", district: "พลับพลาชัย", definiteDx: "AOC", ctScan: "", rtPA: "No", outcome: "Improve", note: "", isIMC: false },
    { id: 2, name: "นางเพะ ระวังดี", hn: "460002959", age: 55, comorbidity: "DM,HT", date: "2024-01-03", dateRaw: "", maaRP: "", onset: "≤ 3hr", type: "FAST TRACT", diagnosis: "stroke Fast tract", nihss: 2, dtx: "124", ekg: "non-AF", ems: "No", status: "Refer", department: "OPD", district: "สำโรง", definiteDx: "Acute ischemic stroke", ctScan: "", rtPA: "Yes", outcome: "Improve", note: "", isIMC: false },
    { id: 3, name: "นายศราวุธ โคลดประโคน", hn: "460007901", age: 45, comorbidity: "stroke hemorrhage ปี 64, HT", date: "2024-01-06", dateRaw: "", maaRP: "", onset: "≤ 3hr", type: "FAST TRACT", diagnosis: "AOC DDx stroke FT", nihss: null, dtx: "151", ekg: "non-AF", ems: "No", status: "Refer", department: "ER", district: "โคกขมิ้น", definiteDx: "Intracerebral hemorrhage", ctScan: "", rtPA: "No", outcome: "Dead", note: "ญาติNR off ET-tube at home", isIMC: false },
    { id: 4, name: "นางเสือม คงทันดี", hn: "460007262", age: 68, comorbidity: "DM, HT", date: "2024-02-22", dateRaw: "", maaRP: "", onset: "≤ 3hr", type: "FAST TRACT", diagnosis: "stroke Fast tract c AAF c RVR", nihss: 3, dtx: "117", ekg: "AF", ems: "No", status: "Refer", department: "ER", district: "ป่าชัน", definiteDx: "Lt. MCA infarction", ctScan: "", rtPA: "No", outcome: "Improve", note: "IMC", isIMC: true },
    { id: 5, name: "นางสวย สงวนแบบ", hn: "470019586", age: 86, comorbidity: "old TB", date: "2024-02-27", dateRaw: "", maaRP: "", onset: "≤ 3hr", type: "FAST TRACT", diagnosis: "stroke Fast tract", nihss: 7, dtx: "177", ekg: "non-AF", ems: "No", status: "Refer", department: "ER", district: "ป่าชัน", definiteDx: "stroke Fast tract", ctScan: "", rtPA: "Yes", outcome: "Improve", note: "IMC", isIMC: true },
];

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StrokeDashboardPage() {
    const [rows, setRows] = useState<StrokeRow[]>(DEMO);
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState("");
    const [search, setSearch] = useState("");
    const [fYear, setFYear] = useState("");
    const [fType, setFType] = useState("");
    const [fDistrict, setFDistrict] = useState("");
    const [fOutcome, setFOutcome] = useState("");
    const [fEMS, setFEMS] = useState("");
    const [fIMC, setFIMC] = useState("");
    const [sortKey, setSortKey] = useState<keyof StrokeRow>("date");
    const [sortAsc, setSortAsc] = useState(false);
    const [page, setPage] = useState(1);
    const fileRef = useRef<HTMLInputElement>(null);
    const PAGE_SIZE = 20;

    const showToast = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(""), 2800);
    }, []);

    const handleUpload = useCallback(async (file: File) => {
        if (!file.name.match(/\.(xlsx|xls)$/i)) { showToast("รองรับเฉพาะไฟล์ .xlsx / .xls"); return; }
        setUploading(true);
        try {
            const data = await parseXlsx(file);
            setRows(data);
            setPage(1);
            showToast(`โหลดข้อมูลสำเร็จ ${data.length} ราย`);
        } catch (e) {
            showToast("อ่านไฟล์ไม่ได้: " + String(e));
        } finally {
            setUploading(false);
        }
    }, [showToast]);

    // ── Derived filters ────────────────────────────────────────────────────────
    const years = useMemo(() => [...new Set(rows.map(r => r.date.slice(0, 4)).filter(Boolean))].sort().reverse(), [rows]);
    const districts = useMemo(() => [...new Set(rows.map(r => r.district).filter(Boolean))].sort(), [rows]);

    const filtered = useMemo(() => {
        let out = rows.filter(r => {
            if (fYear && !r.date.startsWith(fYear)) return false;
            if (fType && r.type !== fType) return false;
            if (fDistrict && r.district !== fDistrict) return false;
            if (fOutcome && r.outcome !== fOutcome) return false;
            if (fEMS && r.ems !== fEMS) return false;
            if (fIMC === "yes" && !r.isIMC) return false;
            if (fIMC === "no" && r.isIMC) return false;
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
            return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
        return out;
    }, [rows, fYear, fType, fDistrict, fOutcome, fEMS, fIMC, search, sortKey, sortAsc]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // ── KPIs ───────────────────────────────────────────────────────────────────
    const total = filtered.length;
    const fast = filtered.filter(r => r.type === "FAST TRACT").length;
    const rtpa = filtered.filter(r => r.rtPA === "Yes").length;
    const dead = filtered.filter(r => r.outcome === "Dead").length;
    const improved = filtered.filter(r => r.outcome === "Improve").length;
    const ems = filtered.filter(r => r.ems === "Yes").length;
    const imc = filtered.filter(r => r.isIMC).length;
    const af = filtered.filter(r => /AF/.test(r.ekg) && !/non-AF/.test(r.ekg)).length;
    const avgNIHSS = (() => {
        const nums = filtered.map(r => r.nihss).filter((n): n is number => n != null);
        return nums.length ? Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10 : 0;
    })();

    // ── Chart data ─────────────────────────────────────────────────────────────
    const monthData = useMemo(() => {
        const map: Record<string, { fast: number; nonFast: number }> = {};
        filtered.forEach(r => {
            if (!r.date) return;
            const ym = dateToYM(r.date);
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

    const ageData = useMemo(() => {
        const buckets: Record<string, number> = { "<40": 0, "40-49": 0, "50-59": 0, "60-69": 0, "70-79": 0, "80+": 0 };
        filtered.forEach(r => {
            const a = r.age;
            if (a == null) return;
            if (a < 40) buckets["<40"]++;
            else if (a < 50) buckets["40-49"]++;
            else if (a < 60) buckets["50-59"]++;
            else if (a < 70) buckets["60-69"]++;
            else if (a < 80) buckets["70-79"]++;
            else buckets["80+"]++;
        });
        return Object.entries(buckets).map(([name, value]) => ({ name, value }));
    }, [filtered]);

    const typeData = [
        { name: "Non-FAST TRACT", value: total - fast },
        { name: "FAST TRACT", value: fast },
    ];
    const outcomeData = [
        { name: "ดีขึ้น (Improve)", value: improved },
        { name: "เสียชีวิต (Dead)", value: dead },
        { name: "ไม่ระบุ", value: total - improved - dead },
    ];
    const ekgData = [
        { name: "non-AF", value: filtered.filter(r => r.ekg === "non-AF").length },
        { name: "AF", value: af },
        { name: "อื่นๆ", value: filtered.filter(r => r.ekg && r.ekg !== "non-AF" && !/AF/.test(r.ekg)).length },
    ];

    const handleSort = (key: keyof StrokeRow) => {
        if (sortKey === key) setSortAsc(p => !p);
        else { setSortKey(key); setSortAsc(true); }
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filtered.map(r => ({
            "ชื่อ-นามสกุล": r.name, HN: r.hn, อายุ: r.age,
            วันที่: r.date, ประเภท: r.type, Onset: r.onset,
            NIHSS: r.nihss, EKG: r.ekg, เขต: r.district,
            "Definite Dx": r.definiteDx, rtPA: r.rtPA,
            Outcome: r.outcome, IMC: r.isIMC ? "Yes" : "", หมายเหตุ: r.note,
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stroke");
        XLSX.writeFile(wb, `stroke_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const SortIcon = ({ k }: { k: keyof StrokeRow }) =>
        sortKey === k
            ? sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />
            : null;

    const TH = ({ label, k, className = "" }: { label: string; k: keyof StrokeRow; className?: string }) => (
        <th
            onClick={() => handleSort(k)}
            className={`px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-800 cursor-pointer whitespace-nowrap select-none hover:bg-blue-100 transition-colors ${className}`}
        >
            <span className="flex items-center gap-1">{label}<SortIcon k={k} /></span>
        </th>
    );

    return (
        <div className="space-y-4 text-gray-800">
            {/* Header */}
            <div className="bg-[#1e3a8a] rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                        <Brain size={20} className="text-white" />
                    </div>
                    <div>
                        <div className="text-white font-bold text-sm leading-tight">Dashboard ผู้ป่วย STROKE — ห้องฉุกเฉิน</div>
                        <div className="text-blue-300 text-[11px]">รายงานการวินิจฉัยและการรักษาผู้ป่วยโรคหลอดเลือดสมอง</div>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="text-blue-300 text-xs">{total} ราย</span>
                    <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white text-[#1e3a8a] rounded-lg hover:bg-blue-50 transition-all disabled:opacity-50"
                    >
                        {uploading ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
                        {uploading ? "กำลังโหลด..." : "อัปโหลด Excel"}
                    </button>
                    <button
                        onClick={exportExcel}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 transition-all"
                    >
                        <Download size={12} /> ส่งออก
                    </button>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-40">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="ค้นหาชื่อ, HN, การวินิจฉัย..."
                        className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2563eb]"
                    />
                </div>
                {[
                    { label: "ปี", val: fYear, set: setFYear, opts: years.map(y => ({ v: y, l: `${y} (พ.ศ. ${Number(y) + 543})` })) },
                    { label: "ประเภท", val: fType, set: setFType, opts: ["FAST TRACT", "Non-FAST TRACT"].map(v => ({ v, l: v })) },
                    { label: "เขต", val: fDistrict, set: setFDistrict, opts: districts.map(v => ({ v, l: v })) },
                    { label: "Outcome", val: fOutcome, set: setFOutcome, opts: ["Improve", "Dead"].map(v => ({ v, l: v })) },
                    { label: "EMS 1669", val: fEMS, set: setFEMS, opts: [{ v: "Yes", l: "ใช่" }, { v: "No", l: "ไม่ใช่" }] },
                    { label: "IMC", val: fIMC, set: setFIMC, opts: [{ v: "yes", l: "เฉพาะ IMC" }, { v: "no", l: "ไม่ใช่ IMC" }] },
                ].map(f => (
                    <select key={f.label} value={f.val} onChange={e => { f.set(e.target.value); setPage(1); }}
                        className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#2563eb]">
                        <option value="">{f.label}: ทั้งหมด</option>
                        {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                ))}
                {(search || fYear || fType || fDistrict || fOutcome || fEMS || fIMC) && (
                    <button onClick={() => { setSearch(""); setFYear(""); setFType(""); setFDistrict(""); setFOutcome(""); setFEMS(""); setFIMC(""); setPage(1); }}
                        className="flex items-center gap-1 text-xs text-red-500 border border-red-200 rounded-lg px-2 py-1.5 hover:bg-red-50">
                        <X size={11} /> ล้าง
                    </button>
                )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
                <KpiCard label="ทั้งหมด" value={total} sub="ราย" icon={Users} accent="#2563eb" delay={0} />
                <KpiCard label="Fast Tract" value={fast} sub={`${total ? Math.round(fast / total * 100) : 0}%`} icon={Clock} accent="#0891b2" delay={.04} />
                <KpiCard label="ได้ rtPA" value={rtpa} sub="ราย" icon={Activity} accent="#0d9488" delay={.08} />
                <KpiCard label="EMS 1669" value={ems} sub={`${total ? Math.round(ems / total * 100) : 0}%`} icon={AlertCircle} accent="#7c3aed" delay={.12} />
                <KpiCard label="IMC" value={imc} sub="ราย" icon={MapPin} accent="#d97706" delay={.16} />
                <KpiCard label="Improve" value={improved} sub={`${total ? Math.round(improved / total * 100) : 0}%`} icon={CheckCircle} accent="#16a34a" delay={.20} />
                <KpiCard label="เสียชีวิต" value={dead} sub={`${total ? Math.round(dead / total * 100) : 0}%`} icon={Heart} accent="#dc2626" delay={.24} />
                <KpiCard label="EKG AF" value={af} sub="ราย" icon={Activity} accent="#9333ea" delay={.28} />
                <KpiCard label="NIHSS เฉลี่ย" value={avgNIHSS} sub="คะแนน" icon={TrendingUp} accent="#1e3a8a" delay={.32} />
            </div>

            {/* Charts row 1 */}
            <div className="grid grid-cols-3 gap-4">
                <ChartCard title="จำนวนผู้ป่วยตามเดือน" className="col-span-3 lg:col-span-1 lg:col-span-3">
                    <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} />
                                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="nonFast" name="Non-FAST" stackId="a" fill="#93c5fd" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="fast" name="FAST TRACT" stackId="a" fill="#1e3a8a" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* Charts row 2 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ChartCard title="ประเภท Stroke">
                    <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={typeData} dataKey="value" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${Math.round(percent * 100)}%`} labelLine={false}>
                                    {typeData.map((_, i) => <Cell key={i} fill={C_BLUE[i * 2]} />)}
                                </Pie>
                                <Tooltip contentStyle={TT_STYLE} />
                                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                <ChartCard title="ผลการรักษา (Outcome)">
                    <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={outcomeData} dataKey="value" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${Math.round(percent * 100)}%`} labelLine={false}>
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
                                <Pie data={ekgData} dataKey="value" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${Math.round(percent * 100)}%`} labelLine={false}>
                                    {ekgData.map((_, i) => <Cell key={i} fill={C_TEAL[i]} />)}
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
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#6b7280" }} width={40} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Bar dataKey="value" fill="#2563eb" radius={[0, 3, 3, 0]}>
                                    {ageData.map((_, i) => <Cell key={i} fill={C_BLUE[Math.min(i, C_BLUE.length - 1)]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* District chart */}
            <ChartCard title="เขตที่อยู่อาศัย (จำนวนผู้ป่วย)">
                <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={districtData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Bar dataKey="value" name="จำนวน" radius={[3, 3, 0, 0]}>
                                {districtData.map((_, i) => <Cell key={i} fill={C_BLUE[Math.min(i, C_BLUE.length - 1)]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider">
                        รายชื่อผู้ป่วย
                    </div>
                    <span className="bg-[#2563eb] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        {filtered.length} ราย
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                        <thead className="bg-blue-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2.5 text-left text-[11px] font-bold text-blue-800">#</th>
                                <TH label="ชื่อ-นามสกุล" k="name" />
                                <TH label="HN" k="hn" />
                                <TH label="อายุ" k="age" />
                                <TH label="วันที่" k="date" />
                                <TH label="ประเภท" k="type" />
                                <TH label="Onset" k="onset" />
                                <TH label="NIHSS" k="nihss" />
                                <TH label="EKG" k="ekg" />
                                <TH label="เขต" k="district" />
                                <TH label="rtPA" k="rtPA" />
                                <TH label="Outcome" k="outcome" />
                                <th className="px-3 py-2.5 text-left text-[11px] font-bold text-blue-800">หมายเหตุ / IMC</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paged.map((r, i) => (
                                <tr key={r.id} className={`border-b border-gray-100 hover:bg-blue-50/40 transition-colors ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                                    <td className="px-3 py-2 text-gray-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                                    <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap max-w-[160px] truncate">{r.name || "-"}</td>
                                    <td className="px-3 py-2 text-gray-600 font-mono">{r.hn || "-"}</td>
                                    <td className="px-3 py-2 text-gray-700">{r.age ?? "-"}</td>
                                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{thaiDate(r.date)}</td>
                                    <td className="px-3 py-2">
                                        {r.type === "FAST TRACT"
                                            ? <span className="bg-[#dbeafe] text-[#1e40af] font-bold text-[10px] px-2 py-0.5 rounded-full">FAST</span>
                                            : <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full">Non-FAST</span>
                                        }
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{r.onset || "-"}</td>
                                    <td className="px-3 py-2 text-center font-bold text-gray-800">{r.nihss ?? "-"}</td>
                                    <td className="px-3 py-2">
                                        {/AF/.test(r.ekg) && !/non-AF/.test(r.ekg)
                                            ? <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">AF</span>
                                            : <span className="text-gray-500">{r.ekg || "-"}</span>
                                        }
                                    </td>
                                    <td className="px-3 py-2 text-gray-700">{r.district || "-"}</td>
                                    <td className="px-3 py-2">
                                        {r.rtPA === "Yes"
                                            ? <span className="bg-[#bfdbfe] text-[#1e3a8a] font-bold text-[10px] px-2 py-0.5 rounded-full">Yes</span>
                                            : <span className="text-gray-400">No</span>
                                        }
                                    </td>
                                    <td className="px-3 py-2">
                                        {r.outcome === "Improve"
                                            ? <span className="bg-green-100 text-green-800 font-bold text-[10px] px-2 py-0.5 rounded-full">Improve</span>
                                            : r.outcome === "Dead"
                                                ? <span className="bg-red-100 text-red-800 font-bold text-[10px] px-2 py-0.5 rounded-full">Dead</span>
                                                : <span className="text-gray-400">{r.outcome || "-"}</span>
                                        }
                                    </td>
                                    <td className="px-3 py-2 max-w-[180px]">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {r.isIMC && <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-1.5 py-0.5 rounded">IMC</span>}
                                            {r.ems === "Yes" && <span className="bg-red-100 text-red-700 font-bold text-[10px] px-1.5 py-0.5 rounded">1669</span>}
                                            {r.note && !r.isIMC && <span className="text-gray-400 truncate">{r.note.slice(0, 40)}{r.note.length > 40 ? "…" : ""}</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {paged.length === 0 && (
                                <tr><td colSpan={13} className="text-center py-12 text-gray-400">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-gray-500">หน้า {page} / {totalPages}</span>
                        <div className="flex gap-1.5">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:border-[#2563eb] transition-colors">← ก่อนหน้า</button>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:border-[#2563eb] transition-colors">ถัดไป →</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ x: "110%", opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "110%", opacity: 0 }}
                        className="fixed bottom-5 right-5 z-[9999] bg-[#1e3a8a] text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-xl"
                    >
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}