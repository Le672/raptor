import type { F1Race } from "./f1";

export type P4Choice = "yes" | "no";
export type P4Poll = {
  poll: { key: string; race: F1Race; closesAt: string } | null;
  counts: { yes: number; no: number; total: number };
  myVote: P4Choice | null;
  authenticated: boolean;
  serverTime: string;
};
export type RadioText = {
  status: "empty" | "working" | "ready" | "error";
  transcript: string;
  translation: string;
  language: string;
  error: string;
  updatedAt?: string;
};
export type RadioTextRequest = { session: number; driver: number; date: string };
