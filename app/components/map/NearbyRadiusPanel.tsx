"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    X,
    Search,
    Download,
    RefreshCw,
    Radar,
    Home,
    Users,
} from "lucide-react";
import type { PikadNearbyData, PikadNeighbor } from "@/app/api/pikad-nearby/route";

/**
 * วงรัศมีรอบบ้านผู้ป่วย (แบบเดียวกับโปรเจค pikad)
 * - เลือกผู้ป่วยเป็นจุดศูนย์กลาง → วาดวงรัศมี 50–500 ม. บนแผนที่ Leaflet เดิมของหน้า
 * - แสดงว่าในรัศมีมีใครบ้าง แยก 2 กลุ่ม:
 *     1) หลังคาเรือนจากทะเบียนพิกัด (ดึงจาก /api/pikad-nearby)
 *     2) ผู้ป่วยในทะเบียนของ dashboard นี้ (คำนวณฝั่ง client จากจุดที่แสดงอยู่)
 * - หมุดหลังคาเรือนแยกสีตามระยะ + วงประซ้อนชั้น 50/100/200 ม.
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
    center: NearbyCenter;
    patients: NearbyPatient[];
    /** marker ของผู้ป่วยบนแผนที่ (ใช้เปิด popup ตอนคลิกรายชื่อ) */
    patientMarkers?: Map<number, LMarker>;
    onClose: () => void;
};

const RADIUS_STEPS = [50, 100, 200, 300, 400, 500];

// สีตามช่วงระยะ (ชุดเดียวกับ pikad)
const CENTER_HEX = "#e53935";
const MAIN_CIRCLE_HEX = "#00897b";
const RING_DEFS = [
    { r: 50, color: "#fb8c00" },
    { r: 100, color: "#ef6c00" },
    { r: 200, color: "#fdd835" },
];
const BANDS: { max: number; hex: string; label: string }[] = [
    { max: 50, hex: "#fb8c00", label: "≤ 50 ม." },
    { max: 100, hex: "#ef6c00", label: "50–100 ม." },
    { max: 200, hex: "#fdd835", label: "100–200 ม." },
    { max: Infinity, hex: "#1e88e5", label: "> 200 ม." },
];
const bandHex = (d: number) => BANDS.find((b) => d <= b.max)!.hex;

const PREFIXES = [
    "เด็กชาย",
    "เด็กหญิง",
    "นางสาว",
    "น.ส.",
    "ด.ช.",
    "ด.ญ.",
    "นาย",
    "นาง",
];
function nameKey(name: string): string {
    let n = String(name ?? "").trim().replace(/​/g, "");
    for (const p of PREFIXES) {
        if (n.startsWith(p)) {
            n = n.slice(p.length);
            break;
        }
    }
    return n.replace(/\s+/g, "");
}

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

const formatDistance = (m: number) =>
    m >= 1000 ? `${(m / 1000).toFixed(2)} กม.` : `${m} ม.`;

function esc(s: string): string {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function DistBadge({ d }: { d: number }) {
    return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 tabular-nums w-16 flex-shrink-0">
            <span
                className="w-2.5 h-2.5 rounded-full border border-white shadow"
                style={{ background: bandHex(d) }}
            />
            {formatDistance(d)}
        </span>
    );
}

