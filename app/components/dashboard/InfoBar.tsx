import { Info } from "lucide-react";

export default function InfoBar() {
  return (
    <div className="flex items-center gap-4 mt-4">
      <Info className="text-[#717171]" />
      <p className="text-sm text-[#717171]">
        แสดงข้อมูล การ์ด:{" "}
        <span className="font-bold">
          วันนี้ (30 มี.ค. 2569)
        </span>
      </p>
    </div>
  );
}