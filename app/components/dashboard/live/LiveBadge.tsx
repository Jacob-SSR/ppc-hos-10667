// app/components/dashboard/live/LiveBadge.tsx
// header bits ที่ซ้ำทุก dashboard: LIVE badge, ปุ่มรีเฟรชหมุน, Wifi/WifiOff
"use client";

import { motion } from "framer-motion";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

export function LiveBadge() {
  return (
    <span
      className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border"
      style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba", color: "#1a5233" }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
      LIVE
    </span>
  );
}

export function ConnectionStatus({
  error,
  connected,
}: {
  error?: boolean;
  connected?: boolean;
}) {
  if (error)
    return (
      <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
        <WifiOff size={13} />
        ไม่เชื่อมต่อ
      </span>
    );
  if (connected)
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
        <Wifi size={13} />
        เชื่อมต่อแล้ว
      </span>
    );
  return null;
}

export function RefreshButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
    >
      <motion.span
        animate={loading ? { rotate: 360 } : { rotate: 0 }}
        transition={loading ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}
      >
        <RefreshCw size={14} />
      </motion.span>
      รีเฟรช
    </button>
  );
}
