import { create } from "zustand";

export type UserRole = "admin" | "user";

export type User = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
};

type AuthStore = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  isAdmin: () => boolean;
};

const TOKEN_KEY = "yukino_auth_token";
const USER_KEY = "yukino_auth_user";

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    const user = raw ? JSON.parse(raw) : null;
    return user && Number.isSafeInteger(user.id) && typeof user.email === "string" && typeof user.name === "string" && ["admin", "user"].includes(user.role) ? user : null;
  } catch {
    return null;
  }
}

function loadStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function store(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* Keep this session usable in memory. */ }
}

const storedToken = loadStoredToken();

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: storedToken ? loadStoredUser() : null,
  token: storedToken,
  isLoading: false,
  setUser: (user) => {
    store(USER_KEY, user ? JSON.stringify(user) : null);
    set({ user });
  },
  setToken: (token) => {
    store(TOKEN_KEY, token);
    set({ token });
  },
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    store(TOKEN_KEY, null);
    store(USER_KEY, null);
    set({ user: null, token: null, isLoading: false });
  },
  isAdmin: () => get().user?.role === "admin",
}));
