"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export default function TopProgressBar() {
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [prevPath, setPrevPath] = useState(pathname);

    // เมื่อ path เปลี่ยน → เริ่มรอบใหม่ (ปรับ state ระหว่าง render ตามแนวทาง React
    // แทนการ setState แบบ synchronous ใน effect body)
    if (pathname !== prevPath) {
        setPrevPath(pathname);
        setLoading(true);
        setProgress(0);
    }

    useEffect(() => {
        // เริ่ม animate จาก 0 → 85 เร็วๆ แล้วค้างรอ
        const t1 = setTimeout(() => setProgress(30), 50);
        const t2 = setTimeout(() => setProgress(60), 200);
        const t3 = setTimeout(() => setProgress(85), 500);

        // จบ
        let t5: ReturnType<typeof setTimeout>;
        const t4 = setTimeout(() => {
            setProgress(100);
            t5 = setTimeout(() => setLoading(false), 300);
        }, 800);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
            clearTimeout(t5);
        };
    }, [pathname]);

    return (
        <AnimatePresence>
            {loading && (
                <motion.div
                    className="fixed top-0 left-0 right-0 z-[9999] h-[3px]"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <motion.div
                        className="h-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                        initial={{ width: "0%" }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}