"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { SidebarItem } from "./types";

type Props = {
    label: string;
    icon: any;
    items: SidebarItem[];
    isOpen: boolean;
    onToggle: () => void;
    isActive: boolean;
};

export default function NavGroup({
    label,
    icon: Icon,
    items,
    isOpen,
    onToggle,
    isActive
}: Props) {

    const pathname = usePathname();

    const isItemActive = (href: string) =>
        pathname === href || pathname?.startsWith(href + "/");

    return (
        <div className="pt-1">

            <button
                onClick={onToggle}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all text-left
        ${isActive || isOpen
                        ? "bg-green-50 text-green-800 font-semibold"
                        : "text-gray-600 hover:bg-gray-100 hover:text-black"}`}
            >

                <Icon size={18} />

                <span className="flex-1 text-sm">{label}</span>

                <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                >
                    <ChevronDown size={16} />
                </motion.span>

            </button>

            <AnimatePresence>

                {isOpen && (

                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                    >

                        <div className="mt-1 ml-3 pl-3 border-l-2 border-green-200 space-y-1">

                            {items.map((item) => {

                                const active = isItemActive(item.href);
                                const Icon = item.icon;

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-start gap-2 px-2 py-2 rounded-md
                    ${active
                                                ? "bg-green-100 text-green-800 font-semibold"
                                                : "text-gray-600 hover:bg-gray-100"}`}
                                    >

                                        <Icon size={16} />

                                        <div>
                                            <div className="text-xs">{item.label}</div>

                                            {item.desc && (
                                                <div className="text-[10px] text-gray-400">
                                                    {item.desc}
                                                </div>
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