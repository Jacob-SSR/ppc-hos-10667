"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ToastType } from "@/types/allTypes";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
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
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const show = (message: string, type: ToastType = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const ToastContainer = () => (
    <AnimatePresence>
      {toast && (
        <Toast key={toast.message} message={toast.message} type={toast.type} />
      )}
    </AnimatePresence>
  );
  return { show, ToastContainer };
}

// ── Floating Input ──────────────────────────────────────
// hint อยู่ใน DOM ตลอด แต่ fade opacity → ไม่มี layout shift
function FloatingInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  required,
  hint,
  disabled,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;
  const isFloating = focused || value.length > 0;

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          disabled={disabled}
          className={`w-full border-2 rounded-xl px-4 pt-7 pb-3 text-base text-gray-900 bg-white
                               focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed
                               ${focused ? "border-green-600 ring-2 ring-green-100" : "border-gray-300"}
                               ${isPassword ? "pr-11" : ""}`}
        />

        {/* Floating label */}
        <motion.label
          htmlFor={id}
          animate={
            isFloating
              ? {
                  top: 8,
                  left: 16,
                  fontSize: "11px",
                  color: focused ? "#16a34a" : "#6b7280",
                }
              : { top: 19, left: 16, fontSize: "15px", color: "#9ca3af" }
          }
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="absolute pointer-events-none font-medium leading-none select-none"
          style={{ top: 19, left: 16 }}
        >
          {label}
        </motion.label>

        {/* Password toggle */}
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowPassword((p) => !p)}
            disabled={disabled}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-700 transition-colors disabled:opacity-30"
          >
            {showPassword ? (
              // eye-off
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              // eye
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Hint — always in DOM, fade in/out via opacity → ไม่ layout shift */}
      <p
        className="text-xs text-gray-400 ml-1 transition-opacity duration-200 select-none"
        style={{ opacity: focused && hint ? 1 : 0, minHeight: "1rem" }}
      >
        {hint ?? ""}
      </p>
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
    if (!show) {
      progress.set(0);
      return;
    }
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
              <p className="text-sm text-gray-400">กำลังนำทาง...</p>
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
      setTimeout(() => router.replace("/pages/dashboard"), 2800);
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
        animate={
          success
            ? { opacity: 0, scale: 0.94, filter: "blur(10px)", y: -8 }
            : { opacity: 1, scale: 1, filter: "blur(0px)", y: 0 }
        }
        className="bg-white w-[440px] px-12 py-12 rounded-2xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
      >
        <h1 className="text-3xl font-bold text-center text-gray-900 tracking-tight">
          Login PPCHOS
        </h1>

        {/* Divider + label */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-300" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
            Health Data Report
          </span>
          <div className="flex-1 h-px bg-gray-300" />
        </div>

        {/* ไม่มี mb คงที่ เพราะ FloatingInput มี hint space ในตัวแล้ว */}
        <div className="space-y-4 mb-8">
          <FloatingInput
            id="username"
            label="User"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            hint="ใช้ชื่อผู้ใช้เดียวกับที่ login เข้า HosXP"
            disabled={loading || success}
          />
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
          className="w-full bg-green-700 hover:bg-green-800 active:scale-[0.98] transition-all text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50"
        >
          {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
        </button>

        <div className="mt-10 flex justify-center">
          <img
            src="/logo.png"
            alt="Hospital Logo"
            className="h-16 opacity-90"
          />
        </div>
      </motion.form>
    </div>
  );
}
