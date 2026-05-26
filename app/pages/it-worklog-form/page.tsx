"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList, CheckCircle2, XCircle,
  ChevronDown, Clock, Calendar, AlertTriangle,
  User, Wrench, Plus, History, X,
} from "lucide-react";

// ── ข้อมูล options ตรงกับ Google Form จริง ────────────────────────────────────

const MAIN_TASKS = [
  "ให้คำปรึกษาด้านไอที",
  "ระบบข้อมูล และรายงาน",
  "คอมพิวเตอร์และอุปกรณ์ต่อพ่วง",
  "ระบบ Network",
  "ระบบ HosXP",
  "ระบบ  GTWOffice",
  "ระบบอินทราเน็ต",
  "ระบบอื่นๆ",
  "ระบบ KPHIS",
  "ระบบเอกสาร",
  "แก้ไขปรับปรุง ระบบความเสี่ยง",
];

const SUB_TASKS: Record<string, string[]> = {
  "ระบบเอกสาร": [
    "บันทึกข้อความนำเสนอ ผอ.",
    "จัดทำโครงการซื้อคอมพิวเตอร์",
    "จัดทำเอกสารแผนโครงการ",
    "ตัวเลือก 4",
  ],
  "ระบบ KPHIS": [
    "ติดตั้งโปรแกรม",
    "ตั้งค่าโปรแกรม",
    "สำรองฐานข้อมูล",
    "กำหนดสิทธิการใช้",
  ],
  "ให้คำปรึกษาด้านไอที": [
    "ปรึกษาปัญหา เครื่องพิมพ์",
    "ปรึกษาปัญหา เครื่องคอมพิวเตอร์",
    "ปรึกษาปัญหา ระบบเครือข่าย",
    "ปรึกษาการใช้งานโปรแกรม QlikView",
    "ปรึกษาการใช้งาน HosXP",
    "ปรึกษาการใช้งานระบบ Intranet",
    "ปรึกษาการใช้งาน Google Sheets",
    "ปรึกษาการใช้งานโปรแกรมต่างๆ",
    "อื่นๆ",
  ],
  "ระบบอินทราเน็ต": [
    "แก้ไขตัวโปรแกรม",
    "เข้าใช้งานไม่ได้",
    "เพิ่มหน้าโปรแกรม",
    "เพิ่ม แก้ไข ระบบรายงาน โปรแกรม",
    "เขียนโปรแกรมใช้งานใหม่",
    "เพิ่มข้อมูลผู้ใช้งานระบบ",
    "แก้ปัญหาการใช้งานของผู้ใช้ระบบ",
    "เพิ่ม แก้ไข โปรแกรมระบบ Line notify",
    "แก้ไข BUG โปรแกรมบริหารจัดการรถยนต์ส่วนกลาง",
    "แก้ไข Config Server",
    "แก้ไขปัญหา Logfile Error",
  ],
  "ระบบอื่นๆ": [
    "ประชุม อบรม",
    "จัดห้องประชุม Conferrent",
    "จัดห้องประชุม",
    "ระบบคิว Hygge",
    "ระบบ PHR",
    "ระบบ Authen Code",
    "KPI",
    "ช่วยงานรพ.",
    "ช่วยงานฝ่ายอื่น",
    "ระบบบันทึกผู้ป่วย Covid-19 HI",
    "ทำงานเอกสารบันทึกข้อความ",
    "ช่วยงานช่างซ่อมบำรุง",
    "ระบบ EPIDEM MOPH IC",
    "ระบบ Pace แก้ไขปัญหา",
    "ระบบ Pace ติดตั้งเครื่อง x-ray เคลื่อนที่",
    "แก้ไขปัญหา อุปกรณ์ต่อพ่วงระบบคิว Hygge",
    "จัดตารางเวรนอกเวลา",
    "จัดทำเอกสารหนังสือจัดซื้อ บันทึกข้อความ เอกสารต่างๆ ของศูนย์คอมพิวเตอร์",
    "ติดตั้ง บำรุงรักษา กล้อง CCTV",
    "ติดตั้ง ตั้งค่า ระบบ Refer R9",
    "ออกบริการฉีดวัคซีน",
    "ทำงาน HAIT",
    "ติดตั้งโปรแกรมอื่นๆ",
    "แก้ไขปัญหาการใช้งาน Microsoft office",
    "พัก",
    "ว่าง",
    "งานวิ่ง รพ.",
    "กรรมการคุมสอบ จนท.ใหม่",
    "กิจกรรม 5 ส.",
    "ทำงาน HA",
    "ตรวจสอบเครื่อง BP Hosxp gateway",
    "ระบบ Telemedicine ห้องยา",
    "ติดตั้ง แก้ไข ระบบ IOT",
    "เป็นวิทยากรอบรมให้แก่เจ้าหน้าที่",
    "ระบบ Cyber Security",
    "หาข้อมูลระบบงาน Server",
    "หาข้อมูลระบบงาน Network",
    "เตรียมการสร้างห้อง Server",
    "ช่วยงาน สสอ. รพสต.",
    "แก้ปัญหาเครื่อง EDC",
    "Config ระบบ Cyber Security",
    "ระบบ firewall zycell",
    "เคลียร์ replicat log hosxp",
    "เคลียร์ไฟล์สำรองข้อมูล hosxp",
    "ส่ง 43 แฟ้ม สปสช.",
    "ส่ง 43 แฟ้ม เข้า HCD สสจ.บุรีรัมย์",
    "ปรับแก้ไขไฟล์ zip สำรอง hosxp",
    "ติดตั้งระบบ Telemat",
    "ทำงานเอกสารบันทึกข้อความ / คำสั่งเสนอ ผอ.",
    "ทำเอกสารโครงการจัดซื้อคอมพิวเตอร์เสนอ สสจ",
    "แก้ไขโปรแกรม office",
    "ระบบปิด visit",
    "ระบบเรียกและแสดงคิว รับบริการ",
    "ประกาศขึ้นเว็บ รพ.",
    "syn ข้อมูลเข้า datacenter สสจ.",
    "จัดเตรียมห้องประชุม+คอม ฝึกอบรม",
    "สอนการใช้งาน ระบบ backoffice",
    "แก้ปัญหาระบบ backoffice",
    "ยืนยันตัวตนระบบ ekyc+หมอพร้อม did",
    "ระบบ moph refer",
    "ดำเนินการเกี่ยวกับ provider id",
    "ปรับปรุงข้อมูลผู้ใช้โปรแกรมขอรถ",
    "ตั้งค่า ไฟวอล Zycel",
    "เพิ่ม User&Pass เข้าเน็ต รพ.",
    "แก้ไขข้อมูล User&Pass Zycel",
    "อัพไฟล์สำรอง hosxp ประจำวัน ขึ้นคลาว",
    "สำรองไฟล์สำรอง hosxp เข้า external HHD",
    "ปรับข้อมูล thairerfer",
    "จัดทำแผนโครงการประจำหน่วยงานเสนอ สสจ.",
    "อื่นๆ",
  ],
  "ระบบ HosXP": [
    "ไม่สามารถเชื่อมต่อฐานข้อมูลได้",
    "Server HosXP ล่ม ไม่สามารถใช้งานได้",
    "Syn data Server HosXP Master2",
    "ติดตั้งโปรแกรม HosXP",
    "เพิ่มผู้ใช้งานระบบ",
    "กำหนด หรือแก้ไขสิทธิการเข้าถึงระบบ",
    "เพิ่มหรือตั้งค่าข้อมูลพื้นฐานระบบ",
    "แก้ปัญหาการใช้งานของผู้ใช้",
    "สอนการใช้งานระบบ HosXP",
    "ตรวจสอบปัญหา แก้ไขปัญหาฐานข้อมูล",
    "เพิ่ม แก้ไข หมวด รายการ ค่ารักษาพยาบาล",
    "ระบบพิมพ์ Sticker Error",
    "บำรุงรักษาฐานข้อมูล check repair table",
    "อัพเดตเวอร์ชั่น",
    "เตรียมฐานข้อมูลเพื่อเชื่อมต่อ Gateway BMS",
    "ตรวจสอบเครื่อง Server Master 2",
    "ย้ายเครื่อง Server",
    "Config Server",
    "ติดตั้งระบบ i-Claim",
    "สำรองข้อมูลระบบ",
    "ปรับโครงสร้างฐานข้อมูล",
    "ตั้งค่า กำหนดค่า การทำงานของระบบ",
    "up structure version hosxp",
  ],
  "ระบบข้อมูล และรายงาน": [
    "ออกแบบและจัดทำรายงานใหม่",
    "แก้ไขรายงานและแบบฟอร์ม",
    "ตรวจสอบและสะท้อนข้อมูล",
    "ส่งข้อมูล ส่งออกไฟล์ข้อมูลเข้าระบบอื่น",
    "เขียนคำสั่ง SQL เพื่อดึงข้อมูล",
    "ดึงข้อมูลส่งให้สสจ.",
    "ส่งข้อมูล ส่งออกไฟล์ข้อมูลเข้าระบบ HDC",
    "ส่งข้อมูล ส่งออกไฟล์ข้อมูลเข้าระบบ OP/PP",
    "ส่งข้อมูล เข้าระบบ OPD สิทธิบัตรทอง",
  ],
  "คอมพิวเตอร์และอุปกรณ์ต่อพ่วง": [
    "ปริ้นเตอร์ไม่พร้อมใช้งาน",
    "เครื่องสำรองไฟไม่พร้อมใช้งาน",
    "เครื่องคอมพิวเตอร์ไม่พร้อมใช้งาน",
    "เม้าท์ไม่พร้อมใช้งาน",
    "แป้นพิมพ์ไม่พร้อมใช้งาน",
    "จอแสดงผล",
    "ติดตั้งเครื่องปริ้นเตอร์",
    "เปลี่ยน แก้ปัญหา หมึกเครื่องปริ้น",
    "แก้ไข เปลี่ยน HDD",
    "ติดตั้งระบบปฏิบัติการใหม่",
    "ติดตั้งเครื่องสำรองไฟ Server",
    "ติดตั้งเครื่องคอมพิวเตอร์",
    "แก้ปัญหาสายแลน",
  ],
  "ระบบ Network": [
    "Internet ใช้งานไม่ได้ ปัญหาเกิดจากผู้ให้บริการ",
    "Internet ใช้งานไม่ได้ ปัญหาเกิดจากผู้ใช้งาน",
    "เพิ่มจุด LAN",
    "ย้ายจุด LAN",
    "IP Address ชน หรือเปลี่ยน IP Address",
    "เพิ่มชื่อผู้ใช้งานระบบ Internet",
    "Fire Wall เสีย",
    "อัพเดต Firewall",
    "Switch เสีย",
    "เพิ่ม แก้ไข ระบบ VPN",
    "Fire wall แก้ไข เพิ่ม Policy",
    "Fire wall แก้ไข เพิ่ม Interface",
    "เพิ่ม แก้ไข โครงสร้างระบบ Network",
    "ติดตั้ง ขยายจุด ระบบ Wi-Fi",
    "Monitor Firewall ตรวจสอบ session ที่ผิดปกติ",
    "แก้ไขปัญหาการใช้งานระบบ Network",
    "ตั้งค่า Address Network",
  ],
  "ระบบ  GTWOffice": [
    "เข้าใช้งานโปรแกรมไม่ได้",
    "สอนการใช้งาน",
    "แก้ไขข้อมูลพื้นฐาน",
    "เพิ่มข้อมูลผู้ใช้งาน",
    "เพิ่มข้อมูลพื้นฐาน",
    "ติดตั้งและแก้ไขระบบสแกน",
  ],
  "ระบบ Hos Office": [
    "เข้าใช้งานโปรแกรมไม่ได้",
    "สอนการใช้งาน",
    "แก้ไขข้อมูลพื้นฐาน",
    "เพิ่มข้อมูลผู้ใช้งาน",
    "เพิ่มข้อมูลพื้นฐาน",
    "ติดตั้งและแก้ไขระบบสแกน",
  ],
};

