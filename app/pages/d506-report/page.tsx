// app/pages/d506-report/page.tsx
// รายงานโรค 506 จาก HOSxP — การ์ดสรุป + แนวโน้มรายเดือน + Top10 + ตารางรายโรค + รายชื่อผู้ป่วย
// พอร์ตจากต้นฉบับ d506_demo.html มาเป็น React + recharts และดึงข้อมูลจริงผ่าน /api/d506-report
"use client";

<<<<<<< HEAD
import { useEffect, useMemo, useState } from "react";
=======
import { useCallback, useEffect, useMemo, useState } from "react";
>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import {
  Users, Mars, Venus, Skull, Activity, RefreshCw, FileDown, Search,
<<<<<<< HEAD
  ClipboardList, TrendingUp, Trophy,
=======
  ClipboardList, TrendingUp, Trophy, Layers,
>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))
} from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";
import { fmtDate, getBangkokToday, THAI_MONTHS_SHORT } from "@/lib/thaiDate";
import { usePagination } from "@/hooks/usePagination";
import type {
  D506Report, D506DiseaseSummary, D506PatientRow,
} from "@/lib/d506.service";

const fmt = (n: number) => n.toLocaleString("th-TH");

// ── ธีมมิ้นต์ (ให้ตรงกับทั้งเว็บ) ─────────────────────────────────────────────
const MINT = "#1a5233";
const MINT_ACCENT = "#3aa36a";
const MINT_BORDER = "#cfe7d8";

<<<<<<< HEAD
=======
// ── ฟิลด์ที่ใช้เป็น "คีย์ตัดซ้ำ" (ติ๊กเลือกเองได้) ────────────────────────────
const KEY_FIELDS: { id: string; label: string; get: (p: D506PatientRow) => string }[] = [
  { id: "name", label: "ชื่อ-สกุล", get: (p) => `${p.prefix}${p.fname} ${p.lname}`.trim() },
  { id: "hn", label: "HN", get: (p) => p.hn.trim() },
  { id: "dxDate", label: "วันวินิจฉัย", get: (p) => p.dxDate },
  { id: "disease", label: "โรค", get: (p) => p.disease },
  { id: "code506", label: "รหัส 506", get: (p) => p.code506 },
  { id: "status", label: "สถานะ", get: (p) => p.status },
  { id: "ptype", label: "ประเภท", get: (p) => p.ptype.trim().toUpperCase() },
];
const DEFAULT_KEYS = ["name", "dxDate", "disease", "status", "ptype"];

>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))
function firstOfMonth(): string {
  const t = getBangkokToday();
  return fmtDate(new Date(t.getFullYear(), t.getMonth(), 1));
}

function Card({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: number | string; sub: string; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4" style={{ borderLeftColor: accent }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
        <Icon size={18} style={{ color: accent, opacity: 0.5 }} />
      </div>
      <div className="text-3xl font-extrabold tabular-nums mt-1" style={{ color: accent }}>{value}</div>
      <div className="text-[11px] text-gray-400">{sub}</div>
    </div>
  );
}

export default function D506ReportPage() {
  const [start, setStart] = useState(firstOfMonth());
  const [end, setEnd] = useState(() => fmtDate(getBangkokToday()));
  const [data, setData] = useState<D506Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fDisease, setFDisease] = useState("");
  const [fSearch, setFSearch] = useState("");
<<<<<<< HEAD

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/d506-report?start=${start}&end=${end}`, { credentials: "include" });
=======
  const [dedup, setDedup] = useState(false); // ตัดซ้ำในตารางหลัก
  const [ptTab, setPtTab] = useState<"list" | "dups">("list"); // แท็บ: รายชื่อ / รายการซ้ำ
  const [keyIds, setKeyIds] = useState<string[]>(DEFAULT_KEYS); // คีย์ตัดซ้ำที่ติ๊กเลือก

  // รับ start/end ระบุตรง ๆ ได้ เพื่อให้เลือกวันแล้วดึงทันที (ไม่ต้องรอ state update)
  async function load(qs: string = start, qe: string = end) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/d506-report?start=${qs}&end=${qe}`, { credentials: "include" });
>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* โหลดครั้งแรก */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

<<<<<<< HEAD
=======
  // เลือกวันบนแถบบน → ดึงข้อมูลใหม่ทันที
  function onStartChange(v: string) { setStart(v); load(v, end); }
  function onEndChange(v: string) { setEnd(v); load(start, v); }

