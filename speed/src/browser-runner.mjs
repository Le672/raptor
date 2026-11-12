import { DownloadRunner } from './engine.mjs';

// Fetching and pacing run independently of React and background UI timers.
export class BrowserRunner {
  constructor({ onUpdate = (state) => {}, makeWorker = () => new Worker(new URL('./download.worker.mjs', import.meta.url), { type: 'module' }) } = {}) {
    this.onUpdate = onUpdate; this.pending = new Map(); this.sequence = 0; this.revision = -1; this.environment = {}; this.latest = null;
    try {
      this.worker = makeWorker();
      this.worker.onmessage = ({ data }) => {
        if (data.state && data.revision >= this.revision) { this.revision = data.revision; this.latest = data.state; this.onUpdate(data.state); }
        if (data.type === 'reply') { const request = this.pending.get(data.requestId); if (request) { this.pending.delete(data.requestId); data.error ? request.reject(new Error(data.error)) : request.resolve(this.latest || data.state); } }
      };
      this.worker.onerror = event => { event.preventDefault?.(); this.useFallback(); };
    } catch { this.useFallback(); }
  }
  useFallback() {
    if (this.closed || this.fallback) return;
    this.worker?.terminate(); this.worker = null;
    this.fallback = new DownloadRunner({ onUpdate: state => { this.latest = state; this.onUpdate(state); } });
    this.fallback.setEnvironment(this.environment);
    if (this.latest?.config && ['running', 'paused', 'recovering'].includes(this.latest.status)) this.fallback.restore(this.latest);
    const pending = [...this.pending.values()]; this.pending.clear();
    for (const request of pending) this.call(request.command, request.input).then(request.resolve, request.reject);
  }
  call(command, input) {
    if (this.closed) return Promise.reject(new Error('下载器已关闭。'));
    if (this.fallback) {
      const method = command === 'environment' ? 'setEnvironment' : command === 'limits' ? 'updateLimits' : command;
      try { return Promise.resolve(this.fallback[method](input)); } catch (error) { return Promise.reject(error); }
    }
    return new Promise((resolve, reject) => {
      const requestId = ++this.sequence; this.pending.set(requestId, { resolve, reject, command, input });
      this.worker.postMessage({ requestId, command, input });
    });
  }
  start(input) { return this.call('start', input); }
  restore(input) { return this.call('restore', input); }
  pause() { return this.call('pause'); }
  resume() { return this.call('resume'); }
  stop() { return this.call('stop'); }
  updateLimits(input) { return this.call('limits', input); }
  setEnvironment(input) { this.environment = { ...this.environment, ...input }; return this.call('environment', input); }
  snapshot() { return this.fallback?.snapshot() || this.latest; }
  dispose() {
    this.closed = true; this.worker?.terminate();
    // Preserve the last checkpoint when the view unloads; explicit Stop ends a task.
    if (this.fallback) { this.fallback.onUpdate = () => {}; this.fallback.pause(); }
    for (const request of this.pending.values()) request.reject(new Error('页面已关闭。'));
    this.pending.clear();
  }
}
