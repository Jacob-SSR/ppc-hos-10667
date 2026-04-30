// components/table/TableRow.tsx
// แทนที่ tbody row ที่เขียนซ้ำกัน 100% ใน ReportTable.tsx และ PpaTable.tsx
// รวม: zebra stripe, hover color, copy-to-clipboard button, Thai date format

"use client";

import { motion } from "framer-motion";
import { FiCopy } from "react-icons/fi";
import toast from "react-hot-toast";
import { copyToClipboard } from "@/lib/clipboard";
import { formatThaiDate } from "@/lib/dateUtils";

interface TableRowProps {
  row: Record<string, unknown>;
  index: number;
  dateKeys?: string[];
  /** columns ที่มี filter active — highlight สีเขียวอ่อน */
  activeFilterKeys?: string[];
}

export function TableRow({
  row,
  index,
  dateKeys = [],
  activeFilterKeys = [],
}: TableRowProps) {
  const isEven = index % 2 === 0;
  const baseColor = isEven ? "#ffffff" : "#f9fafb";

  return (
    <tr
      className="border-b border-gray-100 transition-colors duration-100"
      style={{ backgroundColor: baseColor }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = "#f0faf4")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = baseColor)
      }
    >
      {Object.entries(row).map(([key, val], idx) => {
        const isDate =
          dateKeys.includes(key) &&
          val &&
          (String(val).includes("-") || String(val).includes("T"));

        const displayText = isDate
          ? formatThaiDate(val)
          : String(val ?? "");

        const isFiltered = activeFilterKeys.includes(key);

        return (
          <td
            key={idx}
            className="px-4 py-2.5 text-sm whitespace-nowrap border-r border-gray-100 text-gray-800"
            style={isFiltered ? { backgroundColor: "#f0faf4" } : {}}
          >
            <div className="flex items-center justify-between gap-2 group">
              <span>{displayText}</span>
              <motion.button
                onClick={() => {
                  copyToClipboard(displayText);
                  toast.success("คัดลอกแล้ว");
                }}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-gray-500"
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.85 }}
              >
                <FiCopy size={14} />
              </motion.button>
            </div>
          </td>
        );
      })}
    </tr>
  );
}

/*
  วิธีใช้:
  ─────────────────────────────────────────────────────────────────────────────
  import { TableRow } from "@/components/table/TableRow";

  // ใน ReportTable / PpaTable แทนที่ tbody map ทั้งหมด:
  <tbody>
    {paginatedData.map((row, i) => (
      <TableRow
        key={i}
        row={row}
        index={i}
        dateKeys={dateKeys}
        activeFilterKeys={Object.keys(columnFilters).filter(k => columnFilters[k])}
      />
    ))}
  </tbody>
  ─────────────────────────────────────────────────────────────────────────────
*/