>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))
  const summary = useMemo<D506DiseaseSummary[]>(
    () => (data?.summary ?? []).filter((d) => d.total > 0), [data]);
  const patients = useMemo<D506PatientRow[]>(() => data?.patients ?? [], [data]);

  const top10 = useMemo(
    () => summary.slice(0, 10).map((d) => ({
      name: d.name.length > 14 ? d.name.slice(0, 14) + "…" : d.name,
      full: d.name, count: d.total,
    })), [summary]);

  const monthlyChart = useMemo(
    () => (data?.monthly ?? Array(12).fill(0)).map((v, i) => ({ name: THAI_MONTHS_SHORT[i], count: v })),
    [data]);

  const diseaseOpts = useMemo(
    () => [...new Set(patients.map((p) => p.disease).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "th")), [patients]);

<<<<<<< HEAD
  const filteredPatients = useMemo(() => {
=======
  // กรอง: โรค + ค้นหา + ช่วงวันที่รับรายงาน (ยังไม่ตัดซ้ำ)
  const baseFiltered = useMemo(() => {
>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))
    const q = fSearch.trim().toLowerCase();
    return patients.filter((p) => {
      if (fDisease && p.disease !== fDisease) return false;
      if (q) {
        const target = [p.hn, p.cid, p.fname, p.lname].join(" ").toLowerCase();
        if (!target.includes(q)) return false;
      }
      return true;
    });
  }, [patients, fDisease, fSearch]);

<<<<<<< HEAD
  const { page, setPage, totalPages, paged } = usePagination(filteredPatients, 20);
=======
  // สร้างคีย์ตัดซ้ำจากฟิลด์ที่ติ๊กเลือก
  const makeKey = useCallback(
    (p: D506PatientRow) =>
      KEY_FIELDS.filter((f) => keyIds.includes(f.id)).map((f) => f.get(p)).join("|"),
    [keyIds],
  );

  // นับจำนวนต่อคีย์ (ใช้หาว่าคีย์ไหนซ้ำ)
  const keyCounts = useMemo(() => {
    const m = new Map<string, number>();
    if (keyIds.length === 0) return m;
    baseFiltered.forEach((p) => { const k = makeKey(p); m.set(k, (m.get(k) || 0) + 1); });
    return m;
  }, [baseFiltered, makeKey, keyIds.length]);

  // ตารางหลัก: ถ้าเปิดตัดซ้ำ = เก็บแถวแรกของแต่ละคีย์
  const filteredPatients = useMemo(() => {
    if (!dedup || keyIds.length === 0) return baseFiltered;
    const seen = new Set<string>();
    return baseFiltered.filter((p) => {
      const k = makeKey(p);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [baseFiltered, dedup, makeKey, keyIds.length]);

  const removedDup = baseFiltered.length - filteredPatients.length;

  // รายการซ้ำ: เฉพาะแถวที่คีย์ปรากฏมากกว่า 1 ครั้ง — จัดกลุ่มให้อยู่ติดกัน
  const dupRecords = useMemo(() => {
    if (keyIds.length === 0) return [] as { p: D506PatientRow; k: string; count: number }[];
    return baseFiltered
      .map((p) => ({ p, k: makeKey(p), count: keyCounts.get(makeKey(p)) || 0 }))
      .filter((x) => x.count > 1)
      .sort((a, b) => a.k.localeCompare(b.k, "th") || a.p.hn.localeCompare(b.p.hn));
  }, [baseFiltered, makeKey, keyCounts, keyIds.length]);

  const dupGroupCount = useMemo(
    () => [...keyCounts.values()].filter((c) => c > 1).length, [keyCounts],
  );

  // index ของแต่ละกลุ่มซ้ำ (ใช้สลับสีพื้นให้เห็นกลุ่ม)
  const dupGroupIndex = useMemo(() => {
    const m = new Map<string, number>();
    let i = 0;
    dupRecords.forEach((x) => { if (!m.has(x.k)) m.set(x.k, i++); });
    return m;
  }, [dupRecords]);

  function toggleKey(id: string) {
    setKeyIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  const { page, setPage, totalPages, paged } = usePagination(filteredPatients, 20);
  const dp = usePagination(dupRecords, 20);
>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))

  const foot = useMemo(() => {
    let m = 0, f = 0, t = 0, d = 0;
    summary.forEach((r) => { m += r.male; f += r.female; t += r.total; d += r.death; });
    return { m, f, t, d, cfr: t ? ((d / t) * 100).toFixed(2) : "0.00" };
  }, [summary]);

  const PALETTE = ["#1a5233", "#236b43", "#2d8a56", "#3aa36a", "#55b882"];

  function exportSummary() {
    const out = summary.map((r) => ({
      "รหัส 506": r.code506, "ชื่อโรค": r.name, "ชาย": r.male, "หญิง": r.female,
      "รวม": r.total, "เสียชีวิต": r.death,
      "%CFR": r.total ? Number(((r.death / r.total) * 100).toFixed(2)) : 0,
    }));
    exportToExcel(out, { filePrefix: "d506_สรุปรายโรค", sheetName: "สรุป 506", dateKeys: [] });
  }
  function exportPatients() {
    const out = filteredPatients.map((p, i) => ({
      "ลำดับ": i + 1, "วันที่รับรายงาน": p.reportDate, HN: p.hn, "เลขบัตรปชช.": p.cid,
      "คำนำหน้า": p.prefix, "ชื่อ": p.fname, "สกุล": p.lname, "เพศ": p.sex, "วันเกิด": p.dob,
      "อายุ": p.age ?? "", "บ้านเลขที่": p.house, "หมู่": p.moo, "ตำบล": p.tambon,
      "อำเภอ": p.amphoe, "จังหวัด": p.province, "วันที่เริ่มป่วย": p.onsetDate,
<<<<<<< HEAD
      "โรคที่วินิจฉัย": p.disease, "รหัส 506": p.code506, "ICD-10": p.icd10,
=======
      "วันวินิจฉัย": p.dxDate, "โรคที่วินิจฉัย": p.disease, "รหัส 506": p.code506, "ICD-10": p.icd10,
>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))
      "ประเภท": p.ptype, "สถานะ": p.status, "เสียชีวิต": p.death ? "ใช่" : "ไม่",
    }));
    exportToExcel(out, { filePrefix: "d506_รายชื่อผู้ป่วย", sheetName: "รายชื่อผู้ป่วย 506", dateKeys: [] });
  }
