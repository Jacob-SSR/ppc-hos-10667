// app/pages/billing-dashboard/components/BillingChartTooltip.tsx
"use client";

import { fmt, fmtB, SERVICE_COLORS } from "./billing.constants";
import type { ServiceKey } from "./billing.constants";

interface ServiceBreakdown {
  name: string;
  label: string;
  claim: number;
  comp: number;
  pending: number;
}

interface TooltipPayload {
  payload?: {
    เรียกเก็บ?: number;
    ชดเชย?: number;
    ไม่?: number;
    serviceCount?: number;
    serviceBreakdown?: ServiceBreakdown[];
  };
}

interface BillingChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  selectedService: ServiceKey;
}

export function BillingChartTooltip({
  active,
  payload,
  label,
  selectedService,
}: BillingChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const unitData = payload[0]?.payload;
  if (!unitData) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-xs min-w-[260px] max-w-[320px]">
      <p className="font-bold text-gray-800 text-sm mb-3 pb-2 border-b border-gray-100">
        {label}
      </p>

      {selectedService === "รวมทั้งหมด" ? (
        // โหมดรวม — แสดงแต่ละบริการ
        <div className="space-y-3">
          {unitData.serviceBreakdown?.map((svc) => (
            <div key={svc.name} className="space-y-1">
              <p className="font-semibold text-gray-700 text-[11px]">{svc.label}</p>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-blue-400 shrink-0" />
                  <span className="text-gray-500">เรียกเก็บ</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-green-400 shrink-0" />
                  <span className="text-gray-500">ชดเชย</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-red-300 shrink-0" />
                  <span className="text-gray-500">ไม่ชดเชย</span>
                </div>
                <span className="font-bold text-blue-600 tabular-nums">{fmtB(svc.claim)}</span>
                <span className="font-bold text-green-600 tabular-nums">{fmtB(svc.comp)}</span>
                <span className="font-bold text-red-500 tabular-nums">{fmtB(svc.pending)}</span>
              </div>
            </div>
          ))}

          {/* รวม */}
          <div className="pt-2 border-t border-gray-200 space-y-1">
            <p className="font-bold text-gray-800 text-[11px]">รวมทั้งหมด</p>
            <div className="grid grid-cols-3 gap-1 text-[10px]">
              <span className="font-bold text-blue-700 tabular-nums">
                {fmtB(unitData.เรียกเก็บ ?? 0)}
              </span>
              <span className="font-bold text-green-700 tabular-nums">
                {fmtB(unitData.ชดเชย ?? 0)}
              </span>
              <span className="font-bold text-red-600 tabular-nums">
                {fmtB(unitData.ไม่ ?? 0)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        // โหมดบริการเฉพาะ
        <div className="space-y-2">
          <p className="font-semibold text-gray-600 text-[11px] mb-2">
            {SERVICE_COLORS[selectedService]?.label}
          </p>
          <div className="space-y-1.5">
            {(
              [
                { key: "เรียกเก็บ", dotColor: "bg-blue-400", textColor: "text-blue-700" },
                { key: "ชดเชย", dotColor: "bg-green-400", textColor: "text-green-700" },
                { key: "ไม่", dotColor: "bg-red-300", textColor: "text-red-600" },
              ] as const
            ).map(({ key, dotColor, textColor }) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-sm ${dotColor}`} />
                  <span className="text-gray-600">{key}</span>
                </div>
                <span className={`font-bold tabular-nums ${textColor}`}>
                  {fmtB(
                    (unitData as Record<string, number>)[key] ?? 0
                  )}{" "}
                  บาท
                </span>
              </div>
            ))}
          </div>

          {unitData.serviceCount != null && (
            <div className="pt-2 border-t border-gray-100 text-gray-500">
              จำนวน:{" "}
              <span className="font-bold text-gray-700">
                {fmt(unitData.serviceCount)} รายการ
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}