"use client";

import { useEffect, useId, useState } from "react";
import { Search, X, LoaderCircle, Check } from "lucide-react";
import type { IcdDisease } from "@/lib/icd-disease-search";
import styles from "./report.module.css";

type Response = { items: IcdDisease[]; hasMore: boolean };
export default function DiseaseSearch({ onSelect, onQueryChange }: { onSelect: (disease: IcdDisease) => void; onQueryChange: (query: string) => void }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState<{ query: string; data?: Response; error?: string }>({ query: "" });
  const term = query.trim();
  const searching = open && term.length >= 2;
  const current = state.query === term ? state : undefined;
  const items = current?.data?.items ?? [];
  const loading = searching && !current?.data && !current?.error;

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/icd10-report/diseases?q=${encodeURIComponent(term)}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "ค้นหาชื่อโรคไม่สำเร็จ");
        if (!controller.signal.aborted) setState({ query: term, data });
      } catch (error) {
        if (!controller.signal.aborted) setState({ query: term, error: error instanceof Error ? error.message : "ค้นหาชื่อโรคไม่สำเร็จ" });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term, searching]);

  useEffect(() => {
    if (searching && active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, id, searching]);

  function choose(item: IcdDisease) {
    onSelect(item); setQuery(""); onQueryChange(""); setOpen(false); setActive(-1);
  }
  return <div className={styles.diseaseSearch} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <label className={styles.field} htmlFor={id}>ค้นหาชื่อโรคหรืออาการ</label>
    <div className={styles.searchField}>
      <Search size={17} aria-hidden="true" />
      <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={searching} aria-controls={`${id}-results`} aria-activedescendant={searching && active >= 0 && items[active] ? `${id}-${active}` : undefined}
        aria-describedby={`${id}-help`} autoComplete="off" maxLength={100} value={query}
        placeholder="เช่น ปวดหลัง เจ็บคอ หรือรหัส ICD-10"
        onFocus={() => setOpen(true)}
        onChange={event => { setQuery(event.target.value); onQueryChange(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            if (items.length) setActive(index => event.key === "ArrowDown" ? Math.min(index + 1, items.length - 1) : Math.max(index - 1, 0));
          } else if (event.key === "Enter" && term) {
            event.preventDefault();
            if (searching && active >= 0 && items[active]) choose(items[active]);
          } else if (event.key === "Escape") { event.preventDefault(); setOpen(false); setActive(-1); }
        }} />
      {loading ? <LoaderCircle size={16} className={styles.spin} aria-hidden="true" /> : query && <button type="button" aria-label="ล้างคำค้นชื่อโรค" onClick={() => { setQuery(""); onQueryChange(""); setActive(-1); }}><X size={16} /></button>}
    </div>
    <p id={`${id}-help`} className={styles.help}>พิมพ์อย่างน้อย 2 ตัวอักษร แล้วเลือกชื่อโรคเพื่อใส่รหัสให้อัตโนมัติ</p>
    <div className={styles.diseaseResults} hidden={!searching}>
      <div role="status" className={styles.diseaseStatus}>
        {loading ? "กำลังค้นหาชื่อโรค…" : current?.error ? current.error : items.length ? `พบ ${items.length} รายการ${current?.data?.hasMore ? "ขึ้นไป · ลองพิมพ์ให้เฉพาะเจาะจงขึ้น" : " · เลือกโรคที่ต้องการ"}` : "ไม่พบชื่อโรค ลองใช้คำอื่นหรือชื่อภาษาอังกฤษ"}
      </div>
      <ul id={`${id}-results`} role="listbox" aria-label="ชื่อโรคที่พบ">
        {items.map((item, index) => <li key={item.code} id={`${id}-${index}`} role="option" aria-selected={active === index} className={active === index ? styles.diseaseActive : ""}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(item)} onMouseEnter={() => setActive(index)}>
          <span><strong>{item.thai_name || item.name || item.code}</strong>{item.thai_name && item.name && <small>{item.name}</small>}</span>
          <span className={styles.code}>{item.code}</span>{active === index && <Check size={14} aria-hidden="true" />}
        </li>)}
      </ul>
    </div>
  </div>;
}
