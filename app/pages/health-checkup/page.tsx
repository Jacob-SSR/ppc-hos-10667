"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Building2,
    UserCircle,
    HeartPulse,
    CalendarDays,
    Stethoscope,
    FileInput,
    Printer,
    Check,
    X,
    Upload,
    Save,
    TrendingUp,
    BarChart2,
    Droplet,
    Scale,
    Activity,
    Droplets,
    Eye,
    FileSpreadsheet,
    Keyboard,
} from "lucide-react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Filler,
    Tooltip,
    Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import type { ChartData, ChartOptions, ChartDataset } from "chart.js";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Filler,
    Tooltip,
    Legend
);

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PatientData {
    name: string;
    id: string;
    age: number;
    sex: string;
    date: string;
    next: string;
}

interface VitalsData {
    sys: number;
    dia: number;
    fbs: number;
    bmi: number;
    egfr: number;
}

interface LipidData {
    chol: number;
    ldl: number;
    hdl: number;
    tg: number;
}

interface HistoryData {
    years: number[];
    fbs: number[];
    chol: number[];
    ldl: number[];
    sys: number[];
    dia: number[];
    bmi: number[];
}

interface DashboardData {
    patient: PatientData;
    vitals: VitalsData;
    lipid: LipidData;
    history: HistoryData;
}

interface VitalCardConfig {
    label: string;
    icon: React.ElementType;
    value: string | number;
    unit: string;
    status: StatusLevel;
    statusLabel?: string;
    chart: string;
    type?: "bar" | "line";
    datasets: ChartDataset<"line">[];
}

interface TrendChartConfig {
    title: string;
    type?: "bar" | "line";
    data: { labels: string[]; datasets: ChartDataset<"line">[] };
}

// ─── Default data ──────────────────────────────────────────────────────────────

const DEFAULT_DATA: DashboardData = {
    patient: {
        name: "นายสมชาย รักดี",
        id: "12345/69",
        age: 52,
        sex: "ชาย",
        date: "25 มี.ค. 2569",
        next: "25 มี.ค. 2570",
    },
    vitals: { sys: 120, dia: 80, fbs: 92, bmi: 26.5, egfr: 88 },
    lipid: { chol: 210, ldl: 142, hdl: 48, tg: 165 },
    history: {
        years: [2565, 2566, 2567, 2568, 2569],
        fbs: [88, 90, 95, 98, 92],
        chol: [195, 202, 208, 215, 210],
        ldl: [125, 130, 138, 145, 142],
        sys: [118, 122, 125, 123, 120],
        dia: [78, 80, 82, 81, 80],
        bmi: [24.5, 25.2, 25.8, 26.0, 26.5],
    },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

type StatusLevel = "normal" | "warning" | "danger";

function getStatus(
    val: number,
    normal: [number, number],
    warn?: [number, number]
): StatusLevel {
    if (val >= normal[0] && val <= normal[1]) return "normal";
    if (warn && val >= warn[0] && val <= warn[1]) return "warning";
    return "danger";
}

const STATUS_LABEL: Record<StatusLevel, string> = {
    normal: "ปกติ",
    warning: "เฝ้าระวัง",
    danger: "ผิดปกติ",
};

const STATUS_CLASS: Record<StatusLevel, string> = {
    normal: "bg-green-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
};

const CHART_OPTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
        x: { ticks: { font: { size: 9 }, color: "#6b7280" }, grid: { display: false } },
        y: { ticks: { font: { size: 9 }, color: "#6b7280" } },
    },
} as const;

