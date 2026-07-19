import { useCallback, useEffect, useState } from "react";

const SESSION_KEY = "projecthub-session";

function normalizeSession(value) {
  return value?.token && value?.user && typeof value.user === "object" ? value : null;
}

function readStoredSession() {
  try {
    return normalizeSession(JSON.parse(localStorage.getItem(SESSION_KEY)));
  } catch {
    return null;
  }
}

function tokenExpiresAt(token) {
  try {
    const payload = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")));
    return Number.isFinite(decoded.exp) ? decoded.exp * 1000 : null;
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
      localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
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

  useEffect(() => {
    const expiresAt = tokenExpiresAt(session?.token);
    if (!expiresAt) return undefined;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      window.dispatchEvent(new Event("projecthub:session-expired"));
      return undefined;
    }
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event("projecthub:session-expired"));
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [session?.token]);

  return [session, saveSession];
}
