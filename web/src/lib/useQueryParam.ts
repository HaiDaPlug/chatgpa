import { useEffect, useState } from "react";

export function useQueryParam(name: string, fallback = "") {
  // Initialize from current URL
  const [value, setValue] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) ?? fallback;
  });

  // Sync value to URL when it changes
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    if (value === "" || value == null) {
      usp.delete(name);
    } else {
      usp.set(name, value);
    }
    const next = `${window.location.pathname}?${usp.toString()}`;
    window.history.replaceState({}, "", next);
  }, [name, value]);

  // Listen for popstate (browser back/forward)
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const newValue = params.get(name) ?? fallback;
      setValue(newValue);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [name, fallback]);

  return [value, setValue] as const;
}

export function useQueryNumber(name: string, fallback = 1) {
  const [s, setS] = useQueryParam(name, String(fallback));
  const n = Number(s) || fallback;
  const setN = (v: number) => setS(String(v));
  return [n, setN] as const;
}
