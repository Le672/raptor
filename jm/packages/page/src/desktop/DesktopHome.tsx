import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Clock3, Download, Heart, LibraryBig, LoaderCircle, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { getBatchAlbum, type BatchAlbumItem } from '../api';
import { CoverImage } from '../home/CoverImage';
import { useSearchState } from '../home/useSearchState';
import { useAlbumBatch } from '../home/useAlbumBatch';
import { FAVORITES_CHANGED, readFavorites, toggleFavorite } from '../home/favorites';
import { useDownloads } from '../home/useDownloads';
import { TaskContext, useTasks } from '../home/task-context';
import { buildCombinedDownload, buildSingleDownload, downloadLimit, parseSeriesOrder } from '../home/download-utils';
import type { DownloadFormat, DownloadTarget } from '../home/types';

type View = 'discover' | 'library' | 'downloads';
type SearchItem = { id: string; name: string; author: string };
type Order = 'mr' | 'mv' | 'mp' | 'tf';
type Period = 'a' | 't' | 'w' | 'm';
type Category = '0' | '1' | '2' | '3' | '4';

const categoryOptions: { value: Category; label: string }[] = [
  { value: '0', label: '全部' }, { value: '1', label: '作品名称' },
  { value: '2', label: '作者' }, { value: '3', label: '标签' }, { value: '4', label: '角色' },
];
const orderOptions: { value: Order; label: string }[] = [
  { value: 'mr', label: '最新发布' }, { value: 'mv', label: '最多浏览' },
  { value: 'mp', label: '最多图片' }, { value: 'tf', label: '最多喜欢' },
];
const periodOptions: { value: Period; label: string }[] = [
  { value: 'a', label: '全部时间' }, { value: 't', label: '今天' },
  { value: 'w', label: '本周' }, { value: 'm', label: '本月' },
];

function Cover({ item, data, className = '' }: { item: SearchItem; data?: BatchAlbumItem; className?: string }) {
  const photo = data?.photo;
  return <div className={`desk-cover ${className}`}>
    {photo?.images[0]
      ? <CoverImage coverUrl={photo.images[0].url} scrambleId={photo.scrambleId} albumId={item.id} className="desk-cover-img" />
      : <div className="desk-cover-empty"><BookOpen size={29} strokeWidth={1.1} /></div>}
  </div>;
}

function QueueButton({ targets, format, combined = false, label }: {
  targets: DownloadTarget[]; format: DownloadFormat; combined?: boolean; label: string;
}) {
  const { tasks, addTask, updateTask } = useTasks();
  const busy = tasks.some(task => task.albumId === targets.map(item => item.id).join(',')
    && task.format === format && task.stage !== 'completed' && task.stage !== 'error');

  const queue = () => {
    if (!targets.length || busy) return;
    const name = targets.length === 1 ? targets[0].name : `${targets[0].name} 等 ${targets.length} 话`;
    const albumId = targets.map(item => item.id).join(',');
    const { id, signal } = addTask({ albumId, name, format, stage: 'processing', progress: 0, total: 1 });
    void downloadLimit(async () => {
      try {
        if (combined && targets.length > 1) {
          await buildCombinedDownload(targets, format, name, updates => updateTask(id, updates), signal);
        } else {
          await buildSingleDownload(targets[0], format, updates => updateTask(id, updates), signal);
        }
      } catch (error) {
        if (!signal.aborted) updateTask(id, {
          stage: 'error', error: error instanceof Error ? error.message : String(error), progress: 0, total: 1,
        });
      }
    });
  };
  return <button type="button" className="desk-export-button" disabled={busy || !targets.length} onClick={queue}>
    {busy ? <LoaderCircle size={15} className="desk-spin" /> : <ArrowDownToLine size={15} />}
    <span>{label}</span>
  </button>;
}

