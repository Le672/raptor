import { API_BASE } from './api';

export type TranslationOptions = { endpoint: string; apiKey: string; model: string; language: string };
let ocrTask: Promise<Awaited<ReturnType<typeof import('@paddleocr/paddleocr-js')['PaddleOCR']['create']>>> | undefined;
let runtimePaths: Promise<{ wasm: string; mjs: string }> | undefined;

async function webRuntimePaths(): Promise<{ wasm: string; mjs: string }> {
  runtimePaths ??= (async () => {
    const response = await fetch('/assets/ocr-runtime.wasm');
    if (!response.ok) throw new Error(`OCR 运行文件读取失败：${response.status}`);
    const compressed = await response.blob();
    const magic = new Uint8Array(await compressed.slice(0, 2).arrayBuffer());
    const binary = magic[0] === 0x1f && magic[1] === 0x8b
      ? await new Response(compressed.stream().pipeThrough(new DecompressionStream('gzip'))).blob()
      : compressed;
    const signature = new Uint8Array(await binary.slice(0, 4).arrayBuffer());
    if (signature[0] !== 0 || signature[1] !== 0x61 || signature[2] !== 0x73 || signature[3] !== 0x6d) {
      throw new Error('OCR 运行文件格式无效');
    }
    const wasmUrl = URL.createObjectURL(new Blob([binary], { type: 'application/wasm' }));
    return { wasm: wasmUrl, mjs: new URL('/assets/ocr-runtime.mjs', location.origin).href };
  })().catch(error => { runtimePaths = undefined; throw error; });
  return runtimePaths;
}

export async function readText(blob: Blob): Promise<string> {
  ocrTask ??= (async () => {
    const { PaddleOCR } = await import('@paddleocr/paddleocr-js');
    const hosted = import.meta.env.PROD && document.body.dataset.platform !== 'desktop';
    const paths = hosted ? await webRuntimePaths() : undefined;
    return PaddleOCR.create({
      lang: 'ch', ocrVersion: 'PP-OCRv5', worker: true,
      ortOptions: { backend: 'wasm', numThreads: 1, ...(paths ? { wasmPaths: paths as unknown as string } : {}) },
    });
  })().catch(error => { ocrTask = undefined; throw error; });
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
