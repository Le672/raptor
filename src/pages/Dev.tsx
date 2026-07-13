import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Binary,
  Braces,
  CaseSensitive,
  Clock,
  Copy,
  Hash,
  Link2,
  Palette,
  RefreshCw,
  RotateCcw,
  Check,
  Terminal,
} from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { cn } from "@/lib/utils";

/* ============================================================
   Tool definitions
   ============================================================ */

type ToolId =
  | "base64"
  | "json"
  | "url"
  | "timestamp"
  | "hash"
  | "case"
  | "color";

const tools: { id: ToolId; label: string; icon: typeof Binary }[] = [
  { id: "base64", label: "Base64", icon: Binary },
  { id: "json", label: "JSON", icon: Braces },
  { id: "url", label: "URL", icon: Link2 },
  { id: "timestamp", label: "时间戳", icon: Clock },
  { id: "hash", label: "哈希", icon: Hash },
  { id: "case", label: "大小写", icon: CaseSensitive },
  { id: "color", label: "颜色", icon: Palette },
];

/* ============================================================
   Utility helpers
   ============================================================ */

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }, [text]);
  return { copied, handleCopy };
}

function CopyButton({ text }: { text: string }) {
  const { copied, handleCopy } = useCopy(text);
  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
      disabled={!text}
      onClick={handleCopy}
      type="button"
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-emerald-600" />
          已复制
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
          复制
        </>
      )}
    </button>
  );
}

/* ============================================================
   Individual tool panels
   ============================================================ */

/* ---------- Base64 ---------- */

function Base64Tool() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  const output = useMemo(() => {
    if (!input.trim()) return "";
    try {
      return mode === "encode" ? btoa(input) : atob(input);
    } catch {
      return "输入无效，请检查内容";
    }
  }, [input, mode]);

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <button
          className={cn(
            "rounded-full px-4 py-2 text-sm transition",
            mode === "encode"
              ? "bg-stone-900 text-white"
              : "border border-white/40 bg-white/30 text-stone-600 backdrop-blur-xl",
          )}
          onClick={() => setMode("encode")}
          type="button"
        >
          编码 Encode
        </button>
        <button
          className={cn(
            "rounded-full px-4 py-2 text-sm transition",
            mode === "decode"
              ? "bg-stone-900 text-white"
              : "border border-white/40 bg-white/30 text-stone-600 backdrop-blur-xl",
          )}
          onClick={() => setMode("decode")}
          type="button"
        >
          解码 Decode
        </button>
        <button
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-500 backdrop-blur-xl transition hover:border-white/60"
          onClick={() => {
            setInput(output);
            setMode(mode === "encode" ? "decode" : "encode");
          }}
          type="button"
        >
          <RefreshCw className="size-3.5" />
          交换
        </button>
      </div>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
          {mode === "encode" ? "原始文本" : "Base64 文本"}
        </span>
        <textarea
          className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "encode" ? "输入要编码的文本..." : "输入 Base64 字符串..."}
          rows={4}
          value={input}
        />
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
          {mode === "encode" ? "Base64 结果" : "解码结果"}
        </span>
        <div className="relative">
          <textarea
            readOnly
            className="w-full rounded-2xl border border-white/30 bg-white/20 px-4 py-3 backdrop-blur-xl text-sm text-stone-700"
            rows={4}
            value={output}
          />
          <div className="absolute right-3 top-3">
            <CopyButton text={output} />
          </div>
        </div>
      </label>
    </div>
  );
}

/* ---------- JSON ---------- */