function DetailPanel({ id, cachedData, isFavorite, onFavorite, onClose }: {
  id: string; cachedData?: BatchAlbumItem; isFavorite: boolean;
  onFavorite: (item: SearchItem) => void; onClose: () => void;
}) {
  const navigate = useNavigate();
  const detail = useQuery<BatchAlbumItem>({
    queryKey: ['desktop-album', id],
    queryFn: async ({ signal }) => {
      const found = (await getBatchAlbum([id], signal)).find(item => item.albumId === id);
      if (!found) throw new Error('没有找到作品详情');
      return found;
    },
    initialData: cachedData && !cachedData.error ? cachedData : undefined,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const album = detail.data?.album;
  const photo = detail.data?.photo;
  const chapters = useMemo(() => album?.series?.length
    ? [...album.series].sort((a, b) => parseSeriesOrder(a.sort) - parseSeriesOrder(b.sort))
    : [], [album]);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => setSelected([]), [id]);
  const selectedChapters = selected.length ? chapters.filter(item => selected.includes(item.id)) : chapters;
  const targets: DownloadTarget[] = selectedChapters.map((item, index) => ({
    id: item.id, name: `${album?.name ?? id} - ${item.name || `第 ${index + 1} 话`}`, order: parseSeriesOrder(item.sort),
  }));
  const singleTarget: DownloadTarget[] = [{ id, name: album?.name ?? id, order: 1 }];
  const openReader = (chapterId: string) => navigate(`/reader/${chapterId}`, {
    state: chapters.length ? {
      isSeries: true, album,
      seriesItems: chapters.map((item, index) => ({ id: item.id, name: item.name || `第 ${index + 1} 话`, order: parseSeriesOrder(item.sort) })),
    } : { album, photo },
  });

  return <aside className="desk-detail" aria-label="作品详情">
    <div className="desk-detail-top"><span>作品详情 <span className="desk-mono">/ {id}</span></span><button aria-label="关闭详情" onClick={onClose}><X size={18} /></button></div>
    {detail.isPending ? <div className="desk-detail-message"><LoaderCircle className="desk-spin" /> 正在获取详情…</div>
      : detail.isError || detail.data?.error || !album ? <div className="desk-detail-message desk-error">
        <p>{detail.data?.error?.message ?? (detail.error instanceof Error ? detail.error.message : '详情加载失败')}</p>
        <button className="desk-link" onClick={() => void detail.refetch()}>重新加载</button>
      </div> : <div className="desk-detail-scroll">
        <div className="desk-detail-hero">
          <Cover item={{ id, name: album.name, author: album.author.join('、') }} data={detail.data} className="desk-detail-cover" />
          <div className="desk-detail-hero-copy"><span className="desk-eyebrow">COLLECTION / #{id}</span><h2>{album.name}</h2><p>{album.author.join('、') || '作者未标注'}</p></div>
        </div>
        <div className="desk-detail-actions">
          <button className="desk-primary" onClick={() => openReader(chapters[0]?.id ?? id)}><BookOpen size={17} /> 开始阅读</button>
          <button className={`desk-heart ${isFavorite ? 'active' : ''}`} aria-label={isFavorite ? '取消收藏' : '收藏作品'} onClick={() => onFavorite({ id, name: album.name, author: album.author.join('、') })}><Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} /></button>
        </div>
        <div className="desk-stats"><div><strong>{chapters.length || 1}</strong><span>章节</span></div><div><strong>{photo?.images.length ?? '—'}</strong><span>当前页数</span></div><div><strong>{album.totalViews || '—'}</strong><span>浏览</span></div></div>
        {album.description && <p className="desk-description">{album.description}</p>}
        {!!album.tags.length && <div className="desk-tags">{album.tags.slice(0, 12).map(tag => <span key={tag}>{tag}</span>)}</div>}
        {chapters.length > 0 && <section className="desk-chapters">
          <div className="desk-section-heading"><div><span className="desk-eyebrow">READING ORDER</span><h3>章节目录</h3></div><span>{chapters.length} 话</span></div>
          <div className="desk-chapter-list">{chapters.map((chapter, index) => <div className="desk-chapter" key={chapter.id}>
            <label><input type="checkbox" checked={selected.includes(chapter.id)} onChange={() => setSelected(current => current.includes(chapter.id) ? current.filter(value => value !== chapter.id) : [...current, chapter.id])} /><span>{String(index + 1).padStart(2, '0')}</span><span className="desk-chapter-name">{chapter.name || `第 ${index + 1} 话`}</span></label>
            <button aria-label={`阅读 ${chapter.name}`} onClick={() => openReader(chapter.id)}><ChevronRight size={17} /></button>
          </div>)}</div>
        </section>}
        <section className="desk-export"><div className="desk-section-heading"><div><span className="desk-eyebrow">SAVE FOR LATER</span><h3>导出到电脑</h3></div></div>
          <p>{chapters.length ? selected.length ? `导出选中的 ${selected.length} 话` : `导出全部 ${chapters.length} 话` : '导出当前作品'}</p>
          <div className="desk-export-row">{(['pdf', 'zip', 'cbz'] as const).map(format => <QueueButton key={format} targets={chapters.length ? targets : singleTarget} combined={chapters.length > 0} format={format} label={format.toUpperCase()} />)}</div>
        </section>
      </div>}
  </aside>;
}

