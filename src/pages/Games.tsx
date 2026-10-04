import { Component, ComponentType, lazy, ReactNode, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Dices, Gamepad2, Loader2, Search, Star } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { HomeLink } from "@/components/HomeLink";
import { gameCatalog, GameCategory } from "@/data/games";
import { useStoredState } from "@/hooks/useStoredState";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { todayKey } from "@/lib/game-engines";

const components: Record<string, ComponentType> = {
  "2048": lazy(() => import("@/components/games/Game2048")),
  snake: lazy(() => import("@/components/games/GameSnake")),
  tetris: lazy(() => import("@/components/games/GameTetris")),
  minesweeper: lazy(() => import("@/components/games/GameMinesweeper")),
  flappy: lazy(() => import("@/components/games/GameFlappy")),
  breakout: lazy(() => import("@/components/games/GameBreakout")),
  memory: lazy(() => import("@/components/games/GameMemory")),
  tictactoe: lazy(() => import("@/components/games/GameTicTacToe")),
  pong: lazy(() => import("@/components/games/GamePong")),
  simon: lazy(() => import("@/components/games/GameSimon")),
  puzzle: lazy(() => import("@/components/games/GamePuzzle")),
  sudoku: lazy(() => import("@/components/games/GameSudoku")),
  connect4: lazy(() => import("@/components/games/GameLine").then((m) => ({ default: m.GameConnectFour }))),
  gomoku: lazy(() => import("@/components/games/GameLine").then((m) => ({ default: m.GameGomoku }))),
  lights: lazy(() => import("@/components/games/GameLights")),
  codebreaker: lazy(() => import("@/components/games/GameCodeBreaker")),
  mole: lazy(() => import("@/components/games/GameMole")),
  reaction: lazy(() => import("@/components/games/GameReaction")),
  typing: lazy(() => import("@/components/games/GameTyping")),
};
class GameBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="game-notice" role="alert">游戏暂时未能加载。<button className="game-button" onClick={() => window.location.reload()}>刷新重试</button></div> : this.props.children; }
}
const isIds = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 30 && value.every((n) => typeof n === "string" && gameCatalog.some((g) => g.id === n));

