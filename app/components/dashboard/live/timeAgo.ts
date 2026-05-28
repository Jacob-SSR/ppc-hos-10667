// app/components/dashboard/live/timeAgo.ts
// เดิม copy เป๊ะ 4 ไฟล์ dashboard
export function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff} วินาทีที่แล้ว`;
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
}
