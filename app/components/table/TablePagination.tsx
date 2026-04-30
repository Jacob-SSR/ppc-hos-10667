// components/table/TablePagination.tsx
// แทนที่ pagination block ที่เขียนซ้ำกัน 100% ใน ReportTable.tsx และ PpaTable.tsx
//
// Code เดิมที่ซ้ำ (~30 บรรทัดต่อไฟล์):
//   <motion.div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100" ...>
//     <p>หน้า {page} / {totalPages}</p>
//     <div className="flex items-center gap-2">
//       <motion.button onClick={() => setPage(p => Math.max(p-1, 1))} ...>← ก่อนหน้า</motion.button>
//       <motion.span key={page} ...>{page}</motion.span>
//       <motion.button onClick={() => setPage(p => Math.min(p+1, totalPages))} ...>ถัดไป →</motion.button>
//     </div>
//   </motion.div>

"use client";

import { motion } from "framer-motion";

interface TablePaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({
  page,
  totalPages,
  onPageChange,
}: TablePaginationProps) {
  return (
    <motion.div
      className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <p className="text-sm font-medium text-gray-500">
        หน้า{" "}
        <span className="font-bold text-gray-800">{page}</span>
        {" "}/ {totalPages}
      </p>

      <div className="flex items-center gap-2">
        <motion.button
          onClick={() => onPageChange(Math.max(page - 1, 1))}
          disabled={page === 1}
          className="px-5 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 disabled:opacity-30 transition-colors duration-150"
          whileHover={{ scale: 1.04, borderColor: "#7ec8a0", color: "#1a5233" }}
          whileTap={{ scale: 0.94 }}
        >
          ← ก่อนหน้า
        </motion.button>

        <motion.span
          key={page}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className="rounded-lg px-4 py-2 text-sm font-bold min-w-[3rem] text-center border-2"
          style={{
            borderColor: "#7ec8a0",
            color: "#1a5233",
            backgroundColor: "#f0faf4",
          }}
        >
          {page}
        </motion.span>

        <motion.button
          onClick={() => onPageChange(Math.min(page + 1, totalPages))}
          disabled={page === totalPages}
          className="px-5 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 disabled:opacity-30 transition-colors duration-150"
          whileHover={{ scale: 1.04, borderColor: "#7ec8a0", color: "#1a5233" }}
          whileTap={{ scale: 0.94 }}
        >
          ถัดไป →
        </motion.button>
      </div>
    </motion.div>
  );
}

/*
  วิธีใช้:
  ─────────────────────────────────────────────────────────────────────────────
  import { TablePagination } from "@/components/table/TablePagination";

  // ใน ReportTable และ PpaTable แทนที่ pagination block ทั้งหมด:
  <TablePagination
    page={page}
    totalPages={totalPages}
    onPageChange={setPage}
  />
  ─────────────────────────────────────────────────────────────────────────────
*/