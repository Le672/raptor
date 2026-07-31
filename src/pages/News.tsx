import { ArrowLeft, ExternalLink, Loader2, Newspaper, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { getApiBase } from "@/lib/runtime";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sourceLabel: string;
}

interface NewsResponse {
  items: NewsItem[];
  errors: { source: string; error: string }[];
}

const SOURCE_LABELS: Record<string, string> = {
  ithome: "IT之家",
  kr36: "36氪",
  hn: "Hacker News",
  verge: "The Verge",
};

const SOURCE_ORDER = ["ithome", "kr36", "hn", "verge"];

function formatTime(pubDate: string): string {
  if (!pubDate) return "";
  const t = Date.parse(pubDate);
  if (Number.isNaN(t)) return pubDate;
  return new Date(t).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function News() {
  useDocumentMeta("新闻", "聚合科技资讯与开发圈动态。");
  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<string>("all");

  const load = () => {
    setLoading(true);
    setError(null);
    fetch(`${getApiBase()}/news`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<NewsResponse>;
      })
      .then((d) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return activeSource === "all"
      ? data.items
      : data.items.filter((i) => i.source === activeSource);
  }, [data, activeSource]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10 lg:px-8">
      <div>
        <div className="flex items-center gap-3">
          <HomeLink className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900">
            <ArrowLeft className="size-3.5" />
            返回主页
          </HomeLink>
          <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-stone-600 backdrop-blur-xl">
            news.yukino.bond
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl text-stone-900 sm:text-5xl">
          新闻
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
          聚合几个值得看的科技资讯源，随手刷刷。
        </p>
      </div>

      {/* 源切换 + 刷新 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`rounded-full px-4 py-2 text-sm transition ${
            activeSource === "all"
              ? "bg-stone-900 text-white"
              : "border border-white/40 bg-white/30 text-stone-600 backdrop-blur-xl hover:text-stone-900"
          }`}
          onClick={() => setActiveSource("all")}
          type="button"
        >
          全部
        </button>
        {SOURCE_ORDER.map((key) => (
          <button
            key={key}
            className={`rounded-full px-4 py-2 text-sm transition ${
              activeSource === key
                ? "bg-stone-900 text-white"
                : "border border-white/40 bg-white/30 text-stone-600 backdrop-blur-xl hover:text-stone-900"
            }`}
            onClick={() => setActiveSource(key)}
            type="button"
          >
            {SOURCE_LABELS[key]}
          </button>
        ))}
        <button
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-4 py-2 text-sm text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900 disabled:opacity-50"
          disabled={loading}
          onClick={load}
          type="button"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          刷新
        </button>
      </div>

      {/* 错误提示 */}
      {error ? (
        <div className="glass-panel rounded-[24px] p-6 text-sm text-red-600">
          加载失败：{error}
        </div>
      ) : null}

      {/* 部分源失败提示 */}
      {data && data.errors.length > 0 ? (
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 px-4 py-3 text-xs text-amber-700">
          部分源加载失败：{data.errors.map((e) => e.source).join("、")}
        </div>
      ) : null}

      {/* 列表 */}
      {loading && !data ? (
        <div className="glass-panel flex items-center justify-center gap-2 rounded-[24px] p-10 text-sm text-stone-500">
          <Loader2 className="size-4 animate-spin" />
          加载中…
        </div>
      ) : (
        <div className="glass-panel overflow-hidden rounded-[28px]">
          <div className="border-b border-white/20 px-6 py-4 sm:px-8">
            <h2 className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-stone-500">
              <Newspaper className="size-3.5" />
              最新条目
            </h2>
          </div>
          <div className="divide-y divide-stone-100">
            {filtered.map((item, idx) => (
              <a
                key={`${item.link}-${idx}`}
                className="group flex items-start gap-4 px-6 py-4 transition hover:bg-white/30 sm:px-8"
                href={item.link}
                rel="noreferrer"
                target="_blank"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6 text-stone-900 group-hover:text-stone-600">
                    {item.title}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-stone-500">
                    <span className="rounded-full bg-stone-100 px-2 py-0.5">
                      {item.sourceLabel}
                    </span>
                    {item.pubDate ? <span>{formatTime(item.pubDate)}</span> : null}
                  </div>
                </div>
                <ExternalLink className="size-4 shrink-0 text-stone-400 transition group-hover:text-stone-600" />
              </a>
            ))}
            {filtered.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-stone-500 sm:px-8">
                暂无内容
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
