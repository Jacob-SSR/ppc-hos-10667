// components/ui/Shimmer.tsx
// แทนที่ทุก: <div className="h-xx bg-gray-200 animate-pulse rounded-xl" />
// และ Shimmer() ที่เขียนซ้ำใน OpdSection, IpdSection, ShiftStatsPage, BedOccupancyChart

interface ShimmerProps {
  className?: string;
  /** ความสูง เช่น "h-40" "h-[190px]" — default "h-40" */
  h?: string;
}

export function Shimmer({ className = "", h = "h-40" }: ShimmerProps) {
  return (
    <div className={`${h} ${className} rounded-xl bg-gray-100 animate-pulse`} />
  );
}

// ── ชุด Shimmer สำเร็จรูปที่ใช้บ่อย ──────────────────────────────────────────

/** Grid ของ Shimmer n ช่อง — ใช้แทน Array.from({ length: n }).map(Shimmer) */
export function ShimmerGrid({
  count,
  h = "h-[168px]",
  cols = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
}: {
  count: number;
  h?: string;
  cols?: string;
}) {
  return (
    <div className={`grid ${cols} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <Shimmer key={i} h={h} />
      ))}
    </div>
  );
}

/** Bar แนวนอนวิ่ง — ใช้แทน LoadingBar ใน TableHelpers */
export function ShimmerBar() {
  return (
    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mb-4">
      <div
        className="h-full bg-green-500 rounded-full animate-[shimmer-bar_1.2s_ease-in-out_infinite]"
        style={{ width: "40%", animation: "shimmer-bar 1.2s ease-in-out infinite" }}
      />
    </div>
  );
}

/*
  วิธีใช้:
  ─────────────────────────────────────────────────────────────────────────────
  import { Shimmer, ShimmerGrid, ShimmerBar } from "@/components/ui/Shimmer";

  // แทนที่ใน OpdSection (13 ช่อง):
  <ShimmerGrid count={13} />

  // แทนที่ใน IpdSection (8 ช่อง):
  <ShimmerGrid count={8} h="h-[190px]" cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />

  // แทนที่ใน ShiftStatsPage:
  <ShimmerGrid count={3} h="h-64" cols="grid-cols-1 md:grid-cols-3" />

  // แทนที่ใน BedOccupancyChart, HomeWardTable:
  <Shimmer h="h-[300px]" />

  // แทนที่ LoadingBar ใน ReportTable / PpaTable:
  <ShimmerBar />
  ─────────────────────────────────────────────────────────────────────────────
*/