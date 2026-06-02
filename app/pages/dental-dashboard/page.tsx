"use client";
// app/pages/dental-dashboard/page.tsx
// Dashboard ทันตกรรม (ทันตแพทย์ / ทันตาภิบาล) — พอร์ตจาก dental_dashboard.html
// ดึง /api/dental-dashboard ครั้งเดียว (8 ชุดข้อมูล) แล้ว render ตามแท็บ
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

// ─── Types ──────────────────────────────────────────────────────────────────
type StaffType = "ทันตแพทย์" | "ทันตาภิบาล" | "อื่นๆ";
type ShiftCode = "wd_am" | "wd_pm" | "wknd" | "off";
interface SummaryRow { doctor_name: string; staff_type: StaffType; patient_count: number; visit_count: number; total_income: number; }
interface QueueRow { vn: string; hn: string; patient_name: string; doctor_name: string; staff_type: StaffType; visit_time: string; chief_complaint: string; }
interface ProcRow { doctor_name: string; staff_type: StaffType; procedure_code: string; procedure_name: string; count: number; }
interface PttypeRow { doctor_name: string; staff_type: StaffType; pttype_name: string; count: number; }
interface TrendRow { vstdate: string; staff_type: StaffType; patient_count: number; total_income: number; }
interface ShiftRow { shift_code: ShiftCode; staff_type: StaffType; pttype_name: string; patient_count: number; visit_count: number; total_income: number; }
interface IncomeRow { doctor_name: string; staff_type: StaffType; pttype_name: string; total_income: number; patient_count: number; visit_count: number; }
interface PatientRow { vstdate: string; vsttime: string; hn: string; vn: string; patient_name: string; age: number | null; doctor_name: string; staff_type: StaffType; pttype_name: string; chief_complaint: string; procedures: string; total_income: number; }
interface ApiResp {
    updatedAt: string; start: string; end: string;
    summary: SummaryRow[]; queue: QueueRow[]; procedures: ProcRow[]; pttype: PttypeRow[];
    daily_trend: TrendRow[]; shift_report: ShiftRow[]; income_by_doctor_pttype: IncomeRow[]; patient_list: PatientRow[];
}

type TabId = "today" | "queue" | "procedure" | "pttype" | "trend" | "shift" | "income" | "patients";
const TABS: { id: TabId; label: string }[] = [
    { id: "today", label: "📊 ภาพรวม" },
    { id: "queue", label: "🪑 คิวรอ" },
    { id: "procedure", label: "🔧 หัตถการ" },
    { id: "pttype", label: "🎫 สิทธิ" },
    { id: "trend", label: "📈 แนวโน้ม" },
    { id: "shift", label: "🕐 เวร & สิทธิ์" },
    { id: "income", label: "💰 รายได้รายแพทย์" },
    { id: "patients", label: "📋 รายชื่อผู้ป่วย" },
];

const SHIFT_ORDER: ShiftCode[] = ["wd_am", "wd_pm", "wknd", "off"];
const SHIFT_META: Record<ShiftCode, { label: string; color: string; icon: string }> = {
    wd_am: { label: "วันธรรมดา เช้า (08:30–16:30)", color: "#2980b9", icon: "🌅" },
    wd_pm: { label: "วันธรรมดา เย็น (16:30–20:30)", color: "#8e44ad", icon: "🌆" },
    wknd: { label: "เสาร์-อาทิตย์ (08:30–16:30)", color: "#e67e22", icon: "🏖️" },
    off: { label: "นอกเวร / ไม่ระบุ", color: "#95a5a6", icon: "❓" },
};
const PTTYPE_COLORS = ["#2980b9", "#27ae60", "#8e44ad", "#e67e22", "#c0392b", "#16a085", "#d35400", "#7f8c8d"];
const STAFF_TYPES: StaffType[] = ["ทันตแพทย์", "ทันตาภิบาล"];

const fmt = (n: number | string) => Number(n || 0).toLocaleString("th-TH");
const fmtB = (n: number | string) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const staffCls = (t: StaffType) => (t === "ทันตแพทย์" ? "dentist" : t === "ทันตาภิบาล" ? "therapist" : "other");

type Preset = "today" | "7days" | "30days" | "thismonth" | "custom";

