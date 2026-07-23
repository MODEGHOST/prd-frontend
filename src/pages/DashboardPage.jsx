import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Empty, Table } from "antd";
import {
  BugOutlined,
  CheckCircleOutlined,
  FolderOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { StatCard, StatGrid } from "../components/dashboard/StatCard";
import { useIssueDrawer } from "../components/issues/IssueDrawerContext";
import { PriorityTag, StatusTag } from "../components/ui/StatusTag";
import { dashboardApi } from "../services/api";
import { isRequesterPersona } from "../utils/access";

export function DashboardPage({ user }) {
  const { openIssue } = useIssueDrawer();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    dashboardApi
      .get()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <Empty description={error} />;
  if (loading || !data?.counts) return <Card loading className="rounded-2xl" />;

  const counts = data.counts;
  const requesterView = isRequesterPersona(user);
  const columns = [
    {
      title: "เลขที่",
      dataIndex: "ticket_no",
      key: "ticket_no",
      width: 168,
      ellipsis: true,
      render: (value) => <span className="font-semibold text-red-700">{value}</span>,
    },
    {
      title: "หัวข้อ",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (title, record) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-800">{title}</div>
          {!requesterView ? (
            <div className="truncate text-xs text-slate-400">{record.requester_name}</div>
          ) : null}
        </div>
      ),
    },
    ...(!requesterView ? [{
      title: "โครงการ",
      dataIndex: "project_name",
      key: "project_name",
      width: 120,
      ellipsis: true,
      render: (value) => value || "ทั่วไป",
    }, {
      title: "ความสำคัญ",
      dataIndex: "priority",
      key: "priority",
      width: 100,
      render: (value) => <PriorityTag value={value} labeled={false} />,
    }] : []),
    {
      title: "สถานะ",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value) => <StatusTag value={value} />,
    },
  ];

  const recentIssues = data.recentIssues || [];
  const emptyText = requesterView ? "ยังไม่มีคำขอ" : "ยังไม่มี Issue";

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-red-950 px-5 py-6 text-white shadow-sm md:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-sm text-red-200">INTERNAL WORKSPACE · วันทำงานของคุณ</p>
            <h1 className="m-0 text-2xl font-semibold md:text-3xl">{user.name}</h1>
            <p className="mt-2 mb-0 max-w-xl text-sm text-slate-300 md:text-base">
              {requesterView
                ? "ส่งคำขอและติดตามสถานะได้ง่าย ๆ ในที่เดียว"
                : "สรุปโครงการ งาน และ Issue ที่เกี่ยวข้องกับคุณในวันนี้"}
            </p>
            {requesterView ? (
              <Link to="/issues?new=1">
                <Button className="mt-4" icon={<PlusOutlined />}>แจ้งเรื่องใหม่</Button>
              </Link>
            ) : null}
          </div>
          <div className="rounded-xl bg-white/15 px-3 py-2 text-sm backdrop-blur">
            {new Intl.DateTimeFormat("th-TH", { dateStyle: "full" }).format(new Date())}
          </div>
        </div>
      </section>

      <StatGrid>
        {requesterView ? (
          <>
            <StatCard
              title="คำขอทั้งหมด"
              value={counts.issues}
              hint="รายการที่คุณเป็นผู้แจ้ง"
              icon={<BugOutlined />}
              color="#b91c1c"
            />
            <StatCard
              title="รอรับเรื่อง"
              value={counts.pendingIssues}
              hint="ทีมงานยังไม่ได้รับเรื่อง"
              icon={<UnorderedListOutlined />}
              color="#7c3aed"
            />
            <StatCard
              title="กำลังดำเนินการ"
              value={counts.inProgressIssues}
              hint="ทีมงานรับเรื่องแล้ว"
              icon={<UnorderedListOutlined />}
              color="#ea580c"
            />
            <StatCard
              title="เสร็จสิ้นแล้ว"
              value={counts.completedIssues}
              hint="รายการที่ดำเนินการเรียบร้อย"
              icon={<CheckCircleOutlined />}
              color="#16a34a"
            />
          </>
        ) : (
          <>
            <StatCard
              title="โครงการทั้งหมด"
              value={counts.projects}
              hint={`${counts.activeProjects} กำลังดำเนินการ`}
              icon={<FolderOutlined />}
              color="#b91c1c"
            />
            <StatCard
              title="งานของฉัน"
              value={counts.myWorkTotal}
              hint={`${counts.myWorkDone} รายการเสร็จแล้ว`}
              icon={<UnorderedListOutlined />}
              color="#7c3aed"
            />
            <StatCard
              title="Issue ทั้งหมด"
              value={counts.issues}
              hint={`${counts.openIssues} รายการที่ยังเปิด`}
              icon={<BugOutlined />}
              color="#ea580c"
            />
            <StatCard
              title="อัตรางานสำเร็จ"
              value={`${counts.completionPercent}%`}
              hint="Task + Ticket ในมือของคุณ"
              icon={<CheckCircleOutlined />}
              color="#16a34a"
            />
          </>
        )}
      </StatGrid>

      <Card
        title={<span className="font-semibold">{requesterView ? "คำขอล่าสุด" : "Issue ล่าสุด"}</span>}
        extra={<Link to="/issues" className="text-red-700">ดูทั้งหมด</Link>}
        className="rounded-2xl shadow-sm"
        styles={{ body: { paddingTop: 12 } }}
      >
        {!recentIssues.length ? (
          <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <>
            <div className="space-y-2 md:hidden">
              {recentIssues.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-left transition hover:border-red-200 hover:bg-white"
                  onClick={() => openIssue(record, { goToIssues: true })}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="break-all text-xs font-semibold text-red-700">{record.ticket_no}</span>
                    <StatusTag value={record.status} />
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">{record.title}</div>
                  {!requesterView ? (
                    <div className="mt-0.5 truncate text-xs text-slate-400">{record.requester_name}</div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {!requesterView ? (
                      <>
                        <span className="rounded-md bg-white px-2 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200">
                          {record.project_name || "ทั่วไป"}
                        </span>
                        <PriorityTag value={record.priority} labeled={false} />
                      </>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>

            <div className="hidden md:block">
              <Table
                rowKey="id"
                columns={columns}
                dataSource={recentIssues}
                pagination={false}
                tableLayout="fixed"
                onRow={(record) => ({
                  onClick: () => openIssue(record, { goToIssues: true }),
                  className: "cursor-pointer",
                })}
                locale={{ emptyText }}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
