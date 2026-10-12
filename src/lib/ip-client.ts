import { getApiBase } from "./runtime";
import { normalizeIp, type IpReport, type VisitorNetwork } from "./ip";

export async function ipRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController(), abort = () => controller.abort();
  const timer = setTimeout(abort, body === undefined ? 14000 : 20000);
  signal?.addEventListener("abort", abort, { once: true }); if (signal?.aborted) abort();
  try {
    const response = await fetch(`${getApiBase()}/ip/${path}`, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), credentials: "same-origin", cache: "no-store", signal: controller.signal });
    let data: any; try { data = await response.json(); } catch { throw new Error("查询服务暂时不可用，请稍后重试。"); }
    if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "本次查询失败，请稍后重试。");
    return data as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("本次查询已取消或超时，请重试。");
    if (error instanceof TypeError) throw new Error("无法连接查询服务，请检查网络后重试。");
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
let visitorPending: Promise<VisitorNetwork> | null = null;
let visitorRecent: { value: VisitorNetwork; until: number } | null = null;
export async function loadVisitorNetwork(refresh = false): Promise<VisitorNetwork> {
  if (!refresh && visitorRecent && visitorRecent.until > Date.now()) return visitorRecent.value;
  if (visitorPending) return visitorPending;
  visitorPending = ipRequest<VisitorNetwork>("visitor").then(value => {
    if (value?.source !== "Cloudflare" || value.ip !== null && !normalizeIp(value.ip)) throw new Error("本次连接信息暂时不可用。");
    visitorRecent = { value, until: Date.now() + 60000 }; return value;
  });
  try { return await visitorPending; } finally { visitorPending = null; }
}
export const queryIp = (ip: string, signal?: AbortSignal) => ipRequest<IpReport>("check", { ip }, signal);
