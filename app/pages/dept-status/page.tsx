"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CalendarDays,
    Search,
    Info,
    Users,
    Loader2,
    CheckCircle2,
    Hourglass,
    X,
    ArrowRight,
} from "lucide-react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

import ThaiDateInput from "@/app/components/ThaiDateInput";
import {
    useAutoRefresh,
    KpiCard,
    LiveBadge,
    ConnectionStatus,
    RefreshButton,
    timeAgo,
} from "@/app/components/dashboard/live";
import { fmtDate, toThaiDate, getBangkokToday } from "@/lib/thaiDate";
import type {
    DeptStatusData,
    DeptStatusCard,
    DeptPatientRow,
} from "@/lib/deptStatus.types";

// ─── สีตาม % คนค้าง ──────────────────────────────────────────────
function barColor(pct: number): string {
    if (pct >= 70) return "#ef4444"; // ค้างเยอะ
    if (pct >= 40) return "#f59e0b"; // ปานกลาง
    return "#16a34a"; // ค้างน้อย
}
function textColor(pct: number): string {
    if (pct >= 70) return "#dc2626";
    if (pct >= 40) return "#d97706";
    return "#15803d";
}

// ─── Donut ───────────────────────────────────────────────────────
const SIZE = 88;
const R = 36;
const STROKE = 7;

