"use client";

import { useEffect, useMemo, useState } from "react";
import {
    X,
    Search,
    Download,
    RefreshCw,
    Radar,
    ChevronDown,
    ChevronUp,
    Crosshair,
    MousePointerClick,
} from "lucide-react";

/**
 * วงรัศมีรอบบ้านผู้ป่วย (แบบเดียวกับโปรเจค pikad)
 * - ยังไม่เลือก → แสดงคำแนะนำให้คลิกหมุด/รายชื่อผู้ป่วย
 * - เลือกแล้ว → วาดวงรัศมี 50–500 ม. บนแผนที่ Leaflet เดิมของหน้า
 *   + จางหมุดผู้ป่วยที่อยู่นอกรัศมี ให้เห็นทันทีว่าใครอยู่ในวง
 * - รายชื่อผู้ป่วยรายอื่นในทะเบียนนี้ที่อยู่ในรัศมี (คำนวณฝั่ง client)
 *   นับแยกช่วงระยะ, กรองชื่อ, export Excel, ย้ายจุดศูนย์กลางไปคนถัดไปได้
 */

type LeafletNS = typeof import("leaflet");
type LMap = import("leaflet").Map;
type LMarker = import("leaflet").Marker;

export type NearbyCenter = {
    id: number;
    lat: number;
    lng: number;
    fullName: string;
};

export type NearbyPatient = {
    id: number;
    lat: number;
    lng: number;
    fullName: string;
    detail?: string; // บรรทัดรอง เช่น ตำบล / ผลการรักษา
    color?: string;
};

type Props = {
    L: LeafletNS | null;
    map: LMap | null;
    center: NearbyCenter | null;
    patients: NearbyPatient[];
    /** marker ของผู้ป่วยบนแผนที่ (ใช้จางหมุดนอกรัศมี + เปิด popup ตอนคลิกรายชื่อ) */
    patientMarkers?: Map<number, LMarker>;
    /** ย้ายจุดศูนย์กลางไปผู้ป่วยรายอื่น */
    onRecenter?: (id: number) => void;
    onClose: () => void;
};

const RADIUS_STEPS = [50, 100, 200, 300, 400, 500];
const DIM_OPACITY = 0.25;

// ใกล้ = สีร้อน, ไกล = สีเย็น — วงประ 50/100/200 ม. ใช้สีเดียวกับช่วงระยะ
const CENTER_HEX = "#c92a2a";
const MAIN_CIRCLE_HEX = "#00897b";
const BANDS: { key: number; max: number; hex: string; label: string }[] = [
    { key: 0, max: 50, hex: "#e8590c", label: "≤50 ม." },
    { key: 1, max: 100, hex: "#f59f00", label: "51–100" },
    { key: 2, max: 200, hex: "#4dabf7", label: "101–200" },
    { key: 3, max: Infinity, hex: "#1c7ed6", label: ">200" },
];
const bandOf = (d: number) => BANDS.find((b) => d <= b.max)!;

// ระยะทาง Haversine (เมตร)
function distanceMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

// ตำแหน่ง panel: มือถือเป็น bottom sheet, จอใหญ่ลอยมุมขวาบน
const SHELL =
    "absolute z-[500] left-3 right-3 bottom-3 sm:left-auto sm:bottom-auto sm:top-3 sm:right-3 sm:w-80 bg-white/95 backdrop-blur shadow-lg rounded-xl border border-gray-100";

