// app/pages/billing-dashboard/components/BillingBarChart.tsx
"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import type { BillingDashboardData, BillingItemSummary } from "@/types/allTypes";

import { BillingServiceFilter } from "./BillingServiceFilter";
import { BillingChartTooltip } from "./BillingChartTooltip";
import { BillingServiceSummary } from "./BillingServiceSummary";
import {
  SHORT_LABELS,
  SERVICE_COLORS,
  ALL_SERVICES,
} from "./billing.constants";
import type { ServiceKey } from "./billing.constants";

interface Props {
  data: BillingDashboardData;
}

export default function BillingBarChart({ data }: Props) {
  const [selectedService, setSelectedService] = useState<ServiceKey>("รวมทั้งหมด");

  const chartData = useMemo(() => {
    return data.units.map((unit) => {
      const shortName = unit.หน่วยบริการ
        .replace("โรงพยาบาล", "รพ.")
        .replace("รพ.สต.", "รพสต.");

      if (selectedService === "รวมทั้งหมด") {
        // breakdown สำหรับ tooltip
        const serviceBreakdown = Object.entries(SHORT_LABELS).map(
          ([fullKey, shortKey]) => {
            const matching = unit.items.filter(
              (i: BillingItemSummary) => i.รายการขอเบิก === fullKey,
            );
            const claim = matching.reduce(
              (s: number, i: BillingItemSummary) => s + i.เรียกเก็บ,
              0,
            );
            const comp = matching.reduce(
              (s: number, i: BillingItemSummary) => s + i.ชดเชย,
              0,
            );
            return {
              name: shortKey,
              label: SERVICE_COLORS[shortKey]?.label ?? shortKey,
              claim,
              comp,
              pending: Math.max(0, claim - comp),
            };
          },
        ).filter((svc) => svc.claim > 0);

        return {
          name: shortName,
          เรียกเก็บ: unit.เรียกเก็บ,
          ชดเชย: unit.ชดเชย,
          ไม่ชดเชย: Math.max(0, unit.เรียกเก็บ - unit.ชดเชย),
          serviceBreakdown,
          isHospital: unit.isHospital,
        };
      }

      // กรองเฉพาะบริการที่เลือก
      const fullKey = Object.entries(SHORT_LABELS).find(
        ([, v]) => v === selectedService,
      )?.[0];
      const matching = fullKey
        ? unit.items.filter(
          (i: BillingItemSummary) => i.รายการขอเบิก === fullKey,
        )
        : [];
      const claim = matching.reduce(
        (s: number, i: BillingItemSummary) => s + i.เรียกเก็บ,
        0,
      );
      const comp = matching.reduce(
        (s: number, i: BillingItemSummary) => s + i.ชดเชย,
        0,
      );
      const count = matching.reduce(
        (s: number, i: BillingItemSummary) => s + i.จำนวน,
        0,
      );

      return {
        name: shortName,
        เรียกเก็บ: claim,
        ชดเชย: comp,
        ไม่ชดเชย: Math.max(0, claim - comp),
        serviceCount: count,
        isHospital: unit.isHospital,
      };
    });
  }, [data, selectedService]);

  const colors = SERVICE_COLORS[selectedService] ?? SERVICE_COLORS["รวมทั้งหมด"];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      {/* Header + Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h4 className="text-sm font-bold text-gray-600">
          เรียกเก็บ vs ชดเชย — แยกตามหน่วยบริการ
        </h4>
        <BillingServiceFilter
          selected={selectedService}
          onChange={setSelectedService}
        />
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 flex-wrap items-center">
        {[
          {
            color: colors.claim,
            label: `เรียกเก็บ${selectedService !== "รวมทั้งหมด" ? ` (${selectedService})` : ""}`,
          },
          {
            color: colors.comp,
            label: `ชดเชย${selectedService !== "รวมทั้งหมด" ? ` (${selectedService})` : ""}`,
          },
          { color: colors.pending, label: "ไม่ชดเชย" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ background: l.color }}
            />
            {l.label}
          </span>
        ))}
        <span className="text-xs text-gray-400 ml-auto italic">
          💡 Hover เพื่อดูรายละเอียด
          {selectedService === "รวมทั้งหมด" ? "แต่ละบริการ" : "และจำนวนรายการ"}
        </span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="28%"
          barGap={4}
        >
          <CartesianGrid vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
          />
          <Tooltip
            content={
              <BillingChartTooltip selectedService={selectedService} />
            }
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />
          <Bar dataKey="เรียกเก็บ" fill={colors.claim} radius={[3, 3, 0, 0]} />
          <Bar dataKey="ชดเชย" fill={colors.comp} radius={[3, 3, 0, 0]} />
          <Bar dataKey="ไม่ชดเชย" fill={colors.pending} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Summary ด้านล่าง (เฉพาะเมื่อเลือกบริการเฉพาะ) */}
      <BillingServiceSummary
        selectedService={selectedService}
        chartData={chartData}
      />
    </div>
  );
}