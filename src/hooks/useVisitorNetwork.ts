import { useCallback, useEffect, useState } from "react";
import { loadVisitorNetwork } from "@/lib/ip-client";
import type { VisitorNetwork } from "@/lib/ip";

export function useVisitorNetwork() {
  const [data, setData] = useState<VisitorNetwork | null>(null), [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(true), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError(null);
    loadVisitorNetwork(attempt > 0).then(value => { if (active) setData(value); }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : "本次连接信息暂时不可用。"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  return { data, error, loading, refresh };
}
