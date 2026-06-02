"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

// ─── Types (ตรงกับ lib/ttm.service.ts) ────────────────────────────────────────
interface Shift {
    visit_count: number;
    revenue: number;
}
interface DoctorSummary {
    doctor_id: string;
    doctor_name: string;
    patient_count: number;
    visit_count: number;
    revenue: number;
    shifts: Record<string, Shift>;
}
interface RightRow {
    doctor_id: string;
    doctor_name: string;
    right_code: string;
    right_name: string;
    visit_count: number;
    revenue: number;
}
interface IcdRow {
    icd10_code: string;
    icd10_name: string;
    use_count: number;
}
interface QueueRow {
    queue_no: string;
    hn: string;
    patient_name: string;
    doctor_name: string;
    right_name: string;
    vsttime: string;
    status: string;
}
interface PatientRow {
    vstdate: string;
    vsttime: string;
    vn: string;
    hn: string;
    patient_name: string;
    doctor_id: string;
    doctor_name: string;
    right_code: string;
    right_name: string;
    icd10: string;
    icd10_name: string;
    revenue: number;
}
interface DashData {
    summary: { doctors: DoctorSummary[] };
    rights: { rows: RightRow[] };
    icd10: { rows: IcdRow[] };
    queue: { queue: QueueRow[] };
    patients: { rows: PatientRow[] };
}

type Preset = "today" | "7days" | "30days" | "thismonth" | "custom";
type Mode = "revenue" | "visits" | "patients";
type PivotMode = "revenue" | "visits" | "patients";
type ShiftKey = "am" | "pm" | "ot";

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
    Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 });
const fmtB = (n: number) =>
    Number(n || 0).toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
const rightClass = (code: string) =>
    ({ UC: "r-uc", GOV: "r-gov", SSO: "r-sso", SELF: "r-self" }[code] ?? "r-other");

function getShift(vsttime: string): ShiftKey {
    const [h, m] = (vsttime || "00:00").split(":").map(Number);
    const mins = (h || 0) * 60 + (m || 0);
    if (mins >= 8 * 60 + 30 && mins < 16 * 60 + 30) return "am";
    if (mins >= 16 * 60 + 30 && mins < 20 * 60 + 30) return "pm";
    return "ot";
}
const shiftLabel: Record<ShiftKey, string> = { am: "เช้า", pm: "เย็น", ot: "นอกเวลา" };

const PRESET_LABEL: Record<Preset, string> = {
    today: "วันนี้",
    "7days": "7 วันล่าสุด",
    "30days": "30 วันล่าสุด",
    thismonth: "เดือนนี้",
    custom: "กำหนดเอง",
};

const DOC_COLORS = ["doc-0", "doc-1", "doc-2", "doc-3"];

