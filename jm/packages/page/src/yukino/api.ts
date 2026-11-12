export const API_BASE = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787').replace(/\/$/, '');

export type BookCard = { id: string; title: string; creator: string };
export type SearchPage = { page: number; pageSize: number; total: number; directId: string | null; items: BookCard[] };
export type Book = { id: string; title: string; creators: string[]; description: string; tags: string[]; works: string[]; characters: string[]; views: number; likes: number; chapters: { id: string; title: string; order: number }[] };
export type Chapter = { id: string; title: string; images: { name: string; url: string }[]; scramble: number };

async function request<T>(pathname: string, signal?: AbortSignal): Promise<T> {
  const url = `${API_BASE}${pathname}`;
  const store = 'caches' in window ? await caches.open('yukino-jm-metadata-v1') : null;
  let response: Response;
  try {
    response = await fetch(url, { signal });
    if (response.ok) await store?.put(url, response.clone());
  } catch (cause) {
    if (signal?.aborted) throw cause;
    const cached = await store?.match(url);
    if (!cached) throw cause;
    response = cached;
  }
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'error' in payload ? String(payload.error) : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export function findBooks(query: string, page: number, category: string, order: string, time: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: query, page: String(page), category, order, time });
  return request<SearchPage>(`/v1/search?${params}`, signal);
}

export function getBook(id: string, signal?: AbortSignal) { return request<Book>(`/v1/books/${id}`, signal); }
export function getChapter(id: string, signal?: AbortSignal) { return request<Chapter>(`/v1/chapters/${id}`, signal); }
export function imageUrl(path: string) { return `${API_BASE}${path}`; }
export function coverUrl(id: string) { return `${API_BASE}/v1/covers/${id}`; }
