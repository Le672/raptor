export type SavedBook = { id: string; title: string; creator: string; savedAt: number };
export type ReadingMark = { chapterId: string; page: number; updatedAt: number };

function read<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}

export function favorites(): SavedBook[] { return read<SavedBook[]>('yukino-jm:favorites', []); }
export function setFavorites(value: SavedBook[]) { localStorage.setItem('yukino-jm:favorites', JSON.stringify(value)); }
export function history(): Record<string, ReadingMark> { return read<Record<string, ReadingMark>>('yukino-jm:history', {}); }
export function saveProgress(bookId: string, mark: ReadingMark) {
  localStorage.setItem('yukino-jm:history', JSON.stringify({ ...history(), [bookId]: mark }));
}
export function setting<T>(key: string, fallback: T): T { return read<T>(`yukino-jm:${key}`, fallback); }
export function setSetting<T>(key: string, value: T) { localStorage.setItem(`yukino-jm:${key}`, JSON.stringify(value)); }
