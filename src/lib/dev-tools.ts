export const DEV_TOOLS = [
  { id: "base64", label: "Base64", description: "UTF-8 文本编码与解码" },
  { id: "json", label: "JSON", description: "校验、格式化与压缩 JSON" },
  { id: "url", label: "URL", description: "URL 参数编码与解码" },
  { id: "timestamp", label: "时间戳", description: "秒、毫秒与日期转换" },
  { id: "hash", label: "哈希", description: "SHA-256、SHA-512 与 MD5 校验" },
  { id: "case", label: "大小写", description: "Unicode 文本与命名格式转换" },
  { id: "color", label: "颜色", description: "HEX、RGB 与 HSL 互转" },
] as const;
export type ToolId = typeof DEV_TOOLS[number]["id"];
export function base64(value: string, decode: boolean) {
  if (decode) return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(value.replace(/\s/g, "")), character => character.charCodeAt(0)));
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
export type TimestampUnit = "auto" | "seconds" | "milliseconds";
export function timestampDate(input: string, unit: TimestampUnit = "auto") {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(input.trim())) throw new Error("请输入有效的数字时间戳");
  const value = Number(input), milliseconds = value * (unit === "seconds" || unit === "auto" && Math.abs(value) < 1e11 ? 1000 : 1);
  const date = new Date(milliseconds);
  if (!Number.isFinite(milliseconds) || !Number.isFinite(date.getTime())) throw new Error("时间戳超出有效日期范围");
  return date;
}
export function textCases(input: string) {
  const words = input.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2").match(/[\p{L}\p{N}]+/gu)?.map(word => word.toLowerCase()) ?? [];
  const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  return { upper: input.toUpperCase(), lower: input.toLowerCase(), title: input.replace(/[\p{L}\p{N}]+/gu, word => capital(word.toLowerCase())), sentence: input.replace(/\S[\s\S]*/, text => capital(text.toLowerCase())), camel: words.map((word, index) => index ? capital(word) : word).join(""), snake: words.join("_"), kebab: words.join("-") };
}
export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };
export const colorByte = (value: number) => Number.isFinite(value) ? Math.round(Math.max(0, Math.min(255, value))) : 0;
export function hexRgb(input: string): Rgb | null {
  let hex = input.trim().replace(/^#/, "");
  if (/^[a-f\d]{3}$/i.test(hex)) hex = [...hex].map(value => value + value).join("");
  if (!/^[a-f\d]{6}$/i.test(hex)) return null;
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
}
export const rgbHex = (rgb: Rgb) => `#${[rgb.r, rgb.g, rgb.b].map(value => colorByte(value).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
export function rgbHsl(rgb: Rgb): Hsl {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(value => colorByte(value) / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, l = (max + min) / 2;
  let h = 0;
  if (delta) h = (max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60;
  return { h: Math.round(h), s: Math.round(delta ? delta / (1 - Math.abs(2 * l - 1)) * 100 : 0), l: Math.round(l * 100) };
}
export function hslRgb(hsl: Hsl): Rgb {
  const h = ((hsl.h % 360) + 360) % 360 / 60, s = Math.max(0, Math.min(100, hsl.s)) / 100, l = Math.max(0, Math.min(100, hsl.l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h % 2 - 1)), m = l - c / 2;
  const channels = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  const [r, g, b] = channels.map(value => colorByte((value + m) * 255)); return { r, g, b };
}
export function md5(value: string) {
  const input = new TextEncoder().encode(value), length = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(length); bytes.set(input); bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer); view.setUint32(length - 8, input.length * 8, true); view.setUint32(length - 4, Math.floor(input.length / 0x20000000), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const shifts = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  for (let offset = 0; offset < length; offset += 64) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let index = 0; index < 64; index++) {
      const group = Math.floor(index / 16), shift = shifts[group * 4 + index % 4];
      const f = group === 0 ? (b & c) | (~b & d) : group === 1 ? (d & b) | (~d & c) : group === 2 ? b ^ c ^ d : c ^ (b | ~d);
      const word = group === 0 ? index : group === 1 ? (5 * index + 1) % 16 : group === 2 ? (3 * index + 5) % 16 : (7 * index) % 16;
      const sum = (a + f + Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) + view.getUint32(offset + word * 4, true)) >>> 0;
      const oldD = d; d = c; c = b; b = (b + ((sum << shift) | (sum >>> (32 - shift)))) >>> 0; a = oldD;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  return [a0, b0, c0, d0].map(word => [0, 8, 16, 24].map(shift => ((word >>> shift) & 255).toString(16).padStart(2, "0")).join("")).join("");
}
