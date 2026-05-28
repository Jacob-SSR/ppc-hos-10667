// app/components/dashboard/live/MiniPagination.tsx
// footer ก่อนหน้า/ถัดไป ที่ซ้ำใน PatientTable ของ drug/sepsis/homeward
"use client";

interface Props {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  /** จำนวนรายการรวม (โชว์ต่อท้าย "หน้า x / y") */
  count?: number;
}

export function MiniPagination({ page, totalPages, onChange, count }: Props) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
      <p className="text-xs text-gray-400">
        หน้า {page} / {totalPages}
        {count != null ? ` · ${count} รายการ` : ""}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 disabled:opacity-30 hover:bg-gray-50"
        >
          ← ก่อนหน้า
        </button>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 disabled:opacity-30 hover:bg-gray-50"
        >
          ถัดไป →
        </button>
      </div>
    </div>
  );
}
