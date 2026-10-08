import { STATUS_TARGETS, httpState, type ServiceCheck, type StatusReport } from "../../src/lib/status";
export async function checkService(target: typeof STATUS_TARGETS[number]): Promise<ServiceCheck> {
  const start = Date.now(), checkedAt = new Date(start).toISOString(), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    let response = await fetch(target.url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (response.status === 405) { response = await fetch(target.url, { signal: controller.signal, redirect: "follow" }); await response.body?.cancel(); }
    const state = httpState(response.status);
    return { ...target, state, code: response.status, latency: Date.now() - start, checkedAt, detail: state === "reachable" ? "HTTPS 页面可访问" : state === "unknown" ? "服务限制了本次检测" : `返回 HTTP ${response.status}` };
  } catch { return { ...target, state: "unknown", code: null, latency: Date.now() - start, checkedAt, detail: controller.signal.aborted ? "检测超时，尚不能确认服务状态" : "本次连接失败，尚不能确认服务状态" }; }
  finally { clearTimeout(timer); }
}
let recent: { expires: number; report: StatusReport } | null = null;
let pending: Promise<StatusReport> | null = null;
async function inspect(): Promise<StatusReport> {
  const services: ServiceCheck[] = [];
  for (let index = 0; index < STATUS_TARGETS.length; index += 10) services.push(...await Promise.all(STATUS_TARGETS.slice(index, index + 10).map(checkService)));
  return { services, checkedAt: new Date().toISOString() };
}
export async function onRequestGet() {
  if (!recent || recent.expires <= Date.now()) {
    pending ??= inspect();
    try { const report = await pending; recent = { expires: Date.now() + 60000, report }; }
    finally { pending = null; }
  }
  return new Response(JSON.stringify(recent.report), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60", "Access-Control-Allow-Origin": "*" } });
}