const DEPARTMENTS = [
  "บริหารทั่วไป", "ศูนย์คอมพิวเตอร์", "งานพัสดุ", "งานสารบรรณ",
  "งานการเงินและบัญชี", "งานการเจ้าหน้าที่", "งานยานพาหนะ",
  "งานช่าง(งานซ่อมบำรุง)", "งานรักษาความปลอดภัย",
  "งานพัฒนาคุณภาพและมาตรฐาน", "งานประกันสุขภาพ", "งานซักฟอก",
  "งานจ่ายกลาง", "งานเปล", "สำนักงานการพยาบาล",
  "Lab", "X-rays", "Pharmacy ห้องจ่ายยา", "งานกายภาพบำบัด",
  "LR", "คลินิก ARI", "ฝ่ายโภชนาการ", "องค์กรแพทย์",
  "OPD", "ER", "ทันตกรรม", "แพทย์แผนไทย", "ศูนย์ HI",
  "Ward", "Cohort ward", "งานสร้างเสริมสุขภาพและป้องกันโรค",
  "งานสุขาภิบาลและป้องกันโรค", "งานให้บริการผู้ป่วยที่บ้าน",
  "งานสุขภาพจิต", "งานควบคุมและป้องกันโรคเอดส์และโรคติดต่อทางเพศสัมพันธ์",
  "ควบคุมและป้องกันวัณโรค", "งานเวชฯ", "ห้องเก็บเงิน", "ห้องบัตร",
  "ห้องประชุมชั้น2 ตึก OPD", "ห้องประชุมชั้น2 ตึก งานเวชฯ",
  "ห้องตรวจแพทย์", "งาน NCD",
  "รพ.สต.สำโรง", "รพ.สต.จันดุม", "รพ.สต.โคกเจริญ",
  "รพ.สต.โคกขมิ้น", "รพ.สต.ป่าชัน", "รพ.สต.ตาพระ",
  "สสอ.พลับพลาชัย", "รพ.พลับพลาชัย",
];