const TREND_OPTS = {
    ...CHART_OPTS,
    plugins: {
        legend: {
            display: true,
            labels: { boxWidth: 8, font: { size: 10 }, color: "#374151" },
        },
    },
} as const;

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status, label }: { status: StatusLevel; label?: string }) {
    return (
        <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white ${STATUS_CLASS[status]}`}
        >
            {label ?? STATUS_LABEL[status]}
        </span>
    );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={`bg-white border border-gray-200 rounded-xl p-4 ${className}`}
        >
            {children}
        </div>
    );
}

function CardTitle({ icon: Icon, children }: { icon?: React.ElementType; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-1.5 mb-3 text-[11px] font-bold uppercase tracking-wider text-green-800">
            {Icon && <Icon size={14} className="shrink-0" />}
            <span>{children}</span>
        </div>
    );
}

function TrafficLight({ status }: { status: StatusLevel }) {
    return (
        <div className="flex items-center gap-4 justify-center py-1">
            <div className="bg-slate-800 rounded-2xl px-2 py-2 flex flex-col gap-1.5 shadow-inner">
                {(["danger", "warning", "normal"] as StatusLevel[]).map((s) => (
                    <div
                        key={s}
                        className={`w-5 h-5 rounded-full transition-all duration-300 ${status === s
                            ? s === "normal"
                                ? "bg-green-400 shadow-[0_0_8px_#4ade80]"
                                : s === "warning"
                                    ? "bg-yellow-400 shadow-[0_0_8px_#facc15]"
                                    : "bg-red-500 shadow-[0_0_8px_#ef4444]"
                            : "bg-slate-600 opacity-30"
                            }`}
                    />
                ))}
            </div>
            <div>
                <div
                    className={`text-lg font-bold ${status === "normal"
                        ? "text-green-500"
                        : status === "warning"
                            ? "text-amber-500"
                            : "text-red-500"
                        }`}
                >
                    {STATUS_LABEL[status]}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Overall Health</div>
            </div>
        </div>
    );
}

function LipidBar({
    value,
    low,
    high,
    higher = false,
}: {
    value: number;
    low: number;
    high: number;
    higher?: boolean;
}) {
    let color = "bg-green-500";
    let pct = 50;
    if (!higher) {
        if (value < low) { color = "bg-green-500"; pct = (value / low) * 60; }
        else if (value < high) { color = "bg-amber-500"; pct = 60 + ((value - low) / (high - low)) * 30; }
        else { color = "bg-red-500"; pct = Math.min(100, 90 + ((value - high) / high) * 10); }
    } else {
        if (value >= low) { color = "bg-green-500"; pct = Math.min(100, 60 + ((value - low) / (high - low)) * 40); }
        else { color = "bg-amber-500"; pct = 50; }
    }
    return (
        <div className="h-1 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
            <div
                className={`h-full ${color} rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
            />
        </div>
    );
}

// ─── Tab data ──────────────────────────────────────────────────────────────────

const CBC_ROWS = [
    { name: "Hemoglobin (Hb)", val: "14.5", unit: "g/dL", ref: "13.5 – 17.5", ok: true },
    { name: "Hematocrit (Hct)", val: "43", unit: "%", ref: "40 – 52", ok: true },
    { name: "WBC", val: "6.8", unit: "×10³/μL", ref: "4.0 – 10.0", ok: true },
    { name: "RBC", val: "5.0", unit: "×10⁶/μL", ref: "4.5 – 5.9", ok: true },
    { name: "Platelet", val: "280", unit: "×10³/μL", ref: "150 – 400", ok: true },
];

const URINE_ROWS = [
    { name: "สี (Color)", val: "Yellow", unit: "–", ref: "Yellow", ok: true },
    { name: "โปรตีน", val: "Negative", unit: "–", ref: "Negative", ok: true },
    { name: "น้ำตาล", val: "Negative", unit: "–", ref: "Negative", ok: true },
    { name: "WBC", val: "0-2", unit: "cells/HPF", ref: "0 – 5", ok: true },
    { name: "pH", val: "6.0", unit: "–", ref: "4.5 – 8.0", ok: true },
];

const STOOL_ROWS = [
    { name: "สี (Color)", val: "Brown", unit: "–", ref: "Brown", ok: true },
    { name: "Consistency", val: "Formed", unit: "–", ref: "Formed", ok: true },
    { name: "WBC", val: "0-1", unit: "cells/HPF", ref: "0 – 2", ok: true },
    { name: "Parasites", val: "Not Found", unit: "–", ref: "Not Found", ok: true },
    { name: "Occult Blood", val: "Negative", unit: "–", ref: "Negative", ok: true },
];

