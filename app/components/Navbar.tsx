"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, LogOut, User } from "lucide-react";

export default function Navbar() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
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
        if (data.user) setUsername(data.user.username);
      })
      .catch(() => setUsername(null));
  }, []);

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // ปิดด้วย ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
    router.replace("/auth/login");
  };

  return (
    <header className="h-16 bg-white shadow-md flex items-center px-8">
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
        <h1 className="text-lg font-semibold text-green-700 tracking-wide">
          PLABPLACHAI HOSPITAL
        </h1>
        <div className="h-[2px] w-24 bg-green-600 mx-auto mt-1 rounded-full opacity-70"></div>
      </div>

      {/* Right: User dropdown */}
      <div className="flex-1 flex justify-end items-center">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((p) => !p)}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] pl-2 pr-3 py-1.5 rounded-full shadow-sm transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-green-700 flex items-center justify-center shrink-0">
              <User size={14} className="text-white" strokeWidth={2.2} />
            </div>
            <span className="text-sm font-semibold text-gray-700 max-w-[120px] truncate">
              {username ?? "Guest"}
            </span>
            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-gray-500"
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
                className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
              >
                {/* Header */}
                <div className="px-4 py-3 bg-gradient-to-br from-green-50 to-green-100/60 border-b border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-700/70 mb-0.5">
                    เข้าสู่ระบบในชื่อ
                  </p>
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {username ?? "Guest"}
                  </p>
                </div>

                {/* Menu items */}
                <div className="p-1.5">
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {loggingOut ? (
                      <motion.span
                        className="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full inline-block"
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 0.7,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      />
                    ) : (
                      <LogOut size={15} strokeWidth={2.2} />
                    )}
                    {loggingOut ? "กำลังออก..." : "ออกจากระบบ"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
