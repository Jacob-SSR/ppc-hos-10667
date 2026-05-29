// app/api/ip-homeward-sheets/route.ts
// อ่าน Google Sheet "IP & HomeWard Report PPCH 2569" แล้วสรุปข้อมูล IP + Home Ward
// ทำตามแพทเทิร์นเดียวกับ accident-sheets (lib/sheets helpers + sheetsError)
import { NextResponse } from "next/server";
import {
  getSheetClient,
  getAllSheetTitles,
  getValues,
  toStr,
  toNumOrNull,
  sheetsError,
} from "@/lib/sheets";
import type {
  FundKey,
  IpStatementRow,
  IpMonthRow,
  IpDoctorRow,
  IpFundRow,
  HomeWardSummary,
  IpHomeWardData,
} from "@/lib/ip-homeward.types";

// Sheet ID ของ "IP & HomeWard Report PPCH 2569"
const SPREADSHEET_ID =
  process.env.IP_HOMEWARD_SPREADSHEET_ID ??
  "1jWkNXFIeP_uZ7tTyJA3wosmZPYnknOtJS3QMuG2GJz8";

// แท็บรายเดือน เรียงตามเวลา (ต.ค.68 → พ.ค.69) — ปีงบ 2569
const MONTH_SHEETS: { sheet: string; label: string }[] = [
  { sheet: "1068", label: "ต.ค.68" },
  { sheet: "1168", label: "พ.ย.68" },
  { sheet: "1268", label: "ธ.ค.68" },
  { sheet: "0169", label: "ม.ค.69" },
  { sheet: "0269", label: "ก.พ.69" },
  { sheet: "0369", label: "มี.ค.69" },
  { sheet: "0469", label: "เม.ย.69" },
  { sheet: "0569", label: "พ.ค.69" },
];

const FUND_KEYS: FundKey[] = ["UC", "OFC/LGO", "SSS", "Other"];

// ─── helpers ──────────────────────────────────────────────────────────────────

/** จัดกลุ่มค่า "สิทธิ" ดิบ → 1 ใน 4 กองทุน */
function normFund(raw: unknown): FundKey {
  const s = toStr(raw);
  if (!s) return "Other";
  if (s.toUpperCase().startsWith("SSS")) return "SSS";
  if (
    ["OFC", "LGO", "BKK", "เบิกต้นสังกัด", "ข้าราชการ", "อปท"].some((k) =>
      s.includes(k),
    )
  )
    return "OFC/LGO";
  if (s === "UC" || s.toUpperCase() === "UC") return "UC";
  return "Other";
}

/** ยุบ whitespace ซ้ำในชื่อแพทย์ (เช่น "นพ.กิตติภัทร์  คันธะมาลย์") */
function normDoctor(raw: unknown): string {
  return toStr(raw).replace(/\s+/g, " ").trim();
}

/** หาแถว header (มีทั้ง "ลำดับ" และ "AN") + map ชื่อคอลัมน์ → index (0-based) */
function findHeader(rows: string[][]): {
  headerIdx: number;
  col: Record<string, number>;
} {
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const row = rows[r] ?? [];
    const hasNo = row.some((c) => toStr(c).includes("ลำดับ"));
    const hasAN = row.some((c) => toStr(c).trim() === "AN");
    if (hasNo && hasAN) {
      const col: Record<string, number> = {};
      row.forEach((c, i) => {
        const name = toStr(c);
        if (name && col[name] === undefined) col[name] = i;
      });
      return { headerIdx: r, col };
    }
  }
  return { headerIdx: -1, col: {} };
}

/** หา index คอลัมน์จาก keyword (คืน -1 ถ้าไม่เจอ) */
function colOf(col: Record<string, number>, ...keys: string[]): number {
  // exact match ก่อน
  for (const k of keys) if (col[k] !== undefined) return col[k];
  // partial match
  for (const k of keys)
    for (const [name, idx] of Object.entries(col))
      if (name.includes(k)) return idx;
  return -1;
}

