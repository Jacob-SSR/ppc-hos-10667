"use client";

import { useEffect, useState } from "react";
import type { IcdDisease } from "@/lib/icd-disease-search";
import styles from "./report.module.css";

export default function IcdCodeName({ code }: { code: string }) {
  const normalized = code.trim().toUpperCase().replace(/\./g, "");
  const valid = /^[A-Z][0-9]{2}[A-Z0-9]{0,4}$/.test(normalized);
  const [result, setResult] = useState<{ code: string; item?: IcdDisease; error?: boolean }>();
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/icd10-report/diseases?q=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("lookup failed");
        const data = await response.json();
        const item = (data.items as IcdDisease[]).find(item => item.code.toUpperCase().replace(/\./g, "") === normalized);
        if (!controller.signal.aborted) setResult({ code: normalized, item });
      } catch {
        if (!controller.signal.aborted) setResult({ code: normalized, error: true });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [normalized, valid]);
  const current = result?.code === normalized ? result : undefined;
  return <span className={styles.codeName} aria-live="polite">
    {!valid ? "ใส่รหัสให้ครบเพื่อแสดงชื่อโรค" : !current ? "กำลังอ่านชื่อโรค…" : current.error ? "โหลดชื่อโรคไม่ได้ กรุณาลองใหม่" : current.item?.thai_name || current.item?.name || "ไม่มีชื่อโรคของรหัสนี้ในทะเบียน"}
  </span>;
}
