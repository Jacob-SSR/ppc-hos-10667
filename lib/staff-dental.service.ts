import { db, db2 } from "@/lib/db";
import { withHeavySlot } from "@/lib/limiter";
import type { RowDataPacket } from "mysql2";
import { HR_STAFF_SQL, STAFF_DENTAL_DEPARTMENTS_SQL, hrRosterStaff, matchStaffPatients, resolveStaffPatients, staffDentalVisitQuery, staffPatientQuery, summarizeStaffDental, type StaffDentalReport, type HrStaff, type StaffPatientCandidate, type StaffDentalDepartment, type StaffDentalFilters } from "@/lib/staff-dental";

export async function getStaffDentalDepartments(): Promise<StaffDentalDepartment[]> {
  const [rows] = await db.query<(RowDataPacket & StaffDentalDepartment)[]>(STAFF_DENTAL_DEPARTMENTS_SQL);
  return rows.map(r=>({code:String(r.code),name:String(r.name || r.code)}));
}
export class StaffDentalDepartmentError extends Error {}
export class StaffDentalRosterError extends Error {}

export function getStaffDentalReport(input: StaffDentalFilters): Promise<StaffDentalReport> {
  return withHeavySlot(async () => {
    const departments = input.departmentCode ? await getStaffDentalDepartments() : [];
    const department = departments.find(d=>d.code===input.departmentCode);
    if(input.departmentCode && !department) throw new StaffDentalDepartmentError("ไม่พบแผนกรับบริการที่เลือก กรุณาโหลดรายชื่อแผนกใหม่");
    let personnel: (RowDataPacket & HrStaff)[];
    try { [personnel] = await db2.query<(RowDataPacket & HrStaff)[]>({sql:HR_STAFF_SQL,timeout:60000}); }
    catch(error) {
      if((error as {code?:string}).code==='ER_NO_SUCH_TABLE') throw new StaffDentalRosterError("ยังไม่ได้นำเข้าทะเบียนบุคลากร กรุณาให้ IT รัน SQL นำเข้าทะเบียนที่เตรียมให้ครั้งเดียว");
      throw error;
    }
    if(!personnel.length) throw new StaffDentalRosterError("ทะเบียนบุคลากรยังไม่มีรายชื่อ กรุณาให้ IT นำเข้าข้อมูลบุคลากรก่อน");
    const staff = hrRosterStaff(personnel);
    const query = staffPatientQuery(staff);
    const [patients] = staff.length ? await db.query<(RowDataPacket & StaffPatientCandidate)[]>({ sql: query.sql, timeout: 60000 }, query.params) : [[]];
    const rows = resolveStaffPatients(staff, matchStaffPatients(staff,patients));
    const hns = rows.flatMap(r => r.matchedHn ? [r.matchedHn] : []);
    if (hns.length) {
      const visits = staffDentalVisitQuery(hns, input.start, input.end,input.departmentCode);
      const [counts] = await db.query<(RowDataPacket & { hn: string; visits: number; first_visit: Date | string; last_visit: Date | string; service_departments:string | null })[]>({ sql: visits.sql, timeout: 60000 }, visits.params);
      const byHn = new Map(counts.map(r => [String(r.hn), r]));
      const date = (d: Date | string) => typeof d === "string" ? d.slice(0,10) : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      for (const row of rows) {
        const count = row.matchedHn ? byHn.get(row.matchedHn) : undefined;
        if (count) { row.visits = Number(count.visits); row.status = row.visits > 0 ? "done" : "not_done"; row.firstVisit = date(count.first_visit); row.lastVisit = date(count.last_visit); row.serviceDepartments=count.service_departments || "ไม่ระบุแผนกรับบริการ"; }
      }
    }
    // CID is used only for matching on the server; never include it in the report response.
    return { start: input.start, end: input.end, departmentCode:input.departmentCode || "",departmentName:department?.name || "ทุกแผนก", rows:rows.map(r=>({...r,cid:""})), groups: summarizeStaffDental(rows), updatedAt: new Date().toISOString() };
  });
}
