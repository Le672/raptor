import { useEffect, useId, useRef, useState } from "react";
import { Languages, LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { RadioText, RadioTextRequest } from "@/lib/f1-community";

export function F1RadioText({ entry }: { entry: RadioTextRequest }) {
  const [data, setData] = useState<RadioText | null>(null), [busy, setBusy] = useState(false), [expanded, setExpanded] = useState(false), [error, setError] = useState("");
  const active = useRef(true), id = useId(), identity = `${entry.session}:${entry.driver}:${entry.date}`;
  const currentIdentity = useRef(identity);
  useEffect(() => { currentIdentity.current = identity; active.current = true; setData(null); setError(""); setBusy(false); setExpanded(false); return () => { active.current = false; }; }, [identity]);
  useEffect(() => {
    if (data?.status !== "working") return;
    let alive = true, running = false;
    const start = Date.now();
    const interval = setInterval(async () => {
      if (running || document.visibilityState === "hidden") return;
      if (Date.now() - start > 120000) { setBusy(false); setError("处理时间较长，可再次点击查看结果。"); clearInterval(interval); return; }
      running = true;
      try {
        const result = await api.getRadioText(entry);
        if (alive) { setData(result); if (result.status !== "working") { setBusy(false); setError(result.error); } }
      } catch (failure) { if (alive) { setBusy(false); setError(failure instanceof Error ? failure.message : "文字暂不可用"); clearInterval(interval); } }
      finally { running = false; }
    }, 2500);
    return () => { alive = false; clearInterval(interval); };
  }, [data?.status, identity]);
  const transcribe = async () => {
    if (busy) return;
    if (data?.transcript && data.translation) { setExpanded(value => !value); return; }
    setBusy(true); setExpanded(true); setError("");
    try {
      const result = await api.transcribeRadio(entry);
      if (active.current && currentIdentity.current === identity) { setData(result); setBusy(result.status === "working"); setError(result.error); }
    } catch (failure) {
      if (active.current && currentIdentity.current === identity) { setBusy(false); setError(failure instanceof Error ? failure.message : "转写未完成，请重试"); }
    }
  };
  return <div className="f1-radio-text">
    <button type="button" className="f1-radio-transcribe" onClick={() => void transcribe()} disabled={busy} aria-expanded={expanded} aria-controls={id}>{busy ? <LoaderCircle size={13} className="f1-radio-spinner"/> : <Languages size={13}/>}<span>{busy ? "正在转写与翻译…" : data?.transcript && data.translation ? expanded ? "收起原文与译文" : "查看原文与译文" : data?.transcript ? "重试中文翻译" : error ? "重试转写与翻译" : "转写与中文翻译"}</span></button>
    {expanded && <div className="f1-radio-copy" id={id} aria-live="polite">{data?.transcript && <div><small>转写原文{data.language ? ` · ${data.language.toUpperCase()}` : ""}</small><p lang={data.language || undefined}>{data.transcript}</p></div>}{data?.translation && <div className="f1-radio-translation"><small>中文翻译</small><p lang="zh-CN">{data.translation}</p></div>}{busy && <p className="f1-footnote">正在识别这段录音，首次处理可能需要一些时间。</p>}{error && <p className="f1-radio-error" role="alert">{error}</p>}{data?.transcript && <small className="f1-radio-ai-note">机器转写与翻译可能有误，请以原声为准。</small>}</div>}
  </div>;
}
