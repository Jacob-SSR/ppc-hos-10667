import { db } from "@/lib/db";

export interface ShiftSlot {
    label: string;
    timeStart: string; // "HH:MM:SS"
    timeEnd: string;
    crossMidnight: boolean;
}

export interface ShiftGroup {
    shiftName: string;
    slots: ShiftSlot[];
}

// ── ช่วงเวลาตาม requirement ────────────────────────────────────────────────────
// เวรเช้า  08:30:00 – 16:30:59
// เวรบ่าย  16:31:00 – 00:30:59  (ข้ามเที่ยงคืน)
// เวรดึก   00:31:00 – 08:29:59

const SHIFTS: ShiftGroup[] = [
    {
        shiftName: "เวรเช้า",
        slots: [
            { label: "08:30–10:30", timeStart: "08:30:00", timeEnd: "10:30:59", crossMidnight: false },
            { label: "10:31–12:30", timeStart: "10:31:00", timeEnd: "12:30:59", crossMidnight: false },
            { label: "12:31–14:30", timeStart: "12:31:00", timeEnd: "14:30:59", crossMidnight: false },
            { label: "14:31–16:30", timeStart: "14:31:00", timeEnd: "16:30:59", crossMidnight: false },
        ],
    },
    {
        shiftName: "เวรบ่าย",
        slots: [
            { label: "16:31–18:30", timeStart: "16:31:00", timeEnd: "18:30:59", crossMidnight: false },
            { label: "18:31–20:30", timeStart: "18:31:00", timeEnd: "20:30:59", crossMidnight: false },
            { label: "20:31–22:30", timeStart: "20:31:00", timeEnd: "22:30:59", crossMidnight: false },
            { label: "22:31–00:30", timeStart: "22:31:00", timeEnd: "23:59:59", crossMidnight: true },
        ],
    },
    {
        shiftName: "เวรดึก",
        slots: [
            { label: "00:31–02:30", timeStart: "00:31:00", timeEnd: "02:30:59", crossMidnight: false },
            { label: "02:31–04:30", timeStart: "02:31:00", timeEnd: "04:30:59", crossMidnight: false },
            { label: "04:31–06:30", timeStart: "04:31:00", timeEnd: "06:30:59", crossMidnight: false },
            { label: "06:31–08:29", timeStart: "06:31:00", timeEnd: "08:29:59", crossMidnight: false },
        ],
    },
];

export interface SlotStat {
    shiftName: string;
    slotLabel: string;
    visits: number;   // นับ VN
    patients: number; // นับ HN unique
}

export interface ShiftSummary {
    shiftName: string;
    totalVisits: number;
    totalPatients: number;
}

export interface ShiftStatsResult {
    month: string; // "YYYY-MM"
    slots: SlotStat[];
    summary: ShiftSummary[];
}

// ── Helper: สร้าง SQL WHERE สำหรับ 1 slot ────────────────────────────────────
function buildTimeCondition(slot: ShiftSlot): string {
    if (slot.crossMidnight) {
        // เวรบ่าย slot สุดท้าย: 22:31 – 00:30 → 22:31–23:59:59 เท่านั้น (00:00–00:30 อยู่วันถัดไป)
        return `o.vsttime BETWEEN '${slot.timeStart}' AND '${slot.timeEnd}'`;
    }
    return `o.vsttime BETWEEN '${slot.timeStart}' AND '${slot.timeEnd}'`;
}

export async function getShiftStats(start: string, end: string): Promise<ShiftStatsResult> {
    const slots: SlotStat[] = [];

    for (const group of SHIFTS) {
        for (const slot of group.slots) {
            const sql = `
                SELECT
                    COUNT(o.vn)        AS visits,
                    COUNT(DISTINCT o.hn) AS patients
                FROM ovst o
                WHERE o.vstdate BETWEEN ? AND ?
                  AND ${buildTimeCondition(slot)}
            `;
            const [[row]]: any = await db.query(sql, [start, end]);

            slots.push({
                shiftName: group.shiftName,
                slotLabel: slot.label,
                visits: Number(row?.visits ?? 0),
                patients: Number(row?.patients ?? 0),
            });
        }
    }

    // Summary per shift
    const summary: ShiftSummary[] = SHIFTS.map((group) => {
        const groupSlots = slots.filter((s) => s.shiftName === group.shiftName);
        return {
            shiftName: group.shiftName,
            totalVisits: groupSlots.reduce((a, b) => a + b.visits, 0),
            totalPatients: groupSlots.reduce((a, b) => a + b.patients, 0),
        };
    });

    // Overall summary
    summary.push({
        shiftName: "รวมทั้งหมด",
        totalVisits: summary.reduce((a, b) => a + b.totalVisits, 0),
        totalPatients: summary.reduce((a, b) => a + b.totalPatients, 0),
    });

    const month = start.slice(0, 7);
    return { month, slots, summary };
}