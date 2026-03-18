"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ToastType } from "@/types/allTypes";
import {
    motion, AnimatePresence,
    useMotionValue, useTransform, animate,
} from "framer-motion";

// ── Toast ──────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: ToastType }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-semibold text-white text-base
                ${type === "success" ? "bg-green-600" : "bg-red-500"}`}
        >
            <span>{message}</span>
        </motion.div>
    );
}

function useToast() {
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const show = (message: string, type: ToastType = "error") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };
    const ToastContainer = () => (
        <AnimatePresence>
            {toast && <Toast key={toast.message} message={toast.message} type={toast.type} />}
        </AnimatePresence>
    );
    return { show, ToastContainer };
}

// ── Floating Input + Animated Hint ─────────────────────
function FloatingInput({
    id, label, type = "text", value, onChange, required, hint, disabled,
}: {
    id: string; label: string; type?: string;
    value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    required?: boolean; hint?: string; disabled?: boolean;
}) {
    const [focused, setFocused] = useState(false);
    const isFloating = focused || value.length > 0;

    return (
        <div>
            <div className="relative">
                <input
                    id={id}
                    type={type}
                    value={value}
                    onChange={onChange}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    required={required}
                    disabled={disabled}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 pt-7 pb-3 text-lg text-gray-900 bg-white
                               focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100
                               transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                />

                <motion.label
                    htmlFor={id}
                    animate={
                        isFloating
                            ? { top: 8, left: 16, fontSize: "12px", color: focused ? "#16a34a" : "#6b7280" }
                            : { top: 20, left: 16, fontSize: "17px", color: "#9ca3af" }
                    }
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="absolute pointer-events-none font-medium leading-none"
                    style={{ top: 20, left: 16 }}
                >
                    {label}
                </motion.label>
            </div>

            {/* ✨ Animated Hint */}
            <AnimatePresence>
                {focused && hint && (
                    <motion.p
                        key="hint"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="mt-1.5 ml-1 text-xs text-gray-400 flex items-center gap-1"
                    >
                        {hint}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Success Overlay ────────────────────────────────────
function SuccessOverlay({ show }: { show: boolean }) {
    const progress = useMotionValue(0);
    const logoOpacity = useTransform(progress, [0, 1], [0.06, 1]);
    const logoScale = useTransform(progress, [0, 1], [0.84, 1]);
    const barWidth = useTransform(progress, [0, 1], ["0%", "100%"]);

    useEffect(() => {
        if (!show) { progress.set(0); return; }
        const t = setTimeout(() => {
            animate(progress, 1, { duration: 1.9, ease: [0.4, 0, 0.2, 1] });
        }, 350);
        return () => clearTimeout(t);
    }, [show]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="fixed inset-0 z-[99999] flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <div
                        className="absolute inset-0"
                        style={{
                            background: "rgba(243,244,246,0.85)",
                            backdropFilter: "blur(28px)",
                        }}
                    />

                    <motion.div
                        className="relative flex flex-col items-center gap-8"
                        initial={{ opacity: 0, y: 16, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.15, duration: 0.45 }}
                    >
                        <motion.img
                            src="/logo.png"
                            alt="Hospital Logo"
                            className="object-contain drop-shadow-2xl"
                            style={{
                                width: 500,
                                height: 500,
                                opacity: logoOpacity,
                                scale: logoScale,
                            }}
                        />

                        <div className="text-center">
                            <p className="text-xl font-semibold text-gray-900">
                                เข้าสู่ระบบสำเร็จ
                            </p>
                            <p className="text-sm text-gray-400">
                                กำลังนำทาง...
                            </p>
                        </div>

                        <div className="w-80">
                            <div className="w-full h-[6px] bg-gray-200 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full"
                                    style={{
                                        width: barWidth,
                                        background: "linear-gradient(90deg, #15803d, #4ade80)",
                                        boxShadow: "0 0 10px rgba(74,222,128,0.75)",
                                    }}
                                />
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ── Page ───────────────────────────────────────────────
export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const { show: showToast, ToastContainer } = useToast();

    const handleLogin = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
                credentials: "include",
            });
            if (!res.ok) throw new Error("Login failed");
            setSuccess(true);
            setTimeout(() => router.replace("/pages/report"), 2800);
        } catch {
            showToast("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", "error");
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-gray-200 text-gray-900">
            <ToastContainer />
            <SuccessOverlay show={success} />

            <motion.form
                onSubmit={handleLogin}
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={success
                    ? { opacity: 0, scale: 0.94, filter: "blur(10px)", y: -8 }
                    : { opacity: 1, scale: 1, filter: "blur(0px)", y: 0 }
                }
                className="bg-white w-[440px] px-12 py-12 rounded-2xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
            >
                <h1 className="text-3xl font-bold text-center mb-10 text-gray-900">
                    Login PPCHOS
                </h1>

                <div className="mb-5">
                    <FloatingInput
                        id="username"
                        label="User"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        hint="ใช้ชื่อผู้ใช้เดียวกับที่ login เข้า HosXP"
                        disabled={loading || success}
                    />
                </div>

                <div className="mb-8">
                    <FloatingInput
                        id="password"
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        hint="ใช้รหัสผ่านเดียวกับที่ใช้เข้า HosXP"
                        disabled={loading || success}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || success}
                    className="w-full bg-green-700 text-white py-4 rounded-xl text-lg font-bold"
                >
                    {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
                </button>

                <div className="mt-10 flex justify-center">
                    <img src="/logo.png" alt="Hospital Logo" className="h-16 opacity-90" />
                </div>
            </motion.form>
        </div>
    );
}