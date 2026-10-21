import { beforeEach, describe, expect, it } from 'vitest';
import { directDestination, type Artwork, type ArtworkCard } from '../../pixiv/src/api';
import { exportLibrary, importLibrary, readLibrary, recordView, toggleFavorite, writeLibrary } from '../../pixiv/src/library';
import { canonicalPageUrl, isPortalHost, siteHref } from '../lib/site-routing';
const item: ArtworkCard = { id: '123456', title: '風景', userId: '456', userName: 'Artist', image: 'https://i.pximg.net/img-original/img/2026/10/21/00/00/00/123456_p0.jpg', width: 1200, height: 800, pageCount: 3, type: 0, ai: false, tags: ['風景'], createdAt: '2026-10-21' };
beforeEach(() => localStorage.clear());

describe('Pixiv direct navigation and independent ownership', () => {
  it('accepts PID, localized links and legacy Pixiv artwork links', () => {
    for (const value of ['123456', 'PID: 123456', 'https://www.pixiv.net/artworks/123456', 'https://www.pixiv.net/zh/artworks/123456?x=1', 'https://www.pixiv.net/member_illust.php?illust_id=123456']) expect(directDestination(value)).toBe('/artworks/123456');
    expect(directDestination('https://www.pixiv.net/users/456')).toBe('/users/456');
    for (const value of ['cat', 'https://www.pixiv.net.evil.test/artworks/123456', 'javascript:alert(1)', '0']) expect(directDestination(value)).toBeNull();
  });
  it('routes portal links to the independent site without redirecting its own deep links', () => {
    expect(siteHref('/pixiv', 'www.yukino.bond')).toBe('https://pixiv.yukino.bond/');
    expect(canonicalPageUrl('https://www.yukino.bond/pixiv/artworks/123456')).toBe('https://pixiv.yukino.bond/artworks/123456');
    expect(canonicalPageUrl('https://pixiv.yukino.bond/artworks/123456')).toBeNull();
    expect(isPortalHost('pixiv.yukino.bond')).toBe(false);
  });
});

describe('local Pixiv collection', () => {
  it('toggles favorites and persists reloadable local data', () => {
    const next = toggleFavorite(readLibrary(), item); writeLibrary(next);
    expect(readLibrary().favorites).toHaveLength(1); expect(toggleFavorite(next, item).favorites).toHaveLength(0);
  });
  it('round-trips a backup and keeps the newer multi-image viewing position', () => {
    const detail = { ...item, tags: [{ name: '風景', translation: '' }], description: '', images: [], viewCount: 1, bookmarkCount: 1 } as Artwork;
    const current = recordView(toggleFavorite(readLibrary(), item), detail, 2);
    const older = { ...current, history: [{ ...current.history[0], page: 0, viewedAt: current.history[0].viewedAt - 1000 }] };
    const merged = importLibrary(exportLibrary(older), current);
    expect(merged.favorites).toHaveLength(1); expect(merged.history[0].page).toBe(2);
    expect(merged.history[0].artwork.tags).toEqual(['風景']);
  });
  it('rejects foreign backup formats and invalid image addresses', () => {
    expect(() => importLibrary('{', readLibrary())).toThrow();
    expect(() => importLibrary('{"app":"another-app","version":1}', readLibrary())).toThrow();
    expect(() => importLibrary(JSON.stringify({ app: 'yukino-pixiv', version: 1, favorites: [{ ...item, image: 'https://evil.test/a.jpg' }], history: [] }), readLibrary())).toThrow();
    expect(() => importLibrary('x'.repeat(2_000_001), readLibrary())).toThrow();
  });
  it('removes injected fields and clamps imported viewing positions', () => {
    const raw = JSON.stringify({ app: 'yukino-pixiv', version: 1, favorites: [{ ...item, cookie: 'must not be retained' }], history: [{ artwork: item, page: 99999, viewedAt: Date.now() }] });
    const value = importLibrary(raw, readLibrary());
    expect(exportLibrary(value)).not.toContain('cookie'); expect(value.history[0].page).toBe(2);
  });
  it('recovers safely from corrupt browser storage', () => {
    localStorage.setItem('yukino-pixiv-library-v1', 'not json');
    expect(readLibrary()).toEqual({ favorites: [], history: [], searches: [] });
  });
});