const URGENCY_OPTIONS = ["เร่งด่วน", "ไม่เร่งด่วน"];
const DEV_TYPES = ["งานพัฒนา", "งานประจำ งานบริการ"];

// SLA 0–4 ตามจริง
const SLA_OPTIONS = ["SLA 0", "SLA 1", "SLA 2", "SLA 3", "SLA 4"];

const TIMELINESS_OPTIONS = ["ท้นเวลา", "ไม่ทันเวลา"];

// ── Form state ─────────────────────────────────────────────────────────────────

interface FormState {
  mainTask: string;
  subTask: string;
  workDate: string;
  startTime: string;
  endTime: string;
  subTaskOther: string;
  urgency: string;
  devType: string;
  department: string;
  timeliness: string;
  incidentDate: string;
  incidentTime: string;
  incidentLocation: string;
  reporterName: string;
  symptom: string;
  cause: string;
  solution: string;
  fixStartDate: string;
  fixStartTime: string;
  fixEndDate: string;
  fixEndTime: string;
  sla: string;
}

function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const DEFAULT_FORM: FormState = {
  mainTask: "",
  subTask: "",
  subTaskOther: "",
  workDate: todayStr(),
  startTime: nowTime(),
  endTime: "",
  urgency: "ไม่เร่งด่วน",
  devType: "งานประจำ งานบริการ",
  department: "",
  timeliness: "ท้นเวลา",
  incidentDate: "",
  incidentTime: "",
  incidentLocation: "",
  reporterName: "",
  symptom: "",
  cause: "",
  solution: "",
  fixStartDate: "",
  fixStartTime: "",
  fixEndDate: "",
  fixEndTime: "",
  sla: "",
};

