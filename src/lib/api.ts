const BASE = "/api";

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = localStorage.getItem("yukino_auth_token");
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

  const res = await fetch(url, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "请求失败");
  return data;
}

export const api = {
  getMe: () => request<unknown>("GET", "/auth/me"),
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>("POST", "/auth/me", { email, password }, { action: "login" }),
  register: (email: string, password: string, name: string) =>
    request<{ token: string; user: any }>("POST", "/auth/me", { email, password, name }, { action: "register" }),
  logout: () => request<unknown>("POST", "/auth/me", undefined, { action: "logout" }),

  getPosts: () => request<{ posts: any[] }>("GET", "/posts"),
  getPost: (slug: string) => request<{ post: any }>("GET", "/posts", undefined, { slug }),
  getPostById: (id: number) => request<{ post: any }>("GET", "/posts", undefined, { id: String(id) }),
  createPost: (data: { title: string; slug: string; summary: string; content: string; tag: string; published: boolean }) =>
    request<{ id: number }>("POST", "/posts", data),
  updatePost: (id: number, data: { title: string; slug: string; summary: string; content: string; tag: string; published: boolean }) =>
    request<{ message: string }>("PUT", "/posts", data, { id: String(id) }),
  deletePost: (id: number) =>
    request<{ message: string }>("DELETE", "/posts", undefined, { id: String(id) }),

  getBoxItems: () => request<{ items: any[] }>("GET", "/box"),
  createBoxItem: (data: { title: string; description: string; url: string; category: string; size: string; sort_order: number }) =>
    request<{ id: number }>("POST", "/box", data),
  updateBoxItem: (id: number, data: { title: string; description: string; url: string; category: string; size: string; sort_order: number }) =>
    request<{ message: string }>("PUT", "/box", data, { id: String(id) }),
  deleteBoxItem: (id: number) =>
    request<{ message: string }>("DELETE", "/box", undefined, { id: String(id) }),
};
