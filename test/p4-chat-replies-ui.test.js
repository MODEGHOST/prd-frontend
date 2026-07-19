import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import dayjs from "dayjs";
import {
  chatTimelineMeta,
  formatChatTimestamp,
} from "../src/components/chat/chatTimeline.js";

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");
const [composer, miniChat, issueDetail, projectDetail, api] = await Promise.all([
  read("../src/components/chat/ChatComposer.jsx"),
  read("../src/components/chat/MiniChatDock.jsx"),
  read("../src/components/issues/IssueDetail.jsx"),
  read("../src/pages/ProjectDetailPage.jsx"),
  read("../src/services/api.js"),
]);

test("timeline separates first, ten-minute gaps, and day changes", () => {
  const messages = [
    { user_id: 1, created_at: "2026-07-19T09:00:00" },
    { user_id: 1, created_at: "2026-07-19T09:09:59" },
    { user_id: 2, created_at: "2026-07-19T09:19:59" },
    { user_id: 2, created_at: "2026-07-20T00:01:00" },
  ];
  assert.deepEqual(chatTimelineMeta(messages, 0), {
    showSeparator: true,
    compactSender: false,
  });
  assert.deepEqual(chatTimelineMeta(messages, 1), {
    showSeparator: false,
    compactSender: true,
  });
  assert.equal(chatTimelineMeta(messages, 2).showSeparator, true);
  assert.equal(chatTimelineMeta(messages, 3).showSeparator, true);
});

test("Thai timeline labels today, yesterday, and older dates", () => {
  const now = dayjs("2026-07-19T16:00:00");
  assert.equal(formatChatTimestamp("2026-07-19T09:30:00", now), "วันนี้ 09:30");
  assert.equal(formatChatTimestamp("2026-07-18T09:30:00", now), "เมื่อวาน 09:30");
  assert.match(formatChatTimestamp("2026-07-10T09:30:00", now), /^10 .+ 2026 09:30$/);
});

test("reply UI is shared across all chat surfaces without forward actions", () => {
  assert.match(composer, /replyingTo/);
  assert.match(composer, /onCancelReply/);
  assert.match(composer, /aria-label="ตอบกลับข้อความ"/);
  assert.match(composer, /ChatReplyQuote/);
  for (const surface of [miniChat, issueDetail, projectDetail]) {
    assert.match(surface, /<ChatReplyAction/);
    assert.match(surface, /<ChatReplyQuote/);
    assert.match(surface, /<ChatTimelineSeparator/);
    assert.doesNotMatch(surface, /Forward|ส่งต่อ/);
  }
});

test("JSON and multipart APIs carry replyToId", () => {
  assert.match(api, /sendMessage: \(id, body, files = \[\], replyToId = null\)/);
  assert.match(api, /addComment: \(id, body, files = \[\], replyToId = null\)/);
  assert.match(api, /payload\.append\("replyToId", String\(replyToId\)\)/);
});