function LabTable({ rows }: { rows: { name: string; val: string; unit: string; ref: string; ok: boolean }[] }) {
    return (
        <table className="w-full text-xs border-collapse">
            <thead>
                <tr className="bg-green-50">
                    {["รายการตรวจ", "ผลตรวจ", "หน่วย", "ค่าอ้างอิง", "สถานะ"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-bold text-green-800 border-b border-green-100 text-[11px]">
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-green-50/40 transition-colors">
                        <td className="px-3 py-2 text-gray-700">{r.name}</td>
                        <td className="px-3 py-2 font-bold text-gray-900">{r.val}</td>
                        <td className="px-3 py-2 text-gray-500">{r.unit}</td>
                        <td className="px-3 py-2 text-gray-500">{r.ref}</td>
                        <td className="px-3 py-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white ${r.ok ? "bg-green-500" : "bg-amber-500"}`}>
                                {r.ok ? "ปกติ" : "เฝ้าระวัง"}
                            </span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// ─── Import Modal ──────────────────────────────────────────────────────────────

interface ImportFormState {
    name: string;
    id: string;
    age: number;
    sex: string;
    date: string;
    next: string;
    sys: number;
    dia: number;
    fbs: number;
    bmi: number;
    egfr: number;
    chol: number;
    ldl: number;
    hdl: number;
    tg: number;
}

interface FormField {
    label: string;
    key: keyof ImportFormState;
    type: "text" | "number" | "select";
    opts?: string[];
    step?: string;
}

function ImportModal({
    onClose,
    onSave,
}: {
    onClose: () => void;
    onSave: (data: Partial<DashboardData>) => void;
}) {
    const [tab, setTab] = useState<"excel" | "form">("excel");
    const [dragging, setDragging] = useState(false);
    const [previewed, setPreviewed] = useState(false);

    const [form, setForm] = useState<ImportFormState>({
        name: "นายสมชาย รักดี", id: "12345/69", age: 52, sex: "ชาย",
        date: "25 มี.ค. 2569", next: "25 มี.ค. 2570",
        sys: 120, dia: 80, fbs: 92, bmi: 26.5, egfr: 88,
        chol: 210, ldl: 142, hdl: 48, tg: 165,
    });

    const handleSave = () => {
        onSave({
            patient: { name: form.name, id: form.id, age: form.age, sex: form.sex, date: form.date, next: form.next },
            vitals: { sys: form.sys, dia: form.dia, fbs: form.fbs, bmi: form.bmi, egfr: form.egfr },
            lipid: { chol: form.chol, ldl: form.ldl, hdl: form.hdl, tg: form.tg },
        });
        onClose();
    };

    const sections: { title: string; fields: FormField[] }[] = [
        {
            title: "ข้อมูลผู้ป่วย",
            fields: [
                { label: "ชื่อ-สกุล", key: "name", type: "text" },
                { label: "เลขที่ผู้ป่วย", key: "id", type: "text" },
                { label: "อายุ", key: "age", type: "number" },
                { label: "เพศ", key: "sex", type: "select", opts: ["ชาย", "หญิง"] },
                { label: "วันที่ตรวจ", key: "date", type: "text" },
                { label: "นัดครั้งถัดไป", key: "next", type: "text" },
            ],
        },
        {
            title: "สัญญาณชีพ & ไขมัน",
            fields: [
                { label: "Systolic (mmHg)", key: "sys", type: "number" },
                { label: "Diastolic (mmHg)", key: "dia", type: "number" },
                { label: "FBS (mg/dL)", key: "fbs", type: "number" },
                { label: "BMI (kg/m²)", key: "bmi", type: "number", step: "0.1" },
                { label: "eGFR", key: "egfr", type: "number" },
                { label: "Total Cholesterol", key: "chol", type: "number" },
                { label: "LDL", key: "ldl", type: "number" },
                { label: "HDL", key: "hdl", type: "number" },
                { label: "Triglyceride", key: "tg", type: "number" },
            ],
        },
    ];

    return (
        <motion.div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto shadow-2xl"
                initial={{ scale: 0.94, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.94, y: 20 }}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <div className="text-sm font-bold text-green-800 flex items-center gap-2">
                        <FileInput size={16} />
                        นำเข้าข้อมูลผลตรวจสุขภาพ
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-5 py-3 border-b border-gray-100 flex gap-1">
                    {([["excel", FileSpreadsheet, "Excel / CSV"], ["form", Keyboard, "คีย์ข้อมูลเอง"]] as const).map(
                        ([key, Icon, label]) => (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === key
                                    ? "bg-green-700 text-white"
                                    : "text-gray-500 hover:bg-gray-100"
                                    }`}
                            >
                                <Icon size={13} />
                                {label}
                            </button>
                        )
                    )}
                </div>

                <div className="p-5">
                    {tab === "excel" ? (
                        <>
                            <div
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragging ? "border-green-500 bg-green-50" : "border-green-200 bg-green-50/40 hover:border-green-400 hover:bg-green-50"
                                    }`}
                                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(e) => { e.preventDefault(); setDragging(false); setPreviewed(true); }}
                                onClick={() => document.getElementById("hw-file-input")?.click()}
                            >
                                <Upload size={36} className="text-green-600 mx-auto mb-2" />
                                <div className="text-sm font-bold text-gray-700">ลากไฟล์ Excel / CSV มาวางที่นี่</div>
                                <div className="text-xs text-gray-400 mt-1">รองรับ .xlsx, .xls, .csv</div>
                                <input id="hw-file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={() => setPreviewed(true)} />
                            </div>

                            <AnimatePresence>
                                {previewed && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-3 bg-gray-50 rounded-xl p-4 border border-gray-200"
                                    >
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-green-800 mb-3">
                                            <Eye size={13} /> ตัวอย่างข้อมูลที่อ่านได้
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                                            {[
                                                ["ชื่อ", "นายสมชาย รักดี"], ["เลขที่", "12345/69"],
                                                ["อายุ", "52 ปี"], ["วันที่", "25 มี.ค. 2569"],
                                                ["ความดัน", "120/80 mmHg"], ["FBS", "92 mg/dL"],
                                                ["BMI", "26.5 kg/m²"], ["LDL", "142 mg/dL"],
                                            ].map(([k, v]) => (
                                                <div key={k} className="flex justify-between py-1 border-b border-gray-200">
                                                    <span className="text-gray-500 font-medium">{k}</span>
                                                    <span className="text-gray-800">{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => { setPreviewed(false); onClose(); }}
                                            className="mt-3 w-full bg-green-700 hover:bg-green-800 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                                        >
                                            <Check size={13} /> ยืนยันนำเข้าจาก Excel
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
                    ) : (
                        <div className="space-y-4">
                            {sections.map((section) => (
                                <div key={section.title}>
                                    <div className="text-xs font-bold text-green-800 mb-2 pb-1 border-b border-green-100">
                                        {section.title}
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                        {section.fields.map((f) => (
                                            <div key={f.key}>
                                                <label className="block text-[11px] font-semibold text-gray-500 mb-1">{f.label}</label>
                                                {f.type === "select" ? (
                                                    <select
                                                        value={form[f.key]}
                                                        onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }) as ImportFormState)}
                                                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:border-green-500"
                                                    >
                                                        {f.opts?.map((o) => <option key={o}>{o}</option>)}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type={f.type}
                                                        step={f.step}
                                                        value={form[f.key]}
                                                        onChange={(e) =>
                                                            setForm((p) => ({
                                                                ...p,
                                                                [f.key]: f.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value,
                                                            }) as ImportFormState)
                                                        }
                                                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        ยกเลิก
                    </button>
                    {tab === "form" && (
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 text-xs font-bold text-white bg-green-700 hover:bg-green-800 rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                            <Save size={13} /> บันทึกข้อมูล
                        </button>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
    { key: "cbc", label: "CBC", icon: Droplet },
    { key: "urine", label: "ปัสสาวะ", icon: Droplets },
    { key: "stool", label: "อุจจาระ", icon: Activity },
    { key: "renal", label: "ไต", icon: Activity },
    { key: "lipid", label: "ไขมัน", icon: BarChart2 },
    { key: "trend", label: "แนวโน้ม", icon: TrendingUp },
];

export default function HealthCheckupPage() {
    const [data, setData] = useState<DashboardData>(DEFAULT_DATA);
    const [activeTab, setActiveTab] = useState("cbc");
    const [showModal, setShowModal] = useState(false);
    const [toast, setToast] = useState({ show: false, msg: "", err: false });

    const showToast = useCallback((msg: string, err = false) => {
        setToast({ show: true, msg, err });
        setTimeout(() => setToast((t) => ({ ...t, show: false })), 2600);
    }, []);

    const handleSave = useCallback(
        (patch: Partial<DashboardData>) => {
            setData((prev) => ({ ...prev, ...patch }));
            showToast("บันทึกข้อมูลเรียบร้อย");
        },
        [showToast]
    );

    const { patient, vitals, lipid, history } = data;

    const bpStatus = getStatus(vitals.sys, [90, 130], [131, 140]);
    const fbsStatus = getStatus(vitals.fbs, [70, 100], [101, 125]);
    const bmiStatus = getStatus(vitals.bmi, [18.5, 24.9], [25, 29.9]);
    const egfrStatus: StatusLevel = vitals.egfr >= 90 ? "normal" : vitals.egfr >= 60 ? "warning" : "danger";

    const overallStatus: StatusLevel = (() => {
        const statuses = [bpStatus, fbsStatus, bmiStatus, egfrStatus];
        if (statuses.includes("danger")) return "danger";
        if (statuses.includes("warning")) return "warning";
        return "normal";
    })();

    const yearLabels = history.years.map(String);

    const vitalsCards: VitalCardConfig[] = [
        {
            label: "ความดันโลหิต",
            icon: Activity,
            value: `${vitals.sys}/${vitals.dia}`,
            unit: "mmHg",
            status: bpStatus,
            chart: "bp",
            datasets: [
                { label: "SYS", data: history.sys, borderColor: "#1a5233", backgroundColor: "rgba(26,82,51,.08)", tension: 0.3 },
                { label: "DIA", data: history.dia, borderColor: "#7ec8a0", backgroundColor: "rgba(126,200,160,.08)", tension: 0.3 },
            ],
        },
        {
            label: "น้ำตาลในเลือด (FBS)",
            icon: Droplet,
            value: vitals.fbs,
            unit: "mg/dL",
            status: fbsStatus,
            chart: "fbs",
            datasets: [{ label: "FBS", data: history.fbs, backgroundColor: "#3aa36a55", borderColor: "#3aa36a", borderWidth: 1 }],
            type: "bar",
        },
        {
            label: "ดัชนีมวลกาย (BMI)",
            icon: Scale,
            value: vitals.bmi,
            unit: "kg/m²",
            status: bmiStatus,
            statusLabel: bmiStatus === "normal" ? "ปกติ" : bmiStatus === "warning" ? "น้ำหนักเกิน" : "อ้วน",
            chart: "bmi",
            datasets: [{ label: "BMI", data: history.bmi, borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,.12)", fill: true, tension: 0.3 }],
        },
        {
            label: "การทำงานไต (eGFR)",
            icon: Activity,
            value: vitals.egfr,
            unit: "mL/min",
            status: egfrStatus,
            chart: "egfr",
            datasets: [{ label: "eGFR", data: [95, 93.5, 92, 90, vitals.egfr], borderColor: "#3aa36a", backgroundColor: "rgba(58,163,106,.1)", fill: true, tension: 0.3 }],
        },
    ];

    const trendCharts: TrendChartConfig[] = [
        {
            title: "น้ำตาลในเลือด (FBS)",
            data: { labels: yearLabels, datasets: [{ label: "FBS", data: history.fbs, borderColor: "#3aa36a", backgroundColor: "rgba(58,163,106,.12)", fill: true, tension: 0.3 }] },
        },
        {
            title: "ไขมันในเลือด",
            data: {
                labels: yearLabels, datasets: [
                    { label: "Total Chol", data: history.chol, borderColor: "#185FA5", tension: 0.3 },
                    { label: "LDL", data: history.ldl, borderColor: "#ef4444", tension: 0.3 },
                ],
            },
        },
        {
            title: "ความดันโลหิต",
            data: {
                labels: yearLabels, datasets: [
                    { label: "Systolic", data: history.sys, borderColor: "#1a5233", tension: 0.3 },
                    { label: "Diastolic", data: history.dia, borderColor: "#7ec8a0", tension: 0.3 },
                ],
            },
        },
        {
            title: "ดัชนีมวลกาย (BMI)",
            data: { labels: yearLabels, datasets: [{ label: "BMI", data: history.bmi, backgroundColor: "#f59e0b55", borderColor: "#f59e0b", borderWidth: 1 }] },
            type: "bar",
        },
    ];

    return (
        <>
            <div className="space-y-3 text-gray-800">
                {/* Header */}
                <div className="bg-[#1a5233] rounded-xl px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                            <Building2 size={20} className="text-[#1a5233]" />
                        </div>
                        <div>
                            <div className="text-white font-bold text-sm leading-tight">โรงพยาบาลพลับพลาชัย</div>
                            <div className="text-green-300 text-[11px]">Annual Health Check-up Dashboard</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all"
                        >
                            <FileInput size={13} /> นำเข้าข้อมูล
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1a5233] bg-white hover:bg-green-50 rounded-lg transition-all"
                        >
                            <Printer size={13} /> พิมพ์รายงาน
                        </button>
                    </div>
                </div>

                {/* Top row */}
                <div className="grid grid-cols-4 gap-3">
                    {/* Patient */}
                    <Card>
                        <CardTitle icon={UserCircle}>ข้อมูลผู้รับการตรวจ</CardTitle>
                        <div className="flex gap-3 items-center">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7ec8a0] to-[#1a5233] flex items-center justify-center shrink-0">
                                <UserCircle size={24} className="text-white" />
                            </div>
                            <div>
                                <div className="font-bold text-sm text-gray-900">{patient.name}</div>
                                <div className="text-[11px] text-gray-500 leading-relaxed mt-0.5">
                                    เลขที่ {patient.id}<br />
                                    อายุ {patient.age} ปี · {patient.sex}<br />
                                    ตรวจ {patient.date}
                                </div>
                                <span className="inline-block mt-1 text-[10px] font-bold text-green-800 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                                    HN Active
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* Status */}
                    <Card>
                        <CardTitle icon={HeartPulse}>สถานะโดยรวม</CardTitle>
                        <TrafficLight status={overallStatus} />
                    </Card>

                    {/* Next appointment */}
                    <Card className="text-center">
                        <CardTitle icon={CalendarDays}>นัดครั้งถัดไป</CardTitle>
                        <div className="text-xl font-bold text-[#1a5233] my-1">{patient.next}</div>
                        <div className="text-[11px] text-gray-500">ห้องตรวจสุขภาพ ชั้น 2</div>
                        <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-green-800 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                            044-xxx-xxx
                        </div>
                    </Card>

                    {/* Advice */}
                    <Card>
                        <CardTitle icon={Stethoscope}>คำแนะนำแพทย์</CardTitle>
                        <div className="space-y-0.5 text-[11px] text-gray-600">
                            {[
                                "ออกกำลังกายสม่ำเสมอ 30 นาที/วัน",
                                "ลดอาหารหวาน มัน เค็ม",
                                "ติดตามไขมัน LDL ที่สูง",
                                "ควบคุม BMI ให้อยู่ในเกณฑ์",
                                "ตรวจสุขภาพตามนัดประจำปี",
                            ].map((t) => (
                                <div key={t} className="flex gap-1.5 items-start leading-relaxed">
                                    <Check size={12} className="text-green-500 mt-0.5 shrink-0" />
                                    {t}
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400 leading-relaxed">
                            ผลตรวจโดยรวมปกติ แต่มีค่าไขมัน LDL และ BMI สูงเล็กน้อย ควรปรับพฤติกรรม
                        </div>
                    </Card>
                </div>

                {/* Vitals */}
                <div className="grid grid-cols-4 gap-3">
                    {vitalsCards.map((v) => (
                        <Card key={v.chart}>
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="text-[11px] font-semibold text-gray-500">{v.label}</div>
                                <StatusBadge status={v.status} label={v.statusLabel} />
                            </div>
                            <div className="text-2xl font-bold text-gray-900 leading-none">
                                {v.value} <span className="text-xs font-normal text-gray-400">{v.unit}</span>
                            </div>
                            <div className="h-20 mt-2">
                                {v.type === "bar" ? (
                                    <Bar
                                        data={{ labels: yearLabels, datasets: v.datasets } as unknown as ChartData<"bar">}
                                        options={CHART_OPTS as unknown as ChartOptions<"bar">}
                                    />
                                ) : (
                                    <Line
                                        data={{ labels: yearLabels, datasets: v.datasets } as ChartData<"line">}
                                        options={CHART_OPTS as unknown as ChartOptions<"line">}
                                    />
                                )}
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Lipid */}
                <Card>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                            <Droplets size={16} className="text-amber-500" />
                            แผงไขมันในเลือด (Lipid Profile)
                        </div>
                        <StatusBadge status="warning" />
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: "Total Cholesterol", val: lipid.chol, unit: "ปกติ < 200", low: 200, high: 240 },
                            { label: "LDL (ไขมันเลว)", val: lipid.ldl, unit: "ปกติ < 130", low: 130, high: 160, color: lipid.ldl > 130 ? "text-red-600" : "text-[#1a5233]" },
                            { label: "HDL (ไขมันดี)", val: lipid.hdl, unit: "ปกติ > 40", low: 40, high: 60, higher: true, color: "text-green-600" },
                            { label: "Triglyceride", val: lipid.tg, unit: "ปกติ < 150", low: 150, high: 200, color: lipid.tg > 150 ? "text-amber-600" : "text-[#1a5233]" },
                        ].map((item) => (
                            <div key={item.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
                                <div className="text-[10px] font-bold text-gray-500 mb-1">{item.label}</div>
                                <div className={`text-xl font-bold ${item.color ?? "text-[#1a5233]"}`}>{item.val}</div>
                                <div className="text-[9px] text-gray-400 mt-0.5">{item.unit} mg/dL</div>
                                <LipidBar value={item.val} low={item.low} high={item.high} higher={item.higher} />
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Tabs */}
                <Card className="p-0 overflow-hidden">
                    <div className="flex bg-gray-50 border-b border-gray-200 overflow-x-auto">
                        {TABS.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${activeTab === key
                                    ? "border-[#1a5233] text-[#1a5233] bg-white"
                                    : "border-transparent text-gray-500 hover:text-[#1a5233] hover:bg-green-50/50"
                                    }`}
                            >
                                <Icon size={13} />
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="p-4">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.15 }}
                            >
                                {activeTab === "cbc" && <LabTable rows={CBC_ROWS} />}
                                {activeTab === "urine" && <LabTable rows={URINE_ROWS} />}
                                {activeTab === "stool" && <LabTable rows={STOOL_ROWS} />}

                                {activeTab === "renal" && (
                                    <LabTable
                                        rows={[
                                            { name: "Creatinine", val: "0.95", unit: "mg/dL", ref: "0.7 – 1.3", ok: true },
                                            { name: "BUN", val: "14", unit: "mg/dL", ref: "7 – 20", ok: true },
                                            { name: "eGFR", val: String(vitals.egfr), unit: "mL/min/1.73m²", ref: "≥ 90", ok: vitals.egfr >= 90 },
                                        ]}
                                    />
                                )}

                                {activeTab === "lipid" && (
                                    <LabTable
                                        rows={[
                                            { name: "Total Cholesterol", val: String(lipid.chol), unit: "mg/dL", ref: "< 200", ok: lipid.chol < 200 },
                                            { name: "LDL (ไขมันเลว)", val: String(lipid.ldl), unit: "mg/dL", ref: "< 130", ok: lipid.ldl < 130 },
                                            { name: "HDL (ไขมันดี)", val: String(lipid.hdl), unit: "mg/dL", ref: "> 40", ok: lipid.hdl >= 40 },
                                            { name: "Triglyceride", val: String(lipid.tg), unit: "mg/dL", ref: "< 150", ok: lipid.tg < 150 },
                                        ]}
                                    />
                                )}

                                {activeTab === "trend" && (
                                    <div className="grid grid-cols-2 gap-4">
                                        {trendCharts.map((c) => (
                                            <div key={c.title}>
                                                <div className="text-[11px] font-bold text-[#1a5233] mb-2">{c.title}</div>
                                                <div className="h-44">
                                                    {c.type === "bar" ? (
                                                        <Bar
                                                            data={c.data as unknown as ChartData<"bar">}
                                                            options={TREND_OPTS as unknown as ChartOptions<"bar">}
                                                        />
                                                    ) : (
                                                        <Line
                                                            data={c.data as ChartData<"line">}
                                                            options={TREND_OPTS as unknown as ChartOptions<"line">}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </Card>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <ImportModal onClose={() => setShowModal(false)} onSave={handleSave} />
                )}
            </AnimatePresence>

            {/* Toast */}
            <AnimatePresence>
                {toast.show && (
                    <motion.div
                        initial={{ x: "120%", opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "120%", opacity: 0 }}
                        className={`fixed bottom-5 right-5 z-[9999] px-4 py-2.5 rounded-xl text-white text-sm font-bold shadow-lg ${toast.err ? "bg-red-500" : "bg-green-600"
                            }`}
                    >
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}