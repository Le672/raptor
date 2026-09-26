import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookHeart, BookOpen, ChevronLeft, ChevronRight, CircleHelp, Download, Heart, Home, LayoutGrid, LoaderCircle, Moon, Search, Settings2, Sun, WandSparkles, X } from 'lucide-react';
import { coverUrl, findBooks, getBook, getChapter, type Book, type BookCard, type Chapter, type SearchPage } from './api';
import { exportChapters, type ExportType } from './export';
import { pageBlob, pageObjectUrl } from './images';
import { favorites, history, saveProgress, setFavorites, setSetting, setting } from './library';
import { readText, translateText, type TranslationOptions } from './translation';
import './style.css';

type Route = { kind: 'home' } | { kind: 'book'; id: string } | { kind: 'read'; bookId: string; chapterId: string };
type View = 'discover' | 'library' | 'settings';

const isDesktop = document.body.dataset.platform === 'desktop';
const orderOptions = [['mr', '最新'], ['mv', '最多浏览'], ['mp', '最多收藏'], ['tf', '最新上架']];
const categoryOptions = [['0', '全部'], ['1', '同人'], ['2', '单行本'], ['3', '短篇'], ['4', '韩漫']];
const timeOptions = [['a', '不限时间'], ['t', '今天'], ['w', '本周'], ['m', '本月']];

function parseRoute(): Route {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'book' && /^\d+$/.test(parts[1] || '')) return { kind: 'book', id: parts[1] };
  if (parts[0] === 'read' && /^\d+$/.test(parts[1] || '') && /^\d+$/.test(parts[2] || '')) return { kind: 'read', bookId: parts[1], chapterId: parts[2] };
  return { kind: 'home' };
}

function navigate(path: string) { location.hash = path; }
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }

function PageImage({ chapter, index, onVisible }: { chapter: Chapter; index: number; onVisible?: (index: number) => void }) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) { setReady(true); observer.disconnect(); }
    }, { rootMargin: '900px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    pageObjectUrl(chapter, index).then(url => { if (active) setSrc(url); else URL.revokeObjectURL(url); }).catch(cause => { if (active) setError(message(cause)); });
    return () => { active = false; };
  }, [chapter, index, ready]);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  useEffect(() => {
    const node = element.current;
    if (!node || !onVisible) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) onVisible(index);
    }, { threshold: .55 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [index, onVisible]);
  return <div className="jm-page-frame" ref={element}>
    {src ? <img src={src} alt={`${chapter.title} · 第 ${index + 1} 页`} /> : <div className="jm-image-state">{error || <><LoaderCircle className="spin" size={22} /> 正在载入第 {index + 1} 页</>}</div>}
  </div>;
}

