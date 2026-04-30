// components/table/TableHeader.tsx
// แทนที่ thead + sort logic ที่เขียนซ้ำกัน 100% ใน ReportTable.tsx และ PpaTable.tsx

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";

interface TableHeaderProps {
  columns: string[];
  sortKey: string | null;
  sortAsc: boolean;
  onSort: (key: string) => void;
  /** highlight columns ที่มี filter active */
  activeFilterKeys?: string[];
}

export function TableHeader({
  columns,
  sortKey,
  sortAsc,
  onSort,
  activeFilterKeys = [],
}: TableHeaderProps) {
  return (
    <thead>
      <tr>
        {columns.map((key, i) => (
          <motion.th
            key={key}
            onClick={() => onSort(key)}
            className="sticky top-0 text-white px-4 py-3 text-left cursor-pointer whitespace-nowrap border-r select-none"
            style={{ backgroundColor: "#7ec8a0", borderColor: "#a8d5ba" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 + i * 0.025 }}
            whileHover={{ backgroundColor: "#55b882" }}
          >
            <div className="flex items-center gap-1">
              {key}
              {activeFilterKeys.includes(key) && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-white opacity-80 ml-0.5"
                />
              )}
              <AnimatePresence>
                {sortKey === key && (
                  <motion.span
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.18 }}
                  >
                    {sortAsc ? (
                      <FiChevronUp size={14} />
                    ) : (
                      <FiChevronDown size={14} />
                    )}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </motion.th>
        ))}
      </tr>
    </thead>
  );
}

/*
  วิธีใช้:
  ─────────────────────────────────────────────────────────────────────────────
  import { TableHeader } from "@/components/table/TableHeader";

  // ใน ReportTable / PpaTable แทนที่ thead block:
  <TableHeader
    columns={Object.keys(paginatedData[0])}
    sortKey={sortKey}
    sortAsc={sortAsc}
    onSort={handleSort}
    activeFilterKeys={Object.keys(columnFilters).filter(k => columnFilters[k])}
  />
  ─────────────────────────────────────────────────────────────────────────────
*/