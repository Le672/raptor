import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SiteVisits, SiteVisitsProvider } from '../components/SiteVisits';
afterEach(() => {cleanup();vi.unstubAllGlobals();});
const total = {visits:12,startedAt:'2026-10-11T10:00:00Z',updatedAt:'2026-10-11T10:00:00Z',metric:'pageviews'};
it('shows a shared total and deduplicates StrictMode, while counting page changes and ignoring filters',async () => {
  const request = vi.fn().mockImplementation(async () => Response.json(total)); vi.stubGlobal('fetch',request);
  render(<StrictMode><MemoryRouter><SiteVisitsProvider><SiteVisits/><SiteVisits compact/><Link to='/?q=a'>筛选</Link><Link to='/notes'>笔记</Link></SiteVisitsProvider></MemoryRouter></StrictMode>);
  await waitFor(()=>expect(screen.getByTestId('site-visits-home')).toHaveTextContent('12'));
  const ids = request.mock.calls.map(([,options])=>JSON.parse(options.body).id); expect(new Set(ids).size).toBe(1);
  const count = request.mock.calls.length; fireEvent.click(screen.getByRole('link',{name:'筛选'})); expect(request).toHaveBeenCalledTimes(count);
  fireEvent.click(screen.getByRole('link',{name:'笔记'})); await waitFor(()=>expect(request.mock.calls.length).toBe(count+1));
  expect(JSON.parse(request.mock.calls.at(-1)[1].body).id).not.toBe(ids[0]); expect(screen.getByTestId('site-visits-footer')).toHaveTextContent('12');
});
it('retries the same visit identity after failure and never invents a zero total',async () => {
  const request = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json(total)); vi.stubGlobal('fetch',request);
  render(<MemoryRouter><SiteVisitsProvider><SiteVisits/></SiteVisitsProvider></MemoryRouter>);
  expect(await screen.findByRole('button',{name:'重试读取访问量'})).toBeVisible(); expect(screen.getByTestId('site-visits-home')).toHaveTextContent('—');
  const id = JSON.parse(request.mock.calls[0][1].body).id; fireEvent.click(screen.getByRole('button',{name:'重试读取访问量'}));
  await waitFor(()=>expect(screen.getByTestId('site-visits-home')).toHaveTextContent('12')); expect(JSON.parse(request.mock.calls[1][1].body).id).toBe(id);
});
