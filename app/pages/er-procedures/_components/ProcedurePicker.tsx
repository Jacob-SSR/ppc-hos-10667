"use client";

// ตัวเลือกหัตถการแบบเลือกได้หลายรายการ + ช่องค้นหา
// ทะเบียนหัตถการ ER มีหลายสิบรายการ — Dropdown ปกติ (rdu-dashboard) เลือกได้ทีละอัน
// และไม่มีช่องค้นหา จึงทำตัวเลือกเฉพาะของหน้านี้แทน
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Search, X } from "lucide-react";
import type { ErProcedureCatalogItem } from "@/lib/erProcedures.service";

interface Props {
  catalog: ErProcedureCatalogItem[];
  /** icode ที่เลือกอยู่ — ว่าง = ทุกหัตถการ */
  selected: string[];
  onChange: (icodes: string[]) => void;
  disabled?: boolean;
}

export function ProcedurePicker({ catalog, selected, onChange, disabled }: Props) {
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
    if (!kw) return catalog;
    return catalog.filter(
      (c) =>
        c.name.toLowerCase().includes(kw) ||
        c.icode.toLowerCase().includes(kw) ||
        c.operCode.toLowerCase().includes(kw),
    );
  }, [catalog, q]);

  const label =
    selected.length === 0
      ? "ทุกหัตถการ"
      : selected.length === 1
        ? (catalog.find((c) => c.icode === selected[0])?.name ?? selected[0])
        : `เลือกไว้ ${selected.length} หัตถการ`;

  const toggle = (icode: string) => {
    onChange(
      selectedSet.has(icode)
        ? selected.filter((c) => c !== icode)
        : [...selected, icode],
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
            className="absolute right-0 top-full mt-1 w-[330px] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
          >
            <div className="p-2 border-b border-gray-100 flex items-center gap-2">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาชื่อหัตถการ / รหัส"
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
                {selected.length === 0 ? "แสดงทุกหัตถการ" : `เลือกไว้ ${selected.length} รายการ`}
              </span>
              <button
                onClick={() => onChange([])}
                disabled={selected.length === 0}
                className="text-[11px] font-semibold text-green-700 disabled:text-gray-300"
              >
                ล้างตัวเลือก
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-center text-xs text-gray-400 py-6">ไม่พบหัตถการที่ค้นหา</p>
              )}
              {filtered.map((c) => {
                const on = selectedSet.has(c.icode);
                return (
                  <button
                    key={c.icode}
                    onClick={() => toggle(c.icode)}
                    className={`w-full flex items-start gap-2 text-left px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${on ? "bg-green-50" : ""}`}
                  >
                    <span
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${on ? "bg-green-600 border-green-600" : "border-gray-300"}`}
                    >
                      {on && <Check size={11} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block truncate ${on ? "text-green-800 font-semibold" : "text-gray-700"}`}>
                        {c.name}
                      </span>
                      <span className="block text-[11px] text-gray-400 font-mono">
                        {c.icode}
                        {c.operCode ? ` · ER ${c.operCode}` : ""}
                      </span>
                    </span>
                    <span
                      className={`text-[11px] font-semibold tabular-nums flex-shrink-0 ${c.count ? "text-gray-500" : "text-gray-300"}`}
                    >
                      {c.count}
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
