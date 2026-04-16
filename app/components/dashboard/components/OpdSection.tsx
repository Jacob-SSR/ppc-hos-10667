"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CalendarDays,
  Search,
  Info,
  ArrowRight,
  User,
  UserCheck,
  BedDouble,
  Shield,
  UserCog,
  Globe,
  PhoneIncoming,
  PhoneOutgoing,
  Siren,
  AlertTriangle,
} from "lucide-react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import PatientDetailModal from "./PatientDetailModal";

// ── สีแต่ละการ์ด: pastel อบอุ่น สม่ำเสมอ ───────────────────────────────────
// bg = พื้นหลัง pastel อ่อน
// accent = สีข้อความและ icon (เข้มกว่าพื้น 40%)
const OPD_CARDS = [
  {
    label: "ผู้รับบริการทั้งหมด",
    bg: "#E0F2FE", // sky-100
    accent: "#0369A1", // sky-700
    visitKey: "totalVisit",
    patKey: "totalPatient",
    Icon: User,
    cardType: "all",
  },
  {
    label: "OPD ในเวลา",
    bg: "#FCE7F3", // pink-100
    accent: "#9D174D", // pink-800
    visitKey: "opdOnTime",
    patKey: null,
    Icon: UserCheck,
    cardType: "opdOnTime",
  },
  {
    label: "OPD นอกเวลา",
    bg: "#D1FAE5", // emerald-100
    accent: "#065F46", // emerald-800
    visitKey: "opdOffTime",
    patKey: null,
    Icon: UserCheck,
    cardType: "opdOffTime",
  },
  {
    label: "Admit",
    bg: "#EDE9FE", // violet-100
    accent: "#5B21B6", // violet-800
    visitKey: "admitToday",
    patKey: null,
    Icon: BedDouble,
    cardType: "admitToday",
  },
  {
    label: "สิทธิ์บัตรทอง UC",
    bg: "#FEF9C3", // yellow-100
    accent: "#854D0E", // yellow-800
    visitKey: "opdUc",
    patKey: null,
    Icon: UserCheck,
    cardType: "opdUc",
  },
  {
    label: "สิทธิ์ราชการ",
    bg: "#DBEAFE", // blue-100
    accent: "#1E40AF", // blue-800
    visitKey: "opdGov",
    patKey: null,
    Icon: Shield,
    cardType: "opdGov",
  },
  {
    label: "ประกันสังคม",
    bg: "#CCFBF1", // teal-100
    accent: "#134E4A", // teal-900
    visitKey: "opdSso",
    patKey: null,
    Icon: UserCog,
    cardType: "opdSso",
  },
  {
    label: "ชำระเงิน / พรบ.",
    bg: "#FEE2E2", // red-100
    accent: "#991B1B", // red-800
    visitKey: "opdCash",
    patKey: null,
    Icon: UserCheck,
    cardType: "opdCash",
  },
  {
    label: "แรงงานต่างด้าว",
    bg: "#F3E8FF", // purple-100
    accent: "#6B21A8", // purple-800
    visitKey: "opdForeign",
    patKey: null,
    Icon: Globe,
    cardType: "opdForeign",
  },
  {
    label: "Refer In",
    bg: "#E0F2FE", // cyan-100
    accent: "#164E63", // cyan-900
    visitKey: "referIn",
    patKey: null,
    Icon: PhoneIncoming,
    cardType: "referIn",
  },
  {
    label: "Refer Out",
    bg: "#FFF7ED", // orange-50
    accent: "#9A3412", // orange-800
    visitKey: "referOut",
    patKey: null,
    Icon: PhoneOutgoing,
    cardType: "referOut",
  },
  {
    label: "ผู้ป่วยฉุกเฉิน (ER)",
    bg: "#FFE4E6", // rose-100
    accent: "#9F1239", // rose-800
    visitKey: "erEmergency",
    patKey: null,
    Icon: Siren,
    cardType: "erEmergency",
  },
  {
    label: "อุบัติเหตุ",
    bg: "#FFEDD5", // orange-100
    accent: "#7C2D12", // orange-900
    visitKey: "erAccident",
    patKey: null,
    Icon: AlertTriangle,
    cardType: "erAccident",
  },
];