/** index ของคอลัมน์ "adj.RW" (post) — ต้องไม่ใช่ "Pre adj.RW" */
function postRwCol(col: Record<string, number>): number {
  for (const [name, idx] of Object.entries(col)) {
    const n = name.trim();
    if (n === "adj.RW" || (n.includes("adj.RW") && !n.includes("Pre")))
      return idx;
  }
  return -1;
}

const num = (v: unknown) => toNumOrNull(v) ?? 0;

// ─── parse: ชีตรายเดือน ─────────────────────────────────────────────────────────
interface MonthParse {
  row: IpMonthRow;
  // ต่อแพทย์: name → {cases, rw, los, cost, funds}
  doctors: Map<
    string,
    {
      cases: number;
      rw: number;
      los: number;
      cost: number;
      funds: Record<FundKey, number>;
    }
  >;
  funds: Record<
    FundKey,
    { cases: number; rw: number; los: number; cost: number }
  >;
}

function parseMonthSheet(
  label: string,
  sheet: string,
  rows: string[][],
): MonthParse {
  const { headerIdx, col } = findHeader(rows);
  const doctors = new Map<
    string,
    {
      cases: number;
      rw: number;
      los: number;
      cost: number;
      funds: Record<FundKey, number>;
    }
  >();
  const funds: Record<
    FundKey,
    { cases: number; rw: number; los: number; cost: number }
  > = {
    UC: { cases: 0, rw: 0, los: 0, cost: 0 },
    "OFC/LGO": { cases: 0, rw: 0, los: 0, cost: 0 },
    SSS: { cases: 0, rw: 0, los: 0, cost: 0 },
    Other: { cases: 0, rw: 0, los: 0, cost: 0 },
  };

  const empty: IpMonthRow = {
    label,
    sheet,
    dc: 0,
    uc: 0,
    ofc: 0,
    sss: 0,
    other: 0,
    preRW: 0,
    postRW: 0,
    cmi: null,
    sendDays: 0,
  };
  if (headerIdx < 0) return { row: empty, doctors, funds };

  const cAN = colOf(col, "AN");
  const cRight = colOf(col, "สิทธิ");
  const cDoc = colOf(col, "แพทย์");
  const cPre = colOf(col, "Pre adj.RW");
  const cPost = postRwCol(col);
  const cLOS = colOf(col, "วันนอน");
  const cCost = colOf(col, "ค่ารักษา");
  const cDay = colOf(col, "ระยะส่งข้อมูล", "ระยะส่ง", "Total");

  let dc = 0,
    preRW = 0,
    postRW = 0,
    dayTotal = 0,
    dayN = 0;
  const rightCount: Record<FundKey, number> = {
    UC: 0,
    "OFC/LGO": 0,
    SSS: 0,
    Other: 0,
  };

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const an = cAN >= 0 ? toStr(row[cAN]) : "";
    // แถวข้อมูลจริงต้องขึ้นต้นด้วยตัวเลข (AN) — กันแถวสรุป/ว่าง
    if (!an || !/^\d/.test(an)) continue;
    dc++;

    const fund = normFund(cRight >= 0 ? row[cRight] : "");
    rightCount[fund]++;

    const pre = cPre >= 0 ? num(row[cPre]) : 0;
    const post = cPost >= 0 ? num(row[cPost]) : 0;
    const los = cLOS >= 0 ? num(row[cLOS]) : 0;
    const cost = cCost >= 0 ? num(row[cCost]) : 0;
    preRW += pre;
    postRW += post;

    funds[fund].cases++;
    funds[fund].rw += post;
    funds[fund].los += los;
    funds[fund].cost += cost;

    if (cDay >= 0) {
      const d = toNumOrNull(row[cDay]);
      if (d != null) {
        dayTotal += d;
        dayN++;
      }
    }

    if (cDoc >= 0) {
      const dn = normDoctor(row[cDoc]);
      if (dn && !/^\d/.test(dn)) {
        const d = doctors.get(dn) ?? {
          cases: 0,
          rw: 0,
          los: 0,
          cost: 0,
          funds: { UC: 0, "OFC/LGO": 0, SSS: 0, Other: 0 },
        };
        d.cases++;
        d.rw += post;
        d.los += los;
        d.cost += cost;
        d.funds[fund]++;
        doctors.set(dn, d);
      }
    }
  }

  return {
    row: {
      label,
      sheet,
      dc,
      uc: rightCount.UC,
      ofc: rightCount["OFC/LGO"],
      sss: rightCount.SSS,
      other: rightCount.Other,
      preRW: round2(preRW),
      postRW: round2(postRW),
      cmi: null,
      sendDays: dayN > 0 ? round2(dayTotal / dayN) : 0,
    },
    doctors,
    funds,
  };
}

