import { STATUS_TARGETS, httpState, type ServiceCheck, type StatusReport } from "../../src/lib/status";
class ProbeFailure extends Error { constructor(message: string, public code: number | null = null, public uncertain = false) { super(message); } }
async function businessProbe(target: typeof STATUS_TARGETS[number], signal: AbortSignal): Promise<string> {
  const origin = new URL(target.url).origin;
  async function read(url: string): Promise<any> {
    if (new URL(url).origin !== origin) throw new ProbeFailure('检测地址不在预期服务内');
    const response = await fetch(url, { signal, redirect: 'error', headers: { Accept: 'application/json' } });
    if (!response.ok) { await response.body?.cancel(); throw new ProbeFailure(`业务请求返回 HTTP ${response.status}`, response.status, response.status === 403 || response.status === 429); }
    if (!response.headers.get('content-type')?.includes('application/json')) { await response.body?.cancel(); throw new ProbeFailure('业务接口返回了网页或其他无效内容', response.status); }
    let value: any; try { value = await response.json(); } catch { throw new ProbeFailure('业务接口返回无效 JSON', response.status); }
    if (!value || typeof value !== 'object' || value.error) throw new ProbeFailure('业务接口未返回有效内容', response.status);
    if (value.meta?.stale || value.stale) throw new ProbeFailure('仅有旧缓存，无法确认当前服务', response.status, true);
    return value;
  }
  const first = await read(target.url);
  if (target.probe === 'weather') {
    if (!Number.isFinite(first.current?.temperature) || !Number.isFinite(Date.parse(first.current?.time)) || !Array.isArray(first.daily) || !first.daily.length) throw new ProbeFailure('天气温度或预报不完整', 200);
    return `已读取当前温度及 ${first.daily.length} 日预报（${first.provider || '未知来源'}）${first.notice ? '，自动切换至备用来源' : ''}`;
  }
  if (target.probe === 'novel-detail' || target.probe === 'novel-catalog') {
    const sampleId = first.data?.items?.find((item: any) => /^[1-9]\d{0,8}$/.test(String(item.id)))?.id;
    if (target.probe === 'novel-catalog' && !sampleId) throw new ProbeFailure('书目没有返回可检查的作品', 200);
    const base = target.probe === 'novel-catalog' ? `${origin}/api/book/${sampleId}` : target.url;
    const detail = target.probe === 'novel-catalog' ? await read(base) : first;
    const book = detail.data, volume = book?.volumes?.[0];
    if (!book?.title || !volume || !/^[\w-]{1,100}$/.test(String(volume.id))) throw new ProbeFailure('书籍详情或分卷目录为空', 200);
    const result = await read(`${base}/volume/${encodeURIComponent(volume.id)}`);
    if (!Array.isArray(result.data?.chapters) || !result.data.chapters.length) throw new ProbeFailure('分卷未返回章节目录', 200);
    return `详情及章节目录可读取（${result.data.chapters.length} 章）；正文需登录，未检测`;
  }
  if (target.probe === 'jm-detail') {
    const book = first.items?.find((item: any) => /^\d+$/.test(String(item.id)));
    if (!book) throw new ProbeFailure('搜索未返回有效漫画', 200);
    const detail = await read(`${origin}/v1/books/${book.id}`);
    const chapter = detail.chapters?.find((item: any) => /^\d+$/.test(String(item.id)));
    if (!detail.title || !chapter) throw new ProbeFailure('漫画详情或章节列表为空', 200);
    const pages = await read(`${origin}/v1/chapters/${chapter.id}`);
    if (!Array.isArray(pages.images) || !pages.images.length) throw new ProbeFailure('章节没有返回图片列表', 200);
    return `搜索、详情和章节图片列表可读取（${pages.images.length} 页）；未检测图片下载`;
  }
  if (target.probe === 'media-detail') {
    const item = Array.isArray(first.data) ? first.data.find((x: any) => /^[\w-]+$/.test(String(x.id)) && x.episodeCount > 0) : null;
    if (!item) throw new ProbeFailure('目录没有返回可检查的节目', 200);
    const kind = origin.startsWith('https://cinema.') ? 'title' : 'anime';
    const detail = await read(`${origin}/api/${kind}/${item.id}`);
    if (!Array.isArray(detail.data?.lines) || !detail.data.lines.some((line: any) => Array.isArray(line.episodes) && line.episodes.length)) throw new ProbeFailure('详情没有返回播放线路和集数', 200);
    return '目录、详情及剧集列表可读取；播放需要登录，未检测';
  }
  if (target.probe === 'pixiv-detail') {
    const item = first.items?.find((x: any) => /^\d+$/.test(String(x.id)));
    if (!item) throw new ProbeFailure('排行榜没有返回作品', 200);
    const detail = await read(`${origin}/api/artworks/${item.id}`);
    if (!Array.isArray(detail.images) || !detail.images.length || !detail.userId) throw new ProbeFailure('作品详情没有返回图片或画师', 200);
    return '排行榜和作品详情可读取；未检测原图下载';
  }
  if (target.probe === 'news') {
    if (!Array.isArray(first.items) || !first.items.length) throw new ProbeFailure('新闻没有返回有效条目', 200);
    return `已读取 ${first.items.length} 条新闻；不保证每个订阅源均可用`;
  }
  if (target.probe === 'f1-season') {
    if (!Array.isArray(first.races) || !first.races.length) throw new ProbeFailure('赛历没有返回比赛', 200);
    if (Array.isArray(first.errors) && first.errors.length) throw new ProbeFailure('赛历数据不完整，部分来源不可用', 200, true);
    return `已读取 ${first.races.length} 场比赛；直播和投票未检测`;
  }
  throw new ProbeFailure('未知业务检查');
}
export async function checkService(target: typeof STATUS_TARGETS[number]): Promise<ServiceCheck> {
  const start = Date.now(), checkedAt = new Date(start).toISOString(), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), target.timeoutMs ?? (target.probe ? 20000 : 4500));
  try {
    if (target.probe) {
      const detail = await businessProbe(target, controller.signal);
      return { name: target.name, url: target.url, state: 'reachable', code: 200, latency: Date.now() - start, checkedAt, detail };
    }
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
  } catch (error) { return { ...target, state: error instanceof ProbeFailure && !error.uncertain ? 'error' : 'unknown', code: error instanceof ProbeFailure ? error.code : null, latency: Date.now() - start, checkedAt, detail: error instanceof ProbeFailure ? error.message : controller.signal.aborted ? "检测超时，尚不能确认服务状态" : "本次连接失败，尚不能确认服务状态" }; }
  finally { clearTimeout(timer); }
}
let recent: { expires: number; report: StatusReport } | null = null;
let pending: Promise<StatusReport> | null = null;
async function inspect(): Promise<StatusReport> {
  const services = await Promise.all(STATUS_TARGETS.map(checkService));
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
