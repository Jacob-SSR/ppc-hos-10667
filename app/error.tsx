"use client";

// app/error.tsx
// Error boundary ระดับราก — รับ error ของ app/page.tsx และทุก segment
// ที่ไม่มี error.tsx ของตัวเอง (กลุ่ม dashboard มีของตัวเองที่ app/pages/error.tsx แล้ว)
// หมายเหตุ: ไฟล์นี้ดักไม่ถึง error ที่เกิดใน root layout เอง — กรณีนั้นใช้ global-error.tsx

import { useEffect } from "react";
import { RotateCw } from "lucide-react";

export default function RootError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[root] render error:", error);
    }, [error]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <h1
                    className="text-xl font-semibold"
                    style={{ color: "var(--mint-text)" }}
                >
                    ระบบขัดข้องชั่วคราว
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    เกิดข้อผิดพลาดที่ไม่คาดคิด ลองโหลดใหม่อีกครั้ง
                    หากยังพบปัญหากรุณาแจ้งทีม IT
                </p>

                {error.digest && (
                    <p className="mt-3 font-mono text-xs text-gray-400">
                        รหัสอ้างอิง: {error.digest}
                    </p>
                )}

                <button
                    onClick={reset}
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition hover:opacity-90"
                    style={{ backgroundColor: "var(--mint-600)" }}
                >
                    <RotateCw className="h-4 w-4" />
                    ลองใหม่
                </button>
            </div>
        </div>
    );
}