"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  OpdSummary,
  ModalState,
  DatePreset,
} from "../types/dashboard.types";
import {
  fmtDate,
  getPresetRange,
  toThaiDateLabel,
} from "../components/utils/dashboard.utils";

interface UseOpdDataReturn {
  summary: OpdSummary | null;
  loading: boolean;
  infoLabel: string;
  start: Date;
  end: Date;
  preset: DatePreset;
  setStart: (d: Date) => void;
  setEnd: (d: Date) => void;
  setPreset: (p: DatePreset) => void;
  handlePreset: (p: DatePreset) => void;
  handleSearch: () => void;
  modal: ModalState;
  openModal: (cardLabel: string, cardType: string) => void;
  closeModal: () => void;
}

export function useOpdData(): UseOpdDataReturn {
  const [preset, setPreset] = useState<DatePreset>("วันนี้");
  const [start, setStart] = useState<Date>(
    () => getPresetRange("วันนี้").start,
  );
  const [end, setEnd] = useState<Date>(() => getPresetRange("วันนี้").end);
  const [summary, setSummary] = useState<OpdSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [infoLabel, setInfoLabel] = useState("");
  const [modal, setModal] = useState<ModalState>({
    open: false,
    cardLabel: "",
    cardType: "all",
  });

  const fetchData = useCallback(async (s: Date, e: Date) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard?start=${fmtDate(s)}&end=${fmtDate(e)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSummary(json.summary ?? null);
      setInfoLabel(toThaiDateLabel(fmtDate(s), fmtDate(e)));
    } catch {
      // silently fail — caller handles empty state via summary === null
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(start, end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePreset = useCallback(
    (p: DatePreset) => {
      setPreset(p);
      const range = getPresetRange(p);
      setStart(range.start);
      setEnd(range.end);
      fetchData(range.start, range.end);
    },
    [fetchData],
  );

  const handleSearch = useCallback(() => {
    fetchData(start, end);
  }, [fetchData, start, end]);

  const openModal = useCallback((cardLabel: string, cardType: string) => {
    setModal({ open: true, cardLabel, cardType });
  }, []);

  const closeModal = useCallback(() => {
    setModal((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    summary,
    loading,
    infoLabel,
    start,
    end,
    preset,
    setStart,
    setEnd,
    setPreset,
    handlePreset,
    handleSearch,
    modal,
    openModal,
    closeModal,
  };
}
