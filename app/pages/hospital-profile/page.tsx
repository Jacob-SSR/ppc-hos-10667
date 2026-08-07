"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  RefreshCw,
  Users,
  BedDouble,
  Stethoscope,
  Download,
  MapPin,
  Search,
  Filter,
} from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";

// ─── Types (ตรงกับ lib/hospital-profile.service.ts) ──────────────────────────
interface FiscalYearInfo {
  be: number;
  start: string;
  end: string;
  partial: boolean;
  days: number;
}
interface YearCellOpd {
  visits: number;
  patients: number;
}
interface OpdDepartmentStat {
  depcode: string;
  department: string;
  byYear: Record<number, YearCellOpd>;
}
interface YearCellIpd {
  admissions: number;
  discharges: number;
  patient_days: number;
  avg_los: number;
}
interface IpdWardStat {
  ward: string;
  ward_name: string;
  byYear: Record<number, YearCellIpd>;
}
interface YearSummary {
  be: number;
  partial: boolean;
  opd_visits: number;
  opd_patients: number;
  opd_avg_per_day: number;
  ipd_admissions: number;
  ipd_discharges: number;
  ipd_patient_days: number;
  ipd_avg_los: number;
  bed_occupancy_pct: number;
}
interface HospitalInfo {
  name: string;
  hospcode: string;
  type: string;
  registeredBeds: number;
  affiliation: string;
  location: string;
  catchmentTambons: string[];
  networkUnits: string[];
  bedUnits: { label: string; beds: number }[];
}
interface ApiData {
  updatedAt: string;
  info: HospitalInfo;
  population: number | null;
  years: FiscalYearInfo[];
  summary: YearSummary[];
  opdByDepartment: OpdDepartmentStat[];
  ipdByWard: IpdWardStat[];
}

const GREEN = "#0f6e56";
const HEAD_STYLE = {
  backgroundColor: "#f0faf5",
  color: "#085041",
  borderColor: "#9FE1CB",
};

const num = (n: number | undefined | null) =>
  n == null ? "-" : n.toLocaleString();

function yearLabel(y: FiscalYearInfo): string {
  return y.partial ? `${y.be} (สะสม)` : String(y.be);
}

