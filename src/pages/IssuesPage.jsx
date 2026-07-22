import { useEffect, useState } from "react";
import { Button, Card, Empty, List, Modal, Pagination, Select, message } from "antd";
import { BugOutlined, PlusOutlined, RightOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { IssueForm } from "../components/forms/IssueForm";
import { useIssueDrawer } from "../components/issues/IssueDrawerContext";
import { PageHeader } from "../components/ui/PageHeader";
import { PriorityTag, StatusTag } from "../components/ui/StatusTag";
import { ISSUE_STATUS_FILTER_OPTIONS } from "../constants";
import { issuesApi, projectsApi } from "../services/api";
import { hasPermission, isRequesterPersona } from "../utils/access";

const PAGE_SIZE = 6;

function issueListParams(page, statusFilter) {
  return {
    page,
    limit: PAGE_SIZE,
    ...(statusFilter ? { status: statusFilter } : {}),
  };
}

function requesterStatusSummary(status) {
  if (status === "open") return "ทีมกำลังรอรับเรื่อง";
  if (status === "cancelled") return "คุณยกเลิกคำขอนี้แล้ว";
  if (status === "rejected") return "ทีม Reject คำขอนี้";
  if (status === "closed") return "ดำเนินการเสร็จสิ้นแล้ว";
  return "ทีมรับเรื่องแล้ว";
}

export function IssuesPage({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { openIssue, revision } = useIssueDrawer();
  const requesterView = isRequesterPersona(user);
  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(null);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("new") === "1") setOpen(true);
  }, [location.search]);

  const closeCreateModal = () => {
    setOpen(false);
    const params = new URLSearchParams(location.search);
    if (!params.has("new")) return;
    params.delete("new");
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "" },
      { replace: true },
    );
  };

  const loadIssues = async (nextPage = page) => {
    const issuePage = await issuesApi.list(issueListParams(nextPage, statusFilter));
    setIssues(issuePage.items);
    setTotal(issuePage.total);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    issuesApi
      .list(issueListParams(page, statusFilter))
      .then((issuePage) => {
        if (!active) return;
        setIssues(issuePage.items);
        setTotal(issuePage.total);
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
  }, [revision, page, requesterView, statusFilter]);

  useEffect(() => {
    if (!open || projects.length) return undefined;
    let active = true;
    projectsApi.picker()
      .then((projectList) => {
        if (active) setProjects(projectList);
      })
      .catch((error) => {
        if (active) message.error(error.message);
      });
    return () => {
      active = false;
    };
  }, [open, projects.length]);

  const create = async (values) => {
    setSaving(true);
    try {
      const { files = [], ...payload } = values;
      const created = await issuesApi.create(payload);
      message.success("ส่งเรื่องเรียบร้อย");
      if (files.length && created?.id) {
        try {
          await issuesApi.uploadAttachments(created.id, files);
        } catch (uploadError) {
          message.warning(
            `สร้าง Ticket แล้ว แต่แนบไฟล์ไม่ครบ: ${uploadError.message}`,
            8,
          );
        }
      }
      closeCreateModal();
      setPage(1);
      if (page === 1) await loadIssues(1);
      if (created?.id) openIssue({ id: created.id }, { syncUrl: true });
    } catch (error) {
      message.error(error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={requesterView ? "คำขอของฉัน" : "Issue ทั้งหมด"}
        subtitle={requesterView
          ? "แจ้งเรื่องและติดตามสถานะได้ในที่เดียว"
          : "แจ้ง ติดตาม และพูดคุยกับทีมได้ในที่เดียว"}
        extra={hasPermission(user, "issues.create") ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            แจ้งปัญหา
          </Button>
        ) : null}
      />

      <Card className="mb-4 rounded-xl shadow-sm" styles={{ body: { padding: 12 } }}>
        <Select
          allowClear
          size="small"
          className="min-w-44"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value ?? null);
            setPage(1);
          }}
          placeholder="สถานะทั้งหมด"
          options={ISSUE_STATUS_FILTER_OPTIONS}
        />
      </Card>

      <Card className="rounded-2xl shadow-sm" loading={loading} styles={{ body: { padding: 0 } }}>
        <List
          dataSource={issues}
          locale={{ emptyText: <Empty className="py-10" description="ยังไม่มีรายการแจ้งปัญหา" /> }}
          renderItem={(issue) => (
            <List.Item
              className="issue-row cursor-pointer px-4 py-3 md:px-5"
              onClick={() => openIssue(issue, { syncUrl: true })}
              actions={[
                ...(!requesterView ? [<PriorityTag key="priority" value={issue.priority} />] : []),
                <StatusTag key="status" value={issue.status} />,
                <RightOutlined key="arrow" className="text-slate-300" />,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                    <BugOutlined />
                  </div>
                }
                title={
                  <div>
                    <div className="text-xs text-slate-400">
                      {issue.ticket_no}
                      {` · ${issue.project_name || "ทั่วไป"}`}
                      {issue.system_component ? ` · ${issue.system_component}` : ""}
                    </div>
                    <div className="text-[15px] font-medium text-slate-800">{issue.title}</div>
                  </div>
                }
                description={
                  <div>
                    <div className="line-clamp-1 text-slate-500">{issue.description}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {requesterView
                        ? requesterStatusSummary(issue.status)
                        : `ผู้รับผิดชอบ: ${issue.assignee_name || "รอผู้รับเรื่อง"}`}
                      {!requesterView && Number(issue.member_count) > 0
                        ? ` · สมาชิก ${issue.member_count} คน`
                        : ""}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
        {total > PAGE_SIZE ? (
          <div className="flex justify-center border-t border-slate-100 py-3">
            <Pagination
              size="small"
              current={page}
              pageSize={PAGE_SIZE}
              total={total}
              onChange={setPage}
              showSizeChanger={false}
            />
          </div>
        ) : null}
      </Card>

      <Modal
        title={requesterView ? "แจ้งเรื่องใหม่" : "แจ้งปัญหาหรือข้อเสนอแนะ"}
        open={open}
        centered
        onCancel={closeCreateModal}
        footer={null}
        destroyOnHidden
      >
        <IssueForm
          projects={projects}
          onSubmit={create}
          loading={saving}
          simple={requesterView}
        />
      </Modal>
    </div>
  );
}
