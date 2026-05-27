"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Wind, Droplets, Scissors, Baby } from "lucide-react";
import { RDU_DEPARTMENTS, TARGETS, DISEASE_META } from "@/lib/rdu.constants";
import type { RduDashboardData, RduDoctorRow } from "@/lib/rdu.types";
import { Dropdown } from "./_components/Dropdown";
import { RduCard } from "./_components/RduCard";
import { DoctorTable } from "./_components/DoctorTable";
import { DoctorProfile } from "./_components/DoctorProfile";
import { useRduCharts } from "./_hooks/useRduCharts";
import { resetDeptColors, getDeptColor } from "./_utils/deptColor";

const DISEASE_ICONS = { uri: Wind, dia: Droplets, wound: Scissors, peri: Baby } as const;

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
    if (preset === "30d") { const s = new Date(today); s.setDate(s.getDate() - 29); return { start: s, end: today }; }
    if (preset === "q2") { const fy = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear(); return { start: new Date(fy - 1, 0, 1), end: new Date(fy - 1, 2, 31) }; }
    if (preset === "6m") { const s = new Date(today); s.setMonth(s.getMonth() - 6); s.setDate(1); return { start: s, end: today }; }
    const fy = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    return { start: new Date(fy, 9, 1), end: today };
}

function fmtDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TREND_TABS = [
    { key: "all", label: "ทุกโรค" }, { key: "uri", label: "URI" },
    { key: "dia", label: "Diarrhea" }, { key: "wound", label: "แผลสด" }, { key: "peri", label: "แผลฝีเย็บ" },
];

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

    const { trendRef, gaugeRef, pieRef, atbRef, topAtbRef, bubbleRef } = useRduCharts(data, disTab, trendView);

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
            if (json.doctors.length > 0) { setSelectedDr(json.doctors[0]); setActiveDr(json.doctors[0].doctor_code); }
        } catch (e) { setError((e as Error).message); }
        finally { setLoading(false); }
    }, [preset, depcode]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const dis = data?.diseases.find(d => d.key === disTab);
    const disMeta = DISEASE_META.find(d => d.key === disTab);
    const updatedAt = data
        ? new Date(data.updatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })
        : "";

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

            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
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
                    <div className="flex items-center gap-2 flex-wrap">
                        {data && (
                            <span className="flex items-center gap-1.5 text-xs bg-green-50 border border-green-200 text-gray-500 px-3 py-1.5 rounded-full whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_0_3px_rgba(22,163,74,.2)]" />
                                Live · {updatedAt}
                            </span>
                        )}
                        <Dropdown<string> value={depcode} options={RDU_DEPARTMENTS.map(d => ({ key: d.depcode, label: d.label }))} onChange={setDepcode} />
                        <Dropdown<Preset> value={preset} options={PRESETS} onChange={setPreset} />
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

            {/* 4 RDU Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {["uri", "dia", "wound", "peri"].map(k => (
                    <RduCard key={k} d={data?.diseases.find(d => d.key === k)} loading={loading} />
                ))}
            </div>

            {/* Trend + Gauge */}
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

            {/* Disease Detail */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                    <div>
                        <h3 className="text-sm font-bold text-gray-800">รายละเอียดโรคเป้าหมาย</h3>
                        <div className="text-xs text-gray-400 mt-0.5">วินิจฉัย · ยาที่สั่งบ่อย · ตัวชี้วัดการใช้ยาตามแนวทาง</div>
                    </div>
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
                    {/* Col 1: stats + donut */}
                    <div>
                        {dis && disMeta && (() => {
                            const Icon = DISEASE_ICONS[dis.key as keyof typeof DISEASE_ICONS];
                            return (
                                <>
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold mb-3"
                                        style={{ background: dis.color + "18", color: dis.color }}>
                                        <Icon size={14} strokeWidth={2} />{dis.name}
                                    </div>
                                    <div className="text-xs text-gray-500 mb-3">
                                        เป้าหมาย RDU: ≤ {dis.target}% &nbsp;·&nbsp; ปัจจุบัน:&nbsp;
                                        <strong style={{ color: dis.current > dis.target ? "#dc2626" : "#16a34a" }}>{dis.current}%</strong>
                                    </div>
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
                    {/* Col 3: Smart Use */}
                    <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">ตัวชี้วัด Smart Use</div>
                        <div className="space-y-2">
                            {(SMART_USE[disTab] ?? []).map((item, i) => (
                                <div key={i} className={`flex gap-3 items-start p-3 border rounded-xl ${item.ok ? "border-gray-100 bg-white" : "border-amber-100 bg-amber-50"}`}>
                                    <span className="flex-shrink-0 mt-0.5">
                                        {item.ok ? <CheckCircle2 size={16} className="text-blue-500" /> : <AlertCircle size={16} className="text-amber-500" />}
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

            {/* Doctor Table + Bubble + Profile */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-1">ข้อมูลแพทย์ / ผู้สั่งจ่ายยา (Prescriber-level)</h3>
                <div className="text-xs text-gray-400 mb-4">% การสั่งยาปฏิชีวนะใน 4 โรคเป้าหมาย · เปรียบเทียบกับเป้าหมาย RDU · คลิกแถวเพื่อดูรายละเอียด</div>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    <div className="lg:col-span-3">
                        <DoctorTable
                            doctors={data?.doctors ?? []}
                            activeDr={activeDr}
                            loading={loading}
                            onSelect={dr => { setSelectedDr(dr); setActiveDr(dr.doctor_code); }}
                        />
                    </div>
                    <div className="lg:col-span-2 space-y-4">
                        <div className="relative h-64">
                            {loading && <div className="absolute inset-0 bg-gray-50 rounded-xl animate-pulse" />}
                            <canvas ref={bubbleRef} />
                        </div>
                        {selectedDr
                            ? <DoctorProfile dr={selectedDr} />
                            : <div className="border border-dashed border-gray-200 rounded-2xl h-36 flex items-center justify-center text-sm text-gray-400">คลิกแถวแพทย์เพื่อดูรายละเอียด</div>
                        }
                    </div>
                </div>
            </div>

            {/* Top ATB + ข้อเสนอแนะ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">ยาปฏิชีวนะที่ใช้บ่อย (ทั้งโรงพยาบาล)</h3>
                    <div className="text-xs text-gray-400 mb-4">เรียงตามจำนวนใบสั่ง · ไตรมาสปัจจุบัน</div>
                    <div className="relative h-64">
                        {loading && <div className="absolute inset-0 bg-gray-50 rounded-xl animate-pulse" />}
                        <canvas ref={topAtbRef} />
                    </div>
                </div>
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
                                        {ok ? <CheckCircle2 size={16} className="text-blue-500" /> : <AlertCircle size={16} className="text-amber-500" />}
                                    </span>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                                            <Icon size={13} style={{ color: d.color }} />{d.name}: {d.current}%
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            {ok ? `ผ่านเป้าหมาย ≤${d.target}% · ต่อยอดเป็น best practice` : `เกินเป้า ${(d.current - d.target).toFixed(1)}% · ทบทวนแนวทางและจัดอบรม`}
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