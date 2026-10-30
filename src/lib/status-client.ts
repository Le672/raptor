import type { StatusReport } from './status';

// Public status must not depend on the current portal alias or its quota, and
// never needs account cookies or bearer tokens from the main site's API client.
export async function readStatusReport(): Promise<StatusReport> {
  const response = await fetch('https://status.yukino.bond/api/status', {
    headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) throw new Error('状态检测服务暂时不可用');
  const value = await response.json() as StatusReport;
  if (!Array.isArray(value.services) || !Number.isFinite(Date.parse(value.checkedAt))) throw new Error('状态检测结果格式错误');
  return value;
}