// ─── parse: ชีต "สรุป" → statement ──────────────────────────────────────────────
function parseStatement(rows: string[][]): {
  rows: IpStatementRow[];
  total: IpStatementRow;
} {
  const out: IpStatementRow[] = [];
  let total: IpStatementRow | null = null;

  for (const row of rows) {
    const c0 = toStr(row[0]);
    if (!c0) continue;
    // แถวข้อมูล: คอลัมน์แรกเป็นชื่อเดือน (มี ".") และมีงวดเป็นตัวเลข
    const isMonth =
      /\.\d{2}$/.test(c0) ||
      /^(ต\.ค\.|พ\.ย\.|ธ\.ค\.|ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.)/.test(
        c0,
      );
    if (isMonth && out.findIndex((s) => s.label === c0) === -1) {
      const cases = num(row[2]);
      if (cases <= 0) continue;
      out.push({
        label: c0,
        period: toStr(row[1]).replace(/\.0$/, ""),
        cases,
        adjrw: round2(num(row[3])),
        cmi: toNumOrNull(row[4]),
        pay: round2(num(row[5])),
        deduct: round2(num(row[6])),
        net: round2(num(row[7])),
      });
    } else if (c0 === "รวม" && !total) {
      total = {
        label: "รวม",
        period: "",
        cases: num(row[2]),
        adjrw: round2(num(row[3])),
        cmi: toNumOrNull(row[4]),
        pay: round2(num(row[5])),
        deduct: round2(num(row[6])),
        net: round2(num(row[7])),
      };
    }
  }

  // เก็บเฉพาะ statement ก่อนแถว "รวม" (กันแถว ***คำนวนแบบเดิม / งวดซ้ำ)
  const computedTotal: IpStatementRow = total ?? {
    label: "รวม",
    period: "",
    cases: out.reduce((a, r) => a + r.cases, 0),
    adjrw: round2(out.reduce((a, r) => a + r.adjrw, 0)),
    cmi: null,
    pay: round2(out.reduce((a, r) => a + r.pay, 0)),
    deduct: round2(out.reduce((a, r) => a + r.deduct, 0)),
    net: round2(out.reduce((a, r) => a + r.net, 0)),
  };
  if (computedTotal.cmi == null && computedTotal.adjrw > 0)
    computedTotal.cmi = round4(computedTotal.adjrw / computedTotal.cases);
  // แถว "รวม" ในชีตมักเว้นช่องหักเงินเดือนว่าง → รวมจากรายเดือนแทน
  if (!computedTotal.deduct)
    computedTotal.deduct = round2(out.reduce((a, r) => a + r.deduct, 0));

  return { rows: out, total: computedTotal };
}

