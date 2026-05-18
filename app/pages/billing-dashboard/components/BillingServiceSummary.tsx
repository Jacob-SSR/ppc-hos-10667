// app/pages/billing-dashboard/components/BillingServiceSummary.tsx
"use client";

import { fmtB, SERVICE_COLORS } from "./billing.constants";
import type { ServiceKey } from "./billing.constants";

interface ChartRow {
  เรียกเก็บ: number;
  ชดเชย: number;
  ยังไม่ได้รับ: number;
  serviceCount?: number;
}

interface BillingServiceSummaryProps {
  selectedService: ServiceKey;
  chartData: ChartRow[];
}

export function BillingServiceSummary({
  selectedService,
  chartData,
}: BillingServiceSummaryProps) {
  if (selectedService === "รวมทั้งหมด") return null;

  const totals = chartData.reduce(
    (acc, row) => ({
      claim: acc.claim + (row.เรียกเก็บ ?? 0),
      comp: acc.comp + (row.ชดเชย ?? 0),
      pending: acc.pending + (row.ยังไม่ได้รับ ?? 0),
      count: acc.count + (row.serviceCount ?? 0),
    }),
    { claim: 0, comp: 0, pending: 0, count: 0 },
  );

  const stats = [
    {
      label: "รวมเรียกเก็บ",
      value: fmtB(totals.claim),
      color: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
    {
      label: "รวมชดเชย",
      value: fmtB(totals.comp),
      color: "text-green-700",
      bg: "bg-green-50",
      border: "border-green-100",
    },
    {
      label: "ยังไม่ได้รับ",
      value: fmtB(totals.pending),
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-100",
    },
  ];

  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      <p className="text-xs font-bold text-gray-500 mb-2">
        สรุป: {SERVICE_COLORS[selectedService]?.label}
        {totals.count > 0 && (
          <span className="ml-2 font-normal text-gray-400">
            ({totals.count.toLocaleString("th-TH")} รายการ)
          </span>
        )}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`${s.bg} border ${s.border} rounded-xl px-3 py-2.5 text-center`}
          >
            <p className="text-[10px] text-gray-500 font-medium mb-1">{s.label}</p>
            <p className={`text-sm font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-400">บาท</p>
          </div>
        ))}
      </div>
    </div>
  );
}