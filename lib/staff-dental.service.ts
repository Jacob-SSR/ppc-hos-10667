import { db } from "@/lib/db";
import { withHeavySlot } from "@/lib/limiter";
import type { RowDataPacket } from "mysql2";
import { ACTIVE_DOCTOR_SQL, activeDoctorStaff, matchStaffPatients, resolveStaffPatients, staffDentalVisitQuery, staffPatientQuery, summarizeStaffDental, type StaffDentalReport, type ActiveDoctor, type StaffPatientCandidate } from "@/lib/staff-dental";

export function getStaffDentalReport(input: { start: string; end: string }): Promise<StaffDentalReport> {
  return withHeavySlot(async () => {
    const [doctors] = await db.query<(RowDataPacket & ActiveDoctor)[]>({sql:ACTIVE_DOCTOR_SQL,timeout:60000});
    const staff = activeDoctorStaff(doctors);
    const query = staffPatientQuery(staff);
    const [patients] = staff.length ? await db.query<(RowDataPacket & StaffPatientCandidate)[]>({ sql: query.sql, timeout: 60000 }, query.params) : [[]];
    const rows = resolveStaffPatients(staff, matchStaffPatients(staff,patients));
    doctors.forEach((d,i)=>{ if(!staff[i].first || !staff[i].last) rows[i].name = d.name || `รหัส ${d.code}`; });
    const hns = rows.flatMap(r => r.matchedHn ? [r.matchedHn] : []);
    if (hns.length) {
      const visits = staffDentalVisitQuery(hns, input.start, input.end);
      const [counts] = await db.query<(RowDataPacket & { hn: string; visits: number; first_visit: Date | string; last_visit: Date | string })[]>({ sql: visits.sql, timeout: 60000 }, visits.params);
      const byHn = new Map(counts.map(r => [String(r.hn), r]));
      const date = (d: Date | string) => typeof d === "string" ? d.slice(0,10) : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      for (const row of rows) {
        const count = row.matchedHn ? byHn.get(row.matchedHn) : undefined;
        if (count) { row.visits = Number(count.visits); row.status = row.visits > 0 ? "done" : "not_done"; row.firstVisit = date(count.first_visit); row.lastVisit = date(count.last_visit); }
      }
    }
    // CID is used only for matching on the server; never include it in the report response.
    return { start: input.start, end: input.end, rows:rows.map(r=>({...r,cid:""})), groups: summarizeStaffDental(rows), updatedAt: new Date().toISOString() };
  });
}
