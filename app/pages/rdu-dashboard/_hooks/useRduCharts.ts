import { useEffect, useRef } from "react";
import {
  Chart,
  registerables,
  type TooltipItem,
  type ChartDataset,
  type LineControllerDatasetOptions,
  type ScatterDataPoint,
} from "chart.js";
import { TARGETS } from "@/lib/rdu.constants";
import { getDeptColor } from "../_utils/deptColor";
import type { RduDashboardData } from "@/lib/rdu.types";

Chart.register(...registerables);

// ── type สำหรับ bubble data point ที่มี name ──────────────────────────────────
type BubblePoint = { x: number; y: number; r: number; name: string };

// ── type สำหรับ trend dataset (line มีทั้ง borderDash และ fill) ──────────────
type TrendDataset = Partial<LineControllerDatasetOptions> & {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor?: string;
  tension?: number;
  borderWidth?: number;
  pointRadius?: number;
  fill?: boolean;
  borderDash?: number[];
};

export function useRduCharts(
  data: RduDashboardData | null,
  disTab: string,
  trendView: string,
) {
  const trendRef = useRef<HTMLCanvasElement>(null);
  const gaugeRef = useRef<HTMLCanvasElement>(null);
  const pieRef = useRef<HTMLCanvasElement>(null);
  const atbRef = useRef<HTMLCanvasElement>(null);
  const topAtbRef = useRef<HTMLCanvasElement>(null);
  const bubbleRef = useRef<HTMLCanvasElement>(null);
  const chartMap = useRef<Record<string, Chart | null>>({
    trend: null,
    gauge: null,
    pie: null,
    atb: null,
    topAtb: null,
    bubble: null,
  });

  function destroy(key: string) {
    chartMap.current[key]?.destroy();
    chartMap.current[key] = null;
  }

  // Trend
  useEffect(() => {
    if (!trendRef.current || !data?.trend.length) return;
    destroy("trend");
    const labels = data.trend.map((r) => r.label);
    const COLORS: Record<string, string> = {
      uri: "#1e6fd9",
      dia: "#0aa7a0",
      wound: "#d97706",
      peri: "#7c3aed",
    };
    const keys =
      trendView === "all"
        ? (["uri", "dia", "wound", "peri"] as const)
        : [trendView as "uri" | "dia" | "wound" | "peri"];

    const datasets: TrendDataset[] = [];
    keys.forEach((k) => {
      const c = COLORS[k],
        t = TARGETS[k];
      const pcts = data.trend.map((r) => {
        const tot = r[`${k}_total` as keyof typeof r] as number;
        const rx = r[`${k}_rx` as keyof typeof r] as number;
        return tot > 0 ? Math.round((rx / tot) * 1000) / 10 : 0;
      });
      datasets.push({
        label: `${k.toUpperCase()} % Rx`,
        data: pcts,
        borderColor: c,
        backgroundColor: c + "22",
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: 3,
        fill: false,
      });
      datasets.push({
        label: `เป้า ≤${t}%`,
        data: Array(labels.length).fill(t) as number[],
        borderColor: c,
        borderDash: [5, 5],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
      });
    });

    chartMap.current.trend = new Chart(trendRef.current, {
      type: "line",
      data: { labels, datasets: datasets as ChartDataset<"line", number[]>[] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: {
            min: 0,
            max: 100,
            title: { display: true, text: "% ATB Rx" },
            grid: { color: "#eef3f9" },
          },
        },
        plugins: { legend: { position: "bottom" } },
      },
    });
  }, [data, trendView]);

  // Gauge
  useEffect(() => {
    if (!gaugeRef.current || !data?.diseases.length) return;
    destroy("gauge");
    const dis = data.diseases;
    chartMap.current.gauge = new Chart(gaugeRef.current, {
      type: "bar",
      data: {
        labels: dis.map((d) => d.name.split("/")[0].trim()),
        datasets: [
          {
            label: "% Rx จริง",
            data: dis.map((d) => d.current),
            backgroundColor: dis.map((d) =>
              d.current <= d.target
                ? "#16a34a"
                : d.current <= d.target * 1.2
                  ? "#d97706"
                  : "#dc2626",
            ),
            borderRadius: 6,
            barPercentage: 0.6,
          },
          {
            label: "เป้าหมาย",
            data: dis.map((d) => d.target),
            backgroundColor: "rgba(124,147,173,.22)",
            borderRadius: 6,
            barPercentage: 0.6,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { max: 100, title: { display: true, text: "%" } },
          y: { grid: { display: false } },
        },
        plugins: { legend: { position: "bottom" } },
      },
    });
  }, [data]);

  // Bubble
  useEffect(() => {
    if (!bubbleRef.current || !data?.doctors.length) return;
    destroy("bubble");
    const deptMap = new Map<string, typeof data.doctors>();
    data.doctors.forEach((dr) => {
      const g = deptMap.get(dr.dept) ?? [];
      g.push(dr);
      deptMap.set(dr.dept, g);
    });
    const datasets: ChartDataset<"bubble", BubblePoint[]>[] = Array.from(
      deptMap.entries(),
    ).map(([dept, drs]) => ({
      label: dept || "ไม่ระบุ",
      data: drs.map((dr) => ({
        x: dr.visits,
        y: Math.max(dr.uri_pct, dr.dia_pct, dr.wound_pct, dr.peri_pct),
        r: Math.max(8, Math.sqrt(dr.visits) * 1.2),
        name: dr.doctor_name,
      })),
      backgroundColor: getDeptColor(dept) + "b0",
    }));

    chartMap.current.bubble = new Chart<"bubble", BubblePoint[]>(
      bubbleRef.current,
      {
        type: "bubble",
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: { display: true, text: "จำนวน Visit" },
              grid: { color: "#eef3f9" },
            },
            y: {
              title: { display: true, text: "% Rx สูงสุดใน 4 โรค" },
              grid: { color: "#eef3f9" },
              min: 0,
              max: 80,
            },
          },
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label: (ctx: TooltipItem<"bubble">) => {
                  const raw = ctx.raw as BubblePoint;
                  return `${raw.name} · ${raw.x} visit · max ${raw.y}%`;
                },
              },
            },
            title: {
              display: true,
              text: "ขนาด bubble = จำนวน visit",
              font: { size: 11, weight: "normal" as const },
              color: "#9ca3af",
            },
          },
        },
      },
    );
  }, [data]);

  // Pie + ATB by disease
  useEffect(() => {
    if (!pieRef.current || !atbRef.current || !data) return;
    const dis = data.diseases.find((d) => d.key === disTab);
    if (!dis) return;
    destroy("pie");
    chartMap.current.pie = new Chart(pieRef.current, {
      type: "doughnut",
      data: {
        labels: ["ได้รับ ATB", "ไม่ได้รับ ATB"],
        datasets: [
          {
            data: [dis.rxN, dis.visits - dis.rxN],
            backgroundColor: [dis.color, "#e2e8f0"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: { legend: { position: "bottom" } },
      },
    });
    const atbList =
      data.atbByDisease[disTab as keyof typeof data.atbByDisease] ?? [];
    destroy("atb");
    chartMap.current.atb = new Chart(atbRef.current, {
      type: "bar",
      data: {
        labels: atbList.map((r) => r.drug_name),
        datasets: [
          {
            label: "ใบสั่ง",
            data: atbList.map((r) => r.rx_count),
            backgroundColor: dis.color,
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: "#eef3f9" } },
          y: { grid: { display: false } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }, [data, disTab]);

  // Top ATB
  useEffect(() => {
    if (!topAtbRef.current || !data?.topAtb.length) return;
    destroy("topAtb");
    chartMap.current.topAtb = new Chart(topAtbRef.current, {
      type: "bar",
      data: {
        labels: data.topAtb.map((r) => r.drug_name),
        datasets: [
          {
            label: "ใบสั่ง",
            data: data.topAtb.map((r) => r.rx_count),
            backgroundColor: "#1e6fd9",
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: "#eef3f9" } },
          y: { grid: { display: false } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }, [data]);

  // Cleanup
  useEffect(() => () => Object.keys(chartMap.current).forEach(destroy), []); // eslint-disable-line

  return { trendRef, gaugeRef, pieRef, atbRef, topAtbRef, bubbleRef };
}
