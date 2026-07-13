import { useState } from "react";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import Game2048 from "@/components/games/Game2048";
import GameSnake from "@/components/games/GameSnake";
import GameTetris from "@/components/games/GameTetris";
import GameMinesweeper from "@/components/games/GameMinesweeper";
import GameFlappy from "@/components/games/GameFlappy";
import GameBreakout from "@/components/games/GameBreakout";
import GameMemory from "@/components/games/GameMemory";
import GameTicTacToe from "@/components/games/GameTicTacToe";
import GamePong from "@/components/games/GamePong";
import GameSimon from "@/components/games/GameSimon";

type GameInfo = {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  icon: string;
  component: React.ComponentType;
};

const GAMES: GameInfo[] = [
  { id: "2048", name: "2048", nameEn: "2048", description: "滑动合并数字，达到 2048", icon: "", component: Game2048 },
  { id: "snake", name: "贪吃蛇", nameEn: "Snake", description: "控制蛇吃食物，不要撞到自己", icon: "🐍", component: GameSnake },
  { id: "tetris", name: "俄罗斯方块", nameEn: "Tetris", description: "经典方块消除游戏", icon: "🟦", component: GameTetris },
  { id: "minesweeper", name: "扫雷", nameEn: "Minesweeper", description: "找出所有非雷格子", icon: "💣", component: GameMinesweeper },
  { id: "flappy", name: "Flappy Bird", nameEn: "Flappy Bird", description: "点击跳跃，穿过管道", icon: "", component: GameFlappy },
  { id: "breakout", name: "打砖块", nameEn: "Breakout", description: "控制挡板弹球打砖", icon: "🧱", component: GameBreakout },
  { id: "memory", name: "记忆翻牌", nameEn: "Memory", description: "翻开卡片找到配对", icon: "🃏", component: GameMemory },
  { id: "tictactoe", name: "井字棋", nameEn: "Tic Tac Toe", description: "与 AI 对弈三子棋", icon: "⭕", component: GameTicTacToe },
  { id: "pong", name: "Pong", nameEn: "Pong", description: "经典乒乓球对战", icon: "🏓", component: GamePong },
  { id: "simon", name: "Simon Says", nameEn: "Simon Says", description: "记住颜色序列并重复", icon: "🎵", component: GameSimon },
];

export default function Games() {
  const [activeGame, setActiveGame] = useState<string | null>(null);

  const game = GAMES.find((g) => g.id === activeGame);
  const GameComponent = game?.component;

  if (GameComponent) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
            onClick={() => setActiveGame(null)}
          >
            <ArrowLeft className="size-3.5" />
            返回游戏列表
          </button>
          <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-stone-600 backdrop-blur-xl">
            {game.nameEn}
          </span>
        </div>
        <GameComponent />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 lg:px-8">
      <div>
        <div className="flex items-center gap-3">
          <HomeLink
            className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
          >
            <ArrowLeft className="size-3.5" />
            返回首页
          </HomeLink>
          <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-stone-600 backdrop-blur-xl">
            Games
          </span>
        </div>
        <div className="mt-4">
          <h1 className="font-display text-4xl text-stone-900">小游戏中心</h1>
          <p className="mt-2 text-sm text-stone-500">
            内置经典小游戏，无需安装，打开即玩
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className="glass-panel group flex flex-col gap-3 rounded-[24px] p-5 text-left transition hover:-translate-y-1"
            onClick={() => setActiveGame(g.id)}
          >
            <div className="inline-flex size-12 items-center justify-center rounded-2xl border border-white/40 bg-white/30 text-2xl backdrop-blur-xl transition group-hover:scale-110">
              {g.icon}
            </div>
            <div>
              <h3 className="font-display text-lg text-stone-900">{g.name}</h3>
              <p className="mt-0.5 text-xs text-stone-500">{g.nameEn}</p>
              <p className="mt-2 text-sm text-stone-600">{g.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
