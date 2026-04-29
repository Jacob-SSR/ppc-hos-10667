// app/components/CsvDropzone.tsx
"use client";

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, CheckCircle2, XCircle, FileText, RefreshCw } from "lucide-react";

interface UploadResult {
    success: boolean;
    message?: string;
    error?: string;
    rows?: number;
    filename?: string;
    size?: number;
}

interface CsvDropzoneProps {
    onUploadSuccess?: () => void; // callback ให้ reload data
}

export default function CsvDropzone({ onUploadSuccess }: CsvDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<UploadResult | null>(null);

    const upload = useCallback(async (file: File) => {
        if (!file.name.endsWith(".csv")) {
            setResult({ success: false, error: "รองรับเฉพาะไฟล์ .csv" });
            return;
        }

        setUploading(true);
        setResult(null);

        const form = new FormData();
        form.append("file", file);

        try {
            const res = await fetch("/api/it-worklog-upload", {
                method: "POST",
                body: form,
                credentials: "include",
            });
            const json: UploadResult = await res.json();
            setResult(json);
            if (json.success) {
                // รอ animation เสร็จแล้ว reload data
                setTimeout(() => onUploadSuccess?.(), 800);
            }
        } catch {
            setResult({ success: false, error: "เชื่อมต่อ server ไม่ได้" });
        } finally {
            setUploading(false);
        }
    }, [onUploadSuccess]);

    // Drag events
    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
    const onDragLeave = () => setDragging(false);
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) upload(file);
    };
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) upload(file);
        e.target.value = ""; // reset ให้อัปโหลดซ้ำได้
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-bold text-[#717171]">อัปเดตไฟล์ข้อมูล</h4>
                <span className="text-[11px] text-gray-400 font-medium">
                    it-worklog.csv
                </span>
            </div>

            {/* Drop zone */}
            <motion.div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !uploading && inputRef.current?.click()}
                animate={{
                    borderColor: dragging ? "#3aa36a" : uploading ? "#a8d5ba" : "#d1d5db",
                    backgroundColor: dragging ? "#f0faf4" : "#fafafa",
                    scale: dragging ? 1.01 : 1,
                }}
                transition={{ duration: 0.15 }}
                className="relative border-2 border-dashed rounded-xl cursor-pointer flex flex-col items-center justify-center gap-3 py-8 px-4 select-none"
                style={{ minHeight: 140 }}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={onFileChange}
                />

                <AnimatePresence mode="wait">
                    {uploading ? (
                        <motion.div
                            key="uploading"
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            className="flex flex-col items-center gap-3"
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                                <RefreshCw size={32} className="text-green-600" />
                            </motion.div>
                            <p className="text-sm font-semibold text-green-700">กำลังอัปโหลด...</p>
                        </motion.div>
                    ) : result?.success ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center gap-2"
                        >
                            <CheckCircle2 size={36} className="text-green-600" />
                            <p className="text-sm font-bold text-green-700">{result.message}</p>
                            <p className="text-xs text-gray-400">{result.filename}</p>
                            <p
                                className="text-xs mt-1 underline cursor-pointer text-green-600"
                                onClick={(e) => { e.stopPropagation(); setResult(null); }}
                            >
                                อัปโหลดไฟล์ใหม่
                            </p>
                        </motion.div>
                    ) : result?.error ? (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center gap-2"
                        >
                            <XCircle size={32} className="text-red-500" />
                            <p className="text-sm font-semibold text-red-600">{result.error}</p>
                            <p
                                className="text-xs underline cursor-pointer text-gray-500"
                                onClick={(e) => { e.stopPropagation(); setResult(null); }}
                            >
                                ลองใหม่
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center gap-2 pointer-events-none"
                        >
                            <motion.div
                                animate={dragging ? { y: -6 } : { y: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                            >
                                <UploadCloud
                                    size={36}
                                    style={{ color: dragging ? "#3aa36a" : "#9ca3af" }}
                                />
                            </motion.div>
                            <p className="text-sm font-semibold text-gray-600">
                                {dragging ? "ปล่อยเพื่ออัปโหลด" : "ลากวางไฟล์ หรือคลิกเพื่อเลือก"}
                            </p>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                <FileText size={11} />
                                <span>it-worklog.csv เท่านั้น</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Info */}
            {!result && (
                <p className="text-[11px] text-gray-400 mt-2.5 text-center">
                    ไฟล์จะ overwrite <code className="bg-gray-100 px-1 rounded">it-worklog.csv</code> ถาวรทันที — ข้อมูลจะโหลดใหม่อัตโนมัติ
                </p>
            )}
        </div>
    );
}