function calcMinutes(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff : 0;
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
      {children} {required && <span className="text-red-400">*</span>}
    </label>
  );
}

function Select({
  value, onChange, options, placeholder, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2.5 pr-9 text-sm text-gray-800 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

function Input({
  type = "text", value, onChange, placeholder, required,
}: {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200 transition-all"
    />
  );
}

function Textarea({
  value, onChange, placeholder, rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200 transition-all resize-none"
    />
  );
}

function SectionBox({
  title, icon: Icon, children, accent = "green",
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  accent?: "green" | "amber" | "blue";
}) {
  const headerClass = {
    green: "bg-green-50 border-green-200 text-green-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
  }[accent];
  const iconClass = {
    green: "text-green-700",
    amber: "text-amber-700",
    blue: "text-blue-700",
  }[accent];
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className={`flex items-center gap-2.5 px-5 py-3.5 border-b ${headerClass}`}>
        <Icon size={16} className={iconClass} />
        <h3 className={`text-sm font-bold ${iconClass}`}>{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

// ── History Modal ──────────────────────────────────────────────────────────────

function HistoryModal({ rows, onClose }: { rows: Record<string, string>[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <History size={18} className="text-green-700" />
            <h2 className="text-base font-bold text-gray-800">ประวัติการบันทึกงาน</h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
              {rows.length} รายการ
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all"
          >
            <X size={12} /> ปิด
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <ClipboardList size={40} className="mb-3 opacity-40" />
              <p className="text-sm">ยังไม่มีประวัติการบันทึก</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...rows].reverse().map((row, i) => (
                <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-4 hover:border-green-200 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">
                          {row["เลือกงานหลัก"] || "—"}
                        </span>
                        {row["ความเร่งด่วน"] === "เร่งด่วน" && (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">เร่งด่วน</span>
                        )}
                        <span className="text-xs text-gray-400">{row["ฝ่าย / กลุ่มงาน"]}</span>
                      </div>
                      <p className="text-sm text-gray-700 truncate">
                        {row["เลือกงาน HosXP"] || row["เลือกงาน Network"] ||
                          row["เลือกงาน คอมพิวเตอร์"] || row["เลือกงาน อื่นๆ"] ||
                          row["เลือกงาน ข้อมูลรายงาน"] || row["เลือกงานIntranet"] ||
                          row["เลือกงาน Hos Office"] || row["คำถาม"] || "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-gray-600">{row["วันที่ปฏิบัติงาน"]}</p>
                      <p className="text-xs text-gray-400">{row["เวลาเริ่ม"]} – {row["เวลาแล้วเสร็จ"]}</p>
                      {row["รวมระยะเวลา (นาที)"] && (
                        <p className="text-xs font-bold text-green-600 mt-0.5">{row["รวมระยะเวลา (นาที)"]} นาที</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────────

export default function ItWorklogFormPage() {
  const [userName, setUserName] = useState("");       // username (login)
  const [displayName, setDisplayName] = useState(""); // ชื่อจริงจาก DB
  const [isIT, setIsIT] = useState<boolean | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<Record<string, string>[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const role = data.user?.role;
        setIsIT(role === "IT");
        if (role === "IT") {
          setUserName(data.user?.username ?? "");
          setDisplayName(data.user?.name ?? data.user?.username ?? "");
        }
      })
      .catch(() => setIsIT(false));
  }, []);

  const set = (key: keyof FormState) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val, ...(key === "mainTask" ? { subTask: "", subTaskOther: "" } : key === "subTask" ? { subTaskOther: "" } : {}) }));

  const subOptions = SUB_TASKS[form.mainTask] ?? [];
  const duration = calcMinutes(form.startTime, form.endTime);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/it-worklog-form", { credentials: "include" });
      const data = await res.json();
      setHistory(data.rows ?? []);
      if (data.name) setDisplayName(data.name);
    } catch { }
    setLoadingHistory(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.mainTask || !form.workDate || !form.startTime) {
      setResult({ ok: false, message: "กรุณากรอก: งานหลัก, วันที่, เวลาเริ่ม" });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      // ส่ง fixBy = displayName อัตโนมัติ
      const payload = { ...form, fixBy: displayName };
      const res = await fetch("/api/it-worklog-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({ ok: true, message: "บันทึกสำเร็จ! ส่งข้อมูลไป Google Sheets แล้ว" });
        setForm({ ...DEFAULT_FORM, workDate: todayStr(), startTime: nowTime() });
        fetchHistory();
      } else {
        setResult({ ok: false, message: data.error ?? "บันทึกไม่สำเร็จ" });
      }
    } catch {
      setResult({ ok: false, message: "เชื่อมต่อ server ไม่ได้" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / Permission ──────────────────────────────────────────────────────

  if (isIT === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  if (!isIT) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertTriangle size={28} className="text-red-500" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-800">ไม่มีสิทธิ์เข้าถึง</p>
          <p className="text-sm text-gray-500 mt-1">หน้านี้สำหรับเจ้าหน้าที่ IT เท่านั้น</p>
        </div>
      </div>
    );
  }

  // ── Main Form ─────────────────────────────────────────────────────────────────

  return (
    <>
      <AnimatePresence>
        {showHistory && <HistoryModal rows={history} onClose={() => setShowHistory(false)} />}
      </AnimatePresence>

      <motion.div
        className="space-y-5 max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-700 flex items-center justify-center">
              <ClipboardList size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-800">บันทึกงานประจำวัน</h1>
              <p className="text-xs text-gray-400">บันทึกภาระงานเจ้าหน้าที่ศูนย์คอมพิวเตอร์</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* แสดงชื่อผู้ login */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
              <User size={12} className="text-green-700" />
              <span className="text-xs font-semibold text-green-700">
                {displayName || userName}
              </span>
            </div>
            <button
              onClick={() => { setShowHistory(true); fetchHistory(); }}
              disabled={loadingHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full hover:bg-gray-100 transition-colors"
            >
              {loadingHistory
                ? <motion.div className="w-3 h-3 border border-gray-400 border-t-gray-700 rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                : <History size={12} className="text-gray-500" />}
              <span className="text-xs font-semibold text-gray-600">ประวัติ</span>
            </button>
          </div>
        </div>

        {/* Result toast */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border text-sm font-semibold ${result.ok
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
                }`}
            >
              {result.ok
                ? <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                : <XCircle size={18} className="text-red-500 shrink-0" />}
              <span>{result.message}</span>
              <button onClick={() => setResult(null)} className="ml-auto opacity-60 hover:opacity-100">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Section 1: งานหลัก */}
          <SectionBox title="ข้อมูลงาน" icon={Wrench} accent="green">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label required>งานหลัก</Label>
                <Select
                  value={form.mainTask}
                  onChange={set("mainTask")}
                  options={MAIN_TASKS}
                  placeholder="— เลือกประเภทงาน —"
                />
              </div>

              {/* งานย่อย — แสดงเมื่อมี options */}
              {subOptions.length > 0 && (
                <div className="md:col-span-2">
                  <Label>งานย่อย</Label>
                  <Select
                    value={form.subTask}
                    onChange={set("subTask")}
                    options={subOptions}
                    placeholder="— เลือกงานย่อย —"
                  />
                </div>
              )}

              {/* ช่องอธิบายอื่นๆ — โชว์เมื่อ subTask === "อื่นๆ" */}
              <AnimatePresence>
                {form.subTask === "อื่นๆ" && (
                  <motion.div
                    className="md:col-span-2"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Label required>ระบุรายละเอียด (อื่นๆ)</Label>
                    <input
                      type="text"
                      value={form.subTaskOther}
                      onChange={(e) => set("subTaskOther")(e.target.value)}
                      placeholder="กรุณาระบุรายละเอียดงานที่ทำ..."
                      className="w-full bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200 transition-all"
                      autoFocus
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ความเร่งด่วน */}
              <div>
                <Label required>ความเร่งด่วน</Label>
                <div className="flex gap-2">
                  {URGENCY_OPTIONS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => set("urgency")(u)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${form.urgency === u
                          ? u === "เร่งด่วน"
                            ? "bg-red-500 text-white border-red-500"
                            : "bg-green-700 text-white border-green-700"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                        }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* ประเภทการพัฒนา */}
              <div>
                <Label required>ประเภทการพัฒนา</Label>
                <Select value={form.devType} onChange={set("devType")} options={DEV_TYPES} />
              </div>

              {/* ฝ่าย */}
              <div>
                <Label required>ฝ่าย / กลุ่มงาน</Label>
                <Select
                  value={form.department}
                  onChange={set("department")}
                  options={DEPARTMENTS}
                  placeholder="— เลือกฝ่าย —"
                />
              </div>

              {/* SLA 0–4 */}
              <div>
                <Label>SLA</Label>
                <Select
                  value={form.sla}
                  onChange={set("sla")}
                  options={SLA_OPTIONS}
                  placeholder="— เลือก SLA —"
                />
              </div>
            </div>
          </SectionBox>

          {/* Section 2: วันเวลา */}
          <SectionBox title="วันเวลาปฏิบัติงาน" icon={Calendar} accent="blue">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label required>วันที่ปฏิบัติงาน</Label>
                <Input type="date" value={form.workDate} onChange={set("workDate")} required />
              </div>
              <div>
                <Label required>เวลาเริ่ม</Label>
                <Input type="time" value={form.startTime} onChange={set("startTime")} required />
              </div>
              <div>
                <Label>เวลาแล้วเสร็จ</Label>
                <Input type="time" value={form.endTime} onChange={set("endTime")} />
              </div>
            </div>

            {/* แสดงระยะเวลา */}
            {duration > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl"
              >
                <Clock size={14} className="text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">
                  รวมระยะเวลา: {duration} นาที
                  {duration >= 60 && ` (${Math.floor(duration / 60)} ชม. ${duration % 60} นาที)`}
                </span>
              </motion.div>
            )}

            {/* ความทันเวลา */}
            <div>
              <Label>ความทันเวลา</Label>
              <div className="flex gap-2">
                {TIMELINESS_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("timeliness")(t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${form.timeliness === t
                        ? t === "ท้นเวลา"
                          ? "bg-green-700 text-white border-green-700"
                          : "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </SectionBox>

          {/* Section 3: รายละเอียดเหตุการณ์ */}
          <SectionBox title="รายละเอียดเหตุการณ์" icon={AlertTriangle} accent="amber">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>วันที่เกิดเหตุ</Label>
                <Input type="date" value={form.incidentDate} onChange={set("incidentDate")} />
              </div>
              <div>
                <Label>เวลาที่เกิดเหตุ</Label>
                <Input type="time" value={form.incidentTime} onChange={set("incidentTime")} />
              </div>
              <div>
                <Label>จุดที่เกิดเหตุ</Label>
                <Input value={form.incidentLocation} onChange={set("incidentLocation")} placeholder="ห้อง / จุดที่เกิดเหตุ" />
              </div>
              <div>
                <Label>ชื่อ-นามสกุลผู้แจ้ง</Label>
                <Input value={form.reporterName} onChange={set("reporterName")} placeholder="ชื่อผู้แจ้งปัญหา" />
              </div>
              <div className="md:col-span-2">
                <Label>อาการ / ปัญหา</Label>
                <Textarea value={form.symptom} onChange={set("symptom")} placeholder="อธิบายอาการหรือปัญหาที่พบ" />
              </div>
              <div className="md:col-span-2">
                <Label>สาเหตุ</Label>
                <Textarea value={form.cause} onChange={set("cause")} placeholder="สาเหตุของปัญหา" />
              </div>
              <div className="md:col-span-2">
                <Label>การแก้ไข</Label>
                <Textarea value={form.solution} onChange={set("solution")} placeholder="วิธีการแก้ไขปัญหา" />
              </div>
            </div>

            {/* ช่วงเวลาการแก้ไข */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">ช่วงเวลาการแก้ไข</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label>วันที่เริ่มแก้ไข</Label>
                  <Input type="date" value={form.fixStartDate} onChange={set("fixStartDate")} />
                </div>
                <div>
                  <Label>เวลาที่เริ่ม</Label>
                  <Input type="time" value={form.fixStartTime} onChange={set("fixStartTime")} />
                </div>
                <div>
                  <Label>วันที่แก้ไขเสร็จ</Label>
                  <Input type="date" value={form.fixEndDate} onChange={set("fixEndDate")} />
                </div>
                <div>
                  <Label>เวลาที่เสร็จ</Label>
                  <Input type="time" value={form.fixEndTime} onChange={set("fixEndTime")} />
                </div>
              </div>

              {/* ผู้แก้ไขปัญหา — auto จาก login */}
              <div className="mt-3">
                <Label>ผู้แก้ไขปัญหา</Label>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <User size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-700 font-medium">
                    {displayName || userName || "—"}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">ตั้งค่าอัตโนมัติจากบัญชีที่ Login</span>
                </div>
              </div>
            </div>
          </SectionBox>

          {/* Submit */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setForm({ ...DEFAULT_FORM, workDate: todayStr(), startTime: nowTime() })}
              className="px-5 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
            >
              ล้างข้อมูล
            </button>
            <motion.button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-8 py-2.5 bg-green-700 hover:bg-green-800 text-white text-sm font-bold rounded-xl shadow-md disabled:opacity-50 transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {submitting ? (
                <>
                  <motion.div
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                  />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  บันทึกงาน
                </>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </>
  );
}