import { CalendarDays, Search } from "lucide-react";

export default function FilterToolbar() {
  return (
    <div className="flex items-center gap-6">
      {/* ซ้าย */}
      <div className="flex items-center gap-3">
        <CalendarDays className="text-[#717171]" />
        <div>
          <p className="text-sm text-[#717171]">
            ข้อมูลตามช่วงเวลา (สำหรับ การ์ด)
          </p>
          <p className="text-xs text-gray-400">เลือกช่วงเวลาที่ต้องการ</p>
        </div>
      </div>

      {/* ขวา */}
      <div className="flex items-center gap-3 ml-auto">
        <select className="border rounded-md px-3 py-1.5 text-sm text-[#717171]">
          <option>วันนี้</option>
        </select>

        <input
          type="text"
          value="30/03/2569"
          readOnly
          className="border rounded-md px-3 py-1.5 text-sm w-[130px]"
        />

        <input
          type="text"
          value="30/03/2569"
          readOnly
          className="border rounded-md px-3 py-1.5 text-sm w-[130px]"
        />

        <button className="border rounded-md px-3 py-1.5 flex items-center gap-2 text-sm hover:bg-gray-50">
          <Search size={16} />
          ค้นหา
        </button>
      </div>
    </div>
  );
}
