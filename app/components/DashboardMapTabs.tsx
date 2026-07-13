"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, MapPinned } from "lucide-react";

/**
 * ห่อหน้า Dashboard + แผนที่ ให้อยู่หน้าเดียวกันแบบสลับแท็บ
 * - อ่าน/เขียนแท็บผ่าน query param `?tab=map` → แชร์ลิงก์ / bookmark / กด back ได้
 * - ฝั่งแผนที่ควรส่งเข้ามาแบบ next/dynamic (ssr: false) เพื่อ lazy-load Leaflet
 *   เฉพาะตอนผู้ใช้เปิดแท็บแผนที่เท่านั้น
 */
type Props = {
    overview: ReactNode;
    map: ReactNode;
    overviewLabel?: string;
    mapLabel?: string;
};

function TabButton({
    active,
    onClick,
    icon,
    children,
}: {
    active: boolean;
    onClick: () => void;
    icon: ReactNode;
    children: ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-4 py-2 text-[13px] border-b-2 -mb-px transition-colors ${
                active
                    ? "border-[#1ca887] text-[#0f6e56] font-semibold"
                    : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
        >
            {icon}
            {children}
        </button>
    );
}

function TabsInner({
    overview,
    map,
    overviewLabel = "ภาพรวม",
    mapLabel = "แผนที่บ้าน",
}: Props) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const tab = searchParams.get("tab") === "map" ? "map" : "overview";

    const setTab = (t: "overview" | "map") => {
        router.replace(t === "map" ? `${pathname}?tab=map` : pathname, {
            scroll: false,
        });
    };

    return (
        // แท็บแผนที่ต้องการความสูงเต็มพื้นที่ (h-full) ส่วนแท็บภาพรวมปล่อยให้ยาว
        // ตามเนื้อหาแล้ว scroll ที่ <main> ตามปกติ
        <div className={tab === "map" ? "h-full flex flex-col" : undefined}>
            <div className="flex items-center border-b border-gray-200 mb-4 shrink-0">
                <TabButton
                    active={tab === "overview"}
                    onClick={() => setTab("overview")}
                    icon={<LayoutDashboard size={14} />}
                >
                    {overviewLabel}
                </TabButton>
                <TabButton
                    active={tab === "map"}
                    onClick={() => setTab("map")}
                    icon={<MapPinned size={14} />}
                >
                    {mapLabel}
                </TabButton>
            </div>

            {tab === "map" ? (
                <div className="flex-1 min-h-0">{map}</div>
            ) : (
                <div>{overview}</div>
            )}
        </div>
    );
}

export default function DashboardMapTabs(props: Props) {
    // useSearchParams ต้องอยู่ใต้ Suspense boundary ตามข้อกำหนดของ App Router
    return (
        <Suspense fallback={<div>{props.overview}</div>}>
            <TabsInner {...props} />
        </Suspense>
    );
}