function JsonTool() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState(2);

  const output = useMemo(() => {
    if (!input.trim()) return "";
    try {
      return JSON.stringify(JSON.parse(input), null, indent);
    } catch {
      return "JSON 格式无效，请检查内容";
    }
  }, [input, indent]);

  const isValid = useMemo(() => {
    if (!input.trim()) return null;
    try {
      JSON.parse(input);
      return true;
    } catch {
      return false;
    }
  }, [input]);

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs",
            isValid === null
              ? "border border-white/30 bg-white/20 text-stone-500 backdrop-blur-xl"
              : isValid
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-red-50 text-red-600 ring-1 ring-red-200",
          )}
        >
          {isValid === null ? "等待输入" : isValid ? "有效 JSON" : "无效 JSON"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-stone-500">缩进:</span>
          {[2, 4].map((n) => (
            <button
              key={n}
              className={cn(
                "rounded-full px-3 py-1 text-xs transition",
                indent === n
                  ? "bg-stone-900 text-white"
                  : "border border-white/40 bg-white/30 text-stone-600 backdrop-blur-xl",
              )}
              onClick={() => setIndent(n)}
              type="button"
            >
              {n} 空格
            </button>
          ))}
        </div>
      </div>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
          输入 JSON
        </span>
        <textarea
          className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 font-mono text-sm text-stone-800 placeholder:text-stone-400 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
          onChange={(e) => setInput(e.target.value)}
          placeholder='{"key": "value"}'
          rows={6}
          value={input}
        />
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
          格式化结果
        </span>
        <div className="relative">
          <textarea
            readOnly
            className="w-full rounded-2xl border border-white/30 bg-white/20 px-4 py-3 backdrop-blur-xl font-mono text-sm text-stone-700"
            rows={8}
            value={output}
          />
          <div className="absolute right-3 top-3">
            <CopyButton text={output} />
          </div>
        </div>
      </label>
    </div>
  );
}

/* ---------- URL ---------- */

function UrlTool() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  const output = useMemo(() => {
    if (!input.trim()) return "";
    try {
      return mode === "encode"
        ? encodeURIComponent(input)
        : decodeURIComponent(input);
    } catch {
      return "URL 格式无效";
    }
  }, [input, mode]);

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <button
          className={cn(
            "rounded-full px-4 py-2 text-sm transition",
            mode === "encode"
              ? "bg-stone-900 text-white"
              : "border border-white/40 bg-white/30 text-stone-600 backdrop-blur-xl",
          )}
          onClick={() => setMode("encode")}
          type="button"
        >
          编码 Encode
        </button>
        <button
          className={cn(
            "rounded-full px-4 py-2 text-sm transition",
            mode === "decode"
              ? "bg-stone-900 text-white"
              : "border border-white/40 bg-white/30 text-stone-600 backdrop-blur-xl",
          )}
          onClick={() => setMode("decode")}
          type="button"
        >
          解码 Decode
        </button>
        <button
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-500 backdrop-blur-xl transition hover:border-white/60"
          onClick={() => {
            setInput(output);
            setMode(mode === "encode" ? "decode" : "encode");
          }}
          type="button"
        >
          <RefreshCw className="size-3.5" />
          交换
        </button>
      </div>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
          {mode === "encode" ? "原始文本" : "编码后文本"}
        </span>
        <textarea
          className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "encode" ? "输入要编码的 URL 或文本..." : "输入 URL 编码字符串..."}
          rows={4}
          value={input}
        />
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
          {mode === "encode" ? "编码结果" : "解码结果"}
        </span>
        <div className="relative">
          <textarea
            readOnly
            className="w-full rounded-2xl border border-white/30 bg-white/20 px-4 py-3 backdrop-blur-xl text-sm text-stone-700"
            rows={4}
            value={output}
          />
          <div className="absolute right-3 top-3">
            <CopyButton text={output} />
          </div>
        </div>
      </label>
    </div>
  );
}

/* ---------- Timestamp ---------- */

