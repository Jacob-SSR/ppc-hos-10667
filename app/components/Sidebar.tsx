"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, FileEdit, UserRound, LogOut } from "lucide-react";

const NAV_ITEMS = [
    { label: "Overview", href: "/dashboard", icon: LayoutGrid, exact: true },
    {
        label: "แก้ไขสิทธิ์หลัก 10667 เป็น CUP Split",
        href: "/report",
        icon: FileEdit,
        exact: false,
    },
    {
        label: "คนไหนที่ยังไม่มี endpoint",
        href: "/no-endpoint",
        icon: UserRound,
        exact: false,
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const isActive = (href: string, exact: boolean) =>
        exact ? pathname === href : pathname.startsWith(href);

    const handleLogout = () => {
        // ถ้ามี token ก็ลบตรงนี้
        localStorage.removeItem("token");

        router.push("/");
    };

    return (
        <aside className="flex flex-col w-60 h-screen bg-white border-r border-gray-300">

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
                            <Icon size={18} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* LOGOUT FIXED BOTTOM */}
            <div className="border-t border-gray-200 p-4">
                <button
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 w-full bg-green-800 hover:bg-green-900 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow transition"
                >
                    <LogOut size={16} />
                    Logout
                </button>
            </div>
        </aside>
    );
}