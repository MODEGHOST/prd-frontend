import { lazy } from "react";

const DEFAULT_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 1000;

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function isChunkLoadError(error) {
  const message = String(error?.message || error || "");
  return /Failed to fetch dynamically imported module|Loading chunk [\d]+ failed|Importing a module script failed|error loading dynamically imported module/i
    .test(message);
}

/**
 * Run a dynamic import with a capped retry budget and backoff.
 * Retries only on chunk/network import failures — not on render bugs.
 * Max attempts = 1 initial + `retries` (default 3 total).
 */
export async function importWithRetry(importer, {
  retries = DEFAULT_RETRIES,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
} = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await importer();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < retries && isChunkLoadError(error);
      if (!canRetry) throw error;
      await wait(baseDelayMs * (attempt + 1));
    }
  }
  throw lastError;
}

/**
 * Lazy-load a route/component with a small, capped retry budget.
 * While retrying, React Suspense keeps showing the loading Spin — no rapid loops.
 */
export function lazyWithRetry(importer, options) {
  return lazy(() => importWithRetry(importer, options));
}