export default function Games() {
  const [params, setParams] = useSearchParams(); const activeGame = params.get("game");
  const [query, setQuery] = useState(""); const [category, setCategory] = useState<GameCategory | "全部" | "收藏">("全部");
  const [favorites, setFavorites, persistent] = useStoredState("yukino.games.favorites", [], isIds);
  const [recent, setRecent] = useStoredState("yukino.games.recent", [], isIds); const [copied, setCopied] = useState(false);
  const game = gameCatalog.find((g) => g.id === activeGame); const GameComponent = game && components[game.id];
  const daily = params.get("daily") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("daily")!) ? params.get("daily") : null;
  useEffect(() => { window.scrollTo(0, 0); setCopied(false); }, [activeGame, daily]);
  useDocumentMeta(game ? `${game.name}${daily ? " · 每日挑战" : ""}` : "小游戏中心", "19 个小游戏：数独、华容道、四子棋、五子棋、街机与反应练习。无需安装，打开即玩。");
  const filtered = useMemo(() => gameCatalog.filter((g) => (category === "全部" || (category === "收藏" ? favorites.includes(g.id) : g.category === category)) && `${g.name} ${g.nameEn} ${g.description}`.toLowerCase().includes(query.trim().toLowerCase())), [query, category, favorites]);
  const open = (id: string, challenge = false) => { setRecent((previous) => [id, ...previous.filter((n) => n !== id)].slice(0, 5)); setParams({ game: id, ...(challenge ? { daily: todayKey() } : {}) }); };
  const favorite = (id: string) => setFavorites((previous) => previous.includes(id) ? previous.filter((n) => n !== id) : [...previous, id]);
  if (GameComponent && game) return <div className="feature-page game-detail">
    <div className="feature-heading"><button className="pill-button" onClick={() => setParams({})}><ArrowLeft size={15} />返回游戏列表</button><span className="feature-eyebrow">{game.nameEn}{daily ? ` · ${daily}` : ""}</span></div>
    <div className="game-title-row"><div><h1>{game.name}</h1><p>{game.description}</p></div><div className="game-actions"><button className="pill-button" aria-label={favorites.includes(game.id) ? "取消收藏游戏" : "收藏游戏"} aria-pressed={favorites.includes(game.id)} onClick={() => favorite(game.id)}><Star size={15} fill={favorites.includes(game.id) ? "currentColor" : "none"} />收藏</button><button className="pill-button" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); } catch { setCopied(false); } }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "已复制" : "复制链接"}</button></div></div>
    <GameBoundary key={`${game.id}:${daily}`}><Suspense fallback={<p className="game-notice" role="status"><Loader2 className="animate-spin" size={18} />正在加载游戏…</p>}><GameComponent /></Suspense></GameBoundary>
    <p className="local-note">成绩和收藏保存在当前浏览器。<Link to="/focus">玩够了？去专注一会儿 ↗</Link></p>
  </div>;
  return <div className="feature-page">
    <div><div className="feature-heading"><HomeLink className="pill-button"><ArrowLeft size={15} />返回首页</HomeLink><span className="feature-eyebrow">PLAY A LITTLE</span></div><h1 className="feature-title">小游戏中心<span>{gameCatalog.length} 个小乐趣</span></h1><p className="feature-description">换个节奏，开一局。益智、棋类、街机和手速练习，打开即玩。</p></div>
    <div className="daily-challenge"><div><span className="feature-eyebrow">DAILY CHALLENGE · {todayKey()}</span><h2>每天两道新题目</h2><p>同一天打开的是同一题，可以复制链接和朋友一起挑战。</p></div><div className="game-actions"><button className="pill-button" onClick={() => open("sudoku", true)}>每日数独</button><button className="pill-button" onClick={() => open("puzzle", true)}>每日华容道</button></div></div>
    <div className="feature-toolbar"><label className="feature-search"><Search size={17} /><input aria-label="搜索小游戏" placeholder="找个游戏玩…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className="pill-button" disabled={!filtered.length} onClick={() => open(filtered[Math.floor(Math.random() * filtered.length)].id)}><Dices size={16} />随机一局</button></div>
    <div className="filter-chips" aria-label="游戏分类">{(["全部", "益智", "街机", "棋类", "反应", "收藏"] as const).map((cat) => <button key={cat} aria-pressed={category === cat} onClick={() => setCategory(cat)}>{cat}{cat === "收藏" ? ` ${favorites.length}` : ""}</button>)}</div>
    {!persistent && <p role="status" className="feature-warning">浏览器存储不可用，本次收藏不能保留到下次访问。</p>}
    {!!recent.length && category === "全部" && !query && <div className="recent-games"><span>最近玩过</span>{recent.map((id) => <button key={id} onClick={() => open(id)}>{gameCatalog.find((g) => g.id === id)?.name}</button>)}</div>}
    <div className="game-library">{filtered.map((g) => <article className="game-card" key={g.id}><button className="game-card-main" onClick={() => open(g.id)}><span className="game-card-icon" aria-hidden="true">{g.icon}</span><div><div className="game-card-labels"><span>{g.category}</span>{g.isNew && <span className="new-game">NEW</span>}</div><h2>{g.name}</h2><small>{g.nameEn}</small><p>{g.description}</p></div><Gamepad2 className="game-card-arrow" size={17} /></button><button className="game-favorite" aria-label={`${favorites.includes(g.id) ? "取消收藏" : "收藏"}${g.name}`} aria-pressed={favorites.includes(g.id)} onClick={() => favorite(g.id)}><Star size={17} fill={favorites.includes(g.id) ? "currentColor" : "none"} /></button></article>)}</div>
    {!filtered.length && <p className="game-notice">{category === "收藏" ? "还没有收藏游戏，点卡片右上角的星星即可收藏。" : "没有找到游戏，试试其他关键词或分类。"}</p>}
    <p className="local-note">无需账号，无需安装。收藏、最近游玩和成绩仅保存在当前浏览器。</p>
  </div>;
}
