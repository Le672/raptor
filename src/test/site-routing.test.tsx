// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://ip.yukino.bond/ip"}
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { TopNav } from '../components/TopNav';
import { Footer } from '../components/Footer';
import { SiteLink } from '../components/SiteLink';
import { canonicalPageUrl, siteHref } from '../lib/site-routing';
import { onRequest as routePage } from '../../functions/_middleware';
afterEach(cleanup);
const destinations = [
  ['首页','https://www.yukino.bond/'], ['笔记','https://www.yukino.bond/notes'],
  ['工具','https://dev.yukino.bond/dev'], ['导航','https://links.yukino.bond/links'],
  ['游戏','https://games.yukino.bond/games'], ['新闻','https://news.yukino.bond/news'],
  ['姬漫','https://jm.yukino.bond/'],
  ['Pixiv','https://pixiv.yukino.bond/'],
  ['轻小说','https://novel.yukino.bond/'],
  ['番剧','https://comic.yukino.bond/'],
  ['影视','https://cinema.yukino.bond/'],
  ['专注','https://focus.yukino.bond/focus'], ['余票','https://cr.yukino.bond/cr'],
  ['F1','https://f1.yukino.bond/f1'], ['测速','https://speed.yukino.bond/'],
  ['IP','/ip'], ['资源','https://box.yukino.bond/box'], ['博客','https://blog.yukino.bond/blog'],
  ['设备','https://uses.yukino.bond/uses'], ['实验','https://lab.yukino.bond/lab'],
  ['友链','https://friends.yukino.bond/friends'], ['订阅','https://rss.yukino.bond/rss'],
  ['状态','https://status.yukino.bond/status'], ['日志','https://changelog.yukino.bond/changelog'],
  ['关于','https://about.yukino.bond/about-me'],
];
describe('canonical site navigation', () => {
  it('links every header entry, account and footer to its real owner from the IP site', () => {
    render(<MemoryRouter initialEntries={['/ip']}><TopNav/><Footer/></MemoryRouter>);
    const nav = within(screen.getByRole('navigation',{name:'主导航'}));
    for (const [name, href] of destinations) expect(nav.getByRole('link',{name})).toHaveAttribute('href',href);
    expect(nav.getByRole('link',{name:'IP'})).toHaveAttribute('aria-current','page');
    expect(nav.getByRole('link',{name:'首页'})).not.toHaveAttribute('aria-current');
    expect(nav.getByRole('link',{name:'姬漫'})).toHaveAttribute('target','_blank');
    expect(screen.getByRole('link',{name:/登录/})).toHaveAttribute('href','https://www.yukino.bond/login');
    const footer = within(screen.getByRole('navigation',{name:'页脚导航'}));
    expect(footer.getByRole('link',{name:'订阅'})).toHaveAttribute('href','https://rss.yukino.bond/rss');
    for (const link of screen.getAllByRole('link',{name:'Yukino.'})) expect(link).toHaveAttribute('href','https://www.yukino.bond/');
  });
  it('preserves feature selection, article queries and fragments on native cross-origin anchors', () => {
    render(<MemoryRouter initialEntries={['/ip']}><SiteLink to='/games?game=snake#scores'>游戏</SiteLink><SiteLink to='/blog?post=a%2Fb#section-4'>文章</SiteLink></MemoryRouter>);
    expect(screen.getByRole('link',{name:'游戏'})).toHaveAttribute('href','https://games.yukino.bond/games?game=snake#scores');
    expect(screen.getByRole('link',{name:'文章'})).toHaveAttribute('href','https://blog.yukino.bond/blog?post=a%2Fb#section-4');
    expect(siteHref('/focus','localhost')).toBe('/focus');
    expect(siteHref('/speed','raptor.pages.dev')).toBe('/speed');
    expect(siteHref('/jm','www.yukino.bond')).toBe('https://jm.yukino.bond/');
    expect(siteHref('/novel','www.yukino.bond')).toBe('https://novel.yukino.bond/');
    expect(siteHref('/comic','www.yukino.bond')).toBe('https://comic.yukino.bond/');
    expect(siteHref('/cinema','www.yukino.bond')).toBe('https://cinema.yukino.bond/');
    expect(canonicalPageUrl('https://www.yukino.bond/cinema/watch/ikun-1/0/0')).toBe('https://cinema.yukino.bond/watch/ikun-1/0/0');
    expect(canonicalPageUrl('https://cinema.yukino.bond/watch/ikun-1/0/0')).toBeNull();
    expect(canonicalPageUrl('https://www.yukino.bond/comic/watch/bf-1/0/0')).toBe('https://comic.yukino.bond/watch/bf-1/0/0');
    expect(canonicalPageUrl('https://comic.yukino.bond/watch/bf-1/0/0')).toBeNull();
    expect(canonicalPageUrl('https://www.yukino.bond/novel/book/8')).toBe('https://novel.yukino.bond/book/8');
    expect(canonicalPageUrl('https://novel.yukino.bond/book/8')).toBeNull();
  });
  it.each(['www','ip','focus','dev','blog','cr','f1','games','rss'])('corrects legacy paths on %s without redirect loops', host => {
    const input = `https://${host}.yukino.bond/f1?tab=calendar&year=2024#round-3`;
    const target = 'https://f1.yukino.bond/f1?tab=calendar&year=2024#round-3';
    expect(canonicalPageUrl(input)).toBe(target); expect(canonicalPageUrl(target)).toBe(target);
  });
  it('keeps rail deep links and subsite roots, and leaves data/assets/external sites alone', () => {
    expect(canonicalPageUrl('https://ip.yukino.bond/live?train=G1039&date=2026-10-11')).toBe('https://cr.yukino.bond/live?train=G1039&date=2026-10-11');
    expect(canonicalPageUrl('https://cr.yukino.bond/?view=board&station=IZQ')).toBe('https://cr.yukino.bond/?view=board&station=IZQ');
    expect(canonicalPageUrl('https://ip.yukino.bond/notes?q=abc')).toBe('https://www.yukino.bond/notes?q=abc');
    for (const address of ['https://ip.yukino.bond/api/ip/check','https://ip.yukino.bond/assets/app.js','https://cr.yukino.bond/rail-network/cities.json','https://dev.example.com/','https://localhost/dev','https://jm.yukino.bond/']) expect(canonicalPageUrl(address)).toBeNull();
  });
  it('redirects wrong document hosts at the edge but permits legacy speed recovery and API posts', async () => {
    const next = async () => new Response('asset');
    const response = await routePage({request:new Request('https://ip.yukino.bond/dev?tool=json'),next});
    expect(response.status).toBe(308); expect(response.headers.get('Location')).toBe('https://dev.yukino.bond/dev?tool=json');
    for (const request of [new Request('https://ip.yukino.bond/speed'),new Request('https://ip.yukino.bond/api/ip/check',{method:'POST'}),new Request('https://focus.yukino.bond/assets/app.js')]) expect(await (await routePage({request,next})).text()).toBe('asset');
  });
});
