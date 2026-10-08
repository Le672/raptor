import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { validateBoxInput } from "@/lib/content";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

type BoxItem = {
  id: number;
  title: string;
  description: string;
  url: string;
  category: string;
  size: string;
  sort_order: number;
};

const CATEGORIES = [
  { id: "software", label: "软件" },
  { id: "document", label: "文档" },
  { id: "media", label: "媒体" },
  { id: "other", label: "其他" },
];

export default function AdminBox() {
  useDocumentMeta("资源管理", "管理公开资源链接与分类。");
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [items, setItems] = useState<BoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BoxItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    url: "",
    category: "other",
    size: "",
    sort_order: 0,
  });
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/login?next=%2Fadmin%2Fbox", { replace: true });
      return;
    }
    loadItems();
  }, [user]);

  const loadItems = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.getBoxItems();
      setItems(res.items);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "资源加载失败");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", description: "", url: "", category: "other", size: "", sort_order: 0 });
    setShowForm(true);
    setError("");
  };

  const openEdit = (item: BoxItem) => {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description,
      url: item.url,
      category: item.category,
      size: item.size,
      sort_order: item.sort_order,
    });
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.title || !form.url) {
      setError("标题和链接不能为空");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.updateBoxItem(editing.id, validateBoxInput(form));
      } else {
        await api.createBoxItem(validateBoxInput(form));
      }
      setShowForm(false);
      await loadItems();
    } catch (err: any) {
      setError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (saving) return;
    if (!confirm("确定要删除这个资源吗？")) return;
    setSaving(true);
    setError("");
    try {
      await api.deleteBoxItem(id);
      await loadItems();
    } catch (err: any) {
      setError(err.message || "删除失败");
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== "admin") return null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 lg:px-8">
      <div>
        <div className="flex items-center gap-3">
          <Link
            className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
            to="/admin"
          >
            <ArrowLeft className="size-3.5" />
            返回管理台
          </Link>
          <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-stone-600 backdrop-blur-xl">
            资源管理
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <h1 className="font-display text-4xl text-stone-900">资源管理</h1>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-stone-900/80 px-5 py-2.5 text-sm text-white backdrop-blur-xl transition hover:-translate-y-0.5"
            onClick={openCreate}
            disabled={saving}
          >
            <Plus className="size-4" />
            添加资源
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200/40 bg-red-50/40 px-4 py-3 text-sm text-red-700 backdrop-blur-xl">{error}</div>
      )}

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200/40 bg-red-50/40 px-4 py-3 text-sm text-red-700">
          <span>{loadError}{items.length > 0 ? " · 当前列表尚未刷新" : ""}</span>
          <button type="button" disabled={loading} onClick={() => void loadItems()} className="underline">重新加载资源</button>
        </div>
      )}

      {showForm && (
        <form className="glass-panel rounded-[32px] p-6 sm:p-8" onSubmit={event => { event.preventDefault(); void handleSave(); }}>
          <h2 className="font-display text-2xl text-stone-900">
            {editing ? "编辑资源" : "添加资源"}
          </h2>
          <div className="mt-6 grid gap-5">
            <div className="grid gap-2">
              <label htmlFor="resource-title" className="text-sm font-medium text-stone-700">标题</label>
              <input
                className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                id="resource-title"
                required maxLength={200}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="resource-description" className="text-sm font-medium text-stone-700">描述</label>
              <input
                className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                id="resource-description"
                maxLength={2000}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="resource-url" className="text-sm font-medium text-stone-700">链接</label>
              <input
                className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                id="resource-url"
                type="url" required maxLength={2000}
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-3 gap-5">
              <div className="grid gap-2">
                <label htmlFor="resource-category" className="text-sm font-medium text-stone-700">分类</label>
                <select
                  className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                  id="resource-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="resource-size" className="text-sm font-medium text-stone-700">大小</label>
                <input
                  className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                  id="resource-size"
                  maxLength={100}
                  value={form.size}
                  onChange={(e) => setForm({ ...form, size: e.target.value })}
                  placeholder="~80 MB"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="resource-sort_order" className="text-sm font-medium text-stone-700">排序</label>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                  id="resource-sort_order"
                  min={-1000000} max={1000000} step={1}
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl bg-stone-900/80 px-5 py-3 text-sm text-white backdrop-blur-xl transition hover:-translate-y-0.5",
                  saving && "opacity-60",
                )}
                disabled={saving}
                type="submit"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              <button
                className="rounded-2xl border border-white/40 bg-white/30 px-5 py-3 text-sm text-stone-700 backdrop-blur-xl transition hover:border-white/60"
                type="button"
                disabled={saving}
                onClick={() => setShowForm(false)}
              >
                取消
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">加载中...</p>
      ) : items.length === 0 && !loadError ? (
        <div className="glass-panel rounded-[32px] p-12 text-center">
          <p className="text-sm text-stone-500">还没有资源，点击上方按钮添加</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="glass-panel flex items-center justify-between gap-4 rounded-[24px] p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="truncate font-display text-xl text-stone-900">{item.title}</h3>
                  <span className="rounded-full border border-white/30 bg-white/20 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-stone-500 backdrop-blur-xl">
                    {item.category}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-stone-500">{item.description}</p>
                <p className="text-xs text-stone-400">{item.url}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  className="rounded-full border border-white/40 bg-white/30 p-2.5 text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
                  onClick={() => openEdit(item)}
                  disabled={saving}
                  aria-label={`编辑资源 ${item.title}`}
                  title="编辑"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  className="rounded-full border border-red-200/60 bg-white/30 p-2.5 text-red-500 backdrop-blur-xl transition hover:border-red-300 hover:text-red-700"
                  onClick={() => handleDelete(item.id)}
                  disabled={saving}
                  aria-label={`删除资源 ${item.title}`}
                  title="删除"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
