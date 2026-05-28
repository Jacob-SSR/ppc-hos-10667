// hooks/usePagination.ts
// แทนที่ page/setPage/totalPages/paged + useEffect(reset) ที่ซ้ำใน
// PatientTable ของ drug/sepsis/homeward/stroke dashboard
"use client";

import { useState, useEffect, useMemo } from "react";

export function usePagination<T>(rows: T[], pageSize = 20) {
  const [page, setPage] = useState(1);

  // reset เมื่อจำนวน rows เปลี่ยน (เช่น filter)
  useEffect(() => setPage(1), [rows.length]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  const paged = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );

  return { page, setPage, totalPages, paged, pageSize };
}
