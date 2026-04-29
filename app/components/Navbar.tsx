"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, LogOut, LogIn, User } from "lucide-react";

export default function Navbar() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (data.user) {
          setUsername(data.user.username);
          setIsGuest(data.user.role === "guest");
        }
      })
      .catch(() => {
        setUsername(null);
        setIsGuest(true);
      });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    router.replace("/auth/login");
  };

  const handleLogin = () => {
    router.push("/auth/login");
  };

  return (
    <header
      className="
    h-16
    flex items-center px-8
    sticky top-0 z-50
    bg-[rgba(255,255,255,0.55)]
    backdrop-blur-lg
    border-b border-white/70
    shadow-sm
  "
    >
      {/* Left: Logo */}
      <div className="flex-1 flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="Hospital Logo"
          width={120}
          height={120}
          priority
          className="object-contain"
        />
      </div>

      {/* Center: Title */}
      <div className="flex-1 text-center">
        <h1 className="text-lg font-semibold tracking-wide" style={{ color: "#1a5233" }}>
          PLABPLACHAI HOSPITAL
        </h1>
        <div
          className="h-[2px] w-24 mx-auto mt-1 rounded-full opacity-70"
          style={{ backgroundColor: "#7ec8a0" }}
        />
      </div>

      {/* Right: User dropdown */}
      <div className="flex-1 flex justify-end items-center gap-2">
        {isGuest && (
          <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-full">
            GUEST
          </span>
        )}

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((p) => !p)}
            className="flex items-center gap-2 active:scale-[0.98] pl-2 pr-3 py-1.5 rounded-full shadow-sm transition-all"
            style={{ backgroundColor: "#d6f0e0" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#c2e8d4")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d6f0e0")}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: isGuest ? "#9ca3af" : "#7ec8a0" }}
            >
              <User size={14} className="text-white" strokeWidth={2.2} />
            </div>
            <span className="text-sm font-semibold max-w-[120px] truncate" style={{ color: "#1a5233" }}>
              {username ?? "Guest"}
            </span>
            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ color: "#3aa36a" }}
            >
              <ChevronDown size={14} />
            </motion.span>
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-xl border overflow-hidden z-50"
                style={{ borderColor: "#c2e8d4" }}
              >
                {/* Header */}
                <div
                  className={`px-4 py-3 border-b ${isGuest ? "bg-gradient-to-br from-amber-50 to-amber-100/60" : ""
                    }`}
                  style={
                    !isGuest
                      ? {
                        background: "linear-gradient(135deg, #f0faf4, #d6f0e0)",
                        borderBottomColor: "#c2e8d4",
                      }
                      : { borderBottomColor: "#fde68a" }
                  }
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                    style={{ color: isGuest ? "#92400e99" : "#1a523399" }}
                  >
                    {isGuest ? "โหมดผู้เยี่ยมชม" : "เข้าสู่ระบบในชื่อ"}
                  </p>
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {username ?? "Guest"}
                  </p>
                  {isGuest && (
                    <p className="text-[10px] text-amber-700 mt-1">
                      เข้าถึงได้เฉพาะ Dashboard
                    </p>
                  )}
                </div>

                {/* Menu items */}
                <div className="p-1.5">
                  {isGuest ? (
                    <button
                      onClick={handleLogin}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold active:scale-[0.98] transition-all"
                      style={{ color: "#1a5233" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0faf4")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <LogIn size={15} strokeWidth={2.2} />
                      เข้าสู่ระบบ
                    </button>
                  ) : (
                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {loggingOut ? (
                        <motion.span
                          className="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full inline-block"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                        />
                      ) : (
                        <LogOut size={15} strokeWidth={2.2} />
                      )}
                      {loggingOut ? "กำลังออก..." : "ออกจากระบบ"}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}