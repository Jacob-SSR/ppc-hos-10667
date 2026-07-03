import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // จำเป็นสำหรับ deploy บน Docker — สร้าง .next/standalone/server.js
  output: "standalone",
};

export default nextConfig;
