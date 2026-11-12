import { DownloadRunner, validateConfig } from './engine.mjs';

let revision = 0, releaseOwnership;
const publish = state => {
  postMessage({ type: 'state', state, revision: ++revision });
  if (!['running', 'paused', 'recovering'].includes(state.status)) { releaseOwnership?.(); releaseOwnership = undefined; }
};
const runner = new DownloadRunner({ onUpdate: publish });

async function restoreOwned(saved) {
  if (['running', 'recovering'].includes(runner.status) || (runner.status === 'paused' && releaseOwnership)) throw new Error('请先结束当前任务。');
  if (runner.status === 'paused') runner.status = 'idle';
  if (!navigator.locks) return runner.restore(saved);
  return new Promise((resolve, reject) => {
    navigator.locks.request('yukino-speed-task:' + saved.id, { ifAvailable: true }, async lock => {
      if (!lock) {
        const state = runner.restore(saved, { autoResume: false });
        runner.message = '此任务已在另一个标签页运行，关闭原标签页后可继续。';
        resolve(runner.emit()); return;
      }
      const held = new Promise(done => { releaseOwnership = done; });
      try { resolve(runner.restore(saved)); } catch (error) { releaseOwnership?.(); releaseOwnership = undefined; reject(error); }
      await held;
    }).catch(reject);
  });
}

let queue = Promise.resolve();
onmessage = ({ data: { requestId, command, input } }) => {
  queue = queue.then(async () => {
    try {
      let state;
      if (command === 'start') state = await restoreOwned({ id: crypto.randomUUID(), startedAt: new Date().toISOString(), bytes: 0, elapsedMs: 0, history: [], status: 'running', config: validateConfig(input) });
      else if (command === 'restore') state = await restoreOwned(input);
      else if (command === 'environment') state = runner.setEnvironment(input);
      else if (command === 'limits') state = runner.updateLimits(input);
      else if (command === 'resume' && !releaseOwnership && navigator.locks && runner.id) state = await restoreOwned({ ...runner.snapshot(), status: 'running' });
      else if (['pause', 'resume', 'stop', 'snapshot'].includes(command)) state = runner[command]();
      else throw new Error('未知下载命令。');
      postMessage({ type: 'reply', requestId, state, revision, error: null });
    } catch (error) { postMessage({ type: 'reply', requestId, error: error.message }); }
  });
};
