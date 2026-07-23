import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Image,
  Input,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Steps,
  Tag,
  Timeline,
  Typography,
  message,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  PaperClipOutlined,
} from "@ant-design/icons";
import {
  ChatReplyAction,
  ChatReplyQuote,
  ChatTimelineSeparator,
  CompactChatComposer,
  chatTimelineMeta,
} from "../chat/ChatComposer";
import { ProjectForm } from "../forms/ProjectForm";
import { IssueForm } from "../forms/IssueForm";
import { issuesApi, projectsApi, usersApi } from "../../services/api";
import { getSocket, joinIssueRoom } from "../../services/socket";
import { AppDatePicker } from "../ui/AppDatePicker";
import { PriorityTag, StatusTag } from "../ui/StatusTag";
import { isRequesterPersona } from "../../utils/access";
import { dayjs, formatDateTime, toApiDateTime, toDayjs } from "../../utils/datetime";

const WORKFLOW_STEPS = [
  { title: "รอรับเรื่อง" },
  { title: "รับเรื่องแล้ว" },
  { title: "กำลังดำเนินการ" },
  { title: "ตรวจสอบ" },
  { title: "เสร็จสิ้น" },
];

const REQUESTER_WORKFLOW_STEPS = [
  { title: "ส่งเรื่องแล้ว" },
  { title: "รับเรื่องแล้ว" },
  { title: "กำลังดำเนินการ" },
  { title: "เสร็จสิ้น" },
];

const INLINE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const TERMINAL_STATUSES = new Set(["closed", "cancelled", "rejected"]);

function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(status);
}

function AttachmentImage({ issueId, attachment, width = 96 }) {
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!issueId || !INLINE_IMAGE_TYPES.has(attachment.mime_type)) return undefined;
    let active = true;
    let objectUrl = "";
    issuesApi.loadInlineAttachment(issueId, attachment.id)
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
  }, [attachment.id, attachment.mime_type, issueId]);

  if (!INLINE_IMAGE_TYPES.has(attachment.mime_type)) return null;
  if (failed) return <Typography.Text type="secondary">โหลดตัวอย่างไม่ได้</Typography.Text>;
  if (!source) return <Spin size="small" />;
  return (
    <Image
      src={source}
      alt={attachment.original_name}
      width={width}
      className="max-h-28 rounded-lg object-cover"
      preview={{ mask: "ดูรูปเต็ม" }}
    />
  );
}

function currentWorkflowStep(detail) {
  if (detail.status === "closed") return 4;
  if (detail.board_status === "review") return 3;
  if (detail.status === "in_progress") return 2;
  if (detail.status === "accepted") return 1;
  return 0;
}

function currentRequesterWorkflowStep(detail) {
  if (detail.status === "closed") return 3;
  if (detail.status === "in_progress") return 2;
  if (detail.status === "accepted") return 1;
  return 0;
}

function formatDate(value) {
  return formatDateTime(value, "ยังไม่ระบุ");
}

function formatActualDuration(detail) {
  if (!detail?.completed_at) return "งานยังไม่เสร็จ";
  const start = dayjs(detail.started_at || detail.accepted_at || detail.created_at);
  const end = dayjs(detail.completed_at);
  const minutes = Math.max(0, end.diff(start, "minute"));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;
  return [
    days ? `${days} วัน` : "",
    hours ? `${hours} ชั่วโมง` : "",
    remainingMinutes || (!days && !hours) ? `${remainingMinutes} นาที` : "",
  ].filter(Boolean).join(" ");
}

