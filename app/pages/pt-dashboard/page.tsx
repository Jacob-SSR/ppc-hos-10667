"use client";
// app/pages/pt-dashboard/page.tsx
// Dashboard กายภาพบำบัด (PT/PTA) — พอร์ตจาก DASHBO_1.HTM เข้าระบบจริง
// ดึง /api/pt-dashboard (records[] + queue[]) แล้วคำนวณทุก section ฝั่ง client
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chart, registerables } from "chart.js";
import { exportToExcel } from "@/lib/exportExcel";

Chart.register(...registerables);

// ─── Types ──────────────────────────────────────────────────────────────────
interface PtRecord {
    date: string;
    shift: "morning" | "evening";
    staff_id: string;
    staff_name: string;
    role: "pt" | "pta";
    right: string;
    procedure: string;
    procedure_name: string;
    income: number;
    hn: string;
    patient_name: string;
}
interface PtQueueItem {
    queue_no: string;
    hn: string;
    patient_name: string;
    staff_name: string;
    vsttime: string;
    status: string;
}
interface ApiResp {
    records: PtRecord[];
    queue: PtQueueItem[];
    start: string;
    end: string;
    updatedAt: string;
}

type Preset = "today" | "7days" | "30days" | "thismonth";

const PRESETS: { key: Preset; label: string }[] = [
    { key: "today", label: "วันนี้" },
    { key: "7days", label: "7 วัน" },
    { key: "30days", label: "30 วัน" },
    { key: "thismonth", label: "เดือนนี้" },
];

const SHL: Record<string, string> = { morning: "เวรเช้า", evening: "เวรเย็น" };
const SHC: Record<string, string> = { morning: "sh-m", evening: "sh-e" };
const RC: Record<string, string> = {
    UC: "right-uc",
    ข้าราชการ: "right-gov",
    ประกันสังคม: "right-sso",
    จ่ายเอง: "right-self",
};
const baht = (n: number) => "฿" + (n || 0).toLocaleString();

