"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function Dropdown<T extends string>({
    value, options, onChange, className = "",
}: {
    value: T;
    options: { key: T; label: string }[];
    onChange: (v: T) => void;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const label = options.find(o => o.key === value)?.label ?? value;

    useEffect(() => {
        const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button onClick={() => setOpen(p => !p)}
                className="flex items-center gap-2 border border-gray-300 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400 transition-colors min-w-[160px] justify-between">
                <span>{label}</span>
                <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-full overflow-hidden">
                        {options.map(o => (
                            <button key={o.key} onClick={() => { onChange(o.key); setOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${value === o.key ? "text-green-700 font-semibold bg-green-50" : "text-gray-700"}`}>
                                {o.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}