"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { BedDouble, Users, RefreshCw, TrendingUp, Crown } from "lucide-react";

// ─── Types (ตรงกับ lib/productivity-ipd.service.ts) ───────────────────────────
type Status = "low" | "ok" | "high";
type Mode = "ward" | "class";

interface WardType {
    label: string;
    hours: number;
}
interface Acuity {
    id: number;
    key: string;
    label: string;
    short: string;
    color: string;
    bg: string;
    hours: number;
}
interface Day {
    date: string;
    isWeekend: boolean;
    census: number;
    acuityCounts: Record<string, number>;
    acuityClassified: number;
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
    hoursPerPatient: number;
    hoursPerShift: number;
    standardLow: number;
    standardHigh: number;
    defaultMorning: number;
    defaultAfternoon: number;
    defaultNight: number;
    defaultHead: number;
    wardTypes: WardType[];
    acuity: Acuity[];
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
export default function ProductivityIpdPage() {
    const [data, setData] = useState<ApiData | null>(null);
    const [loading, setLoading] = useState(true);

    const [mode, setMode] = useState<Mode>("ward");

    // โหมดประเภทหอ
    const [census, setCensus] = useState(0);
    const [hoursPerPt, setHoursPerPt] = useState(6);
    const [wardIdx, setWardIdx] = useState<number>(-1); // -1 = กำหนดเอง

    // โหมดจำแนกประเภท
    const [acuity, setAcuity] = useState<Record<string, number>>({});

    // พยาบาล (ใช้ร่วมทั้ง 2 โหมด)
    const [nM, setNM] = useState(0);
    const [nA, setNA] = useState(0);
    const [nN, setNN] = useState(0);
    const [nHead, setNHead] = useState(0);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/productivity-ipd", { credentials: "include" });
            if (res.ok) {
                const json: ApiData = await res.json();
                setData(json);
                setCensus(json.today.census);
                setHoursPerPt(json.config.hoursPerPatient);
                setNM(json.today.nurseMorning);
                setNA(json.today.nurseAfternoon);
                setNN(json.today.nurseNight);
                setNHead(json.today.headStaff);
                setAcuity({ ...json.today.acuityCounts });
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

    const todayCalc = useMemo(() => {
        if (!data) return null;
        const { config } = data;
        const totalN = nM + nA + nN + nHead;
        const actual = totalN * config.hoursPerShift;

        let needed = 0;
        let classSum = 0;
        if (mode === "ward") {
            needed = census * hoursPerPt;
        } else {
            needed = config.acuity.reduce((s, a) => s + (acuity[a.key] ?? 0) * a.hours, 0);
            classSum = config.acuity.reduce((s, a) => s + (acuity[a.key] ?? 0), 0);
        }

        const pct = actual > 0 ? round2((needed / actual) * 100) : 0;
        return {
            needed: round2(needed),
            totalN,
            actual,
            pct,
            classSum,
            status: classify(pct, config.standardLow, config.standardHigh),
        };
    }, [data, mode, census, hoursPerPt, acuity, nM, nA, nN, nHead]);

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
                        <BedDouble size={20} /> ผลิตภาพการพยาบาล IPD
                    </h1>
                    <p className="text-xs text-gray-400 mt-1">
                        ครองเตียง (census) จาก HOSxP · รวมทั้ง IPD · เกณฑ์มาตรฐาน{" "}
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

            {/* ── Mode toggle ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-2 flex gap-2">
                {[
                    { k: "ward" as Mode, t: "📋 ตามประเภทหอผู้ป่วย" },
                    { k: "class" as Mode, t: "🧩 จำแนกประเภทผู้ป่วย" },
                ].map((m) => {
                    const active = mode === m.k;
                    return (
                        <button
                            key={m.k}
                            onClick={() => setMode(m.k)}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                            style={
                                active
                                    ? { backgroundColor: "#0f6e56", color: "white" }
                                    : { backgroundColor: "#f0faf5", color: "#0f6e56" }
                            }
                        >
                            {m.t}
                        </button>
                    );
                })}
            </div>

            {/* ── โหมด 1: ตามประเภทหอ ── */}
            {mode === "ward" && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                    <h2 className="text-sm font-bold mb-4" style={{ color: "#0f6e56" }}>
                        🛏️ คำนวณตามประเภทหอผู้ป่วย
                    </h2>
                    <div className="grid sm:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">ประเภทหอผู้ป่วย</label>
                            <select
                                value={wardIdx}
                                onChange={(e) => {
                                    const idx = Number(e.target.value);
                                    setWardIdx(idx);
                                    if (idx >= 0) setHoursPerPt(data.config.wardTypes[idx].hours);
                                }}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0f6e56]"
                            >
                                <option value={-1}>กำหนดเอง</option>
                                {data.config.wardTypes.map((w, i) => (
                                    <option key={w.label} value={i}>
                                        {w.label} ({w.hours} ชม.)
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">ชม.การพยาบาล/ราย/วัน</label>
                            <input
                                type="number"
                                min={0}
                                step={0.1}
                                value={hoursPerPt}
                                onChange={(e) => {
                                    setHoursPerPt(Number(e.target.value) || 0);
                                    setWardIdx(-1);
                                }}
                                className="w-full text-center font-bold bg-white border border-gray-200 rounded-lg py-2 focus:outline-none focus:border-[#0f6e56]"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">
                                ผู้ป่วยครองเตียง (ราย) · จาก HOSxP
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={census}
                                onChange={(e) => setCensus(Number(e.target.value) || 0)}
                                className="w-full text-center font-bold bg-white border border-gray-200 rounded-lg py-2 focus:outline-none focus:border-[#0f6e56]"
                            />
                        </div>
                    </div>
                    <div className="mt-4 bg-gray-50 rounded-xl px-4 py-3 text-center">
                        <p className="text-base font-semibold" style={{ color: "#0f6e56" }}>
                            ชม.ที่ต้องการ = {census.toLocaleString()} × {hoursPerPt} ={" "}
                            {todayCalc.needed.toFixed(2)} ชม.
                        </p>
                    </div>
                </div>
            )}

            {/* ── โหมด 2: จำแนกประเภทผู้ป่วย ── */}
            {mode === "class" && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                    <h2 className="text-sm font-bold mb-1" style={{ color: "#0f6e56" }}>
                        🧩 คำนวณจำแนกประเภทผู้ป่วย
                    </h2>
                    {data.today.acuityClassified > 0 ? (
                        <p className="text-[11px] text-gray-500 mb-4">
                            ✅ ดึงอัตโนมัติจาก HOSxP (ipd_nurse_note) · จำแนกแล้ว{" "}
                            {data.today.acuityClassified.toLocaleString()} / ครองเตียง{" "}
                            {data.today.census.toLocaleString()} ราย · แก้ตัวเลขเองได้
                        </p>
                    ) : (
                        <p className="text-[11px] text-amber-600 mb-4">
                            ℹ️ ยังไม่มีบันทึกระดับผู้ป่วยใน HOSxP วันนี้ → กรอกเอง (ครองเตียง{" "}
                            {data.today.census.toLocaleString()} ราย ใช้เป็นยอดอ้างอิงให้กระจายครบ)
                        </p>
                    )}
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm border-collapse">
                            <thead>
                                <tr>
                                    {["ประเภทผู้ป่วย", "ชม./ราย", "จำนวนราย", "ชม.รวม"].map((h, i) => (
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
                                {data.config.acuity.map((a) => {
                                    const c = acuity[a.key] ?? 0;
                                    const sub = round2(c * a.hours);
                                    return (
                                        <tr key={a.key} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="px-3 py-2">
                                                <span
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                                                    style={{ backgroundColor: a.bg, color: a.color }}
                                                >
                                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                                                    {a.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center font-semibold">{a.hours}</td>
                                            <td className="px-3 py-2 text-center">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={c}
                                                    onChange={(e) =>
                                                        setAcuity((p) => ({ ...p, [a.key]: Number(e.target.value) || 0 }))
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
                                    <td className="px-3 py-2">รวม</td>
                                    <td className="px-3 py-2" />
                                    <td className="px-3 py-2 text-center tabular-nums">
                                        {todayCalc.classSum.toLocaleString()} ราย
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums">
                                        {todayCalc.needed.toFixed(1)} ชม.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    {todayCalc.classSum !== data.today.census && (
                        <p className="text-[11px] text-amber-600 mt-2">
                            ℹ️ จำแนกระดับแล้ว {todayCalc.classSum} ราย · ครองเตียง {data.today.census} ราย ·
                            เหลือยังไม่จำแนก {Math.max(0, data.today.census - todayCalc.classSum)} ราย (ไม่นำมาคิด)
                        </p>
                    )}
                </div>
            )}

            {/* ── จำนวนพยาบาล (ใช้ร่วม) ── */}
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

            {/* ── ผลผลิตภาพวันนี้ ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: "#0f6e56" }}>
                    <TrendingUp size={16} /> ผลผลิตภาพวันนี้ ({mode === "ward" ? "ตามประเภทหอ" : "จำแนกประเภท"})
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
                        { v: `${todayCalc.needed.toFixed(2)} ชม.`, l: "ชม.ที่ต้องการ (ตัวตั้ง)" },
                        { v: `${todayCalc.actual} ชม.`, l: "ชม.ปฏิบัติงานจริง (ตัวหาร)" },
                        { v: `${todayCalc.totalN} คน`, l: `พยาบาลรวม (${nM}+${nA}+${nN}+${nHead})` },
                        {
                            v: mode === "ward" ? `${census} ราย` : `${todayCalc.classSum} ราย`,
                            l: mode === "ward" ? "ครองเตียง" : "ผู้ป่วยที่จำแนก",
                        },
                    ].map((d) => (
                        <div key={d.l} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                            <p className="text-base font-semibold text-gray-700">{d.v}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{d.l}</p>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-400 text-center">
                    {mode === "ward"
                        ? `สูตร: (${census} × ${hoursPerPt}) × 100 ÷ (${todayCalc.totalN} × ${data.config.hoursPerShift}) = ${todayCalc.pct.toFixed(2)}%`
                        : `สูตร: [${data.config.acuity
                            .filter((a) => (acuity[a.key] ?? 0) > 0)
                            .map((a) => `(${acuity[a.key]}×${a.hours})`)
                            .join(" + ") || "0"}] × 100 ÷ (${todayCalc.totalN} × ${data.config.hoursPerShift}) = ${todayCalc.pct.toFixed(2)}%`}
                </p>
            </div>

            {/* ── ย้อนหลัง 7 วัน (ตามประเภทหอ) ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h2 className="text-sm font-bold mb-1" style={{ color: "#0f6e56" }}>
                    📆 ย้อนหลัง 7 วัน — ครองเตียงจาก HOSxP
                </h2>
                <p className="text-[11px] text-gray-400 mb-4">
                    คิดแบบตามประเภทหอ ({data.config.hoursPerPatient} ชม./ราย) เทียบพยาบาล default
                </p>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border-collapse">
                        <thead>
                            <tr>
                                {["วันที่", "ครองเตียง", "พยาบาล", "หัวหน้า", "รวม", "Productivity", "สถานะ"].map((h) => (
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
                                        <td className="px-3 py-2 text-center tabular-nums">{d.census.toLocaleString()}</td>
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
                    * พยาบาล default (เช้า {data.config.defaultMorning} + บ่าย {data.config.defaultAfternoon} + ดึก{" "}
                    {data.config.defaultNight} + หัวหน้า {data.config.defaultHead} วันธรรมดา / 0 วันหยุด) ปรับได้ผ่าน .env
                </p>
            </div>
        </div>
    );
}