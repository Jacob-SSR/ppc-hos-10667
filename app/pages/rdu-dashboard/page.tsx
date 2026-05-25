"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Chart, registerables, type TooltipItem } from "chart.js";
import { motion, AnimatePresence } from "framer-motion";
import {
    Wind, Droplets, Scissors, Baby,
    CheckCircle2, AlertCircle, Download,
    ChevronDown, RefreshCw,
} from "lucide-react";
import { RDU_DEPARTMENTS, TARGETS, DISEASE_META } from "@/lib/rdu.constants";
import type { RduDashboardData, RduDiseaseRow, RduDoctorRow } from "@/lib/rdu.types";

Chart.register(...registerables);

// ─── Icons แทน emoji ────────────────────────────────────────────────────────
const DISEASE_ICONS = {
    uri: Wind,
    dia: Droplets,
    wound: Scissors,
    peri: Baby,
} as const;

// ─── Preset ช่วงเวลา (ตามรูป image 4) ───────────────────────────────────────
type Preset = "30d" | "q2" | "6m" | "fiscal";
const PRESETS: { key: Preset; label: string }[] = [
    { key: "30d", label: "30 วันล่าสุด" },
    { key: "q2", label: "ไตรมาสนี้ (Q2/2569)" },
    { key: "6m", label: "6 เดือน" },
    { key: "fiscal", label: "ปีงบประมาณ 2569" },
];

function getPresetRange(preset: Preset): { start: Date; end: Date } {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (preset === "30d") {
        const s = new Date(today); s.setDate(s.getDate() - 29);
        return { start: s, end: today };
    }
    if (preset === "q2") {
        // Q2 ปีงบฯ = ม.ค.–มี.ค. ของปีปฏิทิน (ปีงบฯ ต.ค.–ก.ย.)
        const fiscalYear = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
        return {
            start: new Date(fiscalYear - 1, 0, 1),  // 1 ม.ค.
            end: new Date(fiscalYear - 1, 2, 31),  // 31 มี.ค.
        };
    }
    if (preset === "6m") {
        const s = new Date(today); s.setMonth(s.getMonth() - 6); s.setDate(1);
        return { start: s, end: today };
    }
    // fiscal year ต.ค. – ปัจจุบัน
    const fy = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    return { start: new Date(fy, 9, 1), end: today };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function cellColor(pct: number, target: number) {
    if (pct === 0) return "text-gray-300";
    if (pct <= target) return "text-green-700 font-semibold";
    if (pct <= target * 1.2) return "text-amber-600 font-semibold";
    return "text-red-700 font-bold";
}

function statusBadge(dr: RduDoctorRow) {
    let fails = 0;
    if (dr.uri_total > 0 && dr.uri_pct > TARGETS.uri) fails++;
    if (dr.dia_total > 0 && dr.dia_pct > TARGETS.dia) fails++;
    if (dr.wound_total > 0 && dr.wound_pct > TARGETS.wound) fails++;
    if (dr.peri_total > 0 && dr.peri_pct > TARGETS.peri) fails++;
    if (fails === 0) return { label: "ผ่านเกณฑ์ทุกโรค", cls: "bg-green-100 text-green-800" };
    if (fails === 1) return { label: "ทบทวน 1 รายการ", cls: "bg-amber-100 text-amber-700" };
    return { label: "ต้องปรับปรุง", cls: "bg-red-100 text-red-700" };
}

function initials(name: string) {
    const p = name.replace(/นพ\.|พญ\.|พว\.|ทพ\.|ทพญ\.|นาย|นาง|น\.ส\.|นางสาว/g, "").trim().split(/\s+/);
    return (p[0]?.[0] ?? "") + (p[1]?.[0] ?? "");
}

// ─── RduCard (ตามรูป image 4) ────────────────────────────────────────────────
function RduCard({ d, loading }: { d?: RduDiseaseRow; loading: boolean }) {
    if (loading || !d) return <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" />;

    const ratio = d.current / d.target;
    let badgeCls = "bg-green-100 text-green-800"; let badgeLabel = "ผ่านเป้า"; let fill = "#16a34a";
    if (ratio > 1.2) { badgeCls = "bg-red-100 text-red-700"; badgeLabel = "ไม่ผ่าน"; fill = "#dc2626"; }
    else if (ratio > 1) { badgeCls = "bg-amber-100 text-amber-700"; badgeLabel = "เกินเป้า"; fill = "#d97706"; }

    const fillPct = Math.min(100, (d.current / Math.max(d.target * 2, d.current + 5)) * 100);
    const Icon = DISEASE_ICONS[d.key as keyof typeof DISEASE_ICONS];

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <span className={`absolute top-4 right-4 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeCls}`}>
                {badgeLabel}
            </span>

            {/* Icon + ชื่อโรค */}
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: d.color + "18" }}>
                    <Icon size={20} style={{ color: d.color }} strokeWidth={1.8} />
                </div>
                <div>
                    <div className="text-sm font-bold text-gray-800 leading-snug">{d.name}</div>
                    <div className="text-[11px] text-gray-400 leading-snug">{d.full}</div>
                </div>
            </div>

            {/* ตัวเลขใหญ่ */}
            <div className="text-4xl font-extrabold text-gray-900 leading-none mb-1">
                {d.current}<span className="text-lg font-medium text-gray-400 ml-1">%</span>
            </div>

            {/* Gauge bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden my-3">
                <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${fillPct}%`, background: fill }} />
            </div>

            {/* เป้า + จำนวนราย */}
            <div className="flex justify-between text-[11px] text-gray-400">
                <span>เป้าหมาย <strong className="text-gray-600">≤ {d.target}%</strong></span>
                <span><strong className="text-gray-700">{d.rxN}</strong>/{d.visits} ราย</span>
            </div>
        </div>
    );
}

