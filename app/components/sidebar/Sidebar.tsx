"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, LayoutDashboard, FileText, Stethoscope } from "lucide-react";

import NavGroup from "./NavGroup";
import {
    DASHBOARD_ITEMS,
    REPORT_ITEMS,
    PPA_ITEMS
} from "./sidebarMenu";

export default function Sidebar() {

    const pathname = usePathname();
    const router = useRouter();

    const [dashboardOpen, setDashboardOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [ppaOpen, setPpaOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {

        if (pathname?.startsWith("/pages/ppa")) setPpaOpen(true);
        if (REPORT_ITEMS.some(i => pathname === i.href)) setReportOpen(true);
        if (DASHBOARD_ITEMS.some(i => pathname === i.href)) setDashboardOpen(true);

    }, [pathname]);

    const isAnyActive = (items: any[]) =>
        items.some(i => pathname === i.href || pathname?.startsWith(i.href));

    const handleLogout = async () => {

        setLoggingOut(true);

        await fetch("/api/logout", {
            method: "POST",
            credentials: "include"
        });

        router.replace("/auth/login");

    };

    return (

        <aside className="flex flex-col w-60 h-screen bg-white border-r border-gray-300">

            <nav className="flex-1 px-4 py-6 space-y-1 text-sm overflow-y-auto">

                <NavGroup
                    label="Dashboard"
                    icon={LayoutDashboard}
                    items={DASHBOARD_ITEMS}
                    isOpen={dashboardOpen}
                    onToggle={() => setDashboardOpen(v => !v)}
                    isActive={isAnyActive(DASHBOARD_ITEMS)}
                />

                <NavGroup
                    label="รายงาน"
                    icon={FileText}
                    items={REPORT_ITEMS}
                    isOpen={reportOpen}
                    onToggle={() => setReportOpen(v => !v)}
                    isActive={isAnyActive(REPORT_ITEMS)}
                />

                <NavGroup
                    label="PPA"
                    icon={Stethoscope}
                    items={PPA_ITEMS}
                    isOpen={ppaOpen}
                    onToggle={() => setPpaOpen(v => !v)}
                    isActive={isAnyActive(PPA_ITEMS)}
                />

            </nav>

            <div className="border-t border-gray-200 p-4">

                <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex items-center justify-center gap-2 w-full bg-green-800 hover:bg-green-900 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow"
                >

                    <LogOut size={16} />

                    {loggingOut ? "กำลังออก..." : "Logout"}

                </button>

            </div>

        </aside>

    );
}