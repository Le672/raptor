export type Favorite = {
  id: string;
  name: string;
  author: string;
  savedAt: number;
};

const STORAGE_KEY = 'jm-local-favorites-v1';
export const FAVORITES_CHANGED = 'jm-favorites-changed';

export function readFavorites(): Favorite[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Favorite =>
      !!item && typeof item.id === 'string' && typeof item.name === 'string' &&
      typeof item.author === 'string' && typeof item.savedAt === 'number'
    );
  } catch {
    return [];
  }
}

export function toggleFavorite(item: Omit<Favorite, 'savedAt'>): Favorite[] {
  const current = readFavorites();
  const next = current.some((favorite) => favorite.id === item.id)
    ? current.filter((favorite) => favorite.id !== item.id)
    : [{ ...item, savedAt: Date.now() }, ...current];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(FAVORITES_CHANGED));
  return next;
}
