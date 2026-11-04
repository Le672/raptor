// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://status.yukino.bond/"}
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AppShell } from '../components/AppShell';
import Status from '../pages/Status';
import { api } from '../lib/api';

const optional = vi.hoisted(() => ({ visits: vi.fn(), recovery: vi.fn() }));
vi.mock('../components/TopNav', () => ({ TopNav: () => null }));
vi.mock('../components/PageUtilities', () => ({ PageUtilities: () => null }));
vi.mock('../components/Footer', () => ({ Footer: ({ liveInfo }: { liveInfo: boolean }) => <p>{liveInfo ? 'live extras' : 'independent footer'}</p> }));
vi.mock('../components/SiteVisits', () => ({ SiteVisitsProvider: optional.visits }));
vi.mock('../components/LegacySpeedRecovery', () => ({ LegacySpeedRecovery: optional.recovery }));
vi.mock('../lib/api', () => ({ api: { getMe: vi.fn(), getStatus: vi.fn() } }));
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

it('renders live status without mounting portal login, visit counters, or legacy statistics recovery', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.mocked(api.getMe).mockRejectedValue(new Error('portal quota exhausted'));
  vi.mocked(api.getStatus).mockResolvedValue({ services: [], checkedAt: new Date().toISOString() });
  render(<MemoryRouter initialEntries={['/status']}><Routes><Route element={<AppShell />}><Route path='/status' element={<Status />} /></Route></Routes></MemoryRouter>);
  expect(await screen.findByText(/实际检测时间/)).toBeInTheDocument();
  expect(screen.getByText('independent footer')).toBeInTheDocument();
  expect(api.getMe).not.toHaveBeenCalled();
  expect(optional.visits).not.toHaveBeenCalled();
  expect(optional.recovery).not.toHaveBeenCalled();
});
