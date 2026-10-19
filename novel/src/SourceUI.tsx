import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightLeft, BookOpen, Check, ChevronRight, Download, ExternalLink, LoaderCircle, RefreshCw, Upload, X } from 'lucide-react';
import { SOURCES, bookSource, sourceInfo } from '../shared/sources.mjs';
import { dateLabel, request, READING_CACHE, type Book, type Envelope, type SearchPage, type SourceStatus, type SourceStatusData } from './api';
import { exportLibrary, importLibrary } from './library';

const stateNames = { ok: '可用', stale: '旧缓存', error: '暂不可用', restricted: '源站限制', limited: '链接直达' };
export function SourceBadge({ book, inline = false }: { book: Book; inline?: boolean }) {
  const source = sourceInfo(book.source || bookSource(book.id)) || SOURCES[0];
  return <span className={`source-badge ${inline ? 'inline' : ''} source-${source.id}`} title={source.kind}>{source.name}</span>;
}
export function SourceSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="source-select"><span className="sr-only">选择书源</span><select aria-label="选择书源" value={value || 'all'} onChange={event => onChange(event.target.value)}>
    <option value="all">全部书源</option>
    {SOURCES.map(source => <option key={source.id} value={source.id}>{source.name}{source.search ? '' : ' · 已知书目'}</option>)}
  </select></label>;
}
export function SourceStateStrip({ sources }: { sources?: SourceStatus[] }) {
  if (!sources?.length) return null;
  return <div className="source-state-wrapper">
    <div className="source-state-strip" aria-label="书源查询状态">{sources.map(source => <span key={source.id} className={`source-state state-${source.state}`} title={source.reason || source.note}>
      <span className="status-dot" />{source.name}<small>{source.state === 'ok' ? `${source.count} 条` : stateNames[source.state]}</small>
    </span>)}</div>
    {sources.filter(source => ['error','restricted','stale'].includes(source.state)).map(source => <p className="source-query-warning" key={source.id} role="status">{source.name}：{source.reason || '当前仅能显示上次获取的数据'}。其他书源不受影响。</p>)}
    {sources.length === 1 && sources[0].id === 'wenku' && <p className="source-query-warning">文库仅搜索已通过链接打开的书目。要添加其他作品，请粘贴源站书籍链接；完整搜索需要前往源站登录。</p>}
  </div>;
}
export function SourceSwitcher({ book }: { book: Book }) {
  const [open, setOpen] = useState(false), [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Envelope<SearchPage> | null>(null), [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setResult(null); setError('');
    request<SearchPage>(`/api/books?source=all&q=${encodeURIComponent(book.title)}${revision ? '&refresh=1' : ''}`, controller.signal)
      .then(setResult).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [open, book.id, book.title, revision]);
  const matches = result?.data.items.filter(item => bookSource(item.id) !== bookSource(book.id)) || [];
  return <div className="source-switcher">
    <button className="text-button" onClick={() => setOpen(value => !value)}><ArrowRightLeft size={14} />其他书源{open ? <X size={13} /> : <ChevronRight size={13} />}</button>
    {open && <div className="source-switch-panel" aria-label="其他书源匹配结果">
      <div className="panel-heading"><strong>其他书源的匹配结果</strong><button className="text-button" onClick={() => setRevision(value => value + 1)}><RefreshCw size={13} />重新查找</button></div>
      <p>请核对书名和作者。切换后进入对应目录，各书源分别保存进度。</p>
      {!result && !error && <div className="source-loading" role="status"><LoaderCircle size={17} className="spin" />正在查询其他书源…</div>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {matches.map(item => <Link key={item.id} to={`/book/${item.id}`} className="source-match"><SourceBadge book={item} inline /><span><strong>{item.title}</strong><small>{item.author || '作者未标注'}</small></span><ChevronRight size={15} /></Link>)}
      {result && !matches.length && <p className="source-no-match">当前返回结果中没有其他版本，可以缩短书名再搜索。</p>}
      <SourceStateStrip sources={result?.data.sources} />
      <Link className="text-button" to={`/?source=all&q=${encodeURIComponent(book.title)}`}>在全部书源中搜索<ChevronRight size={14} /></Link>
    </div>}
  </div>;
}

export function SourceSettings() {
  const [result, setResult] = useState<Envelope<SourceStatusData> | null>(null), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [revision, setRevision] = useState(0), [notice, setNotice] = useState('');
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    request<SourceStatusData>(`/api/status${revision ? '?refresh=1' : ''}`,controller.signal)
      .then(setResult).catch(error => { if(!controller.signal.aborted)setError(error.message); })
      .finally(() => { if(!controller.signal.aborted)setLoading(false); });
    return () => controller.abort();
  },[revision]);
  return <>
    <div className="page-heading"><span className="eyebrow">MORE SHELVES, MORE STORIES</span><h1>书源与设置</h1><p>译文书库与中文原创一起找，每个书源的状态都清楚可见。</p></div>
    <div className="multi-source-heading"><div><strong>{SOURCES.length} 个书源</strong><span>{result ? `当前发现 ${result.data.indexed} 条书源记录` : '正在检查公开书目'}</span></div><button className="button secondary" disabled={loading} onClick={() => setRevision(value=>value+1)}><RefreshCw size={14} className={loading?'spin':''} />检查全部书源</button></div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {loading && <p className="source-loading" role="status"><LoaderCircle size={17} className="spin" />正在检查各书源，结果会保留各自的成功时间…</p>}
    <div className="source-cards">{SOURCES.map(info => {
      const state=result?.data.sources?.find(item=>item.id===info.id);
      return <section className={`provider-card provider-${info.id}`} key={info.id}>
        <div className="provider-heading"><span className="source-logo"><BookOpen size={24} /></span><div><h2>{info.name}</h2><span>{info.kind}</span></div><span className={`provider-state state-${state?.state||'pending'}`}>{state ? stateNames[state.state] : '检查中'}</span></div>
        <p>{info.note}</p>
        <dl><div><dt>当前发现书目</dt><dd>{state ? state.count : '—'} 条</dd></div><div><dt>最近成功获取</dt><dd>{dateLabel(state?.checkedAt,true)}</dd></div><div><dt>搜索范围</dt><dd>{info.id==='bili'?'聚合接口已索引书库':info.id==='wenku'?'已打开的公开书目':'源站当前返回的公开结果'}</dd></div></dl>
        {state && ['error','restricted','stale'].includes(state.state) && <p className="provider-warning" role="status">{state.reason}</p>}
        <div className="source-links"><Link to={`/?source=${info.id}`}>浏览此书源<ChevronRight size={13} /></Link><a href={info.origin} target="_blank" rel="noreferrer">访问源站<ExternalLink size={12} /></a></div>
      </section>;
    })}</div>
    <div className="source-update-note"><Check size={17} /><p>每 15 分钟同步公开更新列表，并轮流检查新增书源的已知书目。访问时按 5 分钟缓存检查；收藏较多时分批检查，每次最多 6 本。更新时间取自源站；某个书源失败时，其余来源继续工作。</p></div>
    <section className="settings-card"><span className="eyebrow">YOUR OWN LITTLE LIBRARY</span><h2>让书签跟着你走</h2><p>收藏、阅读进度与设置保存在此浏览器。旧书架继续保留，同一本书在不同书源的进度分别记录。浏览过的目录和章节会自动缓存，明确受限的章节不会用旧缓存冒充可读正文。备份仅含书目和进度。</p>
      <div className="button-group"><button className="button" onClick={exportLibrary}><Download size={15} />导出书架与进度</button><button className="button secondary" onClick={()=>file.current?.click()}><Upload size={15} />导入备份</button><button className="text-button" onClick={async()=>{await caches.delete(READING_CACHE).catch(()=>false);setNotice('已清理阅读缓存，书架和进度保留。');}}>清理阅读缓存</button>
        <input className="sr-only" type="file" ref={file} accept=".json,application/json" aria-label="导入书架备份文件" onChange={async event=>{const upload=event.target.files?.[0];if(!upload)return;try{if(upload.size>3*1024*1024)throw new Error('备份文件不能超过 3 MB');importLibrary(await upload.text());setNotice('书架与阅读进度已合并导入。');}catch(error){setNotice(error instanceof Error?error.message:'导入失败');}event.target.value='';}} />
      </div>{notice&&<p className="notice" role="status">{notice}</p>}
    </section>
    <p className="catalog-footnote">书源状态以实际请求为准，发现数量不代表各平台全部作品。VIP、登录和版权限制请前往源站处理。</p>
  </>;
}
