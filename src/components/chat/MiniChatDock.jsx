import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Button, Empty, Spin, message } from "antd";
import {
  CloseOutlined,
  DownOutlined,
  ExpandOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { issuesApi, projectsApi } from "../../services/api";
import { getSocket, joinIssueRoom, joinProjectRoom } from "../../services/socket";
import {
  ChatMessageAttachments,
  ChatReplyAction,
  ChatReplyQuote,
  ChatTimelineSeparator,
  CompactChatComposer,
  chatTimelineMeta,
} from "./ChatComposer";

function MiniChat({ chat, session, onClose, onExpandFull }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showLatestButton, setShowLatestButton] = useState(false);
  const [headerTitle, setHeaderTitle] = useState(chat.title || "แชท");
  const [chatLocked, setChatLocked] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const scrollRef = useRef(null);
  const endRef = useRef(null);
  const nearBottomRef = useRef(true);
  const messageRefs = useRef(new Map());
  const isProject = chat.entity_type === "project";

  useEffect(() => {
    let active = true;
    setHeaderTitle(chat.title || "แชท");

    const loadTitle = isProject
      ? projectsApi.get(chat.entity_id).then((data) => {
          const name = data?.project?.name || data?.name;
          if (name) setHeaderTitle(name);
          const locked = Boolean(
            data?.permissions?.boardLocked
            || data?.project?.board_locked
            || data?.project?.status === "completed"
            || (
              Number(data?.project?.work_total || 0) > 0
              && Number(data?.project?.work_done || 0) >= Number(data?.project?.work_total || 0)
            ),
          );
          setChatLocked(locked);
          if (locked) setReplyingTo(null);
        })
      : issuesApi.get(chat.entity_id).then((data) => {
          setChatLocked(false);
          if (data?.ticket_no || data?.title) {
            setHeaderTitle(
              [data.ticket_no, data.title].filter(Boolean).join(" · "),
            );
          }
        });

    loadTitle.catch(() => {});

    setLoading(true);
    const request = isProject
      ? projectsApi.listMessages(chat.entity_id, { limit: 200 })
      : issuesApi.comments(chat.entity_id, { limit: 200 });
    request
      .then((data) => {
        if (active) setMessages(data.items);
      })
      .catch((error) => {
        if (active) message.error(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [chat.entity_id, chat.title, isProject]);

  useEffect(() => {
    const leave = isProject
      ? joinProjectRoom(chat.entity_id)
      : joinIssueRoom(chat.entity_id);
    const socket = getSocket();
    const eventName = isProject ? "projectMessage" : "issueMessage";
    const onMessage = (item) => {
      const matches = isProject
        ? Number(item.project_id) === Number(chat.entity_id)
        : Number(item.issue_id) === Number(chat.entity_id);
      if (!matches) return;
      setMessages((current) =>
        current.some((entry) => Number(entry.id) === Number(item.id))
          ? current
          : [...current, item],
      );
    };
    socket.on(eventName, onMessage);
    return () => {
      socket.off(eventName, onMessage);
      leave();
    };
  }, [chat.entity_id, isProject]);

  useEffect(() => {
    if (!collapsed && nearBottomRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, collapsed]);

  const handleChatScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const nearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 72;
    nearBottomRef.current = nearBottom;
    setShowLatestButton(!nearBottom);
  };

  const jumpToLatest = () => {
    nearBottomRef.current = true;
    setShowLatestButton(false);
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadInline = useCallback(
    (attachment) => (
      isProject
        ? projectsApi.loadInlineAttachment(
            chat.entity_id,
            attachment.message_id,
            attachment.id,
          )
        : issuesApi.loadInlineAttachment(chat.entity_id, attachment.id)
    ),
    [chat.entity_id, isProject],
  );

  const download = useCallback(async (attachment) => {
    try {
      const blob = isProject
        ? await projectsApi.downloadAttachment(
            chat.entity_id,
            attachment.message_id,
            attachment.id,
          )
        : await issuesApi.downloadAttachment(chat.entity_id, attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.original_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      message.error(error.message);
    }
  }, [chat.entity_id, isProject]);

  const send = async (body, files, replyToId) => {
    if (chatLocked) {
      message.warning("งานทั้งหมดเสร็จสิ้นแล้ว ไม่สามารถส่งข้อความในแชททีมได้อีก");
      return false;
    }
    if ((!body && !files.length) || sending) return false;
    setSending(true);
    try {
      const result = isProject
        ? await projectsApi.sendMessage(chat.entity_id, body, files, replyToId)
        : await issuesApi.addComment(chat.entity_id, body, files, replyToId);
      const sent = result?.data;
      if (sent?.id) {
        setMessages((current) =>
          current.some((entry) => Number(entry.id) === Number(sent.id))
            ? current
            : [...current, sent],
        );
      }
      nearBottomRef.current = true;
      setShowLatestButton(false);
      window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
      return true;
    } catch (error) {
      message.error(error.message);
      return false;
    } finally {
      setSending(false);
    }
  };

  const goToMessage = (id) => {
    const element = messageRefs.current.get(Number(id));
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(Number(id));
    window.setTimeout(() => setHighlightedId(null), 1600);
  };

  const openFullPage = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (event?.nativeEvent) {
      event.nativeEvent.stopImmediatePropagation?.();
    }
    if (!isProject) {
      onExpandFull?.(chat);
      return;
    }
    onExpandFull?.(chat);
    navigate(chat.target_url || `/projects/${chat.entity_id}?tab=chat`);
  };

  return (
    <section className="w-[420px] max-w-[calc(100vw-24px)] shrink-0 overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex h-12 items-center gap-2 bg-red-700 px-3 text-white">
        <Avatar size={30} icon={<MessageOutlined />} className="bg-white/20 text-white" />
        <button
          type="button"
          className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left text-white"
          onClick={() => setCollapsed((value) => !value)}
        >
          <div className="truncate text-sm font-semibold" title={headerTitle}>{headerTitle}</div>
          {chat.actor_name ? <div className="truncate text-[11px] text-red-100">{chat.actor_name}</div> : null}
        </button>
        <Button
          type="text"
          size="small"
          icon={<ExpandOutlined />}
          className="text-white hover:!bg-white/15 hover:!text-white"
          title="เปิดหน้าเต็ม"
          onClick={openFullPage}
        />
        <Button
          type="text"
          size="small"
          icon={<DownOutlined className={collapsed ? "rotate-180" : ""} />}
          className="text-white hover:!bg-white/15 hover:!text-white"
          title={collapsed ? "ขยาย" : "ย่อ"}
          onClick={() => setCollapsed((value) => !value)}
        />
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          className="text-white hover:!bg-white/15 hover:!text-white"
          title="ปิด"
          onClick={onClose}
        />
      </header>

      {!collapsed ? (
        <>
          <div className="relative">
            <div
              ref={scrollRef}
              onScroll={handleChatScroll}
              className="h-[420px] overflow-y-auto bg-slate-50 p-3"
            >
              {loading ? (
                <div className="flex h-full items-center justify-center"><Spin /></div>
              ) : !messages.length ? (
                <Empty className="mt-24" image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีข้อความ" />
              ) : (
                <div className="flex flex-col">
                  {messages.map((item, index) => {
                    const mine = Number(item.user_id) === Number(session.user.id);
                    const timeline = chatTimelineMeta(messages, index);
                    return (
                      <div key={item.id}>
                        {timeline.showSeparator ? (
                          <ChatTimelineSeparator timestamp={item.created_at} />
                        ) : null}
                        <div
                          ref={(element) => {
                            if (element) messageRefs.current.set(Number(item.id), element);
                            else messageRefs.current.delete(Number(item.id));
                          }}
                          className={`group flex items-center gap-1 ${mine ? "justify-end" : "justify-start"} ${
                            timeline.compactSender ? "mt-0.5" : "mt-2"
                          } ${Number(highlightedId) === Number(item.id) ? "rounded-xl bg-amber-100 ring-2 ring-amber-300" : ""}`}
                        >
                          {mine && !chatLocked ? (
                            <ChatReplyAction
                              onClick={() => setReplyingTo({
                                id: Number(item.id),
                                user_name: item.user_name,
                                body: item.body,
                                has_attachments: Boolean(item.attachments?.length),
                              })}
                            />
                          ) : null}
                          <div className={`max-w-[88%] rounded-2xl px-3 py-1.5 text-sm ${
                            mine
                              ? "rounded-br-md bg-red-700 text-white"
                              : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                          }`}>
                            {!mine && !timeline.compactSender ? (
                              <div className="mb-0.5 text-[11px] font-semibold text-red-700">{item.user_name}</div>
                            ) : null}
                            <ChatReplyQuote
                              preview={item.reply_preview}
                              mine={mine}
                              onClick={() => goToMessage(item.reply_to_id)}
                            />
                            {item.body ? (
                              <div className="whitespace-pre-wrap break-words leading-relaxed">{item.body}</div>
                            ) : null}
                            <ChatMessageAttachments
                              attachments={item.attachments}
                              loadInline={loadInline}
                              download={download}
                              mine={mine}
                            />
                          </div>
                          {!mine && !chatLocked ? (
                            <ChatReplyAction
                              onClick={() => setReplyingTo({
                                id: Number(item.id),
                                user_name: item.user_name,
                                body: item.body,
                                has_attachments: Boolean(item.attachments?.length),
                              })}
                            />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
              )}
            </div>
            {showLatestButton ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                <Button
                  type="primary"
                  shape="circle"
                  icon={<DownOutlined />}
                  aria-label="กลับไปข้อความล่าสุด"
                  title="กลับไปข้อความล่าสุด"
                  onClick={jumpToLatest}
                  className="pointer-events-auto shadow-md"
                />
              </div>
            ) : null}
          </div>
          <div className="border-t border-slate-200 bg-white p-2.5">
            {chatLocked ? (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
                งานเสร็จแล้ว — แชทเปิดดูได้อย่างเดียว
              </div>
            ) : (
              <CompactChatComposer
                onSend={send}
                sending={sending}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
              />
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

export function MiniChatDock({ chats, session, onClose, onExpandFull }) {
  if (!chats.length) return null;
  return (
    <div className="fixed right-3 bottom-0 z-40 flex max-w-[calc(100vw-24px)] flex-row-reverse items-end gap-3 overflow-x-auto px-1 pt-3">
      {chats.map((chat) => (
        <MiniChat
          key={`${chat.entity_type}:${chat.entity_id}`}
          chat={chat}
          session={session}
          onClose={() => onClose(chat)}
          onExpandFull={onExpandFull}
        />
      ))}
    </div>
  );
}
