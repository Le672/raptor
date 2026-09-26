import CryptoJS from 'crypto-js';
import { imageUrl, type Chapter } from './api';

function sliceTotal(chapter: Chapter, name: string): number {
  const photoId = Number(chapter.id);
  if (photoId < chapter.scramble || /\.gif$/i.test(name)) return 0;
  if (photoId < 268850) return 10;
  const digest = CryptoJS.MD5(`${photoId}${name.split('.')[0]}`).toString();
  return (digest.charCodeAt(digest.length - 1) % (photoId < 421926 ? 10 : 8)) * 2 + 2;
}

const inFlight = new Map<string, Promise<Blob>>();
const waiting: Array<() => void> = [];
let activeRequests = 0;

async function withImageSlot<T>(work: () => Promise<T>): Promise<T> {
  if (activeRequests >= 3) await new Promise<void>(resolve => waiting.push(resolve));
  else activeRequests++;
  try { return await work(); }
  finally {
    const next = waiting.shift();
    if (next) next();
    else activeRequests--;
  }
}

async function fetchImage(url: string): Promise<Blob> {
  return withImageSlot(async () => {
    let failure: Error = new Error('图片读取失败');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) return response.blob();
        failure = new Error(`图片读取失败：${response.status}`);
        if (response.status < 500 && response.status !== 429) break;
      } catch (cause) { failure = cause instanceof Error ? cause : new Error('图片网络中断'); }
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 650));
    }
    throw failure;
  });
}

async function decode(source: Blob, pieces: number): Promise<Blob> {
  if (!pieces) return source;
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器无法建立图片画布');
    const base = Math.floor(bitmap.height / pieces);
    const extra = bitmap.height % pieces;
    let target = 0;
    for (let index = 0; index < pieces; index++) {
      const height = base + (index === 0 ? extra : 0);
      const sourceY = bitmap.height - base * (index + 1) - extra;
      ctx.drawImage(bitmap, 0, sourceY, bitmap.width, height, 0, target, bitmap.width, height);
      target += height;
    }
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片处理失败')), 'image/jpeg', .94));
  } finally { bitmap.close(); }
}

export function pageBlob(chapter: Chapter, index: number): Promise<Blob> {
  const entry = chapter.images[index];
  if (!entry) return Promise.reject(new Error('页码超出范围'));
  const key = `${chapter.id}/${entry.name}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const run = (async () => {
    const request = imageUrl(entry.url);
    const storage = 'caches' in window ? await caches.open('yukino-jm-pages-v1') : null;
    const cached = await storage?.match(request);
    if (cached) return cached.blob();
    const result = await decode(await fetchImage(request), sliceTotal(chapter, entry.name));
    if (storage) await storage.put(request, new Response(result, { headers: { 'Content-Type': result.type } }));
    return result;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, run);
  return run;
}

export async function pageObjectUrl(chapter: Chapter, index: number): Promise<string> {
  return URL.createObjectURL(await pageBlob(chapter, index));
}
