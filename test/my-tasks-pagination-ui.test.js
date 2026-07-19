import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../src/pages/MyTasksPage.jsx", import.meta.url), "utf8");

test("my work lists fetch and render four records per page", () => {
  assert.match(page, /const PAGE_SIZE = 4/);
  assert.match(page, /status,[\s\S]*page: 1,[\s\S]*limit: PAGE_SIZE/);
  assert.match(page, /changeTaskPage/);
  assert.match(page, /pageSize=\{PAGE_SIZE\}/);
});

test("my work cards use compact spacing", () => {
  assert.match(page, /className=\{canWorkIssues \? "mt-8" : ""\}/);
  assert.match(page, /gutter=\{\[18, 22\]\}/);
  assert.match(page, /body: \{ padding: 14 \}/);
});
