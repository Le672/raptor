import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, Clock3, Download, ExternalLink, Heart, Home, Image as ImageIcon, Layers, LoaderCircle, Moon, Palette, RefreshCw, Search, Settings2, Sun, Trophy, Upload, UserRound, X } from 'lucide-react';
import { directDestination, getJson, imageUrl, type Artwork, type ArtworkCard, type ArtworkPage } from './api';
import { exportLibrary, importLibrary, readLibrary, recordView, toggleFavorite, writeLibrary, type Library } from './library';

type Go = (path: string) => void;
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const count = (n: number) => new Intl.NumberFormat('zh-CN', { notation: n > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);
const rankOptions = [['daily', '每日'], ['weekly', '每周'], ['monthly', '每月'], ['rookie', '新人'], ['original', '原创']];
const topics = ['風景', 'オリジナル', '初音ミク', '原神', '崩壊スターレイル', 'ブルーアーカイブ', '猫'];
const labels: Record<string, string> = { '/': '发现作品', '/search': '搜索作品', '/ranking': '排行榜', '/favorites': '我的收藏', '/history': '浏览足迹', '/settings': '偏好与备份' };

function useRemote<T>(path: string | null) {
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string; loading: boolean }>({ key: null, data: null, error: '', loading: !!path });
  const [version, retry] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setState({ key: path, data: null, error: '', loading: true });
    getJson<T>(path, controller.signal).then(data => setState({ key: path, data, error: '', loading: false })).catch(cause => {
      if (!controller.signal.aborted) setState({ key: path, data: null, error: errorText(cause), loading: false });
    });
    return () => controller.abort();
  }, [path, version]);
  return { data: state.key === path ? state.data : null, error: state.key === path ? state.error : '', loading: !!path && (state.key !== path || state.loading), retry: () => retry(value => value + 1) };
}

function Picture({ src, title, large = false }: { src: string; title: string; large?: boolean }) {
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => { setFailed(false); setAttempt(0); }, [src]);
  return failed ? <div className="picture-failed"><ImageIcon size={26} /><span>图片暂时未能载入</span><button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>重试图片</button></div> : <img key={src + attempt} src={imageUrl(src)} alt={title} loading={large ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="empty"><Palette size={34} strokeWidth={1.2} /><h3>{title}</h3><div>{children}</div></div>;
}
function ErrorNotice({ error, retry, source }: { error: string; retry: () => void; source?: string }) {
  return <div className="error-notice" role="alert"><ImageIcon size={26} /><h3>暂时没能取到作品</h3><p>{error}</p><div className="actions"><button className="primary" onClick={retry}><RefreshCw size={15} />重新加载</button>{source && <a className="button" href={source} target="_blank" rel="noreferrer">打开 Pixiv<ArrowUpRight size={15} /></a>}</div></div>;
}
function Skeleton() { return <div className="art-grid loading-grid" aria-label="正在加载作品" aria-busy="true">{Array.from({ length: 12 }, (_, i) => <div className="skeleton" key={i}><div /><span /><small /></div>)}</div>; }

