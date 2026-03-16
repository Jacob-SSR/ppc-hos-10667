"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ToastType } from "@/types/allTypes";
import { motion, AnimatePresence } from "framer-motion";

// ── Toast ──────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: ToastType }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-semibold text-white
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

// ── Floating Input ─────────────────────────────────────
function FloatingInput({
    id, label, type = "text", value, onChange, required,
}: {
    id: string; label: string; type?: string;
    value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean;
}) {
    const [focused, setFocused] = useState(false);
    const isFloating = focused || value.length > 0;

    return (
        <div className="relative">
            <input
                id={id} type={type} value={value} onChange={onChange}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                required={required}
                className="w-full border-2 border-black rounded-lg p-3 pt-5 pb-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-600 transition peer"
            />
            <motion.label
                htmlFor={id}
                animate={
                    isFloating
                        ? { top: -10, left: 10, fontSize: "16px", color: focused ? "#16a34a" : "#374151" }
                        : { top: 14, left: 12, fontSize: "18px", color: "#9ca3af" }
                }
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute pointer-events-none font-medium bg-white px-1 origin-left"
                style={{ top: 14, left: 12 }}
            >
                {label}
            </motion.label>
        </div>
    );
}

// ── Animated Title ─────────────────────────────────────
function AnimatedTitle({ text }: { text: string }) {
    return (
        <h1 className="text-2xl font-bold text-center mb-8 text-gray-900 flex justify-center flex-wrap">
            {text.split("").map((char, i) => (
                <motion.span
                    key={i}
                    whileHover={{ scale: 1.4, color: "#15803d" }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    className="inline-block cursor-default"
                >
                    {char === " " ? "\u00A0" : char}
                </motion.span>
            ))}
        </h1>
    );
}

// ── Page ───────────────────────────────────────────────
export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
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

            showToast("เข้าสู่ระบบสำเร็จ!", "success");
            setTimeout(() => router.replace("/pages/report"), 1000);
        } catch (err) {
            showToast("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-gray-200 text-gray-900">
            <ToastContainer />

            <motion.form
                onSubmit={handleLogin}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-white w-96 p-10 rounded-xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
            >
                <AnimatedTitle text="Login PPCHOS" />

                <div className="mb-5">
                    <FloatingInput
                        id="username" label="User" value={username}
                        onChange={(e) => setUsername(e.target.value)} required
                    />
                </div>

                <div className="mb-6">
                    <FloatingInput
                        id="password" label="Password" type="password" value={password}
                        onChange={(e) => setPassword(e.target.value)} required
                    />
                </div>

                <motion.button
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.02 }}
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold shadow-md hover:bg-green-800 transition"
                >
                    {loading ? "กำลังเข้าสู่ระบบ..." : "Login"}
                </motion.button>

                <div className="mt-8 flex justify-center">
                    <img src="/logo.png" alt="Hospital Logo" className="h-14" />
                </div>
            </motion.form>
        </div>
    );
}