<<<<<<< HEAD

  const inputCls = "px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-blue-400";
=======
  function exportDups() {
    const out = dupRecords.map((x, i) => ({
      "ลำดับ": i + 1, "กลุ่มที่": (dupGroupIndex.get(x.k) ?? 0) + 1, "จำนวนซ้ำ": x.count,
      "ชื่อ-สกุล": `${x.p.prefix}${x.p.fname} ${x.p.lname}`.trim(), HN: x.p.hn, "เลขบัตรปชช.": x.p.cid,
      "วันที่รับรายงาน": x.p.reportDate, "วันวินิจฉัย": x.p.dxDate, "โรคที่วินิจฉัย": x.p.disease,
      "รหัส 506": x.p.code506, "ประเภท": x.p.ptype, "สถานะ": x.p.status,
    }));
    exportToExcel(out, { filePrefix: "d506_รายการซ้ำ", sheetName: "รายการซ้ำ 506", dateKeys: [] });
  }

  const inputCls = "px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-[#3aa36a] focus:ring-2 focus:ring-[#a8d5ba]";
  // control ในกล่องรายชื่อ — พื้นขาว ตัวอักษรเข้ม อ่านชัด
  const ctrlCls = "px-2.5 py-1.5 rounded-lg border border-[#cfe7d8] bg-white text-sm text-gray-700 focus:outline-none focus:border-[#3aa36a] focus:ring-2 focus:ring-[#a8d5ba]";
>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))

  return (
    <div className="p-4 md:p-6 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: MINT_ACCENT + "22" }}>
            <ClipboardList size={22} style={{ color: MINT }} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: MINT }}>รายงานโรค 506 — โรงพยาบาลพลับพลาชัย</h1>
            <p className="text-xs text-gray-400">ระบาดวิทยา · ดึงจากฐานข้อมูล HOSxP (surveil_member)</p>
          </div>
        </div>
        <span className="text-xs text-gray-500">
          {loading ? "กำลังโหลด..." : error ? "โหลดไม่ได้" : `${fmt(data?.cards.total ?? 0)} ราย`}
        </span>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-sm p-3 mb-4 flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-gray-400">ตั้งแต่
<<<<<<< HEAD
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-gray-400">ถึง
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
        </label>
        <button onClick={load} disabled={loading}