export default function NearbyRadiusPanel({
    L,
    map,
    center,
    patients,
    patientMarkers,
    onRecenter,
    onClose,
}: Props) {
    const [radius, setRadius] = useState(100);
    const [q, setQ] = useState("");
    const [band, setBand] = useState<number | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // เปลี่ยนผู้ป่วยศูนย์กลาง → เคลียร์ตัวกรองรายชื่อ + กางรายการ
    const centerId = center?.id ?? null;
    useEffect(() => {
        setQ("");
        setBand(null);
        setActiveId(null);
        setCollapsed(false);
    }, [centerId]);

    // ─── ผู้ป่วยรายอื่นที่อยู่ในรัศมี (เรียงใกล้ → ไกล) ─────────────────────────
    const nearby = useMemo(() => {
        if (!center) return [];
        return patients
            .filter((p) => p.id !== center.id)
            .map((p) => ({
                ...p,
                distance: Math.round(
                    distanceMeters(center.lat, center.lng, p.lat, p.lng),
                ),
            }))
            .filter((p) => p.distance <= radius)
            .sort((a, b) => a.distance - b.distance);
    }, [patients, center, radius]);

    const bandCounts = useMemo(() => {
        const counts = BANDS.map(() => 0);
        for (const p of nearby) counts[bandOf(p.distance).key]++;
        return counts;
    }, [nearby]);

    const term = q.trim().toLowerCase();
    const shown = useMemo(
        () =>
            nearby.filter(
                (p) =>
                    (band === null || bandOf(p.distance).key === band) &&
                    (!term ||
                        `${p.fullName} ${p.detail ?? ""}`.toLowerCase().includes(term)),
            ),
        [nearby, band, term],
    );

    // ─── วาดวงรัศมี + จุดศูนย์กลาง (layer ของตัวเอง ลบทิ้งตอนปิด) ───────────
    useEffect(() => {
        if (!L || !map || !center) return;
        const layer = L.layerGroup().addTo(map);
        const c: [number, number] = [center.lat, center.lng];

        for (const b of BANDS) {
            if (b.max < radius)
                L.circle(c, {
                    radius: b.max,
                    color: b.hex,
                    weight: 1.5,
                    fill: false,
                    dashArray: "4 4",
                    opacity: 0.9,
                    interactive: false,
                }).addTo(layer);
        }
        const main = L.circle(c, {
            radius,
            color: MAIN_CIRCLE_HEX,
            fillColor: MAIN_CIRCLE_HEX,
            fillOpacity: 0.07,
            weight: 2.5,
            interactive: false,
        }).addTo(layer);

        // วงแดงล้อมหมุดผู้ป่วยที่เป็นศูนย์กลาง (คลิกทะลุไปหมุดเดิมได้)
        L.marker(c, {
            icon: L.divIcon({
                className: "nearby-center",
                html: `<span style="display:block;width:30px;height:30px;border-radius:50%;border:3px solid ${CENTER_HEX};box-shadow:0 0 0 4px rgba(201,42,42,.2)"></span>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
            }),
            interactive: false,
            zIndexOffset: 1000,
        }).addTo(layer);

        // เว้นที่ให้ panel ไม่บังวง (จอใหญ่ = ขวา, มือถือ = ล่าง)
        const wide = map.getSize().x >= 640;
        map.fitBounds(main.getBounds(), {
            paddingTopLeft: [30, 30],
            paddingBottomRight: wide ? [350, 30] : [30, 260],
            maxZoom: 18,
        });

        return () => {
            layer.remove();
        };
    }, [L, map, center, radius]);

    // ─── จางหมุดผู้ป่วยที่อยู่นอกรัศมี ─────────────────────────────────────────
    useEffect(() => {
        if (!center || !patientMarkers) return;
        const inside = new Set(nearby.map((p) => p.id));
        inside.add(center.id);
        // หน้าแม่สร้าง marker ใหม่ใน effect ของตัวเอง ซึ่งรันหลัง effect ลูก
        // → เลื่อนไป tick ถัดไปให้จางบน marker ชุดล่าสุด
        const t = setTimeout(() => {
            patientMarkers.forEach((m, id) =>
                m.setOpacity(inside.has(id) ? 1 : DIM_OPACITY),
            );
        }, 0);
        return () => {
            clearTimeout(t);
            patientMarkers.forEach((m) => m.setOpacity(1));
        };
    }, [center, nearby, patientMarkers]);

    // เปลี่ยนรัศมี → ล้างตัวกรองช่วงระยะ (ช่วงเดิมอาจหลุดนอกวงไปแล้ว)
    const pickRadius = (r: number) => {
        setRadius(r);
        setBand(null);
    };

    const focusPatient = (id: number) => {
        setActiveId(id);
        const m = patientMarkers?.get(id);
        if (!map || !m) return;
        map.panTo(m.getLatLng(), { animate: true });
        m.openPopup();
    };

    const exportExcel = async () => {
        if (!center) return;
        setExporting(true);
        setError(null);
        try {
            const XLSX = await import("xlsx");
            const rows = shown.map((p, i) => ({
                ลำดับ: i + 1,
                "ระยะ (เมตร)": p.distance,
                "ชื่อ-นามสกุล": p.fullName,
                รายละเอียด: p.detail ?? "",
                ละติจูด: p.lat,
                ลองจิจูด: p.lng,
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            ws["!cols"] = [
                { wch: 6 },
                { wch: 12 },
                { wch: 28 },
                { wch: 30 },
                { wch: 12 },
                { wch: 12 },
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "ผู้ป่วยใกล้เคียง");
            const safeName = (center.fullName || "ผู้ป่วย").replace(
                /[\\/:*?"<>|]/g,
                "_",
            );
            XLSX.writeFile(wb, `ผู้ป่วยใกล้เคียง_${safeName}_รัศมี${radius}ม.xlsx`);
        } catch {
            setError("Export ไม่สำเร็จ");
        } finally {
            setExporting(false);
        }
    };

    // ─── ยังไม่เลือกผู้ป่วย → คำแนะนำ ─────────────────────────────────────────
    if (!center) {
        return (
            <div className="absolute z-[500] top-3 right-3 max-w-[calc(100%-8rem)] bg-white/95 backdrop-blur shadow-md rounded-full pl-2.5 pr-3.5 py-1.5 flex items-center gap-2 text-[11px] text-gray-600 pointer-events-none">
                <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: MAIN_CIRCLE_HEX }}
                >
                    <Radar size={13} />
                </span>
                <span>
                    <MousePointerClick size={12} className="inline -mt-0.5 mr-0.5" />
                    คลิกผู้ป่วย เพื่อดูว่ามีใครอยู่ในรัศมี 50–500 ม.
                </span>
            </div>
        );
    }

    return (
        <div
            className={`${SHELL} flex flex-col overflow-hidden ${collapsed ? "" : "max-h-[55%] sm:max-h-[calc(100%-1.5rem)]"
                }`}
        >
            {/* หัว: ผู้ป่วยศูนย์กลาง + สรุปจำนวน */}
            <div className="px-3.5 pt-3 pb-2.5">
                <div className="flex items-start gap-2.5">
                    <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                        style={{ background: MAIN_CIRCLE_HEX }}
                    >
                        <Radar size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-gray-800 truncate leading-tight">
                            {center.fullName}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5 whitespace-nowrap">
                            <b className="text-[13px]" style={{ color: MAIN_CIRCLE_HEX }}>
                                {nearby.length}
                            </b>{" "}
                            รายในรัศมี {radius} ม.
                        </div>
                    </div>
                    <button
                        onClick={() => setCollapsed((v) => !v)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title={collapsed ? "แสดงรายชื่อ" : "ย่อ"}
                    >
                        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="ปิดวงรัศมี"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* เลือกรัศมี */}
                <div className="mt-3 grid grid-cols-6 gap-1 p-1 bg-gray-100 rounded-lg" title="รัศมี (เมตร)">
                    {RADIUS_STEPS.map((r) => (
                        <button
                            key={r}
                            onClick={() => pickRadius(r)}
                            className={`py-1 rounded-md text-[11px] tabular-nums transition-colors ${radius === r
                                ? "bg-white shadow-sm font-semibold text-[#00695c]"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            {r}
                            {radius === r && <span className="text-[9px] font-normal"> ม.</span>}
                        </button>
                    ))}
                </div>
            </div>

            {!collapsed && (
                <>
                    {/* จำนวนตามช่วงระยะ — คลิกเพื่อกรอง (ทำหน้าที่เป็น legend ด้วย) */}
                    <div className="px-3.5 pb-2.5 -mt-0.5 grid grid-cols-4 gap-1.5">
                        {BANDS.map((b) => {
                            const disabled = b.key > 0 && BANDS[b.key - 1].max >= radius;
                            const active = band === b.key;
                            return (
                                <button
                                    key={b.key}
                                    disabled={disabled}
                                    onClick={() => setBand(active ? null : b.key)}
                                    className={`rounded-lg border px-1.5 py-1 text-left transition-colors disabled:opacity-35 ${active
                                        ? "border-transparent text-white"
                                        : "border-gray-200 bg-white hover:border-gray-300"
                                        }`}
                                    style={active ? { background: b.hex } : undefined}
                                >
                                    <div className="flex items-center gap-1 text-[9px] opacity-90">
                                        <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ background: active ? "#fff" : b.hex }}
                                        />
                                        {b.label}
                                    </div>
                                    <div className="text-[14px] font-bold tabular-nums leading-tight">
                                        {bandCounts[b.key]}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* ค้นหา + export */}
                    <div className="flex items-center gap-2 px-3.5 py-2 border-y border-gray-100 bg-gray-50/60">
                        <div className="relative flex-1">
                            <Search
                                size={13}
                                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="กรองชื่อในรัศมี"
                                className="w-full pl-7 pr-6 py-1.5 text-[12px] rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-[#1ca887]"
                            />
                            {q && (
                                <button
                                    onClick={() => setQ("")}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={exportExcel}
                            disabled={exporting || shown.length === 0}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-[#1ca887] hover:text-[#0f6e56] disabled:opacity-40"
                            title="Export Excel"
                        >
                            {exporting ? (
                                <RefreshCw size={13} className="animate-spin" />
                            ) : (
                                <Download size={13} />
                            )}
                            Excel
                        </button>
                    </div>

                    {/* รายชื่อ (เรียงใกล้ → ไกล) */}
                    <div className="flex-1 overflow-y-auto min-h-[80px]">
                        {error && (
                            <div className="m-3 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                {error}
                            </div>
                        )}

                        {shown.map((p) => {
                            const b = bandOf(p.distance);
                            return (
                                <div
                                    key={p.id}
                                    className={`group flex items-stretch border-b border-gray-50 ${activeId === p.id ? "bg-[#e8f5ee]" : "hover:bg-gray-50"
                                        }`}
                                >
                                    <span className="w-1 flex-shrink-0" style={{ background: b.hex }} />
                                    <button
                                        onClick={() => focusPatient(p.id)}
                                        className="flex-1 min-w-0 text-left pl-2.5 pr-1 py-2 flex items-center gap-2.5"
                                    >
                                        <span className="w-12 flex-shrink-0 text-right">
                                            <span className="text-[13px] font-bold tabular-nums text-gray-800">
                                                {p.distance}
                                            </span>
                                            <span className="text-[10px] text-gray-400"> ม.</span>
                                        </span>
                                        <span className="min-w-0">
                                            <span className="text-[12px] font-medium text-gray-800 truncate flex items-center gap-1.5">
                                                {p.color && (
                                                    <span
                                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                                        style={{ background: p.color }}
                                                    />
                                                )}
                                                <span className="truncate">{p.fullName}</span>
                                            </span>
                                            {p.detail && (
                                                <span className="block text-[10px] text-gray-400 truncate">
                                                    {p.detail}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                    {onRecenter && (
                                        <button
                                            onClick={() => onRecenter(p.id)}
                                            className="px-2.5 text-gray-300 hover:text-[#00897b] sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                            title="ใช้คนนี้เป็นจุดศูนย์กลาง"
                                        >
                                            <Crosshair size={15} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {shown.length === 0 && (
                            <div className="px-5 py-6 text-center">
                                <div className="text-[12px] text-gray-500">
                                    {q
                                        ? `ไม่พบ "${q}"`
                                        : band !== null
                                            ? "ไม่มีผู้ป่วยในช่วงระยะนี้"
                                            : `ไม่มีผู้ป่วยรายอื่นในรัศมี ${radius} ม.`}
                                </div>
                                {!q && band === null && radius < 500 && (
                                    <button
                                        onClick={() =>
                                            pickRadius(
                                                RADIUS_STEPS[RADIUS_STEPS.indexOf(radius) + 1],
                                            )
                                        }
                                        className="mt-2 text-[11px] font-medium text-[#00897b] hover:underline"
                                    >
                                        ขยายรัศมีเป็น{" "}
                                        {RADIUS_STEPS[RADIUS_STEPS.indexOf(radius) + 1]} ม. →
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
