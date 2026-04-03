"use client";

import { ArrowRight, User } from "lucide-react";

export default function Card() {
  return (
    <div className="grid grid-cols-4 gap-6 mt-4">
      <div className="bg-[#80E9FF] p-6 rounded-2xl text-white shadow-md hover:shadow-xl transition-all duration-300 w-[220px] flex flex-col items-center gap-4">
        <p>ผู้รับบริการทั้งหมด</p>

        <User size={40} fill="white" />

        <p>999 คน (1000 ครั้ง)</p>

        <button className="flex items-center gap-2 border border-white text-white px-4 py-1 rounded-full hover:bg-white hover:text-[#4FB3C8] transition cursor-pointer ">
          รายละเอียด
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
