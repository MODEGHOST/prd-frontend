import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [issuesPage, layout] = await Promise.all([
  readFile(new URL("../src/pages/IssuesPage.jsx", import.meta.url), "utf8"),
  readFile(new URL("../src/layouts/AppLayout.jsx", import.meta.url), "utf8"),
]);

test("issues fetch six server-paginated records", () => {
  assert.match(issuesPage, /const PAGE_SIZE = 6/);
  assert.match(issuesPage, /\.list\(\{ page, limit: PAGE_SIZE \}\)/);
  assert.match(issuesPage, /pageSize=\{PAGE_SIZE\}/);
});

test("project options load only when the issue form opens", () => {
  assert.match(issuesPage, /if \(!open \|\| projects\.length\) return undefined/);
  assert.match(issuesPage, /projectsApi[\s\S]*\.picker\(\)/);
});

test("pending issue menu count uses a high-contrast badge", () => {
  assert.match(layout, /bg-amber-400/);
  assert.match(layout, /Ticket ที่ยังไม่ได้รับเรื่อง/);
  assert.match(layout, /pendingIssueCount > 99 \? "99\+"/);
});
