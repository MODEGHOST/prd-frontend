import { useCallback, useEffect, useState } from "react";

const SESSION_KEY = "projecthub-session";

function normalizeSession(value) {
  if (!value?.user || typeof value.user !== "object") return null;
  return {
    user: value.user,
    companies: Array.isArray(value.companies) ? value.companies : [],
    authenticated: true,
  };
}

function readStoredSession() {
  try {
    return normalizeSession(JSON.parse(localStorage.getItem(SESSION_KEY)));
  } catch {
    return null;
  }
}

export function useSession() {
  const [session, setSession] = useState(readStoredSession);

  const saveSession = useCallback((value) => {
    const normalized = normalizeSession(value);
    setSession(normalized);
    if (normalized) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        user: normalized.user,
        companies: normalized.companies,
      }));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    const syncSession = (event) => {
      if (event.key === SESSION_KEY) setSession(readStoredSession());
    };
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  return [session, saveSession];
}
