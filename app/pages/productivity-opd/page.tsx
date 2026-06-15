"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, Users, RefreshCw, TrendingUp, Crown } from "lucide-react";

// ─── Types (ตรงกับ lib/productivity.service.ts) ───────────────────────────────
type Status = "low" | "ok" | "high";
interface Day {
    date: string;
    isWeekend: boolean;
    opdTotal: number; // ครั้ง
    opdPatients: number; // คน
    nurseStaff: number;
    headStaff: number;
    nurseCount: number;
    nurseFromRoster: boolean;
    neededHours: number;
    actualHours: number;
    productivity: number;
    status: Status;
}
interface Config {
    hoursPerPatient: number;
    hoursPerShift: number;
    standardLow: number;
    standardHigh: number;
    defaultNurse: number;
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProductivityPage() {
    const [data, setData] = useState<ApiData | null>(null);
    const [loading, setLoading] = useState(true);

    // override แยก 2 ช่อง — recalc client-side
    const [nurseOverride, setNurseOverride] = useState<number | null>(null);
    const [headOverride, setHeadOverride] = useState<number | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/productivity-opd", { credentials: "include" });
            if (res.ok) {
                const json: ApiData = await res.json();
                setData(json);
                setNurseOverride(json.today.nurseStaff);
                setHeadOverride(json.today.headStaff);
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

    // คำนวณวันนี้ใหม่ตามค่า 2 ช่อง
    const todayCalc = useMemo(() => {
        if (!data) return null;
        const { today, config } = data;
        const nurse = nurseOverride ?? today.nurseStaff;
        const head = headOverride ?? today.headStaff;
        const totalN = nurse + head;
        const needed = today.opdTotal * config.hoursPerPatient;
        const actual = totalN * config.hoursPerShift;
        const pct = actual > 0 ? Math.round((needed / actual) * 10000) / 100 : 0;
        return {
            nurse,
            head,
            totalN,
            needed: Math.round(needed * 100) / 100,
            actual,
            pct,
            ratio: totalN > 0 ? (today.opdTotal / totalN).toFixed(1) : "0",
            status: classify(pct, config.standardLow, config.standardHigh),
        };
    }, [data, nurseOverride, headOverride]);

    if (loading || !data || !todayCalc) {
        return (
            <div className="space-y-4">
                <div className="h-24 bg-gray-100 animate-pulse rounded-2xl" />
                <div className="h-64 bg-gray-100 animate-pulse rounded-2xl" />
                <div className="h-80 bg-gray-100 animate-pulse rounded-2xl" />
            </div>
        );
    }

    const st = STATUS_STYLE[todayCalc.status];
    const maxPct = Math.max(...data.history.map((d) => d.productivity), 110);

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: "#0f6e56" }}>
                        <Activity size={20} /> ผลิตภาพการพยาบาล OPD
                    </h1>
                    <p className="text-xs text-gray-400 mt-1">
                        ดึงข้อมูลผู้ป่วยจาก HOSxP · เกณฑ์มาตรฐาน {data.config.standardLow}–
                        {data.config.standardHigh}% · วันที่ {toThaiDate(data.today.date)}
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

            {/* ── ยอดผู้ป่วย + พยาบาล วันนี้ ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h2 className="text-sm font-bold mb-4" style={{ color: "#0f6e56" }}>
                    🏥 ยอดผู้ป่วย OPD วันนี้ (จาก HOSxP)
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* OPD รวม */}
                    <div
                        className="rounded-xl px-4 py-4 text-center"
                        style={{ backgroundColor: "#f0faf5", border: "1px solid #9FE1CB" }}
                    >
                        <p className="text-3xl font-extrabold tabular-nums" style={{ color: "#0f6e56" }}>
                            {data.today.opdTotal.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            ผู้รับบริการ OPD (ครั้ง)
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            {data.today.opdPatients.toLocaleString()} คน
                        </p>
                    </div>

                    {/* พยาบาลเวรเช้า */}
                    <div className="rounded-xl px-4 py-3 bg-gray-50 border border-gray-200">
                        <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                            <Users size={13} /> พยาบาลเวรเช้า (RN+TN+PN)
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={nurseOverride ?? ""}
                            onChange={(e) => setNurseOverride(Number(e.target.value) || 0)}
                            className="w-full text-center text-2xl font-extrabold tabular-nums text-gray-800 bg-white border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-[#0f6e56]"
                        />
                    </div>

                    {/* หัวหน้า */}
                    <div className="rounded-xl px-4 py-3 bg-gray-50 border border-gray-200">
                        <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                            <Crown size={13} /> หัวหน้า
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={headOverride ?? ""}
                            onChange={(e) => setHeadOverride(Number(e.target.value) || 0)}
                            className="w-full text-center text-2xl font-extrabold tabular-nums text-gray-800 bg-white border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-[#0f6e56]"
                        />
                        {data.today.isWeekend && (
                            <p className="text-[10px] text-amber-600 mt-1 text-center">วันหยุด default = 0</p>
                        )}
                    </div>

                    {/* สัดส่วน */}
                    <div className="rounded-xl px-4 py-4 bg-gray-50 border border-gray-200 text-center">
                        <p className="text-2xl font-extrabold tabular-nums text-gray-700">
                            1 : {todayCalc.ratio}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            พยาบาล : ผู้ป่วย <span className="text-gray-400">(รวม {todayCalc.totalN} คน)</span>
                        </p>
                    </div>
                </div>

                <p className="text-[11px] text-gray-400 mt-2">
                    {data.today.nurseFromRoster
                        ? "✅ ดึงจำนวนพยาบาลจากตารางเวร HOSxP"
                        : "ℹ️ ยังไม่ได้ map ตารางเวร — ใช้ค่า default (แก้ได้ในช่องด้านบน)"}
                </p>
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
                        { v: `${todayCalc.needed.toFixed(2)} ชม.`, l: "ชม.พยาบาลที่ต้องการ" },
                        { v: `${todayCalc.actual} ชม.`, l: "ชม.ที่ปฏิบัติงานจริง" },
                        { v: `${todayCalc.totalN} คน`, l: `พยาบาลรวม (${todayCalc.nurse}+${todayCalc.head})` },
                        { v: `1 : ${todayCalc.ratio}`, l: "พยาบาล : ผู้ป่วย" },
                    ].map((d) => (
                        <div key={d.l} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                            <p className="text-base font-semibold text-gray-700">{d.v}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{d.l}</p>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-400 text-center">
                    สูตร: ({data.today.opdTotal} × {data.config.hoursPerPatient}) × 100 ÷ ({todayCalc.totalN} ×{" "}
                    {data.config.hoursPerShift}) = {todayCalc.pct.toFixed(2)}%
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
                                {["วันที่", "OPD รวม", "พยาบาล", "หัวหน้า", "รวม", "Productivity", "สถานะ"].map((h) => (
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
                                        <td className="px-3 py-2 text-center tabular-nums">{d.opdTotal.toLocaleString()}</td>
                                        <td className="px-3 py-2 text-center tabular-nums">{d.nurseStaff}</td>
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
                    * ตาราง 7 วันใช้ค่า default ({data.config.defaultNurse} + หัวหน้า {data.config.defaultHead} วันธรรมดา /
                    0 วันหยุด) จนกว่าจะ map ตารางเวรจริง
                </p>
            </div>
        </div>
    );
}