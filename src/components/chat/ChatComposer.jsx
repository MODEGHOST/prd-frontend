import { useEffect, useRef, useState } from "react";
import { Button, Image, Input, Spin, Tag, Typography, message } from "antd";
import {
  CloseOutlined,
  DownloadOutlined,
  FileOutlined,
  PaperClipOutlined,
  RollbackOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { formatChatTimestamp } from "./chatTimeline";

export { chatTimelineMeta, formatChatTimestamp } from "./chatTimeline";

export const MAX_CHAT_FILES = 15;
export const CHAT_FILE_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt";
export const INLINE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function fileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function CompactChatComposer({
  onSend,
  sending = false,
  placeholder = "พิมพ์ข้อความ...",
  replyingTo = null,
  onCancelReply,
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const pickerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (replyingTo) inputRef.current?.focus?.();
  }, [replyingTo]);

  const addFiles = (incoming) => {
    const candidates = [...(incoming || [])].filter(Boolean);
    if (!candidates.length) return;
    setFiles((current) => {
      const existing = new Set(current.map(fileKey));
      const unique = candidates.filter((file) => !existing.has(fileKey(file)));
      const available = Math.max(0, MAX_CHAT_FILES - current.length);
      if (unique.length > available) {
        message.warning(`แนบไฟล์ได้ไม่เกิน ${MAX_CHAT_FILES} ไฟล์ต่อข้อความ`);
      }
      return [...current, ...unique.slice(0, available)];
    });
  };

  const submit = async () => {
    const trimmed = body.trim();
    if ((!trimmed && !files.length) || sending) return;
    const succeeded = await onSend(trimmed, files, replyingTo?.id || null);
    if (succeeded !== false) {
      setBody("");
      setFiles([]);
      onCancelReply?.();
      if (pickerRef.current) pickerRef.current.value = "";
    }
  };

  return (
    <div
      onDrop={(event) => {
        event.preventDefault();
        addFiles(event.dataTransfer?.files);
      }}
      onDragOver={(event) => event.preventDefault()}
    >
      {replyingTo ? (
        <div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border-l-4 border-red-600 bg-red-50 px-2.5 py-1.5 text-xs">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-red-700">
              ตอบกลับ {replyingTo.user_name || "ข้อความ"}
            </div>
            <div className="truncate text-slate-500">
              {replyingTo.body || (replyingTo.has_attachments ? "ไฟล์แนบ" : "ข้อความ")}
            </div>
          </div>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            aria-label="ยกเลิกการตอบกลับ"
            title="ยกเลิกการตอบกลับ"
            onClick={onCancelReply}
          />
        </div>
      ) : null}
      {files.length ? (
        <div className="mb-2 flex flex-wrap gap-1 rounded-lg bg-slate-50 p-2">
          {files.map((file) => (
            <Tag
              key={fileKey(file)}
              closable
              onClose={() => setFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)))}
              className="max-w-full"
            >
              <span className="inline-block max-w-56 truncate align-bottom">{file.name}</span>
            </Tag>
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <input
          ref={pickerRef}
          type="file"
          multiple
          accept={CHAT_FILE_ACCEPT}
          className="hidden"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <Button
          icon={<PaperClipOutlined />}
          aria-label="แนบไฟล์"
          title={`แนบไฟล์ได้สูงสุด ${MAX_CHAT_FILES} ไฟล์ต่อข้อความ`}
          onClick={() => pickerRef.current?.click()}
        />
        <Input.TextArea
          ref={inputRef}
          autoSize={{ minRows: 1, maxRows: 4 }}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onPaste={(event) => {
            const images = [...(event.clipboardData?.files || [])]
              .filter((file) => INLINE_IMAGE_TYPES.has(file.type));
            if (images.length) addFiles(images);
          }}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={sending}
          disabled={!body.trim() && !files.length}
          aria-label="ส่งข้อความ"
          onClick={submit}
        />
      </div>
    </div>
  );
}

export function ChatTimelineSeparator({ timestamp }) {
  return (
    <div className="flex justify-center py-2.5" role="separator">
      <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-[10px] font-medium text-slate-500">
        {formatChatTimestamp(timestamp)}
      </span>
    </div>
  );
}

export function ChatReplyQuote({ preview, mine = false, onClick }) {
  if (!preview) return null;
  const content = preview.body || (preview.has_attachments ? "ไฟล์แนบ" : "ข้อความ");
  return (
    <button
      type="button"
      className={`mb-1.5 block w-full min-w-0 rounded-lg border-l-4 px-2 py-1 text-left text-xs ${
        mine
          ? "border-red-200 bg-white/15 text-red-50"
          : "border-red-400 bg-slate-50 text-slate-600"
      }`}
      onClick={onClick}
      title="ไปยังข้อความต้นทาง"
    >
      <div className={`truncate font-semibold ${mine ? "text-white" : "text-red-700"}`}>
        {preview.user_name || "ข้อความต้นทาง"}
      </div>
      <div className="truncate">{content}</div>
    </button>
  );
}

export function ChatReplyAction({ onClick }) {
  return (
    <Button
      type="text"
      size="small"
      icon={<RollbackOutlined />}
      aria-label="ตอบกลับข้อความ"
      title="ตอบกลับข้อความ"
      onClick={onClick}
      className="!h-7 !w-7 !min-w-0 !p-0 !text-slate-400 opacity-50 transition-opacity hover:!bg-red-50 hover:!text-red-700 hover:opacity-100 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
    />
  );
}

function AuthenticatedImage({ attachment, loadInline }) {
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    loadInline(attachment)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setSource(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment, loadInline]);

  if (failed) return <Typography.Text type="secondary">โหลดตัวอย่างไม่ได้</Typography.Text>;
  if (!source) return <Spin size="small" />;
  return (
    <Image
      src={source}
      alt={attachment.original_name}
      width="100%"
      height="100%"
      className="!block h-full w-full"
      style={{ objectFit: "cover" }}
      preview={{ mask: "ดูรูปเต็ม" }}
    />
  );
}

export function ChatMessageAttachments({
  attachments = [],
  loadInline,
  download,
  mine = false,
}) {
  if (!attachments.length) return null;
  const images = attachments.filter((attachment) =>
    INLINE_IMAGE_TYPES.has(attachment.mime_type));
  const files = attachments.filter((attachment) =>
    !INLINE_IMAGE_TYPES.has(attachment.mime_type));
  return (
    <div className="mt-2 space-y-1.5">
      {images.length ? (
        <div className={`grid gap-0.5 overflow-hidden rounded-xl bg-black/10 ${
          images.length === 1 ? "grid-cols-1" : "grid-cols-2"
        }`}>
          {images.map((attachment) => (
            <div
              key={attachment.id}
              className={`group/image relative min-w-0 overflow-hidden bg-slate-200 ${
                images.length === 1 ? "aspect-video" : "aspect-[4/3]"
              }`}
            >
              <AuthenticatedImage
                attachment={attachment}
                loadInline={loadInline}
              />
              <button
                type="button"
                aria-label={`ดาวน์โหลด ${attachment.original_name}`}
                title="ดาวน์โหลด"
                onClick={() => download(attachment)}
                className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border-0 bg-black/55 text-white opacity-80 backdrop-blur-sm transition hover:bg-black/75 hover:opacity-100 focus:outline-2 focus:outline-offset-2 focus:outline-white sm:opacity-0 sm:group-hover/image:opacity-100 sm:focus:opacity-100"
              >
                <DownloadOutlined />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {files.length ? (
        <div className={`divide-y overflow-hidden rounded-lg border ${
          mine ? "divide-white/20 border-white/30 bg-white/10" : "divide-slate-200 border-slate-200 bg-slate-50"
        }`}>
          {files.map((attachment) => (
            <div key={attachment.id} className="flex min-w-0 items-center gap-2 px-2 py-1.5">
              <FileOutlined className="shrink-0" />
              <Typography.Text
                ellipsis={{ tooltip: attachment.original_name }}
                className={`min-w-0 flex-1 ${mine ? "!text-white" : ""}`}
              >
                {attachment.original_name}
              </Typography.Text>
              <span className={`shrink-0 text-[10px] ${mine ? "text-red-100" : "text-slate-400"}`}>
                {Math.ceil(Number(attachment.size_bytes || 0) / 1024)} KB
              </span>
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                aria-label={`ดาวน์โหลด ${attachment.original_name}`}
                title="ดาวน์โหลด"
                className={`!h-7 !w-7 !min-w-0 !p-0 ${mine ? "!text-white" : "!text-red-700"}`}
                onClick={() => download(attachment)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
