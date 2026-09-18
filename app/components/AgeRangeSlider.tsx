"use client";

import { useId, useState } from "react";
import { MIN_AGE, MAX_AGE } from "@/lib/population-report";
import styles from "./AgeRangeSlider.module.css";

interface Props {
  value: readonly [number, number];
  onChange: (value: [number, number]) => void;
}

export default function AgeRangeSlider({ value, onChange }: Props) {
  const id = useId();
  const [draft, setDraft] = useState<[string, string]>([String(value[0]), String(value[1])]);
  const update = (index: 0 | 1, raw: number) => {
    const next: [number, number] = [...value];
    next[index] = Math.max(index === 0 ? MIN_AGE : value[0], Math.min(index === 0 ? value[1] : MAX_AGE, Math.round(raw)));
    setDraft([String(next[0]), String(next[1])]);
    onChange(next);
  };
  const commit = (index: 0 | 1) => {
    const raw = draft[index].trim();
    update(index, raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : value[index]);
  };
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="font-semibold text-gray-800">ช่วงอายุ (ปี)</legend>
      <div className="flex items-end gap-4">
        {([0, 1] as const).map((index) => (
          <label key={index} htmlFor={`${id}-${index}`} className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-gray-600">
            {index === 0 ? "อายุเริ่มต้น" : "อายุสิ้นสุด"}
            <input id={`${id}-${index}`} type="number" inputMode="numeric" min={MIN_AGE} max={MAX_AGE} step={1}
              value={draft[index]}
              onChange={(event) => {
                const raw = event.target.value;
                setDraft((prev) => index === 0 ? [raw, prev[1]] : [prev[0], raw]);
                const num = Number(raw);
                if (raw !== "" && Number.isInteger(num) && num >= MIN_AGE && num <= MAX_AGE && (index === 0 ? num <= value[1] : num >= value[0])) {
                  const next: [number, number] = [...value];
                  next[index] = num;
                  onChange(next);
                }
              }}
              onBlur={() => commit(index)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(index); } }}
              className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:outline-2 focus:outline-green-700"
            />
          </label>
        ))}
      </div>
      <div className="relative h-11 mx-3">
        <div className="absolute inset-x-3 top-5 h-1 rounded-full bg-gray-200">
          <div className="absolute h-1 rounded-full bg-green-700" style={{ left: `${value[0] / MAX_AGE * 100}%`, right: `${100 - value[1] / MAX_AGE * 100}%` }} />
        </div>
        {([0, 1] as const).map((index) => (
          <input key={index} type="range" min={MIN_AGE} max={MAX_AGE} step={1} value={value[index]}
            aria-label={index === 0 ? "เลื่อนอายุเริ่มต้น" : "เลื่อนอายุสิ้นสุด"}
            aria-valuemin={index === 0 ? MIN_AGE : value[0]}
            aria-valuemax={index === 0 ? value[1] : MAX_AGE}
            aria-valuetext={`${value[index]} ปี`}
            onChange={(event) => update(index, Number(event.target.value))}
            className={styles.range}
            style={{ zIndex: index === 0 && value[0] === MAX_AGE ? 2 : undefined }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500"><span>0 ปี</span><span>120 ปี</span></div>
      <p className="text-sm text-gray-600">เลือก {value[0]}–{value[1]} ปี (รวมอายุต้นและปลาย) · ลากปุ่มหรือกรอกตัวเลข</p>
    </fieldset>
  );
}
