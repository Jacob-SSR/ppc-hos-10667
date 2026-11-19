import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { HrStaff } from "@/lib/staff-dental";

export class StaffDentalRosterError extends Error {}
const text = (value: unknown) => typeof value === "string" ? value.replace(/\s+/gu," ").trim() : "";

/** Accept only the personnel fields needed for this report. No database is involved. */
export function parseHrRosterFile(value: unknown): HrStaff[] {
  if(!value || typeof value !== "object") throw new StaffDentalRosterError("รูปแบบไฟล์ทะเบียนบุคลากรไม่ถูกต้อง");
  const source=value as Record<string,unknown>;
  if(source.version!==1 || !Array.isArray(source.people) || source.people.length>10000) throw new StaffDentalRosterError("รูปแบบไฟล์ทะเบียนบุคลากรไม่ถูกต้อง");
  const result:HrStaff[]=[], cids=new Set<string>(), ordinals=new Set<number>();
  source.people.forEach((item:unknown,index:number)=>{
    if(!item || typeof item!=="object") throw new StaffDentalRosterError(`ข้อมูลบุคลากรแถว ${index+1} ไม่ถูกต้อง`);
    const row=item as Record<string,unknown>;
    if(row.active===0 || row.active===false) return;
    const record:HrStaff={staff_ordinal:Number(row.staff_ordinal),prefix:text(row.prefix),first_name:text(row.first_name),last_name:text(row.last_name),cid:text(row.cid),position_name:text(row.position_name),unit_name:text(row.unit_name),department_name:text(row.department_name)};
    if(!Number.isSafeInteger(record.staff_ordinal) || record.staff_ordinal<1 || !/^\d{13}$/.test(record.cid) || /^(\d)\1{12}$/.test(record.cid)) throw new StaffDentalRosterError(`ลำดับหรือเลขบัตรแถว ${index+1} ไม่ถูกต้อง`);
    if(!record.first_name || !record.last_name || !record.position_name || !record.unit_name || !record.department_name) throw new StaffDentalRosterError(`ข้อมูลชื่อ/ตำแหน่ง/หน่วยงานแถว ${index+1} ไม่ครบ`);
    if(cids.has(record.cid) || ordinals.has(record.staff_ordinal)) throw new StaffDentalRosterError(`เลขบัตรหรือลำดับซ้ำที่แถว ${index+1}`);
    cids.add(record.cid);ordinals.add(record.staff_ordinal);result.push(record);
  });
  if(!result.length) throw new StaffDentalRosterError("ไฟล์ทะเบียนบุคลากรไม่มีรายชื่อที่ใช้งาน");
  return result.sort((a,b)=>a.staff_ordinal-b.staff_ordinal);
}

export async function readStaffDentalRoster(filePath=process.env.STAFF_DENTAL_ROSTER_FILE || path.join(process.cwd(),"private","staff-dental-roster.json")):Promise<HrStaff[]> {
  try {
    const info=await stat(filePath);
    if(!info.isFile() || info.size>5*1024*1024) throw new StaffDentalRosterError("ไฟล์ทะเบียนบุคลากรต้องเป็นไฟล์ JSON ขนาดไม่เกิน 5 MB");
    const content=await readFile(filePath,"utf8");
    return parseHrRosterFile(JSON.parse(content.replace(/^\uFEFF/,"")));
  } catch(error) {
    if(error instanceof StaffDentalRosterError) throw error;
    if((error as {code?:string}).code==='ENOENT') throw new StaffDentalRosterError("ไม่พบไฟล์ทะเบียนบุคลากร กรุณาวางไฟล์ staff-dental-roster.json ในโฟลเดอร์ private ของเซิร์ฟเวอร์");
    throw new StaffDentalRosterError("อ่านไฟล์ทะเบียนบุคลากรไม่สำเร็จ กรุณาตรวจรูปแบบไฟล์และสิทธิ์อ่าน");
  }
}
