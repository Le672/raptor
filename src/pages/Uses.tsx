import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Monitor, Keyboard, HardDrive, Code2, Globe, Pencil, Plus, Save, Trash2, X, Loader2 } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useAuthStore } from "@/hooks/useAuthStore";
import { api, ApiError } from "@/lib/api";
import { DEFAULT_USES, USES_ICONS, validateUsesDocument } from "@/lib/uses";
import type { UsesCategory, UsesDocument, UsesIcon, UsesItem } from "@/lib/uses";

const icons = { monitor: Monitor, keyboard: Keyboard, code: Code2, globe: Globe, drive: HardDrive };
const iconNames = { monitor: "设备", keyboard: "外设", code: "开发", globe: "服务", drive: "软件" };
const inputClass = "mt-1 w-full min-w-0 rounded-xl border border-stone-300/60 bg-white/70 px-3 py-2.5 text-sm text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300/60 bg-white/60 px-4 py-2.5 text-sm text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50";
const clone = (content: UsesDocument): UsesDocument => JSON.parse(JSON.stringify(content));

export default function Uses() {
  useDocumentMeta("设备与环境", "记录常用设备、编辑器、开发环境和个人工作流。");
  const token = useAuthStore((state) => state.token);
  const [content, setContent] = useState<UsesDocument>(DEFAULT_USES);
  const [draft, setDraft] = useState<UsesDocument>(() => clone(DEFAULT_USES));
  const [revision, setRevision] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [serverCanEdit, setServerCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const canEdit = Boolean(token && serverCanEdit);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setServerCanEdit(false);
    setEditing(false);
    setError("");
    api.getUses().then((data) => {
      if (!active) return;
      setContent(data.content);
      setRevision(data.revision);
      setUpdatedAt(data.updatedAt);
      setServerCanEdit(data.canEdit);
      setLoaded(true);
    }).catch((error) => {
      if (active) setError(error instanceof Error ? error.message : "清单读取失败，请稍后重试");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, reload]);

  const changeCategory = (id: string, changes: Partial<UsesCategory>) => setDraft((current) => ({
    ...current, categories: current.categories.map((category) => category.id === id ? { ...category, ...changes } : category),
  }));
  const changeItem = (categoryId: string, itemId: string, changes: Partial<UsesItem>) => setDraft((current) => ({
    ...current, categories: current.categories.map((category) => category.id === categoryId ? {
      ...category, items: category.items.map((item) => item.id === itemId ? { ...item, ...changes } : item),
    } : category),
  }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || saving) return;
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const data = await api.updateUses(validateUsesDocument(draft), revision);
      setContent(data.content);
      setRevision(data.revision);
      setUpdatedAt(data.updatedAt);
      setEditing(false);
      setMessage("已保存，访客现在可以看到最新清单。");
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存失败，请稍后重试");
      if (error instanceof ApiError && [401, 403].includes(error.status)) setServerCanEdit(false);
    } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10 lg:px-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <HomeLink className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600">
            <ArrowLeft className="size-3.5" />返回主页
          </HomeLink>
          <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-stone-600">uses.yukino.bond</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-4xl text-stone-900 sm:text-5xl">设备与环境</h1>
          {canEdit && !editing && !loading && (
            <button className={buttonClass} onClick={() => { setDraft(clone(content)); setEditing(true); setError(""); setMessage(""); }}>
              <Pencil size={16} />编辑清单
            </button>
          )}
        </div>
        {!editing && <p className="mt-3 max-w-xl whitespace-pre-wrap text-sm leading-7 text-stone-600">{content.description}</p>}
        {!token && <Link to="/login?next=/uses" className="mt-3 inline-block text-xs text-stone-500 underline underline-offset-4">管理员登录</Link>}
        {updatedAt && !editing && <p className="mt-3 text-xs text-stone-400">最近更新：<time dateTime={updatedAt}>{new Date(updatedAt).toLocaleDateString("zh-CN")}</time></p>}
      </div>

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}{!editing && <button className="ml-3 underline" onClick={() => setReload((value) => value + 1)}>重新加载</button>}
      </div>}
      {message && <p role="status" className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p>}

      {loading ? <p role="status" className="inline-flex items-center gap-2 text-sm text-stone-500"><Loader2 size={16} className="animate-spin" />正在读取清单…</p> : editing && canEdit ? (
        <form onSubmit={save} className="space-y-6">
          <fieldset disabled={saving} className="space-y-6 disabled:opacity-60">
            <div className="glass-panel rounded-[28px] p-6">
              <label className="block text-sm text-stone-600">页面介绍
                <textarea className={inputClass} rows={3} maxLength={1200} value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <p className="mt-3 text-xs text-stone-500">修改后点击保存，清单将公开展示。取消编辑会放弃本次修改。</p>
            </div>
            {draft.categories.map((category, categoryIndex) => (
              <section key={category.id} aria-label={`编辑分类 ${categoryIndex + 1}`} className="glass-panel min-w-0 space-y-4 rounded-[28px] p-5 sm:p-6">
                <div className="grid min-w-0 items-end gap-3 sm:grid-cols-[1fr_120px_auto]">
                  <label className="min-w-0 text-xs text-stone-600">分类名称
                    <input className={inputClass} maxLength={80} required value={category.title} onChange={(event) => changeCategory(category.id, { title: event.target.value })} />
                  </label>
                  <label className="text-xs text-stone-600">图标
                    <select className={inputClass} value={category.icon} onChange={(event) => changeCategory(category.id, { icon: event.target.value as UsesIcon })}>
                      {USES_ICONS.map((icon) => <option key={icon} value={icon}>{iconNames[icon]}</option>)}
                    </select>
                  </label>
                  <button type="button" className={buttonClass} aria-label={`删除分类 ${category.title || categoryIndex + 1}`}
                    onClick={() => setDraft((current) => ({ ...current, categories: current.categories.filter((item) => item.id !== category.id) }))}>
                    <Trash2 size={15} />删除分类
                  </button>
                </div>
                {category.items.map((item, itemIndex) => (
                  <div key={item.id} className="min-w-0 rounded-2xl border border-stone-200 bg-white/40 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-stone-500">条目 {itemIndex + 1}</span>
                      <button type="button" aria-label={`删除条目 ${item.label || itemIndex + 1}`} className="rounded-lg p-2 text-stone-500 hover:bg-red-50 hover:text-red-700"
                        onClick={() => changeCategory(category.id, { items: category.items.filter((entry) => entry.id !== item.id) })}><Trash2 size={15} /></button>
                    </div>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <label className="min-w-0 text-xs text-stone-600">条目名称
                        <input className={inputClass} required maxLength={80} placeholder="例如：笔记本" value={item.label} onChange={(event) => changeItem(category.id, item.id, { label: event.target.value })} />
                      </label>
                      <label className="min-w-0 text-xs text-stone-600">设备或软件名称
                        <input className={inputClass} required maxLength={240} placeholder="例如：MacBook Pro" value={item.value} onChange={(event) => changeItem(category.id, item.id, { value: event.target.value })} />
                      </label>
                    </div>
                    <label className="mt-3 block text-xs text-stone-600">补充说明
                      <input className={inputClass} maxLength={500} value={item.detail} onChange={(event) => changeItem(category.id, item.id, { detail: event.target.value })} />
                    </label>
                  </div>
                ))}
                <button type="button" className={buttonClass} disabled={category.items.length >= 50}
                  onClick={() => changeCategory(category.id, { items: [...category.items, { id: crypto.randomUUID(), label: "", value: "", detail: "" }] })}>
                  <Plus size={16} />添加条目
                </button>
              </section>
            ))}
            <button type="button" className={buttonClass} disabled={draft.categories.length >= 20}
              onClick={() => setDraft((current) => ({ ...current, categories: [...current.categories, { id: crypto.randomUUID(), title: "", icon: "monitor", items: [] }] }))}>
              <Plus size={16} />添加分类
            </button>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm text-white disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{saving ? "保存中…" : "保存清单"}
            </button>
            <button type="button" className={buttonClass} disabled={saving} onClick={() => { setEditing(false); setError(""); }}><X size={16} />取消编辑</button>
          </div>
        </form>
      ) : loaded && (
        <div className="grid gap-6 sm:grid-cols-2">
          {content.categories.map((category) => {
            const Icon = icons[category.icon];
            return <section key={category.id} className="glass-panel min-w-0 rounded-[28px] p-6">
              <div className="mb-5 flex items-center gap-2"><Icon className="size-4 shrink-0 text-stone-500" /><h2 className="break-words text-sm tracking-[0.16em] text-stone-500">{category.title}</h2></div>
              <div className="space-y-3">
                {category.items.map((item) => <div key={item.id} className="rounded-2xl border border-white/30 bg-white/20 px-4 py-3">
                  <div className="flex flex-col justify-between gap-1 sm:flex-row sm:gap-3">
                    <span className="break-words text-xs text-stone-500">{item.label}</span><span className="min-w-0 break-words text-sm text-stone-900 sm:text-right">{item.value}</span>
                  </div>
                  {item.detail && <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-stone-500">{item.detail}</p>}
                </div>)}
                {!category.items.length && <p className="text-sm text-stone-400">暂未添加条目</p>}
              </div>
            </section>;
          })}
          {!content.categories.length && <p className="text-sm text-stone-500">设备清单正在整理中。</p>}
        </div>
      )}
    </div>
  );
}
