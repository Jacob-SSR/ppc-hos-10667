// app/components/MobileSidebarToggle.tsx
"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import Sidebar from "@/app/components/sidebar/Sidebar";

export default function MobileSidebarToggle() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    // ปิด drawer เมื่อเปลี่ยนหน้า
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // ล็อก scroll body เมื่อ drawer เปิด
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    return (
        <>
            {/* Burger button — แสดงเฉพาะมือถือ */}
            <button
                onClick={() => setOpen(true)}
                className="md:hidden fixed bottom-5 left-5 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
                style={{ backgroundColor: "#1a5233" }}
                aria-label="เปิดเมนู"
            >
                <Menu size={22} className="text-white" />
            </button>

            {/* Overlay + Drawer */}
            <AnimatePresence>
                {open && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            key="backdrop"
                            className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setOpen(false)}
                        />

                        {/* Drawer */}
                        <motion.div
                            key="drawer"
                            className="md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl flex flex-col"
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", stiffness: 320, damping: 32 }}
                        >
                            {/* Drawer header */}
                            <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-gray-200">
                                <span className="font-bold text-sm" style={{ color: "#1a5233" }}>เมนู</span>
                                <button
                                    onClick={() => setOpen(false)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                                >
                                    <X size={18} className="text-gray-500" />
                                </button>
                            </div>

                            {/* Sidebar content */}
                            <div className="flex-1 overflow-y-auto">
                                <Sidebar />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}