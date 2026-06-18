"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles,
    RefreshCw,
    AlertCircle,
    Send,
    MessageCircle,
    ChevronUp,
    X,
} from "lucide-react";

interface AiSummaryCardProps {
    summary: unknown;
    context: string;
    disabled?: boolean;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

// แปลง **ตัวหนา** ของ Markdown เป็นตัวหนาจริง + เปลี่ยน "* " หน้าบรรทัดเป็น •
function renderRich(content: string) {
    const lines = content.split("\n");
    return lines.map((line, li) => {
        const cleaned = line.replace(/^(\s*)\*\s+/, "$1• ");
        const parts = cleaned.split(/(\*\*[^*]+\*\*)/g);
        return (
            <span key={li}>
                {parts.map((p, pi) =>
                    p.startsWith("**") && p.endsWith("**") ? (
                        <strong key={pi} style={{ fontWeight: 700 }}>
                            {p.slice(2, -2)}
                        </strong>
                    ) : (
                        p
                    ),
                )}
                {li < lines.length - 1 && <br />}
            </span>
        );
    });
}

export default function AiSummaryCard({
    summary,
    context,
    disabled = false,
}: AiSummaryCardProps) {
    // ── Modal เปิด/ปิด ──
    const [open, setOpen] = useState(false);

    const [text, setText] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── chat state ──
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);

