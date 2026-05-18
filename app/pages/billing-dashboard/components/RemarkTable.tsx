// app/pages/billing-dashboard/components/RemarkTable.tsx
"use client";

import { AlertTriangle } from "lucide-react";
import type { BillingDashboardData } from "@/types/allTypes";

const fmt = (n: number) => n.toLocaleString("th-TH");

interface RemarkTableProps {
  data: BillingDashboardData["remarkSummary"];
}

export function RemarkTable({ data }: RemarkTableProps) {
  if (!data.length) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={15} className="text-amber-600" />
        <h4 className="text-sm font-bold text-gray-600">สรุปรหัสหมายเหตุ / ข้อผิดพลาด</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-amber-600">
              {["รหัสหมายเหตุ", "หน่วยบริการ", "จำนวน", "เรียกเก็บ (฿)"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-white font-semibold border-r border-amber-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
              >
                <td className="px-3 py-2">
                  <span className="inline-block text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                    {row.รหัส}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700">{row.หน่วยบริการ}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-700">
                  {fmt(row.จำนวน)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-amber-800">
                  {fmt(row.เรียกเก็บ)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}