export default function HospitalProfilePage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── filters ──
  const [hiddenYears, setHiddenYears] = useState<number[]>([]);
  const [deptFilter, setDeptFilter] = useState("");
  const [wardFilter, setWardFilter] = useState("");

  // ซ่อนได้ทุกปียกเว้นปีสุดท้าย — ต้องเหลือให้ดูอย่างน้อย 1 ปี
  const toggleYear = (be: number) =>
    setHiddenYears((prev) => {
      if (prev.includes(be)) return prev.filter((y) => y !== be);
      const next = [...prev, be];
      return data && next.length >= data.years.length ? prev : next;
    });

  const visibleYears = useMemo(
    () => (data ? data.years.filter((y) => !hiddenYears.includes(y.be)) : []),
    [data, hiddenYears],
  );
  const visibleSummary = useMemo(
    () =>
      data ? data.summary.filter((s) => !hiddenYears.includes(s.be)) : [],
    [data, hiddenYears],
  );

  const filteredOpd = useMemo(() => {
    if (!data) return [];
    const q = deptFilter.trim().toLowerCase();
    if (!q) return data.opdByDepartment;
    return data.opdByDepartment.filter((d) =>
      d.department.toLowerCase().includes(q),
    );
  }, [data, deptFilter]);

  const filteredIpd = useMemo(() => {
    if (!data) return [];
    const q = wardFilter.trim().toLowerCase();
    if (!q) return data.ipdByWard;
    return data.ipdByWard.filter((w) =>
      w.ward_name.toLowerCase().includes(q),
    );
  }, [data, wardFilter]);

  // ยอดรวมของ "แถวที่แสดงอยู่" ต่อปี — ใช้ตอนมีการกรอง
  const opdFilteredTotals = useMemo(() => {
    const m: Record<number, { visits: number; patients: number }> = {};
    for (const y of visibleYears) {
      let visits = 0;
      let patients = 0;
      for (const d of filteredOpd) {
        visits += d.byYear[y.be]?.visits ?? 0;
        patients += d.byYear[y.be]?.patients ?? 0;
      }
      m[y.be] = { visits, patients };
    }
    return m;
  }, [filteredOpd, visibleYears]);

  const ipdFilteredTotals = useMemo(() => {
    const m: Record<
      number,
      { admissions: number; discharges: number; avg_los: number }
    > = {};
    for (const y of visibleYears) {
      let admissions = 0;
      let discharges = 0;
      let patientDays = 0;
      for (const w of filteredIpd) {
        const c = w.byYear[y.be];
        if (!c) continue;
        admissions += c.admissions;
        discharges += c.discharges;
        patientDays += c.patient_days;
      }
      m[y.be] = {
        admissions,
        discharges,
        avg_los:
          discharges > 0
            ? Math.round((patientDays / discharges) * 10) / 10
            : 0,
      };
    }
    return m;
  }, [filteredIpd, visibleYears]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hospital-profile", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-gray-100 animate-pulse rounded-2xl" />
        <div className="h-64 bg-gray-100 animate-pulse rounded-2xl" />
        <div className="h-80 bg-gray-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <p className="text-red-600 mb-3">{error ?? "ไม่มีข้อมูล"}</p>
        <button
          onClick={fetchData}
          className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  const { info } = data;
  const allYears = data.years;
  const opdFilterActive = deptFilter.trim() !== "";
  const wardFilterActive = wardFilter.trim() !== "";

  const exportOpd = () => {
    const rows = filteredOpd.map((d) => {
      const row: Record<string, unknown> = { แผนก: d.department };
      for (const y of visibleYears) {
        row[`ปีงบ ${yearLabel(y)} (ครั้ง)`] = d.byYear[y.be]?.visits ?? 0;
        row[`ปีงบ ${yearLabel(y)} (คน)`] = d.byYear[y.be]?.patients ?? 0;
      }
      return row;
    });
    exportToExcel(rows, {
      filePrefix: "opd-3year",
      sheetName: "OPD",
      dateKeys: [],
    });
  };

  const exportIpd = () => {
    const rows = filteredIpd.map((w) => {
      const row: Record<string, unknown> = { หอผู้ป่วย: w.ward_name };
      for (const y of visibleYears) {
        const c = w.byYear[y.be];
        row[`ปีงบ ${yearLabel(y)} รับไว้`] = c?.admissions ?? 0;
        row[`ปีงบ ${yearLabel(y)} จำหน่าย`] = c?.discharges ?? 0;
        row[`ปีงบ ${yearLabel(y)} วันนอนรวม`] = c?.patient_days ?? 0;
        row[`ปีงบ ${yearLabel(y)} LOS เฉลี่ย`] = c?.avg_los ?? 0;
      }
      return row;
    });
    exportToExcel(rows, {
      filePrefix: "ipd-3year",
      sheetName: "IPD",
      dateKeys: [],
    });
  };

  // chip เลือกปีงบ — วางซ้ำในทุกการ์ดตาราง ให้เห็นชัดตรงจุดที่ใช้งาน
  const yearChips = () => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-gray-500 flex items-center gap-1">
        <Filter size={14} /> ปีงบ:
      </span>
      {allYears.map((y) => {
        const active = !hiddenYears.includes(y.be);
        return (
          <button
            key={y.be}
            onClick={() => toggleYear(y.be)}
            title={active ? "กดเพื่อซ่อนปีนี้" : "กดเพื่อแสดงปีนี้"}
            className="text-sm px-3 py-1 rounded-full border font-semibold transition-colors"
            style={
              active
                ? { background: GREEN, color: "#fff", borderColor: GREEN }
                : {
                    background: "#fff",
                    color: "#9ca3af",
                    borderColor: "#d1d5db",
                    textDecoration: "line-through",
                  }
            }
          >
            {active ? "✓ " : ""}
            {yearLabel(y)}
          </button>
        );
      })}
    </div>
  );

  const summaryMetrics: {
    label: string;
    get: (s: YearSummary) => string;
  }[] = [
    { label: "OPD ผู้รับบริการ (ครั้ง)", get: (s) => num(s.opd_visits) },
    { label: "OPD ผู้รับบริการ (คน)", get: (s) => num(s.opd_patients) },
    { label: "OPD เฉลี่ยต่อวัน (ครั้ง)", get: (s) => num(s.opd_avg_per_day) },
    { label: "IPD รับไว้รักษา (ราย)", get: (s) => num(s.ipd_admissions) },
    { label: "IPD จำหน่าย (ราย)", get: (s) => num(s.ipd_discharges) },
    { label: "วันนอนรวม (วัน)", get: (s) => num(s.ipd_patient_days) },
    { label: "วันนอนเฉลี่ย LOS (วัน)", get: (s) => String(s.ipd_avg_los) },
    {
      label: `อัตราครองเตียง (% ต่อ ${info.registeredBeds} เตียง)`,
      get: (s) => `${s.bed_occupancy_pct}%`,
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            className="text-lg font-bold flex items-center gap-2"
            style={{ color: GREEN }}
          >
            <Building2 size={20} /> ข้อมูลทั่วไป & สถิติบริการ OPD/IPD 3
            ปีย้อนหลัง
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            ข้อมูลจาก HOSxP · ปีงบประมาณ {allYears[0].be}–
            {allYears[allYears.length - 1].be} (1 ต.ค. – 30 ก.ย.) ·
            ปีงบปัจจุบันเป็นยอดสะสมถึงวันนี้
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={14} /> รีเฟรช
        </button>
      </div>

      {/* ── ข้อมูลทั่วไป ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-bold mb-4" style={{ color: GREEN }}>
          🏥 ข้อมูลทั่วไปของโรงพยาบาล
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-1.5">
            <p className="font-bold text-gray-800">{info.name}</p>
            <p className="text-gray-600">
              รหัสหน่วยบริการ {info.hospcode} · {info.type}
            </p>
            <p className="text-gray-600">{info.affiliation}</p>
            <p className="text-gray-600 flex items-center gap-1">
              <MapPin size={13} /> {info.location}
            </p>
            <p className="text-gray-600">
              จำนวนเตียงตามกรอบ{" "}
              <span className="font-semibold text-gray-800">
                {info.registeredBeds} เตียง
              </span>
              {data.population != null && (
                <>
                  {" · ประชากรในความรับผิดชอบ (บัญชี 1) "}
                  <span className="font-semibold text-gray-800">
                    {num(data.population)} คน
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            <p className="text-gray-600">
              <span className="font-semibold text-gray-800">
                เขตรับผิดชอบ:
              </span>{" "}
              {info.catchmentTambons.join(" · ")}
            </p>
            <p className="text-gray-600">
              <span className="font-semibold text-gray-800">
                หน่วยบริการเครือข่าย:
              </span>{" "}
              {info.networkUnits.join(" · ")}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {info.bedUnits.map((b) => (
                <span
                  key={b.label}
                  className="text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: "#f0faf5", color: "#085041" }}
                >
                  {b.label} {b.beds} เตียง
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── สรุปภาพรวมรายปี ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2
            className="text-sm font-bold flex items-center gap-2"
            style={{ color: GREEN }}
          >
            <Users size={16} /> สรุปภาพรวมการให้บริการรายปีงบประมาณ
          </h2>
          {yearChips()}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr>
                <th
                  className="px-3 py-2 text-left font-semibold border-b-2"
                  style={HEAD_STYLE}
                >
                  รายการ
                </th>
                {visibleYears.map((y) => (
                  <th
                    key={y.be}
                    className="px-3 py-2 text-center font-semibold border-b-2 whitespace-nowrap"
                    style={HEAD_STYLE}
                  >
                    ปีงบ {yearLabel(y)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaryMetrics.map((m) => (
                <tr
                  key={m.label}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                    {m.label}
                  </td>
                  {visibleSummary.map((s) => (
                    <td
                      key={s.be}
                      className="px-3 py-2 text-center tabular-nums font-medium text-gray-800"
                    >
                      {m.get(s)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          * IPD รับไว้นับตามวันรับ (regdate) · จำหน่าย/วันนอน นับตามวันจำหน่าย
          (dchdate) · ปีงบสะสมยังไม่ครบปี เปรียบเทียบตรง ๆ กับปีเต็มไม่ได้
        </p>
      </div>

      {/* ── OPD รายแผนก ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2
            className="text-sm font-bold flex items-center gap-2"
            style={{ color: GREEN }}
          >
            <Stethoscope size={16} /> ผู้ป่วยนอก (OPD) แยกรายแผนก
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                placeholder="กรองแผนก..."
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-44 focus:outline-none focus:border-[#0f6e56]"
              />
            </div>
            {opdFilterActive && (
              <span className="text-[11px] text-gray-400">
                แสดง {filteredOpd.length}/{data.opdByDepartment.length} แผนก
              </span>
            )}
            <button
              onClick={exportOpd}
              className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              <Download size={13} /> Export Excel
            </button>
          </div>
        </div>
        <div className="mb-3">{yearChips()}</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className="px-3 py-2 text-left font-semibold border-b-2 align-bottom"
                  style={HEAD_STYLE}
                >
                  แผนก
                </th>
                {visibleYears.map((y) => (
                  <th
                    key={y.be}
                    colSpan={2}
                    className="px-3 py-1.5 text-center font-semibold whitespace-nowrap"
                    style={HEAD_STYLE}
                  >
                    ปีงบ {yearLabel(y)}
                  </th>
                ))}
              </tr>
              <tr>
                {visibleYears.flatMap((y) => [
                  <th
                    key={`${y.be}-v`}
                    className="px-3 py-1.5 text-center text-xs font-medium border-b-2"
                    style={HEAD_STYLE}
                  >
                    ครั้ง
                  </th>,
                  <th
                    key={`${y.be}-p`}
                    className="px-3 py-1.5 text-center text-xs font-medium border-b-2"
                    style={HEAD_STYLE}
                  >
                    คน
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {filteredOpd.map((d) => (
                <tr
                  key={d.depcode}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                    {d.department}
                  </td>
                  {visibleYears.flatMap((y) => [
                    <td
                      key={`${y.be}-v`}
                      className="px-3 py-2 text-center tabular-nums"
                    >
                      {num(d.byYear[y.be]?.visits ?? 0)}
                    </td>,
                    <td
                      key={`${y.be}-p`}
                      className="px-3 py-2 text-center tabular-nums text-gray-500"
                    >
                      {num(d.byYear[y.be]?.patients ?? 0)}
                    </td>,
                  ])}
                </tr>
              ))}
              {/* รวม — ตอนกรองอยู่ใช้ผลรวมเฉพาะแถวที่แสดง */}
              <tr className="border-t-2" style={{ borderColor: "#9FE1CB" }}>
                <td className="px-3 py-2 font-bold" style={{ color: GREEN }}>
                  {opdFilterActive ? "รวมแผนกที่แสดง" : "รวมทั้งโรงพยาบาล"}
                </td>
                {visibleSummary.flatMap((s) => [
                  <td
                    key={`${s.be}-v`}
                    className="px-3 py-2 text-center tabular-nums font-bold"
                    style={{ color: GREEN }}
                  >
                    {num(
                      opdFilterActive
                        ? opdFilteredTotals[s.be]?.visits
                        : s.opd_visits,
                    )}
                  </td>,
                  <td
                    key={`${s.be}-p`}
                    className="px-3 py-2 text-center tabular-nums font-bold"
                    style={{ color: GREEN }}
                  >
                    {num(
                      opdFilterActive
                        ? opdFilteredTotals[s.be]?.patients
                        : s.opd_patients,
                    )}
                  </td>,
                ])}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          * นับจากการมารับบริการ (ovst) แยกตามแผนกหลักของ visit ·
          &quot;คน&quot; ในแถวรวมทั้งโรงพยาบาลนับไม่ซ้ำข้ามแผนก
          จึงไม่เท่ากับผลรวมของแต่ละแผนก
          {opdFilterActive &&
            " · ตอนกรองอยู่ แถวรวมเป็นผลบวกของแผนกที่แสดง (คนอาจซ้ำข้ามแผนก)"}
        </p>
      </div>

      {/* ── IPD ราย ward ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2
            className="text-sm font-bold flex items-center gap-2"
            style={{ color: GREEN }}
          >
            <BedDouble size={16} /> ผู้ป่วยใน (IPD) แยกรายหอผู้ป่วย
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={wardFilter}
                onChange={(e) => setWardFilter(e.target.value)}
                placeholder="กรองหอผู้ป่วย..."
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-44 focus:outline-none focus:border-[#0f6e56]"
              />
            </div>
            {wardFilterActive && (
              <span className="text-[11px] text-gray-400">
                แสดง {filteredIpd.length}/{data.ipdByWard.length} หอ
              </span>
            )}
            <button
              onClick={exportIpd}
              className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              <Download size={13} /> Export Excel
            </button>
          </div>
        </div>
        <div className="mb-3">{yearChips()}</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className="px-3 py-2 text-left font-semibold border-b-2 align-bottom"
                  style={HEAD_STYLE}
                >
                  หอผู้ป่วย
                </th>
                {visibleYears.map((y) => (
                  <th
                    key={y.be}
                    colSpan={3}
                    className="px-3 py-1.5 text-center font-semibold whitespace-nowrap"
                    style={HEAD_STYLE}
                  >
                    ปีงบ {yearLabel(y)}
                  </th>
                ))}
              </tr>
              <tr>
                {visibleYears.flatMap((y) =>
                  ["รับไว้", "จำหน่าย", "LOS"].map((h) => (
                    <th
                      key={`${y.be}-${h}`}
                      className="px-3 py-1.5 text-center text-xs font-medium border-b-2 whitespace-nowrap"
                      style={HEAD_STYLE}
                    >
                      {h}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {filteredIpd.map((w) => (
                <tr
                  key={w.ward}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                    {w.ward_name}
                  </td>
                  {visibleYears.flatMap((y) => {
                    const c = w.byYear[y.be];
                    return [
                      <td
                        key={`${y.be}-a`}
                        className="px-3 py-2 text-center tabular-nums"
                      >
                        {num(c?.admissions ?? 0)}
                      </td>,
                      <td
                        key={`${y.be}-d`}
                        className="px-3 py-2 text-center tabular-nums text-gray-500"
                      >
                        {num(c?.discharges ?? 0)}
                      </td>,
                      <td
                        key={`${y.be}-l`}
                        className="px-3 py-2 text-center tabular-nums text-gray-500"
                      >
                        {c?.avg_los ?? "-"}
                      </td>,
                    ];
                  })}
                </tr>
              ))}
              {/* รวม — ตอนกรองอยู่ใช้ผลรวมเฉพาะแถวที่แสดง */}
              <tr className="border-t-2" style={{ borderColor: "#9FE1CB" }}>
                <td className="px-3 py-2 font-bold" style={{ color: GREEN }}>
                  {wardFilterActive ? "รวมหอที่แสดง" : "รวมทั้งโรงพยาบาล"}
                </td>
                {visibleSummary.flatMap((s) => [
                  <td
                    key={`${s.be}-a`}
                    className="px-3 py-2 text-center tabular-nums font-bold"
                    style={{ color: GREEN }}
                  >
                    {num(
                      wardFilterActive
                        ? ipdFilteredTotals[s.be]?.admissions
                        : s.ipd_admissions,
                    )}
                  </td>,
                  <td
                    key={`${s.be}-d`}
                    className="px-3 py-2 text-center tabular-nums font-bold"
                    style={{ color: GREEN }}
                  >
                    {num(
                      wardFilterActive
                        ? ipdFilteredTotals[s.be]?.discharges
                        : s.ipd_discharges,
                    )}
                  </td>,
                  <td
                    key={`${s.be}-l`}
                    className="px-3 py-2 text-center tabular-nums font-bold"
                    style={{ color: GREEN }}
                  >
                    {wardFilterActive
                      ? (ipdFilteredTotals[s.be]?.avg_los ?? "-")
                      : s.ipd_avg_los}
                  </td>,
                ])}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          * รับไว้ = admission ตามวันรับ · จำหน่าย/LOS (วันนอนเฉลี่ย)
          ตามวันจำหน่าย · หอผู้ป่วยตามรหัส ward ใน HOSxP
        </p>
      </div>
    </div>
  );
}
