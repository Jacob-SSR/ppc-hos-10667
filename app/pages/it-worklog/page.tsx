"use client";

import { StatCard } from "@/app/components/ui/StatCard";
import { Shimmer } from "@/app/components/ui/Shimmer";
import {
    DailyBarChart,
    AvgDurationChart,
    TaskDurationChart,
    StaffLoadSection,
    StatusDonutSection,
    StatusTrendChart,
    StaffTimelinessChart,
    GroupTimelinessSection,
    SlaReportSection,
} from "./components/WorklogCharts";
import { SubTaskSection } from "./components/SubTaskSection";
import { SummaryTablesSection } from "./components/SummaryTablesSection";
import { useWorklogData } from "@/hooks/useWorklogData";
import { STAFF_COLORS } from "@/lib/worklog.constants";
import { BE_YEARS } from "@/lib/worklog.utils";
import {
    TrendingUp, Clock, AlertTriangle,
    Activity, Users, Info, Calendar,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer } from "recharts";

const MINT = { 500: "#3aa36a", 700: "#236b43" };

export default function ItWorklogPage() {
    const {
        allData, loading, error,
        staffList, selectedStaff, setSelectedStaff,
        timeFilter, setTimeFilter,
        viewMode, setViewMode,
        selectedMainForSub, setSelectedMainForSub,
        filtered, kpis,
        usedShorts, shortColor,
        barData, areaData,
        staffLoad, pieData, durationByTask, statusTrendData, staffTimelinessTrend, timelinessByGroup,
        slaReports,
        mainTasksWithSub,
    } = useWorklogData();

    const { totalJobs, totalMin, avgMin, urgentCount, onTimeCount, devCount, staffCount } = kpis;
    const hasData = !loading && allData.length > 0;

    return (
        <div className="space-y-4">

            {/* ── Header card ── */}
            <div className="rounded-2xl shadow-sm overflow-hidden">
                {/* Gradient header */}
                <div
                    style={{ background: `linear-gradient(135deg, #1a5233 0%, #236b43 100%)` }}
                    className="px-4 md:px-6 py-3 md:py-4 flex flex-wrap items-center justify-between gap-3"
                >
                    <div>
                        <h1 className="text-base md:text-lg font-bold text-white">
                            บันทึกงานประจำวัน — เจ้าหน้าที่ไอที
                        </h1>
                        <p className="text-[11px] mt-0.5" style={{ color: "#a8d5ba" }}>
                            โหลดจาก Google Sheets
                        </p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 space-y-2">
                    {/* แถว 1: date range */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-gray-500">
                            <Calendar size={13} />
                            <span className="text-[10px] font-semibold uppercase tracking-wide hidden sm:inline">ช่วงเวลา</span>
                        </div>
                        <div className="flex rounded-lg overflow-hidden border border-gray-200">
                            {([
                                { key: "custom", label: "กำหนดเอง" },
                                { key: "today", label: "วันนี้" },
                                { key: "thisMonth", label: "เดือนนี้" },
                            ] as const).map(({ key, label }) => {
                                const active = timeFilter.type === key;
                                return (
                                    <button key={key}
                                        onClick={() =>
                                            setTimeFilter(
                                                key === "custom"
                                                    ? { type: "custom", start: "", end: "" }
                                                    : { type: key },
                                            )
                                        }
                                        className="px-2.5 md:px-3 py-1.5 text-xs transition-colors"
                                        style={{
                                            backgroundColor: active ? MINT[500] : "white",
                                            color: active ? "white" : "#4b5563",
                                            fontWeight: active ? 600 : 400,
                                        }}>
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* year dropdown (พ.ศ.) */}
                        <select
                            value={timeFilter.type === "year" ? timeFilter.beYear : ""}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (v) setTimeFilter({ type: "year", beYear: Number(v) });
                            }}
                            className="border rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-[#3aa36a]"
                            style={{
                                borderColor: timeFilter.type === "year" ? MINT[500] : "#e5e7eb",
                                color: timeFilter.type === "year" ? MINT[700] : "#4b5563",
                                fontWeight: timeFilter.type === "year" ? 600 : 400,
                            }}
                        >
                            <option value="" disabled>เลือกปี พ.ศ.</option>
                            {BE_YEARS.map((y) => (
                                <option key={y} value={y}>ปี {y}</option>
                            ))}
                        </select>

                        {/* custom date range */}
                        {timeFilter.type === "custom" && (
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="date"
                                    value={timeFilter.start}
                                    onChange={(e) =>
                                        setTimeFilter({ ...timeFilter, start: e.target.value })
                                    }
                                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 bg-white focus:outline-none focus:border-[#3aa36a]"
                                />
                                <span className="text-xs text-gray-400">ถึง</span>
                                <input
                                    type="date"
                                    value={timeFilter.end}
                                    onChange={(e) =>
                                        setTimeFilter({ ...timeFilter, end: e.target.value })
                                    }
                                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 bg-white focus:outline-none focus:border-[#3aa36a]"
                                />
                            </div>
                        )}

                        {/* view mode */}
                        <div className="flex rounded-lg overflow-hidden border border-gray-200">
                            {(["day", "month"] as const).map((m) => (
                                <button key={m} onClick={() => setViewMode(m)}
                                    className="px-2.5 md:px-3 py-1.5 text-xs transition-colors"
                                    style={{
                                        backgroundColor: viewMode === m ? MINT[700] : "white",
                                        color: viewMode === m ? "white" : "#4b5563",
                                        fontWeight: viewMode === m ? 600 : 400,
                                    }}>
                                    {m === "day" ? "รายวัน" : "รายเดือน"}
                                </button>
                            ))}
                        </div>

                        {/* staff filter */}
                        <select
                            value={selectedStaff}
                            onChange={(e) => setSelectedStaff(e.target.value)}
                            disabled={loading}
                            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 bg-white disabled:opacity-50 max-w-[180px] focus:outline-none focus:border-[#3aa36a]"
                        >
                            {staffList.map((s) => <option key={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Info bar */}
                    <div className="flex items-start gap-2 text-xs text-gray-500">
                        <Info size={13} className="shrink-0 mt-0.5" />
                        {error
                            ? <span className="text-red-500">{error}</span>
                            : <span>
                                แสดงข้อมูล{" "}
                                <span className="font-bold text-gray-700">
                                    {loading ? "กำลังโหลด..." : `${filtered.length.toLocaleString()} รายการ (ทั้งหมด ${allData.length.toLocaleString()} รายการ)`}
                                </span>
                            </span>
                        }
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="bg-white px-4 md:px-6 py-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
                        {loading
                            ? Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} h="h-[130px] md:h-[168px]" />)
                            : <>
                                <StatCard icon={TrendingUp} label="งานทั้งหมด" value={totalJobs.toLocaleString()} sub="รายการ" bg="#E0F2FE" accent="#0369A1" delay={0} />
                                <StatCard icon={Clock} label="เฉลี่ยต่องาน" value={`${avgMin} นาที`} sub={`รวม ${Math.round(totalMin / 60)} ชม.`} bg="#FEF9C3" accent="#854D0E" delay={0.04} />
                                <StatCard icon={AlertTriangle} label="งานเร่งด่วน" value={urgentCount.toLocaleString()} sub={`${totalJobs > 0 ? Math.round(urgentCount / totalJobs * 100) : 0}%`} bg="#FEE2E2" accent="#991B1B" delay={0.08} />
                                <StatCard icon={Activity} label="งานพัฒนา" value={devCount.toLocaleString()} sub={`จาก ${totalJobs}`} bg="#EDE9FE" accent="#5B21B6" delay={0.12} />
                                <StatCard icon={Users} label="เจ้าหน้าที่" value={staffCount} sub="คน" bg="#D1FAE5" accent="#065F46" delay={0.16} />
                                <StatCard icon={TrendingUp} label="ทันเวลา" value={`${totalJobs > 0 ? Math.round(onTimeCount / totalJobs * 100) : 0}%`} sub={`${onTimeCount} รายการ`} bg="#CCFBF1" accent="#134E4A" delay={0.20} />
                            </>
                        }
                    </div>
                </div>
            </div>

            {/* ── ตารางสรุป: เจ้าหน้าที่ / การพัฒนา / ความเร่งด่วน / ทันเวลา ── */}
            {hasData && (
                <SummaryTablesSection
                    staffLoad={staffLoad}
                    totalJobs={totalJobs}
                    devCount={devCount}
                    urgentCount={urgentCount}
                    onTimeCount={onTimeCount}
                />
            )}

            {/* ── Bar Chart ── */}
            {hasData && (
                <DailyBarChart data={barData} usedShorts={usedShorts} shortColor={shortColor} viewMode={viewMode} />
            )}

            {/* ── Pie + Area ── */}
            {hasData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-2xl p-4">
                        <h4 className="text-sm font-bold text-[#717171] mb-3">สัดส่วนประเภทงาน</h4>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                            <div className="w-2 h-2 rounded-full" style={{ background: MINT[500] }} />
                            <strong className="text-gray-700">{filtered.length.toLocaleString()} รายการ</strong>
                        </div>
                        <div className="flex flex-col items-center gap-3">
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%"
                                        outerRadius={85} innerRadius={45}
                                        dataKey="value" paddingAngle={2}
                                        label={({ percent }) => (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ""}
                                        labelLine={false}>
                                        {pieData.map((e, i) => (
                                            <Cell key={i} fill={e.color} stroke="#fff" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <PieTooltip
                                        formatter={(v: number | undefined, _, p) => [`${v ?? 0} งาน`, p?.payload?.name]}
                                        contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="w-full grid grid-cols-2 gap-x-3 gap-y-1.5">
                                {pieData.map((t) => (
                                    <div key={t.name} className="flex items-center gap-1.5 min-w-0">
                                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: t.color }} />
                                        <span className="text-[11px] text-gray-600 truncate flex-1">{t.short}</span>
                                        <span className="text-[11px] font-bold text-gray-800 tabular-nums shrink-0">{t.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <AvgDurationChart data={areaData} avgMin={avgMin} />
                </div>
            )}

            {/* ── ระยะเวลาที่ใช้ (ชม.) แยกตามประเภทงาน ── */}
            {hasData && <TaskDurationChart data={durationByTask} />}

            {hasData && (
                <SubTaskSection
                    filtered={filtered}
                    mainTasksWithSub={mainTasksWithSub}
                    selectedMain={selectedMainForSub}
                    onSelectMain={setSelectedMainForSub}
                />
            )}

            {/* ── Donut: ระดับความเร่งด่วน / ความทันเวลา / ประเภทการดำเนินงาน ── */}
            {hasData && (
                <StatusDonutSection
                    totalJobs={totalJobs}
                    urgentCount={urgentCount}
                    onTimeCount={onTimeCount}
                    devCount={devCount}
                />
            )}

            {/* ── แนวโน้มร้อยละ: เร่งด่วน / ทันเวลา / งานพัฒนา ── */}
            {hasData && (
                <StatusTrendChart data={statusTrendData} viewMode={viewMode} />
            )}

            {/* ── ความทันเวลาต่อเจ้าหน้าที่ ── */}
            {hasData && (
                <StaffTimelinessChart
                    staffs={staffTimelinessTrend.staffs}
                    rows={staffTimelinessTrend.rows}
                    viewMode={viewMode}
                />
            )}

            {/* ── ความทันเวลาแยกกลุ่ม Software / Hardware ── */}
            {hasData && (
                <GroupTimelinessSection groups={timelinessByGroup} />
            )}

            {/* ── SLA: Service Desk / Report — แยกกันคนละ section ── */}
            {hasData && <SlaReportSection reports={slaReports} />}

            {/* ── ปริมาณงานต่อเจ้าหน้าที่ ── */}
            {hasData && <StaffLoadSection staffLoad={staffLoad} />}

            {/* ── Recent table ── */}
            {hasData && (
                <div className="bg-white border border-[#d6f0e0] rounded-2xl p-3 md:p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-700">รายการล่าสุด</h4>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full border"
                            style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba", color: "#1a5233" }}>
                            {filtered.length.toLocaleString()} รายการ
                        </span>
                    </div>
                    <div className="overflow-auto max-h-72 border border-[#d6f0e0] rounded-xl">
                        <table className="min-w-full text-xs border-collapse">
                            <thead>
                                <tr>
                                    {["วันที่", "เจ้าหน้าที่", "ประเภทงาน", "หมวดย่อย", "นาที", "เร่งด่วน"].map((h) => (
                                        <th key={h}
                                            className="sticky top-0 text-white px-2 md:px-3 py-2 text-left font-semibold whitespace-nowrap border-r"
                                            style={{ backgroundColor: MINT[700], borderColor: "#1a5233" }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.slice().reverse().slice(0, 100).map((row, i) => {
                                    const isEven = i % 2 === 0;
                                    const base = isEven ? "#ffffff" : "#f0faf4";
                                    return (
                                        <tr key={i} className="border-b border-[#e8f5ee] transition-colors"
                                            style={{ backgroundColor: base }}
                                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e8f5ee")}
                                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = base)}>
                                            <td className="px-2 md:px-3 py-2 whitespace-nowrap text-gray-500">
                                                {(() => {
                                                    const [, m, d] = row.date.split("-").map(Number);
                                                    return `${d} ${["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][m] ?? ""}`;
                                                })()}
                                            </td>
                                            <td className="px-2 md:px-3 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STAFF_COLORS[row.staff] ?? MINT[500] }} />
                                                    <span className="font-medium text-gray-800 truncate max-w-[80px] md:max-w-none">{row.staff}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 md:px-3 py-2 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                                                    style={{ background: row.color ?? "#94a3b8" }}>
                                                    {row.short || row.mainTask}
                                                </span>
                                            </td>
                                            <td className="px-2 md:px-3 py-2 text-gray-600 max-w-[120px] md:max-w-[200px]">
                                                {row.subTask
                                                    ? <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-full"
                                                        style={{ background: (row.color ?? "#94a3b8") + "14", color: row.color ?? "#94a3b8", border: `1px solid ${(row.color ?? "#94a3b8")}33` }}
                                                        title={row.subTask}>
                                                        {row.subTask}
                                                    </span>
                                                    : <span className="text-gray-300">—</span>
                                                }
                                            </td>
                                            <td className="px-2 md:px-3 py-2 text-center font-medium text-gray-700">{row.duration || "—"}</td>
                                            <td className="px-2 md:px-3 py-2 whitespace-nowrap">
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${row.urgency === "เร่งด่วน" ? "bg-red-100 text-red-700" : "text-white"}`}
                                                    style={row.urgency !== "เร่งด่วน" ? { background: MINT[500] } : {}}>
                                                    {row.urgency === "เร่งด่วน" ? "เร่งด่วน" : "ปกติ"}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}