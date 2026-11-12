// Pick from the canonical directory. A guest supplies only a book ID.
export async function buildReaderPreview(env, ctx, id, { getBook, getVolume, getChapter, validPartId }) {
  const { data: book, meta } = await getBook(env, ctx, id, false, false);
  for (const volume of book.volumes || []) {
    if (!validPartId(volume.id)) continue;
    const directory = Array.isArray(volume.chapters) ? volume : (await getVolume(env, ctx, id, volume.id)).data;
    const first = directory.chapters.find(item => !item.restricted && validPartId(item.id));
    if (!first) continue;
    const { data: chapter, meta: chapterMeta } = await getChapter(env, ctx, id, first.id);
    if (chapter.bookId !== id || chapter.volumeId !== volume.id || chapter.id !== first.id) break;
    const paragraphs = [];
    let remaining = 1800;
    for (const block of chapter.blocks) {
      if (block.type !== 'text' || !block.text.trim()) continue;
      const text = Array.from(block.text.trim().slice(0, remaining * 2)).slice(0, remaining);
      paragraphs.push(text.join(''));
      remaining -= text.length;
      if (!remaining || paragraphs.length >= 24) break;
    }
    if (!paragraphs.length) break;
    return { data: { bookTitle: book.title, chapterTitle: chapter.title, volumeId: volume.id,
      chapterId: first.id, paragraphs, sourceUrl: chapter.sourceUrl }, meta: chapterMeta || meta };
  }
  throw Object.assign(new Error('书源暂未提供可试读的正文，可前往源站查看。'), { status: 404 });
}
