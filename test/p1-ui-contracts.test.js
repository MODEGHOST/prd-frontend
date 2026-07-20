import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");
const [issueForm, issueDetail, issuesPage, accessPage, loginPage] = await Promise.all([
  read("../src/components/forms/IssueForm.jsx"),
  read("../src/components/issues/IssueDetail.jsx"),
  read("../src/pages/IssuesPage.jsx"),
  read("../src/pages/AccessAdminPage.jsx"),
  read("../src/pages/LoginPage.jsx"),
]);

test("requester issue form includes safe project and system context", () => {
  assert.match(issueForm, /name="projectId"/);
  assert.match(issueForm, /name="systemComponent"/);
  assert.match(issuesPage, /projectsApi\.picker/);
  assert.match(issueDetail, /system_component/);
  assert.match(issueDetail, /project_code/);
});

test("issue form supports drag drop and pasted images with partial failure notice", () => {
  assert.match(issueForm, /Upload\.Dragger/);
  assert.match(issueForm, /onPaste/);
  assert.match(issuesPage, /สร้าง Ticket แล้ว แต่แนบไฟล์ไม่ครบ/);
  assert.match(issueDetail, /downloadAttachment/);
  assert.match(issueDetail, /deleteAttachment/);
});

test("requester can edit or cancel only while server permissions allow it", () => {
  assert.match(issueDetail, /permissions\.canEdit/);
  assert.match(issueDetail, /permissions\.canCancel/);
  assert.match(issueDetail, /issuesApi\.cancel/);
  assert.match(issueDetail, /submitLabel="บันทึกการแก้ไข"/);
});

test("staff rejection requires a confirmed reason", () => {
  assert.match(issueDetail, /permissions\.canReject/);
  assert.match(issueDetail, /name="reason"/);
  assert.match(issueDetail, /whitespace: true/);
  assert.match(issueDetail, /issuesApi\.reject/);
  assert.match(issueDetail, /rejection_reason/);
});

test("admin invitation and invite-aware registration are reachable", () => {
  assert.match(accessPage, /InvitationsPanel/);
  assert.match(accessPage, /resendInvitation/);
  assert.match(accessPage, /revokeInvitation/);
  assert.match(loginPage, /inviteToken/);
  assert.match(loginPage, /setMode\("register"\)/);
  assert.match(loginPage, /disabled=\{Boolean\(invitation\)\}/);
});