// ─── parse: ชีต "Admit Home Ward" ───────────────────────────────────────────────
function parseHomeWard(rows: string[][]): HomeWardSummary {
  // top-summary อยู่คอลัมน์ H (idx 7) / J (idx 9) บริเวณแถว 1-5 และ block สิทธิ คอลัมน์ Q (idx 16/17)
  const labelVal = (label: string): number => {
    for (let r = 0; r < Math.min(rows.length, 8); r++) {
      const row = rows[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        if (toStr(row[c]).includes(label)) {
          // ค่าตัวเลขถัดไปทางขวา
          for (let k = c + 1; k < row.length; k++) {
            const n = toNumOrNull(row[k]);
            if (n != null) return n;
          }
        }
      }
    }
    return 0;
  };

  // นับสิทธิจากแถวรายละเอียด (robust กว่า block สรุป)
  const { headerIdx, col } = findHeader(rows);
  const funds: Record<FundKey, number> = {
    UC: 0,
    "OFC/LGO": 0,
    SSS: 0,
    Other: 0,
  };
  let detailDc = 0,
    preDetail = 0,
    postDetail = 0;
  if (headerIdx >= 0) {
    const cAN = colOf(col, "AN");
    const cRight = colOf(col, "สิทธิ");
    const cPre = colOf(col, "Pre adj.RW");
    const cPost = postRwCol(col);
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const an = cAN >= 0 ? toStr(row[cAN]) : "";
      if (!an || !/^\d/.test(an)) continue;
      detailDc++;
      funds[normFund(cRight >= 0 ? row[cRight] : "")]++;
      if (cPre >= 0) preDetail += num(row[cPre]);
      if (cPost >= 0) postDetail += num(row[cPost]);
    }
  }

  // เริ่มโครงการ — หาแถว "เริ่ม ..." คอลัมน์ A
  let startDate = "";
  for (const row of rows.slice(0, 8)) {
    const c0 = toStr(row[0]);
    const m = c0.match(/เริ่ม\s*([\d/.\-]+)/);
    if (m) {
      startDate = m[1];
      break;
    }
  }

  const dc = labelVal("ยอด D/C ปัจจุบัน") || detailDc;
  return {
    dc,
    coded: labelVal("Coder ลงรหัส") || 0,
    sent: labelVal("ส่ง Claim แล้ว") || 0,
    notSent:
      labelVal("ยังไม่ส่ง") ||
      Math.max(0, dc - (labelVal("ส่ง Claim แล้ว") || 0)),
    preRW: round2(labelVal("Pre adj.RW") || preDetail),
    postRW: round2(labelVal("Post adj.RW") || postDetail),
    paid: round2(labelVal("ชดเชยแล้ว") || labelVal("ชดเชย") || 0),
    startDate,
    funds,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

// ─── GET ────────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  try {
    const sheets = await getSheetClient();
    const titles = await getAllSheetTitles(sheets, SPREADSHEET_ID);

    // 1) statement (ชีต "สรุป")
    const sumTitle = titles.find((t) => t.trim() === "สรุป") ?? "สรุป";
    const sumRaw = await getValues(sheets, SPREADSHEET_ID, `${sumTitle}!A:J`);
    const { rows: statement, total: statementTotal } = parseStatement(sumRaw);
    const cmiByLabel: Record<string, number | null> = {};
    statement.forEach((s) => (cmiByLabel[s.label] = s.cmi));

    // 2) รายเดือน — เฉพาะแท็บที่มีจริง
    const present = MONTH_SHEETS.filter((m) => titles.includes(m.sheet));
    const monthParses: MonthParse[] = [];
    for (const m of present) {
      const raw = await getValues(sheets, SPREADSHEET_ID, `${m.sheet}!A:T`);
      const p = parseMonthSheet(m.label, m.sheet, raw);
      p.row.cmi = cmiByLabel[m.label] ?? null;
      monthParses.push(p);
    }
    const monthly: IpMonthRow[] = monthParses.map((p) => p.row);
    const monthLabels = monthly.map((m) => m.label);

    // 3) aggregate รายแพทย์ (รวมทุกเดือน)
    const docAgg = new Map<string, IpDoctorRow>();
    monthParses.forEach((p, mi) => {
      p.doctors.forEach((d, name) => {
        let row = docAgg.get(name);
        if (!row) {
          row = {
            name,
            cases: 0,
            adjrw: 0,
            avgRw: 0,
            avgLos: 0,
            cost: 0,
            funds: { UC: 0, "OFC/LGO": 0, SSS: 0, Other: 0 },
            monthlyCases: new Array(monthParses.length).fill(0),
            monthlyRw: new Array(monthParses.length).fill(0),
          };
          docAgg.set(name, row);
        }
        row.cases += d.cases;
        row.adjrw += d.rw;
        row.avgLos += d.los; // sum ก่อน เฉลี่ยทีหลัง
        row.cost += d.cost;
        FUND_KEYS.forEach((k) => (row!.funds[k] += d.funds[k]));
        row.monthlyCases[mi] = d.cases;
        row.monthlyRw[mi] = round2(d.rw);
      });
    });
    const doctors: IpDoctorRow[] = Array.from(docAgg.values())
      .map((d) => ({
        ...d,
        adjrw: round2(d.adjrw),
        avgRw: d.cases > 0 ? round4(d.adjrw / d.cases) : 0,
        avgLos: d.cases > 0 ? round2(d.avgLos / d.cases) : 0,
        cost: Math.round(d.cost),
      }))
      .sort((a, b) => b.cases - a.cases);

    // 4) aggregate รายกองทุน
    const fundAgg: Record<FundKey, IpFundRow> = {} as Record<
      FundKey,
      IpFundRow
    >;
    FUND_KEYS.forEach((k) => {
      fundAgg[k] = {
        name: k,
        cases: 0,
        adjrw: 0,
        avgRw: 0,
        avgLos: 0,
        cost: 0,
        monthlyCases: new Array(monthParses.length).fill(0),
        monthlyRw: new Array(monthParses.length).fill(0),
      };
    });
    monthParses.forEach((p, mi) => {
      FUND_KEYS.forEach((k) => {
        const f = p.funds[k];
        fundAgg[k].cases += f.cases;
        fundAgg[k].adjrw += f.rw;
        fundAgg[k].avgLos += f.los;
        fundAgg[k].cost += f.cost;
        fundAgg[k].monthlyCases[mi] = f.cases;
        fundAgg[k].monthlyRw[mi] = round2(f.rw);
      });
    });
    const funds: IpFundRow[] = FUND_KEYS.map((k) => {
      const f = fundAgg[k];
      return {
        ...f,
        adjrw: round2(f.adjrw),
        avgRw: f.cases > 0 ? round4(f.adjrw / f.cases) : 0,
        avgLos: f.cases > 0 ? round2(f.avgLos / f.cases) : 0,
        cost: Math.round(f.cost),
      };
    });

    // 5) Home Ward
    const hwTitle = titles.find((t) => t.trim().startsWith("Admit Home Ward"));
    let homeward: HomeWardSummary = {
      dc: 0,
      coded: 0,
      sent: 0,
      notSent: 0,
      preRW: 0,
      postRW: 0,
      paid: 0,
      startDate: "",
      funds: { UC: 0, "OFC/LGO": 0, SSS: 0, Other: 0 },
    };
    if (hwTitle) {
      const hwRaw = await getValues(sheets, SPREADSHEET_ID, `${hwTitle}!A:T`);
      homeward = parseHomeWard(hwRaw);
    }

    // 6) KPI รวม
    const dcTotal = monthly.reduce((a, m) => a + m.dc, 0);
    const avgSend =
      monthly.length > 0
        ? round2(
            monthly.reduce((a, m) => a + m.sendDays, 0) /
              monthly.filter((m) => m.sendDays > 0).length || 0,
          )
        : 0;
    const data: IpHomeWardData = {
      updatedAt: new Date().toISOString(),
      fiscalYear: "2569",
      months: monthLabels,
      monthly,
      statement,
      statementTotal,
      doctors,
      funds,
      homeward,
      kpi: {
        dcTotal,
        ucPassA: statementTotal.cases,
        adjrwTotal: statementTotal.adjrw,
        cmiAvg: statementTotal.cmi ?? 0,
        payTotal: statementTotal.pay,
        netTotal: statementTotal.net,
        doctorCount: doctors.length,
        avgSendDays: avgSend,
      },
    };

    if (debug) {
      return NextResponse.json({
        titles,
        monthSheetsPresent: present.map((m) => m.sheet),
        statementCount: statement.length,
        doctorCount: doctors.length,
        sample: monthly[0],
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    return sheetsError(err, "IpHomeWardSheets");
  }
}