    const abortRef = useRef<AbortController | null>(null);
    const chatAbortRef = useRef<AbortController | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    // เลื่อนแชทลงล่างสุดเมื่อมีข้อความใหม่
    useEffect(() => {
        scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [messages, chatLoading]);

    // ปิดด้วย Esc + ล็อก scroll เมื่อเปิด
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        if (open) {
            window.addEventListener("keydown", h);
            document.body.style.overflow = "hidden";
        }
        return () => {
            window.removeEventListener("keydown", h);
            document.body.style.overflow = "";
        };
    }, [open]);

    // ── สรุป ──
    const run = async () => {
        if (loading || disabled) return;

        setLoading(true);
        setError(null);

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
            setMessages([]);
            setChatError(null);
        } catch (e: unknown) {
            if (e instanceof Error && e.name === "AbortError") return;
            setError((e as Error).message ?? "เกิดข้อผิดพลาด");
        } finally {
            setLoading(false);
        }
    };

    // ── ถามต่อ ──
    const send = async () => {
        const question = input.trim();
        if (!question || chatLoading || disabled) return;

        const nextMessages: ChatMessage[] = [
            ...messages,
            { role: "user", content: question },
        ];
        setMessages(nextMessages);
        setInput("");
        setChatLoading(true);
        setChatError(null);

        chatAbortRef.current?.abort();
        const controller = new AbortController();
        chatAbortRef.current = controller;

        try {
            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                signal: controller.signal,
                body: JSON.stringify({ summary, context, messages: nextMessages }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data?.error ?? `HTTP ${res.status}`);
            }

            const reply = data?.reply?.trim();
            if (!reply) {
                throw new Error("AI ไม่ได้ส่งคำตอบกลับมา");
            }

            setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        } catch (e: unknown) {
            if (e instanceof Error && e.name === "AbortError") return;
            setChatError((e as Error).message ?? "เกิดข้อผิดพลาด");
        } finally {
            setChatLoading(false);
        }
    };

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    const SUGGESTIONS = [
        "จุดไหนน่าเป็นห่วงที่สุด",
        "ควรเฝ้าระวังอะไรเป็นพิเศษ",
        "สรุปสั้นๆ ให้ผู้บริหารฟัง",
    ];

    return (
        <>
            {/* ══ ปุ่มเล็กมุมล่างขวา (กดเปิด/ปิด) ══ */}
            <button
                onClick={() => setOpen((o) => !o)}
                className="fixed bottom-5 right-5 z-40 flex items-center gap-2 pl-4 pr-3.5 py-2.5 rounded-full text-white font-bold text-sm shadow-lg active:scale-95 transition-transform"
                style={{ backgroundColor: "#3aa36a" }}
            >
                <Sparkles size={15} />
                สรุปด้วย AI
                {text && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
                )}
                <motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex"
                >
                    <ChevronUp size={16} />
                </motion.span>
            </button>

            {/* ══ Modal กลางจอ ══ */}
            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                        />
                        <div
                            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                            onClick={() => setOpen(false)}
                        >
                            <motion.div
                                className="relative bg-white rounded-2xl flex flex-col overflow-hidden w-full max-w-[560px]"
                                style={{
                                    maxHeight: "88vh",
                                    boxShadow:
                                        "0 24px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)",
                                }}
                                initial={{ scale: 0.94, y: 20, opacity: 0 }}
                                animate={{ scale: 1, y: 0, opacity: 1 }}
                                exit={{ scale: 0.94, y: 20, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 360, damping: 32 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* HEADER */}
                                <div className="border-b border-gray-100 px-5 py-4 shrink-0 flex items-center gap-3">
                                    <div
                                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: "#f0faf4" }}
                                    >
                                        <Sparkles size={16} style={{ color: "#1a5233" }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-sm font-bold text-gray-900">สรุปโดย AI</h2>
                                        <p className="text-[11px] text-gray-400 truncate">{context}</p>
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
                                        {loading ? "วิเคราะห์..." : text ? "สรุปใหม่" : "สรุป"}
                                    </button>

                                    <button
                                        onClick={() => setOpen(false)}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-all active:scale-95 shrink-0"
                                        aria-label="ปิด"
                                    >
                                        <X size={14} strokeWidth={2.5} />
                                    </button>
                                </div>

                                {/* BODY */}
                                <div className="flex-1 overflow-y-auto px-5 py-4">
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
                                                className="text-sm text-gray-700 leading-relaxed"
                                            >
                                                {renderRich(text)}
                                            </motion.div>
                                        )}

                                        {!text && !loading && !error && (
                                            <motion.div
                                                key="empty"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="flex flex-col items-center justify-center py-10 gap-3 text-center"
                                            >
                                                <div
                                                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                                    style={{ backgroundColor: "#f0faf4" }}
                                                >
                                                    <Sparkles size={24} style={{ color: "#1a5233" }} />
                                                </div>
                                                <p className="text-sm text-gray-500 max-w-xs">
                                                    กดปุ่ม <span className="font-bold" style={{ color: "#1a5233" }}>สรุป</span> ด้านบน
                                                    เพื่อให้ AI ช่วยสรุปประเด็นสำคัญจากข้อมูลในหน้านี้
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* ── แชท (หลังสรุปเสร็จ) ── */}
                                    <AnimatePresence>
                                        {text && !loading && (
                                            <motion.div
                                                key="chat"
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.25, ease: "easeOut" }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-4 pt-4 border-t" style={{ borderColor: "#e8f5ee" }}>
                                                    <div className="flex items-center gap-1.5 mb-3">
                                                        <MessageCircle size={14} style={{ color: "#3aa36a" }} />
                                                        <p
                                                            className="text-xs font-bold uppercase tracking-wide"
                                                            style={{ color: "#1a5233" }}
                                                        >
                                                            ถามเจาะลึกข้อมูลหน้านี้
                                                        </p>
                                                    </div>

                                                    {(messages.length > 0 || chatLoading) && (
                                                        <div
                                                            ref={scrollRef}
                                                            className="space-y-3 max-h-[300px] overflow-y-auto mb-3 pr-1"
                                                        >
                                                            {messages.map((m, i) => (
                                                                <div
                                                                    key={i}
                                                                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                                                                >
                                                                    <div
                                                                        className="max-w-[85%] text-sm leading-relaxed rounded-2xl px-4 py-2.5"
                                                                        style={
                                                                            m.role === "user"
                                                                                ? {
                                                                                    backgroundColor: "#3aa36a",
                                                                                    color: "#ffffff",
                                                                                    borderBottomRightRadius: 4,
                                                                                }
                                                                                : {
                                                                                    backgroundColor: "#f0faf4",
                                                                                    color: "#374151",
                                                                                    border: "1px solid #d6f0e0",
                                                                                    borderBottomLeftRadius: 4,
                                                                                }
                                                                        }
                                                                    >
                                                                        {renderRich(m.content)}
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {chatLoading && (
                                                                <div className="flex justify-start">
                                                                    <div
                                                                        className="rounded-2xl px-4 py-3 flex items-center gap-1"
                                                                        style={{
                                                                            backgroundColor: "#f0faf4",
                                                                            border: "1px solid #d6f0e0",
                                                                            borderBottomLeftRadius: 4,
                                                                        }}
                                                                    >
                                                                        {[0, 1, 2].map((d) => (
                                                                            <motion.span
                                                                                key={d}
                                                                                className="w-1.5 h-1.5 rounded-full"
                                                                                style={{ backgroundColor: "#3aa36a" }}
                                                                                animate={{ opacity: [0.3, 1, 0.3] }}
                                                                                transition={{
                                                                                    duration: 1,
                                                                                    repeat: Infinity,
                                                                                    delay: d * 0.2,
                                                                                }}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {messages.length === 0 && !chatLoading && (
                                                        <div className="flex flex-wrap gap-2 mb-3">
                                                            {SUGGESTIONS.map((s) => (
                                                                <button
                                                                    key={s}
                                                                    onClick={() => setInput(s)}
                                                                    className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                                                                    style={{
                                                                        borderColor: "#a8d5ba",
                                                                        color: "#1a5233",
                                                                        backgroundColor: "#f0faf4",
                                                                    }}
                                                                >
                                                                    {s}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {chatError && (
                                                        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-2">
                                                            <AlertCircle size={13} />
                                                            {chatError}
                                                        </div>
                                                    )}

                                                    <div className="flex items-end gap-2">
                                                        <textarea
                                                            value={input}
                                                            onChange={(e) => setInput(e.target.value)}
                                                            onKeyDown={onInputKeyDown}
                                                            disabled={disabled || chatLoading}
                                                            rows={1}
                                                            placeholder="พิมพ์คำถามเกี่ยวกับข้อมูลหน้านี้..."
                                                            className="flex-1 resize-none border-2 rounded-xl px-4 py-2.5 text-sm text-gray-800 bg-white focus:outline-none transition-colors disabled:opacity-50"
                                                            style={{ borderColor: "#d6f0e0", maxHeight: 120 }}
                                                            onFocus={(e) => (e.currentTarget.style.borderColor = "#7ec8a0")}
                                                            onBlur={(e) => (e.currentTarget.style.borderColor = "#d6f0e0")}
                                                        />
                                                        <button
                                                            onClick={send}
                                                            disabled={disabled || chatLoading || !input.trim()}
                                                            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm disabled:opacity-40 transition-all active:scale-95"
                                                            style={{ backgroundColor: "#3aa36a" }}
                                                            aria-label="ส่งคำถาม"
                                                        >
                                                            <Send size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* FOOTER */}
                                <div className="px-5 py-2.5 bg-white border-t border-gray-100 shrink-0">
                                    <p className="text-[10px] text-gray-300 text-center">
                                        * สรุปและคำตอบจาก AI อาจคลาดเคลื่อน โปรดตรวจสอบกับข้อมูลจริงก่อนตัดสินใจ
                                    </p>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}