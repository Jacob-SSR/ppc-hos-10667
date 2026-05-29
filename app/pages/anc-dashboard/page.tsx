"use client";

import { useEffect, useMemo, useState } from "react";

// ─── Types (ตรงกับ /api/anc-sheets) ───────────────────────────────────────────
interface AncRow {
    month: string;
    vn: string;
    hn: string;
    serviceDate: string; // YYYY-MM-DD
    compAmount: number;
    compStatus: string; // OK / NO
    right: string; // UCS/WEL/SSS/OFC
    rightName: string;
    hmain: string;
    hsub: string;
    dept: string;
    doctor: string;
    diag: string;
    cost: number;
    debt: number;
    fdhStatus: string;
}
interface AncSummary {
    total: number;
    okCount: number;
    noCount: number;
    uniquePatients: number;
    claimedAmount: number;
    debtTotal: number;
    expectedAmount: number;
    compRate: number;
}
interface AncData {
    updatedAt: string;
    rows: AncRow[];
    summary: AncSummary;
}

const RIGHT_LABEL: Record<string, string> = {
    UCS: "บัตรทอง (UCS)",
    WEL: "สงเคราะห์ (WEL)",
    SSS: "ประกันสังคม (SSS)",
    OFC: "ข้าราชการ (OFC)",
};
const FDH_LABEL: Record<string, string> = {
    cut_off_batch: "ตัดงวดแล้ว",
    rejected: "ถูกปฏิเสธ",
    nhso_appealed: "อุทธรณ์",
    unclaimed: "ยังไม่ส่งเคลม",
    received: "รับเรื่องแล้ว",
};

