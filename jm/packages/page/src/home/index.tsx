import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Heart, RefreshCw, Search, Sparkles } from "lucide-react";
import { TaskContext } from "./task-context";
import { useSearchState } from "./useSearchState";
import { useAlbumBatch } from "./useAlbumBatch";
import { useDownloads } from "./useDownloads";
import { TaskPanel } from "./TaskPanel";
import { AlbumModal } from "./AlbumModal";
import { AlbumCard } from "./AlbumCard";
import { CoverImage } from "./CoverImage";
import { ThemePopover } from "../theme/ThemeControls";
import { FAVORITES_CHANGED, readFavorites, toggleFavorite } from "./favorites";
import "./home.css";

const categories = [
    ["0", "全部内容"], ["1", "作品名称"], ["2", "作者"], ["3", "标签"], ["4", "角色"],
] as const;

export default function Home() {
    const [modalAlbumId, setModalAlbumId] = useState<string | null>(null);
    const [view, setView] = useState<'search' | 'favorites'>('search');
    const [favorites, setFavorites] = useState(readFavorites);

    useEffect(() => {
        const refresh = () => setFavorites(readFavorites());
        window.addEventListener(FAVORITES_CHANGED, refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener(FAVORITES_CHANGED, refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);

    const {
        urlQuery, urlPage,
        query, category, setCategory, orderBy, setOrderBy, timeFilter, setTimeFilter,
        queryError, data, isSearchError, searchPending, refetchSearch, fallbackSearch,
        totalCount, totalPages, hasNextPage, hasPrevPage,
        redirectAid, hasResults,
        pushSearch, handleQueryChange, handleSubmit, handlePageChange,
        listRef,
    } = useSearchState(() => setModalAlbumId(null));

    const { showTaskPanel, setShowTaskPanel, taskContextValue, clearCompleted } = useDownloads();
    const { albumCache, getCardRef } = useAlbumBatch(data);

    return (
        <TaskContext.Provider value={taskContextValue}>
            <div className="jm-web-shell">
                {showTaskPanel && <TaskPanel onClose={() => { setShowTaskPanel(false); clearCompleted(); }} />}
                {modalAlbumId && <AlbumModal
                    albumId={modalAlbumId}
                    cachedData={albumCache.get(modalAlbumId)}
                    isFavorite={favorites.some(item => item.id === modalAlbumId)}
                    onToggleFavorite={item => toggleFavorite(item)}
                    onClose={() => setModalAlbumId(null)}
                />}

                <header className="jm-site-header">
                    <div className="jm-header-inner">
                        <a className="jm-brand" href="https://www.yukino.bond/" aria-label="返回 Yukino 主站">
                            <span className="jm-brand-mark">雪</span>
                            <span>Yukino<span className="jm-brand-dot">.</span></span>
                            <span className="jm-brand-divider" />
                            <span className="jm-brand-section">COMIC LIBRARY</span>
                        </a>
                        <nav className="jm-header-actions" aria-label="站点导航">
                            <a className="jm-back-link" href="https://www.yukino.bond/"><ArrowLeft size={15} /> 主站</a>
                            <button className="jm-task-button" type="button" onClick={() => setShowTaskPanel(true)}>
                                <BookOpen size={15} /> 下载任务
                            </button>
                            <ThemePopover className="jm-theme-trigger" />
                        </nav>
                    </div>
                </header>

                <main className="jm-main">
                    <section className="jm-intro" aria-labelledby="jm-title">
                        <div className="jm-intro-copy">
                            <p className="jm-eyebrow"><span className="jm-status-dot" /> A QUIET CORNER FOR COMICS</p>
                            <h1 id="jm-title">慢慢挑一本，<br /><span>慢慢读。</span></h1>
                            <p className="jm-intro-text">在这里发现喜欢的作品，收藏起来，留给一个刚刚好的午后。</p>
                            <a className="jm-home-link" href="https://www.yukino.bond/"><ArrowLeft size={15} /> 回到 Yukino 的小站</a>
                        </div>
                        <div className="jm-intro-art" aria-hidden="true">
                            <div className="jm-art-topline"><span>YUKINO / READING ROOM</span><Sparkles size={17} /></div>
                            <span className="jm-art-kanji">漫</span>
                            <span className="jm-art-orbit jm-art-orbit-one" />
                            <span className="jm-art-orbit jm-art-orbit-two" />
                            <span className="jm-art-sun" />
                            <span className="jm-art-hill jm-art-hill-back" />
                            <span className="jm-art-hill jm-art-hill-front" />
                            <div className="jm-art-caption"><span>今日の一冊</span><span>让故事<br />在纸页间生长。</span></div>
                            <div className="jm-art-foot"><span>READ · SAVE · RETURN</span><span>01 — ∞</span></div>
                        </div>
                    </section>

                    <div className="jm-divider"><span>保持好奇，遇见新的故事。</span><span>搜寻作品 / 收进喜欢 / 随时继续</span></div>

                    <section className="jm-library" aria-label="作品库">
                        <div className="jm-section-heading">
                            <div>
                                <p className="jm-eyebrow">THE COLLECTION</p>
                                <h2>{view === 'search' ? <>找一本<span> / Discover</span></> : <>留下喜欢<span> / Saved</span></>}</h2>
                            </div>
                            <div className="jm-view-tabs" role="tablist" aria-label="内容视图">
                                <button type="button" className={view === 'search' ? 'is-active' : ''} role="tab" aria-selected={view === 'search'} onClick={() => setView('search')}>
                                    发现作品
                                </button>
                                <button type="button" className={view === 'favorites' ? 'is-active' : ''} role="tab" aria-selected={view === 'favorites'} onClick={() => setView('favorites')}>
                                    <Heart size={14} /> 我的收藏 <span className="jm-tab-count">{favorites.length}</span>
                                </button>
                            </div>
                        </div>

                        {view === 'search' && <>
                            <form onSubmit={handleSubmit} className="jm-search-form">
                                <label className="jm-category-wrap">
                                    <span className="jm-sr-only">搜索类别</span>
                                    <select value={category} onChange={event => {
                                        const value = event.target.value as "0" | "1" | "2" | "3" | "4";
                                        setCategory(value);
                                        if (query.trim()) pushSearch(query, value, orderBy, timeFilter, 1);
                                    }}>
                                        {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                </label>
                                <span className="jm-search-divider" />
                                <Search className="jm-search-icon" size={20} aria-hidden="true" />
                                <input name="query" value={query} onChange={handleQueryChange} placeholder="输入作品、作者或标签" aria-label="搜索漫画" aria-invalid={!!queryError} aria-describedby={queryError ? "search-query-error" : undefined} />
                                <button className="jm-search-submit" type="submit" disabled={searchPending} aria-busy={searchPending}>
                                    {searchPending ? <span className="jm-spinner" /> : <>开始搜索 <ArrowRight size={16} /></>}
                                </button>
                            </form>
                            {queryError && <p id="search-query-error" role="alert" className="jm-field-error">{queryError}</p>}

                            <div className="jm-filter-row">
                                <span className="jm-filter-label">整理方式</span>
                                <label><span className="jm-sr-only">排序方式</span><select value={orderBy} onChange={event => {
                                    const value = event.target.value as "mr" | "mv" | "mp" | "tf";
                                    setOrderBy(value);
                                    if (query.trim()) pushSearch(urlQuery, category, value, timeFilter, 1);
                                }}>
                                    <option value="mr">最新发布</option><option value="mv">最多浏览</option><option value="mp">最多图片</option><option value="tf">最多喜欢</option>
                                </select></label>
                                <label><span className="jm-sr-only">时间范围</span><select value={timeFilter} onChange={event => {
                                    const value = event.target.value as "a" | "t" | "w" | "m";
                                    setTimeFilter(value);
                                    if (query.trim()) pushSearch(urlQuery, category, orderBy, value, 1);
                                }}>
                                    <option value="a">全部时间</option><option value="t">今天</option><option value="w">本周</option><option value="m">本月</option>
                                </select></label>
                                <span className="jm-filter-note">用一点时间，找到想读的故事。</span>
                            </div>

                            {isSearchError && <div className="jm-error-banner" role="alert">
                                <div><strong>第 {urlPage} 页暂时没有载入</strong><span>{fallbackSearch ? '先为你保留上一次成功加载的结果。' : '请检查网络连接，或稍后再试。'}</span></div>
                                <button type="button" onClick={() => { void refetchSearch(); }}><RefreshCw size={14} /> 重试</button>
                            </div>}

                            <div className="jm-results-area" aria-busy={searchPending}>
                                {redirectAid && <button className="jm-direct-match" type="button" onClick={() => setModalAlbumId(redirectAid)}>
                                    <span className="jm-direct-cover">{albumCache.get(redirectAid)?.photo?.images[0] && <CoverImage coverUrl={albumCache.get(redirectAid)!.photo!.images[0].url} scrambleId={albumCache.get(redirectAid)!.photo!.scrambleId} albumId={redirectAid} className="w-full h-full" />}</span>
                                    <span className="jm-direct-copy"><small>DIRECT MATCH</small><strong>{albumCache.get(redirectAid)?.album?.name ?? `作品 #${redirectAid}`}</strong><span>找到直接匹配的作品 <ArrowUpRight size={13} /></span></span>
                                </button>}

                                {hasResults && <>
                                    <div className="jm-result-meta"><span>搜索结果</span><span>{totalCount.toLocaleString()} 部作品</span></div>
                                    <div ref={listRef} className="jm-results-scroll">
                                        <div className="jm-results-grid">
                                            {data.content.map(item => <AlbumCard key={item.id} item={item} cachedData={albumCache.get(item.id)} onClick={() => setModalAlbumId(item.id)} cardRef={getCardRef(item.id)} />)}
                                        </div>
                                    </div>
                                </>}

                                {searchPending && !data && <div className="jm-state-panel" role="status"><span className="jm-spinner jm-spinner-dark" /><span>正在翻找作品…</span></div>}
                                {!data && !searchPending && <div className="jm-state-panel jm-welcome-state"><span className="jm-state-ornament">✳</span><strong>从一个关键词开始</strong><span>搜索作品名、作者、标签或角色，发现下一本喜欢的故事。</span></div>}
                                {data && "content" in data && data.content.length === 0 && !redirectAid && <div className="jm-state-panel jm-welcome-state"><span className="jm-state-ornament">⌕</span><strong>还没有找到这本故事</strong><span>试试更短的关键词，或换一种搜索类别。</span></div>}
                            </div>

                            {totalCount > 0 && <div className="jm-pagination">
                                <span>{totalCount.toLocaleString()} 部作品 <i /> 第 {urlPage} / {totalPages} 页</span>
                                <div>
                                    <button type="button" disabled={urlPage === 1 || searchPending} onClick={() => handlePageChange(1)}>首页</button>
                                    <button type="button" disabled={!hasPrevPage || searchPending} onClick={() => handlePageChange(urlPage - 1)}>上一页</button>
                                    <button className="jm-page-next" type="button" disabled={!hasNextPage || searchPending || isSearchError} onClick={() => handlePageChange(urlPage + 1)}>下一页 <ArrowRight size={14} /></button>
                                    <button type="button" disabled={urlPage === totalPages || searchPending || isSearchError} onClick={() => handlePageChange(totalPages)}>末页</button>
                                </div>
                            </div>}
                        </>}

                        {view === 'favorites' && <div className="jm-favorites-panel" role="tabpanel">
                            {favorites.length === 0 ? <div className="jm-state-panel jm-welcome-state"><span className="jm-state-ornament">♡</span><strong>喜欢的作品会留在这里</strong><span>打开作品详情，点一下收藏，下次就能接着找回来。</span><button type="button" className="jm-return-search" onClick={() => setView('search')}>去发现作品 <ArrowRight size={14} /></button></div> : <>
                                <div className="jm-result-meta"><span>本地收藏</span><span>保存于当前浏览器</span></div>
                                <div className="jm-favorites-list">{favorites.map(item => <article key={item.id} className="jm-favorite-row">
                                    <button className="jm-favorite-open" type="button" onClick={() => setModalAlbumId(item.id)}><span className="jm-favorite-cover"><Heart size={15} fill="currentColor" /></span><span className="jm-favorite-copy"><strong>{item.name}</strong><small>{item.author || `作品 #${item.id}`}</small></span><ArrowUpRight size={17} className="jm-favorite-arrow" /></button>
                                    <button className="jm-remove-favorite" type="button" aria-label={`取消收藏 ${item.name}`} onClick={() => toggleFavorite(item)}>移除</button>
                                </article>)}</div>
                            </>}
                        </div>}
                    </section>

                    <footer className="jm-footer"><span>YUKINO / COMIC LIBRARY</span><span>给故事一点安静的空间 <i>✳</i></span><a href="https://www.yukino.bond/">Yukino.bond <ArrowUpRight size={12} /></a></footer>
                </main>
            </div>
        </TaskContext.Provider>
    );
}
