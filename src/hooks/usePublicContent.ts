import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PostSummary, BoxItem } from "@/lib/content";

type State<T> = { data: T[]; loading: boolean; error: string };
const cache = new Map<string, unknown[]>();
function useContent<T>(key: string, fetcher: () => Promise<T[]>, enabled = true) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<State<T>>({ data: (cache.get(key) as T[] | undefined) ?? [], loading: enabled, error: "" });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState(previous => ({ ...previous, loading: true, error: "" }));
    fetcher().then(data => {
      if (!Array.isArray(data)) throw new Error("服务返回的数据格式不正确");
      if (active) { cache.set(key, data); setState({ data, loading: false, error: "" }); }
    }).catch(error => { if (active) setState(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : "加载失败" })); });
    return () => { active = false; };
  }, [enabled, key, fetcher, version]);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  return { ...state, refresh };
}
const posts = () => api.getPosts().then(result => result.posts);
const box = () => api.getBoxItems().then(result => result.items);
export const usePublicPosts = (enabled = true) => useContent<PostSummary>("posts", posts, enabled);
export const useBoxItems = () => useContent<BoxItem>("box", box);
