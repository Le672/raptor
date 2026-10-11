// Both clients count received payload bytes. They never count scheduled or discarded bytes.
export function validateConfig(input) {
  const config = { url: '', kind: 'file', threads: 4, limitBytes: 0, rateBps: 0, durationMs: 0, cacheBust: true, ...input };
  let address;
  try { address = new URL(config.url); } catch { throw new Error('请填写完整的 HTTP / HTTPS 下载文件地址。'); }
  if (!['http:', 'https:'].includes(address.protocol) || address.username || address.password || config.url.length > 4096) throw new Error('仅支持不含账号密码的 HTTP / HTTPS 文件地址。');
  if (!Number.isInteger(config.threads) || config.threads < 1 || config.threads > 32) throw new Error('线程数须为 1–32。');
  for (const key of ['limitBytes', 'rateBps', 'durationMs']) if (!Number.isFinite(config[key]) || config[key] < 0 || config[key] > Number.MAX_SAFE_INTEGER) throw new Error('流量、带宽和持续时间必须是有效的非负数。');
  if (!Number.isSafeInteger(config.limitBytes)) throw new Error('流量配额必须是整数个字节。');
  if (config.kind === 'cloudflare' && (address.hostname !== 'speed.cloudflare.com' || address.pathname !== '/__down')) throw new Error('Cloudflare 模式需要 speed.cloudflare.com/__down 地址。');
  if (config.referrer) {
    let referrer;
    try { referrer = new URL(config.referrer); } catch { throw new Error('来源页须为完整 HTTP / HTTPS 地址。'); }
    if (!['http:', 'https:'].includes(referrer.protocol) || referrer.username || referrer.password || config.referrer.length > 4096) throw new Error('无效的下载来源页。');
    config.referrer = referrer.href;
  }
  config.url = address.href;
  return config;
}

export function requestSpec(config, bytes, sequence) {
  const url = new URL(config.url);
  const headers = config.referrer ? { Referer: config.referrer } : {};
  if (config.kind === 'cloudflare') url.searchParams.set('bytes', String(bytes));
  else headers.Range = `bytes=0-${bytes - 1}`;
  if (config.cacheBust) url.searchParams.set('_ys', `${Date.now()}-${sequence}`);
  return { url: url.href, headers };
}

export function formatBytes(bytes, digits = 2) {
  const value = Math.max(0, Number(bytes) || 0);
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = value ? Math.min(units.length - 1, Math.floor(Math.log10(value) / 3)) : 0;
  return `${(value / 1000 ** index).toFixed(index === 0 ? 0 : digits)} ${units[index]}`;
}
export function formatDuration(ms) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
export function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Aborted'));
    const stop = () => { clearTimeout(timer); signal?.removeEventListener('abort', stop); reject(new Error('Aborted')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, Math.max(0, ms));
    signal?.addEventListener('abort', stop, { once: true });
  });
}

