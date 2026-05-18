// app/pages/billing-dashboard/components/UploadDropzone.tsx
"use client";

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

interface UploadDropzoneProps {
  onSuccess: () => void;
}

export function UploadDropzone({ onSuccess }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/billing-upload", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = await res.json();
      setResult({ ok: json.success, msg: json.message ?? json.error });
      if (json.success) setTimeout(onSuccess, 600);
    } catch {
      setResult({ ok: false, msg: "เชื่อมต่อ server ไม่ได้" });
    } finally {
      setUploading(false);
    }
  }, [onSuccess]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-[#717171]">อัปโหลดข้อมูลการเบิกจ่าย</h4>
        <span className="text-[11px] text-gray-400">billing.xlsx</span>
      </div>

      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) upload(f);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        animate={{
          borderColor: dragging ? "#3aa36a" : "#d1d5db",
          backgroundColor: dragging ? "#f0faf4" : "#fafafa",
          scale: dragging ? 1.01 : 1,
        }}
        className="border-2 border-dashed rounded-xl cursor-pointer flex flex-col items-center justify-center gap-2 py-6 px-4 select-none"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />

        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <RefreshCw size={28} className="text-green-600" />
              </motion.div>
              <p className="text-sm font-semibold text-green-700">กำลังอัปโหลด...</p>
            </motion.div>
          ) : result?.ok ? (
            <motion.div key="ok" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
              <CheckCircle2 size={28} className="text-green-600" />
              <p className="text-sm font-bold text-green-700">{result.msg}</p>
              <p
                className="text-xs text-gray-400 underline cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setResult(null); }}
              >
                อัปโหลดไฟล์ใหม่
              </p>
            </motion.div>
          ) : result ? (
            <motion.div key="err" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
              <XCircle size={28} className="text-red-500" />
              <p className="text-sm font-semibold text-red-600">{result.msg}</p>
              <p
                className="text-xs text-gray-500 underline cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setResult(null); }}
              >
                ลองใหม่
              </p>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1 pointer-events-none">
              <motion.div
                animate={dragging ? { y: -6 } : { y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                <UploadCloud size={28} style={{ color: dragging ? "#3aa36a" : "#9ca3af" }} />
              </motion.div>
              <p className="text-sm font-semibold text-gray-600">
                {dragging ? "ปล่อยเพื่ออัปโหลด" : "ลากวางไฟล์ หรือคลิกเพื่อเลือก"}
              </p>
              <p className="text-xs text-gray-400">.xlsx จาก หมอพร้อม / DMOR เท่านั้น</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}