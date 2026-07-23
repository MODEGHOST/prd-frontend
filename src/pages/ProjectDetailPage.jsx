import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Gantt from "frappe-gantt";
import {
  Avatar,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { TaskForm } from "../components/forms/TaskForm";
import { AppRangePicker } from "../components/ui/AppDatePicker";
import { PageHeader } from "../components/ui/PageHeader";
import { PriorityTag, StatusTag } from "../components/ui/StatusTag";
import {
  PLAN_STATUS_OPTIONS,
  ROLE_LABELS,
  STATUS_LABELS,
  TASK_COLUMNS,
  progressStrokeColor,
} from "../constants";
import { projectsApi, tasksApi, usersApi } from "../services/api";
import { getSocket, joinProjectRoom } from "../services/socket";
import { upsertById, mergeTaskPatch } from "../utils/realtimeMerge";
import { hasPermission } from "../utils/access";
import {
  dayjs,
  formatDate,
  formatDateRange,
  formatDateShort,
  toApiDate,
} from "../utils/datetime";
import {
  ChatMessageAttachments,
  ChatReplyAction,
  ChatReplyQuote,
  ChatTimelineSeparator,
  CompactChatComposer,
  chatTimelineMeta,
} from "../components/chat/ChatComposer";

function formatBudget(budget, currency = "THB") {
  try {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: currency || "THB",
      maximumFractionDigits: 0,
    }).format(Number(budget || 0));
  } catch {
    return `${Number(budget || 0).toLocaleString("th-TH")} ${currency || "THB"}`;
  }
}

function memberUserId(member) {
  return member.user_id ?? member.userId ?? member.id;
}

function memberName(member) {
  return member.name || member.user_name || "ไม่ระบุ";
}