function TimestampTool() {
  const [tsInput, setTsInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const now = useMemo(() => Date.now(), []);

  const tsResult = useMemo(() => {
    const v = tsInput.trim();
    if (!v) return null;
    const ms = v.length <= 10 ? Number(v) * 1000 : Number(v);
    if (Number.isNaN(ms)) return { error: "无效的时间戳" };
    const d = new Date(ms);
    return {
      iso: d.toISOString(),
      local: d.toLocaleString("zh-CN"),
      utc: d.toUTCString(),
    };
  }, [tsInput]);

  const dateResult = useMemo(() => {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return { error: "无效的日期" };
    return {
      seconds: Math.floor(d.getTime() / 1000),
      millis: d.getTime(),
    };
  }, [dateInput]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
          当前时间戳:
        </span>
        <code className="rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-sm text-stone-700 backdrop-blur-xl">
          {Math.floor(now / 1000)}
        </code>
        <span className="text-xs text-stone-400">(秒)</span>
        <code className="rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-sm text-stone-700 backdrop-blur-xl">
          {now}
        </code>
        <span className="text-xs text-stone-400">(毫秒)</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* timestamp → date */}
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
            时间戳 → 日期
          </span>
          <input
            className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
            onChange={(e) => setTsInput(e.target.value)}
            placeholder="输入时间戳（秒或毫秒）"
            type="text"
            value={tsInput}
          />
          {tsResult && "error" in tsResult ? (
            <p className="text-sm text-red-500">{tsResult.error}</p>
          ) : tsResult ? (
            <div className="space-y-1.5 rounded-2xl border border-white/30 bg-white/20 p-4 text-sm backdrop-blur-xl">
              <p className="text-stone-700">
                <span className="text-stone-500">ISO: </span>
                {tsResult.iso}
              </p>
              <p className="text-stone-700">
                <span className="text-stone-500">本地: </span>
                {tsResult.local}
              </p>
              <p className="text-stone-700">
                <span className="text-stone-500">UTC: </span>
                {tsResult.utc}
              </p>
            </div>
          ) : null}
        </div>

        {/* date → timestamp */}
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
            日期 → 时间戳
          </span>
          <input
            className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-stone-800 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
            onChange={(e) => setDateInput(e.target.value)}
            type="datetime-local"
            value={dateInput}
          />
          {dateResult && "error" in dateResult ? (
            <p className="text-sm text-red-500">{dateResult.error}</p>
          ) : dateResult ? (
            <div className="space-y-1.5 rounded-2xl border border-white/30 bg-white/20 p-4 text-sm backdrop-blur-xl">
              <p className="text-stone-700">
                <span className="text-stone-500">秒: </span>
                {dateResult.seconds}
              </p>
              <p className="text-stone-700">
                <span className="text-stone-500">毫秒: </span>
                {dateResult.millis}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------- Hash ---------- */

function HashTool() {
  const [input, setInput] = useState("");
  const [algo, setAlgo] = useState<"SHA-256" | "SHA-512" | "MD5">("SHA-256");
  const [hash, setHash] = useState("");

  const computeHash = useCallback(async () => {
    if (!input.trim()) {
      setHash("");
      return;
    }
    if (algo === "MD5") {
      // MD5 via a simple pure-JS approach (not crypto.subtle)
      setHash("MD5 需要额外库支持，请使用 SHA-256 或 SHA-512");
      return;
    }
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const buf = await crypto.subtle.digest(algo, data);
      const hex = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setHash(hex);
    } catch {
      setHash("计算失败");
    }
  }, [input, algo]);

  useEffect(() => {
    computeHash();
  }, [computeHash]);

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        {(["SHA-256", "SHA-512", "MD5"] as const).map((a) => (
          <button
            key={a}
            className={cn(
              "rounded-full px-4 py-2 text-sm transition",
              algo === a
                ? "bg-stone-900 text-white"
                : "border border-white/40 bg-white/30 text-stone-600 backdrop-blur-xl",
            )}
            onClick={() => setAlgo(a)}
            type="button"
          >
            {a}
          </button>
        ))}
      </div>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
          输入文本
        </span>
        <textarea
          className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入要计算哈希的文本..."
          rows={4}
          value={input}
        />
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
          {algo} 结果
        </span>
        <div className="relative">
          <textarea
            readOnly
            className="w-full rounded-2xl border border-white/30 bg-white/20 px-4 py-3 backdrop-blur-xl font-mono text-sm text-stone-700"
            rows={2}
            value={hash}
          />
          <div className="absolute right-3 top-3">
            <CopyButton text={hash} />
          </div>
        </div>
      </label>
    </div>
  );
}

/* ---------- Case ---------- */

type CaseMode = "upper" | "lower" | "title" | "sentence" | "camel" | "snake" | "kebab";

const caseModes: { id: CaseMode; label: string; example: string }[] = [
  { id: "upper", label: "大写", example: "HELLO WORLD" },
  { id: "lower", label: "小写", example: "hello world" },
  { id: "title", label: "首字母大写", example: "Hello World" },
  { id: "sentence", label: "句首大写", example: "Hello world" },
  { id: "camel", label: "驼峰 camelCase", example: "helloWorld" },
  { id: "snake", label: "蛇形 snake_case", example: "hello_world" },
  { id: "kebab", label: "短横 kebab-case", example: "hello-world" },
];

function toTitleCase(s: string) {
  return s.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

function CaseTool() {
  const [input, setInput] = useState("");

  const outputs = useMemo(() => {
    if (!input.trim()) return {} as Record<CaseMode, string>;
    return {
      upper: input.toUpperCase(),
      lower: input.toLowerCase(),
      title: toTitleCase(input),
      sentence: input.charAt(0).toUpperCase() + input.slice(1).toLowerCase(),
      camel: input
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()),
      snake: input
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_|_$/g, ""),
      kebab: input
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    };
  }, [input]);

  return (
    <div className="grid gap-5">
      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
          输入文本
        </span>
        <textarea
          className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入要转换的文本..."
          rows={3}
          value={input}
        />
      </label>

      <div className="grid gap-3">
        {caseModes.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-4 rounded-2xl border border-white/30 bg-white/20 px-4 py-3 backdrop-blur-xl"
          >
            <span className="w-32 shrink-0 text-xs uppercase tracking-[0.2em] text-stone-500">
              {m.label}
            </span>
            <code className="min-w-0 flex-1 break-all text-sm text-stone-700">
              {outputs[m.id] || (
                <span className="text-stone-400">{m.example}</span>
              )}
            </code>
            <CopyButton text={outputs[m.id] || ""} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Color ---------- */

function ColorTool() {
  const [hex, setHex] = useState("#3B82F6");
  const [rgb, setRgb] = useState({ r: 59, g: 130, b: 246 });

  const hsl = useMemo(() => {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }, [rgb]);

  const handleHexChange = useCallback((value: string) => {
    setHex(value);
    const hex = value.replace("#", "");
    if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
      setRgb({
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      });
    }
  }, []);

  const handleRgbChange = useCallback(
    (channel: "r" | "g" | "b", value: string) => {
      const n = Math.min(255, Math.max(0, Number(value) || 0));
      const next = { ...rgb, [channel]: n };
      setRgb(next);
      setHex(
        `#${[next.r, next.g, next.b]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("")}`,
      );
    },
    [rgb],
  );

  const colorStr = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5">
        <div
          className="h-32 rounded-2xl border border-white/40 shadow-inner backdrop-blur-xl"
          style={{ backgroundColor: colorStr }}
        />

        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
            HEX
          </span>
          <div className="flex items-center gap-3">
            <input
              className="flex-1 rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-stone-800 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
              onChange={(e) => handleHexChange(e.target.value)}
              placeholder="#000000"
              type="text"
              value={hex}
            />
            <CopyButton text={hex} />
          </div>
        </label>

        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
            RGB
          </span>
          <div className="flex items-center gap-3">
            {(["r", "g", "b"] as const).map((ch) => (
              <label key={ch} className="flex items-center gap-2">
                <span className="text-xs uppercase text-stone-500">{ch}</span>
                <input
                  className="w-20 rounded-2xl border border-white/40 bg-white/30 px-3 py-2 text-sm text-stone-800 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                  max={255}
                  min={0}
                  onChange={(e) => handleRgbChange(ch, e.target.value)}
                  type="number"
                  value={rgb[ch]}
                />
              </label>
            ))}
            <CopyButton text={colorStr} />
          </div>
        </div>

        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
            HSL
          </span>
          <div className="flex items-center gap-3">
            <code className="flex-1 rounded-2xl border border-white/30 bg-white/20 px-4 py-3 backdrop-blur-xl text-sm text-stone-700">
              hsl({hsl.h}, {hsl.s}%, {hsl.l}%)
            </code>
            <CopyButton text={`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`} />
          </div>
        </label>
      </div>

      <div className="space-y-5">
        <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
          预设色板
        </span>
        <div className="grid grid-cols-4 gap-3">
          {[
            "#EF4444",
            "#F97316",
            "#F59E0B",
            "#84CC16",
            "#22C55E",
            "#06B6D4",
            "#3B82F6",
            "#8B5CF6",
            "#EC4899",
            "#64748B",
            "#1E293B",
            "#FFFFFF",
          ].map((c) => (
            <button
              key={c}
              className="h-12 rounded-2xl border-2 border-white/30 transition hover:scale-105 hover:border-white/50 backdrop-blur-xl"
              onClick={() => handleHexChange(c)}
              style={{ backgroundColor: c }}
              title={c}
              type="button"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Page component
   ============================================================ */

export default function Dev() {
  useDocumentMeta(
    "开发工具",
    "Base64、JSON、URL编码、时间戳、哈希、大小写转换、颜色转换等常用开发小工具。",
  );

  const [activeTool, setActiveTool] = useState<ToolId>("base64");

  const ToolPanel = useMemo(() => {
    const map: Record<ToolId, () => JSX.Element> = {
      base64: Base64Tool,
      json: JsonTool,
      url: UrlTool,
      timestamp: TimestampTool,
      hash: HashTool,
      case: CaseTool,
      color: ColorTool,
    };
    const Comp = map[activeTool];
    return <Comp />;
  }, [activeTool]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <HomeLink
              className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
            >
              <ArrowLeft className="size-3.5" />
              返回主页
            </HomeLink>
            <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-stone-600 backdrop-blur-xl">
              dev.yukino.bond
            </span>
          </div>
          <h1 className="mt-4 font-display text-4xl text-stone-900 sm:text-5xl">
            开发工具箱
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
            常用开发小工具集合，所有计算均在浏览器本地完成，不会上传数据。
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/30 px-4 py-2 text-sm text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
          onClick={() => window.location.reload()}
          type="button"
        >
          <RotateCcw className="size-4" />
          重置全部
        </button>
      </div>

      {/* Tool tabs */}
      <div className="glass-panel rounded-[32px] p-6 sm:p-8">
        <div className="mb-8 flex flex-wrap gap-2">
          {tools.map((t) => (
            <button
              key={t.id}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm transition",
                activeTool === t.id
                  ? "bg-stone-900 text-white"
                  : "border border-white/40 bg-white/30 text-stone-600 backdrop-blur-xl hover:border-white/60 hover:text-stone-900",
              )}
              onClick={() => setActiveTool(t.id)}
              type="button"
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </div>

        {ToolPanel}
      </div>

      {/* Footer note */}
      <div className="rounded-2xl border border-white/30 bg-white/20 p-5 text-center backdrop-blur-xl">
        <div className="inline-flex items-center gap-2 text-xs text-stone-500">
          <Terminal className="size-3.5" />
          所有工具均在浏览器本地运行，不会将数据发送到任何服务器
        </div>
      </div>
    </div>
  );
}