import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Pagination,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  BugOutlined,
  ClearOutlined,
  FolderOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { TaskForm } from "../components/forms/TaskForm";
import { useIssueDrawer } from "../components/issues/IssueDrawerContext";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { AppRangePicker } from "../components/ui/AppDatePicker";
import { PageHeader } from "../components/ui/PageHeader";
import { DifficultyTag, PriorityTag, StatusTag } from "../components/ui/StatusTag";
import { VirtualList } from "../components/ui/VirtualList";
import {
  STATUS_LABELS,
  TASK_COLUMNS,
  progressStrokeColor,
} from "../constants";
import { boardApi, issuesApi, projectsApi, tasksApi } from "../services/api";
import { getSocket, joinIssueRoom, joinProjectRoom } from "../services/socket";
import { hasPermission } from "../utils/access";
import { dayjs, formatDate, toApiDate } from "../utils/datetime";
import {
  applyBoardGate,
  mergeTaskPatch,
  upsertById,
} from "../utils/realtimeMerge";

const columnAccent = {
  todo: "border-t-slate-400",
  doing: "border-t-red-600",
  review: "border-t-violet-500",
  done: "border-t-emerald-500",
};

const dateRangePresets = [
  { label: "วันนี้", value: [dayjs().startOf("day"), dayjs().endOf("day")] },
  { label: "สัปดาห์นี้", value: [dayjs().startOf("week"), dayjs().endOf("week")] },
  { label: "เดือนนี้", value: [dayjs().startOf("month"), dayjs().endOf("month")] },
];

const KANBAN_CARD_ESTIMATE = 128;

function KanbanCard({
  task,
  mode,
  canMove,
  lockHint,
  onOpen,
  onMoveStatus,
}) {
  const currentStatus = mode === "project"
    ? task.status
    : (task.board_status || (task.status === "in_progress" ? "doing" : "todo"));
  const metaLabel = mode === "ticket"
    ? (task.project_name || "Ticket ทั่วไป")
    : (task.due_date ? formatDate(task.due_date) : "ไม่กำหนด");

  return (
    <Card
      size="small"
      className={`task-card-draggable kanban-task-card rounded-lg border border-slate-200 ${canMove ? "" : "opacity-95"}`}
      styles={{ body: { padding: "8px 10px" } }}
      draggable={canMove}
      onDragStart={(event) => {
        if (!canMove) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData(mode === "project" ? "task" : "ticket", String(task.id));
      }}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-slate-800 line-clamp-2">
          {task.title}
        </div>
        {mode === "project" && task.issue_id ? (
          <Tag color="blue" className="m-0 shrink-0 !px-1.5 !py-0 !text-[10px] !leading-5">
            Ticket
          </Tag>
        ) : null}
      </div>

      {task.description ? (
        <div className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-slate-500">
          {task.description}
        </div>
      ) : null}

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <PriorityTag value={task.priority} labeled className="kanban-meta-tag" />
        {mode === "project" ? (
          <DifficultyTag value={task.difficulty || "medium"} labeled className="kanban-meta-tag" />
        ) : null}
      </div>

      {lockHint ? (
        <div className="mt-1 text-[10px] leading-snug text-amber-700">{lockHint}</div>
      ) : null}

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Avatar size={20} className="shrink-0 text-[10px]">
            {task.assignee_name?.slice(0, 1) || "?"}
          </Avatar>
          <span className="truncate text-[11px] text-slate-400">{metaLabel}</span>
        </div>
      </div>

      {canMove ? (
        <div
          className="mt-1.5"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Select
            size="small"
            className="w-full"
            value={currentStatus}
            options={TASK_COLUMNS.map((status) => ({
              value: status,
              label: STATUS_LABELS[status],
            }))}
            onChange={(status) => onMoveStatus?.(task, status)}
            aria-label="เปลี่ยนสถานะงาน"
          />
        </div>
      ) : (
        <div className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
          {STATUS_LABELS[currentStatus] || currentStatus}
        </div>
      )}
    </Card>
  );
}

