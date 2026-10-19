// app/api/pikad-nearby/route.ts
// ค้นหาหลังคาเรือนในรัศมีรอบจุดศูนย์กลาง (เหมือน /api/nearby ของโปรเจค pikad)
// ใช้ร่วมกันทุกแท็บ "แผนที่บ้าน" ของ dashboard — เลือกผู้ป่วยแล้วดูว่ารอบบ้านมีใครบ้าง
import { NextResponse } from "next/server";
import {
  getSheetClient,
  getFirstSheetTitle,
  getValues,
  toStr,
  sheetsError,
} from "@/lib/sheets";
import { cachedQuery } from "@/lib/cache";

// พิกัดบ้านเปลี่ยนไม่บ่อย → cache รายการทั้งชีต 30 นาที แล้วคำนวณระยะต่อ request
const TTL_HOUSEHOLDS = 1800;
const MIN_RADIUS = 50;
const MAX_RADIUS = 500;

const PIKAD_SPREADSHEET_ID = process.env.PIKAD_SPREADSHEET_ID!;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PikadNeighbor {
  id: number; // ลำดับแถวในชีต
  fullName: string;
  cid: string;
  lat: number;
  lng: number;
  mapLink: string;
  distance: number; // เมตร (ปัดเศษ)
}

export interface PikadNearbyData {
  radius: number;
  total: number;
  neighbors: PikadNeighbor[];
}

type Household = Omit<PikadNeighbor, "distance">;

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function parseLatLng(s: string): { lat: number; lng: number } | null {
  if (!s) return null;
  const sep = s.includes("/") ? "/" : ",";
  const [a, b] = s.split(sep);
  const lat = parseFloat((a || "").trim());
  const lng = parseFloat((b || "").trim());
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  // กรอบประเทศไทย — กันพิกัดกรอกผิด
  if (lat < 5.4 || lat > 20.6 || lng < 97.2 || lng > 105.8) return null;
  return { lat, lng };
}

async function loadHouseholds(): Promise<Household[]> {
  const sheets = await getSheetClient();
  const first = await getFirstSheetTitle(sheets, PIKAD_SPREADSHEET_ID);
  // A=ละติจูด/ลองจิจูด  B=ชื่อ-นามสกุล  C=เลข13หลัก  D=วันเกิด  E=ลิ้งพิกัด
  const raw = await getValues(sheets, PIKAD_SPREADSHEET_ID, `${first}!A2:E`);

  const out: Household[] = [];
  raw.forEach((row, i) => {
    if (!row || row.length < 2) return;
    const c = parseLatLng(toStr(row[0]));
    if (!c) return;
    out.push({
      id: i + 2,
      fullName: toStr(row[1]),
      cid: toStr(row[2]),
      lat: c.lat,
      lng: c.lng,
      mapLink: toStr(row[4]),
    });
  });
  return out;
}

// ─── GET /api/pikad-nearby?lat=..&lng=..&radius=.. ───────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const radiusRaw = parseFloat(searchParams.get("radius") ?? "");

  if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radiusRaw)) {
    return NextResponse.json(
      { error: "ต้องระบุ lat, lng, radius" },
      { status: 400 },
    );
  }
  if (!PIKAD_SPREADSHEET_ID) {
    return NextResponse.json(
      { error: "ไม่ได้ตั้งค่า PIKAD_SPREADSHEET_ID ใน .env" },
      { status: 500 },
    );
  }
  const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, radiusRaw));

  try {
    const households = await cachedQuery(
      ["pikad-households"],
      loadHouseholds,
      TTL_HOUSEHOLDS,
    );

    const neighbors: PikadNeighbor[] = [];
    for (const h of households) {
      const d = distanceMeters(lat, lng, h.lat, h.lng);
      if (d <= radius) neighbors.push({ ...h, distance: Math.round(d) });
    }
    // เรียงใกล้ → ไกล
    neighbors.sort((a, b) => a.distance - b.distance);

    const body: PikadNearbyData = {
      radius,
      total: neighbors.length,
      neighbors,
    };
    return NextResponse.json(body);
  } catch (err) {
    return sheetsError(err, "PikadNearby");
  }
}
