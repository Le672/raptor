import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Binary, Braces, Link2, Clock, Hash, CaseSensitive, Palette, RotateCcw } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { CopyButton } from "@/components/CopyButton";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { DEV_TOOLS, base64, timestampDate, textCases, hexRgb, rgbHex, rgbHsl, hslRgb, colorByte, md5, type Rgb, type Hsl, type ToolId, type TimestampUnit } from "@/lib/dev-tools";

const fieldClass = "w-full rounded-2xl border border-stone-200 bg-white/60 px-4 py-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-200";
const buttonClass = "rounded-full border border-stone-200 bg-white/60 px-4 py-2 text-sm text-stone-700 disabled:opacity-40";
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-2"><span className="text-xs text-stone-500">{label}</span>{children}</label>; }
function Result({ title, value, error = "" }: { title: string; value: string; error?: string }) {
  return <div className="space-y-3"><Field label={title}><textarea className={fieldClass + " font-mono"} value={value} rows={4} readOnly /></Field>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<CopyButton text={value} label={"复制" + title} disabled={!!error} /></div>;
}
function Codec({ kind }: { kind: "base64" | "url" }) {
  const [input, setInput] = useState(""), [decode, setDecode] = useState(false);
  const result = useMemo(() => {
    try { return { value: kind === "base64" ? base64(input, decode) : decode ? decodeURIComponent(input) : encodeURIComponent(input), error: "" }; }
    catch { return { value: "", error: kind === "base64" ? "请输入有效的 UTF-8 Base64 字符串" : "URL 编码不完整或包含无效字符" }; }
  }, [input, decode, kind]);
  return <div className="grid gap-5"><div className="flex flex-wrap gap-2"><button className={buttonClass} type="button" aria-pressed={!decode} onClick={() => setDecode(false)}>编码 Encode</button><button className={buttonClass} type="button" aria-pressed={decode} onClick={() => setDecode(true)}>解码 Decode</button><button className={buttonClass} disabled={!!result.error || !input} type="button" onClick={() => { setInput(result.value); setDecode(value => !value); }}>交换</button><button className={buttonClass} type="button" onClick={() => setInput("")}>清空</button></div><Field label={decode ? "待解码文本" : "原始文本"}><textarea className={fieldClass} value={input} maxLength={100000} rows={5} onChange={event => setInput(event.target.value)} /></Field><Result title={kind === "base64" ? "Base64 结果" : "URL 结果"} {...result} /><p className="text-xs leading-6 text-stone-500">{kind === "url" ? "使用 encodeURIComponent / decodeURIComponent 转换 URL 参数；空格会编码成 %20，+ 保持字面含义。" : "使用 UTF-8，支持中文、emoji 与空白字符。"}</p></div>;
}
function JsonTool() {
  const [input, setInput] = useState(""), [indent, setIndent] = useState("2");
  const result = useMemo(() => { if (!input.trim()) return { value: "", error: "" }; try { return { value: JSON.stringify(JSON.parse(input), null, Number(indent)), error: "" }; } catch (error) { return { value: "", error: error instanceof Error ? error.message : "JSON 格式错误" }; } }, [input, indent]);
  return <div className="grid gap-5"><div className="flex flex-wrap gap-3"><label className="text-sm text-stone-600">输出格式 <select className={buttonClass} value={indent} onChange={event => setIndent(event.target.value)} aria-label="JSON 输出格式"><option value="2">缩进 2 空格</option><option value="4">缩进 4 空格</option><option value="0">压缩</option></select></label><button className={buttonClass} type="button" onClick={() => setInput('{"name":"Yukino","tags":["代码","生活"],"active":true}')}>载入示例</button><button className={buttonClass} type="button" onClick={() => setInput("")}>清空</button></div><Field label="JSON 输入"><textarea className={fieldClass + " font-mono"} value={input} onChange={event => setInput(event.target.value)} rows={8} maxLength={100000} spellCheck={false} /></Field><Result title="JSON 结果" {...result} />{input.trim() && !result.error && <p role="status" className="text-xs text-emerald-700">JSON 校验通过 · 输入 {input.length} 字符，输出 {result.value.length} 字符</p>}</div>;
}
function TimestampTool() {
  const [input, setInput] = useState(""), [unit, setUnit] = useState<TimestampUnit>("auto"), [dateInput, setDateInput] = useState(""), [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const result = useMemo(() => { if (!input.trim()) return { value: "", error: "" }; try { const date = timestampDate(input, unit); return { value: "ISO: " + date.toISOString() + "\n本地: " + date.toLocaleString("zh-CN") + "\nUTC: " + date.toUTCString(), error: "" }; } catch (error) { return { value: "", error: error instanceof Error ? error.message : "无效的时间戳" }; } }, [input, unit]);
  const date = new Date(dateInput), validDate = Number.isFinite(date.getTime());
  return <div className="grid gap-6"><div className="rounded-2xl bg-white/60 p-4"><p className="text-xs text-stone-500">当前时间戳，每秒更新</p><code className="my-3 block break-all text-stone-800">{Math.floor(now / 1000)} 秒 / {now} 毫秒</code><button type="button" className={buttonClass} onClick={() => { setUnit("milliseconds"); setInput(String(Date.now())); }}>填入当前时间</button></div><div className="grid gap-6 lg:grid-cols-2"><div className="space-y-4"><Field label="时间戳输入"><input className={fieldClass} value={input} onChange={event => setInput(event.target.value)} inputMode="decimal" maxLength={40} placeholder="支持负数和小数" /></Field><Field label="时间戳单位"><select className={fieldClass} value={unit} onChange={event => setUnit(event.target.value as TimestampUnit)}><option value="auto">自动判断</option><option value="seconds">秒</option><option value="milliseconds">毫秒</option></select></Field><Result title="日期结果" {...result} /><p className="text-xs leading-6 text-stone-500">自动模式将绝对值小于 1000 亿的输入视作秒。接近 1970 年的毫秒值请手动选择单位。</p></div><div className="space-y-4"><Field label="本地日期输入"><input className={fieldClass} type="datetime-local" step="1" value={dateInput} onChange={event => setDateInput(event.target.value)} /></Field><Result title="时间戳结果" value={validDate ? "秒: " + date.getTime() / 1000 + "\n毫秒: " + date.getTime() : ""} error={dateInput && !validDate ? "无效的日期" : ""} /><p className="text-xs text-stone-500">日期输入使用你的浏览器本地时区。</p></div></div></div>;
}
function HashTool() {
  const [input, setInput] = useState(""), [algorithm, setAlgorithm] = useState("SHA-256"), [value, setValue] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  useEffect(() => {
    let current = true; setValue(""); setError(""); setLoading(true);
    const compute = async () => {
      try {
        const digest = algorithm === "MD5" ? md5(input) : Array.from(new Uint8Array(await crypto.subtle.digest(algorithm, new TextEncoder().encode(input))), byte => byte.toString(16).padStart(2, "0")).join("");
        if (current) setValue(digest);
      } catch { if (current) setError("当前环境无法计算此哈希，请使用 HTTPS 页面重试"); }
      finally { if (current) setLoading(false); }
    };
    void compute(); return () => { current = false; };
  }, [input, algorithm]);
  return <div className="grid gap-5"><Field label="哈希算法"><select className={fieldClass} value={algorithm} onChange={event => setAlgorithm(event.target.value)}>{["SHA-256", "SHA-512", "MD5"].map(algo => <option key={algo}>{algo}</option>)}</select></Field><Field label="哈希输入文本"><textarea className={fieldClass} value={input} onChange={event => setInput(event.target.value)} rows={5} maxLength={100000} /></Field>{loading && <p role="status" className="text-xs text-stone-500">正在计算…</p>}<Result title={algorithm + " 结果"} value={value} error={error} /><p className="text-xs text-stone-500">按原始 UTF-8 文本计算，包括空格与换行；空字符串也有确定的哈希值。</p></div>;
}
function CaseTool() {
  const [input, setInput] = useState(""), outputs = useMemo(() => textCases(input), [input]);
  const labels = { upper: "大写", lower: "小写", title: "首字母大写", sentence: "句首大写", camel: "camelCase", snake: "snake_case", kebab: "kebab-case" };
  return <div className="grid gap-5"><Field label="大小写输入文本"><textarea className={fieldClass} value={input} onChange={event => setInput(event.target.value)} rows={4} maxLength={100000} placeholder="支持 helloWorld、HTTPServer 和中文文本" /></Field>{(Object.keys(labels) as (keyof typeof labels)[]).map(mode => <div key={mode} className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white/40 p-4"><span className="w-32 text-xs text-stone-500">{labels[mode]}</span><code className="min-w-0 flex-1 break-all text-sm text-stone-700">{outputs[mode]}</code><CopyButton text={outputs[mode]} label={"复制" + labels[mode]} /></div>)}</div>;
}
function ColorTool() {
  const [rgb, setRgb] = useState<Rgb>({ r: 59, g: 130, b: 246 }), [hex, setHex] = useState("#3B82F6"), [hsl, setHsl] = useState<Hsl>(() => rgbHsl({ r: 59, g: 130, b: 246 }));
  const updateRgb = (next: Rgb) => { setRgb(next); setHex(rgbHex(next)); setHsl(rgbHsl(next)); };
  const updateHex = (value: string) => { setHex(value); const next = hexRgb(value); if (next) { setRgb(next); setHsl(rgbHsl(next)); } };
  const updateHsl = (channel: keyof Hsl, value: string) => {
    if (!Number.isFinite(Number(value))) return;
    const next = { ...hsl, [channel]: channel === "h" ? Math.max(0, Math.min(360, Number(value))) : Math.max(0, Math.min(100, Number(value))) };
    const rgb = hslRgb(next); setHsl(next); setRgb(rgb); setHex(rgbHex(rgb));
  };
  return <div className="grid gap-6 lg:grid-cols-2"><div className="space-y-5"><div className="h-36 rounded-2xl border border-stone-200" style={{ backgroundColor: rgbHex(rgb) }} aria-label={"颜色预览 " + rgbHex(rgb)} /><Field label="HEX 颜色"><input className={fieldClass} value={hex} onChange={event => updateHex(event.target.value)} maxLength={7} placeholder="#RGB 或 #RRGGBB" /></Field>{!hexRgb(hex) && <p role="alert" className="text-xs text-red-700">请输入 3 位或 6 位 HEX，预览保留上次有效颜色。</p>}<CopyButton text={rgbHex(rgb)} disabled={!hexRgb(hex)} label="复制 HEX" /><div><p className="mb-3 text-xs text-stone-500">RGB（0–255，按整数处理）</p><div className="grid grid-cols-3 gap-3">{(["r", "g", "b"] as const).map(channel => <Field key={channel} label={channel.toUpperCase()}><input className={fieldClass} type="number" min={0} max={255} step={1} value={rgb[channel]} onChange={event => updateRgb({ ...rgb, [channel]: colorByte(Number(event.target.value)) })} /></Field>)}</div><div className="mt-3"><CopyButton text={'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')'} label="复制 RGB" /></div></div></div><div className="space-y-5"><div><p className="mb-3 text-xs text-stone-500">HSL（色相 / 饱和度 / 亮度）</p><div className="grid grid-cols-3 gap-3">{(["h", "s", "l"] as const).map(channel => <Field key={channel} label={channel.toUpperCase()}><input className={fieldClass} type="number" min={0} max={channel === "h" ? 360 : 100} value={hsl[channel]} onChange={event => updateHsl(channel, event.target.value)} /></Field>)}</div><div className="mt-3"><CopyButton text={'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)'} label="复制 HSL" /></div></div><Field label="颜色选择器"><input type="color" className="h-12 w-full cursor-pointer" value={rgbHex(rgb)} onChange={event => updateHex(event.target.value)} /></Field><div className="grid grid-cols-4 gap-3">{["#EF4444", "#F97316", "#F59E0B", "#84CC16", "#22C55E", "#06B6D4", "#3B82F6", "#8B5CF6", "#FFFFFF", "#000000", "#264E3D", "#E8EDDA"].map(color => <button type="button" key={color} className="h-12 rounded-xl border border-stone-200" style={{ backgroundColor: color }} onClick={() => updateHex(color)} aria-label={"选用颜色 " + color} />)}</div></div></div>;
}
const icons = { base64: Binary, json: Braces, url: Link2, timestamp: Clock, hash: Hash, case: CaseSensitive, color: Palette };
const panels = { base64: () => <Codec kind="base64" />, json: JsonTool, url: () => <Codec kind="url" />, timestamp: TimestampTool, hash: HashTool, case: CaseTool, color: ColorTool };
export default function Dev() {
  useDocumentMeta("开发工具", "七种本地开发工具，支持分享当前工具、切换保留输入和完整校验。");
  const [params, setParams] = useSearchParams(), [reset, setReset] = useState(0);
  const requested = params.get("tool"), active: ToolId = DEV_TOOLS.some(tool => tool.id === requested) ? requested as ToolId : "base64";
  const select = (id: ToolId) => setParams(previous => { const next = new URLSearchParams(previous); next.set("tool", id); return next; });
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10"><div><HomeLink className="text-link">← 返回主页</HomeLink><p className="eyebrow mt-6">LOCAL TOOLBOX</p><h1 className="mt-3 font-display text-4xl text-stone-900">开发工具箱</h1><p className="mt-4 text-sm leading-7 text-stone-600">七种工具，在浏览器本地处理数据。切换工具保留本次输入，复制地址可分享当前工具。</p><div className="mt-5 flex flex-wrap gap-3"><CopyButton text={"https://www.yukino.bond/dev?tool=" + active} label="复制工具链接" /><button className={buttonClass + " inline-flex items-center gap-2"} type="button" onClick={() => setReset(value => value + 1)}><RotateCcw size={14} />清空所有工具输入</button></div></div><div className="glass-panel rounded-[32px] p-5 sm:p-8"><div role="tablist" aria-label="开发工具" className="mb-8 flex flex-wrap gap-2">{DEV_TOOLS.map((tool, index) => { const Icon = icons[tool.id]; return <button key={tool.id} id={"tool-tab-" + tool.id} role="tab" aria-selected={active === tool.id} aria-controls={"tool-panel-" + tool.id} tabIndex={active === tool.id ? 0 : -1} type="button" className={buttonClass + (active === tool.id ? " !bg-stone-800 !text-white" : "") + " inline-flex items-center gap-2"} onClick={() => select(tool.id)} onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? DEV_TOOLS.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + DEV_TOOLS.length) % DEV_TOOLS.length; select(DEV_TOOLS[next].id); document.getElementById("tool-tab-" + DEV_TOOLS[next].id)?.focus(); }}><Icon size={15} />{tool.label}</button>; })}</div>{DEV_TOOLS.map(tool => { const Panel = panels[tool.id]; return <section key={tool.id + reset} id={"tool-panel-" + tool.id} role="tabpanel" aria-labelledby={"tool-tab-" + tool.id} hidden={active !== tool.id}><h2 className="mb-5 text-sm text-stone-500">{tool.description}</h2><Panel /></section>; })}</div><p className="text-center text-xs text-stone-500">工具输入不会上传到服务器，也不会自动写入浏览器存储。</p></div>;
}