export class DownloadRunner {
  constructor({ fetcher = globalThis.fetch.bind(globalThis), onUpdate = (state) => {}, now = () => performance.now() } = {}) {
    this.fetcher = fetcher; this.onUpdate = onUpdate; this.now = now;
    this.status = 'idle'; this.bytes = 0; this.elapsed = 0; this.history = []; this.workers = [];
    this.controllers = new Set(); this.generation = 0; this.peakBps = 0; this.samples = [];
    this.config = null; this.message = ''; this.reserved = 0;
  }
  snapshot() {
    const now = this.now();
    const elapsedMs = this.elapsed + (this.status === 'running' ? now - this.activeSince : 0);
    // One second sliding window; startup uses the actual sampled duration.
    const cutoff = now - 1000;
    this.samples = this.samples.filter(sample => sample.t >= cutoff);
    const windowMs = Math.min(1000, Math.max(250, now - (this.activeSince ?? now)));
    const rateBps = this.status === 'running' ? this.samples.reduce((sum, s) => sum + s.bytes, 0) * 1000 / windowMs : 0;
    this.peakBps = Math.max(this.peakBps, rateBps);
    return { id: this.id, startedAt: this.startedAt, status: this.status, bytes: this.bytes, elapsedMs,
      rateBps, averageBps: elapsedMs > 0 ? this.bytes * 1000 / elapsedMs : 0, peakBps: this.peakBps,
      message: this.message, config: this.config && { ...this.config }, history: [...this.history], workers: this.workers.map(w => ({ ...w })) };
  }
  emit(chart = false) {
    const state = this.snapshot();
    if (chart && this.status === 'running') { this.history.push({ t: state.elapsedMs / 1000, bps: state.rateBps }); this.history = this.history.slice(-180); state.history = [...this.history]; }
    this.onUpdate(state); return state;
  }
  start(input) {
    if (['running', 'paused'].includes(this.status)) throw new Error('请先结束当前任务。');
    this.config = validateConfig(input);
    this.id = globalThis.crypto.randomUUID(); this.startedAt = new Date().toISOString();
    this.bytes = 0; this.elapsed = 0; this.history = []; this.samples = []; this.peakBps = 0; this.sequence = 0; this.message = '';
    this.workers = Array.from({ length: this.config.threads }, (_, index) => ({ index, bytes: 0, requests: 0, status: '等待', error: '', failures: 0 }));
    this.launch(); return this.snapshot();
  }
  launch() {
    const generation = ++this.generation;
    this.status = 'running'; this.activeSince = this.now(); this.nextRequestAt = this.now(); this.reserved = 0; this.samples = [];
    this.timer = setInterval(() => {
      if (this.config.durationMs && this.snapshot().elapsedMs >= this.config.durationMs) this.finish('completed', '已达到设定持续时间。');
      else this.emit(true);
    }, 250);
    this.emit();
    this.task = Promise.all(this.workers.map(worker => this.worker(worker, generation))).then(() => {
      if (this.generation === generation && this.status === 'running') {
        const failed = this.workers.every(w => w.failures >= 3);
        this.finish(failed ? 'error' : 'completed', failed ? '所有下载线程均失败，请更换服务器或检查下载地址。' : '已达到设定流量。');
      }
    });
  }
  pause() { if (this.status === 'running') this.finish('paused', '已暂停，下载连接已关闭。'); }
  resume() { if (this.status === 'paused') { if (this.config.limitBytes && this.bytes >= this.config.limitBytes) this.finish('completed', '已达到设定流量。'); else this.launch(); } }
  stop() { if (['running', 'paused'].includes(this.status)) this.finish('stopped', '已手动结束。'); }
  finish(status, message) {
    if (this.status === 'running') this.elapsed += this.now() - this.activeSince;
    this.status = status; this.message = message; ++this.generation;
    clearInterval(this.timer);
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear(); this.reserved = 0;
    for (const w of this.workers) if (w.status !== '失败') w.status = status === 'paused' ? '暂停' : '结束';
    this.emit();
  }
  updateLimits(limits) {
    if (!this.config) return;
    this.config = validateConfig({ ...this.config, ...limits });
    this.nextRequestAt = this.now();
    if (this.config.limitBytes && this.bytes >= this.config.limitBytes && ['running', 'paused'].includes(this.status)) this.finish('completed', '已达到设定流量。');
    else this.emit();
  }
  async worker(worker, generation) {
    const alive = () => this.generation === generation && this.status === 'running';
    while (alive()) {
      // Rate control is applied BEFORE issuing downloads, across all threads.
      const chunkSize = this.config.rateBps ? Math.max(1024, Math.min(2_000_000, Math.floor(this.config.rateBps / this.config.threads / 4))) : 2_000_000;
      const available = this.config.limitBytes ? Math.max(0, this.config.limitBytes - this.bytes - this.reserved) : chunkSize;
      if (!available) {
        if (this.bytes >= this.config.limitBytes) return;
        await wait(20); continue;
      }
      const allocated = Math.min(chunkSize, available);
      this.reserved += allocated;
      const controller = new AbortController(); this.controllers.add(controller);
      let received = 0, reader, timeout;
      const armTimeout = () => { clearTimeout(timeout); timeout = setTimeout(() => controller.abort(), 15000); };
      try {
        if (this.config.rateBps) {
          const due = Math.max(this.now(), this.nextRequestAt);
          this.nextRequestAt = due + allocated * 1000 / this.config.rateBps;
          worker.status = '限速等待';
          await wait(due - this.now(), controller.signal);
        }
        if (!alive()) return;
        armTimeout(); worker.status = '连接中';
        const spec = requestSpec(this.config, allocated, this.sequence++);
        const response = await this.fetcher(spec.url, { signal: controller.signal, headers: spec.headers, cache: 'no-store', credentials: 'omit', redirect: 'follow' });
        if (!response.ok) throw new Error(`服务器返回 HTTP ${response.status}`);
        if (/text\/html|application\/json|text\/xml/.test(response.headers.get('content-type') || '')) throw new Error('地址返回网页或接口数据，请填写真实下载文件地址');
        if (!response.body) throw new Error('服务器没有返回可读取的数据流');
        worker.status = '下载中'; worker.requests++;
        reader = response.body.getReader();
        while (alive()) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!alive()) break;
          const length = value.byteLength;
          received += length; this.bytes += length; worker.bytes += length;
          this.samples.push({ t: this.now(), bytes: length }); armTimeout();
          // Count the entire received chunk even if a server ignores Range; never silently clip totals.
          if (this.config.limitBytes && this.bytes >= this.config.limitBytes) { this.finish('completed', '已达到设定流量。'); break; }
          if (received >= allocated) break;
        }
        if (!received && alive()) throw new Error('服务器返回空文件');
        worker.failures = 0; worker.error = '';
        if (response.status !== 206 && this.config.kind !== 'cloudflare' && (this.config.rateBps || this.config.limitBytes)) this.message = '此服务器不支持 Range，停止时可能有额外预读流量；建议选择 Cloudflare 或支持 Range 的文件服务器。';
      } catch (error) {
        if (!alive()) return;
        worker.failures++; worker.status = '重试';
        worker.error = controller.signal.aborted ? '连接或读取超时' : error instanceof TypeError ? '连接失败：请检查 CORS、HTTPS、服务器和网络；也可使用 Windows 版' : String(error?.message || error);
        this.message = `线程 ${worker.index + 1}：${worker.error}`;
        if (worker.failures >= 3) { worker.status = '失败'; this.emit(); return; }
        this.emit(); await wait(worker.failures * 500);
      } finally {
        clearTimeout(timeout); controller.abort(); this.controllers.delete(controller);
        if (this.generation === generation) this.reserved = Math.max(0, this.reserved - allocated);
        try { await reader?.cancel(); } catch { /* aborted stream */ }
      }
    }
  }
}
