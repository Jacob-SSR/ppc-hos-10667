"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, Check, AlertCircle, Sun, Moon, Type, Settings2, RefreshCw } from "lucide-react";
import { useSettings, FontSize } from "@/app/contexts/SettingsContext";

// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg text-sm font-semibold text-white ${ok ? "bg-green-700" : "bg-red-600"}`}
        >
            {ok ? <Check size={16} /> : <AlertCircle size={16} />}
            {msg}
        </motion.div>
    );
}

// ── Password Field ────────────────────────────────────────────────────────────
function PasswordField({ id, label, value, onChange, disabled, placeholder }: {
    id: string; label: string; value: string;
    onChange: (v: string) => void; disabled?: boolean; placeholder?: string;
}) {
    const [show, setShow] = useState(false);
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="block text-sm font-semibold text-gray-600">{label}</label>
            <div className="relative">
                <input
                    id={id} type={show ? "text" : "password"} value={value}
                    onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm bg-white text-gray-900 focus:outline-none focus:border-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShow((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-700 transition-colors">
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>
        </div>
    );
}

// ── Password Section ──────────────────────────────────────────────────────────
function PasswordSection() {
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    const showToast = (msg: string, ok: boolean) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3500);
    };

    const strength = (() => {
        if (!next) return 0;
        let s = 0;
        if (next.length >= 6) s++;
        if (next.length >= 10) s++;
        if (/[A-Z]/.test(next)) s++;
        if (/[0-9]/.test(next)) s++;
        if (/[^A-Za-z0-9]/.test(next)) s++;
        return s;
    })();

    const strengthLabel = ["", "อ่อนมาก", "อ่อน", "ปานกลาง", "แข็งแรง", "แข็งแรงมาก"][strength];
    const strengthColor = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"][strength];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!current || !next || !confirm) { showToast("กรุณากรอกข้อมูลให้ครบถ้วน", false); return; }
        if (next !== confirm) { showToast("รหัสผ่านใหม่ไม่ตรงกัน", false); return; }
        if (next.length < 6) { showToast("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร", false); return; }

        setLoading(true);
        try {
            const res = await fetch("/api/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword: current, newPassword: next }),
                credentials: "include",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "เกิดข้อผิดพลาด");
            showToast("เปลี่ยนรหัสผ่านสำเร็จ", true);
            setCurrent(""); setNext(""); setConfirm("");
        } catch (err) {
            showToast((err as Error).message, false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <AnimatePresence>{toast && <Toast msg={toast.msg} ok={toast.ok} />}</AnimatePresence>
            <form onSubmit={handleSubmit} className="space-y-5">
                <PasswordField id="current" label="รหัสผ่านปัจจุบัน" value={current} onChange={setCurrent} disabled={loading} placeholder="••••••••" />
                <PasswordField id="new" label="รหัสผ่านใหม่" value={next} onChange={setNext} disabled={loading} placeholder="อย่างน้อย 6 ตัวอักษร" />

                {next.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5">
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex-1 h-1.5 rounded-full transition-all duration-300"
                                    style={{ backgroundColor: i <= strength ? strengthColor : "#e5e7eb" }} />
                            ))}
                        </div>
                        <p className="text-xs font-medium" style={{ color: strengthColor }}>{strengthLabel}</p>
                    </motion.div>
                )}

                <PasswordField id="confirm" label="ยืนยันรหัสผ่านใหม่" value={confirm} onChange={setConfirm} disabled={loading} placeholder="••••••••" />

                {confirm.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className={`flex items-center gap-1.5 text-xs font-medium ${next === confirm ? "text-green-600" : "text-red-500"}`}>
                        {next === confirm ? <Check size={13} /> : <AlertCircle size={13} />}
                        {next === confirm ? "รหัสผ่านตรงกัน" : "รหัสผ่านไม่ตรงกัน"}
                    </motion.div>
                )}

                <button type="submit"
                    disabled={loading || !current || !next || !confirm || next !== confirm}
                    className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors text-sm">
                    {loading
                        ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}><RefreshCw size={15} /></motion.span>
                        : <Lock size={15} />}
                    {loading ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
                </button>
            </form>
        </>
    );
}

// ── Font Size Section ─────────────────────────────────────────────────────────
const FONT_OPTIONS: { value: FontSize; label: string; desc: string; size: string }[] = [
    { value: "sm", label: "เล็ก", desc: "13px", size: "20px" },
    { value: "md", label: "กลาง", desc: "15px — มาตรฐาน", size: "26px" },
    { value: "lg", label: "ใหญ่", desc: "17px", size: "32px" },
    { value: "xl", label: "ใหญ่มาก", desc: "20px — สายตาพักผ่อน", size: "40px" },
];

