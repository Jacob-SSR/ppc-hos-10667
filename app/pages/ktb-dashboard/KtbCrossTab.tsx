"use client";

import React, { useMemo } from "react";
import type { KtbDashboardData, KtbUnitSummary, KtbServiceSummary } from "./types";

// ─── Service columns ตามรูป ──────────────────────────────────────────────────

const SERVICE_COLS: { key: string; label: string; sublabel: string }[] = [
  {
    key: "HPV_DNA",
    label: "ค่าบริการเก็บตัวอย่าง HPV DNA Test",
    sublabel: "เก็บตัวอย่าง",
  },
  {
    key: "HCV",
    label: "การตรวจคัดกรองโรคไวรัสตับอักเสบ ซี",
    sublabel: "ตับอักเสบ C",
  },
  {
    key: "HBV",
    label: "บริการตรวจคัดกรองไวรัสตับอักเสบ บี",
    sublabel: "ตับอักเสบ B",
  },
  {
    key: "FLU",
    label: "ฉีดวัคซีนไข้หวัดใหญ่ตามฤดูกาล (7 กลุ่มเสี่ยง)",
    sublabel: "วัคซีนไข้หวัดใหญ่",
  },
];

// map ชื่อจริงใน xlsx → key
const SERVICE_KEY_MAP: Record<string, string> = {
  "ค่าบริการเก็บตัวอย่าง": "HPV_DNA",
  "การตรวจคัดกรองโรคไวรัสตับอักเสบ ซี": "HCV",
  "บริการตรวจคัดกรองไวรัสตับอักเสบ บี": "HBV",
  "ฉีดวัคซีนป้องกันโรคป้องกันโรคไข้หวัดใหญ่ตามฤดูกาล(7กลุ่มเสี่ยง)": "FLU",
  "วัคซีนป้องกันโรคไข้หวัดใหญ่ตามฤดูกาล": "FLU",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface SvcStat {
  claimCount: number;
  claimBaht: number;
  compCount: number;
  compBaht: number;
}

interface RowData {
  hcode: string;
  name: string;
  isHospital: boolean;
  totalBaht: number;
  services: Record<string, SvcStat>;
}

interface TotalsType {
  totalBaht: number;
  services: Record<string, SvcStat>;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtN = (n: number) => n.toLocaleString("th-TH");
const fmtB = (n: number) =>
  n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── Build rows from API data ─────────────────────────────────────────────────

function buildRows(units: KtbUnitSummary[]): RowData[] {
  return units.map((unit) => {
    const services: Record<string, SvcStat> = {};

    // init all service keys
    for (const svc of SERVICE_COLS) {
      services[svc.key] = {
        claimCount: 0,
        claimBaht: 0,
        compCount: 0,
        compBaht: 0,
      };
    }

    // sum from items
    for (const item of unit.รายการ) {
      const key = SERVICE_KEY_MAP[item.รายการขอเบิก];
      if (!key || !services[key]) continue;
      services[key].claimCount += item.จำนวน;
      services[key].claimBaht += item.เรียกเก็บ;
      if (item.สถานะ === "ชดเชย") {
        services[key].compCount += item.จำนวน;
        services[key].compBaht += item.ชดเชย;
      }
    }

    return {
      hcode: unit.hcodeKey,
      name: unit.หน่วยบริการ,
      isHospital: unit.isHospital,
      totalBaht: unit.เรียกเก็บ,
      services,
    };
  });
}

// ─── SvcCells ─────────────────────────────────────────────────────────────────

function SvcCells({ stat }: { stat: SvcStat }) {
  const noComp =
    stat.claimBaht > 0 && stat.compBaht === 0 && stat.claimCount > 0;

  return (
    <>
      {/* เรียกเก็บ */}
      <td
        className={`px-2 py-1.5 text-right tabular-nums text-xs border-r border-gray-200 ${
          stat.claimCount === 0 ? "text-gray-300" : "text-gray-700"
        }`}
      >
        {stat.claimCount === 0 ? "—" : fmtN(stat.claimCount)}
      </td>
      <td
        className={`px-2 py-1.5 text-right tabular-nums text-xs border-r-2 border-gray-300 ${
          stat.claimBaht === 0
            ? "text-gray-300"
            : noComp
            ? "bg-amber-50 text-amber-900 font-medium"
            : "text-gray-700"
        }`}
      >
        {stat.claimBaht === 0 ? "—" : fmtB(stat.claimBaht)}
      </td>
      {/* ชดเชย */}
      <td
        className={`px-2 py-1.5 text-right tabular-nums text-xs border-r border-gray-200 ${
          stat.compCount === 0 ? "text-gray-300" : "text-[#236b43]"
        }`}
      >
        {stat.compCount === 0 ? (noComp ? "0" : "—") : fmtN(stat.compCount)}
      </td>
      <td
        className={`px-2 py-1.5 text-right tabular-nums text-xs border-r-2 border-gray-300 ${
          stat.compBaht === 0 && stat.claimBaht > 0
            ? "text-red-500 font-bold bg-red-50"
            : stat.compBaht === 0
            ? "text-gray-300"
            : "text-[#236b43] font-medium"
        }`}
      >
        {stat.compBaht === 0
          ? noComp
            ? "0.00"
            : "—"
          : fmtB(stat.compBaht)}
      </td>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  data: KtbDashboardData;
}

export default function KtbCrossTab({ data }: Props) {
  const rows = useMemo(() => buildRows(data.units), [data]);

  const totals = useMemo<TotalsType>(() => {
    const services: Record<string, SvcStat> = Object.fromEntries(
      SERVICE_COLS.map((s) => [
        s.key,
        { claimCount: 0, claimBaht: 0, compCount: 0, compBaht: 0 },
      ])
    );
    let totalBaht = 0;

    for (const row of rows) {
      totalBaht += row.totalBaht;
      for (const svc of SERVICE_COLS) {
        services[svc.key].claimCount += row.services[svc.key].claimCount;
        services[svc.key].claimBaht += row.services[svc.key].claimBaht;
        services[svc.key].compCount += row.services[svc.key].compCount;
        services[svc.key].compBaht += row.services[svc.key].compBaht;
      }
    }

    return { totalBaht, services };
  }, [rows]);

  const thBase =
    "px-2 py-2 text-white font-semibold text-[11px] text-center border border-[#a8d5ba]";
  const thTop = `${thBase} bg-[#1a5233]`;
  const thMid = `${thBase} bg-[#236b43]`;
  const thSub = `${thBase} bg-[#7ec8a0] text-[10px] text-[#1a5233]`;

  // แยก รพ กับ รพสต
  const hospitalRows = rows.filter((r) => r.isHospital);
  const rphstRows = rows.filter((r) => !r.isHospital);

  const renderRow = (row: RowData, i: number) => (
    <tr
      key={row.hcode}
      className={`border-b border-gray-200 transition-colors hover:bg-[#f0faf4] ${
        i % 2 === 0 ? "bg-white" : "bg-gray-50/40"
      }`}
    >
      {/* รหัส */}
      <td className="px-2 py-1.5 text-center text-xs font-medium text-[#1a5233] bg-[#f0faf4] border-r border-gray-200">
        {row.hcode}
      </td>
      {/* ชื่อ */}
      <td
        className={`px-2 py-1.5 text-left text-xs font-medium border-r border-gray-200 ${
          row.isHospital ? "text-blue-800 bg-blue-50" : "text-gray-700"
        }`}
      >
        {row.name}
      </td>
      {/* รวม */}
      <td
        className={`px-2 py-1.5 text-right tabular-nums text-xs font-bold border-r-2 border-gray-300 ${
          row.isHospital ? "text-blue-800 bg-blue-50" : "text-[#1a5233]"
        }`}
      >
        {fmtB(row.totalBaht)}
      </td>
      {/* services */}
      {SERVICE_COLS.map((svc) => (
        <SvcCells key={svc.key} stat={row.services[svc.key]} />
      ))}
    </tr>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-bold text-gray-600">
            KTB รพสต.บริการ 2568 ชดเชย 2569 — แยกตามประเภทบริการ
          </h4>
          <p className="text-[11px] text-gray-400 mt-0.5">
            สรุปยอดเรียกเก็บ vs ชดเชย แยกตามหน่วยบริการและประเภทบริการ
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-3 text-[10px]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block" />
          มีเรียกเก็บแต่ชดเชย 0 (ติด ERR)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-50 border border-red-300 inline-block" />
          ชดเชย 0 บาท
        </span>
      </div>

      <div className="overflow-x-auto">
        <table
          className="border-collapse text-xs"
          style={{ minWidth: "900px" }}
        >
          <thead>
            {/* Row 1: header หลัก */}
            <tr>
              <th className={thTop} rowSpan={3} style={{ minWidth: 56 }}>
                รหัส
                <br />
                หน่วยบริการ
              </th>
              <th
                className={thTop}
                rowSpan={3}
                style={{ minWidth: 140, textAlign: "left" }}
              >
                ชื่อหน่วยบริการ
              </th>
              <th className={thTop} rowSpan={3} style={{ minWidth: 80 }}>
                รวม (บาท)
              </th>
              {SERVICE_COLS.map((s) => (
                <th key={s.key} className={thTop} colSpan={4}>
                  {s.label}
                  <br />
                  <span style={{ fontSize: 9, fontWeight: 400 }}>
                    {s.sublabel}
                  </span>
                </th>
              ))}
            </tr>

            {/* Row 2: เรียกเก็บ / ชดเชย */}
            <tr>
              {SERVICE_COLS.map((s) => (
                <React.Fragment key={s.key}>
                  <th className={thMid} colSpan={2}>
                    เรียกเก็บ
                  </th>
                  <th className={thMid} colSpan={2}>
                    ชดเชย
                  </th>
                </React.Fragment>
              ))}
            </tr>

            {/* Row 3: รายการ / บาท */}
            <tr>
              {SERVICE_COLS.map((s) => (
                <React.Fragment key={s.key}>
                  <th className={thSub}>รายการ</th>
                  <th className={thSub}>บาท</th>
                  <th className={thSub}>รายการ</th>
                  <th className={thSub}>บาท</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* ─── โรงพยาบาล ─────────────────────────────────────────── */}
            {hospitalRows.length > 0 && (
              <>
                <tr>
                  <td
                    colSpan={3 + SERVICE_COLS.length * 4}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-700 bg-blue-50 border-b border-blue-100"
                  >
                    🏥 โรงพยาบาล
                  </td>
                </tr>
                {hospitalRows.map((row, i) => renderRow(row, i))}
              </>
            )}

            {/* ─── รพสต ───────────────────────────────────────────────── */}
            {rphstRows.length > 0 && (
              <>
                <tr>
                  <td
                    colSpan={3 + SERVICE_COLS.length * 4}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-green-700 bg-green-50 border-b border-green-100"
                  >
                    🏨 โรงพยาบาลส่งเสริมสุขภาพตำบล (รพ.สต.)
                  </td>
                </tr>
                {rphstRows.map((row, i) => renderRow(row, i))}
              </>
            )}
          </tbody>

          {/* Footer รวม */}
          <tfoot>
            <tr className="bg-[#d6f0e0] border-t-2 border-[#55b882]">
              <td className="px-2 py-2 text-xs font-bold text-[#1a5233] text-center">
                รวม
              </td>
              <td className="px-2 py-2 text-xs font-bold text-[#1a5233]">
                รวมทั้งหมด
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-xs font-extrabold text-[#1a5233] border-r-2 border-gray-300">
                {fmtB(totals.totalBaht)}
              </td>
              {SERVICE_COLS.map((svc) => {
                const t = totals.services[svc.key];
                return (
                  <React.Fragment key={svc.key}>
                    <td className="px-2 py-2 text-right tabular-nums text-xs font-bold text-[#1a5233]">
                      {t.claimCount === 0 ? "—" : fmtN(t.claimCount)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-xs font-bold text-[#1a5233] border-r-2 border-gray-300">
                      {t.claimBaht === 0 ? "—" : fmtB(t.claimBaht)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-xs font-bold text-[#1a5233]">
                      {t.compCount === 0 ? "—" : fmtN(t.compCount)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-xs font-bold text-[#1a5233] border-r-2 border-gray-300">
                      {t.compBaht === 0 ? "—" : fmtB(t.compBaht)}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>

            {/* Footer รพสต รวม */}
            {rphstRows.length > 0 && (() => {
              const rphstTotalBaht = rphstRows.reduce((s, r) => s + r.totalBaht, 0);
              const rphstSvc: Record<string, SvcStat> = Object.fromEntries(
                SERVICE_COLS.map((s) => [s.key, { claimCount: 0, claimBaht: 0, compCount: 0, compBaht: 0 }])
              );
              for (const row of rphstRows) {
                for (const svc of SERVICE_COLS) {
                  rphstSvc[svc.key].claimCount += row.services[svc.key].claimCount;
                  rphstSvc[svc.key].claimBaht += row.services[svc.key].claimBaht;
                  rphstSvc[svc.key].compCount += row.services[svc.key].compCount;
                  rphstSvc[svc.key].compBaht += row.services[svc.key].compBaht;
                }
              }
              return (
                <tr className="bg-green-50 border-t border-green-200">
                  <td className="px-2 py-1.5 text-[11px] font-bold text-green-700 text-center">
                    รพสต
                  </td>
                  <td className="px-2 py-1.5 text-[11px] font-bold text-green-700">
                    รวม รพ.สต. ทั้งหมด
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-[11px] font-bold text-green-700 border-r-2 border-gray-300">
                    {fmtB(rphstTotalBaht)}
                  </td>
                  {SERVICE_COLS.map((svc) => {
                    const t = rphstSvc[svc.key];
                    return (
                      <React.Fragment key={svc.key}>
                        <td className="px-2 py-1.5 text-right tabular-nums text-[11px] font-bold text-green-700">
                          {t.claimCount === 0 ? "—" : fmtN(t.claimCount)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-[11px] font-bold text-green-700 border-r-2 border-gray-300">
                          {t.claimBaht === 0 ? "—" : fmtB(t.claimBaht)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-[11px] font-bold text-green-700">
                          {t.compCount === 0 ? "—" : fmtN(t.compCount)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-[11px] font-bold text-green-700 border-r-2 border-gray-300">
                          {t.compBaht === 0 ? "—" : fmtB(t.compBaht)}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              );
            })()}
          </tfoot>
        </table>
      </div>

      <p className="text-[10px] text-gray-400 mt-3">
        * ช่องสีเหลือง = มีเรียกเก็บแต่ชดเชย 0 บาท (ติด ERR) · ช่องสีแดง =
        ชดเชย 0 บาท ทั้งที่มีรายการ
      </p>
    </div>
  );
}