export type FocusTask = { id: string; text: string; done: boolean };
export type FocusLog = { id: string; date: string; seconds: number };
export type FocusSettings = Record<"focus" | "short" | "long", number>;
export type FocusBackup = { version: 1; tasks: FocusTask[]; notes: string; logs: FocusLog[]; settings: FocusSettings };
const identifier = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 120;
const unique = (items: { id: string }[]) => new Set(items.map(item => item.id)).size === items.length;
export function validTasks(value: unknown): value is FocusTask[] {
  return Array.isArray(value) && value.length <= 100 && value.every(task => task && identifier(task.id) && typeof task.text === "string" && !!task.text.trim() && task.text.length <= 160 && typeof task.done === "boolean") && unique(value);
}
export function validLog(value: unknown): value is FocusLog[] {
  return Array.isArray(value) && value.length <= 365 && value.every(log => {
    if (!log || !identifier(log.id) || typeof log.date !== "string" || !/^\d{4}-\d\d-\d\d$/.test(log.date) || !Number.isInteger(log.seconds) || log.seconds < 60 || log.seconds > 7200) return false;
    const date = new Date(log.date + "T00:00:00Z"); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === log.date;
  }) && unique(value);
}
export function validSettings(value: unknown): value is FocusSettings {
  return !!value && typeof value === "object" && ["focus", "short", "long"].every(key => Number.isInteger((value as Record<string, number>)[key]) && (value as Record<string, number>)[key] >= 1 && (value as Record<string, number>)[key] <= 120);
}
export function parseFocusBackup(text: string): FocusBackup {
  if (text.length > 1000000) throw new Error("备份文件超过 1 MB");
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("不是有效的 JSON 备份"); }
  if (!data || data.version !== 1 || !validTasks(data.tasks) || !validLog(data.logs) || !validSettings(data.settings) || typeof data.notes !== "string" || data.notes.length > 12000) throw new Error("备份版本或内容无效，原有记录未改变");
  return { version: 1, tasks: data.tasks.map((task: FocusTask) => ({ id: task.id, text: task.text, done: task.done })), logs: data.logs.map((log: FocusLog) => ({ id: log.id, date: log.date, seconds: log.seconds })), settings: { focus: data.settings.focus, short: data.settings.short, long: data.settings.long }, notes: data.notes };
}
export function restoreDeletedTasks(current: FocusTask[], removed: FocusTask[]) {
  const ids = new Set(current.map(task => task.id)); return [...current, ...removed.filter(task => !ids.has(task.id))].slice(0, 100);
}