const fmt = (n: number) => n.toLocaleString("th-TH");
const isOk = (r: AncRow) => r.compStatus.toUpperCase() === "OK";
const cleanFacility = (s: string) => {
    if (!s) return "ไม่ระบุ";
    const name = s.includes("#") ? s.split("#").slice(1).join("#") : s;
    return (
        name
            .replace(/โรงพยาบาลส่งเสริมสุขภาพตำบล(บ้าน)?/g, "รพ.สต.")
            .replace(/โรงพยาบาล/g, "รพ.")
            .trim() || "ไม่ระบุ"
    );
};
const toThai = (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${d}/${m}/${Number(y) + 543}`;
};

// count-up hook (เหมือน animateNum ใน mockup)
function useCountUp(target: number, run: boolean) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!run) return;
        let cur = 0;
        const step = Math.max(1, Math.ceil(target / 40));
        const t = setInterval(() => {
            cur += step;
            if (cur >= target) {
                cur = target;
                clearInterval(t);
            }
            setVal(cur);
        }, 22);
        return () => clearInterval(t);
    }, [target, run]);
    return val;
}

type StatusFilter = "all" | "OK" | "NO";

export default function AncDashboardPage() {
    const [data, setData] = useState<AncData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<StatusFilter>("all");
    const [q, setQ] = useState("");
    const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/anc-sheets", { credentials: "include" });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
            setData(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchData();
    }, []);

    const s = data?.summary;
    const rows = data?.rows ?? [];

    // KPI count-up
    const kTotal = useCountUp(s?.total ?? 0, !!s);
    const kOk = useCountUp(s?.okCount ?? 0, !!s);
    const kNo = useCountUp(s?.noCount ?? 0, !!s);
    const kAmt = useCountUp(Math.round(s?.claimedAmount ?? 0), !!s);

    // filter + search → group by month
    const groups = useMemo(() => {
        const ql = q.trim().toLowerCase();
        const filtered = rows.filter((r) => {
            if (filter !== "all" && r.compStatus.toUpperCase() !== filter) return false;
            if (!ql) return true;
            const hay = `${r.vn} ${r.hn} ${r.right} ${r.rightName} ${r.hsub} ${r.doctor} ${r.diag}`.toLowerCase();
            return hay.includes(ql);
        });
        const map: Record<string, { label: string; rows: AncRow[] }> = {};
        filtered.forEach((r) => {
            const key = /^\d{4}-\d{2}/.test(r.serviceDate) ? r.serviceDate.slice(0, 7) : "ไม่ระบุ";
            if (!map[key]) map[key] = { label: r.month?.trim() || key, rows: [] };
            map[key].rows.push(r);
        });
        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, v], i) => ({ key, idx: i, ...v }));
    }, [rows, filter, q]);

    // เปิดหมวดแรกโดย default / เปิดทุกหมวดเมื่อ filter|search
    const isOpen = (key: string, idx: number) => {
        if (key in openKeys) return openKeys[key];
        if (q || filter !== "all") return true;
        return idx === 0;
    };
    const toggle = (key: string, idx: number) =>
        setOpenKeys((p) => ({ ...p, [key]: !isOpen(key, idx) }));

    // export CSV (เฉพาะที่กรองอยู่)
    const exportCSV = () => {
        const header = ["เดือน", "VN", "HN", "วันที่", "สิทธิ", "หน่วยบริการ", "แพทย์", "การวินิจฉัย", "สถานะ", "เรียกเก็บ", "ชดเชย", "สถานะเคลมFDH"];
        const esc = (v: unknown) => {
            const str = String(v ?? "");
            return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        };
        const lines: string[][] = [header];
        groups.forEach((g) =>
            g.rows.forEach((r) =>
                lines.push([
                    g.label, r.vn, r.hn, toThai(r.serviceDate),
                    RIGHT_LABEL[r.right] ?? r.right, cleanFacility(r.hsub || r.hmain),
                    r.doctor, r.diag, isOk(r) ? "ชดเชยแล้ว" : "ยังไม่ชดเชย",
                    String(r.debt), String(r.compAmount), FDH_LABEL[r.fdhStatus] ?? r.fdhStatus,
                ]),
            ),
        );
        const csv = "\uFEFF" + lines.map((r) => r.map(esc).join(",")).join("\r\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "ผลงานเคลม_ANC_2569.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    const exportPDF = () => {
        setOpenKeys(Object.fromEntries(groups.map((g) => [g.key, true])));
        setTimeout(() => window.print(), 350);
    };

    return (
        <div className="anc-dash">
            <style>{CSS}</style>

            {/* Header */}
            <div className="anc-header">
                <div className="crumb">🏥 กลุ่มงานประกันสุขภาพ · โรงพยาบาลพลับพลาชัย</div>
                <h1>ผลงานการเบิกเงินชดเชยบริการฝากครรภ์</h1>
                <div className="sub">Antenatal Care (ANC) — Dashboard งานเคลม</div>
                <div className="badge-year">
                    ปีงบประมาณ 2569
                    {data && <span className="upd"> · อัปเดต {new Date(data.updatedAt).toLocaleString("th-TH")}</span>}
                </div>
            </div>

            <div className="wrap">
                {/* Error */}
                {error && (
                    <div className="err">
                        <b>ไม่สามารถดึงข้อมูลได้:</b> {error}
                        <button className="refresh" onClick={fetchData}>ลองใหม่</button>
                    </div>
                )}

                {/* KPI cards */}
                <div className="kpis">
                    <div className="kpi"><div className="ic">🤰</div><div className="num">{fmt(kTotal)}</div><div className="lbl">ยอด ANC ทั้งหมด (ราย)</div></div>
                    <div className="kpi"><div className="ic">✅</div><div className="num ok">{fmt(kOk)}</div><div className="lbl">ชดเชยแล้ว ({s ? s.compRate : 0}%)</div></div>
                    <div className="kpi"><div className="ic">⏳</div><div className="num no">{fmt(kNo)}</div><div className="lbl">ยังไม่ชดเชย (ราย)</div></div>
                    <div className="kpi"><div className="ic">💰</div><div className="num">{fmt(kAmt)}</div><div className="lbl">ยอดชดเชย (บาท)</div></div>
                </div>

                {/* secondary KPI strip */}
                {s && (
                    <div className="kpis kpis-sm">
                        <div className="kpi"><div className="num">{fmt(s.uniquePatients)}</div><div className="lbl">หญิงตั้งครรภ์ (คน)</div></div>
                        <div className="kpi"><div className="num">{fmt(Math.round(s.debtTotal))}</div><div className="lbl">มูลค่าเรียกเก็บ (บาท)</div></div>
                        <div className="kpi"><div className="num">{fmt(Math.round(s.expectedAmount))}</div><div className="lbl">คาดว่าจะได้รับ (บาท)</div></div>
                        <div className="kpi"><div className="num">{s.compRate}%</div><div className="lbl">อัตราชดเชย</div></div>
                    </div>
                )}

                {/* Controls */}
                <div className="controls">
                    <div className="search">
                        <span className="mag">🔍</span>
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา VN / HN / สิทธิ / แพทย์ / การวินิจฉัย..." />
                    </div>
                    <div className="chips">
                        {([["all", "ทั้งหมด"], ["OK", "ชดเชยแล้ว"], ["NO", "ยังไม่ชดเชย"]] as [StatusFilter, string][]).map(([f, label]) => (
                            <button key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{label}</button>
                        ))}
                    </div>
                </div>

                {/* Export */}
                <div className="export-box">
                    <div className="eb-label">📤 ส่งออกไฟล์</div>
                    <div className="eb-btns">
                        <button className="ebtn ebtn-pdf" onClick={exportPDF}>📄 บันทึกเป็น PDF</button>
                        <button className="ebtn ebtn-print" onClick={() => window.print()}>🖨️ พิมพ์เอกสาร</button>
                        <button className="ebtn ebtn-csv" onClick={exportCSV}>📊 ส่งออก CSV (Excel)</button>
                    </div>
                </div>

                {/* Loading */}
                {loading && !data && (
                    <div className="cats">
                        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" />)}
                    </div>
                )}

                {/* Category accordions (= เดือน) */}
                <div className="cats">
                    {groups.map((g) => {
                        const open = isOpen(g.key, g.idx);
                        const okN = g.rows.filter(isOk).length;
                        const claimed = g.rows.filter(isOk).reduce((a, r) => a + r.compAmount, 0);
                        const debt = g.rows.reduce((a, r) => a + r.debt, 0);
                        return (
                            <div key={g.key} className={`cat ${open ? "open" : ""}`}>
                                <div className="cat-head" onClick={() => toggle(g.key, g.idx)}>
                                    <div className="cat-num">{g.idx + 1}</div>
                                    <div className="cat-title">{g.label}</div>
                                    <div className="cat-meta">
                                        <span className="prog-tag pg-ok">ชดเชย {okN}</span>
                                        <span className="prog-tag pg-no">ค้าง {g.rows.length - okN}</span>
                                        <span className="cat-sum">{fmt(g.rows.length)} ราย · {fmt(Math.round(claimed))} ฿</span>
                                    </div>
                                    <span className="arrow">▼</span>
                                </div>
                                <div className="cat-body">
                                    <div className="cat-inner">
                                        <div className="dx">
                                            <b>📊 สรุปเดือนนี้:</b> ทั้งหมด {g.rows.length} ราย · ชดเชยแล้ว {okN} ราย ·
                                            เรียกเก็บ {fmt(Math.round(debt))} ฿ · ได้รับชดเชย {fmt(Math.round(claimed))} ฿
                                        </div>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>VN</th><th>วันที่</th><th>สิทธิ</th><th>หน่วยบริการ</th>
                                                    <th>แพทย์</th><th>สถานะ</th><th className="num-col">ชดเชย</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {g.rows.map((r) => (
                                                    <tr key={r.vn}>
                                                        <td className="code">{r.vn}</td>
                                                        <td>{toThai(r.serviceDate)}</td>
                                                        <td>{RIGHT_LABEL[r.right] ?? r.right}</td>
                                                        <td className="act">{cleanFacility(r.hsub || r.hmain)}</td>
                                                        <td className="doc">{r.doctor.split("#")[0].trim()}</td>
                                                        <td>
                                                            <span className={`badge ${isOk(r) ? "b-ok" : "b-no"}`}>
                                                                {isOk(r) ? "ชดเชยแล้ว" : "ยังไม่ชดเชย"}
                                                            </span>
                                                            {r.fdhStatus && FDH_LABEL[r.fdhStatus] && (
                                                                <span className="fdh">{FDH_LABEL[r.fdhStatus]}</span>
                                                            )}
                                                        </td>
                                                        <td className="price">{isOk(r) ? fmt(r.compAmount) + " ฿" : <span className="muted">—</span>}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {!loading && groups.length === 0 && (
                    <div className="no-result">ไม่พบรายการที่ค้นหา 🌸</div>
                )}

                {/* Footnotes */}
                <div className="footnotes">
                    <h3>📝 หมายเหตุประกอบ</h3>
                    <p><b>ชดเชยแล้ว</b> = สถานะชดเชย OK (ตัดงวด/รับเงินแล้ว) · <b>ยังไม่ชดเชย</b> = สถานะ NO (ถูกปฏิเสธ/รออุทธรณ์/ยังไม่ส่งเคลม)</p>
                    <p><b>เรียกเก็บ</b> = ยอดลูกหนี้ค่ารักษา · <b>ยอดชดเชย</b> = เงินที่ได้รับจริงจาก Invoice · <b>คาดว่าจะได้รับ</b> = รายที่ยังไม่ชดเชย × 360 บาท</p>
                    <p style={{ marginTop: 8 }}><b>สิทธิ:</b> UCS บัตรทอง · WEL สงเคราะห์ · SSS ประกันสังคม · OFC ข้าราชการ</p>
                </div>

                <div className="anc-footer">
                    🌸 จัดทำโดย กลุ่มงานประกันสุขภาพ โรงพยาบาลพลับพลาชัย · ข้อมูลผลงานเคลม ANC ปีงบประมาณ 2569
                </div>
            </div>
        </div>
    );
}

// ─── Scoped CSS (พอร์ตจาก mockup, prefix .anc-dash กัน global ชนกัน) ──────────
const CSS = `
.anc-dash{
  --pink-bg:#fff5f8;--pink-soft:#ffe3ee;--pink-mid:#ffc2da;--pink-deep:#f48fb1;
  --pink-accent:#ec6a9c;--pink-dark:#c2185b;--plum:#8e244f;--rose-card:#fff;
  --text:#5a3046;--text-soft:#9a6b81;
  --shadow:0 8px 28px rgba(236,106,156,.18);--shadow-sm:0 3px 12px rgba(236,106,156,.14);
  font-family:'Sarabun',sans-serif;color:var(--text);
  background:linear-gradient(160deg,#fff5f8 0%,#ffeaf3 50%,#fde4ee 100%);
  margin:-1rem;padding:0 0 50px;min-height:100%;
}
.anc-dash *{box-sizing:border-box}
.anc-dash .wrap{max-width:1240px;margin:0 auto;padding:0 20px}
.anc-dash .anc-header{
  background:linear-gradient(135deg,#ec6a9c 0%,#f48fb1 60%,#ffc2da 100%);color:#fff;
  padding:30px 20px 26px;text-align:center;border-radius:0 0 32px 32px;box-shadow:var(--shadow);
  position:relative;overflow:hidden;margin-bottom:24px;
}
.anc-dash .anc-header::before,.anc-dash .anc-header::after{content:"";position:absolute;border-radius:50%;background:rgba(255,255,255,.16)}
.anc-dash .anc-header::before{width:200px;height:200px;top:-70px;right:-40px}
.anc-dash .anc-header::after{width:140px;height:140px;bottom:-60px;left:-30px}
.anc-dash .crumb{font-size:.9rem;font-weight:500;opacity:.92;position:relative}
.anc-dash .anc-header h1{font-size:1.7rem;font-weight:800;margin:8px 0 4px;position:relative;text-shadow:0 2px 6px rgba(150,30,70,.25)}
.anc-dash .anc-header .sub{font-size:1rem;font-weight:500;opacity:.96;position:relative}
.anc-dash .badge-year{display:inline-block;margin-top:10px;background:#fff;color:var(--pink-dark);font-weight:700;padding:6px 18px;border-radius:30px;font-size:.9rem;box-shadow:0 4px 12px rgba(150,30,70,.22);position:relative}
.anc-dash .badge-year .upd{font-weight:500;font-size:.78rem;opacity:.7}
.anc-dash .err{background:#fff;border:1.5px solid #f5b5cb;border-radius:16px;padding:14px 18px;margin-bottom:18px;color:#b3245b;font-size:.9rem}
.anc-dash .err .refresh{margin-left:12px;border:none;background:var(--pink-accent);color:#fff;padding:5px 14px;border-radius:20px;font-family:inherit;font-weight:600;cursor:pointer}
.anc-dash .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px}
.anc-dash .kpis-sm{margin-bottom:22px}
.anc-dash .kpis-sm .kpi{padding:14px}
.anc-dash .kpis-sm .num{font-size:1.4rem}
.anc-dash .kpi{background:var(--rose-card);border-radius:18px;padding:18px 16px;text-align:center;box-shadow:var(--shadow-sm);border:1.5px solid var(--pink-soft);transition:transform .2s,box-shadow .2s}
.anc-dash .kpi:hover{transform:translateY(-3px);box-shadow:var(--shadow)}
.anc-dash .kpi .ic{font-size:1.6rem;margin-bottom:4px}
.anc-dash .kpi .num{font-size:1.9rem;font-weight:800;color:var(--pink-accent);line-height:1.1}
.anc-dash .kpi .num.ok{color:#2e9e4f}.anc-dash .kpi .num.no{color:#d23b6e}
.anc-dash .kpi .lbl{font-size:.85rem;color:var(--text-soft);font-weight:500;margin-top:4px}
.anc-dash .controls{background:var(--rose-card);border-radius:18px;padding:16px 18px;margin-bottom:16px;box-shadow:var(--shadow-sm);border:1.5px solid var(--pink-soft);display:flex;flex-wrap:wrap;gap:14px;align-items:center}
.anc-dash .search{flex:1;min-width:220px;position:relative}
.anc-dash .search input{width:100%;padding:11px 14px 11px 40px;border:1.5px solid var(--pink-mid);border-radius:14px;font-family:inherit;font-size:.95rem;color:var(--text);outline:none;background:var(--pink-bg)}
.anc-dash .search input:focus{border-color:var(--pink-accent);box-shadow:0 0 0 3px rgba(236,106,156,.16)}
.anc-dash .search .mag{position:absolute;left:13px;top:50%;transform:translateY(-50%)}
.anc-dash .chips{display:flex;flex-wrap:wrap;gap:8px}
.anc-dash .chip{border:1.5px solid var(--pink-mid);background:#fff;color:var(--pink-dark);padding:8px 16px;border-radius:30px;font-family:inherit;font-size:.88rem;font-weight:600;cursor:pointer;transition:all .18s}
.anc-dash .chip:hover{background:var(--pink-soft)}
.anc-dash .chip.active{background:linear-gradient(135deg,var(--pink-accent),var(--pink-deep));color:#fff;border-color:transparent;box-shadow:0 4px 12px rgba(236,106,156,.3)}
.anc-dash .export-box{background:linear-gradient(135deg,#fff,#fff5f8);border-radius:18px;padding:16px 20px;margin:0 0 22px;box-shadow:var(--shadow-sm);border:1.5px solid var(--pink-mid);display:flex;flex-wrap:wrap;align-items:center;gap:14px}
.anc-dash .eb-label{font-weight:700;color:var(--plum);font-size:.98rem}
.anc-dash .eb-btns{display:flex;flex-wrap:wrap;gap:10px;margin-left:auto}
.anc-dash .ebtn{border:none;cursor:pointer;font-family:inherit;font-weight:700;font-size:.9rem;padding:10px 18px;border-radius:13px;color:#fff;transition:transform .15s}
.anc-dash .ebtn:hover{transform:translateY(-2px)}
.anc-dash .ebtn-pdf{background:linear-gradient(135deg,var(--pink-accent),var(--pink-deep));box-shadow:0 4px 12px rgba(236,106,156,.35)}
.anc-dash .ebtn-csv{background:linear-gradient(135deg,#9c5fb8,#b07cc9);box-shadow:0 4px 12px rgba(156,95,184,.35)}
.anc-dash .ebtn-print{background:linear-gradient(135deg,#5fa8b8,#7cc0c9);box-shadow:0 4px 12px rgba(95,168,184,.35)}
.anc-dash .cats{display:block}
.anc-dash .skeleton{height:64px;border-radius:20px;background:#ffe3ee;margin-bottom:14px;animation:ancpulse 1.2s ease-in-out infinite}
@keyframes ancpulse{0%,100%{opacity:1}50%{opacity:.5}}
.anc-dash .cat{background:var(--rose-card);border-radius:20px;margin-bottom:16px;overflow:hidden;box-shadow:var(--shadow-sm);border:1.5px solid var(--pink-soft)}
.anc-dash .cat-head{display:flex;align-items:center;gap:14px;padding:16px 20px;cursor:pointer;background:linear-gradient(135deg,#ffe3ee,#ffd0e2)}
.anc-dash .cat-head:hover{background:linear-gradient(135deg,#ffd6e7,#ffc2da)}
.anc-dash .cat-num{width:40px;height:40px;flex-shrink:0;border-radius:50%;background:linear-gradient(135deg,var(--pink-accent),var(--pink-deep));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.1rem;box-shadow:0 3px 8px rgba(236,106,156,.35)}
.anc-dash .cat-title{flex:1;font-weight:700;font-size:1.05rem;color:var(--plum)}
.anc-dash .cat-meta{display:flex;gap:8px;align-items:center;flex-shrink:0}
.anc-dash .prog-tag{font-size:.76rem;font-weight:700;padding:4px 11px;border-radius:20px;white-space:nowrap}
.anc-dash .pg-ok{background:#e3f7e8;color:#2e7d32}.anc-dash .pg-no{background:#ffe0ea;color:#c2185b}
.anc-dash .cat-sum{font-weight:800;color:var(--pink-accent);font-size:.95rem;white-space:nowrap}
.anc-dash .arrow{font-size:.85rem;color:var(--pink-dark);transition:transform .25s}
.anc-dash .cat.open .arrow{transform:rotate(180deg)}
.anc-dash .cat-body{max-height:0;overflow:hidden;transition:max-height .35s ease}
.anc-dash .cat.open .cat-body{max-height:6000px;overflow:auto}
.anc-dash .cat-inner{padding:4px 20px 16px}
.anc-dash .dx{background:var(--pink-bg);border-radius:12px;padding:10px 14px;margin:10px 0 14px;font-size:.85rem;color:var(--text-soft);border-left:4px solid var(--pink-mid)}
.anc-dash .dx b{color:var(--pink-dark)}
.anc-dash table{width:100%;border-collapse:collapse;font-size:.88rem}
.anc-dash thead th{background:var(--pink-soft);color:var(--plum);font-weight:700;text-align:left;padding:9px 11px;font-size:.82rem;position:sticky;top:0}
.anc-dash thead th:first-child{border-radius:10px 0 0 10px}
.anc-dash thead th:last-child{border-radius:0 10px 10px 0;text-align:right}
.anc-dash thead th.num-col{text-align:right}
.anc-dash tbody td{padding:9px 11px;border-bottom:1px solid var(--pink-soft);vertical-align:top}
.anc-dash tbody tr:hover{background:#fff8fb}
.anc-dash .code{font-weight:700;color:var(--pink-dark);background:#fff0f6;padding:2px 8px;border-radius:8px;font-size:.8rem;white-space:nowrap}
.anc-dash .act{font-weight:500;line-height:1.4}
.anc-dash .doc{color:var(--text-soft);font-size:.82rem}
.anc-dash .price{text-align:right;font-weight:800;color:var(--pink-accent);white-space:nowrap}
.anc-dash .price .muted{color:#ccc}
.anc-dash .badge{display:inline-block;font-size:.74rem;font-weight:700;padding:3px 9px;border-radius:14px;white-space:nowrap}
.anc-dash .b-ok{background:#e3f7e8;color:#2e7d32}.anc-dash .b-no{background:#ffe0ea;color:#c2185b}
.anc-dash .fdh{display:block;font-size:.7rem;color:var(--text-soft);margin-top:3px}
.anc-dash .footnotes{background:var(--rose-card);border-radius:18px;padding:18px 22px;margin-top:8px;box-shadow:var(--shadow-sm);border:1.5px solid var(--pink-soft);font-size:.85rem;line-height:1.6;color:var(--text-soft)}
.anc-dash .footnotes h3{color:var(--plum);font-size:.98rem;margin-bottom:8px}
.anc-dash .footnotes b{color:var(--pink-dark)}
.anc-dash .anc-footer{text-align:center;margin-top:26px;color:var(--text-soft);font-size:.82rem}
.anc-dash .no-result{text-align:center;padding:40px;color:var(--text-soft);font-size:1rem}
@media print{
  .anc-dash{background:#fff;margin:0}
  .anc-dash .anc-header{box-shadow:none;border-radius:0}
  .anc-dash .controls,.anc-dash .export-box,.anc-dash .anc-footer,.anc-dash .arrow{display:none!important}
  .anc-dash .cat .cat-body{max-height:none!important}
  .anc-dash .cat{break-inside:avoid;box-shadow:none;border:1px solid #f0c4d6}
  .anc-dash .kpi,.anc-dash .cat,.anc-dash .footnotes{box-shadow:none}
}
@media(max-width:760px){
  .anc-dash .kpis{grid-template-columns:repeat(2,1fr)}
  .anc-dash .anc-header h1{font-size:1.3rem}
  .anc-dash .cat-title{font-size:.95rem}
  .anc-dash .cat-meta{flex-direction:column;align-items:flex-end;gap:4px}
  .anc-dash table{font-size:.8rem}
  .anc-dash thead th,.anc-dash tbody td{padding:7px 6px}
}
`;