function Card({ item, saved, go, favorite }: { item: ArtworkCard; saved: boolean; go: Go; favorite: (item: ArtworkCard) => void }) {
  return <article className="art-card">
    <a className="art-image" href={'/artworks/' + item.id} onClick={event => { event.preventDefault(); go('/artworks/' + item.id); }} aria-label={'查看作品：' + item.title}>
      <Picture src={item.image} title={item.title} />
      {item.rank ? <span className={'rank-badge rank-' + Math.min(item.rank, 4)}>#{String(item.rank).padStart(2, '0')}</span> : null}
      {item.pageCount > 1 && <span className="page-badge"><Layers size={12} />{item.pageCount}</span>}
      {item.ai && <span className="ai-badge">AI</span>}
      {item.type === 2 && <span className="animation-badge">动图封面</span>}
    </a>
    <button className={'favorite-icon ' + (saved ? 'saved' : '')} aria-label={saved ? '取消收藏：' + item.title : '收藏：' + item.title} aria-pressed={saved} onClick={() => favorite(item)}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button>
    <div className="art-copy"><a href={'/artworks/' + item.id} onClick={event => { event.preventDefault(); go('/artworks/' + item.id); }} title={item.title}>{item.title}</a><button className="artist-link" onClick={() => go('/users/' + item.userId)} disabled={!item.userId}>{item.userName || '未知画师'}<span>PID {item.id}</span></button></div>
  </article>;
}

function SearchBox({ value, setValue, submit }: { value: string; setValue: (value: string) => void; submit: (event: FormEvent) => void }) {
  return <form className="search-form" onSubmit={submit}><Search size={19} aria-hidden="true" /><input value={value} onChange={event => setValue(event.target.value)} placeholder="标签、标题、PID 或 Pixiv 链接" aria-label="搜索 Pixiv 作品" required maxLength={300} autoComplete="off" />{value && <button className="search-clear" type="button" aria-label="清空关键词" onClick={() => setValue('')}><X size={15} /></button>}<button className="primary" type="submit"><Search size={15} /><span>搜索</span></button></form>;
}

function Pager({ page, next, change, busy }: { page: number; next: boolean; change: (page: number) => void; busy?: boolean }) {
  return <nav className="pager" aria-label="作品分页"><button className="button" disabled={page <= 1 || busy} onClick={() => change(page - 1)}><ChevronLeft size={16} />上一页</button><span>第 {page} 页</span><button className="button" disabled={!next || busy} onClick={() => change(page + 1)}>下一页<ChevronRight size={16} /></button></nav>;
}

function Detail({ id, go, library, update, notify }: { id: string; go: Go; library: Library; update: (transform: (value: Library) => Library) => void; notify: (message: string) => void }) {
  const remote = useRemote<Artwork>('/api/artworks/' + id), item = remote.data;
  const [page, setPage] = useState(0), [original, setOriginal] = useState(false), [downloading, setDownloading] = useState(false);
  const initialized = useRef(false);
  useEffect(() => {
    if (!item || initialized.current) return;
    initialized.current = true;
    const saved = readLibrary().history.find(entry => entry.artwork.id === id);
    setPage(Math.min(saved?.page || 0, item.images.length - 1));
  }, [item, id]);
  useEffect(() => { if (item && initialized.current) update(value => recordView(value, item, page)); }, [item, page, update]);
  useEffect(() => {
    if (!item) return;
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches('input,textarea,select,button,a') || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); setPage(value => Math.min(item.images.length - 1, value + 1)); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); setPage(value => Math.max(0, value - 1)); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [item]);
  const image = item?.images[page], saved = library.favorites.some(entry => entry.id === id);
  async function download() {
    if (!image?.original) return;
    setDownloading(true);
    try {
      const response = await fetch(imageUrl(image.original, true));
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || '原图下载失败，请重试。'); }
      const blob = await response.blob(), url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = `pixiv-${id}_p${page}.${image.original.split('.').pop()}`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000); notify('已交给浏览器保存原图。');
    } catch (error) { notify(errorText(error)); } finally { setDownloading(false); }
  }
  return <>
    <div className="detail-back"><button className="text-button" onClick={() => { let from = ''; try { from = sessionStorage.getItem('pixiv-return') || ''; } catch { /* Return to the gallery when session storage is unavailable. */ } go(from.startsWith('/') && !from.startsWith('//') ? from : '/'); }}><ArrowLeft size={16} />返回作品列表</button><span>PIXIV / {id}</span></div>
    {remote.loading ? <div className="detail-loading"><LoaderCircle className="spin" size={28} />正在读取作品与图片…</div> : remote.error ? <ErrorNotice error={remote.error} retry={remote.retry} source={'https://www.pixiv.net/artworks/' + id} /> : item && image ? <div className="detail-layout">
      <section className="viewer" aria-label="作品图片">
        <div className="viewer-top"><span><ImageIcon size={15} />{image.width} × {image.height}</span><button className="text-button" aria-pressed={original} onClick={() => setOriginal(value => !value)}>{original ? '切换预览图' : '查看原图'}</button></div>
        <div className={'viewer-image ' + (original ? 'original' : '')}><Picture src={original && image.original ? image.original : image.regular} title={item.title + ' · 第 ' + (page + 1) + ' 张'} large /></div>
        {item.images.length > 1 && <div className="viewer-controls"><button className="icon-button" aria-label="上一张" disabled={page === 0} onClick={() => setPage(value => value - 1)}><ChevronLeft size={20} /></button><label>图片 <select aria-label="选择图片页码" value={page} onChange={event => setPage(Number(event.target.value))}>{item.images.map((_, index) => <option value={index} key={index}>{index + 1} / {item.images.length}</option>)}</select></label><button className="icon-button" aria-label="下一张" disabled={page === item.images.length - 1} onClick={() => setPage(value => value + 1)}><ChevronRight size={20} /></button></div>}
        {item.type === 2 && <p className="viewer-note">这里显示动图封面，完整动画可在 Pixiv 原站播放。</p>}
        {item.pageCount > item.images.length && <p className="viewer-note">本站展示前 {item.images.length} 张，其余图片请在原站查看。</p>}
      </section>
      <aside className="art-detail"><span className="eyebrow">A MOMENT IN COLOUR</span><h1>{item.title}</h1><button className="detail-artist" onClick={() => go('/users/' + item.userId)}><span><UserRound size={20} /></span><div><strong>{item.userName}</strong><small>查看画师的公开作品 <ArrowUpRight size={12} /></small></div></button>
        <div className="detail-stats"><span><Heart size={15} />{count(item.bookmarkCount)} 收藏</span><span><ImageIcon size={15} />{item.pageCount} 张图片</span><span>{count(item.viewCount)} 浏览</span>{item.ai && <span>AI 生成</span>}</div>
        <div className="detail-actions"><button className={saved ? 'button saved' : 'primary'} aria-pressed={saved} onClick={() => update(value => toggleFavorite(value, item))}><Heart size={17} fill={saved ? 'currentColor' : 'none'} />{saved ? '已收藏在本机' : '收藏这件作品'}</button><button className="button" disabled={downloading || !image.original} onClick={() => void download()}>{downloading ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />}保存第 {page + 1} 张原图</button></div>
        <div className="tag-list">{item.tags.map(tag => <button key={tag.name} onClick={() => go('/search?' + new URLSearchParams({ q: tag.name, scope: 's_tag_full' }))}>#{tag.name}</button>)}</div>
        {item.description && <p className="description">{item.description}</p>}
        <dl className="work-meta"><div><dt>作品编号</dt><dd>{id}</dd></div><div><dt>发布时间</dt><dd>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-CN') : '源站未提供'}</dd></div><div><dt>作品类型</dt><dd>{['插画', '漫画', '动图'][item.type] || '插画'}</dd></div></dl>
        <a className="source-link" href={'https://www.pixiv.net/artworks/' + id} target="_blank" rel="noreferrer">在 Pixiv 查看原作<ExternalLink size={14} /></a><p className="attribution">作品版权归原作者所有。保存仅供个人欣赏，转载与使用请取得作者许可。</p>
      </aside>
    </div> : null}
  </>;
}

export default function App() {
  const [route, setRoute] = useState(() => new URL(location.href));
  const [library, setLibrary] = useState(readLibrary), libraryRef = useRef(library);
  const [keyword, setKeyword] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('yukino-pixiv-theme') || 'light'; } catch { return 'light'; } });
  const [toast, setToast] = useState(''), [localQuery, setLocalQuery] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const notify = useCallback((value: string) => setToast(value), []);
  const update = useCallback((transform: (value: Library) => Library) => {
    try { const next = transform(libraryRef.current); writeLibrary(next); libraryRef.current = next; setLibrary(next); } catch (error) { setToast(errorText(error)); }
  }, []);
  const go = useCallback((path: string) => {
    if (!path.startsWith('/') || path.startsWith('//')) return;
    if (!/^\/(?:artworks|users)\//.test(location.pathname)) { try { sessionStorage.setItem('pixiv-return', location.pathname + location.search); } catch { /* Navigation still works without storage. */ } }
    history.pushState({}, '', path); setRoute(new URL(location.href)); window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  useEffect(() => { const listener = () => setRoute(new URL(location.href)); window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('yukino-pixiv-theme', theme); } catch { /* Theme still works for this visit. */ } }, [theme]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { setKeyword(route.searchParams.get('q') || ''); setLocalQuery(''); document.title = `${labels[route.pathname] || (route.pathname.startsWith('/users/') ? '画师作品' : '作品详情')} · Pixiv 画廊 · Yukino`; }, [route]);
  useEffect(() => {
    const listener = (event: StorageEvent) => { if (event.key === 'yukino-pixiv-library-v1') { const next = readLibrary(); libraryRef.current = next; setLibrary(next); } };
    window.addEventListener('storage', listener); return () => window.removeEventListener('storage', listener);
  }, []);

  const path = route.pathname, params = route.searchParams, query = params.get('q') || '', page = Math.max(1, Number(params.get('page')) || 1);
  const isHome = path === '/', isSearch = path === '/search', isRanking = path === '/ranking';
  const isFavorites = path === '/favorites', isHistory = path === '/history', isSettings = path === '/settings';
  const artworkMatch = path.match(/^\/artworks\/([1-9]\d{0,11})\/?$/), userMatch = path.match(/^\/users\/([1-9]\d{0,11})\/?$/);
  const mode = params.get('mode') || 'daily';
  const listingPath = isHome || isRanking ? '/api/ranking?' + new URLSearchParams({ mode, page: String(page) }) : isSearch ? '/api/search?' + params : userMatch ? `/api/users/${userMatch[1]}?page=${page}` : null;
  const remote = useRemote<ArtworkPage>(listingPath), result = remote.data;
  const favorite = (item: ArtworkCard) => update(value => toggleFavorite(value, item));
  const submit = (event: FormEvent) => {
    event.preventDefault(); const value = keyword.trim(); if (!value) return;
    const direct = directDestination(value);
    if (direct) { go(direct); return; }
    if (value.length > 100) { notify('搜索关键词最多 100 个字符。'); return; }
    update(old => ({ ...old, searches: [value, ...old.searches.filter(item => item !== value)].slice(0, 10) }));
    go('/search?' + new URLSearchParams({ q: value, order: 'date_d', scope: 's_tag', type: 'all' }));
  };
  const searchTag = (tag: string) => go('/search?' + new URLSearchParams({ q: tag, scope: 's_tag_full' }));
  const changeParam = (key: string, value: string) => { const next = new URLSearchParams(params); next.set(key, value); if (key !== 'page') next.delete('page'); go((isHome ? '/ranking' : path) + '?' + next); };
  const saved = new Set(library.favorites.map(item => item.id));
  const localItems = (isFavorites ? library.favorites : library.history.map(item => item.artwork)).filter(item => (item.title + ' ' + item.userName + ' ' + item.id + ' ' + item.tags.join(' ')).toLowerCase().includes(localQuery.toLowerCase()));
  const title = isSearch ? query : isRanking ? '这一刻，值得看见。' : isFavorites ? '把喜欢，留在这里。' : isHistory ? '再看一眼，那时的心动。' : userMatch ? result?.user?.name || '画师的作品' : '为日常，添一点色彩。';
  const known = isHome || isSearch || isRanking || isFavorites || isHistory || isSettings || !!artworkMatch || !!userMatch;

  return <div className="pixiv-app">
    <aside className="sidebar"><a className="brand" href="/" onClick={event => { event.preventDefault(); go('/'); }}><span className="brand-icon"><Palette size={24} strokeWidth={1.5} /></span><span><strong>Yukino <em>Pixiv</em></strong><small>A LITTLE ART ROOM</small></span></a><p className="nav-label">画廊 / GALLERY</p><nav aria-label="画廊导航">{[[Home, '发现作品', '/'], [Trophy, '排行榜', '/ranking'], [Heart, '我的收藏', '/favorites'], [Clock3, '浏览足迹', '/history'], [Settings2, '偏好与备份', '/settings']].map(([Icon, label, href]) => { const Mark = Icon as typeof Home; return <a key={String(href)} href={String(href)} className={path === href ? 'active' : ''} aria-current={path === href ? 'page' : undefined} onClick={event => { event.preventDefault(); go(String(href)); }}><Mark size={18} /><span>{String(label)}</span>{href === '/favorites' && <small>{library.favorites.length}</small>}</a>; })}</nav>
      <div className="sidebar-note"><span className="note-art"><Palette size={31} strokeWidth={1} /></span><p>遇见一幅画，<br />收好一个小小的瞬间。</p><small>MAKE ROOM FOR INSPIRATION</small></div><div className="sidebar-bottom"><span>Yukino · 个人艺术空间</span><a href="https://www.yukino.bond/">返回主站 <ArrowUpRight size={13} /></a></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><span className="mobile-mark"><Palette size={20} /></span><span>Yukino</span><span>/</span><strong>{labels[path] || (userMatch ? '画师作品' : '作品详情')}</strong></div><div className="topbar-right"><span className="public-label"><span />公开作品 · 免登录浏览</span><button className="icon-button" aria-label="切换明暗主题" onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button></div></header>
      <main className="content">
        {artworkMatch ? <Detail key={artworkMatch[1]} id={artworkMatch[1]} go={go} library={library} update={update} notify={notify} /> : isSettings ? <>
          <div className="page-intro"><span className="eyebrow">YOUR OWN LITTLE ROOM</span><h1>让画廊，更合心意。</h1><p>收藏与足迹保存在当前浏览器，随时可以带走。</p></div><section className="settings-panel"><h2>明暗主题</h2><p>给眼睛选一种舒服的光线。</p><div className="actions"><button className={theme === 'light' ? 'primary' : 'button'} onClick={() => setTheme('light')}><Sun size={17} />日间</button><button className={theme === 'dark' ? 'primary' : 'button'} onClick={() => setTheme('dark')}><Moon size={17} />夜间</button></div></section>
          <section className="settings-panel"><h2>收藏与足迹备份</h2><p>本机有 {library.favorites.length} 件收藏、{library.history.length} 条足迹。导入时合并收藏，保留较新的浏览位置。</p><div className="actions"><button className="primary" onClick={() => { const blob = new Blob([exportLibrary(library)], { type: 'application/json' }), url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `yukino-pixiv-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); }}><Download size={16} />导出备份</button><button className="button" onClick={() => fileInput.current?.click()}><Upload size={16} />导入备份</button><input ref={fileInput} className="sr-only" type="file" accept=".json,application/json" aria-label="选择画廊备份" onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.size > 2_000_000) { notify('备份文件不能超过 2 MB。'); return; } try { const source = await file.text(), next = importLibrary(source, libraryRef.current); writeLibrary(next); libraryRef.current = next; setLibrary(next); notify('备份已合并到本机画廊。'); } catch (error) { notify(errorText(error)); } }} /></div><small>备份只包含作品信息与浏览位置，图片需联网加载；更换浏览器前请先导出。</small></section>
          <section className="settings-panel about-panel"><h2>关于这间画廊</h2><p>通过 Pixiv 的公开网页接口搜索与展示作品。排行榜按源站实际榜单日期显示，关键词搜索支持最新与最早发布排序。账号受限、付费及非公开内容请到原站查看；动图在本站展示封面。</p><p>界面与服务独立编写，接口设计参考 <a href="https://github.com/FreeNowOrg/PixivNow" target="_blank" rel="noreferrer">PixivNow <ExternalLink size={12} /></a>。本站与 pixiv Inc. 无隶属关系，作品版权归各自作者所有。</p></section>
        </> : !known ? <Empty title="这里还没有画作"><p>这个页面不存在。</p><button className="primary" onClick={() => go('/')}>回到画廊</button></Empty> : <>
          {isHome ? <section className="hero"><div className="hero-copy"><span className="eyebrow">YUKINO ART ROOM / 01</span><h1>为日常，<br />添一点<span>色彩。</span></h1><p>寻找喜欢的插画，与灵感不期而遇。</p><SearchBox value={keyword} setValue={setKeyword} submit={submit} /><div className="hero-hints"><span>试着搜</span>{['風景', '初音ミク', 'オリジナル'].map(tag => <button key={tag} onClick={() => searchTag(tag)}>{tag}<ArrowUpRight size={11} /></button>)}</div></div><div className="hero-art" aria-hidden="true"><div className="art-paper paper-back" /><div className="art-paper paper-front"><div className="drawn-sun" /><div className="drawn-hill hill-back" /><div className="drawn-hill hill-front" /><span>A WINDOW TO WONDER</span></div><div className="art-flower">✳</div><span className="hero-art-caption">A LITTLE COLOUR, EVERY DAY.</span></div></section> : <div className="page-intro"><span className="eyebrow">{isSearch ? 'SEARCH / FIND YOUR INSPIRATION' : isFavorites ? 'SAVED WITH LOVE' : isHistory ? 'RECENT MOMENTS' : userMatch ? 'ARTIST / PUBLIC WORKS' : 'PIXIV RANKING'}</span><h1>{title}</h1><p>{isSearch ? '按标签或作品标题，继续寻找喜欢的画面。' : isFavorites ? '一件件收好喜欢的作品，只属于这台设备的收藏夹。' : isHistory ? '最近打开的 120 件作品，多图作品会记住上次看到的位置。' : userMatch ? result?.user?.comment || '按最新发布顺序，浏览画师的公开插画与漫画。' : '从 Pixiv 的榜单里，发现今天的灵感。'}</p></div>}
          {isSearch || isRanking || userMatch ? <div className="compact-search"><SearchBox value={keyword} setValue={setKeyword} submit={submit} /></div> : null}
          {isFavorites || isHistory ? <>
            <div className="collection-toolbar"><span>{localItems.length} 件作品{localQuery && ' · 已筛选'}</span><label><Search size={16} /><input aria-label="筛选本机作品" placeholder="在本机作品中查找" value={localQuery} onChange={event => setLocalQuery(event.target.value)} /></label></div>
            {localItems.length ? <div className="art-grid">{localItems.map(item => <Card key={item.id} item={item} saved={saved.has(item.id)} go={go} favorite={favorite} />)}</div> : <Empty title={localQuery ? '没有匹配的本机作品' : isFavorites ? '喜欢的画，会在这里相遇。' : '从第一件喜欢的作品开始。'}><p>{localQuery ? '换一个标题、画师或 PID 试试。' : isFavorites ? '点击作品旁的爱心，把灵感留在这间画廊。' : '打开一件作品，这里会记住你的浏览位置。'}</p><button className="button" onClick={() => go('/')}>去发现作品<ArrowUpRight size={15} /></button></Empty>}
          </> : <section className="discovery-section"><div className="section-heading"><div><span className="eyebrow">{isHome ? 'DAILY INSPIRATION' : isSearch ? 'SEARCH RESULTS' : userMatch ? 'ARTWORKS' : 'THE ART OF THE MOMENT'}</span><h2>{isHome ? '今日的灵感' : isSearch ? '找到的作品' : userMatch ? '画师作品集' : '看看大家喜欢什么'}{result && <small>{isSearch || userMatch ? `${count(result.total)} 件` : `${result.items.length} 件公开作品`}</small>}</h2></div>{isHome ? <button className="text-button" onClick={() => go('/ranking')}>全部榜单<ArrowUpRight size={15} /></button> : result && <button className="icon-button" aria-label="重新加载作品" onClick={remote.retry}><RefreshCw size={16} /></button>}</div>
            {(isHome || isRanking) && <div className="ranking-filters"><div className="tabs" aria-label="榜单类型">{rankOptions.map(([key, label]) => <button className={mode === key ? 'selected' : ''} key={key} aria-pressed={mode === key} onClick={() => changeParam('mode', key)}>{label}</button>)}</div>{result?.date && <span className="ranking-date">榜单日期 {result.date.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1.$2.$3')}</span>}</div>}
            {isSearch && <div className="search-filters"><label>作品类型<select aria-label="作品类型" value={params.get('type') || 'all'} onChange={event => changeParam('type', event.target.value)}><option value="all">全部作品</option><option value="illustrations">插画 / 动图</option><option value="manga">漫画</option></select></label><label>匹配方式<select aria-label="匹配方式" value={params.get('scope') || 's_tag'} onChange={event => changeParam('scope', event.target.value)}><option value="s_tag">标签包含</option><option value="s_tag_full">标签完全一致</option><option value="s_tc">标题与说明</option></select></label><label>排序<select aria-label="搜索排序" value={params.get('order') || 'date_d'} onChange={event => changeParam('order', event.target.value)}><option value="date_d">最新发布</option><option value="date">最早发布</option></select></label></div>}
            {remote.error ? <ErrorNotice error={remote.error} retry={remote.retry} source={isSearch ? 'https://www.pixiv.net/tags/' + encodeURIComponent(query) + '/artworks' : userMatch ? 'https://www.pixiv.net/users/' + userMatch[1] : 'https://www.pixiv.net/ranking.php'} /> : remote.loading ? <Skeleton /> : result?.items.length ? <div className="art-grid">{result.items.map(item => <Card key={item.id} item={item} saved={saved.has(item.id)} go={go} favorite={favorite} />)}</div> : <Empty title="这次还没有遇到喜欢的画"><p>试试其他关键词或筛选条件。仅展示可匿名浏览的公开作品。</p></Empty>}
            {result && <><div className="result-foot"><span><Check size={12} />来自 Pixiv 的公开作品</span><span>获取于 {new Date(result.fetchedAt).toLocaleString('zh-CN', { hour12: false })}</span></div><Pager page={page} next={result.hasNext} change={value => changeParam('page', String(value))} busy={remote.loading} /></>}
            {isSearch && !!result?.relatedTags?.length && <div className="topic-section"><span>相关标签</span><div className="tag-list">{result.relatedTags.map(tag => <button key={tag} onClick={() => searchTag(tag)}>#{tag}</button>)}</div></div>}
          </section>}
          {isHome && <section className="topic-section"><div className="section-heading"><div><span className="eyebrow">FOLLOW YOUR CURIOSITY</span><h2>从一个标签开始</h2></div></div><div className="topic-pills">{topics.map(tag => <button key={tag} onClick={() => searchTag(tag)}><span>#</span>{tag}<ArrowUpRight size={14} /></button>)}</div>{library.searches.length > 0 && <div className="recent-searches"><Clock3 size={14} /><span>最近搜过</span>{library.searches.slice(0, 5).map(tag => <button key={tag} onClick={() => go('/search?' + new URLSearchParams({ q: tag }))}>{tag}</button>)}</div>}</section>}
        </>}
      </main><footer className="footer"><span>Yukino Pixiv <span className="footer-dot">·</span> 给灵感留一个位置。</span><span>作品属于原作者 <span className="footer-dot">/</span><a href="https://www.pixiv.net" target="_blank" rel="noreferrer">pixiv.net <ArrowUpRight size={11} /></a></span></footer>
    </div>{toast && <div className="toast" role="status"><span>{toast}</span><button aria-label="关闭提示" onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>;
}
