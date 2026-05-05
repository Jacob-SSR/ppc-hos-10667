"use client";

import { Shimmer } from "@/app/components/ui/Shimmer";
import { StatCard } from "@/app/components/ui/StatCard";
import CsvDropzone from "@/app/components/CsvDropzone";
import {
    DailyBarChart,
    AvgDurationChart,
    StaffUrgencySection,
} from "./components/WorklogCharts";
import { SubTaskSection } from "./components/SubTaskSection";
import { useWorklogData } from "@/hooks/useWorklogData";
import { STAFF_COLORS } from "@/lib/worklog.constants";
import {
    TrendingUp, Clock, AlertTriangle,
    Activity, Users, Info, Calendar, RefreshCw,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer } from "recharts";

const MINT = { 500: "#3aa36a", 700: "#236b43" };

export default function ItWorklogPage() {
    const {
        allData, loading, error, fetchData,
        staffList, selectedStaff, setSelectedStaff,
        dateRange, setDateRange,
        viewMode, setViewMode,
        selectedMainForSub, setSelectedMainForSub,
        filtered, kpis,
        usedShorts, shortColor,
        barData, areaData,
        staffLoad, pieData,
        mainTasksWithSub,
    } = useWorklogData();

    const { totalJobs, totalMin, avgMin, urgentCount, onTimeCount, devCount, staffCount } = kpis;
    const hasData = !loading && allData.length > 0;

    return (
        <div className="space-y-4">

            {/* ── Header ── */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="text-lg font-bold text-[#717171] mb-3">
                    บันทึกงานประจำวัน — เจ้าหน้าที่ไอที
                </h4>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 mb-2">
                    <div className="flex items-center gap-2 text-[#717171]">
                        <Calendar size={16} />
                        <div>
                            <p className="text-sm">ข้อมูลตามช่วงเวลา</p>
                            <p className="text-xs text-gray-400">โหลดจาก data/it-worklog.csv</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto flex-wrap">
                        {/* Date range buttons */}
                        <div className="flex rounded-md overflow-hidden border border-gray-200">
                            {[7, 30, 90, 180, 365].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setDateRange(d)}
                                    className="px-3 py-1.5 text-sm transition-colors"
                                    style={{
                                        backgroundColor: dateRange === d ? MINT[500] : "white",
                                        color: dateRange === d ? "white" : "#4b5563",
                                        fontWeight: dateRange === d ? 600 : 400,
                                    }}
                                >
                                    {d}ว.
                                </button>
                            ))}
                            <button
                                onClick={() => setDateRange(99999)}
                                className="px-3 py-1.5 text-sm transition-colors"
                                style={{
                                    backgroundColor: dateRange === 99999 ? MINT[500] : "white",
                                    color: dateRange === 99999 ? "white" : "#4b5563",
                                    fontWeight: dateRange === 99999 ? 600 : 400,
                                }}
                            >
                                ทั้งหมด
                            </button>
                        </div>

                        {/* View mode */}
                        <div className="flex rounded-md overflow-hidden border border-gray-200">
                            {(["day", "month"] as const).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setViewMode(m)}
                                    className="px-3 py-1.5 text-sm transition-colors"
                                    style={{
                                        backgroundColor: viewMode === m ? MINT[700] : "white",
                                        color: viewMode === m ? "white" : "#4b5563",
                                        fontWeight: viewMode === m ? 600 : 400,
                                    }}
                                >
                                    {m === "day" ? "รายวัน" : "รายเดือน"}
                                </button>
                            ))}
                        </div>

                        {/* Staff filter */}
                        <select
                            value={selectedStaff}
                            onChange={(e) => setSelectedStaff(e.target.value)}
                            disabled={loading}
                            className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600 bg-white disabled:opacity-50"
                        >
                            {staffList.map((s) => <option key={s}>{s}</option>)}
                        </select>

                        {/* Refresh */}
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="border border-gray-300 rounded px-3 py-1.5 flex items-center gap-1.5 text-sm hover:bg-gray-50 text-gray-600 disabled:opacity-50 transition-colors"
                        >
                            {loading
                                ? <span className="w-3 h-3 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin inline-block" />
                                : <RefreshCw size={14} />}
                            รีเฟรช
                        </button>
                    </div>
                </div>

                {/* Info bar */}
                <div className="flex items-center gap-2 text-sm text-[#717171] mb-4">
                    <Info size={14} />
                    {error
                        ? <span className="text-red-500">{error}</span>
                        : <span>
                            แสดงข้อมูล:{" "}
                            <span className="font-bold">
                                {loading
                                    ? "กำลังโหลด..."
                                    : `${filtered.length.toLocaleString()} รายการ (ทั้งหมด ${allData.length.toLocaleString()} รายการ)`}
                            </span>
                        </span>
                    }
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {loading
                        ? Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} h="h-[168px]" />)
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

            {/* ── Charts ── */}
            {hasData && (
                <DailyBarChart
                    data={barData}
                    usedShorts={usedShorts}
                    shortColor={shortColor}
                    viewMode={viewMode}
                />
            )}

            {hasData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pie chart */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="text-base font-bold text-[#717171] mb-4">สัดส่วนประเภทงาน</h4>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                            <div className="w-2 h-2 rounded-full" style={{ background: MINT[500] }} />
                            แสดงข้อมูล: <strong className="text-gray-700">{filtered.length.toLocaleString()} รายการ</strong>
                        </div>
                        <div className="flex flex-col items-center gap-4">
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%" cy="50%"
                                        outerRadius={95} innerRadius={50}
                                        dataKey="value"
                                        paddingAngle={2}
                                        label={({ percent }) => (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ""}
                                        labelLine={false}
                                    >
                                        {pieData.map((e, i) => (
                                            <Cell key={i} fill={e.color} stroke="#fff" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <PieTooltip
                                        formatter={(v: number | undefined, _, p) => [`${v ?? 0} งาน`, p?.payload?.name]}
                                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="w-full grid grid-cols-2 gap-x-4 gap-y-1.5">
                                {pieData.map((t) => (
                                    <div key={t.name} className="flex items-center gap-2 min-w-0">
                                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: t.color }} />
                                        <span className="text-xs text-gray-600 truncate flex-1">{t.short}</span>
                                        <span className="text-xs font-bold text-gray-800 tabular-nums shrink-0">{t.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <AvgDurationChart data={areaData} avgMin={avgMin} />
                </div>
            )}

            {hasData && (
                <SubTaskSection
                    filtered={filtered}
                    mainTasksWithSub={mainTasksWithSub}
                    selectedMain={selectedMainForSub}
                    onSelectMain={setSelectedMainForSub}
                />
            )}

            {hasData && (
                <StaffUrgencySection
                    staffLoad={staffLoad}
                    totalJobs={totalJobs}
                    urgentCount={urgentCount}
                    devCount={devCount}
                />
            )}

            {/* ── Recent table ── */}
            {hasData && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-base font-bold text-[#717171]">รายการล่าสุด</h4>
                        <span
                            className="text-xs font-semibold px-3 py-1 rounded-full border"
                            style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba", color: "#1a5233" }}
                        >
                            {filtered.length.toLocaleString()} รายการ
                        </span>
                    </div>
                    <div className="overflow-auto max-h-80 border border-gray-200 rounded-xl">
                        <table className="min-w-full text-xs border-collapse">
                            <thead>
                                <tr>
                                    {["วันที่", "เจ้าหน้าที่", "ประเภทงาน", "หมวดย่อย", "เวลา (นาที)", "ความเร่งด่วน"].map((h) => (
                                        <th
                                            key={h}
                                            className="sticky top-0 text-white px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r"
                                            style={{ backgroundColor: MINT[700], borderColor: "#1a5233" }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.slice().reverse().slice(0, 100).map((row, i) => {
                                    const isEven = i % 2 === 0;
                                    const baseColor = isEven ? "#ffffff" : "#f9fafb";
                                    return (
                                        <tr
                                            key={i}
                                            className="border-b border-gray-100 transition-colors duration-100"
                                            style={{ backgroundColor: baseColor }}
                                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0faf4")}
                                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = baseColor)}
                                        >
                                            <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                                                {(() => {
                                                    const [, m, d] = row.date.split("-").map(Number);
                                                    return `${d} ${["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][m] ?? ""}`;
                                                })()}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STAFF_COLORS[row.staff] ?? MINT[500] }} />
                                                    <span className="font-medium text-gray-800">{row.staff}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span
                                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                                                    style={{ background: row.color }}
                                                >
                                                    {row.short || row.mainTask}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-600 max-w-[200px]">
                                                {row.subTask
                                                    ? <span
                                                        className="inline-block px-2 py-0.5 rounded text-[10px] font-medium truncate max-w-full"
                                                        style={{ background: row.color + "14", color: row.color, border: `1px solid ${row.color}33` }}
                                                        title={row.subTask}
                                                    >
                                                        {row.subTask}
                                                    </span>
                                                    : <span className="text-gray-300">—</span>
                                                }
                                            </td>
                                            <td className="px-3 py-2 text-center font-medium text-gray-700">{row.duration || "—"}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.urgency === "เร่งด่วน" ? "bg-red-100 text-red-700" : "text-white"}`}
                                                    style={row.urgency !== "เร่งด่วน" ? { background: MINT[500] } : {}}
                                                >
                                                    {row.urgency}
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

            <CsvDropzone onUploadSuccess={fetchData} />
        </div>
    );
}