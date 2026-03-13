"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutGrid, FileEdit, UserRound, LogOut,
    FileUser, UserCheck, ChevronDown, ChevronRight,
    Baby, Stethoscope, Users, Activity,
} from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const NAV_ITEMS = [
    { label: "Overview", href: "/pages/dashboard", icon: LayoutGrid, exact: true },
    {
        label: "แก้ไขสิทธิ์หลัก 10667 เป็น CUP Split",
        href: "/pages/report",
        icon: FileEdit,
        exact: false,
    },
    {
        label: "คนไทยที่ยังไม่มี endpoint",
        href: "/pages/no-endpoint",
        icon: UserRound,
        exact: false,
    },
    {
        label: "UC ต่างจังหวัดที่มาทำฟัน",
        href: "/pages/uc-outside-dental",
        icon: FileUser,
        exact: false,
    },
    {
        label: "สถิติผู้รับบริการแยกเวร",
        href: "/pages/shift-stats",
        icon: Activity,
        exact: false,
    },
    {
        label: "ผู้ป่วยนอก UC สิทธิ์ต่างจังหวัดที่มารับบริการ",
        href: "/pages/uc-outside",
        icon: FileUser,
        exact: false,
    },
    {
        label: "ผู้รับบริการแต่ขึ้นทะเบียนบัตรทองที่อื่น",
        href: "/pages/service-unit",
        icon: UserCheck,
        exact: false,
    },
];

const PPA_ITEMS = [
    {
        label: "Aging (ผู้สูงอายุ)",
        href: "/pages/ppa/aging",
        icon: Users,
        desc: "คัดกรองสมอง/หกล้ม อายุ ≥ 50 ปี",
    },
    {
        label: "NCD01 (คัดกรอง DM/HT)",
        href: "/pages/ppa/ncd01",
        icon: Stethoscope,
        desc: "ข้อมูลการคัดกรองโรคเรื้อรัง",
    },
    {
        label: "NCD02 (R73/R030)",
        href: "/pages/ppa/ncd02",
        icon: Stethoscope,
        desc: "วินิจฉัย R73 หรือ R030",
    },
    {
        label: "MCH01 (ANC)",
        href: "/pages/ppa/mch01",
        icon: Baby,
        desc: "บริการฝากครรภ์",
    },
    {
        label: "MCH02 (คลอด)",
        href: "/pages/ppa/mch02",
        icon: Baby,
        desc: "ข้อมูลการคลอด",
    },
    {
        label: "MCH04 (พัฒนาการเด็ก)",
        href: "/pages/ppa/mch04",
        icon: Baby,
        desc: "คัดกรองพัฒนาการเด็ก DSPM",
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);
    const [ppaOpen, setPpaOpen] = useState(() =>
        typeof window !== "undefined" && window.location.pathname.startsWith("/pages/ppa")
    );

    const isActive = (href: string, exact: boolean) => {
        if (!pathname) return false;
        if (exact) return pathname === href;
        return pathname === href || pathname.startsWith(href + "/");
    };

    const isPpaActive = PPA_ITEMS.some((item) => isActive(item.href, false));

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

                {/* Regular nav items */}
                {NAV_ITEMS.map((item) => {
                    const active = isActive(item.href, item.exact);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors
                                ${active
                                    ? "bg-green-50 text-green-800 font-semibold"
                                    : "text-gray-600 hover:bg-gray-100 hover:text-black"}`}
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            <span className="leading-tight">{item.label}</span>
                        </Link>
                    );
                })}

                {/* ── PPA Dropdown ─────────────────────────── */}
                <div className="pt-1">
                    <button
                        onClick={() => setPpaOpen((v) => !v)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-left
                            ${isPpaActive || ppaOpen
                                ? "bg-green-50 text-green-800 font-semibold"
                                : "text-gray-600 hover:bg-gray-100 hover:text-black"}`}
                    >
                        {/* icon */}
                        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-base">🏥</span>
                        <span className="flex-1 leading-tight">PPA</span>
                        <motion.span
                            animate={{ rotate: ppaOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ChevronDown className="w-4 h-4" />
                        </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                        {ppaOpen && (
                            <motion.div
                                key="ppa-menu"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: "easeOut" }}
                                className="overflow-hidden"
                            >
                                <div className="mt-1 ml-3 pl-3 border-l-2 border-green-200 space-y-0.5">
                                    {PPA_ITEMS.map((item) => {
                                        const active = isActive(item.href, false);
                                        const Icon = item.icon;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`flex items-start gap-2 px-2 py-2 rounded-md transition-colors
                                                    ${active
                                                        ? "bg-green-100 text-green-800 font-semibold"
                                                        : "text-gray-600 hover:bg-gray-100 hover:text-black"}`}
                                            >
                                                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <div className="text-xs leading-tight">{item.label}</div>
                                                    <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{item.desc}</div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </nav>

            {/* LOGOUT */}
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