// ─── Component ────────────────────────────────────────────────────────────────
export default function PtDashboardPage() {
    const [preset, setPreset] = useState<Preset>("today");
    const [records, setRecords] = useState<PtRecord[]>([]);
    const [queue, setQueue] = useState<PtQueueItem[]>([]);
    const [updatedAt, setUpdatedAt] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // filters
    const [q, setQ] = useState("");
    const [fRight, setFRight] = useState("");
    const [fShift, setFShift] = useState("");
    const [fRole, setFRole] = useState("");

    // expand states
    const [openSD, setOpenSD] = useState<Record<string, boolean>>({});
    const [collapsedGrp, setCollapsedGrp] = useState<Record<string, boolean>>({});

    const rightChartRef = useRef<HTMLCanvasElement | null>(null);
    const procChartRef = useRef<HTMLCanvasElement | null>(null);
    const rightChartInst = useRef<Chart | null>(null);
    const procChartInst = useRef<Chart | null>(null);

    const load = useCallback(async (p: Preset) => {
        setLoading(true);
        setErr(null);
        try {
            const res = await fetch(`/api/pt-dashboard?preset=${p}`, { cache: "no-store" });
            if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
            const data: ApiResp = await res.json();
            setRecords(data.records || []);
            setQueue(data.queue || []);
            setUpdatedAt(data.updatedAt || new Date().toISOString());
        } catch (e) {
            setErr(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
            setRecords([]);
            setQueue([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(preset);
        const t = setInterval(() => load(preset), 60000);
        return () => clearInterval(t);
    }, [preset, load]);

    // ── KPI ──
    const kpi = useMemo(() => {
        const pts = new Set(records.map((r) => r.hn)).size;
        const vis = records.length;
        const inc = records.reduce((a, r) => a + r.income, 0);
        const pt = records.filter((r) => r.role === "pt");
        const pta = records.filter((r) => r.role === "pta");
        return {
            pts,
            vis,
            inc,
            ptV: pt.length,
            ptI: pt.reduce((a, r) => a + r.income, 0),
            ptaV: pta.length,
            ptaI: pta.reduce((a, r) => a + r.income, 0),
        };
    }, [records]);

    // ── staff summary ──
    const staffRows = useMemo(() => {
        const map: Record<
            string,
            { name: string; role: string; pts: Set<string>; vis: number; inc: number }
        > = {};
        records.forEach((r) => {
            if (!map[r.staff_id])
                map[r.staff_id] = { name: r.staff_name, role: r.role, pts: new Set(), vis: 0, inc: 0 };
            map[r.staff_id].pts.add(r.hn);
            map[r.staff_id].vis++;
            map[r.staff_id].inc += r.income;
        });
        return Object.values(map).sort(
            (a, b) => (a.role === "pt" ? 0 : 1) - (b.role === "pt" ? 0 : 1) || b.vis - a.vis,
        );
    }, [records]);

    // ── shifts × rights ──
    const shiftData = useMemo(() => {
        const SH: Record<string, Record<string, { vis: number; inc: number }>> = {
            morning: {},
            evening: {},
        };
        records.forEach((r) => {
            const sh = SH[r.shift] || SH.morning;
            if (!sh[r.right]) sh[r.right] = { vis: 0, inc: 0 };
            sh[r.right].vis++;
            sh[r.right].inc += r.income;
        });
        return SH;
    }, [records]);

    // ── right totals (chart) ──
    const rightTotals = useMemo(() => {
        const map: Record<string, number> = {};
        records.forEach((r) => {
            map[r.right] = (map[r.right] || 0) + r.income;
        });
        return map;
    }, [records]);

    // ── proc counts (chart) ──
    const procTop = useMemo(() => {
        const map: Record<string, number> = {};
        records.forEach((r) => {
            if (r.procedure && r.procedure !== "-")
                map[r.procedure] = (map[r.procedure] || 0) + 1;
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
    }, [records]);

    // ── pivot staff × right ──
    const pivot = useMemo(() => {
        const staffMap: Record<string, Record<string, number>> = {};
        records.forEach((r) => {
            if (!staffMap[r.staff_name]) staffMap[r.staff_name] = {};
            staffMap[r.staff_name][r.right] = (staffMap[r.staff_name][r.right] || 0) + r.income;
        });
        const rights = [...new Set(records.map((r) => r.right))];
        const totals: Record<string, number> = {};
        rights.forEach((rr) => (totals[rr] = 0));
        let grand = 0;
        const rows = Object.entries(staffMap).map(([sn, rm]) => {
            const tot = Object.values(rm).reduce((a, b) => a + b, 0);
            grand += tot;
            rights.forEach((rr) => (totals[rr] += rm[rr] || 0));
            return { sn, rm, tot };
        });
        return { rights, totals, grand, rows };
    }, [records]);

    // ── staff detail ──
    const staffDetail = useMemo(() => {
        const map: Record<
            string,
            {
                name: string;
                role: string;
                shifts: Record<string, { vis: number; inc: number }>;
                rights: Record<string, { vis: number; inc: number }>;
                procs: Record<string, number>;
            }
        > = {};
        records.forEach((r) => {
            if (!map[r.staff_id])
                map[r.staff_id] = { name: r.staff_name, role: r.role, shifts: {}, rights: {}, procs: {} };
            const s = map[r.staff_id];
            if (!s.shifts[r.shift]) s.shifts[r.shift] = { vis: 0, inc: 0 };
            s.shifts[r.shift].vis++;
            s.shifts[r.shift].inc += r.income;
            if (!s.rights[r.right]) s.rights[r.right] = { vis: 0, inc: 0 };
            s.rights[r.right].vis++;
            s.rights[r.right].inc += r.income;
            if (r.procedure && r.procedure !== "-")
                s.procs[r.procedure] = (s.procs[r.procedure] || 0) + 1;
        });
        return Object.entries(map).sort(
            (a, b) => (a[1].role === "pt" ? 0 : 1) - (b[1].role === "pt" ? 0 : 1),
        );
    }, [records]);

    // ── patient list grouped by staff ──
    const patientGroups = useMemo(() => {
        const grpMap: Record<string, { name: string; role: string; rows: PtRecord[] }> = {};
        records.forEach((r) => {
            if (!grpMap[r.staff_id]) grpMap[r.staff_id] = { name: r.staff_name, role: r.role, rows: [] };
            grpMap[r.staff_id].rows.push(r);
        });
        const ql = q.toLowerCase();
        let grandV = 0,
            grandI = 0;
        const groups = Object.entries(grpMap)
            .sort((a, b) => (a[1].role === "pt" ? 0 : 1) - (b[1].role === "pt" ? 0 : 1))
            .map(([sid, grp]) => {
                if (fRole && grp.role !== fRole) return null;
                const filtered = grp.rows.filter((r) => {
                    const mq =
                        !ql ||
                        r.hn.toLowerCase().includes(ql) ||
                        r.patient_name.toLowerCase().includes(ql) ||
                        r.procedure.toLowerCase().includes(ql);
                    const mr = !fRight || r.right === fRight;
                    const ms = !fShift || r.shift === fShift;
                    return mq && mr && ms;
                });
                if (!filtered.length) return null;
                const grpI = filtered.reduce((a, r) => a + r.income, 0);
                grandV += filtered.length;
                grandI += grpI;
                return { sid, grp, filtered, grpI };
            })
            .filter(Boolean) as { sid: string; grp: { name: string; role: string }; filtered: PtRecord[]; grpI: number }[];
        return { groups, grandV, grandI };
    }, [records, q, fRight, fShift, fRole]);

    // ── charts ──
    useEffect(() => {
        if (!rightChartRef.current) return;
        const labels = Object.keys(rightTotals);
        const vals = Object.values(rightTotals);
        const colors = ["#185FA5", "#854F0B", "#3B6D11", "#888780", "#5b21b6", "#c0392b"];
        rightChartInst.current?.destroy();
        rightChartInst.current = new Chart(rightChartRef.current, {
            type: "doughnut",
            data: { labels, datasets: [{ data: vals, backgroundColor: colors.slice(0, labels.length), borderWidth: 2 }] },
            options: { plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false },
        });
    }, [rightTotals]);

    useEffect(() => {
        if (!procChartRef.current) return;
        procChartInst.current?.destroy();
        procChartInst.current = new Chart(procChartRef.current, {
            type: "bar",
            data: {
                labels: procTop.map((x) => x[0]),
                datasets: [{ label: "จำนวนครั้ง", data: procTop.map((x) => x[1]), backgroundColor: "#1a6fa8", borderRadius: 4 }],
            },
            options: {
                indexAxis: "y",
                plugins: { legend: { display: false } },
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { beginAtZero: true } },
            },
        });
    }, [procTop]);

    useEffect(() => {
        return () => {
            rightChartInst.current?.destroy();
            procChartInst.current?.destroy();
        };
    }, []);

    // ── export ──
    const onExportExcel = () => {
        if (!records.length) return;
        exportToExcel(
            records.map((r) => ({
                วันที่: r.date,
                เวร: SHL[r.shift] || r.shift,
                เจ้าหน้าที่: r.staff_name,
                ประเภท: r.role === "pt" ? "PT" : "PTA",
                HN: r.hn,
                ชื่อผู้ป่วย: r.patient_name,
                หัตถการ: r.procedure,
                ชื่อหัตถการ: r.procedure_name,
                สิทธิ์: r.right,
                รายได้: r.income,
            })),
            { fileName: "รายงานกายภาพบำบัด", sheetName: "PT" },
        );
    };

    const colors = ["#185FA5", "#854F0B", "#3B6D11", "#888780", "#5b21b6", "#c0392b"];

    return (
        <div className="pt-dash">
            <style>{CSS}</style>

            <header className="pt-header">
                <div>
                    <h1>ระบบรายงานกายภาพบำบัด HOS XP</h1>
                    <div className="sub">รพ.พลับพลาชัย {updatedAt && `| อัปเดต ${new Date(updatedAt).toLocaleTimeString("th-TH")}`}</div>
                </div>
            </header>

            <div className="controls">
                <div className="sc-btns">
                    {PRESETS.map((p) => (
                        <button key={p.key} className={preset === p.key ? "active" : ""} onClick={() => setPreset(p.key)}>
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="export-bar">
                    <button className="btn btn-green" onClick={onExportExcel}>📊 Excel</button>
                    <button className="btn btn-gray" onClick={() => window.print()}>🖨️ พิมพ์ / PDF</button>
                </div>
            </div>

            <main>
                {err && <div className="err-box">⚠️ {err}</div>}
                {loading && <div className="loading">กำลังโหลด…</div>}

                {/* KPI */}
                <div className="kpi-row">
                    <div className="kpi"><div className="lbl">ผู้ป่วยทั้งหมด</div><div className="val">{kpi.pts.toLocaleString()}</div><div className="sub">ราย</div></div>
                    <div className="kpi"><div className="lbl">Visits ทั้งหมด</div><div className="val">{kpi.vis.toLocaleString()}</div><div className="sub">ครั้ง</div></div>
                    <div className="kpi"><div className="lbl">รายได้รวม</div><div className="val">{baht(kpi.inc)}</div><div className="sub">บาท</div></div>
                    <div className="kpi blue"><div className="lbl">นักกายภาพ PT</div><div className="val">{kpi.ptV.toLocaleString()}</div><div className="sub">visits / {baht(kpi.ptI)}</div></div>
                    <div className="kpi green"><div className="lbl">ผู้ช่วยกายภาพ PTA</div><div className="val">{kpi.ptaV.toLocaleString()}</div><div className="sub">visits / {baht(kpi.ptaI)}</div></div>
                </div>

                <div className="grid2">
                    {/* staff summary */}
                    <div className="card">
                        <div className="card-hdr"><span className="dot" style={{ background: "var(--pt-primary)" }} />สรุปรายบุคคล</div>
                        <div className="card-body">
                            <table>
                                <thead><tr><th>ชื่อ</th><th>ประเภท</th><th>ผู้ป่วย</th><th>Visits</th><th>รายได้</th></tr></thead>
                                <tbody>
                                    {staffRows.map((s, i) => (
                                        <tr key={i}>
                                            <td>{s.name}</td>
                                            <td><span className={`role-${s.role}`}>{s.role === "pt" ? "PT" : "PTA"}</span></td>
                                            <td className="num">{s.pts.size}</td>
                                            <td className="num">{s.vis}</td>
                                            <td className="inc">{baht(s.inc)}</td>
                                        </tr>
                                    ))}
                                    {!staffRows.length && <tr><td colSpan={5} className="empty">ไม่มีข้อมูล</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* queue */}
                    <div className="card">
                        <div className="card-hdr"><span className="dot" style={{ background: "#4CAF50" }} />คิวรอรับบริการ (วันนี้)</div>
                        <div className="card-body">
                            {queue.length ? (
                                queue.slice(0, 12).map((qi, i) => (
                                    <div className="q-item" key={i}>
                                        <span>{qi.queue_no}. {qi.patient_name} ({qi.hn})</span>
                                        <span className={qi.status === "กำลังรับบริการ" ? "q-active" : "q-wait"}>{qi.status}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="empty">ไม่มีคิวรอ</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid2">
                    {/* shifts */}
                    <div className="card">
                        <div className="card-hdr"><span className="dot" style={{ background: "var(--pt-morning)" }} />แยกตามเวร / สิทธิ์</div>
                        <div className="card-body">
                            {(["morning", "evening"] as const).map((sh) => (
                                <div key={sh} style={{ marginBottom: 12 }}>
                                    <div style={{ marginBottom: 5 }}>
                                        <span className={SHC[sh]} style={{ fontSize: ".7rem", fontWeight: 600, padding: "2px 7px", borderRadius: 999 }}>
                                            {sh === "morning" ? "เวรเช้า (08:30-16:30)" : "เวรเย็น (16:30-20:30)"}
                                        </span>
                                    </div>
                                    <table>
                                        <thead><tr><th>สิทธิ์</th><th>Visits</th><th>รายได้</th></tr></thead>
                                        <tbody>
                                            {Object.entries(shiftData[sh]).map(([k, v]) => (
                                                <tr key={k}><td>{k}</td><td className="num">{v.vis}</td><td className="inc">{baht(v.inc)}</td></tr>
                                            ))}
                                            {!Object.keys(shiftData[sh]).length && <tr><td colSpan={3} className="empty">—</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* right chart */}
                    <div className="card">
                        <div className="card-hdr"><span className="dot" style={{ background: "var(--pt-evening)" }} />กราฟรายได้ตามสิทธิ์</div>
                        <div className="card-body">
                            <div className="legend">
                                {Object.entries(rightTotals).map(([l, v], i) => (
                                    <span key={l}><span className="leg-sq" style={{ background: colors[i % colors.length] }} />{l} {baht(v)}</span>
                                ))}
                            </div>
                            <div className="chart-w"><canvas ref={rightChartRef} /></div>
                        </div>
                    </div>
                </div>

                {/* patient list */}
                <div className="card">
                    <div className="card-hdr"><span className="dot" style={{ background: "#e91e63" }} />รายชื่อผู้ป่วย แยกรายเจ้าหน้าที่</div>
                    <div className="card-body">
                        <div className="pt-search">
                            <input type="text" placeholder="ค้นหา HN / ชื่อ / หัตถการ..." value={q} onChange={(e) => setQ(e.target.value)} />
                            <select value={fRight} onChange={(e) => setFRight(e.target.value)}>
                                <option value="">สิทธิ์ทั้งหมด</option>
                                <option>UC</option><option>ข้าราชการ</option><option>ประกันสังคม</option><option>จ่ายเอง</option>
                            </select>
                            <select value={fShift} onChange={(e) => setFShift(e.target.value)}>
                                <option value="">เวรทั้งหมด</option>
                                <option value="morning">เวรเช้า</option>
                                <option value="evening">เวรเย็น</option>
                            </select>
                            <select value={fRole} onChange={(e) => setFRole(e.target.value)}>
                                <option value="">PT + PTA</option>
                                <option value="pt">PT เท่านั้น</option>
                                <option value="pta">PTA เท่านั้น</option>
                            </select>
                        </div>

                        {patientGroups.grandV ? (
                            <>
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginBottom: 8, fontSize: ".78rem", color: "var(--pt-muted)" }}>
                                    <span>รวม <strong style={{ color: "var(--pt-text)" }}>{patientGroups.grandV} visits</strong></span>
                                    <span>รายได้รวม <strong style={{ color: "var(--pt-primary)" }}>{baht(patientGroups.grandI)}</strong></span>
                                </div>
                                {patientGroups.groups.map(({ sid, grp, filtered, grpI }) => (
                                    <div className="pt-grp" key={sid}>
                                        <div className="pt-grp-hdr" onClick={() => setCollapsedGrp((s) => ({ ...s, [sid]: !s[sid] }))}>
                                            <span className={`role-${grp.role}`}>{grp.role === "pt" ? "PT" : "PTA"}</span>
                                            <span className="g-name">{grp.name}</span>
                                            <span className="g-meta">{filtered.length} visits &nbsp;|&nbsp; {baht(grpI)}</span>
                                            <span style={{ fontSize: ".78rem", color: "var(--pt-muted)" }}>{collapsedGrp[sid] ? "▶" : "▼"}</span>
                                        </div>
                                        <div className={`pt-grp-body${collapsedGrp[sid] ? " collapsed" : ""}`}>
                                            <table style={{ fontSize: ".78rem" }}>
                                                <thead>
                                                    <tr><th>วันที่</th><th>HN</th><th>ชื่อผู้ป่วย</th><th style={{ textAlign: "center" }}>หัตถการ</th><th>เวร</th><th>สิทธิ์</th><th style={{ textAlign: "right" }}>รายได้</th></tr>
                                                </thead>
                                                <tbody>
                                                    {filtered.map((r, i) => (
                                                        <tr key={i}>
                                                            <td>{r.date}</td>
                                                            <td style={{ fontFamily: "monospace", fontSize: ".75rem", color: "var(--pt-muted)" }}>{r.hn}</td>
                                                            <td>{r.patient_name}</td>
                                                            <td style={{ textAlign: "center" }}><span className="proc-pill" title={r.procedure_name}>{r.procedure}</span></td>
                                                            <td><span className={SHC[r.shift]}>{SHL[r.shift]}</span></td>
                                                            <td><span className={RC[r.right] || ""}>{r.right}</span></td>
                                                            <td className="inc">{baht(r.income)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ background: "var(--pt-primary-light)" }}>
                                                        <td colSpan={6} style={{ fontWeight: 600, color: "var(--pt-muted)", fontSize: ".72rem" }}>รวม {filtered.length} visits</td>
                                                        <td className="inc">{baht(grpI)}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div className="empty">ไม่พบข้อมูล</div>
                        )}
                    </div>
                </div>

                {/* staff detail */}
                <div className="card">
                    <div className="card-hdr"><span className="dot" style={{ background: "#2196F3" }} />สรุปรายเจ้าหน้าที่ (เวร / สิทธิ์ / หัตถการ)</div>
                    <div className="card-body">
                        {staffDetail.map(([sid, s]) => {
                            const vis = Object.values(s.shifts).reduce((a, v) => a + v.vis, 0);
                            const inc = Object.values(s.shifts).reduce((a, v) => a + v.inc, 0);
                            const open = !!openSD[sid];
                            const topProcs = Object.entries(s.procs).sort((a, b) => b[1] - a[1]).slice(0, 5);
                            return (
                                <div className="sc" key={sid}>
                                    <div className="sc-hdr" onClick={() => setOpenSD((o) => ({ ...o, [sid]: !o[sid] }))}>
                                        <span className={`role-${s.role}`}>{s.role === "pt" ? "PT" : "PTA"}</span>
                                        <span style={{ fontWeight: 600, fontSize: ".88rem" }}>{s.name}</span>
                                        <div className="sc-minis">
                                            <span className="mini">Visits <strong>{vis}</strong></span>
                                            <span className="mini">รายได้ <strong>{baht(inc)}</strong></span>
                                        </div>
                                        <span style={{ fontSize: ".8rem", color: "var(--pt-muted)", marginLeft: 4 }}>{open ? "▲" : "▼"}</span>
                                    </div>
                                    <div className={`sc-body${open ? " open" : ""}`}>
                                        <div className="sc-grid">
                                            <div>
                                                <div className="dtitle">แยกตามเวร</div>
                                                <table className="mini-table">
                                                    <thead><tr><th>เวร</th><th className="nr">Visits</th><th className="nr">รายได้</th></tr></thead>
                                                    <tbody>
                                                        {Object.entries(s.shifts).map(([sh, v]) => (
                                                            <tr key={sh}><td><span className={SHC[sh] || "sh-m"}>{SHL[sh] || sh}</span></td><td className="nr">{v.vis}</td><td className="nr">{baht(v.inc)}</td></tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div>
                                                <div className="dtitle">แยกตามสิทธิ์</div>
                                                <table className="mini-table">
                                                    <thead><tr><th>สิทธิ์</th><th className="nr">Visits</th><th className="nr">รายได้</th></tr></thead>
                                                    <tbody>
                                                        {Object.entries(s.rights).map(([rt, v]) => (
                                                            <tr key={rt}><td>{rt}</td><td className="nr">{v.vis}</td><td className="nr">{baht(v.inc)}</td></tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div>
                                                <div className="dtitle">หัตถการ Top 5</div>
                                                {topProcs.map(([c, n]) => (
                                                    <span className="proc-tag" key={c}>{c} <b>({n})</b></span>
                                                ))}
                                                {!topProcs.length && <span className="empty">—</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {!staffDetail.length && <div className="empty">ไม่มีข้อมูล</div>}
                    </div>
                </div>

                {/* pivot */}
                <div className="card">
                    <div className="card-hdr"><span className="dot" />Pivot รายได้ บุคลากร × สิทธิ์การรักษา</div>
                    <div className="card-body">
                        <div className="pivot-wrap">
                            <table className="pivot">
                                <thead>
                                    <tr><th>บุคลากร</th>{pivot.rights.map((r) => <th key={r}>{r}</th>)}<th>รวม</th></tr>
                                </thead>
                                <tbody>
                                    {pivot.rows.map(({ sn, rm, tot }) => (
                                        <tr key={sn}>
                                            <td>{sn}</td>
                                            {pivot.rights.map((rr) => <td className="inc" key={rr}>{baht(rm[rr] || 0)}</td>)}
                                            <td className="pivot-tot inc">{baht(tot)}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ background: "var(--pt-primary-light)", fontWeight: 700 }}>
                                        <td>รวมทั้งหมด</td>
                                        {pivot.rights.map((rr) => <td className="pivot-tot inc" key={rr}>{baht(pivot.totals[rr] || 0)}</td>)}
                                        <td className="pivot-tot inc">{baht(pivot.grand)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* proc chart */}
                <div className="card">
                    <div className="card-hdr"><span className="dot" style={{ background: "#4CAF50" }} />หัตถการที่ใช้มากที่สุด</div>
                    <div className="card-body">
                        <div className="chart-w" style={{ height: 240 }}><canvas ref={procChartRef} /></div>
                    </div>
                </div>
            </main>
        </div>
    );
}

// ─── Scoped CSS (พอร์ตจาก DASHBO_1.HTM, prefix .pt-dash กันชนกับ layout หลัก) ──
const CSS = `
.pt-dash{--pt-primary:#1a6fa8;--pt-primary-light:#e8f4fd;--pt-bg:#f0f4f8;--pt-card:#fff;--pt-text:#1e293b;--pt-muted:#64748b;--pt-border:#e2e8f0;--pt-morning:#ff9800;--pt-evening:#7c3aed;color:var(--pt-text);font-size:14px}
.pt-dash *{box-sizing:border-box}
.pt-header{background:linear-gradient(135deg,#1a6fa8,#0d4f7a);color:#fff;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;border-radius:10px}
.pt-header h1{font-size:1.1rem;font-weight:600}
.pt-header .sub{font-size:.78rem;opacity:.85}
.pt-dash .controls{background:#fff;border:1px solid var(--pt-border);border-radius:10px;margin-top:12px;padding:10px 16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.pt-dash .sc-btns{display:flex;gap:5px;flex-wrap:wrap}
.pt-dash .sc-btns button{padding:4px 10px;border:1px solid var(--pt-border);background:var(--pt-bg);border-radius:6px;cursor:pointer;font-size:.78rem;color:var(--pt-muted)}
.pt-dash .sc-btns button.active,.pt-dash .sc-btns button:hover{background:var(--pt-primary-light);color:var(--pt-primary);border-color:var(--pt-primary)}
.pt-dash .export-bar{display:flex;gap:7px;align-items:center;margin-left:auto}
.pt-dash .btn{padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-size:.8rem;font-weight:600;color:#fff}
.pt-dash .btn-green{background:#217346}.pt-dash .btn-gray{background:#555}
.pt-dash main{padding:16px 0;display:flex;flex-direction:column;gap:16px}
.pt-dash .kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.pt-dash .kpi{background:#fff;border-radius:10px;padding:14px;border:1px solid var(--pt-border);display:flex;flex-direction:column;gap:3px}
.pt-dash .kpi .lbl{font-size:.7rem;color:var(--pt-muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.pt-dash .kpi .val{font-size:1.5rem;font-weight:700;color:var(--pt-primary)}
.pt-dash .kpi .sub{font-size:.7rem;color:var(--pt-muted)}
.pt-dash .kpi.blue .val{color:#2196F3}.pt-dash .kpi.green .val{color:#4CAF50}
.pt-dash .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:700px){.pt-dash .grid2{grid-template-columns:1fr}}
.pt-dash .card{background:#fff;border-radius:10px;border:1px solid var(--pt-border);overflow:hidden}
.pt-dash .card-hdr{padding:10px 14px;border-bottom:1px solid var(--pt-border);font-weight:600;font-size:.86rem;display:flex;align-items:center;gap:7px}
.pt-dash .dot{width:7px;height:7px;border-radius:50%;background:var(--pt-primary)}
.pt-dash .card-body{padding:14px}
.pt-dash table{width:100%;border-collapse:collapse;font-size:.8rem}
.pt-dash th{background:var(--pt-bg);padding:6px 8px;text-align:left;font-size:.7rem;font-weight:600;color:var(--pt-muted);border-bottom:1px solid var(--pt-border);text-transform:uppercase}
.pt-dash td{padding:6px 8px;border-bottom:1px solid var(--pt-border)}
.pt-dash tr:last-child td{border-bottom:none}
.pt-dash tbody tr:hover td{background:var(--pt-primary-light)}
.pt-dash .inc{text-align:right;font-weight:600;color:var(--pt-primary)}
.pt-dash .num{text-align:right}
.pt-dash .empty{color:var(--pt-muted);font-size:.85rem;text-align:center;padding:8px}
.pt-dash .role-pt{background:#dbeafe;color:#1e40af;padding:1px 7px;border-radius:999px;font-size:.7rem;font-weight:600}
.pt-dash .role-pta{background:#dcfce7;color:#166534;padding:1px 7px;border-radius:999px;font-size:.7rem;font-weight:600}
.pt-dash .sh-m{background:#fff3cd;color:#92400e;padding:1px 6px;border-radius:999px;font-size:.68rem;font-weight:600}
.pt-dash .sh-e{background:#ede9fe;color:#5b21b6;padding:1px 6px;border-radius:999px;font-size:.68rem;font-weight:600}
.pt-dash .proc-pill{background:var(--pt-primary-light);color:var(--pt-primary);padding:1px 7px;border-radius:999px;font-size:.7rem;font-weight:600}
.pt-dash .right-uc{color:#1565C0;font-size:.72rem;font-weight:600}
.pt-dash .right-gov{color:#1B5E20;font-size:.72rem;font-weight:600}
.pt-dash .right-sso{color:#BF360C;font-size:.72rem;font-weight:600}
.pt-dash .right-self{color:#4A148C;font-size:.72rem;font-weight:600}
.pt-dash .sc{border:1px solid var(--pt-border);border-radius:8px;overflow:hidden;margin-bottom:8px}
.pt-dash .sc-hdr{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;cursor:pointer;background:var(--pt-bg);flex-wrap:wrap;gap:8px}
.pt-dash .sc-hdr:hover{background:var(--pt-primary-light)}
.pt-dash .sc-minis{display:flex;gap:12px;flex-wrap:wrap}
.pt-dash .mini{font-size:.72rem;color:var(--pt-muted)}
.pt-dash .mini strong{color:var(--pt-text)}
.pt-dash .sc-body{display:none;padding:12px;border-top:1px solid var(--pt-border)}
.pt-dash .sc-body.open{display:block}
.pt-dash .sc-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
@media(max-width:600px){.pt-dash .sc-grid{grid-template-columns:1fr}}
.pt-dash .dtitle{font-size:.68rem;font-weight:600;color:var(--pt-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
.pt-dash .mini-table{width:100%;border-collapse:collapse;font-size:.75rem}
.pt-dash .mini-table th{background:var(--pt-bg);padding:4px 7px;font-size:.65rem;font-weight:600;color:var(--pt-muted);border-bottom:1px solid var(--pt-border)}
.pt-dash .mini-table td{padding:4px 7px;border-bottom:1px solid var(--pt-border)}
.pt-dash .mini-table tr:last-child td{border-bottom:none}
.pt-dash .mini-table .nr{text-align:right}
.pt-dash .proc-tag{display:inline-block;background:var(--pt-primary-light);color:var(--pt-primary);padding:1px 7px;border-radius:999px;font-size:.72rem;margin:2px}
.pt-dash .pt-search{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px}
.pt-dash .pt-search input,.pt-dash .pt-search select{border:1px solid var(--pt-border);border-radius:6px;padding:5px 8px;font-size:.8rem;color:var(--pt-text);background:#fff}
.pt-dash .pt-search input{flex:1;min-width:150px}
.pt-dash .pt-grp{margin-bottom:14px}
.pt-dash .pt-grp-hdr{display:flex;align-items:center;gap:7px;padding:7px 10px;background:var(--pt-bg);border-radius:6px;border:1px solid var(--pt-border);cursor:pointer;flex-wrap:wrap;margin-bottom:5px}
.pt-dash .pt-grp-hdr:hover{background:var(--pt-primary-light)}
.pt-dash .pt-grp-hdr .g-name{font-weight:600;font-size:.86rem}
.pt-dash .pt-grp-hdr .g-meta{font-size:.72rem;color:var(--pt-muted);margin-left:auto}
.pt-dash .pt-grp-body{display:block;overflow-x:auto}
.pt-dash .pt-grp-body.collapsed{display:none}
.pt-dash .pivot-wrap{overflow-x:auto}
.pt-dash .pivot th{white-space:nowrap}
.pt-dash .pivot td{text-align:right}
.pt-dash .pivot td:first-child{text-align:left;font-weight:500}
.pt-dash .pivot-tot{font-weight:700;background:var(--pt-primary-light)!important;color:var(--pt-primary)}
.pt-dash .chart-w{position:relative;height:210px}
.pt-dash .legend{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px;font-size:.75rem;color:var(--pt-muted)}
.pt-dash .leg-sq{width:10px;height:10px;border-radius:2px;display:inline-block;margin-right:3px}
.pt-dash .q-item{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:6px;background:var(--pt-bg);border:1px solid var(--pt-border);font-size:.8rem;margin-bottom:5px}
.pt-dash .q-wait{color:var(--pt-morning);font-weight:600;font-size:.7rem}
.pt-dash .q-active{color:#4CAF50;font-weight:600;font-size:.7rem}
.pt-dash .err-box{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:10px 14px;border-radius:8px;font-size:.85rem}
.pt-dash .loading{color:var(--pt-muted);font-size:.85rem;padding:4px 0}
@media print{
  .pt-dash .controls,.pt-dash .export-bar{display:none!important}
  .pt-dash .card{box-shadow:none;border:1px solid #ccc;page-break-inside:avoid}
  .pt-dash .kpi-row{grid-template-columns:repeat(5,1fr)}
  @page{margin:1.5cm;size:A4 landscape}
}
`;