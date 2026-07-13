import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Post = {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content: string;
  tag: string;
  published: number;
  created_at: string;
  updated_at: string;
};

export default function AdminPosts() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Post | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    summary: "",
    content: "",
    tag: "开发",
    published: false,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/");
      return;
    }
    loadPosts();
  }, [user]);

  const loadPosts = async () => {
    try {
      const res = await api.getPosts();
      setPosts(res.posts);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", slug: "", summary: "", content: "", tag: "开发", published: false });
    setShowForm(true);
    setError("");
  };

  const openEdit = (post: Post) => {
    setEditing(post);
    setForm({
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      content: post.content,
      tag: post.tag,
      published: post.published === 1,
    });
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (!form.title || !form.slug || !form.content) {
      setError("标题、slug 和内容不能为空");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.updatePost(editing.id, form);
      } else {
        await api.createPost(form);
      }
      setShowForm(false);
      await loadPosts();
    } catch (err: any) {
      setError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这篇文章吗？")) return;
    try {
      await api.deletePost(id);
      await loadPosts();
    } catch (err: any) {
      setError(err.message || "删除失败");
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
            文章管理
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <h1 className="font-display text-4xl text-stone-900">文章管理</h1>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-stone-900/80 px-5 py-2.5 text-sm text-white backdrop-blur-xl transition hover:-translate-y-0.5"
            onClick={openCreate}
          >
            <Plus className="size-4" />
            新建文章
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200/40 bg-red-50/40 px-4 py-3 text-sm text-red-700 backdrop-blur-xl">{error}</div>
      )}

      {showForm && (
        <div className="glass-panel rounded-[32px] p-6 sm:p-8">
          <h2 className="font-display text-2xl text-stone-900">
            {editing ? "编辑文章" : "新建文章"}
          </h2>
          <div className="mt-6 grid gap-5">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-stone-700">标题</label>
              <input
                className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-stone-700">Slug（URL 标识）</label>
              <input
                className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="my-post-slug"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-stone-700">摘要</label>
              <input
                className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-stone-700">正文（支持 Markdown）</label>
              <textarea
                className="min-h-[300px] w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700">标签</label>
                <select
                  className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                  value={form.tag}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}
                >
                  <option value="开发">开发</option>
                  <option value="随笔">随笔</option>
                  <option value="收藏">收藏</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm backdrop-blur-xl">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm({ ...form, published: e.target.checked })}
                    className="size-4"
                  />
                  发布（勾选后对访客可见）
                </label>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl bg-stone-900/80 px-5 py-3 text-sm text-white backdrop-blur-xl transition hover:-translate-y-0.5",
                  saving && "opacity-60",
                )}
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? "保存中..." : "保存"}
              </button>
              <button
                className="rounded-2xl border border-white/40 bg-white/30 px-5 py-3 text-sm text-stone-700 backdrop-blur-xl transition hover:border-white/60"
                onClick={() => setShowForm(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">加载中...</p>
      ) : posts.length === 0 ? (
        <div className="glass-panel rounded-[32px] p-12 text-center">
          <p className="text-sm text-stone-500">还没有文章，点击上方按钮创建第一篇</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="glass-panel flex items-center justify-between gap-4 rounded-[24px] p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="truncate font-display text-xl text-stone-900">{post.title}</h3>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.2em]",
                      post.published
                        ? "bg-green-100 text-green-700"
                        : "border border-white/30 bg-white/20 text-stone-500 backdrop-blur-xl",
                    )}
                  >
                    {post.published ? "已发布" : "草稿"}
                  </span>
                  <span className="rounded-full border border-white/30 bg-white/20 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-stone-500 backdrop-blur-xl">
                    {post.tag}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-stone-500">{post.summary}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  className="rounded-full border border-white/40 bg-white/30 p-2.5 text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
                  onClick={() => openEdit(post)}
                  title="编辑"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  className="rounded-full border border-red-200/60 bg-white/30 p-2.5 text-red-500 backdrop-blur-xl transition hover:border-red-300 hover:text-red-700"
                  onClick={() => handleDelete(post.id)}
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
