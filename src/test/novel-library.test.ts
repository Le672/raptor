import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { history, importLibrary, preferences, saveProgress, shelf, toggleSaved } from '../../novel/src/library';
import { directId, request } from '../../novel/src/api';
import type { Book } from '../../novel/src/api';
const book: Book = { id: '8', title: '测试书', author: '测试作者', illustrator: '', description: '', cover: '', tags: [], status: 'ongoing', updatedAt: null, sourceFetchedAt: null, sourceUrl: 'https://www.linovelib.com/novel/8.html' };
beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('novel library and deep links', () => {
  it('imports backups without replacing newer reading progress with an older bookmark', () => {
    saveProgress({ book, volumeId: '11', chapterId: '22', chapterTitle: '第二章', percent: 65, updatedAt: 200 });
    importLibrary(JSON.stringify({ version: 1, shelf: [{ book, savedAt: 100 }], history: [{ book, volumeId: '11', chapterId: '21', chapterTitle: '第一章', percent: 30, updatedAt: 100 }] }));
    expect(shelf()).toHaveLength(1); expect(history()[0].chapterId).toBe('22'); expect(history()[0].percent).toBe(65);
    toggleSaved(book); expect(shelf()).toHaveLength(0); expect(history()).toHaveLength(1);
  });
  it('validates imported links and clamps corrupt reader settings', () => {
    importLibrary(JSON.stringify({ version: 1, shelf: [{ book: { ...book, cover: 'https://evil.test/image.png' }, savedAt: 10 }], history: [] }));
    expect(shelf()).toHaveLength(0);
    localStorage.setItem('novel:settings', JSON.stringify({ fontSize: 1000, lineHeight: 10, width: -1, paper: 'invalid' }));
    expect(preferences()).toMatchObject({ fontSize: 30, lineHeight: 2.5, width: 560, paper: 'paper' });
    expect(directId('https://www.linovelib.com/novel/4649.html')).toBe('4649');
    expect(directId('4649')).toBe('4649');
    expect(directId('https://www.linovelib.com.evil.test/novel/4649.html')).toBe('');
  });
  it('keeps legacy and source-specific shelves and progress separate when native IDs match', () => {
    const sf = { ...book, id: 'sf-8', source: 'sf' as const };
    saveProgress({ book, volumeId: '11', chapterId: '22', chapterTitle: '旧书签', percent: 65, updatedAt: 200 });
    toggleSaved(book);
    importLibrary(JSON.stringify({ version: 1, shelf: [{ book: sf, savedAt: 300 }], history: [{ book: sf, volumeId: 'v12345678', chapterId: '22', chapterTitle: '新书源', percent: 10, updatedAt: 300 }] }));
    expect(shelf().map(x => x.book.id)).toEqual(['8', 'sf-8']);
    expect(history().find(x => x.book.id === '8')?.percent).toBe(65);
    expect(history().find(x => x.book.id === 'sf-8')?.percent).toBe(10);
    expect(directId('https://book.sfacg.com/Novel/775221/')).toBe('sf-775221');
    expect(directId('https://www.linovel.net/book/122429.html')).toBe('linovel-122429');
    expect(directId('https://www.wenku8.net/book/1973.htm')).toBe('wenku-1973');
    expect(directId('https://book.sfacg.com.evil.test/Novel/8/')).toBe('');
  });
  it('does not use a browser body cache after an explicit subscription denial', async () => {
    const match = vi.fn(async () => new Response(JSON.stringify({ data: { text: 'old' }, meta: {} })));
    vi.stubGlobal('caches', { open: async () => ({ match }) });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: '需要订阅' }), { status: 403 })));
    await expect(request('/api/book/sf-8/chapter/12')).rejects.toThrow('需要订阅');
    expect(match).not.toHaveBeenCalled();
  });
});
