// app/components/dashboard/live/CountdownRing.tsx
// รวม CountdownRing 4 variant (accident/drug/sepsis ใช้แบบไม่มีเลข, homeward/it-worklog มีเลขกลาง)
"use client";

interface Props {
  secondsLeft: number;
  total: number;
  color?: string;
  /** แสดงตัวเลขวินาทีตรงกลางวง (แบบ homeward / it-worklog) */
  showText?: boolean;
}

export function CountdownRing({
  secondsLeft,
  total,
  color = "#3aa36a",
  showText = false,
}: Props) {
  const r = 10;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - secondsLeft / total);

  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 28 28"
      className={showText ? undefined : "-rotate-90"}
    >
      <circle cx={14} cy={14} r={r} fill="none" stroke="#e5e7eb" strokeWidth={3} />
      <circle
        cx={14}
        cy={14}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={showText ? "rotate(-90 14 14)" : undefined}
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
      {showText && (
        <text
          x={14}
          y={18}
          textAnchor="middle"
          fontSize={8}
          fill={color}
          fontWeight={700}
        >
          {secondsLeft}
        </text>
      )}
    </svg>
  );
}
