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

const OPD_CARDS = [
  {
    label: "ผู้รับบริการทั้งหมด",
    bg: "#80E9FF",
    visitKey: "totalVisit",
    patKey: "totalPatient",
    Icon: User,
    cardType: "all",
  },
  {
    label: "OPD ในเวลา",
    bg: "#FF8080",
    visitKey: "opdOnTime",
    patKey: null,
    Icon: UserCheck,
    cardType: "opdOnTime",
  },
  {
    label: "OPD นอกเวลา",
    bg: "#7DE8B0",
    visitKey: "opdOffTime",
    patKey: null,
    Icon: UserCheck,
    cardType: "opdOffTime",
  },
  {
    label: "Admit",
    bg: "#9B9CF4",
    visitKey: "admitToday",
    patKey: null,
    Icon: BedDouble,
    cardType: "admitToday",
  },
  {
    label: "สิทธิ์บัตรทอง UC",
    bg: "#FF8080",
    visitKey: "opdUc",
    patKey: null,
    Icon: UserCheck,
    cardType: "opdUc",
  },
  {
    label: "สิทธิ์ราชการ",
    bg: "#FF8080",
    visitKey: "opdGov",
    patKey: null,
    Icon: Shield,
    cardType: "opdGov",
  },
  {
    label: "ประกันสังคม",
    bg: "#FF8080",
    visitKey: "opdSso",
    patKey: null,
    Icon: UserCog,
    cardType: "opdSso",
  },
  {
    label: "ชำระเงิน / พรบ.",
    bg: "#FF8080",
    visitKey: "opdCash",
    patKey: null,
    Icon: UserCheck,
    cardType: "opdCash",
  },
  {
    label: "แรงงานต่างด้าว",
    bg: "#FF8080",
    visitKey: "opdForeign",
    patKey: null,
    Icon: Globe,
    cardType: "opdForeign",
  },
  {
    label: "Refer In",
    bg: "#FF8080",
    visitKey: "referIn",
    patKey: null,
    Icon: PhoneIncoming,
    cardType: "referIn",
  },
  {
    label: "Refer Out",
    bg: "#FF8080",
    visitKey: "referOut",
    patKey: null,
    Icon: PhoneOutgoing,
    cardType: "referOut",
  },
  {
    label: "ผู้ป่วยฉุกเฉิน (ER)",
    bg: "#FF6B6B",
    visitKey: "erEmergency",
    patKey: null,
    Icon: Siren,
    cardType: "erEmergency",
  },
  {
    label: "อุบัติเหตุ",
    bg: "#FF8C42",
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
                    className="rounded-2xl p-4 flex flex-col items-center gap-3 text-white relative"
                    style={{ backgroundColor: card.bg }}
                  >
                    <p className="text-sm font-semibold text-center leading-snug">
                      {card.label}
                    </p>
                    <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center">
                      <Icon size={24} color="white" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-bold text-center">
                      {displayVal}
                    </p>
                    <button
                      onClick={() => hasData && openModal(card)}
                      disabled={!hasData}
                      className={`flex items-center gap-1.5 border border-white rounded-full px-4 py-1 text-xs transition-all
                      ${
                        hasData
                          ? "hover:bg-white/20 cursor-pointer"
                          : "opacity-40 cursor-not-allowed"
                      }`}
                    >
                      รายละเอียด <ArrowRight size={12} />
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
