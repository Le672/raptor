import { STATUS_TARGETS, httpState, type ServiceCheck, type StatusReport } from "../../src/lib/status";
class ProbeFailure extends Error { constructor(message: string, public code: number | null = null, public uncertain = false) { super(message); } }
async function businessProbe(target: typeof STATUS_TARGETS[number], signal: AbortSignal): Promise<string> {
  const origin = new URL(target.url).origin;
  async function read(url: string, allowStale = false): Promise<any> {
    if (new URL(url).origin !== origin) throw new ProbeFailure('检测地址不在预期服务内');
    const response = await fetch(url, { signal, redirect: 'error', headers: { Accept: 'application/json' } });
    if (!response.ok) { await response.body?.cancel(); throw new ProbeFailure(`业务请求返回 HTTP ${response.status}`, response.status, response.status === 403 || response.status === 429); }
    if (!response.headers.get('content-type')?.includes('application/json')) { await response.body?.cancel(); throw new ProbeFailure('业务接口返回了网页或其他无效内容', response.status); }
    let value: any; try { value = await response.json(); } catch { throw new ProbeFailure('业务接口返回无效 JSON', response.status); }
    if (!value || typeof value !== 'object' || value.error) throw new ProbeFailure('业务接口未返回有效内容', response.status);
    if (!allowStale && (value.meta?.stale || value.stale)) throw new ProbeFailure('仅有旧缓存，无法确认当前服务', response.status, true);
    return value;
  }
  const reader = target.probe === 'reader-catalog' || target.probe === 'reader-source';
  const first = await read(target.url, reader);
  if (target.probe === 'weather') {
    if (!Number.isFinite(first.current?.temperature) || !Number.isFinite(Date.parse(first.current?.time)) || !Array.isArray(first.daily) || !first.daily.length) throw new ProbeFailure('天气温度或预报不完整', 200);
    return `已读取当前温度及 ${first.daily.length} 日预报（${first.provider || '未知来源'}）${first.notice ? '，自动切换至备用来源' : ''}`;
  }
  if (reader) {
    if (!Array.isArray(first.data?.items)) throw new ProbeFailure('书目接口没有返回有效列表', 200);
    const items = first.data.items;
    const cached = first.meta?.stale || first.stale;
    if (target.probe === 'reader-catalog') {
      if (!items.length) throw new ProbeFailure('书目列表暂未返回作品', 200, Boolean(cached));
      return `书目可浏览（本页 ${items.length} 本）${cached ? '，当前列表含缓存数据' : ''}`;
    }
    const ids = [...new Set<string>(items.map((item: any) => String(item?.id)).filter((id: string) => /^(?:[a-z]+-)?\d{1,12}$/.test(id)))].slice(0, 2);
    if (!ids.length) throw new ProbeFailure('书源暂未提供可检查的书目', 200, true);
    for (const id of ids) {
      try {
        const base = `${origin}/api/book/${id}`;
        const { data: book } = await read(base);
        const volume = Array.isArray(book?.volumes) && book.volumes.find((item: any) => /^[\w-]{1,100}$/.test(String(item?.id ?? '')));
        if (!book?.title || !volume) continue;
        const { data } = await read(`${base}/volume/${encodeURIComponent(volume.id)}`);
        if (Array.isArray(data?.chapters) && data.chapters.length) {
          return `详情及章节目录可读取（${data.chapters.length} 章）${cached ? '，样本来自缓存书目' : ''}；正文需登录，未检测`;
        }
      } catch (error) {
        if (!(error instanceof ProbeFailure) || (!error.uncertain && ![404, 410].includes(error.code))) throw error;
        if (ids.at(-1) === id) throw new ProbeFailure(`本次样本未能确认章节目录：${error.message}`, error.code, true);
      }
    }
    throw new ProbeFailure('本次书目样本没有可确认的分卷或章节', 200, true);
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
  const { name, url, statusOnly } = target;
  const result = (state: ServiceCheck['state'], code: number | null, detail: string): ServiceCheck =>
    ({ name, url, statusOnly, state, code, latency: Date.now() - start, checkedAt, detail });
  try {
    if (target.probe) {
      const detail = await businessProbe(target, controller.signal);
      return result('reachable', 200, detail);
    }
    const method = target.jsonKeys || target.contentType ? "GET" : "HEAD";
    const options = { redirect: "follow" as const, signal: controller.signal };
    let response = await fetch(url, { ...options, method });
    if (method === "HEAD" && [404, 405, 501].includes(response.status)) {
      await response.body?.cancel();
      response = await fetch(url, options);
    }
    if (target.jsonKeys) {
      if (response.status !== (target.expectedStatus ?? 200)) {
        await response.body?.cancel();
        return result(httpState(response.status) === 'unknown' ? 'unknown' : 'error', response.status, `接口响应异常（HTTP ${response.status}），业务未正常执行`);
      }
      let value: Record<string, unknown> | null = null;
      if (response.headers.get('Content-Type')?.includes('application/json')) {
        try { value = await response.json(); } catch { /* Invalid JSON is a failed API, including HTTP 200 fallbacks. */ }
      } else await response.body?.cancel();
      const valid = value && target.jsonKeys.every(key => Object.prototype.hasOwnProperty.call(value, key));
      return result(valid ? 'reachable' : 'error', response.status, valid ? '接口返回了有效数据' : '接口返回了网页或无效数据，业务未正常执行');
    }
    await response.body?.cancel();
    const state = httpState(response.status);
    if (state === "reachable" && target.contentType && !response.headers.get('content-type')?.includes(target.contentType)) {
      return result('error', response.status, '返回的内容类型与预期不符');
    }
    return result(state, response.status, state === "reachable" ? "HTTPS 内容可访问" : state === "unknown" ? "服务限制了本次检测" : `返回 HTTP ${response.status}`);
  } catch (error) {
    return result(error instanceof ProbeFailure && !error.uncertain ? 'error' : 'unknown',
      error instanceof ProbeFailure ? error.code : null,
      error instanceof ProbeFailure ? error.message : controller.signal.aborted ? "检测超时，尚不能确认服务状态" : "本次连接失败，尚不能确认服务状态");
  }
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
