const DEPT_PALETTE = [
  "#1e6fd9",
  "#dc2626",
  "#16a34a",
  "#7c3aed",
  "#0aa7a0",
  "#d97706",
  "#db2777",
  "#0284c7",
  "#65a30d",
  "#9333ea",
];

const cache: Record<string, string> = {};
let idx = 0;

export function resetDeptColors() {
  Object.keys(cache).forEach((k) => delete cache[k]);
  idx = 0;
}

export function getDeptColor(dept: string): string {
  if (!dept) return "#6b7280";
  if (!cache[dept]) {
    cache[dept] = DEPT_PALETTE[idx % DEPT_PALETTE.length];
    idx++;
  }
  return cache[dept];
}
