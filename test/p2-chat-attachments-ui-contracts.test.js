import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");
const [issueDetail, api, composer, miniChat, projectDetail] = await Promise.all([
  read("../src/components/issues/IssueDetail.jsx"),
  read("../src/services/api.js"),
  read("../src/components/chat/ChatComposer.jsx"),
  read("../src/components/chat/MiniChatDock.jsx"),
  read("../src/pages/ProjectDetailPage.jsx"),
]);

test("authenticated image previews use blobs and revoke object URLs", () => {
  assert.match(api, /loadInlineAttachment/);
  assert.match(api, /responseType: "blob"/);
  assert.match(issueDetail, /issuesApi\.loadInlineAttachment/);
  assert.match(issueDetail, /URL\.createObjectURL/);
  assert.match(issueDetail, /URL\.revokeObjectURL/);
  assert.match(issueDetail, /preview=\{\{ mask: "ดูรูปเต็ม" \}\}/);
  assert.match(issueDetail, /downloadAttachment/);
});

test("issue chat supports optional body, multiple files, drag-drop, and pasted images", () => {
  assert.match(api, /if \(!files\.length\) return api\.post[\s\S]*\{ body, replyToId \}/);
  assert.match(api, /const payload = new FormData\(\)/);
  assert.match(api, /payload\.append\("files", file\)/);
  assert.match(api, /headers: \{ "Content-Type": "multipart\/form-data" \}/);
  assert.doesNotMatch(issueDetail, /Upload\.Dragger/);
  assert.match(issueDetail, /<CompactChatComposer/);
  assert.match(composer, /files\.length \?/);
  assert.match(composer, /icon=\{<PaperClipOutlined \/>}/);
  assert.match(composer, /type="file"[\s\S]*multiple/);
  assert.match(composer, /onDrop=/);
  assert.match(composer, /clipboardData\?\.files/);
  assert.match(composer, /MAX_CHAT_FILES = 5/);
  assert.match(composer, /Math\.max\(0, MAX_CHAT_FILES - current\.length\)/);
  assert.doesNotMatch(composer, /beforeUpload/);
});

test("comment attachments render below their message with preview and download", () => {
  assert.match(issueDetail, /item\.attachments\?\.length/);
  assert.match(issueDetail, /item\.attachments\.map/);
  assert.match(issueDetail, /<AttachmentImage/);
  assert.match(issueDetail, /ดาวน์โหลด/);
});

test("mini and full project chat share compact attachment composer and renderer", () => {
  assert.match(miniChat, /<CompactChatComposer/);
  assert.match(miniChat, /<ChatMessageAttachments/);
  assert.match(miniChat, /projectsApi\.sendMessage\(chat\.entity_id, body, files, replyToId\)/);
  assert.match(projectDetail, /<CompactChatComposer/);
  assert.match(projectDetail, /<ChatMessageAttachments/);
  assert.match(api, /sendMessage: \(id, body, files = \[\], replyToId = null\)/);
  assert.match(api, /responseType: "blob"/);
  assert.match(composer, /URL\.createObjectURL/);
  assert.match(composer, /URL\.revokeObjectURL/);
});

test("mini chat keeps history position and offers a jump-to-latest control", () => {
  assert.match(miniChat, /ref=\{scrollRef\}/);
  assert.match(miniChat, /onScroll=\{handleChatScroll\}/);
  assert.match(miniChat, /nearBottomRef/);
  assert.match(miniChat, /showLatestButton \?/);
  assert.match(miniChat, /กลับไปข้อความล่าสุด/);
  assert.match(miniChat, /h-\[420px\]/);
  assert.match(miniChat, /w-\[420px\]/);
});
