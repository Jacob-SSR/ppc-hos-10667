"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  PatientRow,
  HistoryRow,
  GenderFilter,
} from "../types/dashboard.types";

interface UsePatientModalReturn {
  patients: PatientRow[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  genderFilter: GenderFilter;
  setGenderFilter: (g: GenderFilter) => void;
  filtered: PatientRow[];
  selectedPatient: PatientRow | null;
  selectPatient: (p: PatientRow) => void;
  clearPatient: () => void;
  modalSize: { w: number; h: number };
  startResize: (e: React.MouseEvent) => void;
}

export function usePatientModal(
  isOpen: boolean,
  start: string,
  end: string,
  cardType: string,
): UsePatientModalReturn {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(
    null,
  );
  const [modalSize, setModalSize] = useState({ w: 480, h: 640 });

  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 480, h: 640 });

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);

        const res = await fetch(
          `/api/dashboard/patients?start=${start}&end=${end}&type=${cardType}`,
          { credentials: "include" },
        );
        const data = await res.json();

        if (!cancelled) {
          setPatients(data.patients ?? []);
          setSearch("");
          setSelectedPatient(null);
          setGenderFilter("all");
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [isOpen, start, end, cardType]);

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();

    const matchSearch =
      !q ||
      `${p.pname}${p.fname} ${p.lname}`.toLowerCase().includes(q) ||
      p.hn.includes(q) ||
      p.cid?.includes(q) ||
      p.dx_name?.toLowerCase().includes(q) ||
      p.department?.toLowerCase().includes(q);

    const matchGender =
      genderFilter === "all" ||
      (genderFilter === "male" && p.sex === "1") ||
      (genderFilter === "female" && p.sex !== "1");

    return matchSearch && matchGender;
  });

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;

      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        w: modalSize.w,
        h: modalSize.h,
      };

      const onMove = (ev: MouseEvent) => {
        if (!isResizing.current) return;

        setModalSize({
          w: Math.max(
            360,
            Math.min(
              900,
              resizeStart.current.w + ev.clientX - resizeStart.current.x,
            ),
          ),
          h: Math.max(
            400,
            Math.min(
              window.innerHeight * 0.95,
              resizeStart.current.h + ev.clientY - resizeStart.current.y,
            ),
          ),
        });
      };

      const onUp = () => {
        isResizing.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [modalSize.w, modalSize.h],
  );

  return {
    patients,
    loading,
    search,
    setSearch,
    genderFilter,
    setGenderFilter,
    filtered,
    selectedPatient,
    selectPatient: setSelectedPatient,
    clearPatient: () => setSelectedPatient(null),
    modalSize,
    startResize,
  };
}

// ─── History Hook ─────────────────────────────────────────────────────────────

interface UsePatientHistoryReturn {
  history: HistoryRow[];
  loading: boolean;
}

export function usePatientHistory(hn: string): UsePatientHistoryReturn {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false); // ✅ เปลี่ยนตรงนี้

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);

        const res = await fetch(
          `/api/dashboard/patients?start=2020-01-01&end=2099-12-31&hn=${hn}`,
          { credentials: "include" },
        );
        const data = await res.json();

        if (!cancelled) {
          setHistory(data.history ?? []);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [hn]);

  return { history, loading };
}
