"use client";

import { useEffect, useState, useRef } from "react";
import {
  CalendarDays, Search, Info, ArrowRight,
  User, UserCheck, BedDouble, Shield, UserCog, Globe,
  PhoneIncoming, PhoneOutgoing, Siren, AlertTriangle, Car,
} from "lucide-react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import PatientDetailModal from "./PatientDetailModal";

const OPD_CARDS = [
  {
    label: "ผู้รับบริการทั้งหมด",
    bg: "#E0F2FE", accent: "#0369A1",
    visitKey: "totalVisit", patKey: "totalPatient",
    maleKey: "totalMale", femaleKey: "totalFemale",
    Icon: User, cardType: "all",
  },
  {
    label: "OPD ในเวลา",
    bg: "#FCE7F3", accent: "#9D174D",
    visitKey: "opdOnTime", patKey: "opdOnTimePat",
    maleKey: "opdOnTimeMale", femaleKey: "opdOnTimeFemale",
    Icon: UserCheck, cardType: "opdOnTime",
  },
  {
    label: "OPD นอกเวลา",
    bg: "#D1FAE5", accent: "#065F46",
    visitKey: "opdOffTime", patKey: "opdOffTimePat",
    maleKey: "opdOffTimeMale", femaleKey: "opdOffTimeFemale",
    Icon: UserCheck, cardType: "opdOffTime",
  },
  {
    label: "Admit",
    bg: "#EDE9FE", accent: "#5B21B6",
    visitKey: "admitToday", patKey: "admitPat",
    maleKey: "admitMale", femaleKey: "admitFemale",
    Icon: BedDouble, cardType: "admitToday",
  },
  {
    label: "สิทธิ์บัตรทอง UC",
    bg: "#FEF9C3", accent: "#854D0E",
    visitKey: "opdUc", patKey: "opdUcPat",
    maleKey: "opdUcMale", femaleKey: "opdUcFemale",
    Icon: UserCheck, cardType: "opdUc",
  },
  {
    label: "สิทธิ์ราชการ",
    bg: "#DBEAFE", accent: "#1E40AF",
    visitKey: "opdGov", patKey: "opdGovPat",
    maleKey: "opdGovMale", femaleKey: "opdGovFemale",
    Icon: Shield, cardType: "opdGov",
  },
  {
    label: "ประกันสังคม",
    bg: "#CCFBF1", accent: "#134E4A",
    visitKey: "opdSso", patKey: "opdSsoPat",
    maleKey: "opdSsoMale", femaleKey: "opdSsoFemale",
    Icon: UserCog, cardType: "opdSso",
  },
  {
    label: "ชำระเงิน / พรบ.",
    bg: "#FEE2E2", accent: "#991B1B",
    visitKey: "opdCash", patKey: "opdCashPat",
    maleKey: "opdCashMale", femaleKey: "opdCashFemale",
    Icon: UserCheck, cardType: "opdCash",
  },
  {
    label: "แรงงานต่างด้าว",
    bg: "#F3E8FF", accent: "#6B21A8",
    visitKey: "opdForeign", patKey: "opdForeignPat",
    maleKey: "opdForeignMale", femaleKey: "opdForeignFemale",
    Icon: Globe, cardType: "opdForeign",
  },
  {
    label: "Refer In",
    bg: "#E0F2FE", accent: "#164E63",
    visitKey: "referIn", patKey: "referInPat",
    maleKey: "referInMale", femaleKey: "referInFemale",
    Icon: PhoneIncoming, cardType: "referIn",
  },
  {
    label: "Refer Out",
    bg: "#FFF7ED", accent: "#9A3412",
    visitKey: "referOut", patKey: "referOutPat",
    maleKey: "referOutMale", femaleKey: "referOutFemale",
    Icon: PhoneOutgoing, cardType: "referOut",
  },
  {
    label: "ผู้ป่วยฉุกเฉิน (ER)",
    bg: "#FFE4E6", accent: "#9F1239",
    visitKey: "erEmergency", patKey: "erEmergencyPat",
    maleKey: "erEmergencyMale", femaleKey: "erEmergencyFemale",
    Icon: Siren, cardType: "erEmergency",
  },
  {
    label: "อุบัติเหตุขนส่ง",
    bg: "#FEF9C3", accent: "#854D0E",
    visitKey: "erTransport", patKey: "erTransportPat",
    maleKey: "erTransportMale", femaleKey: "erTransportFemale",
    Icon: Car, cardType: "erTransport",
  },
  {
    label: "อุบัติเหตุอื่นๆ",
    bg: "#FEF3C7", accent: "#92400E",
    visitKey: "erOtherAccident", patKey: "erOtherAccidentPat",
    maleKey: "erOtherAccidentMale", femaleKey: "erOtherAccidentFemale",
    Icon: AlertTriangle, cardType: "erOtherAccident",
  },
];

