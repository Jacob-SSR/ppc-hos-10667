// app/pages/it-worklog/components/SubTaskSection.tsx
// แยก SubTaskBreakdown + SubTaskChart ออกจาก it-worklog/page.tsx

"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkRow {
    mainTask: string;
    subTask: string;
    [key: string]: unknown;
}

interface SubTaskData {
    mainTask: string;
    subTask: string;
    count: number;
}

function taskColor(t: string): string {
    const TASK_COLORS: Record<string, string> = {
        "ระบบ HosXP": "#0ea5e9",
        "ระบบ KPHIS": "#3aa36a",
        "ระบบ Network": "#10b981",
        "คอมพิวเตอร์และอุปกรณ์ต่อพ่วง": "#f59e0b",
        "ระบบข้อมูล และรายงาน": "#8b5cf6",
        "ระบบอื่นๆ": "#94a3b8",
        "ระบบเอกสาร": "#ec4899",
        "ระบบ  HosOffice": "#f97316",
        "ระบบ  GTWOffice": "#14b8a6",
        "ระบบอินทราเน็ต": "#55b882",
        "ให้คำปรึกษาด้านไอที": "#64748b",
        "แก้ไขปรับปรุง ระบบความเสี่ยง": "#ef4444",
    };
    return TASK_COLORS[t] ?? "#94a3b8";
}

function taskShort(t: string): string {
    const TASK_SHORT: Record<string, string> = {
        "ระบบ HosXP": "HosXP",
        "ระบบ KPHIS": "KPHIS",
        "ระบบ Network": "Network",
        "คอมพิวเตอร์และอุปกรณ์ต่อพ่วง": "คอมฯ",
        "ระบบข้อมูล และรายงาน": "รายงาน",
        "ระบบอื่นๆ": "อื่นๆ",
        "ระบบเอกสาร": "เอกสาร",
        "ระบบ  HosOffice": "HosOffice",
        "ระบบ  GTWOffice": "GTWOffice",
        "ระบบอินทราเน็ต": "Intranet",
        "ให้คำปรึกษาด้านไอที": "ปรึกษา",
        "แก้ไขปรับปรุง ระบบความเสี่ยง": "ความเสี่ยง",
    };
    return TASK_SHORT[t] ?? t;
}

// ── SubTaskBreakdown ──────────────────────────────────────────────────────────

interface SubTaskBreakdownProps {
    data: SubTaskData[];
}

