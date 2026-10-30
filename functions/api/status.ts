import { STATUS_TARGETS, httpState, type ServiceCheck, type StatusReport } from "../../src/lib/status";
export async function checkService(target: typeof STATUS_TARGETS[number]): Promise<ServiceCheck> {
  const start = Date.now(), checkedAt = new Date(start).toISOString(), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    let response = await fetch(target.url, { method: target.jsonKeys ? "GET" : "HEAD", redirect: "follow", signal: controller.signal });
    if (response.status === 405) { response = await fetch(target.url, { signal: controller.signal, redirect: "follow" }); await response.body?.cancel(); }
    if (target.jsonKeys) {
      if (response.status !== (target.expectedStatus ?? 200)) {
        await response.body?.cancel();
        return { name: target.name, url: target.url, state: response.status === 403 || response.status === 429 ? 'unknown' : 'error',
          code: response.status, latency: Date.now() - start, checkedAt, detail: `接口响应异常（HTTP ${response.status}），业务未正常执行` };
      }
      let value: Record<string, unknown> | null = null;
      if (response.headers.get('Content-Type')?.includes('application/json')) {
        try { value = await response.json(); } catch { /* Invalid JSON is a failed API, including HTTP 200 fallbacks. */ }
      } else await response.body?.cancel();
      const valid = value && target.jsonKeys.every(key => Object.prototype.hasOwnProperty.call(value, key));
      return { name: target.name, url: target.url, state: valid ? 'reachable' : 'error', code: response.status,
        latency: Date.now() - start, checkedAt, detail: valid ? '接口返回了有效数据' : '接口返回了网页或无效数据，业务未正常执行' };
    }
    await response.body?.cancel();
    const state = httpState(response.status);
    return { ...target, state, code: response.status, latency: Date.now() - start, checkedAt, detail: state === "reachable" ? "HTTPS 页面可访问" : state === "unknown" ? "服务限制了本次检测" : `返回 HTTP ${response.status}` };
  } catch { return { ...target, state: "unknown", code: null, latency: Date.now() - start, checkedAt, detail: controller.signal.aborted ? "检测超时，尚不能确认服务状态" : "本次连接失败，尚不能确认服务状态" }; }
  finally { clearTimeout(timer); }
}
let recent: { expires: number; report: StatusReport } | null = null;
let pending: Promise<StatusReport> | null = null;
async function inspect(): Promise<StatusReport> {
  const services: ServiceCheck[] = [];
  for (let index = 0; index < STATUS_TARGETS.length; index += 18) services.push(...await Promise.all(STATUS_TARGETS.slice(index, index + 18).map(checkService)));
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