function Workspace() {
  const [view, setView] = useState<View>('discover');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState(readFavorites);
  const { tasks, removeTask, clearCompleted } = useTasks();
  const searchState = useSearchState(() => setSelectedId(null));
  const { albumCache, getCardRef } = useAlbumBatch(searchState.data);
  const currentItems = searchState.data?.content ?? [];
  const activeCount = tasks.filter(task => task.stage === 'processing' || task.stage === 'finalizing').length;
  const favoriteItems: SearchItem[] = favorites.map(item => ({ id: item.id, name: item.name, author: item.author }));

  useEffect(() => {
    const refresh = () => setFavorites(readFavorites());
    window.addEventListener(FAVORITES_CHANGED, refresh);
    return () => window.removeEventListener(FAVORITES_CHANGED, refresh);
  }, []);
  useEffect(() => {
    if (searchState.redirectAid) setSelectedId(searchState.redirectAid);
  }, [searchState.redirectAid]);

  const searchSubmit = (event: FormEvent) => {
    setView('discover');
    searchState.handleSubmit(event);
  };
  const setSearchFilter = (kind: 'category' | 'order' | 'time', value: string) => {
    const category = kind === 'category' ? value as Category : searchState.category;
    const order = kind === 'order' ? value as Order : searchState.orderBy;
    const time = kind === 'time' ? value as Period : searchState.timeFilter;
    searchState.setCategory(category); searchState.setOrderBy(order); searchState.setTimeFilter(time);
    if (searchState.urlQuery) searchState.pushSearch(searchState.urlQuery, category, order, time, 1);
  };

  return <div className="desktop-shell">
    <aside className="desk-sidebar">
      <div className="desk-brand"><div className="desk-brand-icon"><BookOpen size={23} /></div><div><strong>YUKINO</strong><span>COMIC STUDIO</span></div></div>
      <div className="desk-sidebar-label">WORKSPACE</div>
      <nav className="desk-nav" aria-label="主导航">
        <button className={view === 'discover' ? 'active' : ''} onClick={() => setView('discover')}><Search size={19} />探索作品</button>
        <button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><LibraryBig size={19} />我的收藏 <span>{favorites.length}</span></button>
        <button className={view === 'downloads' ? 'active' : ''} onClick={() => setView('downloads')}><Download size={19} />下载任务 {activeCount > 0 && <i>{activeCount}</i>}</button>
      </nav>
      <div className="desk-sidebar-bottom"><div className="desk-online-dot" /><span>云端资料源已连接</span><small>桌面版 · Windows</small></div>
    </aside>
    <main className="desk-main">
      <header className="desk-toolbar"><div><span className="desk-eyebrow">YOUR PERSONAL READING SPACE</span><h1>{view === 'discover' ? '发现好作品' : view === 'library' ? '我的书架' : '下载中心'}</h1></div><div className="desk-toolbar-badge"><Sparkles size={15} /> YUKINO DESKTOP</div></header>
      {view === 'discover' && <>
        <form className="desk-search" onSubmit={searchSubmit}><Search size={21} /><input aria-label="搜索漫画" placeholder="搜索作品、作者、标签或编号…" value={searchState.query} onChange={searchState.handleQueryChange} /><button type="submit">搜索作品 <ArrowRight size={16} /></button></form>
        {searchState.queryError && <p className="desk-error desk-inline-error">{searchState.queryError}</p>}
        <div className="desk-filters"><span><SlidersHorizontal size={16} /> 筛选</span><select aria-label="搜索类别" value={searchState.category} onChange={event => setSearchFilter('category', event.target.value)}>{categoryOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select aria-label="排序方式" value={searchState.orderBy} onChange={event => setSearchFilter('order', event.target.value)}>{orderOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select aria-label="时间范围" value={searchState.timeFilter} onChange={event => setSearchFilter('time', event.target.value)}>{periodOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
        <div className="desk-results-bar"><div><span className="desk-eyebrow">DISCOVER</span><h2>{searchState.urlQuery ? `“${searchState.urlQuery}” 的结果` : '从搜索开始'}</h2></div><span>{searchState.searchPending ? '检索中…' : searchState.totalCount ? `共 ${searchState.totalCount} 部作品` : ''}</span></div>
        <div className="desk-scroll" ref={searchState.listRef}>
          {searchState.isSearchError && <div className="desk-empty desk-error"><p>搜索暂时失败，请稍后再试。</p><button onClick={() => void searchState.refetchSearch()}>重新搜索</button></div>}
          {!searchState.urlQuery && <div className="desk-welcome"><div className="desk-welcome-art"><BookOpen size={66} strokeWidth={0.85} /></div><span className="desk-eyebrow">A QUIETER WAY TO READ</span><h2>你的漫画书房，已准备就绪。</h2><p>在上方输入作品名称、作者或编号，开始探索。打开作品后可阅读、收藏和导出到电脑。</p></div>}
          {searchState.searchPending && !searchState.data && <div className="desk-empty"><LoaderCircle className="desk-spin" /> 正在寻找作品…</div>}
          {searchState.data && currentItems.length === 0 && !searchState.redirectAid && !searchState.searchPending && <div className="desk-empty">没有找到相关作品，换个关键词试试。</div>}
          {currentItems.length > 0 && <div className="desk-grid">{currentItems.map(item => <div role="button" tabIndex={0} className={`desk-card ${selectedId === item.id ? 'selected' : ''}`} key={item.id} ref={getCardRef(item.id)} data-album-id={item.id} onClick={() => setSelectedId(item.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(item.id); } }}><Cover item={item} data={albumCache.get(item.id)} /><div className="desk-card-info"><strong title={item.name}>{item.name}</strong><span>{item.author || '作者未标注'}</span><small>#{item.id}</small></div></div>)}</div>}
          {searchState.totalPages > 1 && <div className="desk-pagination"><button disabled={!searchState.hasPrevPage || searchState.searchPending} onClick={() => searchState.handlePageChange(searchState.urlPage - 1)}><ArrowLeft size={16} /> 上一页</button><span>{searchState.urlPage} / {searchState.totalPages}</span><button disabled={!searchState.hasNextPage || searchState.searchPending} onClick={() => searchState.handlePageChange(searchState.urlPage + 1)}>下一页 <ArrowRight size={16} /></button></div>}
        </div>
      </>}
      {view === 'library' && <div className="desk-scroll"><div className="desk-results-bar"><div><span className="desk-eyebrow">SAVED COLLECTION</span><h2>喜欢的作品</h2></div><span>{favorites.length} 部</span></div>{favoriteItems.length ? <div className="desk-library-list">{favoriteItems.map(item => <button key={item.id} onClick={() => setSelectedId(item.id)}><div className="desk-library-icon"><BookOpen size={21} /></div><div><strong>{item.name}</strong><span>{item.author || `#${item.id}`}</span></div><ChevronRight size={18} /></button>)}</div> : <div className="desk-empty"><Heart size={31} /><p>书架还空着。找到喜欢的作品后，点击详情中的爱心即可收藏。</p></div>}</div>}
      {view === 'downloads' && <div className="desk-scroll"><div className="desk-results-bar"><div><span className="desk-eyebrow">EXPORT QUEUE</span><h2>下载任务</h2></div>{tasks.length > 0 && <button className="desk-link" onClick={clearCompleted}>清除已结束任务</button>}</div>{tasks.length ? <div className="desk-task-list">{tasks.map(task => <div className="desk-task" key={task.id}><div className="desk-task-icon">{task.stage === 'completed' ? <Check size={21} /> : <Download size={21} />}</div><div className="desk-task-body"><div><strong>{task.name}</strong><span>{task.format.toUpperCase()}</span></div><p>{task.error || (task.stage === 'completed' ? '文件已生成' : task.stage === 'finalizing' ? '正在写入文件…' : '正在处理图片…')}</p><div className="desk-progress"><span style={{ width: `${task.total ? Math.min(100, task.progress / task.total * 100) : 0}%` }} /></div></div><button aria-label={`移除 ${task.name}`} onClick={() => removeTask(task.id)}><X size={17} /></button></div>)}</div> : <div className="desk-empty"><Clock3 size={31} /><p>暂无下载任务。打开作品详情，选择 PDF、ZIP 或 CBZ。</p></div>}</div>}
    </main>
    {selectedId && <DetailPanel key={selectedId} id={selectedId} cachedData={albumCache.get(selectedId)} isFavorite={favorites.some(item => item.id === selectedId)} onFavorite={item => setFavorites(toggleFavorite(item))} onClose={() => setSelectedId(null)} />}
  </div>;
}

export default function DesktopHome() {
  const downloads = useDownloads();
  return <TaskContext.Provider value={downloads.taskContextValue}><Workspace /></TaskContext.Provider>;
}
