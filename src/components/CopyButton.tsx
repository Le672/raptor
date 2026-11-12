import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyText } from "@/lib/browser-actions";

export function CopyButton({ text, label = "复制", disabled = false }: { text: string; label?: string; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { setState("idle"); return () => clearTimeout(timer.current); }, [text]);
  return <span className="inline-flex flex-col gap-1"><button className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white/60 px-3 py-2 text-xs text-stone-700 disabled:opacity-40" type="button" disabled={disabled || !text} onClick={async () => {
    try { await copyText(text); setState("copied"); } catch { setState("error"); }
    clearTimeout(timer.current); timer.current = setTimeout(() => setState("idle"), 2200);
  }}>{state === "copied" ? <Check size={14} /> : <Copy size={14} />}{state === "copied" ? "已复制" : label}</button><span role="status" className="text-xs text-red-700">{state === "error" ? "复制失败，请手动复制" : ""}</span></span>;
}
