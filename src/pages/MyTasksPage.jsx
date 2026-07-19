import { useEffect, useMemo, useState } from "react";
import { Card, Col, Empty, List, Pagination, Row, Tabs, message } from "antd";
import { RightOutlined } from "@ant-design/icons";
import { useIssueDrawer } from "../components/issues/IssueDrawerContext";
import { PageHeader } from "../components/ui/PageHeader";
import { PriorityTag, StatusTag } from "../components/ui/StatusTag";
import { STATUS_LABELS, TASK_COLUMNS } from "../constants";
import { issuesApi, tasksApi } from "../services/api";
import { hasPermission } from "../utils/access";

const PAGE_SIZE = 4;

export function MyTasksPage({ user }) {
  const canWorkIssues = hasPermission(user, "issues.transition");
  const { openIssue, revision } = useIssueDrawer();
  const [tasks, setTasks] = useState([]);
  const [activeIssues, setActiveIssues] = useState([]);
  const [closedIssues, setClosedIssues] = useState([]);
  const [activeIssuePage, setActiveIssuePage] = useState(1);
  const [closedIssuePage, setClosedIssuePage] = useState(1);
  const [activeIssueTotal, setActiveIssueTotal] = useState(0);
  const [closedIssueTotal, setClosedIssueTotal] = useState(0);
  const [taskPages, setTaskPages] = useState(
    () => Object.fromEntries(TASK_COLUMNS.map((status) => [status, 1])),
  );
  const [taskTotals, setTaskTotals] = useState(
    () => Object.fromEntries(TASK_COLUMNS.map((status) => [status, 0])),
  );
  const [tasksLoading, setTasksLoading] = useState(true);
  const [issuesLoading, setIssuesLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setTasksLoading(true);
    Promise.all(TASK_COLUMNS.map((status) => tasksApi.list({
      mine: true,
      standalone: true,
      status,
      page: 1,
      limit: PAGE_SIZE,
    })))
      .then((taskData) => {
        if (!active) return;
        setTasks(taskData.flatMap((page) => page.items));
        setTaskPages(Object.fromEntries(TASK_COLUMNS.map((status) => [status, 1])));
        setTaskTotals(Object.fromEntries(
          TASK_COLUMNS.map((status, index) => [status, taskData[index].total]),
        ));
      })
      .catch((error) => {
        if (active) message.error(error.message);
      })
      .finally(() => {
        if (active) setTasksLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  useEffect(() => {
    let active = true;
    setIssuesLoading(true);
    Promise.all([
      issuesApi.list({
        mine: true,
        excludeStatus: "closed",
        page: activeIssuePage,
        limit: PAGE_SIZE,
      }),
      issuesApi.list({
        mine: true,
        status: "closed",
        page: closedIssuePage,
        limit: PAGE_SIZE,
      }),
    ])
      .then(([activeIssueData, closedIssueData]) => {
        if (!active) return;
        setActiveIssues(activeIssueData.items);
        setClosedIssues(closedIssueData.items);
        setActiveIssueTotal(activeIssueData.total);
        setClosedIssueTotal(closedIssueData.total);
      })
      .catch((error) => {
        if (active) message.error(error.message);
      })
      .finally(() => {
        if (active) setIssuesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeIssuePage, closedIssuePage, revision]);

  const changeTaskPage = async (status, page) => {
    setTasksLoading(true);
    try {
      const result = await tasksApi.list({
        mine: true,
        standalone: true,
        status,
        page,
        limit: PAGE_SIZE,
      });
      setTasks((current) => [
        ...current.filter((task) => task.status !== status),
        ...result.items,
      ]);
      setTaskPages((current) => ({ ...current, [status]: page }));
      setTaskTotals((current) => ({ ...current, [status]: result.total }));
    } catch (error) {
      message.error(error.message);
    } finally {
      setTasksLoading(false);
    }
  };

  const grouped = useMemo(
    () => TASK_COLUMNS.map((status) => [status, tasks.filter((task) => task.status === status)]),
    [tasks],
  );
  const renderIssueList = (list, emptyText, total, page, setPage) => (
    <>
      <List
        size="small"
        loading={issuesLoading}
        dataSource={list}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} /> }}
        renderItem={(issue) => (
        <List.Item
          className="cursor-pointer !px-1 !py-2"
          onClick={() => openIssue(issue)}
          actions={[
            <PriorityTag key="priority" value={issue.priority} />,
            <StatusTag key="status" value={issue.status} />,
            <RightOutlined key="open" className="text-slate-300" />,
          ]}
        >
          <List.Item.Meta
            title={`${issue.ticket_no} · ${issue.title}`}
            description={
              `${Number(issue.assignee_id) === Number(user.id) ? "Owner" : "Member"} · ${issue.project_name || "ทั่วไป"}`
            }
          />
        </List.Item>
        )}
      />
      {total > PAGE_SIZE ? (
        <div className="mt-3 flex justify-center">
          <Pagination
            size="small"
            current={page}
            pageSize={PAGE_SIZE}
            total={total}
            showSizeChanger={false}
            onChange={setPage}
          />
        </div>
      ) : null}
    </>
  );

  return (
    <div>
      <PageHeader title="งานของฉัน" subtitle="Task และ Ticket ที่คุณเป็น Owner หรือ Member" />

      {canWorkIssues ? (
        <Card
          className="rounded-xl shadow-sm"
          title="Ticket ที่รับผิดชอบ"
          styles={{
            header: { minHeight: 44, paddingInline: 14 },
            body: { padding: "4px 14px 14px" },
          }}
        >
          <Tabs
            size="small"
            items={[
              {
                key: "active",
                label: `กำลังดำเนินการ (${activeIssueTotal})`,
                children: renderIssueList(
                  activeIssues,
                  "ยังไม่มี Ticket ที่กำลังดำเนินการ",
                  activeIssueTotal,
                  activeIssuePage,
                  setActiveIssuePage,
                ),
              },
              {
                key: "history",
                label: `ประวัติงาน (${closedIssueTotal})`,
                children: renderIssueList(
                  closedIssues,
                  "ยังไม่มี Ticket ที่เสร็จสิ้น",
                  closedIssueTotal,
                  closedIssuePage,
                  setClosedIssuePage,
                ),
              },
            ]}
          />
        </Card>
      ) : null}

      <Row gutter={[18, 22]} className={canWorkIssues ? "mt-8" : ""}>
        {grouped.map(([status, list]) => (
          <Col xs={24} md={12} key={status}>
            <Card
              loading={tasksLoading}
              className="h-full rounded-xl shadow-sm"
              styles={{
                header: { minHeight: 42, paddingInline: 14 },
                body: { padding: 14 },
              }}
              title={
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">{STATUS_LABELS[status]}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {taskTotals[status]}
                  </span>
                </div>
              }
            >
              {list.length ? (
                <div className="divide-y divide-slate-100">
                  {list.map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-800">{task.title}</div>
                        <div className="text-xs text-slate-400">{task.project_name}</div>
                      </div>
                      <PriorityTag value={task.priority} />
                    </div>
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีงาน" />
              )}
              {taskTotals[status] > PAGE_SIZE ? (
                <div className="mt-3 flex justify-center border-t border-slate-100 pt-3">
                  <Pagination
                    size="small"
                    current={taskPages[status]}
                    pageSize={PAGE_SIZE}
                    total={taskTotals[status]}
                    showSizeChanger={false}
                    onChange={(page) => changeTaskPage(status, page)}
                  />
                </div>
              ) : null}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