export function IssueDetail({ issue, user, users: usersProp, open, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [staffUsers, setStaffUsers] = useState(usersProp || []);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const messageRefs = useRef(new Map());
  const [assignForm] = Form.useForm();
  const [membersForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const selectedMemberIds = Form.useWatch("memberIds", membersForm) || [];

  const staff = useMemo(
    () => (staffUsers.length ? staffUsers : usersProp || []),
    [staffUsers, usersProp],
  );

  const ensureStaffUsers = async () => {
    if (staffUsers.length || (usersProp && usersProp.length)) {
      if (usersProp?.length && !staffUsers.length) setStaffUsers(usersProp);
      return;
    }
    try {
      const data = await usersApi.list({ role: "staff" });
      setStaffUsers(data);
    } catch (error) {
      message.error(error.message);
    }
  };

  const loadDetail = async () => {
    if (!issue?.id) return;
    const [detailData, commentData, attachmentData] = await Promise.all([
      issuesApi.get(issue.id),
      issuesApi.comments(issue.id, { limit: 200 }),
      issuesApi.attachments(issue.id),
    ]);
    setDetail(detailData);
    setComments(commentData.items);
    setAttachments(attachmentData);
  };

  useEffect(() => {
    setDetail(null);
    setComments([]);
    setAttachments([]);
    setReplyingTo(null);
    if (!open || !issue?.id) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    Promise.all([
      issuesApi.get(issue.id),
      issuesApi.comments(issue.id, { limit: 200 }),
      issuesApi.attachments(issue.id),
    ])
      .then(([detailData, commentData, attachmentData]) => {
        if (!active) return;
        setDetail(detailData);
        setComments(commentData.items);
        setAttachments(attachmentData);
      })
      .catch((error) => {
        if (active) {
          setDetail(null);
          setComments([]);
          setAttachments([]);
          message.error(error.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, issue?.id]);

  useEffect(() => {
    if (!open || !issue?.id) return undefined;

    const leave = joinIssueRoom(issue.id);
    const socket = getSocket();
    const onMessage = (item) => {
      if (Number(item.issue_id) !== Number(issue.id)) return;
      setComments((current) => (
        current.some((comment) => Number(comment.id) === Number(item.id))
          ? current
          : [...current, item]
      ));
    };
    const onIssueChanged = (payload) => {
      const next = payload?.issue;
      if (!next || Number(next.id) !== Number(issue.id)) return;
      setDetail((current) => (current ? {
        ...current,
        ...next,
        // Preserve nested detail-only fields that list patches do not carry.
        members: current.members,
        activities: current.activities,
        permissions: current.permissions,
      } : current));
    };
    socket.on("issueMessage", onMessage);
    socket.on("issue:changed", onIssueChanged);
    return () => {
      socket.off("issueMessage", onMessage);
      socket.off("issue:changed", onIssueChanged);
      leave();
    };
  }, [open, issue?.id]);

  const runAction = async (action, successMessage) => {
    setActionLoading(true);
    try {
      await action();
      message.success(successMessage);
      await loadDetail();
      await onChanged?.();
      return true;
    } catch (error) {
      message.error(error.message);
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const submitComment = async (body = "", files = [], replyToId = null) => {
    if (!body.trim() && !files.length) {
      message.error("กรุณากรอกข้อความหรือแนบไฟล์");
      return false;
    }
    const success = await runAction(
      () => issuesApi.addComment(detail.id, body, files, replyToId),
      "ส่งข้อความแล้ว",
    );
    return Boolean(success);
  };

  const goToMessage = (messageId) => {
    const element = messageRefs.current.get(Number(messageId));
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(Number(messageId));
    window.setTimeout(() => setHighlightedMessageId(null), 1600);
  };

  const downloadAttachment = async (attachment) => {
    try {
      const blob = await issuesApi.downloadAttachment(detail.id, attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.original_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      message.error(error.message);
    }
  };

  const deleteAttachment = async (attachment) => {
    await runAction(
      () => issuesApi.deleteAttachment(detail.id, attachment.id),
      "ลบไฟล์แล้ว",
    );
  };

  const confirmComplete = () => {
    Modal.confirm({
      title: "ยืนยันเสร็จสิ้นงาน",
      content: "เมื่อปิด Ticket แล้ว รายละเอียดและแชทจะอ่านได้อย่างเดียวและแก้ไขไม่ได้",
      okText: "เสร็จสิ้นและปิด Ticket",
      cancelText: "ยกเลิก",
      centered: true,
      okButtonProps: { danger: true },
      onOk: () => runAction(
        () => issuesApi.updateWorkflow(detail.id, "closed"),
        "ปิด Ticket เรียบร้อย",
      ),
    });
  };

  const openEdit = async () => {
    try {
      if (!projects.length) setProjects(await projectsApi.picker());
      setEditOpen(true);
    } catch (error) {
      message.error(error.message);
    }
  };

  const submitEdit = async (values) => {
    const success = await runAction(
      () => issuesApi.update(detail.id, values),
      "แก้ไขคำขอเรียบร้อย",
    );
    if (success) setEditOpen(false);
    return success;
  };

  const confirmCancel = () => {
    Modal.confirm({
      title: "ยืนยันยกเลิกคำขอ",
      content: "เมื่อยกเลิกแล้วจะไม่สามารถแก้ไขหรือเปิดคำขอนี้กลับมาได้",
      okText: "ยืนยันยกเลิกคำขอ",
      cancelText: "กลับ",
      centered: true,
      okButtonProps: { danger: true },
      onOk: () => runAction(
        () => issuesApi.cancel(detail.id),
        "ยกเลิกคำขอเรียบร้อย",
      ),
    });
  };

  const submitReject = async ({ reason }) => {
    const success = await runAction(
      () => issuesApi.reject(detail.id, reason),
      "Reject คำขอเรียบร้อย",
    );
    if (success) {
      rejectForm.resetFields();
      setRejectOpen(false);
    }
  };

  const openAssign = async () => {
    await ensureStaffUsers();
    assignForm.setFieldsValue({
      assigneeId: detail.assignee_id || undefined,
      keepPreviousAsMember: false,
    });
    setAssignOpen(true);
  };

  const submitAssign = async (values) => {
    const success = await runAction(
      () => issuesApi.assign(detail.id, values),
      "มอบหมายผู้รับผิดชอบแล้ว",
    );
    if (success) setAssignOpen(false);
  };

  const openMembers = async () => {
    await ensureStaffUsers();
    membersForm.setFieldsValue({
      memberIds: (detail.members || []).map((member) => member.user_id),
    });
    setMembersOpen(true);
  };

  const submitMembers = async ({ memberIds = [] }) => {
    const success = await runAction(
      () => issuesApi.updateMembers(detail.id, memberIds),
      "อัปเดตสมาชิกแล้ว",
    );
    if (success) setMembersOpen(false);
  };

  const saveEstimate = async (value) => {
    await runAction(
      () => issuesApi.update(detail.id, {
        estimatedCompletionAt: value ? toApiDateTime(value) : null,
      }),
      value ? "บันทึกเวลาคาดว่าจะเสร็จแล้ว" : "ยกเลิกเวลาคาดว่าจะเสร็จแล้ว",
    );
  };

  const openConvert = async () => {
    await ensureStaffUsers();
    setConvertOpen(true);
  };

  const convertToProject = async (values) => {
    const success = await runAction(
      () => issuesApi.convertToProject(detail.id, values),
      "สร้างโครงการจาก Ticket เรียบร้อย",
    );
    if (success) setConvertOpen(false);
  };

  const current = detail || issue;
  const permissions = detail?.permissions || {};
  const requesterView = isRequesterPersona(user);
  const canManageIssue = [
    permissions.canAccept,
    permissions.canAssign,
    permissions.canManageMembers,
    permissions.canConvertToProject,
    permissions.canWork,
    permissions.canUpdate,
    permissions.canEdit,
    permissions.canCancel,
    permissions.canReject,
  ].some(Boolean);
  const selectedMemberIdSet = new Set(selectedMemberIds.map(Number));
  const memberOptions = staff
    .filter((candidate) => {
      const id = Number(candidate.id);
      if (id === Number(user.id)) return false; // ไม่โชว์ชื่อตัวเอง
      if (id === Number(detail?.assignee_id)) return false; // Owner แยกช่อง
      return true;
    })
    .map((candidate) => ({
      value: candidate.id,
      label: `${candidate.name} (${candidate.role})`,
    }));
  // ให้คนที่เลือกไว้แล้วยังโผล่ในรายการเสมอ (แม้ filter ค้นหา)
  const selectedMemberOptions = (detail?.members || [])
    .filter((member) => {
      const id = Number(member.user_id);
      return id !== Number(user.id) && id !== Number(detail?.assignee_id);
    })
    .map((member) => ({
      value: member.user_id,
      label: `${member.name}${member.role ? ` (${member.role})` : ""}`,
    }));
  const mergedMemberOptions = [
    ...selectedMemberOptions.filter((option) => selectedMemberIdSet.has(Number(option.value))),
    ...memberOptions.filter((option) => !selectedMemberOptions.some((selected) => Number(selected.value) === Number(option.value))),
  ];
  const ownerOptions = staff
    .filter((candidate) => Number(candidate.id) !== Number(user.id) || Number(detail?.assignee_id) === Number(user.id))
    .map((candidate) => ({
      value: candidate.id,
      label: `${candidate.name} (${candidate.role})`,
    }));

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        size={requesterView ? 600 : 720}
        destroyOnHidden
        title={
          <div>
            <Typography.Text type="secondary">{current?.ticket_no}</Typography.Text>
            <div className="text-base font-semibold text-slate-800">{current?.title}</div>
          </div>
        }
      >
        {loading && !detail ? (
          <div className="flex justify-center py-16">
            <Spin size="large" />
          </div>
        ) : detail ? (
          <div className="space-y-5">
            <Space wrap>
              {!requesterView ? <PriorityTag value={detail.priority} /> : null}
              <StatusTag value={detail.status} />
              {isTerminalStatus(detail.status) ? <Tag color="default">อ่านอย่างเดียว</Tag> : null}
            </Space>

            <div className="rounded-2xl border border-slate-100 p-4">
              <Steps
                current={requesterView
                  ? currentRequesterWorkflowStep(detail)
                  : currentWorkflowStep(detail)}
                items={requesterView ? REQUESTER_WORKFLOW_STEPS : WORKFLOW_STEPS}
                status={["cancelled", "rejected"].includes(detail.status) ? "error" : "process"}
                responsive
                size="small"
              />
            </div>

            {detail.status === "closed" ? (
              <Alert
                showIcon
                type="success"
                message="Ticket นี้เสร็จสิ้นแล้ว"
                description={requesterView
                  ? "คุณยังเปิดดูรายละเอียดและข้อความเดิมได้"
                  : "รายละเอียด Timeline และบทสนทนายังคงเปิดดูได้ แต่ไม่สามารถแก้ไขหรือส่งข้อความเพิ่มได้"}
              />
            ) : null}

            {detail.status === "cancelled" ? (
              <Alert
                showIcon
                type="info"
                message="ผู้แจ้งยกเลิกคำขอนี้แล้ว"
                description="คำขอนี้เป็นแบบอ่านอย่างเดียว"
              />
            ) : null}

            {detail.status === "rejected" ? (
              <Alert
                showIcon
                type="error"
                message="คำขอนี้ถูก Reject"
                description={detail.rejection_reason || "ไม่พบเหตุผลที่ระบุ"}
              />
            ) : null}

            <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap">
              {detail.description}
            </div>

            {requesterView ? (
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="โครงการ">
                  {detail.project_name
                    ? `${detail.project_code || ""} ${detail.project_name}`.trim()
                    : "เรื่องทั่วไป"}
                </Descriptions.Item>
                <Descriptions.Item label="ระบบ / Component">
                  {detail.system_component || "ไม่ระบุ"}
                </Descriptions.Item>
                <Descriptions.Item label="ผู้รับผิดชอบ">
                  {detail.assignee_name || "รอทีมงานรับเรื่อง"}
                </Descriptions.Item>
                <Descriptions.Item label="วันที่แจ้ง">{formatDate(detail.created_at)}</Descriptions.Item>
                <Descriptions.Item label="คาดว่าจะเสร็จ">
                  {detail.estimated_completion_at
                    ? formatDate(detail.estimated_completion_at)
                    : "ทีมงานยังไม่ได้ระบุ"}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="ผู้แจ้ง">{detail.requester_name}</Descriptions.Item>
              <Descriptions.Item label="โครงการ">
                {detail.project_id ? (
                  <Link to={`/projects/${detail.project_id}`}>{detail.project_name}</Link>
                ) : "ยังไม่ผูกโครงการ"}
              </Descriptions.Item>
              <Descriptions.Item label="ระบบ / Component">
                {detail.system_component || "ไม่ระบุ"}
              </Descriptions.Item>
              <Descriptions.Item label="ผู้รับผิดชอบหลัก">
                {detail.assignee_name || "ยังไม่มีผู้รับผิดชอบ"}
              </Descriptions.Item>
              <Descriptions.Item label="สมาชิก">
                {detail.members?.length
                  ? detail.members.map((member) => member.name).join(", ")
                  : "ยังไม่มีสมาชิก"}
              </Descriptions.Item>
              <Descriptions.Item label="คาดว่าจะเสร็จ">
                {detail.estimated_completion_at
                  ? (
                    <span>
                      {formatDate(detail.estimated_completion_at)}
                      {detail.eta_locked ? (
                        <span className="ml-1 text-xs text-slate-400">(ตามวันสิ้นสุดโครงการ)</span>
                      ) : null}
                    </span>
                  )
                  : "ยังไม่ระบุ"}
              </Descriptions.Item>
              <Descriptions.Item label="ระยะเวลาที่ใช้จริง">
                {formatActualDuration(detail)}
              </Descriptions.Item>
              </Descriptions>
            )}

            {!isTerminalStatus(detail.status) && canManageIssue ? (
              <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4">
                <Typography.Title level={5} className="!mt-0">จัดการ Ticket</Typography.Title>
                <Space wrap>
                  {permissions.canWork && detail.status === "accepted" ? (
                    <Button
                      type="primary"
                      loading={actionLoading}
                      onClick={() => runAction(
                        () => issuesApi.updateWorkflow(detail.id, "in_progress"),
                        "เริ่มดำเนินการแล้ว",
                      )}
                    >
                      เริ่มดำเนินการ
                    </Button>
                  ) : null}
                  {permissions.canWork && detail.status === "in_progress" ? (
                    <Button disabled>
                      {detail.board_status === "review" ? "อยู่ระหว่างตรวจสอบ" : "เริ่มดำเนินการแล้ว"}
                    </Button>
                  ) : null}
                  {permissions.canEdit ? (
                    <Button type="primary" onClick={openEdit}>แก้ไขคำขอ</Button>
                  ) : null}
                  {permissions.canCancel ? (
                    <Button danger onClick={confirmCancel}>ยกเลิกคำขอ</Button>
                  ) : null}
                  {permissions.canAccept ? (
                    <Button
                      type="primary"
                      loading={actionLoading}
                      onClick={() => runAction(
                        () => issuesApi.accept(detail.id),
                        "รับเรื่องเรียบร้อย",
                      )}
                    >
                      รับเรื่อง
                    </Button>
                  ) : null}
                  {permissions.canReject ? (
                    <Button danger onClick={() => setRejectOpen(true)}>Reject</Button>
                  ) : null}
                  {permissions.canAssign ? (
                    <Button onClick={openAssign}>มอบหมาย / เปลี่ยน Owner</Button>
                  ) : null}
                  {permissions.canManageMembers ? (
                    <Button onClick={openMembers}>เพิ่ม / จัดการ Member</Button>
                  ) : null}
                  {permissions.canConvertToProject ? (
                    <Button onClick={openConvert}>สร้างเป็นโครงการ</Button>
                  ) : null}
                  {permissions.canWork && ["accepted", "in_progress"].includes(detail.status) ? (
                    <Button danger onClick={confirmComplete}>เสร็จสิ้นงาน</Button>
                  ) : null}
                </Space>

                {permissions.canUpdate && !detail.eta_locked ? (
                  <div className="mt-4">
                    <Typography.Text className="mb-1 block">เวลาคาดว่าจะเสร็จ (ไม่บังคับ)</Typography.Text>
                    <AppDatePicker
                      showTime
                      allowClear
                      value={detail.estimated_completion_at
                        ? toDayjs(detail.estimated_completion_at)
                        : null}
                      onChange={saveEstimate}
                      disabledDate={(date) => date?.isBefore(dayjs().startOf("day"))}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {!requesterView ? (
              <>
                <Divider />
                <Typography.Title level={5} className="!mb-2">ประวัติความคืบหน้า</Typography.Title>
                {detail.activities?.length ? (
                  <Timeline
                    items={detail.activities.map((activity) => ({
                      children: (
                        <div>
                          <div>{activity.description}</div>
                          <Typography.Text type="secondary" className="text-xs">
                            {formatDate(activity.created_at)}
                            {activity.actor_name ? ` · ${activity.actor_name}` : ""}
                          </Typography.Text>
                        </div>
                      ),
                    }))}
                  />
                ) : (
                  <Typography.Text type="secondary">ยังไม่มีประวัติ</Typography.Text>
                )}
              </>
            ) : null}

            <Divider />
            <Typography.Title level={5} className="!mb-2">
              <PaperClipOutlined /> ไฟล์แนบ ({attachments.length})
            </Typography.Title>
            <List
              dataSource={attachments}
              locale={{ emptyText: "ไม่มีไฟล์แนบ" }}
              renderItem={(attachment) => {
                const isImage = INLINE_IMAGE_TYPES.has(attachment.mime_type);
                return (
                  <List.Item
                    actions={[
                      <Button
                        key="download"
                        type="link"
                        icon={<DownloadOutlined />}
                        onClick={() => downloadAttachment(attachment)}
                      >
                        ดาวน์โหลด
                      </Button>,
                      permissions.canDeleteAttachments ? (
                        <Button
                          key="delete"
                          type="link"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => deleteAttachment(attachment)}
                        >
                          ลบ
                        </Button>
                      ) : null,
                    ].filter(Boolean)}
                  >
                    {isImage ? (
                      <AttachmentImage issueId={detail.id} attachment={attachment} />
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <Typography.Text ellipsis={{ tooltip: attachment.original_name }}>
                          {attachment.original_name}
                        </Typography.Text>
                        <Typography.Text type="secondary" className="shrink-0">
                          {Math.ceil(Number(attachment.size_bytes) / 1024)} KB
                        </Typography.Text>
                      </div>
                    )}
                  </List.Item>
                );
              }}
            />

            <Divider />
            <Typography.Title level={5} className="!mb-2">
              บทสนทนา ({comments.length})
            </Typography.Title>
            {!comments.length ? (
              <Typography.Text type="secondary">ยังไม่มีข้อความ</Typography.Text>
            ) : (
              <div className="flex flex-col">
                {comments.map((item, index) => {
                  const mine = Number(item.user_id) === Number(user.id);
                  const timeline = chatTimelineMeta(comments, index);
                  const senderName = requesterView
                    ? (mine ? "คุณ" : "ทีมงาน")
                    : item.user_name;
                  const replyPreview = item.reply_preview
                    ? {
                        ...item.reply_preview,
                        user_name: requesterView
                          ? (Number(item.reply_preview.user_id) === Number(user.id) ? "คุณ" : "ทีมงาน")
                          : item.reply_preview.user_name,
                      }
                    : null;
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
                        className={`group flex items-center gap-2 ${mine ? "flex-row-reverse" : ""} ${
                          timeline.compactSender ? "mt-0.5" : "mt-2"
                        } ${Number(highlightedMessageId) === Number(item.id) ? "rounded-xl bg-amber-100 ring-2 ring-amber-300" : ""}`}
                      >
                        {!timeline.compactSender ? (
                          <Avatar className="shrink-0">{senderName.slice(0, 1)}</Avatar>
                        ) : <div className="w-8 shrink-0" />}
                        <div className={`max-w-[82%] rounded-2xl px-3 py-1.5 ${
                          mine ? "rounded-br-md bg-red-700 text-white" : "rounded-bl-md bg-slate-50 text-slate-700"
                        }`}>
                          {!timeline.compactSender ? (
                            <div className={`mb-1 text-xs font-semibold ${mine ? "text-red-100" : "text-red-700"}`}>
                              {senderName}
                              {!requesterView && item.user_role ? ` · ${item.user_role}` : ""}
                            </div>
                          ) : null}
                          <ChatReplyQuote
                            preview={replyPreview}
                            mine={mine}
                            onClick={() => goToMessage(item.reply_to_id)}
                          />
                          {item.body ? (
                            <div className="whitespace-pre-wrap break-words">{item.body}</div>
                          ) : null}
                          {item.attachments?.length ? (
                            <div className="mt-2 space-y-2">
                              {item.attachments.map((attachment) => (
                                <div
                                  key={attachment.id}
                                  className={`rounded-lg border p-2 ${
                                    mine ? "border-white/30 bg-white/10" : "border-slate-200 bg-white"
                                  }`}
                                >
                                  {INLINE_IMAGE_TYPES.has(attachment.mime_type) ? (
                                    <AttachmentImage issueId={detail.id} attachment={attachment} width={128} />
                                  ) : (
                                    <Typography.Text
                                      ellipsis={{ tooltip: attachment.original_name }}
                                      className={mine ? "!text-white" : ""}
                                    >
                                      {attachment.original_name}
                                    </Typography.Text>
                                  )}
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    className={mine ? "!text-white" : ""}
                                    onClick={() => downloadAttachment(attachment)}
                                  >
                                    ดาวน์โหลด
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <ChatReplyAction
                          onClick={() => setReplyingTo({
                            id: Number(item.id),
                            user_name: senderName,
                            body: item.body,
                            has_attachments: Boolean(item.attachments?.length),
                          })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {permissions.canComment ? (
              <CompactChatComposer
                onSend={submitComment}
                sending={actionLoading}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
              />
            ) : (
              <Alert
                type="info"
                showIcon
                message={isTerminalStatus(detail.status)
                  ? "บทสนทนานี้เป็นแบบอ่านอย่างเดียว"
                  : "เฉพาะผู้แจ้งและทีมที่ได้รับมอบหมายเท่านั้นที่ส่งข้อความได้"}
              />
            )}
          </div>
        ) : null}
      </Drawer>

      <Modal
        title="แก้ไขคำขอ"
        open={editOpen}
        centered
        footer={null}
        onCancel={() => setEditOpen(false)}
        destroyOnHidden
      >
        {detail ? (
          <IssueForm
            key={`edit-${detail.id}`}
            projects={projects}
            onSubmit={submitEdit}
            loading={actionLoading}
            simple
            showAttachments={false}
            submitLabel="บันทึกการแก้ไข"
            initialValues={{
              title: detail.title,
              description: detail.description,
              type: detail.type,
              projectId: detail.project_id || undefined,
              systemComponent: detail.system_component || "",
            }}
          />
        ) : null}
      </Modal>

      <Modal
        title="ยืนยัน Reject คำขอ"
        open={rejectOpen}
        centered
        okText="ยืนยัน Reject"
        cancelText="ยกเลิก"
        okButtonProps={{ danger: true }}
        confirmLoading={actionLoading}
        onOk={() => rejectForm.submit()}
        onCancel={() => {
          rejectForm.resetFields();
          setRejectOpen(false);
        }}
        destroyOnHidden
      >
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message="คำขอจะสิ้นสุดทันทีและผู้แจ้งจะเห็นเหตุผลนี้"
        />
        <Form form={rejectForm} layout="vertical" onFinish={submitReject}>
          <Form.Item
            name="reason"
            label="เหตุผลในการ Reject"
            rules={[
              { required: true, whitespace: true, message: "กรุณาระบุเหตุผลในการ Reject" },
              { max: 1000, message: "เหตุผลต้องไม่เกิน 1,000 ตัวอักษร" },
            ]}
          >
            <Input.TextArea
              rows={5}
              maxLength={1000}
              showCount
              placeholder="อธิบายเหตุผลเพื่อให้ผู้แจ้งทราบ"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="มอบหมายผู้รับผิดชอบหลัก"
        open={assignOpen}
        centered
        onCancel={() => setAssignOpen(false)}
        onOk={() => assignForm.submit()}
        confirmLoading={actionLoading}
        destroyOnHidden
      >
        <Form form={assignForm} layout="vertical" onFinish={submitAssign}>
          <Form.Item
            name="assigneeId"
            label="Owner"
            rules={[{ required: true, message: "กรุณาเลือกผู้รับผิดชอบ" }]}
          >
            <Select
              showSearch
              allowClear={false}
              optionFilterProp="label"
              placeholder="พิมพ์ชื่อเพื่อค้นหา"
              options={ownerOptions}
              filterOption={(input, option) =>
                String(option?.label || "").toLowerCase().includes(input.trim().toLowerCase())
              }
            />
          </Form.Item>
          {detail?.assignee_id ? (
            <Form.Item name="keepPreviousAsMember" valuePropName="checked">
              <Checkbox>ให้ Owner เดิมอยู่ช่วยงานต่อในฐานะ Member</Checkbox>
            </Form.Item>
          ) : null}
        </Form>
      </Modal>

      <Modal
        title="จัดการสมาชิกใน Ticket"
        open={membersOpen}
        centered
        onCancel={() => setMembersOpen(false)}
        onOk={() => membersForm.submit()}
        confirmLoading={actionLoading}
        destroyOnHidden
      >
        <Form form={membersForm} layout="vertical" onFinish={submitMembers}>
          <Form.Item
            name="memberIds"
            label="สมาชิกที่ร่วมงาน"
            extra="ไม่แสดงชื่อของคุณและ Owner — คนที่เลือกไว้แล้วจะยังโผล่ในรายการเพื่อแก้ไขหรือนำออก"
          >
            <Select
              mode="multiple"
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder="พิมพ์ชื่อเพื่อค้นหาและเลือกสมาชิก"
              options={mergedMemberOptions}
              maxTagCount="responsive"
              filterOption={(input, option) =>
                String(option?.label || "").toLowerCase().includes(input.trim().toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="สร้างโครงการจาก Ticket"
        open={convertOpen}
        centered
        onCancel={() => setConvertOpen(false)}
        footer={null}
        width={680}
        destroyOnHidden
      >
        {detail ? (
          <ProjectForm
            key={`convert-${detail.id}`}
            users={staff}
            currentUserId={user.id}
            loading={actionLoading}
            onSubmit={convertToProject}
            submitLabel="สร้างและเชื่อมโครงการ"
            initialValues={{
              name: detail.title,
              code: `PRJ-${String(detail.ticket_no || detail.id).replace(/\D/g, "").slice(-6)}`,
              description: detail.description,
              prd: `ที่มา: ${detail.ticket_no}\n\n${detail.description}`,
              ownerId: detail.assignee_id || user.id,
              memberIds: (detail.members || [])
                .map((member) => member.user_id)
                .filter((id) => Number(id) !== Number(user.id)),
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}
