import { ReactNode, useCallback } from "react";
import { useStoredState } from "@/hooks/useStoredState";

export const gameButton = "game-button";
export function GameStats({ values }: { values: [string, ReactNode][] }) {
  return <div className="game-stats">{values.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}
export function GameNotice({ children }: { children: ReactNode }) { return <p className="game-notice" role="status">{children}</p>; }
export function useGameBest(id: string, lower = false) {
  const [best, setBest, persistent] = useStoredState(`yukino.game.best.${id}`, 0, (n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0);
  const record = useCallback((value: number) => {
    if (value > 0 && Number.isFinite(value)) setBest((current) => !current || (lower ? value < current : value > current) ? value : current);
  }, [lower, setBest]);
  return { best, record, persistent };
}
