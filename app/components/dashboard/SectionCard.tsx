import FilterToolbar from "./FilterToolbar";
import InfoBar from "./InfoBar";

type SectionCardProps = {
  title: string;
  children?: React.ReactNode;
};

export default function SectionCard({ title, children }: SectionCardProps) {
  return (
    <div className="border bg-white rounded-lg p-4 mt-4">
      <h4 className="text-lg font-bold text-[#717171]">{title}</h4>

      <div className="pt-4">
        <FilterToolbar />
        <InfoBar />

        <div className="border rounded-2xl mt-6"></div>

        {/* ตรงนี้สำคัญ */}
        {children}
      </div>
    </div>
  );
}