function Cover({ id, title }: { id: string; title: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="jm-cover">{failed ? <BookOpen size={42} strokeWidth={1.3} /> : <img loading="lazy" src={coverUrl(id)} alt={`${title} 封面`} onError={() => setFailed(true)} />}</div>;
}

function BookTile({ item, onOpen, saved }: { item: BookCard; onOpen: () => void; saved: boolean }) {
  return <button className="jm-tile" onClick={onOpen}>
    <Cover id={item.id} title={item.title} />
    <span className="jm-tile-copy"><strong>{item.title}</strong><small>{item.creator || `JM ${item.id}`}</small></span>
    {saved && <span className="jm-tile-heart" aria-label="已收藏"><Heart size={15} fill="currentColor" /></span>}
  </button>;
}

function Reader({ route, back, settings }: { route: Extract<Route, { kind: 'read' }>; back: () => void; settings: TranslationOptions }) {
  const [book, setBook] = useState<Book | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'vertical' | 'horizontal'>(() => setting('reader-mode', 'vertical'));
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [translated, setTranslated] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [translationBusy, setTranslationBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    setBook(null); setChapter(null); setError(''); setTranslated(''); setSourceText('');
    Promise.all([getBook(route.bookId), getChapter(route.chapterId)]).then(([nextBook, nextChapter]) => {
      if (cancelled) return;
      setBook(nextBook); setChapter(nextChapter);
      const old = history()[route.bookId];
      setPage(old?.chapterId === route.chapterId ? Math.min(old.page, nextChapter.images.length - 1) : 0);
    }).catch(cause => { if (!cancelled) setError(message(cause)); });
    return () => { cancelled = true; };
  }, [route.bookId, route.chapterId]);

  useEffect(() => { if (chapter) saveProgress(route.bookId, { chapterId: chapter.id, page, updatedAt: Date.now() }); }, [chapter, page, route.bookId]);
  useEffect(() => { setTranslated(''); setSourceText(''); }, [page, chapter?.id]);

  const markVisible = useCallback((index: number) => setPage(index), []);
  const currentChapterIndex = book?.chapters.findIndex(item => item.id === route.chapterId) ?? -1;
  const adjacent = (delta: number) => book?.chapters[currentChapterIndex + delta];
  const switchMode = () => { const next = mode === 'vertical' ? 'horizontal' : 'vertical'; setMode(next); setSetting('reader-mode', next); };
  const changePage = (delta: number) => {
    if (!chapter) return;
    const next = page + delta;
    if (next >= 0 && next < chapter.images.length) setPage(next);
    else if (next < 0 && adjacent(-1)) navigate(`/read/${route.bookId}/${adjacent(-1)!.id}`);
    else if (next >= chapter.images.length && adjacent(1)) navigate(`/read/${route.bookId}/${adjacent(1)!.id}`);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (mode !== 'horizontal' || ['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) return;
      if (event.key === 'ArrowRight') changePage(1);
      if (event.key === 'ArrowLeft') changePage(-1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const runTranslation = async () => {
    if (!chapter) return;
    setTranslationBusy(true); setError('');
    try {
      const recognized = await readText(await pageBlob(chapter, page));
      setSourceText(recognized || '未识别出文字');
      if (!recognized) return;
      if (!settings.endpoint || !settings.apiKey || !settings.model) { setTranslated('请先在设置中填写翻译 API。'); return; }
      setTranslated(await translateText(recognized, settings));
    } catch (cause) { setError(`翻译失败：${message(cause)}`); }
    finally { setTranslationBusy(false); }
  };
  const save = async (format: ExportType) => {
    if (!chapter) return;
    setDownloadBusy('准备下载…'); setError('');
    try { await exportChapters([chapter], `${book?.title || 'Yukino JM'}-${chapter.title}`, format, (done, total) => setDownloadBusy(`${done} / ${total} 页`)); }
    catch (cause) { setError(`下载失败：${message(cause)}`); }
    finally { setDownloadBusy(''); }
  };

  return <div className="jm-reader">
    <div className="jm-reader-toolbar">
      <button className="icon-button" onClick={back} aria-label="返回作品"><ArrowLeft size={19} /></button>
      <div className="jm-reader-title"><strong>{book?.title || '正在打开…'}</strong><small>{chapter?.title || route.chapterId} · {chapter ? `${page + 1} / ${chapter.images.length}` : '载入中'}</small></div>
      <div className="jm-reader-controls">
        <button className="small-button" onClick={switchMode}>{mode === 'vertical' ? '纵向阅读' : '横向翻页'}</button>
        <button className="icon-button" onClick={() => setZoom(value => Math.max(.7, value - .15))} aria-label="缩小">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button className="icon-button" onClick={() => setZoom(value => Math.min(2, value + .15))} aria-label="放大">+</button>
        <button className="small-button" onClick={() => void runTranslation()} disabled={translationBusy}>{translationBusy ? <LoaderCircle size={15} className="spin" /> : <WandSparkles size={15} />} 翻译本页</button>
        <select className="small-select" aria-label="下载格式" value="" onChange={event => { void save(event.target.value as ExportType); event.target.value = ''; }}><option value="">下载章节</option><option value="cbz">CBZ</option><option value="zip">ZIP</option><option value="pdf">PDF</option></select>
      </div>
    </div>
    {error && <div className="jm-alert" role="alert">{error}</div>}
    {downloadBusy && <div className="jm-info">正在准备 {downloadBusy}</div>}
    {!chapter ? <div className="jm-empty"><LoaderCircle className="spin" /> 正在读取章节…</div> : <>
      <div className={`jm-reader-stage ${mode}`}>
        {mode === 'vertical' ? <div className="jm-vertical-pages" style={{ width: `${Math.round(Math.min(zoom, 1.5) * 100)}%` }}>{chapter.images.map((_, index) => <PageImage key={index} chapter={chapter} index={index} onVisible={markVisible} />)}</div>
          : <div className="jm-horizontal-page"><button onClick={() => changePage(-1)} aria-label="上一页"><ChevronLeft /></button><div style={{ width: `${Math.round(zoom * 100)}%` }}><PageImage key={`${chapter.id}-${page}`} chapter={chapter} index={page} /></div><button onClick={() => changePage(1)} aria-label="下一页"><ChevronRight /></button></div>}
      </div>
      <div className="jm-reader-bottom"><button className="small-button" disabled={!adjacent(-1)} onClick={() => navigate(`/read/${route.bookId}/${adjacent(-1)!.id}`)}>上一章节</button><span>{chapter.title}</span><button className="small-button" disabled={!adjacent(1)} onClick={() => navigate(`/read/${route.bookId}/${adjacent(1)!.id}`)}>下一章节</button></div>
    </>}
    {(sourceText || translated) && <aside className="jm-translation-panel"><button className="icon-button" onClick={() => { setSourceText(''); setTranslated(''); }} aria-label="关闭翻译"><X size={17} /></button><h3>本页翻译</h3><p>{translated || '识别完成'}</p><details><summary>识别原文</summary><pre>{sourceText}</pre></details></aside>}
  </div>;
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const [view, setView] = useState<View>('discover');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [category, setCategory] = useState('0');
  const [order, setOrder] = useState('mr');
  const [time, setTime] = useState('a');
  const [page, setPage] = useState(1);
  const [searchResult, setSearchResult] = useState<SearchPage | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [error, setError] = useState('');
  const [book, setBook] = useState<Book | null>(null);
  const [bookBusy, setBookBusy] = useState(false);
  const [saved, setSaved] = useState(favorites);
  const [selected, setSelected] = useState<string[]>([]);
  const [downloadBusy, setDownloadBusy] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => setting('theme', isDesktop ? 'dark' : 'light'));
  const [translation, setTranslation] = useState<TranslationOptions>(() => setting('translation', { endpoint: '', apiKey: '', model: '', language: '简体中文' }));
  const marks = history();

  useEffect(() => { const update = () => setRoute(parseRoute()); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  useEffect(() => { document.documentElement.dataset.jmTheme = theme; setSetting('theme', theme); }, [theme]);
  useEffect(() => {
    if (!submitted) return;
    const controller = new AbortController();
    setSearchBusy(true); setError('');
    findBooks(submitted, page, category, order, time, controller.signal).then(setSearchResult).catch(cause => { if (!controller.signal.aborted) setError(message(cause)); }).finally(() => { if (!controller.signal.aborted) setSearchBusy(false); });
    return () => controller.abort();
  }, [submitted, page, category, order, time]);
  useEffect(() => {
    if (route.kind !== 'book') return;
    const controller = new AbortController();
    setBook(null); setBookBusy(true); setError(''); setSelected([]);
    getBook(route.id, controller.signal).then(setBook).catch(cause => { if (!controller.signal.aborted) setError(message(cause)); }).finally(() => { if (!controller.signal.aborted) setBookBusy(false); });
    return () => controller.abort();
  }, [route]);

  const saveTranslation = (next: TranslationOptions) => { setTranslation(next); setSetting('translation', next); };
  const toggleFavorite = () => {
    if (!book) return;
    const next = saved.some(item => item.id === book.id) ? saved.filter(item => item.id !== book.id) : [{ id: book.id, title: book.title, creator: book.creators.join(', '), savedAt: Date.now() }, ...saved];
    setSaved(next); setFavorites(next);
  };
  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (/^\d+$/.test(value)) { navigate(`/book/${value}`); return; }
    setView('discover'); setPage(1); setSubmitted(value); navigate('/');
  };
  const changeFilter = (key: 'category' | 'order' | 'time', value: string) => {
    setPage(1);
    if (key === 'category') setCategory(value);
    if (key === 'order') setOrder(value);
    if (key === 'time') setTime(value);
  };
  const downloadSelected = async (format: ExportType) => {
    if (!book) return;
    const ids = selected.length ? selected : book.chapters.map(item => item.id);
    setDownloadBusy('正在读取章节…'); setError('');
    try {
      const chapters: Chapter[] = [];
      for (const [index, id] of ids.entries()) { chapters.push(await getChapter(id)); setDownloadBusy(`章节 ${index + 1} / ${ids.length}`); }
      await exportChapters(chapters, book.title, format, (done, total) => setDownloadBusy(`${done} / ${total} 页`));
    } catch (cause) { setError(`下载失败：${message(cause)}`); }
    finally { setDownloadBusy(''); }
  };
  const savedMap = useMemo(() => new Set(saved.map(item => item.id)), [saved]);

  if (route.kind === 'read') return <Reader route={route} back={() => navigate(`/book/${route.bookId}`)} settings={translation} />;

  return <div className={`jm-app ${isDesktop ? 'jm-desktop' : ''}`}>
    <aside className="jm-sidebar">
      <button className="jm-brand" onClick={() => { navigate('/'); setView('discover'); }}><span className="jm-logo"><BookOpen size={25} /></span><span><strong>Yukino <em>JM</em></strong><small>{isDesktop ? 'COMIC STUDIO' : 'READING ROOM'}</small></span></button>
      <div className="jm-nav-label">浏览</div>
      <nav aria-label="主导航">
        <button className={route.kind === 'home' && view === 'discover' ? 'active' : ''} onClick={() => { navigate('/'); setView('discover'); }}><LayoutGrid size={18} /> 发现作品</button>
        <button className={route.kind === 'home' && view === 'library' ? 'active' : ''} onClick={() => { navigate('/'); setView('library'); }}><BookHeart size={18} /> 我的书架 <span>{saved.length}</span></button>
        <button className={route.kind === 'home' && view === 'settings' ? 'active' : ''} onClick={() => { navigate('/'); setView('settings'); }}><Settings2 size={18} /> 阅读设置</button>
      </nav>
      <div className="jm-sidebar-bottom"><span className="jm-status-dot" /> {isDesktop ? '本地桌面工作台' : 'Yukino · 个人阅读空间'}<a href="https://yukino.bond" target="_blank" rel="noreferrer">返回主站 ↗</a></div>
    </aside>
    <main className="jm-main">
      <header className="jm-topbar"><div className="jm-mobile-brand"><BookOpen size={22} /> Yukino JM</div><div className="jm-breadcrumb"><Home size={15} /> {route.kind === 'book' ? '作品详情' : view === 'discover' ? '发现作品' : view === 'library' ? '我的书架' : '阅读设置'}</div><button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="切换明暗主题">{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button></header>
      {route.kind === 'book' ? <div className="jm-content">
        <button className="jm-back" onClick={() => navigate('/')}><ArrowLeft size={17} /> 返回</button>
        {bookBusy && <div className="jm-empty"><LoaderCircle className="spin" /> 正在读取作品…</div>}
        {error && <div className="jm-alert" role="alert">{error}</div>}
        {book && <><div className="jm-book-hero"><Cover id={book.id} title={book.title} /><div className="jm-book-info"><span className="jm-eyebrow">JM #{book.id}</span><h1>{book.title}</h1><p className="jm-creators">{book.creators.join(' · ') || '未知作者'}</p><div className="jm-book-meta"><span>{book.chapters.length} 章节</span><span>{book.views.toLocaleString()} 浏览</span><span>{book.likes.toLocaleString()} 喜欢</span></div><div className="jm-book-actions"><button className="jm-primary" onClick={() => { const mark = marks[book.id]; navigate(`/read/${book.id}/${mark?.chapterId || book.chapters[0]?.id}`); }} disabled={!book.chapters.length}><BookOpen size={17} /> {marks[book.id] ? '继续阅读' : '开始阅读'}</button><button className="jm-secondary" onClick={toggleFavorite}><Heart size={17} fill={savedMap.has(book.id) ? 'currentColor' : 'none'} /> {savedMap.has(book.id) ? '已加入书架' : '加入书架'}</button></div></div></div>
          {(book.tags.length > 0 || book.works.length > 0) && <div className="jm-tags">{[...book.tags, ...book.works].map(tag => <span key={tag}>{tag}</span>)}</div>}
          {book.description && <section className="jm-section"><h2>作品简介</h2><p className="jm-description">{book.description}</p></section>}
          <section className="jm-section"><div className="jm-section-head"><div><span className="jm-eyebrow">CONTENTS</span><h2>章节目录</h2></div><span>选择章节后可批量导出</span></div>
            <div className="jm-chapter-actions"><label><input type="checkbox" checked={selected.length === book.chapters.length && book.chapters.length > 0} onChange={event => setSelected(event.target.checked ? book.chapters.map(item => item.id) : [])} /> 全选</label><div><button className="small-button" disabled={!!downloadBusy || !book.chapters.length} onClick={() => void downloadSelected('cbz')}><Download size={15} /> CBZ</button><button className="small-button" disabled={!!downloadBusy || !book.chapters.length} onClick={() => void downloadSelected('zip')}>ZIP</button><button className="small-button" disabled={!!downloadBusy || !book.chapters.length} onClick={() => void downloadSelected('pdf')}>PDF</button></div></div>
            {downloadBusy && <div className="jm-info"><LoaderCircle size={16} className="spin" /> 正在准备 {downloadBusy}</div>}
            <div className="jm-chapter-list">{book.chapters.map((item, index) => <div className="jm-chapter" key={item.id}><input aria-label={`选择 ${item.title}`} type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} /><button onClick={() => navigate(`/read/${book.id}/${item.id}`)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.title}</strong>{marks[book.id]?.chapterId === item.id && <small>读到第 {marks[book.id].page + 1} 页</small>}<ChevronRight size={17} /></button></div>)}</div>
          </section></>}
      </div> : view === 'discover' ? <div className="jm-content"><section className="jm-hero"><div><span className="jm-eyebrow">YUKINO READING ROOM</span><h1>在故事里，<br /><em>慢慢翻一页。</em></h1><p>搜索作品、保存喜欢的漫画，随时继续阅读。</p><form className="jm-search" onSubmit={search}><Search size={20} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题、作者、标签或输入作品 ID" aria-label="搜索漫画" /><button type="submit">搜索 <ChevronRight size={17} /></button></form></div><div className="jm-hero-art" aria-hidden="true"><div className="jm-art-circle"><BookOpen size={100} strokeWidth={.8} /></div><span>阅读 · 收藏 · 下载</span></div></section>
        <section className="jm-section"><div className="jm-section-head"><div><span className="jm-eyebrow">DISCOVER</span><h2>{submitted ? `“${submitted}” 的结果` : '开始探索'}</h2></div>{searchResult && <span>找到 {searchResult.total.toLocaleString()} 部作品</span>}</div>
          <div className="jm-filters"><label>分类 <select value={category} onChange={event => changeFilter('category', event.target.value)}>{categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>排序 <select value={order} onChange={event => changeFilter('order', event.target.value)}>{orderOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>时间 <select value={time} onChange={event => changeFilter('time', event.target.value)}>{timeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
          {error && <div className="jm-alert" role="alert">{error}</div>}
          {searchBusy && <div className="jm-empty"><LoaderCircle className="spin" /> 正在搜索…</div>}
          {!submitted && <div className="jm-start"><Search size={28} /><h3>想读什么？</h3><p>输入关键词或作品 ID，开启你的漫画书房。</p></div>}
          {submitted && !searchBusy && searchResult && <>{searchResult.directId && <button className="jm-direct" onClick={() => navigate(`/book/${searchResult.directId}`)}><BookOpen size={18} /> 直接打开作品 #{searchResult.directId} <ChevronRight size={18} /></button>}<div className="jm-grid">{searchResult.items.map(item => <BookTile key={item.id} item={item} saved={savedMap.has(item.id)} onOpen={() => navigate(`/book/${item.id}`)} />)}</div>{!searchResult.items.length && <div className="jm-empty">没有找到相关作品。试试更短的关键词。</div>}<div className="jm-pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} 页</span><button disabled={searchResult.items.length === 0 || page * searchResult.pageSize >= searchResult.total} onClick={() => setPage(page + 1)}>下一页</button></div></>}
        </section></div> : view === 'library' ? <div className="jm-content"><div className="jm-page-heading"><span className="jm-eyebrow">YOUR SHELF</span><h1>我的书架</h1><p>收藏和阅读进度保存在这台设备上。</p></div>{saved.length ? <div className="jm-grid">{saved.map(item => <BookTile key={item.id} item={item} saved onOpen={() => navigate(`/book/${item.id}`)} />)}</div> : <div className="jm-start"><BookHeart size={30} /><h3>书架还是空的</h3><p>打开喜欢的作品，点「加入书架」即可收藏。</p><button className="jm-primary" onClick={() => setView('discover')}>去发现作品</button></div>}</div> : <div className="jm-content"><div className="jm-page-heading"><span className="jm-eyebrow">PREFERENCES</span><h1>阅读设置</h1><p>调整翻译服务与界面偏好。</p></div><section className="jm-settings-panel"><h2><WandSparkles size={20} /> 漫画翻译</h2><p>本地 OCR 提取文字，使用你提供的兼容 OpenAI 的 API 翻译。密钥只保存在当前设备，发起翻译时经本站 Worker 转发。</p><label>API 地址<input type="url" value={translation.endpoint} placeholder="https://api.example.com/v1/chat/completions" onChange={event => saveTranslation({ ...translation, endpoint: event.target.value })} /></label><label>API 密钥<input type="password" value={translation.apiKey} autoComplete="off" placeholder="sk-…" onChange={event => saveTranslation({ ...translation, apiKey: event.target.value })} /></label><div className="jm-setting-row"><label>模型<input value={translation.model} placeholder="gpt-4o-mini" onChange={event => saveTranslation({ ...translation, model: event.target.value })} /></label><label>目标语言<input value={translation.language} onChange={event => saveTranslation({ ...translation, language: event.target.value })} /></label></div><div className="jm-note"><CircleHelp size={17} /> OCR 模型首次使用需要下载；离线时已缓存的漫画仍可阅读。</div></section><section className="jm-settings-panel"><h2><Sun size={20} /> 外观</h2><div className="jm-theme-buttons"><button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><Sun size={18} /> 浅色</button><button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><Moon size={18} /> 深色</button></div></section></div>}
    </main>
    <nav className="jm-mobile-nav" aria-label="移动导航"><button className={view === 'discover' ? 'active' : ''} onClick={() => { navigate('/'); setView('discover'); }}><Search size={19} />发现</button><button className={view === 'library' ? 'active' : ''} onClick={() => { navigate('/'); setView('library'); }}><Heart size={19} />书架</button><button className={view === 'settings' ? 'active' : ''} onClick={() => { navigate('/'); setView('settings'); }}><Settings2 size={19} />设置</button></nav>
  </div>;
}
