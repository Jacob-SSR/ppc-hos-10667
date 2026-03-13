"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, FileEdit, UserRound, LogOut, FileUser, Activity, UserCheck } from "lucide-react";
import { useState } from "react";

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
        label: "ผู้ป่วยนอก UC สิทธิ์ต่างจังหวัดที่มารับบริการ",
        href: "/pages/uc-outside",
        icon: FileUser,
        exact: false,
    },
    // {
    //     label: "สถิติผู้รับบริการแยกเวร",
    //     href: "/pages/shift-stats",
    //     icon: Activity,
    //     exact: false,
    // },
    {
        label: "ผู้รับบริการแต่ขึ้นทะเบียนบัตรทองที่อื่น",
        href: "/pages/service-unit",
        icon: UserCheck,
        exact: false,
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);

    const isActive = (href: string, exact: boolean) => {
        if (!pathname) return false;
        if (exact) return pathname === href;
        return pathname === href || pathname.startsWith(href + "/");
    };

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await fetch("/api/logout", {
                method: "POST",
                credentials: "include",
            });
        } finally {
            router.replace("/auth/login");
        }
    };

    return (
        <aside className="flex flex-col w-60 h-screen bg-white border-r border-gray-300 ">

            {/* NAV */}
            <nav className="flex-1 px-4 py-6 space-y-1 text-sm">
                {NAV_ITEMS.map((item) => {
                    const active = isActive(item.href, item.exact);
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                flex items-center gap-3 px-3 py-2 rounded-md transition-colors
                ${active
                                    ? "bg-green-50 text-green-800 font-semibold"
                                    : "text-gray-600 hover:bg-gray-100 hover:text-black"
                                }
              `}
                        >
                            <Icon className="w-6 h-6 flex-shrink-0" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* LOGOUT FIXED BOTTOM */}
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