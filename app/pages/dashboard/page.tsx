"use client";

import Card from "@/app/components/dashboard/Card";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Info,
  Search,
  User,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div>
      <div className="border bg-white rounded-lg p-4">
        <h1 className="text-xl font-bold text-[#717171]">
          Dashboard โรงพยาบาลพลับพลาชัย
        </h1>
      </div>

      {/* OPD */}
      <div className="border bg-white rounded-lg p-4 mt-4">
        <h4 className="text-lg font-bold text-[#717171]">
          ภาพรวมผู้รับบริการ OPD วันนี้
        </h4>
        <div className="pt-4">
          <div className="flex items-center gap-4 mb-4">
            <CalendarDays className="text-[#717171]" />
            <div>
              <p className="font-bold text-sm text-[#717171]">
                ข้อมูลตามช่วงเวลา (สำหรับ การ์ด)
              </p>
              <p className="text-sm text-gray-500">เลือกช่วงเวลาที่ต้องการ</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Info className="text-[#717171]" />
            <div className="text-sm text-[#717171]">
              <p>
                แสดงข้อมูล การ์ด:{" "}
                <span className="font-bold text-[#717171]">
                  วันนี้ (30 มี.ค. 2569)
                </span>
              </p>
            </div>
          </div>

          {/* ข้อมูลช่วงเวลา */}
          <div className="grid grid-cols-4 gap-6 mt-6 items-end">
            <div>
              <p className="text-[#717171] font-bold">ช่วงเวลา</p>
              <div className="border text-[#717171] rounded-lg p-2 w-32 ">
                <div className="flex justify-between items-center text-[#717171]">
                  <p>วันที่</p>
                  <ChevronDown />
                </div>
              </div>
            </div>
            <div>
              <p className="text-[#717171] font-bold">วันที่เริ่มต้น</p>
              <div className="border text-[#717171] rounded-lg p-2 w-32 ">
                <div className="flex items-center text-[#717171]">
                  <p>30/03/2569</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-[#717171] font-bold">วันที่สิ้นสุด</p>
              <div className="border text-[#717171] rounded-lg p-2 w-32 ">
                <div className="flex items-center text-[#717171]">
                  <p>30/03/2569</p>
                </div>
              </div>
            </div>

            <div className="border text-[#717171] rounded-lg p-2 w-32">
              <div className="flex justify-between items-center text-[#717171]">
                <Search />
                <p>ค้นหา</p>
              </div>
            </div>
          </div>
          <div className="border rounded-2xl mt-6"></div>

          {/* card OPD */}
          <Card />
        </div>
      </div>

      {/* IPD */}
      <div className="border bg-white rounded-lg p-4 mt-4">
        <h4 className="text-lg font-bold text-[#717171]">
          ภาพรวมผู้รับบริการ IPD วันนี้
        </h4>
        <div className="pt-4">
          <div className="flex items-center gap-4 mb-4">
            <CalendarDays className="text-[#717171]" />
            <div>
              <p className="font-bold text-sm text-[#717171]">
                ข้อมูลตามช่วงเวลา (สำหรับ การ์ด)
              </p>
              <p className="text-sm text-gray-500">เลือกช่วงเวลาที่ต้องการ</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Info className="text-[#717171]" />
            <div className="text-sm text-[#717171]">
              <p>
                แสดงข้อมูล การ์ด:{" "}
                <span className="font-bold text-[#717171]">
                  วันนี้ (30 มี.ค. 2569)
                </span>
              </p>
            </div>
          </div>

          {/* ข้อมูลช่วงเวลา */}
          <div className="grid grid-cols-4 gap-6 mt-6 items-end">
            <div>
              <p className="text-[#717171] font-bold">ช่วงเวลา</p>
              <div className="border text-[#717171] rounded-lg p-2 w-32 ">
                <div className="flex justify-between items-center text-[#717171]">
                  <p>วันที่</p>
                  <ChevronDown />
                </div>
              </div>
            </div>
            <div>
              <p className="text-[#717171] font-bold">วันที่เริ่มต้น</p>
              <div className="border text-[#717171] rounded-lg p-2 w-32 ">
                <div className="flex items-center text-[#717171]">
                  <p>30/03/2569</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-[#717171] font-bold">วันที่สิ้นสุด</p>
              <div className="border text-[#717171] rounded-lg p-2 w-32 ">
                <div className="flex items-center text-[#717171]">
                  <p>30/03/2569</p>
                </div>
              </div>
            </div>

            <div className="border text-[#717171] rounded-lg p-2 w-32">
              <div className="flex justify-between items-center text-[#717171]">
                <Search />
                <p>ค้นหา</p>
              </div>
            </div>
          </div>
          <div className="border rounded-2xl mt-6"></div>

          {/* card IPD */}
          <Card />
        </div>
      </div>
    </div>
  );
}
