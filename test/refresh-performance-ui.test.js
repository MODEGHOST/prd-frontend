import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");
const [app, loadingState, api, projectsPage, projectDetail] = await Promise.all([
  read("../src/app/App.jsx"),
  read("../src/components/ui/AppLoadingState.jsx"),
  read("../src/services/api.js"),
  read("../src/pages/ProjectsPage.jsx"),
  read("../src/pages/ProjectDetailPage.jsx"),
]);

test("hard refresh communicates that session restoration is still active", () => {
  assert.match(app, /AppLoadingState fullScreen/);
  assert.match(loadingState, /ระบบยังทำงานอยู่ ไม่ต้องกดรีเฟรชซ้ำ/);
  assert.match(loadingState, /role="status"/);
});

test("dashboard callers share one in-flight aggregate request", () => {
  assert.match(api, /let dashboardRequest = null/);
  assert.match(api, /if \(!dashboardRequest\)/);
  assert.match(api, /dashboardRequest = api\.get\("\/dashboard"\)\.finally/);
});

test("large project data loads only when its feature is opened", () => {
  assert.match(projectsPage, /if \(!open \|\| users\.length\) return undefined/);
  assert.match(projectDetail, /activeTab !== "weekly"/);
  assert.match(projectDetail, /activeTab !== "tasks"/);
  assert.match(projectDetail, /activeTab !== "chat"/);
  assert.match(projectDetail, /listByColumns\(\{ projectId, limit: 100 \}\)/);
  assert.match(projectDetail, /listMessages\(projectId, \{ limit: 100 \}\)/);
});