function FontSizeSection() {
    const { fontSize, setFontSize } = useSettings();
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {FONT_OPTIONS.map((opt) => {
                    const active = fontSize === opt.value;
                    return (
                        <button key={opt.value} onClick={() => setFontSize(opt.value)}
                            className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-150 ${active ? "border-green-600 bg-green-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                            {active && (
                                <motion.div layoutId="font-check"
                                    className="absolute top-2 right-2 w-4 h-4 rounded-full bg-green-600 flex items-center justify-center"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}>
                                    <Check size={10} className="text-white" />
                                </motion.div>
                            )}
                            <span className="font-bold text-gray-800" style={{ fontSize: opt.size }}>ก</span>
                            <div className="text-center">
                                <p className={`text-xs font-bold ${active ? "text-green-700" : "text-gray-700"}`}>{opt.label}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</p>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Live preview */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">ตัวอย่างข้อความ</p>
                <p className="text-gray-800 leading-relaxed">โรงพยาบาลพลับพลาชัย — ระบบรายงานข้อมูลสุขภาพ</p>
                <p className="text-sm text-gray-500 mt-1">ผู้รับบริการ OPD ในเวลา · บัตรทอง UC · สิทธิ์ราชการ</p>
            </div>
        </div>
    );
}

// ── Dark Mode Section ─────────────────────────────────────────────────────────
function DarkModeSection() {
    const { darkMode, setDarkMode } = useSettings();
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-200 bg-white">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${darkMode ? "bg-indigo-100" : "bg-amber-100"}`}>
                        {darkMode ? <Moon size={20} className="text-indigo-600" /> : <Sun size={20} className="text-amber-600" />}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-800">{darkMode ? "โหมดกลางคืน" : "โหมดกลางวัน"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{darkMode ? "พื้นหลังสีเข้ม ลดแสงสะท้อน" : "พื้นหลังสีขาว มองเห็นชัด"}</p>
                    </div>
                </div>

                <button onClick={() => setDarkMode(!darkMode)}
                    className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${darkMode ? "bg-indigo-600" : "bg-gray-300"}`}
                    aria-label="สลับโหมดสีเข้ม">
                    <motion.div animate={{ x: darkMode ? 28 : 4 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm flex items-center justify-center">
                        {darkMode ? <Moon size={10} className="text-indigo-600" /> : <Sun size={10} className="text-amber-500" />}
                    </motion.div>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {[
                    { dark: false, icon: Sun, label: "โหมดกลางวัน", desc: "เหมาะสำหรับใช้งานปกติ", iconColor: "text-amber-500", bg: "bg-amber-50" },
                    { dark: true, icon: Moon, label: "โหมดกลางคืน", desc: "เหมาะสำหรับใช้งานตอนดึก", iconColor: "text-indigo-500", bg: "bg-indigo-50" },
                ].map((opt) => {
                    const active = darkMode === opt.dark;
                    const Icon = opt.icon;
                    return (
                        <button key={String(opt.dark)} onClick={() => setDarkMode(opt.dark)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${active ? (opt.dark ? "border-indigo-500" : "border-amber-500") : "border-gray-200 hover:border-gray-300"} ${opt.bg}`}>
                            <Icon size={24} className={opt.iconColor} />
                            <p className="text-xs font-bold text-gray-700">{opt.label}</p>
                            <p className="text-[10px] text-gray-400">{opt.desc}</p>
                            {active && <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center"><Check size={10} className="text-white" /></div>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({ icon: Icon, title, desc, children, accentColor = "#1a5233", accentBg = "#f0faf4" }: {
    icon: React.ElementType; title: string; desc: string; children: React.ReactNode;
    accentColor?: string; accentBg?: string;
}) {
    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: accentBg }}>
                    <Icon size={18} style={{ color: accentColor }} strokeWidth={1.8} />
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-900">{title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
            </div>
            <div className="px-6 py-5">{children}</div>
        </motion.div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
    return (
        <div className="max-w-2xl mx-auto space-y-5">
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-700 flex items-center justify-center">
                    <Settings2 size={18} className="text-white" />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-gray-900">ตั้งค่าระบบ</h1>
                    <p className="text-xs text-gray-400">จัดการรหัสผ่าน การแสดงผล และธีม</p>
                </div>
            </motion.div>

            <SectionCard icon={Lock} title="เปลี่ยนรหัสผ่าน" desc="ใช้รหัสผ่านเดียวกับระบบ HosXP" accentColor="#1a5233" accentBg="#f0faf4">
                <PasswordSection />
            </SectionCard>

            <SectionCard icon={Type} title="ขนาดตัวอักษร" desc="ปรับให้เหมาะสมกับสายตา มีผลทันที" accentColor="#0369A1" accentBg="#E0F2FE">
                <FontSizeSection />
            </SectionCard>

            <SectionCard icon={Moon} title="โหมดสีเข้ม (Dark Mode)" desc="สลับธีมสว่าง/มืด มีผลทันที" accentColor="#4338ca" accentBg="#eef2ff">
                <DarkModeSection />
            </SectionCard>
        </div>
    );
}