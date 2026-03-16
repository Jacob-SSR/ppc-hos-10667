"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutGrid, FileEdit, UserRound, LogOut,
    FileUser, UserCheck, ChevronDown,
    Baby, Stethoscope, Users, Activity, BarChart2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

const REPORT_ITEMS = [
    { label: "แก้ไขสิทธิ์หลัก 10667 เป็น CUP Split", href: "/pages/report", icon: FileEdit },
    { label: "คนไทยที่ยังไม่มี endpoint", href: "/pages/no-endpoint", icon: UserRound },
    { label: "UC ต่างจังหวัดที่มาทำฟัน", href: "/pages/uc-outside-dental", icon: FileUser },
    { label: "ผู้ป่วยนอก UC สิทธิ์ต่างจังหวัด", href: "/pages/uc-outside", icon: FileUser },
    { label: "ผู้รับบริการแต่ขึ้นทะเบียนบัตรทองที่อื่น", href: "/pages/service-unit", icon: UserCheck },
];

const DASHBOARD_ITEMS = [
    { label: "Overview", href: "/pages/dashboard", icon: LayoutGrid },
    { label: "สถิติผู้รับบริการแยกเวร", href: "/pages/shift-stats", icon: Activity },
];

const PPA_ITEMS = [
    { label: "Aging (ผู้สูงอายุ)", href: "/pages/ppa/aging", icon: Users, desc: "คัดกรองสมอง/หกล้ม อายุ ≥ 50 ปี" },
    { label: "NCD01 (คัดกรอง DM/HT)", href: "/pages/ppa/ncd01", icon: Stethoscope, desc: "ข้อมูลการคัดกรองโรคเรื้อรัง" },
    { label: "NCD02 (R73/R030)", href: "/pages/ppa/ncd02", icon: Stethoscope, desc: "วินิจฉัย R73 หรือ R030" },
    { label: "MCH01 (ANC)", href: "/pages/ppa/mch01", icon: Baby, desc: "บริการฝากครรภ์" },
    { label: "MCH02 (คลอด)", href: "/pages/ppa/mch02", icon: Baby, desc: "ข้อมูลการคลอด" },
    { label: "MCH03 (วางแผนครอบครัว)", href: "/pages/ppa/mch-woman", icon: Baby, desc: "คุมกำเนิด/วางแผนครอบครัว อายุ 15-49 ปี" },
    { label: "MCH04 (พัฒนาการเด็ก)", href: "/pages/ppa/mch04", icon: Baby, desc: "คัดกรองพัฒนาการเด็ก DSPM" },
];

// ── Reusable Group Dropdown ──
function NavGroup({
    label, icon, items, isOpen, onToggle, isActive,
}: {
    label: string;
    icon: React.ReactNode;
    items: { label: string; href: string; icon: any; desc?: string }[];
    isOpen: boolean;
    onToggle: () => void;
    isActive: boolean;
}) {
    const pathname = usePathname();
    const isItemActive = (href: string) =>
        pathname === href || pathname?.startsWith(href + "/");

    return (
        <div className="pt-1">
            <button
                onClick={onToggle}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-left
                    ${isActive || isOpen ? "bg-green-50 text-green-800 font-semibold" : "text-gray-600 hover:bg-gray-100 hover:text-black"}`}
            >
                <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-base">
                    {icon}
                </span>
                <span className="flex-1 leading-tight text-sm">{label}</span>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-4 h-4" />
                </motion.span>
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        key={`${label}-menu`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="overflow-hidden"
                    >
                        <div className="mt-1 ml-3 pl-3 border-l-2 border-green-200 space-y-0.5">
                            {items.map((item) => {
                                const active = isItemActive(item.href);
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-start gap-2 px-2 py-2 rounded-md transition-colors
                                            ${active ? "bg-green-100 text-green-800 font-semibold" : "text-gray-600 hover:bg-gray-100 hover:text-black"}`}
                                    >
                                        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-xs leading-tight">{item.label}</div>
                                            {item.desc && (
                                                <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{item.desc}</div>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);
    const [ppaOpen, setPpaOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [dashboardOpen, setDashboardOpen] = useState(false);

    useEffect(() => {
        if (pathname?.startsWith("/pages/ppa")) setPpaOpen(true);
        if (REPORT_ITEMS.some(i => pathname === i.href)) setReportOpen(true);
        if (DASHBOARD_ITEMS.some(i => pathname === i.href)) setDashboardOpen(true);
    }, [pathname]);

    const isAnyActive = (items: { href: string }[]) =>
        items.some(i => pathname === i.href || pathname?.startsWith(i.href + "/"));

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await fetch("/api/logout", { method: "POST", credentials: "include" });
        } finally {
            router.replace("/auth/login");
        }
    };

    return (
        <aside className="flex flex-col w-60 h-screen bg-white border-r border-gray-300">
            <nav className="flex-1 px-4 py-6 space-y-1 text-sm overflow-y-auto">

                {/* Dashboard Group */}
                <NavGroup
                    label="Dashboard"
                    icon="📊"
                    items={DASHBOARD_ITEMS}
                    isOpen={dashboardOpen}
                    onToggle={() => setDashboardOpen(v => !v)}
                    isActive={isAnyActive(DASHBOARD_ITEMS)}
                />

                {/* Report Group */}
                <NavGroup
                    label="รายงาน"
                    icon="📋"
                    items={REPORT_ITEMS}
                    isOpen={reportOpen}
                    onToggle={() => setReportOpen(v => !v)}
                    isActive={isAnyActive(REPORT_ITEMS)}
                />

                {/* PPA Group */}
                <NavGroup
                    label="PPA"
                    icon="🏥"
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
                    className="flex items-center justify-center gap-2 w-full bg-green-800 hover:bg-green-900 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-2xl transition disabled:opacity-60"
                >
                    <LogOut size={16} />
                    {loggingOut ? "กำลังออก..." : "Logout"}
                </button>
            </div>
        </aside>
    );
}