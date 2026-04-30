// app/components/dashboard/components/WardCard.tsx
// แยกออกจาก IpdSection.tsx — card แสดง ward เดี่ยว

import { ArrowRight, BedDouble } from "lucide-react";
import type { WardDisplayItem } from "@/app/components/dashboard/types/dashboard.types";

interface WardCardProps {
  ward: WardDisplayItem;
}

export function WardCard({ ward }: WardCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center gap-2 shadow-sm">
      <p className="text-sm font-semibold text-gray-700 text-center">
        {ward.label}
      </p>
      <BedDouble size={52} strokeWidth={1.5} className="text-gray-800 my-1" />
      <p className="text-base font-bold text-gray-900 text-center">
        Admit {ward.admit}/{ward.totalBeds} เตียง
      </p>
      <p className="text-xs text-gray-500">({ward.vacantLabel})</p>
      <button className="flex items-center gap-1.5 border border-gray-300 rounded-full px-4 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors mt-1">
        รายละเอียด <ArrowRight size={12} />
      </button>
    </div>
  );
}