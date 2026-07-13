"use client";

import dynamic from "next/dynamic";
import { RefreshCw } from "lucide-react";
import DashboardMapTabs from "@/app/components/DashboardMapTabs";
import Overview from "./OverviewView";

// โหลด Leaflet เฉพาะตอนผู้ใช้เปิดแท็บแผนที่ (ไม่ถ่วงแท็บภาพรวม)
const MapView = dynamic(() => import("./MapView"), {
    ssr: false,
    loading: () => (
        <div className="h-full flex items-center justify-center gap-2 text-gray-500 text-sm">
            <RefreshCw size={16} className="animate-spin" /> กำลังโหลดแผนที่…
        </div>
    ),
});

export default function Page() {
    return (
        <DashboardMapTabs
            overview={<Overview />}
            map={<MapView />}
            mapLabel="แผนที่บ้านผู้ป่วยอุบัติเหตุ"
        />
    );
}
