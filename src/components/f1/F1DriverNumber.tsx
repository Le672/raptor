import { driverNumberMark } from "@/data/f1-driver-numbers";

export function F1DriverNumber({ year, driverId, code, number, compact = false, color }: {
  year: number; driverId?: string; code?: string; number?: string | number; compact?: boolean; color?: string;
}) {
  const mark = driverNumberMark(year, driverId, code, driverId ? undefined : number);
  const display = mark?.number || String(number || code || "—");
  return <span className={`f1-driver-number${compact ? " f1-driver-number-compact" : ""}`} role="img" aria-label={`车号 ${display}`} title={`车号 ${display}`} style={{ color }}>
    {mark ? <><span className="f1-driver-number-art" aria-hidden="true" style={{ maskImage: `url("${mark.asset}")`, WebkitMaskImage: `url("${mark.asset}")` }}/><span className="f1-driver-number-fallback" aria-hidden="true">{display}</span></> : <span aria-hidden="true">{display}</span>}
  </span>;
}

