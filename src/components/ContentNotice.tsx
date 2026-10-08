export function ContentNotice({ loading, error, refresh, hasData = false }: { loading: boolean; error: string; refresh: () => void; hasData?: boolean }) {
  if (loading) return <p role="status" className="text-sm text-stone-500">正在读取云端内容…</p>;
  if (!error) return null;
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><span>{error}{hasData ? "，当前展示上次读取的内容。" : "。"}</span><button type="button" className="underline underline-offset-4" onClick={refresh}>重新加载</button></div>;
}
