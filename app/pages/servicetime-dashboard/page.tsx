"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Users, Clock, Target, Stethoscope, Pill, FlaskConical,
    UserCheck, Gauge, Settings, X, Calendar, RotateCcw, AlarmClockCheck, AlertTriangle,
} from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { ConnectionStatus, LiveBadge, RefreshButton } from "@/app/components/dashboard/live";
import { fmtDate, getBangkokToday, toThaiDateLabel, getCurrentFiscalYear, getCurrentCalendarYear } from "@/lib/thaiDate";
import type { ServiceTimeData, ServiceScope, VisitType, ServiceShift } from "@/lib/servicetime.types";

import {
    C, fmt, mins, timeColor, pctColor, stageShort,
    Preset, PRESETS, FISCAL_YEARS, CALENDAR_YEARS, fiscalRange, calendarRange,
    SCOPES, VISIT_TYPES, SHIFTS, presetRange,
    Segmented, Field,
    TabBar, View,
    FlowVSM,
    OverviewView,
} from "@/app/components/servicetime";

export default function ServiceTimeDashboardPage() {
    const [preset, setPreset] = useState<Preset>("month");
    const [fiscalYear, setFiscalYear] = useState<number>(() => getCurrentFiscalYear());
    const [calendarYear, setCalendarYear] = useState<number>(() => getCurrentCalendarYear());
    const [customStart, setCustomStart] = useState<Date>(() => presetRange("month").start);
    const [customEnd, setCustomEnd] = useState<Date>(() => getBangkokToday());
    const [scope, setScope] = useState<ServiceScope>("opd");
    const [visitType, setVisitType] = useState<VisitType>("all");
    const [shift, setShift] = useState<ServiceShift>("all");
    const [clinic, setClinic] = useState<string>("all");
    const [view, setView] = useState<View>("overview");

    // เป้าหมาย (เก็บใน localStorage) — targetTotal ส่งไป server, pctGoal ใช้ฝั่ง client (สี/สถานะ)
    const DEFAULT_TARGETS = { total: 90, pct: 80 };
    const [targetTotal, setTargetTotal] = useState<number>(DEFAULT_TARGETS.total);
    const [pctGoal, setPctGoal] = useState<number>(DEFAULT_TARGETS.pct);
    const [showSettings, setShowSettings] = useState(false);
    const [draftTotal, setDraftTotal] = useState<string>(String(DEFAULT_TARGETS.total));
    const [draftPct, setDraftPct] = useState<string>(String(DEFAULT_TARGETS.pct));

    useEffect(() => {
        try {
            const raw = localStorage.getItem("servicetimeTargets");
            if (raw) {
                const v = JSON.parse(raw);
                if (v?.total) setTargetTotal(v.total);
                if (v?.pct) setPctGoal(v.pct);
            }
        } catch { /* ignore */ }
    }, []);

    const openSettings = () => {
        setDraftTotal(String(targetTotal));
        setDraftPct(String(pctGoal));
        setShowSettings(true);
    };
    const saveSettings = () => {
        const t = Math.min(720, Math.max(10, Number(draftTotal) || DEFAULT_TARGETS.total));
        const p = Math.min(100, Math.max(1, Number(draftPct) || DEFAULT_TARGETS.pct));
        setTargetTotal(t);
        setPctGoal(p);
        try { localStorage.setItem("servicetimeTargets", JSON.stringify({ total: t, pct: p })); } catch { /* ignore */ }
        setShowSettings(false);
    };

    const [data, setData] = useState<ServiceTimeData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        const { start, end } =
            preset === "custom" ? { start: customStart, end: customEnd }
                : preset === "fiscal" ? fiscalRange(fiscalYear)
                    : preset === "calendar" ? calendarRange(calendarYear)
                        : presetRange(preset);
        setLoading(true);
        setError(null);
        try {
            const qs = new URLSearchParams({
                start: fmtDate(start), end: fmtDate(end), scope, visitType,
                shift, clinic, target: String(targetTotal),
            });
            const res = await fetch(`/api/servicetime?${qs}`, { credentials: "include" });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error ?? `HTTP ${res.status}`);
            }
            setData((await res.json()) as ServiceTimeData);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [preset, customStart, customEnd, fiscalYear, calendarYear, scope, visitType, shift, clinic, targetTotal]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const summary = data?.summary;
    const total = summary?.total;

    const kpis = useMemo(() => {
        if (!data || !summary || !total) return [];
        const waitDoc = data.stages.find((s) => s.key === "wait_doctor");
        const waitPh = data.stages.find((s) => s.key === "wait_pharmacy");
        return [
            { icon: Users, label: "จำนวน Visit", value: fmt(summary.totalVisits), sub: `ครบ flow ${fmt(summary.completeFlowVisits)}`, ...({ accent: C.blue, bg: C.blueL }) },
            { icon: Clock, label: "ระยะเวลารวมเฉลี่ย", value: mins(total.stat.avg), sub: `มัธยฐาน ${mins(total.stat.median)} · P90 ${mins(total.stat.p90)}`, ...timeColor(total.stat.avg, total.target) },
            { icon: Target, label: `ผ่านเกณฑ์ ≤ ${total.target} นาที`, value: total.withinTargetPct != null ? `${total.withinTargetPct}%` : "-", sub: `เป้า ≥ ${pctGoal}% ของ visit ครบ flow`, ...pctColor(total.withinTargetPct, pctGoal) },
            { icon: Stethoscope, label: "รอตรวจเฉลี่ย", value: mins(waitDoc?.stat.avg ?? null), sub: `เป้า ≤ ${waitDoc?.target} นาที`, ...timeColor(waitDoc?.stat.avg ?? null, waitDoc?.target ?? null) },
            { icon: Pill, label: "รอรับยาเฉลี่ย", value: mins(waitPh?.stat.avg ?? null), sub: `เป้า ≤ ${waitPh?.target} นาที`, ...timeColor(waitPh?.stat.avg ?? null, waitPh?.target ?? null) },
            { icon: FlaskConical, label: "Lab TAT เฉลี่ย", value: mins(data.lab.total.avg), sub: `≤ ${data.lab.target} นาที = ${data.lab.withinTargetPct ?? "-"}%`, ...timeColor(data.lab.total.avg, data.lab.target) },
        ];
    }, [data, summary, total, pctGoal]);

    // การ์ดสรุปหัวเรื่อง (ผู้ป่วย OPD / เวลารวมมัธยฐาน / %เสร็จภายใน 120 นาที / จุดคอขวด)
    const headlineKpis = useMemo(() => {
        if (!data || !summary || !total) return [];
        const within120 = pctColor(summary.within120Pct, 80);
        return [
            {
                icon: scope === "opd" ? Users : UserCheck,
                label: scope === "er" ? "ผู้ป่วย ER" : scope === "all" ? "ผู้ป่วย OPD+ER" : "ผู้ป่วย OPD",
                value: fmt(summary.totalVisits),
                sub: "ราย",
                accent: C.blue, bg: C.blueL,
            },
            {
                icon: Clock,
                label: "เวลารวมทั้ง flow (มัธยฐาน)",
                value: total.stat.median != null ? String(total.stat.median) : "-",
                sub: "นาที (ยื่นบัตร → การเงิน)",
                ...timeColor(total.stat.median, total.target),
            },
            {
                icon: AlarmClockCheck,
                label: "เสร็จภายใน 120 นาที",
                value: summary.within120Pct != null ? `${summary.within120Pct}%` : "-",
                sub: "เป้าหมาย ≥ 80%",
                ...within120,
            },
            {
                icon: AlertTriangle,
                label: "จุดคอขวด (รอนานสุด)",
                value: summary.bottleneckLabel ?? "-",
                sub: `เฉพาะขั้นตอน "รอ"`,
                accent: C.red, bg: C.redL,
            },
        ];
    }, [data, summary, total, scope]);

    const rangeLabel = data ? toThaiDateLabel(data.start, data.end) : "";

    const exportClinics = useCallback(() => {
        if (!data) return;
        const rows = data.byDepartment.map((r) => {
            const o: Record<string, unknown> = {
                คลินิก: r.department,
                visit: r.visits,
                ครบflow: r.completeFlowVisits,
            };
            for (const s of data.stageColumns) {
                o[`${stageShort(s.key, s.label)} (นาที)`] =
                    r.stages.find((x) => x.key === s.key)?.avg ?? "";
            }
            o["รวมเฉลี่ย (นาที)"] = r.avgTotal ?? "";
            o["รวมมัธยฐาน (นาที)"] = r.medianTotal ?? "";
            o["%ผ่านเกณฑ์"] = r.withinTargetPct ?? "";
            o["จุดคอขวด"] = r.bottleneckKey
                ? stageShort(r.bottleneckKey, r.bottleneckKey)
                : "";
            return o;
        });
        exportToExcel(rows, {
            sheetName: "แยกรายคลินิก",
            filePrefix: `servicetime_รายคลินิก_${data.start}_${data.end}`,
            dateKeys: [],
        });
    }, [data]);

    const filtersActive =
        clinic !== "all" || shift !== "all" || scope !== "opd" || visitType !== "all";
    const resetFilters = () => {
        setClinic("all"); setShift("all"); setScope("opd"); setVisitType("all");
    };

    return (
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Gauge size={22} className="text-green-700" />
                        <h1 className="text-xl md:text-2xl font-extrabold text-gray-800">
                            ระยะเวลารอคอย / ให้บริการ OPD
                        </h1>
                        <LiveBadge />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        ตัวชี้วัด Service Time (R9) · {rangeLabel || "—"}
                        {clinic !== "all" && <span className="text-green-700 font-semibold"> · คลินิก: {clinic}</span>}
                        {shift !== "all" && <span className="text-gray-500"> · {SHIFTS.find((s) => s.key === shift)?.label}</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ConnectionStatus error={!!error} connected={!error && !!data} />
                    <RefreshButton loading={loading} onClick={fetchData} />
                </div>
            </div>

            {/* Filter bar */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-4 py-3.5 mb-5">
                <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                    <Field label="ช่วงวันที่" icon={Calendar}>
                        <div className="flex items-center gap-2">
                            <Segmented value={preset} options={PRESETS} onChange={setPreset} />
                            {preset === "fiscal" && (
                                <select
                                    value={fiscalYear}
                                    onChange={(e) => setFiscalYear(Number(e.target.value))}
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                                    title="เลือกปีงบประมาณ"
                                >
                                    {FISCAL_YEARS.map((y) => (
                                        <option key={y} value={y}>ปีงบ {y}</option>
                                    ))}
                                </select>
                            )}
                            {preset === "calendar" && (
                                <select
                                    value={calendarYear}
                                    onChange={(e) => setCalendarYear(Number(e.target.value))}
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                                    title="เลือกปีปฏิทิน"
                                >
                                    {CALENDAR_YEARS.map((y) => (
                                        <option key={y} value={y}>ปี {y}</option>
                                    ))}
                                </select>
                            )}
                            {preset === "custom" && (
                                <div className="flex items-center gap-2">
                                    <DatePicker
                                        selected={customStart}
                                        onChange={(d: Date | null) => { if (d) setCustomStart(d); }}
                                        dateFormat="dd/MM/yyyy"
                                        locale={th}
                                        customInput={<ThaiDateInput />}
                                    />
                                    <span className="text-gray-400">–</span>
                                    <DatePicker
                                        selected={customEnd}
                                        onChange={(d: Date | null) => { if (d) setCustomEnd(d); }}
                                        dateFormat="dd/MM/yyyy"
                                        locale={th}
                                        customInput={<ThaiDateInput />}
                                    />
                                </div>
                            )}
                        </div>
                    </Field>

                    <Field label="คลินิก" icon={Stethoscope}>
                        <select
                            value={clinic}
                            onChange={(e) => setClinic(e.target.value)}
                            disabled={!data || data.clinics.length === 0}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600/30 disabled:opacity-60 disabled:cursor-not-allowed min-w-[140px]"
                            title="เลือกคลินิก"
                        >
                            <option value="all">ทุกคลินิก</option>
                            {data?.clinics.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </Field>

                    <Field label="เวร" icon={Clock}>
                        <Segmented value={shift} options={SHIFTS} onChange={setShift} />
                    </Field>

                    <Field label="กลุ่มบริการ">
                        <Segmented value={scope} options={SCOPES} onChange={setScope} />
                    </Field>

                    <Field label="ประเภทการมา">
                        <Segmented value={visitType} options={VISIT_TYPES} onChange={setVisitType} />
                    </Field>

                    <div className="ml-auto flex items-center gap-2 self-end">
                        {filtersActive && (
                            <button
                                onClick={resetFilters}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                title="ล้างตัวกรองทั้งหมด"
                            >
                                <RotateCcw size={13} /> ล้างตัวกรอง
                            </button>
                        )}
                        <button
                            onClick={openSettings}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
                            title="ตั้งค่าเป้าหมาย"
                        >
                            <Settings size={15} /> เป้าหมาย
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm p-4 mb-4">
                    โหลดข้อมูลไม่สำเร็จ: {error}
                </div>
            )}

            {loading && !data ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            ) : data ? (
                <>
                    <TabBar value={view} onChange={setView} />

                    {view === "flow" && <FlowVSM data={data} />}

                    {view === "overview" && (
                        <OverviewView
                            data={data}
                            headlineKpis={headlineKpis}
                            kpis={kpis}
                            pctGoal={pctGoal}
                            clinic={clinic}
                            onSelectClinic={setClinic}
                            onExportClinics={exportClinics}
                        />
                    )}
                </>
            ) : null}

            {/* Modal ตั้งค่าเป้าหมาย */}
            {showSettings && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
                >
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="flex items-center gap-2 text-base font-bold text-gray-800">
                                <Settings size={17} className="text-green-700" /> ตั้งค่าเป้าหมาย
                            </h3>
                            <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={18} />
                            </button>
                        </div>

                        <label className="block text-sm text-gray-500 mb-1">เป้าหมายเวลารวมทั้ง flow (นาที)</label>
                        <input
                            type="number" min={10} max={720} step={5} value={draftTotal}
                            onChange={(e) => setDraftTotal(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                        />

                        <label className="block text-sm text-gray-500 mb-1">เป้าหมาย % ผู้ป่วยที่เสร็จภายในเวลา</label>
                        <input
                            type="number" min={1} max={100} step={1} value={draftPct}
                            onChange={(e) => setDraftPct(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                        />
                        <p className="text-[11px] text-gray-400 mb-5">
                            เวลารวมมีผลกับการคำนวณ %ผ่านเกณฑ์ (ดึงข้อมูลใหม่) · %เป้าหมายใช้กำหนดสี/สถานะ
                        </p>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={saveSettings}
                                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
                            >
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}