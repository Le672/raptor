import { readerSite } from './reader-site.mjs';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookMarked, Check, Download, LogIn, Monitor, RefreshCw, Share2, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import { applyUpdate, checkUpdate, devicePlatform, installApp, usePwa } from './pwa';
import { appLoginUrlForPage, useSession } from './AuthControls';
import './app.css';

export function InstallControl() {
  const pwa = usePwa();
  return <Link to="/install" className="install-control" aria-label={pwa.installed ? '应用与安装' : `安装${readerSite.title}`}><Download size={15} /><span>{pwa.installed ? '应用' : '安装'}</span></Link>;
}
export function AppNotices() {
  const pwa = usePwa();
  return <>{pwa.offline && <div className="app-notice" role="status"><WifiOff size={17} /><p>当前离线。已保存的书架、阅读进度和目录仍可查看，章节正文需要联网验证登录。</p></div>}{pwa.updateReady && <div className="app-notice" role="status"><RefreshCw size={17} /><p>书房有新版本。更新会保留此设备的书架与阅读进度。</p><button className="text-button" onClick={applyUpdate}>更新应用<ArrowRight size={14} /></button></div>}</>;
}
const platforms = [
  { id: 'ios', label: 'iOS / iPadOS', icon: Smartphone, title: '把书房，放到主屏幕。', intro: '使用 Safari 添加到主屏幕，轻点图标，就能在独立窗口里继续阅读。', steps: [`在 Safari 中打开 ${readerSite.host}。`, '点按分享按钮，选择「添加到主屏幕」。', '若出现「作为网页 App 打开」，保持开启，再点「添加」。', '从主屏幕打开书房，在应用内登录一次。'] },
  { id: 'android', label: '安卓', icon: Smartphone, title: '下一本故事，一点即开。', intro: '推荐使用 Chrome 安装，让书房出现在主屏幕和应用列表中。', steps: [`使用 Chrome 打开 ${readerSite.host}。`, '点下方「安装书房」，并在浏览器窗口确认安装。', '若按钮尚未出现，打开 Chrome 菜单，选择「安装应用」或「添加到主屏幕」。', '打开书房并登录，之后可直接恢复会话。'] },
  { id: 'pc', label: '电脑', icon: Monitor, title: '给桌面，留一间书房。', intro: 'Windows、macOS 和 Linux 可通过 Chrome 安装，在自己的窗口里阅读。', steps: [`使用 Chrome 打开 ${readerSite.host}。`, '点下方「安装书房」，或地址栏右侧的安装图标。', '也可在 Chrome 菜单中选择「投放、保存和分享」→「将网页安装为应用」。', '从桌面、开始菜单或应用启动器打开；Mac 也可在 Safari 中选择「文件」→「添加到程序坞」。'] },
] as const;
export function InstallPage() {
  const pwa = usePwa(), session = useSession();
  const [selected, setSelected] = useState(devicePlatform), platform = platforms.find(item => item.id === selected)!;
  return <div className="install-page"><div className="page-heading"><span className="eyebrow">YOUR STORIES, WITH YOU</span><h1>随身的{readerSite.title}</h1><p>同一个书房，装进手机、平板和电脑。</p></div>
    <div className="platform-tabs" role="tablist" aria-label="选择安装设备">{platforms.map(item => <button key={item.id} id={`tab-${item.id}`} role="tab" aria-selected={selected === item.id} aria-controls="platform-guide" onClick={() => setSelected(item.id)}><item.icon size={17} />{item.label}</button>)}</div>
    <section className="install-hero" role="tabpanel" id="platform-guide" aria-labelledby={`tab-${selected}`}><div className="install-copy"><span className="install-kicker"><span />{pwa.installed ? '正在独立应用中使用' : `${readerSite.upperBrand} · 网页应用`}</span><h2>{platform.title}</h2><p>{platform.intro}</p><div className="install-actions">{pwa.installed ? <span className="installed-mark"><Check size={16} />已在独立应用中打开</span> : selected !== 'ios' && pwa.installReady ? <button className="button" disabled={pwa.installing} onClick={() => void installApp()}><Download size={16} />{pwa.installing ? '正在打开安装窗口…' : '安装书房'}</button> : <span className="manual-install"><Share2 size={17} />{selected === 'ios' ? '分享 → 添加到主屏幕' : '使用浏览器菜单安装'}</span>}<Link className="text-button" to="/shelf">打开我的书架<ArrowRight size={15} /></Link></div>{pwa.error && <p className="inline-error" role="alert">{pwa.error}</p>}<small>安装入口由浏览器提供。已安装、隐私模式或浏览器不支持时，请参考下方步骤。</small></div><div className="app-preview" aria-hidden="true"><div className="app-preview-dots">•••</div><img src="/icons/icon-192.png" alt="" /><strong>{readerSite.title}</strong><span>把故事，读成日常。</span><div className="app-preview-books"><i /><i /><i /></div><div className="app-preview-footer"><BookMarked size={14} />下一页，接着读。</div></div></section>
    <div className="install-grid"><section className="install-card"><h2><platform.icon size={19} />{platform.label} 安装步骤</h2><ol className="install-steps">{platform.steps.map(step => <li key={step}>{step}</li>)}</ol>{selected === 'ios' && <p className="install-tip">微信、QQ 等应用内浏览器中，请先在 Safari 打开网址。</p>}</section><section className="install-card"><h2><ShieldCheck size={19} />登录一次，记住这台设备</h2><p>默认保持登录 7 天，关闭再打开会自动检查并恢复会话。密码不会保存在网页中，到期后重新登录即可。</p><div className="install-session"><span>{session.loading ? '正在检查登录…' : session.user ? `当前账号：${session.user.name}` : session.unavailable ? '暂时无法检查登录，联网后会重试' : '当前设备尚未登录'}</span><Link className="text-button" to={appLoginUrlForPage()}><LogIn size={14} />{session.user ? '管理登录' : '在书房内登录'}</Link></div><p className="install-tip">iOS 的主屏幕应用可能使用独立存储，安装后请在应用内登录一次。每台设备分别保存会话。</p></section><section className="install-card"><h2><BookMarked size={19} />书架与进度，都留在这里</h2><p>收藏、足迹和阅读设置保存在当前设备的应用或浏览器中。更新应用会保留这些记录；换设备前，可在设置中导出备份。</p><Link className="text-button" to="/sources">备份书架与进度<ArrowRight size={14} /></Link><p className="install-tip">浏览器与独立应用的记录可能分开；卸载应用或清除网站数据会影响本机记录，目前不提供云端同步。</p></section><section className="install-card"><h2><RefreshCw size={19} />更新与离线使用</h2><p>联网时检查应用更新。离线时可打开书房、查看本机书架和已缓存目录；搜索新内容、读取章节正文仍需联网。</p><button className="text-button" onClick={() => pwa.updateReady ? applyUpdate() : void checkUpdate()}><RefreshCw size={14} />{pwa.updateReady ? '更新应用' : '检查应用更新'}</button></section></div></div>;
}