export function BoardPage({ user }) {
  const canUseTicketBoard = hasPermission(user, "issues.transition");
  const canManageAllIssues = hasPermission(user, "issues.manage_all");
  const canManageAllTasks = hasPermission(user, "tasks.manage_all");
  const { openIssue, revision } = useIssueDrawer();
  const [view, setView] = useState("overview");
  const [mode, setMode] = useState("project");
  const [projectId, setProjectId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ticketId, setTicketId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [memberUsers, setMemberUsers] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [canCreateTasks, setCanCreateTasks] = useState(false);
  const [boardLocked, setBoardLocked] = useState(false);
  const [openTaskCount, setOpenTaskCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [overviewItems, setOverviewItems] = useState([]);
  const [overviewTotal, setOverviewTotal] = useState(0);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewPage, setOverviewPage] = useState(1);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);
  const [open, setOpen] = useState(false);
  const [overviewType, setOverviewType] = useState("all");
  const [overviewQuery, setOverviewQuery] = useState("");
  const [overviewStatus, setOverviewStatus] = useState();
  const [overviewRange, setOverviewRange] = useState(null);
  const [overviewSort, setOverviewSort] = useState("updated");
  const [boardQuery, setBoardQuery] = useState("");
  const [debouncedBoardQuery, setDebouncedBoardQuery] = useState("");
  const [boardStatus, setBoardStatus] = useState();
  const [boardPriority, setBoardPriority] = useState();
  const [boardAssignee, setBoardAssignee] = useState();
  const [boardRange, setBoardRange] = useState(null);
  const [overdueOnly, setOverdueOnly] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedBoardQuery(boardQuery);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [boardQuery]);

  const projectTaskFilters = useMemo(() => ({
    projectId,
    limit: 100,
    q: debouncedBoardQuery.trim() || undefined,
    status: boardStatus || undefined,
    priority: boardPriority || undefined,
    assigneeId: boardAssignee || undefined,
    dateFrom: boardRange?.[0] ? toApiDate(boardRange[0]) : undefined,
    dateTo: boardRange?.[1] ? toApiDate(boardRange[1]) : undefined,
    overdue: overdueOnly ? "true" : undefined,
  }), [
    projectId,
    debouncedBoardQuery,
    boardStatus,
    boardPriority,
    boardAssignee,
    boardRange,
    overdueOnly,
  ]);

  const [columnTotals, setColumnTotals] = useState({});

  useEffect(() => {
    if (view !== "overview") return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      setOverviewLoading(true);
      boardApi
        .overview({
          page: overviewPage,
          limit: 6,
          type: overviewType,
          query: overviewQuery.trim() || undefined,
          status: overviewStatus,
          dateFrom: overviewRange?.[0] ? toApiDate(overviewRange[0]) : undefined,
          dateTo: overviewRange?.[1] ? toApiDate(overviewRange[1]) : undefined,
          sort: overviewSort,
        })
        .then((page) => {
          if (!active) return;
          const lastPage = Math.max(1, Math.ceil(page.total / 6));
          if (overviewPage > lastPage) {
            setOverviewPage(lastPage);
            return;
          }
          setOverviewItems(page.items);
          setOverviewTotal(page.total);
        })
        .catch((error) => {
          if (active) message.error(error.message);
        })
        .finally(() => {
          if (active) setOverviewLoading(false);
        });
    }, overviewQuery ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    view,
    overviewPage,
    overviewType,
    overviewQuery,
    overviewStatus,
    overviewRange,
    overviewSort,
    revision,
  ]);

  useEffect(() => {
    if (!projectId || mode !== "project" || view !== "board") {
      if (!projectId) {
        setTasks([]);
        setLoading(false);
      }
      return undefined;
    }

    let active = true;
    setLoading(true);
    Promise.all([
      tasksApi.listByColumns(projectTaskFilters),
      projectsApi.get(projectId),
    ])
      .then(([taskData, projectData]) => {
        if (!active) return;
        setTasks(taskData.items);
        setColumnTotals(taskData.totals || {});
        // ผู้รับผิดชอบงาน = สมาชิกโครงการที่เป็นเจ้าหน้าที่เท่านั้น (ไม่รวม requester / ทั้งระบบ)
        setMemberUsers(
          (projectData.members || []).filter((member) => Boolean(member.is_staff)),
        );
        setCanManage(Boolean(projectData.permissions?.canManage));
        setCanCreateTasks(Boolean(projectData.permissions?.canCreateTasks));
        setBoardLocked(Boolean(
          projectData.permissions?.boardLocked
          || projectData.project?.board_locked,
        ));
        setOpenTaskCount(Number(projectData.project?.open_task_count || 0));
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
  }, [projectId, mode, view, projectTaskFilters]);

  useEffect(() => {
    if (view !== "board") return undefined;

    const socket = getSocket();
    const leaveFns = [];

    if (mode === "project" && projectId) {
      leaveFns.push(joinProjectRoom(projectId));
    }
    if (mode === "ticket" && ticketId) {
      leaveFns.push(joinIssueRoom(ticketId));
    }

    const onTaskChanged = (payload) => {
      if (mode !== "project" || !projectId) return;
      if (Number(payload?.projectId) !== Number(projectId)) return;
      const task = payload?.task;
      if (!task) return;

      // Respect active board filters: drop rows that no longer match.
      const matchesFilters = () => {
        if (boardStatus && task.status !== boardStatus) return false;
        if (boardPriority && task.priority !== boardPriority) return false;
        if (boardAssignee && Number(task.assignee_id) !== Number(boardAssignee)) return false;
        const query = debouncedBoardQuery.trim().toLocaleLowerCase("th");
        if (query) {
          const hay = `${task.title || ""} ${task.description || ""}`.toLocaleLowerCase("th");
          if (!hay.includes(query)) return false;
        }
        if (overdueOnly) {
          if (!task.due_date || task.status === "done" || !dayjs(task.due_date).isBefore(dayjs(), "day")) {
            return false;
          }
        }
        return true;
      };

      setTasks((current) => {
        const exists = current.some((row) => Number(row.id) === Number(task.id));
        if (!matchesFilters()) {
          if (!exists) return current;
          const previous = current.find((row) => Number(row.id) === Number(task.id));
          if (previous && setColumnTotals) {
            setColumnTotals((totals) => ({
              ...totals,
              [previous.status]: Math.max(0, Number(totals[previous.status] || 1) - 1),
            }));
          }
          return current.filter((row) => Number(row.id) !== Number(task.id));
        }
        return mergeTaskPatch(current, task, setColumnTotals);
      });
      applyBoardGate(
        { setBoardLocked, setOpenTaskCount, setCanCreateTasks },
        payload.boardGate,
      );
    };

    const onIssueChanged = (payload) => {
      const issue = payload?.issue;
      if (!issue) return;
      if (mode === "ticket" && Number(ticketId) === Number(issue.id)) {
        setTickets((current) => upsertById(current, issue));
      }
      if (mode === "project" && payload?.linkedTask
          && Number(payload.linkedTask.project_id) === Number(projectId)) {
        setTasks((current) => mergeTaskPatch(current, payload.linkedTask, setColumnTotals));
      }
    };

    socket.on("task:changed", onTaskChanged);
    socket.on("issue:changed", onIssueChanged);

    return () => {
      socket.off("task:changed", onTaskChanged);
      socket.off("issue:changed", onIssueChanged);
      leaveFns.forEach((leave) => leave());
    };
  }, [
    view,
    mode,
    projectId,
    ticketId,
    boardStatus,
    boardPriority,
    boardAssignee,
    debouncedBoardQuery,
    overdueOnly,
  ]);

  const reloadTasks = async () => {
    if (!projectId) return;
    const [taskData, projectData] = await Promise.all([
      tasksApi.listByColumns(projectTaskFilters),
      projectsApi.get(projectId),
    ]);
    setTasks(taskData.items);
    setColumnTotals(taskData.totals || {});
    setCanCreateTasks(Boolean(projectData.permissions?.canCreateTasks));
    setBoardLocked(Boolean(
      projectData.permissions?.boardLocked
      || projectData.project?.board_locked,
    ));
    setOpenTaskCount(Number(projectData.project?.open_task_count || 0));
  };

  const move = async (task, status) => {
    if (boardLocked) {
      message.warning("งานทั้งหมดเสร็จสิ้นแล้ว ไม่สามารถย้ายงานได้อีก");
      return;
    }
    const permissionOk = task.issue_id
      ? canManageAllIssues || Boolean(task.issue_participant)
      : canManage || Number(task.assignee_id) === Number(user.id);
    if (!permissionOk || task.status === status) return;
    if (task.issue_id) {
      const incompleteSiblings = Math.max(
        0,
        openTaskCount - (task.status !== "done" ? 1 : 0),
      );
      if (incompleteSiblings > 0) {
        message.warning("ยังมีงานอื่นค้างอยู่ — ต้องเคลียร์งานให้หมดก่อน จึงจะขยับการ์ด Ticket ได้");
        return;
      }
    }
    const previousStatus = task.status;
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status } : item)));
    setColumnTotals((current) => ({
      ...current,
      [previousStatus]: Math.max(0, Number(current[previousStatus] || 1) - 1),
      [status]: Number(current[status] || 0) + 1,
    }));
    try {
      await tasksApi.update(task.id, { status });
      if (task.issue_id && status === "done") {
        setBoardLocked(true);
        setOpenTaskCount(0);
        setCanCreateTasks(false);
        message.success("เสร็จสิ้นงานทั้งหมดแล้ว กระดานถูกล็อก");
      } else if (previousStatus === "done" || status === "done" || task.status !== "done") {
        setOpenTaskCount((current) => {
          let next = current;
          if (previousStatus !== "done" && status === "done") next = Math.max(0, next - 1);
          if (previousStatus === "done" && status !== "done") next += 1;
          return next;
        });
      }
    } catch (error) {
      message.error(error.message);
      await reloadTasks();
    }
  };

  const moveTicket = async (ticket, boardStatus) => {
    const currentStatus = ticket.board_status || (ticket.status === "in_progress" ? "doing" : "todo");
    if (currentStatus === boardStatus) return;
    const previousTicket = ticket;
    setTickets((current) => current.map((item) => (
      item.id === ticket.id ? { ...item, board_status: boardStatus } : item
    )));
    try {
      await issuesApi.updateBoardStatus(ticket.id, boardStatus);
      message.success(boardStatus === "done" ? "เสร็จสิ้นและปิด Ticket แล้ว" : "ย้าย Ticket แล้ว");
      if (boardStatus === "done") {
        setTicketId(null);
        setView("overview");
      }
    } catch (error) {
      message.error(error.message);
      setTickets((current) => upsertById(current, previousTicket));
    }
  };

  const create = async (values) => {
    if (boardLocked) {
      message.warning("งานทั้งหมดเสร็จสิ้นแล้ว ไม่สามารถเพิ่มงานได้อีก");
      return;
    }
    setSaving(true);
    try {
      await tasksApi.create({ ...values, projectId });
      message.success("เพิ่มงานเรียบร้อย");
      setOpen(false);
      await reloadTasks();
    } catch (error) {
      message.error(error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const saveTaskDetail = async (values) => {
    if (!selectedTask) return;
    if (boardLocked) {
      message.warning("งานทั้งหมดเสร็จสิ้นแล้ว ไม่สามารถแก้ไขได้อีก");
      return;
    }
    setSavingDetail(true);
    try {
      await tasksApi.update(selectedTask.id, values);
      message.success("บันทึกรายละเอียดงานแล้ว");
      setSelectedTask(null);
      await reloadTasks();
    } catch (error) {
      message.error(error.message);
      throw error;
    } finally {
      setSavingDetail(false);
    }
  };

  const selectedBoardTicket = useMemo(
    () => tickets.find((ticket) => Number(ticket.id) === Number(ticketId)) || null,
    [tickets, ticketId],
  );
  const visibleItems = useMemo(
    () => (mode === "project" ? tasks : (selectedBoardTicket ? [selectedBoardTicket] : [])),
    [mode, tasks, selectedBoardTicket],
  );
  const filteredVisibleItems = useMemo(() => {
    // Project board filters are applied server-side; keep client filters for ticket mode.
    if (mode === "project") return visibleItems;
    const query = boardQuery.trim().toLocaleLowerCase("th");
    return visibleItems.filter((item) => {
      const currentStatus = item.board_status || (item.status === "in_progress" ? "doing" : "todo");
      if (boardStatus && currentStatus !== boardStatus) return false;
      if (boardPriority && item.priority !== boardPriority) return false;
      if (boardAssignee && Number(item.assignee_id) !== Number(boardAssignee)) return false;
      if (query) {
        const searchable = `${item.ticket_no || ""} ${item.title || ""} ${item.description || ""}`;
        if (!searchable.toLocaleLowerCase("th").includes(query)) return false;
      }
      const itemDate = item.due_date || item.estimated_completion_at || item.updated_at;
      if (boardRange) {
        if (!itemDate) return false;
        const date = dayjs(itemDate);
        if (date.isBefore(boardRange[0], "day") || date.isAfter(boardRange[1], "day")) {
          return false;
        }
      }
      if (overdueOnly) {
        if (!item.due_date || currentStatus === "done" || !dayjs(item.due_date).isBefore(dayjs(), "day")) {
          return false;
        }
      }
      return true;
    });
  }, [
    visibleItems,
    mode,
    boardQuery,
    boardStatus,
    boardPriority,
    boardAssignee,
    boardRange,
    overdueOnly,
  ]);
  const boardAssigneeOptions = useMemo(() => {
    if (mode === "project" && memberUsers.length) {
      return memberUsers.map((member) => ({
        value: member.id,
        label: member.name,
      }));
    }
    const values = new Map();
    visibleItems.forEach((item) => {
      if (item.assignee_id && item.assignee_name) values.set(item.assignee_id, item.assignee_name);
    });
    return [...values].map(([value, label]) => ({ value, label }));
  }, [mode, memberUsers, visibleItems]);

  const columnItems = useMemo(() => {
    const buckets = Object.fromEntries(TASK_COLUMNS.map((status) => [status, []]));
    filteredVisibleItems.forEach((item) => {
      const status = mode === "project"
        ? item.status
        : (item.board_status || (item.status === "in_progress" ? "doing" : "todo"));
      if (buckets[status]) buckets[status].push(item);
    });
    return buckets;
  }, [filteredVisibleItems, mode]);

  const openBoard = (item) => {
    setBoardQuery("");
    setBoardStatus();
    setBoardPriority();
    setBoardAssignee();
    setBoardRange(null);
    setOverdueOnly(false);
    setSelectedWorkspace(item);
    if (item.kind === "project") {
      setTasks([]);
      setMemberUsers([]);
      setCanManage(false);
      setCanCreateTasks(false);
      setLoading(true);
      setMode("project");
      setProjectId(item.id);
    } else {
      setMode("ticket");
      setTicketId(item.id);
      setTickets([item]);
    }
    setView("board");
  };

  if (view === "overview") {
    return (
      <div>
        <PageHeader
          title="กระดานงาน"
          subtitle="เลือกโครงการหรือ Ticket เพื่อเปิดกระดานและจัดการสถานะงาน"
        />

        <div className="flex flex-col gap-4">
          <Card
            className="rounded-xl shadow-sm"
            styles={{ body: { padding: 12 } }}
          >
            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
              <Input
                allowClear
                size="small"
                className="w-full md:min-w-56 md:flex-1"
                value={overviewQuery}
                onChange={(event) => {
                  setOverviewQuery(event.target.value);
                  setOverviewPage(1);
                }}
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="ค้นหาชื่อ รหัสโครงการ หรือเลข Ticket"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:contents">
                <div className="w-full sm:col-span-2 md:w-auto md:min-w-0 [&_.ant-segmented]:w-full md:[&_.ant-segmented]:w-auto">
                  <Segmented
                    size="small"
                    value={overviewType}
                    onChange={(value) => {
                      setOverviewType(value);
                      setOverviewPage(1);
                    }}
                    options={[
                      { value: "all", label: "ทั้งหมด" },
                      { value: "project", label: "โครงการ" },
                      ...(canUseTicketBoard ? [{ value: "ticket", label: "Ticket" }] : []),
                    ]}
                  />
                </div>
                <Select
                  allowClear
                  size="small"
                  className="w-full md:min-w-36 md:w-36"
                  value={overviewStatus}
                  onChange={(value) => {
                    setOverviewStatus(value);
                    setOverviewPage(1);
                  }}
                  placeholder="สถานะ"
                  options={[
                    { value: "pending", label: "รออนุมัติ" },
                    { value: "active", label: "โครงการกำลังดำเนินการ" },
                    { value: "on_hold", label: "พักโครงการ" },
                    { value: "completed", label: "โครงการเสร็จสิ้น" },
                    { value: "accepted", label: "Ticket รับเรื่องแล้ว" },
                    { value: "in_progress", label: "Ticket กำลังดำเนินการ" },
                  ]}
                />
                <AppRangePicker
                  size="small"
                  className="w-full sm:col-span-2 md:w-auto"
                  value={overviewRange}
                  onChange={(value) => {
                    setOverviewRange(value);
                    setOverviewPage(1);
                  }}
                  presets={dateRangePresets}
                  placeholder={["ตั้งแต่วันที่", "ถึงวันที่"]}
                />
                <Select
                  size="small"
                  className="w-full md:min-w-36 md:w-40"
                  value={overviewSort}
                  onChange={(value) => {
                    setOverviewSort(value);
                    setOverviewPage(1);
                  }}
                  options={[
                    { value: "updated", label: "อัปเดตล่าสุด" },
                    { value: "due", label: "ใกล้ครบกำหนด" },
                    { value: "workload", label: "งานค้างมากที่สุด" },
                  ]}
                />
                <div className="flex items-center justify-between gap-2 sm:col-span-2 md:contents">
                  <Button
                    size="small"
                    type="text"
                    icon={<ClearOutlined />}
                    onClick={() => {
                      setOverviewQuery("");
                      setOverviewType("all");
                      setOverviewStatus();
                      setOverviewRange(null);
                      setOverviewSort("updated");
                      setOverviewPage(1);
                    }}
                  >
                    ล้าง
                  </Button>
                  <span className="text-xs text-slate-400 md:ml-auto">{overviewTotal} รายการ</span>
                </div>
              </div>
            </div>
          </Card>

          {overviewItems.length ? (
            <>
              <Row gutter={[14, 14]}>
                {overviewItems.map((item) => {
                const isProject = item.kind === "project";
                const total = Number(item.work_total || 0);
                const done = Number(item.work_done || 0);
                const percent = total ? Math.round((done / total) * 100) : 0;
                return (
                  <Col xs={24} sm={12} xl={8} key={`${item.kind}-${item.id}`}>
                    <Card
                      hoverable
                      loading={overviewLoading}
                      className="h-full rounded-xl border border-slate-200 shadow-sm"
                      styles={{ body: { padding: 16 } }}
                      onClick={() => openBoard(item)}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          isProject ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                        }`}
                        >
                          {isProject ? <FolderOutlined /> : <BugOutlined />}
                        </div>
                        <Tag color={isProject ? "red" : "gold"}>
                          {isProject ? "โครงการ" : "Ticket"}
                        </Tag>
                      </div>
                      <div className="text-xs font-medium text-slate-400">
                        {isProject ? item.code : item.ticket_no}
                      </div>
                      <div className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold text-slate-800">
                        {item.title}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <StatusTag value={item.status} />
                        {!isProject ? <PriorityTag value={item.priority} /> : null}
                      </div>
                      {isProject ? (
                        <div className="mt-3">
                          <div className="mb-1 flex justify-between text-xs text-slate-500">
                            <span>ความคืบหน้า</span>
                            <span className={percent >= 100 ? "font-medium text-green-600" : undefined}>
                              {done}/{total} งาน · {percent}%
                            </span>
                          </div>
                          <Progress
                            percent={percent}
                            size="small"
                            showInfo={false}
                            strokeColor={progressStrokeColor(percent)}
                          />
                        </div>
                      ) : (
                        <div className="mt-3 truncate text-xs text-slate-500">
                          {item.project_name || "Ticket ทั่วไป"}
                          {item.assignee_name ? ` · ${item.assignee_name}` : ""}
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                        <span className="text-xs text-slate-400">
                          {item.item_date ? formatDate(item.item_date) : "ไม่กำหนดวันที่"}
                        </span>
                        <Button size="small" type="link" className="!h-auto !px-0">เปิดกระดาน</Button>
                      </div>
                    </Card>
                  </Col>
                );
                })}
              </Row>
              {overviewTotal > 6 ? (
                <div className="flex justify-center">
                  <Pagination
                    size="small"
                    current={overviewPage}
                    pageSize={6}
                    total={overviewTotal}
                    showSizeChanger={false}
                    onChange={setOverviewPage}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <Card className="rounded-xl" styles={{ body: { padding: 20 } }}>
              <Empty
                description={overviewLoading
                  ? "กำลังโหลดรายการ"
                  : "ไม่พบโครงการหรือ Ticket ตามตัวกรอง"}
              />
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={mode === "project"
          ? selectedWorkspace?.title || "กระดานโครงการ"
          : selectedBoardTicket?.title || "กระดาน Ticket"}
        subtitle={mode === "ticket" && selectedBoardTicket
          ? `${selectedBoardTicket.ticket_no} · ลากการ์ดเพื่อเปลี่ยนสถานะ`
          : "ลากการ์ดเพื่อเปลี่ยนสถานะงาน"}
        extra={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setView("overview")}>
              กลับหน้ารวม
            </Button>
            {mode === "project" && canCreateTasks && !boardLocked ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)} disabled={!projectId}>
                เพิ่มงาน
              </Button>
            ) : null}
          </Space>
        }
      />

      {mode === "project" && boardLocked ? (
        <Alert
          className="mb-4"
          type="success"
          showIcon
          message="งานทั้งหมดเสร็จสิ้นแล้ว"
          description="กระดานถูกล็อก ไม่สามารถเพิ่ม ย้าย หรือแก้ไขงานได้อีก"
        />
      ) : null}
      <div className="flex flex-col gap-4">
      <Card className="rounded-xl shadow-sm" styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            allowClear
            size="small"
            className="min-w-56 flex-1"
            value={boardQuery}
            onChange={(event) => setBoardQuery(event.target.value)}
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="ค้นหาชื่องาน รายละเอียด หรือเลข Ticket"
          />
          <Select
            allowClear
            size="small"
            className="min-w-40"
            value={boardStatus}
            onChange={setBoardStatus}
            placeholder="สถานะ"
            options={TASK_COLUMNS.map((status) => ({
              value: status,
              label: STATUS_LABELS[status],
            }))}
          />
          <Select
            allowClear
            size="small"
            className="min-w-40"
            value={boardPriority}
            onChange={setBoardPriority}
            placeholder="ความสำคัญ"
            options={[
              { value: "low", label: "ต่ำ" },
              { value: "medium", label: "ปานกลาง" },
              { value: "high", label: "สูง" },
              { value: "urgent", label: "เร่งด่วน" },
            ]}
          />
          <Select
            allowClear
            size="small"
            showSearch
            optionFilterProp="label"
            className="min-w-44"
            value={boardAssignee}
            onChange={setBoardAssignee}
            placeholder="ผู้รับผิดชอบ"
            options={boardAssigneeOptions}
          />
          <AppRangePicker
            size="small"
            className=""
            value={boardRange}
            onChange={setBoardRange}
            presets={dateRangePresets}
            placeholder={["ตั้งแต่วันที่", "ถึงวันที่"]}
          />
          <Space size={6}>
            <Switch size="small" checked={overdueOnly} onChange={setOverdueOnly} />
            <span className="text-xs text-slate-600">เกินกำหนด</span>
          </Space>
          <Button
            size="small"
            type="text"
            icon={<ClearOutlined />}
            onClick={() => {
              setBoardQuery("");
              setBoardStatus();
              setBoardPriority();
              setBoardAssignee();
              setBoardRange(null);
              setOverdueOnly(false);
            }}
          >
            ล้าง
          </Button>
        </div>
      </Card>

      {!selectedWorkspace ? (
        <Empty description="ไม่พบรายการที่เลือก" />
      ) : (
        <div className="overflow-x-auto pb-2">
          <Row gutter={[16, 16]} className="min-w-[720px] md:min-w-[980px]">
            {TASK_COLUMNS.map((column) => {
              const columnTasks = columnItems[column] || [];
              return (
                <Col span={6} key={column}>
                  <Card
                    loading={mode === "project" ? loading : false}
                    className={`kanban-column rounded-2xl border-0 border-t-4 shadow-none ${columnAccent[column]}`}
                    title={
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700">{STATUS_LABELS[column]}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                          {Number.isFinite(columnTotals[column])
                            ? columnTotals[column]
                            : columnTasks.length}
                        </span>
                      </div>
                    }
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      if (mode === "project") {
                        const task = tasks.find((item) => item.id === Number(event.dataTransfer.getData("task")));
                        if (task) move(task, column);
                      } else {
                        const ticket = tickets.find(
                          (item) => item.id === Number(event.dataTransfer.getData("ticket")),
                        );
                        if (ticket) moveTicket(ticket, column);
                      }
                    }}
                  >
                    {columnTasks.length ? (
                      <>
                        <VirtualList
                          items={columnTasks}
                          estimateSize={KANBAN_CARD_ESTIMATE}
                          overscan={6}
                          className="kanban-column-list"
                          getItemKey={(task) => `${mode}-${task.id}`}
                        >
                          {(task) => {
                            const permissionOk = mode === "ticket"
                              ? Boolean(task.assignee_id) && (
                                canManageAllIssues
                                || Boolean(task.issue_participant)
                              )
                              : task.issue_id
                                ? canManageAllIssues || Boolean(task.issue_participant)
                                : canManage || Number(task.assignee_id) === Number(user.id);
                            const ticketBlockedByOpenWork = mode === "project"
                              && Boolean(task.issue_id)
                              && !boardLocked
                              && Math.max(0, openTaskCount - (task.status !== "done" ? 1 : 0)) > 0;
                            const canMove = permissionOk
                              && !(mode === "project" && boardLocked)
                              && !ticketBlockedByOpenWork;
                            let lockHint = "";
                            if (mode === "project" && boardLocked) {
                              lockHint = "งานจบแล้ว — ย้ายไม่ได้";
                            } else if (ticketBlockedByOpenWork) {
                              lockHint = "ต้องเคลียร์งานอื่นให้หมดก่อน จึงขยับการ์ด Ticket ได้";
                            }
                            return (
                              <KanbanCard
                                task={task}
                                mode={mode}
                                canMove={canMove}
                                lockHint={lockHint}
                                onMoveStatus={(item, status) => {
                                  if (mode === "ticket") moveTicket(item, status);
                                  else move(item, status);
                                }}
                                onOpen={() => {
                                  if (mode === "ticket") {
                                    openIssue(task);
                                  } else {
                                    setSelectedTask(task);
                                  }
                                }}
                              />
                            );
                          }}
                        </VirtualList>
                        {Number(columnTotals[column] || 0) > columnTasks.length ? (
                          <div className="mt-2 text-center text-[11px] text-slate-400">
                            แสดง {columnTasks.length} จาก {columnTotals[column]} งานในคอลัมน์นี้
                            (ใช้ตัวกรองเพื่อหาเพิ่ม)
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-400">ไม่มีงานในสถานะนี้</div>
                    )}
                  </Card>
                </Col>
              );
            })}
          </Row>
        </div>
      )}
      </div>

      <Modal
        title="เพิ่มงานใหม่"
        open={open}
        centered
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <TaskForm onSubmit={create} loading={saving} users={memberUsers} />
      </Modal>

      <TaskDetail
        task={selectedTask}
        open={Boolean(selectedTask)}
        users={memberUsers}
        canEdit={Boolean(
          selectedTask
          && !boardLocked
          && (
            selectedTask.issue_id
              ? canManageAllIssues || Boolean(selectedTask.issue_participant)
              : canManage || Number(selectedTask.assignee_id) === Number(user.id)
          )
        )}
        canChangeAssignee={Boolean(!boardLocked && (canManage || canManageAllTasks))}
        loading={savingDetail}
        onClose={() => setSelectedTask(null)}
        onSave={saveTaskDetail}
        readOnlyHint={boardLocked
          ? "งานทั้งหมดเสร็จสิ้นแล้ว — เปิดดูได้อย่างเดียว แก้ไขไม่ได้"
          : undefined}
      />
    </div>
  );
}