// ─── สี palette สำหรับ dept — assign dynamic ตาม dept ที่พบจริง ─────────────
// ไม่ hardcode ชื่อแผนก เพราะชื่อในฐานข้อมูลแต่ละโรงพยาบาลต่างกัน
const DEPT_PALETTE = [
    "#1e6fd9", // น้ำเงิน
    "#dc2626", // แดง (ER)
    "#16a34a", // เขียว (เด็ก/คลินิก)
    "#7c3aed", // ม่วง (ห้องคลอด)
    "#0aa7a0", // ฟ้าเขียว (ชุมชน)
    "#d97706", // ส้ม
    "#db2777", // ชมพู
    "#0284c7", // ฟ้า
    "#65a30d", // เขียวอ่อน
    "#9333ea", // ม่วงสด
];

// cache สี dept ระดับ module (รีเซ็ตเมื่อ data เปลี่ยน)
const deptColorCache: Record<string, string> = {};
let paletteIndex = 0;

function resetDeptColors() {
    Object.keys(deptColorCache).forEach(k => delete deptColorCache[k]);
    paletteIndex = 0;
}

function getDeptColor(dept: string): string {
    if (!dept) return "#6b7280";
    if (!deptColorCache[dept]) {
        deptColorCache[dept] = DEPT_PALETTE[paletteIndex % DEPT_PALETTE.length];
        paletteIndex++;
    }
    return deptColorCache[dept];
}

function avatarColor(dept: string) {
    return getDeptColor(dept);
}

