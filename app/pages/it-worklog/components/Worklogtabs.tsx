"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    LayoutDashboard,
    LineChart,
    Timer,
    Wrench,
} from "lucide-react";

export type WorklogTabKey = "overview" | "charts" | "sla" | "solutions";

const TABS: { key: WorklogTabKey; label: string; icon: ReactNode }[] = [
    { key: "overview", label: "ภาพรวม", icon: <LayoutDashboard size={14} /> },
    { key: "charts", label: "กราฟ & แนวโน้ม", icon: <LineChart size={14} /> },
    { key: "sla", label: "SLA & ทันเวลา", icon: <Timer size={14} /> },
    { key: "solutions", label: "การแก้ไขปัญหา", icon: <Wrench size={14} /> },
];

type Props = Record<WorklogTabKey, ReactNode>;

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
            className={`flex items-center gap-1.5 px-3 md:px-4 py-2 text-[13px] whitespace-nowrap border-b-2 -mb-px transition-colors ${active
                    ? "border-[#236b43] text-[#1a5233] font-semibold"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
        >
            {icon}
            {children}
        </button>
    );
}

function TabsInner(props: Props) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const raw = searchParams.get("tab");
    const tab: WorklogTabKey = TABS.some((t) => t.key === raw)
        ? (raw as WorklogTabKey)
        : "overview";

    const setTab = (t: WorklogTabKey) => {
        router.replace(t === "overview" ? pathname : `${pathname}?tab=${t}`, {
            scroll: false,
        });
    };

    return (
        <div>
            {/* แถบแท็บ — sticky ไว้บนสุดเวลาสกอลล์ จะได้สลับได้ตลอด */}
            <div className="sticky top-0 z-10 bg-[#f7fbf9]/95 backdrop-blur-sm -mx-1 px-1">
                <div className="flex items-center border-b border-gray-200 overflow-x-auto">
                    {TABS.map((t) => (
                        <TabButton
                            key={t.key}
                            active={tab === t.key}
                            onClick={() => setTab(t.key)}
                            icon={t.icon}
                        >
                            {t.label}
                        </TabButton>
                    ))}
                </div>
            </div>

            <div className="mt-4 space-y-4">{props[tab]}</div>
        </div>
    );
}

export default function WorklogTabs(props: Props) {
    // useSearchParams ต้องอยู่ใต้ Suspense boundary ตามข้อกำหนดของ App Router
    return (
        <Suspense fallback={<div className="mt-4 space-y-4">{props.overview}</div>}>
            <TabsInner {...props} />
        </Suspense>
    );
}