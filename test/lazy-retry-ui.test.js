import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importWithRetry, isChunkLoadError } from "../src/utils/lazyWithRetry.js";

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("isChunkLoadError detects common dynamic import failures", () => {
  assert.equal(
    isChunkLoadError(new Error("Failed to fetch dynamically imported module: http://x/a.js")),
    true,
  );
  assert.equal(isChunkLoadError(new Error("Loading chunk 3 failed")), true);
  assert.equal(isChunkLoadError(new Error("Cannot read properties of null")), false);
});

test("importWithRetry retries chunk failures a capped number of times with backoff", async () => {
  let calls = 0;
  const delays = [];
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => {
    delays.push(ms);
    return originalSetTimeout(fn, 0);
  };

  try {
    const result = await importWithRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new Error("Failed to fetch dynamically imported module");
        }
        return { default: "ok" };
      },
      { retries: 2, baseDelayMs: 1000 },
    );

    assert.equal(result.default, "ok");
    assert.equal(calls, 3);
    assert.deepEqual(delays, [1000, 2000]);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("importWithRetry does not retry non-chunk errors", async () => {
  let calls = 0;
  await assert.rejects(
    () => importWithRetry(async () => {
      calls += 1;
      throw new Error("Cannot read properties of null");
    }, { retries: 2, baseDelayMs: 10 }),
    /Cannot read properties of null/,
  );
  assert.equal(calls, 1);
});

test("routes and shells use lazyWithRetry instead of bare lazy", async () => {
  const [routes, app, issueDrawer, boundary] = await Promise.all([
    read("../src/app/routes.jsx"),
    read("../src/app/App.jsx"),
    read("../src/components/issues/IssueDrawerContext.jsx"),
    read("../src/components/ui/AppErrorBoundary.jsx"),
  ]);
  assert.match(routes, /lazyWithRetry/);
  assert.doesNotMatch(routes, /\blazy\(/);
  assert.match(app, /lazyWithRetry/);
  assert.match(app, /resetKey=\{location\.pathname\}/);
  assert.match(issueDrawer, /lazyWithRetry/);
  assert.match(boundary, /ลองอีกครั้ง/);
  assert.match(boundary, /projecthub:chunk-reload/);
});
