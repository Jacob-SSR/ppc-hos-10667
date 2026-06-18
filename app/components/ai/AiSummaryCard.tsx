"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";

interface AiSummaryCardProps {
    summary: unknown;
    context: string;
    disabled?: boolean;
}

export default function AiSummaryCard({
    summary,
    context,
    disabled = false,
}: AiSummaryCardProps) {
    const [text, setText] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const abortRef = useRef<AbortController | null>(null);

    const run = async () => {
        if (loading || disabled) return;

        setLoading(true);
        setError(null);

        // cancel request เดิมถ้ามี
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const res = await fetch("/api/ai/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                signal: controller.signal,
                body: JSON.stringify({ summary, context }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data?.error ?? `HTTP ${res.status}`);
            }

            const resultText = data?.summary?.trim();

            if (!resultText) {
                throw new Error("AI ไม่ได้ส่งข้อความกลับมา");
            }

            setText(resultText);
        } catch (e: unknown) {
            if (e instanceof Error && e.name === "AbortError") return;
            setError((e as Error).message ?? "เกิดข้อผิดพลาด");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="bg-white border rounded-2xl shadow-sm p-5"
            style={{ borderColor: "#a8d5ba" }}
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: "#f0faf4" }}
                    >
                        <Sparkles size={16} style={{ color: "#1a5233" }} />
                    </div>

                    <h3 className="text-sm font-bold" style={{ color: "#1a5233" }}>
                        สรุปโดย AI
                    </h3>
                </div>

                <button
                    onClick={run}
                    disabled={disabled || loading}
                    className="flex items-center gap-1.5 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm disabled:opacity-40 transition-all active:scale-95"
                    style={{ backgroundColor: "#3aa36a" }}
                >
                    <motion.span
                        animate={loading ? { rotate: 360 } : { rotate: 0 }}
                        transition={
                            loading
                                ? { duration: 0.8, repeat: Infinity, ease: "linear" }
                                : {}
                        }
                    >
                        <RefreshCw size={13} />
                    </motion.span>

                    {loading
                        ? "กำลังวิเคราะห์..."
                        : text
                            ? "สรุปใหม่"
                            : "สรุปด้วย AI"}
                </button>
            </div>

            <AnimatePresence mode="wait">
                {error && (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2"
                    >
                        <AlertCircle size={14} />
                        {error}
                    </motion.div>
                )}

                {loading && !text && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-2"
                    >
                        {[100, 92, 96, 70].map((w, i) => (
                            <div
                                key={i}
                                className="h-3.5 rounded bg-gray-100 animate-pulse"
                                style={{ width: `${w}%` }}
                            />
                        ))}
                    </motion.div>
                )}

                {text && !loading && (
                    <motion.div
                        key="text"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
                    >
                        {text}
                    </motion.div>
                )}

                {!text && !loading && !error && (
                    <motion.p
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-gray-400"
                    >
                        กดปุ่ม สรุปด้วย AI เพื่อให้ AI ช่วยสรุปประเด็นสำคัญจากข้อมูลนี้
                    </motion.p>
                )}
            </AnimatePresence>

            <p className="text-[10px] text-gray-300 mt-3">
                * สรุปโดย AI อาจคลาดเคลื่อน โปรดตรวจสอบกับข้อมูลจริงก่อนตัดสินใจ
            </p>
        </div>
    );
}