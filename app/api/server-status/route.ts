import { NextResponse } from "next/server";
import { NodeSSH } from "node-ssh";
import si from "systeminformation";

export const dynamic = "force-dynamic";

const SSH_USER = process.env.MONITOR_SSH_USER || "root";
const SSH_PASSWORD = process.env.MONITOR_SSH_PASSWORD || "";

type ServerConfig = {
  name: string;
  host: string;
  type: "local" | "ssh";
  os: "linux" | "windows";
};

const SERVERS: ServerConfig[] = (process.env.MONITOR_SERVERS || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [name, host, type, os] = entry.split("|").map((v) => v.trim());
    return {
      name,
      host,
      type: type === "local" ? "local" : "ssh",
      os: os === "windows" ? "windows" : "linux",
    };
  });

interface DiskInfo {
  mount: string;
  total: number; // bytes
  used: number; // bytes
}

export interface ServerStats {
  name: string;
  online: boolean;
  error?: string;
  ram?: { total: number; used: number }; // bytes
  disks?: DiskInfo[];
  uptimeSec?: number;
}

// ---------- เครื่องที่โค้ดรันอยู่ (local) ----------
async function getLocalStats() {
  const mem = await si.mem();
  const fsList = await si.fsSize();
  const time = si.time();

  return {
    ram: { total: mem.total, used: mem.active },
    disks: fsList
      .filter((f) => f.size > 0)
      .map((f) => ({ mount: f.mount, total: f.size, used: f.used })),
    uptimeSec: Math.floor(Number(time.uptime) || 0),
  };
}

// ---------- เครื่อง Linux ผ่าน SSH ----------
async function getLinuxStats(ssh: NodeSSH) {
  const memRes = await ssh.execCommand(`free -b | awk 'NR==2 {print $2" "$3}'`);
  const [total, used] = memRes.stdout.trim().split(/\s+/).map(Number);

  const diskRes = await ssh.execCommand(
    `df -B1 -x tmpfs -x devtmpfs -x overlay -x squashfs --output=target,size,used | tail -n +2`,
  );
  const disks: DiskInfo[] = diskRes.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const p = line.trim().split(/\s+/);
      return { mount: p[0], total: Number(p[1]), used: Number(p[2]) };
    })
    .filter((d) => d.total > 0);

  const upRes = await ssh.execCommand(`awk '{print $1}' /proc/uptime`);
  const uptimeSec = Math.floor(Number(upRes.stdout.trim()) || 0);

  return { ram: { total, used }, disks, uptimeSec };
}

// ---------- เครื่อง Windows ผ่าน SSH (ต้องเปิด OpenSSH Server ที่เครื่องนั้นก่อน) ----------
async function getWindowsStats(ssh: NodeSSH) {
  // RAM: total used (bytes) — Win32_OperatingSystem รายงานเป็น KB เลยคูณ 1024
  const memRes = await ssh.execCommand(
    `powershell -NoProfile -Command "$os = Get-CimInstance Win32_OperatingSystem; [string]($os.TotalVisibleMemorySize * 1024) + ' ' + [string](($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) * 1024)"`,
  );
  const [total, used] = memRes.stdout.trim().split(/\s+/).map(Number);

  // Disk: DriveType=3 คือ harddisk ในเครื่อง (ไม่รวม CD/USB/network drive)
  const diskRes = await ssh.execCommand(
    `powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object { $_.DeviceID + ' ' + $_.Size + ' ' + ($_.Size - $_.FreeSpace) }"`,
  );
  const disks: DiskInfo[] = diskRes.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const p = line.trim().split(/\s+/);
      return { mount: p[0], total: Number(p[1]), used: Number(p[2]) };
    })
    .filter((d) => d.total > 0);

  const upRes = await ssh.execCommand(
    `powershell -NoProfile -Command "[int]((Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime).TotalSeconds"`,
  );
  const uptimeSec = Math.floor(Number(upRes.stdout.trim()) || 0);

  return { ram: { total, used }, disks, uptimeSec };
}

async function getSshStats(server: ServerConfig) {
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: server.host,
      username: SSH_USER,
      password: SSH_PASSWORD,
      readyTimeout: 5000,
    });
    return server.os === "windows"
      ? await getWindowsStats(ssh)
      : await getLinuxStats(ssh);
  } finally {
    ssh.dispose();
  }
}

export async function GET(req: Request) {
  // เช็ค role จาก session เดียวกับที่ sidebar ใช้ — ไม่ใช่ IT ตอบ 403
  const meRes = await fetch(new URL("/api/me", req.url), {
    headers: { cookie: req.headers.get("cookie") || "" },
    cache: "no-store",
  });
  const me = await meRes.json().catch(() => null);
  const role = me?.user?.role?.toUpperCase();

  if (role !== "IT") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const results = await Promise.allSettled(
    SERVERS.map((s) => (s.type === "local" ? getLocalStats() : getSshStats(s))),
  );

  const data: ServerStats[] = SERVERS.map((s, i) => {
    const r = results[i];
    if (r.status === "fulfilled") {
      return { name: s.name, online: true, ...r.value };
    }
    return {
      name: s.name,
      online: false,
      error: r.reason?.message || String(r.reason),
    };
  });

  return NextResponse.json({
    servers: data,
    fetchedAt: new Date().toISOString(),
  });
}