export default function DentalDashboardPage() {
    const [preset, setPreset] = useState<Preset>("today");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const [data, setData] = useState<ApiResp | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [tab, setTab] = useState<TabId>("today");
    const [clock, setClock] = useState("--:--:--");

    // patient filters
    const [pq, setPq] = useState("");
    const [fStaff, setFStaff] = useState("");
    const [fDoctor, setFDoctor] = useState("");
    const [fPttype, setFPttype] = useState("");
    // income mode
    const [incomeMode, setIncomeMode] = useState<"income" | "patient" | "visit">("income");

    // clock
    useEffect(() => {
        const t = setInterval(() => setClock(new Date().toLocaleTimeString("th-TH")), 1000);
        setClock(new Date().toLocaleTimeString("th-TH"));
        return () => clearInterval(t);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            let url = "";
            if (preset === "custom" && customFrom && customTo) url = `/api/dental-dashboard?start=${customFrom}&end=${customTo}`;
            else url = `/api/dental-dashboard?preset=${preset === "custom" ? "today" : preset}`;
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const d: ApiResp = await res.json();
            setData(d);
        } catch (e) {
            setErr(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [preset, customFrom, customTo]);

    useEffect(() => {
        if (preset === "custom" && (!customFrom || !customTo)) return;
        load();
        const t = setInterval(load, 60000);
        return () => clearInterval(t);
    }, [load, preset, customFrom, customTo]);

    const rangeLabel = data ? (data.start === data.end ? data.start : `${data.start} – ${data.end}`) : "";

    // ── KPI ──
    const kpi = useMemo(() => {
        const s = data?.summary || [];
        return {
            totalPatients: s.reduce((a, r) => a + r.patient_count, 0),
            dentistVisits: s.filter((r) => r.staff_type === "ทันตแพทย์").reduce((a, r) => a + r.visit_count, 0),
            therapistVisits: s.filter((r) => r.staff_type === "ทันตาภิบาล").reduce((a, r) => a + r.visit_count, 0),
            totalIncome: s.reduce((a, r) => a + r.total_income, 0),
        };
    }, [data]);

    // ── charts ──
    const chartRefs = {
        pie: useRef<HTMLCanvasElement | null>(null),
        trendPt: useRef<HTMLCanvasElement | null>(null),
        trendInc: useRef<HTMLCanvasElement | null>(null),
        incDoc: useRef<HTMLCanvasElement | null>(null),
        incPie: useRef<HTMLCanvasElement | null>(null),
        shiftPt: useRef<HTMLCanvasElement | null>(null),
        shiftInc: useRef<HTMLCanvasElement | null>(null),
    };
    const chartInst = useRef<Record<string, Chart | null>>({});
    const mk = (key: string, ref: HTMLCanvasElement | null, cfg: import("chart.js").ChartConfiguration) => {
        if (!ref) return;
        chartInst.current[key]?.destroy();
        chartInst.current[key] = new Chart(ref, cfg);
    };

    // pie (today)
    useEffect(() => {
        if (tab !== "today" || !data) return;
        const s = data.summary;
        const c = (t: StaffType) => s.filter((r) => r.staff_type === t).reduce((a, r) => a + r.patient_count, 0);
        mk("pie", chartRefs.pie.current, {
            type: "doughnut",
            data: { labels: ["ทันตแพทย์", "ทันตาภิบาล", "อื่นๆ"], datasets: [{ data: [c("ทันตแพทย์"), c("ทันตาภิบาล"), c("อื่นๆ")], backgroundColor: ["#2980b9", "#27ae60", "#9b59b6"], borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
        });
    }, [tab, data]); // eslint-disable-line

    // trend
    useEffect(() => {
        if (tab !== "trend" || !data) return;
        const rows = data.daily_trend;
        const dates = [...new Set(rows.map((r) => r.vstdate))].sort();
        const series = (st: StaffType, key: "patient_count" | "total_income") =>
            dates.map((d) => { const r = rows.find((x) => x.vstdate === d && x.staff_type === st); return r ? r[key] : 0; });
        const commonOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" as const } }, scales: { y: { beginAtZero: true }, x: { ticks: { maxRotation: 45, font: { size: 11 } } } } };
        mk("trendPt", chartRefs.trendPt.current, {
            type: "line",
            data: {
                labels: dates, datasets: [
                    { label: "ทันตแพทย์", data: series("ทันตแพทย์", "patient_count"), borderColor: "#2980b9", backgroundColor: "rgba(41,128,185,.1)", tension: .3, fill: true },
                    { label: "ทันตาภิบาล", data: series("ทันตาภิบาล", "patient_count"), borderColor: "#27ae60", backgroundColor: "rgba(39,174,96,.1)", tension: .3, fill: true },
                ]
            },
            options: commonOpts,
        });
        mk("trendInc", chartRefs.trendInc.current, {
            type: "bar",
            data: {
                labels: dates, datasets: [
                    { label: "ทันตแพทย์", data: series("ทันตแพทย์", "total_income"), backgroundColor: "rgba(41,128,185,.75)" },
                    { label: "ทันตาภิบาล", data: series("ทันตาภิบาล", "total_income"), backgroundColor: "rgba(39,174,96,.75)" },
                ]
            },
            options: { ...commonOpts, scales: { x: { stacked: true, ticks: { maxRotation: 45, font: { size: 11 } } }, y: { stacked: true, beginAtZero: true } } },
        });
    }, [tab, data]); // eslint-disable-line

    // income charts
    const incomeDerived = useMemo(() => {
        const rows = data?.income_by_doctor_pttype || [];
        const valueKey = incomeMode === "income" ? "total_income" : incomeMode === "patient" ? "patient_count" : "visit_count";
        const doctors = [...new Map(rows.map((r) => [r.doctor_name, { name: r.doctor_name, type: r.staff_type }])).values()]
            .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, "th") : a.type.localeCompare(b.type)));
        const pttypes = [...new Set(rows.map((r) => r.pttype_name))].sort();
        const getV = (dn: string, pt: string) => { const r = rows.find((x) => x.doctor_name === dn && x.pttype_name === pt); return r ? (r[valueKey as keyof IncomeRow] as number) : 0; };
        const grandPt: Record<string, number> = {}; pttypes.forEach((p) => (grandPt[p] = 0));
        let grand = 0;
        const bodyRows = doctors.map((d) => {
            let rowTotal = 0;
            pttypes.forEach((pt) => { const v = getV(d.name, pt); rowTotal += v; grandPt[pt] += v; grand += v; });
            return { d, rowTotal };
        });
        const maxPerDoctor = Math.max(1, ...bodyRows.map((b) => b.rowTotal));
        return { rows, valueKey, doctors, pttypes, getV, grandPt, grand, bodyRows, maxPerDoctor };
    }, [data, incomeMode]);

    useEffect(() => {
        if (tab !== "income" || !data) return;
        const { doctors, pttypes, getV, grandPt } = incomeDerived;
        const datasets = pttypes.map((pt, i) => ({ label: pt, data: doctors.map((d) => getV(d.name, pt)), backgroundColor: PTTYPE_COLORS[i % PTTYPE_COLORS.length] }));
        mk("incDoc", chartRefs.incDoc.current, {
            type: "bar",
            data: { labels: doctors.map((d) => d.name), datasets },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } },
        });
        mk("incPie", chartRefs.incPie.current, {
            type: "doughnut",
            data: { labels: pttypes, datasets: [{ data: pttypes.map((pt) => grandPt[pt]), backgroundColor: PTTYPE_COLORS }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
        });
    }, [tab, data, incomeDerived]); // eslint-disable-line

    // shift charts
    useEffect(() => {
        if (tab !== "shift" || !data) return;
        const rows = data.shift_report;
        const shifts = SHIFT_ORDER.filter((s) => rows.some((r) => r.shift_code === s));
        const ds = (key: "patient_count" | "total_income") => STAFF_TYPES.map((st, i) => ({
            label: st,
            data: shifts.map((sh) => rows.filter((r) => r.shift_code === sh && r.staff_type === st).reduce((a, r) => a + r[key], 0)),
            backgroundColor: i === 0 ? "rgba(41,128,185,.8)" : "rgba(39,174,96,.8)",
        }));
        const barOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" as const } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } };
        mk("shiftPt", chartRefs.shiftPt.current, { type: "bar", data: { labels: shifts.map((s) => SHIFT_META[s].label), datasets: ds("patient_count") }, options: barOpts });
        mk("shiftInc", chartRefs.shiftInc.current, { type: "bar", data: { labels: shifts.map((s) => SHIFT_META[s].label), datasets: ds("total_income") }, options: barOpts });
    }, [tab, data]); // eslint-disable-line

    useEffect(() => () => { Object.values(chartInst.current).forEach((c) => c?.destroy()); }, []);

    // ── patient list filtered ──
    const patientFiltered = useMemo(() => {
        const rows = data?.patient_list || [];
        const q = pq.toLowerCase();
        return rows.filter((r) =>
            (!q || [r.patient_name, r.hn, r.vn, r.chief_complaint, r.procedures].join(" ").toLowerCase().includes(q)) &&
            (!fStaff || r.staff_type === fStaff) &&
            (!fDoctor || r.doctor_name === fDoctor) &&
            (!fPttype || r.pttype_name === fPttype));
    }, [data, pq, fStaff, fDoctor, fPttype]);

    const patientDoctors = useMemo(() => [...new Set((data?.patient_list || []).map((r) => r.doctor_name))].sort(), [data]);
    const patientPttypes = useMemo(() => [...new Set((data?.patient_list || []).map((r) => r.pttype_name))].sort(), [data]);

    const exportCSV = () => {
        const rows = patientFiltered;
        if (!rows.length) return;
        const headers = ["วันที่", "เวลา", "HN", "VN", "ชื่อ-นามสกุล", "อายุ", "บุคลากร", "ประเภท", "สิทธิ์", "อาการสำคัญ", "หัตถการ", "รายได้"];
        const lines = [headers.join(",")];
        rows.forEach((r) => lines.push([r.vstdate, r.vsttime || "", r.hn, r.vn, `"${r.patient_name}"`, r.age ?? "", `"${r.doctor_name}"`, r.staff_type, `"${r.pttype_name}"`, `"${(r.chief_complaint || "").replace(/"/g, "'")}"`, `"${(r.procedures || "").replace(/"/g, "'")}"`, r.total_income].join(",")));
        const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `dental_patients_${data?.start}_${data?.end}.csv`;
        a.click();
    };

    // group patients by doctor (for table)
    const patientGroups = useMemo(() => {
        const docs = [...new Map(patientFiltered.map((r) => [r.doctor_name, { name: r.doctor_name, type: r.staff_type }])).values()]
            .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, "th") : a.type.localeCompare(b.type)));
        return docs.map((doc) => {
            const dRows = patientFiltered.filter((r) => r.doctor_name === doc.name);
            return { doc, dRows, dIncome: dRows.reduce((s, r) => s + r.total_income, 0), dPt: new Set(dRows.map((r) => r.hn)).size };
        });
    }, [patientFiltered]);

    const Badge = ({ t }: { t: StaffType }) => <span className={`staff-badge ${staffCls(t)}`}>{t}</span>;

    return (
        <div className="dental-dash">
            <style>{CSS}</style>

            <header className="dd-header">
                <div>
                    <h1>🦷 ระบบรายงานทันตกรรม</h1>
                    <div className="sub">รพ.พลับพลาชัย • รีเฟรชทุก 60 วินาที {data && `• อัปเดต ${new Date(data.updatedAt).toLocaleTimeString("th-TH")}`}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="clock">{clock}</div>
                    <button className="refresh-btn" onClick={load}>🔄 รีเฟรช</button>
                </div>
            </header>

            <div className="tabs">
                {TABS.map((t) => (
                    <button key={t.id} className={`tab-btn${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
                ))}
            </div>

            <div className="date-bar">
                <label>📅 ช่วงวันที่:</label>
                {([["today", "วันนี้"], ["7days", "7 วัน"], ["30days", "30 วัน"], ["thismonth", "เดือนนี้"], ["custom", "กำหนดเอง"]] as [Preset, string][]).map(([p, l]) => (
                    <button key={p} className={`preset-btn${preset === p ? " active" : ""}`} onClick={() => setPreset(p)}>{l}</button>
                ))}
                {preset === "custom" && (
                    <div className="date-inputs">
                        <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                        <span style={{ color: "#718096" }}>ถึง</span>
                        <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                        <button className="apply-btn" onClick={load}>ดู</button>
                    </div>
                )}
                <span className="date-label">{rangeLabel}</span>
            </div>

            {err && <div style={{ padding: "16px 24px" }}><div className="error-msg">❌ เชื่อมต่อ API ไม่ได้: {err}</div></div>}

            <div className="dd-body">
                {/* ── TODAY ── */}
                {tab === "today" && (
                    <>
                        <div className="kpi-grid">
                            <div className="kpi-card"><div className="label">ผู้ป่วยทั้งหมด</div><div className="value">{fmt(kpi.totalPatients)}</div><div className="sub-label">ราย | {rangeLabel}</div></div>
                            <div className="kpi-card dentist"><div className="label">ทันตแพทย์</div><div className="value" style={{ color: "#2980b9" }}>{fmt(kpi.dentistVisits)}</div><div className="sub-label">Visits</div></div>
                            <div className="kpi-card therapist"><div className="label">ทันตาภิบาล</div><div className="value" style={{ color: "#27ae60" }}>{fmt(kpi.therapistVisits)}</div><div className="sub-label">Visits</div></div>
                            <div className="kpi-card income"><div className="label">รายได้รวม</div><div className="value" style={{ color: "#e67e22", fontSize: "1.5rem" }}>{fmtB(kpi.totalIncome)}</div><div className="sub-label">บาท</div></div>
                        </div>
                        <div className="two-col">
                            <div className="card">
                                <div className="section-title">รายละเอียดแยกผู้ให้บริการ</div>
                                {loading ? <div className="loading">กำลังโหลด…</div> : (data?.summary.length ? (
                                    <table><thead><tr><th>ชื่อ</th><th>ประเภท</th><th>ผู้ป่วย (ราย)</th><th>Visits</th><th>รายได้ (บาท)</th></tr></thead>
                                        <tbody>{data.summary.map((r, i) => (
                                            <tr key={i}><td>{r.doctor_name}</td><td><Badge t={r.staff_type} /></td><td>{fmt(r.patient_count)}</td><td>{fmt(r.visit_count)}</td><td>{fmtB(r.total_income)}</td></tr>
                                        ))}</tbody></table>
                                ) : <div className="loading">ไม่พบข้อมูล</div>)}
                            </div>
                            <div className="card">
                                <div className="section-title">สัดส่วนผู้ป่วย</div>
                                <div className="chart-wrap"><canvas ref={chartRefs.pie} /></div>
                            </div>
                        </div>
                    </>
                )}

                {/* ── QUEUE ── */}
                {tab === "queue" && (
                    <div className="card">
                        <div className="section-title">คิวรอรับบริการ ณ ขณะนี้</div>
                        {data?.queue.length ? data.queue.map((r, i) => (
                            <div className={`queue-item ${staffCls(r.staff_type)}`} key={i}>
                                <div className="queue-no">{i + 1}</div>
                                <div className="queue-info">
                                    <div className="name">{r.patient_name}</div>
                                    <div className="detail">HN: {r.hn} | <Badge t={r.staff_type} /> {r.doctor_name}{r.chief_complaint ? ` | ${r.chief_complaint}` : ""}</div>
                                </div>
                                <div className="queue-time">{r.visit_time}</div>
                            </div>
                        )) : <div className="loading">ไม่มีคิวรอขณะนี้</div>}
                    </div>
                )}

                {/* ── PROCEDURE ── */}
                {tab === "procedure" && (
                    <div className="two-col">
                        {STAFF_TYPES.map((st) => (
                            <div className="card" key={st}>
                                <div className="section-title"><Badge t={st} /> หัตถการ</div>
                                {(() => {
                                    const rows = (data?.procedures || []).filter((r) => r.staff_type === st); return rows.length ? (
                                        <table><thead><tr><th>ผู้ให้บริการ</th><th>รหัส (ICD-9)</th><th>หัตถการ</th><th>จำนวน</th></tr></thead>
                                            <tbody>{rows.map((r, i) => (<tr key={i}><td>{r.doctor_name}</td><td>{r.procedure_code}</td><td>{r.procedure_name}</td><td>{fmt(r.count)}</td></tr>))}</tbody></table>
                                    ) : <div className="loading">ไม่พบข้อมูล</div>;
                                })()}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── PTTYPE ── */}
                {tab === "pttype" && (
                    <div className="two-col">
                        {STAFF_TYPES.map((st) => (
                            <div className="card" key={st}>
                                <div className="section-title"><Badge t={st} /> สิทธิการรักษา</div>
                                {(() => {
                                    const rows = (data?.pttype || []).filter((r) => r.staff_type === st); return rows.length ? (
                                        <table><thead><tr><th>ผู้ให้บริการ</th><th>สิทธิ</th><th>จำนวน</th></tr></thead>
                                            <tbody>{rows.map((r, i) => (<tr key={i}><td>{r.doctor_name}</td><td>{r.pttype_name}</td><td>{fmt(r.count)}</td></tr>))}</tbody></table>
                                    ) : <div className="loading">ไม่พบข้อมูล</div>;
                                })()}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── TREND ── */}
                {tab === "trend" && (
                    <>
                        <div className="card" style={{ marginBottom: 20 }}>
                            <div className="section-title">จำนวนผู้ป่วย {rangeLabel}</div>
                            <div className="chart-wrap" style={{ height: 300 }}><canvas ref={chartRefs.trendPt} /></div>
                        </div>
                        <div className="card" style={{ marginBottom: 20 }}>
                            <div className="section-title">รายได้ {rangeLabel} (บาท)</div>
                            <div className="chart-wrap" style={{ height: 300 }}><canvas ref={chartRefs.trendInc} /></div>
                        </div>
                        <div className="card">
                            <div className="section-title">ตารางสรุปรายวัน</div>
                            {(() => {
                                const rows = data?.daily_trend || [];
                                const dates = [...new Set(rows.map((r) => r.vstdate))].sort().reverse();
                                if (!dates.length) return <div className="loading">ไม่พบข้อมูล</div>;
                                return (
                                    <table><thead><tr><th>วันที่</th><th>ผู้ป่วย (ทพ.)</th><th>ผู้ป่วย (ทภ.)</th><th>รวมผู้ป่วย</th><th>รายได้ ทพ.</th><th>รายได้ ทภ.</th><th>รวมรายได้</th></tr></thead>
                                        <tbody>{dates.map((d) => {
                                            const den = rows.find((x) => x.vstdate === d && x.staff_type === "ทันตแพทย์");
                                            const the = rows.find((x) => x.vstdate === d && x.staff_type === "ทันตาภิบาล");
                                            const tp = (den?.patient_count || 0) + (the?.patient_count || 0);
                                            const ti = (den?.total_income || 0) + (the?.total_income || 0);
                                            return (<tr key={d}><td>{d}</td><td>{fmt(den?.patient_count || 0)}</td><td>{fmt(the?.patient_count || 0)}</td><td><strong>{fmt(tp)}</strong></td><td>{fmtB(den?.total_income || 0)}</td><td>{fmtB(the?.total_income || 0)}</td><td><strong>{fmtB(ti)}</strong></td></tr>);
                                        })}</tbody></table>
                                );
                            })()}
                        </div>
                    </>
                )}

                {/* ── SHIFT ── */}
                {tab === "shift" && (() => {
                    const rows = data?.shift_report || [];
                    const shifts = SHIFT_ORDER.filter((s) => rows.some((r) => r.shift_code === s));
                    return (
                        <>
                            <div className="kpi-grid" style={{ marginBottom: 20 }}>
                                {shifts.map((sh) => {
                                    const shRows = rows.filter((r) => r.shift_code === sh);
                                    const pt = shRows.reduce((a, r) => a + r.patient_count, 0);
                                    const inc = shRows.reduce((a, r) => a + r.total_income, 0);
                                    const m = SHIFT_META[sh];
                                    return <div className="kpi-card" key={sh} style={{ borderLeftColor: m.color }}><div className="label">{m.icon} {m.label}</div><div className="value" style={{ color: m.color, fontSize: "1.6rem" }}>{fmt(pt)}</div><div className="sub-label">ราย | รายได้ {fmtB(inc)} บาท</div></div>;
                                })}
                            </div>
                            <div className="two-col" style={{ marginBottom: 20 }}>
                                <div className="card"><div className="section-title">ผู้ป่วยแยกเวร (ราย)</div><div className="chart-wrap"><canvas ref={chartRefs.shiftPt} /></div></div>
                                <div className="card"><div className="section-title">รายได้แยกเวร (บาท)</div><div className="chart-wrap"><canvas ref={chartRefs.shiftInc} /></div></div>
                            </div>
                            <div className="card" style={{ marginBottom: 20 }}>
                                <div className="section-title">ตารางสรุปแยกเวร × ประเภทบุคลากร</div>
                                <table><thead><tr><th>เวร</th><th>บุคลากร</th><th>ผู้ป่วย (ราย)</th><th>Visits</th><th>รายได้ (บาท)</th></tr></thead>
                                    <tbody>{shifts.flatMap((sh) => STAFF_TYPES.map((st) => {
                                        const sub = rows.filter((r) => r.shift_code === sh && r.staff_type === st);
                                        const m = SHIFT_META[sh];
                                        return (<tr key={sh + st}><td><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: m.color, display: "inline-block" }} />{m.icon} {m.label}</span></td><td><Badge t={st} /></td><td>{fmt(sub.reduce((a, r) => a + r.patient_count, 0))}</td><td>{fmt(sub.reduce((a, r) => a + r.visit_count, 0))}</td><td>{fmtB(sub.reduce((a, r) => a + r.total_income, 0))}</td></tr>);
                                    }))}</tbody></table>
                            </div>
                            {shifts.map((sh) => {
                                const shRows = rows.filter((r) => r.shift_code === sh);
                                const ptMap = new Map<string, { staff_type: StaffType; pttype_name: string; patient_count: number; total_income: number }>();
                                shRows.forEach((r) => { const k = `${r.staff_type}|${r.pttype_name}`; if (!ptMap.has(k)) ptMap.set(k, { staff_type: r.staff_type, pttype_name: r.pttype_name, patient_count: 0, total_income: 0 }); const o = ptMap.get(k)!; o.patient_count += r.patient_count; o.total_income += r.total_income; });
                                const ptRows = [...ptMap.values()].sort((a, b) => b.patient_count - a.patient_count);
                                const m = SHIFT_META[sh];
                                return (
                                    <div className="card" key={sh} style={{ marginBottom: 16, borderTop: `4px solid ${m.color}` }}>
                                        <div className="section-title">{m.icon} {m.label} — สิทธิ์การรักษา</div>
                                        <table><thead><tr><th>บุคลากร</th><th>สิทธิ์</th><th>ผู้ป่วย (ราย)</th><th>รายได้ (บาท)</th></tr></thead>
                                            <tbody>{ptRows.map((r, i) => (<tr key={i}><td><Badge t={r.staff_type} /></td><td>{r.pttype_name}</td><td>{fmt(r.patient_count)}</td><td>{fmtB(r.total_income)}</td></tr>))}</tbody></table>
                                    </div>
                                );
                            })}
                        </>
                    );
                })()}

                {/* ── INCOME ── */}
                {tab === "income" && (() => {
                    const { doctors, pttypes, getV, grandPt, grand, maxPerDoctor } = incomeDerived;
                    const valueLabel = incomeMode === "income" ? "รายได้ (บาท)" : incomeMode === "patient" ? "ผู้ป่วย (ราย)" : "Visits";
                    const fmtVal = (v: number) => (incomeMode === "income" ? fmtB(v) : fmt(v));
                    const sortedPt = pttypes.slice().sort((a, b) => grandPt[b] - grandPt[a]);
                    return (
                        <>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 700, fontSize: ".9rem" }}>แสดงค่า:</span>
                                {([["income", "💵 รายได้ (บาท)"], ["patient", "👤 จำนวนผู้ป่วย (ราย)"], ["visit", "📋 Visits"]] as [typeof incomeMode, string][]).map(([m, l]) => (
                                    <button key={m} className={`preset-btn${incomeMode === m ? " active" : ""}`} onClick={() => setIncomeMode(m)}>{l}</button>
                                ))}
                            </div>
                            <div className="card" style={{ overflowX: "auto", marginBottom: 20 }}>
                                <div className="section-title">ตาราง: แพทย์ × สิทธิ์การรักษา</div>
                                <table className="pivot-table"><thead><tr><th className="row-header">แพทย์ / ทันตาภิบาล</th>{pttypes.map((pt) => <th key={pt}>{pt}</th>)}<th className="total-col">รวม</th></tr></thead>
                                    <tbody>{doctors.map((d) => {
                                        let rowTotal = 0; pttypes.forEach((pt) => (rowTotal += getV(d.name, pt)));
                                        return (<tr key={d.name}><td className="row-label"><span className={d.type === "ทันตแพทย์" ? "type-dentist" : "type-therapist"}><Badge t={d.type} /></span> {d.name}</td>
                                            {pttypes.map((pt) => { const v = getV(d.name, pt); const pct = maxPerDoctor > 0 ? (v / maxPerDoctor * 100).toFixed(0) : "0"; return (<td key={pt}><div className="pivot-cell-bar"><span>{fmtVal(v)}</span><div className="bar-bg"><div className="bar-fill" style={{ width: `${pct}%` }} /></div></div></td>); })}
                                            <td className="total-col">{fmtVal(rowTotal)}</td></tr>);
                                    })}</tbody>
                                    <tfoot><tr className="total-row"><td className="row-label">รวมทั้งหมด</td>{pttypes.map((pt) => <td key={pt}>{fmtVal(grandPt[pt])}</td>)}<td className="total-col">{fmtVal(grand)}</td></tr></tfoot>
                                </table>
                            </div>
                            <div className="card" style={{ marginBottom: 20 }}>
                                <div className="section-title">{valueLabel} แยกสิทธิ์ แต่ละแพทย์</div>
                                <div className="chart-wrap" style={{ height: 320 }}><canvas ref={chartRefs.incDoc} /></div>
                            </div>
                            <div className="two-col">
                                <div className="card"><div className="section-title">สัดส่วนสิทธิ์รวมทั้งหมด</div><div className="chart-wrap" style={{ height: 260 }}><canvas ref={chartRefs.incPie} /></div></div>
                                <div className="card">
                                    <div className="section-title">Top {valueLabel} ตามสิทธิ์</div>
                                    {sortedPt.map((pt, i) => {
                                        const pct = grand > 0 ? (grandPt[pt] / grand * 100).toFixed(1) : "0";
                                        const col = PTTYPE_COLORS[pttypes.indexOf(pt) % PTTYPE_COLORS.length];
                                        return (<div key={pt} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f0f4f8" }}>
                                            <span style={{ width: 28, height: 28, borderRadius: "50%", background: col, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: ".78rem", fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                                            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: ".88rem" }}>{pt}</div><div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, marginTop: 4, overflow: "hidden" }}><div style={{ height: "100%", background: col, width: `${pct}%`, borderRadius: 3 }} /></div></div>
                                            <div style={{ textAlign: "right" }}><div style={{ fontWeight: 700, fontSize: ".9rem", color: col }}>{fmtVal(grandPt[pt])}</div><div style={{ fontSize: ".75rem", color: "#a0aec0" }}>{pct}%</div></div>
                                        </div>);
                                    })}
                                </div>
                            </div>
                        </>
                    );
                })()}

                {/* ── PATIENTS ── */}
                {tab === "patients" && (
                    <div className="card">
                        <div className="pt-filter-bar">
                            <input type="text" placeholder="🔍 ค้นหา ชื่อ / HN / VN" value={pq} onChange={(e) => setPq(e.target.value)} />
                            <select value={fStaff} onChange={(e) => setFStaff(e.target.value)}><option value="">— ทุกประเภทบุคลากร —</option><option>ทันตแพทย์</option><option>ทันตาภิบาล</option></select>
                            <select value={fDoctor} onChange={(e) => setFDoctor(e.target.value)}><option value="">— ทุกเจ้าหน้าที่ —</option>{patientDoctors.map((d) => <option key={d}>{d}</option>)}</select>
                            <select value={fPttype} onChange={(e) => setFPttype(e.target.value)}><option value="">— ทุกสิทธิ์ —</option>{patientPttypes.map((p) => <option key={p}>{p}</option>)}</select>
                            <button className="preset-btn" onClick={exportCSV} style={{ marginLeft: "auto" }}>⬇️ Export CSV</button>
                        </div>
                        <div className="pt-stats">
                            <div className="pt-stat">👤 ผู้ป่วย <strong>{fmt(new Set(patientFiltered.map((r) => r.hn)).size)}</strong> ราย</div>
                            <div className="pt-stat">📋 Visits <strong>{fmt(patientFiltered.length)}</strong> ครั้ง</div>
                            <div className="pt-stat">💵 รายได้รวม <strong>{fmtB(patientFiltered.reduce((s, r) => s + r.total_income, 0))}</strong> บาท</div>
                        </div>
                        <div className="patient-table-wrap">
                            {patientFiltered.length ? patientGroups.map(({ doc, dRows, dIncome, dPt }) => (
                                <div key={doc.name}>
                                    <div className={`doctor-group-header${doc.type === "ทันตาภิบาล" ? " therapist" : ""}`}>
                                        <span><Badge t={doc.type} /> {doc.name}</span>
                                        <span className="grp-stat">ผู้ป่วย {fmt(dPt)} ราย | {fmt(dRows.length)} visits | รายได้ {fmtB(dIncome)} บาท</span>
                                    </div>
                                    <table><thead><tr><th>วันที่</th><th>เวลา</th><th>HN</th><th>VN</th><th>ชื่อ-นามสกุล</th><th>อายุ</th><th>สิทธิ์</th><th>อาการสำคัญ</th><th>หัตถการ (ICD-9)</th><th>รายได้ (บาท)</th></tr></thead>
                                        <tbody>{dRows.map((r, i) => (
                                            <tr key={i}><td>{r.vstdate}</td><td>{r.vsttime || "-"}</td><td>{r.hn}</td><td style={{ fontSize: ".75rem", color: "#718096" }}>{r.vn}</td><td style={{ fontWeight: 600 }}>{r.patient_name}</td><td style={{ textAlign: "center" }}>{r.age ?? "-"}</td><td><span className="staff-badge" style={{ background: "#ebf5fb", color: "#1a5276" }}>{r.pttype_name}</span></td><td>{r.chief_complaint || "-"}</td><td className="proc-cell">{r.procedures || "-"}</td><td className="income-cell" style={{ textAlign: "right" }}>{fmtB(r.total_income)}</td></tr>
                                        ))}</tbody>
                                        <tfoot><tr style={{ background: "#f7fafc", fontWeight: 700 }}><td colSpan={9} style={{ textAlign: "right", padding: "7px 12px", fontSize: ".82rem", color: "#4a5568" }}>รวม {doc.name}</td><td className="income-cell" style={{ textAlign: "right" }}>{fmtB(dIncome)}</td></tr></tfoot>
                                    </table>
                                </div>
                            )) : <div className="loading">ไม่พบข้อมูล</div>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Scoped CSS (พอร์ตจาก dental_dashboard.html, prefix .dental-dash) ──
const CSS = `
.dental-dash{color:#2d3748;font-size:14px}
.dental-dash *{box-sizing:border-box}
.dental-dash .dd-header{background:linear-gradient(135deg,#1a5276 0%,#2980b9 100%);color:#fff;padding:16px 24px;display:flex;justify-content:space-between;align-items:center;border-radius:10px}
.dental-dash .dd-header h1{font-size:1.3rem;font-weight:700}
.dental-dash .dd-header .sub{font-size:.85rem;opacity:.85;margin-top:2px}
.dental-dash .clock{font-size:1.1rem;font-weight:600;letter-spacing:1px}
.dental-dash .refresh-btn{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:.85rem}
.dental-dash .refresh-btn:hover{background:rgba(255,255,255,.35)}
.dental-dash .tabs{display:flex;background:#fff;border-bottom:2px solid #e2e8f0;padding:0 12px;margin-top:12px;border-radius:10px 10px 0 0;overflow-x:auto}
.dental-dash .tab-btn{padding:12px 16px;cursor:pointer;font-size:.9rem;font-weight:600;border:none;background:none;color:#718096;border-bottom:3px solid transparent;margin-bottom:-2px;white-space:nowrap}
.dental-dash .tab-btn.active{color:#2980b9;border-bottom-color:#2980b9}
.dental-dash .tab-btn:hover{color:#2980b9}
.dental-dash .date-bar{background:#fff;padding:10px 24px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dental-dash .date-bar label{font-size:.82rem;font-weight:600;color:#4a5568;white-space:nowrap}
.dental-dash .preset-btn{padding:5px 12px;border-radius:20px;border:1px solid #cbd5e0;background:#fff;font-size:.82rem;cursor:pointer;color:#4a5568}
.dental-dash .preset-btn:hover{background:#ebf5fb;border-color:#2980b9;color:#2980b9}
.dental-dash .preset-btn.active{background:#2980b9;border-color:#2980b9;color:#fff;font-weight:600}
.dental-dash .date-inputs{display:flex;align-items:center;gap:6px}
.dental-dash .date-inputs input[type=date]{border:1px solid #cbd5e0;border-radius:6px;padding:4px 8px;font-size:.82rem;color:#2d3748}
.dental-dash .apply-btn{background:#2980b9;color:#fff;border:none;border-radius:6px;padding:5px 14px;font-size:.82rem;font-weight:600;cursor:pointer}
.dental-dash .date-label{margin-left:auto;font-size:.8rem;color:#718096;white-space:nowrap}
.dental-dash .dd-body{padding:20px 24px}
.dental-dash .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}
.dental-dash .kpi-card{background:#fff;border-radius:12px;padding:18px 20px;box-shadow:0 1px 6px rgba(0,0,0,.08);border-left:5px solid #ccc}
.dental-dash .kpi-card.dentist{border-left-color:#2980b9}.dental-dash .kpi-card.therapist{border-left-color:#27ae60}.dental-dash .kpi-card.income{border-left-color:#e67e22}
.dental-dash .kpi-card .label{font-size:.78rem;color:#718096;text-transform:uppercase;letter-spacing:.5px}
.dental-dash .kpi-card .value{font-size:2rem;font-weight:700;margin:4px 0}
.dental-dash .kpi-card .sub-label{font-size:.8rem;color:#a0aec0}
.dental-dash .section-title{font-size:1rem;font-weight:700;color:#2d3748;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.dental-dash .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:.75rem;font-weight:600;color:#fff}
.dental-dash .two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
@media(max-width:900px){.dental-dash .two-col{grid-template-columns:1fr}}
.dental-dash .card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 6px rgba(0,0,0,.08)}
.dental-dash table{width:100%;border-collapse:collapse;font-size:.88rem}
.dental-dash th{background:#edf2f7;padding:9px 12px;text-align:left;font-weight:600;font-size:.8rem;color:#4a5568}
.dental-dash td{padding:8px 12px;border-bottom:1px solid #f0f4f8}
.dental-dash tr:last-child td{border-bottom:none}
.dental-dash tbody tr:hover td{background:#f7fafc}
.dental-dash .staff-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.75rem;font-weight:600}
.dental-dash .staff-badge.dentist,.dental-dash .badge.dentist{background:#ebf5fb;color:#1a5276}
.dental-dash .badge.dentist{background:#2980b9;color:#fff}
.dental-dash .staff-badge.therapist{background:#eafaf1;color:#145a32}
.dental-dash .badge.therapist{background:#27ae60;color:#fff}
.dental-dash .staff-badge.other{background:#f4ecf7;color:#6c3483}
.dental-dash .pt-filter-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.dental-dash .pt-filter-bar select,.dental-dash .pt-filter-bar input[type=text]{border:1px solid #cbd5e0;border-radius:6px;padding:5px 10px;font-size:.83rem;color:#2d3748;background:#fff}
.dental-dash .pt-filter-bar input[type=text]{min-width:200px}
.dental-dash .pt-stats{display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap}
.dental-dash .pt-stat{background:#edf2f7;border-radius:8px;padding:6px 14px;font-size:.82rem}
.dental-dash .pt-stat strong{color:#2980b9}
.dental-dash .patient-table-wrap{overflow-x:auto}
.dental-dash .patient-table-wrap table{font-size:.82rem}
.dental-dash .patient-table-wrap td{max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dental-dash .patient-table-wrap td.proc-cell{max-width:300px;white-space:normal;font-size:.78rem;color:#4a5568;line-height:1.4}
.dental-dash .doctor-group-header{background:linear-gradient(135deg,#1a5276,#2980b9);color:#fff;padding:8px 14px;font-weight:700;font-size:.88rem;border-radius:6px;margin:14px 0 4px;display:flex;justify-content:space-between;align-items:center}
.dental-dash .doctor-group-header .grp-stat{font-size:.78rem;opacity:.85;font-weight:400}
.dental-dash .doctor-group-header.therapist{background:linear-gradient(135deg,#145a32,#27ae60)}
.dental-dash .income-cell{font-weight:600;color:#1a5276}
.dental-dash .pivot-table{width:100%;border-collapse:collapse;font-size:.85rem;white-space:nowrap}
.dental-dash .pivot-table th{background:#edf2f7;padding:8px 12px;text-align:center;font-size:.78rem;color:#4a5568;border:1px solid #e2e8f0}
.dental-dash .pivot-table th.row-header{text-align:left;min-width:160px}
.dental-dash .pivot-table td{padding:7px 12px;border:1px solid #f0f4f8;text-align:right}
.dental-dash .pivot-table td.row-label{text-align:left;font-weight:600;background:#f7fafc}
.dental-dash .pivot-table td.total-col{background:#ebf5fb;font-weight:700;color:#1a5276}
.dental-dash .pivot-table tr.total-row td{background:#fef9e7;font-weight:700;border-top:2px solid #f0d060}
.dental-dash .pivot-cell-bar{display:flex;flex-direction:column;gap:2px}
.dental-dash .pivot-cell-bar .bar-bg{height:4px;background:#e2e8f0;border-radius:2px;overflow:hidden}
.dental-dash .pivot-cell-bar .bar-fill{height:100%;border-radius:2px;background:#2980b9}
.dental-dash .type-dentist{color:#1a5276}.dental-dash .type-therapist{color:#145a32}
.dental-dash .queue-item{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;background:#f7fafc;margin-bottom:8px;border-left:4px solid #ccc}
.dental-dash .queue-item.dentist{border-left-color:#2980b9}.dental-dash .queue-item.therapist{border-left-color:#27ae60}
.dental-dash .queue-no{font-size:1.3rem;font-weight:700;min-width:36px;color:#718096}
.dental-dash .queue-info .name{font-weight:600;font-size:.92rem}
.dental-dash .queue-info .detail{font-size:.78rem;color:#718096;margin-top:2px}
.dental-dash .queue-time{margin-left:auto;font-size:.85rem;color:#a0aec0}
.dental-dash .chart-wrap{position:relative;height:260px}
.dental-dash .loading{text-align:center;color:#a0aec0;padding:40px;font-size:.9rem}
.dental-dash .error-msg{color:#e53e3e;background:#fff5f5;padding:14px;border-radius:8px;font-size:.88rem;border-left:4px solid #e53e3e}
`;