// ─── StatCell (top-level เพื่อหลีกเลี่ยง "Components created during render") ──
function StatCell({
    label, total, rx, target,
}: {
    label: string; total: number; rx: number; target: number;
}) {
    if (total === 0) return (
        <div className="p-3 border border-gray-100 rounded-xl bg-gray-50 text-center">
            <div className="text-[10px] text-gray-400 mb-1">{label}</div>
            <div className="text-sm font-bold text-gray-300">—</div>
        </div>
    );
    const pct = Math.round((rx / total) * 1000) / 10;
    const pass = pct <= target;
    return (
        <div className={`p-3 border rounded-xl text-center ${pass ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            <div className="text-[10px] text-gray-500 mb-1">{label} (≤{target}%)</div>
            <div className={`text-xl font-extrabold ${pass ? "text-green-700" : "text-red-600"}`}>{pct}%</div>
        </div>
    );
}

function DoctorProfile({ dr }: { dr: RduDoctorRow }) {
    const s = statusBadge(dr);

    return (
        <div className="border border-gray-200 rounded-2xl p-5 bg-gray-50">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                    style={{ background: avatarColor(dr.dept) }}>
                    {initials(dr.doctor_name)}
                </div>
                <div className="min-w-0">
                    <div className="font-bold text-gray-900 text-sm truncate">{dr.doctor_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{dr.dept || "—"} · <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.cls}`}>{s.label}</span></div>
                </div>
            </div>

            {/* % ATB 4 โรค */}
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                % การสั่งยาปฏิชีวนะใน 4 โรคเป้าหมาย
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
                <StatCell label="URI" total={dr.uri_total} rx={dr.uri_rx} target={TARGETS.uri} />
                <StatCell label="Diarrhea" total={dr.dia_total} rx={dr.dia_rx} target={TARGETS.dia} />
                <StatCell label="แผลสด" total={dr.wound_total} rx={dr.wound_rx} target={TARGETS.wound} />
                <StatCell label="ฝีเย็บ" total={dr.peri_total} rx={dr.peri_rx} target={TARGETS.peri} />
            </div>
            <div className="text-xs text-gray-500">
                <strong>Visit:</strong> {dr.visits} ราย &nbsp;·&nbsp; <strong>หน่วย:</strong> {dr.dept || "—"}
            </div>
        </div>
    );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────
function Dropdown<T extends string>({
    value, options, onChange, className = "",
}: {
    value: T;
    options: { key: T; label: string }[];
    onChange: (v: T) => void;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const label = options.find(o => o.key === value)?.label ?? value;

    useEffect(() => {
        const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button onClick={() => setOpen(p => !p)}
                className="flex items-center gap-2 border border-gray-300 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400 transition-colors min-w-[160px] justify-between">
                <span>{label}</span>
                <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-full overflow-hidden">
                        {options.map(o => (
                            <button key={o.key} onClick={() => { onChange(o.key); setOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${value === o.key ? "text-green-700 font-semibold bg-green-50" : "text-gray-700"}`}>
                                {o.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RduDashboardPage() {
    const [preset, setPreset] = useState<Preset>("fiscal");
    const [depcode, setDepcode] = useState("");
    const [data, setData] = useState<RduDashboardData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [disTab, setDisTab] = useState("uri");
    const [trendView, setTrendView] = useState("all");
    const [selectedDr, setSelectedDr] = useState<RduDoctorRow | null>(null);
    const [activeDr, setActiveDr] = useState("");

    // chart refs
    const trendRef = useRef<HTMLCanvasElement>(null);
    const gaugeRef = useRef<HTMLCanvasElement>(null);
    const pieRef = useRef<HTMLCanvasElement>(null);
    const atbRef = useRef<HTMLCanvasElement>(null);
    const topAtbRef = useRef<HTMLCanvasElement>(null);
    const bubbleRef = useRef<HTMLCanvasElement>(null);
    const chartMap = useRef<Record<string, Chart | null>>({
        trend: null, gauge: null, pie: null, atb: null, topAtb: null, bubble: null,
    });

    function destroyChart(key: string) {
        chartMap.current[key]?.destroy();
        chartMap.current[key] = null;
    }

    // ── Fetch ────────────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        const { start, end } = getPresetRange(preset);
        setLoading(true); setError(null);
        try {
            const params = new URLSearchParams({ start: fmtDate(start), end: fmtDate(end) });
            if (depcode) params.set("depcode", depcode);
            const res = await fetch(`/api/rdu-dashboard?${params}`, { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json: RduDashboardData = await res.json();
            resetDeptColors();
            Array.from(new Set(json.doctors.map(dr => dr.dept))).sort().forEach(getDeptColor);
            setData(json);
            if (json.doctors.length > 0) {
                setSelectedDr(json.doctors[0]);
                setActiveDr(json.doctors[0].doctor_code);
            }
        } catch (e) { setError((e as Error).message); }
        finally { setLoading(false); }
    }, [preset, depcode]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Trend chart ───────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!trendRef.current || !data?.trend.length) return;
        destroyChart("trend");
        const labels = data.trend.map(r => r.label);
        const COLORS: Record<string, string> = { uri: "#1e6fd9", dia: "#0aa7a0", wound: "#d97706", peri: "#7c3aed" };
        const keys = trendView === "all"
            ? (["uri", "dia", "wound", "peri"] as const)
            : [trendView as "uri" | "dia" | "wound" | "peri"];

        const datasets: any[] = [];
        keys.forEach(k => {
            const c = COLORS[k]; const t = TARGETS[k];
            const pcts = data.trend.map(r => {
                const tot = r[`${k}_total` as keyof typeof r] as number;
                const rx = r[`${k}_rx` as keyof typeof r] as number;
                return tot > 0 ? Math.round((rx / tot) * 1000) / 10 : 0;
            });
            datasets.push({ label: `${k.toUpperCase()} % Rx`, data: pcts, borderColor: c, backgroundColor: c + "22", tension: 0.35, borderWidth: 2.5, pointRadius: 3, fill: false });
            datasets.push({ label: `เป้า ≤${t}%`, data: Array(labels.length).fill(t), borderColor: c, borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, fill: false });
        });

        chartMap.current.trend = new Chart(trendRef.current, {
            type: "line",
            data: { labels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                scales: { y: { min: 0, max: 100, title: { display: true, text: "% ATB Rx" }, grid: { color: "#eef3f9" } } },
                plugins: { legend: { position: "bottom" } },
            },
        });
    }, [data, trendView]);

    // ── Gauge chart ───────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!gaugeRef.current || !data?.diseases.length) return;
        destroyChart("gauge");
        const dis = data.diseases;
        chartMap.current.gauge = new Chart(gaugeRef.current, {
            type: "bar",
            data: {
                labels: dis.map(d => d.name.split("/")[0].trim()),
                datasets: [
                    { label: "% Rx จริง", data: dis.map(d => d.current), backgroundColor: dis.map(d => d.current <= d.target ? "#16a34a" : d.current <= d.target * 1.2 ? "#d97706" : "#dc2626"), borderRadius: 6, barPercentage: 0.6 },
                    { label: "เป้าหมาย", data: dis.map(d => d.target), backgroundColor: "rgba(124,147,173,.22)", borderRadius: 6, barPercentage: 0.6 },
                ],
            },
            options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, scales: { x: { max: 100, title: { display: true, text: "%" } }, y: { grid: { display: false } } }, plugins: { legend: { position: "bottom" } } },
        });
    }, [data]);

    // ── Bubble chart (image 2 บนขวา) ─────────────────────────────────────────────
    useEffect(() => {
        if (!bubbleRef.current || !data?.doctors.length) return;
        destroyChart("bubble");

        // จัดกลุ่มตาม dept (สีถูก assign จาก fetchData แล้ว)
        const deptMap = new Map<string, typeof data.doctors>();
        data.doctors.forEach(dr => {
            const g = deptMap.get(dr.dept) ?? [];
            g.push(dr);
            deptMap.set(dr.dept, g);
        });

        const datasets = Array.from(deptMap.entries()).map(([dept, drs]) => ({
            label: dept || "ไม่ระบุ",
            data: drs.map(dr => ({
                x: dr.visits,
                y: Math.max(dr.uri_pct, dr.dia_pct, dr.wound_pct, dr.peri_pct),
                r: Math.max(8, Math.sqrt(dr.visits) * 1.2),
                name: dr.doctor_name,
            })),
            backgroundColor: getDeptColor(dept) + "b0",
        }));

        chartMap.current.bubble = new Chart(bubbleRef.current, {
            type: "bubble",
            data: { datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: "จำนวน Visit" }, grid: { color: "#eef3f9" } },
                    y: { title: { display: true, text: "% Rx สูงสุดใน 4 โรค" }, grid: { color: "#eef3f9" }, min: 0, max: 80 },
                },
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: { callbacks: { label: (ctx: TooltipItem<'bubble'>) => { const raw = ctx.raw as { x: number; y: number; r: number; name: string }; return `${raw.name} · ${raw.x} visit · max ${raw.y}%`; } } },
                    title: { display: true, text: "ขนาด bubble = จำนวน visit", font: { size: 11, weight: "normal" as const }, color: "#9ca3af" },
                },
            },
        });
    }, [data]);

    // ── Disease pie + ATB ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!pieRef.current || !atbRef.current || !data) return;
        const dis = data.diseases.find(d => d.key === disTab);
        if (!dis) return;

        destroyChart("pie");
        chartMap.current.pie = new Chart(pieRef.current, {
            type: "doughnut",
            data: { labels: ["ได้รับ ATB", "ไม่ได้รับ ATB"], datasets: [{ data: [dis.rxN, dis.visits - dis.rxN], backgroundColor: [dis.color, "#e2e8f0"], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: "68%", plugins: { legend: { position: "bottom" } } },
        });

        const atbList = data.atbByDisease[disTab as keyof typeof data.atbByDisease] ?? [];
        destroyChart("atb");
        chartMap.current.atb = new Chart(atbRef.current, {
            type: "bar",
            data: { labels: atbList.map(r => r.drug_name), datasets: [{ label: "ใบสั่ง", data: atbList.map(r => r.rx_count), backgroundColor: dis.color, borderRadius: 4 }] },
            options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, scales: { x: { grid: { color: "#eef3f9" } }, y: { grid: { display: false } } }, plugins: { legend: { display: false } } },
        });
    }, [data, disTab]);

    // ── Top ATB ───────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!topAtbRef.current || !data?.topAtb.length) return;
        destroyChart("topAtb");
        chartMap.current.topAtb = new Chart(topAtbRef.current, {
            type: "bar",
            data: { labels: data.topAtb.map(r => r.drug_name), datasets: [{ label: "ใบสั่ง", data: data.topAtb.map(r => r.rx_count), backgroundColor: "#1e6fd9", borderRadius: 4 }] },
            options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, scales: { x: { grid: { color: "#eef3f9" } }, y: { grid: { display: false } } }, plugins: { legend: { display: false } } },
        });
    }, [data]);

    useEffect(() => () => Object.keys(chartMap.current).forEach(destroyChart), []); // eslint-disable-line

    // ─── derived ──────────────────────────────────────────────────────────────────
    const dis = data?.diseases.find(d => d.key === disTab);
    const disMeta = DISEASE_META.find(d => d.key === disTab);
    const updatedAt = data
        ? new Date(data.updatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })
        : "";

    const TREND_TABS = [
        { key: "all", label: "ทุกโรค" }, { key: "uri", label: "URI" }, { key: "dia", label: "Diarrhea" },
        { key: "wound", label: "แผลสด" }, { key: "peri", label: "แผลฝีเย็บ" },
    ];

    // ─── Checklist (smart use indicators — static ตามโรค) ────────────────────────
    const SMART_USE: Record<string, { ok: boolean; title: string; detail: string }[]> = {
        uri: [
            { ok: true, title: "ประเมิน Centor score", detail: "82% ของผู้ป่วยถูกประเมิน" },
            { ok: false, title: "หลีกเลี่ยง ATB ในโรคหวัดธรรมดา", detail: `${dis?.current ?? 0}% สั่ง ATB (เป้า ≤20%)` },
            { ok: true, title: "ใช้ symptomatic Rx", detail: "paracetamol + คำแนะนำ 95%" },
            { ok: true, title: "นัด follow-up", detail: "76% ผู้ป่วยได้คำแนะนำกลับมาดู" },
        ],
        dia: [
            { ok: true, title: "ใช้ ORS เป็นหลัก", detail: "94% ของผู้ป่วยได้รับ ORS" },
            { ok: true, title: "หลีกเลี่ยง ATB ใน watery diarrhea", detail: `${dis?.current ?? 0}% สั่ง ATB (ผ่านเป้า)` },
            { ok: true, title: "เก็บอุจจาระเพาะเชื้อ (bloody)", detail: "78%" },
            { ok: false, title: "หลีกเลี่ยง Loperamide ในเด็ก", detail: "4 ราย ใช้ในเด็ก < 5 ปี" },
        ],
        wound: [
            { ok: false, title: "ทำความสะอาดแผลถูกวิธี + เลี่ยง ATB", detail: `${dis?.current ?? 0}% สั่ง ATB (เป้า ≤40%)` },
            { ok: true, title: "ให้ Tetanus prophylaxis", detail: "88% ของรายที่จำเป็น" },
            { ok: true, title: "ใช้ Dicloxacillin/Amoxi-Clav", detail: "94% ยาตามแนวทาง" },
            { ok: false, title: "Duration ≤ 5 วัน", detail: "62% เป้า ≥75%" },
        ],
        peri: [
            { ok: true, title: "ทำความสะอาดแผลตามมาตรฐาน", detail: "100%" },
            { ok: true, title: "หลีกเลี่ยง ATB routine", detail: `${dis?.current ?? 0}% สั่ง ATB (ผ่านเป้า)` },
            { ok: true, title: "ประเมินการติดเชื้อก่อนสั่งยา", detail: "มีเกณฑ์ชัดเจน" },
            { ok: true, title: "คำแนะนำดูแลแผลที่บ้าน", detail: "98%" },
        ],
    };

    return (
        <div className="space-y-4">

            {/* ── Header (image 4) ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Left: logo + title */}
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,#1e6fd9,#0aa7a0)" }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2L12 22M2 12L22 12" /><circle cx="12" cy="12" r="9" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-gray-900">โรงพยาบาลพลับพลาชัย — Antibiotic Smart Use</h1>
                            <div className="text-xs text-gray-400">การใช้ยาปฏิชีวนะอย่างสมเหตุผล (RDU) · 4 โรคเป้าหมาย กระทรวงสาธารณสุข</div>
                        </div>
                    </div>

                    {/* Right: Live + dropdowns + export */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Live badge */}
                        {data && (
                            <span className="flex items-center gap-1.5 text-xs bg-green-50 border border-green-200 text-gray-500 px-3 py-1.5 rounded-full whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_0_3px_rgba(22,163,74,.2)]" />
                                Live · {updatedAt}
                            </span>
                        )}

                        {/* หน่วยบริการ */}
                        <Dropdown<string>
                            value={depcode}
                            options={RDU_DEPARTMENTS.map(d => ({ key: d.depcode, label: d.label }))}
                            onChange={setDepcode}
                        />

                        {/* ช่วงเวลา */}
                        <Dropdown<Preset>
                            value={preset}
                            options={PRESETS}
                            onChange={setPreset}
                        />

                        {/* ส่งออกรายงาน */}
                        <button onClick={() => alert("Export รายงาน RDU")}
                            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
                            <Download size={14} />ส่งออกรายงาน
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
                        <RefreshCw size={14} className="flex-shrink-0" />{error}
                        <button onClick={fetchData} className="ml-auto underline font-semibold">ลองใหม่</button>
                    </div>
                )}
            </div>

            {/* ── RDU Banner 4 cards (image 4) ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {["uri", "dia", "wound", "peri"].map(k => (
                    <RduCard key={k} d={data?.diseases.find(d => d.key === k)} loading={loading} />
                ))}
            </div>

            {/* ── Trend + Gauge ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-gray-800">แนวโน้ม % การสั่งยาปฏิชีวนะ ใน 4 โรคเป้าหมาย</h3>
                            <div className="text-xs text-gray-400 mt-0.5">เปรียบเทียบกับเป้าหมาย RDU · เส้นประ = เป้าหมายแต่ละโรค</div>
                        </div>
                        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                            {TREND_TABS.map(t => (
                                <button key={t.key} onClick={() => setTrendView(t.key)}
                                    className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-all ${trendView === t.key ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="relative h-72">
                        {loading && <div className="absolute inset-0 bg-gray-50 rounded-xl animate-pulse" />}
                        <canvas ref={trendRef} />
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">สรุปสถานะ RDU เทียบเป้าหมาย</h3>
                    <div className="text-xs text-gray-400 mb-4">4 โรคเป้าหมาย</div>
                    <div className="relative h-72">
                        {loading && <div className="absolute inset-0 bg-gray-50 rounded-xl animate-pulse" />}
                        <canvas ref={gaugeRef} />
                    </div>
                </div>
            </div>

            {/* ── Disease Detail (image 3) ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                    <div>
                        <h3 className="text-sm font-bold text-gray-800">รายละเอียดโรคเป้าหมาย</h3>
                        <div className="text-xs text-gray-400 mt-0.5">วินิจฉัย · ยาที่สั่งบ่อย · ตัวชี้วัดการใช้ยาตามแนวทาง</div>
                    </div>
                    {/* Tabs (image 3 บนขวา) */}
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                        {DISEASE_META.map(t => (
                            <button key={t.key} onClick={() => setDisTab(t.key)}
                                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all whitespace-nowrap ${disTab === t.key ? "bg-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                                style={disTab === t.key ? { color: t.color } : {}}>
                                {t.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Col 1: pill + stats + donut */}
                    <div>
                        {dis && disMeta && (() => {
                            const Icon = DISEASE_ICONS[dis.key as keyof typeof DISEASE_ICONS];
                            return (
                                <>
                                    {/* Pill badge */}
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold mb-3"
                                        style={{ background: dis.color + "18", color: dis.color }}>
                                        <Icon size={14} strokeWidth={2} />
                                        {dis.name}
                                    </div>
                                    <div className="text-xs text-gray-500 mb-3">
                                        เป้าหมาย RDU: ≤ {dis.target}% &nbsp;·&nbsp; ปัจจุบัน:&nbsp;
                                        <strong style={{ color: dis.current > dis.target ? "#dc2626" : "#16a34a" }}>{dis.current}%</strong>
                                    </div>
                                    {/* 4 stat boxes */}
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        {[
                                            ["จำนวนผู้ป่วย", dis.visits.toLocaleString()],
                                            ["ได้รับ ATB", dis.rxN.toLocaleString()],
                                            ["% Rx", `${dis.current}%`],
                                            ["ส่วนต่างจากเป้า", `${dis.current > dis.target ? "+" : ""}${(dis.current - dis.target).toFixed(1)}%`],
                                        ].map(([l, v]) => (
                                            <div key={l} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                                                <div className="text-[10px] text-gray-400">{l}</div>
                                                <div className="text-sm font-bold text-gray-800 mt-0.5">{v}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            );
                        })()}
                        {/* Donut */}
                        <div className="relative h-52">
                            {loading && <div className="absolute inset-0 bg-gray-50 rounded-xl animate-pulse" />}
                            <canvas ref={pieRef} />
                        </div>
                    </div>

                    {/* Col 2: ATB bar */}
                    <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">ยาปฏิชีวนะที่สั่งบ่อย</div>
                        <div className="relative h-72">
                            {loading && <div className="absolute inset-0 bg-gray-50 rounded-xl animate-pulse" />}
                            {!loading && (data?.atbByDisease[disTab as keyof typeof data.atbByDisease]?.length === 0) && (
                                <div className="text-sm text-gray-400 text-center py-8">ไม่พบข้อมูลยา</div>
                            )}
                            <canvas ref={atbRef} />
                        </div>
                    </div>

                    {/* Col 3: Smart Use checklist (image 3 ขวา) */}
                    <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">ตัวชี้วัด Smart Use</div>
                        <div className="space-y-2">
                            {(SMART_USE[disTab] ?? []).map((item, i) => (
                                <div key={i} className={`flex gap-3 items-start p-3 border rounded-xl ${item.ok ? "border-gray-100 bg-white" : "border-amber-100 bg-amber-50"}`}>
                                    <span className="flex-shrink-0 mt-0.5">
                                        {item.ok
                                            ? <CheckCircle2 size={16} className="text-blue-500" />
                                            : <AlertCircle size={16} className="text-amber-500" />}
                                    </span>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-800">{item.title}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{item.detail}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Doctor Table + Bubble + Profile (image 2) ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-1">ข้อมูลแพทย์ / ผู้สั่งจ่ายยา (Prescriber-level)</h3>
                <div className="text-xs text-gray-400 mb-4">% การสั่งยาปฏิชีวนะใน 4 โรคเป้าหมาย · เปรียบเทียบกับเป้าหมาย RDU · คลิกแถวเพื่อดูรายละเอียด</div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    {/* ตาราง */}
                    <div className="lg:col-span-3">
                        {loading
                            ? <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
                            : (
                                <div className="max-h-96 overflow-auto border border-gray-200 rounded-xl">
                                    <table className="w-full text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-green-700 sticky top-0">
                                                {["แพทย์ / ผู้สั่งจ่าย", "หน่วย", "Visit", "URI %", "Diarrhea %", "แผลสด %", "ฝีเย็บ %", "สถานะ"].map(h => (
                                                    <th key={h} className="px-3 py-2.5 text-left text-white font-semibold border-r border-green-600 whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(data?.doctors ?? []).map((dr, i) => {
                                                const s = statusBadge(dr);
                                                const base = activeDr === dr.doctor_code ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50";
                                                return (
                                                    <tr key={dr.doctor_code}
                                                        onClick={() => { setSelectedDr(dr); setActiveDr(dr.doctor_code); }}
                                                        className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50/60 transition-colors ${base}`}>
                                                        <td className="px-3 py-2.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                                                    style={{ background: avatarColor(dr.dept) }}>
                                                                    {initials(dr.doctor_name)}
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold text-gray-800">{dr.doctor_name}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                                style={{ background: avatarColor(dr.dept) + "20", color: avatarColor(dr.dept) }}>
                                                                {dr.dept || "—"}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right">{dr.visits}</td>
                                                        <td className={`px-3 py-2.5 text-right ${dr.uri_total > 0 ? cellColor(dr.uri_pct, TARGETS.uri) : "text-gray-300"}`}>
                                                            {dr.uri_total > 0 ? dr.uri_pct + "%" : "—"}
                                                        </td>
                                                        <td className={`px-3 py-2.5 text-right ${dr.dia_total > 0 ? cellColor(dr.dia_pct, TARGETS.dia) : "text-gray-300"}`}>
                                                            {dr.dia_total > 0 ? dr.dia_pct + "%" : "—"}
                                                        </td>
                                                        <td className={`px-3 py-2.5 text-right ${dr.wound_total > 0 ? cellColor(dr.wound_pct, TARGETS.wound) : "text-gray-300"}`}>
                                                            {dr.wound_total > 0 ? dr.wound_pct + "%" : "—"}
                                                        </td>
                                                        <td className={`px-3 py-2.5 text-right ${dr.peri_total > 0 ? cellColor(dr.peri_pct, TARGETS.peri) : "text-gray-300"}`}>
                                                            {dr.peri_total > 0 ? dr.peri_pct + "%" : "—"}
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {!loading && !data?.doctors.length && (
                                                <tr><td colSpan={8} className="text-center py-8 text-gray-400">ไม่พบข้อมูล</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        <div className="text-xs text-gray-400 mt-2">เกณฑ์: URI ≤20% · Diarrhea ≤20% · แผลสด ≤40% · ฝีเย็บ ≤10%</div>
                    </div>

                    {/* Bubble chart + Profile */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Bubble (image 2 บนขวา) */}
                        <div className="relative h-64">
                            {loading && <div className="absolute inset-0 bg-gray-50 rounded-xl animate-pulse" />}
                            <canvas ref={bubbleRef} />
                        </div>
                        {/* Profile (image 2 ล่างขวา) */}
                        {selectedDr
                            ? <DoctorProfile dr={selectedDr} />
                            : <div className="border border-dashed border-gray-200 rounded-2xl h-36 flex items-center justify-center text-sm text-gray-400">คลิกแถวแพทย์เพื่อดูรายละเอียด</div>
                        }
                    </div>
                </div>
            </div>

            {/* ── Top ATB + ข้อเสนอแนะ (image 1) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">ยาปฏิชีวนะที่ใช้บ่อย (ทั้งโรงพยาบาล)</h3>
                    <div className="text-xs text-gray-400 mb-4">เรียงตามจำนวนใบสั่ง · ไตรมาสปัจจุบัน</div>
                    <div className="relative h-64">
                        {loading && <div className="absolute inset-0 bg-gray-50 rounded-xl animate-pulse" />}
                        <canvas ref={topAtbRef} />
                    </div>
                </div>

                {/* ข้อเสนอแนะ (image 1 ขวา) */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">ข้อเสนอแนะเชิงระบบ</h3>
                    <div className="text-xs text-gray-400 mb-4">สำหรับคณะกรรมการ ASU / PTC</div>
                    <div className="space-y-3">
                        {data?.diseases.map(d => {
                            const ok = d.current <= d.target;
                            const Icon = DISEASE_ICONS[d.key as keyof typeof DISEASE_ICONS];
                            return (
                                <div key={d.key} className={`flex gap-3 items-start p-3 border rounded-xl ${ok ? "border-gray-100 bg-white" : "border-amber-100 bg-amber-50"}`}>
                                    <span className="flex-shrink-0 mt-0.5">
                                        {ok
                                            ? <CheckCircle2 size={16} className="text-blue-500" />
                                            : <AlertCircle size={16} className="text-amber-500" />}
                                    </span>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                                            <Icon size={13} style={{ color: d.color }} />
                                            {d.name}: {d.current}%
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            {ok
                                                ? `ผ่านเป้าหมาย ≤${d.target}% · ต่อยอดเป็น best practice`
                                                : `เกินเป้า ${(d.current - d.target).toFixed(1)}% · ทบทวนแนวทางและจัดอบรม`}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="text-center text-xs text-gray-400 py-2">
                ข้อมูลจากระบบ HosXP · โรงพยาบาลพลับพลาชัย จ.บุรีรัมย์ · อ้างอิง: คู่มือ RDU Hospital, สปสช., WHO AWaRe
            </div>
        </div>
    );
}