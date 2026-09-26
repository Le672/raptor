import type { Chapter } from './api';
import { pageBlob } from './images';

export type ExportType = 'zip' | 'cbz' | 'pdf';
type Entry = { path: string; content: Uint8Array };
const encoder = new TextEncoder();

function u16(value: number) { return [value & 255, value >>> 8 & 255]; }
function u32(value: number) { return [value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24 & 255]; }

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let x = n;
  for (let i = 0; i < 8; i++) x = x & 1 ? (x >>> 1) ^ 0xedb88320 : x >>> 1;
  return x >>> 0;
});

function checksum(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries: Entry[]): Blob {
  const chunks: BlobPart[] = [];
  const central: BlobPart[] = [];
  let position = 0;
  for (const { path, content } of entries) {
    const name = encoder.encode(path);
    const crc = checksum(content);
    const local = new Uint8Array([
      0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(content.length), ...u32(content.length), ...u16(name.length), ...u16(0),
    ]);
    chunks.push(local, name, content.slice());
    central.push(new Uint8Array([
      0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(content.length), ...u32(content.length), ...u16(name.length), ...u16(0),
      ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(position),
    ]), name);
    position += local.length + name.length + content.length;
  }
  const centralSize = central.reduce((sum, part) => sum + (part as Uint8Array).length, 0);
  const footer = new Uint8Array([
    0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
    ...u32(centralSize), ...u32(position), ...u16(0),
  ]);
  return new Blob([...chunks, ...central, footer], { type: 'application/zip' });
}

async function jpegPage(source: Blob): Promise<{ data: Uint8Array; width: number; height: number }> {
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 PDF 图片画布');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('JPEG 编码失败')), 'image/jpeg', .91));
    return { data: new Uint8Array(await blob.arrayBuffer()), width: bitmap.width, height: bitmap.height };
  } finally { bitmap.close(); }
}

async function picturePdf(blobs: Blob[]): Promise<Blob> {
  const pages = await Promise.all(blobs.map(jpegPage));
  const objects: BlobPart[][] = [];
  const add = (parts: BlobPart[]) => { objects.push(parts); return objects.length; };
  const catalogId = add([]);
  const pagesId = add([]);
  const pageIds: number[] = [];
  for (const page of pages) {
    const imageId = add([
      encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.data.length} >>\nstream\n`),
      page.data.slice(), encoder.encode('\nendstream'),
    ]);
    const stream = encoder.encode(`q ${page.width} 0 0 ${page.height} 0 0 cm /Im0 Do Q`);
    const contentId = add([encoder.encode(`<< /Length ${stream.length} >>\nstream\n`), stream, encoder.encode('\nendstream')]);
    pageIds.push(add([encoder.encode(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`)]));
  }
  objects[catalogId - 1] = [encoder.encode(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)];
  objects[pagesId - 1] = [encoder.encode(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`)];
  const output: BlobPart[] = [];
  const positions = [0];
  let offset = 0;
  const append = (part: BlobPart) => { output.push(part); offset += part instanceof Uint8Array ? part.length : new Blob([part]).size; };
  append(encoder.encode('%PDF-1.4\n'));
  objects.forEach((parts, index) => {
    positions.push(offset);
    append(encoder.encode(`${index + 1} 0 obj\n`));
    parts.forEach(append);
    append(encoder.encode('\nendobj\n'));
  });
  const xref = offset;
  append(encoder.encode(`xref\n0 ${positions.length}\n0000000000 65535 f \n`));
  for (const position of positions.slice(1)) append(encoder.encode(`${String(position).padStart(10, '0')} 00000 n \n`));
  append(encoder.encode(`trailer\n<< /Size ${positions.length} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`));
  return new Blob(output, { type: 'application/pdf' });
}

export async function exportChapters(chapters: Chapter[], title: string, format: ExportType, onProgress: (done: number, total: number) => void): Promise<void> {
  const total = chapters.reduce((sum, chapter) => sum + chapter.images.length, 0);
  if (!total) throw new Error('没有可导出的图片');
  if (total > 500) throw new Error('单次最多导出 500 页，请分批下载');
  const jobs = chapters.flatMap((chapter, chapterIndex) => chapter.images.map((_, pageIndex) => ({ chapter, chapterIndex, pageIndex })));
  const entries = new Array<Entry>(jobs.length);
  const blobs = new Array<Blob>(jobs.length);
  let done = 0;
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
    while (cursor < jobs.length) {
      const jobIndex = cursor++;
      const { chapter, chapterIndex, pageIndex } = jobs[jobIndex];
      const blob = await pageBlob(chapter, pageIndex);
      blobs[jobIndex] = blob;
      const chapterFolder = chapters.length > 1 && format === 'zip' ? `${String(chapterIndex + 1).padStart(3, '0')}-${safeName(chapter.title)}/` : '';
      const name = `${chapterFolder}${String(chapters.length > 1 ? chapterIndex + 1 : 1).padStart(3, '0')}-${String(pageIndex + 1).padStart(4, '0')}.jpg`;
      entries[jobIndex] = { path: name, content: new Uint8Array(await blob.arrayBuffer()) };
      onProgress(++done, total);
    }
  }));
  const result = format === 'pdf' ? await picturePdf(blobs) : storedZip(entries);
  const url = URL.createObjectURL(result);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeName(title)}.${format}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function safeName(value: string) { return (value.replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ').trim().slice(0, 80) || 'Yukino-JM'); }
