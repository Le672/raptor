import type { Book } from './api';
import { bookIdValid, partIdValid } from '../shared/sources.mjs';
export type SavedBook = { book: Book; savedAt: number };
export type Progress = { book: Book; volumeId: string; chapterId: string; chapterTitle: string; percent: number; updatedAt: number };
export type Preferences = { theme: 'light' | 'dark'; paper: 'paper' | 'white' | 'night'; fontSize: number; lineHeight: number; width: number; serif: boolean };
export const defaults: Preferences = { theme: 'light', paper: 'paper', fontSize: 20, lineHeight: 1.95, width: 760, serif: true };
let storageFailed = false;
const temporary = new Map<string, unknown>();
function read<T>(key: string, fallback: T): T { if (temporary.has(key)) return temporary.get(key) as T; try { return JSON.parse(localStorage.getItem(`novel:${key}`) || 'null') ?? fallback; } catch { return fallback; } }
function write(key: string, value: unknown) { try { localStorage.setItem(`novel:${key}`, JSON.stringify(value)); temporary.delete(key); } catch { storageFailed = true; temporary.set(key, value); } window.dispatchEvent(new Event('novel-library')); }
export function persistenceFailed() { return storageFailed; }
export function shelf(): SavedBook[] { const data = read<unknown>('shelf', []); return Array.isArray(data) ? data.filter(x => x?.book && bookIdValid(x.book.id) && typeof x.book.title === 'string').slice(0, 200) : []; }
export function history(): Progress[] { const data = read<unknown>('history', []); return Array.isArray(data) ? data.filter(x => x?.book && bookIdValid(x.book.id) && typeof x.chapterId === 'string').slice(0, 150) : []; }
export function isSaved(id: string) { return shelf().some(x => x.book.id === id); }
export function toggleSaved(book: Book) { const old = shelf(); write('shelf', old.some(x => x.book.id === book.id) ? old.filter(x => x.book.id !== book.id) : [{ book, savedAt: Date.now() }, ...old].slice(0, 200)); }
export function saveProgress(value: Progress) { write('history', [value, ...history().filter(x => x.book.id !== value.book.id)].slice(0, 150)); }
export function progressFor(id: string) { return history().find(x => x.book.id === id); }
export function preferences(): Preferences {
  const value = read<Partial<Preferences>>('settings', {});
  return { theme: value.theme === 'dark' ? 'dark' : 'light', paper: ['paper','white','night'].includes(value.paper || '') ? value.paper! : 'paper', fontSize: Math.min(30, Math.max(16, Number(value.fontSize) || 20)), lineHeight: Math.min(2.5, Math.max(1.5, Number(value.lineHeight) || 1.95)), width: Math.min(960, Math.max(560, Number(value.width) || 760)), serif: value.serif !== false };
}
export function setPreferences(value: Preferences) { write('settings', value); }
export function downloadFile(name: string, content: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name.replace(/[<>:"/\\|?*]/g, '_'); a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportLibrary() { downloadFile(`Yukino-书架-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, shelf: shelf(), history: history(), settings: preferences() }, null, 2), 'application/json'); }
export function importLibrary(text: string) {
  const data = JSON.parse(text);
  if (data.version !== 1 || !Array.isArray(data.shelf) || !Array.isArray(data.history)) throw new Error('这不是 Yukino 轻小说书架备份');
  const validBook = (book: Book) => book && bookIdValid(book.id) && typeof book.title === 'string' && typeof book.author === 'string' && Array.isArray(book.tags) && (!book.cover || /^\/api\/image\?src=/.test(book.cover));
  const saved = data.shelf.filter((x: SavedBook) => validBook(x.book) && Number.isFinite(x.savedAt));
  const recent = data.history.filter((x: Progress) => validBook(x.book) && partIdValid(x.volumeId) && partIdValid(x.chapterId) && Number.isFinite(x.updatedAt) && Number.isFinite(x.percent) && x.percent >= 0 && x.percent <= 100);
  write('shelf', [...new Map([...shelf(), ...saved].map(x => [x.book.id, x])).values()].slice(0, 200));
  write('history', [...new Map([...history(), ...recent].sort((a, b) => a.updatedAt - b.updatedAt).map(x => [x.book.id, x])).values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 150));
}
