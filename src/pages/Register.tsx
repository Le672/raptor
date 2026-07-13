import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useAuthStore } from "@/hooks/useAuthStore";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function Register() {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }

    setLoading(true);

    try {
      const res = await api.register(email, password, name);
      setToken(res.token);
      setUser(res.user);
      navigate(res.user.role === "admin" ? "/admin" : "/");
    } catch (err: any) {
      setError(err.message || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md items-center px-6 py-12 lg:px-8">
      <div className="glass-panel w-full rounded-[32px] p-8">
        <div className="flex items-center gap-3">
          <HomeLink
            className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
          >
            <ArrowLeft className="size-3.5" />
            返回首页
          </HomeLink>
        </div>

        <div className="mt-8 space-y-2">
          <h1 className="font-display text-3xl text-stone-900">创建账号</h1>
          <p className="text-sm text-stone-500">注册一个 Yukino 账号</p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-2xl border border-red-200/40 bg-red-50/40 px-4 py-3 text-sm text-red-700 backdrop-blur-xl">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">昵称</label>
            <input
              className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的昵称"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">邮箱</label>
            <input
              className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">密码</label>
            <input
              className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">确认密码</label>
            <input
              className="w-full rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
              required
            />
          </div>

          <button
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900/80 px-5 py-3 text-sm text-white backdrop-blur-xl transition hover:-translate-y-0.5",
              loading && "opacity-60",
            )}
            disabled={loading}
            type="submit"
          >
            <UserPlus className="size-4" />
            {loading ? "注册中..." : "注册"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          已有账号？{" "}
          <Link className="text-stone-900 underline" to="/login">
            去登录
          </Link>
        </p>
      </div>
    </div>
  );
}
