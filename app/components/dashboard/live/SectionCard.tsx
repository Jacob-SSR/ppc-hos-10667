// app/components/dashboard/live/SectionCard.tsx
// รวม SectionCard (accident/drug/sepsis) + ChartCard (homeward/stroke)
// ต่างกันแค่มี/ไม่มี icon และสี title
"use client";

interface Props {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  /** สี title + icon (default เทา) — homeward/stroke ใช้ #1a5233 */
  titleColor?: string;
}

export function SectionCard({
  title,
  icon: Icon,
  children,
  className = "",
  titleColor = "#4b5563",
}: Props) {
  return (
    <div className={`bg-white border border-gray-200 rounded-2xl shadow-sm p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon size={15} style={{ color: titleColor }} />}
        <p className="text-sm font-bold" style={{ color: titleColor }}>
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}