export default function NearbyRadiusPanel({
    L,
    map,
    center,
    patients,
    patientMarkers,
    onClose,
}: Props) {
    const [radiusIndex, setRadiusIndex] = useState(1); // 100 ม.
    const radius = RADIUS_STEPS[radiusIndex];
    const [tab, setTab] = useState<"house" | "patient">("house");
    const [q, setQ] = useState("");
    const [households, setHouseholds] = useState<PikadNeighbor[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    const ringLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
    const houseLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
    const houseMarkerById = useRef<Map<number, LMarker>>(new Map());

    // ─── layer ของตัวเอง (ลบทิ้งตอนปิด panel) ─────────────────────────────────
    useEffect(() => {
        if (!L || !map) return;
        const rings = L.layerGroup().addTo(map);
        const houses = L.layerGroup().addTo(map);
        ringLayerRef.current = rings;
        houseLayerRef.current = houses;
        return () => {
            rings.remove();
            houses.remove();
            ringLayerRef.current = null;
            houseLayerRef.current = null;
        };
    }, [L, map]);

    // ─── วาดวงรัศมี + จุดศูนย์กลาง ────────────────────────────────────────────
    useEffect(() => {
        const layer = ringLayerRef.current;
        if (!L || !map || !layer) return;
        layer.clearLayers();
        const c: [number, number] = [center.lat, center.lng];

        for (const rd of RING_DEFS) {
            if (rd.r <= radius)
                L.circle(c, {
                    radius: rd.r,
                    color: rd.color,
                    weight: 1.5,
                    fill: false,
                    dashArray: "4 4",
                    opacity: 0.8,
                    interactive: false,
                }).addTo(layer);
        }
        const main = L.circle(c, {
            radius,
            color: MAIN_CIRCLE_HEX,
            fillColor: MAIN_CIRCLE_HEX,
            fillOpacity: 0.06,
            weight: 2.5,
            interactive: false,
        }).addTo(layer);

        // วงแดงล้อมหมุดผู้ป่วยที่เป็นศูนย์กลาง (คลิกทะลุไปหมุดเดิมได้)
        L.marker(c, {
            icon: L.divIcon({
                className: "nearby-center",
                html: `<span style="display:block;width:28px;height:28px;border-radius:50%;border:3px solid ${CENTER_HEX};box-shadow:0 0 0 3px rgba(229,57,53,.25)"></span>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
            }),
            interactive: false,
            zIndexOffset: 1000,
        }).addTo(layer);

        // เว้นขอบขวาให้ panel (กว้าง ~320px) ไม่บังวง — จอแคบใช้ padding ปกติ
        const panelGap = map.getSize().x > 700 ? 350 : 30;
        map.fitBounds(main.getBounds(), {
            paddingTopLeft: [30, 30],
            paddingBottomRight: [panelGap, 30],
            maxZoom: 18,
        });
    }, [L, map, center.lat, center.lng, radius]);

    // ─── ดึงหลังคาเรือนในรัศมี (debounce ตอนเลื่อน slider) ─────────────────────
    useEffect(() => {
        let cancelled = false;
        const t = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    lat: String(center.lat),
                    lng: String(center.lng),
                    radius: String(radius),
                });
                const res = await fetch(`/api/pikad-nearby?${params}`, {
                    credentials: "include",
                });
                const j = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
                if (cancelled) return;
                // ตัดตัวผู้ป่วยเองออก (บ้านเดียวกันแต่เป็นคนอื่นยังแสดงอยู่)
                const self = nameKey(center.fullName);
                setHouseholds(
                    (j as PikadNearbyData).neighbors.filter(
                        (n) => !self || nameKey(n.fullName) !== self,
                    ),
                );
            } catch (e) {
                if (!cancelled) {
                    setHouseholds([]);
                    setError((e as Error).message);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [center.lat, center.lng, center.fullName, radius]);

    // ─── หมุดหลังคาเรือน แยกสีตามระยะ ──────────────────────────────────────────
    useEffect(() => {
        const layer = houseLayerRef.current;
        if (!L || !layer) return;
        layer.clearLayers();
        houseMarkerById.current.clear();
        for (const n of households) {
            const hex = bandHex(n.distance);
            const m = L.marker([n.lat, n.lng], {
                icon: L.divIcon({
                    className: "nearby-house",
                    html: `<span style="display:block;width:13px;height:13px;border-radius:50%;background:${hex};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
                    iconSize: [13, 13],
                    iconAnchor: [6.5, 6.5],
                }),
            }).bindPopup(
                `<div style="font-family:'Prompt','Noto Sans Thai',sans-serif;font-size:12px;line-height:1.5">
          <div style="font-weight:600;font-size:13px">${esc(n.fullName || "-")}</div>
          ${n.cid ? `<div style="color:#666">CID ${esc(n.cid)}</div>` : ""}
          <div>📏 ห่างจาก ${esc(center.fullName)} <b>${formatDistance(n.distance)}</b></div>
          ${n.mapLink ? `<a href="${esc(n.mapLink)}" target="_blank" rel="noopener" style="color:#1ca887;font-weight:600;text-decoration:none">🗺️ เปิดใน Google Maps →</a>` : ""}
        </div>`,
                { maxWidth: 260 },
            );
            m.addTo(layer);
            houseMarkerById.current.set(n.id, m);
        }
    }, [L, households, center.fullName]);

    // ─── ผู้ป่วยในทะเบียนนี้ที่อยู่ในรัศมี (คำนวณฝั่ง client) ──────────────────
    const nearbyPatients = useMemo(() => {
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
    }, [patients, center.id, center.lat, center.lng, radius]);

    const term = q.trim().toLowerCase();
    const shownHouses = useMemo(
        () =>
            term
                ? households.filter(
                    (n) =>
                        n.fullName.toLowerCase().includes(term) ||
                        n.cid.includes(term),
                )
                : households,
        [households, term],
    );
    const shownPatients = useMemo(
        () =>
            term
                ? nearbyPatients.filter((p) =>
                    `${p.fullName} ${p.detail ?? ""}`.toLowerCase().includes(term),
                )
                : nearbyPatients,
        [nearbyPatients, term],
    );

    const openMarker = (m: LMarker | undefined) => {
        if (!map || !m) return;
        map.panTo(m.getLatLng(), { animate: true });
        m.openPopup();
    };

    const exportExcel = async () => {
        setExporting(true);
        try {
            const XLSX = await import("xlsx");
            const rows =
                tab === "house"
                    ? shownHouses.map((n, i) => ({
                        ลำดับ: i + 1,
                        "ระยะ (เมตร)": n.distance,
                        "ชื่อ-นามสกุล": n.fullName,
                        CID: n.cid,
                        ละติจูด: n.lat,
                        ลองจิจูด: n.lng,
                        ลิงก์แผนที่: n.mapLink,
                    }))
                    : shownPatients.map((p, i) => ({
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
                { wch: 22 },
                { wch: 12 },
                { wch: 12 },
                { wch: 40 },
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(
                wb,
                ws,
                tab === "house" ? "หลังคาเรือน" : "ผู้ป่วย",
            );
            const safeName = (center.fullName || "ผู้ป่วย").replace(
                /[\\/:*?"<>|]/g,
                "_",
            );
            XLSX.writeFile(
                wb,
                `${tab === "house" ? "เพื่อนบ้าน" : "ผู้ป่วยใกล้เคียง"}_${safeName}_รัศมี${radius}ม.xlsx`,
            );
        } catch {
            setError("Export ไม่สำเร็จ");
        } finally {
            setExporting(false);
        }
    };

    const listCount = tab === "house" ? shownHouses.length : shownPatients.length;

    return (
        <div className="absolute top-3 right-3 z-[500] w-80 max-w-[calc(100%-1.5rem)] max-h-[calc(100%-1.5rem)] bg-white/95 backdrop-blur shadow-lg rounded-xl flex flex-col overflow-hidden">
            {/* หัว: ผู้ป่วยศูนย์กลาง */}
            <div className="px-3 pt-3 pb-2 border-b">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                        <Radar size={16} className="mt-0.5 flex-shrink-0" style={{ color: MAIN_CIRCLE_HEX }} />
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold text-gray-500">
                                ใครอยู่รอบบ้านผู้ป่วย
                            </div>
                            <div className="text-[13px] font-semibold text-gray-800 truncate">
                                {center.fullName}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                        title="ปิดวงรัศมี"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* slider รัศมี 50–500 ม. */}
                <div className="flex items-center gap-2 mt-2.5">
                    <span className="text-[11px] text-gray-500">รัศมี</span>
                    <input
                        type="range"
                        min={0}
                        max={RADIUS_STEPS.length - 1}
                        value={radiusIndex}
                        onChange={(e) => setRadiusIndex(Number(e.target.value))}
                        className="flex-1 accent-[#00897b]"
                    />
                    <span
                        className="text-[12px] font-bold tabular-nums w-14 text-right"
                        style={{ color: MAIN_CIRCLE_HEX }}
                    >
                        {radius} ม.
                    </span>
                </div>
                <div className="flex justify-between text-[9px] text-gray-400 px-7 -mt-0.5">
                    {RADIUS_STEPS.map((r) => (
                        <span key={r}>{r}</span>
                    ))}
                </div>

                {/* legend สีตามระยะ */}
                <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-2">
                    <span className="flex items-center gap-1 text-[10px] text-gray-600">
                        <span
                            className="w-2.5 h-2.5 rounded-full border-2"
                            style={{ borderColor: CENTER_HEX }}
                        />
                        ผู้ป่วย
                    </span>
                    {BANDS.map((b) => (
                        <span
                            key={b.label}
                            className="flex items-center gap-1 text-[10px] text-gray-600"
                        >
                            <span
                                className="w-2.5 h-2.5 rounded-full border border-white shadow"
                                style={{ background: b.hex }}
                            />
                            {b.label}
                        </span>
                    ))}
                </div>
            </div>

            {/* แท็บ: หลังคาเรือน / ผู้ป่วยในทะเบียนนี้ */}
            <div className="flex border-b text-[12px]">
                {(
                    [
                        ["house", Home, "หลังคาเรือน", households.length],
                        ["patient", Users, "ผู้ป่วยในทะเบียน", nearbyPatients.length],
                    ] as const
                ).map(([key, Icon, label, count]) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 border-b-2 -mb-px transition-colors ${tab === key
                            ? "border-[#1ca887] text-[#0f6e56] font-semibold"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        <Icon size={13} />
                        {label}
                        <span className="text-[10px] bg-gray-100 rounded-full px-1.5 tabular-nums">
                            {key === "house" && loading ? "…" : count}
                        </span>
                    </button>
                ))}
            </div>

            {/* ค้นหา + export */}
            <div className="flex items-center gap-2 px-3 py-2 border-b">
                <div className="relative flex-1">
                    <Search
                        size={13}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={tab === "house" ? "กรองชื่อ / CID" : "กรองชื่อ"}
                        className="w-full pl-7 pr-6 py-1.5 text-[12px] rounded-lg border border-gray-200 focus:outline-none focus:border-[#1ca887]"
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
                    disabled={exporting || listCount === 0}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:border-[#1ca887] hover:text-[#0f6e56] disabled:opacity-40"
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

                {tab === "house" &&
                    (loading && households.length === 0 ? (
                        <div className="p-5 flex items-center justify-center gap-2 text-[12px] text-gray-500">
                            <RefreshCw size={14} className="animate-spin" />
                            กำลังค้นหาหลังคาเรือนใกล้เคียง…
                        </div>
                    ) : (
                        shownHouses.map((n) => (
                            <button
                                key={n.id}
                                onClick={() => openMarker(houseMarkerById.current.get(n.id))}
                                className="w-full text-left px-3 py-2 border-b border-gray-50 hover:bg-[#e8f5ee] flex items-center gap-2"
                            >
                                <DistBadge d={n.distance} />
                                <div className="min-w-0">
                                    <div className="text-[12px] font-medium text-gray-800 truncate">
                                        {n.fullName || "-"}
                                    </div>
                                    {n.cid && (
                                        <div className="text-[10px] text-gray-400">CID {n.cid}</div>
                                    )}
                                </div>
                            </button>
                        ))
                    ))}

                {tab === "patient" &&
                    shownPatients.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => openMarker(patientMarkers?.get(p.id))}
                            className="w-full text-left px-3 py-2 border-b border-gray-50 hover:bg-[#e8f5ee] flex items-center gap-2"
                        >
                            <DistBadge d={p.distance} />
                            <div className="min-w-0">
                                <div className="text-[12px] font-medium text-gray-800 truncate flex items-center gap-1.5">
                                    {p.color && (
                                        <span
                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ background: p.color }}
                                        />
                                    )}
                                    {p.fullName}
                                </div>
                                {p.detail && (
                                    <div className="text-[10px] text-gray-400 truncate">
                                        {p.detail}
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}

                {(tab === "patient" || (!loading && !error)) && listCount === 0 && (
                    <div className="p-5 text-center text-[12px] text-gray-400">
                        {q
                            ? `ไม่พบ "${q}" ในรัศมี ${radius} ม.`
                            : tab === "house"
                                ? `ไม่มีหลังคาเรือนอื่นในรัศมี ${radius} ม.`
                                : `ไม่มีผู้ป่วยรายอื่นในรัศมี ${radius} ม.`}
                    </div>
                )}
            </div>
        </div>
    );
}
