// app/pages/billing-dashboard/components/BillingServiceFilter.tsx
"use client";

import { ALL_SERVICES, SERVICE_COLORS } from "./billing.constants";
import type { ServiceKey } from "./billing.constants";

interface BillingServiceFilterProps {
  selected: ServiceKey;
  onChange: (svc: ServiceKey) => void;
}

export function BillingServiceFilter({ selected, onChange }: BillingServiceFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-400 font-medium">ประเภทบริการ:</span>
      <div className="flex flex-wrap gap-1.5">
        {ALL_SERVICES.map((svc) => {
          const isActive = selected === svc;
          const activeColor =
            svc === "รวมทั้งหมด"
              ? "#1a5233"
              : (SERVICE_COLORS[svc]?.claim ?? "#1a5233");

          return (
            <button
              key={svc}
              onClick={() => onChange(svc)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 border"
              style={{
                backgroundColor: isActive ? activeColor : "white",
                color: isActive ? "white" : "#374151",
                borderColor: isActive ? activeColor : "#d1d5db",
              }}
            >
              {svc}
            </button>
          );
        })}
      </div>
    </div>
  );
}