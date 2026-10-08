import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";
export class PageErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous: Readonly<{ children: ReactNode; resetKey: string }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }
  render() {
    if (this.state.failed) return <section role="alert" className="mx-auto my-12 max-w-xl rounded-3xl border border-stone-200 bg-white/70 p-8"><h1 className="font-display text-2xl text-stone-900">这个页面遇到了一点问题</h1><p className="my-4 text-sm leading-7 text-stone-500">可以重试或前往其他页面；浏览器中已保存的内容仍会保留。</p><div className="flex flex-wrap gap-4"><button type="button" className="pill-button" onClick={() => this.setState({ failed: false })}>重新打开</button><Link className="pill-button" to="/">返回首页</Link><Link className="pill-button" to="/status">查看服务状态</Link></div></section>;
    return this.props.children;
  }
}
