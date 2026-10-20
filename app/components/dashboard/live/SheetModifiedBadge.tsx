// app/components/dashboard/live/SheetModifiedBadge.tsx
// "ชีตแก้ไขล่าสุด ..." — เวลาที่มีคนแก้ Google Sheet จริง (จาก Drive API)
// ต่างจาก "อัปเดต x นาทีที่แล้ว" ที่เป็นเวลา server ดึงข้อมูลเข้า cache
"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { visibleInterval } from "@/lib/visibleInterval";
import type { SheetModifiedInfo, SheetSourceKey } from "@/lib/sheets/modified";

const POLL_MS = 120_000; // เท่ากับ TTL cache ฝั่ง server
const STALE_DAYS = 7; // ไม่มีใครแก้ชีตเกินนี้ → ขึ้นสีเตือน

/** "19 ต.ค. 69 09:30" (เวลาไทย) */
export function formatSheetTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isSheetStale(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > STALE_DAYS * 86_400_000;
}

/** keys ว่าง = ขอทุกชีต */
export function useSheetsModified(keys: SheetSourceKey[] = []) {
  const [items, setItems] = useState<SheetModifiedInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = keys.join(",");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const url = query ? `/api/sheets-modified?keys=${query}` : "/api/sheets-modified";
        const res = await fetch(url, { credentials: "include" });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
        if (!cancelled) {
          setItems(j.items as SheetModifiedInfo[]);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    };
    load();
    const stop = visibleInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, [query]);

  return { items, error };
}

/**
 * วางต่อท้ายบรรทัด "อัปเดต ..." ใน header ของ dashboard
 *   <SheetModifiedBadge sources={["stroke"]} />
 * หลายชีต (เช่นแท็บแผนที่ที่ใช้ชีตพิกัดด้วย) จะแสดงชื่อชีตกำกับแต่ละเวลา
 */
export function SheetModifiedBadge({
  sources,
  className = "",
  leadingDot = true,
  staleClassName = "text-amber-600 font-semibold",
}: {
  sources: SheetSourceKey[];
  className?: string;
  /** false = ไม่มี "·" นำหน้า (ใช้เมื่อ badge ไม่ได้ต่อท้ายข้อความอื่น) */
  leadingDot?: boolean;
  /** header พื้นเข้มส่งสีอ่อนกว่านี้มาแทน */
  staleClassName?: string;
}) {
  const { items } = useSheetsModified(sources);
  const shown = items?.filter((i) => i.modifiedAt) ?? [];
  if (shown.length === 0) return null; // ยังโหลด / Drive API ใช้ไม่ได้ → ไม่แสดงอะไร

  const multi = shown.length > 1;
  return (
    <span className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
      {leadingDot && <span>·</span>}
      <FileSpreadsheet size={10} />
      <span>ชีตแก้ไขล่าสุด</span>
      {shown.map((i, idx) => (
        <span
          key={i.key}
          title={`${i.label}: ${formatSheetTime(i.modifiedAt!)}`}
          className={isSheetStale(i.modifiedAt!) ? staleClassName : undefined}
        >
          {idx > 0 && ", "}
          {multi && `${i.label} `}
          {formatSheetTime(i.modifiedAt!)}
        </span>
      ))}
    </span>
  );
}
