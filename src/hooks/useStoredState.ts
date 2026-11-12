import { Dispatch, SetStateAction, useEffect, useState } from "react";

/** Small local preferences remain usable when browser storage is unavailable. */
export function useStoredState<T>(key: string, initial: T, validate: (value: unknown) => value is T): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
      return validate(parsed) ? parsed : initial;
    } catch { return initial; }
  });
  const [persistent, setPersistent] = useState(true);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); setPersistent(true); }
    catch { setPersistent(false); }
  }, [key, value]);
  return [value, setValue, persistent];
}