// ─── Component ────────────────────────────────────────────────────────────────
export default function TtmDashboardPage() {
    const [data, setData] = useState<DashData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [preset, setPreset] = useState<Preset>("today");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [mode, setMode] = useState<Mode>("revenue");
    const [pivotMode, setPivotMode] = useState<PivotMode>("revenue");
    const [lastUpdate, setLastUpdate] = useState("—");
    const [countdown, setCountdown] = useState(60);

    // patient list controls
    const [ptSearch, setPtSearch] = useState("");
    const [ptDoctor, setPtDoctor] = useState("");
    const [ptRight, setPtRight] = useState("");
    const [ptShift, setPtShift] = useState("");
    const [ptSortKey, setPtSortKey] = useState<string>("vstdate");
    const [ptSortAsc, setPtSortAsc] = useState(true);

    const barRef = useRef<HTMLCanvasElement>(null);
    const pieRef = useRef<HTMLCanvasElement>(null);
    const barChart = useRef<Chart | null>(null);
    const pieChart = useRef<Chart | null>(null);

    const docColorMap = useRef<Record<string, string>>({});
    const getDocColor = (name: string) => {
        if (!docColorMap.current[name]) {
            const idx = Object.keys(docColorMap.current).length % DOC_COLORS.length;
            docColorMap.current[name] = DOC_COLORS[idx];
        }
        return docColorMap.current[name];
    };

    // ── fetch ──
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (preset === "custom") {
                if (!customStart || !customEnd) {
                    setLoading(false);
                    return;
                }
                params.set("start", customStart);
                params.set("end", customEnd);
            } else {
                params.set("preset", preset);
            }
            const res = await fetch(`/api/ttm-dashboard?${params}`, {
                credentials: "include",
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = (await res.json()) as DashData;
            setData(json);
            setLastUpdate(new Date().toLocaleTimeString("th-TH"));
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
            setCountdown(60);
        }
    }, [preset, customStart, customEnd]);

    useEffect(() => {
        if (preset !== "custom") fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preset]);

    // ── auto refresh 60s ──
    useEffect(() => {
        const t = setInterval(() => {
            setCountdown((s) => {
                if (s <= 1) {
                    fetchData();
                    return 60;
                }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [fetchData]);

    const doctors = data?.summary.doctors ?? [];
    const rightRows = data?.rights.rows ?? [];
    const icdRows = data?.icd10.rows ?? [];
    const queueRows = data?.queue.queue ?? [];
    const allPatients = data?.patients.rows ?? [];

    // ── KPI ──
    const kpi = useMemo(() => {
        let tp = 0,
            tv = 0,
            tr = 0;
        doctors.forEach((d) => {
            tp += d.patient_count;
            tv += d.visit_count;
            tr += d.revenue;
        });
        return {
            patients: tp,
            visits: tv,
            revenue: tr,
            avg: tv > 0 ? tr / tv : 0,
            queue: queueRows.length,
        };
    }, [doctors, queueRows]);

    // ── charts ──
    useEffect(() => {
        if (!barRef.current) return;
        const labels = doctors.map((d) => d.doctor_name.split(" ").slice(-1)[0]);
        const values = doctors.map((d) =>
            mode === "revenue" ? d.revenue : mode === "visits" ? d.visit_count : d.patient_count,
        );
        const barLabel =
            mode === "revenue" ? "รายได้ (บาท)" : mode === "visits" ? "Visits" : "ผู้ป่วย";
        const colors = ["#2e7d32", "#1565c0", "#6a1b9a", "#e65100", "#00695c"];
        barChart.current?.destroy();
        barChart.current = new Chart(barRef.current, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: barLabel,
                        data: values,
                        backgroundColor: colors.slice(0, Math.max(1, doctors.length)),
                        borderRadius: 6,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } },
            },
        });
    }, [doctors, mode]);

    useEffect(() => {
        if (!pieRef.current) return;
        const rightAgg: Record<string, number> = {};
        rightRows.forEach((r) => {
            rightAgg[r.right_name] =
                (rightAgg[r.right_name] || 0) +
                (mode === "revenue" ? r.revenue : r.visit_count);
        });
        const rColors = ["#1565c0", "#880e4f", "#e65100", "#4a148c", "#2e7d32", "#00695c"];
        pieChart.current?.destroy();
        pieChart.current = new Chart(pieRef.current, {
            type: "doughnut",
            data: {
                labels: Object.keys(rightAgg),
                datasets: [
                    {
                        data: Object.values(rightAgg),
                        backgroundColor: rColors.slice(0, Object.keys(rightAgg).length),
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom", labels: { font: { size: 11 } } } },
            },
        });
    }, [rightRows, mode]);

    useEffect(
        () => () => {
            barChart.current?.destroy();
            pieChart.current?.destroy();
        },
        [],
    );

    // ── pivot ──
    const pivot = useMemo(() => {
        const docs = [...new Set(rightRows.map((r) => r.doctor_name))];
        const rights = [...new Set(rightRows.map((r) => r.right_name))];
        const lookup: Record<string, number> = {};
        rightRows.forEach((r) => {
            const v = pivotMode === "revenue" ? r.revenue : r.visit_count;
            // โหมด "ผู้ป่วย" ใช้ค่าจาก visit_count เป็น proxy (ไม่มี unique HN ต่อสิทธิ์)
            lookup[`${r.doctor_name}__${r.right_name}`] =
                (lookup[`${r.doctor_name}__${r.right_name}`] || 0) + v;
        });
        return { docs, rights, lookup };
    }, [rightRows, pivotMode]);

    // ── icd10 max ──
    const icdMax = Math.max(...icdRows.map((r) => r.use_count), 1);

    // ── patient filter + sort ──
    const ptDoctors = useMemo(
        () => [...new Set(allPatients.map((r) => r.doctor_name))].sort(),
        [allPatients],
    );
    const ptRights = useMemo(
        () => [...new Set(allPatients.map((r) => r.right_name))].sort(),
        [allPatients],
    );

    const filteredPatients = useMemo(() => {
        const q = ptSearch.toLowerCase().trim();
        let rows = allPatients.filter((r) => {
            if (ptDoctor && r.doctor_name !== ptDoctor) return false;
            if (ptRight && r.right_name !== ptRight) return false;
            if (ptShift && getShift(r.vsttime) !== ptShift) return false;
            if (q) {
                const hay = `${r.hn} ${r.patient_name} ${r.icd10} ${r.icd10_name}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
        rows = rows.slice().sort((a, b) => {
            let va: string | number = (a as never)[ptSortKey] ?? "";
            let vb: string | number = (b as never)[ptSortKey] ?? "";
            if (ptSortKey === "revenue") {
                va = Number(va);
                vb = Number(vb);
            }
            if (ptSortKey === "shift") {
                va = getShift(a.vsttime);
                vb = getShift(b.vsttime);
            }
            if (va < vb) return ptSortAsc ? -1 : 1;
            if (va > vb) return ptSortAsc ? 1 : -1;
            return 0;
        });
        return rows;
    }, [allPatients, ptSearch, ptDoctor, ptRight, ptShift, ptSortKey, ptSortAsc]);

    const totalRev = filteredPatients.reduce((s, r) => s + Number(r.revenue || 0), 0);

    const sortPt = (key: string) => {
        if (ptSortKey === key) setPtSortAsc((p) => !p);
        else {
            setPtSortKey(key);
            setPtSortAsc(true);
        }
    };
    const sortIcon = (key: string) =>
        ptSortKey === key ? (ptSortAsc ? "↑" : "↓") : "↕";

    const periodLabel =
        preset === "custom" ? `${customStart} – ${customEnd}` : PRESET_LABEL[preset];

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="ttm-dash">
            <style>{CSS}</style>

            {/* Header */}
            <div className="dash-header">
                <h1>🌿 Dashboard แพทย์แผนไทย – HOS XP</h1>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    {loading && <span className="spinner" />}
                    <span className="refresh-countdown">
                        รีเฟรชใน <b>{countdown}</b> วิ
                    </span>
                    <span className="last-update">อัปเดต: {lastUpdate}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="controls">
                <label>ช่วงวันที่:</label>
                <div className="btn-group">
                    {(["today", "7days", "30days", "thismonth", "custom"] as Preset[]).map((p) => (
                        <button
                            key={p}
                            className={`btn ${preset === p ? "active" : ""}`}
                            onClick={() => setPreset(p)}
                        >
                            {PRESET_LABEL[p]}
                        </button>
                    ))}
                </div>
                {preset === "custom" && (
                    <div className="custom-range">
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                        />{" "}
                        ถึง{" "}
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                        />
                        <button className="btn" onClick={fetchData}>
                            ดู
                        </button>
                    </div>
                )}

                <label style={{ marginLeft: 12 }}>แสดงค่า:</label>
                <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                    <option value="revenue">รายได้ (บาท)</option>
                    <option value="visits">จำนวน Visits</option>
                    <option value="patients">จำนวนผู้ป่วย</option>
                </select>
            </div>

            <div className="main">
                {error && (
                    <div className="error">
                        ❌ ไม่สามารถโหลดข้อมูล: {error} — ตรวจสอบการเชื่อมต่อฐานข้อมูล/สิทธิ์การเข้าถึง
                    </div>
                )}

                {/* KPI */}
                <div className="kpi-grid">
                    <div className="kpi-card">
                        <div className="kpi-label">ผู้ป่วยทั้งหมด</div>
                        <div className="kpi-value">{fmt(kpi.patients)}</div>
                        <div className="kpi-sub">unique HN</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Visits ทั้งหมด</div>
                        <div className="kpi-value">{fmt(kpi.visits)}</div>
                        <div className="kpi-sub">ครั้ง</div>
                    </div>
                    <div className="kpi-card accent">
                        <div className="kpi-label">รายได้รวม</div>
                        <div className="kpi-value">{fmtB(kpi.revenue)}</div>
                        <div className="kpi-sub">บาท</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">รายได้เฉลี่ย/Visit</div>
                        <div className="kpi-value">{kpi.visits > 0 ? fmtB(kpi.avg) : "—"}</div>
                        <div className="kpi-sub">บาท/ครั้ง</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">คิวรอ ณ ขณะนี้</div>
                        <div className="kpi-value">{fmt(kpi.queue)}</div>
                        <div className="kpi-sub">ราย</div>
                    </div>
                </div>

                {/* Doctor cards */}
                <div className="section">
                    <h2>
                        👨‍⚕️ สรุปรายแพทย์แผนไทย <span className="badge">{periodLabel}</span>
                    </h2>
                    <div className="doctor-cards">
                        {doctors.length === 0 ? (
                            <div className="empty">ไม่มีข้อมูล</div>
                        ) : (
                            doctors.map((d) => (
                                <div className="doc-card" key={d.doctor_id}>
                                    <div className="doc-name">👤 {d.doctor_name}</div>
                                    <div className="doc-stats">
                                        <div>
                                            <div className="stat-val">{fmt(d.patient_count)}</div>
                                            <div className="stat-lbl">ผู้ป่วย</div>
                                        </div>
                                        <div>
                                            <div className="stat-val">{fmt(d.visit_count)}</div>
                                            <div className="stat-lbl">Visits</div>
                                        </div>
                                        <div>
                                            <div className="stat-val">{fmtB(d.revenue)}</div>
                                            <div className="stat-lbl">บาท</div>
                                        </div>
                                    </div>
                                    <div className="shift-list">
                                        {Object.entries(d.shifts).map(([name, s]) => {
                                            const cls = name.includes("เช้า")
                                                ? "am"
                                                : name.includes("เย็น")
                                                    ? "pm"
                                                    : "we";
                                            return (
                                                <div className={`shift-row ${cls}`} key={name}>
                                                    <span>{name}</span>
                                                    <span className="shift-count">
                                                        {fmt(s.visit_count)} visits / {fmtB(s.revenue)} ฿
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Charts */}
                <div className="two-col">
                    <div className="section">
                        <h2>📊 รายได้รายแพทย์ (แท่ง)</h2>
                        <div className="chart-wrap">
                            <canvas ref={barRef} />
                        </div>
                    </div>
                    <div className="section">
                        <h2>🔵 สิทธิ์การรักษา (วงกลม)</h2>
                        <div className="chart-wrap">
                            <canvas ref={pieRef} />
                        </div>
                    </div>
                </div>

                {/* Pivot */}
                <div className="section">
                    <h2>📋 ตาราง Pivot: แพทย์แผนไทย × สิทธิ์การรักษา</h2>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        {(["revenue", "visits", "patients"] as PivotMode[]).map((m) => (
                            <button
                                key={m}
                                className={`btn ${pivotMode === m ? "active" : ""}`}
                                onClick={() => setPivotMode(m)}
                            >
                                {m === "revenue" ? "รายได้" : m === "visits" ? "Visits" : "ผู้ป่วย"}
                            </button>
                        ))}
                    </div>
                    <div className="pivot-wrap">
                        {pivot.docs.length === 0 ? (
                            <div className="empty">ไม่มีข้อมูล</div>
                        ) : (
                            <table className="pivot">
                                <thead>
                                    <tr>
                                        <th>แพทย์แผนไทย</th>
                                        {pivot.rights.map((r) => (
                                            <th key={r}>{r}</th>
                                        ))}
                                        <th>รวม</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pivot.docs.map((doc) => {
                                        let rowTotal = 0;
                                        return (
                                            <tr key={doc}>
                                                <td>{doc}</td>
                                                {pivot.rights.map((r) => {
                                                    const val = pivot.lookup[`${doc}__${r}`] || 0;
                                                    rowTotal += val;
                                                    return (
                                                        <td className="num" key={r}>
                                                            {pivotMode === "revenue" ? fmtB(val) : fmt(val)}
                                                        </td>
                                                    );
                                                })}
                                                <td className="num total">
                                                    {pivotMode === "revenue" ? fmtB(rowTotal) : fmt(rowTotal)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr>
                                        <td className="total">รวมทั้งหมด</td>
                                        {pivot.rights.map((r) => {
                                            const colTotal = pivot.docs.reduce(
                                                (s, doc) => s + (pivot.lookup[`${doc}__${r}`] || 0),
                                                0,
                                            );
                                            return (
                                                <td className="num total" key={r}>
                                                    {pivotMode === "revenue" ? fmtB(colTotal) : fmt(colTotal)}
                                                </td>
                                            );
                                        })}
                                        <td className="num total">
                                            {pivotMode === "revenue"
                                                ? fmtB(Object.values(pivot.lookup).reduce((s, v) => s + v, 0))
                                                : fmt(Object.values(pivot.lookup).reduce((s, v) => s + v, 0))}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* ICD10 + Queue */}
                <div className="two-col">
                    <div className="section">
                        <h2>🏷️ รหัสวินิจฉัย ICD-10 ที่ใช้บ่อย</h2>
                        <div className="icd-list">
                            {icdRows.length === 0 ? (
                                <div className="empty">ไม่มีข้อมูล</div>
                            ) : (
                                icdRows.map((r) => (
                                    <div className="icd-row" key={r.icd10_code}>
                                        <span className="icd-code">{r.icd10_code}</span>
                                        <div className="icd-bar-wrap">
                                            <div
                                                className="icd-bar"
                                                style={{ width: `${Math.round((r.use_count / icdMax) * 100)}%` }}
                                            >
                                                {r.use_count}
                                            </div>
                                        </div>
                                        <span className="icd-name" title={r.icd10_name}>
                                            {r.icd10_name}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="section">
                        <h2>🔢 คิวรอรับบริการ ณ ปัจจุบัน</h2>
                        <div style={{ overflowX: "auto" }}>
                            {queueRows.length === 0 ? (
                                <div className="empty">ไม่มีคิวรอบริการ</div>
                            ) : (
                                <table className="queue">
                                    <thead>
                                        <tr>
                                            <th>คิว</th>
                                            <th>HN</th>
                                            <th>ชื่อ</th>
                                            <th>แพทย์</th>
                                            <th>สิทธิ์</th>
                                            <th>เวลา</th>
                                            <th>สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {queueRows.map((r) => (
                                            <tr key={r.queue_no + r.hn}>
                                                <td>
                                                    <b>{r.queue_no}</b>
                                                </td>
                                                <td>{r.hn}</td>
                                                <td>{r.patient_name}</td>
                                                <td>{r.doctor_name}</td>
                                                <td>
                                                    <span className="right-badge r-other">{r.right_name}</span>
                                                </td>
                                                <td>{r.vsttime || "—"}</td>
                                                <td
                                                    className={
                                                        r.status === "กำลังรับบริการ" ? "status-in" : "status-wait"
                                                    }
                                                >
                                                    {r.status}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {/* Patient list */}
                <div className="section">
                    <h2>
                        🧑‍🤝‍🧑 รายชื่อผู้ป่วย <span className="badge">{periodLabel}</span>
                    </h2>
                    <div className="pt-controls">
                        <input
                            type="text"
                            placeholder="🔍 ค้นหา HN / ชื่อ-สกุล / ICD-10"
                            value={ptSearch}
                            onChange={(e) => setPtSearch(e.target.value)}
                        />
                        <select value={ptDoctor} onChange={(e) => setPtDoctor(e.target.value)}>
                            <option value="">— แพทย์ทุกคน —</option>
                            {ptDoctors.map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>
                        <select value={ptRight} onChange={(e) => setPtRight(e.target.value)}>
                            <option value="">— สิทธิ์ทุกประเภท —</option>
                            {ptRights.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
                        <select value={ptShift} onChange={(e) => setPtShift(e.target.value)}>
                            <option value="">— ทุกเวร —</option>
                            <option value="am">เช้า (08:30-16:30)</option>
                            <option value="pm">เย็น (16:30-20:30)</option>
                            <option value="ot">นอกเวลา</option>
                        </select>
                        <span className="pt-count">แสดง {filteredPatients.length} รายการ</span>
                    </div>
                    <div className="ptlist-wrap">
                        <table className="ptlist">
                            <thead>
                                <tr>
                                    {[
                                        ["vstdate", "#วันที่"],
                                        ["hn", "HN"],
                                        ["patient_name", "ชื่อ-สกุล"],
                                        ["doctor_name", "แพทย์แผนไทย"],
                                        ["shift", "เวร"],
                                        ["right_name", "สิทธิ์"],
                                        ["icd10", "ICD-10"],
                                    ].map(([key, label]) => (
                                        <th key={key} onClick={() => sortPt(key)}>
                                            {label} <span className="sort-icon">{sortIcon(key)}</span>
                                        </th>
                                    ))}
                                    <th onClick={() => sortPt("revenue")} style={{ textAlign: "right" }}>
                                        รายได้ (฿) <span className="sort-icon">{sortIcon("revenue")}</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPatients.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="empty">
                                            ไม่มีข้อมูลผู้ป่วย
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPatients.map((r, i) => {
                                        const shift = getShift(r.vsttime);
                                        return (
                                            <tr key={r.vn + i}>
                                                <td>
                                                    {r.vstdate || "—"} {(r.vsttime || "").slice(0, 5)}
                                                </td>
                                                <td>
                                                    <b>{r.hn}</b>
                                                </td>
                                                <td>{r.patient_name}</td>
                                                <td>
                                                    <span className={`doc-tag ${getDocColor(r.doctor_name)}`}>
                                                        {r.doctor_name}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`shift-tag ${shift}`}>{shiftLabel[shift]}</span>
                                                </td>
                                                <td>
                                                    <span className={`right-badge ${rightClass(r.right_code)}`}>
                                                        {r.right_name}
                                                    </span>
                                                </td>
                                                <td className="icd">
                                                    <b>{r.icd10}</b> {r.icd10_name}
                                                </td>
                                                <td className="num">{fmtB(r.revenue)}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            <tfoot className="ptfoot">
                                <tr>
                                    <td colSpan={7}>รวม</td>
                                    <td className="num" style={{ textAlign: "right" }}>
                                        {filteredPatients.length ? fmtB(totalRev) : "—"}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Scoped CSS (ทุก selector อยู่ใต้ .ttm-dash กัน clash กับ Navbar/Sidebar) ──
const CSS = `
.ttm-dash {
  --primary:#2e7d32; --primary-light:#4caf50; --primary-dark:#1b5e20;
  --accent:#ff8f00; --bg:#f1f8e9; --card:#fff; --text:#1a1a1a;
  --muted:#6e7e6e; --border:#c8e6c9; --shift-am:#1565c0; --shift-pm:#6a1b9a; --shift-we:#00695c;
  background:var(--bg); color:var(--text); font-size:14px; border-radius:12px; overflow:hidden;
}
.ttm-dash .dash-header { background:var(--primary-dark); color:#fff; padding:14px 24px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }
.ttm-dash .dash-header h1 { font-size:18px; font-weight:700; }
.ttm-dash .last-update, .ttm-dash .refresh-countdown { font-size:12px; color:#a5d6a7; }
.ttm-dash .controls { background:#fff; border-bottom:2px solid var(--border); padding:10px 24px; display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
.ttm-dash .controls label { font-weight:600; color:var(--primary-dark); font-size:13px; }
.ttm-dash .btn-group { display:flex; gap:4px; flex-wrap:wrap; }
.ttm-dash .btn { padding:5px 12px; border:1.5px solid var(--primary); border-radius:6px; background:#fff; color:var(--primary); cursor:pointer; font-size:13px; transition:all .2s; }
.ttm-dash .btn:hover, .ttm-dash .btn.active { background:var(--primary); color:#fff; }
.ttm-dash .custom-range { display:flex; gap:6px; align-items:center; }
.ttm-dash input[type="date"] { padding:4px 8px; border:1.5px solid var(--border); border-radius:6px; font-size:13px; }
.ttm-dash select { padding:5px 10px; border:1.5px solid var(--border); border-radius:6px; font-size:13px; cursor:pointer; }
.ttm-dash .main { padding:18px 24px; display:flex; flex-direction:column; gap:18px; }
.ttm-dash .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:14px; }
.ttm-dash .kpi-card { background:var(--card); border-radius:12px; padding:16px; border-left:5px solid var(--primary-light); box-shadow:0 2px 8px #0001; }
.ttm-dash .kpi-card .kpi-label { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
.ttm-dash .kpi-card .kpi-value { font-size:28px; font-weight:700; color:var(--primary-dark); }
.ttm-dash .kpi-card .kpi-sub { font-size:11px; color:var(--muted); margin-top:4px; }
.ttm-dash .kpi-card.accent { border-left-color:var(--accent); }
.ttm-dash .kpi-card.accent .kpi-value { color:var(--accent); }
.ttm-dash .section { background:var(--card); border-radius:12px; padding:18px; box-shadow:0 2px 8px #0001; }
.ttm-dash .section h2 { font-size:15px; font-weight:700; color:var(--primary-dark); margin-bottom:14px; display:flex; align-items:center; gap:8px; }
.ttm-dash .section h2 .badge { background:var(--primary-light); color:#fff; font-size:11px; padding:2px 8px; border-radius:20px; font-weight:600; }
.ttm-dash .two-col { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
@media (max-width:860px){ .ttm-dash .two-col { grid-template-columns:1fr; } }
.ttm-dash .doctor-cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px,1fr)); gap:14px; }
.ttm-dash .doc-card { border:1.5px solid var(--border); border-radius:10px; padding:14px; background:#fafffe; }
.ttm-dash .doc-card .doc-name { font-weight:700; font-size:14px; color:var(--primary-dark); margin-bottom:10px; }
.ttm-dash .doc-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; text-align:center; margin-bottom:12px; }
.ttm-dash .doc-stats .stat-val { font-size:20px; font-weight:700; color:var(--primary); }
.ttm-dash .doc-stats .stat-lbl { font-size:10px; color:var(--muted); }
.ttm-dash .shift-list { display:flex; flex-direction:column; gap:4px; }
.ttm-dash .shift-row { display:flex; justify-content:space-between; align-items:center; padding:4px 8px; border-radius:6px; font-size:12px; }
.ttm-dash .shift-row.am { background:#e3f2fd; color:var(--shift-am); }
.ttm-dash .shift-row.pm { background:#f3e5f5; color:var(--shift-pm); }
.ttm-dash .shift-row.we { background:#e0f2f1; color:var(--shift-we); }
.ttm-dash .shift-row .shift-count { font-weight:700; }
.ttm-dash .chart-wrap { position:relative; height:240px; }
.ttm-dash .pivot-wrap { overflow-x:auto; }
.ttm-dash table.pivot { border-collapse:collapse; width:100%; font-size:13px; }
.ttm-dash table.pivot th { background:var(--primary-dark); color:#fff; padding:8px 12px; text-align:left; white-space:nowrap; }
.ttm-dash table.pivot td { padding:7px 12px; border-bottom:1px solid var(--border); white-space:nowrap; }
.ttm-dash table.pivot tr:hover td { background:#f1f8f1; }
.ttm-dash table.pivot td.num { text-align:right; font-weight:600; }
.ttm-dash table.pivot td.total { font-weight:700; background:#e8f5e9; }
.ttm-dash .right-badge { display:inline-block; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600; }
.ttm-dash .r-uc { background:#e3f2fd; color:#1565c0; }
.ttm-dash .r-gov { background:#fce4ec; color:#880e4f; }
.ttm-dash .r-sso { background:#fff8e1; color:#e65100; }
.ttm-dash .r-self { background:#f3e5f5; color:#4a148c; }
.ttm-dash .r-other { background:#f1f8e9; color:#2e7d32; }
.ttm-dash table.queue { border-collapse:collapse; width:100%; font-size:13px; }
.ttm-dash table.queue th { background:#263238; color:#fff; padding:7px 10px; text-align:left; }
.ttm-dash table.queue td { padding:6px 10px; border-bottom:1px solid #eee; }
.ttm-dash table.queue tr:hover td { background:#f9fbe7; }
.ttm-dash .status-wait { color:#e65100; font-weight:700; }
.ttm-dash .status-in { color:#1b5e20; font-weight:700; }
.ttm-dash .icd-list { display:flex; flex-direction:column; gap:6px; }
.ttm-dash .icd-row { display:flex; align-items:center; gap:10px; }
.ttm-dash .icd-code { font-family:monospace; font-size:12px; background:#e8f5e9; color:var(--primary-dark); padding:2px 7px; border-radius:5px; min-width:70px; text-align:center; }
.ttm-dash .icd-bar-wrap { flex:1; height:18px; background:#e8f5e9; border-radius:4px; overflow:hidden; }
.ttm-dash .icd-bar { height:100%; background:var(--primary-light); border-radius:4px; transition:width .4s; display:flex; align-items:center; padding-left:6px; font-size:11px; color:#fff; font-weight:600; min-width:24px; }
.ttm-dash .icd-name { font-size:12px; color:var(--muted); min-width:160px; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ttm-dash .spinner { display:inline-block; width:12px; height:12px; border:2px solid #a5d6a7; border-top-color:#fff; border-radius:50%; animation:ttmspin .7s linear infinite; vertical-align:middle; }
@keyframes ttmspin { to { transform:rotate(360deg); } }
.ttm-dash .empty { text-align:center; color:var(--muted); padding:24px; font-style:italic; }
.ttm-dash .error { color:#c62828; background:#ffebee; padding:10px; border-radius:6px; font-size:13px; }
.ttm-dash .pt-controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:14px; }
.ttm-dash .pt-controls input[type="text"] { padding:6px 10px; border:1.5px solid var(--border); border-radius:6px; font-size:13px; min-width:200px; }
.ttm-dash .pt-count { margin-left:auto; font-size:12px; color:var(--muted); }
.ttm-dash table.ptlist { border-collapse:collapse; width:100%; font-size:13px; }
.ttm-dash table.ptlist th { background:var(--primary-dark); color:#fff; padding:8px 10px; text-align:left; white-space:nowrap; cursor:pointer; user-select:none; position:sticky; top:0; z-index:1; }
.ttm-dash table.ptlist th:hover { background:var(--primary); }
.ttm-dash table.ptlist th .sort-icon { margin-left:4px; opacity:.6; font-size:10px; }
.ttm-dash table.ptlist td { padding:7px 10px; border-bottom:1px solid var(--border); white-space:nowrap; }
.ttm-dash table.ptlist tr:hover td { background:#f1f8f1; }
.ttm-dash table.ptlist td.num { text-align:right; font-weight:600; color:var(--primary-dark); }
.ttm-dash table.ptlist td.icd { font-family:monospace; font-size:11px; }
.ttm-dash .ptlist-wrap { overflow-x:auto; max-height:420px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; }
.ttm-dash .doc-tag { display:inline-block; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600; }
.ttm-dash .doc-0 { background:#e8f5e9; color:#2e7d32; }
.ttm-dash .doc-1 { background:#e3f2fd; color:#1565c0; }
.ttm-dash .doc-2 { background:#f3e5f5; color:#6a1b9a; }
.ttm-dash .doc-3 { background:#fff8e1; color:#e65100; }
.ttm-dash .shift-tag { display:inline-block; padding:2px 7px; border-radius:10px; font-size:11px; }
.ttm-dash .shift-tag.am { background:#e3f2fd; color:#1565c0; }
.ttm-dash .shift-tag.pm { background:#f3e5f5; color:#6a1b9a; }
.ttm-dash .shift-tag.ot { background:#fafafa; color:#555; }
.ttm-dash tfoot.ptfoot td { font-weight:700; background:#e8f5e9; padding:7px 10px; border-top:2px solid var(--primary-light); }
`;