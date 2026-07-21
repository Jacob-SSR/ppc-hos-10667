"use client";

import ReportTable from "@/app/components/ReportTable";
import { useState } from "react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import toast, { Toaster } from "react-hot-toast";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { formatDate } from "@/lib/dateUtils";

export default function ServiceUnitPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    appended: number;
    duplicates: number;
    newRows: number;
    label: string;
  } | null>(null);

  const getLastWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const daysToLastMonday = day === 0 ? 6 : day - 1;
    const mon = new Date(now);
    mon.setDate(now.getDate() - daysToLastMonday - 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { start: mon, end: sun };
  };

  const { start: defaultStart, end: defaultEnd } = getLastWeek();
  const [syncStart, setSyncStart] = useState<Date | null>(defaultStart);
  const [syncEnd, setSyncEnd] = useState<Date | null>(defaultEnd);

  const handleManualSync = async () => {
    if (!syncStart || !syncEnd) {
      toast.error("กรุณาเลือกช่วงวันที่");
      return;
    }

    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch("/api/sync/service-unit-to-sheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sync-secret": process.env.NEXT_PUBLIC_SYNC_SECRET ?? "ppchos10909",
        },
        body: JSON.stringify({
          start: formatDate(syncStart),
          end: formatDate(syncEnd),
        }),
        credentials: "include",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sync failed");

      setSyncResult({
        appended: json.appended,
        duplicates: json.duplicates,
        newRows: json.newRows,
        label: json.dateRange?.label ?? "",
      });

      toast.success(`Sync สำเร็จ! ส่ง ${json.appended} ราย → Google Sheets`);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Sync ไม่สำเร็จ");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { borderRadius: "10px", fontWeight: 600, fontSize: "14px" },
          success: { iconTheme: { primary: "#166534", secondary: "#fff" } },
        }}
      />

      {/* ── Sync Card ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-gray-200 rounded-2xl shadow-md px-6 py-5"
        style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.07)" }}
      >
        <div className="flex flex-wrap items-end gap-5">
          {/* Icon + Title */}
          <div className="flex items-center gap-2 self-center">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <RefreshCw size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">
                Sync → Google Sheets
              </p>
              <p className="text-xs text-gray-400">
                Auto ทุกวันจันทร์ 08:00 | หรือกด Manual
              </p>
            </div>
          </div>

          {/* Date range picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              วันที่เริ่ม
            </label>
            <DatePicker
              selected={syncStart}
              onChange={(d: Date | null) => setSyncStart(d)}
              dateFormat="dd/MM/yyyy"
              locale={th}
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              yearDropdownItemNumber={10}
              customInput={<ThaiDateInput />}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              วันที่สิ้นสุด
            </label>
            <DatePicker
              selected={syncEnd}
              onChange={(d: Date | null) => setSyncEnd(d)}
              dateFormat="dd/MM/yyyy"
              locale={th}
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              yearDropdownItemNumber={10}
              customInput={<ThaiDateInput />}
            />
          </div>

          {/* Sync Button */}
          <motion.button
            onClick={handleManualSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.97] text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-lg disabled:opacity-50 transition-colors"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
          >
            <motion.span
              animate={syncing ? { rotate: 360 } : { rotate: 0 }}
              transition={
                syncing
                  ? { duration: 0.8, repeat: Infinity, ease: "linear" }
                  : {}
              }
            >
              <RefreshCw size={15} />
            </motion.span>
            {syncing ? "กำลัง Sync..." : "Sync ทันที"}
          </motion.button>

          {/* Result badge */}
          <AnimatePresence>
            {syncResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2"
              >
                <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                <div className="text-xs font-semibold text-green-800">
                  <span className="font-black">{syncResult.appended}</span> ราย
                  <span className="mx-2 text-gray-400">|</span>
                  <span className="text-green-700">
                    ใหม่ {syncResult.newRows}
                  </span>
                  <span className="mx-1 text-gray-400">·</span>
                  <span className="text-yellow-600">
                    ซ้ำ {syncResult.duplicates}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Duplicate legend */}
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" />
            <span>ใหม่ — ไม่เคยมีใน Sheet</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ background: "#fff3a0", border: "1px solid #d4b800" }}
            />
            <span>
              ซ้ำ — CID + ชื่อ-นามสกุล ตรงกับที่มีอยู่แล้ว (highlight สีเหลือง)
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Report Table ── */}
      <ReportTable
        apiPath="/api/service-unit"
        exportFilePrefix="service-unit"
        dateKeys={["วันที่รับบริการ"]}
        sheetName="ServiceUnit"
        columnFilterKeys={[
          "หน่วยบริการ",
          "รหัสสิทธิ์",
          "ชื่อสิทธิ์",
          "ชื่อโรงพยาบาลหลัก",
          "ที่อยู่",
          "หมู่",
        ]}
        columnFilterLabels={{
          หน่วยบริการ: "หน่วยบริการ",
          รหัสสิทธิ์: "รหัสสิทธิ์",
          ชื่อสิทธิ์: "กลุ่มสิทธิ์",
          ชื่อโรงพยาบาลหลัก: "โรงพยาบาลต้นสังกัด",
          ที่อยู่: "ที่อยู่ (ตำบล/อำเภอ)",
          หมู่: "หมู่บ้าน",
        }}
      />
    </div>
  );
}