=======
          <input type="date" value={start} onChange={(e) => onStartChange(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-gray-400">ถึง
          <input type="date" value={end} onChange={(e) => onEndChange(e.target.value)} className={inputCls} />
        </label>
        <button onClick={() => load()} disabled={loading}
>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: MINT }}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> ดึงข้อมูล
        </button>
        <button onClick={exportSummary} disabled={!summary.length}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold hover:brightness-95 disabled:opacity-50"
          style={{ backgroundColor: "#f0faf4", color: MINT, borderColor: MINT_BORDER }}>
          <FileDown size={14} /> Excel (สรุป 506)
        </button>
      </div>

      {error && !loading && (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm mb-4">
          <Skull size={40} className="mx-auto mb-2 text-rose-500" />
          <div className="text-rose-600 font-bold mb-1">โหลดข้อมูลไม่ได้</div>
          <div className="text-gray-500 text-sm">{error}</div>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl p-16 text-center text-gray-500 shadow-sm">
          <RefreshCw className="animate-spin mx-auto mb-3" /> กำลังดึงข้อมูลจาก HOSxP…
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <Card icon={Users} label="ผู้ป่วยทั้งหมด" value={fmt(data.cards.total)} sub="รวมทุกโรค" accent={MINT} />
            <Card icon={Mars} label="เพศชาย" value={fmt(data.cards.male)} sub="ราย" accent="#2c7a7b" />
            <Card icon={Venus} label="เพศหญิง" value={fmt(data.cards.female)} sub="ราย" accent="#b7791f" />
            <Card icon={Skull} label="เสียชีวิต" value={fmt(data.cards.death)} sub="ราย" accent="#c53030" />
            <Card icon={Activity} label="โรคที่พบ" value={fmt(data.cards.diseases)} sub="รายการ" accent={MINT_ACCENT} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-2xl shadow-sm p-4 lg:col-span-2">
              <p className="flex items-center gap-1.5 text-sm font-bold text-gray-600 mb-3"><TrendingUp size={15} style={{ color: MINT_ACCENT }} /> แนวโน้มรายเดือน (ปี {new Date(start).getFullYear() + 543})</p>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={monthlyChart} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v} ราย`, ""]} />
                  <Line type="monotone" dataKey="count" stroke={MINT} strokeWidth={2}
                    dot={{ r: 4, fill: MINT }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-gray-600 mb-3"><Trophy size={15} style={{ color: MINT_ACCENT }} /> Top 10 โรค</p>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [`${v} ราย`, ""]}
                    labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ""} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {top10.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Disease table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
            <div className="px-4 py-3 text-white text-sm font-bold" style={{ backgroundColor: MINT }}>ตารางรายงานโรค 506</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs" style={{ backgroundColor: "#f0faf4", color: MINT }}>
                    <th className="px-3 py-2 w-10">ที่</th>
                    <th className="px-3 py-2 text-left">ชื่อโรค</th>
                    <th className="px-3 py-2">รหัส</th>
                    <th className="px-3 py-2">ชาย</th>
                    <th className="px-3 py-2">หญิง</th>
                    <th className="px-3 py-2">รวม</th>
                    <th className="px-3 py-2">เสียชีวิต</th>
                    <th className="px-3 py-2">%CFR</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-gray-400">ไม่พบข้อมูลในช่วงวันที่นี้</td></tr>
                  ) : summary.map((r, i) => {
                    const cfr = r.total ? ((r.death / r.total) * 100).toFixed(2) : "0.00";
                    return (
                      <tr key={r.code506 || r.name} className="border-b border-gray-50 hover:bg-[#f0faf4]">
                        <td className="px-3 py-2 text-center text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2">
                          <button className="font-medium text-left hover:underline" style={{ color: MINT_ACCENT }}
                            onClick={() => { setFDisease(r.name); document.getElementById("pt-list")?.scrollIntoView({ behavior: "smooth" }); }}>
                            {r.name}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-500">{r.code506 || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(r.male)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(r.female)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r.total > 30 ? "bg-yellow-50 text-orange-700" : ""}`}>{fmt(r.total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-600 font-bold">{r.death > 0 ? r.death : "–"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{cfr}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                {summary.length > 0 && (
                  <tfoot>
                    <tr className="font-bold border-t-2" style={{ backgroundColor: "#f0faf4", color: MINT, borderColor: MINT_ACCENT }}>
                      <td className="px-3 py-2 text-left" colSpan={3}>รวมทุกโรค</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(foot.m)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(foot.f)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(foot.t)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600">{fmt(foot.d)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{foot.cfr}%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Patient list */}
          <div id="pt-list" className="bg-white rounded-2xl shadow-sm overflow-hidden">
<<<<<<< HEAD
            <div className="px-4 py-3 text-white flex items-center justify-between flex-wrap gap-2" style={{ backgroundColor: MINT }}>
              <span className="flex items-center gap-2 text-sm font-bold"><Users size={16} /> รายชื่อผู้ป่วยโรค 506 ({fmt(filteredPatients.length)} ราย)</span>
              <div className="flex items-center gap-2 flex-wrap">
                <select value={fDisease} onChange={(e) => setFDisease(e.target.value)}
                  className="px-2 py-1 rounded border border-white/40 bg-white/15 text-white text-xs">
                  <option value="" className="text-gray-800">— ทุกโรค —</option>
                  {diseaseOpts.map((d) => <option key={d} value={d} className="text-gray-800">{d}</option>)}
                </select>
                <div className="relative">
                  <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70" />
                  <input value={fSearch} onChange={(e) => setFSearch(e.target.value)}
                    placeholder="ค้นหา ชื่อ / HN / บัตรปชช."
                    className="pl-7 pr-2 py-1 rounded border border-white/40 bg-white/15 text-white text-xs placeholder-white/70 w-52" />
                </div>
                <button onClick={exportPatients}
                  className="flex items-center gap-1 px-2.5 py-1 rounded border border-white/40 bg-white/20 text-white text-xs font-semibold hover:bg-white/30">
                  <FileDown size={12} /> Excel
                </button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
=======
            {/* แถบหัวข้อ (มิ้นต์) */}
            <div className="px-4 py-3 text-white flex items-center gap-2" style={{ backgroundColor: MINT }}>
              <Users size={16} />
              <span className="text-sm font-bold">รายชื่อผู้ป่วยโรค 506</span>
              <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
                {ptTab === "list" ? `${fmt(filteredPatients.length)} ราย` : `ซ้ำ ${fmt(dupGroupCount)} กลุ่ม`}
              </span>
            </div>
            {/* แถบเครื่องมือ (พื้นสว่าง) */}
            <div className="px-4 py-2.5 bg-[#f0faf4] border-b border-[#cfe7d8] space-y-2">
              <div className="flex items-end gap-2 flex-wrap">
                <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase text-[#2d8a56]">โรค
                  <select value={fDisease} onChange={(e) => setFDisease(e.target.value)} className={ctrlCls}>
                    <option value="">— ทุกโรค —</option>
                    {diseaseOpts.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase text-[#2d8a56] flex-1 min-w-[180px]">ค้นหา
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={fSearch} onChange={(e) => setFSearch(e.target.value)}
                      placeholder="ชื่อ / HN / บัตรปชช." className={`${ctrlCls} pl-8 w-full`} />
                  </div>
                </label>
                {ptTab === "list" && (
                  <button onClick={() => setDedup((v) => !v)}
                    title="ตัดแถวซ้ำในตารางตามคีย์ที่เลือกด้านล่าง"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold ${dedup ? "bg-[#1a5233] text-white border-[#1a5233]" : "bg-white text-[#1a5233] border-[#cfe7d8] hover:bg-[#e7f5ec]"}`}>
                    <Layers size={14} /> ตัดซ้ำ{dedup && removedDup > 0 ? ` (−${fmt(removedDup)})` : ""}
                  </button>
                )}
                <button onClick={ptTab === "list" ? exportPatients : exportDups}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cfe7d8] bg-white text-[#1a5233] text-sm font-semibold hover:bg-[#e7f5ec]">
                  <FileDown size={14} /> Excel
                </button>
              </div>
              {/* ติ๊กเลือกคีย์ตัดซ้ำ */}
              <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-gray-600">
                <span className="font-semibold text-[#2d8a56]">ถือว่าซ้ำเมื่อตรงกัน:</span>
                {KEY_FIELDS.map((f) => (
                  <label key={f.id} className="inline-flex items-center gap-1 cursor-pointer select-none">
                    <input type="checkbox" checked={keyIds.includes(f.id)} onChange={() => toggleKey(f.id)}
                      className="w-3.5 h-3.5 accent-[#1a5233]" />
                    {f.label}
                  </label>
                ))}
                {keyIds.length === 0 && <span className="text-rose-500">← เลือกอย่างน้อย 1 อย่าง</span>}
              </div>
            </div>
            {/* แท็บ: รายชื่อทั้งหมด / รายการซ้ำ */}
            <div className="flex gap-1 px-4 pt-3">
              <button onClick={() => setPtTab("list")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-sm font-semibold"
                style={ptTab === "list"
                  ? { backgroundColor: "#f0faf4", color: MINT, boxShadow: `inset 0 -2px 0 ${MINT_ACCENT}` }
                  : { backgroundColor: "#eef2f0", color: "#64748b" }}>
                <Users size={15} /> รายชื่อทั้งหมด
                <span className="text-white rounded-full px-1.5 text-[11px]" style={{ backgroundColor: MINT_ACCENT }}>{fmt(filteredPatients.length)}</span>
              </button>
              <button onClick={() => setPtTab("dups")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-sm font-semibold"
                style={ptTab === "dups"
                  ? { backgroundColor: "#f0faf4", color: MINT, boxShadow: `inset 0 -2px 0 ${MINT_ACCENT}` }
                  : { backgroundColor: "#eef2f0", color: "#64748b" }}>
                <Layers size={15} /> รายการซ้ำ
                <span className="text-white rounded-full px-1.5 text-[11px]" style={{ backgroundColor: dupGroupCount ? "#c05621" : "#94a3b8" }}>{fmt(dupGroupCount)} กลุ่ม</span>
              </button>
            </div>

            {/* ── แท็บรายการซ้ำ ── */}
            {ptTab === "dups" && (
              <>
                <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                  <table className="text-xs whitespace-nowrap" style={{ minWidth: "100%" }}>
                    <thead className="sticky top-0 z-10">
                      <tr className="text-white" style={{ backgroundColor: "#143f28" }}>
                        {["#", "ชื่อ-สกุล", "HN", "เลขบัตรปชช.", "วันที่รับรายงาน", "วันวินิจฉัย", "โรค", "รหัส 506", "ประเภท", "สถานะ", "ซ้ำ (กลุ่ม)"]
                          .map((h) => <th key={h} className="px-2.5 py-2 font-semibold">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {dp.paged.length === 0 ? (
                        <tr><td colSpan={11} className="text-center py-10 text-gray-400">ไม่พบรายการซ้ำตามคีย์ที่เลือก</td></tr>
                      ) : dp.paged.map((x, i) => (
                        <tr key={`${x.p.hn}-${x.p.vstdate}-${i}`}
                          className="border-b border-gray-50"
                          style={{ backgroundColor: (dupGroupIndex.get(x.k) ?? 0) % 2 ? "#f7fbf9" : "#ffffff" }}>
                          <td className="px-2.5 py-1.5 text-center text-gray-400">{(dp.page - 1) * 20 + i + 1}</td>
                          <td className="px-2.5 py-1.5 font-medium">{x.p.prefix}{x.p.fname} {x.p.lname}</td>
                          <td className="px-2.5 py-1.5 text-center font-mono font-semibold">{x.p.hn}</td>
                          <td className="px-2.5 py-1.5 text-center font-mono">{x.p.cid}</td>
                          <td className="px-2.5 py-1.5 text-center">{x.p.reportDate}</td>
                          <td className="px-2.5 py-1.5 text-center">{x.p.dxDate}</td>
                          <td className="px-2.5 py-1.5">{x.p.disease}</td>
                          <td className="px-2.5 py-1.5 text-center">{x.p.code506}</td>
                          <td className="px-2.5 py-1.5 text-center">{x.p.ptype}</td>
                          <td className="px-2.5 py-1.5 text-center">{x.p.status}</td>
                          <td className="px-2.5 py-1.5 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-700">×{x.count}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {dp.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1.5 py-3">
                    <button disabled={dp.page === 1} onClick={() => dp.setPage(dp.page - 1)}
                      className="w-8 h-8 rounded-lg border border-gray-200 disabled:opacity-40">‹</button>
                    <span className="text-xs text-gray-500 mx-2">หน้า {dp.page}/{dp.totalPages}</span>
                    <button disabled={dp.page === dp.totalPages} onClick={() => dp.setPage(dp.page + 1)}
                      className="w-8 h-8 rounded-lg border border-gray-200 disabled:opacity-40">›</button>
                  </div>
                )}
              </>
            )}

            {/* ── แท็บรายชื่อทั้งหมด ── */}
            <div className={`overflow-x-auto max-h-[560px] overflow-y-auto ${ptTab === "list" ? "" : "hidden"}`}>
>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))
              <table className="text-xs whitespace-nowrap" style={{ minWidth: "100%" }}>
                <thead className="sticky top-0 z-10">
                  <tr className="text-white" style={{ backgroundColor: "#143f28" }}>
                    {["#", "วันที่รับรายงาน", "HN", "เลขบัตรปชช.", "คำนำหน้า", "ชื่อ", "สกุล", "เพศ",
                      "วันเกิด", "อายุ", "บ้านเลขที่", "หมู่", "ตำบล", "อำเภอ", "จังหวัด", "วันเริ่มป่วย",
<<<<<<< HEAD
                      "โรคที่วินิจฉัย", "รหัส 506", "ICD-10", "ประเภท", "สถานะ", "เสียชีวิต"]
=======
                      "วันวินิจฉัย", "โรคที่วินิจฉัย", "รหัส 506", "ICD-10", "ประเภท", "สถานะ", "เสียชีวิต"]
>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))
                      .map((h) => <th key={h} className="px-2.5 py-2 font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 ? (
<<<<<<< HEAD
                    <tr><td colSpan={22} className="text-center py-10 text-gray-400">ไม่พบข้อมูล</td></tr>
=======
                    <tr><td colSpan={23} className="text-center py-10 text-gray-400">ไม่พบข้อมูล</td></tr>
>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))
                  ) : paged.map((p, i) => (
                    <tr key={`${p.hn}-${i}`} className="border-b border-gray-50 hover:bg-[#f0faf4]">
                      <td className="px-2.5 py-1.5 text-center text-gray-400">{(page - 1) * 20 + i + 1}</td>
                      <td className="px-2.5 py-1.5 text-center">{p.reportDate}</td>
                      <td className="px-2.5 py-1.5 text-center font-mono font-semibold">{p.hn}</td>
                      <td className="px-2.5 py-1.5 text-center font-mono">{p.cid}</td>
                      <td className="px-2.5 py-1.5 text-center">{p.prefix}</td>
                      <td className="px-2.5 py-1.5">{p.fname}</td>
                      <td className="px-2.5 py-1.5">{p.lname}</td>
                      <td className="px-2.5 py-1.5 text-center">{p.sex}</td>
                      <td className="px-2.5 py-1.5 text-center">{p.dob}</td>
                      <td className="px-2.5 py-1.5 text-center">{p.age ?? "—"}</td>
                      <td className="px-2.5 py-1.5 text-center">{p.house}</td>
                      <td className="px-2.5 py-1.5 text-center">{p.moo}</td>
                      <td className="px-2.5 py-1.5">{p.tambon || "—"}</td>
                      <td className="px-2.5 py-1.5">{p.amphoe || "—"}</td>
                      <td className="px-2.5 py-1.5">{p.province || "—"}</td>
                      <td className="px-2.5 py-1.5 text-center">{p.onsetDate}</td>
<<<<<<< HEAD
=======
                      <td className="px-2.5 py-1.5 text-center">{p.dxDate}</td>
>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))
                      <td className="px-2.5 py-1.5 font-medium">{p.disease}</td>
                      <td className="px-2.5 py-1.5 text-center">{p.code506}</td>
                      <td className="px-2.5 py-1.5 text-center">{p.icd10}</td>
                      <td className="px-2.5 py-1.5 text-center">{p.ptype}</td>
                      <td className="px-2.5 py-1.5 text-center">{p.status}</td>
                      <td className="px-2.5 py-1.5 text-center">
                        {p.death
                          ? <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">เสียชีวิต</span>
                          : <span className="text-gray-300">–</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
<<<<<<< HEAD
            {totalPages > 1 && (
=======
            {ptTab === "list" && totalPages > 1 && (
>>>>>>> afce280 (feat(d506): เพิ่มรายงานโรค 506 (HOSxP) + D506 Dashboard (Google Sheet))
              <div className="flex items-center justify-center gap-1.5 py-3">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}
                  className="w-8 h-8 rounded-lg border border-gray-200 disabled:opacity-40">‹</button>
                <span className="text-xs text-gray-500 mx-2">หน้า {page}/{totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage(page + 1)}
                  className="w-8 h-8 rounded-lg border border-gray-200 disabled:opacity-40">›</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