const PRESETS = ["วันนี้", "สัปดาห์นี้", "เดือนนี้", "ปีนี้"];

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toThaiDate(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${Number(y) + 543}`;
}

function getPresetRange(preset: string): { start: Date; end: Date } {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "สัปดาห์นี้") {
    const day = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return { start: mon, end: today };
  }
  if (preset === "เดือนนี้") return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
  if (preset === "ปีนี้") return { start: new Date(today.getFullYear(), 0, 1), end: today };
  return { start: today, end: today };
}

function buildTitle(preset: string, start: Date, end: Date): string {
  const base = "ภาพรวมผู้รับบริการ OPD";
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (preset === "วันนี้" || (isSameDay(start, end) && isSameDay(start, today))) return `${base} วันนี้`;
  if (preset === "สัปดาห์นี้") return `${base} สัปดาห์นี้`;
  if (preset === "เดือนนี้") return `${base} เดือนนี้`;
  if (preset === "ปีนี้") return `${base} ปีนี้`;
  const s = toThaiDate(fmt(start));
  const e = toThaiDate(fmt(end));
  if (s === e) return `${base} วันที่ ${s}`;
  return `${base} ${s} – ${e}`;
}

function Shimmer() {
  return <div className="h-[210px] rounded-2xl bg-gray-200 animate-pulse" />;
}

interface ModalState {
  open: boolean;
  cardLabel: string;
  cardType: string;
}

export default function OpdSection() {
  const [preset, setPreset] = useState("วันนี้");
  const [start, setStart] = useState<Date>(() => getPresetRange("วันนี้").start);
  const [end, setEnd] = useState<Date>(() => getPresetRange("วันนี้").end);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [infoLabel, setInfoLabel] = useState("");
  const [titleLabel, setTitleLabel] = useState("ภาพรวมผู้รับบริการ OPD วันนี้");
  const [modal, setModal] = useState<ModalState>({ open: false, cardLabel: "", cardType: "all" });

  const fetchData = async (s: Date, e: Date, p: string = preset) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?start=${fmt(s)}&end=${fmt(e)}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setSummary(json.summary ?? null);
        const sLabel = toThaiDate(fmt(s));
        const eLabel = toThaiDate(fmt(e));
        setInfoLabel(sLabel === eLabel ? sLabel : `${sLabel} – ${eLabel}`);
        setTitleLabel(buildTitle(p, s, e));
      }
    } catch { }
    setLoading(false);
  };

  const initialStart = useRef(start);
  const initialEnd = useRef(end);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const s = initialStart.current;
        const e = initialEnd.current;
        const res = await fetch(`/api/dashboard?start=${fmt(s)}&end=${fmt(e)}`, { credentials: "include" });
        if (res.ok && !cancelled) {
          const json = await res.json();
          setSummary(json.summary ?? null);
          const sLabel = toThaiDate(fmt(s));
          const eLabel = toThaiDate(fmt(e));
          setInfoLabel(sLabel === eLabel ? sLabel : `${sLabel} – ${eLabel}`);
          setTitleLabel(buildTitle("วันนี้", s, e));
        }
      } catch { }
      if (!cancelled) setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  const handlePreset = (p: string) => {
    setPreset(p);
    const { start: s, end: e } = getPresetRange(p);
    setStart(s);
    setEnd(e);
    fetchData(s, e, p);
  };

  const handleSearch = () => fetchData(start, end, preset);

  const getDisplay = (card: (typeof OPD_CARDS)[0]) => {
    if (!summary) return { main: "—", male: null, female: null };
    const visits = summary[card.visitKey];
    const patients = card.patKey ? summary[card.patKey] : null;
    const male = card.maleKey ? summary[card.maleKey] ?? null : null;
    const female = card.femaleKey ? summary[card.femaleKey] ?? null : null;
    if (visits == null) return { main: "—", male: null, female: null };
    const main = patients != null
      ? `${Number(patients).toLocaleString()} คน (${Number(visits).toLocaleString()} ครั้ง)`
      : `${Number(visits).toLocaleString()} ราย`;
    return {
      main,
      male: male != null ? Number(male) : null,
      female: female != null ? Number(female) : null,
    };
  };

  const openModal = (card: (typeof OPD_CARDS)[0]) => {
    setModal({ open: true, cardLabel: card.label, cardType: card.cardType });
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-lg font-bold text-[#717171] mb-3">{titleLabel}</h4>

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
              {PRESETS.map((p) => <option key={p}>{p}</option>)}
            </select>
            <DatePicker
              selected={start}
              onChange={(d: Date | null) => { if (d) { setStart(d); setPreset("กำหนดเอง"); } }}
              dateFormat="dd/MM/yyyy" locale={th}
              showMonthDropdown showYearDropdown dropdownMode="select"
              customInput={<ThaiDateInput />}
            />
            <DatePicker
              selected={end}
              onChange={(d: Date | null) => { if (d) { setEnd(d); setPreset("กำหนดเอง"); } }}
              dateFormat="dd/MM/yyyy" locale={th}
              showMonthDropdown showYearDropdown dropdownMode="select"
              customInput={<ThaiDateInput />}
            />
            <button
              onClick={handleSearch} disabled={loading}
              className="border border-gray-300 rounded px-3 py-1.5 flex items-center gap-1.5 text-sm hover:bg-gray-50 text-gray-600 disabled:opacity-50"
            >
              {loading
                ? <span className="w-3 h-3 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin inline-block" />
                : <Search size={14} />}
              ค้นหา
            </button>
          </div>
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-2 text-sm text-[#717171] mb-4">
          <Info size={14} />
          <span>แสดงข้อมูล การ์ด: <span className="font-bold">{infoLabel || "—"}</span></span>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {loading
            ? Array.from({ length: 14 }).map((_, i) => <Shimmer key={i} />)
            : OPD_CARDS.map((card, i) => {
              const { Icon } = card;
              const { main } = getDisplay(card);
              const hasData = summary && summary[card.visitKey] != null;

              return (
                <div
                  key={i}
                  className="rounded-2xl p-5 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                  style={{ backgroundColor: card.bg }}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: card.accent + "22" }}
                  >
                    <Icon size={24} style={{ color: card.accent }} strokeWidth={1.8} />
                  </div>

                  <p className="text-sm font-bold text-center leading-snug text-black">
                    {card.label}
                  </p>

                  <p className="text-xl font-extrabold text-center tabular-nums text-black">
                    {main}
                  </p>

                  <button
                    onClick={() => hasData && openModal(card)}
                    disabled={!hasData}
                    className="flex items-center gap-1 text-sm font-semibold px-4 py-1.5 rounded-full transition-all text-black mt-1"
                    style={{
                      backgroundColor: card.accent + "18",
                      border: `1.5px solid ${card.accent}40`,
                      cursor: hasData ? "pointer" : "not-allowed",
                      opacity: hasData ? 1 : 0.4,
                    }}
                  >
                    รายละเอียด <ArrowRight size={12} />
                  </button>
                </div>
              );
            })}
        </div>
      </div>

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