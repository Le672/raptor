import { useEffect, useMemo, useState } from "react";
import { getOfficialEquipment } from "../lib/rail-equipment";
import type { TrainEquipment } from "../lib/rail-equipment";
import { DETAIL_ZOOM, inRailView, loadStationDwell, loadStationGeometry } from "../lib/rail-national-detail";
import type { RailViewport, StationDwellResponse, StationGeometry } from "../lib/rail-national-detail";
import type { NationalTrain } from "../lib/rail-national";

export const equipmentKey = (train: Pick<NationalTrain, "code" | "date">) => `${train.date}/${train.code}`;

export function useNationalRailDetail(view: RailViewport | null, trains: NationalTrain[], selected: NationalTrain | undefined) {
  const code = view?.station;
  const [geometry, setGeometry] = useState<{ code: string; data: StationGeometry | null; failed?: boolean }>();
  const [arrivals, setArrivals] = useState<{ code: string; data?: StationDwellResponse; failed?: boolean }>();
  const [equipment, setEquipment] = useState<Record<string, TrainEquipment | null>>({});
  useEffect(() => {
    if (!code) return;
    let active = true;
    void loadStationGeometry(code).then(data => { if (active) setGeometry({ code, data }); })
      .catch(() => { if (active) setGeometry({ code, data: null, failed: true }); });
    return () => { active = false; };
  }, [code]);
  useEffect(() => {
    if (!code) return;
    const controller = new AbortController();
    const request = async () => {
      if (document.hidden) return;
      try {
        const data = await loadStationDwell(code, controller.signal);
        if (!controller.signal.aborted) setArrivals({ code, data });
      } catch {
        if (!controller.signal.aborted) setArrivals({ code, failed: true });
      }
    };
    void request();
    const interval = window.setInterval(() => { void request(); }, 30000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [code]);
  const targetKeys = useMemo(() => {
    const visible = view && view.zoom >= DETAIL_ZOOM.lengths
      ? trains.filter(train => train.point && inRailView(train.point, view.bounds))
        .sort((a, b) => Number(b.stationCode === code && b.stopped) - Number(a.stationCode === code && a.stopped) || a.id.localeCompare(b.id))
        .slice(0, 12)
      : [];
    const keys = new Set([...(selected ? [equipmentKey(selected)] : []), ...visible.map(equipmentKey)]);
    return [...keys].join(",");
  }, [code, selected, trains, view]);
  useEffect(() => {
    if (!targetKeys) return;
    const keys = targetKeys.split(",");
    let active = true, running = false;
    const request = async () => {
      if (!active || running || document.hidden) return;
      running = true;
      const queue = keys.slice();
      const worker = async () => {
        while (active && queue.length) {
          const key = queue.shift()!, [date, train] = key.split("/");
          const value = await getOfficialEquipment(train, date);
          if (active) setEquipment(previous => {
            if (previous[key] === value) return previous;
            const next = { ...previous, [key]: value };
            const stored = Object.keys(next);
            if (stored.length > 160) delete next[stored[0]];
            return next;
          });
        }
      };
      try { await Promise.all([worker(), worker()]); } finally { running = false; }
    };
    void request();
    const timer = window.setInterval(() => { void request(); }, 75000);
    return () => { active = false; window.clearInterval(timer); };
  }, [targetKeys]);
  return { geometry: geometry?.code === code ? geometry : undefined, arrivals: arrivals?.code === code ? arrivals : undefined, equipment };
}
