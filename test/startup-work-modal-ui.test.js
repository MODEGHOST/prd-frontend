import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");
const [app, layout, modal] = await Promise.all([
  read("../src/app/App.jsx"),
  read("../src/layouts/AppLayout.jsx"),
  read("../src/components/notifications/StartupWorkModal.jsx"),
]);

test("authenticated startup opens a role-aware work summary modal", () => {
  assert.match(app, /dashboardApi\.get\(\)/);
  assert.match(app, /setStartupModalOpen\(true\)/);
  assert.match(app, /<LoginPage onLogin=\{completeLogin\}/);
  assert.match(app, /showStartupSummary=\{loginSummaryRequested\}/);
  assert.doesNotMatch(app, /<LoginPage onLogin=\{setSession\}/);
  assert.match(app, /<StartupWorkModal/);
  assert.match(modal, /requesterView/);
  assert.match(modal, /คำขอของคุณที่ยังดำเนินการไม่เสร็จ/);
  assert.match(modal, /อัปเดตที่ยังไม่ได้อ่าน/);
});

test("issue navigation shows the pending acceptance badge", () => {
  assert.match(app, /pendingIssueCount=\{workSummary\?\.pendingIssueCount \|\| 0\}/);
  assert.match(app, /notification\.entity_type === "issue"\) refreshWorkSummary\(\)/);
  assert.match(layout, /item\.key === "issues"/);
  assert.match(layout, /Ticket ที่ยังไม่ได้รับเรื่อง/);
});
