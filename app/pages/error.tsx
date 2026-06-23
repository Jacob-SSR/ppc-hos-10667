"use client";

// app/pages/error.tsx
// Error boundary ของกลุ่มหน้า dashboard (ทุกหน้าใต้ app/pages/*)
// จะถูกเรนเดอร์แทนที่ "เนื้อหาหน้า" แต่ยังอยู่ภายในกรอบ Navbar + Sidebar
// (เพราะ layout ของ segment นี้ยังทำงานอยู่) → ผู้ใช้ไม่หลุดออกจากระบบ
//
// error.tsx ต้องเป็น Client Component เสมอ และรับ props { error, reset }
//   - error : Error object (มี .digest ถ้า throw จากฝั่ง server)
//   - reset : เรียกเพื่อ retry การเรนเดอร์ segment นี้ใหม่

import { useEffect } from "react";
import { RotateCw, Home, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // log ไว้ดูปลายทาง — จุดนี้คือที่ที่ควรต่อ Sentry/observability ภายหลัง
        console.error("[dashboard] render error:", error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                    <AlertTriangle className="h-7 w-7 text-red-500" />
                </div>

                <h2 className="text-lg font-semibold text-gray-900">
                    โหลดข้อมูลไม่สำเร็จ
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    เกิดข้อผิดพลาดระหว่างดึงข้อมูลส่วนนี้ อาจเป็นเพราะการเชื่อมต่อฐานข้อมูล
                    ขัดข้องชั่วคราว ลองโหลดใหม่อีกครั้ง หากยังไม่หาย แจ้งทีม IT ได้เลย
                </p>

                {error.digest && (
                    <p className="mt-3 font-mono text-xs text-gray-400">
                        รหัสอ้างอิง: {error.digest}
                    </p>
                )}

                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <button
                        onClick={reset}
                        className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                        style={{ backgroundColor: "var(--mint-600)" }}
                    >
                        <RotateCw className="h-4 w-4" />
                        ลองใหม่
                    </button>
                    <Link
                        href="/pages/dashboard"
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                        <Home className="h-4 w-4" />
                        กลับหน้าหลัก
                    </Link>
                </div>
            </div>
        </div>
    );
}