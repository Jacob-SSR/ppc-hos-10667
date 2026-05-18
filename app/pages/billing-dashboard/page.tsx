"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { RefreshCw, TrendingUp, AlertTriangle, BadgeCheck, Info } from "lucide-react";
import type { BillingDashboardData, BillingUnitSummary, BillingItemSummary } from "@/types/allTypes";

import { KpiCard }        from "./components/KpiCard";
import { UnitCard }       from "./components/UnitCard";
import { RemarkTable }    from "./components/RemarkTable";
import { UploadDropzone } from "./components/UploadDropzone";
import BillingBarChart    from "./components/BillingBarChart";
import BillingCrossTab    from "./BillingCrossTab";

const fmt = (n: number) => n.toLocaleString("th-TH");

export default function BillingDashboardPage() {
  const [data, setData] = useState<BillingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noFile, setNoFile] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoFile(false);
    try {
      const res = await fetch("/api/billing-dashboard", { credentials: "include" });
      if (res.status === 404) { setNoFile(true); setLoading(false); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPending = data ? data.totalClaim - data.totalComp - data.totalNoComp : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Dashboard การเบิกจ่ายค่าบริการ</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            แยกตามประเภทที่ขอเบิก รพ.สต. และโรงพยาบาลพลับพลาชัย
            {data && (
              <span className="ml-2">
                · อัปเดต {new Date(data.updatedAt).toLocaleString("th-TH")}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <motion.span
            animate={loading ? { rotate: 360 } : { rotate: 0 }}
            transition={loading ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}
          >
            <RefreshCw size={14} />
          </motion.span>
          รีเฟรช
        </button>
      </div>

      {/* No file */}
      {noFile && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
          <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูล</p>
            <p className="text-xs text-amber-700 mt-1">
              กรุณาอัปโหลดไฟล์ Excel จาก หมอพร้อม / DMOR ด้านล่าง
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* KPI Cards */}
      {(loading || data) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[130px] rounded-2xl bg-gray-100 animate-pulse" />
              ))
            : data && (
                <>
                  <KpiCard
                    icon={TrendingUp}
                    label="รายการทั้งหมด"
                    value={fmt(data.totalRows)}
                    sub="รายการขอเบิก"
                    accent="#0369A1"
                    bg="#E0F2FE"
                  />
                  <KpiCard
                    icon={TrendingUp}
                    label="เรียกเก็บรวม"
                    value={fmt(data.totalClaim)}
                    sub="บาท"
                    accent="#854D0E"
                    bg="#FEF9C3"
                  />
                  <KpiCard
                    icon={BadgeCheck}
                    label="ชดเชยแล้ว"
                    value={fmt(data.totalComp)}
                    sub={`${
                      data.totalClaim > 0
                        ? Math.round((data.totalComp / data.totalClaim) * 1000) / 10
                        : 0
                    }% ของที่เรียกเก็บ`}
                    accent="#3B6D11"
                    bg="#EAF3DE"
                  />
                  <KpiCard
                    icon={AlertTriangle}
                    label="ยังค้างชดเชย"
                    value={fmt(totalPending)}
                    sub={`${data.units.reduce(
                      (s: number, u: BillingUnitSummary) =>
                        s +
                        u.items
                          .filter((item: BillingItemSummary) => item.สถานะ === "ไม่ชดเชย")
                          .reduce((n: number, item: BillingItemSummary) => n + item.จำนวน, 0),
                      0,
                    )} รายการ`}
                    accent="#991B1B"
                    bg="#FEE2E2"
                  />
                </>
              )}
        </div>
      )}

      {/* Bar Chart */}
      {data && <BillingBarChart data={data} />}

      {/* Cross-tab */}
      {data && <BillingCrossTab data={data} />}

      {/* Unit cards */}
      {data && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
            รายละเอียดแยกตามหน่วยบริการ
          </p>
          {data.units.map((unit) => (
            <UnitCard key={unit.hcodeKey} unit={unit} />
          ))}
        </div>
      )}

      {/* Remark */}
      {data && <RemarkTable data={data.remarkSummary} />}

      {/* Upload */}
      <UploadDropzone onSuccess={fetchData} />
    </div>
  );
}