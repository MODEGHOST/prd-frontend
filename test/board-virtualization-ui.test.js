import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [virtualList, projectDetail] = await Promise.all([
  readFile(new URL("../src/components/ui/VirtualList.jsx", import.meta.url), "utf8"),
  readFile(new URL("../src/pages/ProjectDetailPage.jsx", import.meta.url), "utf8"),
]);

test("VirtualList only mounts a window of items around the scroll position", () => {
  assert.match(virtualList, /export function VirtualList/);
  assert.match(virtualList, /paddingTop/);
  assert.match(virtualList, /paddingBottom/);
  assert.match(virtualList, /overscan/);
  assert.match(virtualList, /items\.slice\(startIndex, endIndex\)/);
});

test("project plan gantt window-renders rows for large plan lists", () => {
  assert.match(projectDetail, /visiblePlans/);
  assert.match(projectDetail, /project-plan-scroll/);
  assert.match(projectDetail, /updateWindowFromScroll/);
  assert.match(projectDetail, /topSpacer/);
  assert.match(projectDetail, /bottomSpacer/);
});
