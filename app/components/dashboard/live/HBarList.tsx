// app/components/dashboard/live/HBarList.tsx
// รวม HBarChart (accident) + HBarList (drug/sepsis/homeward) เป็นตัวเดียว
// รับได้ทั้ง array ของ [label, count] (แบบ Object.entries) และ {label, count}
"use client";

import { motion } from "framer-motion";

type Datum = [string, number] | { label: string; count: number };

interface Props {
  data: Datum[];
  /** สีตาม index (วนรอบ) */
  colors?: string[];
  /** สีตามชื่อ label (override colors) */
  colorMap?: Record<string, string>;
  /** ถ้าส่ง total มา จะโชว์ % ต่อท้าย */
  total?: number;
  /** ความกว้าง label column (px) */
  labelWidth?: number;
}

function normalize(d: Datum): { label: string; count: number } {
  return Array.isArray(d) ? { label: d[0], count: d[1] } : d;
}

const DEFAULT_COLOR = "#85B7EB";

export function HBarList({ data, colors, colorMap, total, labelWidth = 110 }: Props) {
  const rows = data.map(normalize);
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="space-y-2">
      {rows.map(({ label, count }, i) => {
        const color =
          colorMap?.[label] ??
          colors?.[i % colors.length] ??
          DEFAULT_COLOR;
        const pct = total ? Math.round((count / total) * 100) : 0;

        return (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span
              className="text-right shrink-0 text-gray-500 truncate leading-tight"
              style={{ width: labelWidth }}
              title={label}
            >
              {label}
            </span>
            <div className="flex-1 h-5 rounded bg-gray-100 overflow-hidden">
              <motion.div
                className="h-full rounded"
                style={{ backgroundColor: color }}
                initial={{ width: 0 }}
                animate={{ width: `${(count / max) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.03 }}
              />
            </div>
            <span
              className="text-right font-bold text-gray-700 tabular-nums shrink-0"
              style={{ minWidth: 24 }}
            >
              {count}
              {total ? ` (${pct}%)` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
