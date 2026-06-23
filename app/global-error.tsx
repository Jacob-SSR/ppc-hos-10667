"use client";

// app/global-error.tsx
// ด่านสุดท้าย — ดัก error ที่เกิดใน root layout เอง (ซึ่ง app/error.tsx ดักไม่ถึง)
// ไฟล์นี้ "แทนที่ root layout ทั้งหมด" จึงต้องมี <html>/<body> ของตัวเอง
// และต้องไม่พึ่ง CSS/ฟอนต์ของแอป (เพราะตอนนั้นอาจโหลดไม่สำเร็จ) → ใช้ inline style ล้วน

import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[global] fatal error:", error);
    }, [error]);

    return (
        <html lang="th">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f0faf4",
                    fontFamily:
                        "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                    color: "#1a5233",
                    padding: "1rem",
                }}
            >
                <div
                    style={{
                        maxWidth: "28rem",
                        width: "100%",
                        background: "#fff",
                        border: "1px solid #d6f0e0",
                        borderRadius: "1rem",
                        padding: "2rem",
                        textAlign: "center",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    }}
                >
                    <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
                        ระบบขัดข้อง
                    </h1>
                    <p
                        style={{
                            marginTop: "0.5rem",
                            fontSize: "0.875rem",
                            lineHeight: 1.6,
                            color: "#475569",
                        }}
                    >
                        เกิดข้อผิดพลาดร้ายแรงในการโหลดระบบ กรุณาลองใหม่
                        หากยังไม่หายโปรดแจ้งทีม IT
                    </p>
                    {error.digest && (
                        <p
                            style={{
                                marginTop: "0.75rem",
                                fontSize: "0.75rem",
                                fontFamily: "monospace",
                                color: "#94a3b8",
                            }}
                        >
                            รหัสอ้างอิง: {error.digest}
                        </p>
                    )}
                    <button
                        onClick={reset}
                        style={{
                            marginTop: "1.5rem",
                            background: "#2d8a56",
                            color: "#fff",
                            border: "none",
                            borderRadius: "0.5rem",
                            padding: "0.5rem 1.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            cursor: "pointer",
                        }}
                    >
                        ลองใหม่
                    </button>
                </div>
            </body>
        </html>
    );
}