function ManageMembersModal({ open, onCancel, onSave, saving, users, members, ownerId, currentUserId }) {
  const [form] = Form.useForm();
  const selectedIds = Form.useWatch("memberIds", form) || [];
  const watchedOwnerId = Form.useWatch("ownerId", form);

  useEffect(() => {
    if (!open) return;
    const currentIds = members.map(memberUserId);
    const responsibilities = {};
    members.forEach((member) => {
      responsibilities[memberUserId(member)] = member.responsibility || "";
    });
    form.setFieldsValue({
      ownerId,
      memberIds: currentIds.filter((id) => Number(id) !== Number(ownerId)),
      responsibilities,
    });
  }, [open, members, ownerId, form]);

  // This list is already filtered by the backend's capability-based `role=staff`
  // query, so custom staff roles must not be removed by legacy role labels.
  const staffUsers = users;
  const toOption = (user) => ({
    value: user.id,
    label: `${user.name} (${ROLE_LABELS[user.role] || user.role})`,
  });
  const ownerOptions = staffUsers.map(toOption);
  const memberOptions = staffUsers
    .filter((user) => {
      const id = Number(user.id);
      if (currentUserId && id === Number(currentUserId)) return false;
      if (watchedOwnerId && id === Number(watchedOwnerId)) return false;
      return true;
    })
    .map(toOption);
  const selectedKeep = staffUsers
    .filter((user) => selectedIds.map(Number).includes(Number(user.id)))
    .filter((user) => !currentUserId || Number(user.id) !== Number(currentUserId))
    .filter((user) => !watchedOwnerId || Number(user.id) !== Number(watchedOwnerId))
    .map(toOption);
  const mergedMemberOptions = [
    ...selectedKeep,
    ...memberOptions.filter((option) => !selectedKeep.some((item) => Number(item.value) === Number(option.value))),
  ];

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const owner = values.ownerId;
      const ids = Array.from(new Set([...(values.memberIds || []), owner].filter(Boolean)));
      await onSave({
        ownerId: owner,
        members: ids.map((userId) => ({
          userId,
          responsibility: values.responsibilities?.[userId] || "",
        })),
      });
    } catch (error) {
      if (error?.errorFields) return;
      // parent handles API errors
    }
  };

  return (
    <Modal
      title="จัดการทีมโครงการ"
      open={open}
      centered
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={saving}
      okText="บันทึก"
      cancelText="ยกเลิก"
      width={640}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="ownerId"
          label="เจ้าของหลัก"
          rules={[{ required: true, message: "กรุณาเลือกเจ้าของหลัก" }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="พิมพ์ชื่อเพื่อค้นหา"
            options={ownerOptions}
            filterOption={(input, option) =>
              String(option?.label || "").toLowerCase().includes(input.trim().toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item
          name="memberIds"
          label="สมาชิกทีม"
          extra="ไม่แสดงชื่อของคุณและ Owner — คนที่เลือกไว้แล้วยังโผล่เพื่อแก้ไขหรือนำออก"
        >
          <Select
            mode="multiple"
            showSearch
            optionFilterProp="label"
            placeholder="พิมพ์ชื่อเพื่อค้นหาสมาชิก"
            options={mergedMemberOptions}
            maxTagCount="responsive"
            filterOption={(input, option) =>
              String(option?.label || "").toLowerCase().includes(input.trim().toLowerCase())
            }
          />
        </Form.Item>
        {selectedIds.length ? (
          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="text-sm font-medium text-slate-700">หน้าที่รับผิดชอบ</div>
            {selectedIds.map((userId) => {
              const user = staffUsers.find((item) => item.id === userId);
              return (
                <Form.Item
                  key={userId}
                  name={["responsibilities", userId]}
                  label={user?.name || `ผู้ใช้ #${userId}`}
                  className="mb-2"
                >
                  <Input.TextArea rows={2} placeholder="เช่น พัฒนา Frontend, ดูแล QA" />
                </Form.Item>
              );
            })}
          </div>
        ) : null}
      </Form>
    </Modal>
  );
}

function isPlanPastProjectEnd(planEnd, projectEnd) {
  if (!projectEnd || !planEnd) return false;
  return dayjs(planEnd).startOf("day").isAfter(dayjs(projectEnd).startOf("day"));
}

function ProjectPlanModal({
  open,
  onCancel,
  onSubmit,
  saving,
  members,
  projectStart,
  projectEnd,
  plan,
}) {
  const [form] = Form.useForm();
  const watchedRange = Form.useWatch("range", form);
  const exceedsProjectEnd = Boolean(
    projectEnd
    && watchedRange?.[1]
    && dayjs(watchedRange[1]).startOf("day").isAfter(dayjs(projectEnd).startOf("day")),
  );

  const assigneeOptions = useMemo(() => {
    const options = new Map();
    (members || []).forEach((member) => {
      const id = Number(memberUserId(member));
      if (!Number.isInteger(id) || id <= 0) return;
      options.set(id, {
        value: id,
        label: memberName(member),
      });
    });
    // คงผู้รับผิดชอบเดิมไว้ในรายการ แม้ตอนนี้จะไม่อยู่ในสมาชิกที่กรองแล้ว
    if (plan?.assignee_id) {
      const id = Number(plan.assignee_id);
      if (Number.isInteger(id) && id > 0 && !options.has(id)) {
        options.set(id, {
          value: id,
          label: plan.assignee_name || `สมาชิก #${id}`,
        });
      }
    }
    return [...options.values()];
  }, [members, plan]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (plan) {
      form.setFieldsValue({
        range: [
          dayjs(plan.week_start || plan.weekStart),
          dayjs(plan.week_end || plan.weekEnd),
        ],
        title: plan.title,
        description: plan.description || "",
        assigneeId: plan.assignee_id ? Number(plan.assignee_id) : undefined,
        status: plan.status || "planned",
      });
      return;
    }
    // เพิ่มใหม่: ใส่ช่วงโครงการให้เป็นค่าเริ่มต้น แล้วให้ปรับย่อย/ขยายได้
    if (projectStart && projectEnd) {
      form.setFieldsValue({
        range: [dayjs(projectStart), dayjs(projectEnd)],
        status: "planned",
      });
    }
  }, [open, form, plan, projectStart, projectEnd]);

  const handleFinish = async (values) => {
    try {
      await onSubmit({
        title: values.title,
        description: values.description || "",
        weekStart: values.range?.[0] ? toApiDate(values.range[0]) : "",
        weekEnd: values.range?.[1] ? toApiDate(values.range[1]) : "",
        assigneeId: values.assigneeId ? Number(values.assigneeId) : null,
        status: values.status || "planned",
      });
      form.resetFields();
    } catch {
      // keep form values
    }
  };

  return (
    <Modal
      title={plan ? "แก้ไขช่วงงานในแผนโปรเจกต์" : "เพิ่มช่วงงานในแผนโปรเจกต์"}
      open={open}
      centered
      onCancel={onCancel}
      footer={null}
      destroyOnHidden
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ status: "planned" }}
        onFinish={handleFinish}
      >
        <Form.Item
          name="range"
          label="ช่วงวันที่ดำเนินงาน"
          extra={(
            <div className="space-y-1">
              <div>
                {projectStart && projectEnd
                  ? `ช่วงโครงการ ${formatDateRange(projectStart, projectEnd)} · ขยายเกินวันสิ้นสุดได้ถ้างานล่าช้า`
                  : "ควรกำหนดวันเริ่มและวันสิ้นสุดของโครงการก่อน"}
              </div>
              {exceedsProjectEnd ? (
                <div className="font-medium text-amber-700">
                  ช่วงนี้อยู่นอกวันสิ้นสุดโครงการ — จะถูกทำเครื่องหมายว่าเกินกำหนดบน Gantt
                </div>
              ) : null}
            </div>
          )}
          rules={[{ required: true, message: "กรุณาเลือกช่วงวันที่ดำเนินงาน" }]}
        >
          <AppRangePicker
            disabledDate={(current) => (
              Boolean(projectStart && current.isBefore(dayjs(projectStart), "day"))
            )}
          />
        </Form.Item>
        <Form.Item name="title" label="หัวข้อ" rules={[{ required: true, message: "กรุณากรอกหัวข้อ" }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="รายละเอียด">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="assigneeId" label="ผู้รับผิดชอบ">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="เลือกสมาชิกในทีม"
            options={assigneeOptions}
          />
        </Form.Item>
        <Form.Item name="status" label="สถานะ">
          <Select options={PLAN_STATUS_OPTIONS} />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={saving}>
          {plan ? "บันทึกการแก้ไข" : "เพิ่มลงในแผนโปรเจกต์"}
        </Button>
      </Form>
    </Modal>
  );
}

const PLAN_BAR_COLORS = {
  planned: { background: "#94a3b8", border: "#64748b" },
  in_progress: { background: "#dc2626", border: "#b91c1c" },
  done: { background: "#22c55e", border: "#16a34a" },
};

const PLAN_PROGRESS = {
  planned: 0,
  in_progress: 50,
  done: 100,
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPlanViewConfig(projectStart, projectEnd, plans, containerWidth) {
  const projectFrom = dayjs(projectStart).startOf("day");
  const projectTo = dayjs(projectEnd).startOf("day");
  const usableWidth = Math.max(640, Math.floor(containerWidth || 960));

  const planDates = (plans || []).flatMap((plan) => [
    dayjs(plan.week_start || plan.weekStart).startOf("day"),
    dayjs(plan.week_end || plan.weekEnd).startOf("day"),
  ]);
  const earliestPlan = planDates.length
    ? planDates.reduce((min, date) => (date.isBefore(min) ? date : min), planDates[0])
    : projectFrom;
  const latestPlan = planDates.length
    ? planDates.reduce((max, date) => (date.isAfter(max) ? date : max), planDates[0])
    : projectTo;

  // ขอบเขตจริงของแผน + โปรเจกต์
  const contentStart = earliestPlan.isBefore(projectFrom) ? earliestPlan : projectFrom;
  const contentEnd = latestPlan.isAfter(projectTo) ? latestPlan : projectTo;
  const contentDays = Math.max(1, contentEnd.diff(contentStart, "day") + 1);

  // คอลัมน์ประมาณ 52–64px ให้แถบงานสมสัดส่วนกับวัน และเต็มความกว้างจอ
  const IDEAL_COL = 56;
  if (contentDays <= 60) {
    const fitDays = Math.max(contentDays, Math.floor(usableWidth / IDEAL_COL));
    const columnWidth = Math.max(48, Math.floor(usableWidth / fitDays));
    const extra = Math.max(0, fitDays - contentDays);
    const extraLeft = Math.floor(extra / 2);
    const extraRight = extra - extraLeft;
    const padStartDays = earliestPlan.diff(contentStart, "day") + extraLeft;
    const padEndDays = contentEnd.diff(latestPlan, "day") + extraRight;
    return {
      viewMode: "Day",
      columnWidth,
      padding: [`${padStartDays}d`, `${padEndDays}d`],
    };
  }

  const weeks = Math.max(1, Math.ceil(contentDays / 7));
  const fitWeeks = Math.max(weeks, Math.floor(usableWidth / 120));
  return {
    viewMode: "Week",
    columnWidth: Math.max(100, Math.floor(usableWidth / fitWeeks)),
    padding: [
      `${Math.max(0, earliestPlan.diff(contentStart, "day"))}d`,
      `${Math.max(0, contentEnd.diff(latestPlan, "day"))}d`,
    ],
  };
}

function truncateBarLabel(text, start, end, columnWidth) {
  const days = Math.max(1, dayjs(end).startOf("day").diff(dayjs(start).startOf("day"), "day") + 1);
  const barWidth = days * Math.max(48, columnWidth || 56);
  // ประมาณความกว้างตัวอักษรไทย/อังกฤษบนแถบ
  const maxChars = Math.max(4, Math.floor((barWidth - 20) / 9));
  const value = String(text || "").trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(3, maxChars - 1))}…`;
}

function shortPersonName(name) {
  const value = String(name || "ไม่ระบุ").trim();
  const parts = value.split(/\s+/);
  return parts[0] || value;
}

function ProjectPlanTimeline({ project, plans, canEdit, onEdit }) {
  const ganttRef = useRef(null);
  const ganttInstanceRef = useRef(null);
  const scrollRef = useRef(null);
  const scrollRafRef = useRef(0);
  const [sideMeta, setSideMeta] = useState({ headerHeight: 88, rowHeight: 58 });
  const [windowStart, setWindowStart] = useState(0);
  const [viewportRows, setViewportRows] = useState(12);
  const validProjectRange = project?.start_date && project?.end_date;
  const rowHeight = sideMeta.rowHeight || 58;
  const overscan = 6;
  const windowEnd = Math.min(plans.length, windowStart + viewportRows + overscan * 2);
  const visibleStart = Math.max(0, windowStart - overscan);
  const visiblePlans = useMemo(
    () => plans.slice(visibleStart, windowEnd),
    [plans, visibleStart, windowEnd],
  );

  const updateWindowFromScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      const nextStart = Math.max(0, Math.floor(node.scrollTop / rowHeight));
      const nextViewport = Math.max(8, Math.ceil(node.clientHeight / rowHeight));
      setWindowStart((current) => (current === nextStart ? current : nextStart));
      setViewportRows((current) => (current === nextViewport ? current : nextViewport));
    });
  }, [rowHeight]);

  const renderGantt = useCallback(() => {
    const container = ganttRef.current;
    if (!container || !validProjectRange || !plans.length) return;

    if (ganttInstanceRef.current) {
      ganttInstanceRef.current.clear();
      ganttInstanceRef.current = null;
    }
    container.innerHTML = "";

    // ใช้แผนทั้งหมดคำนวณแกนเวลา ให้เลื่อนแนวตั้งแล้วสเกลวันไม่กระโดด
    const view = getPlanViewConfig(
      project.start_date,
      project.end_date,
      plans,
      Math.max(
        480,
        (container.clientWidth || container.parentElement?.clientWidth || 960) - 4,
      ),
    );

    const tasks = visiblePlans.map((plan) => {
      const start = String(plan.week_start || plan.weekStart || "").slice(0, 10);
      const end = String(plan.week_end || plan.weekEnd || "").slice(0, 10);
      const assignee = plan.assignee_name || "ไม่ระบุ";
      const title = plan.title || "ช่วงงาน";
      const overdue = isPlanPastProjectEnd(end, project.end_date);
      return {
        id: String(plan.id),
        name: truncateBarLabel(title, start, end, view.columnWidth),
        title,
        description: plan.description || "",
        start,
        end,
        progress: PLAN_PROGRESS[plan.status] ?? 0,
        custom_class: [
          `project-plan-${plan.status || "planned"}`,
          overdue ? "project-plan-overrun" : "",
        ].filter(Boolean).join(" "),
        assignee,
        status: plan.status || "planned",
        overdue,
        dateLabel: `${formatDateShort(start)}–${formatDateShort(end)}`,
      };
    }).filter((task) => task.start && task.end && task.start <= task.end);

    if (!tasks.length) return;

    const taskMap = Object.fromEntries(tasks.map((task) => [String(task.id), task]));

    const dayMode = {
      name: "Day",
      padding: view.padding,
      date_format: "YYYY-MM-DD",
      step: "1d",
      column_width: view.columnWidth,
      lower_text: (d, ld) => (!ld || d.getDate() !== ld.getDate()
        ? dayjs(d).format("D")
        : ""),
      upper_text: (d, ld) => (!ld || d.getMonth() !== ld.getMonth()
        ? dayjs(d).format("MMM BBBB")
        : ""),
      thick_line: (d) => d.getDay() === 1,
    };
    const weekMode = {
      name: "Week",
      padding: view.padding,
      step: "7d",
      date_format: "YYYY-MM-DD",
      column_width: view.columnWidth,
      lower_text: (d) => {
        const endOfWeek = dayjs(d).add(6, "day");
        return `${dayjs(d).format("D MMM")} - ${endOfWeek.format("D MMM")}`;
      },
      upper_text: (d, ld) => (!ld || d.getMonth() !== ld.getMonth()
        ? dayjs(d).format("MMM BBBB")
        : ""),
    };

    const gantt = new Gantt(container, tasks, {
      view_modes: view.viewMode === "Week" ? [weekMode] : [dayMode],
      view_mode_select: false,
      readonly: true,
      infinite_padding: false,
      scroll_to: "start",
      today_button: true,
      auto_move_label: false,
      container_height: "auto",
      bar_height: 30,
      bar_corner_radius: 8,
      column_width: view.columnWidth,
      padding: 28,
      lines: "both",
      popup: ({ task, set_title, set_subtitle, set_details, add_action }) => {
        set_title(escapeHtml(task.title || task.name));
        set_subtitle(
          `${escapeHtml(task.assignee)} · ${escapeHtml(STATUS_LABELS[task.status] || task.status)}${
            task.overdue ? " · เกินกำหนด" : ""
          }`,
        );
        set_details(
          `<div class="project-plan-popup-details">
            <div>${escapeHtml(task.description || "ไม่มีรายละเอียด")}</div>
            <div class="project-plan-popup-dates">
              ${escapeHtml(task.dateLabel || formatDateRange(task.start, task.end))}
            </div>
            ${task.overdue
              ? `<div class="project-plan-popup-overrun">เกินวันสิ้นสุดโครงการ (${formatDate(project.end_date)})</div>`
              : ""}
          </div>`,
        );
        if (canEdit) {
          add_action("แก้ไขช่วงงาน", () => {
            const selected = plans.find((plan) => String(plan.id) === String(task.id));
            if (selected) onEdit(selected);
          });
        }
      },
    });

    const svg = container.querySelector("svg.gantt");
    const dateCount = gantt.dates?.length || 0;
    if (svg && dateCount) {
      const exactWidth = dateCount * view.columnWidth + 140;
      svg.setAttribute("width", String(exactWidth));
      svg.style.width = `${exactWidth}px`;
      svg.style.minWidth = `${exactWidth}px`;
    }

    const ns = "http://www.w3.org/2000/svg";
    container.querySelectorAll(".bar-wrapper").forEach((wrapper) => {
      try {
        const bar = wrapper.querySelector(".bar");
        const label = wrapper.querySelector(".bar-label");
        const task = taskMap[String(wrapper.getAttribute("data-id"))];
        if (!bar || !label || !task) return;

        const barWidth = Number(bar.getAttribute("width") || 0);
        const barX = Number(bar.getAttribute("x") || 0);
        const barY = Number(bar.getAttribute("y") || 0);
        let text = label.textContent || "";
        const maxChars = Math.max(3, Math.floor((barWidth - 16) / 9));
        if (text.length > maxChars) {
          text = `${text.slice(0, Math.max(2, maxChars - 1))}…`;
          label.textContent = text;
        }
        label.classList.remove("big");
        let labelWidth = text.length * 8;
        try {
          labelWidth = label.getBBox().width || labelWidth;
        } catch {
          // ignore when SVG is not measurable yet
        }
        label.setAttribute("x", String(barX + Math.max(6, (barWidth - labelWidth) / 2)));

        wrapper.querySelectorAll(".bar-assignee-label").forEach((node) => node.remove());
        const assigneeLabel = document.createElementNS(ns, "text");
        assigneeLabel.setAttribute("class", `bar-assignee-label${task.overdue ? " bar-overrun-label" : ""}`);
        assigneeLabel.setAttribute("x", String(barX + barWidth + 10));
        assigneeLabel.setAttribute("y", String(barY + 20));
        assigneeLabel.textContent = task.overdue
          ? `${shortPersonName(task.assignee)} · เกินกำหนด`
          : shortPersonName(task.assignee);
        wrapper.appendChild(assigneeLabel);
      } catch {
        // keep bar visible even if label tweak fails
      }
    });

    const ganttContainer = container.querySelector(".gantt-container");
    if (ganttContainer && svg) {
      const svgHeight = Number(svg.getAttribute("height") || 0);
      if (svgHeight > 0) {
        ganttContainer.style.height = `${svgHeight}px`;
      }
      ganttContainer.scrollLeft = 0;
    }

    const header = container.querySelector(".grid-header");
    const nextMeta = {
      headerHeight: Math.round(header?.getBoundingClientRect().height || 88),
      rowHeight: 58,
    };
    setSideMeta((current) => (
      current.headerHeight === nextMeta.headerHeight && current.rowHeight === nextMeta.rowHeight
        ? current
        : nextMeta
    ));

    ganttInstanceRef.current = gantt;
  }, [
    canEdit,
    onEdit,
    plans,
    project?.end_date,
    project?.start_date,
    validProjectRange,
    visiblePlans,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      renderGantt();
    }, 0);

    const container = ganttRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return () => {
        window.clearTimeout(timer);
        if (ganttInstanceRef.current) {
          ganttInstanceRef.current.clear();
          ganttInstanceRef.current = null;
        }
      };
    }

    let resizeTimer;
    let lastWidth = container.clientWidth;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.round(entries[0]?.contentRect?.width || container.clientWidth);
      if (nextWidth < 120) return;
      if (Math.abs(nextWidth - lastWidth) < 40) return;
      lastWidth = nextWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderGantt, 180);
    });
    observer.observe(container);

    return () => {
      window.clearTimeout(timer);
      clearTimeout(resizeTimer);
      observer.disconnect();
      if (ganttInstanceRef.current) {
        ganttInstanceRef.current.clear();
        ganttInstanceRef.current = null;
      }
      container.innerHTML = "";
    };
  }, [renderGantt]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    updateWindowFromScroll();
    if (typeof ResizeObserver === "undefined") {
      return () => {
        if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      };
    }
    const observer = new ResizeObserver(() => updateWindowFromScroll());
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [updateWindowFromScroll, plans.length]);

  if (!validProjectRange) {
    return (
      <Empty
        description="ยังไม่ได้กำหนดวันเริ่มและวันสิ้นสุดของโครงการ จึงไม่สามารถแสดง Gantt ได้"
      />
    );
  }

  const timelineStart = dayjs(project.start_date);
  const timelineEnd = dayjs(project.end_date);
  const projectDays = Math.max(1, timelineEnd.diff(timelineStart, "day") + 1);
  const topSpacer = visibleStart * rowHeight;
  const bottomSpacer = Math.max(0, (plans.length - windowEnd) * rowHeight);

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm" styles={{ body: { padding: 0 } }}>
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-slate-800">Gantt Chart แผนงานโปรเจกต์</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {formatDateRange(timelineStart, timelineEnd)}
              {" · "}{projectDays} วัน
              {" · "}{plans.length} ช่วงงาน
              {" · เห็นผู้รับผิดชอบข้างแถบทันที"}
              {canEdit ? " · คลิกแถบเพื่อแก้ไข" : ""}
            </div>
          </div>
          <Space size={12} wrap>
            {PLAN_STATUS_OPTIONS.map((option) => (
              <span key={option.value} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: PLAN_BAR_COLORS[option.value].background }}
                />
                {option.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-amber-600 bg-amber-100" />
              เกินวันสิ้นสุดโครงการ
            </span>
          </Space>
        </div>
      </div>
      {!plans.length ? (
        <div className="py-12">
          <Empty description="ยังไม่มีช่วงงานในแผนโปรเจกต์" />
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="project-plan-scroll min-h-[min(55vh,560px)] max-h-[min(85vh,960px)] overflow-auto"
          onScroll={updateWindowFromScroll}
        >
          <div className="flex min-w-0 items-start">
            <div className="project-plan-side w-52 shrink-0 border-r border-slate-200 bg-white">
              <div
                className="sticky top-0 z-10 flex items-end border-b border-slate-200 bg-slate-50 px-3 pb-2 text-xs font-semibold text-slate-600"
                style={{ height: sideMeta.headerHeight }}
              >
                ช่วงงาน / ผู้รับผิดชอบ
              </div>
              <div style={{ height: topSpacer }} aria-hidden="true" />
              {visiblePlans.map((plan) => {
                const overdue = isPlanPastProjectEnd(
                  plan.week_end || plan.weekEnd,
                  project.end_date,
                );
                return (
                  <button
                    key={plan.id}
                    type="button"
                    className={`flex w-full flex-col justify-center border-b border-slate-100 px-3 text-left transition ${
                      canEdit ? "cursor-pointer hover:bg-red-50" : "cursor-default"
                    } ${overdue ? "bg-amber-50/70" : ""}`}
                    style={{ height: rowHeight }}
                    onClick={() => {
                      if (canEdit) onEdit(plan);
                    }}
                    title={`${plan.title} · ${plan.assignee_name || "ไม่ระบุ"}${overdue ? " · เกินกำหนด" : ""}`}
                  >
                    <div className="flex items-center gap-1">
                      <div className="truncate text-sm font-semibold text-slate-800">{plan.title}</div>
                      {overdue ? (
                        <Tag color="orange" className="m-0 shrink-0 px-1 text-[10px] leading-4">
                          เกินกำหนด
                        </Tag>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs font-medium text-red-700">
                      {plan.assignee_name || "ไม่ระบุผู้รับผิดชอบ"}
                    </div>
                  </button>
                );
              })}
              <div style={{ height: bottomSpacer }} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 overflow-x-auto overflow-y-visible">
              <div style={{ height: topSpacer }} aria-hidden="true" />
              <div className="project-plan-gantt" ref={ganttRef} />
              <div style={{ height: bottomSpacer }} aria-hidden="true" />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export function ProjectDetailPage({ session }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = Number(id);

  const [detail, setDetail] = useState(null);
  const [users, setUsers] = useState([]);
  const [weeklyPlans, setWeeklyPlans] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskColumnTotals, setTaskColumnTotals] = useState({});
  const [messages, setMessages] = useState([]);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [weeklyPlansLoaded, setWeeklyPlansLoaded] = useState(false);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "overview");

  const [membersOpen, setMembersOpen] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  const chatEndRef = useRef(null);
  const messagesRef = useRef([]);
  const chatMessageRefs = useRef(new Map());

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (["overview", "team", "weekly", "tasks", "chat"].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  const changeTab = (tab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === "overview") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const project = detail?.project;
  const members = useMemo(() => detail?.members || [], [detail?.members]);
  const permissions = detail?.permissions || {};
  const canManage = Boolean(permissions.canManage);
  const canManageMembers = canManage
    && hasPermission(session.user, "projects.members.manage");
  const canUpdateStatus = canManage
    && hasPermission(session.user, "projects.status.update");
  const canCreateTask = Boolean(permissions.canCreateTasks)
    && hasPermission(session.user, "tasks.create");
  const canEditPlans = Boolean(permissions.canEditPlans)
    && hasPermission(session.user, "projects.plan.manage");
  const canChat = hasPermission(session.user, "projects.chat");
  const boardLocked = Boolean(permissions.boardLocked || project?.board_locked);
  const workComplete = Number(project?.work_total || 0) > 0
    && Number(project?.work_done || 0) >= Number(project?.work_total || 0);
  const chatLocked = boardLocked || workComplete || project?.status === "completed";
  const canSendChat = canChat && !chatLocked;

  const memberUsers = useMemo(
    () =>
      members
        .filter((member) => Boolean(member.is_staff))
        .map((member) => ({
          id: memberUserId(member),
          name: memberName(member),
          role: member.role || member.user_role,
          department: member.department,
        })),
    [members],
  );

  const openPlanEditor = useCallback((plan) => {
    setEditingPlan(plan);
    setPlanOpen(true);
  }, []);

  const loadDetail = () =>
    projectsApi.get(projectId).then((data) => {
      setDetail(data);
      return data;
    });

  useEffect(() => {
    if (!projectId) {
      setError("ไม่พบโครงการ");
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError("");
    setUsers([]);
    setWeeklyPlans([]);
    setTasks([]);
    setTaskColumnTotals({});
    setMessages([]);
    setMessagesTotal(0);
    setWeeklyPlansLoaded(false);
    setTasksLoaded(false);
    setMessagesLoaded(false);
    messagesRef.current = [];

    projectsApi
      .get(projectId)
      .then((detailData) => {
        if (!active) return;
        setDetail(detailData);
      })
      .catch((err) => {
        if (active) setError(err.message || "โหลดโครงการไม่สำเร็จ");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!membersOpen || users.length) return undefined;
    let active = true;
    usersApi
      .list({ role: "staff" })
      .then((userData) => {
        if (active) setUsers(userData);
      })
      .catch((err) => {
        if (active) message.error(err.message);
      });
    return () => {
      active = false;
    };
  }, [membersOpen, users.length]);

  useEffect(() => {
    if (activeTab !== "weekly" || weeklyPlansLoaded || !projectId) return undefined;
    let active = true;
    setTabLoading(true);
    projectsApi
      .listWeeklyPlans(projectId)
      .then((planData) => {
        if (!active) return;
        setWeeklyPlans(planData);
        setWeeklyPlansLoaded(true);
      })
      .catch((err) => {
        if (active) message.error(err.message);
      })
      .finally(() => {
        if (active) setTabLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, projectId, weeklyPlansLoaded]);

  useEffect(() => {
    if (activeTab !== "tasks" || tasksLoaded || !projectId) return undefined;
    let active = true;
    setTabLoading(true);
    tasksApi
      .listByColumns({ projectId, limit: 100 })
      .then((taskData) => {
        if (!active) return;
        setTasks(taskData.items);
        setTaskColumnTotals(taskData.totals || {});
        setTasksLoaded(true);
      })
      .catch((err) => {
        if (active) message.error(err.message);
      })
      .finally(() => {
        if (active) setTabLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, projectId, tasksLoaded]);

  useEffect(() => {
    if (activeTab !== "chat" || messagesLoaded || !projectId) return undefined;
    let active = true;
    setTabLoading(true);
    projectsApi
      .listMessages(projectId, { limit: 100 })
      .then((messageData) => {
        if (!active) return;
        setMessages((current) => {
          const byId = new Map(messageData.items.map((item) => [Number(item.id), item]));
          current.forEach((item) => byId.set(Number(item.id), item));
          const next = [...byId.values()].sort(
            (left, right) => new Date(left.created_at) - new Date(right.created_at),
          );
          messagesRef.current = next;
          return next;
        });
        setMessagesTotal(Number(messageData.total || messageData.items.length));
        setMessagesLoaded(true);
      })
      .catch((err) => {
        if (active) message.error(err.message);
      })
      .finally(() => {
        if (active) setTabLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, projectId, messagesLoaded]);

  useEffect(() => {
    if (!session?.user || !projectId || error) return undefined;

    const leave = joinProjectRoom(projectId);
    const socket = getSocket();

    const onMessage = (item) => {
      if (activeTab !== "chat") return;
      if (Number(item.project_id) !== Number(projectId)) return;
      setMessages((current) => {
        if (current.some((msg) => msg.id === item.id)) return current;
        const next = [...current, item];
        messagesRef.current = next;
        return next;
      });
    };

    const onWeeklyPlanChanged = (payload) => {
      if (Number(payload?.projectId) !== Number(projectId)) return;
      const plan = payload?.plan;
      if (!plan) return;
      setWeeklyPlans((current) => upsertById(current, plan));
      setWeeklyPlansLoaded(true);
    };

    const onTaskChanged = (payload) => {
      if (Number(payload?.projectId) !== Number(projectId)) return;
      const task = payload?.task;
      if (!task) return;
      setTasks((current) => mergeTaskPatch(current, task, setTaskColumnTotals));
      setTasksLoaded(true);
    };

    socket.on("projectMessage", onMessage);
    socket.on("weeklyPlan:changed", onWeeklyPlanChanged);
    socket.on("task:changed", onTaskChanged);

    return () => {
      socket.off("projectMessage", onMessage);
      socket.off("weeklyPlan:changed", onWeeklyPlanChanged);
      socket.off("task:changed", onTaskChanged);
      leave();
    };
  }, [session?.user, projectId, error, activeTab]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  useEffect(() => {
    if (chatLocked) setReplyingTo(null);
  }, [chatLocked]);

  const saveMembers = async (payload) => {
    setSavingMembers(true);
    try {
      await projectsApi.updateMembers(projectId, payload);
      message.success("อัปเดตทีมเรียบร้อย");
      setMembersOpen(false);
      const data = await loadDetail();
      setDetail(data);
    } catch (err) {
      message.error(err.message);
      throw err;
    } finally {
      setSavingMembers(false);
    }
  };

  const savePlan = async (values) => {
    setSavingPlan(true);
    try {
      if (editingPlan) {
        await projectsApi.updateWeeklyPlan(projectId, editingPlan.id, values);
        message.success("แก้ไขช่วงงานในแผนโปรเจกต์แล้ว");
      } else {
        await projectsApi.createWeeklyPlan(projectId, values);
        message.success("เพิ่มช่วงงานในแผนโปรเจกต์แล้ว");
      }
      setPlanOpen(false);
      setEditingPlan(null);
      setWeeklyPlans(await projectsApi.listWeeklyPlans(projectId));
    } catch (err) {
      message.error(err.message);
      throw err;
    } finally {
      setSavingPlan(false);
    }
  };

  const updateProjectStatus = async (status) => {
    try {
      await projectsApi.updateStatus(projectId, status);
      setDetail((current) => ({
        ...current,
        project: { ...current.project, status },
      }));
      message.success("อัปเดตสถานะโครงการแล้ว");
    } catch (err) {
      message.error(err.message);
    }
  };

  const createTask = async (values) => {
    setSavingTask(true);
    try {
      await tasksApi.create({ ...values, projectId });
      message.success("เพิ่มงานเรียบร้อย");
      setTaskOpen(false);
      const taskData = await tasksApi.listByColumns({ projectId, limit: 100 });
      setTasks(taskData.items);
      setTaskColumnTotals(taskData.totals || {});
      const data = await loadDetail();
      setDetail(data);
    } catch (err) {
      message.error(err.message);
      throw err;
    } finally {
      setSavingTask(false);
    }
  };

  const loadChatAttachment = useCallback(
    (attachment) => projectsApi.loadInlineAttachment(
      projectId,
      attachment.message_id,
      attachment.id,
    ),
    [projectId],
  );

  const downloadChatAttachment = useCallback(async (attachment) => {
    try {
      const blob = await projectsApi.downloadAttachment(
        projectId,
        attachment.message_id,
        attachment.id,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.original_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error(err.message);
    }
  }, [projectId]);

  const sendChat = async (body, files, replyToId) => {
    if (chatLocked) {
      message.warning("งานทั้งหมดเสร็จสิ้นแล้ว ไม่สามารถส่งข้อความในแชททีมได้อีก");
      return false;
    }
    if (!body && !files.length) return false;
    setSendingChat(true);
    try {
      const result = await projectsApi.sendMessage(projectId, body, files, replyToId);
      const sent = result?.data || result;
      if (sent?.id && !messagesRef.current.some((msg) => msg.id === sent.id)) {
        const optimistic = {
          project_id: projectId,
          user_id: session.user.id,
          user_name: session.user.name,
          body,
          reply_to_id: replyToId,
          created_at: new Date().toISOString(),
          attachments: [],
          ...sent,
        };
        setMessages((current) => {
          if (current.some((msg) => msg.id === optimistic.id)) return current;
          const next = [...current, optimistic];
          messagesRef.current = next;
          return next;
        });
      }
      return true;
    } catch (err) {
      message.error(err.message);
      return false;
    } finally {
      setSendingChat(false);
    }
  };

  const goToChatMessage = (messageId) => {
    const element = chatMessageRefs.current.get(Number(messageId));
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(Number(messageId));
    window.setTimeout(() => setHighlightedMessageId(null), 1600);
  };

  if (loading) {
    return <Card loading className="rounded-2xl" />;
  }

  if (error || !project) {
    return (
      <div>
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/projects")}>
          กลับไปรายการโครงการ
        </Button>
        <Empty className="mt-8" description={error || "ไม่พบโครงการ"} />
      </div>
    );
  }

  const overviewTab = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl shadow-sm lg:col-span-2">
          <h3 className="mt-0 mb-2 text-base font-semibold text-slate-800">รายละเอียด</h3>
          <p className="mb-4 whitespace-pre-wrap text-sm text-slate-600">
            {project.description || "ยังไม่มีรายละเอียด"}
          </p>
          <h3 className="mb-2 text-base font-semibold text-slate-800">PRD</h3>
          <p className="mb-0 whitespace-pre-wrap text-sm text-slate-600">
            {project.prd || "ยังไม่มี Product Requirement"}
          </p>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <div className="space-y-3 text-sm text-slate-600">
            <div>
              <div className="text-xs text-slate-400">งบประมาณ</div>
              <div className="text-lg font-semibold text-slate-800">
                {formatBudget(project.budget, project.currency)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">ระยะเวลา</div>
              <div>
                {formatDateRange(project.start_date, project.end_date)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">ผู้สร้าง</div>
              <div className="font-medium text-slate-800">{project.creator_name || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">เจ้าของหลัก</div>
              <div className="font-medium text-slate-800">{project.owner_name || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">สถานะ</div>
              <StatusTag value={project.status} />
            </div>
          </div>
        </Card>
      </div>

      <Card
        className="rounded-2xl shadow-sm"
        title={
          <div className="flex items-center justify-between gap-2">
            <span>สมาชิกทีม</span>
            {canManageMembers ? (
              <Button size="small" icon={<TeamOutlined />} onClick={() => setMembersOpen(true)}>
                แก้ไขสมาชิก
              </Button>
            ) : null}
          </div>
        }
      >
        {members.length ? (
          <div className="flex flex-wrap gap-3">
            {members.map((member) => (
              <div
                key={memberUserId(member)}
                className="flex min-w-52 flex-1 items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
              >
                <Avatar className="bg-red-100 text-red-700">
                  {memberName(member).slice(0, 1)}
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-800">{memberName(member)}</div>
                  <div className="text-xs text-slate-400">
                    {ROLE_LABELS[member.role] || member.role || "-"}
                    {member.department ? ` · ${member.department}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {member.responsibility || "ยังไม่ระบุหน้าที่"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty description="ยังไม่มีสมาชิก" />
        )}
      </Card>
    </div>
  );

  const teamTab = (
    <Card className="rounded-2xl shadow-sm">
      <div className="mb-4 flex justify-end">
        {canManageMembers ? (
          <Button type="primary" icon={<TeamOutlined />} onClick={() => setMembersOpen(true)}>
            จัดการทีม
          </Button>
        ) : null}
      </div>
      <Table
        rowKey={(row) => memberUserId(row)}
        dataSource={members}
        pagination={false}
        locale={{ emptyText: "ยังไม่มีสมาชิกในโครงการ" }}
        columns={[
          {
            title: "ชื่อ",
            key: "name",
            render: (_, row) => (
              <Space>
                <Avatar size="small" className="bg-red-100 text-red-700">
                  {memberName(row).slice(0, 1)}
                </Avatar>
                {memberName(row)}
                {Number(memberUserId(row)) === Number(project.owner_id) ? (
                  <Tag color="blue">เจ้าของหลัก</Tag>
                ) : null}
              </Space>
            ),
          },
          {
            title: "บทบาท",
            dataIndex: "role",
            key: "role",
            render: (value) => ROLE_LABELS[value] || value || "-",
          },
          {
            title: "แผนก",
            dataIndex: "department",
            key: "department",
            render: (value) => value || "-",
          },
          {
            title: "หน้าที่รับผิดชอบ",
            dataIndex: "responsibility",
            key: "responsibility",
            render: (value) => value || "-",
          },
        ]}
      />
    </Card>
  );

  const weeklyTab = (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium text-slate-700">วางแผนการทำงานตามช่วงเวลาของโปรเจกต์</div>
          <div className="mt-0.5 text-xs text-slate-500">
            แบ่งงานเป็นช่วงวันที่เพื่อให้ทีมและผู้บริหารเห็นภาพรวมเดียวกัน
          </div>
        </div>
        {canEditPlans ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingPlan(null);
              setPlanOpen(true);
            }}
          >
            เพิ่มช่วงงาน
          </Button>
        ) : null}
      </div>
      {!weeklyPlansLoaded && tabLoading ? (
        <Card loading className="rounded-2xl" />
      ) : (
        <ProjectPlanTimeline
          project={project}
          plans={weeklyPlans}
          canEdit={canEditPlans}
          onEdit={openPlanEditor}
        />
      )}
    </div>
  );

  const tasksTab = (
    <div>
      <div className="mb-4 flex justify-end">
        {canCreateTask ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setTaskOpen(true)}>
            เพิ่มงาน
          </Button>
        ) : null}
      </div>
      {!tasksLoaded && tabLoading ? (
        <Card loading className="rounded-2xl" />
      ) : !tasks.length ? (
        <Empty description="ยังไม่มีงานในโครงการ" />
      ) : (
        <div className="space-y-4">
          {TASK_COLUMNS.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column);
            if (!columnTasks.length) return null;
            return (
              <Card
                key={column}
                size="small"
                className="rounded-2xl shadow-sm"
                title={
                  <div className="flex items-center justify-between">
                    <span>{STATUS_LABELS[column]}</span>
                    <Tag>
                      {Number.isFinite(taskColumnTotals[column])
                        ? taskColumnTotals[column]
                        : columnTasks.length}
                    </Tag>
                  </div>
                }
              >
                <Table
                  size="small"
                  pagination={false}
                  virtual
                  scroll={{ x: true, y: 420 }}
                  rowKey="id"
                  dataSource={columnTasks}
                  columns={[
                    {
                      title: "ชื่องาน",
                      dataIndex: "title",
                      key: "title",
                    },
                    {
                      title: "ความสำคัญ",
                      dataIndex: "priority",
                      key: "priority",
                      width: 120,
                      render: (value) => <PriorityTag value={value} />,
                    },
                    {
                      title: "ผู้รับผิดชอบ",
                      dataIndex: "assignee_name",
                      key: "assignee_name",
                      render: (value) => value || "-",
                    },
                    {
                      title: "กำหนดส่ง",
                      dataIndex: "due_date",
                      key: "due_date",
                      render: (value) => formatDate(value),
                    },
                  ]}
                />
                {Number(taskColumnTotals[column] || 0) > columnTasks.length ? (
                  <div className="mt-2 text-center text-xs text-slate-400">
                    แสดง {columnTasks.length} จาก {taskColumnTotals[column]} งาน
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const chatTab = (
    <Card loading={!messagesLoaded && tabLoading} className="rounded-2xl shadow-sm">
      <div className="mb-3 max-h-96 min-h-64 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3">
        {!messages.length ? (
          <Empty className="py-10" description="ยังไม่มีข้อความในแชททีม" />
        ) : (
          <div className="flex flex-col">
            {messagesTotal > messages.length ? (
              <div className="mb-2 text-center text-xs text-slate-400">
                แสดงข้อความล่าสุด {messages.length} จากทั้งหมด {messagesTotal}
              </div>
            ) : null}
            {messages.map((item, index) => {
              const isMine = Number(item.user_id) === Number(session.user.id);
              const timeline = chatTimelineMeta(messages, index);
              return (
                <div key={item.id}>
                  {timeline.showSeparator ? (
                    <ChatTimelineSeparator timestamp={item.created_at} />
                  ) : null}
                  <div
                    ref={(element) => {
                      if (element) chatMessageRefs.current.set(Number(item.id), element);
                      else chatMessageRefs.current.delete(Number(item.id));
                    }}
                    className={`group flex items-center gap-1 ${isMine ? "justify-end" : "justify-start"} ${
                      timeline.compactSender ? "mt-0.5" : "mt-2"
                    } ${Number(highlightedMessageId) === Number(item.id) ? "rounded-xl bg-amber-100 ring-2 ring-amber-300" : ""}`}
                  >
                    {isMine && canSendChat ? (
                      <ChatReplyAction
                        onClick={() => setReplyingTo({
                          id: Number(item.id),
                          user_name: item.user_name || "สมาชิก",
                          body: item.body,
                          has_attachments: Boolean(item.attachments?.length),
                        })}
                      />
                    ) : null}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-1.5 ${
                        isMine
                          ? "rounded-br-md bg-red-700 text-white"
                          : "rounded-bl-md bg-white text-slate-800 shadow-sm"
                      }`}
                    >
                      {!isMine && !timeline.compactSender ? (
                        <div className="mb-1 text-xs font-medium text-slate-500">
                          {item.user_name || "สมาชิก"}
                        </div>
                      ) : null}
                      <ChatReplyQuote
                        preview={item.reply_preview}
                        mine={isMine}
                        onClick={() => goToChatMessage(item.reply_to_id)}
                      />
                      {item.body ? (
                        <div className="whitespace-pre-wrap text-sm">{item.body}</div>
                      ) : null}
                      <ChatMessageAttachments
                        attachments={item.attachments}
                        loadInline={loadChatAttachment}
                        download={downloadChatAttachment}
                        mine={isMine}
                      />
                    </div>
                    {!isMine && canSendChat ? (
                      <ChatReplyAction
                        onClick={() => setReplyingTo({
                          id: Number(item.id),
                          user_name: item.user_name || "สมาชิก",
                          body: item.body,
                          has_attachments: Boolean(item.attachments?.length),
                        })}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      {canSendChat ? (
        <CompactChatComposer
          onSend={sendChat}
          sending={sendingChat}
          placeholder="พิมพ์ข้อความถึงทีม..."
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      ) : (
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
          {chatLocked
            ? "งานทั้งหมดเสร็จสิ้นแล้ว — แชททีมเปิดดูได้อย่างเดียว พิมพ์ต่อไม่ได้"
            : "คุณมีสิทธิ์อ่านแชท แต่ไม่มีสิทธิ์ส่งข้อความ"}
        </div>
      )}
    </Card>
  );

  return (
    <div>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Link to="/projects" className="text-slate-400 hover:text-red-700">
              <ArrowLeftOutlined />
            </Link>
            {project.name}
          </span>
        }
        subtitle={`${project.code} · เจ้าของหลัก ${project.owner_name || "-"} · ผู้สร้าง ${project.creator_name || "-"}`}
        extra={
          canUpdateStatus ? (
            project.status === "pending" ? (
              <Space>
                <Button type="primary" onClick={() => updateProjectStatus("active")}>
                  อนุมัติโครงการ
                </Button>
                <Button danger onClick={() => updateProjectStatus("rejected")}>
                  ปฏิเสธ
                </Button>
              </Space>
            ) : ["active", "on_hold", "completed"].includes(project.status) ? (
              <Select
                value={project.status}
                className="min-w-40"
                onChange={updateProjectStatus}
                options={[
                  { value: "active", label: "กำลังดำเนินการ" },
                  { value: "on_hold", label: "พักโครงการ" },
                  { value: "completed", label: "เสร็จสิ้น" },
                ]}
              />
            ) : (
              <StatusTag value={project.status} />
            )
          ) : (
            <StatusTag value={project.status} />
          )
        }
      />

      <Card className="mb-4 rounded-2xl shadow-sm">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">ความคืบหน้ารวม Task + Ticket</span>
          <span
            className={`font-semibold ${
              Number(project.completion_percent || 0) >= 100 ? "text-green-600" : "text-red-700"
            }`}
          >
            {project.completion_percent || 0}%
          </span>
        </div>
        <Progress
          percent={project.completion_percent || 0}
          showInfo={false}
          strokeColor={progressStrokeColor(project.completion_percent || 0)}
        />
        <div className="mt-1 text-xs text-slate-400">
          เสร็จแล้ว {project.work_done || 0} จาก {project.work_total || 0} รายการ
        </div>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={changeTab}
        items={[
          { key: "overview", label: "ภาพรวม", children: overviewTab },
          { key: "team", label: "ทีม", children: teamTab },
          { key: "weekly", label: "แผนงานโปรเจกต์", children: weeklyTab },
          { key: "tasks", label: "งาน", children: tasksTab },
          { key: "chat", label: "แชททีม", children: chatTab },
        ]}
      />

      <ManageMembersModal
        open={membersOpen}
        onCancel={() => setMembersOpen(false)}
        onSave={saveMembers}
        saving={savingMembers}
        users={users}
        members={members}
        ownerId={project.owner_id}
        currentUserId={session.user.id}
      />

      <ProjectPlanModal
        open={planOpen}
        onCancel={() => {
          setPlanOpen(false);
          setEditingPlan(null);
        }}
        onSubmit={savePlan}
        saving={savingPlan}
        members={memberUsers}
        projectStart={project.start_date}
        projectEnd={project.end_date}
        plan={editingPlan}
      />

      <Modal
        title="เพิ่มงานในโครงการ"
        open={taskOpen}
        centered
        onCancel={() => setTaskOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <TaskForm onSubmit={createTask} loading={savingTask} users={memberUsers} />
      </Modal>
    </div>
  );
}
