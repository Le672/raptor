import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StatusNotice } from '../components/StatusNotice';
import { readStatusReport } from '../lib/status-client';

vi.mock('../lib/status-client', () => ({ readStatusReport: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('keeps a dismissed alert closed on refresh and shows a changed incident', async () => {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const report = (name: string) => ({
    checkedAt: new Date().toISOString(),
    services: [{
      name, url: 'https://www.yukino.bond/', state: 'error' as const, code: 503,
      latency: 10, checkedAt: new Date().toISOString(), detail: '暂时不可用',
    }],
  });
  vi.mocked(readStatusReport).mockResolvedValue(report('主站'));

  render(<StatusNotice />);
  fireEvent.click(await screen.findByRole('button', { name: '暂停故障滚动提示' }));
  expect(screen.getByRole('button', { name: '播放故障滚动提示' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '关闭故障滚动提示' }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  const refresh = async () => {
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  };
  await refresh();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  vi.mocked(readStatusReport).mockResolvedValue(report('新闻内容读取'));
  await refresh();
  expect(screen.getByRole('status', { name: /新闻内容读取/ })).toBeVisible();
  expect(screen.getByRole('button', { name: '暂停故障滚动提示' })).toBeVisible();
});
