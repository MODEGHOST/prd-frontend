import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Col, Empty, Modal, Pagination, Progress, Row, Space, Spin, message } from "antd";
import { PlusOutlined, TeamOutlined, UserOutlined, WalletOutlined } from "@ant-design/icons";
import { ProjectForm } from "../components/forms/ProjectForm";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusTag } from "../components/ui/StatusTag";
import { progressStrokeColor } from "../constants";
import { projectsApi, usersApi } from "../services/api";
import { hasPermission } from "../utils/access";
import { summarizeProjectBrief } from "../utils/projectBrief";

const PAGE_SIZE = 12;

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

export function ProjectsPage({ user }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async (nextPage = page) => {
    setLoading(true);
    try {
      const projectData = await projectsApi.list({ page: nextPage, limit: PAGE_SIZE });
      setProjects(projectData.items);
      setTotal(projectData.total);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    projectsApi
      .list({ page, limit: PAGE_SIZE })
      .then((projectData) => {
        if (!active) return;
        setProjects(projectData.items);
        setTotal(projectData.total);
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
  }, [page]);

  useEffect(() => {
    if (!open || users.length) return undefined;
    let active = true;
    usersApi
      .list({ role: "staff" })
      .then((userData) => {
        if (active) setUsers(userData);
      })
      .catch((error) => {
        if (active) message.error(error.message);
      });
    return () => {
      active = false;
    };
  }, [open, users.length]);

  const create = async (values) => {
    setSaving(true);
    try {
      await projectsApi.create(values);
      message.success("สร้างโครงการเรียบร้อย");
      setOpen(false);
      if (page === 1) {
        await load(1);
      } else {
        setPage(1);
      }
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
        title="โครงการทั้งหมด"
        subtitle="ติดตามสถานะและความคืบหน้าของทุกโครงการ"
        extra={
          hasPermission(user, "projects.create") ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
              สร้างโครงการ
            </Button>
          ) : null
        }
      />

      <Spin spinning={loading} tip="กำลังโหลดโครงการ">
        <Row gutter={[16, 16]} className={loading && !projects.length ? "min-h-72" : ""}>
          {projects.map((project) => {
          const progress = project.work_total
            ? Math.round((Number(project.work_done || 0) / project.work_total) * 100)
            : 0;
          return (
            <Col xs={24} md={12} xl={8} key={project.id}>
              <Card
                loading={loading}
                hoverable
                className="h-full cursor-pointer rounded-2xl shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                    {project.code}
                  </span>
                  <StatusTag value={project.status} />
                </div>
                <h3 className="m-0 text-lg font-semibold text-slate-800">{project.name}</h3>
                <p className="mt-2 mb-4 line-clamp-2 min-h-10 text-sm text-slate-500">
                  {summarizeProjectBrief(project) || "ยังไม่มีรายละเอียดโครงการ"}
                </p>
                <div className="mb-3 space-y-1.5 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <UserOutlined className="text-slate-400" />
                    <span>
                      ผู้สร้าง: <span className="text-slate-700">{project.creator_name || "-"}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserOutlined className="text-slate-400" />
                    <span>
                      เจ้าของหลัก: <span className="text-slate-700">{project.owner_name || "-"}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <TeamOutlined className="text-slate-400" />
                      สมาชิก {project.member_count ?? 0} คน
                    </span>
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <WalletOutlined className="text-slate-400" />
                      {formatBudget(project.budget, project.currency)}
                    </span>
                  </div>
                </div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>ความคืบหน้า</span>
                  <span
                    className={`font-semibold ${
                      progress >= 100 ? "text-green-600" : "text-slate-700"
                    }`}
                  >
                    {progress}%
                  </span>
                </div>
                <Progress
                  percent={progress}
                  showInfo={false}
                  size="small"
                  strokeColor={progressStrokeColor(progress)}
                />
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-500">
                  <Space size={6}>
                    <span>{project.work_done || 0}/{project.work_total || 0} รายการเสร็จ</span>
                  </Space>
                  <span>รวม Task + Ticket</span>
                </div>
              </Card>
            </Col>
          );
          })}
        </Row>
      </Spin>

      {!loading && !projects.length ? <Empty className="mt-10" description="ยังไม่มีโครงการ" /> : null}
      {total > PAGE_SIZE ? (
        <div className="mt-6 flex justify-center">
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={total}
            showSizeChanger={false}
            onChange={setPage}
          />
        </div>
      ) : null}

      <Modal
        title="สร้างโครงการใหม่"
        open={open}
        centered
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnHidden
        width={880}
        classNames={{ content: "max-md:!w-[calc(100vw-32px)]" }}
      >
        <ProjectForm onSubmit={create} loading={saving} users={users} currentUserId={user.id} />
      </Modal>
    </div>
  );
}
