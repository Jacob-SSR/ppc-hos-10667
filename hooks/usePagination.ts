// hooks/usePagination.ts
// แทนที่ page/setPage/totalPages/paged + reset ที่ซ้ำใน
// PatientTable ของ drug/sepsis/homeward/stroke dashboard
"use client";

import { useState, useMemo } from "react";

export function usePagination<T>(rows: T[], pageSize = 20) {
  const [page, setPage] = useState(1);
  const [prevLen, setPrevLen] = useState(rows.length);

  // reset เมื่อจำนวน rows เปลี่ยน (เช่น filter)
  // ปรับ state ระหว่าง render ตามแนวทาง React แทนการใช้ useEffect
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (rows.length !== prevLen) {
    setPrevLen(rows.length);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  const paged = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );

  return { page, setPage, totalPages, paged, pageSize };
}
