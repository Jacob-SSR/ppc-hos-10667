"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Baby, Users, RefreshCw, TrendingUp, Crown } from "lucide-react";

// ─── Types (ตรงกับ lib/productivity-lr.service.ts) ────────────────────────────
type Status = "low" | "ok" | "high";

interface LrWork {
    key: string;
    label: string;
    short: string;
    color: string;
    bg: string;
    hours: number;
    auto: boolean;
}
interface Day {
    date: string;
    weekday: string;
    isWeekend: boolean;
    deliveries: number;
    babies: number;
    nurseMorning: number;
    nurseAfternoon: number;
    nurseNight: number;
    headStaff: number;
    nurseCount: number;
    actualHours: number;
    neededHours: number;
    productivity: number;
    status: Status;
}
interface Config {
    work: LrWork[];
    hoursPerShift: number;
    historyDays: number;
    standardLow: number;
    standardHigh: number;
    defaultMorning: number;
    defaultAfternoon: number;
    defaultNight: number;
    defaultHead: number;
}
interface ApiData {
    updatedAt: string;
    today: Day;
    history: Day[];
    totalDeliveries: number;
    workingDays: number;
    config: Config;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toThaiDate(d: string): string {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${Number(y) + 543}`;
}

const STATUS_STYLE: Record<
    Status,
    { label: string; advice: string; bg: string; border: string; text: string; bar: string }
> = {
    low: {
        label: "ผลิตภาพต่ำกว่าเกณฑ์ ⚠️",
        advice: "ภาระงานน้อยเทียบเวรที่เฝ้า → ปกติของห้องคลอดในวันงานน้อย (standby)",
        bg: "#FAECE7",
        border: "#D85A30",
        text: "#993C1D",
        bar: "#D85A30",
    },
    ok: {
        label: "ผลิตภาพเหมาะสม ✅",
        advice: "อยู่ในเกณฑ์มาตรฐาน 90–110% เหมาะสมดี",
        bg: "#f0faf5",
        border: "#1D9E75",
        text: "#085041",
        bar: "#1D9E75",
    },
    high: {
        label: "ผลิตภาพสูงกว่าเกณฑ์ 🔴",
        advice: "งานคลอดหนาแน่นเทียบกำลังพล → ควรเสริมเวร/ทีมสำรอง",
        bg: "#FAEEDA",
        border: "#BA7517",
        text: "#854F0B",
        bar: "#BA7517",
    },
};

const BADGE: Record<Status, string> = {
    ok: "เหมาะสม",
    low: "ต่ำกว่าเกณฑ์",
    high: "สูงกว่าเกณฑ์",
};

function classify(pct: number, lo: number, hi: number): Status {
    return pct < lo ? "low" : pct <= hi ? "ok" : "high";
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProductivityLrPage() {
    const [data, setData] = useState<ApiData | null>(null);
    const [loading, setLoading] = useState(true);

    const [selectedDate, setSelectedDate] = useState<string>("");
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [hours, setHours] = useState<Record<string, number>>({});
    const [nM, setNM] = useState(0);
    const [nA, setNA] = useState(0);
    const [nN, setNN] = useState(0);
    const [nHead, setNHead] = useState(0);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/productivity-lr", { credentials: "include" });
            if (res.ok) {
                const json: ApiData = await res.json();
                setData(json);
                // วันที่ทำงานล่าสุด (มีคลอด) ไม่งั้นใช้วันนี้
                const working = json.history.filter((d) => d.deliveries > 0);
                const pick = working.length ? working[working.length - 1] : json.today;
                setSelectedDate(pick.date);
                setCounts({ delivery: pick.deliveries, observe: 0, postpartum: 0 });
                setHours(Object.fromEntries(json.config.work.map((w) => [w.key, w.hours])));
                setNM(json.config.defaultMorning);
                setNA(json.config.defaultAfternoon);
                setNN(json.config.defaultNight);
                setNHead(json.config.defaultHead);
            }
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const selectDay = (d: Day) => {
        setSelectedDate(d.date);
        setCounts((p) => ({ ...p, delivery: d.deliveries }));
    };

    const todayCalc = useMemo(() => {
        if (!data) return null;
        const { config } = data;
        const totalN = nM + nA + nN + nHead;
        const actual = totalN * config.hoursPerShift;
        const needed = config.work.reduce(
            (s, w) => s + (counts[w.key] ?? 0) * (hours[w.key] ?? 0),
            0,
        );
        const pct = actual > 0 ? round2((needed / actual) * 100) : 0;
        return {
            needed: round2(needed),
            totalN,
            actual,
            pct,
            status: classify(pct, config.standardLow, config.standardHigh),
        };
    }, [data, counts, hours, nM, nA, nN, nHead]);

    if (loading || !data || !todayCalc) {
        return (
            <div className="space-y-4">
                <div className="h-24 bg-gray-100 animate-pulse rounded-2xl" />
                <div className="h-72 bg-gray-100 animate-pulse rounded-2xl" />
                <div className="h-64 bg-gray-100 animate-pulse rounded-2xl" />
            </div>
        );
    }

    const st = STATUS_STYLE[todayCalc.status];
    const workingDays = data.history.filter((d) => d.deliveries > 0);
    const maxPct = Math.max(...workingDays.map((d) => d.productivity), 110);

    const nurseFields = [
        { key: "m", label: "เวรเช้า", value: nM, set: setNM, icon: null as React.ElementType | null },
        { key: "a", label: "เวรบ่าย", value: nA, set: setNA, icon: null },
        { key: "n", label: "เวรดึก", value: nN, set: setNN, icon: null },
        { key: "h", label: "หัวหน้า", value: nHead, set: setNHead, icon: Crown },
    ];

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: "#0f6e56" }}>
                        <Baby size={20} /> ผลิตภาพการพยาบาลห้องคลอด (LR)
                    </h1>
                    <p className="text-xs text-gray-400 mt-1">
                        ผู้คลอดจาก HOSxP (ipt_pregnancy) · เฉพาะห้องคลอด · เกณฑ์{" "}
                        {data.config.standardLow}–{data.config.standardHigh}% · ย้อนหลัง{" "}
                        {data.config.historyDays} วัน · คลอดรวม {data.totalDeliveries} ราย /{" "}
                        {data.workingDays} วันที่มีคลอด
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                    <RefreshCw size={14} /> รีเฟรช
                </button>
            </div>

            {/* ── เลือกวันประเมิน + ภาระงาน ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h2 className="text-sm font-bold" style={{ color: "#0f6e56" }}>
                        🍼 ภาระงานห้องคลอด
                    </h2>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">วันที่ประเมิน</label>
                        <select
                            value={selectedDate}
                            onChange={(e) => {
                                const d = data.history.find((x) => x.date === e.target.value);
                                if (d) selectDay(d);
                            }}
                            className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#0f6e56]"
                        >
                            {(workingDays.length ? workingDays : data.history)
                                .slice()
                                .reverse()
                                .map((d) => (
                                    <option key={d.date} value={d.date}>
                                        {d.weekday} {toThaiDate(d.date)} · คลอด {d.deliveries}
                                    </option>
                                ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border-collapse">
                        <thead>
                            <tr>
                                {["ประเภทงาน", "ชม./ราย", "จำนวนราย", "ชม.รวม"].map((h, i) => (
                                    <th
                                        key={h}
                                        className={`px-3 py-2 font-semibold border-b-2 ${i >= 1 ? "text-center" : "text-left"}`}
                                        style={{ backgroundColor: "#f0faf5", color: "#085041", borderColor: "#9FE1CB" }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.config.work.map((w) => {
                                const c = counts[w.key] ?? 0;
                                const h = hours[w.key] ?? 0;
                                const sub = round2(c * h);
                                return (
                                    <tr key={w.key} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="px-3 py-2">
                                            <span
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                                                style={{ backgroundColor: w.bg, color: w.color }}
                                            >
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: w.color }} />
                                                {w.label}
                                            </span>
                                            <div className="text-[11px] text-gray-400 mt-0.5">
                                                {w.short}
                                                {w.auto && <span className="ml-1 text-emerald-600">· auto</span>}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.1}
                                                value={h}
                                                onChange={(e) =>
                                                    setHours((p) => ({ ...p, [w.key]: Number(e.target.value) || 0 }))
                                                }
                                                className="w-16 text-center bg-white border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-[#0f6e56]"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <input
                                                type="number"
                                                min={0}
                                                value={c}
                                                onChange={(e) =>
                                                    setCounts((p) => ({ ...p, [w.key]: Number(e.target.value) || 0 }))
                                                }
                                                className="w-20 text-center font-bold text-gray-800 bg-white border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-[#0f6e56]"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-center tabular-nums font-semibold text-gray-700">
                                            {sub.toFixed(1)} ชม.
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-gray-50 font-bold" style={{ color: "#0f6e56" }}>
                                <td className="px-3 py-2" colSpan={3}>
                                    รวม ชม.ที่ต้องการ
                                </td>
                                <td className="px-3 py-2 text-center tabular-nums">
                                    {todayCalc.needed.toFixed(1)} ชม.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                    ผู้คลอดดึง auto จากวันที่เลือก · รอคลอด/หลังคลอด กรอกเอง · ชม./ราย แก้ได้ (ค่าเริ่มต้นเป็น placeholder)
                </p>
            </div>

            {/* ── จำนวนพยาบาล ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: "#0f6e56" }}>
                    <Users size={16} /> จำนวนพยาบาลห้องคลอด (RN+TN+PN รวมหัวหน้า ไม่รวม AID)
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {nurseFields.map((f) => {
                        const Icon = f.icon;
                        return (
                            <div key={f.key} className="rounded-xl px-4 py-3 bg-gray-50 border border-gray-200">
                                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                                    {Icon && <Icon size={13} />} {f.label}
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    value={f.value}
                                    onChange={(e) => f.set(Number(e.target.value) || 0)}
                                    className="w-full text-center text-2xl font-extrabold tabular-nums text-gray-800 bg-white border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-[#0f6e56]"
                                />
                            </div>
                        );
                    })}
                    <div
                        className="rounded-xl px-4 py-3 text-center flex flex-col justify-center"
                        style={{ backgroundColor: "#f0faf5", border: "1px solid #9FE1CB" }}
                    >
                        <p className="text-2xl font-extrabold tabular-nums" style={{ color: "#0f6e56" }}>
                            {todayCalc.totalN}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                            รวม × {data.config.hoursPerShift} = {todayCalc.actual} ชม.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── ผลผลิตภาพ ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: "#0f6e56" }}>
                    <TrendingUp size={16} /> ผลผลิตภาพ — {toThaiDate(selectedDate)}
                </h2>
                <motion.div
                    key={`${todayCalc.pct}-${selectedDate}`}
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="rounded-2xl p-6 text-center mb-4"
                    style={{ backgroundColor: st.bg, border: `2px solid ${st.border}` }}
                >
                    <p className="text-5xl font-extrabold tabular-nums" style={{ color: st.text }}>
                        {todayCalc.pct.toFixed(2)}%
                    </p>
                    <p className="text-base font-bold mt-2" style={{ color: st.text }}>
                        {st.label}
                    </p>
                    <p className="text-sm mt-1 opacity-90" style={{ color: st.text }}>
                        {st.advice}
                    </p>
                </motion.div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                        { v: `${todayCalc.needed.toFixed(1)} ชม.`, l: "ชม.ที่ต้องการ (ตัวตั้ง)" },
                        { v: `${todayCalc.actual} ชม.`, l: "ชม.ปฏิบัติงานจริง (ตัวหาร)" },
                        { v: `${todayCalc.totalN} คน`, l: `พยาบาลรวม (${nM}+${nA}+${nN}+${nHead})` },
                        { v: `${counts.delivery ?? 0} ราย`, l: "ผู้คลอดวันนี้" },
                    ].map((d) => (
                        <div key={d.l} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                            <p className="text-base font-semibold text-gray-700">{d.v}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{d.l}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── ประวัติวันที่มีคลอด ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h2 className="text-sm font-bold mb-1" style={{ color: "#0f6e56" }}>
                    📆 วันที่มีคลอด ({data.config.historyDays} วันล่าสุด)
                </h2>
                <p className="text-[11px] text-gray-400 mb-4">
                    คิดจากผู้คลอด × {data.config.work[0].hours} ชม. เทียบพยาบาล default · คลิกแถวเพื่อเลือกวัน
                </p>
                {workingDays.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 text-center">
                        ไม่มีการคลอดในช่วง {data.config.historyDays} วันล่าสุด
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm border-collapse">
                            <thead>
                                <tr>
                                    {["วันที่", "ผู้คลอด", "ทารก", "พยาบาล", "Productivity", "สถานะ"].map((h) => (
                                        <th
                                            key={h}
                                            className="px-3 py-2 text-left font-semibold border-b-2"
                                            style={{ backgroundColor: "#f0faf5", color: "#085041", borderColor: "#9FE1CB" }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {workingDays
                                    .slice()
                                    .reverse()
                                    .map((d) => {
                                        const s = STATUS_STYLE[d.status];
                                        const barW = Math.min((d.productivity / maxPct) * 100, 100);
                                        const active = d.date === selectedDate;
                                        return (
                                            <tr
                                                key={d.date}
                                                onClick={() => selectDay(d)}
                                                className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                                                style={active ? { background: "#f0faf5", fontWeight: 600, color: "#0f6e56" } : {}}
                                            >
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    {d.weekday} {toThaiDate(d.date)}
                                                    {d.isWeekend && (
                                                        <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                                                            หยุด
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-center tabular-nums">{d.deliveries}</td>
                                                <td className="px-3 py-2 text-center tabular-nums">{d.babies}</td>
                                                <td className="px-3 py-2 text-center tabular-nums">{d.nurseCount}</td>
                                                <td className="px-3 py-2 min-w-[120px]">
                                                    <span className="tabular-nums">{d.productivity.toFixed(1)}%</span>
                                                    <div className="h-1.5 rounded-full mt-1 bg-gray-200 overflow-hidden">
                                                        <div className="h-full rounded-full" style={{ width: `${barW}%`, backgroundColor: s.bar }} />
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span
                                                        className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                                                        style={{ backgroundColor: s.bg, color: s.text }}
                                                    >
                                                        {BADGE[d.status]}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="text-[11px] text-gray-400 mt-3">
                    * พยาบาล default (เช้า {data.config.defaultMorning} + บ่าย {data.config.defaultAfternoon} + ดึก{" "}
                    {data.config.defaultNight} + หัวหน้า {data.config.defaultHead}) ปรับได้ผ่าน .env ·
                    ประวัติคิดเฉพาะผู้คลอด (รอคลอด/หลังคลอดกรอกในการ์ดด้านบน)
                </p>
            </div>
        </div>
    );
}