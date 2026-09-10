"use client";

// ตัวเลือก "หมวดหมู่รายละเอียดการให้บริการ" แบบเลือกได้หลายหมวด + ช่องค้นหา
// ค้นได้ทั้งชื่อหมวดและ "คำที่ใช้จับหมวดนั้น" (hint) เช่นพิมพ์ "เสมหะ" แล้วเจอ
// หมวดกายภาพทรวงอก — คนกายภาพนึกคำที่ตัวเองพิมพ์ในเวชระเบียนออกก่อนชื่อหมวดเสมอ
// แสดง "ยอดครั้ง / จำนวน AN" กำกับทุกหมวด เพื่อเลือกได้โดยไม่ต้องเปิดกราฟดูก่อน
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Search, X } from "lucide-react";
import type { PtIpdCategoryItem } from "@/lib/ptIpdRegister.service";

interface Props {
  categories: PtIpdCategoryItem[];
  /** key ของหมวดที่เลือกอยู่ — ว่าง = ทุกหมวด */
  selected: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
}

export function CategoryPicker({ categories, selected, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return categories;
    return categories.filter(
      (c) =>
        c.label.toLowerCase().includes(kw) || c.hint.toLowerCase().includes(kw),
    );
  }, [categories, q]);

  const label =
    selected.length === 0
      ? "ทุกหมวดหมู่"
      : selected.length === 1
        ? (categories.find((c) => c.key === selected[0])?.label ?? selected[0])
        : `เลือกไว้ ${selected.length} หมวด`;

  const toggle = (key: string) => {
    onChange(
      selectedSet.has(key)
        ? selected.filter((k) => k !== key)
        : [...selected, key],
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 border border-gray-300 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400 transition-colors min-w-[210px] max-w-[280px] justify-between disabled:opacity-50"
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 w-[340px] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
          >
            <div className="p-2 border-b border-gray-100 flex items-center gap-2">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาหมวด หรือคำที่บันทึก เช่น เสมหะ, ฝึกเดิน"
                className="w-full text-sm outline-none text-gray-700 placeholder:text-gray-300"
              />
              {q && (
                <button onClick={() => setQ("")} className="text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-gray-50">
              <span className="text-[11px] text-gray-400">
                {selected.length === 0 ? "แสดงทุกหมวดหมู่" : `เลือกไว้ ${selected.length} หมวด`}
              </span>
              <button
                onClick={() => onChange([])}
                disabled={selected.length === 0}
                className="text-[11px] font-semibold text-green-700 disabled:text-gray-300"
              >
                ล้างตัวเลือก
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-center text-xs text-gray-400 py-6">
                  {categories.length === 0 ? "ยังไม่มีข้อมูล" : "ไม่พบหมวดที่ค้นหา"}
                </p>
              )}
              {filtered.map((c) => {
                const on = selectedSet.has(c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => toggle(c.key)}
                    title={`คำที่ใช้จับหมวดนี้: ${c.hint}`}
                    className={`w-full flex items-start gap-2 text-left px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${on ? "bg-green-50" : ""}`}
                  >
                    <span
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${on ? "bg-green-600 border-green-600" : "border-gray-300"}`}
                    >
                      {on && <Check size={11} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: c.color }} />
                        <span className={`truncate ${on ? "text-green-800 font-semibold" : "text-gray-700"}`}>
                          {c.label}
                        </span>
                      </span>
                      <span className="block text-[10px] text-gray-400 truncate">{c.hint}</span>
                    </span>
                    <span className="text-right flex-shrink-0">
                      <span className={`block text-[11px] font-semibold tabular-nums ${c.count ? "text-gray-500" : "text-gray-300"}`}>
                        {c.count}
                      </span>
                      <span className="block text-[10px] text-gray-300 tabular-nums">{c.admissions} AN</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
