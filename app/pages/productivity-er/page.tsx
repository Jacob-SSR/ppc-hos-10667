"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Siren, Users, RefreshCw, TrendingUp, Crown } from "lucide-react";

// ─── Types (ตรงกับ lib/productivity-er.service.ts) ────────────────────────────
type Status = "low" | "ok" | "high";

interface ErTriage {
    key: string;
    ids: number[];
    label: string;
    short: string;
    color: string;
    bg: string;
    hours: number;
}
interface Day {
    date: string;
    isWeekend: boolean;
    counts: Record<string, number>;
    erTotal: number;
    classified: number;
    unclassified: number;
    nurseMorning: number;
    nurseAfternoon: number;
    nurseNight: number;
    headStaff: number;
    nurseCount: number;
    neededHours: number;
    actualHours: number;
    productivity: number;
    status: Status;
}
interface Config {
    triage: ErTriage[];
    hoursPerShift: number;
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
        advice: "ภาระงานน้อย ไม่คุ้มค่า → ควรลดจำนวนพยาบาล หรือเพิ่มปริมาณงาน",
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
        advice: "ภาระงานมาก มีความเสี่ยง → ควรเพิ่มจำนวนพยาบาล หรือผ่องถ่ายงาน",
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
export default function ProductivityErPage() {
    const [data, setData] = useState<ApiData | null>(null);
    const [loading, setLoading] = useState(true);

    // ค่าที่แก้ได้ฝั่ง client → recalc วันนี้
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [nM, setNM] = useState(0);
    const [nA, setNA] = useState(0);
    const [nN, setNN] = useState(0);
    const [nHead, setNHead] = useState(0);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/productivity-er", { credentials: "include" });
            if (res.ok) {
                const json: ApiData = await res.json();
                setData(json);
                setCounts({ ...json.today.counts });
                setNM(json.today.nurseMorning);
                setNA(json.today.nurseAfternoon);
                setNN(json.today.nurseNight);
                setNHead(json.today.headStaff);
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

    // คำนวณวันนี้ใหม่ตามค่าที่แก้
    const todayCalc = useMemo(() => {
        if (!data) return null;
        const { config } = data;
        const needed = config.triage.reduce(
            (s, t) => s + (counts[t.key] ?? 0) * t.hours,
            0,
        );
        const totalN = nM + nA + nN + nHead;
        const actual = totalN * config.hoursPerShift;
        const pct = actual > 0 ? round2((needed / actual) * 100) : 0;
        const classified = config.triage.reduce((s, t) => s + (counts[t.key] ?? 0), 0);
        return {
            needed: round2(needed),
            totalN,
            actual,
            pct,
            classified,
            status: classify(pct, config.standardLow, config.standardHigh),
        };
    }, [data, counts, nM, nA, nN, nHead]);

    if (loading || !data || !todayCalc) {
        return (
            <div className="space-y-4">
                <div className="h-24 bg-gray-100 animate-pulse rounded-2xl" />
                <div className="h-80 bg-gray-100 animate-pulse rounded-2xl" />
                <div className="h-64 bg-gray-100 animate-pulse rounded-2xl" />
            </div>
        );
    }

    const st = STATUS_STYLE[todayCalc.status];
    const maxPct = Math.max(...data.history.map((d) => d.productivity), 110);

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
                        <Siren size={20} /> ผลิตภาพการพยาบาล ER
                    </h1>
                    <p className="text-xs text-gray-400 mt-1">
                        ดึงข้อมูลผู้ป่วย ER จาก HOSxP · 4 ระดับ Triage · เกณฑ์มาตรฐาน{" "}
                        {data.config.standardLow}–{data.config.standardHigh}% · วันที่{" "}
                        {toThaiDate(data.today.date)}
                        {data.today.isWeekend && " · วันหยุด (หัวหน้าไม่อยู่)"}
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                    <RefreshCw size={14} /> รีเฟรช
                </button>
            </div>

            {/* ── ตารางผู้ป่วยแยกระดับ Triage วันนี้ ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h2 className="text-sm font-bold mb-4" style={{ color: "#0f6e56" }}>
                    🚑 ยอดผู้ป่วย ER วันนี้ แยกตามระดับ Triage (จาก HOSxP)
                </h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border-collapse">
                        <thead>
                            <tr>
                                {["ระดับ Triage", "คำอธิบาย", "ชม./visit", "จำนวนผู้ป่วย", "ชม.รวม"].map((h, i) => (
                                    <th
                                        key={h}
                                        className={`px-3 py-2 font-semibold border-b-2 ${i >= 2 ? "text-center" : "text-left"}`}
                                        style={{ backgroundColor: "#f0faf5", color: "#085041", borderColor: "#9FE1CB" }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.config.triage.map((t) => {
                                const c = counts[t.key] ?? 0;
                                const sub = round2(c * t.hours);
                                return (
                                    <tr key={t.key} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="px-3 py-2">
                                            <span
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                                                style={{ backgroundColor: t.bg, color: t.color }}
                                            >
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                                                {t.label}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{t.short}</td>
                                        <td className="px-3 py-2 text-center font-semibold">{t.hours}</td>
                                        <td className="px-3 py-2 text-center">
                                            <input
                                                type="number"
                                                min={0}
                                                value={c}
                                                onChange={(e) =>
                                                    setCounts((p) => ({ ...p, [t.key]: Number(e.target.value) || 0 }))
                                                }
                                                className="w-20 text-center font-bold text-gray-800 bg-white border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-[#0f6e56]"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-center tabular-nums font-semibold text-gray-700">
                                            {sub.toFixed(2)} ชม.
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-gray-50 font-bold" style={{ color: "#0f6e56" }}>
                                <td className="px-3 py-2" colSpan={3}>
                                    รวมทั้งหมด
                                </td>
                                <td className="px-3 py-2 text-center tabular-nums">
                                    {todayCalc.classified.toLocaleString()} ราย
                                </td>
                                <td className="px-3 py-2 text-center tabular-nums">
                                    {todayCalc.needed.toFixed(2)} ชม.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {data.today.unclassified > 0 && (
                    <p className="text-[11px] text-amber-600 mt-2">
                        ℹ️ มีผู้ป่วย ER ที่เป็น OPD case (สีขาว) / ไม่ระบุระดับ (ไม่อยู่ใน triage 1–5) อีก{" "}
                        {data.today.unclassified.toLocaleString()} ราย — ไม่นำมาคำนวณผลิตภาพ (รวม ER ทั้งหมด{" "}
                        {data.today.erTotal.toLocaleString()} ราย)
                    </p>
                )}
            </div>

            {/* ── จำนวนพยาบาล ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: "#0f6e56" }}>
                    <Users size={16} /> จำนวนพยาบาล (RN+TN+PN รวมหัวหน้า ไม่รวม AID/คนงาน)
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
                    {/* รวม */}
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
                {data.today.isWeekend && (
                    <p className="text-[11px] text-amber-600 mt-2">วันหยุด: หัวหน้า default = 0</p>
                )}
            </div>

            {/* ── ผลผลิตภาพ วันนี้ ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: "#0f6e56" }}>
                    <TrendingUp size={16} /> ผลผลิตภาพวันนี้
                </h2>
                <motion.div
                    key={todayCalc.pct}
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    {[
                        { v: `${todayCalc.needed.toFixed(2)} ชม.`, l: "ชม.พยาบาลที่ต้องการ (ตัวตั้ง)" },
                        { v: `${todayCalc.actual} ชม.`, l: "ชม.ที่ปฏิบัติงานจริง (ตัวหาร)" },
                        { v: `${todayCalc.totalN} คน`, l: `พยาบาลรวม (${nM}+${nA}+${nN}+${nHead})` },
                        { v: `${todayCalc.classified} ราย`, l: "ผู้ป่วย ER (4 ระดับ)" },
                    ].map((d) => (
                        <div key={d.l} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                            <p className="text-base font-semibold text-gray-700">{d.v}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{d.l}</p>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-400 text-center">
                    สูตร: [{data.config.triage
                        .filter((t) => (counts[t.key] ?? 0) > 0)
                        .map((t) => `(${counts[t.key]}×${t.hours})`)
                        .join(" + ") || "0"}
                    ] × 100 ÷ ({todayCalc.totalN} × {data.config.hoursPerShift}) = {todayCalc.pct.toFixed(2)}%
                </p>
            </div>

            {/* ── ย้อนหลัง 7 วัน ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h2 className="text-sm font-bold mb-4" style={{ color: "#0f6e56" }}>
                    📆 ย้อนหลัง 7 วัน (ข้อมูลจาก HOSxP)
                </h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border-collapse">
                        <thead>
                            <tr>
                                {["วันที่", "ผู้ป่วย ER", "พยาบาล", "หัวหน้า", "รวม", "Productivity", "สถานะ"].map((h) => (
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
                            {[...data.history].reverse().map((d, i) => {
                                const s = STATUS_STYLE[d.status];
                                const barW = Math.min((d.productivity / maxPct) * 100, 100);
                                const nurseShift = d.nurseMorning + d.nurseAfternoon + d.nurseNight;
                                return (
                                    <tr
                                        key={d.date}
                                        className="border-b border-gray-100 hover:bg-gray-50"
                                        style={i === 0 ? { fontWeight: 600, color: "#0f6e56" } : {}}
                                    >
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {toThaiDate(d.date)}
                                            {i === 0 && (
                                                <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: "#EAF3DE", color: "#3B6D11" }}>
                                                    วันนี้
                                                </span>
                                            )}
                                            {d.isWeekend && (
                                                <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                                                    หยุด
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-center tabular-nums">{d.classified.toLocaleString()}</td>
                                        <td className="px-3 py-2 text-center tabular-nums">{nurseShift}</td>
                                        <td className="px-3 py-2 text-center tabular-nums">{d.headStaff}</td>
                                        <td className="px-3 py-2 text-center tabular-nums font-semibold">{d.nurseCount}</td>
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
                <p className="text-[11px] text-gray-400 mt-3">
                    * ตาราง 7 วันใช้ค่าพยาบาล default (เช้า {data.config.defaultMorning} + บ่าย{" "}
                    {data.config.defaultAfternoon} + ดึก {data.config.defaultNight} + หัวหน้า{" "}
                    {data.config.defaultHead} วันธรรมดา / 0 วันหยุด) จนกว่าจะ map ตารางเวรจริง · ปรับค่าได้ผ่าน .env
                </p>
            </div>
        </div>
    );
}