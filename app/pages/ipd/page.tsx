"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronDown, FiChevronUp, FiCopy } from "react-icons/fi";
import {
    BedDouble,
    Users,
    Clock,
    TrendingUp,
    Search,
    FileDown,
    AlertCircle,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { formatDate, formatThaiDate } from "@/lib/dateUtils";
import { exportToExcel } from "@/lib/exportExcel";
import { copyToClipboard } from "@/lib/clipboard";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// ── Ward label map ────────────────────────────────────────────────────────────
const WARD_LABELS: Record<string, string> = {
    "01": "ผู้ป่วยใน",
    "04": "ห้องพิเศษ",
    "14": "HW ยาเสพติด",
    "15": "พลับพลารักษ์",
};

const WARD_COLORS: Record<string, { bg: string; text: string; bar: string; light: string }> = {
    "01": { bg: "bg-blue-50", text: "text-blue-700", bar: "rgba(37,99,235,0.8)", light: "#dbeafe" },
    "04": { bg: "bg-orange-50", text: "text-orange-700", bar: "rgba(234,88,12,0.8)", light: "#ffedd5" },
    "14": { bg: "bg-pink-50", text: "text-pink-700", bar: "rgba(219,39,119,0.8)", light: "#fce7f3" },
    "15": { bg: "bg-teal-50", text: "text-teal-700", bar: "rgba(13,148,136,0.8)", light: "#ccfbf1" },
};

// ── Interfaces ────────────────────────────────────────────────────────────────
interface WardStat {
    ward_code: string;
    total: number;
    unique_patients: number;
    avg_los: number;
    discharge_normal: number;
    discharge_other: number;
    admit_total: number;
}

interface SummaryData {
    summary: { total: number; unique_patients: number; avg_los: number };
    byWard: WardStat[];
    byPttype: { pttype_name: string; total: number }[];
    byDchtype: { dchtype_name: string; total: number }[];
}

interface DischargeRow {
    dchtype_name: string;
    hn: string;
    cid: string;
    an: string;
    pname: string;
    fname: string;
    lname: string;
    regdate: string;
    regtime: string;
    dchdate: string;
    dchtime: string;
    ward_code: string;
    doctor_name: string;
    admdate: string;
    pdx: string;
    pttype_name: string;
    los: number;
    address: string;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
    icon: Icon,
    label,
    value,
    sub,
    color,
    delay = 0,
}: {
    icon: any;
    label: string;
    value: any;
    sub?: string;
    color: string;
    delay?: number;
}) {
    return (
        <motion.div
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-start gap-4"
            style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.07)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, type: "spring", stiffness: 260, damping: 22 }}
        >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color} shrink-0`}>
                <Icon size={22} className="text-white" />
            </div>
            <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
                <p className="text-2xl font-extrabold text-gray-800">{value ?? "—"}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </motion.div>
    );
}

// ── Ward Card ─────────────────────────────────────────────────────────────────
function WardCard({ ward, delay }: { ward: WardStat; delay: number }) {
    const c = WARD_COLORS[ward.ward_code] ?? WARD_COLORS["01"];
    const label = WARD_LABELS[ward.ward_code] ?? `Ward ${ward.ward_code}`;
    return (
        <motion.div
            className={`${c.bg} rounded-2xl border border-gray-100 shadow-sm p-5`}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, type: "spring", stiffness: 260, damping: 22 }}
        >
            <div className="flex items-center justify-between mb-3">
                <div>
                    <p className={`text-xs font-bold uppercase tracking-widest ${c.text} opacity-70`}>
                        Ward {ward.ward_code}
                    </p>
                    <p className={`text-base font-bold ${c.text}`}>{label}</p>
                </div>
                <BedDouble size={28} className={`${c.text} opacity-30`} />
            </div>
            <p className={`text-4xl font-black ${c.text} mb-3`}>
                {ward.total.toLocaleString()}
                <span className="text-base font-semibold ml-1 opacity-60">ราย</span>
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/60 rounded-lg p-1.5">
                    <p className={`text-xs font-bold ${c.text}`}>{ward.unique_patients}</p>
                    <p className="text-[10px] text-gray-500">ผู้ป่วย</p>
                </div>
                <div className="bg-white/60 rounded-lg p-1.5">
                    <p className={`text-xs font-bold ${c.text}`}>{ward.avg_los ?? "—"}</p>
                    <p className="text-[10px] text-gray-500">วัน (avg)</p>
                </div>
                <div className="bg-white/60 rounded-lg p-1.5">
                    <p className={`text-xs font-bold ${c.text}`}>{ward.discharge_normal}</p>
                    <p className="text-[10px] text-gray-500">จำหน่ายปกติ</p>
                </div>
            </div>
        </motion.div>
    );
}

// ── Shimmer ───────────────────────────────────────────────────────────────────
function Shimmer({ h = "h-32" }: { h?: string }) {
    return <div className={`${h} rounded-2xl bg-gray-200 animate-pulse`} />;
}

const PAGE_SIZE = 50;

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function IpdDashboardPage() {
    const today = new Date();
    const [start, setStart] = useState<Date | null>(today);
    const [end, setEnd] = useState<Date | null>(today);
    const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
    const [rows, setRows] = useState<DischargeRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetched, setFetched] = useState(false);

    // Table state
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortAsc, setSortAsc] = useState(true);
    const [page, setPage] = useState(1);

    const fetchAll = async () => {
        if (!start || !end) return;
        setLoading(true);
        const s = formatDate(start);
        const e = formatDate(end);
        try {
            const [sumRes, rowRes] = await Promise.all([
                fetch(`/api/ipd/summary?start=${s}&end=${e}`, { credentials: "include" }),
                fetch(`/api/ipd/discharge?start=${s}&end=${e}`, { credentials: "include" }),
            ]);
            if (!sumRes.ok || !rowRes.ok) throw new Error("fetch failed");
            const [sumJson, rowJson] = await Promise.all([sumRes.json(), rowRes.json()]);
            setSummaryData(sumJson);
            setRows(Array.isArray(rowJson) ? rowJson : []);
            setFetched(true);
            setPage(1);
            setSearch("");
            toast.success("โหลดข้อมูลสำเร็จ");
        } catch {
            toast.error("โหลดข้อมูลไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    // auto-load today on mount
    useEffect(() => { fetchAll(); }, []); // eslint-disable-line

    // Table filter/sort
    const filtered = rows.filter((r) =>
        Object.values(r).some((v) => String(v).toLowerCase().includes(search.toLowerCase()))
    );
    const sorted = sortKey
        ? [...filtered].sort((a: any, b: any) =>
            sortAsc
                ? String(a[sortKey]).localeCompare(String(b[sortKey]), "th")
                : String(b[sortKey]).localeCompare(String(a[sortKey]), "th")
        )
        : filtered;
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSort = (key: string) => {
        if (sortKey === key) setSortAsc((p) => !p);
        else { setSortKey(key); setSortAsc(true); }
    };

    const handleExport = () => {
        if (sorted.length === 0) { toast.error("ไม่มีข้อมูล"); return; }
        exportToExcel(sorted, {
            filePrefix: "ipd-discharge",
            sheetName: "IPD",
            dateKeys: ["regdate", "dchdate", "admdate"],
        });
    };

    // Chart: By Ward (grouped — admit vs discharge)
    const wardLabels = (summaryData?.byWard ?? []).map(
        (w) => WARD_LABELS[w.ward_code] ?? w.ward_code
    );
    const wardBarData = {
        labels: wardLabels,
        datasets: [
            {
                label: "Admit (รับใหม่)",
                data: (summaryData?.byWard ?? []).map((w) => w.admit_total),
                backgroundColor: (summaryData?.byWard ?? []).map(
                    (w) => WARD_COLORS[w.ward_code]?.bar ?? "rgba(22,101,52,0.8)"
                ),
                borderRadius: 6,
                borderSkipped: false,
            },
            {
                label: "จำหน่าย",
                data: (summaryData?.byWard ?? []).map((w) => w.total),
                backgroundColor: (summaryData?.byWard ?? []).map(
                    (w) => WARD_COLORS[w.ward_code]?.bar.replace("0.8", "0.3") ?? "rgba(22,101,52,0.3)"
                ),
                borderRadius: 6,
                borderSkipped: false,
                borderWidth: 2,
                borderColor: (summaryData?.byWard ?? []).map(
                    (w) => WARD_COLORS[w.ward_code]?.bar ?? "rgba(22,101,52,0.8)"
                ),
            },
        ],
    };

    // Chart: Pttype doughnut
    const pttypeColors = [
        "rgba(37,99,235,0.8)", "rgba(234,88,12,0.8)", "rgba(22,101,52,0.8)",
        "rgba(219,39,119,0.8)", "rgba(13,148,136,0.8)", "rgba(161,98,7,0.8)",
        "rgba(109,40,217,0.8)", "rgba(15,118,110,0.8)",
    ];
    const pttypeDonut = {
        labels: (summaryData?.byPttype ?? []).map((p) => p.pttype_name),
        datasets: [{
            data: (summaryData?.byPttype ?? []).map((p) => p.total),
            backgroundColor: pttypeColors,
            borderWidth: 2,
            borderColor: "#fff",
        }],
    };

    const chartOpts: any = {
        responsive: true,
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: "#374151",
                    font: { size: 11, family: "Prompt, sans-serif" },
                    boxWidth: 12,
                    padding: 10,
                },
            },
            tooltip: {
                callbacks: {
                    label: (i: any) => ` ${i.dataset.label}: ${i.formattedValue} ราย`,
                },
            },
        },
        scales: {
            x: { ticks: { color: "#374151", font: { size: 12 } }, grid: { display: false } },
            y: { ticks: { color: "#374151", font: { size: 11 } }, grid: { color: "#f3f4f6" }, beginAtZero: true },
        },
    };

    const donutOpts: any = {
        responsive: true,
        cutout: "65%",
        plugins: {
            legend: {
                position: "right",
                labels: { color: "#374151", font: { size: 11 }, padding: 10, boxWidth: 12 },
            },
            tooltip: { callbacks: { label: (i: any) => ` ${i.label}: ${i.formattedValue} ราย` } },
        },
    };

    const colKeys = paginated[0] ? Object.keys(paginated[0]) : [];
    const dateKeys = ["regdate", "dchdate", "admdate"];

    return (
        <div className="space-y-6">
            <Toaster position="top-center" toastOptions={{
                style: { borderRadius: "10px", fontWeight: 600, fontSize: "14px" },
                success: { iconTheme: { primary: "#166534", secondary: "#fff" } },
            }} />

            {/* ── Title ── */}
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <BedDouble size={22} className="text-green-700" />
                    Dashboard ผู้ป่วยใน (IPD) — การจำหน่าย
                </h1>
            </motion.div>

            {/* ── Filter Bar ── */}
            <motion.div
                className="bg-white border border-gray-200 rounded-2xl shadow-md px-6 py-5"
                style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.07)" }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
            >
                <div className="flex flex-wrap items-end gap-5">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                            วันที่จำหน่าย (เริ่ม)
                        </label>
                        <DatePicker
                            selected={start}
                            onChange={(d: Date | null) => setStart(d)}
                            dateFormat="dd/MM/yyyy"
                            locale={th}
                            showMonthDropdown showYearDropdown
                            dropdownMode="select"
                            yearDropdownItemNumber={20}
                            customInput={<ThaiDateInput />}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                            วันที่จำหน่าย (สิ้นสุด)
                        </label>
                        <DatePicker
                            selected={end}
                            onChange={(d: Date | null) => setEnd(d)}
                            dateFormat="dd/MM/yyyy"
                            locale={th}
                            showMonthDropdown showYearDropdown
                            dropdownMode="select"
                            yearDropdownItemNumber={20}
                            customInput={<ThaiDateInput />}
                        />
                    </div>

                    <motion.button
                        onClick={fetchAll}
                        disabled={loading}
                        className="flex items-center gap-2 bg-green-800 text-white text-sm font-bold px-8 py-2.5 rounded-xl shadow-lg disabled:opacity-50"
                        whileHover={{ scale: 1.04, boxShadow: "0 8px 28px rgba(22,101,52,0.35)" }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {loading ? (
                            <>
                                <motion.span
                                    className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full inline-block"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                                />
                                กำลังโหลด...
                            </>
                        ) : (
                            <><Search size={14} /> Search</>
                        )}
                    </motion.button>

                    {fetched && start && end && (
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">ช่วงข้อมูล</span>
                            <span className="bg-green-50 border border-green-200 text-green-800 text-sm font-semibold px-4 py-1.5 rounded-full">
                                {start.toLocaleDateString("th-TH")}
                                {start.toDateString() !== end.toDateString() && ` – ${end.toLocaleDateString("th-TH")}`}
                            </span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} h="h-28" />)
                ) : summaryData ? (
                    <>
                        <KpiCard icon={BedDouble} label="จำหน่ายทั้งหมด" value={summaryData.summary.total?.toLocaleString()} sub="ราย" color="bg-green-700" delay={0} />
                        <KpiCard icon={Users} label="ผู้ป่วยไม่ซ้ำ" value={summaryData.summary.unique_patients?.toLocaleString()} sub="HN unique" color="bg-blue-600" delay={0.06} />
                        <KpiCard icon={Clock} label="LOS เฉลี่ย" value={summaryData.summary.avg_los ?? "—"} sub="วัน/ราย" color="bg-orange-500" delay={0.12} />
                        <KpiCard icon={TrendingUp} label="จำนวน Ward" value="4" sub="ที่เปิดใช้งาน" color="bg-purple-600" delay={0.18} />
                    </>
                ) : (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-28 rounded-2xl bg-white border border-gray-200 flex items-center justify-center">
                            <AlertCircle size={20} className="text-gray-300" />
                        </div>
                    ))
                )}
            </div>

            {/* ── Ward Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} h="h-44" />)
                ) : summaryData?.byWard.length ? (
                    summaryData.byWard.map((w, i) => (
                        <WardCard key={w.ward_code} ward={w} delay={i * 0.07} />
                    ))
                ) : (
                    <div className="col-span-4 flex items-center justify-center py-10 text-gray-400 text-sm">
                        <AlertCircle size={18} className="mr-2" /> ไม่พบข้อมูล Ward
                    </div>
                )}
            </div>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bar: By Ward */}
                <motion.div
                    className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6"
                    style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.07)" }}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                >
                    <p className="text-sm font-bold text-gray-700 mb-4">จำนวนจำหน่ายแยก Ward</p>
                    {loading ? (
                        <Shimmer h="h-48" />
                    ) : summaryData?.byWard.length ? (
                        <Bar data={wardBarData} options={chartOpts} />
                    ) : (
                        <div className="h-48 flex items-center justify-center text-gray-300 text-sm">ไม่มีข้อมูล</div>
                    )}
                </motion.div>

                {/* Donut: By Pttype */}
                <motion.div
                    className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6"
                    style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.07)" }}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <p className="text-sm font-bold text-gray-700 mb-4">สัดส่วนตามสิทธิ์</p>
                    {loading ? (
                        <Shimmer h="h-48" />
                    ) : summaryData?.byPttype.length ? (
                        <Doughnut data={pttypeDonut} options={donutOpts} />
                    ) : (
                        <div className="h-48 flex items-center justify-center text-gray-300 text-sm">ไม่มีข้อมูล</div>
                    )}
                </motion.div>
            </div>

            {/* ── Discharge type + Patient table ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Dchtype list */}
                <motion.div
                    className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5"
                    style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.07)" }}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.22 }}
                >
                    <p className="text-sm font-bold text-gray-700 mb-3">ประเภทการจำหน่าย</p>
                    {loading ? (
                        <Shimmer h="h-40" />
                    ) : summaryData?.byDchtype.length ? (
                        <div className="space-y-2">
                            {summaryData.byDchtype.map((d, i) => {
                                const max = summaryData.byDchtype[0].total;
                                const pct = max > 0 ? Math.round((d.total / max) * 100) : 0;
                                const name = d.dchtype_name ?? "ไม่ระบุ";
                                return (
                                    <div key={i} className="flex items-center gap-2 group relative">
                                        {/* Full name tooltip */}
                                        <div className="absolute left-0 -top-8 z-10 bg-gray-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap
                                            opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
                                            {name}
                                            <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
                                        </div>

                                        <div className="w-24 truncate text-xs text-gray-600 font-medium shrink-0 cursor-default">
                                            {name}
                                        </div>
                                        <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-green-600 rounded-full group-hover:bg-green-500 transition-colors duration-150"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ delay: 0.3 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-gray-700 w-8 text-right shrink-0">
                                            {d.total}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-8">ไม่มีข้อมูล</p>
                    )}
                </motion.div>

                {/* Patient table */}
                <motion.div
                    className="md:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm p-5"
                    style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.07)" }}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 }}
                >
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                        <p className="text-sm font-bold text-gray-700">
                            รายชื่อผู้ป่วยที่จำหน่าย
                            {sorted.length > 0 && (
                                <span className="ml-2 bg-green-50 text-green-800 border border-green-200 text-xs font-bold px-2 py-0.5 rounded-full">
                                    {sorted.length.toLocaleString()} ราย
                                </span>
                            )}
                        </p>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="border-2 border-gray-200 px-3 py-1.5 rounded-lg w-44 text-sm text-gray-800 bg-white focus:outline-none focus:border-green-700 transition-colors"
                            />
                            <AnimatePresence>
                                {rows.length > 0 && (
                                    <motion.button
                                        onClick={handleExport}
                                        className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        whileHover={{ scale: 1.04 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <FileDown size={13} /> Export
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {loading ? (
                        <Shimmer h="h-64" />
                    ) : paginated.length > 0 ? (
                        <>
                            <div className="overflow-auto max-h-[420px] border border-gray-200 rounded-xl">
                                <table className="min-w-full text-xs border-collapse">
                                    <thead>
                                        <tr>
                                            {[
                                                "hn", "pname", "fname", "lname",
                                                "ward_code", "pttype_name", "regdate", "dchdate",
                                                "los", "pdx", "doctor_name", "dchtype_name"
                                            ].map((key) => (
                                                <th
                                                    key={key}
                                                    onClick={() => handleSort(key)}
                                                    className="sticky top-0 bg-green-800 text-white px-3 py-2.5 text-left cursor-pointer whitespace-nowrap border-r border-green-700 select-none"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        {key === "ward_code" ? "Ward"
                                                            : key === "pttype_name" ? "สิทธิ์"
                                                                : key === "regdate" ? "วันรับ"
                                                                    : key === "dchdate" ? "วันจำหน่าย"
                                                                        : key === "los" ? "LOS(วัน)"
                                                                            : key === "pdx" ? "Dx"
                                                                                : key === "doctor_name" ? "แพทย์"
                                                                                    : key === "dchtype_name" ? "ประเภทจำหน่าย"
                                                                                        : key === "pname" ? "คำนำหน้า"
                                                                                            : key === "fname" ? "ชื่อ"
                                                                                                : key === "lname" ? "นามสกุล"
                                                                                                    : key}
                                                        {sortKey === key && (
                                                            sortAsc ? <FiChevronUp size={11} /> : <FiChevronDown size={11} />
                                                        )}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginated.map((row, i) => (
                                            <tr
                                                key={i}
                                                className={`border-b border-gray-100 hover:bg-green-50/60 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                                            >
                                                {[
                                                    "hn", "pname", "fname", "lname",
                                                    "ward_code", "pttype_name", "regdate", "dchdate",
                                                    "los", "pdx", "doctor_name", "dchtype_name"
                                                ].map((key, idx) => {
                                                    const val = (row as any)[key];
                                                    const display = dateKeys.includes(key) && val
                                                        ? formatThaiDate(val)
                                                        : key === "ward_code"
                                                            ? `${WARD_LABELS[val] ?? val} (${val})`
                                                            : String(val ?? "");
                                                    return (
                                                        <td
                                                            key={idx}
                                                            className="px-3 py-2 whitespace-nowrap border-r border-gray-100 text-gray-800"
                                                        >
                                                            <div className="flex items-center gap-1 group">
                                                                <span>{display}</span>
                                                                <button
                                                                    onClick={() => {
                                                                        copyToClipboard(display);
                                                                        toast.success("คัดลอกแล้ว");
                                                                    }}
                                                                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-gray-400"
                                                                >
                                                                    <FiCopy size={11} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                                <p className="text-xs font-medium text-gray-500">
                                    หน้า <span className="font-bold text-gray-800">{page}</span> / {totalPages}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                                        disabled={page === 1}
                                        className="px-3 py-1.5 border-2 border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:border-green-700 hover:text-green-800 disabled:opacity-30 transition-colors"
                                    >
                                        ← ก่อนหน้า
                                    </button>
                                    <span className="border-2 border-green-700 rounded-lg px-3 py-1.5 text-xs font-bold text-green-800 bg-green-50">
                                        {page}
                                    </span>
                                    <button
                                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                                        disabled={page === totalPages}
                                        className="px-3 py-1.5 border-2 border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:border-green-700 hover:text-green-800 disabled:opacity-30 transition-colors"
                                    >
                                        ถัดไป →
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 gap-2">
                            <motion.div
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="text-3xl"
                            >
                                <BedDouble size={28} className="text-gray-400" />
                            </motion.div>
                            <p className="text-sm text-gray-400 font-medium">ไม่พบข้อมูลผู้ป่วยใน</p>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}