const PRESETS = ["วันนี้", "สัปดาห์นี้", "เดือนนี้"];

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toThaiDate(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${Number(y) + 543}`;
}

function getPresetRange(preset: string): { start: Date; end: Date } {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === "สัปดาห์นี้") {
    const day = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return { start: mon, end: today };
  }
  if (preset === "เดือนนี้") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: today,
    };
  }
  return { start: today, end: today };
}

function Shimmer() {
  return <div className="h-[168px] rounded-2xl bg-gray-200 animate-pulse" />;
}

// ── Modal state type ───────────────────────────────────────────────────────────
interface ModalState {
  open: boolean;
  cardLabel: string;
  cardType: string;
}

export default function OpdSection() {
  const [preset, setPreset] = useState("วันนี้");
  const [start, setStart] = useState<Date>(
    () => getPresetRange("วันนี้").start,
  );
  const [end, setEnd] = useState<Date>(() => getPresetRange("วันนี้").end);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [infoLabel, setInfoLabel] = useState("");

  // Modal state
  const [modal, setModal] = useState<ModalState>({
    open: false,
    cardLabel: "",
    cardType: "all",
  });

  const fetchData = useCallback(async (s: Date, e: Date) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?start=${fmt(s)}&end=${fmt(e)}`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setSummary(json.summary ?? null);
        const sLabel = toThaiDate(fmt(s));
        const eLabel = toThaiDate(fmt(e));
        setInfoLabel(sLabel === eLabel ? sLabel : `${sLabel} – ${eLabel}`);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(start, end);
  }, []); // eslint-disable-line

  const handlePreset = (p: string) => {
    setPreset(p);
    const { start: s, end: e } = getPresetRange(p);
    setStart(s);
    setEnd(e);
    fetchData(s, e);
  };

  const handleSearch = () => fetchData(start, end);

  const getDisplay = (card: (typeof OPD_CARDS)[0]) => {
    if (!summary) return "—";
    const visits = summary[card.visitKey];
    const patients = card.patKey ? summary[card.patKey] : null;
    if (visits == null) return "—";
    if (patients != null)
      return `${Number(patients).toLocaleString()} คน (${Number(visits).toLocaleString()} ครั้ง)`;
    return `${Number(visits).toLocaleString()} ราย`;
  };

  const openModal = (card: (typeof OPD_CARDS)[0]) => {
    setModal({ open: true, cardLabel: card.label, cardType: card.cardType });
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-lg font-bold text-[#717171] mb-3">
          ภาพรวมผู้รับบริการ OPD วันนี้
        </h4>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <div className="flex items-center gap-2 text-[#717171]">
            <CalendarDays size={16} />
            <div>
              <p className="text-sm">ข้อมูลตามช่วงเวลา (สำหรับ การ์ด)</p>
              <p className="text-xs text-gray-400">เลือกช่วงเวลาที่ต้องการ</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <select
              value={preset}
              onChange={(e) => handlePreset(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600 bg-white"
            >
              {PRESETS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <DatePicker
              selected={start}
              onChange={(d: Date | null) => {
                if (d) {
                  setStart(d);
                  setPreset("กำหนดเอง");
                }
              }}
              dateFormat="dd/MM/yyyy"
              locale={th}
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              customInput={<ThaiDateInput />}
            />
            <DatePicker
              selected={end}
              onChange={(d: Date | null) => {
                if (d) {
                  setEnd(d);
                  setPreset("กำหนดเอง");
                }
              }}
              dateFormat="dd/MM/yyyy"
              locale={th}
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              customInput={<ThaiDateInput />}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="border border-gray-300 rounded px-3 py-1.5 flex items-center gap-1.5 text-sm hover:bg-gray-50 text-gray-600 disabled:opacity-50"
            >
              {loading ? (
                <span className="w-3 h-3 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin inline-block" />
              ) : (
                <Search size={14} />
              )}
              ค้นหา
            </button>
          </div>
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-2 text-sm text-[#717171] mb-4">
          <Info size={14} />
          <span>
            แสดงข้อมูล การ์ด:{" "}
            <span className="font-bold">{infoLabel || "—"}</span>
          </span>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {loading
            ? Array.from({ length: 13 }).map((_, i) => <Shimmer key={i} />)
            : OPD_CARDS.map((card, i) => {
                const { Icon } = card;
                const displayVal = getDisplay(card);
                const hasData = summary && summary[card.visitKey] != null;

                return (
                  <div
                    key={i}
                    className="rounded-2xl p-5 flex flex-col items-center gap-3 relative transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                    style={{ backgroundColor: card.bg }}
                  >
                    {/* Icon circle — สีอ่อนกว่า accent 25% */}
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: card.accent + "22" }}
                    >
                      <Icon
                        size={22}
                        style={{ color: card.accent }}
                        strokeWidth={1.8}
                      />
                    </div>
                    <p
                      className="text-xs font-bold text-center leading-snug tracking-wide"
                      style={{ color: card.accent }}
                    >
                      {card.label}
                    </p>
                    <p
                      className="text-lg font-extrabold text-center tabular-nums"
                      style={{ color: card.accent }}
                    >
                      {displayVal}
                    </p>
                    <button
                      onClick={() => hasData && openModal(card)}
                      disabled={!hasData}
                      className="flex items-center gap-1 text-xs font-semibold px-4 py-1.5 rounded-full transition-all"
                      style={{
                        backgroundColor: card.accent + "18",
                        color: card.accent,
                        border: `1.5px solid ${card.accent}40`,
                        cursor: hasData ? "pointer" : "not-allowed",
                        opacity: hasData ? 1 : 0.4,
                      }}
                    >
                      รายละเอียด <ArrowRight size={11} />
                    </button>
                  </div>
                );
              })}
        </div>
      </div>

      {/* Patient Detail Modal */}
      <PatientDetailModal
        isOpen={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        cardLabel={modal.cardLabel}
        cardType={modal.cardType}
        start={fmt(start)}
        end={fmt(end)}
        infoLabel={infoLabel}
      />
    </>
  );
}
