import { getApiBase } from "@/lib/runtime";
import type { User } from "@/hooks/useAuthStore";
import type { UsesDocument, UsesResponse } from "@/lib/uses";
import type { Post, PostSummary, PostInput, BoxItem, BoxInput } from "@/lib/content";
import { useAuthStore } from "@/hooks/useAuthStore";
import type { StatusReport } from "@/lib/status";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const BASE = getApiBase();

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = useAuthStore.getState().token;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<T> {
  let url = `${BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { method, headers: getHeaders(), body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    let data;
    try { data = await res.json(); } catch { throw new ApiError("服务暂时不可用，请稍后重试", res.status); }
    if (!res.ok) {
      if (res.status === 401 && !path.includes("/auth/")) useAuthStore.getState().logout();
      throw new ApiError(data && typeof data.error === "string" ? data.error : "请求失败", res.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted ? "请求超时，请重试" : "连接失败，请检查网络后重试", 0);
  } finally { clearTimeout(timer); }
}

export const api = {
  getStatus: () => request<StatusReport>("GET", "/status"),
  getMe: () => request<{ user: User }>("GET", "/auth/me"),
  login: (email: string, password: string, source: "mail" | "local" = "mail") =>
    request<{ token: string; user: User }>("POST", "/auth/me", { email, password, source }, { action: "login" }),
  register: (email: string, password: string, name: string) =>
    request<{ token: string; user: User }>("POST", "/auth/me", { email, password, name }, { action: "register" }),
  logout: () => request<unknown>("POST", "/auth/me", undefined, { action: "logout" }),
  getUses: () => request<UsesResponse>("GET", "/uses"),
  updateUses: (content: UsesDocument, revision: number) =>
    request<UsesResponse>("PUT", "/uses", { content, revision }),

  getPosts: () => request<{ posts: PostSummary[] }>("GET", "/posts"),
  getAdminPosts: () => request<{ posts: PostSummary[] }>("GET", "/posts", undefined, { admin: "1" }),
  getPost: (slug: string) => request<{ post: Post }>("GET", "/posts", undefined, { slug }),
  getPostById: (id: number) => request<{ post: Post }>("GET", "/posts", undefined, { id: String(id) }),
  createPost: (data: PostInput) =>
    request<{ id: number }>("POST", "/posts", data),
  updatePost: (id: number, data: PostInput) =>
    request<{ message: string }>("PUT", "/posts", data, { id: String(id) }),
  deletePost: (id: number) =>
    request<{ message: string }>("DELETE", "/posts", undefined, { id: String(id) }),

  getBoxItems: () => request<{ items: BoxItem[] }>("GET", "/box"),
  createBoxItem: (data: BoxInput) =>
    request<{ id: number }>("POST", "/box", data),
  updateBoxItem: (id: number, data: BoxInput) =>
    request<{ message: string }>("PUT", "/box", data, { id: String(id) }),
  deleteBoxItem: (id: number) =>
    request<{ message: string }>("DELETE", "/box", undefined, { id: String(id) }),
};