function Donut({ percent }: { percent: number }) {
    const CX = SIZE / 2;
    const CY = SIZE / 2;
    const CIRCUM = 2 * Math.PI * R;
    const dash = (Math.min(100, Math.max(0, percent)) / 100) * CIRCUM;
    const stroke = barColor(percent);
    const txt = textColor(percent);

    return (
        <div style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0 }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e5e7eb" strokeWidth={STROKE} />
                <circle
                    cx={CX}
                    cy={CY}
                    r={R}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${CIRCUM}`}
                    transform={`rotate(-90 ${CX} ${CY})`}
                />
            </svg>
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                }}
            >
                <span style={{ fontSize: 18, fontWeight: 700, color: txt, lineHeight: 1 }}>
                    {percent}%
                </span>
                <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>คนค้าง</span>
            </div>
        </div>
    );
}

// ─── Card ────────────────────────────────────────────────────────
function DeptCard({ card, onClick }: { card: DeptStatusCard; onClick: () => void }) {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center gap-3 hover:shadow-md transition-all duration-150">
            <p className="text-sm font-bold text-gray-800 text-center leading-snug w-full min-h-[2.5rem] flex items-center justify-center">
                {card.dep_name}
            </p>

            <Donut percent={card.percent} />

            <p className="text-sm font-bold text-gray-800 text-center">
                ยังอยู่ในแผนกนี้ {card.active}/{card.entered} คน
            </p>
            <p className="text-xs font-medium text-gray-500 text-center">
                (เสร็จ/ผ่านไปแล้ว {card.done})
            </p>

            <button
                onClick={onClick}
                disabled={card.entered === 0}
                className="border border-gray-300 rounded-full px-5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all flex items-center gap-1 disabled:opacity-40"
            >
                รายละเอียด <ArrowRight size={13} />
            </button>
        </div>
    );
}

// ─── Detail Modal ────────────────────────────────────────────────
function DeptModal({
    card,
    patients,
    onClose,
}: {
    card: DeptStatusCard;
    patients: DeptPatientRow[];
    onClose: () => void;
}) {
    // ยังอยู่แผนกนี้ (ยังไม่เสร็จ)
    const here = patients.filter(
        (p) => p.cur_dep_code === card.dep_code && !p.isFinished,
    );
    // ผ่านแผนกนี้ไปแล้ว: เคยมี cur หรือ last = แผนกนี้ แต่ตอนนี้ไม่ได้อยู่ที่นี่/เสร็จแล้ว
    const moved = patients.filter(
        (p) =>
            (p.last_dep_code === card.dep_code || p.cur_dep_code === card.dep_code) &&
            !(p.cur_dep_code === card.dep_code && !p.isFinished),
    );

    const Row = ({ p, showDest }: { p: DeptPatientRow; showDest?: boolean }) => {
        // ย้ายไปแผนกอื่นจริงไหม (ปลายทางต่างจากการ์ดที่เปิดอยู่)
        const movedAway = p.cur_dep_code !== card.dep_code;
        return (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50">
                <span className="text-xs font-mono text-gray-400 w-12 shrink-0">{p.vsttime}</span>
                <span className="text-xs font-mono text-gray-500 w-20 shrink-0">{p.hn}</span>
                <span className="flex-1 text-sm text-gray-800 truncate">{p.patient_name}</span>
                {showDest ? (
                    <span className="text-[11px] shrink-0 flex items-center gap-1.5">
                        {p.isFinished && <span className="text-gray-400">{p.status}</span>}
                        {/* โชว์ลูกศรเฉพาะตอนย้ายไปแผนกอื่นจริง ไม่ชี้กลับการ์ดตัวเอง */}
                        {movedAway && (
                            <span className="font-medium text-gray-600">→ {p.cur_dep_name}</span>
                        )}
                    </span>
                ) : (
                    <span className="text-[11px] font-medium text-amber-700 shrink-0">{p.status}</span>
                )}
            </div>
        );
    };

    return (
        <AnimatePresence>
            <motion.div
                key="dept-modal-backdrop"
                className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            />
            <div
                key="dept-modal-panel"
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    className="relative bg-gray-50 rounded-2xl flex flex-col overflow-hidden w-full max-w-lg"
                    style={{ height: "min(80vh, 640px)", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}
                    initial={{ scale: 0.94, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.94, y: 20, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 360, damping: 32 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* header */}
                    <div className="bg-white border-b border-gray-100 px-5 py-4 shrink-0 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-green-700 flex items-center justify-center shrink-0">
                            <Users size={16} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-sm font-bold text-gray-900 truncate">{card.dep_name}</h2>
                            <p className="text-[11px] text-gray-400">
                                ยังอยู่แผนกนี้ {card.active} · เข้าทั้งหมด {card.entered} · คงค้าง {card.percent}%
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold active:scale-95"
                        >
                            <X size={12} strokeWidth={2.5} /> ปิด
                        </button>
                    </div>

                    {/* body */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 mb-1 px-1">
                                ยังอยู่แผนกนี้ ({here.length})
                            </p>
                            <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
                                {here.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-6">ไม่มีคนค้าง</p>
                                ) : (
                                    here.map((p, i) => <Row key={`here-${p.vn}-${p.hn}-${i}`} p={p} />)
                                )}
                            </div>
                        </div>

                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1 px-1">
                                ผ่านแผนกนี้ไปแล้ว ({moved.length})
                            </p>
                            <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
                                {moved.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-6">—</p>
                                ) : (
                                    moved.map((p, i) => (
                                        <Row key={`moved-${p.vn}-${p.hn}-${i}`} p={p} showDest />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

// ─── Page ────────────────────────────────────────────────────────
const LEGEND = [
    { color: "#16a34a", label: "ค้างน้อย (<40%)" },
    { color: "#f59e0b", label: "ปานกลาง (40–69%)" },
    { color: "#ef4444", label: "ค้างเยอะ (≥70%)" },
];

export default function DeptStatusPage() {
    const [date, setDate] = useState<Date>(() => getBangkokToday());
    const [activeDate, setActiveDate] = useState<Date>(() => getBangkokToday());
    const [selected, setSelected] = useState<DeptStatusCard | null>(null);

    const url = `/api/dept-status?date=${fmtDate(activeDate)}`;
    const { data, loading, error, connected, secondsLeft, refetch } =
        useAutoRefresh<DeptStatusData>(url, 30_000);

    const infoLabel = toThaiDate(fmtDate(activeDate));
    const cards = data?.cards ?? [];
    // เรียง % คงค้างมากไปน้อย (100% บนสุด) ใช้ร่วมกันทั้งการ์ดและตาราง
    const sortedCards = useMemo(
        () => [...cards].sort((a, b) => b.percent - a.percent || b.active - a.active),
        [cards],
    );
    const patients = useMemo(() => data?.patients ?? [], [data]);
    const byStatus = data?.byStatus ?? [];

    return (
        <div className="p-4 md:p-6 space-y-5">
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h4 className="text-lg font-bold text-[#717171]">
                        ภาพรวมสถานะผู้ป่วย OPD ตามแผนก
                    </h4>
                    <LiveBadge />
                    <ConnectionStatus error={!!error} connected={connected} />
                    <div className="ml-auto flex items-center gap-2">
                        {data && (
                            <span className="text-xs text-gray-400 hidden sm:inline">
                                อัปเดต {timeAgo(data.updatedAt)} · รีเฟรชใน {secondsLeft}s
                            </span>
                        )}
                        <RefreshButton loading={loading} onClick={refetch} />
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 mb-2">
                    <div className="flex items-center gap-2 text-[#717171]">
                        <CalendarDays size={16} />
                        <div>
                            <p className="text-sm">ข้อมูลตามวันที่</p>
                            <p className="text-xs text-gray-400">เลือกวันที่ต้องการ (วันนี้ = real-time)</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 ml-auto flex-wrap">
                        <DatePicker
                            selected={date}
                            onChange={(d: Date | null) => {
                                if (d) setDate(d);
                            }}
                            dateFormat="dd/MM/yyyy"
                            locale={th}
                            showMonthDropdown
                            showYearDropdown
                            dropdownMode="select"
                            customInput={<ThaiDateInput />}
                        />
                        <button
                            onClick={() => setActiveDate(date)}
                            disabled={loading}
                            className="border border-gray-300 rounded px-3 py-1.5 flex items-center gap-1.5 text-sm hover:bg-gray-50 text-gray-600 disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                            ค้นหา
                        </button>
                    </div>
                </div>

                {/* Info + legend */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#717171]">
                    <span className="flex items-center gap-2">
                        <Info size={14} />
                        แสดงข้อมูล: <span className="font-bold">{infoLabel}</span>
                    </span>
                    <span className="flex items-center gap-3 text-xs ml-auto">
                        {LEGEND.map((l) => (
                            <span key={l.label} className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: l.color }} />
                                {l.label}
                            </span>
                        ))}
                    </span>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <KpiCard
                    icon={Users}
                    label="ผู้รับบริการทั้งหมด"
                    value={(data?.totalVisits ?? 0).toLocaleString()}
                    sub="วันที่เลือก"
                    accent="#1a5233"
                    bg="#f0faf4"
                />
                <KpiCard
                    icon={Hourglass}
                    label="ยังไม่เสร็จ (กำลังรับบริการ)"
                    value={(data?.totalActive ?? 0).toLocaleString()}
                    sub="ยังอยู่ในระบบ"
                    accent="#b45309"
                    bg="#fff7ed"
                />
                <KpiCard
                    icon={CheckCircle2}
                    label="เสร็จ/ออกจาก OPD แล้ว"
                    value={(data?.totalDone ?? 0).toLocaleString()}
                    accent="#15803d"
                    bg="#ecfdf5"
                />
            </div>

            {/* สรุปสถานะผู้ป่วยขณะนี้ (จาก ovstost.name จริง) */}
            {byStatus.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-gray-500 mb-2">สถานะผู้ป่วยขณะนี้</p>
                    <div className="flex flex-wrap gap-2">
                        {byStatus.map((s) => (
                            <span
                                key={s.name}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
                                style={
                                    s.finished
                                        ? { background: "#f9fafb", borderColor: "#e5e7eb", color: "#6b7280" }
                                        : { background: "#fff7ed", borderColor: "#fed7aa", color: "#b45309" }
                                }
                            >
                                {s.name}
                                <span className="font-bold tabular-nums">{s.count}</span>
                            </span>
                        ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">
                        สีส้ม = ยังไม่เสร็จ · สีเทา = เสร็จ/ออกจาก OPD
                    </p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                    โหลดข้อมูลไม่สำเร็จ: {error}
                </div>
            )}

            {/* Cards grid + table */}
            {loading && !data ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-[260px] rounded-xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            ) : sortedCards.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl py-16 text-center text-gray-400 text-sm">
                    ไม่พบข้อมูลผู้รับบริการในวันที่เลือก
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {sortedCards.map((c) => (
                            <DeptCard key={c.dep_code} card={c} onClick={() => setSelected(c)} />
                        ))}
                    </div>

                    {/* Summary table */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                        <h2 className="text-sm font-bold text-gray-600 mb-3">
                            สรุปสถานะตามแผนก (เรียง % คงค้างมากไปน้อย)
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-green-700">
                                        {["#", "แผนก", "เข้าทั้งหมด", "ยังอยู่แผนก", "เสร็จ/ผ่านไปแล้ว", "% คงค้าง"].map(
                                            (h, i) => (
                                                <th
                                                    key={h}
                                                    className={`px-3 py-2.5 text-white font-semibold whitespace-nowrap border-r border-green-600 ${i === 1 ? "text-left" : "text-center"
                                                        }`}
                                                >
                                                    {h}
                                                </th>
                                            ),
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedCards.map((c, i) => (
                                        <tr
                                            key={c.dep_code}
                                            onClick={() => setSelected(c)}
                                            className={`border-b border-gray-100 cursor-pointer hover:bg-green-50/60 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"
                                                }`}
                                        >
                                            <td className="px-3 py-2 text-center text-gray-500 font-medium">{i + 1}</td>
                                            <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">
                                                {c.dep_name}
                                            </td>
                                            <td className="px-3 py-2 text-center text-gray-700 tabular-nums">
                                                {c.entered.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-center font-bold tabular-nums text-amber-700">
                                                {c.active.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-center text-gray-600 tabular-nums">
                                                {c.done.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span
                                                    className="inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded-full text-xs font-bold text-white tabular-nums"
                                                    style={{ backgroundColor: barColor(c.percent) }}
                                                >
                                                    {c.percent}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                                        <td className="px-3 py-2.5 text-center text-gray-500" colSpan={2}>
                                            รวมทั้งหมด
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-gray-800 tabular-nums">
                                            {(data?.totalVisits ?? 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-amber-700 tabular-nums">
                                            {(data?.totalActive ?? 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-gray-600 tabular-nums">
                                            {(data?.totalDone ?? 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-gray-400 tabular-nums">
                                            {data && data.totalVisits > 0
                                                ? Math.round((data.totalActive / data.totalVisits) * 100)
                                                : 0}
                                            %
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-3">
                            * คอลัมน์ &quot;เข้าทั้งหมด&quot; นับทั้งคนที่ยังอยู่และที่ผ่านแผนกนี้ไปแล้ว — ผลรวมจึงมากกว่ายอด
                            OPD จริงได้ (1 คนผ่านหลายแผนก) · คลิกแถวเพื่อดูรายชื่อ
                        </p>
                    </div>
                </>
            )}

            {/* Modal */}
            {selected && (
                <DeptModal card={selected} patients={patients} onClose={() => setSelected(null)} />
            )}
        </div>
    );
}