export function SubTaskBreakdown({ data }: SubTaskBreakdownProps) {
    const [expandedTask, setExpandedTask] = useState<string | null>(null);

    const grouped = useMemo(() => {
        const map = new Map<string, { sub: string; count: number }[]>();
        for (const row of data) {
            if (!row.subTask) continue;
            if (!map.has(row.mainTask)) map.set(row.mainTask, []);
            const existing = map.get(row.mainTask)!.find((s) => s.sub === row.subTask);
            if (existing) existing.count += row.count;
            else map.get(row.mainTask)!.push({ sub: row.subTask, count: row.count });
        }
        for (const [, subs] of map) subs.sort((a, b) => b.count - a.count);
        return Array.from(map.entries())
            .map(([main, subs]) => ({ main, subs, total: subs.reduce((s, r) => s + r.count, 0) }))
            .sort((a, b) => b.total - a.total);
    }, [data]);

    if (grouped.length === 0) return null;

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-base font-bold text-[#717171] mb-1">หมวดย่อยภายในแต่ละหมวดหลัก</h4>
            <p className="text-xs text-gray-400 mb-4">คลิกหมวดหลักเพื่อดูรายละเอียด</p>

            <div className="space-y-2">
                {grouped.map((g) => {
                    const color = taskColor(g.main);
                    const isOpen = expandedTask === g.main;
                    const maxSub = g.subs[0]?.count ?? 0;

                    return (
                        <div key={g.main} className="border border-gray-100 rounded-xl overflow-hidden">
                            <button
                                onClick={() => setExpandedTask(isOpen ? null : g.main)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                            >
                                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                                <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{g.main}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                                    style={{ background: color + "18", color }}>
                                    {g.subs.length} หมวดย่อย
                                </span>
                                <span className="text-sm font-extrabold tabular-nums shrink-0" style={{ color }}>
                                    {g.total} งาน
                                </span>
                                <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.15 }}
                                    className="text-gray-400 shrink-0">
                                    <ChevronRight size={16} />
                                </motion.span>
                            </button>

                            <AnimatePresence>
                                {isOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                        className="overflow-hidden border-t border-gray-100"
                                    >
                                        <div className="px-4 py-3 space-y-2.5 bg-gray-50/60">
                                            {g.subs.map((s, si) => {
                                                const pct = maxSub > 0 ? (s.count / maxSub) * 100 : 0;
                                                return (
                                                    <motion.div key={s.sub}
                                                        initial={{ opacity: 0, x: -8 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: si * 0.03 }}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-xs text-gray-700 truncate max-w-[75%]">{s.sub}</span>
                                                            <span className="text-xs font-bold tabular-nums" style={{ color }}>{s.count}</span>
                                                        </div>
                                                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                                                            <motion.div
                                                                className="h-full rounded-full"
                                                                style={{ background: color + "cc" }}
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${pct}%` }}
                                                                transition={{ duration: 0.5, ease: "easeOut", delay: si * 0.03 }}
                                                            />
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── SubTaskChart ──────────────────────────────────────────────────────────────

interface SubTaskChartProps {
    filtered: WorkRow[];
    selectedMain: string;
}

export function SubTaskChart({ filtered, selectedMain }: SubTaskChartProps) {
    const data = useMemo(() => {
        const map: Record<string, number> = {};
        filtered
            .filter((r) => r.mainTask === selectedMain && r.subTask)
            .forEach((r) => { map[r.subTask] = (map[r.subTask] || 0) + 1; });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filtered, selectedMain]);

    const color = taskColor(selectedMain);
    const max = data[0]?.value ?? 1;

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-32 text-xs text-gray-400">
                ไม่มีหมวดย่อยสำหรับหมวดนี้
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {data.map((d, i) => (
                <div key={d.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-700 truncate max-w-[78%]">{d.name}</span>
                        <span className="font-bold tabular-nums" style={{ color }}>{d.value}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                        <motion.div
                            className="h-full rounded-full"
                            style={{ background: color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(d.value / max) * 100}%` }}
                            transition={{ delay: i * 0.04, duration: 0.5, ease: "easeOut" }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── SubTaskSection (ประกอบทั้งสองเข้าด้วยกัน) ─────────────────────────────────

interface SubTaskSectionProps {
    filtered: WorkRow[];
    mainTasksWithSub: string[];
    selectedMain: string;
    onSelectMain: (main: string) => void;
}

export function SubTaskSection({
    filtered,
    mainTasksWithSub,
    selectedMain,
    onSelectMain,
}: SubTaskSectionProps) {
    const subTaskData = useMemo(() =>
        filtered.filter((r) => r.subTask).map((r) => ({ mainTask: r.mainTask, subTask: r.subTask, count: 1 })),
        [filtered],
    );

    if (subTaskData.length === 0) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SubTaskBreakdown data={subTaskData} />

            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h4 className="text-base font-bold text-[#717171]">หมวดย่อยของ</h4>
                    <select
                        value={selectedMain}
                        onChange={(e) => onSelectMain(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-green-400"
                        style={{ maxWidth: "220px" }}
                    >
                        {mainTasksWithSub.map((m) => (
                            <option key={m} value={m}>{taskShort(m)}</option>
                        ))}
                    </select>
                </div>

                {selectedMain && (
                    <div className="flex items-center gap-2 mb-4 text-xs">
                        <div className="w-3 h-3 rounded-full" style={{ background: taskColor(selectedMain) }} />
                        <span className="text-gray-600 font-medium">{selectedMain}</span>
                        <span className="text-gray-400 ml-auto">
                            {filtered.filter((r) => r.mainTask === selectedMain && r.subTask).length} งาน
                        </span>
                    </div>
                )}

                <div className="overflow-y-auto max-h-[340px] pr-1">
                    <SubTaskChart filtered={filtered} selectedMain={selectedMain} />
                </div>
            </div>
        </div>
    );
}