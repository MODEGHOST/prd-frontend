import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from "antd";
import {
  CheckOutlined,
  KeyOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { PageHeader } from "../components/ui/PageHeader";
import { accessAdminApi } from "../services/api";
import { hasPermission } from "../utils/access";
import { formatDateTime } from "../utils/datetime";

const STATUS_META = {
  pending: ["รออนุมัติ", "gold"],
  active: ["ใช้งาน", "green"],
  suspended: ["ระงับ", "red"],
  rejected: ["ปฏิเสธ", "default"],
};

const PERMISSION_GROUP_LABELS = {
  audit: "บันทึกการตรวจสอบ",
  company: "บริษัท",
  issues: "Ticket",
  members: "สมาชิกบริษัท",
  projects: "โครงการ",
  roles: "บทบาท",
  tasks: "งาน",
  other: "อื่น ๆ",
};

function MembersPanel({ canManageMembers, canManageRoles }) {
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [memberPage, roleList] = await Promise.all([
        accessAdminApi.members({ page, limit: 20 }),
        accessAdminApi.roles(),
      ]);
      setRows(memberPage.items);
      setTotal(memberPage.total);
      setRoles(Array.isArray(roleList) ? roleList : roleList.items || []);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const updateStatus = async (membershipId, status) => {
    setSavingId(membershipId);
    try {
      await accessAdminApi.updateMemberStatus(membershipId, status);
      message.success(status === "active" ? "อนุมัติสมาชิกแล้ว" : "อัปเดตสถานะแล้ว");
      await load();
    } catch (error) {
      message.error(error.message);
    } finally {
      setSavingId(null);
    }
  };

  const confirmApproval = (row) => {
    const displayName = [row.first_name, row.last_name].filter(Boolean).join(" ") || row.name;
    Modal.confirm({
      centered: true,
      title: "ยืนยันการอนุมัติสมาชิก",
      content: (
        <div className="mt-4 space-y-3">
          <div>
            ต้องการอนุมัติ <strong>{displayName}</strong> ใช่หรือไม่
          </div>
          <Alert
            showIcon
            type={row.email_verified_at ? "success" : "warning"}
            message={row.email_verified_at
              ? "บุคคลนี้ยืนยันอีเมลแล้ว"
              : "บุคคลนี้ยังไม่ได้ยืนยันอีเมล"}
            description={row.email_verified_at
              ? "เมื่อยืนยัน บุคคลนี้จะได้รับสถานะสมาชิกที่ใช้งานได้"
              : "อนุมัติ membership ได้ แต่บุคคลนี้จะยังเข้าสู่ระบบไม่ได้จนกว่าจะยืนยันอีเมล"}
          />
        </div>
      ),
      okText: "อนุมัติ",
      cancelText: "ยกเลิก",
      onOk: () => updateStatus(row.membership_id, "active"),
    });
  };

  const updateRoles = async (membershipId, roleIds) => {
    setSavingId(membershipId);
    try {
      await accessAdminApi.updateMemberRoles(membershipId, roleIds);
      message.success("อัปเดต Role แล้ว");
      await load();
    } catch (error) {
      message.error(error.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <Table
        rowKey="membership_id"
        loading={loading}
        dataSource={rows}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          showSizeChanger: false,
          onChange: setPage,
        }}
        scroll={{ x: 1000 }}
        columns={[
          {
            title: "พนักงาน",
            key: "name",
            render: (_, row) => (
              <div>
                <div className="font-medium text-slate-800">
                  {[row.first_name, row.last_name].filter(Boolean).join(" ") || row.name}
                </div>
                <div className="text-xs text-slate-400">{row.email}</div>
              </div>
            ),
          },
          { title: "รหัสพนักงาน", dataIndex: "employee_code", width: 140 },
          {
            title: "อีเมล",
            key: "verified",
            width: 120,
            render: (_, row) => (
              <Tag color={row.email_verified_at ? "green" : "gold"}>
                {row.email_verified_at ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"}
              </Tag>
            ),
          },
          {
            title: "สถานะ",
            dataIndex: "status",
            width: 120,
            render: (status) => {
              const [label, color] = STATUS_META[status] || [status, "default"];
              return <Tag color={color}>{label}</Tag>;
            },
          },
          {
            title: "Role",
            key: "roles",
            width: 250,
            render: (_, row) => (
              <Select
                mode="multiple"
                className="w-full"
                value={row.roles || []}
                options={roles.map((role) => ({
                  value: role.name,
                  label: role.label || role.name,
                  disabled: role.can_assign === false,
                }))}
                disabled={!canManageRoles
                  || !row.can_change_roles
                  || row.status !== "active"
                  || savingId === row.membership_id}
                onChange={(values) => updateRoles(row.membership_id, values)}
              />
            ),
          },
          {
            title: "จัดการ",
            key: "actions",
            fixed: "right",
            width: 210,
            render: (_, row) => canManageMembers && row.can_change_status ? (
              <Space>
                {row.status === "pending" ? (
                  <>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      loading={savingId === row.membership_id}
                      onClick={() => confirmApproval(row)}
                    >
                      อนุมัติ
                    </Button>
                    <Button
                      danger
                      size="small"
                      onClick={() => updateStatus(row.membership_id, "rejected")}
                    >
                      ปฏิเสธ
                    </Button>
                  </>
                ) : null}
                {row.status === "active" && row.can_suspend !== false ? (
                  <Button
                    danger
                    size="small"
                    icon={<StopOutlined />}
                    onClick={() => updateStatus(row.membership_id, "suspended")}
                  >
                    ระงับ
                  </Button>
                ) : null}
                {row.status === "suspended" ? (
                  <Button
                    size="small"
                    onClick={() => confirmApproval(row)}
                  >
                    เปิดใช้งาน
                  </Button>
                ) : null}
              </Space>
            ) : null,
          },
        ]}
      />
    </Card>
  );
}

function InvitationsPanel() {
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [invitationRows, roleRows] = await Promise.all([
        accessAdminApi.invitations(),
        accessAdminApi.roles(),
      ]);
      setRows(invitationRows);
      setRoles(roleRows.filter((role) => role.can_assign));
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const invite = async (values) => {
    try {
      await accessAdminApi.invite(values);
      message.success("ส่งคำเชิญแล้ว");
      setOpen(false);
      form.resetFields();
      await load();
    } catch (error) {
      message.error(error.message);
    }
  };

  const action = async (id, type) => {
    try {
      if (type === "resend") await accessAdminApi.resendInvitation(id);
      else await accessAdminApi.revokeInvitation(id);
      message.success(type === "resend" ? "ส่งซ้ำแล้ว" : "เพิกถอนแล้ว");
      await load();
    } catch (error) {
      message.error(error.message);
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="primary" icon={<MailOutlined />} onClick={() => setOpen(true)}>
          เชิญสมาชิก
        </Button>
      </div>
      <Card className="rounded-2xl shadow-sm">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: "อีเมล", dataIndex: "email" },
            {
              title: "Role",
              dataIndex: "roles",
              render: (values) => (values || []).join(", "),
            },
            {
              title: "สถานะ",
              dataIndex: "status",
              render: (value) => <Tag>{value}</Tag>,
            },
            { title: "หมดอายุ", dataIndex: "expires_at" },
            {
              title: "",
              render: (_, row) => row.status === "pending" ? (
                <Space>
                  <Button size="small" onClick={() => action(row.id, "resend")}>ส่งซ้ำ</Button>
                  <Button danger size="small" onClick={() => action(row.id, "revoke")}>เพิกถอน</Button>
                </Space>
              ) : null,
            },
          ]}
        />
      </Card>
      <Modal title="เชิญสมาชิก" open={open} centered footer={null} onCancel={() => setOpen(false)}>
        <Form form={form} layout="vertical" onFinish={invite}>
          <Form.Item
            name="email"
            label="อีเมล"
            rules={[{ required: true, type: "email", message: "กรุณาระบุอีเมลที่ถูกต้อง" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="employeeCode"
            label="รหัสพนักงาน"
            normalize={(value) => String(value || "").replace(/\D/g, "").slice(0, 8)}
            rules={[
              { pattern: /^(\d{8})?$/, message: "รหัสพนักงานต้องเป็นตัวเลข 8 หลัก" },
            ]}
          >
            <Input inputMode="numeric" placeholder="ตัวเลข 8 หลัก" maxLength={8} />
          </Form.Item>
          <Form.Item name="roles" label="Role" rules={[{ required: true, message: "กรุณาเลือก Role" }]}>
            <Select
              mode="multiple"
              options={roles.map((role) => ({
                value: role.name,
                label: role.label || role.name,
              }))}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>ส่งคำเชิญ</Button>
        </Form>
      </Modal>
    </>
  );
}

function AuditPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    accessAdminApi.auditLogs({ page, limit: 50 })
      .then((result) => {
        if (!active) return;
        setRows(result.items);
        setTotal(result.total);
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

  return (
    <Card className="rounded-2xl shadow-sm">
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{
          current: page,
          pageSize: 50,
          total,
          showSizeChanger: false,
          onChange: setPage,
        }}
        scroll={{ x: 900 }}
        columns={[
          {
            title: "เวลา",
            dataIndex: "created_at",
            width: 190,
            render: (value) => formatDateTime(value),
          },
          {
            title: "ผู้ดำเนินการ",
            dataIndex: "actor_name",
            width: 180,
            render: (value) => value || "ระบบ",
          },
          { title: "เหตุการณ์", dataIndex: "action", width: 220 },
          {
            title: "เป้าหมาย",
            key: "target",
            width: 200,
            render: (_, row) => [row.entity_type, row.entity_id].filter(Boolean).join(" #") || "-",
          },
          {
            title: "รายละเอียด",
            dataIndex: "metadata_json",
            render: (value) => {
              if (!value) return "-";
              if (typeof value === "string") return value;
              return JSON.stringify(value);
            },
          },
        ]}
      />
    </Card>
  );
}

function RolesPanel() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    try {
      const [roleData, permissionData] = await Promise.all([
        accessAdminApi.roles(),
        accessAdminApi.permissions(),
      ]);
      setRoles(Array.isArray(roleData) ? roleData : roleData.items || []);
      setPermissions(Array.isArray(permissionData) ? permissionData : permissionData.items || []);
    } catch (error) {
      message.error(error.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const groups = {};
    for (const permission of permissions) {
      const group = permission.code?.split(".")[0] || "other";
      if (!groups[group]) groups[group] = [];
      groups[group].push(permission);
    }
    return groups;
  }, [permissions]);

  const editRole = (role) => {
    setSelectedRole(role);
    const codes = new Set(role.permissions || []);
    setSelectedPermissions(
      permissions.filter((permission) => codes.has(permission.code)).map((permission) => permission.id),
    );
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      await accessAdminApi.updateRolePermissions(selectedRole.id, selectedPermissions);
      message.success("บันทึก Permission แล้ว");
      setSelectedRole(null);
      await load();
    } catch (error) {
      message.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const createRole = async (values) => {
    setSaving(true);
    try {
      await accessAdminApi.createRole(values);
      message.success("สร้าง Role แล้ว");
      setCreateOpen(false);
      form.resetFields();
      await load();
    } catch (error) {
      message.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="primary" icon={<KeyOutlined />} onClick={() => setCreateOpen(true)}>
          สร้าง Custom Role
        </Button>
      </div>
      <Card className="rounded-2xl shadow-sm">
        <Table
          rowKey="id"
          dataSource={roles}
          pagination={false}
          columns={[
            {
              title: "Role",
              key: "name",
              render: (_, role) => (
                <div>
                  <div className="font-medium">{role.label || role.name}</div>
                  <div className="text-xs text-slate-400">{role.name}</div>
                </div>
              ),
            },
            {
              title: "Permission",
              key: "permission_count",
              render: (_, role) => `${(role.permissions || []).length} รายการ`,
            },
            {
              title: "ประเภท",
              key: "type",
              render: (_, role) => (
                <Tag color={role.is_system ? "blue" : "purple"}>
                  {role.is_system ? "Built-in" : "Custom"}
                </Tag>
              ),
            },
            {
              title: "",
              key: "action",
              align: "right",
              render: (_, role) => (
                <Button
                  onClick={() => editRole(role)}
                  disabled={!role.is_system && role.can_edit_permissions === false}
                >
                  {role.is_system ? "ดู Permission" : "จัดการ Permission"}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={`Permission · ${selectedRole?.name || ""}`}
        open={Boolean(selectedRole)}
        onCancel={() => setSelectedRole(null)}
        onOk={savePermissions}
        confirmLoading={saving}
        okButtonProps={{ disabled: selectedRole?.can_edit_permissions !== true }}
        okText={selectedRole?.can_edit_permissions ? "บันทึก" : "Built-in Role"}
        width={1200}
        centered
        styles={{ body: { maxHeight: "calc(100vh - 180px)", overflowY: "auto" } }}
      >
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message="สิทธิ์ทั้งหมดแสดงเป็นภาษาไทย และ Backend จะตรวจสอบลำดับระดับของผู้จัดการอีกครั้ง"
        />
        <Checkbox.Group
          className="w-full"
          value={selectedPermissions}
          onChange={setSelectedPermissions}
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 font-semibold text-slate-700">
                  {PERMISSION_GROUP_LABELS[group] || group}
                </div>
                <Space direction="vertical" size={8}>
                  {items.map((permission) => (
                    <Checkbox
                      key={permission.id}
                      value={permission.id}
                      disabled={selectedRole?.can_edit_permissions !== true
                        || permission.grantable_to_custom_role === false}
                    >
                      <div>
                        <div className="text-sm">{permission.description || permission.code}</div>
                        <div className="text-xs text-slate-400">{permission.code}</div>
                      </div>
                    </Checkbox>
                  ))}
                </Space>
              </div>
            ))}
          </div>
        </Checkbox.Group>
      </Modal>

      <Modal
        title="สร้าง Custom Role"
        open={createOpen}
        centered
        footer={null}
        onCancel={() => setCreateOpen(false)}
      >
        <Form form={form} layout="vertical" onFinish={createRole}>
          <Form.Item
            name="name"
            label="ชื่อ Role"
            rules={[{ required: true, message: "กรุณากรอกชื่อ Role" }]}
          >
            <Input placeholder="เช่น QA, Support, Team Lead" maxLength={100} />
          </Form.Item>
          <Form.Item name="description" label="คำอธิบาย">
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={saving}>
            สร้าง Role
          </Button>
        </Form>
      </Modal>
    </>
  );
}

export function AccessAdminPage({ user }) {
  const canReadMembers = hasPermission(user, "members.read")
    || hasPermission(user, "members.manage")
    || hasPermission(user, "roles.manage");
  const canManageMembers = hasPermission(user, "members.manage");
  const canManageRoles = hasPermission(user, "roles.manage");
  const canReadAudit = hasPermission(user, "audit.read");
  const items = [
    canReadMembers ? {
      key: "members",
      label: <span><TeamOutlined /> สมาชิก</span>,
      children: (
        <MembersPanel
          canManageMembers={canManageMembers}
          canManageRoles={canManageRoles}
        />
      ),
    } : null,
    canManageMembers ? {
      key: "invitations",
      label: <span><MailOutlined /> คำเชิญ</span>,
      children: <InvitationsPanel />,
    } : null,
    canManageRoles ? {
      key: "roles",
      label: <span><SafetyCertificateOutlined /> Role & Permission</span>,
      children: <RolesPanel />,
    } : null,
    canReadAudit ? {
      key: "audit",
      label: <span><SafetyCertificateOutlined /> Audit Log</span>,
      children: <AuditPanel />,
    } : null,
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title="สมาชิกและสิทธิ์"
        subtitle="อนุมัติพนักงาน จัดการ Role และ Permission ภายในบริษัทปัจจุบัน"
      />
      <Tabs items={items} />
    </div>
  );
}
