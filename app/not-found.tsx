// app/not-found.tsx
// หน้า 404 — แสดงเมื่อเข้า URL ที่ไม่มีอยู่ หรือเมื่อโค้ดเรียก notFound()
// เป็น Server Component ได้ (ไม่มี interactivity นอกจากลิงก์)

import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <div
                    className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ backgroundColor: "var(--mint-50)" }}
                >
                    <FileQuestion
                        className="h-7 w-7"
                        style={{ color: "var(--mint-600)" }}
                    />
                </div>

                <p
                    className="text-3xl font-bold"
                    style={{ color: "var(--mint-text)" }}
                >
                    404
                </p>
                <h1 className="mt-1 text-lg font-semibold text-gray-900">
                    ไม่พบหน้าที่ต้องการ
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    หน้านี้อาจถูกย้าย ลบไปแล้ว หรือพิมพ์ URL ไม่ถูกต้อง
                </p>

                <Link
                    href="/pages/dashboard"
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition hover:opacity-90"
                    style={{ backgroundColor: "var(--mint-600)" }}
                >
                    <Home className="h-4 w-4" />
                    กลับหน้าหลัก
                </Link>
            </div>
        </div>
    );
}