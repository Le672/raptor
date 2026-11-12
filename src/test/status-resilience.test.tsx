// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import Status from '../pages/Status';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({ api: { getStatus: vi.fn() } }));
afterEach(() => { localStorage.clear(); vi.clearAllMocks(); });
it('keeps the status page and dated last checks visible when the API is unavailable', async () => {
  localStorage.setItem('yukino-status:last-report', JSON.stringify({ checkedAt: new Date(Date.now() - 3600000).toISOString(), services: [
    { name: '主站登录接口', url: 'https://www.yukino.bond/api/auth/access', state: 'error', code: 503, latency: 12, checkedAt: new Date().toISOString(), detail: '额度用尽' },
  ] }));
  vi.mocked(api.getStatus).mockRejectedValue(new Error('检测服务暂不可用'));
  render(<MemoryRouter><Status /></MemoryRouter>);
  expect((await screen.findAllByRole('alert')).some(item => item.textContent?.includes('以下保留上次检测结果'))).toBe(true);
  expect(screen.getByRole('heading', { name: '服务状态' })).toBeInTheDocument();
  expect(screen.getByText('额度用尽')).toBeInTheDocument();
  expect(screen.getByText(/检测结果已过期/)).toBeInTheDocument();
});
