import { API_BASE } from './api';

export type TranslationOptions = { endpoint: string; apiKey: string; model: string; language: string };
let ocrTask: Promise<Awaited<ReturnType<typeof import('@paddleocr/paddleocr-js')['PaddleOCR']['create']>>> | undefined;

export async function readText(blob: Blob): Promise<string> {
  ocrTask ??= import('@paddleocr/paddleocr-js').then(({ PaddleOCR }) => PaddleOCR.create({
    lang: 'ch', ocrVersion: 'PP-OCRv5', worker: true,
    ortOptions: { backend: 'wasm', numThreads: 1 },
  })).catch(error => { ocrTask = undefined; throw error; });
  const engine = await ocrTask;
  const result = await engine.predict(blob);
  return result.flatMap(page => page.items.map(item => item.text.trim()).filter(Boolean)).join('\n');
}

export async function translateText(source: string, options: TranslationOptions): Promise<string> {
  const response = await fetch(`${API_BASE}/v1/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...options, text: source }),
  });
  const result = await response.json() as { text?: string; error?: string };
  if (!response.ok || !result.text) throw new Error(result.error || '翻译失败');
  return result.text;
}
