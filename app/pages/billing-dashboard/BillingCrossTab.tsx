"use client";

import React, { useMemo } from "react";
import type { BillingDashboardData, BillingItemSummary } from "@/types/allTypes";

const SERVICE_COLS: { key: string; label: string; sublabel: string }[] = [
  {
    key: "บริการฉีดวัคซีนพื้นฐานตามกาหนดการให้วัคซีนตามแผนงานสร้างเสริมภูมิคุ้มกันโรค (EPI) ของกระทรวงสาธารณสุข",
    label: "วัคซีน EPI พื้นฐาน",
    sublabel: "ตามแผนสร้างเสริมภูมิคุ้มกัน",
  },
  {
    key: "บริการควบคุมป้องกันและรักษาผู้ป่วยเบาหวาน หรือความดันโลหิตสูง",
    label: "ควบคุม DM/HT",
    sublabel: "เบาหวาน หรือความดันโลหิตสูง",
  },
  {
    key: "บริการฉีดวัคซีนคอตีบ-บาดทะยัก (dT) ในผู้ใหญ่",
    label: "วัคซีน dT",
    sublabel: "คอตีบ-บาดทะยักในผู้ใหญ่",
  },
  {
    key: "บริการผู้ป่วยเบาหวานชนิดที่ 2",
    label: "เบาหวานชนิดที่ 2",
    sublabel: "บริการผู้ป่วย DM T2",
  },
  {
    key: "บริการโรคความดันโลหิตสูง",
    label: "ความดันโลหิตสูง",
    sublabel: "บริการผู้ป่วย HT",
  },
];

const fmtN = (n: number) => n.toLocaleString("th-TH");
const fmtB = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface SvcStat {
  claimCount: number;
  claimBaht: number;
  compCount: number;
  compBaht: number;
}

// แยก type ให้ชัดเจน ไม่ใช้ intersection กับ Record<string, SvcStat>
interface TotalsType {
  totalBaht: number;
  services: Record<string, SvcStat>;
}

interface RowData {
  hcode: string;
  name: string;
  isHospital: boolean;
  totalBaht: number;
  services: Record<string, SvcStat>;
}

