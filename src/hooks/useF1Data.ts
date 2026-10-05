import { useCallback, useEffect, useRef, useState } from "react";
import { F1_API } from "@/lib/f1";

export function useF1Data<T>(query: string | null, refreshSeconds = 0) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const controller = useRef<AbortController>(), identity = useRef(query), running = useRef(false);
  const load = useCallback(async () => {
    if (!query || running.current) return;
    const active = new AbortController(); controller.current = active; running.current = true;
    setLoading(true);
    const timer = setTimeout(() => active.abort(), 22000);
    try {
      const response = await fetch(`${F1_API}?${query}`, { signal: active.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "数据源暂不可用，请稍后重试");
      if (!active.signal.aborted && identity.current === query) { setData(payload); setError(""); }
    } catch (e) { if (identity.current === query && controller.current === active) setError(active.signal.aborted ? "请求超时，请重试" : e instanceof Error ? e.message : "网络连接失败"); }
    finally { clearTimeout(timer); if (controller.current === active) { running.current = false; setLoading(false); } }
  }, [query]);
  useEffect(() => {
    controller.current?.abort(); running.current = false; identity.current = query; setData(null); setError(""); setLoading(false);
    if (!query) return;
    void load();
    const onVisible = () => { if (document.visibilityState === "visible" && refreshSeconds) void load(); };
    const interval = refreshSeconds ? setInterval(() => { if (document.visibilityState !== "hidden") void load(); }, refreshSeconds * 1000) : undefined;
    document.addEventListener("visibilitychange", onVisible);
    return () => { controller.current?.abort(); identity.current = null; if (interval) clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [query, refreshSeconds, load]);
  return { data, error, loading, reload: load };
}
