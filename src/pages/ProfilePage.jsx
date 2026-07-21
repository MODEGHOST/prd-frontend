import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Form,
  Input,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  EditOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { PageHeader } from "../components/ui/PageHeader";
import { ROLE_LABELS } from "../constants";
import { authApi } from "../services/api";

function resolveNameParts(user) {
  const first = String(user?.firstName || "").trim();
  const last = String(user?.lastName || "").trim();
  const full = String(user?.name || "").trim();

  if (first && last) {
    return { firstName: first, lastName: last };
  }
  if (first && !last && full.startsWith(first)) {
    return {
      firstName: first,
      lastName: full.slice(first.length).trim(),
    };
  }
  if (!first && !last && full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
    };
  }
  return { firstName: first, lastName: last };
}

function ProfileField({ label, value, hint }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-xs font-medium tracking-wide text-slate-500">{label}</div>
      <div className="break-words text-[15px] leading-6 font-medium text-slate-800">
        {value || <span className="font-normal text-slate-400">ยังไม่ได้ระบุ</span>}
      </div>
      {hint ? <div className="mt-1.5 text-[11px] leading-4 text-slate-400">{hint}</div> : null}
    </div>
  );
}

export function ProfilePage({ session, onSessionUpdate }) {
  const user = session?.user;
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameParts = useMemo(() => resolveNameParts(user), [user]);

  useEffect(() => {
    if (!user) return;
    form.setFieldsValue({
      telegramId: user.telegramId || "",
    });
  }, [form, user, editing]);

  const cancelEdit = () => {
    form.setFieldsValue({
      telegramId: user?.telegramId || "",
    });
    setEditing(false);
  };

  const save = async (values) => {
    setSaving(true);
    try {
      const data = await authApi.updateProfile({
        telegramId: values.telegramId || "",
      });
      message.success(data.message || "บันทึกข้อมูลแล้ว");
      onSessionUpdate?.({
        user: data.user,
        companies: data.companies || session.companies,
      });
      setEditing(false);
    } catch (error) {
      message.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const needsTelegram = !user.telegramId;
  const roleLabels = (user.roles || [])
    .map((role) => ROLE_LABELS[role] || role)
    .filter(Boolean);

  const identityFields = (
    <div className="grid gap-5 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2">
      <ProfileField label="ชื่อ" value={nameParts.firstName} />
      <ProfileField label="นามสกุล" value={nameParts.lastName} />
      <ProfileField label="ชื่อผู้ใช้" value={user.username} />
      <ProfileField
        label="อีเมล"
        value={user.email}
        hint="ใช้ยืนยันบัญชีและรีเซ็ตรหัสผ่าน"
      />
      <ProfileField label="รหัสพนักงาน" value={user.employeeCode} />
      <ProfileField label="บริษัท" value={user.companyName} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="ข้อมูลของฉัน"
        subtitle="ดูข้อมูลบัญชีที่สมัครไว้ และแก้ไข Telegram ID ได้เมื่อต้องการ"
        extra={
          editing ? (
            <Space wrap>
              <Button onClick={cancelEdit} disabled={saving}>
                ยกเลิก
              </Button>
              <Button type="primary" loading={saving} onClick={() => form.submit()}>
                บันทึก
              </Button>
            </Space>
          ) : (
            <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>
              แก้ไขข้อมูล
            </Button>
          )
        }
      />

      {needsTelegram && !editing ? (
        <Alert
          className="mb-6"
          type="info"
          showIcon
          message="ยังไม่ได้กรอก Telegram ID"
          description="กดแก้ไขข้อมูลเพื่อเพิ่ม Telegram ID ได้ทันที"
          action={
            <Button size="small" type="link" onClick={() => setEditing(true)}>
              แก้ไขเลย
            </Button>
          }
        />
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-red-50 px-6 py-7 md:px-8 md:py-8">
          <div className="flex flex-wrap items-center gap-5">
            <Avatar size={80} className="bg-red-700 text-2xl shadow-sm">
              {(user.name || nameParts.firstName || "?").slice(0, 1)}
            </Avatar>
            <div className="min-w-0">
              <Typography.Title level={3} className="!mb-2 !mt-0 !text-slate-800">
                {user.name || `${nameParts.firstName} ${nameParts.lastName}`.trim() || "-"}
              </Typography.Title>
              <div className="text-sm text-slate-500">@{user.username || "-"}</div>
              <Space wrap size={[8, 8]} className="mt-3">
                {roleLabels.map((label) => (
                  <Tag key={label} className="!mr-0" color="red">
                    {label}
                  </Tag>
                ))}
                {user.companyName ? <Tag className="!mr-0">{user.companyName}</Tag> : null}
              </Space>
            </div>
          </div>
        </div>

        <div className="px-6 py-7 md:px-8 md:py-8">
          {editing ? (
            <Form form={form} layout="vertical" onFinish={save} requiredMark="optional">
              <div className="mb-6">{identityFields}</div>

              <Form.Item
                name="telegramId"
                label="Telegram ID"
                extra="ไม่บังคับ — ใส่ได้ทั้ง @username หรือตัวเลข ID"
                rules={[
                  {
                    validator(_, value) {
                      if (!value) return Promise.resolve();
                      if (!/^@?[a-zA-Z0-9_]{3,64}$/.test(value)) {
                        return Promise.reject(new Error("รูปแบบ Telegram ID ไม่ถูกต้อง"));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input
                  prefix={<SendOutlined />}
                  size="large"
                  placeholder="@username หรือ 123456789"
                  allowClear
                />
              </Form.Item>
            </Form>
          ) : (
            <div className="space-y-6">
              {identityFields}
              <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <ProfileField
                    label="Telegram ID"
                    value={user.telegramId ? (
                      <span className="inline-flex items-center gap-2">
                        <SendOutlined className="text-slate-400" />
                        {user.telegramId}
                      </span>
                    ) : null}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