function buildRows(data: BillingDashboardData): RowData[] {
  return data.units.map((unit) => {
    const services: Record<string, SvcStat> = {};
    for (const svc of SERVICE_COLS) {
      const matching = unit.items.filter(
        (i: BillingItemSummary) => i.รายการขอเบิก === svc.key,
      );
      services[svc.key] = {
        claimCount: matching.reduce((s: number, i: BillingItemSummary) => s + i.จำนวน, 0),
        claimBaht: matching.reduce((s: number, i: BillingItemSummary) => s + i.เรียกเก็บ, 0),
        compCount: matching
          .filter((i: BillingItemSummary) => i.สถานะ === "ชดเชย")
          .reduce((s: number, i: BillingItemSummary) => s + i.จำนวน, 0),
        compBaht: matching.reduce((s: number, i: BillingItemSummary) => s + i.ชดเชย, 0),
      };
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

function SvcCells({ stat, warnIfNoComp }: { stat: SvcStat; warnIfNoComp?: boolean }) {
  const noComp = warnIfNoComp && stat.claimBaht > 0 && stat.compBaht === 0;
  const warnCls = "bg-amber-50 text-amber-900";

  return (
    <>
      <td className={`px-2 py-1.5 text-right tabular-nums text-xs ${stat.claimCount === 0 ? "text-gray-300" : "text-gray-700"}`}>
        {fmtN(stat.claimCount)}
      </td>
      <td className={`px-2 py-1.5 text-right tabular-nums text-xs border-r-2 border-gray-300 ${stat.claimBaht === 0 ? "text-gray-300" : noComp ? warnCls : "text-gray-700"}`}>
        {fmtB(stat.claimBaht)}
      </td>
      <td className={`px-2 py-1.5 text-right tabular-nums text-xs ${stat.compCount === 0 ? "text-gray-300" : "text-[#236b43]"}`}>
        {fmtN(stat.compCount)}
      </td>
      <td className={`px-2 py-1.5 text-right tabular-nums text-xs border-r-2 border-gray-300 ${stat.compBaht === 0 && stat.claimBaht > 0 ? "text-red-500" : stat.compBaht === 0 ? "text-gray-300" : "text-[#236b43] font-medium"}`}>
        {fmtB(stat.compBaht)}
      </td>
    </>
  );
}

interface Props {
  data: BillingDashboardData;
}

export default function BillingCrossTab({ data }: Props) {
  const rows = useMemo(() => buildRows(data), [data]);

  // แยก totalBaht และ services ออกจากกัน ไม่ต้อง intersection type
  const totals = useMemo<TotalsType>(() => {
    const services: Record<string, SvcStat> = Object.fromEntries(
      SERVICE_COLS.map((s) => [
        s.key,
        { claimCount: 0, claimBaht: 0, compCount: 0, compBaht: 0 },
      ]),
    );
    let totalBaht = 0;

    for (const row of rows) {
      totalBaht += row.totalBaht;
      for (const svc of SERVICE_COLS) {
        services[svc.key].claimCount += row.services[svc.key].claimCount;
        services[svc.key].claimBaht  += row.services[svc.key].claimBaht;
        services[svc.key].compCount  += row.services[svc.key].compCount;
        services[svc.key].compBaht   += row.services[svc.key].compBaht;
      }
    }

    return { totalBaht, services };
  }, [rows]);

  const thBase = "px-2 py-2 text-white font-medium text-[11px] text-center border border-[#a8d5ba]";
  const thTop  = `${thBase} bg-[#1a5233]`;
  const thMid  = `${thBase} bg-[#236b43]`;
  const thSub  = `${thBase} bg-[#7ec8a0] text-[10px] text-[#1a5233]`;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-gray-600">
          จัดสรรผลงานบริการ - MOPH CLAIM
        </h4>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs" style={{ minWidth: "900px" }}>
          <thead>
            {/* Row 1: หัวหลัก */}
            <tr>
              <th className={thTop} rowSpan={3} style={{ minWidth: 56 }}>
                รหัส<br />หน่วยบริการ
              </th>
              <th className={thTop} rowSpan={3} style={{ minWidth: 130, textAlign: "left" }}>
                ชื่อหน่วยบริการ
              </th>
              <th className={thTop} rowSpan={3} style={{ minWidth: 76 }}>
                รวม (บาท)
              </th>
              {SERVICE_COLS.map((s) => (
                <th key={s.key} className={thTop} colSpan={4}>
                  {s.label}
                  <br />
                  <span style={{ fontSize: 9, fontWeight: 400 }}>{s.sublabel}</span>
                </th>
              ))}
            </tr>

            {/* Row 2: เรียกเก็บ / ชดเชย */}
            <tr>
              {SERVICE_COLS.map((s) => (
                <React.Fragment key={s.key}>
                  <th className={thMid} colSpan={2}>เรียกเก็บ</th>
                  <th className={thMid} colSpan={2}>ชดเชย</th>
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
            {rows.map((row, i) => (
              <tr
                key={row.hcode}
                className={`border-b border-gray-200 transition-colors hover:bg-[#f0faf4] ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
              >
                <td className="px-2 py-1.5 text-center text-xs font-medium text-[#1a5233] bg-[#f0faf4]">
                  {row.hcode}
                </td>
                <td className={`px-2 py-1.5 text-left text-xs font-medium ${row.isHospital ? "text-blue-800 bg-blue-50" : "text-gray-700"}`}>
                  {row.name}
                </td>
                <td className={`px-2 py-1.5 text-right tabular-nums text-xs font-medium border-r-2 border-gray-300 ${row.isHospital ? "text-blue-800 bg-blue-50" : "text-[#1a5233]"}`}>
                  {fmtB(row.totalBaht)}
                </td>
                {SERVICE_COLS.map((s) => (
                  <SvcCells
                    key={s.key}
                    stat={row.services[s.key]}
                    warnIfNoComp={s.key.includes("เบาหวาน หรือความดัน")}
                  />
                ))}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="bg-[#d6f0e0] border-t-2 border-[#55b882]">
              <td className="px-2 py-2 text-xs font-medium text-[#1a5233] text-center">รวม</td>
              <td className="px-2 py-2 text-xs font-medium text-[#1a5233] text-left">รวมทั้งหมด</td>
              <td className="px-2 py-2 text-right tabular-nums text-xs font-medium text-[#1a5233] border-r-2 border-gray-300">
                {fmtB(totals.totalBaht)}
              </td>
              {SERVICE_COLS.map((s) => {
                const t = totals.services[s.key];
                return (
                  <React.Fragment key={s.key}>
                    <td className="px-2 py-2 text-right tabular-nums text-xs font-medium text-[#1a5233]">
                      {fmtN(t.claimCount)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-xs font-medium text-[#1a5233] border-r-2 border-gray-300">
                      {fmtB(t.claimBaht)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-xs font-medium text-[#1a5233]">
                      {fmtN(t.compCount)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-xs font-medium text-[#1a5233] border-r-2 border-gray-300">
                      {fmtB(t.compBaht)}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[10px] text-gray-400 mt-2">
        * ช่องสีเหลือง = มีการเรียกเก็บแต่ได้รับชดเชย 0 บาท (ติด ERR) · ช่องสีแดง = ชดเชย 0 มีเรียกเก็บ
      </p>
    </div>
  );
}