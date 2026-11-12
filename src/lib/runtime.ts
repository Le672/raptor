// 运行时环境检测：判断是否运行在原生 app 壳（Capacitor / Electron）中
// 原生壳内没有同源的后端，API 和子域链接需指向线上站点。

const LIVE_ORIGIN = "https://www.yukino.bond";

function isCapacitorNative(): boolean {
  // Capacitor 注入全局对象；原生平台（android/ios）走 http://localhost 或 capacitor://
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

function isElectron(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("Electron");
}

/** 是否运行在 Electron 桌面壳内（file:// 加载，需用 HashRouter） */
export function isElectronApp(): boolean {
  return isElectron();
}

/** 是否运行在原生 app 壳内（Capacitor 原生 或 Electron） */
export function isNativeApp(): boolean {
  return isCapacitorNative() || isElectron();
}

/** API 基址：原生壳内指向线上站点，浏览器内保持相对路径 */
export function getApiBase(): string {
  return isNativeApp() ? `${LIVE_ORIGIN}/api` : "/api";
}

/** 线上站点根 URL，用于原生壳内需要跳转到子域时 */
export function getLiveOrigin(): string {
  return LIVE_ORIGIN;
}
