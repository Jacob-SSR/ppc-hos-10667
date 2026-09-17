import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

const DASHBOARD_URL =
  "https://script.google.com/macros/s/AKfycbyA38KbqNEaJCap9K16FkYHyznWhx5PU0JeIr6RfUbrmMdW2L3ma-2o_ADshIPLrP0BLQ/exec";

export const metadata: Metadata = {
  title: "ระบบติดตามสถานะชาร์ท | โรงพยาบาลพลับพลาชัย",
};

export default function ChartTrackingPage() {
  return (
    <section className="flex min-h-full min-w-0 flex-col gap-4 pb-16 md:pb-0">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-gray-500">
            Executive Dashboard · งานประกันสุขภาพ
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            ระบบติดตามสถานะชาร์ท
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            C3 ผู้ป่วยใน: Chart – Code – Claim · รพ.พลับพลาชัย
          </p>
          <p className="mt-1 text-sm text-gray-600">
            ติดตามชาร์ทผู้ป่วยในสู่การส่งเคลมทันเวลา · เกณฑ์ภายใน 15 วันหลังจำหน่าย
          </p>
        </div>
        <a
          href={DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          เปิดหน้าเต็ม
          <span className="sr-only"> (แท็บใหม่)</span>
        </a>
      </header>

      <p id="chart-tracking-help" className="text-sm text-gray-500">
        หากรายงานไม่แสดงหรือ Google ขอให้เข้าสู่ระบบ ให้กด “เปิดหน้าเต็ม”
      </p>
      <iframe
        src={DASHBOARD_URL}
        title="ระบบติดตามสถานะชาร์ท — C3 ผู้ป่วยใน: Chart – Code – Claim"
        aria-describedby="chart-tracking-help"
        className="block min-h-[36rem] w-full flex-1 rounded-lg border border-gray-200 bg-gray-50"
        style={{ height: "calc(100dvh - 18rem)" }}
        referrerPolicy="no-referrer"
        allowFullScreen
      />
    </section>
  );
}
